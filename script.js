(function () {
    'use strict';

    // STATE
    let mx = innerWidth / 2, my = innerHeight / 2, smx = mx, smy = my;
    let scrollP = 0, theaterOn = false, audioPlaying = false;
    let audioCtx, analyser, audioData, lenis;

    // ELEMENTS
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    const gate = $('#gate'), theater = $('#theater'), stageVideo = $('#stage-video');
    const stageDarken = $('#stage-darken'), blackoutRealm = $('#blackout-realm');
    const audioPulse = $('#audio-pulse'), audioEl = $('#audio-player');
    const audioToggle = $('#audio-toggle'), barsEl = $('#audio-bars');
    const nowPlaying = $('#now-playing'), cursorEl = $('#cursor');
    const hudFill = $('#hud-fill');
    const footerCanvas = $('#footer-canvas'), contactUi = document.querySelector('.contact-ui');
    const copyBtn = $('#footer-copy');
    const waterTrack = $('#water-track');

    const EMAIL = 'tony@tonyandersonmusic.com';

    const chapters = [
        { id: 'ch-presence', start: 0.00, end: 0.14 },
        { id: 'ch-words',    start: 0.12, end: 0.28 },
        { id: 'ch-water',    start: 0.32, end: 0.58 },
        { id: 'ch-gift',     start: 0.56, end: 0.72 },
        { id: 'ch-contact',  start: 0.72, end: 1.00 },
    ];

    const WARM_S = 0.65, WARM_F = 0.76;
    const WATER_SCROLL_S = 0.32, WATER_SCROLL_E = 0.58;

    // ===== CURSOR =====
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
    document.addEventListener('touchmove', e => { mx = e.touches[0].clientX; my = e.touches[0].clientY; }, {passive: true});

    (function cursorLoop() {
        smx += (mx - smx) * 0.14; smy += (my - smy) * 0.14;
        cursorEl.style.left = smx + 'px'; cursorEl.style.top = smy + 'px';
        const menuOrb = document.getElementById('menu-orb');
        if (window.menuOpen && menuOrb) { menuOrb.style.left = smx + 'px'; menuOrb.style.top = smy + 'px'; }
        requestAnimationFrame(cursorLoop);
    })();

    document.addEventListener('mouseover', e => {
        if (e.target.closest('a,button,.gift-link')) cursorEl.classList.add('hovering');
        if (e.target.closest('#footer-canvas')) { cursorEl.classList.add('copying'); $('#cursor-text').innerText = 'CLICK TO COPY'; }
    });
    document.addEventListener('mouseout', e => {
        if (e.target.closest('a,button,.gift-link')) cursorEl.classList.remove('hovering');
        if (e.target.closest('#footer-canvas')) cursorEl.classList.remove('copying');
    });

    if ('ontouchstart' in window) {
        cursorEl.style.display = 'none';
        document.documentElement.style.cursor = 'auto';
    }

    // ===== SCATTERED WORD FRAGMENTS (position from data attrs) =====
    $$('.frag').forEach(f => {
        f.style.left = f.dataset.x + '%';
        f.style.top = f.dataset.y + '%';
        f.style.fontSize = `clamp(${f.dataset.size * 0.5}rem, ${f.dataset.size}vw, ${f.dataset.size * 1.2}rem)`;
    });

    // ===== STARDUST KINETIC FOOTER =====
    function initKineticFooter() {
        if (!footerCanvas) return;
        const ctx = footerCanvas.getContext('2d');
        let cW, cH, particles = [];
        let dissolving = false;
        
        function build() {
            cW = footerCanvas.width = innerWidth;
            cH = footerCanvas.height = innerHeight;
            
            const off = document.createElement('canvas');
            off.width = cW; off.height = cH;
            const oCtx = off.getContext('2d');
            
            const isMobile = cW < 768;
            const fs = isMobile ? Math.min(cW * 0.085, 45) : Math.min(cW * 0.055, 100);
            
            oCtx.font = `italic ${fs}px "Instrument Serif", serif`;
            oCtx.fillStyle = 'white';
            oCtx.textAlign = 'center';
            oCtx.textBaseline = 'middle';
            
            if (isMobile) {
                oCtx.fillText('tony@', cW/2, cH/2 - fs*0.7);
                oCtx.fillText('tonyandersonmusic.com', cW/2, cH/2 + fs*0.7);
            } else {
                oCtx.fillText('tony@tonyandersonmusic.com', cW/2, cH/2);
            }
            
            const data = oCtx.getImageData(0, 0, cW, cH).data;
            particles = [];
            const step = isMobile ? 3 : 4; // Dense for legibility
            
            for (let y = 0; y < cH; y += step) {
                for (let x = 0; x < cW; x += step) {
                    if (data[(y * cW + x) * 4 + 3] > 128) {
                        particles.push({
                            bx: x, by: y,
                            x: x + (Math.random() - 0.5) * cW * 0.5,
                            y: y + (Math.random() - 0.5) * cH * 0.5,
                            vx: 0, vy: 0,
                            size: isMobile ? 1.2 : 1.5,
                        });
                    }
                }
            }
        }
        
        document.fonts.ready.then(build);
        window.addEventListener('resize', build);
        
        function draw() {
            ctx.clearRect(0, 0, cW, cH);
            if (parseFloat(blackoutRealm.style.opacity) > 0.05 && particles.length > 0) {
                const time = Date.now() * 0.002;
                ctx.fillStyle = 'rgba(196, 149, 106, 0.85)'; // Ember color
                ctx.beginPath();
                
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    
                    if (dissolving) {
                        p.vy -= 0.05 + Math.random() * 0.05;
                        p.vx += (Math.random() - 0.5) * 0.2;
                    } else {
                        // Gentle shimmer drift
                        const driftX = Math.sin(time + p.bx * 0.01) * 0.3;
                        const driftY = Math.cos(time + p.by * 0.01) * 0.3;
                        
                        const dx = mx - p.x;
                        const dy = my - p.y;
                        const distSq = dx*dx + dy*dy;
                        
                        if (distSq < 10000) { // 100px radius
                            const dist = Math.sqrt(distSq);
                            const force = (100 - dist) / 100;
                            p.vx -= (dx / dist) * force * 1.5;
                            p.vy -= (dy / dist) * force * 1.5;
                        }
                        
                        p.vx += (p.bx - p.x) * 0.06;
                        p.vy += (p.by - p.y) * 0.06;
                        
                        p.x += driftX;
                        p.y += driftY;
                    }
                    
                    p.vx *= 0.82;
                    p.vy *= 0.82;
                    
                    p.x += p.vx;
                    p.y += p.vy;
                    
                    ctx.rect(p.x, p.y, p.size, p.size);
                }
                ctx.fill();
            }
            requestAnimationFrame(draw);
        }
        draw();

        footerCanvas.addEventListener('click', () => {
            if(dissolving) return;
            navigator.clipboard.writeText(EMAIL).then(() => {
                const ct = $('#cursor-text');
                if(ct) {
                    ct.innerText = 'COPIED';
                    setTimeout(() => { if (cursorEl.classList.contains('copying')) ct.innerText = 'CLICK TO COPY'; }, 2000);
                }
                const vh = $('#void-hint');
                if (vh) {
                    vh.innerText = 'COPIED TO CLIPBOARD';
                    vh.classList.add('copied');
                    setTimeout(() => { vh.innerText = 'CLICK ANYWHERE TO COPY EMAIL'; vh.classList.remove('copied'); }, 2000);
                }
                
                // Elegant dissolution
                dissolving = true;
                particles.forEach(p => {
                    p.vy -= Math.random() * 5 + 2;
                    p.vx += (Math.random() - 0.5) * 4;
                });
                
                // Re-condense beautifully
                setTimeout(() => {
                    dissolving = false;
                    particles.forEach(p => {
                        p.x = p.bx + (Math.random() - 0.5) * cW * 0.5;
                        p.y = p.by - Math.random() * cH;
                        p.vx = 0; p.vy = 0;
                    });
                }, 1600);
            });
        });
    }

    // ===== GATE =====
    function initGate() {
        document.addEventListener('mousemove', e => {
            if (!gate || gate.style.display === 'none') return;
            gate.style.setProperty('--gate-mx', (e.clientX / innerWidth * 100) + '%');
            gate.style.setProperty('--gate-my', (e.clientY / innerHeight * 100) + '%');
        });
        const tl = gsap.timeline({ delay: 0.4 });
        tl.to('.gate-name-line[data-line="1"]', { opacity: 1, y: 0, duration: 1.6, ease: 'power3.out' });
        tl.to('.gate-name-line[data-line="2"]', { opacity: 1, y: 0, duration: 1.6, ease: 'power3.out' }, '-=1.1');
        tl.to('.gate-overline', { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, '-=0.9');
        tl.to('.gate-enter', { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, '-=0.5');
    }

    // ===== ENTER =====
    function enter() {
        if (theaterOn) return;
        theaterOn = true;
        startAudio();
        const tl = gsap.timeline({ onComplete: () => { gate.style.display = 'none'; scrollTo(0, 0); } });
        tl.to('.letterbox-top', { height: 0, duration: 1.4, ease: 'power3.inOut' });
        tl.to('.letterbox-bottom', { height: 0, duration: 1.4, ease: 'power3.inOut' }, '<');
        tl.to('.gate-content', { opacity: 0, y: -40, duration: 0.9, ease: 'power2.in' }, '<');
        tl.to('.gate-video.blurred', { opacity: 0, duration: 1.4, ease: 'power2.inOut' }, '-=0.8');
        tl.to(gate, { opacity: 0, duration: 1, ease: 'power2.inOut' }, '-=0.5');
        tl.set(theater, { className: '' });
        tl.fromTo(theater, { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'power2.out' }, '-=0.6');
        tl.call(() => { initScroll(); initParallax(); initKineticFooter(); });
    }

    $('#gate-enter').addEventListener('click', enter);
    document.addEventListener('keydown', e => { if (e.key === 'Enter' && !theaterOn) enter(); });

    // ===== MENU LOGIC =====
    const menuBtn = $('#menu-toggle');
    const menuOverlay = $('#menu-overlay');
    const menuLinks = $$('.menu-link');
    const menuFooter = $('.menu-footer');
    window.menuOpen = false; // Exposed for cursor loop

    if (menuBtn && menuOverlay) {
        menuBtn.addEventListener('click', () => {
            window.menuOpen = !window.menuOpen;
            if (window.menuOpen) {
                if (window.lenis) window.lenis.stop();
                menuBtn.classList.add('open');
                menuOverlay.classList.add('active');
                gsap.fromTo(menuLinks, {y: 80, opacity: 0}, {y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: 'power4.out', delay: 0.2});
                gsap.fromTo(menuFooter, {y: 20, opacity: 0}, {y: 0, opacity: 0.3, duration: 1.2, ease: 'power4.out', delay: 0.6});
            } else {
                if (window.lenis) window.lenis.start();
                menuBtn.classList.remove('open');
                menuOverlay.classList.remove('active');
                gsap.to(menuLinks, {y: -40, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.in'});
                gsap.to(menuFooter, {y: 20, opacity: 0, duration: 0.5, ease: 'power3.in'});
            }
        });
    }

    // ===== MEDIA PLAYBACK =====
    function startAudio() {
        audioEl.load();
        audioCtx = new (AudioContext || webkitAudioContext)();
        const src = audioCtx.createMediaElementSource(audioEl);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.85;
        src.connect(analyser); analyser.connect(audioCtx.destination);
        audioData = new Uint8Array(analyser.frequencyBinCount);
        audioEl.volume = 0.55;
        audioEl.play().then(() => {
            audioPlaying = true; barsEl.classList.add('playing'); nowPlaying.classList.add('visible');
        }).catch(() => {});
        (function pulse() {
            if (!analyser) return;
            analyser.getByteFrequencyData(audioData);
            let bass = 0; for (let i = 0; i < 8; i++) bass += audioData[i];
            bass /= 8 * 255;
            if (audioPulse && audioPlaying) audioPulse.style.opacity = bass * 0.35;
            requestAnimationFrame(pulse);
        })();
    }

    audioToggle.addEventListener('click', () => {
        if (!audioCtx) { startAudio(); return; }
        if (audioPlaying) {
            audioEl.pause(); audioPlaying = false;
            barsEl.classList.remove('playing'); nowPlaying.classList.remove('visible');
            audioPulse.style.opacity = 0;
        } else {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            audioEl.play(); audioPlaying = true;
            barsEl.classList.add('playing'); nowPlaying.classList.add('visible');
        }
    });

    // ===== SCROLL ENGINE =====
    function initScroll() {
        gsap.registerPlugin(ScrollTrigger);
        lenis = new Lenis({ duration: 1.6, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(t => lenis.raf(t * 1000));
        gsap.ticker.lagSmoothing(0);

        // Measure water track width for horizontal scroll
        const trackW = waterTrack.scrollWidth;
        const viewW = innerWidth;
        const maxTranslate = Math.max(0, trackW - viewW);

        ScrollTrigger.create({
            trigger: '#scroll-proxy', start: 'top top', end: 'bottom bottom',
            onUpdate: self => {
                scrollP = self.progress;
                updateChapters(scrollP);
                updateWater(scrollP, maxTranslate);
                updateVoid(scrollP);
                if (hudFill) hudFill.style.width = (scrollP * 100) + '%';
            },
        });
    }

    // ===== CHAPTER TRANSITIONS =====
    function updateChapters(p) {
        chapters.forEach(({ id, start, end }) => {
            const el = document.getElementById(id);
            if (!el) return;
            const mid = (start + end) / 2;
            let op = 0, y = 0;

            if (p < start) { op = 0; y = 35; }
            else if (p < mid) { const t = easeOutExpo((p - start) / (mid - start)); op = t; y = 35 * (1 - t); }
            else if (p < end) { const t = easeInCubic((p - mid) / (end - mid)); op = 1 - t; y = -25 * t; }
            else { op = 0; y = -25; }

            el.style.opacity = Math.max(0, op);
            el.style.visibility = op > 0.01 ? 'visible' : 'hidden';

            // Ch2 (water) only gets opacity, no Y shift (horizontal scroll handles it)
            if (id === 'ch-water') {
                el.style.transform = 'none';
            } else {
                el.style.transform = `translateY(${y}px)`;
            }
            el.classList.toggle('active', op > 0.5);
        });

        if (p >= 0.12 && p <= 0.28) {
            const range = 0.28 - 0.12;
            $$('.frag').forEach(f => {
                const delay = parseFloat(f.dataset.delay);
                const localP = (p - 0.12) / range;
                const t = Math.max(0, Math.min(1, (localP - delay) * 4));
                const e = easeOutExpo(t);
                f.style.opacity = e;
                f.style.transform = `translateY(${20 * (1 - e)}px)`;
            });
        }
    }

    // ===== HORIZONTAL NIOBRARA =====
    function updateWater(p, maxTx) {
        if (p >= WATER_SCROLL_S && p <= WATER_SCROLL_E) {
            const localP = (p - WATER_SCROLL_S) / (WATER_SCROLL_E - WATER_SCROLL_S);
            const tx = -localP * maxTx;
            waterTrack.style.transform = `translateX(${tx}px)`;
        }
    }

    // ===== THE VOID =====
    function updateVoid(p) {
        if (p >= WARM_S) {
            const t = Math.min(1, (p - WARM_S) / (WARM_F - WARM_S));
            const e = easeOutExpo(t);
            stageDarken.style.opacity = e;
            blackoutRealm.style.opacity = e;
            if (footerCanvas) footerCanvas.classList.add('active');
            if (contactUi) contactUi.classList.add('active');
            const vh = $('#void-hint'); if (vh) vh.classList.add('active');
        } else {
            stageDarken.style.opacity = 0;
            blackoutRealm.style.opacity = 0;
            if (footerCanvas) footerCanvas.classList.remove('active');
            if (contactUi) contactUi.classList.remove('active');
            const vh = $('#void-hint'); if (vh) vh.classList.remove('active');
        }
    }

    // ===== VIDEO PARALLAX & VOID SHIFT =====
    function initParallax() {
        (function loop() {
            const ox = ((mx / innerWidth) - 0.5) * 10;
            const oy = ((my / innerHeight) - 0.5) * 6;
            if(stageVideo) stageVideo.style.transform = `translate(${ox}px, ${oy}px) scale(1.06)`;
            
            if (parseFloat(blackoutRealm.style.opacity) > 0.05) {
                const time = Date.now() * 0.0005;
                const bgX = 50 + Math.sin(time) * 15;
                const bgY = 50 + Math.cos(time * 0.8) * 15;
                blackoutRealm.style.background = `radial-gradient(circle at ${bgX}% ${bgY}%, #1a1410 0%, #0a0806 50%, #000000 100%)`;
            }
            
            requestAnimationFrame(loop);
        })();
    }

    // Particles removed in favor of The Void.

    // ===== UTILS =====
    function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
    function easeInCubic(t) { return t * t * t; }

    // ===== BOOT =====
    addEventListener('load', () => {
        initGate();
        const bv = $('#gate-video-blur'), cv = $('#gate-video-clear');
        if (bv && cv) bv.addEventListener('play', () => { cv.currentTime = bv.currentTime; });
    });
})();
