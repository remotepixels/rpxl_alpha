
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
const videoSelect = document.getElementById("videoSource");
const audioSelect = document.getElementById("audioSource");
const cameraSelect = document.getElementById("cameraSource");
const microphoneSelect = document.getElementById("microphoneSource");
var videoElement = document.querySelector('video#camera');
var audioElement = document.querySelector('audio#microphone');

console.log("Video select :", videoSelect);
console.log("Audio select :", audioSelect);
console.log("Camera select :", cameraSelect);
console.log("Microphone select :", microphoneSelect);

navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      //console.log("Audio / Video devices found :", devices);
      // populte drop down boxes with devices;
      devices.forEach(device => {
        //if (device.deviceId === 'default') return; //ignore defailt device
        const option = document.createElement('option');
        option.value = device.deviceId;

        if (device.kind === 'audioinput') {
          option.text = device.label || `Microphone ${microphoneSource.length + 1}`;
          microphoneSource.appendChild(option);
          } else if (device.kind === 'videoinput') {
            option.text = device.label || `Camera ${cameraSource.length + 1}`;
            cameraSource.appendChild(option);
          }
        });

        //duplicate sources in to video and audio source dropdowns for stream if we're on that page shit way of doing it but couldn't get it to work otherwise
        if (videoSelect && audioSelect) {
          var select1 = document.getElementById("cameraSource");
          var options = select1.innerHTML 
          var select2 = document.getElementById("videoSource");
          select2.innerHTML = options
          var select1 = document.getElementById("microphoneSource");
          var options = select1.innerHTML
          var select2 = document.getElementById("audioSource");
          select2.innerHTML = options
        }
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
