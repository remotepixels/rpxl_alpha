//Media device query and select logic for streamer and client dialog
//loads previews of streams, stops duplicate device selects for host, shows vu for audio
const mainAudioSelect = document.getElementById('audioSource');
const mainVideoSelect = document.getElementById('videoSource');
const userAudioSelect = document.getElementById('microphoneSource');
const userVideoSelect = document.getElementById('cameraSource');
const mainPreview = document.getElementById('videoPreview');
const userPreview = document.getElementById('cameraPreview');
const mainPreviewVU = document.getElementById('mainPreviewVU');
const userPreviewVU = document.getElementById('userPreviewVU');
const mainStreamVU = document.getElementById("mainStreamVU");
const userStreamVU = document.getElementById("userStreamVU");

const dataArrayMain = new Uint8Array(128);
const dataArrayUser = new Uint8Array(128);
const vuIntervals = {};
const vuLevels = {};

//attach for dropdowns
[mainAudioSelect, userAudioSelect, mainVideoSelect, userVideoSelect]
		.forEach(sel => sel.addEventListener('change', handleSelectionChange));

async function getDevices() {
	let probeStream = null;
	let micAllowed = false;
	let camAllowed = false;

	try {
		probeStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
		micAllowed = !!probeStream.getAudioTracks()[0];
		camAllowed = !!probeStream.getVideoTracks()[0];
	} catch (e) {
		console.log("Permission probe failed:", e);
	}

	if (probeStream) {
		probeStream.getTracks().forEach(t => t.stop());
		probeStream = null;
	}

	if (!camAllowed || !micAllowed) {
		permissionsDialog.classList.remove("hidden");
		settingsDialog.classList.add("hidden");

		// Disable dropdowns
		if (!micAllowed) {
			mainAudioSelect.disabled = true;
			userAudioSelect.disabled = true;
		}
		if (!camAllowed) {
			mainVideoSelect.disabled = true;
			userVideoSelect.disabled = true;
		}
	}	else {
		settingsDialog.classList.remove("hidden");
		document.getElementById("name").focus();
 	}

	//ENUMERATE DEVICES 
	const devices = await navigator.mediaDevices.enumerateDevices();
	const audioInputs = devices.filter(d => d.kind === "audioinput");
	const videoInputs = devices.filter(d => d.kind === "videoinput");

	[mainAudioSelect, userAudioSelect, mainVideoSelect, userVideoSelect].forEach(sel =>
		sel.innerHTML = '<option value="" selected>None</option>'
	);

	audioInputs.forEach(device => {
		if (device.deviceId !== "default") {
			const label = device.label || `Microphone ${device.deviceId.slice(0, 6)}`;
			const option = new Option(label, device.deviceId);
			mainAudioSelect.add(option.cloneNode(true));
			userAudioSelect.add(option.cloneNode(true));
		}
	});

	videoInputs.forEach(device => {
		if (device.deviceId !== "default") {
			const label = device.label || `Camera ${device.deviceId.slice(0, 6)}`;
			const option = new Option(label, device.deviceId);
			mainVideoSelect.add(option.cloneNode(true));
			userVideoSelect.add(option.cloneNode(true));
		}
	});
}

//used to preview streams (local only never published)
const PREVIEWS = {
	main: {
		audioDeviceId: null,
		videoDeviceId: null,
		audioStream: null,
		videoStream: null,
		audioContext: null,
		analyser: null,
		vuInterval: null,
		vuElement: mainPreviewVU,
		videoElement: mainPreview
	},
	user: {
		audioDeviceId: null,
		videoDeviceId: null,
		audioStream: null,
		videoStream: null,
		audioContext: null,
		analyser: null,
		vuInterval: null,
		vuElement: userPreviewVU,
		videoElement: userPreview
	}
};

async function handleSelectionChange() {
	const selectedMainAudio = mainAudioSelect.value || null;
	const selectedUserAudio = userAudioSelect.value || null;
	const selectedMainVideo = mainVideoSelect.value || null;
	const selectedUserVideo = userVideoSelect.value || null;

	// Prevent duplicate device use (unchanged)
	[mainAudioSelect, userAudioSelect].forEach(sel =>
		Array.from(sel.options).forEach(o => o.disabled = false)
	);
	if (selectedMainAudio)
		userAudioSelect.querySelector(`option[value="${selectedMainAudio}"]`)?.setAttribute("disabled", true);
	if (selectedUserAudio)
		mainAudioSelect.querySelector(`option[value="${selectedUserAudio}"]`)?.setAttribute("disabled", true);

	[mainVideoSelect, userVideoSelect].forEach(sel =>
		Array.from(sel.options).forEach(o => o.disabled = false)
	);
	if (selectedMainVideo)
		userVideoSelect.querySelector(`option[value="${selectedMainVideo}"]`)?.setAttribute("disabled", true);
	if (selectedUserVideo)
		mainVideoSelect.querySelector(`option[value="${selectedUserVideo}"]`)?.setAttribute("disabled", true);

	// preview windows
	await Promise.all([
		reconcileAudioPreview("main", selectedMainAudio),
		reconcileVideoPreview("main", selectedMainVideo),
		reconcileAudioPreview("user", selectedUserAudio),
		reconcileVideoPreview("user", selectedUserVideo)
	]);

	if (selectedMainAudio) {
		ensureVULoop("main");
	} else {
		stopVULoop("main");
		if (isStreamer) mainPreviewVU.style.height = "0%";
		mainStreamVU.style.setProperty("--vu", 0);
	}

	//turn off mic button if no microphone selected
	if (selectedUserAudio) {
		ensureVULoop("user");
		userStreamVU.classList.remove("micOffline");
	} else {
		stopVULoop("user");

		userPreviewVU.style.height = "0%";
		//userStreamVU.classList.remove("muted");
		userStreamVU.classList.add("micOffline");
		userStreamVU.style.setProperty("--vu", 0);
	}
}

