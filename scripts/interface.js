const peerButton = document.getElementById("toolPeers");
const chatButton = document.getElementById("toolChat");
const filesButton = document.getElementById("toolFiles");
let activePeerUUID = null;

//pointer up on buttons with data-ui attribute to trigger UI actions, pointer down to close popups when clicking outside
document.addEventListener("pointerup", (e) => {
	if (document.querySelector('[data-tool="toolDraw"][aria-pressed="true"]')) return;
	if (e.target.closest("#markup")) return;

    const button = e.target.closest("[data-ui]");
    if (!button) return;

    const ui = UI[button.dataset.ui];
    if (ui) ui(button);
});

//pointerdown to cancel dialogs or popovers when clicking outside of them
document.addEventListener("pointerdown", (e) => {
    const dialogs = document.querySelectorAll("[data-close-outside]");

    dialogs.forEach(dialog => {

        if (dialog.classList.contains("hidden")) return;

        if (!dialog.contains(e.target)) {
            dialog.classList.add("hidden");
			restoreDialog(settingsDialog, settingsSnapshot);
			handleSelectionChange();
        }

    });
});

const volumeSlider = document.getElementById("toolStreamVolume");
const mainVideo = document.getElementById("mainStream");

// If your slider is 0–100
volumeSlider.addEventListener("input", () => {
	mainVideo.volume = volumeSlider.value / 100;
});

mainVideo.volume = volumeSlider.value / 100;

//hide toolbar after 3 seconds of inactivity, show when mouse moves near bottom or on click
const toolbar = document.querySelector(".toolbar");
let timer;

function resetToolbarTimer() {
	if (!toolbar) return;
	
    toolbar.classList.remove("fade");

    clearTimeout(timer);

    timer = setTimeout(() => {
        toolbar.classList.add("fade");
    }, 3000);
}

//document.addEventListener("pointermove", resetToolbarTimer);
document.addEventListener("pointerdown", resetToolbarTimer);

document.addEventListener("pointermove", (e) => {
    if (window.innerHeight - e.clientY < 120) {
        resetToolbarTimer();
    }
});

if (peerButton) {
	peerButton.addEventListener("pointerup", () => {
		updatePeerBadge();
	});
}

if (chatButton) {
	chatButton.addEventListener("pointerup", () => {
		unreadMessages = 0;
		updateChatBadge();
	});
}

if (filesButton) {
	filesButton.addEventListener("pointerup", () => {
		newFiles = 0;
		updateFilesBadge();
	});
}


