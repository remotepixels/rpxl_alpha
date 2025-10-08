//wait for 1 seconds after loaded to run the first time
setInterval(function() { sendMainstreamSize(); }, 1000); 

function sendMainstreamSize() {
  let layoutElement = document.querySelector('.holder');
    let LEwidth = layoutElement.offsetWidth || 0;
    let LEheight = layoutElement.offsetHeight || 0;
    let LEtop = layoutElement.offsetTop || 0;
    let LEleft = layoutElement.offsetLeft || 0;
  // if (layoutElement) {
  //   let LEwidth = layoutElement.offsetWidth || 0;
  //   let LEheight = layoutElement.offsetHeight || 0;
  //   let LEtop = layoutElement.offsetTop || 0;
  //   let LEleft = layoutElement.offsetLeft || 0;
  // }

  if ((LEtop === 0) && (LEleft === 0)) {
    // If the top and left are 0, it means the mainstream is not in the expected position
    // console.log("Mainstream is not positioned correctly, offset by 1 px...");
    LEtop = LEtop+1;
    LEleft = LEleft+1;
  } 
  // Send the message to the parent window
  window.parent.postMessage({
      sendData: 'mainstreamSize', // Add a type to easily filter messages
      width: LEwidth,
      height: LEheight,
      top: LEtop,
      left: LEleft,
      "type": "pcs"
    }, '*'); // Use '*' for the target origin for simplicity should be sent to parent
}

// run everytime the window is resized but throttled
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