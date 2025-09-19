
//find video and audio sources and populate dropdown boces
//load the sources when selected into the correct preview areas (main or user), make sure that the same sources can not be used twice
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
//var stream = null;

//every time we select the dropdown check the source (main or user)
//and get the value selected and get the respective stream and put it in the correct preview box
//every time we select the dropdown check the source (main or user)
//and get the value selected and get the respective stream and put it in the correct preview box
function checkSelection (calledBy) {
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
    if ((videos != "")) {
        videoElement.classList.remove("fadeout");
        getvideoStream();
    } else {
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
    //window.stream = stream; 

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
    //window.stream = stream; 
    if (audioElement.id == "audio") { var volumeMeterEl = document.getElementById('audiometer'); }
    if (audioElement.id == "microphone") { var volumeMeterEl = document.getElementById('micmeter'); }

    let audioContext = null;
    let analyserNode = null;
    let animationFrameId = null; // To store the ID returned by requestAnimationFrame
    let mediaStreamAudioSourceNode = null; // Store the source node

    if (audio != "") {//used to make sure we don't set the stream on startup since none is the default option
        audioSelected.selectedIndex = [...audioSelected.options].findIndex(option => option.text === stream.getAudioTracks()[0].label);
        audioElement.srcObject = stream;

        //setup audio handler for UV meter
        audioContext = new AudioContext();
        mediaStreamAudioSourceNode = audioContext.createMediaStreamSource(stream);
        analyserNode = audioContext.createAnalyser(); // Store the analyser node
        mediaStreamAudioSourceNode.connect(analyserNode);

        const pcmData = new Float32Array(analyserNode.fftSize);
        let currentMeterValue = 0; // Keep this outside the function so it persists between frames
        const attack = 0.1; // Faster response when volume increases (adjust as needed)
        const decay = 0.95; // Slower response when volume decreases (adjust as needed)
        const scaleFactor = 1000; // Adjust this to match your meter's maximum visual height (e.g., 200px)

        const onFrame = () => {
            analyserNode.getFloatTimeDomainData(pcmData);
            let sumSquares = 0.0;
            for (const amplitude of pcmData) { sumSquares += amplitude * amplitude; }
            const instantValue = Math.sqrt(sumSquares / pcmData.length);

            // Apply attack and decay
            if (instantValue > currentMeterValue) {
                currentMeterValue = currentMeterValue + (instantValue - currentMeterValue) * attack;
            } else {
                currentMeterValue = currentMeterValue * decay;
            }

            currentMeterValue = Math.max(0, currentMeterValue);

            if (volumeMeterEl) {
                const meterHeight = currentMeterValue * scaleFactor;
                volumeMeterEl.style.height = meterHeight + 'px';
            }

            // Store the animation frame ID
            animationFrameId = window.requestAnimationFrame(onFrame);
        };

        // Start the animation loop
        animationFrameId = window.requestAnimationFrame(onFrame);
    } else {
            // stop uv meters if set to none
            if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
            audioContext = null;
            analyserNode = null;
            mediaStreamAudioSourceNode = null;
                if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            if (volumeMeterEl) {
                volumeMeterEl.style.height = '0px';
            }
        }
    }
}

function handleError(error) {
    console.error('Error: ', error);
}