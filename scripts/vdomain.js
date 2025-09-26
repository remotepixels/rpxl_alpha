
////////////////////////////////////////////////////////////////////////////////////////////////////
function sendMainstreamSize() {
  const layoutElement = document.querySelector('.holder');
  let width = 0;
  let height = 0;
  let top = 0;
  let left = 0;

  if (layoutElement) {
    width = layoutElement.offsetWidth;
    height = layoutElement.offsetHeight;
    top = layoutElement.offsetTop;
    left = layoutElement.offsetLeft;
  }
  if (width === 0 || height === 0) {
    //don't send if there is no video element, try again every 2 seconds
    setTimeout(function() { sendMainstreamSize(); }, 2000); 
    console.log("no video stream, retry in 2 second");
    return; 
  } 
  if ((top === 0) && (left === 0)) {
    // If the top and left are 0, it means the mainstream is not in the expected position
    // This can happen if the mainstream is not yet loaded or if it's in a different layout
    // We will try to send the size again after 1 second
    console.log("Mainstream is not positioned correctly, retrying...");
    
    // Send the message to the parent window with current size

    window.parent.postMessage({
        sendData: 'mainstreamSize', // Add a type to easily filter messages
        width: width,
        height: height,
        top: top+1,
        left: left+1,
        "type": "pcs"
    }, '*')

    //setTimeout(function() { sendMainstreamSize(); }, 500);  
    return; 
  }

  // Send the message to the parent window
  window.parent.postMessage({
      sendData: 'mainstreamSize', // Add a type to easily filter messages
      width: width,
      height: height,
      top: top,
      left: left,
      "type": "pcs"
    }, '*'); // Use '*' for the target origin for simplicity should be sent to parent
}          

//wait for 1 seconds after loaded to run the first time
setTimeout(function() { sendMainstreamSize(); }, 1000); 
// var streamActivated = false;
// setInterval(function() { checkForMainstream(); }, 2000); //send every 15 seconds just in case

// function checkForMainstream() {
//   const noStream = document.getElementById('retryimage');

//   if ((noStream) || (streamActivated == false)) {
//     window.parent.postMessage({
//       sendData: 'noMainStream', 
//       value: 1,// Add a type to easily filter messages
//       "type": "pcs"
//     }, '*')
//     //console.log("no stream, disable stream tools, update every 2 seconds");
//     streamActivated = false;
//   } else {
//     streamActivated = true;
//     sendMainstreamSize();
//   }
// }


// run everytime the window is resized but throttled
// This will ensure that the function is not called too often
// and will only be called once every 250ms
window.addEventListener("resize", resizeThrottler, false);
let resizeTimeout; // timeout ID
function resizeThrottler() {
  // ignore resize events as long as an actualResizeHandler execution is in the queue
  if (!resizeTimeout) {
    // set a timeout to prevent multiple event’s firing
    resizeTimeout = setTimeout(function () {
      resizeTimeout = null;
      sendMainstreamSize();
    }, 250);
  }
}