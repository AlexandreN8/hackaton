FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir aiohttp==3.9.5

COPY . .

CMD ["python", "-m", "http.server", "8080"]
