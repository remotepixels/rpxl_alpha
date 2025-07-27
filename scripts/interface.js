////////////////////////////////////////////////////////////////////////////////////////////////////
//limit session ID to letters and numbers only
////////////////////////////////////////////////////////////////////////////////////////////////////
var regex = /^[a-zA-Z0-9]*$/;
var lastValue = "";

function restrictInput(e) {
	var currentValue = e.target.value;

	if (!currentValue.match(regex))
		e.target.value = lastValue;
	else
		lastValue = currentValue;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//toolbar code
////////////////////////////////////////////////////////////////////////////////////////////////////
var openModal = "";
var openIcon = "";

const toolShare = document.getElementById("toolShare");
const toolQuit = document.getElementById("toolQuit"); 
const toolSettings = document.getElementById("toolSettings");
const toolMuteStream = document.getElementById("toolMuteStream");
const toolStreamVolume = document.getElementById("toolStreamVolume");
const toolDraw = document.getElementById("toolDraw");
const toolPalette = document.getElementById("toolPalette");
const toolEraser = document.getElementById("toolEraser");
const toolMuteMicrophone = document.getElementById("toolMuteMicrophone");
const toolMuteCamera = document.getElementById("toolMuteCamera");


if (toolShare) { toolShare.addEventListener("click", function () { openDialog(shareDialog, toolShare); });}
if (toolQuit) { toolQuit.addEventListener("click", function () { openDialog(quitDialog, toolQuit); });}

if (toolSettings) { toolSettings.addEventListener("click", function () { 
    recalSelectedDevices();
    openDialog(settingsDialog, toolSettings); });
}

if (toolMuteStream) { toolMuteStream.addEventListener("click", function() { toggleIcon(toolMuteStream); toolMuteStreamSelect(); });}
if (toolStreamVolume) { toolStreamVolume.addEventListener("click", function() { toolStreamVolumeSelect(); });}

if (toolDraw) { toolDraw.addEventListener("click", function() { toggleIcon(toolDraw); toolDrawSelect(); });}
if (toolPalette) { toolPalette.addEventListener("click", function () { openDialog(paletteDialog, toolPalette); });}
if (toolEraser) { toolEraser.addEventListener("click", function() { toolEraserSelect(); });}

if (toolMuteMicrophone) { toolMuteMicrophone.addEventListener("click", function() { toolMuteMicrophoneSelect(); });}
if (toolMuteCamera) { toolMuteCamera.addEventListener("click", function() { toolMuteCameraSelect(); });}

//toggle toolbar icons on and off
function toggleIcon (toolIcon) {
    if (toolIcon.getAttribute("aria-expanded") == "false") {
            toolIcon.setAttribute("aria-expanded", "true");
            toolIcon.classList.toggle("selected"); 
        } else { 
            toolIcon.setAttribute("aria-expanded", "false");
            toolIcon.classList.toggle("selected"); }
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

// Close the dropdown if the user clicks outside of it
window.onclick = function(e) {
    if (e.target.matches("div#popupBG")) {
        openModal.close();
        openModal.classList.add("hidden");
        openIcon.setAttribute("aria-expanded", "false"); 
        openIcon.classList.toggle("selected"); 
        document.getElementById("popupBG").classList.add("hidden");
        openModal = "";
        openIcon = "";
    } 
}

//main stream mute and volume
function toolMuteStreamSelect () {
    if (toolMuteStream.getAttribute("aria-expanded") == "false") {
        toolMuteStream.lastElementChild.innerHTML = "volume_off";
        toolStreamVolume.value = "0";
        mainStream.contentWindow.postMessage({
            "volume": 0
        }, '*');
        popupStreamMuted.classList.remove("hidden");
        popupStreamMuted.show();
        setTimeout ( function () {
            popupStreamMuted.classList.add("hidden");
            popupStreamMuted.close();
        }, 3000);
        console.log("main stream mute")
    } else {
        popupStreamMuted.close();
        toolMuteStream.setAttribute("aria-expanded", "true");
        toolMuteStream.lastElementChild.innerHTML = "volume_up";
        toolStreamVolume.value = "80";
        mainStream.contentWindow.postMessage({
            "volume": 80
        }, '*');
        console.log("main stream un-mute")
    }
}

function toolStreamVolumeSelect () {
        toolMuteStream.setAttribute("aria-expanded", "true");
        toolMuteStream.classList.remove("selected"); 
        toolMuteStream.lastElementChild.innerHTML = "volume_up";
        let vol = document.getElementById("toolStreamVolume").value
        mainStream.contentWindow.postMessage({
            "volume": vol
        }, '*');
        console.log("main stream volume",vol)
}

//drawing tool
function toolDrawSelect () {
    if (toolDraw.getAttribute("aria-expanded") == "true") {
        document.getElementById("annotationsCanvas").style.display = "block";
        document.getElementById("annotationsCanvas").style.cursor = "crosshair";

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDrawing);
        canvas.addEventListener('mouseout', endDrawing);
    } else {
        document.getElementById("annotationsCanvas").style.cursor = "default";

        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', endDrawing);
        canvas.removeEventListener('mouseout', endDrawing);
    }
}

// specific for annotations and color pots popup
// Get all the color elements and select the one clicked on
var color = "white";

const colorPots = document.querySelectorAll('.colorpot');

// Add a click event listener to each color element
colorPots.forEach(colorPot => {
    colorPot.addEventListener('click', () => {
        // 1. Get the selected color value
        const newSelectedColor = colorPot.getAttribute('value');
        color = newSelectedColor;
        console.log('Selected color:', color); // Optional: Log the selected color

        // 2. Remove the 'selectedcolorpot' class from the previously selected element
        const previouslySelected = document.querySelector('.colorpot.selectedcolorpot');
        if (previouslySelected) {
            previouslySelected.classList.remove('selectedcolorpot');
            previouslySelected.setAttribute('aria-expanded', 'false');
        }

        // 3. Add the 'selectedcolorpot' class to the clicked element
        colorPot.classList.add('selectedcolorpot');
        colorPot.setAttribute('aria-expanded', 'true');
    });
});


//mute local user microphone and camera
function toolMuteMicrophoneSelect () {
    if (toolMuteMicrophone.getAttribute("aria-expanded") == "false") {
        toolMuteMicrophone.setAttribute("aria-expanded", "true");
        toolMuteMicrophone.classList.toggle("selectedred");  
        toolMuteMicrophone.lastElementChild.innerHTML = "mic_off";
        viewersStream.contentWindow.postMessage({
            "mic": false
        }, '*');
        popupMicMuted.classList.remove("hidden");
        popupMicMuted.show();
        console.log("mic mute")
    } else {
        toolMuteMicrophone.setAttribute("aria-expanded", "false");
        toolMuteMicrophone.classList.toggle("selectedred"); 
        toolMuteMicrophone.lastElementChild.innerHTML = "mic";
        viewersStream.contentWindow.postMessage({
            "mic": true
        }, '*');
        popupMicMuted.classList.add("hidden");
        popupMicMuted.close();
        console.log("mic un-mute")
    }
}

function toolMuteCameraSelect () {
    if (toolMuteCamera.getAttribute("aria-expanded") == "false") {
        toolMuteCamera.setAttribute("aria-expanded", "true");
        toolMuteCamera.classList.toggle("selectedred");  
        toolMuteCamera.lastElementChild.innerHTML = "no_photography";
        viewersStream.contentWindow.postMessage({
            "camera": false
        }, '*');
        popupCamMuted.classList.remove("hidden");
        popupCamMuted.show();
        setTimeout ( function () {
            popupCamMuted.classList.add("hidden");
            popupCamMuted.close();
        }, 3000);
        console.log("camera off")
    } else {
        toolMuteCamera.setAttribute("aria-expanded", "false");
        toolMuteCamera.classList.toggle("selectedred"); 
        toolMuteCamera.lastElementChild.innerHTML = "photo_camera";
        popupCamMuted.close();
        viewersStream.contentWindow.postMessage({
            "camera": true
        }, '*');
        console.log("camera on")
    }
}

