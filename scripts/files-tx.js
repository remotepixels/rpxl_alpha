const transfers = new Map(); // fileID -> TransferState
const chunkSize = 64 * 1024;
const hotChunks = new Map(); // fileID -> Map(part -> ArrayBuffer) files already chunked
const sendCache = new Map(); //disk cache
const MEMORY_CACHE = 32; //chunks to keep in memory
const MAX_SEND_BUFFER = (8 * 1024 * 1024) + 5120;	//8.5MB WEBRTC PC buffer
const PARALLEL_READS = 8;
const MAX_INFLIGHT = 96; // or even 96
let sending = false;

// Simple CRC32
function crc32(buf) {
	let crc = -1;
	for (let b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xFF];
	return (crc ^ -1) >>> 0;
}

const table = (() => {
	let t = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) c = ((c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1);
		t[i] = c >>> 0;
	}
	return t;
});

//
async function respondToFileRequest(fileID, targetUUID, initialWindow = 128) {
	sending = false;

	const meta = files[fileID];
	if (!meta) return;

	if (!meta.activeDownloads) meta.activeDownloads = new Set();
	meta.activeDownloads.add(targetUUID);

	// Cancel pending purge
	if (meta.purgeTimer) {
		clearTimeout(meta.purgeTimer);
		meta.purgeTimer = null;
		console.log("Reset purge timer due to new download:", meta.name);
	}

	await produceChunks(fileID, targetUUID);

	await refillSendCache(fileID, targetUUID);
	sendData();

	const t = transfers.get(`${fileID}:${targetUUID}`);
	if (t) {
		t.credit += initialWindow;
		console.log("Initial window:", initialWindow, "for", fileID);
	}

}

async function produceChunks(fileID, targetUUID, startIndex = 0) {
	const file = files[fileID]?.file;
	if (!file) return;

	const transferKey = `${fileID}:${targetUUID}`;
	let transfer = transfers.get(transferKey);

	// Initialize transfer state only on first call
	if (!transfer) {
		const totalChunks = Math.ceil(file.size / chunkSize);

		transfer = {
			fileID,
			targetUUID,
			totalChunks,
			announced: false,
			sendCursor: 0,
			credit: 0,
			pending: new Set(),
			inflight: new Set(),
			maxWritten: -1,
			nextChunk: startIndex,
			idBytes: new TextEncoder().encode(fileID)
		};

		transfers.set(transferKey, transfer);
		transfer.useMemoryOnly = file.size <= 64 * 1024 * 1024;

		console.log(`Splitting ${file.name} into ${totalChunks} parts`);
	}

	const totalChunks = transfer.totalChunks;
	const isSmallFile = file.size < 4 * 1024 * 1024;

	const CHUNKS_PER_SLICE = isSmallFile ? totalChunks : 64;
	const YIELD_INTERVAL = isSmallFile ? totalChunks : 16;

	files[fileID].chunkSize = chunkSize;
	files[fileID].activeDownloads ??= new Set();
	files[fileID].activeDownloads.add(targetUUID);

	//do not chunk if file is under 4MB, just read whole file and send as one 
	if (isSmallFile && startIndex === 0) {
		try {
			const buffer = await file.arrayBuffer();

			buildAndStoreChunk({fileID, targetUUID, transfer, partIndex: 0, totalChunks: 1, buffer, file});

			transfer.totalChunks = 1;
			sendData();
			return;
		} catch (err) {
			console.error("Tiny file read failed:", err);
			markFileDead(fileID);
			sendBroadcast("source-not-found", fileID);
			return;
		}
	}

	//chunk large files
	let processed = 0;

	try {

		let readQueue = [];

		for (let i = startIndex; i < totalChunks && processed < CHUNKS_PER_SLICE; i++) {

			transfer.nextChunk = i + 1;
			processed++;

			if (processed % YIELD_INTERVAL === 0) {
				await Promise.resolve();
			}

			// Skip already cached
			if (hotChunks.get(fileID)?.has(i)) {
				transfer.pending.add(i);
				transfer.maxWritten = Math.max(transfer.maxWritten, i);
				continue;
			}

			const start = i * chunkSize;
			const end = Math.min(file.size, start + chunkSize);

			// queue read instead of awaiting immediately
			readQueue.push(
				file.slice(start, end).arrayBuffer()
					.then(buffer => ({ i, buffer }))
					.catch(err => {
						console.error(`Failed to read chunk ${i} from ${file.name}:`, err);
						throw err;
					})
			);

			//when queue full → process batch
			if (readQueue.length >= PARALLEL_READS) {
				const results = await Promise.all(readQueue.splice(0));

				for (const { i: partIndex, buffer } of results) {
					buildAndStoreChunk({
						fileID,
						targetUUID,
						transfer,
						partIndex,
						totalChunks,
						buffer,
						file
					});
				}
			}
		}

		//make sure last chunk gets sent......
		if (readQueue.length) {
			const results = await Promise.all(readQueue);

			for (const { i: partIndex, buffer } of results) {
				buildAndStoreChunk({
					fileID,
					targetUUID,
					transfer,
					partIndex,
					totalChunks,
					buffer,
					file
				});
			}
		}

		await refillSendCache(fileID, targetUUID);

		// Continue with remaining chunks asynchronously
		const next = transfer.nextChunk;
		if (next < totalChunks) {
			setTimeout(() => produceChunks(fileID, targetUUID, next).catch(err =>
				console.error("Error in produceChunks continuation:", err)), 0);
		}

	} catch (err) {
		console.error("Fatal error in produceChunks:", err);
		markFileDead(fileID);
		sendBroadcast("source-not-found", fileID);
	}
}


