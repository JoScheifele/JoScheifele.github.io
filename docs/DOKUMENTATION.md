# Portfolio-Website – Projektdokumentation

Statische Portfolio-Seite, reines HTML/CSS/JS ohne Frameworks oder Build-Schritt.
Direkt deploybar über **GitHub Pages** oder **Cloudflare Pages**.

**Sprache der Website: Englisch** (`<html lang="en">`). Code-Kommentare und diese Doku
bleiben deutsch. Inhalte stammen aus dem Lebenslauf (Stand 2026) plus der aktuellen
Werkstudentenstelle bei ABB Ratingen (Entwicklung).

---

## 1. Projektstruktur

```
Website/
├── index.html              Startseite, alle Sektionen
├── projects/
│   ├── bachelor-thesis.html  Projektseite PRJ-001 (Bachelorarbeit, Poster)
│   ├── camera-model.html     Artikel PRJ-002 (Kameramodell in Simscape, Blog-Layout mit Videos)
│   └── bmw-e46.html          PRJ-003 (eigenes Auto: Fotos, Arbeitsliste, Lightbox)
├── css/styles.css          Komplettes Styling (Design-Tokens oben in :root)
├── js/main.js              Navigation, Scroll-Effekte, Lissajous-Animation, Lightbox
├── assets/
│   ├── favicon.svg
│   ├── img/                portrait.jpg, projects/ (Karten-Bild + Poster), gallery/ (01–10.jpg)
│   └── video/camera-model/ Simulationsvideos (1080 px, H.264, ohne Ton) + Standbilder
├── docs/DOKUMENTATION.md   Diese Datei
├── tests/
│   ├── static_check.py     Statische HTML-Prüfung (Python-Stdlib)
│   ├── browser_test.mjs    Browser-Test via Headless-Chrome (Node ≥ 22)
│   └── screenshots/        Wird von den Tests erzeugt (gitignored)
├── _originals/            Originaldateien in voller Auflösung (gitignored, nicht veröffentlicht)
├── .nojekyll               Sagt GitHub Pages: kein Jekyll-Processing
└── .gitignore
```

> Videos für die Seite: schwarze Ränder abschneiden, auf ~1080 px verkleinern, ohne Ton,
> `-movflags +faststart` (siehe ffmpeg-Aufruf im Änderungsprotokoll). Videos mit `data-autoplay`
> laufen nur, solange sie sichtbar sind, und gar nicht bei „Bewegung reduzieren".

## 2. Sektionen

| # | ID            | Inhalt                                                        |
|---|---------------|---------------------------------------------------------------|
| – | `#hero`       | Name, Tagline, CTA-Buttons, Kurzdaten (ABB, M.Sc., Düsseldorf), Portrait (Platzhalter) |
| 01| `#about`      | Profiltext + Skill-Gruppen: Testing, Software, Languages, Off the clock |
| 02| `#experience` | Zwei Timelines: *Work* (ABB, Rhythm Automotive, AVL-Schrick, Zivildienst, Ausbildung) und *Education* (HSD, TH Köln, BM1) |
| 03| `#projects`   | 3 Projekt-Karten; #1 = Bachelorarbeit (KI-Videoauswertung), #2/#3 Platzhalter |
| 04| `#gallery`    | Foto-/Video-Mosaik mit 10 Fotos + Lightbox                    |
| 05| `#contact`    | Mail-Link + Social-Links (kein Formular → kein Backend nötig) |

> Bewusst **nicht** auf der Seite: die Telefonnummer aus dem CV (öffentliche Seiten werden
> von Bots nach Nummern und Adressen durchsucht).

## 3. Design-Konzept: „Technisch, aber artsy"

- **Farben:** Helles Grau `#f5f5f3` als Hintergrund, weiße Karten, schwarzer Text `#111111`,
  **dezentes Grün** `#2e7d4f` als einziger Akzent, gedämpftes Graugrün als Zweitakzent.
  Alle Werte als CSS-Variablen in `:root` → zentral änderbar.
- **Typografie:** *Instrument Serif* (editoriale Headlines, kursiv für Akzentwörter),
  *IBM Plex Sans* (Fließtext), *IBM Plex Mono* (Labels, Metadaten, Nummern).
  **Lokal gehostet** in `assets/fonts/` (woff2, Zeichensätze latin + latin-ext), eingebunden
  über `css/fonts.css`. Kein Abruf von Google-Servern → keine Übertragung der Besucher-IP an
  Google (DSGVO). Lizenz: SIL Open Font License 1.1, Lizenztexte liegen daneben.
  Die Tests prüfen, dass keine Seite Ressourcen von fremden Servern lädt.
