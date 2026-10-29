importScripts("astronomy.browser.min.js", "data.js", "engine.js");
self.onmessage = (e) => {
  const { year, lat, lon, place } = e.data;
  try {
    const y = Panchang.build(year, lat, lon, place, (p, m) => self.postMessage({ type: "progress", p, m }));
    self.postMessage({ type: "done", y });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err && err.stack || err) });
  }
};
