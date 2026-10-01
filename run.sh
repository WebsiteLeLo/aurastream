#!/bin/bash
echo "Starting AuraStream..."

if ! command -v python3 &> /dev/null
then
    echo "Python3 is not installed! Please install python3 and python3-venv."
    exit 1
fi

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing requirements..."
pip install -r requirements.txt

echo "Starting the server..."
python3 app.py
