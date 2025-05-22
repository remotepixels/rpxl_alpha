
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
var openModal = 0

toolMuteStream.addEventListener("click", function() { toolMuteStreamSelect(); });
toolStreamVolume.addEventListener("click", function() { toolStreamVolumeSelect(); });

toolDraw.addEventListener("click", function() { toolDrawSelect(); });
popupPalette.addEventListener("click", function() { showPopupMenu(popupPalette); });
toolEraser.addEventListener("click", function() { toolEraserSelect(); });

toolMuteMicrophone.addEventListener("click", function() { toolMuteMicrophoneSelect(); });
toolMuteCamera.addEventListener("click", function() { toolMuteCameraSelect(); });
/*
popupSettings.addEventListener("click", function() {       console.log("popupSettings clicked");
    if (document.getElementById("popupBlockSettings").classList.contains("hidden")) {
        document.getElementById("popupBlockSettings").classList.remove("hidden");
        document.getElementById("popupSettings").setAttribute("aria-expanded", "true");
    } else {

    }
});*/
/*popupBlockSettings.addEventListener("click", function() {  

    if (document.getElementById("mainWindow").classList.contains("hidden")) {
    //do nothing till main interface is loaded
    } else { 
    document.getElementById("popupBlockSettings").classList.add("hidden")
    document.getElementById("popupSettings").setAttribute("aria-expanded", "false");
    }
});*/


function hidePopupMenu() {  //used folr special cases like the share menu or to hide after changing settings
    const popups = document.querySelectorAll(".popupBG");
    popups.forEach(popup => {
        if (!popup.classList.contains("hidden")) {
            popup.classList.add("hidden");
            popup.previousElementSibling.setAttribute("aria-expanded", "false");
            }
    });
}

// Close the dropdown if the user clicks outside of it
window.onclick = function(e) {
    //console.log("openModal", openModal);
    if (openModal == true) {
        //console.log("click");
        if (e.target.matches('.tool') || e.target.matches('.tool *') || e.target.matches('.toolpopup') || e.target.matches('.toolpopup *') || e.target.matches('.toolquit') || e.target.matches('.toolquit *')) {
            //console.log("openModal click inside");
        } else {
            //console.log("openModal click ooutside");
            const popups = document.querySelectorAll(".popupBG");
            popups.forEach(popup => {
                if (!popup.classList.contains("hidden")) {
                    popup.classList.add("hidden");
                    popup.previousElementSibling.setAttribute("aria-expanded", "false");
                }
            });
            topmenu.style.zIndex = 1;        
            openModal = false;
        }
    }
}
function showPopupMenu(event) {
    parent = event.closest('.top');
    if (parent != null) {
        parent.style.zIndex = 9;
    console.log(parent);
    }
    if (event.nextElementSibling.classList.contains("hidden")) {
        event.nextElementSibling.classList.remove("hidden");

        event.setAttribute("aria-expanded", "true");
        openModal = true;
        //console.log("openModal", openModal);
    } else {
        event.nextElementSibling.classList.add("hidden");
        event.setAttribute("aria-expanded", "false");
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//main stream mute and volume
////////////////////////////////////////////////////////////////////////////////////////////////////
function toolMuteStreamSelect () {
    if (toolMuteStream.getAttribute("aria-expanded") == "false") {
        toolMuteStream.setAttribute("aria-expanded", "true");
        toolMuteStream.classList.toggle("selected");  
        toolMuteStream.lastElementChild.innerHTML = "volume_off";
        toolStreamVolume.value = "0";
        mainStream.contentWindow.postMessage({
            "volume": 0
        }, '*');
        document.getElementById("popupStreamMuted").style.display = "block";
        setTimeout ( function () {document.getElementById("popupStreamMuted").style.display = "none"; }, 3000);
        console.log("main stream mute")
    } else {
        toolMuteStream.setAttribute("aria-expanded", "false");
        toolMuteStream.classList.toggle("selected"); 
        toolMuteStream.lastElementChild.innerHTML = "volume_up";
        toolStreamVolume.value = "80";
        mainStream.contentWindow.postMessage({
            "volume": 80
        }, '*');
        console.log("main stream un-mute")
    }
}

function toolStreamVolumeSelect () {
        toolMuteStream.setAttribute("aria-expanded", "false");
        toolMuteStream.classList.remove("selected"); 
        toolMuteStream.lastElementChild.innerHTML = "volume_up";
        let vol = document.getElementById("toolStreamVolume").value
        mainStream.contentWindow.postMessage({
            "volume": vol
        }, '*');
        console.log("main stream volume",vol)
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//drawing tool
////////////////////////////////////////////////////////////////////////////////////////////////////
function toolDrawSelect () {
    if (toolDraw.getAttribute("aria-expanded") == "false") {
        toolDraw.setAttribute("aria-expanded", "true");
        toolDraw.classList.toggle("selected"); 

        document.getElementById("annotationsCanvas").style.cursor = "crosshair";
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDrawing);
        canvas.addEventListener('mouseout', endDrawing);
    } else {
        toolDraw.setAttribute("aria-expanded", "false");
        document.getElementById("annotationsCanvas").style.cursor = "default";
        toolDraw.classList.toggle("selected"); 

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


////////////////////////////////////////////////////////////////////////////////////////////////////
//mute local microphone and camera
////////////////////////////////////////////////////////////////////////////////////////////////////
function toolMuteMicrophoneSelect () {
    if (toolMuteMicrophone.getAttribute("aria-expanded") == "false") {
        toolMuteMicrophone.setAttribute("aria-expanded", "true");
        toolMuteMicrophone.classList.toggle("selectedred");  
        toolMuteMicrophone.lastElementChild.innerHTML = "mic_off";
        viewersStream.contentWindow.postMessage({
            "mic": false
        }, '*');
        document.getElementById("popupMicMuted").style.display = "block";
        console.log("mic mute")
    } else {
        toolMuteMicrophone.setAttribute("aria-expanded", "false");
        toolMuteMicrophone.classList.toggle("selectedred"); 
        toolMuteMicrophone.lastElementChild.innerHTML = "mic";
        viewersStream.contentWindow.postMessage({
            "mic": true
        }, '*');
        document.getElementById("popupMicMuted").style.display = "none";
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
        document.getElementById("popupCamMuted").style.display = "block";
        setTimeout ( function () {document.getElementById("popupCamMuted").style.display = "none"; }, 2000);
        console.log("camera off")
    } else {
        toolMuteCamera.setAttribute("aria-expanded", "false");
        toolMuteCamera.classList.toggle("selectedred"); 
        toolMuteCamera.lastElementChild.innerHTML = "photo_camera";
        viewersStream.contentWindow.postMessage({
            "camera": true
        }, '*');
        console.log("camera on")
    }
}


