
//check if the user has allowed access to the camera and microphone
//if not show a popup to ask them to allow access
//Microphone access is required but camera access is optional

checkPermissions();

async function checkPermissions() {
try {
    const cameraPermission = await navigator.permissions.query({ name: 'camera' });
    const microphonePermission = await navigator.permissions.query({ name: 'microphone' });

    //block login and session if microphone is not allowed
    if ((microphonePermission.state !== 'granted') || (cameraPermission.state !== 'granted')){
        document.getElementById('popupPermissionMic').classList.remove("hidden");
        permissionMicHelp.addEventListener("click", function() {  window.open('https://www.google.com/search?client=safari&rls=en&q=browser+permissions+for+camera+and+microphone&ie=UTF-8&oe=UTF-8&channel=36" target="_blank"'); });
    } 
    } catch (error) {
        console.error('Error checking permissions:', error);
        // Handle potential errors
    }
}

//session creation options of video and audio sources
//find video and audio sources
//populates dropdown boxes with the found sources
//load the sources when selected into the correct preview areas (main or user)
//make sure that the same sources can not be used twice
//check that a valid session id is entered
//sanitize all values before creating streams

//used to populate initial drop down and listen for onclick events

var videoSelect = document.querySelector('select#videoSource');
var audioSelect = document.querySelector('select#audioSource');
var cameraSelect = document.querySelector('select#cameraSource');
var microphoneSelect = document.querySelector('select#microphoneSource');

videoSelect.onchange = checkSelection;
audioSelect.onchange = checkSelection;
cameraSelect.onchange = checkSelection;
microphoneSelect.onchange = checkSelection;


//dependant on if main or user dropdowns selected will change when moving streams from one to the other
var videos = ""
var audios = ""
var videoSelected
var audioSelected
var videoElement = document.querySelector('video#video');
var audioElement = document.querySelector('audio#audio');
var stream = null;


//every time we select the dropdown check the source (main or user)
//and get the value selected and get the respective stream and put it in the correct preview box
function checkSelection (calledBy) {
    if (stream != null) {
        console.log("stopping stream")
        stream.getTracks().forEach(function(track) {
            track.stop();
        });}
    //setup which elements will be replaced depending on the source changes
    //video, audio, camera or microphone and sets the target preview areas (main or user)
    //disables a select source so that it can not be used twice
    //console.log(calledBy.srcElement.id)
    if (calledBy.srcElement.id == "videoSource") { 
        videoElement = document.querySelector('video#video');
        videos = document.getElementById("videoSource").value;
        videoSelected = document.querySelector('select#videoSource');
        preventDupes.call(this, cameraSource, this.selectedIndex );
    } 
    if (calledBy.srcElement.id == "audioSource") { 
        audioElement = document.querySelector('audio#audio');
        audios = document.getElementById("audioSource").value;
        audioSelected = document.querySelector('select#audioSource');
        preventDupes.call(this, microphoneSource, this.selectedIndex );
    }
    if (calledBy.srcElement.id == "cameraSource") { 
        videoElement = document.querySelector('video#camera');
        videos = document.getElementById("cameraSource").value;
        videoSelected = document.querySelector('select#cameraSource');
        preventDupes.call(this, videoSource, this.selectedIndex );
    } 
    if (calledBy.srcElement.id == "microphoneSource") { 
        audioElement = document.querySelector('audio#microphone');
        audios = document.getElementById("microphoneSource").value;
        audioSelected = document.querySelector('select#microphoneSource');
        preventDupes.call(this, audioSource, this.selectedIndex );
    } 

    //check if a new video or audio option has been selected
    //if so get the appropriate stream
    //if they were set to none the stop the video or audio stream
    if ((videos != "")) { 
        videoElement.classList.remove("fadeout");  
        getvideoStream();
    } else {
        //console.log("video :", videoElement.srcObject)
        if (videoElement.srcObject != null) { //make sure there is a stream or we get an error trying to stop things
            const videoStream = videoElement.srcObject;
            const videoTracks = videoStream.getTracks();
            videoTracks[0].stop();
            videoElement.classList.add("fadeout");  
        }
    }

    if ((audios != "")) {
        getAudioStream();
    } else {
        //console.log("audio ", videoElement.srcObject)
        if (audioElement.srcObject != null) { //make sure there is a stream or we get an error trying to stop things
            const audioStream = audioElement.srcObject;
            const audioTracks = audioStream.getTracks();
            audioTracks[0].stop();
        }
    }
}
//prevents the sources from being selected twice as both main and user sources
function preventDupes( select, index ) {
    var options = select.options,
        len = options.length;
    while( len-- ) {
        options[ len ].disabled = false;
    }
    if( index > 0 ) {
        select.options[ index ].disabled = true;
    }
    if( index === select.selectedIndex ) {
        //alert('You\'ve already selected the item "' + select.options[index].text + '".\n\nPlease choose another.');
        this.selectedIndex = 0;
    }
    return;
}
//initial population of selects audio and video streams
getStreams().then(getDevices).then(gotDevices);

