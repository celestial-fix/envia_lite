# Single-stage Dockerfile for Envialite application
# Uses Alpine Python for smaller image size

FROM python:3.11-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy application files
COPY server.py .
COPY index.html .
COPY styles.css .
COPY script.js .
COPY README.md .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Run the application
CMD ["python", "server.py", "8000"]
