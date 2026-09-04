FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema requeridas para Playwright y Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m playwright install --with-deps chromium

COPY . .

# Dar permisos de ejecución al script de inicio
RUN chmod +x entrypoint.sh

CMD ["/app/entrypoint.sh"]
