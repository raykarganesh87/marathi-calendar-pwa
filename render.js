/* Builds the printable A4-portrait calendar pages (HTML) from the engine result. */
(function (root) {
  const DATA = (typeof module !== "undefined") ? require("./data.js") : root.DATA;
  const DAY = 86400000, IST = 5.5 * 3600000;
  const DEV = "०१२३४५६७८९";
  const dn = (x) => String(x).replace(/[0-9]/g, (d) => DEV[+d]);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const pad = (n) => String(n).padStart(2, "0");
  const parts = (ms) => {
    const r = Math.round((ms + IST) / 60000) * 60000, d = new Date(r);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes(), key: Math.floor(r / DAY) };
  };
  const hhmm = (p) => dn(pad(p.H) + ":" + pad(p.M));
  const T = (ms, key) => { const p = parts(ms); return hhmm(p) + (p.key > key ? "*" : ""); };
  const keyToYMD = (k) => { const d = new Date(k * DAY); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
  const tithiName = (n) => n === 15 ? "पौर्णिमा" : n === 30 ? "अमावास्या" : DATA.TITHI[(n - 1) % 15];
  const tithiShort = (n) => n === 15 ? "पौर्णिमा" : n === 30 ? "अमावास्या" : (n <= 15 ? "शु. " : "व. ") + dn((n - 1) % 15 + 1);
  const tithiFull = (n, month, adhik) => {
    const k = (n - 1) % 15 + 1, pre = (adhik ? "अधिक " : "") + DATA.MMONTH[month] + " ";
    return (n === 15 || n === 30) ? pre + tithiName(n) : `${pre}${n <= 15 ? "शुद्ध" : "वद्य"} ${DATA.TITHI[k - 1]}`;
  };

  function ctx(y) {
    const shakaOf = (key) => key >= y.gudi ? y.year - 78 : y.year - 79;
    return { shakaOf, samvatsaraOf: (key) => DATA.SAMVATSARA[(shakaOf(key) + 11) % 60] };
  }

  const adBox = (h, w = 198) => h > 0 ? `<div class="ad" style="height:${h}mm">येथे जाहिरात द्या (${dn(w)} × ${dn(h)} मिमी)</div>` : "";
  const adBot = (h, w = 198) => h > 0 ? `<div class="ad bot" style="height:${h}mm">येथे जाहिरात द्या (${dn(w)} × ${dn(h)} मिमी)</div>` : "";
  const page = (inner, adT, adB, extra = "") =>
    `<div class="sheet"><div class="pg ${extra}">${adBox(adT)}${inner}${adBot(adB)}</div></div>`;

  // ---------------------------------------------------------------- month grid
  function dayCell(r, rowh) {
    const n = r.tithi, hol = r.holiday || r.wd === 6, cls = [];
    if (r.holiday) cls.push("hol");
    if (n === 15) cls.push("pur");
    if (n === 30) cls.push("ama");
    const moon = n === 15 ? '<span class="moon f"></span>' : n === 30 ? '<span class="moon n"></span>' : "";
    const items = r.fest.map((x) => `<span class="f">${esc(x)}</span>`)
      .concat(r.vrata.filter((x) => x !== "पौर्णिमा" && x !== "अमावास्या").map((x) => `<span class="v">${esc(x)}</span>`));
    return `<td class="${cls.join(" ")}"><div class="cin" style="height:${(rowh - 0.3).toFixed(2)}mm"><div class="d1">` +
      `<span class="num ${hol ? "red" : ""}">${dn(r.d)}<span class="en">${r.d}</span></span><span class="ts">${moon}${tithiShort(n)}</span></div>` +
      `<div class="tn">${tithiName(n)}</div><div class="nk">${DATA.NAK[r.nak]}</div>` +
      `<div class="ev" style="max-height:${(rowh - 15.5).toFixed(2)}mm">${items.join(" | ")}</div></div></td>`;
  }

  function footerHtml(recs, bottomMm, place) {
    const has = (r, f) => r.vrata.some(f);
    const ek = recs.filter((r) => has(r, (x) => x.includes("एकादशी")))
      .map((r) => `${dn(r.d)} ${r.vrata.find((x) => x.includes("एकादशी")).replace(" एकादशी", "")}`).join("; ");
    const sk = recs.filter((r) => has(r, (x) => x.includes("संकष्ट"))).map((r) => dn(r.d)).join(" ");
    const vi = recs.filter((r) => r.vrata.includes("विनायकी चतुर्थी")).map((r) => dn(r.d)).join(" ");
    const pr = recs.flatMap((r) => r.vrata.filter((x) => x.includes("प्रदोष")).map((x) => `${dn(r.d)} (${x.split(" ")[0]})`)).join(", ");
    const ms = recs.filter((r) => has(r, (x) => x.includes("मासिक शिवरात्री"))).map((r) => dn(r.d)).join(" ");
    const pu = recs.filter((r) => r.vrata.includes("पौर्णिमा")).map((r) => dn(r.d)).join(" ");
    const am = recs.filter((r) => r.vrata.includes("अमावास्या")).map((r) => dn(r.d)).join(" ");
    const a = recs[0], b = recs[recs.length - 1], S = "<i>|</i>";
    const g = (l, v) => `<b>${l}</b> ${v || "—"}`;
    return `<div class="foot" style="bottom:${bottomMm}mm;height:15mm">${[g("एकादशी:", esc(ek)), g("संकष्ट चतुर्थी:", sk), g("विनायकी:", vi)].join(S)}<br>` +
      `${[g("प्रदोष:", esc(pr)), g("मासिक शिवरात्री:", ms), g("पौर्णिमा:", pu), g("अमावास्या:", am)].join(S)}<br>` +
      `<b>सूर्योदय / सूर्यास्त (${esc(place)}):</b> ${dn(1)} तारीख ${T(a.sr, a.key)} / ${T(a.ss, a.key)} – ${dn(b.d)} तारीख ${T(b.sr, b.key)} / ${T(b.ss, b.key)}</div>`;
  }

  function monthPages(y, c, m, o) {
    const recs = y.days.filter((r) => r.m === m), first = recs[0], last = recs[recs.length - 1];
    const [adT, adB] = o.adGrid, [oT, oB] = o.adOther;
    const names = [];
    for (const r of recs) { const nm = (r.adhik ? "अधिक " : "") + DATA.MMONTH[r.month]; if (!names.includes(nm)) names.push(nm); }
    const sa = c.shakaOf(first.key), sb = c.shakaOf(last.key);
    const shk = sa === sb ? dn(sa) : `${dn(sa)}–${dn(sb)}`;
    const s1 = c.samvatsaraOf(first.key), s2 = c.samvatsaraOf(last.key), smv = s1 === s2 ? s1 : `${s1} / ${s2}`;
    const hjs = [], seen = new Set();
    for (const r of recs) { const k = r.hijri[1] + "," + r.hijri[2]; if (!seen.has(k)) { seen.add(k); hjs.push([r.hijri[1], r.hijri[2]]); } }
    const hj = hjs.map((h) => DATA.HIJRI_M[h[0]]).join(" – ") + " " + dn(hjs[hjs.length - 1][1]);
    const vs = dn(sa + 135) + (sa !== sb ? "–" + dn(sb + 135) : "");
    const firstWd = (first.wd + 1) % 7;
    const cells = Array(firstWd).fill(null).concat(recs);
    while (cells.length % 7) cells.push(null);
    const rows = cells.length / 7, hdrH = 16, footH = 15;
    const gapT = adT ? 2 : 0, gapB = adB ? 2 : 0;
    const avail = 284 - (adT + gapT + hdrH + 1.5 + 6 + 1 + footH + gapB + adB);
    const rowh = (avail - 1) / rows;
    const ths = ["रविवार", "सोमवार", "मंगळवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"]
      .map((n, i) => `<th class="${i === 0 ? "sun" : ""}">${n}</th>`).join("");
    let trs = "";
    for (let i = 0; i < rows; i++)
      trs += `<tr style="height:${rowh.toFixed(2)}mm">` + cells.slice(i * 7, i * 7 + 7).map((x) => x ? dayCell(x, rowh) : '<td class="empty"></td>').join("") + "</tr>";
    const hdr = `<div class="hdr" style="height:${hdrH}mm;margin-top:${gapT}mm"><div class="m">${DATA.GREG[m - 1]} <span class="y">${dn(y.year)}</span></div>` +
      `<div class="sub">${names.join(" – ")} &nbsp;|&nbsp; शके ${shk} &nbsp;|&nbsp; ${smv} संवत्सर<br>हिजरी: ${hj} &nbsp;|&nbsp; विक्रम संवत ${vs}</div></div>`;
    const grid = page(hdr + `<table class="cal" style="margin-top:1.5mm"><tr>${ths}</tr>${trs}</table>` + footerHtml(recs, 6 + adB + gapB, y.place), adT, adB);

    // ---- daily table
    const evOf = (r) => {
      const ev = r.fest.concat(r.vrata).filter((x) => x !== "पौर्णिमा" && x !== "अमावास्या").map(esc);
      if (r.tithi === 15 || r.tithi === 30) ev.unshift(tithiName(r.tithi));
      return ev.join(" | ");
    };
    const tavail = 284 - (oT + (oT ? 2 : 0) + 11 + 1.5 + 5.5 + (oB ? 2 : 0) + oB);
    let need = 0;
    for (const r of recs) { need += 5.3; const e = evOf(r); if (e) need += (e.length > 135 ? 7 : 3.9); }
    const k = Math.max(0.6, Math.min(1, tavail / need));
    let trows = "";
    for (const r of recs) {
      const cls = (r.holiday || r.wd === 6) ? "hol" : "", e = evOf(r), n = r.tithi;
      trows += `<tr class="${cls}${e ? "" : " last"}"><td class="dt">${dn(r.d)} ${DATA.WEEK_S[r.wd]}</td>` +
        `<td>${tithiFull(n, r.month, r.adhik)} <b>${T(r.tithiEnd, r.key)}</b></td><td>${DATA.NAK[r.nak]} <b>${T(r.nakEnd, r.key)}</b></td>` +
        `<td>${DATA.YOGA[r.yoga]} <b>${T(r.yogaEnd, r.key)}</b></td><td>${r.karana} <b>${T(r.karanaEnd, r.key)}</b></td>` +
        `<td>${DATA.RASHI[r.rashi]} <b>${T(r.rashiEnd, r.key)}</b></td><td>${T(r.sr, r.key)} / ${T(r.ss, r.key)}</td>` +
        `<td>${dn(r.hijri[0])} ${DATA.HIJRI_M[r.hijri[1]]}</td></tr>`;
      if (e) trows += `<tr class="fe last ${cls}"><td colspan="8">- ${e}</td></tr>`;
    }
    const widths = [15, 37, 32, 24, 24, 22, 22, 22];
    const cg = widths.map((w) => `<col style="width:${w}mm">`).join("");
    const th = ["तारीख/वार", "तिथी (समाप्ती)", "नक्षत्र (समाप्ती)", "योग (समाप्ती)", "करण (समाप्ती)", "चंद्र रास", "सूर्योदय / सूर्यास्त", "हिजरी"]
      .map((x) => `<th>${x}</th>`).join("");
    const inner2 = `<div class="hdr" style="height:11mm;margin-top:${oT ? 2 : 0}mm"><div class="m" style="font-size:14pt">${DATA.GREG[m - 1]} ${dn(y.year)} – दैनंदिन पंचांग</div>` +
      `<div class="sub">${esc(y.place)} | भा.प्र.वे. २४ तास | * = पुढील दिवशी</div></div>` +
      `<table class="pt" style="--k:${k.toFixed(3)}"><colgroup>${cg}</colgroup><tr>${th}</tr>${trows}</table>`;
    return grid + page(inner2, oT, oB);
  }

  // ---------------------------------------------------------------- cover & vrata list
  function cover(y, c, o) {
    const [oT, oB] = o.adOther, D = y.days, d0 = D[0], d1 = D[D.length - 1];
    const sa = c.shakaOf(d0.key), sb = c.shakaOf(d1.key);
    const shk = sa === sb ? dn(sa) : `${dn(sa)}–${dn(sb)}`, vs = sa === sb ? dn(sa + 135) : `${dn(sa + 135)}–${dn(sb + 135)}`;
    const s1 = c.samvatsaraOf(d0.key), s2 = c.samvatsaraOf(d1.key), smv = s1 === s2 ? s1 : `${s1} / ${s2}`;
    const h0 = d0.hijri[2], h1 = d1.hijri[2], hj = h0 === h1 ? dn(h0) : `${dn(h0)}–${dn(h1)}`;
    const g = keyToYMD(y.gudi);
    const hol = D.filter((r) => r.holiday).map((r) => {
      const t = r.fest.filter((x) => !x.includes("संक्रांत") && !x.includes("मास प्रारंभ") && !x.includes("शब-ए")).join("; ");
      return t ? `<tr><td style="width:22mm">${dn(r.d)} ${DATA.GREG[r.m - 1]}</td><td style="width:9mm">${DATA.WEEK_S[r.wd]}</td><td>${esc(t)}</td></tr>` : "";
    }).join("");
    const sk = y.sank.map((s) => `<tr><td>${DATA.RASHI[s.rashi]} संक्रांत</td><td>${dn(s.p.d)} ${DATA.GREG[s.p.m - 1]}, ${hhmm(s.p)}</td></tr>`).join("");
    const ec = y.ecl.length ? y.ecl.map((e) => `<tr><td><b>${e.label}</b></td><td>${dn(e.p.d)} ${DATA.GREG[e.p.m - 1]}, ${hhmm(e.p)} | ${esc(y.place)}: ${e.vis ? "दिसेल" : "दिसणार नाही"}</td></tr>`).join("")
      : "<tr><td>या वर्षात ग्रहण नाही</td></tr>";
    let adh = "या वर्षात अधिक मास नाही.";
    if (y.adhik.length) adh = "अधिक मास: " + y.adhik.map(([m, a, b]) => {
      const A = keyToYMD(a), B = keyToYMD(b);
      return `अधिक ${DATA.MMONTH[m]} (${dn(A.d)} ${DATA.GREG[A.m - 1]} ते ${dn(B.d)} ${DATA.GREG[B.m - 1]})`;
    }).join("; ") + ".";
    const notes = [
      `तिथी, नक्षत्र, योग, करण, चंद्र राशी व सूर्योदय/सूर्यास्त खगोलीय गणिताने (लाहिरी/चित्रपक्ष अयनांश) ${esc(y.place)} साठी काढले आहेत. वेळा भारतीय प्रमाणवेळ, २४ तासांत; * = पुढील दिवशी.`,
      "महिने अमांत पद्धतीचे (अमावास्येला महिना संपतो). " + adh,
      "सण-तिथी निर्णय प्रचलित धर्मशास्त्र नियमांनुसार (सूर्योदय / मध्याह्न / अपराह्न / प्रदोष / निशीथ / चंद्रोदय, भद्रा परिहार) संगणकाद्वारे ठरवले आहेत. तिथी दोन दिवस किंवा क्षय असल्यास छापील पंचांगांत मतभेद संभवतात (उदा. लक्ष्मीपूजन).",
      "* खूण असलेले इस्लामी सण चंद्रदर्शनावर अवलंबून; हिजरी तारखा अंदाजित, ±१ दिवस फरक शक्य.",
      "मुहूर्त / लग्न / चौघडिया समाविष्ट नाहीत. धार्मिक कार्यासाठी स्थानिक पंचांगाशी पडताळणी करावी.",
    ].map((n) => `- ${n}`).join("<br>");
    const inner = `<div class="cover"><div class="big"><div class="yr">${dn(y.year)}</div><h1>मराठी पंचांग दिनदर्शिका</h1>` +
      `<div class="l1">शके ${shk} | ${smv} संवत्सर | विक्रम संवत ${vs} | हिजरी ${hj}</div>` +
      `<div class="l2">शके ${dn(c.shakaOf(y.gudi))} चा प्रारंभ: गुढीपाडवा, ${dn(g.d)} ${DATA.GREG[g.m - 1]} ${dn(g.y)} &nbsp;|&nbsp; स्थळ: ${esc(y.place)}</div></div>` +
      `<div class="cols"><div class="col"><h3>सुट्ट्या व प्रमुख सण</h3><table>${hol}</table></div>` +
      `<div class="col"><h3>संक्रांती (सूर्याचा राशीप्रवेश)</h3><table>${sk}</table><h3 style="margin-top:3mm">ग्रहणे ${dn(y.year)}</h3><table>${ec}</table>` +
      `<h3 style="margin-top:3mm">माहिती व टीप</h3><div class="notes">${notes}</div></div></div></div>`;
    return page(inner, oT, oB);
  }

  function vrataPage(y, o) {
    const [oT, oB] = o.adOther;
    const secs = { "एकादशी": [], "संकष्ट चतुर्थी (चंद्रोदय)": [], "विनायकी चतुर्थी": [], "प्रदोष": [], "मासिक शिवरात्री": [], "पौर्णिमा": [], "अमावास्या": [] };
    for (const r of y.days) {
      const ds = `${dn(r.d)} ${DATA.GREG[r.m - 1].slice(0, 3)} (${DATA.WEEK_S[r.wd]})`;
      for (const t of r.vrata) {
        if (t.includes("एकादशी")) secs["एकादशी"].push(`${ds} – ${t.replace(" एकादशी", "")}`);
        else if (t.includes("संकष्ट")) {
          const mm = t.match(/चंद्रोदय ([०-९:]+)/);
          secs["संकष्ट चतुर्थी (चंद्रोदय)"].push(`${ds} – ${mm && !t.includes("तिथी नाही") ? mm[1] : "प्रदोष"}`);
        } else if (t === "विनायकी चतुर्थी") secs["विनायकी चतुर्थी"].push(ds);
        else if (t.includes("प्रदोष")) secs["प्रदोष"].push(ds);
        else if (t.includes("शिवरात्री")) secs["मासिक शिवरात्री"].push(ds);
        else if (t === "पौर्णिमा") secs["पौर्णिमा"].push(ds);
        else if (t === "अमावास्या") secs["अमावास्या"].push(ds);
      }
    }
    const body = Object.entries(secs).map(([k, v]) => `<h4>${k}</h4>` + v.map((x) => `<div class="i">${esc(x)}</div>`).join("")).join("");
    const inner = `<div class="hdr" style="height:11mm;margin-top:${oT ? 2 : 0}mm"><div class="m" style="font-size:14pt">व्रते व उपवास – यादी ${dn(y.year)}</div>` +
      `<div class="sub">स्मार्त / भागवत भेद दर्शवला आहे</div></div><div class="list3">${body}</div>`;
    return page(inner, oT, oB);
  }

  function renderAll(y, o) {
    const opts = { adGrid: [28, 28], adOther: [20, 20], ...(o || {}) };
    const c = ctx(y);
    let html = cover(y, c, opts);
    for (let m = 1; m <= 12; m++) html += monthPages(y, c, m, opts);
    return html + vrataPage(y, opts);
  }

  const api = { renderAll };
  if (typeof module !== "undefined") module.exports = api; else root.Render = api;
})(typeof self !== "undefined" ? self : globalThis);
