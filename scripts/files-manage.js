//add / remove files
const files = {};
let folderMap = {}; // keeps track of folder DOM nodes


function escapeHtml(s) {
	return String(s).replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
}

function formatBytes(a) {
	if (a === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const e = Math.floor(Math.log(a) / Math.log(1024));
	return (a / Math.pow(1024, e)).toFixed(0) + '' + units[e];
}

//DRAG AND DROP AND FILE ADDING HANDLING
toolAddFile.addEventListener("click", () => {
	toolAddFile.click();
});


// Always handle picking files on both desktop + mobile
toolAddFile.addEventListener("change", (event) => {
	const files = event.target.files;
	const dropId = generateRandomID(8);

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

});

function setupFileDrop()  {
	//set for desktop (folders and drag drop)
	toolAddFile.setAttribute('webkitdirectory', "");
	toolAddFile.setAttribute('directory', "");

	const dropOverlay = document.getElementById('dropArea');

	dropOverlay.classList.remove("hidden");
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
		const dropId = generateRandomID(8);

		const items = e.dataTransfer.items;
		if (!items) return handleFileList(e.dataTransfer.files);

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
		//else log(`Skipping hidden file: ${file.name}`);
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

	const id = generateRandomID(8);
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
	//log(`Added: ${relativePath} (${formatBytes(file.size)})`);

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


//FILE AND FOLDER DELETES
function removeElementWithFade(el) {
	return new Promise((resolve) => {
		if (!el) return resolve(); // nothing to remove

		el.offsetHeight;       // Trigger reflow so transition always runs
		el.classList.add('fade-slide-out');

		el.addEventListener('transitionend', () => {
			if (el.parentNode) el.parentNode.removeChild(el);
			resolve();
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
	//log(`Deleting directory: ${path}`);

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
	//log(`Announced directory removal : ${path}`);
}

//REMOVE FILE FROM DOM
async function deleteFile(id) {
	const file = files[id];
	if (!file) return;

	const folderPath = file.folderPath || '';
	delete files[id];
	const el = document.querySelector(`.file-item[data-id="${id}"]`);

	if (el) await removeElementWithFade(el);

	//log(`Deleted file : / ${folderPath} / ${file.name}`);
	cleanupEmptyFolders(folderPath);
	await announceFileRemoved(id, folderPath);
}

//ANNOUNCE FILE REMOVAL TO ALL PEERS
async function announceFileRemoved(id, path) {
	const total = Object.keys(connectedPeers).length;
	if (total == 0) return;

	sendBroadcast("file-removed", { id });
	//log(`Announced file removal : `, files[id]);
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
				//log(`Removing empty folder: ${path}`);
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
				//log(`Removing empty folder: ${path}`);
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
