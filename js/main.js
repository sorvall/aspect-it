document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    const scrollProgress = document.querySelector('.scroll-progress');

    const updateHeader = () => {
        if (!header) return;
        const scrolled = window.scrollY > 20;
        header.classList.toggle('scrolled', scrolled);
        if (header.classList.contains('header--hero')) {
            header.classList.toggle('header--hero-top', window.scrollY < 400);
        }
    };

    window.addEventListener('scroll', () => {
        updateHeader();
        if (scrollProgress) {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            scrollProgress.style.width = max > 0 ? `${(window.scrollY / max) * 100}%` : '0%';
        }
    });
    updateHeader();

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('open'));
    }

    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach((el) => observer.observe(el));

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
