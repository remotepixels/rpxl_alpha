
//wait for document to load
document.addEventListener("DOMContentLoaded", () => {

	const toolbuttons = document.querySelectorAll("tool");

	toolbuttons.forEach((toolbutton) => {
		const selectButton = toolbutton.querySelector("tool");
		const dropdown = toolbutton.querySelector("toolpopup");

		const toggleDropdown = (expand = null) => {
			const isOpen = expand !== null ? expand : dropdown.classList.contains("hidden");
			dropdown.classList.toggle("hidden", !isOpen);
			selectButton.setAttribute("aria-expanded", isOpen);
			selectButton.classList.toggle("active", isOpen);
		};

		selectButton.addEventListener("click", () => {
			toggleDropdown();
		});

		document.addEventListener("click", (event) => {
		const isOutsideClick = !toolbutton.contains(event.target);
			if (isOutsideClick) {
				toggleDropdown(false);
			}
		});
	});


});



/*
document.addEventListener("DOMContentLoaded", () => {

	const toolbuttons = document.querySelectorAll(".toolbutton");

	toolbuttons.forEach((toolbutton) => {
		const selectButton = toolbutton.querySelector(".tool");
		const dropdown = toolbutton.querySelector(".toolpopup");

		const toggleDropdown = (expand = null) => {
			const isOpen = expand !== null ? expand : dropdown.classList.contains("hidden");
			dropdown.classList.toggle("hidden", !isOpen);
			selectButton.setAttribute("aria-expanded", isOpen);
			selectButton.classList.toggle("active", isOpen);
		};

		selectButton.addEventListener("click", () => {
			toggleDropdown();
		});

		document.addEventListener("click", (event) => {
		const isOutsideClick = !toolbutton.contains(event.target);
			if (isOutsideClick) {
				toggleDropdown(false);
			}
		});
	});


});
*/