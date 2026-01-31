//interface and toolbar functionality
//active dialogs and icons
var openModal = "";
var openIcon = "";
const popupBG = document.getElementById("popupBG");
//streamer tools
const toolHistory = document.getElementById("toolHistory");
const toolShare = document.getElementById("toolShare");
const toolQuit = document.getElementById("toolQuit"); 
const toolBlindStream = document.getElementById("toolBlindStream");
const toolMuteStream = document.getElementById("toolMuteStream");
//setting dialog (all)
const toolSettings = document.getElementById("toolSettings");
//user tools
const toolMuteMicrophone = document.getElementById("toolMuteMicrophone");
const toolMuteCamera = document.getElementById("toolMuteCamera");
//file share tools
const toolFileShare = document.getElementById("toolFileShare");
//stream tools
const toolDraw = document.getElementById("toolDraw");
const toolPalette = document.getElementById("toolPalette");
const toolEraser = document.getElementById("toolEraser");
//volume control (local)
const toolStreamVolume = document.getElementById("toolStreamVolume");
//default markup color
var color = "white";
const colorPots = document.querySelectorAll('.colorpot');
//popup banner
const activeBanners = new Map();

function deactivateTools(whichTools) {
	if (!whichTools || whichTools.length === 0) return;

	let toolConfig = {};

	if (whichTools === "userMicrophone") {
		toolConfig = {
			toolMuteMicrophone: { icon: "mic" },
		};
	}
	if (whichTools === "userCamera") {
		toolConfig = {
			toolMuteCamera: { icon: "photo_camera" }
		};
	}

	if (whichTools === "fileShare") {
		toolConfig = {
			toolFileShare: { icon: "folder" }
		};
	}

	if (whichTools === "streamVideo") {
		toolConfig = {
			toolDraw: { icon: "format_ink_highlighter" },
			toolPalette: { icon: "palette" },
			toolEraser: { icon: "ink_eraser" },
			toolBlindStream: { icon: "movie_off" }
		};
	}
	if (whichTools === "streamAudio") {
		toolConfig = {
			toolMuteStream: { icon: "volume_up" },
			toolVolume: { icon: "" }
		};
	}

	document.querySelectorAll(".tool").forEach(tool => {
		const cfg = toolConfig[tool.id];
		if (!cfg) return; // skip tools we don't care about

		tool.disabled = true;
		tool.classList.add("disable", "hidden");
		tool.classList.remove("selected");
		tool.setAttribute("aria-expanded", "false");
		if (cfg.icon) tool.lastElementChild.textContent = cfg.icon;
	});

	// close all open dialogs
	document.querySelectorAll("dialog:not(.hidden)").forEach(modal => {
		modal.classList.add("hidden");
		modal.close();
	});
}

function reactivateTools(whichTools) {
	if (!whichTools || whichTools.length === 0) return;

	let toolConfig = {};

	if (whichTools === "userMicrophone") {
		toolConfig = {
			toolMuteMicrophone: { icon: "mic" },
		};
	}
	if (whichTools === "userCamera") {
		toolConfig = {
			toolMuteCamera: { icon: "photo_camera" }
		};
	}

	if (whichTools === "fileShare") {
		toolConfig = {
			toolFileShare: { icon: "folder" }
		};
	}

	if (whichTools === "streamVideo") {
		toolConfig = {
			toolDraw: { icon: "format_ink_highlighter" },
			toolPalette: { icon: "palette" },
			toolEraser: { icon: "ink_eraser" },
			toolBlindStream: { icon: "movie_off" }
		};
	}

	if (whichTools === "streamAudio") {
		toolConfig = {
			toolMuteStream: { icon: "volume_up" },
			toolVolume: { icon: "" }
		};

	}
	document.querySelectorAll(".tool").forEach(tool => {
		const cfg = toolConfig[tool.id];
		if (!cfg) return; // skip tools we don't care about

		tool.disabled = false;
		tool.classList.remove("disable", "hidden");
	});
}

//open ppopup dialogs and menus
function openDialog (dialog, toolIcon) {
    document.getElementById("popupBG").classList.remove("hidden");
    dialog.classList.remove("hidden");
    dialog.show();
    toolIcon.setAttribute("aria-expanded", "true"); 
    toolIcon.classList.toggle("selected"); 
    openModal = dialog; 
    openIcon = toolIcon;
}

