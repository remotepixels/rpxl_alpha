//RECEIVER
function requestDownload(fileID, isFolder = false) {
	//folders
	if (isFolder) {
		const folderPath = fileID;  // fileID *is* a folder path here
		log(`Requesting folder : ${folderPath}`);

		// Find all files whose folderPath starts with this folder
		const fileIDs = Object.keys(files).filter(id =>
			files[id].folderPath.startsWith(folderPath)
		);

		for (const id of fileIDs) {
			const meta = files[id];
			const host = meta.uploadedBy;

			queueDownload(id, host, true);
			createFileProgressUI(id);
		}
		return;
	}
	//single file
	const meta = files[fileID];
	if (!meta) return log("Requested file failed : no such file");

	const host = meta.uploadedBy;
	queueDownload(fileID, host, false);
	createFileProgressUI(fileID);
}

//FILE RECEIVING HANDLING
async function handleIncomingChunk(buffer) {
	onChunkReceived(buffer.byteLength);
	//console.warn("Received RAW");
	const view = new DataView(buffer);
	let offset = 0;

	const part = view.getUint32(offset, true); offset += 4;
	const total = view.getUint32(offset, true); offset += 4;
	const idLen = view.getUint32(offset, true); offset += 4;

	const idBytes = new Uint8Array(buffer, offset, idLen);
	const fileID = new TextDecoder().decode(idBytes);
	offset += idLen;

	const crcExpected = view.getUint32(offset, true); offset += 4;
	const chunk = buffer.slice(offset);

	const crcActual = crc32(new Uint8Array(chunk));
	if (crcActual !== crcExpected) {
		console.warn("CRC Failed id:", fileID, "part", part, " of", total)
		return;
	}

	if (!incomingFiles.has(fileID)) {
		incomingFiles.set(fileID, {
			total,
			received: new Set(),
			lastAckCount: 0,
			completed: false,
			assembling: false
		});
	}

	const file = incomingFiles.get(fileID);

	if (!file.received.has(part)) {
		await storeRxChunk(fileID, part, file.total, chunk);
		file.received.add(part);
		updateFileProgressUI(fileID, (file.received.size / file.total) * 100);
	}

	//send ACK if new chunks arrived
	if (file.received.size !== file.lastAckCount) {
		file.lastAckCount = file.received.size;

		sendToPeer(files[fileID]?.uploadedBy, "ACK-chunks", {
			fileID,
			parts: [part]
		});
	}

	if (!file.completed && file.received.size === file.total) {
		if (file.assembling) return;
		file.assembling = true;

		const stream = new ReadableStream({
			async pull(controller) {
				try {
					if (!this.chunkIndex) this.chunkIndex = 0;

					if (this.chunkIndex >= file.total) {
						controller.close();
						return;
					}

					const db = await openRxDB();
					const tx = db.transaction(RX_STORE, "readonly");
					const store = tx.objectStore(RX_STORE);

					let count = 0;

					while (this.chunkIndex < file.total && count < BATCH) {
						const key = `${fileID}:${this.chunkIndex}`;

						const chunk = await new Promise(res => {
							const req = store.get(key);
							req.onsuccess = () => res(req.result?.data);
						});

						if (!chunk) throw new Error("Missing chunk " + this.chunkIndex);

						controller.enqueue(new Uint8Array(chunk));

						this.chunkIndex++;
						count++;
					}

					// IMPORTANT: wait for tx to finish before returning
					await new Promise((res, rej) => {
						tx.oncomplete = res;
						tx.onerror = () => rej(tx.error);
					});

					// Yield so WebRTC + UI can breathe
					await new Promise(r => setTimeout(r, 0));

				} catch (e) {
					controller.error(e);
				}
			}
		});

		file.completed = true;
		incomingFiles.delete(fileID);

		enqueueSWDownload(fileID, stream);
	}
}

//RECIEVER CACHE DB
const RX_DB = "IncomingFileCache";
const RX_STORE = "chunks";
let rxDB;

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

async function storeRxChunk(fileID, part, total, data) {
	const db = await openRxDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(RX_STORE, "readwrite");
		const store = tx.objectStore(RX_STORE);

		store.put({
			key: `${fileID}:${part}`,
			fileID,
			part,
			total,
			data,
			ts: Date.now()
		});

		tx.oncomplete = resolve;
		tx.onerror = () => reject(tx.error);
	});
}

async function getRxChunk(fileID, part) {
	const db = await openRxDB();
	return new Promise(res => {
		const tx = db.transaction(RX_STORE);
		const req = tx.objectStore(RX_STORE).get(`${fileID}:${part}`);
		req.onsuccess = () => res(req.result?.data);
	});
}

