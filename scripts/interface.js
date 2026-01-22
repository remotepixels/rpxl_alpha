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

if (toolStreamVolume) { toolStreamVolume.addEventListener("pointerdown", function() { toolStreamVolumeSelect(); });}

//mute local user microphone and camera
function toolMuteMicrophoneSelect () {
    if (toolMuteMicrophone.getAttribute("aria-expanded") == "false") {
        toolMuteMicrophone.setAttribute("aria-expanded", "true");
        toolMuteMicrophone.classList.toggle("selected");  
        toolMuteMicrophone.lastElementChild.innerHTML = "mic_off";
		TRACKS.user.audio.enabled = false;
		showBanner({ key:"mic_muted", message:"Your Microphone has been muted", type:"warning", timeout:null });
    } else {
        toolMuteMicrophone.setAttribute("aria-expanded", "false");
        toolMuteMicrophone.classList.toggle("selected"); 
        toolMuteMicrophone.lastElementChild.innerHTML = "mic";
		TRACKS.user.audio.enabled = true;
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

        document.getElementById("annotationsCanvas").style.display = "block";
        document.getElementById("annotationsCanvas").style.cursor = "crosshair";

        canvas.addEventListener('pointerdown', startDrawing);
        canvas.addEventListener('pointermove', draw);
        canvas.addEventListener('pointerup', endDrawing);
        canvas.addEventListener('mouseout', endDrawing);
    } else {
		toolDraw.setAttribute("aria-expanded", "false");
        toolDraw.classList.toggle("selected"); 

        document.getElementById("annotationsCanvas").style.cursor = "default";

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
        console.log('Selected color:', color); // Optional: Log the selected color

        const previouslySelected = document.querySelector('.colorpot.selectedcolorpot');
        if (previouslySelected) {
            previouslySelected.classList.remove('selectedcolorpot');
            previouslySelected.setAttribute('aria-expanded', 'false');
        }

        colorPot.classList.add('selectedcolorpot');
        colorPot.setAttribute('aria-expanded', 'true');
    });
});

//local volume
function toolStreamVolumeSelect () {
        let vol = document.getElementById("toolStreamVolume").value
		showBanner({ key:"local_volume", message:"Local stream volume changed", type:"notification", timeout:3000 });
}

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
