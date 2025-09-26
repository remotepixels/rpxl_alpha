
////////////////////////////////////////////////////////////////////////////////////////////////////
//// Drawing code for canvas, as well as clearing and undoing
////////////////////////////////////////////////////////////////////////////////////////////////////
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
        drawingHistory.push(currentPath);
        
        // Send path to peers
        sendDrawingData(currentPath);
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

////////////////////////////////////////////////////////////////////////////////////////////////////
//sends the drawing data to the main stream iframe and the peers
////////////////////////////////////////////////////////////////////////////////////////////////////
function sendDrawingData(pathPoints) {
    const drawingData = {
        t: 'path',
        p: pathPoints,
        c: color,  // Color
        w: 3       // Width
    };
    //console.log("Sending drawing data:", drawingData);
    iframe.contentWindow.postMessage({
        sendData: { overlayNinja: { drawingData: drawingData } },
        type: "pcs"
    }, "*");
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Set up the event listener
//listens for other drawing events from clients
////////////////////////////////////////////////////////////////////////////////////////////////////
const eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
const eventer = window[eventMethod];
const messageEvent = eventMethod === "attachEvent" ? "onmessage" : "message";
var canvasSet = null;

eventer(messageEvent, function(e) {
    const viewersFrame = document.getElementById("viewersStream");  //check if there is a client lest viewersframe

    // Make sure the message is from our VDO.Ninja iframe
    //if ((e.source != iframe.contentWindow) || (e.source != streamFrame.contentWindow)) return;
    //check if there is a amin stream and if there is then turn on annotations tools
    if (e.data && e.data.sendData === 'mainstreamSize') {
        const { width, height, top, left } = e.data;
        
        var offsetViewFrame = 0;
        if (viewersFrame) {var offsetViewFrame = 110;} //director view has a sidebar so we need to offset the canvas
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
            canvasSet = null;
        }
        //sometimes the video stream is not ready yet, so we need to check if width and height are 0
        //if it is we will rezize the canvas to the size by 1px and this will kick things into gear
        if (left == 0 && top == 0) { 
            document.getElementById('mainStream').style.width = "calc(100% - "+offsetViewFrame+"px)";
            //console.log("resized frame to get correct top and left positions for canvas");
        } 
        if (width > 0 && height > 0 && canvasSet == null) {
            // turn on the annotation tools and place canvas
            //offst canvas depending if in director or client view        
            var leftOffset = left + offsetViewFrame;
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
            document.getElementById("annotationsCanvas").style.left = leftOffset+"px";
            canvasSet = true;
            //document.getElementById("annotationsCanvas").style.border = "1px solid red";
            //console.log("Canvas size updated to: w:"+width+" h:"+height+" t:"+top+" l:"+left);
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
                    drawingHistory.push(pathPoints);
                    
                    // Draw it
                    if (pathPoints && pathPoints.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(pathPoints[0].x * canvas.width, pathPoints[0].y * canvas.height);
                        
                        for (let i = 1; i < pathPoints.length; i++) {
                            ctx.lineTo(pathPoints[i].x * canvas.width, pathPoints[i].y * canvas.height);
                        }
                        ctx.lineWidth = 3;
                        ctx.lineCap = 'round';
                        ctx.strokeStyle = pathColor;
                        ctx.stroke();
                    }
                }
            }
            
            // Handle initial state sync
            if (data.drawingHistory) {
                // Clear current state
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Apply all paths from history
                data.drawingHistory.forEach(path => {
                    if (path.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(path[0].x * canvas.width, path[0].y * canvas.height);
                        
                        for (let i = 1; i < path.length; i++) {
                            ctx.lineTo(path[i].x * canvas.width, path[i].y * canvas.height);
                        }
                        
                        ctx.stroke();
                    }
                });
                
                // Update local history
                drawingHistory.length = 0;
                drawingHistory.push(...data.drawingHistory);
            }
        }
    }
}, false);
