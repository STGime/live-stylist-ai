/* LiveStylist landing — interactive bits.
 * Floating bubbles ported from app/src/components/FloatingBubbles.tsx
 * (light palette, 18 bubbles, 12-52px, 6-16s float, opacity 0.25-0.5).
 */

// ----- Floating bubbles background -----
// Same palette + size + duration distribution as the app component so the
// landing and the in-app onboarding feel like the same animation.
const BUBBLE_COLORS = [
  '#FF8FAB', '#FF6B8A', '#C5A3FF', '#A78BFA', '#FFB88C',
  '#F9A8D4', '#A8E6CF', '#6EE7B7', '#FFF3A3', '#FDE68A',
  '#93C5FD', '#7DD3FC', '#E879F9', '#C084FC',
];

function rand(min, max) { return min + Math.random() * (max - min); }

function createBubbles() {
  const container = document.querySelector('.bubbles');
  if (!container) return;
  // Reset any prior children (handles hot-reload-ish edge cases).
  container.innerHTML = '';
  const count = window.innerWidth < 760 ? 12 : 18;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'bubble';
    const size = rand(12, 52);
    const left = Math.random() * 100;
    const duration = rand(6, 16); // seconds, matches RN 6000-16000ms
    const delay = -rand(0, duration); // negative so bubbles appear mid-flight at load
    const opacity = rand(0.25, 0.5);
    const color = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
    el.style.cssText =
      `left:${left}%;` +
      `width:${size}px;height:${size}px;` +
      `background:${color};` +
      `animation-duration:${duration}s;` +
      `animation-delay:${delay}s;` +
      `--bubble-opacity:${opacity};`;
    container.appendChild(el);
  }
}

// ----- Navbar shadow on scroll -----
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  const update = () => navbar.classList.toggle('scrolled', window.scrollY > 24);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

// ----- Mobile nav toggle -----
function initMobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    const open = toggle.classList.toggle('active');
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      toggle.classList.remove('active');
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ----- Scroll-in animations -----
function initScrollAnimations() {
  const els = document.querySelectorAll('.fade-in');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach((el) => obs.observe(el));
}

// ----- Smooth anchor scrolling -----
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ----- Demo video: robust autoplay + sound toggle -----
// The video autoplays muted (browsers block autoplay with sound). Mobile
// browsers — notably Firefox on Android — are inconsistent about honouring the
// `autoplay`/`muted` attributes, which can leave the hero showing broken /
// flashing frames. So we drive playback from JS too: force the muted *property*
// (more reliable than the attribute), kick off play(), retry when the hero
// scrolls into view, and if it's still blocked reveal a tap-to-play button.
function initHeroVideo() {
  const video = document.querySelector('.phone-video');
  if (!video) return;
  const soundBtn = document.getElementById('phone-sound-toggle');
  const playOverlay = document.getElementById('phone-play-overlay');

  // Property is more reliable than the attribute for muted autoplay on mobile.
  video.muted = true;

  const showPlayButton = () => { if (playOverlay) playOverlay.hidden = false; };
  const hidePlayButton = () => { if (playOverlay) playOverlay.hidden = true; };

  const attemptPlay = () => {
    const p = video.play();
    if (p && typeof p.then === 'function') {
      p.then(hidePlayButton).catch(showPlayButton);
    }
  };

  // Initial autoplay attempt.
  attemptPlay();

  // Some mobile browsers only allow playback once the element is on screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && video.paused) attemptPlay();
      });
    }, { threshold: 0.25 });
    io.observe(video);
  }

  // Tap-to-play fallbacks (the overlay button and the video itself).
  if (playOverlay) playOverlay.addEventListener('click', attemptPlay);
  video.addEventListener('click', () => { if (video.paused) attemptPlay(); });
  video.addEventListener('playing', hidePlayButton);

  // Sound toggle — flip muted, reflect via aria-pressed (drives the CSS icon
  // swap), and nudge play() on unmute.
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      const on = !video.muted;
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.setAttribute('aria-label', on ? 'Mute demo video' : 'Unmute demo video');
      if (on) video.play().catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  createBubbles();
  initNavbar();
  initMobileMenu();
  initScrollAnimations();
  initSmoothScroll();
  initHeroVideo();
});
