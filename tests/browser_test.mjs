/**
 * Browser-Test ohne Abhängigkeiten (Node >= 22, Chrome oder Edge installiert).
 * Startet einen kleinen Static-Server, steuert Headless-Chrome per DevTools-Protokoll,
 * prüft Verhalten auf Desktop & Mobile und speichert ganzseitige Screenshots.
 *
 * Aufruf (im Projektordner):  node tests/browser_test.mjs
 */
import http from "node:http";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, extname, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = join(ROOT, "tests", "screenshots");
const PORT = 8765, DEBUG_PORT = 9333;

const BROWSERS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].filter(Boolean);

/* ---------- Static-Server ---------- */
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
               ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4" };
const server = http.createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = join(ROOT, path === "/" ? "index.html" : path);
  try {
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end("404"); }
});
await new Promise((r) => server.listen(PORT, r));

/* ---------- Browser starten ---------- */
const exe = BROWSERS.find((p) => existsSync(p));
if (!exe) { console.error("Kein Chrome/Edge gefunden – setze CHROME_PATH."); process.exit(2); }
const profile = join(tmpdir(), "portfolio-test-profile-" + Date.now());
const browser = spawn(exe, ["--headless=new", `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--hide-scrollbars", "--disable-gpu", "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: "PUT" })).json(); }
  catch { await sleep(200); }
}

/* ---------- Mini-CDP-Client ---------- */
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0; const pending = new Map(); const listeners = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else listeners.forEach((fn) => fn(msg));
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, (m) => (m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("JS: " + r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
  return r.result.value;
};

const pageErrors = [];
listeners.push((m) => {
  if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push(m.params.args.map((a) => a.value).join(" "));
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") pageErrors.push(m.params.entry.text + " " + (m.params.entry.url || ""));
});

// Datenschutz: jeden Request mitschreiben, der nicht an den lokalen Test-Server geht
const externalRequests = new Set();
listeners.push((m) => {
  if (m.method !== "Network.requestWillBeSent") return;
  const url = m.params.request.url;
  if (/^(data|blob|about):/.test(url)) return;
  if (new URL(url).hostname !== "localhost") externalRequests.add(url);
});
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable"); await send("Network.enable");

/* ---------- Test-Helfer ---------- */
const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push([true, name]); }
  catch (e) { results.push([false, name + "  →  " + e.message]); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg || "Assertion fehlgeschlagen"); };

const load = async (width, height, mobile, path = "/") => {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  const loaded = new Promise((r) => listeners.push((m) => m.method === "Page.loadEventFired" && r()));
  await send("Page.navigate", { url: `http://localhost:${PORT}${path}` });
  await loaded;
  await evaluate("document.fonts.ready.then(() => true)");
  await sleep(300);
};

const fullScreenshot = async (file) => {
  await evaluate(`document.documentElement.style.scrollBehavior='auto';
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-visible')); true`);
  await sleep(1000);
  const { cssContentSize: s } = await send("Page.getLayoutMetrics");
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: s.width, height: s.height, scale: 1 } });
  await writeFile(join(SHOTS, file), Buffer.from(data, "base64"));
};

await mkdir(SHOTS, { recursive: true });

/* ================= DESKTOP 1280 × 800 ================= */
await load(1280, 800, false);

await test("Desktop: keine JS-Fehler beim Laden", async () => assert(pageErrors.length === 0, pageErrors.join(" | ")));
await test("Desktop: Schriften lokal geladen (alle drei Familien aktiv)", async () => {
  const r = await evaluate(`(async () => {
    await Promise.all(['400 16px "Instrument Serif"', 'italic 400 16px "Instrument Serif"',
      '400 16px "IBM Plex Sans"', '600 16px "IBM Plex Sans"', '400 16px "IBM Plex Mono"'].map(f => document.fonts.load(f)));
    const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, ''));
    const files = performance.getEntriesByType('resource').map(e => e.name).filter(n => n.endsWith('.woff2'));
    return { families: [...new Set(loaded)].sort(), files, allLocal: files.every(n => n.includes('/assets/fonts/')) };
  })()`);
  assert(r.families.length === 3, "geladene Familien: " + r.families);
  assert(r.files.length > 0 && r.allLocal, "Font-Dateien: " + r.files.join(", "));
});
await test("Desktop: kein horizontales Scrollen", async () => {
  const [sw, cw] = await evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]");
  assert(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
});
await test("Desktop: no-js-Klasse entfernt (JS aktiv)", async () =>
  assert(!(await evaluate("document.documentElement.classList.contains('no-js')"))));
