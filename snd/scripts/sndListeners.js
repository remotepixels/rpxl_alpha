	//if window focus change ask for wakelock again
	document.addEventListener("visibilitychange", () => {
		if (!document.hidden && wakeLock) {
			enableWakeLock();
		}
	});

	//SERVICE WORKER MESSAGES FOR FILE SAVING
	if (navigator.serviceWorker) {
		navigator.serviceWorker.addEventListener("message", event => {
			if (event.data?.type === "download-finished") {
				console.log("SW download finished:", event.data.fileID);
				swDownloadBusy = false;
				sendToPeer(event.data.uploadedBy, "download-complete", event.data.fileID)
				processSWQueue(); 
				markDownloadCompleted(event.data.fileID);
				purgeRxChunks(event.data.fileID).catch(err => 
					console.error("Error purging RX chunks:", err)
				);
			} else if (event.data?.type === "download-error") {
				console.error("SW download error:", event.data.fileID, event.data.error);
				swDownloadBusy = false;
				markDownloadCompleted(event.data.fileID);
				processSWQueue();
			}
		});
	} else {
		console.warn("Service Worker API not available");
	}

	//SHUTDOWN ACTIONS
	window.addEventListener('beforeunload', () => {
		vdo.sendData({
			dataType: 'peer-disconnect',
			timestamp: Date.now()
		});

		if (vdo) {
			vdo.sendData({
				dataType: 'peer-disconnect',
				timestamp: Date.now()
			});
			vdo.disconnect();
		}
		if (vdoWR) {
			vdoWR.sendData({
				dataType: 'peer-disconnect',
				timestamp: Date.now()
			});
			vdo.disconnect();
		}

		flushTxRxDB("OutgoingFileCache"); //remove cache if exists
		flushTxRxDB("IncomingFileCache"); //remove cache if exists
	});

	//VDO (MAIN ROOM) LISTENERS
	function setupVDOListeners() {
		//log('Setting up VDO listeners');

		vdo.addEventListener(`connected`, (event) => {
			//console.log("connected to signaling server");
		});

		vdo.addEventListener(`disconnected`, (event) => {
			//console.log("disconnected to signaling server");
		});

		vdo.addEventListener(`roomJoined`, (event) => {
			//console.log("Joined room :", event.detail.room);
		});
		vdo.addEventListener('peerConnected', (event) => {
			//used to view peers that connect later in session
			playBeep(400, 1);
			const guestUUID = event.detail.uuid;
			connectedPeers[guestUUID] = guestUUID;

			if (!guestUUID) return;
			updatePeersUI();
			handleGuestJoin(guestUUID);
			log("Peer connected :", guestUUID);
			//console.warn("peer connected",event);
		});

		vdo.addEventListener('peerDisconnected', (event) => {
			playBeep(200, 2);
			const guestUUID = event.detail.uuid;
			delete connectedPeers[guestUUID];
			updatePeersUI();
			removePeerFiles(guestUUID);
			log("Peer dis-connected :", guestUUID);
		});

		vdo.addEventListener("peerListing", (event) => {
			//console.warn("lsting", event);
			//asks for all peers in room, can be run after same as listiing????
		});

		vdo.addEventListener("data", (event) => {
			//BINARY RECEIVER ONLY
			//console.warn("data:", event);
			const rawData = event.detail.data;

			handleIncomingChunk(rawData)
		});

		//IO messages, files added, removed, downloads etc.
		vdo.addEventListener('dataReceived', (event) => {
			const uuid = event.detail.uuid;
			const data = event.detail.data;
			const payload = event.detail.data.payload;

			//console.warn('control message from main room:', event);
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
				log(`Received file meta : ${payload.folderPath} / ${payload.name} - uploaded by : ${payload.uploadedBy}`);
			}

			if (data.dataType === "request-file") {
				const fileMeta = files[payload.id];
				log(`File requested : ${fileMeta?.folderPath || ''} / ${fileMeta?.name || payload.id} - by : ${uuid}`);
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
					log(`File removed : ${file.name} - on :  ${file.uploadedBy}`);
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
				log(`Directory removed remotely : ${path}`);
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

			if (data.dataType === "download-complete") {
				onDownloadComplete(payload, uuid);
				return;
			}

		}, false);
	}

	//VDO (WAITING ROOM) LISTENERS
	function setupVDOWRListeners() {
		//console.warn("setting up waiting room listeners",room);

		vdoWR.addEventListener(`connected`, (event) => {
		//	console.log("connected to signaling server");
		});

		vdoWR.addEventListener(`disconnected`, (event) => {
		//	console.log("disconnected to signaling server");
		});
		vdoWR.addEventListener('peerConnected', (event) => {
			playBeep(400, 1);

			const guestUUID = event.detail.uuid;
			if (!guestUUID) return;

			// convert performance timestamp to Date
			const joinedAt = Date.now() - performance.now() + event.timeStamp;

			waitingPeers.set(guestUUID, joinedAt);

			renderWaitingPeers();
			log(`Peer : ${guestUUID} joined waiting room at : ${formatTime(joinedAt)}`);
		});

		vdoWR.addEventListener("peerDisconnected", (event) => {
			const uuid = event.detail?.uuid;
			if (!uuid) return;

			waitingPeers.delete(uuid);
			renderWaitingPeers();
		});

		vdoWR.addEventListener('dataReceived', (event) => {
			const uuid = event.detail.uuid;
			const data = event.detail.data;

			//console.warn('control message waiting room:', event);
			if (data.dataType === "migrate") {
				const target = data.target;
				mainRoom = data.roomid;

				vdoWR.sendData({
					dataType: 'peer-disconnect',
					timestamp: Date.now()
				});

				waitingPeers.delete(uuid);
				renderWaitingPeers();
				log("Host has let you in");
				vdoWR.disconnect();
				sleep(500); 

				createVDOroom();

				["joinShareDialog", "helpIcon", "waitingButton"].forEach(id => {
					document.getElementById(id).style.display = "none";
				});

				document.getElementById('dropArea').classList.add('hidden');
				document.getElementById('topmenu').classList.remove('hidden');
				document.getElementById('subToolBar').classList.remove('hidden');
				document.getElementById('dragDropMessage').textContent = "Drop to add files"
				document.getElementById('dragDropSubMessage').textContent = ""

				firstInteraction = false;
				return;
			}
		});
	}
