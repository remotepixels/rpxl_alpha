function randomBG () {
    // Detect dark mode preference
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const numberArrayBG = Array.from({ length: 6 }, (_, i) => String(i).padStart(3, '0'));
    const randomBG = numberArrayBG[Math.floor(Math.random() * numberArrayBG.length)];
    const theme = isDarkMode ? 'dark' : 'light';
    const imageUrl = `/backgrounds/${theme}_${randomBG}.jpg`;

    document.body.style.backgroundImage = `url('${imageUrl}')`;
}

//check quality and resolution radio buttons
function getCheckedRadioValue(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : null;
}

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
        resolution: getCheckedRadioValue("resolution") || "",
        quality: getCheckedRadioValue("quality") || "",
        videoSource: video.selectedOptions[0].value || "",
        audioSource: audio.selectedOptions[0].value || "",
    });

    sessions[0] = merged;
    localStorage.setItem(APP_NS, JSON.stringify(sessions));
}

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

function updateSessionEntry(baseEntry, updates) {
    return { ...baseEntry, ...updates };
}

function deactivateUserTools() {
    closeDialog(settingsDialog, toolSettings);

    const toolConfig = {
        toolMuteMicrophone: { icon: "mic" },
        toolMuteCamera:     { icon: "photo_camera" }
    };

    document.querySelectorAll(".tool").forEach(tool => {
        const cfg = toolConfig[tool.id];
        if (!cfg) return; // skip tools we don't care about

        tool.disabled = true;
        tool.classList.add("disable");
                tool.classList.add("hidden");
        tool.classList.remove("selected", "selectedred");
        tool.setAttribute("aria-expanded", "false");
        tool.lastElementChild.textContent = cfg.icon;
    });

    // close all open dialogs
    document.querySelectorAll("dialog:not(.hidden)").forEach(modal => {
        modal.classList.add("hidden");
        modal.close();
    });
}

function reactivateUserTools() {
    const cameraSource = document.getElementById("cameraSource").value;
    const microphoneSource = document.getElementById("microphoneSource").value;

    const enableMap = {
        toolMuteMicrophone: microphoneSource !== "",
        toolMuteCamera: cameraSource !== ""
    };

    document.querySelectorAll(".tool").forEach(tool => {
        if (enableMap[tool.id]) {
            tool.disabled = false;
            tool.classList.remove("disable");
            tool.classList.remove("hidden");
        }
    });
}

async function restoreSettingsHost() {
    const previousSettingsJSON = localStorage.getItem(APP_NS);
    const settings = JSON.parse(previousSettingsJSON);
    const entry = settings[0];

    // --- Resolution ---
    if (document.getElementById("res1080P")) {
        document.getElementById("res1080P").checked = entry.resolution === "0";
        document.getElementById("res720P").checked = entry.resolution !== "0";
    }

    // --- Quality ---
    const qualityMap = {
        "16000": "qualityHigh",
        "8000": "qualityMed",
        "4000": "qualityLow"
    };

    Object.values(qualityMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    const q = document.getElementById(qualityMap[entry.quality]);
    if (q) q.checked = true;

    // --- Devices ---
    restoreDeviceSelection("videoSource", entry.videoSource);
    restoreDeviceSelection("audioSource", entry.audioSource);
    restoreDeviceSelection("cameraSource", entry.cameraSource);
    restoreDeviceSelection("microphoneSource", entry.microphoneSource);

    // --- Username ---
    const name = document.getElementById("name");
    if (name) name.value = decodeURIComponent(entry.userName);

    // --- Trigger media logic if available ---
    if (typeof handleSelectionChange === "function") {
        await handleSelectionChange();
    }
}

async function restoreSettingsClient() {
    const previousSettingsJSON = localStorage.getItem(APP_NS);
    const settings = JSON.parse(previousSettingsJSON);
    const entry = settings[0];

    restoreDeviceSelection("cameraSource", entry.cameraSource);
    restoreDeviceSelection("microphoneSource", entry.microphoneSource);

    // --- Username ---
    const name = document.getElementById("name");
    if (name) name.value = decodeURIComponent(entry.userName);

    // --- Trigger media logic if available ---
    if (typeof handleSelectionChange === "function") {
        await handleSelectionChange();
    }
}

function restoreDeviceSelection(selectId, savedDeviceId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.value = savedDeviceId;

    // If it did NOT exist, fallback to "none" or first
    if (select.value !== savedDeviceId) {
        if (select.querySelector('option[value="none"]')) {
            select.value = "none";
        } else if (select.querySelector('option[value=""]')) {
            select.value = "";
        } else {
            select.selectedIndex = 0;
        }
    }
     handleSelectionChange()
}