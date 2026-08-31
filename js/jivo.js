window.jivo_onLoadCallback = function () {
    try {
        if (window.jivo_api && typeof window.jivo_api.setRules === 'function') {
            window.jivo_api.setRules([]);
        } else if (window.jivo_config) {
            window.jivo_config.rules = [];
        }
        if (window.jivo_api && typeof window.jivo_api.close === 'function') {
            window.jivo_api.close();
        }
    } catch (err) {}
};

const JIVO_WIDGET_ID = '5hSboL7QZ5';

if (JIVO_WIDGET_ID) {
    const script = document.createElement('script');
    script.src = 'https://code.jivo.ru/widget/' + JIVO_WIDGET_ID;
    script.async = true;
    document.head.appendChild(script);
}
