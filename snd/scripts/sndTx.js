//TRANSIMITER FILES (HOST)
async function respondToFileRequest(fileID, targetUUID) {
	sending = false;

	const meta = files[fileID];
	if (!meta) return;

	if (!meta.activeDownloads) meta.activeDownloads = new Set();
	meta.activeDownloads.add(targetUUID);

	// Cancel pending purge
	if (meta.purgeTimer) {
		clearTimeout(meta.purgeTimer);
		meta.purgeTimer = null;
		log("Reset purge timer due to new download:", meta.name);
	}

	produceChunks(fileID, targetUUID)
	refillSendCache(fileID, targetUUID);
	sendRAWData();
}

//RECIEVED FILE DOWNLOAD COMPLETE MESSAGE FROM GUEST, SCHEDULE CLEAR FILE FROM CACHE DB
function onDownloadComplete(fileID, peerUUID) {
	const f = files[fileID];
	if (!f) return;

	f.activeDownloads?.delete(peerUUID);
	log("Received download complete : ", f.name, " - by : ", peerUUID);

	// If all peers done → schedule purge
	if (!f.activeDownloads || f.activeDownloads.size === 0) {
		scheduleTxChunkPurge(fileID);
	}
}

//SENDER CHUNK CACHING DB creation parameters
const POST_DOWNLOAD_GRACE = 2 * 60 * 1000; // keep file cached for 2 minutes after file complete recieved
const TX_DB = "OutgoingFileCache";
const TX_STORE = "chunks";
let txDB;
const hotChunks = new Map(); // fileID -> Map(part -> ArrayBuffer)

const sendCache = new Map();
// const cacheQueue = new Map();
const transfers = new Map(); // fileID -> TransferState

const chunkSize = 64 * 1024;						//64Kb
const MAX_SEND_BUFFER = (2 * 1024 * 1024) + 5120;	//2.5MB
const MEMORY_CACHE = 32;

let sending = false;
let swDownloadBusy = false; //used by service worker to serialize
const swDownloadQueue = [];
const BATCH = 6; // chunks per burst to write to SW

function sendRAWData() {
	if (sending) return;
	sending = true;

	const pump = async () => {
		try {
			const BATCH_SIZE = 6; // Send multiple chunks per cycle for buffer efficiency
			const REFILL_THRESHOLD = Math.max(MEMORY_CACHE / 3, 8); // Refill when cache drops below threshold
			let bytesSentInBatch = 0;
			let chunksSentInBatch = 0;

			for (; ;) {
				// Empty cache - refill all transfers
				if (sendCache.size === 0) {
					sending = false;

					// Refill all pending transfers in parallel for better throughput
					const refillPromises = Array.from(transfers.keys()).map(key => {
						const [fileID, targetUUID] = key.split(":");
						return refillSendCache(fileID, targetUUID);
					});
					await Promise.all(refillPromises);

					if (sendCache.size > 0) {
						await pump();
					}
					return;
				}

				// Batch send chunks to maximize throughput
				let bufferFull = false;
				for (let batch = 0; batch < BATCH_SIZE && sendCache.size > 0; batch++) {
					const [key, chunk] = [...sendCache.entries()][0]; // Get first item
					const [fileID, targetUUID, part] = key.split(":");

					const conns = vdo.connections.get(targetUUID);
					const dc = conns?.publisher?.dataChannel || conns?.viewer?.dataChannel;
					if (!dc) {
						sending = false;
						return;
					}

					// Check buffer before sending
					if (dc.bufferedAmount > MAX_SEND_BUFFER) {
						dc.bufferedAmountLowThreshold = MAX_SEND_BUFFER / 4;
						dc.onbufferedamountlow = () => {
							pump().catch(err => console.error("Error resuming pump:", err));
						};
						bufferFull = true;
						break;
					}

					dc.send(chunk);
					bytesSentInBatch += chunk.byteLength;
					chunksSentInBatch++;
					sendCache.delete(key);

					const t = transfers.get(`${fileID}:${targetUUID}`);
					if (t) t.inflight.add(Number(part));
				}

				// Stop if buffer full
				if (bufferFull) {
					sending = false;
					return;
				}

				// Refill cache proactively to keep buffer fuller
				if (sendCache.size <= REFILL_THRESHOLD) {
					const refillPromises = Array.from(transfers.keys()).map(key => {
						const [fileID, targetUUID] = key.split(":");
						return refillSendCache(fileID, targetUUID);
					});
					await Promise.all(refillPromises);
				}

				// Yield to main thread after batch
				await Promise.resolve();

				// Log throughput metrics periodically
				if (chunksSentInBatch >= BATCH_SIZE) {
					console.debug(`Pump: sent ${chunksSentInBatch} chunks (${(bytesSentInBatch / 1024).toFixed(1)} KB), cache size: ${sendCache.size}`);
					chunksSentInBatch = 0;
					bytesSentInBatch = 0;
				}
			}
		} catch (err) {
			console.error("Fatal error in sendRAWData pump:", err);
			sending = false;
		}
	};

	// Properly handle async pump function
	pump().catch(err => console.error("Uncaught error in pump:", err));
}

