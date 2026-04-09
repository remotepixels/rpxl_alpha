//shared functions that I don't know where to put :(
//keeps track off all connected peers, their streams, last tracks and label, see structure below
// Map {
//   "peerUUID" => {
//     uuid: "peerUUID",
//     label: "Alice",
//     streams: Map {
//       "streamID" => {
//         streamID: "streamID",
//         tracks: Map {
//           "audio" => { ...latest audio track... },
//           "video" => { ...latest video track... }
//         }
//       }
//     }
//	transports:{
//		main:null,
//		user:null
//		}
//   }

let connectedPeers = 0;
let oneOnOneUser = null;
let oneOnOneHost = null;
let inRoom = "main";

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

	//if (uuid && streamID && label) {
	addPeerToDOM(uuid, streamID, label);
	//}

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
	addTracksToStream(uuid, streamID, track);
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
	peerDiv.setAttribute("data-room", "main");

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

	if (uuid === oneOnOneUser || uuid === oneOnOneHost) {
		clearOneOnOne();
	}
	connectedPeers--;
	updatePeerRoomCount();
}

function togglePeerRoom(uuid, targetRoom) {
	if (!uuid || !targetRoom) return;

	//const = null;
	const peer = document.querySelector(`.peer[data-uuid="${uuid}"]`);

	if (!peer) return;
	let target = null;

	if (targetRoom === "main") {
		target = document.getElementById("sidePeers");
	} else {
		target = document.getElementById("sideWaitingRoom");
		targetRoom = "lobby";
	}

	if (peer.parentElement === target) return;

	if (uuid === localUUID) {
		console.log("moving to room :", targetRoom);
		inRoom = targetRoom;

		updateRoomUI(targetRoom);
	}

	if (isStreamer) {
		vdo.sendData({
			type: "moveToRoom",
			room: targetRoom,
			user: uuid
		});
	}

	peer.dataset.room = targetRoom;
	target.appendChild(peer);
	console.log("SET:", targetRoom, "READ:", peer.dataset.room);

	updatePeerRoomCount();
}

function toggleOneOnOne(targetUUID, hostUUID) {
	const amIHost = (localUUID === hostUUID);
	const amITarget = (localUUID === targetUUID);
	const isParticipant = amIHost || amITarget;

	const peerElements = document.querySelectorAll('#sidePeers .peer');

	peerElements.forEach(peerEl => {

		const video = peerEl.querySelector('video');
		if (!video) return;

		const peerId = peerEl.dataset.uuid;

		const isHostPeer = (peerId === hostUUID);
		const isTargetPeer = (peerId === targetUUID);
		const isInWhisperPair = isHostPeer || isTargetPeer;

		if (isParticipant) {
			if (isInWhisperPair) {
				showBanner({ key: "oneOnOne", message: "You are in one on one", type: "notification", timeout: null });

				video.volume = 1;
				video.muted = false;

			} else {
				video.volume = 0.1;
				video.muted = false;
			}

		} else {
			if (isInWhisperPair) {
				video.volume = 1;
				video.muted = true;
			} else {
				video.volume = 1;
				video.muted = false;
			}
		}

		let shouldDim;

		if (isParticipant) {
			shouldDim = !isInWhisperPair;   // dim others
		} else {
			shouldDim = isInWhisperPair;    // dim whisper pair
		}

		peerEl.classList.toggle('dimmed', shouldDim);
	});
}

function excludeOneOnOne(excludeUUID) {
	console.log("late joiner exclude from one on one", excludeUUID)
	const peerEl = document.querySelector(`[data-uuid="${excludeUUID}"]`);
	if (!peerEl) return;
	const video = peerEl.querySelector('video');

	peerEl.classList.add('dimmed');
	video.volume = 0.1;
	video.muted = false;
}

