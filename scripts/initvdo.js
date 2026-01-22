//sets up vdoninja and streams
let firstRun = true;
let userStreamID = generateRandomID();
const sessionID = sessionStorage.getItem("sessionID");
const isStreamer = window.location.pathname.startsWith("/stream");
//let label = null;

//vdo sdk's, 
const vdo = new VDONinjaSDK({
	salt: "rpxl.app",
	allowFallback: false,
	debug: false
});

//if host then start second sdk for main stream only
const vdoMS = new VDONinjaSDK({
	salt: "rpxl.app",
	allowFallback: false,
	debug: false
});

//creates empty stream as placeholder till devices come online, then we replace tracks
function initStream(whichStream) {
	const stream = new MediaStream();
	//stream.name = whichStream;
	let video = null;

	if (whichStream == "user") { video = initUserVideoTrack(); }
	if (whichStream == "main") { video = initVideoTrack(); }

	const audio = initAudioTrack();

	stream.addTrack(video.track);
	stream.addTrack(audio.track);

	return {
		stream,
		video,
		audio
	};
}
//creates "silent" audio track, replaced later or used if device set to none
function initAudioTrack() {
	const ctx = new AudioContext();

	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	gain.gain.value = 0; // silence

	oscillator.connect(gain);

	const dest = ctx.createMediaStreamDestination();
	gain.connect(dest);

	oscillator.start();

	const track = dest.stream.getAudioTracks()[0];

	track.onended = () => {
		oscillator.stop();
		ctx.close();
	};

	return { track, ctx };
}
//creates color bars placeholder for main track
function initVideoTrack() {
	const bgColor = '#141414';
	const canvasMS = document.createElement("canvas");
	canvasMS.width = 320;
	canvasMS.height = 80;

	const colors = [
		'#FFFFFF', // White
		'#C0C000', // Yellow
		'#00C0C0', // Cyan
		'#00C000', // Green
		'#C000C0', // Magenta
		'#C00000', // Red
		'#0000C0'  // Blue
	];
	// Bottom bars: Blue (center), Magenta, Cyan, White on left
	const bottomColors = [
		'#0000C0', // Blue
		'#C000C0', // Magenta
		'#00C0C0', // Cyan
		'#FFFFFF'  // White
	];

	const ctx = canvasMS.getContext("2d");
	const barWidth = canvasMS.width / 7;
	let running = true;

	function draw() {
		if (!running) return;
		// Draw the main seven bars (top 2/3 of the height)
		const topHeight = canvasMS.height * 2 / 3;
		for (let i = 0; i < colors.length; i++) {
			ctx.fillStyle = colors[i];
			ctx.fillRect(i * barWidth, 0, barWidth, topHeight);
		}

		// Optional: Draw the PLUGE/Bottom Bars (bottom 1/3)
		const bottomHeight = canvasMS.height * 1 / 3;
		const bottomY = topHeight;
		const bottomBarWidth = canvasMS.width / 4;


		for (let i = 0; i < bottomColors.length; i++) {
			ctx.fillStyle = bottomColors[i];
			ctx.fillRect(i * bottomBarWidth, bottomY, bottomBarWidth, bottomHeight);
		}

		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 30, 320, 25);

		ctx.fillStyle = "#c1c1c1ff";
		ctx.font = "24px arial, sans-serif";
		ctx.fillText("No Video Source Selected", 22, 50);

		requestAnimationFrame(draw);
	}

	draw();

	const stream = canvasMS.captureStream(1);
	const track = stream.getVideoTracks()[0];

	// optional cleanup hook
	track.onended = () => {
		running = false;
		stream.getTracks().forEach(t => t.stop());
	};
	return { track, canvasMS, stream };
}
//creates placeholder user video track, lovely shades of pastel
function initUserVideoTrack() {
	const hue = Math.floor(Math.random() * 360);   // any color
	const saturation = 20 + Math.random() * 20;   // 60–80%
	const lightness = 30 + Math.random() * 5;    // 80–90%
	const bgColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;

	const ctx = canvas.getContext("2d");

	let running = true;

	function draw() {
		if (!running) return;

		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 0, 64, 64);

		requestAnimationFrame(draw);
	}

	draw();

	const stream = canvas.captureStream(1);
	const track = stream.getVideoTracks()[0];

	// optional cleanup hook
	track.onended = () => {
		running = false;
		stream.getTracks().forEach(t => t.stop());
	};

	return { track, canvas, stream };
}

