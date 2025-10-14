//stream annotations and zoom / move functions
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
    if (canvasCurrentWidth >= 2) {
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

      const maxX = Math.max((scaledWidth - winW), 0) / 2;
      const maxY = Math.max((scaledHeight - winH), 0) / 2 + 100;

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

//annotations
const canvas = document.getElementById('annotationsCanvas');
const ctx = document.getElementById('annotationsCanvas').getContext('2d');
const iframe = document.getElementById("viewersStream");

// Track connected peers
const connectedPeers = {};
const drawingHistory = [];
let currentPath = [];
let isDrawing = false;

// Set up event handlers for the canvas
function startDrawing(e) {
    var annotationColor = document.getElementsByName("colorpot");
    for (var i = 0; i < annotationColor.length; i++) {
        if (annotationColor[i].checked) {
            color = annotationColor[i].value;
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
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
}

function endDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    
    if (currentPath.length > 1) {
        // Save path to history
        // drawingHistory.push(currentPath);
        drawingHistory.push({
            color: color,
            width: 3,
            points: [...currentPath]
        });
        // Send path to peers
        //sendDrawingData(currentPath);
        sendDrawingData({
            color: color,
            width: 3,
            points: [...currentPath]
        });
    }
    
    currentPath = [];
}

function toolEraserSelect() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory.length = 0;
    
    // Send clear command
    iframe.contentWindow.postMessage({
        sendData: { overlayNinja: { drawingData: "clear" } },
        type: "pcs"
    }, "*");
}

// //sends the drawing data to the main stream iframe and the peers
// function sendDrawingData(pathPoints) {
//     const drawingData = {
//         t: 'path',
//         p: pathPoints,
//         c: color,  // Color
//         w: 3       // Width
//     };
//     //console.log("Sending drawing data:", drawingData);
//     iframe.contentWindow.postMessage({
//         sendData: { overlayNinja: { drawingData: drawingData } },
//         type: "pcs"
//     }, "*");
// }

function sendDrawingData(drawing) {
    const drawingData = {
        t: 'path',
        p: drawing.points,
        c: drawing.color,
        w: 3
    };

    iframe.contentWindow.postMessage({
        sendData: { overlayNinja: { drawingData: drawingData } },
        type: "pcs"
    }, "*");
}

//redraws canvas if size is changed
// function redrawCanvas() {
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     for (const path of drawingHistory) {
//         if (path.length > 1) {
//             ctx.beginPath();
//             ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height);
//             for (let i = 1; i < path.length; i++) {
//                 ctx.lineTo(path[i].x * canvas.width, path[i].y * canvas.height);
//             }
//             ctx.lineWidth = 3;
//             ctx.lineCap = 'round';
//             ctx.strokeStyle = 'black'; // default color in case one isn't provided
//             // You can improve this by storing color/width info per path later
//             ctx.stroke();
//         }
//     }
// }
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of drawingHistory) {
        const points = stroke.points;
        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
            }
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round';
            ctx.strokeStyle = stroke.color;
            ctx.stroke();
        }
    }
}

//listens for other drawing events from clients
const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
const eventer = window[eventMethod];
const messageEvent = eventMethod === "attachEvent" ? "onmessage" : "message";
//var canvasSet = null;
var canvasCurrentLeft = 0;
var canvasCurrentTop = 0;
var canvasCurrentWidth = 0;
var canvasCurrentHeight = 0;

