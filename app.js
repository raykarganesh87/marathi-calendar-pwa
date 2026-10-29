(function () {
  const $ = (id) => document.getElementById(id);
  const stage = $("stage"), bar = $("bar"), statusEl = $("status"), goBtn = $("go"), printBtn = $("print");
  let worker = null;

  // ---- form setup
  const sel = $("place");
  PLACES.forEach((p, i) => sel.add(new Option(p[0], i)));
  sel.add(new Option("Custom (enter latitude / longitude)", "custom"));
  const now = new Date();
  $("year").value = now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0);
  try {
    const saved = JSON.parse(localStorage.getItem("mcal-settings") || "null");
    if (saved) for (const k in saved) if ($(k) && k !== "year") $(k).value = saved[k];
  } catch (e) {}
  const syncCustom = () => $("custom").classList.toggle("hidden", sel.value !== "custom");
  sel.addEventListener("change", syncCustom); syncCustom();

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $("pdfhint").textContent = isIOS
    ? "iPhone/iPad: after the calendar appears tap Save as PDF, then the Share button, then 'Print' and pinch-out on the preview to get the PDF (Save to Files)."
    : "Tip: in the print window choose Destination = “Save as PDF”, Paper = A4, Margins = None, and tick “Background graphics”.";

  function setProgress(p, msg) { bar.style.width = Math.min(100, p) + "%"; statusEl.textContent = msg ? `Working… ${Math.round(p)}%` : statusEl.textContent; }
  function fit() {
    const w = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth) - 16;
    const s = Math.min(1, w / (210 / 25.4 * 96));
    stage.style.setProperty("--s", s.toFixed(4));
  }
  window.addEventListener("resize", fit);

  function readOpts() {
    const n = (id) => Math.max(0, Math.min(80, parseFloat($(id).value) || 0));
    return { adGrid: [n("gt"), n("gb")], adOther: [n("ot"), n("ob")] };
  }

  goBtn.addEventListener("click", () => {
    const year = parseInt($("year").value, 10);
    if (!(year >= 1900 && year <= 2100)) { alert("Please enter a year between 1900 and 2100."); return; }
    let place, lat, lon;
    if (sel.value === "custom") {
      lat = parseFloat($("clat").value); lon = parseFloat($("clon").value);
      if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 66 || Math.abs(lon) > 180) { alert("Enter valid latitude / longitude."); return; }
      place = $("cname").value.trim() || "स्थानिक";
    } else { const p = PLACES[+sel.value]; place = p[1]; lat = p[2]; lon = p[3]; }
    const opts = readOpts();
    try {
      localStorage.setItem("mcal-settings", JSON.stringify({ place: sel.value, cname: $("cname").value, clat: $("clat").value, clon: $("clon").value,
        gt: $("gt").value, gb: $("gb").value, ot: $("ot").value, ob: $("ob").value }));
    } catch (e) {}
    goBtn.disabled = true; printBtn.classList.add("hidden"); stage.innerHTML = ""; setProgress(1, "start");
    if (worker) worker.terminate();
    worker = new Worker("worker.js");
    worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "progress") setProgress(m.p, m.m);
      else if (m.type === "done") {
        statusEl.textContent = "Preparing pages…"; setProgress(88, "render");
        setTimeout(() => {
          stage.innerHTML = Render.renderAll(m.y, opts);
          fit(); setProgress(100); goBtn.disabled = false; printBtn.classList.remove("hidden");
          document.title = `Marathi_Panchang_Calendar_${year}`;
          statusEl.textContent = `Done – ${year}, ${place}. Preview below; press “Save as PDF / Print”.`;
          $("pdfhint").classList.remove("hidden");
          stage.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 30);
        worker.terminate(); worker = null;
      } else if (m.type === "error") {
        goBtn.disabled = false; statusEl.textContent = "Error: " + m.message; worker.terminate(); worker = null;
      }
    };
    worker.onerror = (e) => { goBtn.disabled = false; statusEl.textContent = "Error: " + (e.message || "worker failed"); };
    worker.postMessage({ year, lat, lon, place });
  });
  printBtn.addEventListener("click", () => window.print());

  // ---- PWA install + service worker
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("install").classList.remove("hidden"); });
  $("install").addEventListener("click", async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $("install").classList.add("hidden"); });
  window.addEventListener("appinstalled", () => $("install").classList.add("hidden"));
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