//connect to vdo.ninja and join room always publish a user track
async function VDOConnect(sessionID) {
	//join room with placeholder stream will be replaced as devices come online
	setupVDOListeners();
	const userInit = initStream("user");
	STREAMS.user = userInit.stream;
	TRACKS.user.video = userInit.video.track;
	TRACKS.user.audio = userInit.audio.track;
	let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());

	await vdo.connect();
	await vdo.joinRoom({
		room: sessionID,
		mode: "full",
		label: sanitizedCurrentUserName,
		video: true,
		audio: true,
		data: true,
		viewOptions: {
			quality: 2,
			scale: .10
		}
	})

	if (!STREAMS.user || STREAMS.user.getTracks().length === 0) {
		throw new Error('Invalid media stream created');
	}

	if (isStreamer) userStreamID = `hs_${userStreamID}`; //append hs_ for host if streamer

	await vdo.publish(STREAMS.user, { streamID: userStreamID, role: "both" });
	document.getElementById("userStream").srcObject = STREAMS.user;

	if (isStreamer) {
		//if streamer publish main stream (placeholder for now)
		wait(50);
		const mainInit = initStream("main");
		STREAMS.main = mainInit.stream;
		TRACKS.main.video = mainInit.video.track;
		TRACKS.main.audio = mainInit.audio.track;
		const mainStreamID = "ms_" + generateRandomID();

		await vdoMS.connect();
		await vdoMS.joinRoom({
			room: sessionID,
			mode: "full",
			video: true,
			audio: true,
			data: true,
			viewOptions: {
				quality: 0,
				scale: 100
			}
		})

		if (!STREAMS.main || STREAMS.main.getTracks().length === 0) {
			throw new Error('Invalid media stream created');
		}

		await vdoMS.publish(STREAMS.main, { streamID: mainStreamID, role: "publisher" });
		document.getElementById("mainStream").srcObject = STREAMS.main;

		//sessionStorage.setItem("mainStreamID", mainStreamID);
	}

	initUserStream();
}

