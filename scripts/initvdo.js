//start the chat stream on vdo ninja (used by presenter and client)
function viewerStream (firstrun) {
    const previousSettingsJSON = localStorage.getItem(APP_NS);
    const settings = JSON.parse(previousSettingsJSON);
    const last = settings[0];
    const invalidSources = new Set(["0", "disabled_in_browser", null, "null", ""]);
    const sessionID = sessionStorage.getItem("sessionID");   //retrieve session ID
    const avatar = sessionStorage.getItem("avatar");   //retrieve avatar
    const isStreamer = window.location.pathname.startsWith("/stream");

    let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());
    let currentCameraSource = document.getElementById("cameraSource");
    let currentMicrophoneSource = document.getElementById("microphoneSource");
    
    if (isStreamer === false && sanitizedCurrentUserName === "") {    //make sure a username is entered, no blanks
        document.getElementById("name").style.animation = "pulse 500ms";
        setTimeout(() => { document.getElementById("name").style.animation = "none"; }, 500);
        document.getElementById("name").focus();
        return;
    } 

    //if settings are unchanged then close dialog and return
    if (sanitizedCurrentUserName === last.userName && 
        currentCameraSource.selectedOptions[0].value === last.cameraSource && 
        currentMicrophoneSource.selectedOptions[0].value === last.microphoneSource &&
        firstrun !== 1) {

        console.log("Viewer settings unchanged, not reloading")
        closeDialog(settingsDialog, toolSettings);
        return;
    }

    console.log("Viewer settings changed, reloading...");

    if (!document.getElementById("viewersStream").classList.contains("hidden") ) { 
            document.getElementById("viewersStream").classList.add("hidden"); 
        }
    document.getElementById("popupBG").classList.add("hidden"); 
    viewersStream.contentWindow.postMessage({ close: true }, "*"); // hangup connection on video ninja

    if (isStreamer === true && sanitizedCurrentUserName === "") {    //make sure a username is entered, no blanks
        sanitizedCurrentUserName = "Host";
    } 

    deactivateUserTools(); //turn off tools while reloading frame - initui.js

    //check camera / mic sources are valid or set to none
    if (invalidSources.has(currentCameraSource.selectedOptions[0].value)) { 
                var cameraSetup = `&avatar=${encodeURIComponent(devURL)}%2Favatars%2F${avatar}&videodevice=0`;//"&novideo&videodevice=0";
       // var cameraSetup = `&avatar=https%3A%2F%2Falpha.rpxl.app%2Favatars%2F${avatar}&videodevice=0`;//"&novideo&videodevice=0";
    } else {
        //var cameraSetup = `&videodevice=${encodeURIComponent(currentCameraSource.selectedOptions[0].textContent)}&videobitrate=64`;
                var cameraSetup = `&videodevice=${encodeURIComponent(currentCameraSource.selectedOptions[0].textContent)}&videobitrate=64`;
    }

    if (invalidSources.has(currentMicrophoneSource.selectedOptions[0].value)) {
        var microphoneSetup = `&audiodevice=none`;
    } else {
        var microphoneSetup = `&audiodevice=${encodeURIComponent(currentMicrophoneSource.selectedOptions[0].textContent)}`;
    }

    if (isStreamer === true) {
        var joinAs = `&director&novice&hidesolo&css=${encodeURIComponent(devURL)}%2Fstyles%2FvdoDirector.css`
           //     var joinAs = "&director&novice&hidesolo&css=https%3A%2F%2Frpxl.app%2Fstyles%2FvdoDirector.css"
    } else {
        var joinAs = `&css=${encodeURIComponent(devURL)}%2Fstyles%2FvdoViewer.css`;
     //           var joinAs = "&css=https%3A%2F%2Frpxl.app%2Fstyles%2FvdoViewer.css";
    }

    const url = new URL(`${devURL}/vdo/`);
    const params = [];
    params.push(`?room=RPXL${sessionID}`);
    //params.push(`&push=Stream${sessionID}`); //push to main stream
    params.push(`&label=${sanitizedCurrentUserName}`);
    params.push(cameraSetup + microphoneSetup + joinAs);
    params.push(`&group=Clients&webcam&hidehome&cleanish&autostart&nocontrols&showlabels`);
    params.push(`&style=6&meterstyle=1&notify&disablehotkeys&signalmeter&chroma=3c3c3c&nomouseevents`);

    url.search = params.join('');
    document.getElementById("viewersStream").src = url.toString();

    reactivateUserTools(); //reactivate tools - initui.js
    storeSelectedDevicesUser(); //store new user only settings - initui.js

    setTimeout(function(){   
        document.getElementById("viewersStream").classList.remove("hidden");  //wait 1 second and show frame
    },2000);
}

