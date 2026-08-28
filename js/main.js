document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    const onceInView = (el, fn, threshold = 0.22) => {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    io.disconnect();
                    fn(entry.target);
                });
            },
            { threshold, rootMargin: '0px 0px -8% 0px' }
        );
        io.observe(el);
    };

    const heroRule = document.querySelector('.hero-editorial-rule');
    if (heroRule) {
        requestAnimationFrame(() => heroRule.classList.add('is-in'));
    }

    const cloud = document.querySelector('[data-cloud-cycle]');
    if (cloud) {
        const tabs = [...cloud.querySelectorAll('.hero-cloud-tab')];
        const panels = [...cloud.querySelectorAll('.hero-cloud-panel')];
        const show = (index) => {
            tabs.forEach((tab, n) => {
                const on = n === index;
                tab.setAttribute('aria-selected', on ? 'true' : 'false');
                tab.tabIndex = on ? 0 : -1;
            });
            panels.forEach((panel, n) => {
                const on = n === index;
                panel.classList.toggle('is-on', on);
                panel.hidden = !on;
            });
        };
        tabs.forEach((tab, n) => {
            tab.addEventListener('click', () => show(n));
        });
        show(0);
    }

    document.querySelectorAll('.home-rise, .home-process').forEach((el) => {
        if (reduceMotion) {
            el.classList.add('is-in');
            return;
        }
        onceInView(el, () => el.classList.add('is-in'));
    });

    window.setTimeout(() => {
        document.querySelectorAll('.home-rise, .home-process').forEach((el) => {
            el.classList.add('is-in');
        });
    }, 2800);

    const proof = document.querySelector('.hero-proof');
    if (proof && !reduceMotion) {
        const proofRect = proof.getBoundingClientRect();
        const proofInView = proofRect.top < window.innerHeight * 0.92 && proofRect.bottom > 0;
        if (!proofInView) {
            onceInView(
                proof,
                () => {
                    proof.querySelectorAll('[data-count]').forEach((el) => {
                        const to = Number(el.dataset.count);
                        if (!Number.isFinite(to)) return;
                        const suffix = el.dataset.suffix || '';
                        const prefix = el.dataset.prefix || '';
                        const start = performance.now();
                        const duration = 900;
                        const tick = (now) => {
                            const t = Math.min(1, (now - start) / duration);
                            el.textContent = prefix + Math.round(to * easeOut(t)) + suffix;
                            if (t < 1) requestAnimationFrame(tick);
                        };
                        requestAnimationFrame(tick);
                    });
                },
                0.4
            );
        }
    }

    const updateHeader = () => {
        if (!header) return;
        const scrolled = window.scrollY > 20;
        header.classList.toggle('scrolled', scrolled);
        if (header.classList.contains('header--hero')) {
            header.classList.toggle('header--hero-top', window.scrollY < 400);
        }
    };

    window.addEventListener('scroll', updateHeader);
    updateHeader();

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('open'));
    }

    const reveals = document.querySelectorAll('.reveal');
    const revealIfInView = (el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92) {
            el.classList.add('visible');
        }
    };
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach((el) => {
        revealIfInView(el);
        observer.observe(el);
    });

    document.querySelectorAll('[data-compare]').forEach((compare) => {
        const slider = compare.querySelector('.compare-slider');
        const before = compare.querySelector('.compare-before');
        const handle = compare.querySelector('.compare-handle');
        const hint = compare.querySelector('.compare-hint');
        if (!slider || !before || !handle) return;

        const update = (val) => {
            const pct = Math.min(100, Math.max(0, Number(val)));
            before.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
            handle.style.left = `${pct}%`;
            slider.value = pct;
        };

        const hideHint = () => {
            if (hint) hint.style.opacity = '0';
        };

        let userTouched = false;

        slider.addEventListener('input', (e) => {
            userTouched = true;
            update(e.target.value);
            hideHint();
        });

        let dragging = false;

        const moveFromEvent = (clientX) => {
            const rect = compare.getBoundingClientRect();
            update(((clientX - rect.left) / rect.width) * 100);
            hideHint();
        };

        compare.addEventListener('pointerdown', (e) => {
            userTouched = true;
            dragging = true;
            compare.setPointerCapture(e.pointerId);
            moveFromEvent(e.clientX);
        });

        compare.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            moveFromEvent(e.clientX);
        });

        compare.addEventListener('pointerup', () => {
            dragging = false;
        });

        compare.addEventListener('pointercancel', () => {
            dragging = false;
        });

        update(slider.value);

        if (compare.hasAttribute('data-compare-demo') && !reduceMotion) {
            onceInView(
                compare,
                () => {
                    if (userTouched) return;
                    const startVal = 22;
                    const endVal = 58;
                    const duration = 1100;
                    update(startVal);
                    const t0 = performance.now();
                    const tick = (now) => {
                        if (userTouched) return;
                        const t = Math.min(1, (now - t0) / duration);
                        update(startVal + (endVal - startVal) * easeOut(t));
                        if (t < 1) requestAnimationFrame(tick);
                    };
                    requestAnimationFrame(tick);
                },
                0.35
            );
        }
    });

    document.querySelectorAll('form[data-form]').forEach((form) => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const success = form.querySelector('.form-success');
            if (success) {
                success.style.display = 'block';
                form.reset();
            }
        });
    });
});
