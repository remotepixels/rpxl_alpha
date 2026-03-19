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
let isVDOReady = false;
let firstRun = true;
let userStreamID = generateRandomID();
let settingsSnapshot = null; //dialog snapshot state
let localUUID = null;

let mainStreamAudio = false;
let userStreamAudio = "micStandby";
let wakeLock = null;

const devURL = window.location.origin;
const REGISTRY = new Map();

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isStreamer = window.location.pathname.startsWith("/stream");
const isQuickShare = window.location.pathname.startsWith("/qs");
const isTVShare = window.location.pathname.startsWith("/tv");
const mainVideoPreview = document.getElementById("mainStream");

	//check if mobile device and warn user
	const mobileDialog = document.getElementById("mobileDialog");


	if (isMobile) {
		mobileDialog.classList.remove("hidden");
		mobileDismiss.addEventListener("pointerup", () => {
			mobileDialog.classList.add("hidden");
		});
	}

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

// enter and escape keys to dismiss dialogs
window.addEventListener("keydown", handleKey);

function isVisible(el) {
    return !el.classList.contains("hidden");
}

function handleKey(event) {
    const el = document.activeElement;
    // if ( el.matches("input, textarea") || el.isContentEditable ) return; 

    if (event.key === "Enter") {
        event.preventDefault();

		if (isVisible(settingsDialog) && firstRun == true) {
			startSession();
			settingsDialog.classList.toggle("hidden");
		}

		if (isVisible(settingsDialog) && firstRun == false) {
			initUserStream();
			settingsDialog.classList.toggle("hidden");
		}		

    }
    if (event.key === "Escape") {
        event.preventDefault();
		if (isStreamer && isVisible(shareDialog)) {
			shareDialog.classList.add("hidden");
		}
		if (isStreamer && isVisible(historyDialog)) {
			historyDialog.classList.add("hidden");
		}
		if (isVisible(settingsDialog) && firstRun == true) return;

		if (isVisible(settingsDialog) && firstRun == false) {
			settingsDialog.classList.toggle("hidden");
		}
    }

}

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

function generateRandomID(len = 24) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const arr = new Uint8Array(len);
	crypto.getRandomValues(arr);
	return Array.from(arr, n => chars[n % chars.length]).join('');
}


function playBeep(freq = 880, duration = 0.15) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();

  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.stop(ctx.currentTime + duration);
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




function snapshotDialog(dialog) {
	const snapshot = {};

	dialog.querySelectorAll("input, select, textarea").forEach(el => {
		if (el.type === "checkbox" || el.type === "radio") {
			snapshot[el.id] = el.checked;
		} else {
			snapshot[el.id] = el.value;
		}
	});

	return snapshot;
}

function restoreDialog(dialog, snapshot) {
	if (!snapshot) return;

	dialog.querySelectorAll("input, select, textarea").forEach(el => {
		if (!(el.id in snapshot)) return;

		if (el.type === "checkbox" || el.type === "radio") {
			el.checked = snapshot[el.id];
		} else {
			el.value = snapshot[el.id];
		}
	});
}

function updateMainVULevel(levelMain) {
	//console.log("updating main VU level to ", levelMain);
	mainStreamVU.style.height = `${levelMain}%`;
}

function updatePeerVULevel(uuid, level) {
	//console.log("updating main VU level to ", levelMain);
	//mainStreamVU.style.height = `${level}%`;
}