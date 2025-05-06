// Listen for messages from the parent
window.addEventListener('message', (event) => {
    // Check if the message is from the expected origin
    if (event.origin === 'https://alpha.rpxl.app') {
        console.log('Received message from parent:', event.data);
    }
});

// Use postMessage to send data to the parent
window.parent.postMessage('Hello from iframe!', 'https://alpha.rpxl.app');