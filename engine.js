/* Marathi panchang engine (JavaScript port).
   Astronomy: astronomy-engine (Sun/Moon positions, rise/set, eclipses) + Lahiri ayanamsa.
   Works in a Web Worker (importScripts) and in Node (for testing). */
(function (root) {
  const A = (typeof Astronomy !== "undefined") ? Astronomy : require("astronomy-engine");
  const DATA = (typeof module !== "undefined") ? require("./data.js") : root.DATA;

  const DAY = 86400000, IST = 5.5 * 3600000, SYNODIC = 29.530588853;
  const DEV = "०१२३४५६७८९";
  const dn = (x) => String(x).replace(/[0-9]/g, (d) => DEV[+d]);
  const mod = (a, n) => ((a % n) + n) % n;

  // ---------------- time helpers (ms since epoch, UTC) ----------------
  const istMs = (y, m, d, h = 0) => Date.UTC(y, m - 1, d) + h * 3600000 - IST;
  function parts(ms) {                                  // IST wall-clock parts, rounded to the minute
    const r = Math.round((ms + IST) / 60000) * 60000, d = new Date(r);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes(),
             wd: (d.getUTCDay() + 6) % 7, key: Math.floor(r / DAY) };
  }
  const dayKey = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / DAY);   // calendar-day number (IST date)
  const keyToYMD = (k) => { const d = new Date(k * DAY); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
  const T = (ms) => A.MakeTime(new Date(ms));

  // ---------------- astronomy ----------------
  // Lahiri ayanamsa as used by Swiss Ephemeris sidereal mode (mean precession + nutation terms),
  // least-squares calibrated against Swiss Ephemeris over 1900-2100 (max residual 0.5 arcsec).
  const AYC = [23.857091086440875, 1.3968869222676288, 0.0003115053124196636, -0.004780694289292517, 1.7039451599245518e-06, -0.00036634700707841895, -2.2114497798823208e-07, -6.314988880262719e-05, 2.0010259628726955e-07];
  function ayanamsa(ms) {
    const t = (ms / DAY + 2440587.5 - 2451545.0) / 36525, r = Math.PI / 180;
    const om = (125.04452 - 1934.136261 * t) * r, ls = (280.4665 + 36000.7698 * t) * r, lm = (218.3165 + 481267.8813 * t) * r;
    return AYC[0] + AYC[1] * t + AYC[2] * t * t + AYC[3] * Math.sin(om) + AYC[4] * Math.cos(om)
         + AYC[5] * Math.sin(2 * ls) + AYC[6] * Math.cos(2 * ls) + AYC[7] * Math.sin(2 * lm) + AYC[8] * Math.cos(2 * lm);
  }
  const sunTrop = (ms) => A.SunPosition(T(ms)).elon;
  const moonTrop = (ms) => A.EclipticGeoMoon(T(ms)).lon;
  const sunSid = (ms) => mod(sunTrop(ms) - ayanamsa(ms), 360);
  const moonSid = (ms) => mod(moonTrop(ms) - ayanamsa(ms), 360);
  const elong = (ms) => mod(moonTrop(ms) - sunTrop(ms), 360);
  const yogaAng = (ms) => mod(moonSid(ms) + sunSid(ms), 360);
  const tithiAt = (ms) => Math.floor(elong(ms) / 12) + 1;
  const MIN = 60000;

  function nextCross(fn, ms, period, spanDays = 2) {
    const target = (Math.floor(fn(ms) / period) + 1) * period;
    const delta = (t) => mod(fn(t) - target + 180, 360) - 180;
    let lo = ms, hi = ms + spanDays * DAY;
    for (let i = 0; i < 30; i++) {                      // 2 days / 2^30 < 1 ms
      const mid = (lo + hi) / 2;
      if (delta(mid) < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function karanaAt(ms) {
    const n = Math.floor(elong(ms) / 6) + 1;
    if (n === 1 || n >= 58) return DATA.KARANA_FIXED[String(n)];
    return DATA.KARANA_MOVING[(n - 2) % 7];
  }
  function findNewMoons(msStart, msEnd) {
    const out = []; let t = msStart;
    while (t < msEnd) {
      let a = t, lo, hi;
      for (;;) {
        const b = a + 0.5 * DAY;
        if (elong(b) < elong(a) - 180) { lo = a; hi = b; break; }
        a = b;
      }
      for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (elong(mid) > 180) lo = mid; else hi = mid; }
      const nm = (lo + hi) / 2; out.push(nm); t = nm + 20 * DAY;
    }
    return out;
  }

  function easter(y) {                                  // Gregorian Easter (Meeus)
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
          g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
          l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
          month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return dayKey(y, month, day);
  }

  const tithiName = (n) => n === 15 ? "पौर्णिमा" : n === 30 ? "अमावास्या" : DATA.TITHI[(n - 1) % 15];
  function tithiFull(n, month, adhik) {
    const k = (n - 1) % 15 + 1, pk = n <= 15 ? "शुद्ध" : "वद्य";
    const pre = month == null ? "" : (adhik ? "अधिक " : "") + DATA.MMONTH[month] + " ";
    return (n === 15 || n === 30) ? pre + tithiName(n) : `${pre}${pk} ${DATA.TITHI[k - 1]}`;
  }

  // ======================================================================
  function build(year, lat, lon, place, progress) {
    const tick = (p, m) => { if (progress) progress(p, m); };
    const obs = new A.Observer(lat, lon, 0);
    const D0 = dayKey(year, 1, 1), D1 = dayKey(year + 1, 1, 1), nd = D1 - D0;
    const dMs = (key, h = 0) => key * DAY + h * 3600000 - IST;     // IST midnight of a day key -> UTC ms

    const riseSet = (body, dir, fromMs) => {
      const r = A.SearchRiseSet(body, obs, dir, T(fromMs), 2, 0);
      return r ? r.date.getTime() : NaN;
    };
    const sunrise = (key) => riseSet(A.Body.Sun, +1, dMs(key));
    const sunset = (key) => riseSet(A.Body.Sun, -1, dMs(key));
    const moonriseAfter = (ms) => riseSet(A.Body.Moon, +1, ms);

    // ---- new moons & lunar months
    tick(2, "new moons");
    const newMoons = findNewMoons(dMs(dayKey(year - 1, 11, 20)), dMs(dayKey(year + 1, 3, 15)));
    const nmInfo = [];
    for (let i = 0; i < newMoons.length - 1; i++) {
      const rs = Math.floor(sunSid(newMoons[i]) / 30), re = Math.floor(sunSid(newMoons[i + 1]) / 30);
      nmInfo.push([(rs + 1) % 12, rs === re]);
    }
    const lunarMonth = (ms) => {
      let lo = 0, hi = newMoons.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (newMoons[mid] <= ms) lo = mid; else hi = mid; }
      return [nmInfo[lo][0], nmInfo[lo][1], newMoons[lo]];
    };

    // ---- Hijri (moon visibility estimate); anchor = Ramadan 1448 starting after new moon of 6 Feb 2027
    const anchor = findNewMoons(dMs(dayKey(2027, 2, 3)), dMs(dayKey(2027, 2, 12)))[0];
    const hStarts = [];
    for (const nm of newMoons) {
      const d0 = parts(nm).key;
      for (let k = 0; k < 3; k++) {
        const key = d0 + k, ss = sunset(key);
        if (ss <= nm) continue;
        const el = Math.abs(mod(moonTrop(ss) - sunTrop(ss) + 180, 360) - 180);
        if ((ss - nm) / 3600000 >= 19 && el >= 9.5) {
          const lun = Math.round((nm - anchor) / DAY / SYNODIC);
          hStarts.push([key + 1, mod(8 + lun, 12), 1448 + Math.floor((8 + lun) / 12)]);
          break;
        }
      }
    }
    const hijriOf = (key) => {
      let cur = hStarts[0];
      for (const h of hStarts) if (h[0] <= key) cur = h;
      return [key - cur[0] + 1, cur[1], cur[2]];
    };

    // ---- daily records
    const DAYS = [];
    for (let i = 0; i < nd; i++) {
      const key = D0 + i, sr = sunrise(key), ss = sunset(key), nsr = sunrise(key + 1), t = sr + MIN;
      const [mi, adhik] = lunarMonth(t);
      const ymd = keyToYMD(key);
      DAYS.push({
        key, y: ymd.y, m: ymd.m, d: ymd.d, wd: (new Date(key * DAY).getUTCDay() + 6) % 7,
        sr, ss, nsr, month: mi, adhik, tithi: tithiAt(t), tithiEnd: nextCross(elong, t, 12),
        nak: Math.floor(moonSid(t) / (360 / 27)), nakEnd: nextCross(moonSid, t, 360 / 27),
        yoga: Math.floor(yogaAng(t) / (360 / 27)), yogaEnd: nextCross(yogaAng, t, 360 / 27),
        karana: karanaAt(t), karanaEnd: nextCross(elong, t, 6),
        rashi: Math.floor(moonSid(t) / 30), rashiEnd: nextCross(moonSid, t, 30),
        hijri: hijriOf(key), fest: [], vrata: [], holiday: false });
      if (i % 15 === 0) tick(5 + 40 * i / nd, "daily panchang");
    }
    const findDay = (key) => DAYS[key - D0];

    // ---- Gudi Padwa / Shaka
    let gudi = null;
    for (const r of DAYS) if (r.month === 0 && !r.adhik && r.tithi <= 2 && r.m >= 3) { gudi = r.key; break; }
    if (gudi === null) gudi = dayKey(year, 4, 1);
    const shakaOf = (key) => key >= gudi ? year - 78 : year - 79;

    // ---- rule helpers
    const kindTime = (kind, r) => {
      const sr = r.sr, ss = r.ss, L = ss - sr;
      switch (kind) {
        case "sunrise": return sr + MIN;
        case "aruna": return sr - 60 * MIN;
        case "madhyahna": return sr + L / 2;
        case "aparahna": return sr + 0.7 * L;
        case "pradosh": return ss + 45 * MIN;
        case "nishita": return ss + (r.nsr - ss) / 2;
      }
    };
    const kc = new Map();
    const kt = (i, kind) => {
      const k = i * 8 + ["sunrise", "aruna", "madhyahna", "aparahna", "pradosh", "nishita"].indexOf(kind);
      if (!kc.has(k)) { const t = kindTime(kind, DAYS[i]), m = lunarMonth(t); kc.set(k, [m[0], m[1], tithiAt(t)]); }
      return kc.get(k);
    };
    const add = (key, text, hol = false, vrata = false) => {
      if (key < D0 || key >= D1) return;
      const r = findDay(key);
      if (!r.fest.includes(text) && !r.vrata.includes(text)) (vrata ? r.vrata : r.fest).push(text);
      if (hol) r.holiday = true;
    };
    const tithiDates = (month, tithi, kinds) => {
      for (const kind of kinds) {
        const found = [];
        for (let i = 0; i < nd; i++) { const v = kt(i, kind); if (v[0] === month && !v[1] && v[2] === tithi) found.push(DAYS[i].key); }
        if (found.length) return found;
      }
      const before = tithi > 1 ? tithi - 1 : 30, after = tithi < 30 ? tithi + 1 : 1, out = [];
      for (const r of DAYS) {
        const t = r.sr + MIN, t2 = r.nsr + MIN, m = lunarMonth(t2);
        if (m[0] === month && !m[1] && tithiAt(t) === before && tithiAt(t2) === after) out.push(r.key);
      }
      return out;
    };

    // ---- festivals
    DATA.FEST.forEach((f, idx) => {
      const [m, pk, k, kinds, label, hol] = f;
      let n = k + (pk ? 15 : 0); if (k === 15 && pk === 1) n = 30;
      let dates = tithiDates(m, n, kinds), note = "";
      const vishti = (tt) => karanaAt(tt).startsWith("विष्टी");
      if (label.startsWith("होळी") && dates.length) {
        let d0 = dates[0]; const tp = kindTime("pradosh", findDay(d0));
        if (vishti(tp)) {
          const bend = nextCross(elong, tp, 6);
          if (bend <= dMs(d0 + 1)) note = " (भद्रा समाप्तीनंतर)"; else { d0 += 1; note = " (भद्रा काळ टाळून)"; }
        }
        dates = [d0];
      }
      if (label.startsWith("नारळी")) {
        let cand = tithiDates(m, n, ["aparahna"]).filter((dd) => !vishti(kindTime("aparahna", findDay(dd))));
        if (!cand.length) { cand = tithiDates(m, n, ["sunrise"]); if (!cand.length) cand = tithiDates(m, n, ["madhyahna"]); }
        dates = cand;
      }
      if (dates.length) {
        const i0 = dates[0] - D0;
        let lab = label + note;
        if (kinds.every((kd) => kt(i0, kd)[2] !== n) && !note) lab += " (तिथी क्षय – वेळ पाहावी)";
        if (m === 0 && k === 1 && pk === 0) {
          const sk = shakaOf(dates[0]);
          lab = `गुढीपाडवा – हिंदू नववर्ष शके ${dn(sk)} प्रारंभ (${DATA.SAMVATSARA[(sk + 11) % 60]} संवत्सर)`;
        }
        add(dates[0], lab, hol);
      }
      if (idx % 6 === 0) tick(48 + 20 * idx / DATA.FEST.length, "festivals");
    });

    for (let i = 1; i < nd; i++) {
      const r = DAYS[i], pv = DAYS[i - 1];
      if (r.month !== pv.month || r.adhik !== pv.adhik) add(r.key, (r.adhik ? "अधिक " : "") + DATA.MMONTH[r.month] + " मास प्रारंभ");
    }
    for (const r of DAYS) if (r.month === 4 && !r.adhik) {
      if (r.wd === 0) add(r.key, "श्रावणी सोमवार");
      if (r.wd === 1) add(r.key, "मंगळागौरी पूजन");
    }

    // ---- vratas
    for (let i = 0; i < nd; i++) {
      const r = DAYS[i], n = r.tithi, pk = n <= 15 ? 0 : 1;
      const prevSame = i > 0 && DAYS[i - 1].tithi === n, nextSame = i + 1 < nd && DAYS[i + 1].tithi === n;
      if (n === 11 || n === 26) {
        let nm = DATA.EK_NAMES[`${r.month},${pk}`] || "";
        if (r.adhik) nm = "अधिक मास – " + (pk === 0 ? "पद्मिनी" : "परम");
        add(r.key, `${nm} एकादशी${prevSame ? " (भागवत)" : nextSame ? " (स्मार्त)" : ""}`, false, true);
      }
      const tm = kindTime("madhyahna", r);
      for (const [tt, lab] of [[15, "पौर्णिमा"], [30, "अमावास्या"]]) if (n === tt || tithiAt(tm) === tt) add(r.key, lab, false, true);
    }
    const VIN = new Set();
    for (const r of DAYS) {
      const mr = moonriseAfter(r.ss - 3600000);
      if (!isNaN(mr) && parts(mr).key === r.key && tithiAt(mr) === 19) {
        const p = parts(mr), nm = r.wd === 1 ? "अंगारकी संकष्टी चतुर्थी" : "संकष्ट चतुर्थी";
        add(r.key, `${nm} (चंद्रोदय ${dn(String(p.H).padStart(2, "0") + ":" + String(p.M).padStart(2, "0"))})`, false, true);
        r.sankashti = true;
      }
      if (tithiAt(kindTime("madhyahna", r)) === 4 && !VIN.has(r.key - 1)) { VIN.add(r.key); add(r.key, "विनायकी चतुर्थी", false, true); }
      const tp = tithiAt(kindTime("pradosh", r));
      if (tp === 13 || tp === 28) add(r.key, `${DATA.WEEK_S[r.wd]} प्रदोष`, false, true);
      if (tithiAt(kindTime("nishita", r)) === 29 && !r.fest.some((x) => x.includes("महाशिवरात्री"))) add(r.key, "मासिक शिवरात्री", false, true);
    }
    for (let i = 0; i < nd - 1; i++) if (DAYS[i].sankashti && DAYS[i + 1].sankashti) {
      DAYS[i].vrata = DAYS[i].vrata.filter((x) => !x.includes("संकष्ट")); DAYS[i].sankashti = false;
    }
    const have = new Set(), done = new Set();
    for (const r of DAYS) if (r.sankashti) have.add(lunarMonth(r.sr)[2]);
    for (const r of DAYS) {
      const s0 = lunarMonth(r.sr)[2];
      if (have.has(s0) || done.has(s0)) continue;
      if (tithiAt(kindTime("pradosh", r)) === 19) {
        done.add(s0);
        add(r.key, r.wd === 1 ? "अंगारकी संकष्टी चतुर्थी" : "संकष्ट चतुर्थी (चंद्रोदयाला तिथी नाही – प्रदोषकाळ; चंद्रोदय पाहावा)", false, true);
      }
    }
    tick(72, "sankranti");

    // ---- sankrantis
    const SANK = [];
    let t = dMs(D0) - 35 * DAY;
    for (let i = 0; i < 16; i++) {
      const t2 = nextCross(sunSid, t, 30, 40), p = parts(t2);
      if (p.y === year) SANK.push({ ms: t2, p, rashi: Math.floor(sunSid(t2 + 10000) / 30) });
      t = t2 + 5 * DAY;
    }
    const hm = (p) => dn(String(p.H).padStart(2, "0") + ":" + String(p.M).padStart(2, "0"));
    for (const s of SANK) {
      const key = s.p.key;
      if (s.rashi === 9) {
        add(key, `मकर संक्रांत (सूर्य मकर राशीत – ${hm(s.p)})`);
        if (s.ms > findDay(key).ss) add(key + 1, "मकर संक्रांत (पुण्यकाल)");
      } else add(key, `${DATA.RASHI[s.rashi]} संक्रांत (${hm(s.p)})`);
    }

    // ---- fixed observances, Easter, Hijri festivals
    for (const [m, d, txt, hol] of DATA.FIXED) add(dayKey(year, m, d), txt, hol);
    const es = easter(year);
    add(es - 2, "गुड फ्रायडे", true); add(es, "ईस्टर संडे");
    const HOL = ["1,10", "10,1", "12,10", "3,12"];
    for (const r of DAYS) {
      const [hd, hmn] = r.hijri, key = `${hmn + 1},${hd}`;
      for (const [a, b, txt] of DATA.HFEST) if (`${a},${b}` === key) add(r.key, txt + " *", HOL.includes(key));
    }
    tick(80, "eclipses");

    // ---- eclipses
    const ECL = [];
    const horizonAlt = (body, tm) => { const eq = A.Equator(body, tm, obs, true, true); return A.Horizon(tm, obs, eq.ra, eq.dec, "normal").altitude; };
    const yEnd = new Date(dMs(D1));
    let se = A.SearchGlobalSolarEclipse(T(dMs(D0)));
    while (se.peak.date < yEnd) {
      let vis = false;
      try {
        const loc = A.SearchLocalSolarEclipse(A.MakeTime(new Date(se.peak.date.getTime() - 2 * DAY)), obs);
        if (Math.abs(loc.peak.time.date - se.peak.date) < DAY)
          vis = [loc.partial_begin, loc.peak, loc.partial_end].some((e) => e && e.altitude > 0);
      } catch (e) {}
      ECL.push({ type: "sun", kind: se.kind, ms: se.peak.date.getTime(), vis });
      se = A.NextGlobalSolarEclipse(se.peak);
    }
    let le = A.SearchLunarEclipse(T(dMs(D0)));
    while (le.peak.date < yEnd) {
      let vis = false;
      if (le.kind !== "penumbral") {
        const half = (le.sd_partial || 0) * 60000;
        vis = [le.peak.date.getTime() - half, le.peak.date.getTime(), le.peak.date.getTime() + half]
          .some((x) => horizonAlt(A.Body.Moon, T(x)) > 0);
      }
      ECL.push({ type: "moon", kind: le.kind, ms: le.peak.date.getTime(), vis });
      le = A.NextLunarEclipse(le.peak);
    }
    ECL.sort((a, b) => a.ms - b.ms);
    const eclLabel = (e) => e.type === "moon"
      ? (e.kind === "penumbral" ? "छायाकल्प चंद्रग्रहण" : (e.kind === "total" ? "खग्रास " : "खंडग्रास ") + "चंद्रग्रहण")
      : (e.kind === "annular" ? "कंकणाकृती " : (e.kind === "total" || e.kind === "hybrid") ? "खग्रास " : "खंडग्रास ") + "सूर्यग्रहण";
    for (const e of ECL) {
      e.p = parts(e.ms); e.label = eclLabel(e);
      const k = e.p.key;
      add(k, e.type === "moon" && e.kind === "penumbral" ? e.label + " (उपछाया – धार्मिक नियम लागू नाहीत)"
        : e.label + (e.vis ? ` (${place} येथून दिसेल)` : ` (${place} येथून दिसणार नाही)`));
    }

    const adhik = [];
    for (const r of DAYS) if (r.adhik) {
      if (!adhik.length || adhik[adhik.length - 1][0] !== r.month) adhik.push([r.month, r.key, r.key]); else adhik[adhik.length - 1][2] = r.key;
    }
    tick(85, "done");
    return { year, place, lat, lon, days: DAYS, sank: SANK, ecl: ECL, gudi, adhik };
  }

  const api = { build, dn, tithiName, tithiFull, parts, keyToYMD, dayKey, DATA };
  if (typeof module !== "undefined") module.exports = api; else root.Panchang = api;
})(typeof self !== "undefined" ? self : globalThis);