async function refillSendCache(fileID, targetUUID) {
	const key = `${fileID}:${targetUUID}`;
	const t = transfers.get(key);
	if (!t || t.refilling) return;

	const available = MEMORY_CACHE - sendCache.size;
	if (available <= 0) return;

	t.refilling = true;
	let loaded = 0;

	try {
		const cacheKey = (p) => `${fileID}:${targetUUID}:${p}`;

		const partsToFetch = [];

		while (
			partsToFetch.length < available &&
			t.sendCursor < t.totalChunks
		) {
			const part = t.sendCursor;

			if (t.inflight.has(part)) {
				t.sendCursor++;
				continue;
			}

			let chunk = hotChunks.get(fileID)?.get(part);
			if (!chunk) chunk = await getTxChunk(fileID, part);

			if (!chunk) break;

			partsToFetch.push(part);
			t.sendCursor++; // advance ONLY after confirmed existence
		}

		if (!partsToFetch.length) return;

		// Load chunks up to available space
		for (const part of partsToFetch) {
			if (loaded >= available || sendCache.size >= MEMORY_CACHE) break;

			try {

				const chunk =
					hotChunks.get(fileID)?.get(part) ||
					await getTxChunk(fileID, part);

				const cacheKey = `${fileID}:${targetUUID}:${part}`;
				sendCache.set(cacheKey, chunk);


				loaded++;
			} catch (err) {
				console.error(`Failed to load chunk ${part} for ${fileID}:`, err);
			}
		}

		// Log once after batch loading and trigger pump only once
		if (loaded > 0) {
			console.log(`REFILL CACHE: loaded ${loaded} chunks for ${fileID}`);
			sendRAWData();
		}

	} finally {
		t.refilling = false;
	}
}

async function handleAckChunks(payload, uuid) {
	if (!payload.parts?.length) return;

	const fileID = payload.fileID;
	if (!fileID) return;

	const key = `${fileID}:${uuid}`;
	const t = transfers.get(key);
	if (!t) return;

	let ackedCount = 0;
	for (const p of payload.parts) {
		const partNum = Number(p);
		// Only delete from inflight (should already be removed from pending when sent)
		if (t.inflight.delete(partNum)) {
			ackedCount++;
		}
		hotChunks.get(fileID)?.delete(partNum);

		sendCache.delete(`${fileID}:${uuid}:${partNum}`);
	}

	if (payload.cancelled) {
		t.cancelled = true;
		transfers.delete(key);
		log("Transfer cancelled:", files[fileID]?.name || fileID);
		return;
	}

	if (t.sendCursor >= t.totalChunks && t.inflight.size === 0) {
		transfers.delete(key);
		log("Transfer completed:", files[fileID]?.name || fileID);
	}

	await refillSendCache(fileID, uuid);
	sendRAWData();

	console.debug(`ACK for ${fileID}: acked ${ackedCount} chunks, inflight: ${t.inflight.size}, pending: ${t.pending.size}`);
}

