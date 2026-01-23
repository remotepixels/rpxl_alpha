//shared functions that I don't know where to put :(


//WAKE LOCK TO PREVENT SLEEPING DURING LARGE TRANSFERS
async function enableWakeLock() {
	try {
		wakeLock = await navigator.wakeLock.request("screen");
		wakeLock.addEventListener("release", () => {
			//console.log("Wake Lock was released");
		});
		//console.log("Wake Lock active");
	} catch (err) {
		console.error(`${err.name}, ${err.message}`);
	}
}

async function disableWakeLock() {
	if (!wakeLock) return;
	try {
		await wakeLock.release();
		wakeLock = null;
		//console.log("Wake Lock disabled");
	} catch (err) {
		console.error(err);
	}
}

// If the tab regains focus, re-request wake lock
document.addEventListener("visibilitychange", () => {
	if (!document.hidden && wakeLock) {
		enableWakeLock();
	}
});

//resize markup canvas on window resize
window.addEventListener("resize", () => {
	wait(50); //wait for resize to finish	
	resizeMarkupCanvas() //markup.js
});

window.addEventListener('load', () => {
	//?
});

window.addEventListener('beforeunload', () => {
	if (vdo) {
		vdo.disconnect();
	}
});

function wait(ms = 50) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function generateRandomID(len = 20) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const arr = new Uint8Array(len);
	crypto.getRandomValues(arr);
	return Array.from(arr, n => chars[n % chars.length]).join('');
}

//main and user streams and tracks used for local playback used in initvdo.js
const TRACKS = {
	main: {
		video: null,
		audio: null
	},
	user: {
		video: null,
		audio: null
	}
};

const STREAMS = {
	user: null,
	main: null
};

//keeps track off all connected peers, their streams, last tracks and label, see structure below
const REGISTRY = new Map();
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
//main:null,
//user:null
//}
//	
//   }
// }

//make sure any streamID's recieved are valid (20chars long, can start with ms_ or hs_)
function isValidStreamID(id) {
	if (typeof id !== "string") return false;

	const PREFIXES = ["ms_", "hs_"];
	const RANDOM_ID_LENGTH = 20;
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

	if (!isValidStreamID(streamID) || (!streamID)) {
		//console.warn("Invalid stream ID:", streamID);
		return;
	}

	//add stream to registry if it doesn't exist
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
		whichStream.muted = true;
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
function limitVideoBitrateForUser(uuid) {
	const peer = REGISTRY.get(uuid);
	if (!peer) return;

	const streams = peer.streams;

	for (let streamID of streams.keys()) {
		if (streamID.startsWith("ms_")) {
			return;
		} else {
			const pc = peer.transports?.user;
			if (!pc) return;

			const sender = pc.getSenders().find(
				s => s.track?.kind === "video"
			);

			if (!sender) return;

			const params = sender.getParameters();
			params.encodings ??= [{}];

			params.encodings[0].maxBitrate = 30_000;
			params.encodings[0].minBitrate = 5_000;
			params.encodings[0].scaleResolutionDownBy = 2;
			params.encodings[0].maxFramerate = 5;
			params.encodings[0].priority = "low";
			params.encodings[0].degradationPreference = "maintain-framerate";

			//console.warn("Applying bitrate limit to user",uuid);
			sender.setParameters(params).catch(err => {
				console.warn("Failed to set bitrate:", err);
			});
		}
	}
}

//this ain't doin' shit but you get the idea
function limitVideoBitrateForMainStream() {
	// Get the first connection object in the map
	const firstConn = [...vdoMS.connections.values()][0];
	// Pull the RTCPeerConnection from publisher
	const pc = firstConn?.publisher?.pc;

	if (!pc) return console.warn("vdoMS PC not ready", vdoMS);

	const sender = pc.getSenders().find(s => s.track?.kind === "video");
	if (!sender) return console.warn("No main stream sender yet");

	const params = sender.getParameters();
	params.encodings ??= [{}];

	params.encodings[0].maxBitrate = 50_000; // 50 kbps example
	params.encodings[0].scaleResolutionDownBy = 4;
	params.encodings[0].maxFramerate = 15;

	sender.setParameters(params).catch(console.warn);
}


/*
for vu of individuals

.peerStream {
	outline: 3px solid var(--mic-color, red);
	--vu-level: 0%;
	position: relative;
}

.peerStream::after {
	content: "";
	position: absolute;
	inset: -3px;
	border-radius: inherit;
	pointer-events: none;

	background: linear-gradient(
		to top,
		rgba(0,150,255,0.9) var(--vu-level),
		rgba(0,150,255,0.0) var(--vu-level)
	);
	mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
	-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
	mask-composite: exclude;
	-webkit-mask-composite: xor;
	padding: 3px;
}


function updatePeerVU(uuid, level) {
	const video = document.querySelector(`#video_${uuid}`);
	if (!video) return;

	// clamp 0–100
	level = Math.max(0, Math.min(level, 100));

	video.style.setProperty("--vu-level", `${level}%`);
}

const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;

updatePeerVU(myUUID, avg);

function updateDOMuserAudio(uuid, audio) {
	const video = document.querySelector(`#video_${uuid}`);
	if (!video) return;

	video.classList.remove("micLive", "micMute", "micStandby");

	if (audio === "micLive") {
		video.classList.add("micLive");
		video.style.setProperty("--mic-color", "lightgrey");
	}
	if (audio === "micMute") {
		video.classList.add("micMute");
		video.style.setProperty("--mic-color", "red");
		video.style.setProperty("--vu-level", "0%");
	}
	if (audio === "micStandby") {
		video.classList.add("micStandby");
		video.style.setProperty("--mic-color", "orange");
	}
}


pc.getStats().then(stats => {
	stats.forEach(r => {
		if (r.type === "inbound-rtp" && r.kind === "audio") {
			const level = (r.audioLevel || 0) * 100;
			updatePeerVU(uuid, level);
		}
	});
});


sendData({ type: "vu", level: avg });

  let last = 0;
function smoothVU(uuid, level) {
	last = last * 0.7 + level * 0.3;
	updatePeerVU(uuid, last);
}



*/