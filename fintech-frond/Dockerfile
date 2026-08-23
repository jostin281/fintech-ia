# Imagen de desarrollo del frontend (Angular). Corre "ng serve" para que
# los cambios de código se reflejen al vuelo en el navegador, igual que
# "npm start" directo en tu PC — pero sin depender de tener Node instalado
# en Windows.
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4200

# --host 0.0.0.0: para que el servidor de Angular acepte conexiones desde
# fuera del contenedor (por defecto solo escucha en localhost del propio
# contenedor, y no lo verías desde tu navegador en Windows).
# --poll 2000: en Windows, los cambios de archivos a través de un volumen
# montado no siempre disparan eventos nativos del sistema de archivos;
# con --poll, Angular revisa cada 2 segundos si algo cambió.
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]
