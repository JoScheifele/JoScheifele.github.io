// Erzeugt die Open-Graph-Vorschaubilder für LinkedIn & Co.
// Aufruf im Projektordner:  node tools/og-cards.mjs
// Braucht Chrome/Edge (headless). Ausgabe: assets/img/og/*.png
//
// Layout 1200 × 630 (Seitenverhältnis 1,91 : 1), gerendert mit doppelter Pixeldichte
// → 2400 × 1260 px PNG. LinkedIn zeigt die Karte im Feed nur ~550 px breit und komprimiert
// neu: deshalb wenig Text, große Schrift, kein feines Raster, verlustfrei als PNG.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "assets/img/og");

const CARDS = [
  {
    file: "home",
    label: "Portfolio",
    title: "Jo Patrick<br><em>Scheifele</em>",
    sub: "Test engineer &amp; analog photographer",
    image: "assets/img/portrait.jpg",
    position: "50% 20%",
  },
  {
    file: "bachelor-thesis",
    label: "Bachelor thesis",
    title: "AI-based<br><em>Video Analysis</em>",
    sub: "YOLO for driver assistance tests",
    image: "assets/img/projects/bachelor-thesis-card.jpg",
    position: "0% 0%",
  },
  {
    file: "camera-model",
    label: "Simulation project",
    title: "Simulating an<br><em>Analog Camera</em>",
    sub: "A Canon T70 in Simscape",
    image: "assets/img/projects/camera-model/card.jpg",
  },
  {
    file: "bmw-e46",
    label: "Garage project",
    title: "BMW E46<br><em>330Ci</em>",
    sub: "My convertible since 2018",
    image: "assets/img/projects/e46/card.jpg",
  },
];

const exe = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!exe) { console.error("Kein Chrome/Edge gefunden – setze CHROME_PATH."); process.exit(2); }

const url = (p) => pathToFileURL(join(ROOT, p)).href;

// Gleiche Tokens wie in css/styles.css (:root)
const page = (c) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link rel="stylesheet" href="${url("css/fonts.css")}">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    background-color: #f5f5f3;
    background-image:
      linear-gradient(rgba(20,20,20,.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(20,20,20,.05) 1px, transparent 1px);
    background-size: 40px 40px;
    color: #111; font-family: "IBM Plex Sans", sans-serif;
    display: grid; grid-template-columns: 1fr 400px; grid-template-rows: 100%; gap: 56px; padding: 64px 64px 64px 72px;
  }
  .text { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
  .label { font: 500 26px/1 "IBM Plex Mono", monospace; letter-spacing: .06em; text-transform: uppercase;
           color: #2e7d4f; display: flex; gap: 14px; align-items: center; }
  .dot { width: 14px; height: 14px; border-radius: 50%; background: #2e7d4f; flex: none; }
  h1 { font: 400 108px/.95 "Instrument Serif", serif; letter-spacing: -.01em; margin-top: 40px; white-space: nowrap; }
  h1 em { font-style: italic; color: #2e7d4f; }
  .sub { font-size: 34px; line-height: 1.25; color: #333; margin-top: 36px; }
  .frame { position: relative; background: #fff; padding: 12px; border: 1px solid #dcdcd8; }
  .frame img { width: 100%; height: 100%; object-fit: cover; display: block;
               object-position: ${c.position ?? "50% 50%"}; }
  /* Passermarken wie ums Portrait auf der Seite */
  .mark { position: absolute; width: 26px; height: 26px; border-color: #2e7d4f; border-style: solid; }
  .tl { top: -14px; left: -14px; border-width: 3px 0 0 3px; }
  .br { bottom: -14px; right: -14px; border-width: 0 3px 3px 0; }
</style></head>
<body>
  <div class="text">
    <p class="label"><span class="dot"></span>${c.label}</p>
    <h1>${c.title}</h1>
    <p class="sub">${c.sub}</p>
  </div>
  <div class="frame"><img src="${url(c.image)}" alt=""><span class="mark tl"></span><span class="mark br"></span></div>
</body></html>`;

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "og-"));
try {
  for (const c of CARDS) {
    const html = join(tmp, `${c.file}.html`);
    const png = join(OUT, `${c.file}.png`);
    writeFileSync(html, page(c));
    execFileSync(exe, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
      "--force-device-scale-factor=2", "--window-size=1200,630", "--virtual-time-budget=3000",
      `--user-data-dir=${join(tmp, "profile")}`, `--screenshot=${png}`, pathToFileURL(html).href,
    ], { stdio: "ignore" });
    console.log(`  ok  ${png.slice(ROOT.length + 1)}  (${Math.round(statSync(png).size / 1024)} KB)`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
