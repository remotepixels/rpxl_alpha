self.addEventListener('install', event => {
	self.skipWaiting(); // activate immediately
	console.log("Installing service SW");
});


self.addEventListener('activate', event => {
	event.waitUntil((async () => {
		await self.clients.claim(); // take control of clients immediately
	})());
	console.log("Activate service SW");
});

const downloads = new Map();
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000; // 5 minute timeout for abandoned downloads
const RX_DB = "IncomingFileCache";
const RX_STORE = "chunks";

let rxDBPromise = null;

function openRxDB() {
	if (rxDBPromise) return rxDBPromise;

	rxDBPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(RX_DB, 1);

		req.onupgradeneeded = e => {
			// DB already exists from page — do nothing
			// SW must NOT redefine schema
			console.log("SW: DB upgrade (ignored)");
		};

		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});

	return rxDBPromise;
}

async function readChunkBatch(db, fileID, start, count) {
	return new Promise((resolve, reject) => {

		const tx = db.transaction(RX_STORE, "readonly");
		const store = tx.objectStore(RX_STORE);

		const results = new Array(count);
		let remaining = count;

		for (let i = 0; i < count; i++) {
			const index = start + i;
			const req = store.get(`${fileID}:${index}`);

			req.onsuccess = () => {
				results[i] = req.result?.data || null;
				if (--remaining === 0) resolve(results);
			};

			req.onerror = () => reject(req.error);
		}
	});
}

self.addEventListener("message", event => {
	const { type, fileID, filename } = event.data || {};

	if (type === "prepare-download") {

		console.log("SW: prepared", fileID);

		downloads.set(fileID, {
			filename,
			activeReaders: 0,
			completed: false
		});

		const port = event.ports[0];
		if (port) {
			port.postMessage({
				type: "download-ready",
				fileID
			});
		}

	}
});


self.addEventListener("fetch", event => {
	const url = new URL(event.request.url);

	if (!url.pathname.startsWith("/snd/download/")) return;

	event.respondWith(streamDownload(url));
});

async function streamDownload(url) {
	const fileID = url.pathname.split("/").pop();

	const entry = downloads.get(fileID);
	if (!entry) return new Response("Not prepared", { status: 404 });

	entry.activeReaders++;
	console.log("SW: streaming file", fileID);

	const db = await openRxDB();

	let part = 0;
	const BATCH = 64;          // tune later
	let buffer = [];
	let done = false;

	const stream = new ReadableStream({
		async pull(controller) {

			if (buffer.length === 0 && !done) {

				const batch = await readChunkBatch(db, fileID, part, BATCH);

				let valid = 0;

				for (const chunk of batch) {
					if (!chunk) {
						done = true;
						break;
					}
					buffer.push(new Uint8Array(chunk));
					valid++;
				}

				part += valid;

				if (valid === 0) done = true;
			}

			if (buffer.length) {
				controller.enqueue(buffer.shift());
				return;
			}

			entry.activeReaders--;

			if (entry.activeReaders === 0 && entry.completed) {
				downloads.delete(fileID);
			}


			controller.close();
			entry.completed = true;
			notifyComplete(fileID, entry.filename);


		}
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "application/octet-stream",
			"Content-Disposition":
				`attachment; filename="${entry.filename}"; filename*=UTF-8''${encodeURIComponent(entry.filename)}`,
			"Cache-Control": "no-store"
		}
	});
}

function notifyComplete(fileID, filename) {
	self.clients.matchAll().then(clients => {
		for (const client of clients) {
			client.postMessage({
				type: "download-finished",
				fileID,
				filename
			});
		}
	});
}

function notifyError(fileID, filename, err) {
	self.clients.matchAll().then(clients => {
		for (const client of clients) {
			client.postMessage({
				type: "download-error",
				fileID,
				filename,
				error: err.message
			});
		}
	});
}

// self.addEventListener("message", event => {
// 	const { type, fileID, filename } = event.data || {};

// 	if (type === "prepare-download") {
// 		console.log("SW: prepared", fileID);

// 		downloads.set(fileID, {
// 			filename,
// 			activeReaders: 0,
// 			completed: false
// 		});

// 	}
// });