await test("Desktop: Menü sichtbar, Hamburger versteckt", async () => {
  const [menu, toggle] = await evaluate(`[getComputedStyle(document.getElementById('nav-menu')).visibility,
    getComputedStyle(document.querySelector('.nav__toggle')).display]`);
  assert(menu === "visible" && toggle === "none", `menu=${menu}, toggle=${toggle}`);
});
await test("Desktop: Lissajous-Pfad wird gezeichnet", async () => {
  const len = await evaluate("document.getElementById('lissajous-path').getAttribute('d').length");
  assert(len > 1000, "d-Länge " + len);
});
await test("Desktop: Header bekommt beim Scrollen Hintergrund", async () => {
  const v = await evaluate(`document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0, 600);
    new Promise(r => setTimeout(() => r(document.querySelector('.site-header').classList.contains('is-scrolled')), 150))`);
  assert(v);
});
await test("Desktop: Scroll-Spy markiert aktive Sektion", async () => {
  const active = await evaluate(`document.getElementById('projects').scrollIntoView();
    new Promise(r => setTimeout(() => r(document.querySelector('.nav__link.is-active')?.getAttribute('href')), 400))`);
  assert(active === "#projects", "aktiv: " + active);
});
await test("Desktop: Reveal-Elemente werden beim Scrollen sichtbar", async () => {
  const v = await evaluate(`new Promise(r => setTimeout(() =>
    r(document.querySelector('#projects .project').classList.contains('is-visible')), 300))`);
  assert(v);
});
await test("Desktop: Galerie 4 Spalten, --big spannt 2×2", async () => {
  const r = await evaluate(`(() => {
    const g = getComputedStyle(document.getElementById('gallery-grid')).gridTemplateColumns.split(' ').length;
    const big = document.querySelector('.shot--big').getBoundingClientRect();
    const n = document.querySelector('.shot:not([class*="--"])').getBoundingClientRect();
    return { g, wRatio: big.width / n.width, hRatio: big.height / n.height };
  })()`);
  assert(r.g === 4, "Spalten: " + r.g);
  assert(r.wRatio > 1.9 && r.hRatio > 1.9, JSON.stringify(r));
});
await test("Desktop: Galerie-Raster ohne Lücken", async () => {
  const r = await evaluate(`(() => {
    const grid = document.getElementById('gallery-grid').getBoundingClientRect();
    const shots = [...document.querySelectorAll('.shot')].map(s => s.getBoundingClientRect());
    const area = shots.reduce((a, s) => a + s.width * s.height, 0);
    const bottom = Math.max(...shots.map(s => s.bottom));
    return { fill: area / (grid.width * (bottom - grid.top)) };
  })()`);
  // Gaps (14px) verringern den Füllgrad; > 0.85 heißt: keine leeren Zellen
  assert(r.fill > 0.85, "Füllgrad " + r.fill.toFixed(2));
});
await test("Desktop: Lightbox öffnen / blättern / schließen", async () => {
  const r = await evaluate(`(async () => {
    const lb = document.getElementById('lightbox');
    const wait = () => new Promise(r => setTimeout(r, 50));
    document.querySelectorAll('.shot')[2].click(); await wait();
    const opened = !lb.hidden, cap1 = lb.querySelector('.lightbox__caption').textContent;
    const focusInside = lb.contains(document.activeElement);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); await wait();
    const cap2 = lb.querySelector('.lightbox__caption').textContent;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })); await wait();
    const cap3 = lb.querySelector('.lightbox__caption').textContent;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await wait();
    return { opened, focusInside, cap1, cap2, cap3, closed: lb.hidden, scrollLock: document.body.style.overflow };
  })()`);
  assert(r.opened, "nicht geöffnet");
  assert(r.focusInside, "Fokus nicht in Lightbox");
  assert(r.cap1.startsWith("3 / 10"), "cap1: " + r.cap1);
  assert(r.cap2.startsWith("4 / 10"), "cap2: " + r.cap2);
  assert(r.cap3.startsWith("1 / 10"), "cap3 (Umlauf rückwärts): " + r.cap3);
  assert(r.closed && r.scrollLock === "", "nicht sauber geschlossen");
});
await test("Desktop: Galerie-Kacheln per Tastatur erreichbar", async () => {
  const r = await evaluate(`[...document.querySelectorAll('.shot')].every(s => s.tabIndex === 0 && s.getAttribute('role') === 'button')`);
  assert(r);
});
await fullScreenshot("desktop-1280.png");

/* ================= MOBILE 375 × 812 ================= */
pageErrors.length = 0;
await load(375, 812, true);

