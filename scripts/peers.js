let connectedPeers = 0;

function updatePeerBadge(connectedPeers = 0) {
	const peersButton = document.getElementById("toolPeers");
	if (!peersButton) return;

	peersButton.dataset.count = connectedPeers;
}

//make sure any streamID's recieved are valid (20chars long, can start with ms_ or hs_)
function isValidStreamID(id) {
	if (typeof id !== "string") return false;

	const PREFIXES = ["ms_", "hs_"];
	const RANDOM_ID_LENGTH = 24;
	const BASE62_RE = /^[A-Za-z0-9]+$/;

	let randomPart = id;
	let hasKnownPrefix = false;

	for (const prefix of PREFIXES) {
		if (id.startsWith(prefix)) {
			randomPart = id.slice(prefix.length);
			hasKnownPrefix = true;
			break;
		}
	}

	// reject strings that *look* prefixed but aren't valid
	if (!hasKnownPrefix && id.includes("_")) return false;

	return randomPart.length === RANDOM_ID_LENGTH &&
		BASE62_RE.test(randomPart);
}

//creates REGISTRY of all connected peers, their stream, tracks, labels etc.
function addToRegistry(uuid, label = null, streamID = null, track = null) {
	if (!uuid) return; //stop if no uuid
	//add uuid to registry if it doesn't exist
	if (!REGISTRY.has(uuid)) {
		REGISTRY.set(uuid, {
			uuid,
			label,
			streams: new Map(),
			transports: {}
		});
	}

	const peer = REGISTRY.get(uuid);

	if (!isValidStreamID(streamID) || (!streamID)) return;

	if (!peer.streams.has(streamID)) {
		peer.streams.set(streamID, {
			streamID,
			audio: null,
			video: null
		});

		//connect to stream
		vdo.quickView({
			streamID: streamID,
			room: sessionID
		}).then(() => {
			//console.warn(`Now viewing: ${streamID}`, 'success');
		}).catch(err => {
			console.warn(`Failed to view: ${err.message}`, 'error');
			return;
		});
		connectedPeers++;
	}

	const stream = peer.streams.get(streamID);

	if (label) {
		peer.label = label;
	}

	addPeerToDOM(uuid, streamID, label);

	if (!track) return;
	//add tracks to registry if doesn't exist
	if (track.kind === "audio") {
		stream.audio = {
			trackID: track.id,
			track,
			label: track.label ?? null,
			muted: track.muted ?? false,
			readyState: track.readyState ?? "live"
		};
	} else if (track.kind === "video") {
		stream.video = {
			trackID: track.id,
			track,
			label: track.label ?? null,
			muted: track.muted ?? false,
			readyState: track.readyState ?? "live"
		};
	}
	addTracksToStream(uuid, streamID, track)
}

//attaches tracks to streams in DOM, ms_(main stream) is always dropped in main viewer
function addTracksToStream(uuid, streamID, track) {
	let whichStream = null;
	if (!isStreamer && streamID.startsWith("ms_")) {
		whichStream = document.getElementById('mainStream');
	} else {
		whichStream = document.getElementById(`video_${uuid}`);
	}
	if (!whichStream) {
		//console.log("something very bad has happened");
		return;
	}

	if (!whichStream.srcObject) {
		whichStream.srcObject = new MediaStream();
	}
	const stream = whichStream.srcObject;

	try {
		stream.getTracks().filter(t => t.kind === track.kind).forEach(t => stream.removeTrack(t));
	} catch (e) {
		console.warn("failed to remove tracks from stream ", stream, track)
	}

	try { stream.addTrack(track); } catch (e) {
		console.warn("failed to add tracks to stream ", stream, track)
	}

	if (track.kind === 'audio') {
		//do not reassigning srcObject, just ensure playback

	}
	if (track.kind === 'video') {
		//do not reassigning srcObject, just ensure playback
		whichStream.muted = false;
		whichStream.playsInline = true;
		whichStream.disablePictureInPicture = true;
		whichStream.preload = "metadata";

		whichStream.play().catch(() => { });
	}

	if (track.kind === 'audio' && streamID.startsWith("ms_")) {
		//reactivateTools("streamAudio");
	}
	if (track.kind === 'video' && streamID.startsWith("ms_")) {
		//reactivateTools("streamVideo");
	}
}

