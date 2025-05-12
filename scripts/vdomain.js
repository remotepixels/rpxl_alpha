/*
// This script is used to send the size of the holder element to the server
// It will check if the holder element exists and if it does, it will send the size
async function sendSize() {
    const holder = document.querySelector('.holder');
    
    if (!holder) {
        //if holder is not found, wait 2 seconds and try again
        console.log("noMainStream")
        window.parent.postMessage({holder: "noMainStream"}, "*");
        waitAndTryAgain = setTimeout(sendSize, 2000);
        return;
    } else {  
        clearTimeout(waitAndTryAgain);
        const computedStyles = window.getComputedStyle(holder);
        const rect = holder.getBoundingClientRect();
        const data = {
            width: rect.width,
            height: rect.height,
            top: rect.top,    
            }
        console.log("MainStreamSize", data);
        window.parent.postMessage({holder: data}, "*");
        return
    };
}

// Throttle the resize event
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
      sendSize();

    }, 250);
  }
}

sendSize()



*/

// Function to send the size of the 'gridlayout' element
function sendMainstreamSize() {
  const gridlayoutElement = document.querySelector('.holder');
  let width = 0;
  let height = 0;

  if (gridlayoutElement) {
    width = gridlayoutElement.offsetWidth;
    height = gridlayoutElement.offsetHeight;
  }

  // Send the message to the parent window
  window.parent.postMessage({
    type: 'maninstreamSize', // Add a type to easily filter messages
    width: width,
    height: height
  }, '*'); // Use '*' for the target origin for simplicity in development,
           // but specify the parent's origin in production for security.
}

// You might want to send the size initially when the iframe loads,
// and potentially again if the gridlayout size changes (e.g., on window resize)
window.addEventListener('load', sendMainstreamSize);
setTimeout ( function () {sendMainstreamSize}, 500);  
//sendMainstreamSize(); // Send the size immediately after the page loads
// Example of sending the size again on window resize (if gridlayout is responsive)
//window.addEventListener('resize', sendGridLayoutSize);

// Throttle the resize event
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
    }, 500);
  }
}