async function reconcileAudioPreview(role, deviceId) {
	const p = PREVIEWS[role];

	if (p.audioDeviceId === deviceId) return;

	// Stop old audio preview
	if (p.audioStream) {
		p.audioStream.getTracks().forEach(t => t.stop());
		p.audioStream = null;
	}

	if (p.audioContext) {
		try {
			if (p.audioContext.state !== "closed") {
				await p.audioContext.close();
			}
		} catch { }
		p.audioContext = null;
	}

	p.analyser = null;
	p.audioDeviceId = null;

	if (!deviceId) return;

	// Start new audio preview, only preview on first run (vu hidden after)	
	// if (firstRun == true) {
		p.audioStream = await navigator.mediaDevices.getUserMedia({
			audio: { deviceId: { exact: deviceId } }
		});

		p.audioContext = new AudioContext();
		const source = p.audioContext.createMediaStreamSource(p.audioStream);

		p.analyser = p.audioContext.createAnalyser();
		p.analyser.fftSize = 128;
		source.connect(p.analyser);

		p.audioDeviceId = deviceId;

		if (p.audioStream && role === "main" && firstRun == true) {
			audioPreview.srcObject = p.audioStream;
		}
	// }
}

async function reconcileVideoPreview(role, deviceId) {
	const p = PREVIEWS[role];

	if (p.videoDeviceId === deviceId) return;

	if (p.videoStream) {
		p.videoStream.getTracks().forEach(t => t.stop());
		p.videoStream = null;
	}

	p.videoDeviceId = null;
	if (p.videoElement) p.videoElement.srcObject = null;

	if (!deviceId) return;
	//only preview devices on first run (preview windows hidden after)
	if (firstRun == true) {
		p.videoStream = await navigator.mediaDevices.getUserMedia({
			video: { deviceId: { exact: deviceId } }
		});

		if (p.videoElement) {
			p.videoElement.srcObject = p.videoStream;
		}

		p.videoDeviceId = deviceId;
	}
}

function getVULevel(analyser, dataArray) {
	if (!analyser) return;
	
	analyser.getByteTimeDomainData(dataArray);
	let sum = 0;

	for (let i = 0; i < dataArray.length; i++) {
		const x = dataArray[i] - 128;
		sum += x * x;
	}

	const rms = Math.sqrt(sum / dataArray.length);
	return (rms / 128) * 100;
}

function smoothVU(newLevel, currentLevel) {
	// fast attack
	if (newLevel > currentLevel) {
		return newLevel;
	}

	// slow decay
	return currentLevel * 0.95;
}

function ensureVULoop(whichVU) {
	if (vuIntervals[whichVU]) return;

	vuIntervals[whichVU] = setInterval(() => {

		const rawLevel = Math.min(
			getVULevel(PREVIEWS[whichVU].analyser, dataArrayMain) * 2,
			100
		);

		vuLevels[whichVU] = smoothVU(rawLevel, vuLevels[whichVU] || 0);
		const level = Math.round(vuLevels[whichVU]);

		document.getElementById(`${whichVU}PreviewVU`).style.height = `${level}%`;
		if (whichVU === "main") {
		document.getElementById(`${whichVU}StreamVU`).style.height = `${level}%`;
		} else {
			document.getElementById(`${whichVU}StreamVU`).style.setProperty("--vu", level);
		}	
		sendVULevel(whichVU, level);
		return;
	}, 40);
}

function stopVULoop(whichVU) {
	if (!vuIntervals[whichVU]) return;

	clearInterval(vuIntervals[whichVU]);
	delete vuIntervals[whichVU];
}

function sendVULevel(whichVU, vuLevel) {
	if (connectedPeers > 1) {
		vdo.sendData({
			type: 'VUData',
			whichVU: whichVU,
			level: vuLevel
		});
		//console.log("sent info for VU", whichVU, "level", vuLevel);
	}
}
