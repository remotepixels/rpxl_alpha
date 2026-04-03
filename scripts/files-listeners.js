
navigator.serviceWorker.addEventListener("message", (event) => {
	if (event.data.type === "download-finished") {
		activeSWDownloads = Math.max(0, activeSWDownloads - 1);

		processSWQueue(); 
		sendToPeer(event.data.uploadedBy, "ack-download-complete", event.data.fileID)

		markDownloadCompleted(event.data.fileID);

		purgeRxChunks(event.data.fileID).catch(err => 
			console.error("Error purging RX chunks:", err)
		);

		console.log("SW download finished:", event.data.fileID);
	}
});

setupFilesListeners()

function setupFilesListeners() {
	vdo.addEventListener('dataReceived', (event) => {
		const uuid = event.detail.uuid;
		const data = event.detail.data;
		const streamID = event.detail.streamID;
		const payload = event.detail.data.payload;
	
		//file handling events
		if (data.dataType == 'file-announce') {
			if (files[payload.id]) return;        //ignore duplicates if already have this file
			if (!uuid) return;
			payload.uploadedBy = uuid;

			files[payload.id] = {
				id: payload.id,
				name: payload.name,
				size: payload.size,
				folderPath: payload.folderPath || '',
				uploadedBy: payload.uploadedBy,
				timestamp: payload.timestamp
			};
			debouncedRerender()
				
			newFiles++;
			updateFilesBadge();
			
			console.log(`Received file meta : ${payload.folderPath} / ${payload.name} - uploaded by : ${payload.uploadedBy}`);

		}

		if (data.dataType === "request-file") {
			const fileMeta = files[payload.id];
			console.log(`File requested : ${fileMeta?.folderPath || ''} / ${fileMeta?.name || payload.id} - by : ${uuid}`);
			enableWakeLock();
			respondToFileRequest(payload.id, uuid);
			return;
		}

		if (data.dataType === "file-removed") {
			const id = payload.id;
			const file = files[id];
			if (file) {
				delete files[id];
				const el = document.querySelector(`.file-item[data-id="${id}"]`);
				removeElementWithFade(el);
				console.log(`File removed : ${file.name} - on :  ${file.uploadedBy}`);
				cleanupEmptyFolders(file.folderPath);
			}
			return;
		}

		if (data.dataType === "directory-removed") {
			const path = payload.path;

			// Remove files inside folder first
			for (const id of Object.keys(files)) {
				if (files[id].folderPath.startsWith(path)) {
					delete files[id];
					const el = document.querySelector(`.file-item[data-id="${id}"]`);
					removeElementWithFade(el);
				}
			}
			// Now remove the folder itself
			const folderDiv = document.querySelector(`.folder[data-path="${path}"]`);
			removeElementWithFade(folderDiv);
			delete folderMap[path];

			cleanupEmptyFolders(path);
			console.log(`Directory removed remotely : ${path}`);
			return;
		}

		if (data.dataType === "source-not-found") {
			//console.warn("source file not found", payload)
			markFileDead(payload);
			const el = document.getElementById(`icon-container_${payload}`);
			el.style.opacity = "0";
			return;
		}

		if (data.dataType === "ACK-chunks") {
			//console.warn("user:", uuid, "ack chunk", payload)
			handleAckChunks( payload, uuid )
			return;
		}

		if (data.dataType === "ack-download-complete") {
			onAckDownloadComplete(payload, uuid);
			return;
		}

	});

	//binary data for file transfers
	vdo.addEventListener("data", (event) => {
		const rawData = event.detail.data;

		handleIncomingChunk(rawData)
	});
}