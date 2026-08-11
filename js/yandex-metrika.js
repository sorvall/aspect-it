/**
 * Яндекс.Метрика — замените 0 на номер счётчика из metrika.yandex.ru
 * После добавления домена в Метрике включите «Вебвизор» и «Карта кликов» в настройках счётчика.
 */
const YANDEX_METRIKA_ID = 0;

if (YANDEX_METRIKA_ID > 0) {
    (function (m, e, t, r, i, k, a) {
        m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
        m[i].l = 1 * new Date();
        k = e.createElement(t);
        a = e.getElementsByTagName(t)[0];
        k.async = 1;
        k.src = r;
        a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

    ym(YANDEX_METRIKA_ID, 'init', {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
        ecommerce: 'dataLayer',
    });
}
