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
COPY docker-entrypoint.sh .

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Expose port
ARG PORT=8000
ENV PORT=$PORT
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/ || exit 1

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # Set DEMO_MODE to "true" to enable demo mode. Any other value disables it.
    DEMO_MODE="false"

# Run the application
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["python", "server.py"]
