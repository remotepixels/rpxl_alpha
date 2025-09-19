

// ------------------ Video and Audio Selection ------------------
//const videoSelect = document.querySelector('select#cameraSource');
//const audioSelect = document.querySelector('select#microphoneSource');
const videoElement = document.querySelector('video#camera');
const audioElement = document.querySelector('audio#microphone');
const volumeMeterEl = document.getElementById('audiometer');

let videoStream = null;
let audioStream = null;
let audioContext = null;
let analyserNode = null;
let animationFrameId = null;
let mediaStreamAudioSourceNode = null;

videoSelect.onchange = () => handleDeviceSelection('video');
audioSelect.onchange = () => handleDeviceSelection('audio');

//init();

// async function init() {
//   try {
//     const devices = await navigator.mediaDevices.enumerateDevices();
//     //const result = await response.json()
//     console.log("Devices :", devices);

//     devices.forEach(devices => {
//     if (devices.deviceId === 'default') return;

//     const option = document.createElement('option');
//     option.value = devices.deviceId;

//     if (devices.kind === 'audioinput') {
//       option.text = devices.label || `Microphone ${audioSelect.length + 1}`;
//       audioSelect.appendChild(option);
//     } else if (devices.kind === 'videoinput') {
//       option.text = devices.label || `Camera ${videoSelect.length + 1}`;
//       videoSelect.appendChild(option);
//     }
//   });
//     //populateDeviceOptions(devices);
//   } catch (error) {
//     handleError(error);
//     console.log('Error accessing media devices. Ensure permissions are granted.');
//   }
// }

function handleDeviceSelection(type) {
  if (type === 'video') {
    const selectedVideoId = videoSelect.value;
    if (selectedVideoId) getVideoStream(selectedVideoId);
    else stopVideoStream();
  } else if (type === 'audio') {
    const selectedAudioId = audioSelect.value;
    if (selectedAudioId) getAudioStream(selectedAudioId);
    else stopAudioStream();
  }
}

// function populateDeviceOptions(deviceInfos) {
//   deviceInfos.forEach(deviceInfo => {
//     if (deviceInfo.deviceId === 'default') return;

//     const option = document.createElement('option');
//     option.value = deviceInfo.deviceId;

//     if (deviceInfo.kind === 'audioinput') {
//       option.text = deviceInfo.label || `Microphone ${audioSelect.length + 1}`;
//       audioSelect.appendChild(option);
//     } else if (deviceInfo.kind === 'videoinput') {
//       option.text = deviceInfo.label || `Camera ${videoSelect.length + 1}`;
//       videoSelect.appendChild(option);
//     }
//   });
// }

function stopVideoStream() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (videoElement.srcObject) {
    videoElement.srcObject = null;
  }
  videoElement.classList.add("fadeout");
}

function stopAudioStream() {
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  if (audioElement.srcObject) {
    audioElement.srcObject = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (volumeMeterEl) {
    volumeMeterEl.style.height = '0px';
  }

  analyserNode = null;
  mediaStreamAudioSourceNode = null;
}

function getVideoStream(deviceId) {
  stopVideoStream();
  const constraints = { video: { deviceId: { exact: deviceId } } };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      videoStream = stream;
      videoElement.srcObject = stream;
      videoElement.classList.remove("fadeout");
      videoSelect.value = deviceId;
    })
    .catch(handleError);
}

function getAudioStream(deviceId) {
  stopAudioStream();
  const constraints = { audio: { deviceId: { exact: deviceId } } };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      audioStream = stream;
      audioSelect.value = deviceId;

      startAudioMeter(stream);
    })
    .catch(handleError);
}

function startAudioMeter(stream) {
  if (!stream.getAudioTracks().length) return;

  audioContext = new AudioContext();
  mediaStreamAudioSourceNode = audioContext.createMediaStreamSource(stream);
  analyserNode = audioContext.createAnalyser();

  mediaStreamAudioSourceNode.connect(analyserNode);

  const pcmData = new Float32Array(analyserNode.fftSize);
  let currentMeterValue = 0;
  const attack = 0.1;
  const decay = 0.95;
  const scaleFactor = 1000;

  const onFrame = () => {
    analyserNode.getFloatTimeDomainData(pcmData);
    const sumSquares = pcmData.reduce((sum, amp) => sum + amp * amp, 0);
    const instantValue = Math.sqrt(sumSquares / pcmData.length);

    currentMeterValue = instantValue > currentMeterValue
      ? currentMeterValue + (instantValue - currentMeterValue) * attack
      : currentMeterValue * decay;

    if (volumeMeterEl) {
      volumeMeterEl.style.height = `${currentMeterValue * scaleFactor}px`;
    }

    animationFrameId = requestAnimationFrame(onFrame);
  };

  animationFrameId = requestAnimationFrame(onFrame);
}

function handleError(error) {
  console.error('Media error:', error);
}
