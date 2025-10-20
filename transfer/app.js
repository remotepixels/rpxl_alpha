// We'll use the iframe‑API of VDO.Ninja (simpler) rather than full SDK for demo.

const dropZone = document.getElementById('dropZone');
const fileListUl = document.getElementById('fileList');
const connectBtn = document.getElementById('connectBtn');

let filesArray = [];  // list of File objects (with relativePath if from folder)
let vdoIframe;
let peerUUIDs = new Set();

// Utility: recursively get all files from items (folders supported)
async function getFilesFromDrops(items) {
  const out = [];

  async function traverse(itemEntry, path) {
    if (itemEntry.isFile) {
      const file = await new Promise(resolve => itemEntry.file(resolve));
      file.relativePath = path + file.name;
      out.push(file);
    } else if (itemEntry.isDirectory) {
      const reader = itemEntry.createReader();
      let entries;
      do {
        entries = await new Promise(resolve => reader.readEntries(resolve));
        for (const entry of entries) {
          await traverse(entry, path + itemEntry.name + '/');
        }
      } while (entries.length);
    }
  }

  for (let item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) {
      await traverse(entry, '');
    }
  }

  return out;
}

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.style.borderColor = '#444';
});
dropZone.addEventListener('dragleave', e => {
  dropZone.style.borderColor = '#888';
});
dropZone.addEventListener('drop', async e => {
  e.preventDefault();
  dropZone.style.borderColor = '#888';

  const items = e.dataTransfer.items;
  filesArray = await getFilesFromDrops(items);
  fileListUl.innerHTML = '';
  filesArray.forEach(f => {
    const li = document.createElement('li');
    li.textContent = `${f.relativePath || f.name} (${f.size} bytes)`;
    li.dataset.filename = f.relativePath || f.name;
    fileListUl.appendChild(li);
  });

  // send metadata to peers
  sendFileListToPeers();
});

// Setup connection to VDO.Ninja via iframe API
connectBtn.addEventListener('click', () => {
  if (vdoIframe) return;
  const roomName = prompt('Enter room name to join/create:');
  if (!roomName) return;

  vdoIframe = document.createElement('iframe');
  // parameters: data‑only (no video/audio), hide UI (cleanish)
  vdoIframe.src = `https://vdo.ninja/?room=${encodeURIComponent(roomName)}&label=guest01&dataonly`;
  vdoIframe.allow = "camera; microphone; fullscreen; display-capture; autoplay;";
  vdoIframe.width = "100%";
  vdoIframe.height = "200px";
  document.body.appendChild(vdoIframe);

  window.addEventListener('message', messageHandler);
});

// Handler for messages from iframe
function messageHandler(e) {
  // Basic check — you may want to validate origin
  const data = e.data;
  if (!data) return;

  // When a new peer connects/disconnects, you may receive certain events (depends on version)
  if (data.peerConnect) {
    console.log('Peer connected: ', data.peerConnect.uuid);
    peerUUIDs.add(data.peerConnect.uuid);
  }
  if (data.peerDisconnect) {
    console.log('Peer disconnected: ', data.peerDisconnect.uuid);
    peerUUIDs.delete(data.peerDisconnect.uuid);
  }
  if (data.dataReceived) {
    handleReceivedData(data.dataReceived, data.uuid);
  }
}

// Send metadata of files to all peers
function sendFileListToPeers() {
  if (!vdoIframe) return;

  const meta = filesArray.map(f => ({
    name: f.name,
    path: f.relativePath || f.name,
    size: f.size,
    type: f.type
  }));

  const payload = {
    type: 'file-list',
    files: meta
  };

  vdoIframe.contentWindow.postMessage({
    sendData: payload
  }, '*');
}

// Handle received messages
function handleReceivedData(data, fromUUID) {
  if (data.type === 'file-list') {
    console.log('Received file‑list from peer', fromUUID, data.files);
    // show in UI or allow click to request download
    showPeerFileList(fromUUID, data.files);
  }
  if (data.type === 'request-file') {
    // peer wants a specific file
    const { path } = data;
    const fileItem = filesArray.find(f => (f.relativePath || f.name) === path);
    if (fileItem) {
      sendFileToPeer(fileItem, fromUUID);
    }
  }
  if (data.type === 'file-chunk') {
    receiveFileChunk(data, fromUUID);
  }
}

// Show peer’s file list in UI (example simple)
function showPeerFileList(peerUUID, files) {
  const ulId = `peer-${peerUUID}-files`;
  let ul = document.getElementById(ulId);
  if (!ul) {
    ul = document.createElement('ul');
    ul.id = ulId;
    const header = document.createElement('h3');
    header.textContent = `Files from peer ${peerUUID}`;
    document.body.appendChild(header);
    document.body.appendChild(ul);
  }
  ul.innerHTML = '';
  files.forEach(f => {
    const li = document.createElement('li');
    li.textContent = `${f.path} (${f.size} bytes)`;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      requestFileFromPeer(peerUUID, f.path);
    });
    ul.appendChild(li);
  });
}

// Request file from a peer
function requestFileFromPeer(peerUUID, path) {
  if (!vdoIframe) return;
  const payload = {
    type: 'request-file',
    path
  };
  vdoIframe.contentWindow.postMessage({
    sendData: payload,
    UUID: peerUUID
  }, '*');
}

// Send a file to a peer (chunked)
function sendFileToPeer(file, peerUUID) {
  const chunkSize = 64 * 1024; // 64KB
  let offset = 0;
  const reader = new FileReader();

  reader.onload = e => {
    const chunk = e.target.result;
    const payload = {
      type: 'file-chunk',
      path: file.relativePath || file.name,
      chunk: chunk,
      last: (offset + chunk.byteLength >= file.size)
    };
    vdoIframe.contentWindow.postMessage({
      sendData: payload,
      UUID: peerUUID
    }, '*');

    offset += chunk.byteLength;
    if (offset < file.size) {
      readSlice(offset);
    } else {
      console.log('Finished sending file', file.name);
    }
  };

  function readSlice(o) {
    const slice = file.slice(o, o + chunkSize);
    reader.readAsArrayBuffer(slice);
  }

  readSlice(0);
}

// Receiving file chunks
const incomingFiles = {};  // key = peerUUID+path, value = {chunks:[], size, received}
function receiveFileChunk(data, fromUUID) {
  const key = fromUUID + '|' + data.path;
  if (!incomingFiles[key]) {
    incomingFiles[key] = { chunks: [], received: 0 };
  }
  const info = incomingFiles[key];
  info.chunks.push(data.chunk);
  info.received += data.chunk.byteLength;

  if (data.last) {
    // assemble
    const blob = new Blob(info.chunks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.path;
    a.textContent = `Download ${data.path} from peer ${fromUUID}`;
    document.body.appendChild(a);
    document.body.appendChild(document.createElement('br'));
    console.log('File complete from peer', data.path);
    delete incomingFiles[key];
  }
}
