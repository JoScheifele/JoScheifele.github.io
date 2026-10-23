"""Statische Checks für index.html – nur Python-Standardbibliothek.

Aufruf (im Projektordner):  python tests/static_check.py
Exit-Code 0 = alles ok, 1 = mindestens ein Fehler.
"""
from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"


class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []          # (tag, attrs-dict, line)
        self.stack = []
        self.unbalanced = []
        self.text = []          # sichtbarer Text + aria-labels (ohne Kommentare/Skripte)

    def handle_data(self, data):
        if not (self.stack and self.stack[-1][0] in ("script", "style")):
            self.text.append(data)

    VOID = {"meta", "link", "img", "br", "hr", "input", "source", "area", "base", "col", "embed", "track", "wbr", "path"}

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs), self.getpos()[0]))
        for k, v in attrs:
            if k in ("aria-label", "alt", "content", "title") and v:
                self.text.append(v)
        if tag not in self.VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self.tags.append((tag, dict(attrs), self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()
        else:
            self.unbalanced.append((tag, self.getpos()[0]))


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    p = Collector()
    p.feed(html)
    errors, passed, warnings = [], [], []

    def check(ok, msg):
        (passed if ok else errors).append(msg)

    tags = p.tags
    by = lambda name: [t for t in tags if t[0] == name]

    # Dokument-Grundlagen
    html_tag = by("html")
    check(html_tag and html_tag[0][1].get("lang") == "en", "<html lang=\"en\"> gesetzt")

    # Seite ist englisch: keine deutschen UI-Reste im sichtbaren Text / in ARIA-Labels
    import re
    visible = " ".join(p.text)
    german = re.findall(r"\b(Platzhalter|Über|und|oder|Kontakt|Projekte|Werdegang|schließen|öffnen|"
                        r"Bild|Menü|Zum Inhalt|Nach oben|heute|Ort)\b", visible)
    check(not german, f"keine deutschen UI-Texte {sorted(set(german)) or ''}")
    check(any(t[1].get("name") == "viewport" for t in by("meta")), "meta viewport vorhanden")
    check(any(t[1].get("name") == "description" for t in by("meta")), "meta description vorhanden")
    check(len(by("title")) == 1, "genau ein <title>")
    check(len(by("h1")) == 1, "genau eine <h1>")

    # Tag-Balance
    check(not p.unbalanced and not p.stack,
          f"Tags ausgeglichen (offen: {p.stack[:3]}, falsch geschlossen: {p.unbalanced[:3]})")

    # IDs eindeutig
    ids = [t[1]["id"] for t in tags if "id" in t[1]]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    check(not dupes, f"IDs eindeutig {dupes or ''}")

    # Anker-Links zeigen auf existierende IDs
    idset = set(ids)
    broken = [(t[1]["href"], t[2]) for t in by("a")
              if t[1].get("href", "").startswith("#") and len(t[1]["href"]) > 1
              and t[1]["href"][1:] not in idset]
    check(not broken, f"alle #Anker-Ziele existieren {broken or ''}")

    # aria-controls / aria-labelledby Ziele
    refs = [(a, t[1][a], t[2]) for t in tags for a in ("aria-controls", "aria-labelledby") if a in t[1]]
    missing = [r for r in refs if r[1] not in idset]
    check(not missing, f"ARIA-Referenzen gültig {missing or ''}")

    # Bilder brauchen alt, Platzhalter brauchen aria-label
    no_alt = [t[2] for t in by("img") if "alt" not in t[1]]
    check(not no_alt, f"alle <img> haben alt (Zeilen {no_alt or '-'})")
    role_img = [t for t in tags if t[1].get("role") == "img"]
    check(all("aria-label" in t[1] for t in role_img), "alle role=img haben aria-label")

    # Externe Links in neuem Tab mit rel=noopener
    unsafe = [t[2] for t in by("a") if t[1].get("target") == "_blank" and "noopener" not in t[1].get("rel", "")]
    check(not unsafe, f"target=_blank nur mit rel=noopener (Zeilen {unsafe or '-'})")

    # Lokale Dateien existieren
    local = []
    for tag, attrs, line in tags:
        for attr in ("src", "href"):
            v = attrs.get(attr, "")
            if v and not v.startswith(("http", "#", "mailto:", "tel:", "data:")):
                local.append((v, line))
    missing_files = [(v, l) for v, l in local if not (ROOT / v.split("?")[0]).exists()]
    check(not missing_files, f"lokale Dateien existieren {missing_files or ''}")

    # Sektionen laut Anforderung
    for sec in ("hero", "about", "experience", "projects", "gallery", "contact"):
        check(sec in idset, f"Sektion #{sec} vorhanden")
    check(len([t for t in by("article") if "project" in t[1].get("class", "").split()]) == 3, "3 Projekt-Karten")
    shots = [t for t in by("figure") if "shot" in t[1].get("class", "").split()]
    check(len(shots) >= 10, f"mind. 10 Galerie-Kacheln ({len(shots)})")

    # Relative Pfade (wichtig für GitHub Pages unter /repo-name/)
    abs_paths = [(v, l) for v, l in local if v.startswith("/")]
    check(not abs_paths, f"keine absoluten Pfade (GitHub-Pages-kompatibel) {abs_paths or ''}")

    # Datenschutz: keine Seite lädt Ressourcen von fremden Servern (Fonts, Skripte, Bilder, Embeds).
    # Normale Links (<a href="https://...">) sind erlaubt – sie übertragen erst beim Klick Daten.
    import re as _re
    external = []
    all_pages = [*sorted(ROOT.glob("*.html")), *sorted((ROOT / "projects").glob("*.html"))]
    for page in all_pages:
        src = page.read_text(encoding="utf-8")
        for m in _re.finditer(r"<(link|script|img|video|audio|source|iframe|embed|object)\b[^>]*?"
                              r"\b(?:src|href|poster|data)=\"(https?:)?//[^\"]+\"", src, _re.I):
            external.append(f"{page.relative_to(ROOT)}:{src.count(chr(10), 0, m.start()) + 1}")
        external += [f"{page.relative_to(ROOT)}: url(http...)" for _ in _re.findall(r"url\(\s*['\"]?https?:", src)]
    for css in (ROOT / "css").glob("*.css"):
        external += [f"{css.relative_to(ROOT)}: @import/url extern"
                     for _ in _re.findall(r"(?:@import|url\()\s*['\"]?https?:", css.read_text(encoding="utf-8"))]
    check(not external, f"keine externen Ressourcen auf allen Seiten {external or ''}")

    # Rechtliches: jede Seite verlinkt Impressum + Datenschutz im Footer
    for name in ("imprint.html", "privacy.html"):
        check((ROOT / name).exists(), f"{name} vorhanden")
    no_legal = []
    for page in all_pages:
        footer = page.read_text(encoding="utf-8").split('<footer class="site-footer">')[-1]
        if not (_re.search(r'href="(\.\./)?imprint\.html"', footer) and _re.search(r'href="(\.\./)?privacy\.html"', footer)):
            no_legal.append(str(page.relative_to(ROOT)))
    check(not no_legal, f"alle Seiten verlinken Impressum + Datenschutz im Footer {no_legal or ''}")

    # Linkvorschau (LinkedIn & Co.): Open-Graph-Tags vollständig, og:url passt zur Datei,
    # og:image zeigt absolut auf die Live-Seite und die Datei existiert lokal
    live = "https://joscheifele.github.io/"
    og_bad = []
    for page in all_pages:
        src = page.read_text(encoding="utf-8")
        og = dict(_re.findall(r'<meta property="og:([\w:]+)" content="([^"]*)"', src))
        rel = page.relative_to(ROOT).as_posix()
        missing = [k for k in ("type", "title", "description", "url", "image", "image:alt") if not og.get(k)]
        if missing:
            og_bad.append(f"{rel}: fehlt {missing}")
            continue
        if og["url"] != live + ("" if rel == "index.html" else rel):
            og_bad.append(f"{rel}: og:url {og['url']}")
        img = og["image"]
        if not img.startswith(live) or not (ROOT / img[len(live):]).exists():
            og_bad.append(f"{rel}: og:image {img}")
    check(not og_bad, f"Open-Graph-Tags vollständig, Vorschaubilder vorhanden {og_bad or ''}")

    # Offene Platzhalter (<mark class="todo">) – nur Warnung, kein Fehler
    for page in all_pages:
        n = page.read_text(encoding="utf-8").count('class="todo"')
        if n:
            warnings.append(f"{page.relative_to(ROOT)}: {n} offene Platzhalter (vor dem Online-Stellen ausfüllen)")

    for m in passed:
        print(f"  PASS  {m}")
    for m in errors:
        print(f"  FAIL  {m}")
    for m in warnings:
        print(f"  WARN  {m}")
    print(f"\n{len(passed)} bestanden, {len(errors)} fehlgeschlagen, {len(warnings)} Warnungen")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
