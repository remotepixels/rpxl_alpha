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

async function getDevices() {
	const permissionsDialogStream = document.getElementById("permissionsDialogStream");
	const permissionsDialogClient = document.getElementById("permissionsDialogClient");

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
		// Streamer
		if (permissionsDialogStream) {
			permissionsDialogStream.classList.remove("hidden");
			permissionsDialogStream.show();
			settingsDialog?.classList.add("hidden");
		}

		// Client dialog
		if (permissionsDialogClient && permissionsDialogClient.classList.contains("hidden")) {
			permissionsDialogClient.classList.remove("hidden");
			permissionsDialogClient.show();

			document.getElementById("permissionIgnore")?.focus();
			document.getElementById("permissionIgnore")?.addEventListener("pointerdown", () => {
				document.getElementById("permissionsCheck")?.classList.add("hidden");
			});
		}

		// Disable dropdowns
		if (!micAllowed) {
			mainAudioSelect.disabled = true;
			userAudioSelect.disabled = true;
		}
		if (!camAllowed) {
			mainVideoSelect.disabled = true;
			userVideoSelect.disabled = true;
		}
	}

	//ENUMERATE DEVICES 
	const devices = await navigator.mediaDevices.enumerateDevices();
	const audioInputs = devices.filter(d => d.kind === "audioinput");
	const videoInputs = devices.filter(d => d.kind === "videoinput");

	[mainAudioSelect, userAudioSelect].forEach(sel =>
		sel.innerHTML = '<option value="" selected>None</option>'
	);
	[mainVideoSelect, userVideoSelect].forEach(sel =>
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

		if (p.audioStream && role === "main") {
			audioPreview.srcObject = p.audioStream;
		}
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
		} else {
			mainVU.style.width = "0%";
		}
		if (PREVIEWS.user.analyser) {
			updateVU(PREVIEWS.user.analyser, userVU);
		} else {
			if (isStreamer) {
				userVU.style.width = "0%";
			} else {	
				userVU.style.height = "0%";
			}
		}
	}, 10);
}

function updateVU(analyser, vuElement) {
	const dataArray = new Uint8Array(analyser.frequencyBinCount);
	analyser.getByteFrequencyData(dataArray);
	const avg = (dataArray.reduce((a, b) => a + b) / dataArray.length) | 0;
	//console.log("avg", avg);	
	if (isStreamer) {
		vuElement.style.width = `${avg}%`;
	} else {
		vuElement.style.height = `${avg}%`;
	}
}
