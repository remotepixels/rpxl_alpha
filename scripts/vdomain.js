// This script is used to send the size of the holder element to the server
// It will check if the holder element exists and if it does, it will send the size
async function sendSize() {
    const holder = document.querySelector('.holder');
    
    if (!holder) {
        //if holder is not found, wait 2 seconds and try again
        console.log("noMainStream")
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