//start the chat stream on vdo ninja (used by presenter and client)
function viewerStream () {  
    console.log ("session stored values", sessionStorage);

    document.getElementById("popupBG").classList.add("hidden"); 

    if (!document.getElementById("viewersStream").classList.contains("hidden")) {
        document.getElementById("viewersStream").classList.add("hidden");
    }

    let sanitizedSessionID = sessionStorage.getItem("sessionID");
    let sanitizedUserName = sessionStorage.getItem("username");
    let sanitizedCamera = sessionStorage.getItem("cameraDevice");
    let sanitizedMicrophone = sessionStorage.getItem("microphoneDevice");

    //if no video source is selected or the camera is disabled in the browser then set to connect as miconly
    if ((sanitizedCamera == 0) || (sanitizedCamera == "disabled_in_browser")) {
        var camOrMicSetup = "videodevice=0";
    }   else {
        var camOrMicSetup = "videodevice="+sanitizedCamera+"&quality=3&videobitrate=196&viewwidth=160&viewheight=90";
    }

    document.getElementById("viewersStream").allow = "autoplay;screen-wake-lock;autoplay;camera *;microphone *;picture-in-picture;display-capture;";
    document.getElementById("viewersStream").src = "https://vdo.rpxl.app/?room=RPXL_"+sanitizedSessionID+
        "&label="+sanitizedUserName+
        "&showlabels"+
        "&style=4"+
        "&meterstyle=2"+
        "&"+camOrMicSetup+
        "&audiodevice="+sanitizedMicrophone+
        "&webcam"+
        "&disablehotkeys"+
        "&showall"+
        "&autostart"+
        "&cleanoutput"+
        "&transparent"+
        "&group=Client"+
        "&avatar=https%3A%2F%2Falpha.rpxl.app%2Fimages%2Favatar.png"+
        "&css=https%3A%2F%2Falpha.rpxl.app%2Fstyles%2Fviewersstream.css";

    setTimeout(function(){   
        document.getElementById("viewersStream").classList.remove("hidden");
    },1000);
}

//view the mainstream (used by clients)
function viewMainstream () {
    //console.log ("sessionStorage for main stream", sessionStorage);

    let sanitizedSessionID = sessionStorage.getItem("sessionID");

    document.getElementById("mainStream").allow = "autoplay;screen-wake-lock;";
    document.getElementById("mainStream").src = "https://vdo.rpxl.app/?room=RPXL_"+sanitizedSessionID+
        "&view=Stream_"+sanitizedSessionID+
        //"&directoronly"+
        "&solo"+//no login options, solos stream
        "&clean"+//remove all interface bits
        "&hideplaybutton"+//hides big play button if autoplay is disabled
        "&transparent"+//makes bg transparent
        "&preloadbitrate=-1"+//preloads the video, might not be necessary as only use scene 1
        "&rampuptime=6000"+
        "&waitimage=https%3A%2F%2Falpha.rpxl.app%2Fimages%2FnosignalHD.png"+
        "&buffer=1000"+//adds a xms buffer
        "&showlist=0"+//hides the viewer list
        "&js=https%3A%2F%2Falpha.rpxl.app%2Fscripts%2Fvdomain.js"+
        "";    

    setTimeout(function(){   
        document.getElementById("mainStream").classList.remove("hidden");
    },1000);
}

//used to start main stream by presenter
function startMainStream() {
    //console.log ("sessionStorage for stream create", sessionStorage);
    if (!document.getElementById("mainStream").classList.contains("hidden") ) { 
        document.getElementById("mainStream").classList.add("hidden"); 
    }

    //get settings from local storage
    let sanitizedSessionID = sessionStorage.getItem("sessionID");
    let resolution = sessionStorage.getItem("resolution") || "1"; //default to 
    let quality = sessionStorage.getItem("quality") || "8000"; //default to low quality
    let sanitizedVideo = sessionStorage.getItem("videoDevice") || "0"; //default       
    let sanitizedAudio = sessionStorage.getItem("audioDevice") || "0"; //default

    document.getElementById("mainStream").allow = "autoplay;screen-wake-lock;autoplay;camera *;microphone *;picture-in-picture;display-capture;";
    document.getElementById("mainStream").src = "https://vdo.rpxl.app/?room=RPXL_"+sanitizedSessionID+
        "&push=Stream_"+sanitizedSessionID+
        "&directoronly"+
        "&mirror"+//mirror the video
        "&label=RPXL-"+sanitizedSessionID+//sets livestream as label for director connection
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
        "&transparent"+//makes bg transparent
        "&agc=0"+//turns off auto gain control
        "&denoise=0"+//turns off denoiser
        "&ab=128"+//constant audio bitrate
        //"&stats"+
        "&showconnections"+
        "&signalmeter"+
        "&waitimage=https%3A%2F%2Falpha.rpxl.app%2Fimages%2FnosignalHD.png"+
        "&js=https%3A%2F%2Falpha.rpxl.app%2Fscripts%2Fvdomain.js";

    setTimeout(function(){   
        document.getElementById("mainStream").classList.remove("hidden");
    },1000);

}