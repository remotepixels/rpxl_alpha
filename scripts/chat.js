const inputChatMessage = document.getElementById("inputChatMessage");
const sendMessageButton = document.getElementById("sendMessage");
const chatHistory = [];

let unreadMessages = 0;

function updateChatBadge() {
	const chatButton = document.getElementById("toolChat");
	if (!chatButton) return;

	chatButton.dataset.count = unreadMessages;
}

sendMessageButton.addEventListener("pointerup", () => {
	sendMessage()
});

inputChatMessage.addEventListener("keydown", (event) => {
    if (event.isComposing) return;

    if (event.key === "Enter") {
        if (event.shiftKey) {
            // Shift+Enter → insert newline
            event.preventDefault();
            const start = inputChatMessage.selectionStart;
            const end = inputChatMessage.selectionEnd;
            inputChatMessage.value = 
                inputChatMessage.value.substring(0, start) + 
                "\n" + 
                inputChatMessage.value.substring(end);
            inputChatMessage.selectionStart = inputChatMessage.selectionEnd = start + 1;
            inputChatMessage.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
            // Enter only → send message
            event.preventDefault();
            sendMessage();
        }
    }
});

inputChatMessage.addEventListener("input", () => {
    inputChatMessage.style.height = "40px";
    inputChatMessage.style.height =
        Math.min(inputChatMessage.scrollHeight, 150) + "px";
		sendMessageButton.style.height = "40px";
		    sendMessageButton.style.height =
        Math.min(inputChatMessage.scrollHeight, 150) + "px";
});

function sendMessage() {
    const text = inputChatMessage.value.trim();
    if (!text) return;
    addMessage(text);
    inputChatMessage.value = "";
	inputChatMessage.style.height = "40px";
		sendMessageButton.style.height = "40px";
}

function addMessage(text) {
	let sanitizedCurrentUserName = document.getElementById("name").value.trim();

	if (sanitizedCurrentUserName && isStreamer) {
		sanitizedCurrentUserName = sanitizedCurrentUserName+" (Host)";
	}

	if (!sanitizedCurrentUserName && isStreamer) {
		sanitizedCurrentUserName = "(Host)";
	}

	const msg = document.createElement("div");
	msg.className = "chatMessage chat-bubble blue";
	msg.classList.add("bubble-in");
	
	const msgBody = document.createElement("div");
	msgBody.append(linkify(text));
	
	const msgTime = document.createElement("div");
	msgTime.className = "chat-time";
	const now = new Date();
	const prettyTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	msgTime.textContent = prettyTime;

	msg.appendChild(msgBody);
	msg.appendChild(msgTime);

	chatContainer.appendChild(msg);

	requestAnimationFrame(() => {
		chatContainer.scrollTop = chatContainer.scrollHeight;
	});
	
	//broadcast to all clients
	vdo.sendData({
		type: 'chat',
		message: text,
		sender: sanitizedCurrentUserName,
		timestamp: msgTime.textContent
	});

	//update local chat history with local messages
	chatHistory.push({
		message: text,
		sender: sanitizedCurrentUserName,
		timestamp: prettyTime
	});
}

	//pdate local chat history with messages from other clients and render them
function postMessage(message, sender, timestamp) {
	if (!message || !sender || timestamp == null) return;

	chatHistory.push({
		message,
		sender,
		timestamp
	});

	renderMessage(message, sender, timestamp);
}

function renderMessage(message, sender, timestamp) {
	//console.log("Posting message from", sender, ":", message , "at", timestamp);

	const msg = document.createElement("div");
	msg.className = "chatMessage chat-bubble";
	msg.classList.add("bubble-in");
	
	const msgSender = document.createElement("div");
	msgSender.className = "chat-user bold";
	msgSender.textContent = sender;

	const msgBody = document.createElement("div");
	msgBody.append(linkify(message));
	
	const msgTime = document.createElement("div");
	msgTime.className = "chat-time";
	msgTime.textContent = timestamp;

	msg.appendChild(msgSender);
	msg.appendChild(msgBody);
	msg.appendChild(msgTime);

	requestAnimationFrame(() => {
		chatContainer.scrollTop = chatContainer.scrollHeight;
	});

	chatContainer.appendChild(msg);
	unreadMessages++;
	updateChatBadge();
}

function linkify(text) {
    const frag = document.createDocumentFragment();
    const urlRE = /\b(https?:\/\/|www\.)[^\s<]+[^\s<.,!?)]/gi;

    let last = 0, match;

    while ((match = urlRE.exec(text))) {
        const url = match[0];
        const start = match.index;

        if (start > last) {
            frag.append(text.slice(last, start));
        }

        const a = document.createElement("a");
        const href = url.startsWith("http") ? url : "https://" + url;

        a.href = href;
        a.textContent = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";

        frag.append(a);

        last = urlRE.lastIndex;
    }

    if (last < text.length) {
        frag.append(text.slice(last));
    }

    return frag;
}
