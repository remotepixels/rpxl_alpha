const smartTVCode = document.getElementById("smartTVInput");
const smartTVBtn = document.getElementById("smartTVButton");
let setupTVListners = false;

smartTVBtn.addEventListener('pointerdown', () => {
		connectToSmartTV();
});

smartTVCode.addEventListener("keydown", e => {
if (e.key === "Enter") {
		e.preventDefault();
		connectToSmartTV();
	}
});

smartTVCode.addEventListener("input", e => {
	let input = e.target;
	let start = input.selectionStart;

	let v = input.value;
	let clean = v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);

	let formatted = clean.length > 4
		? clean.slice(0, 4) + "-" + clean.slice(4)
		: clean;

	input.value = formatted;

	input.setSelectionRange(start, start);
});

async function connectToSmartTV() {
	if (!setupTVListners) {
		setupVDOTVListeners();
		setupTVListners = true; 
	}

	const roomCode = smartTVCode.value.replace("-", "");

	if (roomCode.length !== 8) {
        smartTVCode.focus();
        smartTVCode.style.animation = "pulse 500ms";
        setTimeout(() => { smartTVCode.style.animation = "none"; }, 500);
		console.log("not a valid smart tv code");
		return;
	};

	if (vdoTV.state.room != null) await vdoTV.disconnect();

	await vdoTV.autoConnect({
		room: roomCode,
		mode: "half",	//data only
		password: ""
	});

	const timer = setTimeout(() => {
    	if (vdoTV.state.room !== null) vdoTV.disconnect();
		console.log("nobody home disconnecting")	//5 second time out and disconnect 
    }, 5000);

}


function setupVDOTVListeners() {
		vdoTV.addEventListener(`connected`, (event) => {
			console.log("connected to signaling server");
		});

		vdoTV.addEventListener(`disconnected`, (event) => {
			console.log("disconnected to signaling server");
		});

		vdoTV.addEventListener(`roomJoined`, (event) => {
			console.log("Joined room :", event.detail.room);
		});

		vdoTV.addEventListener('peerConnected', (event) => {		//NOTE! vdoMS
		const uuid = event.detail.uuid;

		console.warn("Found smart TV.. or something,...", uuid);
		});

		vdoTV.addEventListener("dataChannelOpen", (event) => {
			//comes later will contain the peer label (username) but not tracks
			console.log("data channel open for business, sending command");

			vdoTV.sendData({
				type: "migrate",
				roomid: sessionID
			});

		});

		vdoTV.addEventListener("peerListing", (event) => {
			//comes later will contain the peer label (username) but not tracks
		});

		vdoTV.addEventListener('dataReceived', (event) => {
		const data = event.detail.data;
		
		//user events
		if (data.type === 'ack-migrate') {

			console.log("Recieved acknowledgement smartTv will join session");
			vdoTV.disconnect();
		}

	});

}