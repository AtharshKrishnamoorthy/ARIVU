FROM python:3.10-slim

WORKDIR /app

# Install system dependencies if required by any python packages (like psycopg2 or building wheels)
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Copy only the arivu source tree (ignoring root garbage) so the module 'arivu' can be resolved
COPY arivu/ ./arivu/

EXPOSE 8000

CMD ["python", "-m", "arivu.dashboard.backend", "--host", "0.0.0.0", "--port", "8000"]
