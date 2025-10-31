  window.parent.postMessage({
      sendData: 'mainstreamSize', // Add a type to easily filter messages
      width: LEwidth,
      height: LEheight,
      top: LEtop,
      left: LEleft,
      "type": "pcs"
    }, '*'); // Use '*' for the target origin for simplicity should be sent to parent