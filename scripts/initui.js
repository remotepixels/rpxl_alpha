//check quality and resolution radio buttons
function getCheckedRadioValue(name) {
  const selected = document.querySelector(`input[name="${name}"]:checked`);
  return selected ? selected.value : null;
}

//turn off all tools when starting or changing session settings
function deactivateTools() {
    let mytools = document.querySelectorAll(".tool");
    let openModals = document.querySelectorAll("dialog:not(.hidden)");

    mytools.forEach(tool => {
        tool.classList.add("disable");
        tool.classList.remove("selected");
        tool.classList.remove("selectedred");
        tool.setAttribute("aria-expanded", "false");
        tool.classList.remove("selectedred");
        tool.disabled = true;
        if (tool.id === "toolMuteMicrophone") {
            tool.lastElementChild.innerHTML = "mic";
        } else if (tool.id === "toolMuteCamera") {
            tool.lastElementChild.innerHTML = "photo_camera";
        } else if (tool.id === "toolMuteStream") {
            tool.lastElementChild.innerHTML = "volume_up";
        } else if (tool.id === "toolBlindStream") {
            tool.lastElementChild.innerHTML = "movie";
        }
    });
    document.getElementById("toolStreamVolume").disabled = true;
    document.getElementById("toolStreamVolume").classList.add("disable");

    //close any open modals
    openModals.forEach(openModal => {
        openModal.close();
        openModal.classList.add("hidden");
        openIcon.setAttribute("aria-expanded", "false"); 
        document.getElementById("popupBG").classList.add("hidden");
    });
}

//turn back on tools depending on settings
function reactivateTools() {
    let mytools = document.querySelectorAll(".tool");
    let videoSource = sessionStorage.getItem("videoDevice");
    let audioSource = sessionStorage.getItem("audioDevice");
    let cameraSource = sessionStorage.getItem("cameraDevice");
    let microphoneSource = sessionStorage.getItem("microphoneDevice");
    let toolVolumeSlider = document.getElementById("toolStreamVolume");

    mytools.forEach(tool => {
        if (tool.id === "toolShare" || tool.id === "toolSettings" || tool.id === "toolQuit") {
            tool.disabled = false;
            tool.classList.remove("disable");
            // console.log("Share, quit and settings reactivated");
        }
        if (tool.id === "toolMuteMicrophone" && microphoneSource !== "0") {
            tool.disabled = false;
            tool.classList.remove("disable");
            // console.log("Microphone reactivated");
        }
        if (tool.id === "toolMuteCamera" && cameraSource !== "0") {
            tool.disabled = false;
            tool.classList.remove("disable");
            // console.log("Camera reactivated");
        }
        if (tool.id === "toolMuteStream" && audioSource !== "0") {
            tool.disabled = false;
            tool.classList.remove("disable");
            tool.setAttribute("aria-expanded", "true");
            console.log("Audio straem reactivated");
            toolVolumeSlider.disabled = false;
            toolVolumeSlider.classList.remove("disable");
            toolStreamVolume.value = "80";
        }
        if (tool.id === "toolBlindStream" && videoSource !== "0") {
            tool.disabled = false;
            tool.classList.remove("disable");
            // console.log("Video stream reactivated");
        }

    });
}

