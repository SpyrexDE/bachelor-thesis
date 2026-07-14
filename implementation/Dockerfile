FROM python:3.14-slim

# tesseract: spec-compliance OCR (concept/03); dejavu: deterministic text rendering
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
COPY briefs ./briefs
RUN pip install --no-cache-dir .

ENV GRAIN_DATA_DIR=/data \
    GRAIN_BRIEFS_DIR=/app/briefs \
    GRAIN_PROVIDER=mock

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"]

CMD ["uvicorn", "--factory", "grain.api.app:create_app", "--host", "0.0.0.0", "--port", "8000"]
