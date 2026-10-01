/* ==========================================================================
   Portfolio – main.js
   Kleine, unabhängige Module ohne Abhängigkeiten:
   1. Navigation (Scroll-Zustand, Mobile-Menü, aktiver Link)
   2. Reveal-on-Scroll
   3. Lissajous-Figur im Hero (Oszilloskop-Optik)
   4. Galerie-Lightbox
   5. Autoplay-Videos (Projektseiten)
   ========================================================================== */
(() => {
  "use strict";

  document.documentElement.classList.remove("no-js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* 1. Navigation -------------------------------------------------------- */
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.getElementById("nav-menu");
  const links = [...document.querySelectorAll(".nav__link")];

  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const setMenu = (open) => {
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  links.forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // Aktiven Menüpunkt anhand der sichtbaren Sektion markieren
  // (nur reine #-Anker; Unterseiten verlinken auf ../index.html#… und setzen is-active selbst)
  const sections = links
    .filter((a) => a.getAttribute("href").startsWith("#"))
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) =>
        a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => spy.observe(s));

  /* 2. Reveal-on-Scroll ------------------------------------------------- */
  const reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach((el) => io.observe(el));
  }

  /* 3. Lissajous-Figur ---------------------------------------------------
     x = sin(a·t + φ), y = sin(b·t). Die Phase φ läuft langsam durch,
     dadurch "dreht" sich die Figur wie auf einem Oszilloskop. */
  const path = document.getElementById("lissajous-path");
  if (path) {
    const A = 3, B = 4, R = 100, STEPS = 600;
    const draw = (phi) => {
      let d = "";
      for (let i = 0; i <= STEPS; i++) {
        const t = (i / STEPS) * Math.PI * 2;
        const x = R * Math.sin(A * t + phi);
        const y = R * Math.sin(B * t);
        d += (i ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
      }
      path.setAttribute("d", d);
    };
    if (reduceMotion) {
      draw(Math.PI / 4);
    } else {
      let phi = 0, visible = true;
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; })
        .observe(document.getElementById("hero"));
      const tick = () => {
        if (visible && !document.hidden) { phi += 0.0025; draw(phi); }
        requestAnimationFrame(tick);
      };
      tick();
    }
  }

  /* 4. Lightbox ---------------------------------------------------------- */
  const lightbox = document.getElementById("lightbox");
  const shots = [...document.querySelectorAll(".gallery .shot")];
  if (lightbox && shots.length) {
    const stage = lightbox.querySelector(".lightbox__stage");
    const caption = lightbox.querySelector(".lightbox__caption");
    let current = 0;
    let lastFocus = null;

    const render = () => {
      const shot = shots[current];
      const media = shot.querySelector("img, video, .placeholder");
      const clone = media.cloneNode(true);
      if (clone.tagName === "VIDEO") { clone.controls = true; clone.autoplay = true; }
      if (clone.tagName === "IMG") clone.loading = "eager";
      stage.replaceChildren(clone);
      const cap = shot.querySelector("figcaption");
      caption.textContent = `${current + 1} / ${shots.length}` + (cap ? "  ·  " + cap.textContent : "");
    };
    const open = (i) => {
      current = i;
      lastFocus = document.activeElement;
      render();
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      lightbox.querySelector(".lightbox__close").focus();
    };
    const close = () => {
      lightbox.hidden = true;
      stage.replaceChildren();
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    };
    const step = (dir) => { current = (current + dir + shots.length) % shots.length; render(); };

    shots.forEach((shot, i) => {
      shot.tabIndex = 0;
      shot.setAttribute("role", "button");
      shot.setAttribute("aria-label", "Enlarge image " + (i + 1));
      shot.addEventListener("click", () => open(i));
      shot.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); }
      });
    });

    lightbox.querySelector(".lightbox__close").addEventListener("click", close);
    lightbox.querySelector(".lightbox__prev").addEventListener("click", () => step(-1));
    lightbox.querySelector(".lightbox__next").addEventListener("click", () => step(1));
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox) close(); });

    document.addEventListener("keydown", (e) => {
      if (lightbox.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Tab") {
        // Fokus innerhalb der Lightbox halten
        const btns = [...lightbox.querySelectorAll("button")];
        const idx = btns.indexOf(document.activeElement);
        e.preventDefault();
        btns[(idx + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
      }
    });

    // Swipe auf Touch-Geräten
    let touchX = null;
    lightbox.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      touchX = null;
    });
  }

  /* 5. Autoplay-Videos -------------------------------------------------------
     Videos mit data-autoplay laufen nur, solange sie sichtbar sind. Bei
     "Bewegung reduzieren" wird nichts automatisch abgespielt, stattdessen
     bekommen die Videos Bedienelemente. */
  const autoVideos = document.querySelectorAll("video[data-autoplay]");
  if (reduceMotion) {
    autoVideos.forEach((v) => { v.removeAttribute("autoplay"); v.pause(); v.controls = true; });
  } else if ("IntersectionObserver" in window) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) target.play().catch(() => { target.controls = true; });
        else target.pause();
      });
    }, { threshold: 0.25 });
    autoVideos.forEach((v) => vio.observe(v));
  }
})();