- **Hintergrundmuster:** Millimeterpapier (8 px fein / 40 px grob), per Maske weich
  ausgeblendet, plus ein kaum sichtbares **Filmkorn** (SVG-Rauschen). Beides fixiert,
  rein per CSS, keine Bilddateien.
- **Hero-Animation:** Eine **Lissajous-Figur** (3:4) wie auf einem Oszilloskop, deren Phase
  langsam durchläuft. Pausiert, wenn der Hero nicht sichtbar ist.
- **Technische Details:** Bemaßungslinien und Passermarken ums Portrait, `§ 01`-Sektionsnummern,
  Timeline-Punkte als Rauten, Platzhalter mit Schnitt-Schraffur (wie in technischen Zeichnungen).
- **Analog-Details:** Filmstreifen-Leiste über der Galerie, Bildnummern `01A`, `02A` …
  automatisch per CSS-Counter.

## 4. Galerie erweitern

Das Raster ist ein CSS-Grid mit 4 Spalten (Mobile: 2) und `grid-auto-flow: dense`.
Kachelgrößen per Modifier-Klasse:

| Klasse         | Größe (Spalten × Zeilen) | Gut für            |
|----------------|--------------------------|--------------------|
| *(keine)*      | 1 × 1                    | Standard           |
| `shot--wide`   | 2 × 1                    | Querformat, Video  |
| `shot--tall`   | 1 × 2                    | Hochformat         |
| `shot--big`    | 2 × 2                    | Highlights         |

Neues Bild:

```html
<figure class="shot shot--tall">
  <img src="assets/img/gallery/11.jpg" alt="Kurze Bildbeschreibung" loading="lazy">
  <figcaption>Ort · Portra 400 · 2025</figcaption>
</figure>
```

Video: statt `<img>` →
`<video src="assets/video/clip.mp4" muted loop playsinline preload="metadata"></video>`
(in der Lightbox bekommt es automatisch Controls).

**Lückenlos bleiben:** Ein 4-Spalten-Raster ist voll, wenn die Summe der Zellen durch 4
teilbar ist (normal = 1, wide/tall = 2, big = 4). Die aktuelle Belegung ergibt 20 Zellen = 5 Reihen.
`dense` füllt kleinere Lücken selbst; der Browser-Test „Galerie-Raster ohne Lücken" meldet es sonst.

**Originale** in voller Auflösung liegen in `_originals/` (per `.gitignore` nicht veröffentlicht).

**Bildgrößen:** Fotos vorher auf ca. 1600–2000 px lange Kante und als JPG (Qualität ~80)
oder WebP exportieren, sonst lädt die Seite langsam.

## 5. Platzhalter ersetzen – Checkliste

- [x] Name, Standort, Werdegang, Ausbildung, Skills, Sprachen, E-Mail (aus CV)
- [x] Portrait (`assets/img/portrait.jpg`)
- [x] ABB: Start Oktober 2026 eingetragen
- [ ] ABB: konkrete Aufgaben ergänzen, sobald bekannt (aktuell allgemeine Beschreibung)
- [x] Rhythm Automotive: Apr 2026 – Sep 2026
- [x] Projekt 1: Fokus auf Object Detection mit YOLO, Tag „PyQt5" entfernt
- [x] Projekt 1: Detailseite `projects/bachelor-thesis.html` mit Übersicht, Ablauf und Poster (kein Download, NDA); Kartenbild = Ausschnitt aus dem Poster
- [x] Projekt 2: Artikel `projects/camera-model.html` (aus Präsentation + Bericht)
- [x] Projekt 3: `projects/bmw-e46.html` (Kennzeichen auf den Web-Fotos unkenntlich gemacht)
- [x] LinkedIn- und Instagram-URLs im Kontakt
- [ ] GitHub-Link wieder ergänzen, sobald dort Projekte liegen
- [x] Galerie: 10 echte Fotos (Motiv · Ort); Film/Jahr können ergänzt werden

### Vor dem Online-Stellen (Rechtliches)

- [x] **Anschrift:** bewusst nur „Jo Patrick Scheifele, Düsseldorf" + E-Mail, ohne Straße (private, nicht-kommerzielle Seite).
      Restrisiko bekannt: § 18 Abs. 1 MStV verlangt Name + Anschrift, sobald eine Seite nicht ausschließlich
      persönlichen/familiären Zwecken dient – bei einem Bewerbungs-Portfolio ist das auslegungsfähig.
      Falls nötig: vollständige Adresse oder Impressum-Adressdienst nachtragen.
