import os
from pathlib import Path
from dotenv import load_dotenv
from googleapiclient.discovery import build

# Define path
load_dotenv() 

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API")

def get_dynamic_video(mood_status):

    try:
        youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
        
        search_queries = {
            "Deep Focus": "lofi hip hop radio coding music",
            "Light Work": "relaxing jazz instrumental",
            "Idle / Break": "5 minute guided meditation"
        }
        
        query = search_queries.get(mood_status, "lofi beats")

        request = youtube.search().list(
            q=query,
            part="snippet",
            type="video",
            maxResults=1,
            videoEmbeddable='true'
        )
        response = request.execute()
        
        if response.get('items'):
            video_id = response['items'][0]['id']['videoId']
            return f"https://www.youtube.com/embed/{video_id}"
            
    except Exception as e:
        print(f"🔥 YouTube API Error: {e}")
        
    return "https://www.youtube.com/embed/jfKfPfyJRdk"