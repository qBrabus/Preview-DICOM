FROM python:3.11 as builder

WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip \
    && pip wheel --no-cache-dir --wheel-dir /wheels -r /app/requirements.txt

FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY --from=builder /wheels /wheels
RUN pip install --no-cache /wheels/*

COPY backend/app /app/app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
