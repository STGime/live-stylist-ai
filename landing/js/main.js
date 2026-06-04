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

// ----- Demo video sound toggle -----
// Video autoplays muted (browsers block autoplay with sound). The toggle
// flips muted and reflects state via aria-pressed, which drives the icon
// swap in CSS.
function initSoundToggle() {
  const btn = document.getElementById('phone-sound-toggle');
  const video = document.querySelector('.phone-video');
  if (!btn || !video) return;
  btn.addEventListener('click', () => {
    video.muted = !video.muted;
    const on = !video.muted;
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Mute demo video' : 'Unmute demo video');
    // Unmuting after autoplay sometimes needs an explicit play() nudge.
    if (on) video.play().catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', () => {
  createBubbles();
  initNavbar();
  initMobileMenu();
  initScrollAnimations();
  initSmoothScroll();
  initSoundToggle();
});
