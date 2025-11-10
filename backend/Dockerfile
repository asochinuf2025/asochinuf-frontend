# Dockerfile para ASOCHINUF Backend
FROM node:20-alpine

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código
COPY . .

# Exponer puerto
EXPOSE 5001

# Comando para iniciar la aplicación
CMD ["npm", "start"]
