FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash curl git ca-certificates jq procps nodejs npm && \
    npm install -g openclaw && \
    rm -rf /var/lib/apt/lists/*

COPY runner.py /app/runner.py

ENV PYTHONUNBUFFERED=1
WORKDIR /workspace

CMD ["python", "/app/runner.py"]
