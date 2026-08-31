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
        const dwell = 4200;
        const canAuto = !reduceMotion && tabs.length > 1;
        let current = 0;
        let timer = 0;

        const paused = () =>
            document.hidden || cloud.matches(':hover') || cloud.contains(document.activeElement);

        const arm = () => {
            window.clearTimeout(timer);
            cloud.classList.toggle('is-cycling', canAuto && !paused());
            if (!canAuto || paused()) return;
            timer = window.setTimeout(() => show(current + 1), dwell);
        };

        const show = (index) => {
            current = (index + tabs.length) % tabs.length;
            tabs.forEach((tab, n) => {
                const on = n === current;
                tab.setAttribute('aria-selected', on ? 'true' : 'false');
                tab.tabIndex = on ? 0 : -1;
            });
            panels.forEach((panel, n) => {
                if (n === current) {
                    panel.classList.remove('is-on');
                    panel.hidden = false;
                    void panel.offsetWidth;
                    panel.classList.add('is-on');
                } else {
                    panel.hidden = true;
                    panel.classList.remove('is-on');
                }
            });
            arm();
        };

        tabs.forEach((tab, n) => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                show(n);
            });
        });
        cloud.querySelector('.hero-cloud-tabs')?.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            const next = (current + dir + tabs.length) % tabs.length;
            tabs[next].focus();
            show(next);
        });
        cloud.addEventListener('mouseenter', arm);
        cloud.addEventListener('mouseleave', arm);
        cloud.addEventListener('focusin', arm);
        cloud.addEventListener('focusout', () => window.setTimeout(arm, 0));
        document.addEventListener('visibilitychange', arm);
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
        menuToggle.addEventListener('click', () => {
            const open = nav.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
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

    const supportMarkup =
        '<form class="form-group support-dialog-form" data-form>' +
        '<button type="button" class="support-dialog-close" data-support-close aria-label="Закрыть">×</button>' +
        '<p class="support-dialog-kicker">Поддержка</p>' +
        '<h2 id="support-dialog-title">Написать в поддержку</h2>' +
        '<p class="support-dialog-lead">Ответим на почту, обычно в течение двух часов в рабочее время.</p>' +
        '<div class="form-hp" aria-hidden="true"><input type="text" name="company" tabindex="-1" autocomplete="off" /></div>' +
        '<label class="form-field"><span>Имя</span><input type="text" name="name" autocomplete="name" required /></label>' +
        '<label class="form-field"><span>Телефон</span><input type="tel" name="phone" autocomplete="tel" inputmode="tel" maxlength="40" required /></label>' +
        '<label class="form-field"><span>Вопрос</span><textarea name="message" rows="4" required maxlength="1200"></textarea></label>' +
        '<div class="form-actions"><button type="submit" class="btn">Отправить</button></div>' +
        '<label class="form-consent"><input type="checkbox" name="consent" required /><span>Согласен на <a href="privacy.html">обработку персональных данных</a></span></label>' +
        '<p class="form-success">Спасибо! Мы ответим в ближайшее время.</p>' +
        '<p class="form-error" role="alert">Не удалось отправить. Напишите на hello@aspect-it.ru или попробуйте ещё раз.</p>' +
        '</form>';

    const supportOpeners = document.querySelectorAll('[data-support-open]');
    if (supportOpeners.length) {
        const dialog = document.createElement('dialog');
        dialog.className = 'support-dialog';
        dialog.setAttribute('aria-labelledby', 'support-dialog-title');
        dialog.innerHTML = supportMarkup;
        document.body.appendChild(dialog);
        supportOpeners.forEach((el) => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof dialog.showModal === 'function') dialog.showModal();
            });
        });
        dialog.querySelectorAll('[data-support-close]').forEach((btn) => {
            btn.addEventListener('click', () => dialog.close());
        });
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
    }

    const promoKey = 'aspect-support-promo';
    let promoSeen = false;
    try {
        promoSeen = Boolean(sessionStorage.getItem(promoKey));
    } catch (err) {}
    const skipPromo =
        /privacy\.html$/i.test(location.pathname) ||
        promoSeen ||
        typeof HTMLDialogElement === 'undefined';

    if (!skipPromo) {
        const onServices = /services\.html$/i.test(location.pathname);
        const contactHref = document.getElementById('contact') ? '#contact' : 'index.html#contact';
        const tariffHref = onServices ? '#support' : 'services.html#support';
        const promo = document.createElement('dialog');
        promo.className = 'promo-dialog';
        promo.setAttribute('aria-labelledby', 'promo-dialog-title');
        promo.innerHTML =
            '<div class="promo-dialog-inner">' +
            '<button type="button" class="promo-dialog-close" data-promo-close aria-label="Закрыть">×</button>' +
            '<aside class="promo-dialog-price">' +
            '<p class="promo-dialog-kicker">IT-поддержка сайта</p>' +
            '<p class="promo-dialog-sum">8&nbsp;000&nbsp;₽</p>' +
            '<p class="promo-dialog-period">в месяц</p>' +
            '<p class="promo-dialog-note">абонемент · без скрытых доплат</p>' +
            '</aside>' +
            '<div class="promo-dialog-copy">' +
            '<h2 id="promo-dialog-title">Сайт без хозяина теряет заявки каждый день</h2>' +
            '<p class="promo-dialog-lead">Пока прайс устарел, форма молчит, а карта в Яндексе пустая — клиент уходит к тому, у кого страница живая. Берём ведение на себя: как штатный IT, только без оклада и собеседований.</p>' +
            '<ul class="promo-dialog-list">' +
            '<li>Прайсы, акции и тексты — на сайте за 24 часа</li>' +
            '<li>HTTPS, бэкапы и мониторинг — без вашего админа</li>' +
            '<li>Яндекс.Карты, отзывы и Avito в одном тарифе</li>' +
            '<li>Короткий отчёт каждый месяц: что сделали</li>' +
            '</ul>' +
            '<div class="promo-dialog-actions">' +
            '<a class="btn btn-ia" href="' + contactHref + '">Подключить поддержку</a>' +
            '<a class="promo-dialog-more" href="' + tariffHref + '">Что входит в тариф</a>' +
            '</div>' +
            '</div></div>';
        document.body.appendChild(promo);

        const dismissPromo = () => {
            try {
                sessionStorage.setItem(promoKey, '1');
            } catch (err) {}
            if (promo.open) promo.close();
        };

        promo.querySelectorAll('[data-promo-close]').forEach((btn) => {
            btn.addEventListener('click', dismissPromo);
        });
        promo.addEventListener('click', (e) => {
            if (e.target === promo) dismissPromo();
        });
        promo.addEventListener('cancel', dismissPromo);
        promo.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                try {
                    sessionStorage.setItem(promoKey, '1');
                } catch (err) {}
                promo.close();
            });
        });

        window.setTimeout(() => {
            try {
                if (sessionStorage.getItem(promoKey)) return;
            } catch (err) {}
            if (typeof promo.showModal === 'function') promo.showModal();
        }, reduceMotion ? 200 : 900);
    }

    const phoneChars = /[^\d+\s().-]/g;
    const phoneMessage = 'Укажите номер телефона, 10–15 цифр';

    const phoneDigits = (value) => (value || '').replace(/\D/g, '');
    const phoneOk = (value) => {
        const digits = phoneDigits(value);
        return digits.length >= 10 && digits.length <= 15;
    };

    const fieldErrorFor = (input) => {
        const field = input.closest('.form-field');
        if (!field) return null;
        let err = field.querySelector('.field-error');
        if (!err) {
            err = document.createElement('span');
            err.className = 'field-error';
            err.id = (input.name || 'field') + '-error-' + Math.random().toString(36).slice(2, 6);
            err.setAttribute('role', 'alert');
            err.hidden = true;
            field.appendChild(err);
            input.setAttribute('aria-describedby', err.id);
        }
        return err;
    };

    const setFieldError = (input, message) => {
        if (!input) return;
        const err = fieldErrorFor(input);
        input.setCustomValidity(message || '');
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
        if (!err) return;
        err.textContent = message || '';
        err.hidden = !message;
    };

    const cleanPhoneInput = (input) => {
        const cleaned = input.value.replace(phoneChars, '');
        if (cleaned !== input.value) {
            const removed = input.value.length - cleaned.length;
            const pos = input.selectionStart;
            input.value = cleaned;
            if (typeof pos === 'number') {
                const next = Math.max(0, pos - removed);
                input.setSelectionRange(next, next);
            }
        }
        if (phoneOk(input.value) || !input.value.trim()) {
            setFieldError(input, '');
        }
    };

    document.querySelectorAll('form[data-form]').forEach((form) => {
        const phoneInput = form.elements.phone;
        if (phoneInput) {
            phoneInput.setAttribute('maxlength', '40');
            phoneInput.setAttribute('autocomplete', 'tel');
            phoneInput.addEventListener('input', () => cleanPhoneInput(phoneInput));
            phoneInput.addEventListener('blur', () => {
                if (phoneInput.value.trim() && !phoneOk(phoneInput.value)) {
                    setFieldError(phoneInput, phoneMessage);
                }
            });
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const success = form.querySelector('.form-success');
            const error = form.querySelector('.form-error');
            if (error) error.style.display = 'none';
            if (phoneInput) {
                cleanPhoneInput(phoneInput);
                if (!phoneOk(phoneInput.value)) {
                    setFieldError(phoneInput, phoneMessage);
                    phoneInput.focus();
                    if (success) success.style.display = 'none';
                    return;
                }
                setFieldError(phoneInput, '');
            }
            const payload = {
                name: (form.elements.name && form.elements.name.value.trim()) || '',
                phone: (phoneInput && phoneInput.value.trim()) || '',
                company: (form.elements.company && form.elements.company.value.trim()) || '',
                message: (form.elements.message && form.elements.message.value.trim()) || '',
                page: window.location.pathname,
            };
            if (success) success.style.display = 'block';
            form.reset();
            fetch('/api/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }).catch(() => {});
        });
    });
});