function clearOneOnOne() {
	//if (oneOnOneUser === null) return;

	document.querySelectorAll('#sidePeers .peer').forEach(peerEl => {
		const video = peerEl.querySelector('video');

		if (video) {
			video.muted = false;
			video.volume = 1;
		}

		peerEl.classList.remove('dimmed');

	});

	document.querySelectorAll('#peerControls .tool').forEach(popupEl => {
		popupEl.classList.remove("hidden");
	});

	vdo.sendData({
		type: 'oneOnOne',
		action: "off",
		user: oneOnOneUser,
		host: oneOnOneHost,
		timestamp: Date.now()
	});

	hideBannerByKey("oneOnOne");

	document.querySelector('[data-action="oneOnOne"]').classList.remove("selected");
	const oneOnOneBtn = document.querySelector('[data-action="oneOnOne"]');
	if (oneOnOneBtn) {
		oneOnOneBtn.classList.remove("selected");
		oneOnOneBtn.setAttribute("aria-pressed", "false");
	}
	oneOnOneUser = null;
	oneOnOneHost = null;
}
function updatePeerRoomCount() {
	const mainRoom = document.getElementById("sidePeers");
	const mainCount = mainRoom.querySelectorAll(".peerVU").length;

	const mainRoomButton = document.getElementById("toolPeers");
	const waitingRoom = document.getElementById("sideWaitingRoom");
	const waitingCount = waitingRoom.querySelectorAll(".peerVU").length;

	const waitingRoomButton = document.getElementById("toolWaitingRoom");
	if (!waitingRoomButton) return;
	waitingRoomButton.dataset.count = waitingCount;

	if (isStreamer) {
		if (!waitingCount) {
			waitingRoomButton.classList.add("hidden");
		} else {
			waitingRoomButton.classList.remove("hidden");
		}
	}
	
	updateRoomAudio();
}

function updateRoomAudio() {
	console.log("MY ROOM:", inRoom);

	const allVideos = document.querySelectorAll(".peerVU video");

	allVideos.forEach(video => {
		if (video.id === "userStream") return;

		const peerEl = video.closest(".peer");
		if (!peerEl) return;

		const peerRoom = peerEl.dataset.room || "main";

		const shouldHear = (peerRoom === inRoom);

		console.log(
			"PEER:", video.id,
			"dataset.room:", peerEl.dataset.room,
			"I am in Room:", inRoom
		);

		setPeerAudio(video, shouldHear);
	});
}

function setPeerAudio(video, enabled) {

	const stream = video.srcObject;
	if (!stream) return;

	video.muted = !enabled; //oppositesies

	const track = stream.getAudioTracks()[0];
	if (track) track.enabled = enabled;
	//	console.log("v element:", video, "video:" ,video.muted, "track :", track.enabled )

}

function updateRoomUI(moveToRoom) {
	document.querySelectorAll('.side-panel:not(.hidden)').forEach(panel => panel.classList.add("hidden"));

	const waitingRoomBtn = document.getElementById("toolWaitingRoom");
	const chatBtn = document.getElementById("toolChat");
	const filesBtn = document.getElementById("toolFiles");
	const peersBtn = document.getElementById("toolPeers");
	const mainToolbar = document.querySelector(".toolbar.horiz");
	const mainVideo = document.querySelector(".mainStream");
	const zoomIndicator = document.querySelector(".zoom-popup");
	const mainVU = document.getElementById("mainStreamVU");
	const markup = document.getElementById("markup");

	if (moveToRoom == "lobby") {
		waitingRoomBtn.classList.remove("hidden");
		// hide buttons
		[chatBtn, filesBtn, peersBtn, mainToolbar, mainVU, zoomIndicator, mainVideo, markup].forEach(el => el?.classList.add("hidden"));

		setPeerAudio(mainVideo, false);
	} else {
		waitingRoomBtn.classList.add("hidden");
		//show buttons
		[chatBtn, filesBtn, peersBtn, mainToolbar, mainVU, zoomIndicator, mainVideo, markup].forEach(el => el?.classList.remove("hidden"));

		setPeerAudio(mainVideo, true);
	}
}