async function produceChunks(fileID, targetUUID, startIndex = 0) {
	const transferKey = `${fileID}:${targetUUID}`;
	let transfer = transfers.get(transferKey);

	// Initialize transfer state only on first call
	if (!transfer) {
		const file = files[fileID]?.file;
		if (!file) return;

		const totalChunks = Math.ceil(file.size / chunkSize);
		transfer = {
			fileID,
			targetUUID,
			totalChunks,
			sendCursor: 0,
			pending: new Set(),
			inflight: new Set(),
			maxWritten: -1,
			nextChunk: startIndex
		};
		transfers.set(transferKey, transfer);
	}

	const file = files[fileID].file;
	const totalChunks = transfer.totalChunks;
	files[fileID].chunkSize = chunkSize;
	files[fileID].activeDownloads ??= new Set();
	files[fileID].activeDownloads.add(targetUUID);

	const CHUNKS_PER_SLICE = 64;
	const YIELD_INTERVAL = 16; // Yield to main thread every N chunks
	let processed = 0;
	let chunksCached = 0;
	let newChunksProduced = 0;

	try {
		for (let i = startIndex; i < totalChunks && processed < CHUNKS_PER_SLICE; i++) {
			transfer.nextChunk = i + 1;
			processed++;

			// Yield to main thread periodically to avoid blocking
			if (processed % YIELD_INTERVAL === 0) {
				await Promise.resolve();
			}

			// If we've already written it once in this session, skip disk check
			if (hotChunks.get(fileID)?.has(i)) {
				transfer.pending.add(i);
				transfer.maxWritten = Math.max(transfer.maxWritten, i);
				chunksCached++;
				continue;
			}

			// Read file chunk
			let buffer;
			try {
				const start = i * chunkSize;
				const end = Math.min(file.size, start + chunkSize);
				buffer = await file.slice(start, end).arrayBuffer();
			} catch (err) {
				console.error(`Failed to read chunk ${i} from ${file.name}:`, err);
				markFileDead(fileID);
				sendBroadcast("source-not-found", fileID);
				return;
			}

			// Build chunk with header
			const crc = crc32(new Uint8Array(buffer));
			const idBytes = new TextEncoder().encode(fileID);
			const headerLen = 4 + 4 + 4 + idBytes.length + 4;
			const out = new Uint8Array(headerLen + buffer.byteLength);
			const view = new DataView(out.buffer);
			let offset = 0;

			view.setUint32(offset, i, true); offset += 4;
			view.setUint32(offset, totalChunks, true); offset += 4;
			view.setUint32(offset, idBytes.length, true); offset += 4;
			out.set(idBytes, offset); offset += idBytes.length;
			view.setUint32(offset, crc, true); offset += 4;
			out.set(new Uint8Array(buffer), offset);

			if (!hotChunks.has(fileID)) hotChunks.set(fileID, new Map());
			hotChunks.get(fileID).set(i, out.buffer);

			queueMicrotask(() => storeTxChunk(fileID, i, out.buffer));

			transfer.maxWritten = Math.max(transfer.maxWritten, i);
			newChunksProduced++;
		}

		// Log progress after batch processing
		if (processed > 0) {
			const logMsg = chunksCached > 0
				? `File: ${file.name} already cached (${chunksCached}/${processed} chunks)`
				: `Splitting ${file.name} into ${totalChunks} parts (produced ${newChunksProduced} chunks)`;
			log(logMsg);
		}

		await refillSendCache(fileID, targetUUID);
		sendRAWData();

		// Continue with remaining chunks asynchronously
		const next = transfer.nextChunk;
		if (next < totalChunks) {
			setTimeout(() => produceChunks(fileID, targetUUID, next).catch(err =>
				console.error("Error in produceChunks continuation:", err)), 0);
		}

	} catch (err) {
		console.error("Fatal error in produceChunks:", err);
		markFileDead(fileID);
	}
}

//CREATE, WRITE AND GET CHUNKS FROM TX_DB
function openTxDB() {
	if (txDB) return txDB;
	txDB = new Promise((resolve, reject) => {
		const req = indexedDB.open(TX_DB, 1);
		req.onupgradeneeded = e => {
			e.target.result.createObjectStore(TX_STORE, { keyPath: "key" });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return txDB;
}

async function storeTxChunk(fileID, chunkIndex, buffer) {
	const db = await openTxDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(TX_STORE, "readwrite");
		const store = tx.objectStore(TX_STORE);

		const req = store.put({
			key: `${fileID}:${chunkIndex}`,
			fileID,
			chunkIndex,
			data: buffer,
			ts: Date.now()
		});

		//	req.onerror = () => reject(req.error);
		tx.oncomplete = resolve;
		tx.onerror = () => reject(tx.error);
	});
}

async function getTxChunk(fileID, chunkIndex) {
	const db = await openTxDB();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(TX_STORE, "readonly");
		const req = tx.objectStore(TX_STORE).get(`${fileID}:${chunkIndex}`);

		req.onsuccess = () => resolve(req.result?.data || null);
		req.onerror = () => reject(req.error);
	});
}

//scheduler to remove chunks when we recieve file download complete
function scheduleTxChunkPurge(fileID) {
	const file = files[fileID];
	if (!file) return;

	// reset existing timer
	if (file.purgeTimer) {
		clearTimeout(file.purgeTimer);
	}

	log("Scheduling cache purge for file:", file.name);

	file.purgeTimer = setTimeout(async () => {
		try {
			const db = await openTxDB();
			const tx = db.transaction(TX_STORE, "readwrite");
			const store = tx.objectStore(TX_STORE);

			const req = store.getAllKeys();

			req.onsuccess = () => {
				for (const key of req.result) {
					if (key.startsWith(fileID + ":")) {
						store.delete(key);
					}
				}
			};

			tx.oncomplete = () => {
				log("Purged file:", file.name, "from cache");
			};

			tx.onerror = () => {
				console.error("Tx purge failed for", file.name, tx.error);
			};

		} finally {
			file.purgeTimer = null;
		}
	}, POST_DOWNLOAD_GRACE);
}