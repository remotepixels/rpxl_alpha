const RX_DB = "IncomingFileCache";
const RX_STORE = "chunks";
let rxDB;
const rxWriteBuffers = new Map();
const RX_WRITE_BATCH = 32;
const RX_WRITE_DELAY = 25; // ms

function openRxDB() {
	if (rxDB) return rxDB;
	rxDB = new Promise((resolve, reject) => {
		const req = indexedDB.open(RX_DB, 1);
		req.onupgradeneeded = e => {
			e.target.result.createObjectStore(RX_STORE, { keyPath: "key" });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return rxDB;
}

//write file from memory to db
async function storeRxChunk(fileID, part, total, data) {
	let entry = rxWriteBuffers.get(fileID);

	if (!entry) {
		entry = { parts: [], timer: null };
		rxWriteBuffers.set(fileID, entry);
	}

	entry.parts.push({ part, total, data });

	if (entry.parts.length >= RX_WRITE_BATCH) {
		flushRxChunkBatch(fileID);
	} else if (!entry.timer) {
		entry.timer = setTimeout(() => flushRxChunkBatch(fileID), RX_WRITE_DELAY);
	}
}

//writes chunks from memeory to index db
async function flushRxChunkBatch(fileID) {
	const entry = rxWriteBuffers.get(fileID);
	if (!entry || !entry.parts.length) return;

	rxWriteBuffers.delete(fileID);

	const db = await openRxDB();
	const tx = db.transaction(RX_STORE, "readwrite");
	const store = tx.objectStore(RX_STORE);

	for (const p of entry.parts) {
		store.put({
			key: `${fileID}:${p.part}`,
			fileID,
			part: p.part,
			total: p.total,
			data: p.data,
			ts: Date.now()
		});
	}

	return new Promise((res, rej) => {
		tx.oncomplete = res;
		tx.onerror = () => rej(tx.error);
	});
}

//once file succesfully downloaded delete from index db
async function purgeRxChunks(fileID) {
	const meta = files[fileID];
	console.log("Download complete, purging cached files for", meta?.name || fileID);

	const db = await openRxDB();
	const tx = db.transaction(RX_STORE, "readwrite");
	const store = tx.objectStore(RX_STORE);

	const range = IDBKeyRange.bound(
		fileID + ":",
		fileID + ":\uffff"
	);

	return new Promise((resolve, reject) => {
		const req = store.openCursor(range);

		req.onsuccess = e => {
			const cursor = e.target.result;
			if (cursor) {
				cursor.delete();
				cursor.continue();
			} else {
				resolve();
			}
		};

		req.onerror = reject;
	});
}