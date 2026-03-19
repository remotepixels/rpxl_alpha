let folderState = {}; //tracks which folders are open / closed for sort 
let currentSort = 'latest'; //latest or name
// let currentFilter = 'all'; // values: 'all' | 'local' | 'remote'
const fileUIState = new Map();	//tracks file state downloading / dead / normal / etc.

const debouncedRerender = debounce(rerenderFileTree, 100);

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

	// if (currentFilter === 'local') {
	// 	filtered = filtered.filter(f => f.uploadedBy === 'local');
	// }
	// else if (currentFilter === 'remote') {
	// 	filtered = filtered.filter(f => f.uploadedBy !== 'local');
	// }

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
			folderDiv.style.marginLeft = `${(depth)}px`;

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
					if (confirm(`Remove entire folder "${folderPath.slice(8)}" from share?`)) {
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
	Object.assign(fileDiv.style, { display: 'flex', justifyContent: "space-between", alignItems: "center"})

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

//FILE DOWNLOAD UI
// const pausedDownloads = new Set(); // holds fileIDs of paused downloads
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
			// btn.onclick = () => handleFileDownload(id);     // restore original handler
			btn.onclick = () => restoreDownloadIcon(id);     // restore original handler
		};
	}

	const state = getUIState(id);
	state.completed = true;
}

function updateFileProgressUI(id, percent) {
	const bar = document.getElementById(`progress-bar-${id}`);
	if (!bar) return; // safely ignore if element removed
	// if (pausedDownloads.has(id)) return;

	const pct = Math.max(0, Math.min(100, Number(percent) || 0));
	const deg = pct * 3.6; // 100% -> 360°
	bar.style.backgroundImage = `conic-gradient(dodgerblue ${deg}deg, light-dark(var(--color-light-white), var(--color-dark-grey)) ${deg}deg)`;

	const state = getUIState(id);
	state.progress = pct;
}
