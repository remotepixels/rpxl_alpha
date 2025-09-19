
//check if the user has allowed access to the camera and microphone
//if not show a popup to ask them to allow access

// Put variables in global scope to make them available to the browser console.
//const video = document.querySelector("video");
const constraints = {
  audio: true,
  video: true,
};

//find video and audio sources and populate dropdown boces
//load the sources when selected into the correct preview areas (main or user), make sure that the same sources can not be used twice
const videoSelect = document.querySelector('select#videoSource');
const audioSelect = document.querySelector('select#audioSource');
const cameraSelect = document.querySelector('select#cameraSource');
const microphoneSelect = document.querySelector('select#microphoneSource');
var videoElement = document.querySelector('video#camera');
var audioElement = document.querySelector('audio#microphone');

console.log("Video select :", videoSelect);
console.log("Audio select :", audioSelect);
console.log("Camera select :", cameraSelect);
console.log("Microphone select :", microphoneSelect);

navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      console.log("Audio / Video devices found :", devices);

      devices.forEach(device => {
        //if (device.deviceId === 'default') return; //ignore defailt device

          const option = document.createElement('option');
           option.value = device.deviceId;

          if (device.kind === 'audioinput') {
            if (audioSelect) {               
              option.text = device.label || `Microphone ${audioSelect.length + 1}`;
              audioSelect.appendChild(option);
              }
            option.text = device.label || `Microphone ${microphoneSource.length + 1}`;
            microphoneSource.appendChild(option);

           } else if (device.kind === 'videoinput') {
            if (videoSelect) { 
             option.text = device.label || `Camera ${videoSelect.length + 1}`;
             videoSelect.appendChild(option);
            }
             option.text = device.label || `Camera ${cameraSource.length + 1}`;
             cameraSource.appendChild(option);
           }
       });
    });
  })
  .catch((error) => {
    if (error.name === "OverconstrainedError") {
      console.error(
        `The resolution ${constraints.video.width?.exact || ''}x${constraints.video.height?.exact || ''} px is not supported by your device.`,
      );
    } else if (error.name === "NotAllowedError") {
      permissionsDialog.showModal();
      permissionsDialog.classList.remove('hidden');
      document.getElementById('permissionMicHelp').addEventListener('click', () =>
        window.open('https://support.google.com/chrome/answer/2693767','_blank')
      );

      console.error(
        "You need to grant this page permission to access your camera and microphone.",
      );

    } else {
      console.error(`getUserMedia error: ${error.name}`, error);
    }
  });