//low capture quality, low bandwidth, low framerate
function limitVideoBitrateForUser() {
	let brMax = "40kbps";
	let brMin = "20kbps";
	let frameRate = 15;

	vdo.updatePublisherMedia({
	media: {
		video: {
			height: 80,
			maxBitrate: brMax,
			minBitrate: brMin,
			frameRate: frameRate
			}
		}
	});

}

// //adding peers and tracks to DOM
// //adds any incoming video to the DOM, ms_ (main stream is ignored), hs_ (host) is always placed top 
function addPeerToDOM(uuid, streamID, label = null) {
	if (streamID.startsWith("ms_") || null) return;
	const peer = document.querySelector(`[data-uuid="${uuid}"]`);
	if (peer) return;

	//create elements per peer
	const peerDiv = document.createElement("div");
	peerDiv.className = "peer";
	peerDiv.setAttribute("data-uuid", uuid);

	const peerVU = document.createElement("div");
	peerVU.className = "peerVU";
	peerVU.setAttribute("data-property", "--vu");

	const video = document.createElement("video");
	video.className = "peerStream";
	video.id = `video_${uuid}`;
	video.autoplay = true;
	video.playsInline = true;
	video.disablePictureInPicture = true;

	peerVU.appendChild(video);

	const span = document.createElement("span");
	span.className = "peerLabel";
	span.textContent = label || uuid.slice(0, 10); // fallback to uuid if no name

	peerDiv.appendChild(peerVU);
	peerDiv.appendChild(span);

	if (isStreamer && !streamID.startsWith("hs_")) {
		const peerControls = document.createElement("span");
		peerControls.className = "material-symbols-outlined peer-options";
		peerControls.setAttribute("data-ui", "popover");
		peerControls.setAttribute("data-target", "peerControls");
		peerControls.setAttribute("aria-expanded", "false");
		peerControls.textContent = "more_vert";

		peerDiv.appendChild(peerControls);	//add controls for host
	}

	if (streamID.startsWith("hs_")) {
		sidePeers.prepend(peerDiv);
	} else {
		sidePeers.appendChild(peerDiv);
	}
							
	updatePeerRoomCount()
}

function updateDOMLabel(uuid, streamID, label) {
	const peer = document.querySelector(`[data-uuid="${uuid}"]`);
	if (!peer) return;

	if (streamID.startsWith("hs_") && !isStreamer) {
		label = decodeURIComponent(label) + " (Host)";
	} else {
		label = decodeURIComponent(label);
	}

	const labelEl = peer.querySelector(".peerLabel");
	if (labelEl) labelEl.textContent = label;
	//console.log("Updating label", uuid, streamID, label);
}

function updateDOMuserAudio(uuid, audio) {
	const peer = document.querySelector(`[data-uuid="${uuid}"]`);
	if (!peer) return;

	const userVUElement = peer.querySelector(".peerVU");
	if (!userVUElement) return;

	if (audio === "micOffline") {
		userVUElement.classList.add("micOffline");
		userVUElement.classList.remove("muted");
		return;
	}
	if (audio === "micMute") {
		userVUElement.classList.add("muted");
		userVUElement.classList.remove("micOffline");
		return;
	}	
	if (audio === "micLive") {
		userVUElement.classList.remove("muted");
		userVUElement.classList.remove("micOffline");
		return;
	}	
}

function updateDOMuserVU(uuid, level) {
	const peer = document.querySelector(`[data-uuid="${uuid}"]`);
	if (!peer) return;
	
	const userVUElement = peer.querySelector(".peerVU");
	if (!userVUElement) return;

	userVUElement.style.setProperty("--vu", level);
	//console.log("Updating VU for user", uuid, "to level", level);
}

