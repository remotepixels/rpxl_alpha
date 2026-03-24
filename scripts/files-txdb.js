const POST_DOWNLOAD_GRACE = 2 * 60 * 1000; // keep file cached for 2 minutes after file complete recieved
const TX_DB = "OutgoingFileCache";
const TX_STORE = "chunks";
let txDB;

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

	console.log("Scheduling cache purge for file:", file.name);

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
				console.log("Purged file:", file.name, "from cache");
			};

			tx.onerror = () => {
				console.error("Tx purge failed for", file.name, tx.error);
			};

		} finally {
			file.purgeTimer = null;
		}
	}, POST_DOWNLOAD_GRACE);
}