FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Hugging Face Spaces expose port 7860
EXPOSE 7860

# Run with gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:7860", "app:app", "--workers", "2", "--threads", "4", "--timeout", "120"]
