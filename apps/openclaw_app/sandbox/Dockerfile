FROM python:3.12-slim

WORKDIR /app

ARG NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=${NPM_CONFIG_REGISTRY}

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash curl git ca-certificates jq procps && \
    rm -rf /var/lib/apt/lists/*

COPY runner.py /app/runner.py

ENV PYTHONUNBUFFERED=1
WORKDIR /workspace

CMD ["python", "/app/runner.py"]
