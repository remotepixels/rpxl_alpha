//start the chat stream on vdo ninja (used by presenter and client)
var avatar = "";

function viewerStream () {
    let storedUserName = sessionStorage.getItem("username"); //retrieve username, camera and mic settings from storage
    let storedCameraIndex = sessionStorage.getItem("cameraSourceIndex");
    let storedMicIndex = sessionStorage.getItem("microphoneSourceIndex");

    let currentUsername = document.getElementById("name").value.trim() || "Streamer"; //current values in form`
    let sanitizedCurrentUserName = encodeURIComponent(currentUsername); 

    let currentCamera = document.getElementById("cameraSource").selectedIndex;
    let currentMic = document.getElementById("microphoneSource").selectedIndex;

    if (!sanitizedCurrentUserName) {
        document.getElementById("name").style.animation = "pulse 500ms";
        setTimeout(() => { document.getElementById("name").style.animation = "none"; }, 500);
        document.getElementById("name").focus();
        return;
    } 
        
    if (avatar == "") {
        // pick a random avatar image
        const numberArray = Array.from({ length: 43 }, (_, i) => String(i).padStart(3, '0'));
        const randomNum = numberArray[Math.floor(Math.random() * numberArray.length)];
        avatar = `${randomNum}.png`;
    }
    //compare form values with stored values, if they're different then reload the iframe
    if ((sanitizedCurrentUserName != storedUserName) || (currentCamera != storedCameraIndex) || (currentMic != storedMicIndex)) {
        if (!document.getElementById("viewersStream").classList.contains("hidden") ) { 
            document.getElementById("viewersStream").classList.add("hidden"); 
        }
        document.getElementById("popupBG").classList.add("hidden"); 
        viewersStream.contentWindow.postMessage({ close: true }, "*"); // hangup connection on video ninja
        console.log("Viewer settings changed, reloading...");

        storeSelectedDevicesUser(); //store new user only settings - initui.js

        deactivateUserTools(); //turn off tools while reloading frame - initui.js

        //reload the stored values and use to reload viewers frame
        let sanitizedSessionID = sessionStorage.getItem("sessionID");   //retrieve session ID
        let sanitizedUserName = sessionStorage.getItem("username"); //retrieve username, camera and mic settings from storage
        let sanitizedCamera = sessionStorage.getItem("cameraDevice");
        let sanitizedMicrophone = sessionStorage.getItem("microphoneDevice");

        //if no video source is selected or the camera is disabled in the browser then set to connect as miconly
        if ((sanitizedCamera == "0") || (sanitizedCamera == "disabled_in_browser") || (sanitizedCamera == null) || (sanitizedCamera == "null") ) {
            var camSetup = "&avatar=https%3A%2F%2Falpha.rpxl.app%2Favatars%2F"+avatar+"&videodevice=0";//"&novideo&videodevice=0";
        } else {
            var camSetup = "&videodevice="+sanitizedCamera+"&videobitrate=64";
        }

        if ((sanitizedMicrophone == "0") || (sanitizedMicrophone == "disabled_in_browser") || (sanitizedMicrophone == null) || (sanitizedMicrophone == "null") ) {
            var micSetup = "&audiodevice=0";
        } else {
            var micSetup = "&audiodevice="+sanitizedMicrophone;
        }

        document.getElementById("viewersStream").src = "https://alpha.rpxl.app/vdo/?room=RPXL_"+sanitizedSessionID+
            "&cleanish"+
            "&showlabels"+
            "&label="+sanitizedUserName+camSetup+micSetup+
            "&hidehome"+
            "&style=6"+
            "&meterstyle=1"+
            "&webcam"+
            "&notify"+
            "&disablehotkeys"+
            "&clearstorage"+
            "&autostart"+
            "&nocontrols"+
            "&signalmeter"+
            "&chroma=3c3c3c"+
            "&nomouseevents"+
            "&group=Client"+
            "&css=https%3A%2F%2Falpha.rpxl.app%2Fstyles%2FvdoViewer.css"+
            ""; 

        reactivateUserTools(); //reactivate tools - initui.js
        setTimeout(function(){   
            document.getElementById("viewersStream").classList.remove("hidden");  //wait 1 second and show frame
        },2000);
    } else {
        console.log("Viewer settings unchanged, not reloading")
        closeDialog(settingsDialog, toolSettings);
    }
}