function closeDialog(dialog, toolIcon) {
    if (!dialog) return; // safety check

    document.getElementById("popupBG").classList.add("hidden");

    dialog.classList.add("hidden");
    if (typeof dialog.close === "function") dialog.close();
    if (toolIcon) {
        toolIcon.setAttribute("aria-expanded", "false");
        toolIcon.classList.remove("selected");
    }

    openModal = "";
    openIcon = "";
}

//clicking the background to dismiss dialogs
popupBG.addEventListener("pointerdown", function(e) {
    if (e.target.matches("#popupBG")) {
        closeDialog(openModal, openIcon);
    }
});

//actual button assignments
if (toolHistory) { toolHistory.addEventListener("pointerdown", function () { loadHistoryIntoDialog(); });}
if (toolShare) { toolShare.addEventListener("pointerdown", function () { openDialog(shareDialog, toolShare); });}
if (toolQuit) { toolQuit.addEventListener("pointerdown", function () { openDialog(quitDialog, toolQuit); });}

if (toolSettings) { toolSettings.addEventListener("pointerdown", function () { 
    if (isStreamer) {  restoreSettingsHost(); }
    restoreSettingsClient();
    openDialog(settingsDialog, toolSettings); });
}

if (toolMuteMicrophone) { toolMuteMicrophone.addEventListener("pointerdown", function() { toolMuteMicrophoneSelect(); });}
if (toolMuteCamera) { toolMuteCamera.addEventListener("pointerdown", function() { toolMuteCameraSelect(); });}

if (toolBlindStream) { toolBlindStream.addEventListener("pointerdown", function() { toolBlindStreamSelect(); });}
if (toolMuteStream) { toolMuteStream.addEventListener("pointerdown", function() { toolMuteStreamSelect(); });}

if (toolDraw) { toolDraw.addEventListener("pointerdown", function() { toolDrawSelect(); });}
if (toolPalette) { toolPalette.addEventListener("pointerdown", function () { openDialog(paletteDialog, toolPalette); });}
if (toolEraser) { toolEraser.addEventListener("pointerdown", function() { toolEraserSelect(); });}

//if (toolStreamVolume) { toolStreamVolume.addEventListener("pointerdown", function() { toolStreamVolumeSelect(); });}
const mainVideo = document.getElementById("mainStream");
const volumeSlider = document.getElementById("toolStreamVolume");

// Initialize volume
mainVideo.volume = volumeSlider.value / 100;

volumeSlider.addEventListener("input", () => {
  mainVideo.volume = volumeSlider.value / 100;
});

//mute local user microphone and camera
function toolMuteMicrophoneSelect () {
    if (toolMuteMicrophone.getAttribute("aria-expanded") == "false") {
        toolMuteMicrophone.setAttribute("aria-expanded", "true");
        toolMuteMicrophone.classList.toggle("selected");  
        toolMuteMicrophone.lastElementChild.innerHTML = "mic_off";
		TRACKS.user.audio.enabled = false;
		
		vdo.sendData({
				type: 'userStreamAudio',
				info: "micMute",
				timestamp: Date.now()
		});

		showBanner({ key:"mic_muted", message:"Your Microphone has been muted", type:"warning", timeout:null });
    } else {
        toolMuteMicrophone.setAttribute("aria-expanded", "false");
        toolMuteMicrophone.classList.toggle("selected"); 
        toolMuteMicrophone.lastElementChild.innerHTML = "mic";
		TRACKS.user.audio.enabled = true;

		vdo.sendData({
				type: 'userStreamAudio',
				info: "micLive",
				timestamp: Date.now()
		});

		hideBannerByKey("mic_muted");
    }
}

function toolMuteCameraSelect () {
    if (toolMuteCamera.getAttribute("aria-expanded") == "false") {
        toolMuteCamera.setAttribute("aria-expanded", "true");
        toolMuteCamera.classList.toggle("selected");  
        toolMuteCamera.lastElementChild.innerHTML = "no_photography";
		TRACKS.user.video.enabled = false;
		showBanner({ key:"cam_muted", message:"Your camera has been turned off", type:"notification", timeout:3000 });
    } else {
        toolMuteCamera.setAttribute("aria-expanded", "false");
        toolMuteCamera.classList.toggle("selected"); 
        toolMuteCamera.lastElementChild.innerHTML = "photo_camera";
		TRACKS.user.video.enabled = true;
		hideBannerByKey("cam_muted");
    }
}

