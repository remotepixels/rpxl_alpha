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
// }
const REGISTRY = new Map();

//main and user streams and tracks used for local playback used in initvdo.js
//should probaly merge with REGISTRY???????
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

let wakeLock = null;

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

function wait(ms = 50) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function generateRandomID(len = 20) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const arr = new Uint8Array(len);
	crypto.getRandomValues(arr);
	return Array.from(arr, n => chars[n % chars.length]).join('');
}

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

//liimits main stream bitrate (and it works now biches)
function limitVideoBitrateForMainStream(bitrate, height) {
	let brMax = "1mbps";
	let brMin = "1mbps";
	let frameRate = 3;

	if (bitrate === "high") {
		brMax = "16mbps";
		brMin = "8mbps";
		frameRate = 30;
	}

	if (bitrate === "med") {
		brMax = "8mbps";
		brMin = "4mbps";
		frameRate = 30;
	}	
	
	if (bitrate === "low") {
		brMax = "4mbps";
		brMin = "2mbps";
		frameRate = 30;
	}

	vdoMS.updatePublisherMedia({
	media: {
		video: { 
			 codec: "h264",
			width: height * (16/9),
			height: height,
			maxBitrate: brMax,
			minBitrate: brMin,
			frameRate: frameRate
			},
	    audio: {
	    	codec: "opus",
    		bitrate: "64k"
			}
		},
		
	encoding: {
		video: { 
			 codec: "h264",
				maxBitrate: brMax,
				minBitrate: brMin
				}
			}

	});
}



// let mainVU = {
//   ctx: null,
//   analyser: null,
//   data: null,
//   stream: null
// };

function initMainStreamVU(videoEl) {
  if (!videoEl.srcObject) return;

  mainVU.stream = videoEl.srcObject;

  mainVU.ctx = new AudioContext();
  const source = mainVU.ctx.createMediaStreamSource(mainVU.stream);

  mainVU.analyser = mainVU.ctx.createAnalyser();
  mainVU.analyser.fftSize = 512;
  source.connect(mainVU.analyser);

  mainVU.data = new Uint8Array(mainVU.analyser.frequencyBinCount);

  startMainVULoop();
}

function getMainStreamVolume() {
  if (!mainVU.analyser) return 0;

  mainVU.analyser.getByteTimeDomainData(mainVU.data);

  let sum = 0;
  for (let i = 0; i < mainVU.data.length; i++) {
    const v = (mainVU.data[i] - 128) / 128;
    sum += v * v;
  }

  return Math.sqrt(sum / mainVU.data.length); // 0 → 1
}

function startMainVULoop() {
  function loop() {
    const vol = getMainStreamVolume();
	const qVol = Math.round(vol * 255);

	setInterval(() => {
		const vol = getMainStreamVolume();
		vdo.sendData({ 
			type: "mainStreamVU", 
			volume: qVol 
		});
	}, 100);

    requestAnimationFrame(loop);
  }
  loop();
}

/*
//Minimal analyser setup (host side)
const MainVU = {
  ctx: null,
  analyser: null,
  data: null,
  stream: null,
  rms: 0,
  peak: 0
};

function attachVUMeterToStream(stream) {
  if (MainVU.ctx) return; // already attached

  MainVU.stream = stream;
  MainVU.ctx = new AudioContext();

  const source = MainVU.ctx.createMediaStreamSource(stream);

  MainVU.analyser = MainVU.ctx.createAnalyser();
  MainVU.analyser.fftSize = 256; // smaller = cheaper
  source.connect(MainVU.analyser);

  MainVU.data = new Uint8Array(MainVU.analyser.fftSize);
}

//Zero-GC RMS loop
function updateVU() {
  const a = MainVU.analyser;
  if (!a) return;

  a.getByteTimeDomainData(MainVU.data);

  let sum = 0;
  let peak = 0;

  for (let i = 0; i < MainVU.data.length; i++) {
    const v = (MainVU.data[i] - 128) * 0.0078125; // /128 without division
    const av = v < 0 ? -v : v;
    sum += v * v;
    if (av > peak) peak = av;
  }

  MainVU.rms = Math.sqrt(sum / MainVU.data.length);
  MainVU.peak = peak;
}

//smoothing
const VUSmooth = {
  rms: 0,
  peak: 0,
  decay: 0.95 // lower = faster falloff
};

function smoothVU() {
  const attack = 0.6; // fast rise
  const decay = VUSmooth.decay;

  const r = MainVU.rms;
  const p = MainVU.peak;

  VUSmooth.rms = r > VUSmooth.rms 
    ? VUSmooth.rms + (r - VUSmooth.rms) * attack
    : VUSmooth.rms * decay;

  VUSmooth.peak = p > VUSmooth.peak 
    ? p
    : VUSmooth.peak * decay;
}

//log scaling
function perceptual(v) {
  return Math.log10(1 + v * 9);
}

///plugin wrapper
function enableVDOAutoVU(vdo) {
  let timer = null;

  vdo.on("publish", (stream) => {
    console.log("VU attached to published stream");
    attachVUMeterToStream(stream);
    startVUBroadcast();
  });

  function startVUBroadcast() {
    if (timer) return;

    timer = setInterval(() => {
      updateVU();
      smoothVU();

      const v = perceptual(VUSmooth.rms);
      const p = perceptual(VUSmooth.peak);

      // Quantize to 1 byte each
      const rmsQ = (v * 255) | 0;
      const peakQ = (p * 255) | 0;

      vdo.sendData({
        type: "mainStreamVU",
        r: rmsQ,
        p: peakQ
      });

    }, 50); // 20 Hz is plenty
  }
}

///Client-side listener
vdo.on("data", d => {
  if (d.type !== "mainStreamVU") return;

  const rms = d.r / 255;
  const peak = d.p / 255;

  drawVU(rms, peak);
});











*/