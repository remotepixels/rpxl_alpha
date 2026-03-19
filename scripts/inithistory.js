//create session history drop down
function loadHistoryIntoDialog() {
	const sessionsJSON = localStorage.getItem(APP_NS);
	if (!sessionsJSON) return;

	const sessions = JSON.parse(sessionsJSON);
	const dialog = document.getElementById("sectionHistory");

	dialog.innerHTML = `
	<span class="history-heading bold">IMPORTANT Using a previous session will re-use the existing share links</span>`; // reset

	sessions.forEach(entry => {
		const project = decodeURIComponent(entry.projectName) || "Unnamed session";
		const formattedDate = formatDateISO(entry.createdAt);

		const btn = document.createElement("button");
		btn.className = "link historyEntry";
		btn.dataset.sessionId = entry.sessionID;

		btn.innerHTML = `
		<span class="history-item">${project}</span>
		<span class="history-date">${formattedDate}</span>
		`;

		btn.addEventListener("pointerup", async () => {
			restoreSessionFromHistory(entry);
		});

		dialog.appendChild(btn);
	});
}
//restore session ID and session name from history entry selected
async function restoreSessionFromHistory(entry) {
	if (confirm("Restoring project from history.\n\nAny previously shared links from this project will become active again and may allow others to access this session.")) {
		sessionID = entry.sessionID;
		console.log(`Restored sessionID: ${sessionID} from history`);

		const projectInput = document.getElementById("project");
		projectInput.value = decodeURIComponent(entry.projectName) === "Unnamed project"
			? ""
			: decodeURIComponent(entry.projectName);

		// Restore all *other* UI settings
		await restoreSettingsHost(entry); //from initui.js
		await handleSelectionChange(); // single attach
		//historyDialog.classList.toggle("hidden");
		startSession();
	}
}

//restore last used settings from local storage on load
async function restoreSetingsLast() {
	document.getElementById("project").value = ""; 
	await getDevices();   
	
	const sessionsJSON = localStorage.getItem(APP_NS);
	if (!sessionsJSON) {
		await handleSelectionChange(); // single attach
		return;
	}

	const sessions = JSON.parse(sessionsJSON);
	if (!sessions.length) return;

	const last = sessions[0];

	restoreSettingsHost(last); // UI only
	await handleSelectionChange(); // single attach
}

//pretty date in history dialog
	function formatDateISO(dateString) {
		const d = new Date(dateString);
		return (
			d.getFullYear() + "-" +
			String(d.getMonth() + 1).padStart(2, "0") + "-" +
			String(d.getDate()).padStart(2, "0") + " " +
			String(d.getHours()).padStart(2, "0") + ":" +
			String(d.getMinutes()).padStart(2, "0")
		);
	}
	
