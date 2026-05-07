/**
 * KisanTrack Landing Page Logic
 * Handles animations, star/firefly generation, stats count-up, 
 * and Firebase auth routing.
 */

(function() {
  'use strict';

  // --- 1. Firebase Auth Routing ---
  // Ensure Firebase is initialized (assumes firebase-init.js is loaded)
  function checkAuthState() {
    if (typeof firebase !== 'undefined') {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          window.location.href = 'dashboard.html';
        } else {
          // Fade in body after check
          document.body.style.opacity = '1';
        }
      });
    } else {
      // Fallback if firebase fails to load
      document.body.style.opacity = '1';
    }
  }

  // --- 2. Hero Background Elements ---
  function initHeroEffects() {
    const hero = document.getElementById('hero');
    if (!hero) return;

    // A. Generate Stars
    const starField = document.createElement('div');
    starField.className = 'star-field';
    for (let i = 0; i < 40; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      const x = Math.random() * 100;
      const y = Math.random() * 55; // Only top 55%
      const duration = 2 + Math.random() * 3;
      const delay = Math.random() * 5;
      
      star.style.left = `${x}%`;
      star.style.top = `${y}%`;
      star.style.animation = `twinkle ${duration}s infinite ease-in-out ${delay}s`;
      starField.appendChild(star);
    }
    hero.appendChild(starField);

    // B. Generate Fireflies
    const fireflyField = document.createElement('div');
    fireflyField.className = 'firefly-field';
    for (let i = 0; i < 12; i++) {
      const firefly = document.createElement('div');
      firefly.className = 'firefly';
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const duration = 5 + Math.random() * 5;
      const delay = Math.random() * 5;
      
      firefly.style.left = `${x}%`;
      firefly.style.top = `${y}%`;
      firefly.style.animation = `firefly ${duration}s infinite ease-in-out ${delay}s`;
      fireflyField.appendChild(firefly);
    }
    hero.appendChild(fireflyField);
  }

  // --- 3. Navbar Scroll Effect ---
  function initNavbar() {
    const nav = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }

  // --- 4. Stats Count-Up ---
  function animateStats() {
    const statsSection = document.querySelector('.stats-strip');
    if (!statsSection) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        startCounting();
        observer.unobserve(statsSection);
      }
    }, { threshold: 0.15 });

    observer.observe(statsSection);

    function startCounting() {
      const stats = [
        { id: 'stat-animals', end: 500, suffix: '+' },
        { id: 'stat-accuracy', end: 92, suffix: '%' },
        { id: 'stat-reduction', end: 42, suffix: '%' }
      ];

      stats.forEach(stat => {
        const el = document.getElementById(stat.id);
        if (!el) return;
        
        let start = 0;
        const duration = 1800;
        const stepTime = 20;
        const totalSteps = duration / stepTime;
        const increment = stat.end / totalSteps;

        const timer = setInterval(() => {
          start += increment;
          if (start >= stat.end) {
            el.textContent = stat.end + stat.suffix;
            clearInterval(timer);
          } else {
            el.textContent = Math.floor(start) + stat.suffix;
          }
        }, stepTime);
      });

      // Typewriter for "Real-Time"
      const rtEl = document.getElementById('stat-realtime');
      if (rtEl) {
        const text = "Real-Time";
        rtEl.textContent = "";
        let i = 0;
        const typeTimer = setInterval(() => {
          rtEl.textContent += text[i];
          i++;
          if (i >= text.length) clearInterval(typeTimer);
        }, 150);
      }
    }
  }

  // --- 5. Scroll Reveal ---
  function initReveal() {
    const revealEls = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Add staggered delay to children if it's a grid
          if (entry.target.classList.contains('reveal-grid')) {
            const children = entry.target.querySelectorAll('.reveal-item');
            children.forEach((child, index) => {
              child.style.transitionDelay = `${index * 0.1}s`;
              child.classList.add('visible');
            });
          }
        }
      });
    }, { threshold: 0.15 });

    revealEls.forEach(el => observer.observe(el));
  }

  // --- Initialize Everything ---
  document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    initHeroEffects();
    initNavbar();
    animateStats();
    initReveal();
  });

})();
