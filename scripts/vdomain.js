
// Function to send the size of the 'gridlayout' element
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
    //console.warn("Grid layout size is zero, not sending message.");
    setTimeout ( function () {sendMainstreamSize()}, 3000);  
    return; // Avoid sending a message with zero size
  } else {  // Send the message to the parent window
  window.parent.postMessage({
      type: 'maninstreamSize', // Add a type to easily filter messages
      width: width,
      height: height,
      top: top,
      left: left
    }, '*'); // Use '*' for the target origin for simplicity in development,
  }          
}
setTimeout ( function () {sendMainstreamSize()}, 3000);  
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