const swDownloadQueue = []; //service worker queue not main download queue
let activeSWDownloads = 0;
const MAX_SW_DOWNLOADS = 4;

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
	//prepareWritable(fileID);
	const host = meta.uploadedBy;
	queueDownload(fileID, host, false);
	createFileProgressUI(fileID);

}

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

		const file = incomingFiles.get(fileID);
		if (file) {
			file.writable = writable;
			file.writeReady = true;
		}

		console.log("Writable ready for", fileID);

	} catch (err) {
		if (err.name === "AbortError") {
			console.log("User cancelled save dialog");
		} else {
			console.log("FS API error:", err);
		}
	}
}

//FILE RECEIVING HANDLING
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
		console.error("CRC Failed id:", fileID, "part", part, "of", total);
		return;
	}

	let file = incomingFiles.get(fileID);

	if (!file) {
		file = {
			total,
			received: new Set(),
			chunks: new Map(),
			useMemoryOnly: total === 1,
			pendingAckParts: [],
			ackTimerId: null,
			completed: false,
			assembling: false,
			startTime: Date.now(),
			bytesReceived: 0,
			nextWriteIndex: 0,
		};
		incomingFiles.set(fileID, file);
	} else {

		file.total = total;
	}

	if (file.received.has(part)) {
		return;
	}

	// Store chunk to IndexedDB
	try {
		if (file.useMemoryOnly) {
			file.chunks.set(part, chunk);
		} else {
			await storeRxChunk(fileID, part, total, chunk);
		}
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
	const ACK_BATCH_DELAY = 2; // Wait up to 50ms to batch ACKs

	if (file.pendingAckParts.length >= ACK_BATCH_SIZE) {
		// Send immediately if batch full
		sendAckBatch(fileID);
	} else {
		// Otherwise defer to batch with other chunks
		file.ackTimerId = setTimeout(() => sendAckBatch(fileID), ACK_BATCH_DELAY);
	}

	if (file.received.size === file.total && !file.completed) {
		file.completed = true;

		assembleReceivedFile(fileID);

		const elapsed = Date.now() - file.startTime;
		const throughput = (file.bytesReceived / (elapsed / 1000) / 1024 / 1024).toFixed(2);
		console.log(`All chunks received for ${fileID}: ${file.total} chunks, ${throughput} MB/s`);

		activeFileDownloads = Math.max(0, activeFileDownloads - 1);
		processDownloadQueue();
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

	//console.debug(`ACK batch: ${parts.length} chunks for ${fileID}`);
}

async function assembleReceivedFile(fileID) {
	const file = incomingFiles.get(fileID);
	if (!file) return;

	if (file.useMemoryOnly) {
		//assemble directly from memory
		const buffers = [];

		for (let i = 0; i < file.total; i++) {
			buffers.push(file.chunks.get(i));
		}

		const blob = new Blob(buffers);

		triggerBrowserDownload(blob, files[fileID]?.name || fileID);

		console.log("Saved (memory):", fileID);

		incomingFiles.delete(fileID);

		markDownloadCompleted(fileID);
		activeFileDownloads = Math.max(0, activeFileDownloads - 1);
		processDownloadQueue();

		return;
	}
	await flushAllRxChunks(fileID);

	console.debug(`File ready in IndexedDB: ${fileID}`);

	activeFileDownloads = Math.max(0, activeFileDownloads - 1);
	processDownloadQueue();

	markDownloadSaving(fileID);

	enqueueSWDownload(fileID);
}

function triggerBrowserDownload(blob, filename) {
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();

	URL.revokeObjectURL(url);
}

function enqueueSWDownload(fileID) {
	swDownloadQueue.push({ fileID });
	processSWQueue();
}


async function processSWQueue() {
	while (activeSWDownloads < MAX_SW_DOWNLOADS && swDownloadQueue.length) {

		const { fileID } = swDownloadQueue.shift();

		activeSWDownloads++;
		await startSWDownload(fileID);
	}
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
		const timeout = setTimeout(() => reject(new Error("SW prepare timeout")), 15000);

		channel.port1.onmessage = (event) => {
			if (event.data?.type === "download-ready" && event.data.fileID === fileID) {
				clearTimeout(timeout);
				resolve();
			}
		};
	});

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


async function startDLWorker() {
	if (!navigator.serviceWorker) {
		console.warn("Service Worker not supported in this browser");
		return;
	}

	try {
		const registration = await navigator.serviceWorker.register("/files-swdownloader.js", {
			scope: "/"
		});

		console.log("SW registered");

		// 🚨 THIS is the key part
		await navigator.serviceWorker.ready;

		// Wait until SW actually controls THIS page
		if (!navigator.serviceWorker.controller) {
			console.log("Waiting for SW control...");

			await new Promise(resolve => {
				navigator.serviceWorker.addEventListener(
					"controllerchange",
					() => {
						console.log("Service Worker took control");
						resolve();
					},
					{ once: true }
				);
			});
		} else {
			console.log("Service Worker already controlling page");
		}

		console.log("SW fully ready and controlling");

	} catch (error) {
		console.log("Service Worker registration failed:", error);
	}
}