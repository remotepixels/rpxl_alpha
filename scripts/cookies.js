// This script is used to set and get cookies in the browser. (called from initui.js and index.html)
function setCookie(cookieName, cookieValue, expiryDays) {
  const date = new Date();
  date.setTime(date.getTime() + (expiryDays*24*60*60*1000));
  let expires = "expires="+ date.toUTCString();
  document.cookie = cookieName + "=" + cookieValue + ";" + expires + ";path=/";
}

//read cokkie and decode values
function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let cookieArray = decodedCookie.split(';');
  for(let i = 0; i < cookieArray.length; i++) {
    let c = cookieArray[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
}

//check if cookie exists and pre-populate the user camera and mic field in the following dialogue
function checkCookie(cookieUser, cookieCamera, cookieMic) {
    let usercookie = getCookie(cookieUser);
    let cameracookie = getCookie(cookieCamera);
    let miccookie = getCookie(cookieMic);

    if (usercookie != null) {
        // console.log("Retrieved cookie data, name : " + usercookie + " ,camera : " + cameracookie + " ,mic : " + miccookie);
        document.getElementById("name").value = usercookie;
    }
    //wait 1/2 second for the camera and microphone to populate and then set the values
    setTimeout(function() {
        if ((cameracookie != "") && (cameracookie != "None") && (cameracookie != "Disabled in browser")) {
            let selectElement = document.getElementById("cameraSource");
            //console.log("options:"+selectElement.options.length);
            let optionFound = false;
            for (let i = 0; i < selectElement.options.length; i++) {
                const option = selectElement.options[i].innerHTML;
                // Compare the cookie value with the option's value
                if (option === cameracookie) {
                    document.getElementById("cameraSource").selectedIndex = i
                    
                    //videoElement.classList.remove("fadeout");
                    videos = document.getElementById("cameraSource").value;
                    videoSelected = document.querySelector('select#cameraSource');

                    optionFound = true;                    //preselectDevice('video');
                    break; // Stop once the matching option is found and selected
                }
            } 
        }
        if (miccookie != "") {
            let selectElement = document.getElementById("microphoneSource");
            
            let optionFound = false;
            for (let i = 0; i < selectElement.options.length; i++) {
                const option = selectElement.options[i].innerHTML;
                // Compare the cookie value with the option's value
                if (option === miccookie) {
                    document.getElementById("microphoneSource").selectedIndex = i

                    audios = document.getElementById("microphoneSource").value;
                    audioSelected = document.querySelector('select#microphoneSource');

                    optionFound = true;                    //preselectDevice('audio');
                    break; // Stop once the matching option is found and selected
                }
            }
        } 
    },500);
}