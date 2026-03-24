//DOWNLOAD QUEUE
let downloadQueue = [];        // holds pending fileIDs
let downloadState = new Map();	//tracks state of each file in queue (queued, active, stopped, done)
let activeFileDownloads = 0;     //download queue files currently running
const MAX_PARALLEL_DOWNLOADS = 4; // download queue max concurrent files
// const activeStreamers = new Map();

//add to queue to download
function queueDownload(fileID, host, fromFolder = false) {
	const state = downloadState.get(fileID);

	if (state === "queued" || state === "active") return;

	downloadQueue.push({ fileID, host, fromFolder });
	downloadState.set(fileID, "queued");

	processDownloadQueue();
}

function processDownloadQueue() {
	if (activeFileDownloads >= MAX_PARALLEL_DOWNLOADS) return;

	while (activeFileDownloads < MAX_PARALLEL_DOWNLOADS && downloadQueue.length) {

		const job = downloadQueue.shift();
		const state = downloadState.get(job.fileID);

		if (state !== "queued") continue;

		startFileDownload(job.fileID, job.host, job.fromFolder);
	}
}

function startFileDownload(fileID, host, fromFolder) {
	if (downloadState.get(fileID) === "stopped") return;

	activeFileDownloads++;
	downloadState.set(fileID, "active");

	const meta = files[fileID];
	if (!meta) {
		activeFileDownloads--;
		downloadState.delete(fileID);
		return processDownloadQueue();
	}

	if (fromFolder) meta.fromFolderRequest = true;

	sendToPeer(host, "request-file", {
		id: fileID,
		isFolder: fromFolder
	});

	enableWakeLock();
	console.log(`Requesting file: ${meta.name} - from : ${meta.uploadedBy}`);
}

// Receiver: cancel a download
function cancelDownload(fileID) {
	const wasActive = downloadState.get(fileID) === "active";
	const meta = files[fileID];

	if (meta && meta.uploadedBy) {
		sendAbortAck(fileID);
	}

	downloadQueue = downloadQueue.filter(q => q.fileID !== fileID);    // Remove any queued entries for this file
	downloadState.set(fileID, "stopped");
	incomingFiles.delete(fileID);

	updateFileProgressUI(fileID, 0); // or show cancelled state

	if (wasActive) {
		activeFileDownloads = Math.max(0, activeFileDownloads - 1);
		processDownloadQueue();
	}

}

function sendAbortAck(fileID) {
	if (downloadState.get(fileID) !== "active") return;

	const meta = files[fileID];
	if (!meta || !meta.uploadedBy) return;

	const incoming = incomingFiles.get(fileID);
	if (!incoming || !incoming.total) return;
	if (incoming.completed) return;

	// ACK every chunk index [0 .. total-1]
	const allParts = Array.from({ length: incoming.total }, (_, i) => i);

	console.log("Sending cancel to:", meta.uploadedBy, "for file:", meta.name, "total parts:", allParts.length);

	sendToPeer(meta.uploadedBy, "ACK-chunks", {
		fileID,
		parts: allParts,
		cancelled: true
	});
}
