////////////////////////////////////////////////////////////////////////////////////////////////////
// Listen for draw co-ordinates from parent window and send to all clients
////////////////////////////////////////////////////////////////////////////////////////////////////
/*window.addEventListener('message', function(e) {
  // IMPORTANT: Check the origin of the message to ensure it's from a trusted source.
  // For example, if you expect messages from 'https://parent.example.com':
  // if (event.origin !== 'https://parent.example.com') {
  //   return; // Ignore messages from unexpected origins
  // }
  


  if (e.data && e.data.type === 'drawData') {
    let { lastpoint, xoffset, yoffset, force, color, canvasWidth, canvasHeight } = e.data;
      window.parent.postMessage({
        sendData: 'remoteDrawdata',
        lastPoint: lastpoint,
        x: xoffset, 
        y: yoffset, 
        force: force,
        color: color,
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight
      }, '*');

     console.log('draw data recieved from parent');

  }
});
*/
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
  if (width === 0 || height === 0) {
    //don't send if there is no video element, try again in 3 seconds
    setTimeout(function() { sendMainstreamSize(); }, 3000);  
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
setTimeout(function() { sendMainstreamSize(); }, 5000); 

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