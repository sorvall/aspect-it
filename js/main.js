document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');

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

        slider.addEventListener('input', (e) => {
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
    });

    document.querySelectorAll('.team-carousel').forEach((carousel) => {
        const slider = carousel.querySelector('.team-slider');
        const track = carousel.querySelector('.team-track');
        const prevBtn = carousel.querySelector('.team-nav--prev');
        const nextBtn = carousel.querySelector('.team-nav--next');
        const dots = carousel.querySelectorAll('.team-dot');
        if (!slider || !track) return;

        const cards = () => [...track.querySelectorAll('.team-card')];

        const scrollToIndex = (index) => {
            const card = cards()[index];
            if (!card) return;
            const offset = card.offsetLeft - (slider.clientWidth - card.offsetWidth) / 2;
            slider.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
        };

        const updateDots = () => {
            const list = cards();
            if (!list.length) return;
            let active = 0;
            let minDist = Infinity;
            const center = slider.scrollLeft + slider.clientWidth / 2;
            list.forEach((card, i) => {
                const cardCenter = card.offsetLeft + card.offsetWidth / 2;
                const dist = Math.abs(center - cardCenter);
                if (dist < minDist) {
                    minDist = dist;
                    active = i;
                }
            });
            dots.forEach((dot, i) => dot.classList.toggle('is-active', i === active));
        };

        prevBtn?.addEventListener('click', () => {
            const step = cards()[0]?.offsetWidth + 20 || 320;
            slider.scrollBy({ left: -step, behavior: 'smooth' });
        });

        nextBtn?.addEventListener('click', () => {
            const step = cards()[0]?.offsetWidth + 20 || 320;
            slider.scrollBy({ left: step, behavior: 'smooth' });
        });

        dots.forEach((dot, i) => {
            dot.addEventListener('click', () => scrollToIndex(i));
        });

        slider.addEventListener('scroll', updateDots, { passive: true });
        updateDots();

        let dragging = false;
        let startX = 0;
        let scrollStart = 0;

        slider.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.team-nav')) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            dragging = true;
            startX = e.clientX;
            scrollStart = slider.scrollLeft;
            slider.classList.add('is-dragging');
            slider.setPointerCapture(e.pointerId);
        });

        slider.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            slider.scrollLeft = scrollStart - (e.clientX - startX);
        });

        const stopDrag = () => {
            if (!dragging) return;
            dragging = false;
            slider.classList.remove('is-dragging');
            updateDots();
        };

        slider.addEventListener('pointerup', stopDrag);
        slider.addEventListener('pointercancel', stopDrag);
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