//ui types, panels, dialogs, tools, toggles, actions, popovers
const UI = {
    panel(button) {
        const panel = document.getElementById(button.dataset.target);
        const open = !panel.classList.contains("hidden");

        document.querySelectorAll(".side-panel")
            .forEach(p => p.classList.add("hidden"));

        document.querySelectorAll('[data-ui="panel"]')
            .forEach(t => {
                t.classList.remove("selected");
                t.setAttribute("aria-expanded","false");
            });

        if (!open) {
            panel.classList.remove("hidden");
            button.classList.add("selected");
            button.setAttribute("aria-expanded","true");
        }
		resizeMarkupCanvas(); //markup.js
    },

	section(button) {
		const target = button.dataset.target;
		const sections = document.querySelectorAll("[data-section]");

		document.querySelectorAll('[data-group="section"]').forEach(btn => {
			btn.classList.remove("selected");
			btn.setAttribute("aria-pressed", "false");
		});

		button.classList.add("selected");
		button.setAttribute("aria-pressed", "true");

		sections.forEach(sec => sec.classList.add("hidden"));

		if (firstRun && target === "sectionUser") {
			sectionSession.classList.remove("hidden");
		}

		document.getElementById(target).classList.remove("hidden");

	},

	sort(button) {
        const sortOption = button.dataset.action
        //const open = sortOption.classList.contains("selected");

        document.querySelectorAll('[data-group="sortOptions"]').forEach(btn => {
                btn.classList.remove("selected");
                btn.setAttribute("aria-expanded","false");
            });

        button.classList.add("selected");
        button.setAttribute("aria-expanded","true");

		currentSort = sortOption;
		rerenderFileTree();
		//console.log("sort by", sortOption);
	},

    toggle(button) {
        const state = button.getAttribute("aria-pressed") === "true";
        const newState = !state;

        button.setAttribute("aria-pressed", newState);
        button.classList.toggle("selected");

        runAction(button, newState);
    },

	tool(button) {
        const state = button.getAttribute("aria-pressed") === "true";
        const newState = !state;

        button.setAttribute("aria-pressed", newState);
        button.classList.toggle("selected");

        runAction(button, newState);
	},

	action(button) {
		const state = button.getAttribute("aria-pressed") === "true";
		const newState = !state;

    	runAction(button, newState);
    },

    dialog(button) {
        const dialog = document.getElementById(button.dataset.target);
		settingsSnapshot = snapshotDialog(settingsDialog); //global.js, store current settings state to recall if user cancels out of dialog
        dialog.classList.toggle("hidden");
    },

    popover(button) {
		//console.log("show popover:", button.dataset.target);
		const id = button.dataset.target;
		const popover = document.getElementById(id);
		const state = button.getAttribute("aria-expanded") === "true";

		const open = !popover.classList.contains("hidden");
		button.setAttribute("aria-expanded", !state);

		//set activePeerID and toggle options based on peer state
		const peer = button.closest(".peer");
		if (peer) {
			activePeerUUID = peer.dataset.uuid; 

			const vu = peer.querySelector(".peerVU");
			const micTools = popover.querySelectorAll('[data-requires="remoteAudio"]');

			const hasMic = !vu.classList.contains("micOffline");

			// Check where the peer lives
			const inMainRoom = !!peer.closest('#sidePeers');
			const inWaitingRoom = !!peer.closest('#sideWaitingRoom');

			// Final rule:
			// Must have mic AND be in main room
			const allowRemoteAudio = hasMic && inMainRoom && !inWaitingRoom;

			micTools.forEach(tool => {
				tool.classList.toggle("hidden", !allowRemoteAudio);
			});
		}

		// close other popovers
		document.querySelectorAll(".popover").forEach(p => {
			p.classList.add("hidden");
		});

		if (open) return;

		//place popup
		const rect = button.getBoundingClientRect();

		popover.classList.remove("hidden");

		const popW = popover.offsetWidth;
		const popH = popover.offsetHeight + 5;

		let top = rect.bottom;
		let left = rect.left + rect.width / 2 - popW / 2;

		// flip above if bottom overflow
		if (top + popH > window.innerHeight) {
			top = rect.top - popH;
		}

		// clamp horizontally
		left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));

		popover.style.top = top + "px";
		popover.style.left = left + "px";
	}

};