//populates audio and video selects
function getStreams() {
    const videoSource = videoSelect.value;
    const audioSource = audioSelect.value;

    const constraints = {
        audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
        video: {deviceId: videoSource ? {exact: videoSource} : undefined}
    };
    return navigator.mediaDevices.getUserMedia(constraints).
        then(gotvideoStream).catch(handleError);
}
function getDevices() {
  return navigator.mediaDevices.enumerateDevices();
}
//adds each device to the dropdown boxes removing the (default device so we don't have duplicates)
function gotDevices(deviceInfos) {
    window.deviceInfos = deviceInfos; // make available to console
    //console.log('Available input and output devices:', deviceInfos);

    for (const deviceInfo of deviceInfos) {
        const option = document.createElement('option');
        option.value = deviceInfo.deviceId;

        if ((deviceInfo.kind === 'audioinput')  && (option.value != 'default')) {
            option.text = deviceInfo.label || `Microphone ${audioSelect.length + 1}`;
            audioSelect.appendChild(option);
        } else if ((deviceInfo.kind === 'videoinput')  && (option.value != 'default')) {
            option.text = deviceInfo.label || `Microphone ${audioSelect.length + 1}`;
            videoSelect.appendChild(option);
        }
    }
    
    ////////duplicate audio and video sources to camera and microphone sources 
    var select1 = document.getElementById("videoSource");
    var options = select1.innerHTML
    var select2 = document.getElementById("cameraSource");
    select2.innerHTML = options
    var select1 = document.getElementById("audioSource");
    var options = select1.innerHTML
    var select2 = document.getElementById("microphoneSource");
    select2.innerHTML = options
}

//add selected video stream to video element
function getvideoStream() {
    const videoSource = videos;

    const constraints = {
        video: {deviceId: videoSource ? {exact: videoSource} : undefined}
    };
    return navigator.mediaDevices.getUserMedia(constraints).
        then(gotvideoStream).catch(handleError);
}
function gotvideoStream(stream) {
    window.stream = stream; // make stream available to console !important, used to stop streams earlier

    if (videos != "") {//used to make sure we don't set the stream on startup since none is the default option
        videoSelected.selectedIndex = [...videoSelected.options].findIndex(option => option.text === stream.getVideoTracks()[0].label);
        videoElement.srcObject = stream;
    }
}

//add selected audio stream to audio element
function getAudioStream() {
    const audioSource = audios;

    const constraints = {
        audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
    };
    return navigator.mediaDevices.getUserMedia(constraints).
        then(gotAudioStream).catch(handleError);
}
function gotAudioStream(stream) {
    window.stream = stream; // make stream available to console !important, used to stop streams earlier

    if (audio != "") {//used to make sure we don't set the stream on startup since none is the default option
        audioSelected.selectedIndex = [...audioSelected.options].findIndex(option => option.text === stream.getAudioTracks()[0].label);
        audioElement.srcObject = stream;
/*VU meter stuff
        window.AudioContext = (window.AudioContext || window.webkitAudioContext);

        var audioContext = new AudioContext();
        var mediaStreamSource = audioContext.createMediaStreamSource(stream);
        var processor = audioContext.createScriptProcessor(2048, 1, 1);

        mediaStreamSource.connect(audioContext.destination);
        mediaStreamSource.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = function (e) {
        var inputData = e.inputBuffer.getChannelData(0);
        var inputDataLength = inputData.length;
        var total = 0;

        for (var i = 0; i < inputDataLength; i++) {
        total += Math.abs(inputData[i++]);
        }

        var rms = Math.sqrt(total / inputDataLength);
        updateMeter(rms * 200);
        };
        */
    }
}

function handleError(error) {
    console.error('Error: ', error);
}
/*
function updateMeter(pct) {
    var meter = document.getElementById('meter');
    meter.style.width = pct + '%';
}

*/