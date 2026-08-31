const JIVO_WIDGET_ID = '5hSboL7QZ5';

if (JIVO_WIDGET_ID) {
    const script = document.createElement('script');
    script.src = 'https://code.jivo.ru/widget/' + JIVO_WIDGET_ID;
    script.async = true;
    document.head.appendChild(script);
}