//view the mainstream (used by clients)
function viewMainStream () {
    let sanitizedSessionID = sessionStorage.getItem("sessionID");

    document.getElementById("mainStream").src = "https://alpha.rpxl.app/vdo/?room=RPXL_"+sanitizedSessionID+
        "&view=Stream_"+sanitizedSessionID+
        "&autostart"+
        "&hidehome"+//hide vdo ninja homepage
        "&solo"+//no login options, solos stream
        "&cleanish"+//remove all interface bits
        "&meterstyle=3"+
        "&hideplaybutton"+//hides big play button if autoplay is disabled
        "&chroma=3c3c3c"+
        "&preloadbitrate=-1"+//preloads the video, might not be necessary as only use scene 1
        "&rampuptime=6000"+
        "&waitimage=https%3A%2F%2Falpha.rpxl.app%2Fimages%2FnosignalHD.png"+
        "&buffer=1000"+//adds a xms buffer
        "&showlist=0"+//hides the viewer list
        "&css=https%3A%2F%2Falpha.rpxl.app%2Fstyles%2FvdoMain.css"+
        "&js=https%3A%2F%2Falpha.rpxl.app%2Fscripts%2Fvdomain.js"+
        ""; 

    setTimeout(function(){   
        document.getElementById("zoomdiv").classList.remove("hidden");
    },2000);
}

//used to start main stream by presenter
function startMainStream() {
    //get settings from local storage
    let sanitizedSessionID = sessionStorage.getItem("sessionID");
    
    let storedResolution = sessionStorage.getItem("resolution");
    let storedQuality = sessionStorage.getItem("quality");
    let storedVideoIndex = sessionStorage.getItem("videoSourceIndex");
    let storedAudiondex = sessionStorage.getItem("audioSourceIndex"); 

    console.log("stored video:",storedVideoIndex,"storedadeo",storedAudiondex)
    let currentResolution = getCheckedRadioValue("resolution");
    let currentQuality = getCheckedRadioValue("quality");
    let currentVideoIndex = document.getElementById("videoSource").selectedIndex;
    let currentAudioIndex = document.getElementById("audioSource").selectedIndex;

    console.log("current video",currentVideoIndex,"current audio",currentAudioIndex)
    if ((storedResolution != currentResolution) || (storedQuality != currentQuality) || (storedVideoIndex != currentVideoIndex) || (storedAudiondex != currentAudioIndex)) {
        if (!document.getElementById("mainStream").classList.contains("hidden") ) { 
            document.getElementById("mainStream").classList.add("hidden"); 
            document.getElementById("zoomdiv").classList.add("hidden");
        }
        mainStream.contentWindow.postMessage({ close: true }, "*"); // hangup connection on video ninja
        console.log("Main stream settings changed, reloading...")

        storeSelectedDevicesSession(); //store new user only settings and reload frame - initui.js

        let resolution = sessionStorage.getItem("resolution"); 
        let quality = sessionStorage.getItem("quality"); 
        let sanitizedVideo = sessionStorage.getItem("videoDevice"); 
        let sanitizedAudio = sessionStorage.getItem("audioDevice"); 
        
        if (((sanitizedVideo == "0") || (sanitizedVideo == "disabled_in_browser") || (sanitizedVideo == null) || (sanitizedVideo == "null")) &&
            ((sanitizedAudio == "0") || (sanitizedAudio == "disabled_in_browser") || (sanitizedAudio == null) || (sanitizedAudio == "null")))
        {
            console.log("no audio or video stream starting data only stream")
            document.getElementById("mainStream").src = "https://alpha.rpxl.app/vdo/?room=RPXL_"+sanitizedSessionID+
                "&push=Stream_"+sanitizedSessionID+
                "&dataonly"+
                "";
        } else {
            console.log("Starting main stream with settings :", resolution, quality, sanitizedVideo, sanitizedAudio);
            if ((sanitizedVideo == "0") || (sanitizedVideo == "disabled_in_browser") || (sanitizedVideo == null) || (sanitizedVideo == "null") ) {
                var videoSetup = "&avatar=https%3A%2F%2Falpha.rpxl.app%2Favatars%2F"+avatar+"&videodevice=0";//"&novideo&videodevice=0";
            } else {
                var videoSetup = "&videodevice="+sanitizedVideo;
            }
            if ((sanitizedAudio == "0") || (sanitizedAudio == "disabled_in_browser") || (sanitizedAudio == null) || (sanitizedAudio == "null") ) {
                var audioSetup = "&noaudio"; 
            } else {
                var audioSetup = "&audiodevice="+sanitizedAudio;
            }

            document.getElementById("mainStream").src = "https://alpha.rpxl.app/vdo/?room=RPXL_"+sanitizedSessionID+
                "&push=Stream_"+sanitizedSessionID+videoSetup+audioSetup+
                "&directoronly"+
                "&mirror"+//mirror the video
                "&rampuptime=6000"+//ramp up time of 6 seconds
                "&hidehome"+//hide vdo ninja homepage	
                "&webcam"+
                "&cleanish"+//remove all interface bits
                "&ovb="+quality+//outbound video bitrate for main (obs stream)
                "&quality="+resolution+//1 720p set to 0 for 1080p
                "&autostart"+//autostart directors feed
                "&trb=50000"+//total room bit rate
                "&hiddenscenebitrate=50000"+//50mbps, highest quality
                "&showlist=0"+//show hidden guest list
                "&hideplaybutton"+//hides big play button if autoplay is disabled
                "&chroma=3c3c3c"+
                "&meterstyle=1"+
                "&agc=0"+//turns off auto gain control
                "&denoise=0"+//turns off denoiser
                "&ab=128"+//constant audio bitrate
                "&waitimage=https%3A%2F%2Falpha.rpxl.app%2Fimages%2FnosignalHD.png"+
                "&css=https%3A%2F%2Falpha.rpxl.app%2Fstyles%2FvdoMain.css"+
                "&js=https%3A%2F%2Falpha.rpxl.app%2Fscripts%2Fvdomain.js"+
                ""; 

        setTimeout(function(){   
            document.getElementById("mainStream").classList.remove("hidden");
            document.getElementById("zoomdiv").classList.remove("hidden");
        },2000);
        }
    } else {
        console.log("Main stream settings unchanged, not reloading")
    }
}