function setupVDOListeners() {
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
	if (typeof vdo === 'undefined') {
		console.warn('vdo is not available; cannot attach listeners');
		return;
	}

	//monitor resolution of main stream and activate / decativate tools, might not be necessary
	const mainVideoPreview = document.getElementById("mainStream");
	// mainVideoPreview.addEventListener("loadedmetadata", (event) => {
	//  console.warn("Meta:", event);
	// });

	mainVideoPreview.addEventListener("resize", () => {
		let w = mainVideoPreview.videoWidth;
		let h = mainVideoPreview.videoHeight;
		mainVideoPreview.style.width = `${w}px`;
		mainVideoPreview.style.height = `${h}px`;
		console.warn("main stream resolution: resize", w, h);
		if (w <= 320 && h <= 80) {
			deactivateTools("streamVideo");
			//must ping host to see if placeholder audio!
		} else {
			reactivateTools("streamVideo");
		}
	});

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
		//used to view peers that connect later in seesion (ignore streamID as will often be wrong)
		const uuid = event.detail.uuid;
		const pc = event.detail.connection?.pc;

		addToRegistry(uuid, null, null, null);
		const peer = REGISTRY.get(uuid);

		peer.transports ??= {};
		peer.transports.user = pc;

		limitVideoBitrateForUser(uuid);
			//	limitVideoBitrateForMainStream();
		//console.warn("peer connected",uuid, streamID,label, event);
	});

	// vdoMS.addEventListener('peerConnected', (event) => {
	// 	const uuid = event.detail.uuid;
	// 	const pc = event.detail.connection?.pc;

	// 	addToRegistry(uuid, null, null, null);
	// 	const peer = REGISTRY.get(uuid);

	// 	peer.transports ??= {};
	// 	peer.transports.main = pc;

	// 	limitVideoBitrateForMainStream();
	// 	//console.warn("peer connected to ms",uuid, pc);
	// });

	vdo.addEventListener('peerDisconnected', (event) => {
		//console.warn("peer disconnected UUID:", event.detail);
		const uuid = event.detail.uuid;

		disconnectPeer(uuid);
	});

	vdo.addEventListener('peerLatency', (event) => {
		// Show visual ping result for built-in SDK ping/pong

	});

	vdo.addEventListener('dataChannelOpen', (event) => {
		//console.warn(`Data channel opened with viewer: ${event.detail.uuid}...`, 'success');
		const uuid = event.detail.uuid;
		let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());

		vdo.sendData({
			type: 'userLabel',
			label: sanitizedCurrentUserName,
			timestamp: Date.now()
		}, uuid);

		//if we are streaming we need to send some extra data
		if (isStreamer) {
			let currentProjectName = encodeURIComponent(project.value.trim() || "");

			vdo.sendData({
				type: 'streamInfo',
				label: currentProjectName,
				timestamp: Date.now()
			});

		}
	});

	vdo.addEventListener('dataReceived', (event) => {
		//console.warn(`Data received from viewer:`, event);
		const uuid = event.detail.uuid;
		const data = event.detail.data;
		const streamID = event.detail.streamID;
		//console.warn("Data received from ", event);

		if (data.type === 'userLabel') {
			const label = data.label;
			const timestamp = data.timestamp;

			addToRegistry(uuid, label, streamID, null);
			updateDOMLabel(uuid, streamID, label);
			//console.warn(`Received user label from ${uuid}: ${label} at ${timestamp}`);
		}

		if (data.type === 'streamInfo') {
			const label = data.label;
			const projectTitle = document.getElementById("statusLeft");

			projectTitle.textContent = decodeURIComponent(label);
		}

		if (data.type === 'streamAudio') {
			const label = data.label;
			if (label === 'placeholderAudio') {
				deactivateTools("streamAudio");
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

	vdo.addEventListener(`publishing`, (event) => {
		//only lists the stream being published????
		//console.warn("publishing Stream :", event.detail.streamID);
	});

	vdo.addEventListener("videoaddedtoroom", (event) => {
		//will run as user connects once with streamID as null, second time with streamID
		const uuid = event.detail.uuid;
		const streamID = event.detail.streamID || null;
		if (!streamID) return;

		addToRegistry(uuid, null, streamID, null)
		//console.warn("video added to room",uuid, event);
	});

}

//adds any incoming video to the DOM, ms_ (main stream is ignored), hs_ (host) is always placed top 
function addPeerToDOM(uuid, streamID, label = null) {
	if (streamID.startsWith("ms_") || null) return;

	const peerListContainer = document.querySelector(".peerList");
	// Prevent duplicates
	if (document.getElementById(`peer_${uuid}`)) return;

	const peerDiv = document.createElement("div");
	peerDiv.className = "peer";
	peerDiv.id = `peer_${uuid}`;  // unique ID for later access

	// Create video element
	const video = document.createElement("video");
	video.className = "peerStream";
	video.id = `video_${uuid}`;
	video.autoplay = true;
	video.playsInline = true;
	video.disablePictureInPicture = true;

	// Create label
	const span = document.createElement("span");
	span.className = "peerLabel";
	if (streamID.startsWith("hs_")) {
		span.textContent = label || uuid.slice(0, 10) + " (Host)";
	} else {
		span.textContent = label || uuid.slice(0, 10); // fallback to uuid if no name
	}
	peerDiv.appendChild(video);
	peerDiv.appendChild(span);

	if (streamID.startsWith("hs_")) {
		peerListContainer.prepend(peerDiv);
	} else {
		peerListContainer.appendChild(peerDiv);
	}
}

function updateDOMLabel(uuid, streamID, label) {
	if (streamID.startsWith("hs_")) {
		label = decodeURIComponent(label) + " (Host)";
	} else {
		label = decodeURIComponent(label);
	}

	if (!label) return;
	const labelEl = document.querySelector(`#peer_${uuid} .peerLabel`);
	if (labelEl) labelEl.textContent = label;
	//console.warn(`Set label for peer ${uuid} to ${label}`, 'info');
}

async function disconnectPeer(uuid) {
	const mainStream = document.getElementById("mainStream");
	const peer = REGISTRY.get(uuid);
	if (!peer) return;
	const streams = peer.streams;

	for (let streamID of streams.keys()) {
		if (streamID.startsWith("ms_")) {
			mainStream.srcObject.getTracks().forEach(t => t.stop());
			mainStream.srcObject = null;
			deactivateTools("streamVideo");
			deactivateTools("streamAudio");
		}
	}

	const peerDiv = document.getElementById(`peer_${uuid}`);
	//vdo.stopViewing(streams);
	if (!peerDiv) return;

	//stop media
	peerDiv.querySelectorAll("video, audio").forEach(el => {
		if (el.srcObject) {
			el.srcObject.getTracks().forEach(t => t.stop());
			el.srcObject = null;
		}
	});

	peerDiv.remove();
	streams.clear();
	REGISTRY.delete(uuid);
}


//initializes the user stream with the correct video / audio device or a placeholder stream, also sets up the label
async function initUserStream() {
	//load previous settings
	const previousSettingsJSON = localStorage.getItem(APP_NS);
	if (!previousSettingsJSON) return;

	const settings = JSON.parse(previousSettingsJSON);
	if (!settings?.length) return;

	const last = settings[0];

	let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());

	//clients must have name
	if (!sanitizedCurrentUserName && !isStreamer) {
		const el = document.getElementById("name");
		el.style.animation = "pulse 500ms";
		setTimeout(() => (el.style.animation = "none"), 500);
		el.focus();
		return;
	}

	if (sanitizedCurrentUserName !== last.userName || firstRun == true) {
		const userLabel = document.getElementById("userLabel");
		userLabel.innerHTML = decodeURIComponent(sanitizedCurrentUserName);

		vdo.sendData({
			type: 'userLabel',
			label: sanitizedCurrentUserName,
			timestamp: Date.now()
		});
		storeSelectedDevicesUser();
	}

	const invalid = new Set(["", "0", "null", "none", null]); //list of invalid sources
	const cameraSelect = document.getElementById("cameraSource");
	const microphoneSelect = document.getElementById("microphoneSource");
	const cameraCurrentSource = cameraSelect?.value ?? "";
	const microphoneCurrentSource = microphoneSelect?.value ?? "";

	if (cameraCurrentSource !== last.cameraSource || firstRun == true) {
		let oldVideoTrack = TRACKS.user.video;
		let newVideoTrack = null;
		//init selected camera with low settings (ask nice)
		if (!invalid.has(cameraCurrentSource)) {
			const newMediaStream = await navigator.mediaDevices.getUserMedia({
				video: {
					deviceId: { exact: cameraCurrentSource },
					width: { ideal: 320 },
					height: { ideal: 240 },
					frameRate: { ideal: 15, max: 30 }
				},
				audio: false
			});

			newVideoTrack = newMediaStream.getVideoTracks()[0];
			newMediaStream.getAudioTracks().forEach(t => t.stop());
			reactivateTools("userCamera");
		} else {
			//console.warn("no user camera selected using placeholder");
			const tempVideo = initUserVideoTrack();
			newVideoTrack = tempVideo.track;
			deactivateTools("userCamera");
			hideBannerByKey("cam_muted");
		}

		if (oldVideoTrack !== newVideoTrack) {
			//console.warn("changing user camera track or 1st run")
			try {
				await vdo.replaceTrack(oldVideoTrack, newVideoTrack);
			} catch (error) {
				console.warn(`Failed to switch camera: ${error.message}`, 'error');
			}

			oldVideoTrack.stop();
			TRACKS.user.video = newVideoTrack;
			storeSelectedDevicesUser();

			//go through each connection and re-limit bitrate for user stream
			for (const peer of REGISTRY.values()) {
				//for (const stream of peer.streams.values()) {
					limitVideoBitrateForUser(peer.uuid);
				//}
			}
		}
	}
	//init select microphone 
	if (microphoneCurrentSource !== last.microphoneSource || firstRun == true) {
		let oldAudioTrack = TRACKS.user.audio;
		let newAudioTrack = null;

		if (!invalid.has(microphoneCurrentSource)) {
			const newMediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					deviceId: { exact: microphoneCurrentSource },
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				},
				video: false
			});

			newAudioTrack = newMediaStream.getAudioTracks()[0];
			newMediaStream.getVideoTracks().forEach(t => t.stop());
			reactivateTools("userMicrophone");
		} else {
			const tempAudio = initAudioTrack();
			newAudioTrack = tempAudio.track;

			deactivateTools("userMicrophone");
			hideBannerByKey("mic_muted");
			//console.warn("no user microphone selected usinf placeholder);
		}

		if (oldAudioTrack !== newAudioTrack) {
			//console.warn("changing user microphone track, or 1st run")
			try {
				await vdo.replaceTrack(oldAudioTrack, newAudioTrack)
			} catch (error) {
				console.warn(`Failed to switch microphone: ${error.message}`, 'error');
			}

			oldAudioTrack.stop();
			TRACKS.user.audio = newAudioTrack;
			storeSelectedDevicesUser();
		}
	}

	if (isStreamer) initMainStream();
	if (!isStreamer) firstRun = false; //we've run it before

	closeDialog(openModal, openIcon);
}

