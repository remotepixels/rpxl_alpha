window.addEventListener('load', () => {
	//document.documentElement.requestFullscreen();
});

window.addEventListener('beforeunload', () => {
	if (vdo) {
		vdo.disconnect();
	}
});

document.addEventListener("visibilitychange", () => {
	if (!document.hidden && wakeLock) {
		//document.documentElement.requestFullscreen();

		enableWakeLock();
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
		const uuid = event.detail.uuid;
		const pc = event.detail.connection?.pc;
		let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());

		addToRegistry(uuid, null, null, null);

		if (oneOnOneUser) {
			excludeOneOnOne(uuid);
			//console.log("new peer connected excluding from one on one : ", uuid);
		}

		//if peer changes microphone settings, micLive / micOffline (if no mic selected, used because we always send stream)
		wait(500);	 //delay 
		
		//done 3 times once here, once on peerlist and on addvideo to be sure this stuff gets through!
		vdo.sendData({
			type: 'status',
			oneOnOneUser: oneOnOneUser,
			room: inRoom,
			timestamp: Date.now()
		}, uuid);

		vdo.sendData({
			type: 'userLabel',
			label: sanitizedCurrentUserName,
			timestamp: Date.now()
		}, uuid);

		vdo.sendData({
			type: 'userStreamAudio',
			info: userStreamAudio,
			timestamp: Date.now()
		}, uuid);

		vdo.sendData({
			type: 'oneOnOne',
			action: "active",
			user: oneOnOneUser,
			host: oneOnOneHost,
			timestamp: Date.now()
		});

		vdo.sendData({
			type: "markup",
			overlayNinja: {
				action: "syncState",
				to: uuid
			}
		}, uuid);
		// if (isStreamer) {
		// 	let currentProjectName = encodeURIComponent(project.value.trim() || "");
			
		// 	vdo.sendData({
		// 		type: 'streamInfo',
		// 		label: currentProjectName,
		// 		timestamp: Date.now()
		// 	}, uuid);

		// 	vdo.sendData({
		// 		type: 'mainStreamAudio',
		// 		info: mainStreamAudio,
		// 		timestamp: Date.now()
		// 	}, uuid);

		// 	vdo.sendData({
		// 		type: "chatHistory",
		// 		history: chatHistory
		// 	}, uuid);

		// 	vdo.sendData({
		// 		type: "markup",
		// 		overlayNinja: {
		// 			action: "syncState",
		// 			to: uuid
		// 		}
		// 	}, uuid);
		// }
	});

	vdo.addEventListener('peerDisconnected', (event) => {
		const uuid = event.detail.uuid;

		removeFiles(uuid);
		disconnectPeer(uuid);
		//console.warn("peer disconnected UUID:", event.detail);
	});

	vdo.addEventListener('peerLatency', (event) => {
		// Show visual ping result for built-in SDK ping/pong

	});

	vdo.addEventListener('dataChannelOpen', (event) => {
		//RUNS - ONCE FOR DATA, ONCE FOR VIDEO/AUDIO
		const uuid = event.detail.uuid;

		//console.warn(`Data channel opened with viewer: ${event.detail.uuid}...`, 'success');
	});

	//custom data type events 
	vdo.addEventListener('dataReceived', (event) => {
		const uuid = event.detail.uuid;
		const data = event.detail.data;
		const streamID = event.detail.streamID;
		const payload = event.detail.data.payload;
		//console.log("Data received from ", event);
		
		//user events
		if (data.type === 'uuidInfo') {
			localUUID = data.uuidInfo;

			document.getElementById("user").setAttribute("data-uuid", localUUID);
			console.log("Recieved local UUID Info :", localUUID);

			//if we have to join waiting room announce and move immediately
			if (joinWaiting === true) {
				vdo.sendData({
					type: "moveToRoom",
					room: "lobby",
					user: localUUID
				});
				
				togglePeerRoom(localUUID, "lobby");
				wait(100);
				document.getElementById("app").classList.remove("hidden");
			}
		}

		if (data.type === 'remoteToggleMic') {
			const button = document.querySelector('[data-action="muteMicrophone"]');

			UI.toggle(button);

			//console.log("what use is a phone call if you can't speak mr anderson?");
		}

		//recieved on connection, moves each user to the correct room sets them as one one
		if (data.type === 'status') {
			const room = data.room;
			
			const oneOnOneUser = data.oneOnOneUser;
			//const oneOnOneHost = data.oneOnOneHost;

			if (room) {
				togglePeerRoom(uuid, room);
				//console.log("move user on connect:", uuid ," to room :", room);
			}

			 if (oneOnOneUser) {
				toggleOneOnOne(oneOnOneUser, uuid);
				//console.log("setting user one on one on connect :", oneOnOneUser);
			 }
		}

		if (data.type === 'moveToRoom') {
			const userToMove = data.user;
			const toRoom = data.room;
			if (!userToMove || !toRoom) return;

			togglePeerRoom(userToMove, toRoom);
			//console.log("move user :", userToMove, "to: ", toRoom);
		}
		
		if (data.type === 'oneOnOne') {
			const action = data.action;
			const oneOnOneUser = data.user;
			const oneOnOneHost = data.host;

			if (!oneOnOneUser || !oneOnOneHost || !action) return;

			if (action == "off") {
				clearOneOnOne();
				//console.log("One on one off ");
			}
			
			if (action == "active") {
				toggleOneOnOne(oneOnOneUser, oneOnOneHost);
				//console.log("One on one : ", oneOnOneUser, "host : " ,oneOnOneHost);
			}

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

		//chat
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

		//markup events
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
				//console.log("recieved markup syncState");
				sendFullState();
			}

			if (dataMarkup.action === "stateDump") {
				//console.log("recieved markup state dump");
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
	});

	vdo.addEventListener('iceConnectionStateChange', (event) => {
		//console.warn(`ICE connection state: ${event.detail.state}`);
	});

	vdo.addEventListener("peerInfo", (event) => {
		//comes later will contain the peer label (username) but not tracks
		const uuid = event.detail.uuid;
		const streamID = event.detail.streamID;
		const label = event.detail.info.label;
		let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());

		addToRegistry(uuid, label, streamID, null)
		handleGuestFiles(uuid)

		vdo.sendData({
			type: 'uuidInfo',
			uuidInfo: uuid,
			timestamp: Date.now()
		}, uuid);

		vdo.sendData({
			type: 'status',
			oneOnOneUser: oneOnOneUser,
			room: inRoom,
			timestamp: Date.now()
		}, uuid);

		vdo.sendData({
			type: 'userLabel',
			label: sanitizedCurrentUserName,
			timestamp: Date.now()
		}, uuid);

		if (isStreamer) {
			wait (500);
			let currentProjectName = encodeURIComponent(project.value.trim() || "");
			
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
				type: "chatHistory",
				history: chatHistory
			}, uuid);

		}

	});


	vdo.addEventListener("videoaddedtoroom", (event) => {
		//will run as user connects once with streamID as null, second time with streamID
		const uuid = event.detail.uuid;
		const streamID = event.detail.streamID || null;
		let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());

		if (!streamID) return;

		addToRegistry(uuid, null, streamID, null)

		vdo.sendData({
			type: 'status',
			oneOnOneUser: oneOnOneUser,
			room: inRoom,
			timestamp: Date.now()
		}, uuid);

		vdo.sendData({
			type: 'userLabel',
			label: sanitizedCurrentUserName,
			timestamp: Date.now()
		}, uuid);

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
		//console.warn("publishing Stream :", event);
	});

}

