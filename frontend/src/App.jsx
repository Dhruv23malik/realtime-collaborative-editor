import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import CollaborativeEditor from "./components/CollaborativeEditor";
import ChatPanel from "./components/ChatPanel";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

function RoomApp() {
  const [users, setUsers] = useState(0);
  const [socket, setSocket] = useState(null);
  const [showChat, setShowChat] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [language, setLanguage] = useState("javascript");
  const { roomId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId) {
      // If somehow no roomId, redirect to a new random room
      const randomRoom = crypto.randomUUID().slice(0, 8);
      navigate(`/room/${randomRoom}`, { replace: true });
      return;
    }

    const s = io(SOCKET_URL);
    setSocket(s);

    s.emit("join-room", roomId);

    s.on("users-update", (count) => {
      setUsers(count);
    });

    s.on("language-change", (newLanguage) => {
      setLanguage(newLanguage);
    });

    return () => {
      s.off("users-update");
      s.off("language-change");
      s.disconnect();
    };
  }, [roomId, navigate]);

  const handleLanguageChange = (event) => {
    const newLanguage = event.target.value;
    setLanguage(newLanguage);
    if (socket) {
      socket.emit("language-change", newLanguage);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {/* NAVBAR */}
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900/60 px-4 backdrop-blur-md">
        {/* Left: Logo + Name */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-500 text-xs font-semibold shadow-sm">
            CC
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">
              CollabCode
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              Real-time workspace
            </span>
          </div>
        </div>

        {/* Right: Presence + Language + Chat toggle */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-medium text-slate-200">
              {users} users in this room
            </span>
          </div>

          <select
            value={language}
            onChange={handleLanguageChange}
            className="h-8 rounded-md border border-slate-700 bg-slate-900/80 px-2 text-xs font-medium text-slate-100 shadow-sm outline-none focus:border-sky-500"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="cpp">C++</option>
          </select>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="hidden sm:inline">Room:</span>
            <span className="rounded-md bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] text-slate-200">
              {roomId}
            </span>
            <button
              type="button"
              onClick={() => {
                const link = window.location.href;
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(link);
                }
              }}
              className="hidden sm:inline-flex items-center rounded-md border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-800"
            >
              Copy link
            </button>
          </div>

          <button
            onClick={() => setShowChat((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-100 shadow-sm transition-colors hover:border-slate-500 hover:bg-slate-800"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span>{showChat ? "Hide chat" : "Show chat"}</span>
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* FILES */}
        <aside className="flex w-56 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={() => setFilesOpen((v) => !v)}
            className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 hover:bg-slate-900/80"
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-slate-800 text-[10px] text-slate-300">
                <>
                  {/* simple file tree icon */}
                  ☰
                </>
              </span>
              <span>Explorer</span>
            </span>
            <span className="text-[10px] text-slate-500">
              {filesOpen ? "▾" : "▸"}
            </span>
          </button>

          <div
            className={`flex-1 overflow-y-auto px-2 py-2 text-sm ${
              filesOpen ? "opacity-100" : "opacity-0"
            } transition-opacity`}
          >
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
              PROJECT
            </div>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800/80">
              <span className="text-sky-400">◆</span>
              <span className="font-medium">index.js</span>
            </button>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800/80">
              <span className="text-sky-400/80">◆</span>
              <span>app.js</span>
            </button>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800/80">
              <span className="text-sky-400/80">◆</span>
              <span>utils.js</span>
            </button>
          </div>
        </aside>

        {/* EDITOR + CHAT */}
        <main className="flex flex-1 overflow-hidden">
          {/* EDITOR */}
          <div className="flex flex-1 flex-col px-3 py-2">
            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  editor.{language}
                </span>
                <span className="text-slate-600">
                  Monaco ·{" "}
                  {language.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex h-full overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-[0_0_0_1px_rgba(15,23,42,0.9)]">
              <div className="flex h-full w-full">
                <CollaborativeEditor
                  key={showChat ? "chat-open" : "chat-closed"}
                  socket={socket}
                  language={language}
                />
              </div>
            </div>
          </div>

          {/* CHAT PANEL */}
          {showChat && (
            <aside
              className="flex h-full flex-shrink-0 border-l border-slate-800 bg-slate-900/70"
              style={{ width: 280 }}
            >
              <ChatPanel socket={socket} />
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/room/:roomId" element={<RoomApp />} />
      <Route
        path="*"
        element={
          <Navigate
            to={`/room/${crypto.randomUUID().slice(0, 8)}`}
            replace
          />
        }
      />
    </Routes>
  );
}
