import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, useParams, useNavigate, Link } from "react-router-dom";
import { io } from "socket.io-client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import CollaborativeEditor from "./components/CollaborativeEditor";
import ChatPanel from "./components/ChatPanel";
import AIAssistant from "./components/AIAssistant";
import Presence from "./components/Presence";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import JSZip from "jszip";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "mock-google-client-id.apps.googleusercontent.com";

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


function RoomApp({ currentUser, onLogout }) {
  const [users, setUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [showChat, setShowChat] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dynamic File System State
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  
  // File Creation States
  const [creatingInId, setCreatingInId] = useState(null); // Parent folder ID
  const [creatingType, setCreatingType] = useState(null); // "file" or "folder"
  const [newItemName, setNewItemName] = useState("");

  // File Renaming States
  const [renamingFileId, setRenamingFileId] = useState(null);
  const [renamingName, setRenamingName] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Editor Settings
  const [editorSettings, setEditorSettings] = useState(() => {
    const saved = localStorage.getItem("editor_settings");
    return saved ? JSON.parse(saved) : { theme: "vs-dark", fontSize: 15, tabSize: 2 };
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Code Execution states
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleTab, setConsoleTab] = useState("output"); // "output" or "preview"
  const [execRunning, setExecRunning] = useState(false);
  const [execOutput, setExecOutput] = useState("");
  const [execError, setExecError] = useState("");

  // Right sidebar tab state: "chat" or "ai"
  const [rightPanelTab, setRightPanelTab] = useState("chat");

  const displayName = currentUser ? currentUser.username : "Guest";

  const { roomId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId) {
      const randomRoom = crypto.randomUUID().slice(0, 8);
      navigate(`/editor/${randomRoom}`, { replace: true });
      return;
    }

    setLoading(true);
    const s = io(SOCKET_URL);
    setSocket(s);

    // Emits authenticated participant info
    s.emit("join-room", {
      roomId,
      user: currentUser ? {
        userId: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.avatar,
      } : null,
    });

    s.on("file-tree", (tree) => {
      setFiles(tree || []);
      setLoading(false);

      // Auto-select first welcome file if no active file selected
      setActiveFileId((currentId) => {
        const stillExists = tree.some((f) => f._id === currentId && !f.isFolder);
        if (stillExists) return currentId;
        const firstFile = tree.find((f) => !f.isFolder);
        return firstFile ? firstFile._id : null;
      });
    });

    s.on("file-created", (newFile) => {
      setFiles((prev) => {
        const exists = prev.some((f) => f._id === newFile._id);
        if (exists) return prev;
        return [...prev, newFile];
      });
      if (!newFile.isFolder) {
        setActiveFileId(newFile._id);
      }
    });

    s.on("file-deleted", (deletedId) => {
      setFiles((prev) => prev.filter((f) => f._id !== deletedId));
      setActiveFileId((currentId) => (currentId === deletedId ? null : currentId));
    });

    s.on("code-update", ({ fileId, code }) => {
      setFiles((prev) =>
        prev.map((f) => (f._id === fileId ? { ...f, content: code } : f))
      );
    });

    s.on("users-update", (userList) => {
      setUsers(userList || []);
    });

    s.on("error-message", (msg) => {
      alert(msg);
    });

    return () => {
      s.off("file-tree");
      s.off("file-created");
      s.off("file-deleted");
      s.off("code-update");
      s.off("users-update");
      s.off("error-message");
      s.disconnect();
    };
  }, [roomId, currentUser, navigate]);

  // Scoped active file selectors
  const activeFile = useMemo(() => {
    return files.find((f) => f._id === activeFileId);
  }, [files, activeFileId]);

  const activeCode = activeFile ? activeFile.content : "";

  // Dynamic active language calculator based on extension
  const activeLanguage = useMemo(() => {
    if (!activeFile) return "javascript";
    const ext = activeFile.name.split(".").pop().toLowerCase();
    if (ext === "py") return "python";
    if (ext === "html" || ext === "htm") return "html";
    if (ext === "css") return "css";
    if (ext === "json") return "json";
    if (ext === "cpp" || ext === "cc" || ext === "h") return "cpp";
    return "javascript";
  }, [activeFile]);

  const languageMeta = useMemo(
    () => LANGUAGE_DETAILS[activeLanguage] ?? LANGUAGE_DETAILS.javascript,
    [activeLanguage]
  );

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/editor/${roomId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textInput = document.createElement("textarea");
        textInput.value = link;
        document.body.appendChild(textInput);
        textInput.select();
        document.execCommand("copy");
        document.body.removeChild(textInput);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link: ", err);
    }
  };

  // Helper actions to start creations
  const startCreation = (parentId, type) => {
    setCreatingInId(parentId);
    setCreatingType(type);
    setNewItemName("");
    if (parentId) {
      setExpandedFolders((prev) => ({ ...prev, [parentId]: true }));
    }
  };

  const commitCreation = (parentId) => {
    if (!newItemName.trim() || !socket) {
      cancelCreation();
      return;
    }
    socket.emit("file-create", {
      name: newItemName.trim(),
      isFolder: creatingType === "folder",
      parentId: parentId,
    });
    cancelCreation();
  };

  const cancelCreation = () => {
    setCreatingInId(null);
    setCreatingType(null);
    setNewItemName("");
  };

  const commitRename = (fileId) => {
    if (!renamingName.trim() || !socket) {
      setRenamingFileId(null);
      return;
    }
    socket.emit("file-rename", {
      fileId,
      newName: renamingName.trim(),
    });
    setRenamingFileId(null);
  };

  const updateSetting = (key, value) => {
    setEditorSettings((prev) => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem("editor_settings", JSON.stringify(updated));
      return updated;
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const name = file.name;
      if (socket) {
        socket.emit("file-create", {
          name,
          isFolder: false,
          parentId: null,
          content,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportWorkspaceAsZip = async () => {
    const zip = new JSZip();
    files.forEach((file) => {
      if (file.isFolder) {
        const folderPath = file.path.replace(/^\//, "");
        if (folderPath) {
          zip.folder(folderPath);
        }
      } else {
        const filePath = file.path.replace(/^\//, "");
        zip.file(filePath, file.content || "");
      }
    });

    try {
      const zipContent = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipContent);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workspace-${roomId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ZIP export error:", err);
      alert("Failed to export workspace as ZIP.");
    }
  };

  const runCode = async () => {
    if (!activeFile) return;
    setConsoleOpen(true);
    
    if (activeLanguage === "html" || activeLanguage === "css") {
      setConsoleTab("preview");
      return;
    }

    setConsoleTab("output");
    setExecRunning(true);
    setExecOutput("");
    setExecError("");

    try {
      const res = await fetch(`${SOCKET_URL}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activeCode,
          language: activeLanguage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setExecOutput(data.output || "Code executed successfully with no output.");
      } else {
        setExecError(data.error || "Unknown execution error.");
        setExecOutput(data.output || "");
      }
    } catch (err) {
      setExecError(`Execution error: ${err.message}`);
    } finally {
      setExecRunning(false);
    }
  };

  const getCombinedHtmlPreview = () => {
    if (!activeFile || activeLanguage !== "html") return "";
    let htmlContent = activeFile.content || "";
    
    const cssFiles = files.filter(f => !f.isFolder && f.name.split(".").pop().toLowerCase() === "css");
    const styleTags = cssFiles.map(css => `<style>/* ${css.name} */\n${css.content}\n</style>`).join("\n");
    
    if (htmlContent.includes("</head>")) {
      htmlContent = htmlContent.replace("</head>", `${styleTags}\n</head>`);
    } else {
      htmlContent = htmlContent + `\n${styleTags}`;
    }
    
    return htmlContent;
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return files.filter(f => 
      !f.isFolder && 
      (f.name.toLowerCase().includes(query) || (f.content || "").toLowerCase().includes(query))
    );
  }, [files, searchQuery]);

  // Renders the creation inline inputs
  const renderCreationInput = (parentId, depth) => {
    return (
      <div
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        className="flex items-center gap-2 py-1.5 px-3"
      >
        <span className="text-slate-400 text-xs">
          {creatingType === "folder" ? "📁" : "📄"}
        </span>
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder={creatingType === "folder" ? "Folder Name..." : "File Name..."}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitCreation(parentId);
            if (e.key === "Escape") cancelCreation();
          }}
          onBlur={() => commitCreation(parentId)}
          autoFocus
          className="rounded border border-cyan-400/40 bg-slate-950 px-2 py-0.5 text-xs text-white outline-none w-32 focus:border-cyan-300 focus:ring-1 focus:ring-cyan-300"
        />
      </div>
    );
  };

  // Hierarchical rendering tree
  const renderTree = (parentId = null, depth = 0) => {
    const items = files.filter((f) => {
      if (parentId === null) return !f.parentId;
      return f.parentId === parentId;
    });

    // Sort folders first, then files alphabetically
    items.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return items.map((item) => {
      const isExpanded = expandedFolders[item._id];
      const isRenaming = renamingFileId === item._id;

      return (
        <div key={item._id} className="select-none">
          <div
            style={{ paddingLeft: `${depth * 12 + 10}px` }}
            className={`group flex items-center justify-between py-2 px-2.5 rounded-xl transition cursor-pointer my-0.5 ${
              activeFileId === item._id && !item.isFolder
                ? "bg-cyan-400/10 text-cyan-200 border border-cyan-400/20"
                : "text-slate-300 hover:bg-white/[0.04]"
            }`}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData("text/plain", item._id);
            }}
            onDragOver={(e) => {
              if (item.isFolder) {
                e.preventDefault();
                e.currentTarget.classList.add("file-drag-over");
              }
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("file-drag-over");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("file-drag-over");
              const draggedId = e.dataTransfer.getData("text/plain");
              if (draggedId && draggedId !== item._id) {
                socket.emit("file-move", { fileId: draggedId, newParentId: item._id });
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (item.isFolder) {
                setExpandedFolders((prev) => ({
                  ...prev,
                  [item._id]: !prev[item._id],
                }));
              } else {
                setActiveFileId(item._id);
              }
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.isFolder ? (
                <span className="text-amber-400 font-semibold text-base leading-none">
                  {isExpanded ? "📂" : "📁"}
                </span>
              ) : (
                <span className="text-cyan-300 font-medium text-base leading-none">
                  📄
                </span>
              )}

              {isRenaming ? (
                <input
                  type="text"
                  value={renamingName}
                  onChange={(e) => setRenamingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(item._id);
                    if (e.key === "Escape") setRenamingFileId(null);
                  }}
                  onBlur={() => commitRename(item._id)}
                  autoFocus
                  className="rounded border border-cyan-400/40 bg-slate-950 px-2 py-0.5 text-xs text-white outline-none w-32"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate text-sm font-medium">{item.name}</span>
              )}
            </div>

            {/* Explorer action selectors */}
            <div className="hidden group-hover:flex items-center gap-1.5 ml-2">
              {item.isFolder && (
                <>
                  <button
                    type="button"
                    title="New File"
                    className="text-slate-400 hover:text-cyan-300 transition text-[0.6rem] cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCreation(item._id, "file");
                    }}
                  >
                    📄+
                  </button>
                  <button
                    type="button"
                    title="New Folder"
                    className="text-slate-400 hover:text-amber-400 transition text-[0.6rem] cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCreation(item._id, "folder");
                    }}
                  >
                    📁+
                  </button>
                </>
              )}
              <button
                type="button"
                title="Rename"
                className="text-slate-400 hover:text-cyan-300 transition text-[0.65rem] cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingFileId(item._id);
                  setRenamingName(item.name);
                }}
              >
                ✏️
              </button>
              <button
                type="button"
                title="Delete"
                className="text-slate-400 hover:text-rose-400 transition text-[0.65rem] cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete ${item.name}?`)) {
                    socket.emit("file-delete", { fileId: item._id });
                  }
                }}
              >
                🗑️
              </button>
            </div>
          </div>

          {creatingInId === item._id && creatingType && renderCreationInput(item._id, depth + 1)}

          {item.isFolder && isExpanded && (
            <div className="mt-0.5">{renderTree(item._id, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#080b16] text-white flex items-center justify-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-12rem] top-[-10rem] h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute right-[-10rem] top-20 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />
          <div className="mesh-overlay absolute inset-0 opacity-40" />
        </div>
        
        <div className="relative text-center z-10 glass-panel p-8 rounded-3xl border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-2xl animate-rise max-w-sm w-full mx-4">
          <div className="relative flex items-center justify-center mx-auto h-16 w-16 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-cyan-400/20 animate-pulse" />
            <div className="h-12 w-12 rounded-full border-4 border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-white tracking-wide">Workspace Canvas</h3>
          <p className="mt-2 text-sm text-slate-400">Loading room details & chat transcripts...</p>
        </div>
      </div>
    );
  }

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
                <Presence users={users} />
                
                <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3 backdrop-blur-md">
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">Room</p>
                  <p className="mt-2 font-mono text-base text-white">{roomId}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3 backdrop-blur-md">
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">Focus</p>
                  <p className="mt-2 text-base font-medium text-white">{activeFile ? activeFile.name : "No file"}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={handleCopyLink}
                className={`rounded-2xl border transition-all duration-300 px-4 py-3 text-sm font-medium ${
                  copied
                    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                    : "border-white/12 bg-white/8 text-white hover:bg-white/12"
                }`}
              >
                {copied ? "Copied! ✨" : "Copy Room Link"}
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
                onClick={() => setShowSettingsModal(true)}
                className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/12 mr-1 cursor-pointer"
              >
                ⚙️ Settings
              </button>

              <button
                type="button"
                onClick={() => setShowChat((value) => !value)}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 mr-1"
              >
                {showChat ? "Close Sidebar" : "Open Sidebar"}
              </button>

              {/* Dynamic Authentication Toggle Section in Top-Right Nav */}
              {currentUser ? (
                <div className="flex items-center gap-3 bg-white/8 border border-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.username} className="h-8 w-8 rounded-full border border-cyan-400/30 object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-cyan-500 text-xs font-semibold text-slate-950 flex items-center justify-center">
                      {currentUser.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left hidden md:block">
                    <p className="text-[0.6rem] text-slate-400 font-semibold uppercase tracking-wider leading-none">Logged In</p>
                    <p className="text-sm font-semibold text-white mt-1 leading-none">{currentUser.username}</p>
                  </div>
                  <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                    <Link to="/profile" className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition">
                      Profile
                    </Link>
                    <button onClick={onLogout} className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer bg-transparent border-none">
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-950/35 border border-white/10 px-2.5 py-2 rounded-2xl">
                  <Link to="/login" className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition">
                    Login
                  </Link>
                  <Link to="/register" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 shadow-md">
                    Register
                  </Link>
                </div>
              )}
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
                    Workspace Files
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="New File at Root"
                    className="rounded border border-white/10 hover:border-cyan-300/30 bg-white/[0.02] hover:bg-white/[0.06] p-1.5 text-slate-300 hover:text-cyan-200 transition text-[0.65rem] cursor-pointer font-bold"
                    onClick={() => startCreation(null, "file")}
                  >
                    📄+
                  </button>
                  <button
                    type="button"
                    title="New Folder at Root"
                    className="rounded border border-white/10 hover:border-amber-300/30 bg-white/[0.02] hover:bg-white/[0.06] p-1.5 text-slate-300 hover:text-amber-200 transition text-[0.65rem] cursor-pointer font-bold"
                    onClick={() => startCreation(null, "folder")}
                  >
                    📁+
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5 flex-1 flex flex-col min-h-0">
              <div className="rounded-3xl border border-white/8 bg-slate-950/35 p-4 flex-shrink-0">
                <p className="text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">Workspace Explorer</p>
                <p className="mt-2 text-[11px] leading-4 text-slate-400">
                  Manage directories dynamically. Drag-and-drop to relocate. Switch files to code.
                </p>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => document.getElementById("file-upload-input").click()}
                  className="flex-1 rounded-xl border border-white/10 hover:border-cyan-400/30 bg-white/4 hover:bg-white/8 py-2 text-xs font-semibold text-slate-300 transition cursor-pointer text-center"
                >
                  📥 Import
                </button>
                <input
                  type="file"
                  id="file-upload-input"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                
                <button
                  onClick={exportWorkspaceAsZip}
                  className="flex-1 rounded-xl border border-white/10 hover:border-amber-400/30 bg-white/4 hover:bg-white/8 py-2 text-xs font-semibold text-slate-300 transition cursor-pointer text-center"
                >
                  📦 Export ZIP
                </button>
              </div>

              <div className="flex-shrink-0">
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Search Workspace:</label>
                <input
                  type="text"
                  placeholder="Search file name or contents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-cyan-300"
                />
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  File Tree
                </p>
                <div
                  className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-[150px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData("text/plain");
                    if (draggedId) {
                      socket.emit("file-move", { fileId: draggedId, newParentId: null });
                    }
                  }}
                >
                  {searchQuery.trim() ? (
                    <div className="space-y-1">
                      {searchResults.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-2">No matching files found.</p>
                      ) : (
                        searchResults.map((f) => (
                          <div
                            key={f._id}
                            onClick={() => {
                              setActiveFileId(f._id);
                              setSearchQuery("");
                            }}
                            className={`flex items-center gap-2 py-2 px-2.5 rounded-xl cursor-pointer hover:bg-white/[0.04] text-xs ${
                              activeFileId === f._id ? "bg-cyan-400/10 text-cyan-200" : "text-slate-300"
                            }`}
                          >
                            <span>📄</span>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{f.name}</p>
                              <p className="text-[9px] text-slate-500 truncate">{f.path}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <>
                      {creatingInId === null && creatingType && renderCreationInput(null, 0)}
                      {renderTree(null, 0)}
                    </>
                  )}
                </div>
              </div>
            </div>
          </aside>

          <main className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="glass-panel animate-rise min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 shadow-[0_25px_70px_rgba(8,15,30,0.42)] flex flex-col">
              <div className="border-b border-white/8 px-5 py-4 flex-shrink-0">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
                      Editor
                    </p>
                    <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
                      {activeFile ? activeFile.path : "Select a file"}
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

              <div className="flex-1 p-4 sm:p-5 min-h-[360px] min-w-0">
                <div className="editor-shell h-full overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80 flex flex-col">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-rose-400" />
                      <span className="h-3 w-3 rounded-full bg-amber-300" />
                      <span className="h-3 w-3 rounded-full bg-emerald-400" />
                      
                      {activeFile && (activeLanguage === "javascript" || activeLanguage === "python" || activeLanguage === "html" || activeLanguage === "css") && (
                        <button
                          onClick={runCode}
                          disabled={execRunning}
                          className="ml-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1 text-[11px] font-bold text-slate-950 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        >
                          ▶ Run Code
                        </button>
                      )}
                      
                      <button
                        onClick={() => setConsoleOpen(!consoleOpen)}
                        className="ml-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-[11px] font-medium text-slate-300 transition cursor-pointer"
                      >
                        Terminal
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="rounded-full bg-white/6 px-2.5 py-1 font-mono text-slate-300">
                        {activeFile ? activeFile.name : "editor"}
                      </span>
                      <span>{languageMeta.label}</span>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col min-w-0">
                    <div className="flex-1 min-h-[200px] min-w-0">
                      {activeFileId ? (
                        <CollaborativeEditor
                          key={activeFileId}
                          socket={socket}
                          roomId={roomId}
                          fileId={activeFileId}
                          code={activeCode}
                          language={activeLanguage}
                          username={displayName}
                          editorSettings={editorSettings}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                          Select or create a file to start editing.
                        </div>
                      )}
                    </div>

                    {/* Console Drawer */}
                    {consoleOpen && (
                      <div className="h-56 border-t border-white/8 bg-slate-950/95 flex flex-col min-w-0 flex-shrink-0 text-left">
                        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setConsoleTab("output")}
                              className={`text-xs font-semibold py-1 px-2.5 rounded-lg transition ${
                                consoleTab === "output" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                              }`}
                            >
                              Console Output
                            </button>
                            {(activeLanguage === "html" || activeLanguage === "css") && (
                              <button
                                onClick={() => setConsoleTab("preview")}
                                className={`text-xs font-semibold py-1 px-2.5 rounded-lg transition ${
                                  consoleTab === "preview" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                                }`}
                              >
                                Web Preview
                              </button>
                            )}
                          </div>
                          
                          <button
                            onClick={() => setConsoleOpen(false)}
                            className="text-xs text-slate-400 hover:text-white cursor-pointer animate-none"
                          >
                            ✕ Minimize
                          </button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-slate-950">
                          {consoleTab === "output" ? (
                            <pre className="font-mono text-xs leading-5 whitespace-pre-wrap select-text text-left">
                              {execRunning ? (
                                <span className="text-cyan-400 animate-pulse font-bold">Running execution...</span>
                              ) : execError ? (
                                <span className="console-stderr">{execError}</span>
                              ) : (
                                <span className="console-stdout">{execOutput}</span>
                              )}
                            </pre>
                          ) : (
                            <iframe
                              title="HTML Live Preview"
                              sandbox="allow-scripts"
                              srcDoc={getCombinedHtmlPreview()}
                              className="w-full h-full border-none bg-white rounded-xl"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {showChat && (
              <aside className="glass-panel animate-rise min-h-[320px] overflow-hidden rounded-[28px] border border-white/10 shadow-[0_25px_70px_rgba(8,15,30,0.42)] flex flex-col">
                <div className="flex border-b border-white/8 flex-shrink-0">
                  <button
                    onClick={() => setRightPanelTab("chat")}
                    className={`flex-1 py-3 text-xs font-semibold tracking-wider uppercase border-r border-white/8 transition cursor-pointer ${
                      rightPanelTab === "chat" ? "bg-white/5 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    💬 Team Chat
                  </button>
                  <button
                    onClick={() => setRightPanelTab("ai")}
                    className={`flex-1 py-3 text-xs font-semibold tracking-wider uppercase transition cursor-pointer ${
                      rightPanelTab === "ai" ? "bg-white/5 text-cyan-300" : "text-slate-400 hover:text-cyan-200"
                    }`}
                  >
                    🤖 Co-Pilot
                  </button>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  {rightPanelTab === "chat" ? (
                    <ChatPanel
                      socket={socket}
                      roomId={roomId}
                      currentUser={currentUser}
                      users={users}
                      activeFileName={activeFile ? activeFile.name : ""}
                      activeCode={activeCode}
                      activeLanguage={activeLanguage}
                    />
                  ) : (
                    <AIAssistant
                      activeFileName={activeFile ? activeFile.name : ""}
                      activeCode={activeCode}
                      activeLanguage={activeLanguage}
                    />
                  )}
                </div>
              </aside>
            )}
          </main>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="relative w-full max-w-sm rounded-3xl border border-white/12 bg-slate-950 p-6 shadow-2xl animate-rise">
            <h3 className="text-base font-bold text-white mb-4">Editor Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Monaco Theme</label>
                <select
                  value={editorSettings.theme}
                  onChange={(e) => updateSetting("theme", e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300"
                >
                  <option value="vs-dark">VS Dark (Default)</option>
                  <option value="light">VS Light</option>
                  <option value="hc-black">High Contrast Black</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Font Size ({editorSettings.fontSize}px)</label>
                <input
                  type="range"
                  min="12"
                  max="24"
                  value={editorSettings.fontSize}
                  onChange={(e) => updateSetting("fontSize", parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Tab Size</label>
                <select
                  value={editorSettings.tabSize}
                  onChange={(e) => updateSetting("tabSize", parseInt(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300"
                >
                  <option value="2">2 Spaces</option>
                  <option value="4">4 Spaces</option>
                  <option value="8">8 Spaces</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl bg-white hover:opacity-90 px-4 py-2 text-xs font-semibold text-slate-950 transition cursor-pointer"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setCurrentUser(null);
        return;
      }
      try {
        const res = await fetch(`${SOCKET_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setCurrentUser(data.user);
        } else {
          localStorage.removeItem("token");
          setToken(null);
          setCurrentUser(null);
        }
      } catch (err) {
        console.error("Auto-login error:", err);
      }
    };
    loadUser();
  }, [token]);

  const handleLoginSuccess = (user, jwtToken) => {
    setCurrentUser(user);
    setToken(jwtToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setCurrentUser(null);
  };

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Routes>
        <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/register" element={<Register onRegisterSuccess={handleLoginSuccess} />} />
        <Route path="/profile" element={<Profile currentUser={currentUser} />} />
        <Route path="/editor/:roomId" element={<RoomApp currentUser={currentUser} onLogout={handleLogout} />} />
        <Route
          path="*"
          element={<Navigate to={`/editor/${crypto.randomUUID().slice(0, 8)}`} replace />}
        />
      </Routes>
    </GoogleOAuthProvider>
  );
}

