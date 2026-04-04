const swDownloadQueue = []; //service worker queue not main download queue
let activeSWDownloads = 0;
const MAX_SW_DOWNLOADS = 4;

//RECEIVER
function requestDownload(fileID, isFolder = false) {
	if (isFolder) {
		const folderPath = fileID;
		console.log(`Requesting folder: ${folderPath}`);

		const fileIDs = Object.keys(files).filter(id => {
			const f = files[id];
			return f && f.folderPath && f.folderPath.startsWith(folderPath);
		});

		for (const id of fileIDs) {
			const meta = files[id];
			if (!meta) continue;

			queueDownload(id, meta.uploadedBy, true);
			createFileProgressUI(id);
		}
		return;
	}

	const meta = files[fileID];
	if (!meta) {
		console.warn("Requested file failed: no such file", fileID);
		return;
	}

	queueDownload(fileID, meta.uploadedBy, false);
	prepareWritable(fileID);
	createFileProgressUI(fileID);
}

//for chrome only?!?!?!
async function prepareWritable(fileID) {
	const meta = files[fileID];

	if (!window.showSaveFilePicker) {
		console.warn("FS API not supported, fallback to SW");
		return;
	}

	try {
		const handle = await window.showSaveFilePicker({
			suggestedName: meta?.name || fileID
		});

		const writable = await handle.createWritable();

		let file = incomingFiles.get(fileID);
		if (!file) {
			file = {};
			incomingFiles.set(fileID, file);
		}

		file.writable = writable;
		file.writeReady = true;

		console.log("Writable ready for", fileID);

	} catch (err) {
		if (err.name !== "AbortError") {
			console.error("FS API error:", err);
		}
	}
}

function createIncomingFile(total) {
	return {
		total,
		received: new Set(),
		buffer: new Map(),
		nextWriteIndex: 0,
		writable: null,
		writeReady: false,
		writing: false,
		bytesReceived: 0,
		startTime: Date.now(),
		pendingAckParts: [],
		ackTimerId: null,
		completed: false
	};
}

async function handleIncomingChunk(buffer) {
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
		console.error("CRC failed:", fileID, part);
		return;
	}

	let file = incomingFiles.get(fileID);
	if (!file) {
		file = createIncomingFile(total);
		incomingFiles.set(fileID, file);
	}

	if (file.received.has(part)) return;

	file.received.add(part);
	file.bytesReceived += chunk.byteLength;

	updateFileProgressUI(fileID, (file.received.size / file.total) * 100);

	if (part === file.nextWriteIndex && file.writeReady && file.writable) {
		await writeChunkAndFlush(file, fileID, chunk);
	} else {
		// store only if out-of-order
		file.buffer.set(part, chunk);
	}

	// ACK batching
	queueAck(fileID, part);

	// completion
	if (file.received.size === file.total && !file.completed) {
		file.completed = true;

		if (file.writable) {
			await flushRemaining(file, fileID);
			await file.writable.close();

			console.log("Saved:", fileID);

			incomingFiles.delete(fileID);
			markDownloadCompleted(fileID);
		} else {
			assembleFallback(fileID);
		}

		const elapsed = Date.now() - file.startTime;
		const throughput = (file.bytesReceived / (elapsed / 1000) / 1024 / 1024).toFixed(2);
		console.log(`All chunks received for ${fileID}: ${file.total} chunks, ${throughput} MB/s`);


	activeFileDownloads = Math.max(0, activeFileDownloads - 1);
	//processDownloadQueue();
	}
}

async function writeChunkAndFlush(file, fileID, chunk) {
	if (file.writing) {
		file.buffer.set(file.nextWriteIndex, chunk);
		return;
	}

	file.writing = true;

	try {
		// write current
		await file.writable.write(chunk);
		file.nextWriteIndex++;

		// flush buffered in-order chunks
		while (file.buffer.has(file.nextWriteIndex)) {
			const nextChunk = file.buffer.get(file.nextWriteIndex);
			file.buffer.delete(file.nextWriteIndex);

			await file.writable.write(nextChunk);
			file.nextWriteIndex++;
		}

	} catch (err) {
		console.error("Write error:", err);
	} finally {
		file.writing = false;
	}
}

async function flushRemaining(file, fileID) {
	while (file.buffer.has(file.nextWriteIndex)) {
		const chunk = file.buffer.get(file.nextWriteIndex);
		file.buffer.delete(file.nextWriteIndex);

		await file.writable.write(chunk);
		file.nextWriteIndex++;
	}
}

function queueAck(fileID, part) {
	const file = incomingFiles.get(fileID);
	if (!file) return;

	file.pendingAckParts.push(part);

	if (file.ackTimerId) clearTimeout(file.ackTimerId);

	const ACK_BATCH_SIZE = 32;
	const ACK_DELAY = 20;

	if (file.pendingAckParts.length >= ACK_BATCH_SIZE) {
		sendAckBatch(fileID);
	} else {
		file.ackTimerId = setTimeout(() => sendAckBatch(fileID), ACK_DELAY);
	}
}

