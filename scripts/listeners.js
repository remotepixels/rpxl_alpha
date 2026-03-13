//let waitingRoom = null;

window.addEventListener('load', () => {
	//document.documentElement.requestFullscreen();
});

window.addEventListener('beforeunload', () => {
	if (vdo) {
		vdo.disconnect();
	}
});

function setupVDOListeners() {
	mainVideoPreview.addEventListener("loadedmetadata", (event) => {
		//runs when a stream is attached to the main video element
	});

	//monitor resolution of main stream and activate / decativate tools
	mainVideoPreview.addEventListener("resize", () => {
		//resize main stream to new resolution
		let w = mainVideoPreview.videoWidth;
		let h = mainVideoPreview.videoHeight;
		mainVideoPreview.style.width = `${w}px`;
		mainVideoPreview.style.height = `${h}px`;

		resizeMarkupCanvas(); //markup.js
		if (w <= 320 && h <= 80) {
			setTools("video", false);
		} else {
			setTools("video", true);
		}
		console.warn("main stream resolution: resize", w, h);
	});

	vdo.addEventListener(`connected`, (event) => {
		//console.log("connected to signaling server");
	});

	vdo.addEventListener(`disconnected`, (event) => {
		//console.log("disconnected to signaling server");
	});

	vdo.addEventListener(`roomJoined`, (event) => {
		console.log("Joined room :", event.detail.room);
	});

	vdo.addEventListener(`roomLeft`, (event) => {
		console.log("Left room :", event);
		
		//if (waitingRoom) moveRoom(waitingRoom);
	});

	vdo.addEventListener('peerConnected', (event) => {
		//runs ONCE for each peer that connects
		//used to view peers that connect later in session (ignore streamID as will often be wrong)
		const uuid = event.detail.uuid;
		const pc = event.detail.connection?.pc;

		addToRegistry(uuid, null, null, null);

		let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());
		
		//send users name (label) to peers
		vdo.sendData({
			type: 'userLabel',
			label: sanitizedCurrentUserName,
			timestamp: Date.now()
		}, uuid);
		
		//used if peer connects without a microphone
		vdo.sendData({
			type: 'userStreamAudio',
			info: userStreamAudio,
			timestamp: Date.now()
		}, uuid);

		if (isStreamer) {
			// wait(500); //wait for peer to be ready to receive data, otherwise can get lost????
			let currentProjectName = encodeURIComponent(project.value.trim() || "");

			vdo.sendData({
				type: 'uuidInfo',
				uuidInfo: uuid,
				timestamp: Date.now()
			}, uuid);

			vdo.sendData({
				type: 'streamInfo',
				label: currentProjectName,
				timestamp: Date.now()
			}, uuid);

			vdo.sendData({
				type: 'mainStreamAudio',
				info: mainStreamAudio,
				timestamp: Date.now()
			}, uuid);

			vdo.sendData({
				type: "markup",
				overlayNinja: {
					action: "syncState",
					to: uuid
				}
			}, uuid);

			vdo.sendData({
				type: "chatHistory",
				history: chatHistory
			}, uuid);

			//console.warn("sending main audio state, project, markup, chat");
		}
	});


	vdo.addEventListener('peerDisconnected', (event) => {
		const uuid = event.detail.uuid;

		disconnectPeer(uuid);
		console.warn("peer disconnected UUID:", event.detail);
	});

	vdo.addEventListener('peerLatency', (event) => {
		// Show visual ping result for built-in SDK ping/pong

	});

	vdo.addEventListener('dataChannelOpen', (event) => {
		//RUNS - ONCE FOR DATA, ONCE FOR VIDEO/AUDIO
		const uuid = event.detail.uuid;

		//console.warn(`Data channel opened with viewer: ${event.detail.uuid}...`, 'success');
	});

	vdo.addEventListener('dataReceived', (event) => {
		const uuid = event.detail.uuid;
		const data = event.detail.data;
		const streamID = event.detail.streamID;
		//console.log("Data received from ", event);
		
		if (data.type === 'uuidInfo') {
			localUUID = data.uuidInfo;

			console.log("Recieved local UUID Info :", localUUID);
			//moveToRoom(room, userToMove);
		}

		if (data.type === 'remoteToggleMic') {
			const button = document.querySelector('[data-action="muteMicrophone"]');
			UI.toggle(button);

			//console.log("what use is a phone call if you can't speak mr anderson?");
		}

		if (data.type === 'moveToRoom') {
			const room = data.room;
			const userToMove = data.user;
			if (!room || ! userToMove) return;
			togglePeerRoom(userToMove);
			console.log("move user :", userToMove," to room :", room);
		}
		
		if (data.type === 'kick') {
			if (vdo) {
				vdo.disconnect();
			}
			window.location.replace("/error.html");

		}

		if (data.type === 'userLabel') {
			const label = data.label;

			addToRegistry(uuid, label, streamID, null);
			updateDOMLabel(uuid, streamID, label);
			//console.warn(`Received user label from ${uuid}: ${label} at ${timestamp}`);
		}

		if (data.type === 'streamInfo') {
			const label = data.label;

			sessionName.textContent = decodeURIComponent(label);
		}

		if (data.type === 'VUData') {
			const level = data.level;
			const whichVU = data.whichVU;
			
			if (whichVU === "main") {
				updateMainVULevel(level);
			}
			if (whichVU === "user") {
				updateDOMuserVU(uuid, level);
			}
		}

		if (data.type === 'mainStreamAudio') {
			const audio = data.info;
			setTools("audio", audio);
			//console.warn("recieved info for mainaudio state", audio);
		}

		if (data.type === 'userStreamAudio') {
			const audio = data.info;

			updateDOMuserAudio(uuid, audio);
			//console.warn("recieved info for user stream audio state", audio);
		}

		if (data.type === 'chat') {
			const message = data.message;
			const sender = data.sender;
			const timestamp = data.timestamp;
			
			postMessage(message, sender, timestamp);
		}

		if (data.type === "chatHistory") {
			const history = data.history;

			history.forEach(msg => {
				renderMessage(msg.message, msg.sender, msg.timestamp);
			});
			//console.warn("received chat history from peer", data, uuid);
		}

		if (data.type === 'markup') {
			const dataMarkup = data.overlayNinja;
			//console.warn("markup data received", dataMarkup);
			if (dataMarkup.action === "stroke") {
				const s = dataMarkup.stroke;
				drawingHistory[s.owner] ??= [];
				drawingHistory[s.owner].push(s);
				redrawCanvas();
			}

			if (dataMarkup.action === "eraseUser") {
				delete drawingHistory[dataMarkup.owner];
				redrawCanvas();
			}

			if (dataMarkup.action === "clearAll") {
				Object.keys(drawingHistory).forEach(k => delete drawingHistory[k]);
				redrawCanvas();
			}

			if (dataMarkup.action === "syncState" && isStreamer) {
				sendFullState();
			}

			if (dataMarkup.action === "stateDump") {
				Object.assign(drawingHistory, dataMarkup.state);
				redrawCanvas();
			}
		}
	});

	vdo.addEventListener('listing', (event) => {
		//lists all peers already in room, adds them to the registry
		const list = event.detail.list;
		if (!Array.isArray(list)) return;

		for (const item of list) {
			const uuid = item.UUID;
			const streamID = item.streamID || null;

			addToRegistry(uuid, null, streamID, null);
		}
	});

	vdo.addEventListener("peerListing", (event) => {
		//asks for all peers in room, can be run after same as listiing????
	});

	vdo.addEventListener("track", (event) => {
		//adds tracks to already registered peers, runs if a peer connects later
		const uuid = event.detail.uuid;
		const label = event.detail.label || null;
		const streamID = event.detail.streamID || null;
		const track = event.detail.track || null;

		if (!uuid) return;
		addToRegistry(uuid, label, streamID, track)
		//addTracksToStream(uuid, label, streamID, track);
	});

	vdo.addEventListener('iceConnectionStateChange', (event) => {
		//console.warn(`ICE connection state: ${event.detail.state}`);
	});

	vdo.addEventListener("peerInfo", (event) => {
		//comes later will contain the peer label (username) but not tracks
		const uuid = event.detail.uuid;
		const streamID = event.detail.streamID;
		const label = event.detail.info.label;

		addToRegistry(uuid, label, streamID, null)
		//console.warn("peer info",uuid, streamID,event);
	});


	vdo.addEventListener("videoaddedtoroom", (event) => {
		//will run as user connects once with streamID as null, second time with streamID
		const uuid = event.detail.uuid;
		const streamID = event.detail.streamID || null;
		if (!streamID) return;

		addToRegistry(uuid, null, streamID, null)
		//console.warn("video added to room",uuid, event);
	});

	if (typeof vdo === 'undefined') {
		console.warn('vdo is not available; cannot attach listeners');
		return;
	}

	//debug only, all events i know of
	// const sdkEvents = [
	// 	"connected","roomJoined",	"publishing",	"alert",	"error","connectionFailed","disconnected","listing",	"peerListing", "peerConnected","peerDisconnected", "peerInfo",	"track","trackRemoved","iceConnectionStateChange",	"videoaddedtoroom",	"description","offerSDP","someonejoined","other","dataChannelOpen","dataReceived","peerLatency","bye",	"seed"
	// ];
	// //Catch-all logger
	// sdkEvents.forEach(eventName => {
	// 	vdo.addEventListener(eventName, (event) => {
	// 		console.warn(`[SDK EVENT] ${eventName}`, event.detail);
	// 	});
	// });

	//catch any oddities, never popped up before?
}