//view the mainstream (used by clients)
function viewMainStream () {
    let sessionID = sessionStorage.getItem("sessionID");
    const url = new URL(`${devURL}/vdo/`);
    const params = [];
    params.push(`?room=RPXL${sessionID}`);
    params.push(`&view=Stream${sessionID}&showlabel`);
    params.push(`&autostart&nochunked&hidehome&solo&cleanish&hideplaybutton&chroma=3c3c3c`);    //generic view settings
    params.push(`&preloadbitrate=-1&rampuptime=6000&buffer=1000`);  //video settings
    params.push(`&meterstyle=3&agc=0&denoise=0&ab=16&showlist=0`);  //audio settings
    params.push(`&waitimage=https%3A%2F%2Falpha.rpxl.app%2Fimages%2FnosignalHD.png`);
    params.push(`&css=${encodeURIComponent(devURL)}%2Fstyles%2FvdoMain.css`);
    params.push(`&js=${encodeURIComponent(devURL)}%2Fscripts%2Fvdomain.js`);

    url.search = params.join('');
    document.getElementById("mainStream").src = url.toString();

    setTimeout(function(){   
        document.getElementById("zoomdiv").classList.remove("hidden");
    },2000);
}

//used to start main stream by presenter
function startMainStream(firstrun) {
    //get settings from local storage
    const sessionID = sessionStorage.getItem("sessionID");
    const previousSettingsJSON = localStorage.getItem(APP_NS);
    const settings = JSON.parse(previousSettingsJSON);
    const last = settings[0];

    let currentProjectName = encodeURIComponent(project.value.trim() || "");
    let currentResolution = String(getCheckedRadioValue("resolution"));
    let currentQuality    = String(getCheckedRadioValue("quality"));
    let currentVideoSource = document.getElementById("videoSource");
    let currentAudioSource = document.getElementById("audioSource");
 
    if (currentProjectName === last.projectName && 
        currentResolution === last.resolution && 
        currentQuality === last.quality &&
        currentVideoSource.selectedOptions[0].value === last.videoSource &&
        currentAudioSource.selectedOptions[0].value === last.audioSource &&
        firstrun !== 1){
            
        console.log("Main Stream settings unchanged, not reloading")
        closeDialog(settingsDialog, toolSettings);
        return;
    }

    if (!document.getElementById("mainStream").classList.contains("hidden") ) { 
        document.getElementById("mainStream").classList.add("hidden"); 
        document.getElementById("zoomdiv").classList.add("hidden");
    }

    mainStream.contentWindow.postMessage({ close: true }, "*"); // hangup connection on video ninja
    console.log("Main stream settings changed, reloading...")
    
    sessionName.innerHTML = decodeURIComponent(currentProjectName || "Unnamed project");
    const invalidSources = new Set(["0", "disabled_in_browser", null, "null"]);
        
    if ((invalidSources.has(currentAudioSource.selectedOptions[0].value)) && (invalidSources.has(currentVideoSource.selectedOptions[0].value))) { 
        console.log("no audio or video streams starting data only stream")

        const url = new URL(`${devURL}/vdo/`);
        const params = [];
        params.push(`?room=RPXL${sessionID}`);
        params.push(`&push=Stream${sessionID}`);
        params.push(`&label=${currentProjectName || "Unnamed project"}`);
        params.push(`&dataonly`);
        url.search = params.join('');
        document.getElementById("mainStream").src = url.toString();
    } else {
        console.log("Starting main stream with settings :", currentResolution, currentQuality, currentVideoSource.selectedOptions[0].textContent, currentAudioSource.selectedOptions[0].textContent);
        if (invalidSources.has(currentVideoSource.selectedOptions[0].value)) { 
            var videoSetup = `&videodevice=0&novideo`;
        } else {
            var videoSetup = `&videodevice=${encodeURIComponent(currentVideoSource.selectedOptions[0].textContent)}`;
        }
        if (invalidSources.has(currentAudioSource.selectedOptions[0].value)) {
            var audioSetup = `&noaudio`; 
        } else {
            var audioSetup = `&audiodevice=${encodeURIComponent(currentAudioSource.selectedOptions[0].textContent)}`;
        }

        const url = new URL(`${devURL}/vdo/`);
        const params = [];
        params.push(`?room=RPXL${sessionID}`);
        params.push(`&push=Stream${sessionID}`);
        params.push(`&label=${currentProjectName || "Unnamed project"}`);
        params.push(videoSetup + audioSetup);
        params.push(`&ovb=${currentQuality}`); //outbound video bitrate for main (obs stream)
        params.push(`&quality=${currentResolution}`); //1 720p set to 0 for 1080p
        params.push(`&autostart&chroma=3c3c3c&hidehome&webcam&cleanish&view&nochunked&directoronly&mirror&showlist=0`); //autostart generic 
        params.push(`&rampuptime=6000&trb=50000&hiddenscenebitrate=50000&hideplaybutton`); //stream and room settings
        params.push(`&meterstyle=1&agc=0&denoise=0&ab=16`); //audio
        params.push(`&waitimage=${encodeURIComponent(devURL)}%2Fimages%2FnosignalHD.png`);
        params.push(`&css=${encodeURIComponent(devURL)}%2Fstyles%2FvdoMain.css`);
        params.push(`&js=${encodeURIComponent(devURL)}%2Fscripts%2Fvdomain.js`);

        url.search = params.join('');
        document.getElementById("mainStream").src = url.toString();
    }

    storeSelectedDevicesSession(); //store new session settings and reload frame - initui.js

    setTimeout(function(){   
        document.getElementById("mainStream").classList.remove("hidden");
        document.getElementById("zoomdiv").classList.remove("hidden");
    },2000);
}