function buildAndStoreChunk({fileID, targetUUID, transfer, partIndex, totalChunks, buffer, file}) {
	const crc = crc32(new Uint8Array(buffer));
	const idBytes = transfer.idBytes;

	const headerLen = 4 + 4 + 4 + idBytes.length + 4;
	const out = new Uint8Array(headerLen + buffer.byteLength);
	const view = new DataView(out.buffer);

	let offset = 0;

	view.setUint32(offset, partIndex, true); offset += 4;
	view.setUint32(offset, totalChunks, true); offset += 4;
	view.setUint32(offset, idBytes.length, true); offset += 4;
	out.set(idBytes, offset); offset += idBytes.length;
	view.setUint32(offset, crc, true); offset += 4;
	out.set(new Uint8Array(buffer), offset);

	// Ensure chunk map exists once
	let fileChunks = hotChunks.get(fileID);
	if (!fileChunks) {
		fileChunks = new Map();
		hotChunks.set(fileID, fileChunks);
	}

	fileChunks.set(partIndex, out.buffer);

	//push immediately to send queue if small
	sendCache.set(`${fileID}:${targetUUID}:${partIndex}`, out.buffer);

	// Optional disk persistence
	if (!transfer.useMemoryOnly) {
		queueMicrotask(() => storeTxChunk(fileID, partIndex, out.buffer));
	}

	transfer.maxWritten = Math.max(transfer.maxWritten, partIndex);
}

function getQueuedForTransfer(fileID, targetUUID) {
	let count = 0;

	for (const key of sendCache.keys()) {
		if (key.startsWith(fileID + ":" + targetUUID + ":"))
			count++;
	}
	return count;
}


async function refillSendCache(fileID, targetUUID) {
	const file = files[fileID]?.file;
	if (!file) return;

	const key = `${fileID}:${targetUUID}`;
	const t = transfers.get(key);
	if (!t || t.refilling || t.cancelled) return;

	// How many chunks receiver allows us to have in-flight total
	const queued = getQueuedForTransfer(fileID, targetUUID);

	const MEMORY_CACHE_BASE = 32;

	const allowed = Math.max(
		MEMORY_CACHE_BASE - queued,
		t.credit - (t.inflight.size + queued)
	);

	const dynamicCacheSize = Math.max(
		MEMORY_CACHE_BASE,
		Math.ceil(file.size / chunkSize * 0.25) // 25% of file
	);

	if (!t.memoryLimit) {
		const dynamicCacheSize = Math.max(
			MEMORY_CACHE_BASE,
			Math.ceil(file.size / chunkSize * 0.25)
		);

		t.memoryLimit = Math.min(dynamicCacheSize, 512);
	}

	const memoryRoom = t.memoryLimit - sendCache.size;

	const toPrepare = Math.min(allowed, memoryRoom);
	if (toPrepare <= 0) return;

	t.refilling = true;

	try {
		let loaded = 0;

		while (
			loaded < toPrepare &&
			t.sendCursor < t.totalChunks &&
			!t.cancelled
		) {
			const part = t.sendCursor;

			if (t.inflight.has(part)) {
				t.sendCursor++;
				continue;
			}

			let chunk = hotChunks.get(fileID)?.get(part);
			if (!chunk && !t.useMemoryOnly) {
				chunk = await getTxChunk(fileID, part);
			}
			if (!chunk) break;

			sendCache.set(`${fileID}:${targetUUID}:${part}`, chunk);

			t.sendCursor++;
			loaded++;
		}

		if (loaded > 0) {
			console.log(`Prepared ${loaded} chunks (credit ${t.credit}) for ${fileID}`);
			sendData();
		}

	} finally {
		t.refilling = false;
	}
}