await test("Mobile: keine JS-Fehler", async () => assert(pageErrors.length === 0, pageErrors.join(" | ")));
await test("Mobile: kein horizontales Scrollen", async () => {
  const [sw, cw, culprits] = await evaluate(`[document.documentElement.scrollWidth, document.documentElement.clientWidth,
    [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1
      && getComputedStyle(e).position !== 'fixed' && !e.closest('.hero__lissajous, .filmstrip')).slice(0,5).map(e => e.className || e.tagName)]`);
  assert(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}; ${culprits}`);
});
await test("Mobile: Hamburger öffnet und schließt Menü", async () => {
  const r = await evaluate(`(async () => {
    const t = document.querySelector('.nav__toggle'), m = document.getElementById('nav-menu');
    const visibleBefore = getComputedStyle(t).display !== 'none';
    t.click(); await new Promise(r => setTimeout(r, 350));
    const open = m.classList.contains('is-open') && t.getAttribute('aria-expanded') === 'true'
      && getComputedStyle(m).visibility === 'visible';
    m.querySelector('a[href="#gallery"]').click(); await new Promise(r => setTimeout(r, 350));
    const closed = !m.classList.contains('is-open') && t.getAttribute('aria-expanded') === 'false';
    return { visibleBefore, open, closed };
  })()`);
  assert(r.visibleBefore && r.open && r.closed, JSON.stringify(r));
});
await test("Mobile: Galerie 2 Spalten", async () => {
  const g = await evaluate("getComputedStyle(document.getElementById('gallery-grid')).gridTemplateColumns.split(' ').length");
  assert(g === 2, "Spalten: " + g);
});
await test("Mobile: Projekte einspaltig", async () => {
  const g = await evaluate("getComputedStyle(document.querySelector('.projects')).gridTemplateColumns.split(' ').length");
  assert(g === 1, "Spalten: " + g);
});
await test("Mobile: Tap-Targets der Navigation ≥ 44px", async () => {
  const h = await evaluate("document.querySelector('.nav__toggle').getBoundingClientRect().height");
  assert(h >= 44, "Höhe " + h);
});
await fullScreenshot("mobile-375.png");

/* ================= TABLET 768 × 1024 ================= */
await load(768, 1024, true);
await test("Tablet: kein horizontales Scrollen", async () => {
  const [sw, cw] = await evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]");
  assert(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
});
await test("Tablet: Projekte zweispaltig", async () => {
  const g = await evaluate("getComputedStyle(document.querySelector('.projects')).gridTemplateColumns.split(' ').length");
  assert(g === 2, "Spalten: " + g);
});
await fullScreenshot("tablet-768.png");

/* ================= PROJEKTSEITE ================= */
const PROJECT = "/projects/bachelor-thesis.html";
for (const [label, w, h, mobile] of [["Desktop", 1280, 800, false], ["Mobile", 375, 812, true]]) {
  pageErrors.length = 0;
  await load(w, h, mobile, PROJECT);
  await test(`Projektseite ${label}: keine JS-Fehler`, async () => assert(pageErrors.length === 0, pageErrors.join(" | ")));
  await test(`Projektseite ${label}: kein horizontales Scrollen`, async () => {
    const [sw, cw] = await evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]");
    assert(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
  });
  await test(`Projektseite ${label}: Poster geladen`, async () => {
    const ok = await evaluate(`(async () => { const img = document.querySelector('.poster img');
      img.loading = 'eager'; await img.decode().catch(() => {}); return img.naturalWidth > 1000; })()`);
    assert(ok, "Poster-Bild nicht geladen");
  });
  await fullScreenshot(`project-${label.toLowerCase()}.png`);
}

/* ================= ARTIKEL: KAMERAMODELL ================= */
const CAMERA = "/projects/camera-model.html";
for (const [label, w, h, mobile] of [["Desktop", 1280, 800, false], ["Mobile", 375, 812, true]]) {
  pageErrors.length = 0;
  await load(w, h, mobile, CAMERA);
  await test(`Kameramodell ${label}: keine JS-Fehler`, async () => assert(pageErrors.length === 0, pageErrors.join(" | ")));
  await test(`Kameramodell ${label}: kein horizontales Scrollen`, async () => {
    const [sw, cw] = await evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]");
    assert(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
  });
  await test(`Kameramodell ${label}: alle Bilder und Videos ladbar`, async () => {
    const r = await evaluate(`(async () => {
      const imgs = [...document.querySelectorAll('main img')];
      imgs.forEach(i => i.loading = 'eager');
      await Promise.all(imgs.map(i => i.decode().catch(() => {})));
      const vids = [...document.querySelectorAll('main video')];
      await Promise.all(vids.map(v => v.readyState >= 1 ? 0 : new Promise(r => {
        v.addEventListener('loadedmetadata', r, { once: true }); v.addEventListener('error', r, { once: true }); v.load(); })));
      return { badImg: imgs.filter(i => !i.naturalWidth).map(i => i.src),
               badVid: vids.filter(v => !v.videoWidth).map(v => v.currentSrc || v.src), nV: vids.length };
    })()`);
    assert(r.nV === 5, "Videos: " + r.nV);
    assert(!r.badImg.length && !r.badVid.length, JSON.stringify(r));
  });
  await fullScreenshot(`camera-${label.toLowerCase()}.png`);
}

/* ================= AUTO-SEITE ================= */
const CAR = "/projects/bmw-e46.html";
for (const [label, w, h, mobile] of [["Desktop", 1280, 800, false], ["Mobile", 375, 812, true]]) {
  pageErrors.length = 0;
  await load(w, h, mobile, CAR);
  await test(`Auto-Seite ${label}: keine JS-Fehler`, async () => assert(pageErrors.length === 0, pageErrors.join(" | ")));
  await test(`Auto-Seite ${label}: kein horizontales Scrollen`, async () => {
    const [sw, cw] = await evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]");
    assert(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
  });
  await test(`Auto-Seite ${label}: alle Bilder ladbar`, async () => {
    const bad = await evaluate(`(async () => { const imgs = [...document.querySelectorAll('main img')];
      imgs.forEach(i => i.loading = 'eager'); await Promise.all(imgs.map(i => i.decode().catch(() => {})));
      return imgs.filter(i => !i.naturalWidth).map(i => i.src); })()`);
    assert(!bad.length, bad.join(", "));
  });
  await test(`Auto-Seite ${label}: Lightbox öffnet Foto`, async () => {
    const r = await evaluate(`(async () => { const lb = document.getElementById('lightbox');
      document.querySelector('.shot').click(); await new Promise(r => setTimeout(r, 50));
      const ok = !lb.hidden && !!lb.querySelector('.lightbox__stage img');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return ok; })()`);
    assert(r);
  });
  await fullScreenshot(`car-${label.toLowerCase()}.png`);
}

/* ================= IMPRESSUM & DATENSCHUTZ ================= */
for (const page of ["/imprint.html", "/privacy.html"]) {
  for (const [label, w, h, mobile] of [["Desktop", 1280, 800, false], ["Mobile", 375, 812, true]]) {
    pageErrors.length = 0;
    await load(w, h, mobile, page);
    await test(`${page} ${label}: keine JS-Fehler, kein horizontales Scrollen`, async () => {
      const [sw, cw] = await evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]");
      assert(pageErrors.length === 0, pageErrors.join(" | "));
      assert(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
    });
  }
  await fullScreenshot(`legal-${page.slice(1, -5)}-mobile.png`);
}
await test("Footer-Links führen zu Impressum und Datenschutz", async () => {
  await load(1280, 800, false, "/projects/camera-model.html");
  const r = await evaluate(`[...document.querySelectorAll('.site-footer__legal a')].map(a => a.href)`);
  assert(r.length === 2 && r[0].endsWith("/imprint.html") && r[1].endsWith("/privacy.html"), r.join(", "));
});

/* ================= „BACK TO TOP" (alle Seiten) ================= */
// Ziel darf nicht der fixierte Header sein – der ist immer „sichtbar", der Browser scrollt dann nicht
for (const page of ["/", "/projects/bachelor-thesis.html", "/projects/camera-model.html",
                    "/projects/bmw-e46.html", "/imprint.html", "/privacy.html"]) {
  await test(`${page}: „Back to top" scrollt nach oben`, async () => {
    await load(1280, 800, false, page);
    const y = await evaluate(`(async () => {
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, document.documentElement.scrollHeight);
      const a = [...document.querySelectorAll('.site-footer a')].find(a => /back to top/i.test(a.textContent));
      a.click(); await new Promise(r => setTimeout(r, 100)); return scrollY; })()`);
    assert(y === 0, `scrollY nach Klick: ${y}`);
  });
}

/* ================= DATENSCHUTZ (alle Seiten) ================= */
await test("Alle Seiten: keine Requests an externe Server (z. B. Google Fonts)", async () =>
  assert(externalRequests.size === 0, [...externalRequests].join(", ")));

/* ---------- Aufräumen & Bericht ---------- */
ws.close(); browser.kill(); server.close();
await sleep(500);
await rm(profile, { recursive: true, force: true }).catch(() => {});

for (const [ok, name] of results) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
const failed = results.filter((r) => !r[0]).length;
console.log(`\n${results.length - failed} bestanden, ${failed} fehlgeschlagen`);
console.log(`Screenshots: ${SHOTS}`);
process.exit(failed ? 1 : 0);
