//sets up vdoninja and streams
let firstRun = true;
let userStreamID = generateRandomID();
const sessionID = sessionStorage.getItem("sessionID");
const isStreamer = window.location.pathname.startsWith("/stream");
const isQuickShare = window.location.pathname.startsWith("/qs");
const isTVShare = window.location.pathname.startsWith("/tv");
const mainVideoPreview = document.getElementById("mainStream");
let mainStreamAudio = false;
let userStreamAudio = "micStandby";

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


//connect to vdo.ninja and join room always publish a user track
async function VDOConnect(sessionID) {
	//join room with placeholder stream will be replaced as devices come online
	setupVDOListeners();
	const userInit = initStream("user");
	STREAMS.user = userInit.stream;
	TRACKS.user.video = userInit.video.track;
	TRACKS.user.audio = userInit.audio.track;
	let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());

	await vdo.connect({
		password: null,
		push: true,
		view: true
	});

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

	await vdo.publish(STREAMS.user, { 
		streamID: userStreamID, 
		role: "both",
		  encoding: {
			video: {
			maxBitrate: "30k",
			minBitrate: "10k"
			}
		},
		media: {
			video: {
			frameRate: 15,
			resolution: "320x180"
			}
		}
	});

	document.getElementById("userStream").srcObject = STREAMS.user;

	if (isStreamer) {
		//if streamer publish main stream (placeholder for now)
		wait(50);
		setupVDOMSListeners();
		const mainInit = initStream("main");
		STREAMS.main = mainInit.stream;
		TRACKS.main.video = mainInit.video.track;
		TRACKS.main.audio = mainInit.audio.track;
		const mainStreamID = "ms_" + generateRandomID();

		await vdoMS.connect({
			password: "",
			push: true
		});
		await vdoMS.joinRoom({
			room: sessionID,
			mode: "full",
			video: true,
			audio: true,
			data: true,
			claim: true,  
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


//initializes the user stream with the correct video / audio device or a placeholder stream, also sets up the label
async function initUserStream() {
	//load previous settings
	const previousSettingsJSON = localStorage.getItem(APP_NS);
	if (!previousSettingsJSON) return;

	const settings = JSON.parse(previousSettingsJSON);
	if (!settings?.length) return;

	const last = settings[0];

	let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());

	//clients must have name unless.... they are the host, or they are using a quickshare link
	//hosts
	if (sanitizedCurrentUserName !== last.userName || firstRun === true) {
		const userLabel = document.getElementById("userLabel");
		userLabel.innerHTML = decodeURIComponent(sanitizedCurrentUserName);

		vdo.sendData({
			type: 'userLabel',
			label: sanitizedCurrentUserName,
			timestamp: Date.now()
		});

		storeSelectedDevicesUser();
	}
	//mere mortals and peasants
	if (!sanitizedCurrentUserName && !isStreamer) {
		const el = document.getElementById("name");
		el.style.animation = "pulse 500ms";
		setTimeout(() => (el.style.animation = "none"), 500);
		el.focus();
		return;
	}
	const invalid = new Set(["", "0", "null", "none", null]); //list of invalid sources
	const cameraSelect = document.getElementById("cameraSource");
	const microphoneSelect = document.getElementById("microphoneSource");
	const cameraCurrentSource = cameraSelect?.value ?? "";
	const microphoneCurrentSource = microphoneSelect?.value ?? "";

	if (cameraCurrentSource !== last.cameraSource || firstRun === true) {
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
			limitVideoBitrateForUser();
		}
	}
	//init select microphone 
	if (microphoneCurrentSource !== last.microphoneSource || firstRun === true) {
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
			userStreamAudio = "micLive"; //this is a real audio

			reactivateTools("userMicrophone");
		} else {
			const tempAudio = initAudioTrack();
			newAudioTrack = tempAudio.track;
			userStreamAudio = "micStandby"; //placeholder audio

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

			vdo.sendData({
				type: 'userStreamAudio',
				info: userStreamAudio,
				timestamp: Date.now()
			});

			oldAudioTrack.stop();
			TRACKS.user.audio = newAudioTrack;
			storeSelectedDevicesUser();
		}
	}
	if (!isStreamer) firstRun = false; //we've run it before
	if (isStreamer) initMainStream();

	closeDialog(openModal, openIcon);
}

async function initMainStream() {
	//load previous settings
	audioPreview.srcObject = null;

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

	let currentQuality = getCheckedRadioValue("quality") || "low";
	//let currentQuality = document.getElementById("quality");
	//console.warn("quality", currentQuality);

	const invalid = new Set(["", "0", "null", "none", null]);
	const videoSelect = document.getElementById("videoSource");
	const audioSelect = document.getElementById("audioSource");
	const videoCurrentSource = videoSelect?.value ?? "";
	const audioCurrentSource = audioSelect?.value ?? "";

	if (videoCurrentSource !== last.videoSource || height != last.resolution || currentQuality != last.quality || firstRun === true) {
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
			limitVideoBitrateForMainStream(currentQuality, height);

			storeSelectedDevicesSession();
		}
	}

	//init selected audio source
	if (audioCurrentSource !== last.audioSource || firstRun === true) {
		let oldAudioTrack = TRACKS.main.audio;
		let newAudioTrack = null;

		if (!invalid.has(audioCurrentSource)) {
			const newMediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					deviceId: { exact: audioCurrentSource },
					echoCancellation: false,
					noiseSuppression: false,
					autoGainControl: false
				},
				video: false
			});

			newAudioTrack = newMediaStream.getAudioTracks()[0];
			newMediaStream.getVideoTracks().forEach(t => t.stop());
			mainStreamAudio = true; //this is a real audio source so allow volue control
			reactivateTools("streamAudio");
		} else {
			//console.warn("no audio source selected creating empty stream");
			const tempAudio = initAudioTrack();
			newAudioTrack = tempAudio.track;
			mainStreamAudio = false	//placeholder audio, no volume control
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

			vdo.sendData({
				type: 'mainStreamAudio',
				info: mainStreamAudio,
				timestamp: Date.now()
			});

			// if (mainStreamAudio) {
			// 	const videoEL = document.getElementById("mainStream");
			// 	initMainStreamVU(videoEL);
			// }
			oldAudioTrack.stop();
			TRACKS.main.audio = newAudioTrack;
			storeSelectedDevicesSession();
		}
	}
	firstRun = false;
}