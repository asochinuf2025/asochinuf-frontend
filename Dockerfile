# Multi-stage build para ASOCHINUF
# Etapa 1: Construir frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json ./

# Copiar yarn.lock si existe
COPY frontend/yarn.lock* ./

RUN yarn install

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
RUN chmod -R 755 /usr/share/nginx/html && \
    ls -la /usr/share/nginx/html/

# Crear script de entrada mejorado
RUN mkdir -p /app/scripts && \
    echo '#!/bin/sh' > /app/scripts/entrypoint.sh && \
    echo 'set -e' >> /app/scripts/entrypoint.sh && \
    echo '' >> /app/scripts/entrypoint.sh && \
    echo 'echo "========================================="' >> /app/scripts/entrypoint.sh && \
    echo 'echo "Iniciando ASOCHINUF..."' >> /app/scripts/entrypoint.sh && \
    echo 'echo "========================================="' >> /app/scripts/entrypoint.sh && \
    echo '' >> /app/scripts/entrypoint.sh && \
    echo 'echo "Archivos en /usr/share/nginx/html:"' >> /app/scripts/entrypoint.sh && \
    echo 'ls -la /usr/share/nginx/html/' >> /app/scripts/entrypoint.sh && \
    echo '' >> /app/scripts/entrypoint.sh && \
    echo 'echo "Iniciando Nginx en background..."' >> /app/scripts/entrypoint.sh && \
    echo 'nginx -g "daemon off;" > /var/log/nginx/access.log 2>&1 &' >> /app/scripts/entrypoint.sh && \
    echo 'NGINX_PID=$!' >> /app/scripts/entrypoint.sh && \
    echo 'echo "Nginx PID: $NGINX_PID"' >> /app/scripts/entrypoint.sh && \
    echo 'sleep 2' >> /app/scripts/entrypoint.sh && \
    echo 'echo "Verificando que Nginx está corriendo:"' >> /app/scripts/entrypoint.sh && \
    echo 'ps aux | grep nginx' >> /app/scripts/entrypoint.sh && \
    echo '' >> /app/scripts/entrypoint.sh && \
    echo 'echo "Iniciando Backend Node.js en puerto 5001..."' >> /app/scripts/entrypoint.sh && \
    echo 'cd /app/backend' >> /app/scripts/entrypoint.sh && \
    echo 'npm start' >> /app/scripts/entrypoint.sh && \
    chmod +x /app/scripts/entrypoint.sh

EXPOSE 80

CMD ["/app/scripts/entrypoint.sh"]
