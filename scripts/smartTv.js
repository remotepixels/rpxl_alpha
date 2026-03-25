const smartTVCode = document.getElementById("smartTVInput");
const smartTVBtn = document.getElementById("smartTVButton");

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

function connectToSmartTV() {
	const roomCode = smartTVCode.value.replace("-", "");

	if (roomCode.length !== 8) {
        smartTVCode.focus();
        smartTVCode.style.animation = "pulse 500ms";
        setTimeout(() => { smartTVCode.style.animation = "none"; }, 500);
		return;
	};

	const vdoTV = new VDONinjaSDK({
		salt: "rpxl.app",
		allowFallback: false,
		debug: false
	});

	vdoTV.autoConnect({
		room: roomCode,
		mode: "half",	//data only
		password: ""
	});

	vdoTV.addEventListener('peerConnected', (event) => {

		console.log(`Peer : ${event} joined waiting room at`);
	});

	wait(500);

	vdoTV.sendData({
		dataType: "migrate",
		roomid: sessionID
	});

}
