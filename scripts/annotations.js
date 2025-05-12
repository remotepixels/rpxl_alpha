
//////////////////////////////////////////////////////////////
//// Drawing code for annotations and canvas resizing
const canvas = document.getElementById('annotationsCanvas');
const ctx = document.getElementById('annotationsCanvas').getContext('2d');
//const activeCanvas = document.getElementById('annotationsCanvas');
//const activeCtx = document.getElementById('annotationsCanvas').getContext('2d');

var lastPoint;
var force = 1;
var mouseDown = false;

function resizeCanvas() {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.putImageData(imgData, 0, 0);
   // activeCanvas.width = window.innerWidth;
   // activeCanvas.height = window.innerHeight;
}

function draw(data) {
    ctx.beginPath();
    ctx.moveTo(data.lastPoint.x, data.lastPoint.y);
    ctx.lineTo(data.x, data.y);
    ctx.strokeStyle = data.color;
    ctx.lineWidth = Math.pow(1, 4) * 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.closePath();
}

//track mouse movement and draw line
function move(e) {
    mouseDown = e.buttons;
    if (e.buttons) {
        if (!lastPoint) {
            lastPoint = { x: e.offsetX, y: e.offsetY };
            originPoint = { x: e.offsetX, y: e.offsetY };
            return;
        }
        draw({
            lastPoint,
            x: e.offsetX,
            y: e.offsetY,
            force: force,
            color: color
        });
//sends data via broadcast channel
/*      broadcast(JSON.stringify({
        event: 'draw',
        lastPoint,
        x: e.offsetX,
        y: e.offsetY,
        force: force,
        color: color
    }));        */    
        lastPoint = { x: e.offsetX, y: e.offsetY };
    } else {
        lastPoint = undefined;
    }
}
//mousedown function
function down(e) {
    var annotationColor = document.getElementsByName("colorpot");
    for (var i = 0; i < annotationColor.length; i++) {
        if (annotationColor[i].checked) {
            color = annotationColor[i].value;
        }
    }
    originPoint = { x: e.offsetX, y: e.offsetY };
}
//mouse up function
function up() {
    lastPoint = undefined;
    originPoint = undefined;
}
//checks canvas size on startup and sets it to the size of the window
//resizeCanvas();