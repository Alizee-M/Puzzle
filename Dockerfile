FROM nginx:1.27-alpine

COPY www/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
