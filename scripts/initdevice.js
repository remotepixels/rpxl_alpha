//Media device query and select logic for streamer and client dialog
//loads previews of streams, stops duplicate device selects for host, shows vu for audio
const mainAudioSelect = document.getElementById('audioSource');
const mainVideoSelect = document.getElementById('videoSource');
const userAudioSelect = document.getElementById('microphoneSource');
const userVideoSelect = document.getElementById('cameraSource');
const mainPreview = document.getElementById('video');
const userPreview = document.getElementById('camera');
const mainVU = document.getElementById('audiometer');
const userVU = document.getElementById('micmeter');
const startButton = document.getElementById('start-button');

let devices = [];
let mainAudioStream = null, userAudioStream = null;
let mainVideoStream = null, userVideoStream = null;
let mainAudioContext, userAudioContext, mainAnalyser, userAnalyser, vuInterval;
let selectionTimer;

//debounce user changes so give time for streams and devices to settle
function scheduleSelectionChange() {
	clearTimeout(selectionTimer);
	selectionTimer = setTimeout(handleSelectionChange, 50);
}

//get a list of devices, requesting permissions if needed, warns if error, populates the device select elements
async function getDevices() {
	const permissionStreamer = document.getElementById("permissionsDialogStream");
	const permissionClient = document.getElementById("permissionsDialogClient");

	try {
		probeVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
	} catch (e) {
		if (permissionStreamer) {
			permissionsDialogStream.classList.remove("hidden");
			permissionsDialogStream.show();
			settingsDialog.classList.add("hidden");
			//console.log("Video access was denied.");
		} else {
			if (userVideoSelect) userVideoSelect.disabled = true;
		}
	}

	try {
		probeAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch (e) {
		if (permissionStreamer) {
			permissionsDialogStream.classList.remove("hidden");
			permissionsDialogStream.show();
			settingsDialog.classList.add("hidden");
			//console.log("Audio access was denied.");
		}
		if (permissionClient && permissionClient.classList.contains("hidden")) {
			permissionClient.classList.remove("hidden");
			permissionClient.show();
			document.getElementById("permissionIgnore")?.focus();
			document.getElementById("permissionIgnore")?.addEventListener("pointerdown", function () {
			document.getElementById("permissionsCheck").classList.add("hidden");
			});
			if (userAudioSelect) userAudioSelect.disabled = true;
			//console.log("Microphone access was denied.");
		}
	}

	devices = await navigator.mediaDevices.enumerateDevices();

	if (probeVideoStream) {
		probeVideoStream.getTracks().forEach(t => t.stop());
		probeVideoStream = null;
	}

	if (probeAudioStream) {
		probeAudioStream.getTracks().forEach(t => t.stop());
		probeAudioStream = null;
	}

	const audioInputs = devices.filter(d => d.kind === 'audioinput');
	const videoInputs = devices.filter(d => d.kind === 'videoinput');

	[mainAudioSelect, userAudioSelect].forEach(sel => sel.innerHTML = '<option value="" selected>None</option>');
	[mainVideoSelect, userVideoSelect].forEach(sel => sel.innerHTML = '<option value="" selected>None</option>');

	audioInputs.forEach(device => {
		if (device.deviceId !== 'default') {
			const option = new Option(device.label || `Microphone ${device.deviceId}`, device.deviceId);
			mainAudioSelect.add(option.cloneNode(true));
			userAudioSelect.add(option.cloneNode(true));
		}
	});

	videoInputs.forEach(device => {
		if (device.deviceId !== 'default') {
			const option = new Option(device.label || `Camera ${device.deviceId}`, device.deviceId);
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
		vuElement: mainVU,
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
		vuElement: userVU,
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
	ensureVULoop();
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
	if (firstRun == true) {
		p.audioStream = await navigator.mediaDevices.getUserMedia({
			audio: { deviceId: { exact: deviceId } }
		});

		p.audioContext = new AudioContext();
		const source = p.audioContext.createMediaStreamSource(p.audioStream);

		p.analyser = p.audioContext.createAnalyser();
		source.connect(p.analyser);

		p.audioDeviceId = deviceId;
	}
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

//vu meter update loop
function ensureVULoop() {
	if (vuInterval) return;

	vuInterval = setInterval(() => {
		if (PREVIEWS.main.analyser) {
			updateVU(PREVIEWS.main.analyser, mainVU);
		}
		if (PREVIEWS.user.analyser) {
			updateVU(PREVIEWS.user.analyser, userVU);
		}
	}, 10);
}

function updateVU(analyser, vuElement) {
	const dataArray = new Uint8Array(analyser.frequencyBinCount);
	analyser.getByteFrequencyData(dataArray);
	const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
	vuElement.style.height = `${Math.min(avg, 100)}%`;
}
