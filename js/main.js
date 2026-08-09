document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    const scrollProgress = document.querySelector('.scroll-progress');
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');
    const isTouch = matchMedia('(pointer: coarse)').matches;

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

    if (!isTouch && cursorDot && cursorRing) {
        document.body.classList.add('custom-cursor');
        let mx = 0;
        let my = 0;
        let rx = 0;
        let ry = 0;

        document.addEventListener('mousemove', (e) => {
            mx = e.clientX;
            my = e.clientY;
            cursorDot.style.transform = `translate(${mx}px, ${my}px)`;
        });

        const animateRing = () => {
            rx += (mx - rx) * 0.15;
            ry += (my - ry) * 0.15;
            cursorRing.style.transform = `translate(${rx}px, ${ry}px)`;
            requestAnimationFrame(animateRing);
        };
        animateRing();

        document.querySelectorAll('a, button, input, .compare-slider').forEach((el) => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
        });
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
        if (!slider || !before || !handle) return;

        const update = (val) => {
            before.style.clipPath = `inset(0 ${100 - val}% 0 0)`;
            handle.style.left = `${val}%`;
        };

        slider.addEventListener('input', (e) => update(e.target.value));
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