function sendData() {
	if (sending) return;
	sending = true;

	const pump = async () => {
		try {
			const BATCH_SIZE = 16; // Send multiple chunks per cycle for buffer efficiency
			const REFILL_THRESHOLD = Math.max(MEMORY_CACHE / 2, 8); // Refill when cache drops below threshold
			let bytesSentInBatch = 0;
			let chunksSentInBatch = 0;

			for (; ;) {

				let sentSomething = false;

				if (sendCache.size === 0) {
					sending = false;

					//console.log("Empty cache - refill all transfers");
					return;
				}

				let bufferFull = false;

				for (let batch = 0; batch < BATCH_SIZE && sendCache.size > 0; batch++) {

					const [key, chunk] = sendCache.entries().next().value;
					const [fileID, targetUUID, part] = key.split(":");

					const t = transfers.get(`${fileID}:${targetUUID}`);
					if (!t || t.cancelled) {
						sendCache.delete(key);
						console.log("cancel sending");
						continue;
					}

					if (t.inflight.size >= MAX_INFLIGHT) {
						// optional: rotate to avoid blocking queue
						sendCache.delete(key);
						sendCache.set(key, chunk);
						continue;
					}

					if (t.credit <= 0) {
						// Move this chunk to the back to avoid blocking the queue
						sendCache.delete(key);
						sendCache.set(key, chunk);
						continue;
					}

					const conns = vdo.connections.get(targetUUID);
					const dc = conns?.publisher?.dataChannel || conns?.viewer?.dataChannel;
					if (!dc) {
						sending = false;
						console.log("no dc");
						return;
					}

					if (dc.bufferedAmount + chunk.byteLength > MAX_SEND_BUFFER){
						dc.bufferedAmountLowThreshold = MAX_SEND_BUFFER / 2;

						dc.onbufferedamountlow = () => {
							dc.onbufferedamountlow = null;
							if (!sending) sendData();
						};

						sending = false;
						return;
					}

					dc.send(chunk);

					t.credit--;
					t.inflight.add(Number(part));
					sendCache.delete(key);

					bytesSentInBatch += chunk.byteLength;
					chunksSentInBatch++;
					sentSomething = true;
				}

				if (bufferFull) {
					sending = false;
					console.log("buffer full");
					return;
				}

				if (!sentSomething) {
					sending = false;

					// retry instead of waiting for ACK
					setTimeout(() => sendData(), 1);

					return;
				}

				// proactive refill
				if (sendCache.size <= REFILL_THRESHOLD) {
					const refillPromises = Array.from(transfers.keys()).map(key => {
						const [fileID, targetUUID] = key.split(":");
						return refillSendCache(fileID, targetUUID);
					});
					await Promise.all(refillPromises);
				}

				await Promise.resolve();
			}
		} catch (err) {
			console.error("Fatal error in sendRAWData pump:", err);
			sending = false;
		} finally {
			sending = false;
		}
		
	};
	
	pump().catch(err => console.error("Uncaught error in pump:", err));
}

async function handleAckChunks(payload, uuid) {
	if (!payload.parts?.length) return;

	const fileID = payload.fileID;
	if (!fileID) return;

	const key = `${fileID}:${uuid}`;
	const t = transfers.get(key);
	if (!t) return;

	let released = 0;

	for (const p of payload.parts) {
		const partNum = Number(p);

		// Only count real in-flight removals
		if (t.inflight.delete(partNum)) {
			released++;
		}

		// cleanup caches
		hotChunks.get(fileID)?.delete(partNum);
		sendCache.delete(`${fileID}:${uuid}:${partNum}`);
	}

	// ---- FLOW CONTROL ----
	if (released > 0) {
		t.credit += released;
	}

	// ---- CANCEL ----
	if (payload.cancelled) {
		t.cancelled = true;

		// Hard stop: remove anything queued
		for (const key of sendCache.keys()) {
			if (key.startsWith(fileID + ":" + uuid + ":"))
				sendCache.delete(key);
		}

		transfers.delete(key);
		console.log("Transfer cancelled:", files[fileID]?.name || fileID);
		return;
	}

	// ---- COMPLETE ----
	if (t.sendCursor >= t.totalChunks && t.inflight.size === 0) {
		transfers.delete(key);
		console.log("Transfer completed:", files[fileID]?.name || fileID);
		return;
	}

	//console.log(`ACK from peer ${uuid} for file ${fileID} : +${released} credit :${t.credit}, inflight :${t.inflight.size}`);
	await refillSendCache(fileID, uuid);

	sendData();
	
	console.log(`ACK ${fileID} / released : +${released} / credit :${t.credit} / inflight : ${t.inflight.size}`);
}

function onAckDownloadComplete(fileID, peerUUID) {
	const f = files[fileID];
	if (!f) return;

	f.activeDownloads?.delete(peerUUID);
	console.log("Received download complete : ", f.name, " - by : ", peerUUID);

	// If all peers done → schedule purge
	if (!f.activeDownloads || f.activeDownloads.size === 0) {
		if (!f.purgeScheduled) {
			f.purgeScheduled = true;
			scheduleTxChunkPurge(fileID);
		}
	}
}
