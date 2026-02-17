//TRANSIMITER FILES (HOST)
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
		log("Reset purge timer due to new download:", meta.name);
	} //else {
		await produceChunks(fileID, targetUUID);
//	}

	const t = transfers.get(`${fileID}:${targetUUID}`);
	if (t) {
		t.credit += initialWindow;
		console.log("Initial window:", initialWindow, "for", fileID);
	}

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
let pumpWaiting = true;

function sendData() {
	if (sending) return;
	sending = true;
	//console.log("send raw data sending");
	const pump = async () => {
		try {
			const BATCH_SIZE = 6; // Send multiple chunks per cycle for buffer efficiency
			const REFILL_THRESHOLD = Math.max(MEMORY_CACHE / 2, 8); // Refill when cache drops below threshold
			let bytesSentInBatch = 0;
			let chunksSentInBatch = 0;

			for (;;) {

				let sentSomething = false;

				// Empty cache - refill all transfers
				if (sendCache.size === 0) {
					sending = false;
					
					//pumpWaiting = true;
					console.log("Empty cache - refill all transfers");
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

					// ---- CREDIT GATE ----
					if (t.credit <= 0) {
						console.log("no credit");
						continue;
					}

					const conns = vdo.connections.get(targetUUID);
					const dc = conns?.publisher?.dataChannel || conns?.viewer?.dataChannel;
					if (!dc) {
						sending = false;
						console.log("no dc");
						return;
					}

					// ---- NETWORK BACKPRESSURE ----
					if (dc.bufferedAmount > MAX_SEND_BUFFER) {
						dc.bufferedAmountLowThreshold = MAX_SEND_BUFFER / 4;
						dc.onbufferedamountlow = () => sendData();
						bufferFull = true;
						console.log("dc.buffer full");
						await new Promise(r => setTimeout(r, 1));
					}
// const buffer = dc.bufferedAmount;

// // Hard safety cap
// if (buffer > MAX_SEND_BUFFER) {
//     await new Promise(r => setTimeout(r, 4));
//     continue;
// }

// // Soft pacing zone
// if (buffer > MAX_SEND_BUFFER * 0.5) {
//     await new Promise(r => setTimeout(r, 1));
// }

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

				// ---- NOTHING COULD BE SENT → WAIT FOR ACK ----
				if (!sentSomething) {
					sending = false;
					pumpWaiting = true;
					console.log("waiting for ack");
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
// if (sendCache.size + t.inflight.size < t.credit)
//     await refillSendCache(fileID, targetUUID);

				await Promise.resolve();
			}

		} catch (err) {
			console.error("Fatal error in sendRAWData pump:", err);
			sending = false;
		}
	};

	// Properly handle async pump function
	pump().catch(err => console.error("Uncaught error in pump:", err));
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
	const key = `${fileID}:${targetUUID}`;
	const t = transfers.get(key);
	if (!t || t.refilling || t.cancelled) return;

	// How many chunks receiver allows us to have in-flight total
	const queued = getQueuedForTransfer(fileID, targetUUID);
	const allowed = t.credit - (t.inflight.size + queued);

	if (allowed <= 0) return;

	// Also respect memory safety cap
	const memoryRoom = MEMORY_CACHE - sendCache.size;
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
			if (!chunk) chunk = await getTxChunk(fileID, part);
			if (!chunk) break;

			sendCache.set(`${fileID}:${targetUUID}:${part}`, chunk);

			t.sendCursor++;
			loaded++;
		}

		if (loaded > 0) {
			console.debug(`Prepared ${loaded} chunks (credit ${t.credit}) for ${fileID}`);
			sendData();
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
		log("Transfer cancelled:", files[fileID]?.name || fileID);
		return;
	}

	// ---- COMPLETE ----
	if (t.sendCursor >= t.totalChunks && t.inflight.size === 0) {
		transfers.delete(key);
		log("Transfer completed:", files[fileID]?.name || fileID);
		return;
	}

	// ---- CONTINUE SENDING ----
	await refillSendCache(fileID, uuid);

	console.debug(
		`ACK ${fileID} : +${released} credit :${t.credit}, inflight :${t.inflight.size}`
	);
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
			announced: false,
			sendCursor: 0,
			credit:0,
			pending: new Set(),
			inflight: new Set(),
			maxWritten: -1,
			nextChunk: startIndex
		};
		transfers.set(transferKey, transfer);
		log(`Splitting ${file.name} into ${totalChunks} parts`);
	}

	const file = files[fileID].file;
	const totalChunks = transfer.totalChunks;
	files[fileID].chunkSize = chunkSize;
	files[fileID].activeDownloads ??= new Set();
	files[fileID].activeDownloads.add(targetUUID);

	const CHUNKS_PER_SLICE = 64;
	const YIELD_INTERVAL = 32; // Yield to main thread every N chunks
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