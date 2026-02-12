
//play beep on connect
function playBeep(freq = 880, duration = 0.15) {
	const ctx = new (window.AudioContext || window.webkitAudioContext)();
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();

	osc.type = "sine";
	osc.frequency.value = freq;
	osc.connect(gain);
	gain.connect(ctx.destination);

	osc.start();

	gain.gain.setValueAtTime(0.2, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

	osc.stop(ctx.currentTime + duration);
}

//INTERFACE

//SHARE BUTTON
shareBtn.addEventListener('pointerdown', () => {
	navigator.clipboard.writeText(`${devURL}/snd/?SID=${mainRoom}`);
	popupBG.classList.remove("hidden");
	popupClipboard.classList.remove("hidden");
	shareBtn.classList.add("selected");
});
//hidden bg element to hide share menu
popupBG.addEventListener("pointerdown", function (event) {
	if (event.target.matches("#popupBG")) {
		if (!popupClipboard.classList.contains("hidden")) popupClipboard.classList.add("hidden");
		if (!popupWaitingList.classList.contains("hidden")) popupWaitingList.classList.add("hidden");
		popupBG.classList.add("hidden");
		waitingButton.classList.remove("selected");
		shareBtn.classList.remove("selected");
	}
});

//SHOW LOG WINDOW
logBtn.addEventListener('pointerdown', () => {
	document.getElementById('log').classList.toggle('hidden');
	logBtn.classList.toggle('selected');
});

// FILTER FILES - ALL
document.getElementById('filterAll').addEventListener('click', () => {
	currentFilter = 'all';
	setActiveButton('.filterSet', 'filterAll');
	debouncedRerender();
});
// Filter - local
document.getElementById('filterLocal').addEventListener('click', () => {
	currentFilter = 'local';
	setActiveButton('.filterSet', 'filterLocal');
	debouncedRerender();
});
// Filter - remote
document.getElementById('filterRemote').addEventListener('click', () => {
	currentFilter = 'remote';
	setActiveButton('.filterSet', 'filterRemote');
	debouncedRerender();
});

// SORT FILES - LATEST
document.getElementById('sortByTime').addEventListener('click', () => {
	currentSort = 'latest';
	setActiveButton('.sortSet', 'sortByTime');
	rerenderFileTree();
});
// Sort - name
document.getElementById('sortByName').addEventListener('click', () => {
	currentSort = 'name';
	setActiveButton('.sortSet', 'sortByName');
	rerenderFileTree();
});
//SET BUTTON HIGHLIGHT FOR SORT / FILTER
function setActiveButton(groupSelector, activeId) {
	document.querySelectorAll(groupSelector + ' .subTool').forEach(btn => {
		btn.classList.toggle('active', btn.id === activeId);
	});
}

//DRAG AND DROP AND FILE ADDING HANDLING
addBtn.addEventListener("click", () => {
	filePicker.click();
});
// Always handle picking files on both desktop + mobile
filePicker.addEventListener("change", (event) => {
	const files = event.target.files;
	const dropId = randomID(8);

	for (let i = 0; i < files.length; i++) {
		const file = files[i];

		let relativePath;
		if (file.webkitRelativePath && file.webkitRelativePath !== "") {
			relativePath = file.webkitRelativePath;
		} else {
			relativePath = file.name;
		}

		file.relativePath = `${dropId}/${relativePath}`;
		if (!isHiddenFile(file)) addFile(file);
	}

	if (firstInteraction === true) {
		createVDOroom();
		if (waitingRoom) createVDOwaitingRoom();

		document.getElementById('dropArea').classList.add('hidden');
		document.getElementById('joinShareDialog').style.display = "none";
		document.getElementById('helpIcon').style.display = "none";
		document.getElementById('topmenu').classList.remove('hidden');
		document.getElementById('subToolBar').classList.remove('hidden');
		document.getElementById('dragDropMessage').textContent = "Drop to add files"
		document.getElementById('dragDropSubMessage').textContent = ""

		firstInteraction = false;
	}
});
//check if desktop, set up drag and drop UI
function checkMobile() {
	const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

	if (!isMobile) {
		//set for desktop (folders and drag drop)
		filePicker.setAttribute('webkitdirectory', "");
		filePicker.setAttribute('directory', "");

		dropArea.addEventListener('click', () => {
			if (!firstInteraction) return;
			filePicker.click();
		});

		const dropOverlay = document.getElementById('dropArea');
		let dragCounter = 0; // helps handle nested dragenter/dragleave events

		window.addEventListener('dragenter', (e) => {
			e.preventDefault();
			dragCounter++;
			dropOverlay.classList.add('dragover');
		});

		window.addEventListener('dragleave', (e) => {
			e.preventDefault();
			dragCounter--;
			if (dragCounter === 0) dropOverlay.classList.remove('dragover');
		});

		window.addEventListener('dragover', (e) => {
			e.preventDefault();
		});

		window.addEventListener('drop', (e) => {
			e.preventDefault();
			dragCounter = 0;
			dropOverlay.classList.remove('dragover');
		});

		dropArea.addEventListener('drop', async (e) => {
			e.preventDefault();
			const dropId = randomID(8);

			const items = e.dataTransfer.items;
			if (!items) return handleFileList(e.dataTransfer.files);

			if (firstInteraction === true) {
				createVDOroom();
				if (waitingRoom) createVDOwaitingRoom();

				document.getElementById('dropArea').classList.add('hidden');
				document.getElementById('helpIcon').style.display = "none";
				document.getElementById('joinShareDialog').style.display = "none";
				document.getElementById('topmenu').classList.remove('hidden');
				document.getElementById('subToolBar').classList.remove('hidden');
				document.getElementById('dragDropMessage').textContent = "Drop to add files"
				document.getElementById('dragDropSubMessage').textContent = ""

				firstInteraction = false;
			}
			const promises = [];    // Process all top-level entries concurrently

			for (let i = 0; i < items.length; i++) {
				const it = items[i];
				const entry = it.webkitGetAsEntry && it.webkitGetAsEntry();
				if (!entry) {
					if (it.getAsFile) addFile(it.getAsFile());
					continue;
				}

				if (entry.isDirectory) {
					promises.push(readDirectory(entry, '', dropId));
				} else if (entry.isFile) {
					// Wrap entry.file in a promise so we can await it
					promises.push(new Promise(resolve => entry.file(file => {
						addFile(file);
						resolve();
					})));
				}
			}

			await Promise.all(promises);  // Wait for all top-level items to finish
		});
	} else {
		//if mobile only allow multiple files and not folders ---- not sure this works
		filePicker.removeAttribute('webkitdirectory');
		filePicker.removeAttribute('directory');

		dropArea.classList.add('hidden');
		dropArea.style.display = "none";

		document.getElementById('topmenu').classList.remove('hidden');
		document.getElementById('subToolBar').classList.remove('hidden');
	}
}
checkMobile();

function renderWaitingPeers() {
	const container = document.getElementById("popupWaitingList");
	container.innerHTML = "";

	for (const [uuid, ts] of waitingPeers) {
		const row = document.createElement("div");
		row.className = "waitingList";
		row.dataset.uuid = uuid;

		const uuidDiv = document.createElement("div");
		uuidDiv.className = "waitingUUID";
		uuidDiv.textContent = uuid;

		const timeDiv = document.createElement("div");
		timeDiv.className = "waitingTime";
		timeDiv.textContent = formatTime(ts);

		const allowDiv = document.createElement("div");
		allowDiv.className = "waitingAllow";
		allowDiv.innerHTML = `<span class="material-symbols-outlined">check_circle</span>`;

		allowDiv.onclick = () => allowWaitingPeer(uuid);

		row.append(uuidDiv, timeDiv, allowDiv);
		container.appendChild(row);
	}

	const total = waitingPeers.size;

	waitingList.textContent = total === 0 ? "(0)" : `(${total})`;

	if (total) {
		waitingButton.style.animation = "pulse 1000ms";
		setTimeout(() => waitingButton.style.animation = "none", 1000);
	}

	// updateWaitingCount();
}

function allowWaitingPeer(uuid) {
	vdoWR.sendData({
		dataType: "migrate",
		roomid: mainRoom,
		target: uuid
	}, uuid);

	log("migrating peer ", uuid, "to main room, will join with new UUID")
}

//SEND FILE LIST TO USER WHEN THEY CONNECT (AFTER. SHORT DELAY)
async function handleGuestJoin(guestUUID) {
	let logOnce = false;
	loadingEl.classList.remove('hidden');
	await sleep(500);    // delay to ensure the peer connection is ready

	const ids = Object.keys(files);

	if (ids.length === 0) {
		log('No files to send.');
		return;
	}

	//only send local files
	for (const id of ids) {
		const meta = files[id];
		if (meta.uploadedBy == 'local') {
			sendToPeer(guestUUID, "file-announce", meta);
			if (logOnce === false) {
				log(`Sending list of ${ids.length} files to new guest ${guestUUID}...`);
				logOnce = true;
			}
		}
	}
	// Optionally wait for all announcements to process
	await sleep(500 * ids.length); // small buffer for debounced rendering
	loadingEl.classList.add('hidden');    // Hide loading message once file list is rendered
}

//UPDATE THE CONNECTED PEERS COUNT IN UI
function updatePeersUI() {
	const total = Object.keys(connectedPeers).length;

	peersList.textContent = total === 0
		? '(0)'
		: `(${total})`;
}

//REMOVE ANY FILES THE PEER HAS UPLOADED IF THEY DISCONNECT
function removePeerFiles(peerUUID) {
	// Collect IDs of files uploaded by the disconnected peer
	const toRemove = Object.values(files)
		.filter(f => f.uploadedBy === peerUUID)
		.map(f => f.id);

	for (const id of toRemove) {
		const fileMeta = files[id];
		const folderPath = fileMeta.folderPath; // save for cleanup
		delete files[id];      // Remove from files object

		// Remove from DOM
		const fileDiv = document.getElementById(`data-${id}`);
		if (fileDiv) fileDiv.remove();

		cleanupEmptyFolders(folderPath);
	}
}

//PROCESS SINGLE FILE ENTRY 
function readFileEntry(fileEntry, path = '', dropId) {
	return new Promise((resolve, reject) => {
		fileEntry.file(file => {
			if (!file) return resolve();

			file.relativePath = `${dropId}/${path}${file.name}`;

			if (!isHiddenFile(file)) addFile(file);
			resolve();
		}, reject);
	});
}

//READ DIRECTORY 
async function readDirectory(dirEntry, path = '', dropId) {
	const reader = dirEntry.createReader();
	const readEntries = () => new Promise(res => reader.readEntries(res));

	let entries = await readEntries();

	while (entries.length) {
		for (const e of entries) {
			if (e.isDirectory && !e.name.startsWith('.')) {
				await readDirectory(e, path + dirEntry.name + '/', dropId);
			}
			else if (e.isFile) {
				await readFileEntry(e, path + dirEntry.name + '/', dropId);
			}
		}
		entries = await readEntries();
	}
}

//HANDLE FILE LIST (fallback)
function handleFileList(list) {
	for (let i = 0; i < list.length; i++) {
		const file = list[i];
		if (!isHiddenFile(file)) addFile(file);
		else log(`Skipping hidden file: ${file.name}`);
	}
}

//HIDDEN FILE FILTER 
function isHiddenFile(pathOrFile) {
	let path = "";

	if (typeof pathOrFile === "string") path = pathOrFile;
	else if (pathOrFile.webkitRelativePath) path = pathOrFile.webkitRelativePath;
	else if (pathOrFile.relativePath) path = pathOrFile.relativePath;
	else path = pathOrFile.name || "";

	if (!path) return true;

	return path.split('/').some(part => part.startsWith('.') && part.length > 1);
}

//ADD FILE 
function addFile(file) {
	if (!file) return;

	const id = randomID(8);
	const relativePath = file.relativePath || file.name;
	const pathParts = relativePath.split('/');
	const name = pathParts.pop();
	const folderPath = pathParts.join('/');

	const timestamp = Date.now();

	const meta = {
		id,
		name,
		size: file.size,
		folderPath,
		uploadedBy: 'local',
		lastModified: file.lastModified,
		timestamp,
		file
	};

	files[id] = meta;

	debouncedRerender();
	log(`Added: ${relativePath} (${formatBytes(file.size)})`);

	sendBroadcast("file-announce", {
		id,
		name,
		size: meta.size,
		folderPath,
		timestamp
	});
}

//SEND CONTROL MESSAGES (NOT DATA, FILE ADDED/REMOVED, FILE REQUESTS ETC)
//SEND TO SPECIFIC PEER (STREAMID)
function sendToPeer(targetUUID, dataType, payload = {}) {
	const total = Object.keys(connectedPeers).length;
	if (total === 0) return; // only send if peers connected
	vdo.sendData({
		dataType,
		payload
	}, targetUUID)
	//console.warn("sendToPeer dataType", dataType, "to", targetUUID, "payload", payload);
}

//BROADCAST TO ALL PEERS (connects, disconnects, adding or removing files)
function sendBroadcast(dataType, payload = {}) {
	const total = Object.keys(connectedPeers).length;
	if (total === 0) return; // only send if peers connected
	vdo.sendData({
		dataType,
		payload
	});
	//console.warn("broadcast", dataType);
}

//SORT FILES BY LATEST (DEFAULT) OR NAME
//stops sort operation running to often
function debounce(fn, delay) {
	let timer = null;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
}

//SORTS FILE TREE BY DATE/NAME LOCAL/REMOTE OR ALL
function rerenderFileTree() {
	const treeRoot = document.getElementById('fileList');

	//Save folder state (open / closed)
	for (const path in folderMap) {
		const folderDiv = folderMap[path]?.closest('.folder');
		if (!folderDiv) continue;
		const contents = folderDiv.querySelector('.folder-contents');
		//folderState[path] = contents && contents.style.display !== 'none';
		folderState[path] = contents.classList.contains('open');
	}

	//Clear tree
	treeRoot.innerHTML = '';
	folderMap = {};

	//Sort latest / name
	const fileArray = Object.values(files);

	if (currentSort === 'name') {
		fileArray.sort((a, b) => a.name.localeCompare(b.name));
	} else {
		fileArray.sort((a, b) => b.timestamp - a.timestamp);
	}
	//Apply filter all / local / remote
	let filtered = fileArray;

	if (currentFilter === 'local') {
		filtered = filtered.filter(f => f.uploadedBy === 'local');
	}
	else if (currentFilter === 'remote') {
		filtered = filtered.filter(f => f.uploadedBy !== 'local');
	}

	//Rebuild
	for (const f of filtered) {
		renderTreeItem(f);
	}

	//re-apply state (open / closed)
	for (const path in folderState) {
		const contents = folderMap[path];
		if (!contents) continue;

		if (folderState[path]) {
			contents.classList.add('open');
		} else {
			contents.classList.remove('open');
		}
	}
}

//RENDERS FILE TREE
function renderTreeItem(f) {
	const isReceiver = f.uploadedBy !== 'local'; //render in blue with download button for remote

	const treeRoot = document.getElementById('fileList');
	const pathParts = f.folderPath ? f.folderPath.split('/') : [];
	const displayParts = [...pathParts];
	let currentContainer = treeRoot;
	let currentPath = '';
	// let logicalPath = '';
	if (/^[0-9a-f-]{36}$/.test(displayParts[0])) {
		displayParts.shift();
	}

	for (let depth = 0; depth < pathParts.length; depth++) {
		const part = pathParts[depth];
		currentPath = currentPath ? `${currentPath}/${part}` : part;

		if (!folderMap[currentPath]) {
			const folderDiv = document.createElement('div');
			folderDiv.className = 'folder ' + (isReceiver ? 'remote' : 'local');
			folderDiv.dataset.path = currentPath;

			// Apply indentation, 20px per level
			folderDiv.style.marginLeft = `${depth * 20}px`;

			const iconType = isReceiver ? 'folder-download' : 'folder-delete';
			const iconLabel = isReceiver ? 'download' : 'delete';

			folderDiv.innerHTML = `
        <div class="folder-header" data-folder="${currentPath}">
          <span class="material-symbols-outlined folder-icon">folder</span>
          <strong class="folder-text">${escapeHtml(part)}</strong>
          <span class="material-symbols-outlined ${iconType}">${iconLabel}</span>
        </div>
        <div class="folder-contents"></div>
      `;
			if (depth == 0) continue; // do not render the dropID

			currentContainer.appendChild(folderDiv);
			folderMap[currentPath] = folderDiv.querySelector('.folder-contents');

			// Expand/collapse folder
			folderDiv.querySelector('.folder-header').addEventListener('pointerdown', (e) => {
				if (e.target.classList.contains(iconType)) return;
				const contents = folderDiv.querySelector('.folder-contents');
				contents.classList.toggle('open');
				folderState[currentPath] = contents.classList.contains('open');
			});

			// Folder action
			folderDiv.querySelector(`.${iconType}`).addEventListener('pointerdown', async (e) => {
				e.stopPropagation();
				const folderPath = e.target.closest('.folder-header').dataset.folder;
				if (isReceiver) {
					requestDownload(folderPath, true);
				} else {
					if (confirm(`Remove entire directory "${folderPath}" and all its files from share?`)) {
						await deleteDirectory(folderPath);
						sendDirectoryRemoved(folderPath);
					}
				}
			});
		}
		currentContainer = folderMap[currentPath];
	}

	// Create file entry
	const fileDiv = document.createElement('div');
	fileDiv.className = 'file-item ' + (isReceiver ? 'remote' : 'local');
	fileDiv.id = `data-${f.id}`;
	fileDiv.dataset.id = f.id;
	//style object
	Object.assign(fileDiv.style, { display: 'flex', justifyContent: "space-between", alignItems: "center", padding: "2px 10px", marginLeft: `${pathParts.length}px` })

	const fileIconClass = isReceiver ? 'file-download' : 'file-delete';
	const fileIconLabel = isReceiver ? 'download' : 'delete';

	fileDiv.innerHTML = `
    <span class="file-name">${escapeHtml(f.name)}</span>
    <span class="file-size">${formatBytes(f.size)}</span>
    <span class="file-icon-container" id="icon-container_${f.id}">
      <span class="material-symbols-outlined ${fileIconClass}" id="${f.id}_icon">${fileIconLabel}</span>
    </span>
  `;

	currentContainer.appendChild(fileDiv);

	// File action default
	fileDiv.querySelector(`.${fileIconClass}`).addEventListener('pointerdown', async (e) => {
		e.stopPropagation();
		if (isReceiver) {
			requestDownload(f.id, false);
		} else {
			deleteFile(f.id);
		}
	});

	const state = getUIState(f.id);

	// dead
	if (state.dead) {
		fileDiv.classList.add("file-dead");
	}

	// downloading
	if (state.downloading) {
		createFileProgressUI(f.id);
		updateFileProgressUI(f.id, state.progress);
	}

	// completed
	if (state.completed) {
		markDownloadCompleted(f.id);
	}

}

//RESTORES STATE OF FILES (DL PROGRESS, FOLDER OPEN/CLOSE)
function getUIState(id) {
	if (!fileUIState.has(id)) {
		fileUIState.set(id, {
			dead: false,
			downloading: false,
			progress: 0,
			completed: false
		});
	}
	return fileUIState.get(id);
}

//FILE AND FOLDER DELETES
function removeElementWithFade(el) {
	return new Promise((resolve) => {
		if (!el) return resolve(); // nothing to remove

		el.offsetHeight;       // Trigger reflow so transition always runs
		el.classList.add('fade-slide-out');

		el.addEventListener('transitionend', () => {
			if (el.parentNode) el.parentNode.removeChild(el);
			resolve(); // resolve after removal
		}, { once: true });

		// Fallback in case transitionend doesn't fire
		setTimeout(() => {
			if (el.parentNode) el.parentNode.removeChild(el);
			resolve();
		}, 500); // CSS transition duration
	});
}

//REMOVE DIRECTORY(S)
async function deleteDirectory(path) {
	if (!path) return;
	log(`Deleting directory: ${path}`);

	// Find all file IDs inside that folder (recursively)
	const toDelete = Object.keys(files).filter(id =>
		files[id].folderPath.startsWith(path)
	);

	// Delete contained files
	for (const id of toDelete) {
		const el = document.querySelector(`.file-item[data-id="${id}"]`);
		removeElementWithFade(el);
		await announceFileRemoved(id, path);
		delete files[id];
	}

	// Remove the folder DOM
	const folderDiv = document.querySelector(`.folder[data-path="${path}"]`);
	if (folderDiv) folderDiv.remove();

	delete folderMap[path];    // Remove from folderMap
	await sendDirectoryRemoved(path);    //announce directory removal to peers
	cleanupEmptyFolders(path);    //clean any now-empty parents
}

//ANNOUNCE DIRECTORY REMOVAL TO ALL PEERS
async function sendDirectoryRemoved(path, targetUUID = null) {
	const peerKeys = Object.keys(connectedPeers);
	if (peerKeys.length === 0) return;      //console.log("No connected guests");

	sendBroadcast("directory-removed", { path });
	log(`Announced directory removal: ${path}`);
}

//REMOVE FILE FROM DOM
async function deleteFile(id) {
	const file = files[id];
	if (!file) return;

	const folderPath = file.folderPath || '';
	delete files[id];
	const el = document.querySelector(`.file-item[data-id="${id}"]`);

	if (el) await removeElementWithFade(el);

	log(`Deleted file : / ${folderPath} / ${file.name}`);
	cleanupEmptyFolders(folderPath);
	await announceFileRemoved(id, folderPath);
}

//ANNOUNCE FILE REMOVAL TO ALL PEERS
async function announceFileRemoved(id, path) {
	const total = Object.keys(connectedPeers).length;
	if (total == 0) return;

	sendBroadcast("file-removed", { id });
	log(`Announced file removal : `, files[id]);
}

//CLEANUP AND REMOVE ANY EMPTY FOLDERS
function cleanupEmptyFolders(startPath = null) {
	function isEmptyFolder(folderDiv) {
		const contents = folderDiv.querySelector('.folder-contents');
		if (!contents) return true;

		// Check if contents has any visible file-items or folder divs
		const children = Array.from(contents.children).filter(
			el => el.classList.contains('file-item') || el.classList.contains('folder')
		);

		return children.length === 0;
	}

	if (startPath) {
		let parts = startPath.split('/');
		while (parts.length > 0) {
			const path = parts.join('/');
			const folder = document.querySelector(`.folder[data-path="${path}"]`);
			if (folder && isEmptyFolder(folder)) {
				log(`Removing empty folder: ${path}`);
				folder.remove();
				delete folderMap[path];
				sendBroadcast("directory-removed", { path });
			}
			parts.pop(); // move up
		}
	} else {
		const folders = document.querySelectorAll('.folder');
		for (const folder of folders) {
			if (isEmptyFolder(folder)) {
				const path = folder.dataset.path;
				log(`Removing empty folder: ${path}`);
				folder.remove();
				delete folderMap[path];
				// sendBroadcast("directory-removed2", { path });
			}
		}
	}
}

//IF FILE NOT FOUND ON HOST DRIVE WHEN REQUESTED MARK AS DEAD
function markFileDead(fileID) {
	//console.warn("marking file dead");
	const el = document.getElementById(`data-${fileID}`);
	if (!el) return;

	el?.classList.add("file-dead");

	const state = getUIState(fileID);
	state.downloading = false;
	state.progress = 0;
	state.completed = false;
	state.dead = true;
}

//FILE DOWNLOAD UI
const pausedDownloads = new Set(); // holds fileIDs of paused downloads
const incomingFiles = new Map();

function createFileProgressUI(id) {
	const container = document.getElementById(`icon-container_${id}`);
	if (!container) return;

	// Clear previous content and insert progress UI
	container.innerHTML = `
    <div class="roundProgressBarBG">
      <div class="roundProgressBarFill" id="progress-bar-${id}"></div>
      <div class="roundProgressBarCenter">
        <div class="stop-btn" id="stop-btn-${id}">✕</div>
      </div>
    </div>
  `;

	const stopBtn = document.getElementById(`stop-btn-${id}`);
	if (!stopBtn) return;

	Object.assign(stopBtn.style, { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", cursor: "pointer", fontSize: "0.8em", userSelect: "none", opacity: "0.5" });

	stopBtn.addEventListener("pointerdown", () => {
		cancelDownload(id)
		restoreDownloadIcon(id);
	});

	const state = getUIState(id);
	state.downloading = true;
	state.progress = 0;
}

function restoreDownloadIcon(id) {
	const container = document.getElementById(`icon-container_${id}`);
	if (!container) return;

	// Restore original icon
	container.innerHTML = `
    <span class="material-symbols-outlined file-download" id="${id}_icon">download</span>
  `;

	const icon = document.getElementById(`${id}_icon`);
	if (!icon) return;

	// Reattach the normal download behavior
	icon.addEventListener("pointerdown", (e) => {
		e.stopPropagation();
		requestDownload(id, false);
		createFileProgressUI(id);
	});

	const state = getUIState(id);
	state.downloading = false;
	state.progress = 0;
	state.completed = true;
}

function markDownloadCompleted(id) {
	const fileEl = document.getElementById(`icon-container_${id}`);
	if (!fileEl) return;

	const bar = document.getElementById(`progress-bar-${id}`);
	if (bar) bar.style.backgroundImage = `conic-gradient(dodgerblue 0deg, dodgerblue 360deg)`;

	// Replace stop button with ✓ icon (but keep clickable)
	const btn = document.getElementById(`stop-btn-${id}`);
	if (btn) {
		btn.dataset.originalIcon = btn.innerHTML;   // store original
		btn.innerHTML = "✓";                         // completed icon

		// Clicking ✓ restores original download button
		btn.onclick = () => {
			btn.innerHTML = btn.dataset.originalIcon;
			btn.onclick = () => handleFileDownload(id);     // restore original handler
		};
	}

	const state = getUIState(id);
	state.completed = true;
}

function updateFileProgressUI(id, percent) {
	const bar = document.getElementById(`progress-bar-${id}`);
	if (!bar) return; // safely ignore if element removed
	if (pausedDownloads.has(id)) return;

	const pct = Math.max(0, Math.min(100, Number(percent) || 0));
	const deg = pct * 3.6; // 100% -> 360°
	bar.style.backgroundImage = `conic-gradient(dodgerblue ${deg}deg, light-dark(var(--color-light-white), var(--color-dark-grey)) ${deg}deg)`;

	const state = getUIState(id);
	state.progress = pct;
}