//main stream mute and volume
function toolMuteStreamSelect () {
    if (toolMuteStream.getAttribute("aria-expanded") == "false") {
		toolMuteStream.setAttribute("aria-expanded", "true");
		toolMuteStream.classList.toggle("selected"); 
        toolMuteStream.lastElementChild.innerHTML = "volume_off";
		TRACKS.main.audio.enabled = false;
		showBanner({ key:"audio_muted", message:"Main audio stream disabled", type:"warning", timeout:null });
    } else {
        toolMuteStream.setAttribute("aria-expanded", "false");
        toolMuteStream.classList.toggle("selected"); 
        toolMuteStream.lastElementChild.innerHTML = "volume_up";
        TRACKS.main.audio.enabled = true;
		hideBannerByKey("audio_muted");
    }
}
function toolBlindStreamSelect () {
    if (toolBlindStream.getAttribute("aria-expanded") == "false") {
		toolBlindStream.setAttribute("aria-expanded", "true");
		toolBlindStream.classList.toggle("selected"); 
        toolBlindStream.lastElementChild.innerHTML = "movie_off";
		TRACKS.main.video.enabled = false;
		showBanner({ key:"video_blind", message:"Main video stream disabled", type:"warning", timeout:null });
    } else {
        toolBlindStream.setAttribute("aria-expanded", "false");
        toolBlindStream.classList.toggle("selected"); 
        toolBlindStream.lastElementChild.innerHTML = "movie";
        TRACKS.main.video.enabled = true;
		hideBannerByKey("video_blind");
    }
}

//markup tools
function toolDrawSelect () {
    if (toolDraw.getAttribute("aria-expanded") == "false") {
		toolDraw.setAttribute("aria-expanded", "true");
        toolDraw.classList.toggle("selected"); 

        document.getElementById("markup").style.display = "block";
        document.getElementById("markup").style.cursor = "crosshair";

        canvas.addEventListener('pointerdown', startDrawing);
        canvas.addEventListener('pointermove', draw);
        canvas.addEventListener('pointerup', endDrawing);
        canvas.addEventListener('mouseout', endDrawing);
    } else {
		toolDraw.setAttribute("aria-expanded", "false");
        toolDraw.classList.toggle("selected"); 

        document.getElementById("markup").style.cursor = "default";

        canvas.removeEventListener('pointerdown', startDrawing);
        canvas.removeEventListener('pointermove', draw);
        canvas.removeEventListener('pointerup', endDrawing);
        canvas.removeEventListener('mouseout', endDrawing);
    }
}

// specific for markup color pots popup
colorPots.forEach(colorPot => {
    colorPot.addEventListener('pointerdown', () => {
        const newSelectedColor = colorPot.getAttribute('value');
        color = newSelectedColor;

        const previouslySelected = document.querySelector('.colorpot.selectedcolorpot');
        if (previouslySelected) {
            previouslySelected.classList.remove('selectedcolorpot');
            previouslySelected.setAttribute('aria-expanded', 'false');
        }

        colorPot.classList.add('selectedcolorpot');
        colorPot.setAttribute('aria-expanded', 'true');
    });
});

//popup banners and warnings
function showBanner({ key, message, type = "notification", timeout = null}) {
    // If already visible, do nothing
    if (key && activeBanners.has(key)) return;

    const stack = document.getElementById("bannerStack");
    const tpl = document.getElementById("bannerTemplate");

    const banner = tpl.content.firstElementChild.cloneNode(true);
    banner.classList.add(type);
    banner.dataset.key = key || "";

    banner.querySelector("span").textContent = message;

    stack.appendChild(banner);

    if (key) {
        activeBanners.set(key, banner);
    }

    if (timeout !== null) {
        setTimeout(() => hideBanner(banner), timeout);
    }

    return banner;
}

function hideBanner(banner) {
    if (!banner) return;

    const key = banner.dataset.key;
    if (key) activeBanners.delete(key);

    banner.classList.add("exit");
    banner.addEventListener(
        "animationend",
        () => banner.remove(),
        { once: true }
    );
}

function hideBannerByKey(key) {
    const banner = activeBanners.get(key);
    if (banner) hideBanner(banner);
}

