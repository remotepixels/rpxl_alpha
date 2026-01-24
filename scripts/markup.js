//stream markup and zoom / move functions
const zoomPopup = document.getElementById("zoom-popup");
const zoomDiv = document.getElementById("zoomdiv");

let scale = 1;
let translate = { x: 0, y: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function applyTransform() {
	zoomDiv.style.transform = `
        translate(${translate.x}px, ${translate.y}px)
        scale(${scale})
      `;
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function getMousePosInDiv(e) {
	const rect = zoomDiv.getBoundingClientRect();
	return {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top
	};
}

function onWheel(e) {
	e.preventDefault();
	if (markup.offsetWidth >= 2) {
		const prevScale = scale;
		const delta = -e.deltaY * 0.001;
		scale = clamp(scale + delta, MIN_SCALE, MAX_SCALE);

		if (scale === 1) {
			translate.x = 0;
			translate.y = 0;
			zoomPopup.classList.remove("visible");
		} else {
			zoomPopup.classList.add("visible");

			const rect = zoomDiv.getBoundingClientRect();
			const dx = (e.clientX - rect.left - rect.width / 2);
			const dy = (e.clientY - rect.top - rect.height / 2);

			translate.x -= dx * (scale - prevScale) / scale;
			translate.y -= dy * (scale - prevScale) / scale;

			constrainPan();
		}

		applyTransform();
	}
}

function constrainPan() {
	const baseWidth = zoomDiv.offsetWidth;
	const baseHeight = zoomDiv.offsetHeight;

	const scaledWidth = baseWidth * scale;
	const scaledHeight = baseHeight * scale;

	const winW = window.innerWidth - 100; // 100px offset from left
	const winH = window.innerHeight - 45; // 45px offset from top

	const maxX = Math.max((scaledWidth - winW), 0) / 2 + 50;
	const maxY = Math.max((scaledHeight - winH), 0) / 2 + 50;

	translate.x = clamp(translate.x, -maxX, maxX);
	translate.y = clamp(translate.y, -maxY, maxY);
}

function onMouseDown(e) {
	if (scale <= 1) return;
	isDragging = true;
	dragStart.x = e.clientX;
	dragStart.y = e.clientY;
}

function onMouseMove(e) {
	if (toolDraw.getAttribute("aria-expanded") != "true") {
		if (!isDragging) return;

		const dx = e.clientX - dragStart.x;
		const dy = e.clientY - dragStart.y;

		dragStart.x = e.clientX;
		dragStart.y = e.clientY;

		translate.x += dx;
		translate.y += dy;

		constrainPan();
		applyTransform();
	}
}

function onMouseUp() {
	isDragging = false;
}


//markup
const canvas = document.getElementById('markup');
const ctx = document.getElementById('markup').getContext('2d');
const drawingHistory = {};
let currentPath = [];
let isDrawing = false;

// Set up event handlers for the canvas
function startDrawing(e) {
	var markupColor = document.getElementsByName("colorpot");
	for (var i = 0; i < markupColor.length; i++) {
		if (markupColor[i].checked) {
			color = markupColor[i].value;
		}
	}
	isDrawing = true;
	const x = e.offsetX / canvas.width;
	const y = e.offsetY / canvas.height;
	currentPath = [{ x, y }];
	ctx.beginPath();
	ctx.moveTo(e.offsetX, e.offsetY);
}

function draw(e) {
	if (!isDrawing) return;

	const x = e.offsetX / canvas.width;
	const y = e.offsetY / canvas.height;
	currentPath.push({ x, y });

	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.lineCap = 'round';
	ctx.lineTo(e.offsetX, e.offsetY);
	ctx.stroke();
}

function endDrawing() {
	if (!isDrawing) return;
	isDrawing = false;

	if (currentPath.length > 1) {
		const stroke = {
			//id: crypto.randomUUID(),
			owner: userStreamID,
			color: color,
			width: 2,
			points: [...currentPath]
		};

		drawingHistory[userStreamID] ??= [];
		drawingHistory[userStreamID].push(stroke);

		sendDrawingData(stroke);
	}

	currentPath = [];
}

function toolEraserSelect() {
	if (!isStreamer) {
		delete drawingHistory[userStreamID];
		redrawCanvas();

		vdo.sendData({
			type: "markup",
			overlayNinja: {
				action: "eraseUser",
				owner: userStreamID
			}
		});
	} else {
		Object.keys(drawingHistory).forEach(k => delete drawingHistory[k]);
		redrawCanvas();

		vdo.sendData({
			type: "markup",
			overlayNinja: { action: "clearAll" }
		});
	}
}

function sendDrawingData(stroke) {
	vdo.sendData({
		type: "markup",
		overlayNinja: {
			action: "stroke",
			stroke
		},
		timestamp: Date.now()
	});
}

function redrawCanvas() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	for (const user in drawingHistory) {
		for (const stroke of drawingHistory[user]) {
			const pts = stroke.points;
			if (pts.length < 2) continue;

			ctx.beginPath();
			ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height);

			for (let i = 1; i < pts.length; i++) {
				ctx.lineTo(pts[i].x * canvas.width, pts[i].y * canvas.height);
			}

			ctx.lineWidth = stroke.width;
			ctx.lineCap = "round";
			ctx.strokeStyle = stroke.color;
			ctx.stroke();
		}
	}
}

function sendFullState(targetUUID) {
    vdo.sendData({
        type: "markup",
        overlayNinja: {
            action: "stateDump",
            to: userStreamID,
            state: drawingHistory
        }
    });
}

function resizeMarkupCanvas() {
	const video = document.getElementById("mainStream");
	const canvas = document.getElementById("markup");
	const elementRect = video.getBoundingClientRect();
	const videoAspect = video.videoWidth / video.videoHeight;
	const elementAspect = elementRect.width / elementRect.height;
	const dpr = window.devicePixelRatio || 1;
	let width, height;

	if (videoAspect > elementAspect) {
		//by width
		width = elementRect.width;
		height = width / videoAspect;
	} else {
		//by height
		height = elementRect.height;
		width = height * videoAspect;
	}

	// Position canvas exactly over visible video
	canvas.style.width = width + "px";
	canvas.style.height = height + "px";

	// High DPI internal resolution
	canvas.width = width * dpr;
	canvas.height = height * dpr;

	const ctx = canvas.getContext("2d");
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	redrawCanvas()
}