eventer(messageEvent, function(e) {
    const viewersFrame = document.getElementById("viewersStream");  //check if there is a client lest viewersframe

    // Make sure the message is from our VDO.Ninja iframe
    //if ((e.source != iframe.contentWindow) || (e.source != streamFrame.contentWindow)) return;
    //check if there is a amin stream and if there is then turn on annotations tools
    if (e.data && e.data.sendData === 'mainstreamSize') {
        const { width, height, top, left } = e.data;
        
        // var offsetViewFrame = 0;
        // if (viewersFrame) {var offsetViewFrame = 100;} //director view has a sidebar so we need to offset the canvas
        var offsetViewFrameTop = document.getElementById("mainStream").offsetTop;
        //console.log ("frame offset:",offsetViewFrame);
        //console.log ("frame top offset:",offsetViewFrameTop);
        if (width == 0 || height == 0) {
            let streamtools = document.querySelectorAll(".streamtool");

                streamtools.forEach(tool => {
                tool.classList.add("disable");
                tool.classList.remove("selected");
                tool.setAttribute("aria-expanded", "false");
                tool.disabled = true;
            });
            document.getElementById("annotationsCanvas").width = 0;
            document.getElementById("annotationsCanvas").height = 0;
            document.getElementById("annotationsCanvas").style.width = 0+"px";
            document.getElementById("annotationsCanvas").style.height = 0+"px";
            document.getElementById("annotationsCanvas").style.top = 0+"px";
            document.getElementById("annotationsCanvas").style.left = 0+"px";
            canvasCurrentLeft = 0;
            canvasCurrentTop = 0;
            canvasCurrentWidth = 0;
            canvasCurrentHeight = 0;
        }
        //sometimes the video stream is not ready yet, so we need to check if width and height are 0
        //if it is we will rezize the canvas to the size by 1px and this will kick things into gear
        if (left == 0 && top == 0) { 
            document.getElementById('mainStream').style.width = "100%";
            //console.log("resized frame to get correct top and left positions for canvas");
        } 
        if ((width != canvasCurrentWidth || height != canvasCurrentHeight || top != canvasCurrentTop || left != canvasCurrentLeft) && (width >= 1) && (height != 1)) {
            // turn on the annotation tools and place canvas
            //offst canvas depending if in director or client view        
            // var leftOffset = left + offsetViewFrame;
            var topOffset = top + offsetViewFrameTop;

            let streamtools = document.querySelectorAll(".streamtool");
            streamtools.forEach(tool => {
                tool.classList.remove("disable");
                tool.disabled = false;
            });
            
            document.getElementById("annotationsCanvas").width = width;
            document.getElementById("annotationsCanvas").height = height;
            document.getElementById("annotationsCanvas").style.width = width+"px";
            document.getElementById("annotationsCanvas").style.height = height+"px";
            document.getElementById("annotationsCanvas").style.top = topOffset+"px";
            document.getElementById("annotationsCanvas").style.left = left+"px";

            redrawCanvas(); //redraw canvas once resized
            
            canvasCurrentLeft = left;
            canvasCurrentTop = top;
            canvasCurrentWidth = width;
            canvasCurrentHeight = height;
            //document.getElementById("annotationsCanvas").style.border = "1px solid red";
            console.log("Canvas size updated to: w:"+width+" h:"+height+" t:"+top+" l:"+left);
        }
    }    
    //console.log(e.data);

    // Process connection events
    if ("action" in e.data) {
        //console.log("got some data");
        if (e.data.action === "view-stats-updated") { return; } // Ignore stats updates
        if (e.data.action === "guest-connected" && e.data.streamID) {
            connectedPeers[e.data.streamID] = e.data.value?.label || "Guest";
            console.log("Guest connected:", e.data.streamID, "Label:", connectedPeers[e.data.streamID]);
            
            // Send current drawing state to new peer
            if (drawingHistory.length > 0) {
                iframe.contentWindow.postMessage({
                    sendData: { overlayNinja: { drawingHistory: drawingHistory } },
                    type: "pcs",
                    UUID: e.data.streamID
                }, "*");
                
            }
        } 
        else if (e.data.action === "push-connection" && e.data.value === false && e.data.streamID) {
            console.log("Guest disconnected:", e.data.streamID);
            delete connectedPeers[e.data.streamID];
        }
    }
    
    // Handle received data
    if ("dataReceived" in e.data) {
        if ("overlayNinja" in e.data.dataReceived) {
            const data = e.data.dataReceived.overlayNinja;
            
            // Process drawing data
            if (data.drawingData) {
                if (data.drawingData === "clear") {
                    // Clear command
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    drawingHistory.length = 0;
                }
                else if (data.drawingData.t === 'path') {
                    // New path
                    const pathPoints = data.drawingData.p;
                    const pathColor = data.drawingData.c;
                    // Add to history
                    //drawingHistory.push(pathPoints);
                    drawingHistory.push({
                        color: data.drawingData.c,
                        width: data.drawingData.w,
                        points: data.drawingData.p
                    });
                    
                    // Draw it
                    // if (pathPoints && pathPoints.length > 1) {
                    //     ctx.beginPath();
                    //     ctx.moveTo(pathPoints[0].x * canvas.width, pathPoints[0].y * canvas.height);
                        
                    //     for (let i = 1; i < pathPoints.length; i++) {
                    //         ctx.lineTo(pathPoints[i].x * canvas.width, pathPoints[i].y * canvas.height);
                    //     }
                    //     ctx.lineWidth = 3;
                    //     ctx.lineCap = 'round';
                    //     ctx.strokeStyle = pathColor;
                    //     ctx.stroke();
                    // }
                    if (data.drawingData.p && data.drawingData.p.length > 1) {
                        const points = data.drawingData.p;
                        ctx.beginPath();
                        ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
                        
                        for (let i = 1; i < points.length; i++) {
                            ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
                        }
                        ctx.lineWidth = data.drawingData.w;
                        ctx.lineCap = 'round';
                        ctx.strokeStyle = data.drawingData.c;
                        ctx.stroke();
                    }

                }
            }
            
            // Handle initial state sync
            // if (data.drawingHistory) {
            //     // Clear current state
            //     ctx.clearRect(0, 0, canvas.width, canvas.height);
                
            //     // Apply all paths from history
            //     data.drawingHistory.forEach(path => {
            //         if (path.length > 1) {
            //             ctx.beginPath();
            //             ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height);
                        
            //             for (let i = 1; i < path.length; i++) {
            //                 ctx.lineTo(path[i].x * canvas.width, path[i].y * canvas.height);
            //             }
                        
            //             ctx.stroke();
            //         }
            //     });
                
            //     // Update local history
            //     drawingHistory.length = 0;
            //     drawingHistory.push(...data.drawingHistory);
            // }
            if (data.drawingHistory) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                data.drawingHistory.forEach(stroke => {
                    const points = stroke.points;
                    if (points.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
                        
                        for (let i = 1; i < points.length; i++) {
                            ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
                        }

                        ctx.lineWidth = stroke.width;
                        ctx.lineCap = 'round';
                        ctx.strokeStyle = stroke.color;
                        ctx.stroke();
                    }
                });

                drawingHistory.length = 0;
                drawingHistory.push(...data.drawingHistory);
            }

        }
    }
}, false);
