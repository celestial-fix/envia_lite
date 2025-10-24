# Single-stage Dockerfile for Envia lite application
# Uses Alpine Python for smaller image size

FROM python:3.11-alpine

# Set working directory
WORKDIR /

# Copy application files
COPY . .

# Expose port
EXPOSE 9000

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=9000 \
    DEMO_MODE=true

# Run the application directly
# For DEMO mode (safe testing): CMD [ "python", "server.py", "9000", "--demo" ]
# For LIVE mode (real emails): CMD [ "python", "server.py", "9000" ]
CMD [ "python", "server.py", "9000", "--demo" ]
