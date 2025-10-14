function randomBG () {
    // Detect dark mode preference
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Pick random image from 1-10
    const numberArrayBG = Array.from({ length: 6 }, (_, i) => String(i).padStart(3, '0'));
    const randomBG = numberArrayBG[Math.floor(Math.random() * numberArrayBG.length)];

    const theme = isDarkMode ? 'dark' : 'light';
    const imageUrl = `/backgrounds/${theme}_${randomBG}.jpg`;

    // Apply background with styling
    document.body.style.backgroundImage = `url('${imageUrl}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
}

//check quality and resolution radio buttons
function getCheckedRadioValue(name) {
  const selected = document.querySelector(`input[name="${name}"]:checked`);
  return selected ? selected.value : null;
}


function deactivateUserTools() {
    let mytools = document.querySelectorAll(".tool");
    
    closeDialog(settingsDialog, toolSettings);    //close settings open modal interface.js
    mytools.forEach(tool => {
        if (tool.id === "toolMuteMicrophone") {
            tool.disabled = true;
            tool.classList.add("disable");
            tool.classList.remove("selected");
            tool.classList.remove("selectedred");
            tool.setAttribute("aria-expanded", "false");
            tool.lastElementChild.innerHTML = "mic";
        }
        if (tool.id === "toolMuteCamera") {
            tool.disabled = true;
            tool.classList.add("disable");
            tool.classList.remove("selected");
            tool.setAttribute("aria-expanded", "false");
            tool.lastElementChild.innerHTML = "photo_camera";
        }
    });

    let openModals = document.querySelectorAll("dialog:not(.hidden)");
    openModals.forEach(modal => { 
        modal.classList.add("hidden"); 
        modal.close();
    })
}

function reactivateUserTools() {
    let openModals = document.querySelectorAll("dialog:not(.hidden)");

    let mytools = document.querySelectorAll(".tool");
    let cameraSource = sessionStorage.getItem("cameraDevice");
    let microphoneSource = sessionStorage.getItem("microphoneDevice");

    mytools.forEach(tool => {
        if (tool.id === "toolMuteMicrophone" && microphoneSource !== "0") {
            tool.disabled = false;
            tool.classList.remove("disable");
        }
        if (tool.id === "toolMuteCamera" && cameraSource !== "0") {
            tool.disabled = false;
            tool.classList.remove("disable");
        }

    });
}

//process selected devices and store them in sessionStorage
function storeSelectedDevicesSession() {
    let resolution = getCheckedRadioValue("resolution");
    let quality = getCheckedRadioValue("quality");

    const videoList = document.getElementById("videoSource");
    const audioList = document.getElementById("audioSource");


        let videoSelectedIndex = videoList.selectedIndex;
        let sanitizedVideo = videoList.options[videoSelectedIndex].text.toLowerCase().replace(/[\W]+/g, "_");
        if (sanitizedVideo === "none") sanitizedVideo = "0";
        sessionStorage.setItem("videoSourceIndex", videoSelectedIndex); //selected index for video source (main stream)
        sessionStorage.setItem("videoDevice", sanitizedVideo); //selected video device name, not ID (main stream)
        // console.log("videoSource :", videoSelected, " videoDevice name :", sanitizedVideo)

        let audioSelectedIndex = audioList.selectedIndex;
        let sanitizedAudio = audioList.options[audioSelectedIndex].text.toLowerCase().replace(/[\W]+/g, "_");
        if (sanitizedAudio === "none") sanitizedAudio = "0";
        sessionStorage.setItem("audioSourceIndex", audioSelectedIndex || "0"); //selected index for audio source (main stream)
        sessionStorage.setItem("audioDevice", sanitizedAudio); //selected audio device name, not ID (main stream)
        // console.log("audioSource :", audioSelected, " audioDevice name :", sanitizedAudio)


    sessionStorage.setItem("resolution", resolution);
    sessionStorage.setItem("quality", quality);
    // console.log("Updated session settings");
}

function storeSelectedDevicesUser() {
    const cameraList = document.getElementById("cameraSource");
    const microphoneList = document.getElementById("microphoneSource");

    let username = document.getElementById("name").value.trim() || "Presenter";
    let sanitizedUserName = encodeURIComponent(username);
    sessionStorage.setItem("username", sanitizedUserName);
    setCookie("username", sanitizedUserName, 7);


        let cameraSelected = cameraList.selectedIndex;
        let rawCamera = cameraList.options[cameraSelected].text; //used to store cookie for client
        let sanitizedCamera = cameraList.options[cameraSelected].text.toLowerCase().replace(/[\W]+/g, "_");
        if (sanitizedCamera === "none") sanitizedCamera = "0";
        sessionStorage.setItem("cameraSourceIndex", cameraSelected); //selected index for camera source (user webcam)
        sessionStorage.setItem("cameraDevice", sanitizedCamera); //selected camera device name, not ID (user webcam)
        setCookie("camera", rawCamera, 7);
        //console.log("cameraSource :", cameraSelected, " cameraDevice name :", sanitizedCamera)

        let microphoneSelected = microphoneList.selectedIndex;
        let rawMicrophone = microphoneList.options[microphoneSelected].text; //used to store cookie for client
        let sanitizedMicrophone = microphoneList.options[microphoneSelected].text.toLowerCase().replace(/[\W]+/g, "_");
        if (sanitizedMicrophone === "none") sanitizedMicrophone = "0";
        sessionStorage.setItem("microphoneSourceIndex", microphoneSelected); //selected index for microphone source (user microphone)
        sessionStorage.setItem("microphoneDevice", sanitizedMicrophone); //selected microphone device name, not ID (user microphone)
        setCookie("mic", rawMicrophone, 7);
        //console.log("microphoneSource :", microphoneSelected, " microphoneDevice name :", sanitizedMicrophone)

}

//reset the settings dialog everytime it is opened to the curently selected devices. useful if user cancels settings changes half way
function recalSelectedDevices() { //used in interface.js
    let videoDeviceRecal = document.getElementById("videoSource");
    let audioDeviceRecal = document.getElementById("audioSource");
    let cameraDeviceRecal = document.getElementById("cameraSource");
    let microphoneDeviceRecal = document.getElementById("microphoneSource");

    console.log ("sessionStorage", sessionStorage);
    
    if (videoDeviceRecal) { videoDeviceRecal.selectedIndex = sessionStorage.getItem("videoSourceIndex") || 0; }
    if (audioDeviceRecal) { audioDeviceRecal.selectedIndex = sessionStorage.getItem("audioSourceIndex") || 0; }
    if (cameraDeviceRecal) { cameraDeviceRecal.selectedIndex = sessionStorage.getItem("cameraSourceIndex") || 0; }
    if (microphoneDeviceRecal) { microphoneDeviceRecal.selectedIndex = sessionStorage.getItem("microphoneSourceIndex") || 0; } 
    
    let usernameRecal = sessionStorage.getItem("username");
    let userNameDecode = decodeURIComponent(usernameRecal);
    document.getElementById("name").value = userNameDecode;

    let resolutionRecal = sessionStorage.getItem("resolution") || "1"; //default to 720p
    let qualityRecal = sessionStorage.getItem("quality") || "8000"; //default to mid quality

    let resolution = getCheckedRadioValue("resolution");
    let quality = getCheckedRadioValue("quality");

    if (resolution) {     //set resolution radio buttons if they exist
        if (resolutionRecal === "0") {
            document.getElementById("res1080P").checked = true;
        } else if (resolutionRecal === "1") {
            document.getElementById("res720P").checked = true;
        } else if (resolutionRecal === "2") {
            document.getElementById("res4k").checked = true;
        }
    }

    if (quality) {     //set quality radio buttons if they exist
        if (qualityRecal === "16000") {
            document.getElementById("qualityHigh").checked = true;
        } else if (qualityRecal === "8000") {
            document.getElementById("qualityMed").checked = true;
        } else if (qualityRecal === "4000") {
            document.getElementById("qualityLow").checked = true;
        }
    }
}
