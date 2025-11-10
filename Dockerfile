# Multi-stage build para ASOCHINUF
# Etapa 1: Construir frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/yarn.lock ./

RUN yarn install --frozen-lockfile

COPY frontend/ .

RUN yarn build

# Etapa 2: Preparar backend
FROM node:20-alpine AS backend-base

WORKDIR /app/backend

COPY backend/package*.json ./

RUN npm install --production

COPY backend/ .

# Etapa final: Ejecutar backend + servir frontend
FROM node:20-alpine

# Instalar nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Copiar backend
COPY --from=backend-base /app/backend /app/backend

# Copiar frontend construido
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Crear directorio para configuración nginx
RUN mkdir -p /etc/nginx/conf.d

# Copiar configuración nginx
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Cambiar permisos
RUN chmod 755 /usr/share/nginx/html

# Crear script de entrada
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo 'echo "Iniciando Nginx..."' >> /app/entrypoint.sh && \
    echo 'nginx -g "daemon off;" &' >> /app/entrypoint.sh && \
    echo 'NGINX_PID=$!' >> /app/entrypoint.sh && \
    echo 'echo "Iniciando Backend Node.js..."' >> /app/entrypoint.sh && \
    echo 'cd /app/backend && npm start' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 80

CMD ["/app/entrypoint.sh"]