- [x] **Hoster:** GitHub Pages (`privacy.html` Abschnitt 03, Variante A). Für Cloudflare Pages die im
      HTML-Kommentar vorbereitete „Variante B" einsetzen.
- [x] DPF-Zertifizierung des Hosters geprüft (2026-10-22): GitHub, San Francisco – EU-U.S. DPF *Active*
      (<https://www.dataprivacyframework.gov/list>). Gelegentlich erneut prüfen.
- [ ] Betreuer (AVL) hat Poster freigegeben; Projektseite zur Durchsicht geschickt

## 6. Barrierefreiheit & Qualität

- Semantisches HTML (`header/nav/main/section/article/footer`), genau eine `h1`
- Skip-Link „Zum Inhalt springen", sichtbare Fokus-Ringe
- Hamburger-Menü mit `aria-expanded` / `aria-controls`, Escape schließt
- Galerie-Kacheln per Tastatur bedienbar (Tab + Enter), Lightbox mit Fokus-Falle,
  Pfeiltasten, Escape, Swipe auf Touch
- `prefers-reduced-motion` wird respektiert (keine Animationen, statische Lissajous-Figur)
- Ohne JavaScript bleibt alles sichtbar (`no-js`-Fallback)
- Nur relative Pfade → funktioniert auch unter `username.github.io/repo-name/`

## 7. Lokal ansehen

**Variante A – Doppelklick:** `index.html` im Explorer öffnen. Funktioniert, da nichts
per `fetch` geladen wird.

**Variante B – lokaler Server (empfohlen, verhält sich wie GitHub Pages):**

```bash
python -m http.server 8000
```

im Projektordner ausführen, dann <http://localhost:8000> öffnen. Beenden mit `Strg+C`.

Alternativ in VS Code die Extension „Live Server" (lädt bei jeder Änderung automatisch neu).

## 8. Tests

```bash
python tests/static_check.py
node tests/browser_test.mjs
```

**`static_check.py`** (23 Checks): `lang="en"`, keine deutschen UI-Reste im sichtbaren Text
bzw. in ARIA-Labels, viewport, description, genau eine `h1`,
ausgeglichene Tags, eindeutige IDs, alle `#anker` existieren, ARIA-Referenzen gültig,
`alt`/`aria-label` bei Bildern, `rel="noopener"`, lokale Dateien existieren, alle Sektionen,
3 Projekte, ≥ 10 Galerie-Kacheln, keine absoluten Pfade.

**`browser_test.mjs`** (20 Checks): startet eigenen Static-Server + Headless-Chrome/Edge
(über das DevTools-Protokoll, keine npm-Pakete nötig) und prüft auf **Desktop 1280 px,
Mobile 375 px, Tablet 768 px**: keine JS-Fehler, kein horizontales Scrollen, Menü- und
Hamburger-Verhalten, Scroll-Spy, Reveal-Animation, Lissajous-Zeichnung, Galerie-Spalten
und -Spans, lückenloses Raster, Lightbox (öffnen, blättern inkl. Umlauf, schließen,
Fokus, Scroll-Lock), Tastaturbedienbarkeit, Tap-Target-Größe. Speichert ganzseitige
Screenshots nach `tests/screenshots/`.

Falls Chrome/Edge nicht gefunden wird: Umgebungsvariable `CHROME_PATH` setzen.

> Hinweis: In den Ganzseiten-Screenshots erscheint der fixierte Header an der Scroll-Position
> des letzten Tests statt oben. Das ist ein Artefakt der Screenshot-Methode, kein Layout-Fehler.

## 9. Deployment

**Live seit 2026-10-23:** <https://joscheifele.github.io/>

| | |
|---|---|
| Repository | [JoScheifele/JoScheifele.github.io](https://github.com/JoScheifele/JoScheifele.github.io) (öffentlich) |
| Hosting | GitHub Pages, *Deploy from a branch*: `main`, Ordner `/ (root)` |
| Custom Domain | keine (Stand 2026-10-23) |

**Änderungen veröffentlichen:** committen und auf `main` pushen (Kommandozeile oder GitHub Desktop).
Die Aktion „pages build and deployment“ baut die Seite neu, nach ca. 1 min ist sie live.
Status: Repo → *Actions*.

> Wird in den Pages-Einstellungen eine Custom Domain ein- oder ausgetragen, legt GitHub selbst
> einen Commit an (Datei `CNAME`). Danach lokal `git pull`, sonst schlägt der nächste Push fehl.

### Eigene Domain (optional, später)
1. Domain kaufen (z. B. `joscheifele.de`, Stand 2026-10-23 noch nicht registriert)
2. DNS beim Anbieter: vier `A`-Einträge für `@` → `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153`; vier `AAAA` → `2606:50c0:8000::153` bis `2606:50c0:8003::153`;
   `CNAME` für `www` → `joscheifele.github.io`
3. Repo → *Settings → Pages → Custom domain*: `joscheifele.de` (ohne `https://`, ohne `www`), danach `git pull`
4. *Enforce HTTPS* anhaken, sobald das Zertifikat da ist
5. Domain im Account verifizieren (*Settings → Pages → Add a domain*, TXT-Eintrag)

### Cloudflare Pages
1. *Workers & Pages → Create → Pages → Connect to Git* → Repo wählen
2. Framework preset: *None*, Build command: leer, Output directory: `/`
3. Jeder Push auf `main` deployt automatisch

## 10. Änderungsprotokoll

| Datum      | Änderung |
|------------|----------|
| 2026-09-26 | Grundgerüst: Struktur, Navigation, alle Sektionen, Styling, JS-Interaktionen |
| 2026-09-26 | Galerie-Belegung angepasst (Lücke in letzter Reihe behoben), Mobile-Hero: Text vor Portrait |
| 2026-09-26 | Tests (statisch + Browser), Dokumentation, Git-Repo |
| 2026-09-26 | Website auf Englisch umgestellt, echte Inhalte aus dem CV eingesetzt, Werdegang in *Work*/*Education* geteilt, Test auf deutsche Textreste ergänzt |
| 2026-09-26 | Daten ABB (ab Okt 2026) und Rhythm (bis Sep 2026) präzisiert, GitHub-Link entfernt, Projekt 1 auf YOLO Object Detection fokussiert |
| 2026-09-26 | Projekt 3: Seite BMW E46 330Ci mit 5 Filmfotos (Kennzeichen verpixelt), Arbeitsliste, kompakte Galerie + Lightbox, Browser-Tests |
| 2026-09-26 | Projekt 2: Artikel Kameramodell (Simscape), 5 Videos via `ffmpeg -vf "crop=1620:1056:150:0,scale=1080:-2" -crf 26 -an -movflags +faststart`, Artikel-CSS, Video-Autoplay-Modul, Browser-Tests |
| 2026-09-26 | Farbschema hell (Weiß/Grau, schwarzer Text, grüner Akzent), echte Social-Links, Portrait, 10 Galerie-Fotos, Projektseite Bachelorarbeit inkl. Browser-Tests |
| 2026-10-01 | Schriften lokal gehostet statt Google Fonts (DSGVO), Tests auf externe Requests ergänzt, Git-Historie vor der Veröffentlichung zu einem Commit zusammengefasst |
| 2026-10-01 | Bachelorarbeit-Seite entschärft (YOLO statt YOLOv11, Labeling-Methoden allgemein); Impressum (`imprint.html`) und Datenschutzerklärung (`privacy.html`) mit Adress-Platzhaltern, Footer-Links auf allen Seiten, Tests inkl. Platzhalter-Warnung |
| 2026-10-22 | Umzug auf neuen Rechner. Impressum/Datenschutz: nur Name + Düsseldorf + E-Mail (keine Straße), Hoster = GitHub Pages, DPF-Status von GitHub geprüft |
| 2026-10-23 | Veröffentlicht: GitHub-Account in `JoScheifele` umbenannt, Repo `JoScheifele.github.io` (öffentlich), Pages aktiv unter <https://joscheifele.github.io/>; vorher geprüft: keine Originale im Repo, Kennzeichen unkenntlich, keine GPS-Daten in Bildern |

## 11. Mögliche nächste Schritte

- Echte Inhalte und Bilder einsetzen (siehe Checkliste Abschnitt 5)
- Projekt-Detailseiten (`projects/projekt-1.html`) mit gleichem Stylesheet
- Open-Graph-Meta-Tags + Vorschaubild für LinkedIn-Shares
- Responsive Bilder (`srcset`) bzw. WebP für schnellere Galerie
- Eigene Domain über Cloudflare
- Optional: Sprachumschalter DE/EN
