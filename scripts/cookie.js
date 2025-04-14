
//write cookies
//setCookie("Username", "Gui the magnificient", 1);
//setCookie("Resolutions", "1920x1080", 1);
//setCookie("quality", "high", 1);
//setCookie("microphone", "on", 1);
//let whichCookie = username;

function setCookie(cookieName, cookieValue, expiryDays) {
  const date = new Date();
  date.setTime(date.getTime() + (expiryDays*24*60*60*1000));
  let expires = "expires="+ date.toUTCString();
  document.cookie = cookieName + "=" + cookieValue + ";" + expires + ";path=/";
}
/*
//check if cookies exist
function checkCookie(whichCookie) {
  let username = getCookie(whichCookie);
  if (username != "") {
   alert("Welcome again " + username);
  }
}
*/
//read cookies
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
//  return "";
}

//console.log(getCookie("Username"));
//console.log(getCookie("Resolutions"));
//console.log(getCookie("quality"));
//console.log(getCookie("rapidduck"));
