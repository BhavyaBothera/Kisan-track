/**
 * ============================================================
 * KisanTrack — Landing Page Interactions
 * Handles animations, stats count-up, and layout effects.
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Fireflies Generation
    const firefliesContainer = document.getElementById('fireflies-container');
    if (firefliesContainer) {
        const fireflyCount = 10;
        for (let i = 0; i < fireflyCount; i++) {
            const firefly = document.createElement('div');
            firefly.classList.add('firefly');
            
            // Random properties
            const posX = Math.random() * 100; // 0 to 100 vw
            const posY = Math.random() * 100; // 0 to 100 vh
            const delay = Math.random() * 5; // 0 to 5s delay
            const duration = 4 + Math.random() * 4; // 4 to 8s duration

            firefly.style.left = `${posX}%`;
            firefly.style.top = `${posY}%`;
            firefly.style.animationDelay = `${delay}s, ${delay}s`;
            firefly.style.animationDuration = `${duration}s, 3s`;

            firefliesContainer.appendChild(firefly);
        }
    }

    // 2. Navbar Scroll Effect
    const navbar = document.getElementById('landing-navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // 3. Smooth Scroll for "How it Works"
    const btnWatch = document.getElementById('btn-watch-works');
    if (btnWatch) {
        btnWatch.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById('section-how-it-works');
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // 4. Intersection Observer for Fade-Ins
    const fadeObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    });

    const fadeElements = document.querySelectorAll('.fade-up');
    fadeElements.forEach(el => fadeObserver.observe(el));

    // 5. Intersection Observer for Stats Count-Up
    const countUpElements = document.querySelectorAll('.stat-num');
    let hasCounted = false;

    const statsObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !hasCounted) {
                hasCounted = true;
                
                countUpElements.forEach(el => {
                    const finalValueStr = el.getAttribute('data-target');
                    if (!finalValueStr) return;
                    
                    // Extract numeric part and suffix
                    const match = finalValueStr.match(/^(\\d+)(.*?)$/);
                    if (!match) return;
                    
                    const target = parseInt(match[1], 10);
                    const suffix = match[2];
                    
                    const duration = 1500; // 1.5s
                    const frameRate = 30; // 30ms per frame
                    const totalFrames = Math.round(duration / frameRate);
                    let currentFrame = 0;

                    // EaseOutQuad formula
                    const easeOutQuad = t => t * (2 - t);

                    const counter = setInterval(() => {
                        currentFrame++;
                        const progress = currentFrame / totalFrames;
                        const easedProgress = easeOutQuad(progress);
                        
                        const currentValue = Math.round(target * easedProgress);
                        el.textContent = `${currentValue}${suffix}`;

                        if (currentFrame === totalFrames) {
                            clearInterval(counter);
                            el.textContent = finalValueStr; // Ensure exact final value
                        }
                    }, frameRate);
                });
                
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2
    });

    const statsStrip = document.getElementById('stats-strip');
    if (statsStrip) {
        statsObserver.observe(statsStrip);
    }

    // 6. CTA Button Click Handlers
    const ctaButtons = [
        'btn-landing-login',
        'btn-landing-signup',
        'btn-hero-getstarted',
        'btn-final-signup'
    ];

    ctaButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'login.html';
            });
        }
    });

});
