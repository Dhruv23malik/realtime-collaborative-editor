# 🚀 Real-Time Collaborative Code Editor

A production-grade real-time collaborative code editor built with React, Monaco Editor, and Socket.IO.  
Multiple users can edit code simultaneously, see live presence updates, and chat in real time.

---

## 🧠 Overview

This project demonstrates real-time systems architecture using WebSockets with a stable UI layout designed around Monaco Editor constraints.

The application ensures:
- Single socket connection per browser tab
- Live code synchronization
- Accurate user presence tracking
- Persistent real-time chat
- Stable Monaco layout during UI changes

---

## ✨ Features

### 🔹 Real-Time Code Collaboration
- Built using Monaco Editor
- Multiple users can edit simultaneously
- Live updates via Socket.IO
- Prevents feedback loops
- Safe editor remounting on layout changes

### 🔹 Single-Socket Architecture
- Exactly one socket connection per browser tab
- Socket created at application root
- Shared across editor, chat, and presence system

### 🔹 Live User Presence
- Displays number of connected users
- Accurate on refresh
- Uses `socket.id` tracking on backend
- No manual increment/decrement counters

### 🔹 Real-Time Chat Panel
- Instant message broadcasting
- Temporary usernames (Guest-XXX)
- Auto-scroll behavior
- Persistent messages (in-memory backend storage)

### 🔹 Stable Layout System
- Built using Flexbox
- No absolute positioning hacks
- Fixed-width chat panel
- No animated container resizing around Monaco

---

## 🛠️ Tech Stack

### Frontend
- React (Vite)
- Monaco Editor
- Socket.IO Client
- Inline styles (Flexbox layout)

### Backend
- Node.js
- Express
- Socket.IO
- CORS enabled

---

## 📂 Project Structure

```text
├── backend/
│   ├── index.js          # Express app and Socket.IO setup
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CollaborativeEditor.jsx   # Monaco Editor integration
│   │   │   ├── ChatPanel.jsx             # Real-time chat integration
│   │   ├── App.jsx                       # Main Routing and Layout
│   │   ├── index.css                     # Tailwind / Global styles
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## 🚀 Live Deployment

The application is fully deployed and live!

- **Frontend:** Hosted on [Vercel](https://vercel.com)
  - Automatically builds via `npm run build` using the GitHub integration.
- **Backend:** Hosted on [Render](https://render.com)
  - Serves the Socket.IO endpoints.

Enjoy collaborating in real-time! 🌍
