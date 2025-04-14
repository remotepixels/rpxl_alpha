const html = document.querySelector('html');

const changeTheme = document.getElementById("switchTheme");
changeTheme.addEventListener("click", switchTheme);

//switch between light and dark mode
function switchTheme() {
    currentTheme =  changeTheme.value

   if (currentTheme == "light") {
        changeTheme.value = "dark";
        html.style.setProperty("color-scheme", "dark");
    } else {
        changeTheme.value = "light";
        html.style.setProperty("color-scheme", "light");
    } 

}