
////////////////////////////////////////////////////////////////////////////////////////////////////
// Send the size of the 'main video stream (called holder)' element to the parent window
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
  if ((width === 0 || height === 0) && (top === 0 && left === 0)) {
    //don't send if there is no video element, try again every 3 seconds
    setTimeout(function() { sendMainstreamSize(); }, 1000);  
    return; 
  } else {  
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
}

//wait for 5 seconds after loaded to run the first time
setTimeout(function() { sendMainstreamSize(); }, 4000); 

// run everytime the window is resized but throttled
// This will ensure that the function is not called too often
// and will only be called once every 500ms
window.addEventListener("resize", resizeThrottler, false);
let resizeTimeout; // timeout ID
function resizeThrottler() {
  // ignore resize events as long as an actualResizeHandler execution is in the queue
  if (!resizeTimeout) {
    // set a timeout to prevent multiple event’s firing
    resizeTimeout = setTimeout(function () {
      resizeTimeout = null;
      sendMainstreamSize();
    }, 500);
  }
}