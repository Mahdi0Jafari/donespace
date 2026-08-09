FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt gunicorn

# Copy all project files
COPY . .

# Expose port (flask is configured for 3004)
EXPOSE 3004

# Run with Gunicorn instead of Flask development server
CMD ["gunicorn", "-w", "2", "--timeout", "120", "-b", "0.0.0.0:3004", "app:app"]
