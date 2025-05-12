
// Function to send the size of the 'gridlayout' element
function sendMainstreamSize() {
  const layoutElement = document.querySelector('.holder');
  let width = 0;
  let height = 0;
  let top = 0;
  
  if (layoutElement) {
    width = layoutElement.offsetWidth;
    height = layoutElement.offsetHeight;
    top = layoutElement.offsetTop;
  }

  // Send the message to the parent window
  window.parent.postMessage({
    type: 'maninstreamSize', // Add a type to easily filter messages
    width: width,
    height: height,
    top: top
  }, '*'); // Use '*' for the target origin for simplicity in development,
           // but specify the parent's origin in production for security.
}

// You might want to send the size initially when the iframe loads,
// and potentially again if the gridlayout size changes (e.g., on window resize)
window.addEventListener('load', sendMainstreamSize);
setTimeout ( function () {sendMainstreamSize()}, 2000);  
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
