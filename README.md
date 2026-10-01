# AuraStream 🎵

AuraStream is a beautiful, modern, and ad-free music streaming web application built with Python and Flask. It uses YouTube as the backend to stream high-quality audio directly to your browser.

## Features ✨
- **Ad-Free Music**: Stream your favorite songs without any interruptions.
- **Beautiful UI**: Modern, glassmorphism-inspired dark mode interface.
- **Lightning Fast**: Built with lightweight Flask and Vanilla JS.
- **Local Streaming**: Run the app locally on your PC/Mac.

## How to Run Locally 🚀

You can easily run this app on your own computer.

### For Windows:
1. Double click on the **`run.bat`** file.
2. It will automatically install everything and start the server.
3. Open your browser and go to: `http://localhost:8000`

### For Linux/Mac:
1. Open your terminal in this folder.
2. Make the script executable: `chmod +x run.sh`
3. Run the script: `./run.sh`
4. Open your browser and go to: `http://localhost:8000`

## YouTube IP Block Issues (Optional) ⚠️
If you get a "Streaming blocked" or "Bot detected" error even when running locally, it means your IP might be temporarily blocked by YouTube. 
To bypass this:
1. Export your YouTube cookies using a browser extension (like "Get cookies.txt LOCALLY").
2. Save them in a file named `cookies.txt` in the same folder as `app.py`.
3. Restart the server!

## Requirements
- Python 3.8+
- Modern Web Browser
