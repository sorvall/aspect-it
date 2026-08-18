FROM public.ecr.aws/docker/library/nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx/http.conf /etc/nginx/templates/http.conf
COPY nginx/ssl.conf /etc/nginx/templates/ssl.conf
COPY nginx/40-enable-ssl.sh /docker-entrypoint.d/40-enable-ssl.sh
RUN chmod +x /docker-entrypoint.d/40-enable-ssl.sh

ENV DOMAIN=aspect-it.ru

COPY index.html services.html privacy.html robots.txt sitemap.xml /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY assets/ /usr/share/nginx/html/assets/