function assembleFallback(fileID) {
	const file = incomingFiles.get(fileID);
	if (!file) return;

	const buffers = [];

	for (let i = 0; i < file.total; i++) {
		buffers.push(file.buffer.get(i));
	}

	const blob = new Blob(buffers);

	triggerBrowserDownload(blob, files[fileID]?.name || fileID);

	incomingFiles.delete(fileID);
	markDownloadCompleted(fileID);

}


function sendAckBatch(fileID) {
	const file = incomingFiles.get(fileID);
	if (!file || file.pendingAckParts.length === 0) return;

	if (file.ackTimerId) {
		clearTimeout(file.ackTimerId);
		file.ackTimerId = null;
	}

	const parts = file.pendingAckParts.splice(0, 64);

	const host = files[fileID]?.uploadedBy;
	if (!host) return;

	sendToPeer(host, "ACK-chunks", { fileID, parts });
}

// async function tryWriteChunks(fileID) {
// 	const file = incomingFiles.get(fileID);
// 	if (!file || !file.writable || file.writing) return;

// 	file.writing = true;

// 	try {
// 		while (true) {
// 			const next = file.nextWriteIndex;

// 			let chunk = file.useMemoryOnly
// 				? file.chunks.get(next)
// 				: await getRxChunk(fileID, next);

// 			if (!chunk) break;

// 			await file.writable.write(chunk);

// 			if (file.useMemoryOnly) {
// 				file.chunks.delete(next);
// 			} else {
// 				deleteRxChunk(fileID, next).catch(console.error);
// 			}

// 			file.nextWriteIndex++;
// 		}
// 	} catch (err) {
// 		console.error("Write error:", err);
// 	} finally {
// 		file.writing = false;
// 	}
// }

// async function assembleReceivedFile(fileID) {
// 	const file = incomingFiles.get(fileID);
// 	if (!file) return;

// 	if (file.useMemoryOnly) {
// 		//assemble directly from memory
// 		const buffers = [];

// 		for (let i = 0; i < file.total; i++) {
// 			buffers.push(file.chunks.get(i));
// 		}

// 		const blob = new Blob(buffers);

// 		triggerBrowserDownload(blob, files[fileID]?.name || fileID);

// 		console.log("Saved (memory):", fileID);

// 		incomingFiles.delete(fileID);

// 		markDownloadCompleted(fileID);
// 		activeFileDownloads = Math.max(0, activeFileDownloads - 1);
// 		processDownloadQueue();

// 		return;
// 	}

// 	//await flushAllRxChunks(fileID);

// 	console.debug(`File ready in IndexedDB: ${fileID}`);

// 	activeFileDownloads = Math.max(0, activeFileDownloads - 1);
// 	processDownloadQueue();

// 	markDownloadSaving(fileID);

// 	enqueueSWDownload(fileID);
// }

function triggerBrowserDownload(blob, filename) {
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();

	URL.revokeObjectURL(url);
}

// function enqueueSWDownload(fileID) {
// 	swDownloadQueue.push({ fileID });
// 	processSWQueue();
// }


// function processSWQueue() {
// 	while (activeSWDownloads < MAX_SW_DOWNLOADS && swDownloadQueue.length) {

// 		const { fileID } = swDownloadQueue.shift();

// 		activeSWDownloads++;
// 		startSWDownload(fileID);
// 	}
// }

// async function startSWDownload(fileID) {
// 	const filename = files[fileID]?.name || fileID;

// 	const sw = navigator.serviceWorker.controller;

// 	if (!sw) {
// 		await new Promise(r => setTimeout(r, 100));
// 		return startSWDownload(fileID);
// 	}

// 	const channel = new MessageChannel();

// 	try {
// 		const readyPromise = new Promise((resolve, reject) => {
// 			const timeout = setTimeout(() => reject(new Error("SW prepare timeout")), 15000);

// 			channel.port1.onmessage = (event) => {
// 				if (event.data?.type === "download-ready" && event.data.fileID === fileID) {
// 					clearTimeout(timeout);
// 					resolve();
// 				}
// 			};
// 		});

// 		sw.postMessage({
// 			type: "prepare-download",
// 			fileID,
// 			filename
// 		}, [channel.port2]);

// 		await readyPromise;

// 		const iframe = document.createElement("iframe");
// 		iframe.style.display = "none";
// 		iframe.src = `/download/${fileID}`;
// 		document.body.appendChild(iframe);

// 		console.log("Saving:", filename);

// 	} catch (err) {
// 		console.error("SW download failed:", err);
// 	} finally {
// 		activeSWDownloads = Math.max(0, activeSWDownloads - 1);
// 		processSWQueue();
// 	}
// }