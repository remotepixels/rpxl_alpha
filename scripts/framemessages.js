var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent"; // legacy browser support
var eventer = window[eventMethod];
var messageEvent = eventMethod === "attachEvent" ? "onmessage" : "message";
var iframe = document.getElementById("mainStream");
var canvasElement = document.getElementById("annotationsCanvas"); // Replace 'yourCanvasId' with the actual ID of your canvas element

//console.log(messageEvent);

eventer(messageEvent, function (e) {
 // if (e.data.action === 'view-stats-update') { } else if (e.data.action == 'view-stats-update') {    console.log("Received message:", e.data);}
  if (e.data && e.data.sendData === 'remoteDrawdata') {
    console.log("Received remotedrawData:", e.data);
  }

  if (e.source !== iframe.contentWindow) {
    return; // reject messages sent from other iframes
  }

  // process mainstream resize messages
  // make the draw canvas the same size as the mainstream video
  // Check the message type to filter for maninstreamSize messages only
  if (e.data && e.data.sendData === 'mainstreamSize') {
    console.log("Received main stream size message:", e.data);

    const { width, height, top, left } = e.data;

    // if we have video data, i mean some psycho could be sending audio only who knows
    // turn on the annotation tools
    if (width >= 0 && height >= 0) {
      document.getElementById('toolDraw').classList.remove("disable");
      document.getElementById('toolDraw').disabled = false;
      document.getElementById('popupPalette').classList.remove("disable");
      document.getElementById('popupPalette').disabled = false;
      document.getElementById('toolEraser').classList.remove("disable");
      document.getElementById('toolEraser').disabled = false;
    }


    // Ensure the canvas element exists before attempting to set its size
    // turn on the stream voule controls
    if (canvasElement) {
      document.getElementById('toolMuteStream').classList.remove("disable");
      document.getElementById('toolMuteStream').disabled = false;
      document.getElementById('toolStreamVolume').classList.remove("disable");
      document.getElementById('toolStreamVolume').disabled = false;


      document.getElementById("annotationsCanvas").width = width;
      document.getElementById("annotationsCanvas").height = height;
      document.getElementById("annotationsCanvas").style.width = width+"px";
      document.getElementById("annotationsCanvas").style.height = height+"px";
      document.getElementById("annotationsCanvas").style.top = top+55+"px";
      document.getElementById("annotationsCanvas").style.left = left+5+"px"

      console.log(`Canvas size updated to: ${width}x${height}x${top}x${left}`);
      
    } else {
      console.warn("Canvas element not found.");
    }
  }

  // drawing messages
  // scale data sent from client and draw on the canvas
  if (e.data && e.data.sendData === 'remoteDrawData') {
    console.log("Received remote draw data", e.data);

    const { lastPoint, x, y, force, color } = e.data;

    // Scale the coordinates based on the canvas size
    const canvasWidth = canvasElement.width;
    const canvasHeight = canvasElement.height;
    const scaledX = (x / canvasWidth) * canvasElement.width;
    const scaledY = (y / canvasHeight) * canvasElement.height;

    // Draw on the canvas using the scaled coordinates
    draw({
      lastPoint,
      x: scaledX,
      y: scaledY,
      force: force,
      color: color
    });
  }
});