//process selected devices and store them in sessionStorage
function storeSelectedDevices(sessionID, session, user) {
    if (sessionID == 1){  //store session ID changes only
        let sessionID = document.getElementById("sessionID").value.trim();;
        let sessionIDUppercase = sessionID.toUpperCase();
        let sanitizedSessionID = encodeURIComponent(sessionIDUppercase);
    
        sessionStorage.setItem("sessionID", sanitizedSessionID);
        // console.log("Storing Session ID :", sanitizedSessionID);
    }

    if (session == 1){  //store session changes only
        let resolution = getCheckedRadioValue("resolution");
        let quality = getCheckedRadioValue("quality");

        const videoList = document.getElementById("videoSource");
        const audioList = document.getElementById("audioSource");

        if (videoList) {
            let videoSelected = videoList.selectedIndex;
            let sanitizedVideo = videoList.options[videoSelected].text.toLowerCase().replace(/[\W]+/g, "_");
            if (sanitizedVideo === "none") sanitizedVideo = "0";
            sessionStorage.setItem("videoSource", videoSelected); //selected index for video source (main stream)
            sessionStorage.setItem("videoDevice", sanitizedVideo); //selected video device name, not ID (main stream)
            // console.log("videoSource :", videoSelected, " videoDevice name :", sanitizedVideo)
        }
        if (audioList) {
            let audioSelected = audioList.selectedIndex;
            let sanitizedAudio = audioList.options[audioSelected].text.toLowerCase().replace(/[\W]+/g, "_");
            if (sanitizedAudio === "none") sanitizedAudio = "0";
            sessionStorage.setItem("audioSource", audioSelected || "0"); //selected index for audio source (main stream)
            sessionStorage.setItem("audioDevice", sanitizedAudio); //selected audio device name, not ID (main stream)
            // console.log("audioSource :", audioSelected, " audioDevice name :", sanitizedAudio)
        }


        sessionStorage.setItem("resolution", resolution);
        sessionStorage.setItem("quality", quality);
        // console.log("Updated session settings");
    }

    if (user == 1){  //store user changes only
        const cameraList = document.getElementById("cameraSource");
        const microphoneList = document.getElementById("microphoneSource");

        let username = document.getElementById("name").value || "Presenter";
        let sanitizedUserName = encodeURIComponent(username);

        if (cameraList) {
            let cameraSelected = cameraList.selectedIndex;
            let rawCamera = cameraList.options[cameraSelected].text; //used to store cookie for client
            let sanitizedCamera = cameraList.options[cameraSelected].text.toLowerCase().replace(/[\W]+/g, "_");
            if (sanitizedCamera === "none") sanitizedCamera = "0";
            sessionStorage.setItem("cameraSource", cameraSelected); //selected index for camera source (user webcam)
            sessionStorage.setItem("cameraDevice", sanitizedCamera); //selected camera device name, not ID (user webcam)
            setCookie("camera", rawCamera, 7);
            //console.log("cameraSource :", cameraSelected, " cameraDevice name :", sanitizedCamera)
        }
        if (microphoneList) {
            let microphoneSelected = microphoneList.selectedIndex;
            let rawMicrophone = microphoneList.options[microphoneSelected].text; //used to store cookie for client
            let sanitizedMicrophone = microphoneList.options[microphoneSelected].text.toLowerCase().replace(/[\W]+/g, "_");
            if (sanitizedMicrophone === "none") sanitizedMicrophone = "0";
            sessionStorage.setItem("microphoneSource", microphoneSelected); //selected index for microphone source (user microphone)
            sessionStorage.setItem("microphoneDevice", sanitizedMicrophone); //selected microphone device name, not ID (user microphone)
            setCookie("mic", rawMicrophone, 7);
            //console.log("microphoneSource :", microphoneSelected, " microphoneDevice name :", sanitizedMicrophone)
        }

        sessionStorage.setItem("username", sanitizedUserName);
        setCookie("username", sanitizedUserName, 7);
        // console.log("Updated user settings");
    }
}

//reset the settings dialog everytime it is opened to the curently selected devices. useful if user cancels settings changes half way
function recalSelectedDevices() {
    let videoDeviceRecal = document.getElementById("videoSource");
    let audioDeviceRecal = document.getElementById("audioSource");
    let cameraDeviceRecal = document.getElementById("cameraSource");
    let microphoneDeviceRecal = document.getElementById("microphoneSource");

    //console.log ("sessionStorage", sessionStorage);
    
    if (videoDeviceRecal) { videoDeviceRecal.selectedIndex = sessionStorage.getItem("videoSource") || 0; }
    if (audioDeviceRecal) { audioDeviceRecal.selectedIndex = sessionStorage.getItem("audioSource") || 0; }
    if (cameraDeviceRecal) { cameraDeviceRecal.selectedIndex = sessionStorage.getItem("cameraSource") || 0; }
    if (microphoneDeviceRecal) { microphoneDeviceRecal.selectedIndex = sessionStorage.getItem("microphoneSource") || 0; } 
    let usernameRecal = sessionStorage.getItem("username");
    let userNameDecode = decodeURIComponent(usernameRecal);
    document.getElementById("name").value = userNameDecode;

    let resolutionRecal = sessionStorage.getItem("resolution") || "1"; //default to 720p
    let qualityRecal = sessionStorage.getItem("quality") || "8000"; //default to low quality

    //set resolution radio buttons
    if (resolutionRecal === "0") {
        document.getElementById("res1080P").checked = true;
    } else if (resolutionRecal === "1") {
        document.getElementById("res720P").checked = true;
    } else if (resolutionRecal === "2") {
        document.getElementById("res4k").checked = true;
    }
    //set quality radio buttons
    if (qualityRecal === "16000") {
        document.getElementById("qualityHigh").checked = true;
    } else if (qualityRecal === "8000") {
        document.getElementById("qualityMed").checked = true;
    } else if (qualityRecal === "4000") {
        document.getElementById("qualityLow").checked = true;
    }
}
