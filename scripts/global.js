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


  
window.addEventListener('load', () => {
//?
});

window.addEventListener('beforeunload', () => {
	if (vdo) {
		vdo.disconnect();
	}
});

function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function generateRandomID(len = 20) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const arr = new Uint8Array(len);
	crypto.getRandomValues(arr);
	return Array.from(arr, n => chars[n % chars.length]).join('');
}

function randomBG () {
    // Detect dark / light mode and select bg
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const numberArrayBG = Array.from({ length: 6 }, (_, i) => String(i).padStart(3, '0'));
    const randomBG = numberArrayBG[Math.floor(Math.random() * numberArrayBG.length)];
    const theme = isDarkMode ? 'dark' : 'light';
    const imageUrl = `/backgrounds/${theme}_${randomBG}.jpg`;

    document.body.style.backgroundImage = `url('${imageUrl}')`;
}

//check quality and resolution radio buttons
function getCheckedRadioValue(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : null;
}

//used to reset setttings dialog to previous values on open for host
async function restoreSettingsHost() {
    const previousSettingsJSON = localStorage.getItem(APP_NS);
    if (!previousSettingsJSON) return;

    const settings = JSON.parse(previousSettingsJSON);
    const entry = settings && settings[0];
    if (!entry) return;

	//ugly need to rework this shit
	document.getElementById("res1080P").checked = false;
    document.getElementById("res720P").checked = false;
    if (entry.resolution === "1080") document.getElementById("res1080P").checked = true;
    if (entry.resolution === "720") document.getElementById("res720P").checked = true;

    const qualityMap = {
        "16000000": "qualityHigh",
        "800000": "qualityMed",
        "4000": "qualityLow"
    };

    Object.values(qualityMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    const q = document.getElementById(qualityMap[entry.quality]);
    if (q) q.checked = true;

    restoreDeviceSelection("videoSource", entry.videoSource);
    restoreDeviceSelection("audioSource", entry.audioSource);
    restoreDeviceSelection("cameraSource", entry.cameraSource);
    restoreDeviceSelection("microphoneSource", entry.microphoneSource);

    const name = document.getElementById("name");
	const savedName = decodeURIComponent(entry.userName);
    if (name && savedName != "(Host)") name.value = savedName;
}

//used to reset setttings dialog to previous values on open for client
async function restoreSettingsClient() {
    const previousSettingsJSON = localStorage.getItem(APP_NS);
    if (!previousSettingsJSON) return;
	
    const settings = JSON.parse(previousSettingsJSON);
    const entry = settings && settings[0];
    if (!entry) return;

    restoreDeviceSelection("cameraSource", entry.cameraSource);
    restoreDeviceSelection("microphoneSource", entry.microphoneSource);

    const name = document.getElementById("name");
    if (name) name.value = decodeURIComponent(entry.userName);
}

//selects the correct devices in the dropdowns based on saved device ids
async function restoreDeviceSelection(selectId, savedDeviceId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.value = savedDeviceId;

    //fallback to "none" or first
    if (select.value !== savedDeviceId) {
        if (select.querySelector('option[value="none"]')) {
            select.value = "none";
        } else if (select.querySelector('option[value=""]')) {
            select.value = "";
        } else {
            select.selectedIndex = 0;
        }
    }
}

//store session settings to localStorage
function storeSelectedDevicesSession() {
    const sessionsJSON = localStorage.getItem(APP_NS);
    if (!sessionsJSON) return;

    const sessions = JSON.parse(sessionsJSON);
    if (sessions.length === 0) return;

    const latest = sessions[0]; // do NOT replace timestamp or sessionID

    const projectInput = document.getElementById("project");
    const video = document.getElementById("videoSource");
    const audio = document.getElementById("audioSource");

    const merged = updateSessionEntry(latest, {
        projectName: encodeURIComponent(projectInput.value.trim() || ""),
        resolution: getCheckedRadioValue("resolution") || "",
        quality: getCheckedRadioValue("quality") || "",
        videoSource: video.selectedOptions[0].value || "",
        audioSource: audio.selectedOptions[0].value || "",
    });

    sessions[0] = merged;
    localStorage.setItem(APP_NS, JSON.stringify(sessions));
}

//store user settings to localStorage
function storeSelectedDevicesUser() {
    const sessionsJSON = localStorage.getItem(APP_NS);
    if (!sessionsJSON) return;

    const sessions = JSON.parse(sessionsJSON);
    if (sessions.length === 0) return;

    const latest = sessions[0]; // do NOT replace timestamp or sessionID

    const sanitizedUserName = encodeURIComponent(document.getElementById("name").value.trim());
    const camera = document.getElementById("cameraSource");
    const microphone = document.getElementById("microphoneSource");

    const merged = updateSessionEntry(latest, {
        userName: sanitizedUserName || "",
        cameraSource: camera.selectedOptions[0].value || "",
        microphoneSource: microphone.selectedOptions[0].value || "",
    });

    sessions[0] = merged;
    localStorage.setItem(APP_NS, JSON.stringify(sessions));
}
//used if user changes any settings during a session
function updateSessionEntry(baseEntry, updates) {
    return { ...baseEntry, ...updates };
}

//main and user streams and tracks used for local playback
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
	addTracksToStream (uuid, streamID, track)
}

//attaches tracks to streams in DOM, ms_(main stream) is always dropped in main viewer
function addTracksToStream (uuid, streamID, track){
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
			params.encodings[0].scaleResolutionDownBy = 4;
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