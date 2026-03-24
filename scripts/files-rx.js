const swDownloadQueue = [];
let swDownloadBusy = false; 

//RECEIVER
function requestDownload(fileID, isFolder = false) {
	//folders
	if (isFolder) {
		const folderPath = fileID;  // fileID *is* a folder path here
		console.log(`Requesting folder : ${folderPath}`);

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
	if (!meta) return console.log("Requested file failed : no such file");

	const host = meta.uploadedBy;
	queueDownload(fileID, host, false);
	createFileProgressUI(fileID);
}

//FILE RECEIVING HANDLING
async function handleIncomingChunk(buffer) {
	//onChunkReceived(buffer.byteLength);  //used for speed
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
	const ACK_BATCH_DELAY = 5; // Wait up to 50ms to batch ACKs
	
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
		console.log(`All chunks received for ${fileID}: ${file.total} chunks, ${throughput} MB/s`);

		// Start assembly process
		assembleReceivedFile(fileID);
	}
}

function sendAckBatch(fileID) {
	const file = incomingFiles.get(fileID);
	if (!file || !file.pendingAckParts.length) return;

	if (file.ackTimerId) {
		clearTimeout(file.ackTimerId);
		file.ackTimerId = null;
	}

	const parts = file.pendingAckParts.splice(0, 64);

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

	if (!sw) {
		console.warn("SW not ready yet, retrying…");
		await new Promise(r => setTimeout(r, 100));
		return startSWDownload(fileID);
	}

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
	iframe.src = `/download/${fileID}`;
	document.body.appendChild(iframe);

	console.log("Saving to disk :", filename);
}