const ACTIONS = {
	//main toolbar
    muteVideo(state) {
		if (state) {
			console.log("Toggling video state (muted)");
			TRACKS.main.video.enabled = false;
			showBanner({ key:"video_blind", message:"Main video stream disabled", type:"warning", timeout:3000 });
		} 
		if (!state) {
			console.log("Toggling video state (live)");
			TRACKS.main.video.enabled = true;
			hideBannerByKey("video_blind");

		}
    },

    muteAudio(state) {
		if (state) {
			console.log("Toggling audio state (muted)");
			TRACKS.main.audio.enabled = false;
			showBanner({ key:"audio_muted", message:"Main audio stream disabled", type:"warning", timeout:3000 });
		} 
		if (!state) {
			console.log("Toggling audio state (live)");
			TRACKS.main.audio.enabled = true;
			hideBannerByKey("audio_muted");

		}
    },

    drawTool(state) {
		if (state) {
			//console.log("Toggling draw tool (on)")
			document.getElementById("markup").style.cursor = "crosshair";
			canvas.addEventListener('pointerdown', startDrawing);
			canvas.addEventListener('pointermove', draw);
			canvas.addEventListener('pointerup', endDrawing);
			canvas.addEventListener('mouseout', endDrawing);
		} 
		if (!state) {
			//console.log("Toggling draw tool (off)")
			document.getElementById("markup").style.cursor = "default";
			canvas.removeEventListener('pointerdown', startDrawing);
			canvas.removeEventListener('pointermove', draw);
			canvas.removeEventListener('pointerup', endDrawing);
			canvas.removeEventListener('mouseout', endDrawing);

		}
    },

    eraseTool() {
		console.log("Erase tool")
		toolEraserSelect();
    },

	//sidebar
	help() {
        window.open("help.html", "_help");
    },

	remoteToggleMic() {
		if (!activePeerUUID) return;

		vdo.sendData({
			type: 'remoteToggleMic',
			user: activePeerUUID,
			timestamp: Date.now()
		},activePeerUUID);

		peerControls.classList.toggle("hidden", true);
		//console.log("Toggling peer mic", activePeerUUID);
	},

	oneOnOne(state) {
		if (!activePeerUUID) return;

		const allButtons = peerControls.querySelectorAll('.tool');

		if (state) {

			vdo.sendData({
				type: 'oneOnOne',
				action: "active",
				user: activePeerUUID,
				host: localUUID,
				timestamp: Date.now()
			});

			showBanner({ key:"oneOnOne", message:"You are in one on one", type:"notification", timeout:null });
			
			oneOnOneUser = activePeerUUID;
			toggleOneOnOne(activePeerUUID, localUUID);
			peerControls.classList.toggle("hidden", true);

			console.log("one on one active with peeer", activePeerUUID);
			
			document.querySelectorAll('#peerControls .tool').forEach(popupEl => {
				popupEl.classList.add("hidden");
			});

		}
		
		if (!state) {

			vdo.sendData({
				type: 'oneOnOne',
				action: "off",
				user: activePeerUUID,
				host: localUUID,
				timestamp: Date.now()
			});

			allButtons.forEach(btn => {
				if (!btn.querySelector('[data-action="oneOnOne"]')) {
					btn.classList.remove(".hidden");
					}
				});

			clearOneOnOne();
			
			document.querySelectorAll('#peerControls .tool').forEach(popupEl => {
				popupEl.classList.remove("hidden");
			});

			peerControls.classList.toggle("hidden", true);
			console.log("one on one off");
		}
	},

	moveToRoom() {
		if (!activePeerUUID) return;
		const peer = document.querySelector(`.peer[data-uuid="${activePeerUUID}"]`);

		const mainRoom = document.getElementById("sidePeers");
		let targetRoom = null;

		if (peer.parentElement === mainRoom) {
			targetRoom = "lobby";
		} else {
			targetRoom = "main";
		}
		console.log("sending : ", activePeerUUID, " to room : ", targetRoom);

		togglePeerRoom(activePeerUUID, targetRoom);
		peerControls.classList.toggle("hidden", true);
		//console.log("moving peer", activePeerUUID);
	},

	kick() {
		if (!activePeerUUID) return;

		vdo.sendData({
			type: 'kick',
			user: activePeerUUID,
			timestamp: Date.now()
		},activePeerUUID);

		peerControls.classList.toggle("hidden", true);
		//console.log("Kicking peer", activePeerUUID);
	},

    muteMicrophone(state) {
		const vu = document.getElementById("userStreamVU");

		if (state) {
			console.log("Toggling microphone state (muted)");
			TRACKS.user.audio.enabled = false;
			vu.classList.add("muted");

			vdo.sendData({
				type: 'userStreamAudio',
				info: "micMute",
				timestamp: Date.now()
			});

			showBanner({ key:"mic_muted", message:"Your Microphone has been muted", type:"warning", timeout:null });
		} 
		if (!state) {
			console.log("Toggling microphone state (live)");
			TRACKS.user.audio.enabled = true;
			vu.classList.remove("muted");

			vdo.sendData({
					type: 'userStreamAudio',
					info: "micLive",
					timestamp: Date.now()
			});

			hideBannerByKey("mic_muted");

		}
    },

    muteCamera(state) {
		if (state) {
			//console.log("Toggling camera state (muted)");
			TRACKS.user.video.enabled = false;
			showBanner({ key:"cam_muted", message:"Your camera has been turned off", type:"notification", timeout:3000 });
		} 
		if(!state) {
			//console.log("Toggling camera state (live)");
			TRACKS.user.video.enabled = true;
			hideBannerByKey("cam_muted");
		}
    },
};

