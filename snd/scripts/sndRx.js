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

// Separate assembly logic for cleaner flow
async function assembleReceivedFile(fileID) {
	const file = incomingFiles.get(fileID);
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

				const BATCH = 8; // Load 8 chunks per read for better throughput
				let count = 0;
				const chunks = [];

				// Prefetch multiple chunks in parallel within transaction
				const chunkPromises = [];
				while (this.chunkIndex < file.total && count < BATCH) {
					const chunkIdx = this.chunkIndex;
					const key = `${fileID}:${chunkIdx}`;
					
					const promise = new Promise(res => {
						const req = store.get(key);
						req.onsuccess = () => {
							const data = req.result?.data;
							if (!data) throw new Error(`Missing chunk ${chunkIdx}`);
							res(new Uint8Array(data));
						};
						req.onerror = () => res(null);
					});
					
					chunkPromises.push(promise);
					this.chunkIndex++;
					count++;
				}

				// Wait for all chunks in batch
				const results = await Promise.all(chunkPromises);
				for (const chunk of results) {
					if (chunk) controller.enqueue(chunk);
				}

				// Wait for transaction to complete
				await new Promise((res, rej) => {
					tx.oncomplete = res;
					tx.onerror = () => rej(tx.error);
				});

				// Yield to main thread
				await new Promise(r => setTimeout(r, 0));

			} catch (e) {
				controller.error(e);
			}
		}
	});

	incomingFiles.delete(fileID);
	enqueueSWDownload(fileID, stream);
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
	const meta = files[fileID];

	try {
		// Check if service worker is available and controlled
		if (!navigator.serviceWorker) {
			throw new Error("Service Worker API not available");
		}

		if (!navigator.serviceWorker.controller) {
			console.warn("Service Worker not yet activated, waiting for controller...");
			
			// Wait for service worker to be ready and become controller
			const registration = await navigator.serviceWorker.ready;
			if (!registration.active) {
				throw new Error("Service Worker is not active");
			}
			
			// Give it a moment to take control
			await new Promise(r => setTimeout(r, 100));
			
			if (!navigator.serviceWorker.controller) {
				throw new Error("Service Worker failed to become controller after ready state");
			}
		}

		// Post stream to service worker for disk writing
		// Transfer stream ownership to SW to minimize memory in main thread
		navigator.serviceWorker.controller.postMessage({
			type: "download",
			fileID,
			filename,
			stream
		}, [stream]);

		console.log(`SW download initiated for ${filename} (${fileID})`);

		// Wait for SW to receive the message before continuing
		// This allows SW to start streaming to disk immediately
		await new Promise(r => setTimeout(r, 50));

		// Create iframe to trigger download (SW will handle the response)
		const iframe = document.createElement("iframe");
		iframe.style.display = "none";
		iframe.src = `/snd/download/${fileID}`;
		iframe.onload = () => {
			// Iframe loaded, SW should be writing the file
			// Schedule cleanup
			setTimeout(() => {
				try {
					document.body.removeChild(iframe);
				} catch (e) {
					// Already removed or doesn't exist
				}
			}, 5000); // Cleanup after 5s (should be done by then)
		};
		iframe.onerror = () => {
			console.error(`Download iframe error for ${filename}`);
			cleanupDownload(fileID);
		};
		document.body.appendChild(iframe);

		log("Saving file : ", filename);

		// Send completion notification to host after download initiated
		const host = meta?.uploadedBy;
		if (host) {
			sendToPeer(host, "download-complete", fileID);
		}

		// Yield to allow other operations (indexedDB, WebRTC) to complete
		await new Promise(r => setTimeout(r, 100));

		// Clean up and process next in queue
		cleanupDownload(fileID);

	} catch (err) {
		console.error("Error initiating download for", filename, ":", err);
		
		// Log SW state for debugging
		if (navigator.serviceWorker) {
			console.error("SW controller:", navigator.serviceWorker.controller ? "exists" : "null");
			navigator.serviceWorker.getRegistrations().then(regs => {
				console.error("SW registrations count:", regs.length);
				for (const reg of regs) {
					console.error("SW states - active:", !!reg.active, "waiting:", !!reg.waiting, "installing:", !!reg.installing);
				}
			});
		} else {
			console.error("Service Worker API not available");
		}
		
		cleanupDownload(fileID);
	}
}

// Centralized cleanup to prevent state inconsistencies
function cleanupDownload(fileID) {
	activeStreamers.delete(fileID);
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