function viewerStreamDirector () {
    let storedUserName = sessionStorage.getItem("username"); //retrieve username, camera and mic settings from storage
    let storedCameraIndex = sessionStorage.getItem("cameraSourceIndex");
    let storedMicIndex = sessionStorage.getItem("microphoneSourceIndex");

    let currentUsername = document.getElementById("name").value.trim() || "Streamer"; //current values in form`
    let sanitizedCurrentUserName = encodeURIComponent(currentUsername); 

    let currentCamera = document.getElementById("cameraSource").selectedIndex;
    let currentMic = document.getElementById("microphoneSource").selectedIndex;

    if (!sanitizedCurrentUserName) {
        document.getElementById("name").style.animation = "pulse 500ms";
        setTimeout(() => { document.getElementById("name").style.animation = "none"; }, 500);
        document.getElementById("name").focus();
        return;
    } 
        
    if (avatar == "") {
        // pick a random avatar image
        const numberArray = Array.from({ length: 43 }, (_, i) => String(i).padStart(3, '0'));
        const randomNum = numberArray[Math.floor(Math.random() * numberArray.length)];
        avatar = `${randomNum}.png`;
    }
    //compare form values with stored values, if they're different then reload the iframe
    if ((sanitizedCurrentUserName != storedUserName) || (currentCamera != storedCameraIndex) || (currentMic != storedMicIndex)) {
        if (!document.getElementById("viewersStream").classList.contains("hidden") ) { 
            document.getElementById("viewersStream").classList.add("hidden"); 
        }
        document.getElementById("popupBG").classList.add("hidden"); 
        viewersStream.contentWindow.postMessage({ close: true }, "*"); // hangup connection on video ninja
        console.log("Viewer settings changed, reloading...");

        storeSelectedDevicesUser(); //store new user only settings - initui.js
        deactivateUserTools(); //turn off tools while reloading frame - initui.js

        //reload the stored values and use to reload viewers frame
        let sanitizedSessionID = sessionStorage.getItem("sessionID");   //retrieve session ID
        let sanitizedUserName = sessionStorage.getItem("username"); //retrieve username, camera and mic settings from storage
        let sanitizedCamera = sessionStorage.getItem("cameraDevice");
        let sanitizedMicrophone = sessionStorage.getItem("microphoneDevice");

        //if no video source is selected or the camera is disabled in the browser then set to connect as miconly
        if ((sanitizedCamera == "0") || (sanitizedCamera == "disabled_in_browser") || (sanitizedCamera == null) || (sanitizedCamera == "null") ) {
            var camSetup = "&avatar=https%3A%2F%2Falpha.rpxl.app%2Favatars%2F"+avatar+"&videodevice=0";//"&novideo&videodevice=0";
        } else {
            var camSetup = "&videodevice="+sanitizedCamera+"&videobitrate=64";
        }

        if ((sanitizedMicrophone == "0") || (sanitizedMicrophone == "disabled_in_browser") || (sanitizedMicrophone == null) || (sanitizedMicrophone == "null") ) {
            var micSetup = "&audiodevice=0";
        } else {
            var micSetup = "&audiodevice="+sanitizedMicrophone;
        }

        document.getElementById("viewersStream").src = "https://alpha.rpxl.app/vdo/?room=RPXL_"+sanitizedSessionID+
            "&cleanish"+
            "&director"+
            //"&showlabels"+
            "&label="+sanitizedUserName+camSetup+micSetup+
            "&hidehome"+
            //"&style=6"+
            "&meterstyle=1"+
            "&webcam"+
            "&notify"+
            "&disablehotkeys"+
            "&clearstorage"+
            "&autostart"+
            "&nocontrols"+
            "&signalmeter"+
            "&chroma=3c3c3c"+
            "&nomouseevents"+
            "&group=Client"+
            "&css=https%3A%2F%2Falpha.rpxl.app%2Fstyles%2FvdoDirector.css"+
            ""; 

        reactivateUserTools(); //reactivate tools - initui.js
        setTimeout(function(){   
            document.getElementById("viewersStream").classList.remove("hidden");  //wait 1 second and show frame
        },2000);
    } else {
        console.log("Viewer settings unchanged, not reloading")
        closeDialog(settingsDialog, toolSettings);
    }
}
