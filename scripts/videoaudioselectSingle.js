
//check if the user has allowed access to the camera and microphone
//if not show a popup to ask them to allow access
//Microphone access is required but camera access is optional

// ------------------ Permissions ------------------
checkPermissions();

async function checkPermissions() {
    try {
        const [camera, mic] = await Promise.all([
        navigator.permissions.query({ name: 'camera' }),
        navigator.permissions.query({ name: 'microphone' })
        ]);

        if (mic.state !== 'granted' || camera.state !== 'granted') {
            permissionsDialog.showModal();
            permissionsDialog.classList.remove('hidden');
            document.getElementById('permissionMicHelp').addEventListener('click', () =>
                window.open('https://support.google.com/chrome/answer/2693767','_blank') 
            ); 
        }
    } catch (err) {
        console.error('Permission check failed:', err);
    }
}

// ------------------ Video and Audio Selection ------------------
const videoSelect = document.querySelector('select#cameraSource');
const audioSelect = document.querySelector('select#microphoneSource');
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

init();

async function init() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    populateDeviceOptions(devices);
  } catch (error) {
    handleError(error);
  }
}

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

function populateDeviceOptions(deviceInfos) {
  deviceInfos.forEach(deviceInfo => {
    if (deviceInfo.deviceId === 'default') return;

    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;

    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `Microphone ${audioSelect.length + 1}`;
      audioSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `Camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    }
  });
}

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