async function disconnectPeer(uuid) {
	const mainStream = document.getElementById("mainStream");

	const peer = document.querySelector(`[data-uuid="${uuid}"]`);
	const peerREG = REGISTRY.get(uuid);

	if (!peer || !peerREG) return;

	const streams = peerREG.streams;

	for (let streamID of streams.keys()) {
		if (streamID.startsWith("ms_")) {
			mainStream.srcObject.getTracks().forEach(t => t.stop());
			mainStream.srcObject = null;
			setTools("video", false);
			setTools("audio", false);
		}
	}

	//stop media
	peer.querySelectorAll("video, audio").forEach(el => {
		if (el.srcObject) {
			el.srcObject.getTracks().forEach(t => t.stop());
			el.srcObject = null;
		}
	});

	peer.remove();
	streams.clear();
	REGISTRY.delete(uuid);

	updatePeerRoomCount();
}

async function moveToRoom(room, uuid){


		
	console.log("moving to ", moveToRoom);
	connectedPeers = 0;


	const peer = document.querySelector(`.toolbar-horiz`);
	peer.classList.add("hidden");
	mainStream.classList.add("hidden");
	sideFiles.classList.add("hidden");
	sideChat.classList.add("hidden");
	toolChat.classList.add("hidden");
	toolFiles.classList.add("hidden");
	

}

function togglePeerRoom(uuid) {
	let peer = null;
	if (uuid === localUUID) {
		peer= document.getElementById("user")
	} else {
		peer = document.querySelector(`.peer[data-uuid="${uuid}"]`);
	}
    if (!peer) return;

    const peers = document.getElementById("sidePeers");
    const waiting = document.getElementById("sideWaitingRoom");

    if (peer.parentElement === peers) {
		if (isStreamer) {
			vdo.sendData({
				type: "moveToRoom",
				room: "lobby",
				user: uuid
			});
		} else {
			updateRoomUI("lobby")
		}
       waiting.appendChild(peer);
    } else {
		if (isStreamer) {
			vdo.sendData({
				type: 'moveToRoom',
				room: "main",
				user: uuid
			});
		} else {
			updateRoomUI("main")
		}
       	peers.appendChild(peer);
    }

	updatePeerRoomCount()
}

function updatePeerRoomCount() {
	const mainRoom = document.getElementById("sidePeers");
	const mainCount = mainRoom.querySelectorAll(".peerVU").length;

	const mainRoomButton = document.getElementById("toolPeers");
	if (!mainRoomButton) return;
	mainRoomButton.dataset.count = mainCount - 1;

	const waitingRoom = document.getElementById("sideWaitingRoom");
	const waitingCount = waitingRoom.querySelectorAll(".peerVU").length;

	const waitingRoomButton = document.getElementById("toolWaitingRoom");

	if (!waitingCount) {
		waitingRoomButton.classList.add("hidden");
		waitingRoomButton.dataset.count = waitingCount;
	} else {
		waitingRoomButton.classList.remove("hidden");
		waitingRoomButton.dataset.count = waitingCount;
	}

	updateRoomAudio();
}

function updateRoomAudio() {

  const waitingVideos = document.querySelectorAll("#sideWaitingRoom video");
  const mainVideos = document.querySelectorAll("#sidePeers video");

  waitingVideos.forEach(v => setPeerAudio(v, true));
  mainVideos.forEach(v => setPeerAudio(v, false));

}

function setPeerAudio(video, enabled) {
    const stream = video.srcObject;
    if (!stream) return;

    const track = stream.getAudioTracks()[0];
    if (track) track.enabled = enabled;
}

function updateRoomUI(moveToRoom) {
	document.querySelectorAll('.side-panel:not(.hidden)').forEach(panel => panel.classList.add("hidden"));

    const waitingRoomBtn = document.getElementById("toolWaitingRoom");
    const chatBtn = document.getElementById("toolChat");
    const filesBtn = document.getElementById("toolFiles");
    const peersBtn = document.getElementById("toolPeers");

    if (moveToRoom === "lobby") {
        chatBtn.classList.remove("hidden");
        // hide buttons
        chatBtn.classList.add("hidden");
        filesBtn.classList.add("hidden");
        peersBtn.classList.add("hidden");
    } else {
		waitingRoomBtn.classList.add("hidden");
        chatBtn.classList.remove("hidden");
        filesBtn.classList.remove("hidden");
        peersBtn.classList.remove("hidden");
    }
}
