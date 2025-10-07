//check if the user has allowed access to the camera and microphone
function checkPermissions () {
  //used to ask for video and mic access ()
  const constraints = {
    audio: true,
    video: true,
  };

  //find video and audio sources and populate dropdown boces
  const videoSelect = document.getElementById("videoSource");
  const audioSelect = document.getElementById("audioSource");

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        //populate drop down boxes with every device found, either video or audio
        devices.forEach(device => {
          if (device.deviceId === 'default') return; //ignore default device, meh
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

          //duplicate sources in to video and audio source dropdowns for streaming if we're on that page, shit way of doing this
          if (videoSelect) {
            var select1 = document.getElementById("cameraSource");
            var options = select1.innerHTML 
            var select2 = document.getElementById("videoSource");
            select2.innerHTML = options
          }
          if (audioSelect) {
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
        //popup message if the user has blocked access to microphone or camera
        permissionsDialog.showModal();
        permissionsDialog.classList.remove('hidden');
        shmeg.classList.add('hidden');
        document.getElementById('permissionMicHelp').addEventListener('click', () =>
          window.open('https://www.google.com/search?q=camera+and+microphone+permissions+in+your+browser&client=safari&sca_esv=6df9598451498e66&rls=en&ei=rhjUaNugItzqi-gPuuLioAc&ved=0ahUKEwjbr_as5fGPAxVc9QIHHTqxGHQQ4dUDCBA&oq=camera+and+microphone+permissions+in+your+browser&gs_lp=Egxnd3Mtd2l6LXNlcnAiMWNhbWVyYSBhbmQgbWljcm9waG9uZSBwZXJtaXNzaW9ucyBpbiB5b3VyIGJyb3dzZXJIAFAAWABwAHgBkAEAmAEAoAEAqgEAuAEMyAEAmAIAoAIAmAMAkgcAoAcAsgcAuAcAwgcAyAcA&sclient=gws-wiz-serp','_blank')
        );
        //console.error("You need to grant this page permission to access your camera and microphone.",);
      } else {
        console.error(`getUserMedia error: ${error.name}`, error);
      }
    });
}