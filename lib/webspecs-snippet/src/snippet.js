/* WebSpecs browser signal. No cookies, storage, or third-party requests. */
(() => {
  const script = document.currentScript;
  const endpoint = script?.dataset.endpoint || "/analytics/signal";
  const meta = document.querySelector('meta[name="webspecs-request-id"]');
  const requestId =
    script?.dataset.requestId ||
    meta?.getAttribute("content") ||
    window.__WEBSPECS_REQUEST_ID__;
  const started = performance.timeOrigin + performance.now();
  const signal = {
    requestId: requestId || null,
    jsExecuted: true,
    webdriver: typeof navigator.webdriver === "boolean" ? navigator.webdriver : null,
    mouseMoved: false,
    scrolled: false,
    touched: false,
    screenWidth: window.screen?.width || null,
    screenHeight: window.screen?.height || null,
    navigationTimingMs: null
  };
  const mark = (key) => {
    signal[key] = true;
  };
  addEventListener("mousemove", () => mark("mouseMoved"), { once: true, passive: true });
  addEventListener("scroll", () => mark("scrolled"), { once: true, passive: true });
  addEventListener("touchstart", () => mark("touched"), { once: true, passive: true });
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    signal.navigationTimingMs = nav ? Math.round(nav.responseEnd) : null;
  } catch (_) {}
  const send = () => {
    signal.observedAt = new Date().toISOString();
    const body = JSON.stringify(signal);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    } else {
      fetch(endpoint, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        credentials: "omit"
      }).catch(() => {});
    }
  };
  setTimeout(send, 3000);
})();