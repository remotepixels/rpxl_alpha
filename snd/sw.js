self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

const downloads = new Map();

self.addEventListener("message", e => {
	console.log("SW got message", e.data);
	if (e.data?.type === "download") {
		downloads.set(e.data.fileID, {
			stream: e.data.stream,
			filename: e.data.filename
		});
	}
});

console.log("SW booted");

self.addEventListener("fetch", event => {
	const url = new URL(event.request.url);

	if (!url.pathname.startsWith("/snd/download/")) return;

	console.log("SW intercept:", url.pathname);

	const fileID = url.pathname.split("/").pop();
	const entry = downloads.get(fileID);

	if (!entry) {
		event.respondWith(new Response("Not found", { status: 404 }));
		return;
	}

	downloads.delete(fileID);

	event.respondWith(
		new Response(
			entry.stream.pipeThrough(new TransformStream({
				flush() {
					self.clients.matchAll().then(clients => {
						for (const c of clients) {
							c.postMessage({
								type: "download-finished",
								fileID
							});
						}
					});
				}
			})),
			{
				headers: {
					"Content-Type": "application/octet-stream",
					"Content-Disposition":
						`attachment; filename="${entry.filename}"; filename*=UTF-8''${encodeURIComponent(entry.filename)}`
				}
			}
		)
	);
});
