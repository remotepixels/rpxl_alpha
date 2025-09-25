//change inputs on the dropdowns
const videoSelect = document.getElementById("videoSource");
const audioSelect = document.getElementById("audioSource");
const cameraSelect = document.getElementById("cameraSource");
const microphoneSelect = document.getElementById("microphoneSource");

if (videoSelect) videoSelect.onchange = checkSelection;
if (audioSelect) audioSelect.onchange = checkSelection;
if (cameraSelect) cameraSelect.onchange = checkSelection;
if (microphoneSelect) microphoneSelect.onchange = checkSelection;

//dependant on if main or user dropdowns selected will change when moving streams from one to the other
// var videos = ""
// var audios = ""
// var videoSelected
// var audioSelected
//var stream = null;

//every time we select the dropdown check the source (main or user)
//and get the value selected and get the respective stream and put it in the correct preview box
function checkSelection (calledBy) {
    if (calledBy.srcElement.id == "videoSource") {
        // videoElement = document.querySelector('video#video');
        // videos = document.getElementById("videoSource").value;
        // videoSelected = document.querySelector('select#videoSource');
        preventDupes.call(this, cameraSource, this.selectedIndex );
    }
    if (calledBy.srcElement.id == "audioSource") {
        // audioElement = document.querySelector('audio#audio');
        // audios = document.getElementById("audioSource").value;
        // audioSelected = document.querySelector('select#audioSource');
        preventDupes.call(this, microphoneSource, this.selectedIndex );
    }
    if (calledBy.srcElement.id == "cameraSource") {
        // videoElement = document.querySelector('video#camera');
        // videos = document.getElementById("cameraSource").value;
        // videoSelected = document.querySelector('select#cameraSource');
        if (videoSelect) { preventDupes.call(this, videoSource, this.selectedIndex ); }
    }
    if (calledBy.srcElement.id == "microphoneSource") {
        // audioElement = document.querySelector('audio#microphone');
        // audios = document.getElementById("microphoneSource").value;
        // audioSelected = document.querySelector('select#microphoneSource');
        if (audioSelect) { preventDupes.call(this, audioSource, this.selectedIndex ); }
    }
    // console.log("Video Source :", videos);
    // console.log("Audio Source :", audios);  
    // console.log("Video Element :", videoElement.id);
    // console.log("Audio Element :", audioElement.id);
    //     //check if a new video or audio option has been selected

    // if ((videos != "")) {
    //     videoElement.classList.remove("fadeout");
    //     getvideoStream();
    // } else {
    //     if (videoElement.srcObject != null) { //make sure there is a stream or we get an error trying to stop things
    //         const videoStream = videoElement.srcObject;
    //         const videoTracks = videoStream.getTracks();
    //         videoTracks[0].stop();
    //         videoElement.classList.add("fadeout");
    //     }
    // }

    // if ((audios != "")) {
    //     getAudioStream();
    // } else {
    //     if (audioElement.srcObject != null) { //make sure there is a stream or we get an error trying to stop things
    //         const audioStream = audioElement.srcObject;
    //         const audioTracks = audioStream.getTracks();
    //         audioTracks[0].stop();
    //     }
    // }
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

// //add selected video stream to video element
// function getvideoStream() {
//     const videoSource = videos;

//     const constraints = {
//         video: {deviceId: videoSource ? {exact: videoSource} : undefined}
//     };
//     return navigator.mediaDevices.getUserMedia(constraints).
//         then(gotvideoStream).catch(handleError);
// }

// function gotvideoStream(stream) {
//     if (videos != "") {//used to make sure we don't set the stream on startup since none is the default option
//         videoSelected.selectedIndex = [...videoSelected.options].findIndex(option => option.text === stream.getVideoTracks()[0].label);
//         videoElement.srcObject = stream;
//     }
// }

// //add selected audio stream to audio element
// function getAudioStream() {
//     const audioSource = audios;

//     const constraints = {
//         audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
//     };
//     return navigator.mediaDevices.getUserMedia(constraints).
//         then(VUAudioStream).catch(handleError);
// }



// // Store state outside the function so we can manage cleanup
// let vuMeterState = {
//     audioContext: null,
//     analyserNode: null,
//     animationFrameId: null,
//     mediaStreamSource: null,
//     volumeMeterEl: null,
// };

// function VUAudioStream(stream) {
//     // Stop and cleanup any existing VU meter
//     if (vuMeterState.animationFrameId) {
//         cancelAnimationFrame(vuMeterState.animationFrameId);
//         vuMeterState.animationFrameId = null;
//     }
//     if (vuMeterState.mediaStreamSource) {
//         vuMeterState.mediaStreamSource.disconnect();
//         vuMeterState.mediaStreamSource = null;
//     }
//     if (vuMeterState.audioContext) {
//         vuMeterState.audioContext.close();
//         vuMeterState.audioContext = null;
//     }
//     if (vuMeterState.volumeMeterEl) {
//         vuMeterState.volumeMeterEl.style.height = '0px'; // Reset the meter UI
//     }

//     // If no stream, just return after cleanup
//     if (!stream) return;

//     //const audioElement = document.getElementById("audio") || document.getElementById("microphone");
//     let volumeMeterEl = null;
//     console.log("Audio stream for VU meter :", audioElement);
//     if (audioElement.id == "audio") { volumeMeterEl = document.getElementById('audiometer'); }
//     if (audioElement.id == "microphone") { volumeMeterEl = document.getElementById('micmeter'); }

//     const audioContext = new AudioContext();
//     const mediaStreamSource = audioContext.createMediaStreamSource(stream);
//     const analyserNode = audioContext.createAnalyser();
//     mediaStreamSource.connect(analyserNode);

//     const pcmData = new Float32Array(analyserNode.fftSize);
//     let currentMeterValue = 0;
//     const attack = 0.5;
//     const decay = 0.97;
//     const scaleFactor = 1500;

//     const onFrame = () => {
//         analyserNode.getFloatTimeDomainData(pcmData);
//         let sumSquares = 0.0;
//         for (const amplitude of pcmData) {
//             sumSquares += amplitude * amplitude;
//         }
//         const instantValue = Math.sqrt(sumSquares / pcmData.length);

//         if (instantValue > currentMeterValue) {
//             currentMeterValue += (instantValue - currentMeterValue) * attack;
//         } else {
//             currentMeterValue *= decay;
//         }

//         currentMeterValue = Math.max(0, currentMeterValue);

//         if (volumeMeterEl) {
//             const meterHeight = currentMeterValue * scaleFactor;
//             volumeMeterEl.style.height = meterHeight + 'px';
//         }

//         vuMeterState.animationFrameId = window.requestAnimationFrame(onFrame);
//     };

//     // Save state for cleanup
//     vuMeterState = {
//         audioContext,
//         analyserNode,
//         animationFrameId: requestAnimationFrame(onFrame),
//         mediaStreamSource,
//         volumeMeterEl
//     };
// }

// function handleError(error) {
//     console.error('Error with audio/video: ', error);
// }

function stopAllMediaStreams() {
    // Get all media elements on the page (e.g., <video>, <audio>)
    const mediaElements = document.querySelectorAll('video, audio');

    mediaElements.forEach(mediaEl => {
        if (mediaEl.srcObject instanceof MediaStream) {
            // Get all tracks (audio + video) and stop them
            mediaEl.srcObject.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                    console.log(`Stopped ${track.kind} track.`);
                }
            });

            // Clear the srcObject after stopping
            mediaEl.srcObject = null;
        }
    });

    // Also stop any manually created streams not attached to media elements
    if (window.activeStreams && Array.isArray(window.activeStreams)) {
        window.activeStreams.forEach(stream => {
            stream.getTracks().forEach(track => {
                if (track.readyState === 'live') {
                    track.stop();
                    console.log(`Stopped ${track.kind} track from activeStreams.`);
                }
            });
        });
        window.activeStreams = []; // Clear the stored streams
    }
}