async function purgeRxChunks(fileID) {
	const meta = files[fileID];
	log("Purging cached files for", meta?.name || fileID);

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

//DOWNLOAD QUEUE
const ackWaiters = {}; // key = `${id}:${group}` -> resolve()
let downloadState = new Map();	//tracks state of each file in queue (queued, active, stopped, done)
let activeFileDownloads = 0;     //download queue files currently running
const MAX_PARALLEL_DOWNLOADS = 4; // download queue max concurrent files
const activeStreamers = new Map();

//add to queue to download
function queueDownload(fileID, host, fromFolder = false) {
	const state = downloadState.get(fileID);

	// Only reset RX if this is a truly fresh enqueue
	// if (state !== "active" && state !== "queued") {
	// 	incomingFiles.delete(fileID);
	// 	purgeRxChunks(fileID);
	// 	log("Removing any cached data for :", files[fileID].name);
	// }

	// Prevent duplicate queue entries
	if (state === "queued" || state === "active") return;

	downloadQueue.push({ fileID, host, fromFolder });
	downloadState.set(fileID, "queued");

	processDownloadQueue();
}

function processDownloadQueue() {
	if (activeFileDownloads >= MAX_PARALLEL_DOWNLOADS) return;

	while (activeFileDownloads < MAX_PARALLEL_DOWNLOADS && downloadQueue.length) {

		const job = downloadQueue.shift();
		const state = downloadState.get(job.fileID);

		if (state !== "queued") continue;

		startFileDownload(job.fileID, job.host, job.fromFolder);
	}
}

function startFileDownload(fileID, host, fromFolder) {
	if (downloadState.get(fileID) === "stopped") return;

	activeFileDownloads++;
	downloadState.set(fileID, "active");

	const meta = files[fileID];
	if (!meta) {
		activeFileDownloads--;
		downloadState.delete(fileID);
		return processDownloadQueue();
	}

	if (fromFolder) meta.fromFolderRequest = true;

	sendToPeer(host, "request-file", {
		id: fileID,
		isFolder: fromFolder
	});

	enableWakeLock();
	log(`Requesting file: ${meta.name} - from : ${meta.uploadedBy}`);
}

// // Receiver: cancel a download
function cancelDownload(fileID) {
	const wasActive = downloadState.get(fileID) === "active";
	const meta = files[fileID];

	if (meta && meta.uploadedBy) {
		sendAbortAck(fileID);
	}

	downloadQueue = downloadQueue.filter(q => q.fileID !== fileID);    // Remove any queued entries for this file
	downloadState.set(fileID, "stopped");
	incomingFiles.delete(fileID);

	updateFileProgressUI(fileID, 0); // or show cancelled state

	for (const key of Object.keys(ackWaiters)) {
		if (key.startsWith(`${fileID}:`)) {
			try { ackWaiters[key](false); } catch (e) { }
			delete ackWaiters[key];
		}
	}

	if (wasActive) {
		activeFileDownloads = Math.max(0, activeFileDownloads - 1);
		processDownloadQueue();
	}

}

function sendAbortAck(fileID) {
	if (downloadState.get(fileID) !== "active") return;

	const meta = files[fileID];
	if (!meta || !meta.uploadedBy) return;

	const incoming = incomingFiles.get(fileID);
	if (!incoming || !incoming.total) return;
	if (incoming.completed) return;

	// ACK every chunk index [0 .. total-1]
	const allParts = Array.from({ length: incoming.total }, (_, i) => i);

	log("Sending cancel to:", meta.uploadedBy, "for file:", meta.name, "total parts:", allParts.length);

	sendToPeer(meta.uploadedBy, "ACK-chunks", {
		fileID,
		parts: allParts,
		cancelled: true
	});
}

function enqueueSWDownload(fileID, stream) {
	swDownloadQueue.push({ fileID, stream });
	processSWQueue();
}

function processSWQueue() {
	if (swDownloadBusy) return;
	if (!swDownloadQueue.length) return;

	swDownloadBusy = true;

	const { fileID, stream } = swDownloadQueue.shift();
	startSWDownload(fileID, stream);
}

async function startSWDownload(fileID, stream) {
	const filename = files[fileID]?.name || fileID;

	navigator.serviceWorker.controller.postMessage({
		type: "download",
		fileID,
		filename,
		stream
	}, [stream]);

	// tiny delay so SW receives message before fetch
	await new Promise(r => setTimeout(r, 0));

	const iframe = document.createElement("iframe");
	iframe.style.display = "none";
	iframe.src = `/snd/download/${fileID}`;
	document.body.appendChild(iframe);

	// optional cleanup
	setTimeout(() => iframe.remove(), 60_000);

	log("Saving file : ", filename);

	const host = files[fileID]?.uploadedBy;
	sendToPeer(host, "download-complete", fileID);

	activeStreamers.delete(fileID);

	downloadState.delete(fileID);
	activeFileDownloads = Math.max(0, activeFileDownloads - 1);
	markDownloadCompleted(fileID);
	processDownloadQueue();
}