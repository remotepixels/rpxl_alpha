
//CALCULATE AND SHOW SPEED OF DOWNLOAD / UPLOAD
let bytesReceivedInInterval = 0;
let bytesSentInInterval = 0;

function onChunkReceived(chunkSize) {
	bytesReceivedInInterval += chunkSize;
}

function onChunkSent(chunkSize) {
	bytesSentInInterval += chunkSize;
}

function formatSpeed(bytes) {
	if (bytes > 1e6) return (bytes / 1e6).toFixed(2) + " MB/s";
	if (bytes > 1e3) return (bytes / 1e3).toFixed(2) + " KB/s";
	return bytes + " B/s";
}

setInterval(() => {
	const downloadSpeed = formatSpeed(bytesReceivedInInterval * 2); // interval 500ms x2 scale to 1s
	const uploadSpeed = formatSpeed(bytesSentInInterval * 2);
	document.getElementById("transferSpeed").textContent = `Download: ${downloadSpeed} | Upload: ${uploadSpeed}`;
	// Reset counters
	bytesReceivedInInterval = 0;
	bytesSentInInterval = 0;
}, 500);

//UTILITY - NICE FORMAT SIZE / TIME AND REMOVE ANY FUNNY CHARACTERS FROM FILE OR FOLDER NAMES
function formatBytes(a) {
	if (a === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const e = Math.floor(Math.log(a) / Math.log(1024));
	return (a / Math.pow(1024, e)).toFixed(2) + ' ' + units[e];
}

function formatTime(ms) {
	const d = new Date(ms);
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(s) {
	return String(s).replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
}

//PAUSE AFTER CONNECT AND SENDING OF CONTROL MESSAGES IF PEER ADDS OR REMOVES FILES
function sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

// Simple CRC32
function crc32(buf) {
	let crc = -1;
	for (let b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xFF];
	return (crc ^ -1) >>> 0;
}
const table = (() => {
	let t = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) c = ((c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1);
		t[i] = c >>> 0;
	}
	return t;
});

//global used to empty TX and RX db's on shutdown and startup
function flushTxRxDB(db) {
	return new Promise((resolve, reject) => {
		const req = indexedDB.deleteDatabase(db);
		req.onsuccess = resolve;
		req.onerror = () => reject(req.error);
		req.onblocked = () => console.warn("DB delete blocked by open tabs");
	});
}