function runAction(button, state) {
    const action = ACTIONS[button.dataset.action];

    if (action) action(state, button);
}

var color = "white";
const colorPots = document.querySelectorAll('.colorpot');
//popup banner
const activeBanners = new Map();

function setTools(source, state) {
    const tools = document.querySelectorAll(`[data-requires="${source}"]`);

    tools.forEach(tool => {
        tool.classList.toggle("hidden", !state);
		tool.setAttribute("aria-pressed", "false");
    });

}

// // specific for markup color pots popup
colorPots.forEach(colorPot => {
    colorPot.addEventListener('pointerup', () => {
        const newSelectedColor = colorPot.getAttribute('value');
        color = newSelectedColor;

        const previouslySelected = document.querySelector('.colorpot.selectedcolorpot');
        if (previouslySelected) {
            previouslySelected.classList.remove('selectedcolorpot');
            previouslySelected.setAttribute('aria-expanded', 'false');
        }

        colorPot.classList.add('selectedcolorpot');
        colorPot.setAttribute('aria-expanded', 'true');
    });
});

//popup banners and warnings
function showBanner({ key, message, type = "notification", timeout = null}) {
    // If already visible, do nothing
    if (key && activeBanners.has(key)) return;

    const stack = document.getElementById("bannerStack");
    const tpl = document.getElementById("bannerTemplate");

    const banner = tpl.content.firstElementChild.cloneNode(true);
    banner.classList.add(type);
	banner.classList.add("enter");
    banner.dataset.key = key || "";

    banner.querySelector("span").textContent = message;

    stack.appendChild(banner);

    if (key) {
        activeBanners.set(key, banner);
    }

    if (timeout !== null) {
        setTimeout(() => hideBanner(banner), timeout);
    }

    return banner;
}

function hideBanner(banner) {
    if (!banner) return;

    const key = banner.dataset.key;
    if (key) activeBanners.delete(key);

	banner.classList.remove("enter");
    banner.classList.add("exit");
    banner.addEventListener(
        "animationend",
        () => banner.remove(),
        { once: true }
    );
}

function hideBannerByKey(key) {
    const banner = activeBanners.get(key);
    if (banner) hideBanner(banner);
}

// //other interface bits, storing device info, recalling history etc
function randomBG() {
	// Detect dark / light mode and select bg
	const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const numberArrayBG = Array.from({ length: 6 }, (_, i) => String(i).padStart(3, '0'));
	const randomBG = numberArrayBG[Math.floor(Math.random() * numberArrayBG.length)];
	const theme = isDarkMode ? 'dark' : 'light';
	const imageUrl = `/backgrounds/${theme}_${randomBG}.jpg`;

	document.body.style.backgroundImage = `url('${imageUrl}')`;
	document.body.style.width = `100%`;
	document.body.style.height = `100%`;
	document.body.style.backgroundSize = `cover`;

	if (!isStreamer && !isQuickShare && !isTVShare) {
		const header = document.querySelector(`.siteHeader`);
		header.style.backgroundImage = `url('${imageUrl}')`;
		header.style.width = `100%`;
		header.style.backgroundSize = `cover`;
	}
}
