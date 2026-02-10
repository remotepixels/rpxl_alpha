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
		log("Reset purge due to new download:", meta.name);
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

const sendCache = new Map();
const cacheQueue = new Map();
const transfers = new Map(); // fileID -> TransferState

const chunkSize = 64 * 1024;						//64Kb
const MAX_SEND_BUFFER = (2 * 1024 * 1024) + 512;	//2MB
const MEMORY_CACHE = 32;

let sending = false;
let swDownloadBusy = false; //used by service worker to serialize
const swDownloadQueue = [];
const BATCH = 6; // chunks per burst to write to SW

function sendRAWData() {
	if (sending) return;
	sending = true;

	const pump = async () => {
		for (; ;) {
			if (sendCache.size === 0) {
				sending = false;

				for (const key of transfers.keys()) {
					const [fileID, targetUUID] = key.split(":");
					await refillSendCache(fileID, targetUUID);
				}

				if (sendCache.size > 0) {
					sendRAWData();
				}
				return;
			}


			const iter = sendCache.entries().next();
			if (iter.done) return;

			const [key, chunk] = iter.value;
			const [fileID, targetUUID, part] = key.split(":");

			const conns = vdo.connections.get(targetUUID);
			const dc = conns?.publisher?.dataChannel || conns?.viewer?.dataChannel;
			if (!dc) {
				sending = false;
				return;
			}

			if (dc.bufferedAmount > MAX_SEND_BUFFER) {
				dc.bufferedAmountLowThreshold = MAX_SEND_BUFFER / 4;
				dc.onbufferedamountlow = () => pump();
				return;
			}
			//console.warn("SENDRAW : ", fileID ," chunk : " ,chunk);

			dc.send(chunk);
			bytesSentInInterval += chunk.byteLength;
			sendCache.delete(key);

			await refillSendCache(fileID, targetUUID);

			const t = transfers.get(`${fileID}:${targetUUID}`);
			if (t) t.inflight.add(Number(part));
		}
	};
	pump();
}

async function refillSendCache(fileID, targetUUID) {
	const key = `${fileID}:${targetUUID}`;
	const t = transfers.get(key);
	if (!t || t.refilling) return;

	const available = MEMORY_CACHE - sendCache.size;
	if (available <= 0) return;

	t.refilling = true;

	try {
		const parts = [...t.pending]
			.filter(p =>
				!t.inflight.has(p) &&
				!sendCache.has(`${fileID}:${targetUUID}:${p}`)
			)
			.sort((a, b) => a - b)
			.slice(0, available);

		if (!parts.length) {
			t.refilling = false;
			return;
		}

		for (const part of parts) {
			if (sendCache.size >= MEMORY_CACHE) break;

			const chunk = await getTxChunk(fileID, part);
			if (!chunk) continue;

			const cacheKey = `${fileID}:${targetUUID}:${part}`;
			if (sendCache.has(cacheKey)) continue;

			sendCache.set(cacheKey, chunk);
			console.warn("REFILL CACHE : ", fileID);
			sendRAWData()
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

	for (const p of payload.parts) {
		t.pending.delete(p);
		t.inflight.delete(p);
		sendCache.delete(`${fileID}:${uuid}:${p}`);
	}

	if (payload.cancelled) {
		t.cancelled = true;
		transfers.delete(key);
		log("Transfer cancelled:", files[fileID]?.name || fileID);
		return;
	}

	if (t.pending.size === 0 && t.nextChunk >= t.totalChunks) {
		transfers.delete(key);
		log("Transfer completed:", files[fileID]?.name || fileID);
		return;
	}

	await refillSendCache(fileID, uuid);
	sendRAWData();

	console.warn("ACK", fileID, "inflight:", t.inflight.size, "pending:", t.pending.size);
}

async function produceChunks(fileID, targetUUID, startIndex = 0) {
	let logCache = false;
	files[fileID].chunkSize = chunkSize;
	files[fileID].activeDownloads ??= new Set();
	files[fileID].activeDownloads.add(targetUUID);
	let file = files[fileID].file;
	const totalChunks = Math.ceil(file.size / chunkSize);
	const transferKey = `${fileID}:${targetUUID}`;

	const t = {
		fileID,
		targetUUID,
		totalChunks,
		pending: new Set(),
		inflight: new Set(),
		maxWritten: -1,
		nextChunk: 0
	};

	if (!transfers.has(transferKey)) transfers.set(transferKey, t);

	const CHUNKS_PER_SLICE = 64;
	let processed = 0;

	for (let i = startIndex; i < totalChunks && processed < CHUNKS_PER_SLICE; i++) {
		t.nextChunk = i + 1;
		processed++;

		//for (let i = 0; i < totalChunks; i++) {
		//if (i % 32 === 0) await Promise.resolve();

		const chunkIndex = i;
		const cached = await getTxChunk(fileID, chunkIndex);

		if (cached) {
			// chunk already exists in IndexedDB
			const tID = transfers.get(transferKey);
			if (tID) {
				tID.pending.add(chunkIndex);
				tID.maxWritten = Math.max(tID.maxWritten, chunkIndex);
				//sendRAWData();
			}
			if (!logCache) {
				log("File : ", file.name, "is already in cache, sending");
				logCache = true;
			}
			if (t.pending.size <= MEMORY_CACHE % 2) {
				await refillSendCache(fileID, targetUUID);
				sendRAWData();
			}
			continue;
		}

		if (!logCache) {
			log(`Splitting ${file.name} into ${totalChunks} parts and sending`);
			logCache = true;
		}

		const start = i * chunkSize;
		const end = Math.min(file.size, start + chunkSize);

		//if (i % 16 === 0) await Promise.resolve();

		let buffer;
		try {
			buffer = await file.slice(start, end).arrayBuffer();
		} catch (err) {
			//console.warn("Source file not found:", fileID, file.name, err);
			markFileDead(fileID);
			sendBroadcast("source-not-found", fileID);
			return;
		}

		const crc = crc32(new Uint8Array(buffer));
		const idBytes = new TextEncoder().encode(fileID);

		const headerLen = 4 + 4 + 4 + idBytes.length + 4;
		const out = new Uint8Array(headerLen + buffer.byteLength);
		const view = new DataView(out.buffer);
		let o = 0;

		view.setUint32(o, chunkIndex, true); o += 4;
		view.setUint32(o, totalChunks, true); o += 4;
		view.setUint32(o, idBytes.length, true); o += 4;
		out.set(idBytes, o); o += idBytes.length;
		view.setUint32(o, crc, true); o += 4;
		out.set(new Uint8Array(buffer), o);

		await storeTxChunk(fileID, chunkIndex, out.buffer);

		t.pending.add(i);
		t.maxWritten = Math.max(t.maxWritten, i);
		// for (const t of transfers.values()) {
		// 	if (t.fileID === fileID && !t.cancelled) {
		// 		t.pending.add(chunkIndex);
		// 		t.maxWritten = Math.max(t.maxWritten, chunkIndex);
		// 	}

		//if (t.pending.size <= MEMORY_CACHE) {
		await refillSendCache(fileID, targetUUID);
		sendRAWData();
		//		}
		// }
	}
	if (t.nextChunk < totalChunks) {
		setTimeout(() => produceChunks(fileID, targetUUID, t.nextChunk), 0);
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