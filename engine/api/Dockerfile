FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar el código fuente de engine
# Funciona tanto si el contexto de build es la raíz (.) como si es engine/
COPY . /app/source/

# Organizar la estructura en /app/engine
RUN python -c "import os, shutil; src = '/app/source'; dest = '/app/engine'; os.makedirs(dest, exist_ok=True); (shutil.copytree('/app/source/engine', dest, dirs_exist_ok=True) if os.path.exists('/app/source/engine') else shutil.copytree('/app/source', dest, dirs_exist_ok=True))" && \
    pip install --no-cache-dir -r /app/engine/api/requirements.txt && \
    rm -rf /app/source

ENV PYTHONPATH=/app/engine
WORKDIR /app/engine/api

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
