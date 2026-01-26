
//creates empty stream as placeholder till devices come online, then we replace tracks
function initStream(whichStream) {
	const stream = new MediaStream();
	//stream.name = whichStream;
	let video = null;

	if (whichStream == "user") { video = initUserVideoTrack(); }
	if (whichStream == "main") { video = initVideoTrack(); }

	const audio = initAudioTrack();

	stream.addTrack(video.track);
	stream.addTrack(audio.track);

	return {
		stream,
		video,
		audio
	};
}
//creates "silent" audio track, replaced later or used if device set to none
function initAudioTrack() {
	const ctx = new AudioContext();

	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	gain.gain.value = 0; // silence

	oscillator.connect(gain);

	const dest = ctx.createMediaStreamDestination();
	gain.connect(dest);

	oscillator.start();

	const track = dest.stream.getAudioTracks()[0];

	track.onended = () => {
		oscillator.stop();
		ctx.close();
	};

	return { track, ctx };
}
//creates color bars placeholder for main track
function initVideoTrack() {
	const bgColor = '#141414';
	const canvasMS = document.createElement("canvas");
	canvasMS.width = 320;
	canvasMS.height = 80;

	const colors = [
		'#FFFFFF', // White
		'#C0C000', // Yellow
		'#00C0C0', // Cyan
		'#00C000', // Green
		'#C000C0', // Magenta
		'#C00000', // Red
		'#0000C0'  // Blue
	];
	// Bottom bars: Blue (center), Magenta, Cyan, White on left
	const bottomColors = [
		'#0000C0', // Blue
		'#C000C0', // Magenta
		'#00C0C0', // Cyan
		'#FFFFFF'  // White
	];

	const ctx = canvasMS.getContext("2d");
	const barWidth = canvasMS.width / 7;
	let running = true;

	function draw() {
		if (!running) return;
		// Draw the main seven bars (top 2/3 of the height)
		const topHeight = canvasMS.height * 2 / 3;
		for (let i = 0; i < colors.length; i++) {
			ctx.fillStyle = colors[i];
			ctx.fillRect(i * barWidth, 0, barWidth, topHeight);
		}

		// Optional: Draw the PLUGE/Bottom Bars (bottom 1/3)
		const bottomHeight = canvasMS.height * 1 / 3;
		const bottomY = topHeight;
		const bottomBarWidth = canvasMS.width / 4;


		for (let i = 0; i < bottomColors.length; i++) {
			ctx.fillStyle = bottomColors[i];
			ctx.fillRect(i * bottomBarWidth, bottomY, bottomBarWidth, bottomHeight);
		}

		ctx.fillStyle = bgColor;
		ctx.fillRect(0, 30, 320, 25);

		ctx.fillStyle = "#c1c1c1ff";
		ctx.font = "24px arial, sans-serif";
		ctx.fillText("No Video Source Selected", 22, 50);

		requestAnimationFrame(draw);
	}

	draw();

	const stream = canvasMS.captureStream(1);
	const track = stream.getVideoTracks()[0];

	// optional cleanup hook
	track.onended = () => {
		running = false;
		stream.getTracks().forEach(t => t.stop());
	};
	return { track, canvasMS, stream };
}
//creates placeholder user video track, lovely shades of pastel
function initUserVideoTrack() {
	let sanitizedCurrentUserName = encodeURIComponent(document.getElementById("name").value.trim());
	const labelInitials = sanitizedCurrentUserName ? sanitizedCurrentUserName.charAt(0).toUpperCase() : "?";
	
	const hue = Math.floor(Math.random() * 360);
	const saturation = 20 + Math.random() * 20;   // pastel base
	const lightness = 30 + Math.random() * 5;

	// Gradient endpoints
	const lightSat = saturation - 10;
	const lightLum = lightness + 10;
	const darkSat  = saturation + 15;
	const darkLum  = lightness - 10;

	const colorLight = `hsl(${hue}, ${lightSat}%, ${lightLum}%)`;
	const colorDark  = `hsl(${hue}, ${darkSat}%, ${darkLum}%)`;

	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;

	const ctx = canvas.getContext("2d");

	let running = true;

	function draw() {
		if (!running) return;

		const grad = ctx.createLinearGradient(0, 0, 64, 64);
		grad.addColorStop(0, colorLight);
		grad.addColorStop(1, colorDark);

		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, 64, 64);

		// ctx.fillStyle = "rgba(255,255,255,0.6)";
		// ctx.font = "bold 20px sans-serif";
		// ctx.textAlign = "center";
		// ctx.textBaseline = "middle";
		// ctx.fillText(labelInitials, 32, 32);

		requestAnimationFrame(draw);
	}

	draw();

	const stream = canvas.captureStream(1);
	const track = stream.getVideoTracks()[0];

	track.onended = () => {
		running = false;
		stream.getTracks().forEach(t => t.stop());
	};

	return { track, canvas, stream };
}

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
