
    const mainAudioSelect = document.getElementById('audioSource');
    const mainVideoSelect = document.getElementById('videoSource');
    const userAudioSelect = document.getElementById('microphoneSource');
    const userVideoSelect = document.getElementById('cameraSource');
    const mainPreview = document.getElementById('video');
    const userPreview = document.getElementById('camera');
    const mainVU = document.getElementById('audiometer');
    const userVU = document.getElementById('micmeter');
    const startButton = document.getElementById('start-button');

    let devices = [];
    let mainAudioStream = null, userAudioStream = null;
    let mainVideoStream = null, userVideoStream = null;
    let mainAudioContext, userAudioContext;
    let mainAnalyser, userAnalyser;
    let vuInterval;

    async function getDevices() {
      const permissionStreamer = document.getElementById("permissionsDialogStream");
      const permissionClient = document.getElementById("permissionsDialogClient");

      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (e) {
        if (permissionStreamer) {
          permissionsDialogStream.classList.remove("hidden");
          permissionsDialogStream.show();
          settingsDialog.classList.add("hidden");
          //console.log("Video access was denied.");
        } else {      
          cameraSource.disabled = true; }
      }

      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        if (permissionStreamer) {
          permissionsDialogStream.classList.remove("hidden");
          permissionsDialogStream.show();
          settingsDialog.classList.add("hidden");
          //console.log("Audio access was denied.");
        }
        if (permissionClient && shmeg.classList.contains("hidden")) {
          permissionClient.classList.remove("hidden");
          permissionClient.show();
          permissionIgnore.focus();
          document.getElementById("permissionIgnore").addEventListener("click", function () {
            document.getElementById("permissionsCheck").classList.add("hidden");
          });
          microphoneSource.disabled = true; 
          //console.log("Microphone access was denied.");
        }
      }

      devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const videoInputs = devices.filter(d => d.kind === 'videoinput');

      [mainAudioSelect, userAudioSelect].forEach(sel => sel.innerHTML = '<option value="" selected>None</option>');
      [mainVideoSelect, userVideoSelect].forEach(sel => sel.innerHTML = '<option value="" selected>None</option>');

      audioInputs.forEach(device => {
        if (device.deviceId !== 'default') {
            const option = new Option(device.label || `Microphone ${device.deviceId}`, device.deviceId);
            mainAudioSelect.add(option.cloneNode(true));
            userAudioSelect.add(option.cloneNode(true));
        }
      });

      videoInputs.forEach(device => {
        if (device.deviceId !== 'default') {
            const option = new Option(device.label || `Camera ${device.deviceId}`, device.deviceId);
            mainVideoSelect.add(option.cloneNode(true));
            userVideoSelect.add(option.cloneNode(true));
        }
      });
    }

    function stopStream(stream) {
      if (stream) stream.getTracks().forEach(track => track.stop());
    }

    function setupVU(stream, vuElement, contextHolder, analyserHolder) {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      contextHolder.ctx = audioContext;
      analyserHolder.node = analyser;
    }

    function updateVU(analyser, vuElement) {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
      vuElement.style.height = `${Math.min(avg, 100)}%`;
    }

    async function handleSelectionChange() {
      const selectedMainAudio = mainAudioSelect.value;
      const selectedUserAudio = userAudioSelect.value;
      const selectedMainVideo = mainVideoSelect.value;
      const selectedUserVideo = userVideoSelect.value;

      // Prevent duplicate use of devices
      [mainAudioSelect, userAudioSelect].forEach(sel => {
        Array.from(sel.options).forEach(option => option.disabled = false);
      });
      if (selectedMainAudio) userAudioSelect.querySelector(`option[value="${selectedMainAudio}"]`)?.setAttribute('disabled', true);
      if (selectedUserAudio) mainAudioSelect.querySelector(`option[value="${selectedUserAudio}"]`)?.setAttribute('disabled', true);

      [mainVideoSelect, userVideoSelect].forEach(sel => {
        Array.from(sel.options).forEach(option => option.disabled = false);
      });
      if (selectedMainVideo) userVideoSelect.querySelector(`option[value="${selectedMainVideo}"]`)?.setAttribute('disabled', true);
      if (selectedUserVideo) mainVideoSelect.querySelector(`option[value="${selectedUserVideo}"]`)?.setAttribute('disabled', true);

      // Clean up previous streams
      stopStream(mainAudioStream);
      stopStream(userAudioStream);
      stopStream(mainVideoStream);
      stopStream(userVideoStream);

      if (mainAudioContext?.ctx) mainAudioContext.ctx.close();
      if (userAudioContext?.ctx) userAudioContext.ctx.close();

      // Reset VU
      clearInterval(vuInterval);
      mainVU.style.height = "0%";
      userVU.style.height = "0%";

      // Setup streams again
      if (selectedMainAudio) {
        mainAudioStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedMainAudio } });
        mainAudioContext = {}; mainAnalyser = {};
        setupVU(mainAudioStream, mainVU, mainAudioContext, mainAnalyser);
      }

      if (selectedUserAudio) {
        userAudioStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedUserAudio } });
        userAudioContext = {}; userAnalyser = {};
        setupVU(userAudioStream, userVU, userAudioContext, userAnalyser);
      }

      if (selectedMainVideo) {
        mainVideoStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: selectedMainVideo } });
        mainPreview.srcObject = mainVideoStream;
      } else {
        mainPreview.srcObject = null;
      }

      if (selectedUserVideo) {
        userVideoStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: selectedUserVideo } });
        userPreview.srcObject = userVideoStream;
      } else {
        userPreview.srcObject = null;
      }

      vuInterval = setInterval(() => {
        if (mainAnalyser?.node) updateVU(mainAnalyser.node, mainVU);
        if (userAnalyser?.node) updateVU(userAnalyser.node, userVU);
      }, 10);
    }

    async function stopAll() {
      stopStream(mainAudioStream);
      stopStream(userAudioStream);
      stopStream(mainVideoStream);
      stopStream(userVideoStream);
      mainPreview.srcObject = null;
      userPreview.srcObject = null;
      if (mainAudioContext?.ctx) mainAudioContext.ctx.close();
      if (userAudioContext?.ctx) userAudioContext.ctx.close();
      clearInterval(vuInterval);
      mainVU.style.height = "0%";
      userVU.style.height = "0%";
    }

    // getDevices().then(() => {
    //   [mainAudioSelect, userAudioSelect, mainVideoSelect, userVideoSelect].forEach(sel => {
    //     sel.addEventListener('change', handleSelectionChange);
    //   });
    // });