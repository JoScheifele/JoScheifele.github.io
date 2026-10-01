# Jo Patrick Scheifele – Portfolio

Personal portfolio website: test engineering, mechanical/automotive engineering and analog photography.

Plain HTML, CSS and JavaScript – no frameworks, no build step. Deployable as-is on GitHub Pages or Cloudflare Pages.

## Sections

- **Hero** – name, tagline, portrait
- **About** – profile and skills
- **Experience** – work and education timelines
- **Projects** – project cards
- **Photography** – mosaic gallery for photos and videos with lightbox
- **Contact** – email and social links

## Structure

```
index.html              Single page with all sections
css/styles.css          Styling (design tokens in :root)
js/main.js              Navigation, scroll effects, hero animation, lightbox
assets/                 Favicon, images, videos
docs/DOKUMENTATION.md   Detailed project documentation (German)
tests/                  Static and browser tests
```

## Run locally

Open `index.html` directly in the browser, or start a local server in the project folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Tests

```bash
python tests/static_check.py
node tests/browser_test.mjs
```

- `static_check.py` – HTML structure, anchors, ARIA references, alt texts, local files, relative paths (Python standard library only)
- `browser_test.mjs` – headless Chrome/Edge via the DevTools protocol on desktop, tablet and mobile viewports; saves full-page screenshots to `tests/screenshots/` (Node ≥ 22, no npm packages)

## Adding photos

```html
<figure class="shot shot--tall">
  <img src="assets/img/gallery/11.jpg" alt="Short description" loading="lazy">
  <figcaption>Location · Portra 400 · 2025</figcaption>
</figure>
```

Tile sizes: none (1×1), `shot--wide` (2×1), `shot--tall` (1×2), `shot--big` (2×2).
See [docs/DOKUMENTATION.md](docs/DOKUMENTATION.md) for details.

## Deployment

**GitHub Pages:** push to `main` → *Settings → Pages* → Deploy from branch `main`, folder `/ (root)`.

**Cloudflare Pages:** connect the repository, framework preset *None*, no build command, output directory `/`.
