// Scramjet's service worker for /browse/: every request under the frame
// prefix is handed to the controller in the page, which fetches it over Wisp.
importScripts("/browse/controller/controller.sw.js");

self.addEventListener("fetch", (event) => {
  if ($scramjetController.shouldRoute(event)) event.respondWith($scramjetController.route(event));
});