async function initMainStream() {
	//load previous settings
	const previousSettingsJSON = localStorage.getItem(APP_NS);
	if (!previousSettingsJSON) return;

	const settings = JSON.parse(previousSettingsJSON);
	if (!settings?.length) return;

	const last = settings[0];

	let currentProjectName = encodeURIComponent(project.value.trim() || "");

	if (currentProjectName !== last.projectName) {
		const projectTitle = document.getElementById("sessionName");
		projectTitle.textContent = decodeURIComponent(currentProjectName);

		//send updated project name to viewers
		vdo.sendData({
			type: 'streamInfo',
			label: currentProjectName,
			timestamp: Date.now()
		});

		storeSelectedDevicesSession();
	}

	const radio = document.querySelector('input[name="resolution"]:checked');
	const width = Number(radio.dataset.width);
	const height = Number(radio.dataset.height);

	let currentQuality = String(getCheckedRadioValue("quality"));

	const invalid = new Set(["", "0", "null", "none", null]);
	const videoSelect = document.getElementById("videoSource");
	const audioSelect = document.getElementById("audioSource");
	const videoCurrentSource = videoSelect?.value ?? "";
	const audioCurrentSource = audioSelect?.value ?? "";

	if (videoCurrentSource !== last.videoSource || height != last.resolution || currentQuality != last.quality || firstRun == true) {
		let oldVideoTrack = TRACKS.main.video;
		let newVideoTrack = null;

		//console.warn ("video setting changed:", height," stored height",last.resolution)
		if (!invalid.has(videoCurrentSource)) {
			const newMediaStream = await navigator.mediaDevices.getUserMedia({
				video: {
					deviceId: { exact: videoCurrentSource },
					width: { ideal: width },
					height: { ideal: height },
					frameRate: { ideal: 30, max: 60 }
				},
				audio: false
			});

			newVideoTrack = newMediaStream.getVideoTracks()[0];
			newMediaStream.getAudioTracks().forEach(t => t.stop());
		} else {
			const tempVideo = initVideoTrack();
			newVideoTrack = tempVideo.track;

			hideBannerByKey("video_blind");
			//console.warn("no user camera selected using placeholder");
		}

		if (oldVideoTrack !== newVideoTrack) {
			try {
				await vdoMS.replaceTrack(oldVideoTrack, newVideoTrack);
				//console.warn("replacing tracks old - new)", oldVideoTrack, newVideoTrack);
			} catch (error) {
				console.warn(`Failed to switch camera: ${error.message}`, 'error');
			}

			oldVideoTrack.stop();
			TRACKS.main.video = newVideoTrack;
			storeSelectedDevicesSession();
		}
		//re-limit bitrate for main stream
		limitVideoBitrateForMainStream();
	}

	//init selected audio source
	if (audioCurrentSource !== last.audioSource || firstRun == true) {
		let oldAudioTrack = TRACKS.main.audio;
		let newAudioTrack = null;

		if (!invalid.has(audioCurrentSource)) {
			const newMediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					deviceId: { exact: audioCurrentSource },
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				},
				video: false
			});

			newAudioTrack = newMediaStream.getAudioTracks()[0];
			newMediaStream.getVideoTracks().forEach(t => t.stop());
			reactivateTools("streamAudio");
		} else {
			//console.warn("no audio source selected creating empty stream");
			const tempAudio = initAudioTrack();
			newAudioTrack = tempAudio.track;

			vdo.sendData({
				type: 'streamAudio',
				label: 'placeholderAudio',
				timestamp: Date.now()
			});

			deactivateTools("streamAudio");
			hideBannerByKey("audio_muted");
		}

		if (oldAudioTrack !== newAudioTrack) {
			//console.warn("Audio source changed or 1st run");
			try {
				await vdoMS.replaceTrack(oldAudioTrack, newAudioTrack)
			} catch (error) {
				console.warn(`Failed to switch audio: ${error.message}`, 'error');
			}

			oldAudioTrack.stop();
			TRACKS.main.audio = newAudioTrack;
			storeSelectedDevicesSession();
		}
	}
	firstRun = false;
}