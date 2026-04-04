const RX_DB = "IncomingFileCache";
const RX_STORE = "chunks";
let rxDB;
const rxWriteBuffers = new Map();
const RX_WRITE_BATCH = 8;
const RX_WRITE_DELAY = 50; // ms

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

//write file from memory to db
async function storeRxChunk(fileID, part, total, data) {
	let entry = rxWriteBuffers.get(fileID);

	if (!entry) {
		entry = { parts: [], timer: null, flushing: false };
		rxWriteBuffers.set(fileID, entry);
	}

	entry.parts.push({ part, total, data });

	// backpressure protection
	if (entry.parts.length >= RX_WRITE_BATCH * 4) {
		await flushRxChunkBatch(fileID);
		return;
	}

	if (entry.parts.length >= RX_WRITE_BATCH) {
		await flushRxChunkBatch(fileID);
	} else if (!entry.timer) {
		entry.timer = setTimeout(() => {
			entry.timer = null;
			flushRxChunkBatch(fileID).catch(console.error);
		}, RX_WRITE_DELAY);
	}
}

//writes chunks from memeory to index db
async function flushRxChunkBatch(fileID) {
	const entry = rxWriteBuffers.get(fileID);
	if (!entry || entry.flushing) return;

	entry.flushing = true;

	const batch = entry.parts.splice(0, RX_WRITE_BATCH);

	if (entry.parts.length === 0) {
		rxWriteBuffers.delete(fileID);
	} else {
		entry.flushing = false;
		setTimeout(() => flushRxChunkBatch(fileID), 0);
	}

	const db = await openRxDB();
	const tx = db.transaction(RX_STORE, "readwrite");
	const store = tx.objectStore(RX_STORE);

	for (const p of batch) {
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

async function flushAllRxChunks(fileID) {
	const entry = rxWriteBuffers.get(fileID);

	if (entry) {
		// cancel timer
		if (entry.timer) {
			clearTimeout(entry.timer);
			entry.timer = null;
		}

		// flush remaining parts
		await flushRxChunkBatch(fileID);
	}
}

//once file succesfully downloaded delete from index db
async function purgeRxChunks(fileID) {
	const meta = files[fileID];
	console.log("Download complete, purging cached files for", meta?.name || fileID);

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