//adding peers and tracks to DOM
//adds any incoming video to the DOM, ms_ (main stream is ignored), hs_ (host) is always placed top 
function addPeerToDOM(uuid, streamID, label = null) {
	if (streamID.startsWith("ms_") || null) return;

	const peerListContainer = document.querySelector(".peerList");
	// Prevent duplicates
	if (document.getElementById(`peer_${uuid}`)) return;

	const peerDiv = document.createElement("div");
	peerDiv.className = "peer";
	peerDiv.id = `peer_${uuid}`;  // unique ID for later access

	// Create video element
	const video = document.createElement("video");
	video.className = "peerStream";
	video.id = `video_${uuid}`;
	video.autoplay = true;
	video.playsInline = true;
	video.disablePictureInPicture = true;

	// Create label
	const span = document.createElement("span");
	span.className = "peerLabel";
	if (streamID.startsWith("hs_")) {
		span.textContent = label || uuid.slice(0, 10) + " (Host)";
	} else {
		span.textContent = label || uuid.slice(0, 10); // fallback to uuid if no name
	}
	peerDiv.appendChild(video);
	peerDiv.appendChild(span);

	if (streamID.startsWith("hs_")) {
		peerListContainer.prepend(peerDiv);
	} else {
		peerListContainer.appendChild(peerDiv);
	}
}

function updateDOMLabel(uuid, streamID, label) {
	if (streamID.startsWith("hs_")) {
		label = decodeURIComponent(label) + " (Host)";
	} else {
		label = decodeURIComponent(label);
	}

	if (!label) return;
	const labelEl = document.querySelector(`#peer_${uuid} .peerLabel`);
	if (labelEl) labelEl.textContent = label;
	//console.warn(`Set label for peer ${uuid} to ${label}`, 'info');
}

function updateDOMuserAudio(uuid, audio) {
	if (!uuid) return;

	const video = document.querySelector(`#video_${uuid}`);
	if (!video) return;

	if (audio === "micStandby") {
		video.classList.remove("micLive", "micMute");
		video.classList.add("micStandby");
		return;
	}
	if (audio === "micMute") {
		video.classList.remove("micLive", "micStandby");
		video.classList.add("micMute");
		return;
	}	
	if (audio === "micLive") {
				video.classList.remove("micStandby", "micMute");
		video.classList.add("micLive");
		return;
	}	
}


async function disconnectPeer(uuid) {
	const mainStream = document.getElementById("mainStream");
	const peer = REGISTRY.get(uuid);
	if (!peer) return;
	const streams = peer.streams;

	for (let streamID of streams.keys()) {
		if (streamID.startsWith("ms_")) {
			mainStream.srcObject.getTracks().forEach(t => t.stop());
			mainStream.srcObject = null;
			deactivateTools("streamVideo");
			deactivateTools("streamAudio");
		}
	}

	const peerDiv = document.getElementById(`peer_${uuid}`);
	//vdo.stopViewing(streams);
	if (!peerDiv) return;

	//stop media
	peerDiv.querySelectorAll("video, audio").forEach(el => {
		if (el.srcObject) {
			el.srcObject.getTracks().forEach(t => t.stop());
			el.srcObject = null;
		}
	});

	peerDiv.remove();
	streams.clear();
	REGISTRY.delete(uuid);
}

//other interface bits, storing device info, recalling history etc
function randomBG() {
	// Detect dark / light mode and select bg
	const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const numberArrayBG = Array.from({ length: 6 }, (_, i) => String(i).padStart(3, '0'));
	const randomBG = numberArrayBG[Math.floor(Math.random() * numberArrayBG.length)];
	const theme = isDarkMode ? 'dark' : 'light';
	const imageUrl = `/backgrounds/${theme}_${randomBG}.jpg`;

	document.body.style.backgroundImage = `url('${imageUrl}')`;
	document.body.style.width = `100%`;
	document.body.style.height = `100%`;
	document.body.style.backgroundSize = `cover`;

	if (!isStreamer) {
		const header = document.querySelector(`.siteHeader`);
		header.style.backgroundImage = `url('${imageUrl}')`;
		header.style.width = `100%`;
		header.style.backgroundSize = `cover`;
	}
}

//check quality and resolution radio buttons
function getCheckedRadioValue(name) {
	const selected = document.querySelector(`input[name="${name}"]:checked`);
	return selected ? selected.value : null;
}
