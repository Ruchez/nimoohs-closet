/* ═══════════════════════════════════════
   HOME PAGE ANIMATIONS — home-animations.js
═══════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── 1. FLOATING HEARTS / SPARKLES PARTICLES ─── */
  const container = document.getElementById('particles-container');
  const EMOJIS = ['💕', '✨', '🌸', '💗', '⭐', '🌟', '💖', '🎀'];
  const PARTICLE_COUNT = 22;

  if (container) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      spawnParticle();
    }
  }

  function spawnParticle() {
    const el = document.createElement('span');
    el.classList.add('particle');
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

    const size   = 0.8 + Math.random() * 1.2;   // 0.8–2rem
    const left   = Math.random() * 100;           // 0–100%
    const delay  = Math.random() * 8;             // stagger start
    const dur    = 7 + Math.random() * 10;        // 7–17s

    el.style.cssText = `
      left: ${left}%;
      bottom: -60px;
      font-size: ${size}rem;
      animation-duration: ${dur}s;
      animation-delay: ${delay}s;
    `;

    container.appendChild(el);
  }

  /* ─── 2. RIPPLE EFFECT ON HERO BUTTON ─── */
  const heroBtn = document.getElementById('hero-shop-btn');
  if (heroBtn) {
    heroBtn.addEventListener('click', function (e) {
      const ripple   = document.createElement('span');
      ripple.classList.add('ripple');
      const rect     = heroBtn.getBoundingClientRect();
      const size     = Math.max(rect.width, rect.height);
      ripple.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${e.clientX - rect.left - size / 2}px;
        top:  ${e.clientY - rect.top  - size / 2}px;
      `;
      heroBtn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  /* ─── 3. SCROLL INDICATOR HIDES ON SCROLL ─── */
  const scrollIndicator = document.getElementById('scroll-indicator');
  if (scrollIndicator) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        scrollIndicator.style.opacity = '0';
        scrollIndicator.style.transform = 'translateY(10px)';
      } else {
        scrollIndicator.style.opacity = '1';
        scrollIndicator.style.transform = 'translateY(0)';
      }
    }, { passive: true });
    scrollIndicator.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  }

  /* ─── 4. SCROLL REVEAL FOR HIGHLIGHT CARDS ─── */
  const revealEls = document.querySelectorAll('.reveal-up');
  if ('IntersectionObserver' in window && revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealEls.forEach(el => observer.observe(el));
  } else {
    // Fallback: just show them all
    revealEls.forEach(el => el.classList.add('visible'));
  }

  /* ─── 5. CUSTOM CURSOR + HEART TRAIL ─── */
  const dot  = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');

  if (dot && ring && window.innerWidth > 768) {
    let mouseX = 0, mouseY = 0;
    let ringX  = 0, ringY  = 0;
    let lastHeartTime = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      dot.style.left = mouseX + 'px';
      dot.style.top  = mouseY + 'px';

      // Heart trail throttled to every 120ms
      const now = Date.now();
      if (now - lastHeartTime > 120) {
        lastHeartTime = now;
        spawnHeart(mouseX, mouseY);
      }
    });

    // Smooth ring follows cursor
    function animateRing() {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.left = ringX + 'px';
      ring.style.top  = ringY + 'px';
      requestAnimationFrame(animateRing);
    }
    animateRing();

    // Ring grows on hoverable elements
    const hoverables = document.querySelectorAll('a, button, .highlight-card, .btn-hero, .btn-hero-ghost');
    hoverables.forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('hovering'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
    });
  }

  function spawnHeart(x, y) {
    const heart = document.createElement('span');
    heart.classList.add('cursor-heart');
    heart.textContent = '♥';
    heart.style.cssText = `
      left: ${x + (Math.random() * 16 - 8)}px;
      top:  ${y + (Math.random() * 16 - 8)}px;
      font-size: ${0.5 + Math.random() * 0.6}rem;
    `;
    document.body.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }

  /* ─── 6. HIGHLIGHT CARD MAGNETIC TILT ─── */
  document.querySelectorAll('.highlight-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect   = card.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const dx     = (e.clientX - cx) / (rect.width  / 2);
      const dy     = (e.clientY - cy) / (rect.height / 2);
      const tiltX  = dy * -8;
      const tiltY  = dx *  8;
      card.style.transform = `translateY(-12px) perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform 0.4s ease';
    });

    card.addEventListener('mouseenter', () => {
      card.style.transition = 'box-shadow 0.3s ease, border-bottom 0.3s ease';
    });
  });

})();
