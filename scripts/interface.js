

function toolMuteStreamSelect () {
    if (toolMuteStream.getAttribute("aria-expanded") == "false") {
        toolMuteStream.setAttribute("aria-expanded", "true");
        toolMuteStream.classList.toggle("selected");  
        toolMuteStream.lastElementChild.innerHTML = "volume_off";
        toolStreamVolume.value = "0";
        mainStream.contentWindow.postMessage({
            "volume": true
        }, '*');
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


function toolDrawSelect () {
    if (toolDraw.getAttribute("aria-expanded") == "false") {
        toolDraw.setAttribute("aria-expanded", "true");
        toolDraw.classList.toggle("selected");  
    } else {
        toolDraw.setAttribute("aria-expanded", "false");
        toolDraw.classList.toggle("selected"); 
    }
}

function hidePopupMenu(event) {
    event.classList.add("hidden");
    event.previousElementSibling.setAttribute("aria-expanded", "false");
    }

function showPopupMenu(event) {
    if (event.nextElementSibling.classList.contains("hidden")) {
        event.nextElementSibling.classList.remove("hidden");
        event.setAttribute("aria-expanded", "true");
       
    } else {
        event.nextElementSibling.classList.add("hidden");
        event.setAttribute("aria-expanded", "false");
    }
}

function toolMuteMicrophoneSelect () {
    if (toolMuteMicrophone.getAttribute("aria-expanded") == "false") {
        toolMuteMicrophone.setAttribute("aria-expanded", "true");
        toolMuteMicrophone.classList.toggle("selectedred");  
        toolMuteMicrophone.lastElementChild.innerHTML = "mic";
        viewersStream.contentWindow.postMessage({
            "mic": true
        }, '*');
        console.log("mic mute")
    } else {
        toolMuteMicrophone.setAttribute("aria-expanded", "false");
        toolMuteMicrophone.classList.toggle("selectedred"); 
        toolMuteMicrophone.lastElementChild.innerHTML = "mic_off";
        viewersStream.contentWindow.postMessage({
            "mic": false
        }, '*');
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


/*//wait for document to load
document.addEventListener("DOMContentLoaded", () => {

	const toolbuttons = document.querySelectorAll("tool");

	toolbuttons.forEach((toolbutton) => {
		const selectButton = toolbutton.querySelector("tool");
		const dropdown = toolbutton.querySelector("toolpopup");

		const toggleDropdown = (expand = null) => {
			const isOpen = expand !== null ? expand : dropdown.classList.contains("hidden");
			dropdown.classList.toggle("hidden", !isOpen);
			selectButton.setAttribute("aria-expanded", isOpen);
			selectButton.classList.toggle("active", isOpen);
		};

		selectButton.addEventListener("click", () => {
			toggleDropdown();
		});

		document.addEventListener("click", (event) => {
		const isOutsideClick = !toolbutton.contains(event.target);
			if (isOutsideClick) {
				toggleDropdown(false);
			}
		});
	});


});
*/


/*
document.addEventListener("DOMContentLoaded", () => {

	const toolbuttons = document.querySelectorAll(".toolbutton");

	toolbuttons.forEach((toolbutton) => {
		const selectButton = toolbutton.querySelector(".tool");
		const dropdown = toolbutton.querySelector(".toolpopup");

		const toggleDropdown = (expand = null) => {
			const isOpen = expand !== null ? expand : dropdown.classList.contains("hidden");
			dropdown.classList.toggle("hidden", !isOpen);
			selectButton.setAttribute("aria-expanded", isOpen);
			selectButton.classList.toggle("active", isOpen);
		};

		selectButton.addEventListener("click", () => {
			toggleDropdown();
		});

		document.addEventListener("click", (event) => {
		const isOutsideClick = !toolbutton.contains(event.target);
			if (isOutsideClick) {
				toggleDropdown(false);
			}
		});
	});


});
*/