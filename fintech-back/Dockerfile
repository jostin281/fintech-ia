# Imagen de desarrollo del backend (NestJS). Corre "start:dev" (watch mode)
# para que los cambios de código se reflejen al vuelo, igual que si
# corrieras "npm run start:dev" directo en tu PC — pero sin depender de
# tener Node ni PostgreSQL instalados en Windows.
FROM node:20-bookworm-slim

WORKDIR /app

# Prisma necesita "openssl" instalado para detectar correctamente la
# versión de OpenSSL del sistema y descargar el motor de consultas
# correcto; sin esto, cae a una versión por defecto que puede fallar.
#
# python3/pip: para scripts/sri/descargar_comprobantes_sri.py, que usa
# Playwright para automatizar la descarga de comprobantes recibidos desde
# SRI en Línea (función OPCIONAL, apagada por defecto — ver
# SRI_DESCARGA_AUTOMATICA_HABILITADA en el .env). "playwright install
# --with-deps chromium" instala Chromium y todas las librerías del sistema
# que necesita para correr en modo headless dentro de este contenedor.
RUN apt-get update -y && apt-get install -y openssl python3 python3-pip && rm -rf /var/lib/apt/lists/*

COPY scripts/sri/requirements.txt ./scripts/sri/requirements.txt
RUN pip install --break-system-packages --no-cache-dir -r scripts/sri/requirements.txt \
    && python3 -m playwright install --with-deps chromium

# Copiamos primero solo los manifiestos para aprovechar el caché de Docker:
# si no cambian las dependencias, "npm install" no se repite en cada build.
# También copiamos prisma/ y prisma.config.ts antes de "npm install" porque
# el script "postinstall" corre "prisma generate", que necesita el schema
# ya presente en ese momento.
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm install

# Copiamos el resto del código fuente.
COPY . .

EXPOSE 3001

# Al arrancar el contenedor: aplica migraciones, genera el cliente de
# Prisma, siembra los datos iniciales y luego levanta el servidor en modo
# watch. Los tres primeros pasos son seguros de repetir (son idempotentes),
# así que esto corre igual la primera vez que en los siguientes arranques.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npx tsx prisma/seed.ts && npm run start:dev"]
