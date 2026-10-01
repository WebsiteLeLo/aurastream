from spotapi import Song

def main():
    song = Song()
    print("Querying for 'weezer'...")
    songs = song.query_songs("weezer", limit=5)
    
    try:
        data = songs["data"]["searchV2"]["tracksV2"]["items"]
        print("Results:")
        for idx, item in enumerate(data):
            print(f"{idx}: {item['item']['data']['name']}")
    except KeyError as e:
        print(f"Error parsing response data: {e}")
        print("Raw response data:")
        print(songs)

if __name__ == "__main__":
    main()
