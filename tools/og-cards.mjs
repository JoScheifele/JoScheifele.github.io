// Erzeugt die Open-Graph-Vorschaubilder (1200 × 630) für LinkedIn & Co.
// Aufruf im Projektordner:  node tools/og-cards.mjs
// Braucht Chrome/Edge (headless) und ffmpeg (PNG → JPG). Ausgabe: assets/img/og/*.jpg

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "assets/img/og");

const CARDS = [
  {
    file: "home",
    eyebrow: "Test Engineer · Mechanical Engineering · Analog Photography",
    title: "Jo Patrick<br><em>Scheifele</em>",
    sub: "I test, document, and evaluate. In between, I expose 36 frames on film.",
    image: "assets/img/portrait.jpg",
    portrait: true,
    position: "50% 20%",
  },
  {
    file: "bachelor-thesis",
    eyebrow: "PRJ-001 · Bachelor thesis · Object Detection",
    title: "AI-based<br><em>Video Analysis</em>",
    sub: "Automating the evaluation of driver assistance tests with a fine-tuned YOLO model.",
    image: "assets/img/projects/bachelor-thesis-card.jpg",
    position: "0% 0%",
  },
  {
    file: "camera-model",
    eyebrow: "PRJ-002 · Course project · Multibody Simulation",
    title: "Simulating an<br><em>Analog Camera</em>",
    sub: "A 1984 Canon T70 rebuilt in MATLAB Simscape Multibody.",
    image: "assets/img/projects/camera-model/card.jpg",
  },
  {
    file: "bmw-e46",
    eyebrow: "PRJ-003 · Personal · Garage",
    title: "BMW E46<br><em>330Ci</em>",
    sub: "A 2002 convertible I have owned since 2018 – a piece of art on wheels.",
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
      linear-gradient(rgba(20,20,20,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(20,20,20,.06) 1px, transparent 1px),
      linear-gradient(rgba(20,20,20,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(20,20,20,.035) 1px, transparent 1px);
    background-size: 40px 40px, 40px 40px, 8px 8px, 8px 8px;
    color: #111; font-family: "IBM Plex Sans", sans-serif;
    display: grid; grid-template-columns: 1fr 400px; grid-template-rows: 100%; gap: 56px; padding: 60px 64px;
  }
  .text { display: flex; flex-direction: column; min-width: 0; }
  .eyebrow { font: 500 15px/1.4 "IBM Plex Mono", monospace; letter-spacing: .08em;
             text-transform: uppercase; color: #4a4a4a; display: flex; gap: 12px; align-items: baseline; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #2e7d4f; flex: none; transform: translateY(-1px); }
  h1 { font: 400 92px/.95 "Instrument Serif", serif; letter-spacing: -.01em; margin-top: 36px; white-space: nowrap; }
  h1 em { font-style: italic; color: #2e7d4f; }
  .sub { font-size: 24px; line-height: 1.45; color: #4a4a4a; margin-top: 28px; max-width: 32ch; }
  .foot { margin-top: auto; font: 500 17px "IBM Plex Mono", monospace; color: #767676; letter-spacing: .04em;
          border-top: 1px solid #dcdcd8; padding-top: 18px; display: flex; justify-content: space-between; }
  .foot b { font-weight: 500; color: #2e7d4f; }
  .frame { position: relative; align-self: center; height: 100%; background: #fff; padding: 12px;
           border: 1px solid #dcdcd8; }
  .frame img { width: 100%; height: 100%; object-fit: cover; display: block;
               object-position: ${c.position ?? "50% 50%"}; }
  /* Passermarken wie ums Portrait auf der Seite */
  .mark { position: absolute; width: 22px; height: 22px; border-color: #2e7d4f; border-style: solid; }
  .tl { top: -12px; left: -12px; border-width: 2px 0 0 2px; }
  .br { bottom: -12px; right: -12px; border-width: 0 2px 2px 0; }
</style></head>
<body>
  <div class="text">
    <p class="eyebrow"><span class="dot"></span>${c.eyebrow}</p>
    <h1>${c.title}</h1>
    <p class="sub">${c.sub}</p>
    <p class="foot"><span>${c.portrait ? "Portfolio" : "Jo Patrick Scheifele"}</span><b>joscheifele.github.io</b></p>
  </div>
  <div class="frame"><img src="${url(c.image)}" alt=""><span class="mark tl"></span><span class="mark br"></span></div>
</body></html>`;

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "og-"));
try {
  for (const c of CARDS) {
    const html = join(tmp, `${c.file}.html`);
    const png = join(tmp, `${c.file}.png`);
    writeFileSync(html, page(c));
    execFileSync(exe, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
      "--force-device-scale-factor=1", "--window-size=1200,630", "--virtual-time-budget=3000",
      `--user-data-dir=${join(tmp, "profile")}`, `--screenshot=${png}`, pathToFileURL(html).href,
    ], { stdio: "ignore" });
    const jpg = join(OUT, `${c.file}.jpg`);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", png, "-q:v", "3", jpg]);
    console.log("  ok ", jpg.slice(ROOT.length + 1));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
