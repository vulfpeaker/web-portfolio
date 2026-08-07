/* axid.team — Warm Void
   One rAF loop for the whole page. No globals, no dependencies. */
(function () {
  'use strict';

  var doc = document;
  var mq = window.matchMedia;
  var reduce = mq('(prefers-reduced-motion: reduce)').matches;
  var finePointer = mq('(hover: hover) and (pointer: fine)').matches;
  var listHover = mq('(hover: hover) and (min-width: 1024px)');
  var PASSIVE = { passive: true };

  /* ---------------------------------------------------------
     Shared rAF loop. A job returns true while it still needs
     frames; when every job is settled the loop parks itself.
     --------------------------------------------------------- */
  var jobs = [];
  var running = false;

  function tick() {
    var alive = false;
    for (var i = 0; i < jobs.length; i++) {
      if (jobs[i]()) alive = true;
    }
    if (alive) requestAnimationFrame(tick);
    else running = false;
  }

  function wake() {
    if (running || reduce) return;
    running = true;
    requestAnimationFrame(tick);
  }

  /* ---- viewport cache, resize throttled through rAF -------- */
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var resizeQueued = false;

  window.addEventListener('resize', function () {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () {
      vw = window.innerWidth;
      vh = window.innerHeight;
      resizeQueued = false;
    });
  }, PASSIVE);

  /* ---------------------------------------------------------
     Footer year
     --------------------------------------------------------- */
  var yearEl = doc.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------
     Nav: a 1px sentinel 40px down the document beats a scroll
     listener — no work on the main thread while scrolling.
     --------------------------------------------------------- */
  var nav = doc.getElementById('nav');
  var navTop = doc.getElementById('nav-top');
  var hasIO = 'IntersectionObserver' in window;

  if (nav && navTop && hasIO) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-scrolled', !entries[0].isIntersecting);
    }).observe(navTop);
  }

  /* ---------------------------------------------------------
     Hero kinetic reveal — after the webfont swaps, so the
     headline never jumps mid-animation.
     --------------------------------------------------------- */
  var hero = doc.querySelector('.hero');

  if (hero) {
    var fired = false;
    var revealHero = function () {
      if (fired) return;
      fired = true;
      hero.classList.add('is-ready');
    };
    if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) {
      doc.fonts.ready.then(revealHero);
      setTimeout(revealHero, 1500); // fonts blocked / offline
    } else {
      revealHero();
    }
  }

  /* ---------------------------------------------------------
     Scroll reveal — masked, not faded.
     --------------------------------------------------------- */
  var masks = doc.querySelectorAll('.rv');
  var m, kids, k;

  if (!hasIO) {
    for (m = 0; m < masks.length; m++) masks[m].classList.add('is-in', 'rv-done');
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-in');
        obs.unobserve(el);
        setTimeout(function () { el.classList.add('rv-done'); }, 1400);
      });
    }, { rootMargin: '0px 0px -12% 0px' });

    for (m = 0; m < masks.length; m++) {
      if (hero && hero.contains(masks[m])) continue; // hero runs off fonts.ready
      kids = masks[m].children;
      for (k = 0; k < kids.length; k++) kids[k].style.setProperty('--i', k);
      io.observe(masks[m]);
    }
  }

  /* ---------------------------------------------------------
     Ambient light — heavy inertia, desktop pointers only.
     --------------------------------------------------------- */
  var amb = doc.getElementById('ambient');

  if (amb && hero && finePointer && !reduce) {
    var ax = vw * 0.38, ay = vh * 0.52;
    var atx = ax, aty = ay;

    amb.style.transform = 'translate3d(' + ax + 'px,' + ay + 'px,0)';

    jobs.push(function () {
      var dx = atx - ax;
      var dy = aty - ay;
      ax += dx * 0.035;
      ay += dy * 0.035;
      amb.style.transform = 'translate3d(' + ax + 'px,' + ay + 'px,0)';
      if (Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) {
        amb.classList.remove('is-live');
        return false;
      }
      return true;
    });

    hero.addEventListener('mousemove', function (e) {
      atx = e.pageX;
      aty = e.pageY;
      amb.classList.add('is-live');
      wake();
    }, PASSIVE);
  }

  /* ---------------------------------------------------------
     Works
     --------------------------------------------------------- */
  var list = doc.getElementById('works-list');

  /* inline details — <button> gives us Enter/Space for free */
  var heads = doc.querySelectorAll('.work-head');
  for (var h = 0; h < heads.length; h++) {
    heads[h].addEventListener('click', function () {
      var row = this.closest('.work');
      if (!row) return;
      var next = row.getAttribute('data-open') === 'true' ? 'false' : 'true';
      row.setAttribute('data-open', next);
      this.setAttribute('aria-expanded', next);
    }, PASSIVE);
  }

  /* cursor preview — desktop, fine pointer, motion allowed */
  var prev = doc.getElementById('wpreview');
  var prevImg = doc.getElementById('wpreview-img');

  if (list && prev && prevImg && !reduce) {
    var PW = 210, PH = 140;          // half of 420 x 280
    var px = 0, py = 0, ptx = 0, pty = 0, rot = 0;
    var shown = false;

    jobs.push(function () {
      var dx = ptx - px;
      var dy = pty - py;
      px += dx * 0.12;
      py += dy * 0.12;

      // rotation reads off travel distance, so it decays on its own
      var target = dx * 0.15;
      if (target > 4) target = 4;
      else if (target < -4) target = -4;
      rot += (target - rot) * 0.12;

      prev.style.transform =
        'translate3d(' + (px - PW) + 'px,' + (py - PH) + 'px,0) rotate(' + rot.toFixed(2) + 'deg)';

      if (!shown && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        prev.classList.remove('is-live');
        return false;
      }
      return true;
    });

    list.addEventListener('mousemove', function (e) {
      if (!shown || !listHover.matches) return;
      ptx = e.clientX;
      pty = e.clientY;
      wake();
    }, PASSIVE);

    list.addEventListener('mouseover', function (e) {
      if (!listHover.matches) return;
      var row = e.target.closest ? e.target.closest('.work') : null;
      if (!row) return;

      var src = row.getAttribute('data-shot');
      if (src && prevImg.getAttribute('src') !== src) prevImg.setAttribute('src', src);

      if (!shown) {                       // snap to the cursor, then ease
        px = ptx = e.clientX;
        py = pty = e.clientY;
        rot = 0;
        shown = true;
        prev.classList.add('is-on', 'is-live');
      }
      wake();
    }, PASSIVE);

    list.addEventListener('mouseleave', function () {
      shown = false;
      prev.classList.remove('is-on');
    }, PASSIVE);
  }
})();
