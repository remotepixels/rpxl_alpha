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
		console.error("CRC Failed id:", fileID, "part", part, "of", total);
		return;
	}

	if (!incomingFiles.has(fileID)) {
		incomingFiles.set(fileID, {
			total,
			received: new Set(),
			pendingAckParts: [],
			ackTimerId: null,
			completed: false,
			assembling: false,
			startTime: Date.now(),
			bytesReceived: 0
		});
	}

	const file = incomingFiles.get(fileID);

	// Skip duplicate chunks
	if (file.received.has(part)) {
		return;
	}

	// Store chunk to IndexedDB
	try {
		await storeRxChunk(fileID, part, total, chunk);
		file.received.add(part);
		file.bytesReceived += chunk.byteLength;
		updateFileProgressUI(fileID, (file.received.size / file.total) * 100);
	} catch (err) {
		console.error("Failed to store chunk:", err);
		return;
	}

	// Batch ACKs: collect parts and send periodically to reduce network overhead
	file.pendingAckParts.push(part);
	
	// Clear existing timer and set new one
	if (file.ackTimerId) clearTimeout(file.ackTimerId);
	
	const ACK_BATCH_SIZE = 32; // ACK up to 32 parts at once
	const ACK_BATCH_DELAY = 50; // Wait up to 50ms to batch ACKs
	
	if (file.pendingAckParts.length >= ACK_BATCH_SIZE) {
		// Send immediately if batch full
		sendAckBatch(fileID);
	} else {
		// Otherwise defer to batch with other chunks
		file.ackTimerId = setTimeout(() => sendAckBatch(fileID), ACK_BATCH_DELAY);
	}

	// Check if download complete
	if (file.received.size === file.total && !file.completed && !file.assembling) {
		// Cancel any pending ACK timer since we're done receiving
		if (file.ackTimerId) clearTimeout(file.ackTimerId);
		
		file.completed = true;
		file.assembling = true;

		const elapsed = Date.now() - file.startTime;
		const throughput = (file.bytesReceived / (elapsed / 1000) / 1024 / 1024).toFixed(2);
		console.debug(`All chunks received for ${fileID}: ${file.total} chunks, ${throughput} MB/s`);

		// Start assembly process
		assembleReceivedFile(fileID);
	}
}

// Batch and send ACKs to reduce network overhead
function sendAckBatch(fileID) {
	const file = incomingFiles.get(fileID);
	if (!file || !file.pendingAckParts.length) return;

	if (file.ackTimerId) {
		clearTimeout(file.ackTimerId);
		file.ackTimerId = null;
	}

	const parts = file.pendingAckParts.splice(0, 64); // Take up to 64 parts
	
	sendToPeer(files[fileID]?.uploadedBy, "ACK-chunks", {
		fileID,
		parts
	});
	
	console.debug(`ACK batch: ${parts.length} chunks for ${fileID}`);
}

async function assembleReceivedFile(fileID) {
	const file = incomingFiles.get(fileID);
	if (!file) return;

	console.debug(`File ready in IndexedDB: ${fileID}`);

	// mark complete locally
	incomingFiles.delete(fileID);

	// queue download via SW
	enqueueSWDownload(fileID);
}

//RECIEVER CACHE DB
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
// const ackWaiters = {}; // key = `${id}:${group}` -> resolve()
let downloadState = new Map();	//tracks state of each file in queue (queued, active, stopped, done)
let activeFileDownloads = 0;     //download queue files currently running
const MAX_PARALLEL_DOWNLOADS = 4; // download queue max concurrent files
// const activeStreamers = new Map();

//add to queue to download
function queueDownload(fileID, host, fromFolder = false) {
	const state = downloadState.get(fileID);

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

// Receiver: cancel a download
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

function enqueueSWDownload(fileID) {
	swDownloadQueue.push({ fileID });
	processSWQueue();
}


function processSWQueue() {
	if (swDownloadBusy) return;
	if (!swDownloadQueue.length) return;

	swDownloadBusy = true;

const { fileID } = swDownloadQueue.shift();
startSWDownload(fileID);


}

async function startSWDownload(fileID) {
	const filename = files[fileID]?.name || fileID;

	const sw = navigator.serviceWorker.controller;
	if (!sw) throw new Error("No SW controller");

	const channel = new MessageChannel();

	const readyPromise = new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error("SW prepare timeout")), 5000);

		channel.port1.onmessage = (event) => {
			if (event.data?.type === "download-ready" && event.data.fileID === fileID) {
				clearTimeout(timeout);
				resolve();
			}
		};
	});

	// send message WITH reply port
	sw.postMessage({
		type: "prepare-download",
		fileID,
		filename
	}, [channel.port2]);

	await readyPromise;

	// safe navigation
	const iframe = document.createElement("iframe");
	iframe.style.display = "none";
	iframe.src = `/snd/download/${fileID}`;
	document.body.appendChild(iframe);

	console.log("Download started safely:", filename);
}



// Centralized cleanup to prevent state inconsistencies
function cleanupDownload(fileID) {
	// activeStreamers.delete(fileID);
	downloadState.delete(fileID);
	activeFileDownloads = Math.max(0, activeFileDownloads - 1);
	
	markDownloadCompleted(fileID);
	
	// Purge cached chunks from IndexedDB to free space, but allow async
	// so it doesn't block the next download from starting
	purgeRxChunks(fileID).catch(err => 
		console.error("Error purging cache for", fileID, ":", err)
	);

	// Reset busy flag and process next download
	swDownloadBusy = false;
	processSWQueue();
}