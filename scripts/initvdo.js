//start the chat stream on vdo ninja (used by presenter and client)
var avatar = "";

function viewerStream () {
    let sanitizedUserName = sessionStorage.getItem("username"); //retrieve username, camera and mic settings from storage
    let cameraIndex = sessionStorage.getItem("cameraSource");
    let micIndex = sessionStorage.getItem("microphoneSource");

    let currentUsername = document.getElementById("name").value.trim() || "Presenter"; //current values in form`
    let sanitizedCurrentUserName = encodeURIComponent(currentUsername); 

    let currentCamera = document.getElementById("cameraSource");
    let currentMic = document.getElementById("microphoneSource");

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
    if ((sanitizedCurrentUserName != sanitizedUserName) || (currentCamera.selectedIndex != cameraIndex) || (currentMic.selectedIndex != micIndex)) {
        if (!document.getElementById("viewersStream").classList.contains("hidden") ) { 
            document.getElementById("viewersStream").classList.add("hidden"); 
        }
        document.getElementById("popupBG").classList.add("hidden"); 
        viewersStream.contentWindow.postMessage({ close: true }, "*"); // hangup connection on video ninja
        console.log("Viewer settings changed, reloading...");

        deactivateUserTools(); //turn off tools while reloading frame - initui.js
        storeSelectedDevices(0,1); //store new user only settings - initui.js
        //reload the stored values and use to reload viewers frame
        let sanitizedSessionID = sessionStorage.getItem("sessionID");   //retrieve session ID
        let sanitizedUserName = sessionStorage.getItem("username"); //retrieve username, camera and mic settings from storage
        let sanitizedCamera = sessionStorage.getItem("cameraDevice");
        let sanitizedMicrophone = sessionStorage.getItem("microphoneDevice");

        //if no video source is selected or the camera is disabled in the browser then set to connect as miconly
        if ((sanitizedCamera == "0") || (sanitizedCamera == "disabled_in_browser") || (sanitizedCamera == null) || (sanitizedCamera == "null") ) {
            var camSetup = "&avatar=https%3A%2F%2Falpha.rpxl.app%2Favatars%2F"+avatar+"&videodevice=0";//"&novideo&videodevice=0";
        } else {
            var camSetup = "&"+sanitizedCamera+"&videobitrate=64";
        }

        if ((sanitizedMicrophone == "0") || (sanitizedMicrophone == "disabled_in_browser") || (sanitizedMicrophone == null) || (sanitizedMicrophone == "null") ) {
            var micSetup = "&noaudio&audiodevice=0";
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
            "&css=https%3A%2F%2Falpha.rpxl.app%2Fstyles%2Fviewersstream.css"+
            ""; 
            //"&fontsize=100"+
            //"&mutestatus"+
            //"&minipreview&minipreviewoffset"+
            //"&unmutestatus"+
            //"&showall"+
            //"&showconnections"+
            // "&cleanoutput"+
            //"&transparent"+
            // "&groupview=Client"+
            // "&avatar=https%3A%2F%2Falpha.rpxl.app%2Fimages%2Favatar.png"+
            //"&safemode"+
            //"&intro"+
            //"&dataonly"+
            //"&meterstyle=5&bgimage=https%3A%2F%2Falpha.rpxl.app%2Fimages%2Favatar.png"+

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
        "&meterstyle=1"+
        "&hideplaybutton"+//hides big play button if autoplay is disabled
        "&chroma=3c3c3c"+
        "&preloadbitrate=-1"+//preloads the video, might not be necessary as only use scene 1
        "&rampuptime=6000"+
        "&waitimage=https%3A%2F%2Falpha.rpxl.app%2Fimages%2FnosignalHD.png"+
        "&buffer=1000"+//adds a xms buffer
        "&showlist=0"+//hides the viewer list
        "&css=https%3A%2F%2Falpha.rpxl.app%2Fstyles%2Fmainstream.css"+
        "&js=https%3A%2F%2Falpha.rpxl.app%2Fscripts%2Fvdomain.js"+
        ""; 
        //"&style=1"+
        //"&label=RPXL-"+sanitizedSessionID+//sets livestream as label for director connection
        //"&directoronly"+

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
    let storedVideo = sessionStorage.getItem("videoSource");
    let storedAudio = sessionStorage.getItem("audioSource"); 
    
    let currentResolution = getCheckedRadioValue("resolution");
    let currentQuality = getCheckedRadioValue("quality");
    let currentVideo = document.getElementById("videoSource").selectedIndex;
    let currentAudio = document.getElementById("audioSource").selectedIndex;

    if ((storedResolution != currentResolution) || (storedQuality != currentQuality) || (storedVideo != currentVideo) || (storedAudio != currentAudio)) {
        if (!document.getElementById("mainStream").classList.contains("hidden") ) { 
            document.getElementById("mainStream").classList.add("hidden"); 
        }
        console.log("Main stream settings changed, reloading...")

        storeSelectedDevices(1,0); //store new user only settings and reload frame - initui.js

        let resolution = sessionStorage.getItem("resolution"); //default to 
        let quality = sessionStorage.getItem("quality"); //default to low quality
        let sanitizedVideo = sessionStorage.getItem("videoDevice"); //default       
        let sanitizedAudio = sessionStorage.getItem("audioDevice"); //default

        console.log("Starting main stream with settings :", resolution, quality, sanitizedVideo, sanitizedAudio);
        if ((sanitizedVideo == "0") || (sanitizedVideo == "disabled_in_browser") || (sanitizedVideo == null) || (sanitizedVideo == "null") ) {
            var camSetup = "&avatar=https%3A%2F%2Falpha.rpxl.app%2Favatars%2F"+avatar+"&videodevice=0";//"&novideo&videodevice=0";
        } else {
            var camSetup = "&"+sanitizedVideo;
        }
        if ((sanitizedAudio == "0") || (sanitizedAudio == "disabled_in_browser") || (sanitizedAudio == null) || (sanitizedAudio == "null") ) {
            var micSetup = "&noaudio"; //really shouldn't happen buuuuuuuuuttttttt........
        } else {
            var micSetup = "&audiodevice="+sanitizedAudio;
        }

        document.getElementById("mainStream").src = "https://alpha.rpxl.app/vdo/?room=RPXL_"+sanitizedSessionID+
            "&push=Stream_"+sanitizedSessionID+
            "&directoronly"+
            "&mirror"+//mirror the video
            "&rampuptime=6000"+//ramp up time of 6 seconds
            "&hidehome"+//hide vdo ninja homepage	
            "&webcam"+
            "&cleanoutput"+//remove all interface bits
            "&ovb="+quality+//outbound video bitrate for main (obs stream)
            "&quality="+resolution+//1 720p set to 0 for 1080p
            "&videodevice="+sanitizedVideo+//video source
            "&audiodevice="+sanitizedAudio+//audio source
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
            "&js=https%3A%2F%2Falpha.rpxl.app%2Fscripts%2Fvdomain.js"+
            ""; 
            //"&nopush"+
            //"&stats"+
            //"&showconnections"+
            //"&signalmeter"+
            //"&label=RPXL-"+sanitizedSessionID+//sets livestream as label for director connection
            //"&showlabels"+

        setTimeout(function(){   
            document.getElementById("mainStream").classList.remove("hidden");
        },1000);
    } else {
        console.log("Main stream settings unchanged, not reloading")
    }
}