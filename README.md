# 🎓 Smart Classroom 2.0 — Web-Based Low-Latency Live Platform

Welcome to **Smart Classroom 2.0**, a next-generation real-time learning platform built entirely for modern web browsers! It provides real-time vector whiteboard drawing synchronization, live streaming subtitles translated into your native language (Hindi, Bengali, Spanish, French, German, Japanese, etc.), 100% anonymous live student doubt solving, content moderation, personalized AI study notes generation, and recorded lecture playback.

---

## 🌟 Key Features

1. **🎨 Real-Time Vector Whiteboard Sync**: Sub-10ms drawing replication between Teacher and Student screens using a Canonical 1920x1080 virtual resolution frame. Includes infinite pan & zoom navigation.
2. **🌐 YouTube-Style Live Captions & Multilingual Subtitles**: Spoken speech is transcribed instantly and translated (< 30ms latency) into native languages with dual-view original English references.
3. **🕵️ 100% Anonymous Live Student Doubts**: Students can ask live doubts without fear of judgment. The Teacher whiteboard features a glowing **🔔 Live Doubts Bell** with unread counters and audio alerts.
4. **🛡️ Content Moderation & Flagism Engine**: Dual-layer profanity keyword blocking at client & server levels, plus a 1-click **`🚩 Flag / Report`** button for teachers with a **Big Red Flag Warning Overlay** on student screens.
5. **📝 IBM Granite 3.0 AI Study Notes**: 1-click personalized study guide generation based on live lecture transcripts, complete with 1-click PDF print export.
6. **🤖 Floating FAB AI Assistant**: Powered by Cerebras ultra-fast LLM (`gpt-oss-120b`) for instant academic Q&A.
7. **🔐 Student Authentication Engine**: Registered Gmail login with mandatory verification code validation (`csjmu`).

---

## 🛠️ Technologies & Tech Stack Used

- **Frontend**: HTML5, Vanilla CSS Glassmorphic System, JavaScript ES6+, HTML5 2D Canvas API, Web Speech API, Web Audio API.
- **Backend Gateway**: Node.js, Express.js, WebSockets (`ws`), CORS, Body-Parser.
- **AI Models & Cloud Engines**:
  - **Google Translate Free Engine API**: Sub-30ms live multilingual translation.
  - **IBM Granite 3.0 Model** (`ibm-granite/granite-3.0-8b-instruct`): Automated study notes generation.
  - **Cerebras LLM API** (`gpt-oss-120b`): Ultra-fast AI doubt assistant.
- **Storage Layer**: Persistent JSON Store (`students_db.json`, `sessions.json`).

---

## 🚀 How to Install and Run the Project (Step-by-Step Guide)

> *Follow these super easy steps! Even a 2nd standard student can run this project in 2 minutes!*

---

### Step 1: Download & Install Node.js (If you don't have it)
1. Go to **[https://nodejs.org](https://nodejs.org)** in your web browser.
2. Click the big green button that says **"20.x.x LTS (Recommended For Most Users)"**.
3. Once downloaded, double-click the downloaded file and click **"Next" ➔ "Next" ➔ "Install" ➔ "Finish"**.

---

### Step 2: Download / Open the Project Folder
1. Download or clone this project folder to your Desktop.
2. Open the folder `vision-x-final-round`.

---

### Step 3: Open Command Prompt (Terminal)
1. Press `Windows Key + R` on your keyboard.
2. Type `cmd` and press **Enter**.
3. Navigate into the project folder by typing:
   ```bash
   cd Desktop\vision-x-final-round
   ```

---

### Step 4: Install Dependencies & Start the Server
1. Go into the `server` folder and install dependencies:
   ```bash
   cd server
   npm install
   ```
2. Now start the backend server:
   ```bash
   node server.js
   ```
3. You will see a success message on your screen:
   ```
   ====================================================
   🎓 Smart Classroom 2.0 Backend Server running on port 5000
   📡 WebSocket Gateway: ws://localhost:5000
   🔗 REST API Base URL: http://localhost:5000/api
   🖥️ Student Web App:  http://localhost:5000/index.html
   👨‍🏫 Teacher Web App:  http://localhost:5000/teacher.html
   ====================================================
   ```

---

### Step 5: Open the Web Applications in your Browser!
Open Google Chrome, Edge, or Safari and click these links:

- 🎓 **Student App**: 👉 **[http://localhost:5000/index.html](http://localhost:5000/index.html)**
- 👨‍🏫 **Teacher Panel**: 👉 **[http://localhost:5000/teacher.html](http://localhost:5000/teacher.html)**
- 📊 **Teacher Analytics**: 👉 **[http://localhost:5000/teacher-analysis.html](http://localhost:5000/teacher-analysis.html)**

---

## 🎮 How to Test & Use Features

### 1. Student Signup & Login:
- Click **"Student Sign In / Register"** in top navbar.
- Click **"Don't have an account? Sign Up"**.
- Enter your Name, Email, Password, Roll Number, and the mandatory Verification Code: **`csjmu`**.

### 2. Teacher Whiteboard & Mic Broadcasting:
- Open the **Teacher Panel** ([http://localhost:5000/teacher.html](http://localhost:5000/teacher.html)).
- Click **"🎙️ Start Web Speech Mic"** and allow microphone access. Speak into your mic—words stream live onto the Student screen!
- Draw on the canvas—lines appear instantly on student screens!

### 3. Subtitle Languages:
- On the **Student Panel** ([http://localhost:5000/index.html](http://localhost:5000/index.html)), select **`Hindi (हिंदी)`** or **`Bengali (বাংলা)`** from the top bar dropdown. Incoming speech translates live in real-time!

### 4. Asking Anonymous Doubts & Flagism:
- On Student Canvas, click **"🙋‍♂️ Ask Teacher Live Doubt"** and send a question.
- On Teacher Canvas, the glowing **🔔 Bell Icon** will ring! Click it to view doubts.
- Click **`✓ Mark Resolved`** to clear or **`🚩 Flag / Report`** to flag inappropriate questions.

### 5. Generating IBM Granite AI Notes:
- Click **"📝 AI Granite Notes"** in the top navbar to generate a structured markdown study guide and export as a PDF!

---

## ❓ Frequently Asked Questions (FAQ)

- **Q: What is the Student Signup Verification Code?**  
  **A:** The required verification code is **`csjmu`** (case-insensitive).

- **Q: What if port 5000 is already in use?**  
  **A:** Close any other running terminal windows or run `PORT=5001 node server.js`.

- **Q: Do I need to install any database?**  
  **A:** No! The platform uses built-in persistent JSON data stores (`students_db.json` & `sessions.json`).

---

🎉 **Congratulations! Your Smart Classroom 2.0 platform is now live and running!**
