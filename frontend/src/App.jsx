import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import CollaborativeEditor from "./components/CollaborativeEditor";
import ChatPanel from "./components/ChatPanel";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

const LANGUAGE_DETAILS = {
  javascript: { accent: "from-amber-300 via-orange-400 to-pink-500", label: "JavaScript" },
  python: { accent: "from-sky-300 via-cyan-400 to-emerald-400", label: "Python" },
  html: { accent: "from-orange-300 via-rose-400 to-fuchsia-500", label: "HTML" },
  css: { accent: "from-cyan-300 via-blue-400 to-indigo-500", label: "CSS" },
  json: { accent: "from-lime-300 via-emerald-400 to-teal-500", label: "JSON" },
  cpp: { accent: "from-violet-300 via-purple-400 to-indigo-500", label: "C++" },
};

const PROJECT_FILES = [
  { name: "index.js", type: "Entry", status: "Live" },
  { name: "app.js", type: "UI", status: "Synced" },
  { name: "utils.js", type: "Logic", status: "Ready" },
];

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

  const languageMeta = useMemo(
    () => LANGUAGE_DETAILS[language] ?? LANGUAGE_DETAILS.javascript,
    [language]
  );

  const handleLanguageChange = (event) => {
    const newLanguage = event.target.value;
    setLanguage(newLanguage);
    if (socket) {
      socket.emit("language-change", newLanguage);
    }
  };

  const handleCopyLink = async () => {
    const link = window.location.href;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[-10rem] h-80 w-80 rounded-full bg-cyan-400/18 blur-3xl" />
        <div className="absolute right-[-10rem] top-20 h-72 w-72 rounded-full bg-fuchsia-400/12 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="mesh-overlay absolute inset-0 opacity-40" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="glass-panel animate-rise mb-4 overflow-hidden rounded-[28px] border border-white/10 px-5 py-5 shadow-[0_30px_80px_rgba(8,15,30,0.45)] sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${languageMeta.accent} text-lg font-semibold text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.25)]`}>
                  CC
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-cyan-200/75">
                    Collaborative Studio
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
                    Build together in a workspace that feels current.
                  </h1>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3 backdrop-blur-md">
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">Presence</p>
                  <p className="mt-2 flex items-center gap-2 text-base font-medium text-white">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/70" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
                    </span>
                    {users} collaborators live
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3 backdrop-blur-md">
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">Room</p>
                  <p className="mt-2 font-mono text-base text-white">{roomId}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3 backdrop-blur-md">
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">Focus</p>
                  <p className="mt-2 text-base font-medium text-white">{languageMeta.label} session</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <label className="flex min-w-[180px] flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-400">
                Language
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-sm font-medium tracking-normal text-white outline-none transition focus:border-cyan-300/70"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="json">JSON</option>
                  <option value="cpp">C++</option>
                </select>
              </label>

              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/12"
              >
                Copy invite
              </button>

              <button
                type="button"
                onClick={() => setFilesOpen((value) => !value)}
                className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/12 lg:hidden"
              >
                {filesOpen ? "Hide explorer" : "Show explorer"}
              </button>

              <button
                type="button"
                onClick={() => setShowChat((value) => !value)}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
              >
                {showChat ? "Close chat" : "Open chat"}
              </button>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside
            className={`glass-panel animate-rise overflow-hidden rounded-[28px] border border-white/10 shadow-[0_25px_70px_rgba(8,15,30,0.42)] ${
              filesOpen ? "flex" : "hidden"
            } flex-col lg:flex`}
          >
            <div className="border-b border-white/8 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
                    Explorer
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
                    Shared project map
                  </h2>
                </div>
                <div className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Synced
                </div>
              </div>
            </div>

            <div className="space-y-6 px-5 py-5">
              <div className="rounded-3xl border border-white/8 bg-slate-950/35 p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">Workspace notes</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Lightweight, collaborative, and ready for quick edits. The interface now frames the room like a product workspace instead of a plain editor shell.
                </p>
              </div>

              <div>
                <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Files
                </p>
                <div className="space-y-2">
                  {PROJECT_FILES.map((file, index) => (
                    <button
                      key={file.name}
                      type="button"
                      className="group flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition hover:border-cyan-300/30 hover:bg-white/[0.06]"
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${index === 0 ? languageMeta.accent : "from-slate-700 to-slate-800"} text-sm font-semibold text-white`}>
                        {file.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{file.name}</p>
                        <p className="text-xs text-slate-400">
                          {file.type} · {file.status}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <main className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="glass-panel animate-rise min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 shadow-[0_25px_70px_rgba(8,15,30,0.42)]">
              <div className="border-b border-white/8 px-5 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
                      Editor
                    </p>
                    <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
                      Live canvas for {languageMeta.label}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-slate-300">
                      Monaco editor
                    </span>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-100">
                      Real-time sync
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-[calc(100vh-21rem)] min-h-[360px] p-4 sm:p-5">
                <div className="editor-shell h-full overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-rose-400" />
                      <span className="h-3 w-3 rounded-full bg-amber-300" />
                      <span className="h-3 w-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-full bg-white/6 px-2.5 py-1 font-mono text-slate-300">
                        editor.{language}
                      </span>
                      <span>{languageMeta.label}</span>
                    </div>
                  </div>

                  <div className="h-[calc(100%-3.25rem)]">
                    <CollaborativeEditor
                      key={showChat ? "chat-open" : "chat-closed"}
                      socket={socket}
                      language={language}
                    />
                  </div>
                </div>
              </div>
            </section>

            {showChat && (
              <aside className="glass-panel animate-rise min-h-[320px] overflow-hidden rounded-[28px] border border-white/10 shadow-[0_25px_70px_rgba(8,15,30,0.42)]">
                <ChatPanel socket={socket} />
              </aside>
            )}
          </main>
        </div>
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
        element={<Navigate to={`/room/${crypto.randomUUID().slice(0, 8)}`} replace />}
      />
    </Routes>
  );
}
