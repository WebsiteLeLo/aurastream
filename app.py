from flask import Flask, render_template, request, jsonify
import sys
import os

# Ensure spotapi can be imported from the cloned repo
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'SpotAPI')))
from spotapi import Song

app = Flask(__name__)
song_api = Song()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search')
def search():
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'No query provided'}), 400
        
    try:
        import time
        results = None
        # Paginates 20 songs, added retry logic because SpotAPI sometimes fails to scrape hashes
        for attempt in range(3):
            try:
                results = song_api.query_songs(query, limit=20)
                break
            except Exception as e:
                if attempt == 2:
                    raise e
                time.sleep(1)
                
        items = results.get("data", {}).get("searchV2", {}).get("tracksV2", {}).get("items", [])
        
        songs = []
        for item in items:
            data = item.get('item', {}).get('data', {})
            
            # Extract basic track info
            track_name = data.get('name', 'Unknown Title')
            track_id = data.get('id', '')
            
            # Extract artists
            artists_data = data.get('artists', {}).get('items', [])
            artists = [a.get('profile', {}).get('name', 'Unknown Artist') for a in artists_data]
            
            # Extract album and cover art
            album_data = data.get('albumOfTrack', {})
            album_name = album_data.get('name', 'Unknown Album')
            cover_art = ""
            cover_art_sources = album_data.get('coverArt', {}).get('sources', [])
            if cover_art_sources:
                # Get the highest resolution cover art
                cover_art = sorted(cover_art_sources, key=lambda x: x.get('width', 0), reverse=True)[0].get('url', '')
                
            # Extract duration (ms to mm:ss)
            duration_ms = data.get('duration', {}).get('totalMilliseconds', 0)
            seconds = int((duration_ms / 1000) % 60)
            minutes = int((duration_ms / (1000 * 60)) % 60)
            duration_formatted = f"{minutes}:{seconds:02d}"
            
            # Extract preview URL if available (usually in different nodes, but we'll try to find it or just leave empty)
            preview_url = "" # Often requires different endpoint or specific nested data
            
            songs.append({
                'id': track_id,
                'name': track_name,
                'artists': ", ".join(artists),
                'album': album_name,
                'cover_art': cover_art,
                'duration': duration_formatted,
                'duration_ms': duration_ms,
                'preview_url': preview_url
            })
            
        return jsonify({'results': songs})
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Fallback to YouTube Search if Spotify blocks the IP
        try:
            from youtubesearchpython import VideosSearch
            videosSearch = VideosSearch(query, limit = 15)
            results = videosSearch.result().get('result', [])
            songs = []
            for video in results:
                songs.append({
                    'id': video.get('id', ''),
                    'name': video.get('title', 'Unknown'),
                    'artists': video.get('channel', {}).get('name', 'Unknown Artist'),
                    'album': 'YouTube Audio',
                    'cover_art': video.get('thumbnails', [{}])[0].get('url', 'https://via.placeholder.com/300'),
                    'duration': video.get('duration', '0:00'),
                    'duration_ms': 0,
                    'preview_url': ''
                })
            return jsonify({'results': songs})
        except Exception as fallback_e:
            return jsonify({'error': str(e), 'fallback_error': str(fallback_e)}), 500

@app.route('/api/play')
def play():
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'No query provided'}), 400
        
    try:
        import yt_dlp
        import os
        
        ydl_opts = {
            'format': 'best',
            'noplaylist': True,
            'quiet': True,
            'default_search': 'ytsearch',
            'extract_flat': False,
            'ignoreerrors': False,
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}}
        }
        
        # Check for local cookies.txt file if user wants to use their own cookies
        if os.path.exists('cookies.txt'):
            ydl_opts['cookiefile'] = 'cookies.txt'


        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Append 'official audio' to ensure we get the official song and not a weird video/wrong song
            info = ydl.extract_info(f"ytsearch1:{query} official audio", download=False)
            
            if info and 'entries' in info and info['entries'] and len(info['entries']) > 0:
                entry = info['entries'][0]
                if entry and 'url' in entry:
                    return jsonify({'url': entry['url']})
                    
        return jsonify({'error': 'Not found'}), 404
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

import requests
from flask import Response

@app.route('/api/stream')
def stream_audio():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'No url provided'}), 400
        
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    }
    
    range_header = request.headers.get('Range', None)
    if range_header:
        headers['Range'] = range_header

    try:
        req = requests.get(url, headers=headers, stream=True, timeout=10)
        
        def generate():
            for chunk in req.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk

        resp = Response(generate(), status=req.status_code, content_type=req.headers.get('content-type', 'audio/mpeg'))
        if 'Content-Range' in req.headers:
            resp.headers['Content-Range'] = req.headers['Content-Range']
        if 'Content-Length' in req.headers:
            resp.headers['Content-Length'] = req.headers['Content-Length']
        resp.headers['Accept-Ranges'] = 'bytes'
        return resp
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download')
def download_audio():
    url = request.args.get('url')
    name = request.args.get('name', 'Song')
    if not url:
        return jsonify({'error': 'No url provided'}), 400
        
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }
    
    try:
        req = requests.get(url, headers=headers, stream=True, timeout=10)
        
        def generate():
            for chunk in req.iter_content(chunk_size=8192):
                if chunk:
                    yield chunk

        resp = Response(generate(), status=req.status_code, content_type=req.headers.get('content-type', 'audio/mpeg'))
        # Set attachment header to force download
        safe_name = "".join([c for c in name if c.isalpha() or c.isdigit() or c==' ' or c=='-']).rstrip()
        filename = f"[AuraStream] {safe_name}.mp3"
        resp.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        if 'Content-Length' in req.headers:
            resp.headers['Content-Length'] = req.headers['Content-Length']
        
        return resp
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860)