//MS main stream only used by host
function setupVDOMSListeners() {
	vdoMS.addEventListener('peerConnected', (event) => {		//NOTE! vdoMS
		const uuid = event.detail.uuid;
		const pc = event.detail.connection?.pc;

		addToRegistry(uuid, null, null, null);
		playBeep(400, 1);
		//console.warn("peer connected to ms",uuid, pc);
	});

	vdoMS.addEventListener('peerDisconnected', (event) => {
		const uuid = event.detail.uuid;
		playBeep(200, 2);
		disconnectPeer(uuid);
		//console.warn("peer disconnected UUID:", event.detail);
	});

	vdoMS.addEventListener(`publishing`, (event) => {	//NOTE! vdoMS
		//only lists the stream being published????
		//console.warn("publishing Stream :", event);
	});

}

//
function setupVDOWRListeners() {
	vdoWR.addEventListener(`roomJoined`, (event) => {
		console.log("moved to waiting room :", event);
	});

	vdoWR.addEventListener(`roomLeft`, (event) => {
		console.log("left waiting room :", event.detail.room);
	});

	vdoWR.addEventListener('peerConnected', (event) => {		
		const uuid = event.detail.uuid;
		const pc = event.detail.connection?.pc;

		playBeep(400, 1);
		console.warn("peer connected to waiting room",uuid);
	});

	vdoWR.addEventListener('peerDisconnected', (event) => {
		const uuid = event.detail.uuid;
		playBeep(200, 2);
		disconnectPeer(uuid);
		console.warn("peer disconnected to waiting room", event.detail);
	});

	vdoWR.addEventListener(`publishing`, (event) => {	//NOTE! vdoMS
		//only lists the stream being published????
		console.warn("publishing Stream to waiting room:", event);
	});

}


// If the tab regains focus, re-request wake lock
document.addEventListener("visibilitychange", () => {
	if (!document.hidden && wakeLock) {
		//document.documentElement.requestFullscreen();

		enableWakeLock();
	}
});

