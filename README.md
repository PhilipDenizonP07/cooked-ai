# 🔥 CookedAI — Savage Gen Z Meta Roasting AI

> *"Ego death served hot with zero chill."*

CookedAI is an AI-powered personality roasting platform that analyzes your vibe, habits, and gender-tailored confessions to deliver brutal, hilarious, and hyper-accurate Gen Z roasts in **Manglish (Gen Z Malayalam)** and **English**.

Powered by **Google Gemini 3.6 Flash** & **OpenAI GPT-4o-mini**, featuring **The Durandham Jury (Council of Roasters)** and a **0ms-lag Voice Synthesis engine**.

---

## 🏛️ The Council of Roasters (Durandham Jury)

Every roast is adjudicated by three distinct judge personas:

* **Judge Pranaamam 🕊️**: The smiling pacifist who hits you with polite spiritual disappointment (*"Pranaamam. Njan ninte aathmavinuvendi prarthikkaam, mone."*).
* **Judge Aavesham 🌌**: Looking upward in permanent agony at your life choices (*"Looking at the ceiling lights because your answers caused permanent retina damage."*).
* **Judge Harithabham 🌾**: Standing in a paddy field taking selfies, pleading with you to disconnect and touch grass (*"I am literally standing in this paddy field waiting for you to come touch grass."*).

---

## ✨ Features

- **3 Spice Modes**:
  - 🌸 **Sensitive**: Gentle, mild roasts without curse words or insults.
  - 🔥 **Savage**: High-heat roasting with wild Gen Z slang.
  - ☢️ **Nuclear**: Aggressive, unrestrained personality destruction.
- **Bilingual Roasts**: Seamlessly switch between **Manglish** (Colloquial Gen Z Malayalam transliteration) and **English**.
- **Gender-Tailored Psychoanalysis**: Customized question packs for Guys, Girls, and Non-Binary personas.
- **Zero-Lag Voice Synthesis**:
  - Background audio pre-warming while you read your diagnosis.
  - Disk-backed Voice Pack learning engine that caches synthesized audio clips.
  - Instant playback when clicking **Read Out Loud**.
- **Authentic Meme Sound Effects**: Features iconic soundbites randomly played after each roast session:
  - *Fahhhhhhhhhhhhhh*
  - *Instagram Thud*
  - *Gopgopgop*

---

## 🚀 Live Deployment on Vercel

CookedAI is pre-configured for seamless serverless deployment on **Vercel** with automatic GitHub CI/CD:

1. Push this repository to your GitHub account (`https://github.com/PhilipDenizonP07/cooked-ai`).
2. Go to [vercel.com/new](https://vercel.com/new) and click **Import** next to `cooked-ai`.
3. *(Optional)* Add your `GEMINI_API_KEY` under **Environment Variables** (or enter it in the app's settings modal at runtime).
4. Click **Deploy**!

> **Continuous Deployment**: Every future commit pushed to your GitHub `main` branch will automatically build and update your live Vercel application instantly.

---

## 💻 Local Development

### 1. Clone the repository
```bash
git clone https://github.com/PhilipDenizonP07/cooked-ai.git
cd cooked-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` (or create `.env`):
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

### 4. Run the development server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Neo-Brutalist Cyberpunk UI), Vanilla JavaScript
- **Backend**: Node.js, Express.js (Vercel Serverless Architecture)
- **AI Models**: Google Gemini 3.6 Flash via `@google/genai`, OpenAI GPT-4o-mini
- **Audio / TTS**: Gemini Multi-modal Audio Synthesis + Web Audio API + HTML5 Audio Pre-warming
- **Deployment**: Vercel Serverless Functions + Global Edge CDN

---

## 📜 License
MIT License. Free to use, fork, and roast your friends responsibly!
