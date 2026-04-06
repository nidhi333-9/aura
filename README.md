# Aura 🌟
> Understand your productivity without saying a word.

Aura is an AI-powered productivity tracker that passively monitors your computer activity and converts it into real-time insights — focus score, mood analysis, and personalized recommendations.

## 🖥️ Preview

![Aura Dashboard](your-screenshot-or-gif-link)

## 🌐 Live Demo

🔗 https://aura-gamma-eight.vercel.app  
📦 https://github.com/nidhi333-9/aura

## ✨ Features

- Real-time Focus Score based on app & browser usage  
- Smart detection of productive platforms (LeetCode, GitHub, etc.)  
- Focus Trend Graph for daily insights  
- Mood Analysis (Deep Focus, Calm Flow, Low Energy)  
- Personalized YouTube recommendations  
- Spotify integration for mood-based playlists  
- Cross-platform desktop sensor (Mac + Windows)

## 🎨 UI/UX Highlights

- Minimal and distraction-free dashboard  
- Smooth real-time updates  
- Designed for actionable insights, not data overload

## 🛠️ Tech Stack

- Frontend: React + Vite + TailwindCSS  
- Backend: Node.js + Express  
- ML Service: Python + FastAPI  
- Database: MongoDB  
- Desktop Agent: Python + PyInstaller  
- Deployment: Vercel + Railway

## ⚙️ How It Works

1. Desktop sensor tracks active apps and browser tabs  
2. Data is sent to backend for processing  
3. ML service analyzes behavior and predicts focus/mood  
4. Frontend displays insights in real-time

## 🚀 Getting Started

1. Visit: https://aura-gamma-eight.vercel.app  
2. Login with Google  
3. Download the desktop sensor  
4. Run the sensor  
5. Start tracking your productivity in real time

## 💻 Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB

### Backend
cd backend  
npm install  
node server.js  

### Frontend
cd frontend  
npm install  
npm run dev  

### ML Service
cd ml-service  
pip install -r requirements.txt  
uvicorn api:app --reload  

### Sensor
cd tracker  
pip install pywinctl requests  
python sensor.py  

## 🔐 Environment Variables

### Backend
MONGO_URI=  
JWT_SECRET=  
YOUTUBE_API_KEY=  

### Frontend
VITE_API_URL=  

## 📦 Deployment

- Frontend → Vercel  
- Backend → Railway  
- ML Service → Railway  
- Database → MongoDB

## 👩‍💻 Author

**Nidhi Sharma**

- GitHub: https://github.com/nidhi333-9  
- LinkedIn: https://www.linkedin.com/in/techynidhi3/
