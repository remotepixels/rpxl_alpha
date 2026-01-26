//used to reset setttings dialog to previous values on open for host
async function restoreSettingsHost() {
	const previousSettingsJSON = localStorage.getItem(APP_NS);
	if (!previousSettingsJSON) return;

	const settings = JSON.parse(previousSettingsJSON);
	const entry = settings && settings[0];
	if (!entry) return;

	if (entry.resolution === "1080") document.getElementById("res1080P").checked = true;
	if (entry.resolution === "720") document.getElementById("res720P").checked = true;

	if (entry.quality === "high") document.getElementById("qualityHigh").checked = true;
	if (entry.quality === "med") document.getElementById("qualityMed").checked = true;
	if (entry.quality === "low") document.getElementById("qualityLow").checked = true;

	restoreDeviceSelection("videoSource", entry.videoSource);
	restoreDeviceSelection("audioSource", entry.audioSource);
	restoreDeviceSelection("cameraSource", entry.cameraSource);
	restoreDeviceSelection("microphoneSource", entry.microphoneSource);

	const name = document.getElementById("name");
	const savedName = decodeURIComponent(entry.userName);
	if (name && savedName != "(Host)") name.value = savedName;
}

//used to reset setttings dialog to previous values on open for client
async function restoreSettingsClient() {
	const previousSettingsJSON = localStorage.getItem(APP_NS);
	if (!previousSettingsJSON) return;

	const settings = JSON.parse(previousSettingsJSON);
	const entry = settings && settings[0];
	if (!entry) return;

	restoreDeviceSelection("cameraSource", entry.cameraSource);
	restoreDeviceSelection("microphoneSource", entry.microphoneSource);

	const name = document.getElementById("name");
	if (name) name.value = decodeURIComponent(entry.userName);
}

//selects the correct devices in the dropdowns based on saved device ids
async function restoreDeviceSelection(selectId, savedDeviceId) {
	const select = document.getElementById(selectId);
	if (!select) return;

	select.value = savedDeviceId;

	//fallback to "none" or first
	if (select.value !== savedDeviceId) {
		if (select.querySelector('option[value="none"]')) {
			select.value = "none";
		} else if (select.querySelector('option[value=""]')) {
			select.value = "";
		} else {
			select.selectedIndex = 0;
		}
	}
}

//store session settings to localStorage
function storeSelectedDevicesSession() {
	const sessionsJSON = localStorage.getItem(APP_NS);
	if (!sessionsJSON) return;

	const sessions = JSON.parse(sessionsJSON);
	if (sessions.length === 0) return;

	const latest = sessions[0]; // do NOT replace timestamp or sessionID

	const projectInput = document.getElementById("project");
	const video = document.getElementById("videoSource");
	const audio = document.getElementById("audioSource");

	const merged = updateSessionEntry(latest, {
		projectName: encodeURIComponent(projectInput.value.trim() || ""),
		resolution: getCheckedRadioValue("resolution") || "720",
		quality: getCheckedRadioValue("quality") || "med",
		videoSource: video.selectedOptions[0].value || "",
		audioSource: audio.selectedOptions[0].value || "",
	});

	sessions[0] = merged;
	localStorage.setItem(APP_NS, JSON.stringify(sessions));
}

//store user settings to localStorage
function storeSelectedDevicesUser() {
	const sessionsJSON = localStorage.getItem(APP_NS);
	if (!sessionsJSON) return;

	const sessions = JSON.parse(sessionsJSON);
	if (sessions.length === 0) return;

	const latest = sessions[0]; // do NOT replace timestamp or sessionID

	const sanitizedUserName = encodeURIComponent(document.getElementById("name").value.trim());
	const camera = document.getElementById("cameraSource");
	const microphone = document.getElementById("microphoneSource");

	const merged = updateSessionEntry(latest, {
		userName: sanitizedUserName || "",
		cameraSource: camera.selectedOptions[0].value || "",
		microphoneSource: microphone.selectedOptions[0].value || "",
	});

	sessions[0] = merged;
	localStorage.setItem(APP_NS, JSON.stringify(sessions));
}
//used if user changes any settings during a session
function updateSessionEntry(baseEntry, updates) {
	return { ...baseEntry, ...updates };
}
