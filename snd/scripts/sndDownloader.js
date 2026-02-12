self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

const downloads = new Map();
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000; // 5 minute timeout for abandoned downloads

self.addEventListener("message", e => {
	const { type, fileID, stream, filename } = e.data;
	
	if (type === "download") {
		if (!fileID || !stream || !filename) {
			console.error("Invalid download message: missing required fields");
			return;
		}

		console.log(`SW: Queueing download for ${filename} (${fileID})`);

		// Set timeout to clean up abandoned downloads
		const timeoutId = setTimeout(() => {
			if (downloads.has(fileID)) {
				console.warn(`SW: Download ${fileID} timed out, cleaning up`);
				downloads.delete(fileID);
			}
		}, DOWNLOAD_TIMEOUT);

		downloads.set(fileID, {
			stream,
			filename,
			timeoutId,
			startTime: Date.now()
		});
	}
});

console.log("SW: Service Worker booted");

self.addEventListener("fetch", event => {
	const url = new URL(event.request.url);
	const pathname = url.pathname;

	// Match both /snd/download/{fileID} and ../download/{fileID} patterns
	if (!pathname.includes("/download/")) return;

	const fileID = pathname.split("/").pop();
	if (!fileID) {
		event.respondWith(new Response("Not found", { status: 404 }));
		return;
	}

	const entry = downloads.get(fileID);
	if (!entry) {
		console.warn(`SW: No stream found for download request: ${fileID}`);
		event.respondWith(new Response("Download not prepared", { status: 404 }));
		return;
	}

	// Remove from queue and clear timeout
	downloads.delete(fileID);
	clearTimeout(entry.timeoutId);

	const elapsed = Date.now() - entry.startTime;
	console.log(`SW: Starting download delivery for ${entry.filename} (${fileID}), queued for ${elapsed}ms`);

	event.respondWith(
		new Response(
			entry.stream.pipeThrough(new TransformStream({
				transform(chunk, controller) {
					// Pass chunks through with minimal overhead
					controller.enqueue(chunk);
				},
				flush(controller) {
					console.log(`SW: Download stream complete for ${fileID}`);
					controller.close();
					
					// Notify all clients that download finished
					self.clients.matchAll().then(clients => {
						const message = {
							type: "download-finished",
							fileID,
							filename: entry.filename
						};
						for (const client of clients) {
							client.postMessage(message).catch(err =>
								console.error(`SW: Failed to notify client:`, err)
							);
						}
					}).catch(err => 
						console.error(`SW: Failed to match clients:`, err)
					);
				},
				error(err) {
					console.error(`SW: Stream error during download ${fileID}:`, err);
					
					// Notify clients of error
					self.clients.matchAll().then(clients => {
						for (const client of clients) {
							client.postMessage({
								type: "download-error",
								fileID,
								filename: entry.filename,
								error: err.message
							}).catch(e => console.error("Failed to notify error:", e));
						}
					}).catch(e => console.error("Failed to match clients:", e));
				}
			})),
			{
				headers: {
					"Content-Type": "application/octet-stream",
					"Content-Disposition": `attachment; filename="${entry.filename}"; filename*=UTF-8''${encodeURIComponent(entry.filename)}`,
					"Cache-Control": "no-store, no-cache"
				}
			}
		).catch(err => {
			console.error(`SW: Error creating response for ${fileID}:`, err);
			return new Response("Download error", { status: 500 });
		})
	);
});
