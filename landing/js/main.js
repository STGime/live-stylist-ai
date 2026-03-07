// ===== STARS BACKGROUND =====
function createStars() {
  const container = document.querySelector('.bg-stars');
  if (!container) return;
  const count = Math.floor(window.innerWidth * window.innerHeight / 8000);
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 5 + 's';
    star.style.width = star.style.height = (Math.random() * 3 + 1) + 'px';
    container.appendChild(star);
  }
}

// ===== NAVBAR SCROLL =====
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ===== MOBILE MENU =====
function initMobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = toggle.classList.toggle('active');
    links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen);
  });

  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => observer.observe(el));
}

// ===== SMOOTH SCROLL =====
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ===== PARALLAX (subtle) =====
function initParallax() {
  const clouds = document.querySelectorAll('.cloud');
  if (!clouds.length) return;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    clouds.forEach((cloud, i) => {
      const speed = 0.02 + (i * 0.01);
      cloud.style.transform = `translateX(${-200 + scrollY * speed}px)`;
    });
  });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  createStars();
  initNavbar();
  initMobileMenu();
  initScrollAnimations();
  initSmoothScroll();
  initParallax();
});
