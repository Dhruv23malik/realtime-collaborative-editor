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

// Lucide Icons
import {
  Play,
  Settings,
  Copy,
  Check,
  LogOut,
  FolderTree,
  MessageSquare,
  Bot,
  Plus,
  FolderPlus,
  FilePlus,
  Edit2,
  Trash2,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Upload,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  User,
  UserPlus,
  LogIn
} from "lucide-react";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "mock-google-client-id.apps.googleusercontent.com";

const LANGUAGE_DETAILS = {
  javascript: { accent: "from-amber-400 via-orange-500 to-rose-500", label: "JavaScript" },
  python: { accent: "from-sky-400 via-blue-500 to-emerald-500", label: "Python" },
  html: { accent: "from-orange-400 via-red-500 to-pink-500", label: "HTML" },
  css: { accent: "from-cyan-400 via-blue-500 to-indigo-500", label: "CSS" },
  json: { accent: "from-lime-400 via-emerald-500 to-teal-500", label: "JSON" },
  cpp: { accent: "from-violet-400 via-purple-500 to-indigo-500", label: "C++" },
};

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
    return saved ? JSON.parse(saved) : { theme: "vs-dark", fontSize: 13, tabSize: 2 };
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
        style={{ paddingLeft: `${depth * 14 + 14}px` }}
        className="flex items-center gap-2 py-1 px-2.5"
      >
        {creatingType === "folder" ? (
          <Folder className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        ) : (
          <FileText className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
        )}
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
          className="rounded border border-cyan-500/30 bg-slate-900 px-2 py-0.5 text-xs text-white outline-none w-32 focus:border-cyan-400"
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
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            className={`group flex items-center justify-between py-1 px-2 rounded-lg transition cursor-pointer my-0.5 text-xs ${
              activeFileId === item._id && !item.isFolder
                ? "bg-cyan-500/10 text-cyan-200 border border-cyan-500/15"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
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
                isExpanded ? (
                  <FolderOpen className="h-4.5 w-4.5 text-amber-500/90 flex-shrink-0" />
                ) : (
                  <Folder className="h-4.5 w-4.5 text-amber-500/90 flex-shrink-0" />
                )
              ) : (
                <FileText className="h-4 w-4 text-cyan-400/90 flex-shrink-0" />
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
                  className="rounded border border-cyan-500/30 bg-slate-900 px-2 py-0.5 text-xs text-white outline-none w-32"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate font-medium">{item.name}</span>
              )}
            </div>

            {/* Explorer action buttons */}
            <div className="hidden group-hover:flex items-center gap-1.5 ml-2">
              {item.isFolder && (
                <>
                  <button
                    type="button"
                    title="New File"
                    className="p-0.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCreation(item._id, "file");
                    }}
                  >
                    <FilePlus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="New Folder"
                    className="p-0.5 rounded text-slate-500 hover:text-amber-500 hover:bg-white/5 transition cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      startCreation(item._id, "folder");
                    }}
                  >
                    <FolderPlus className="h-3 w-3" />
                  </button>
                </>
              )}
              <button
                type="button"
                title="Rename"
                className="p-0.5 rounded text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingFileId(item._id);
                  setRenamingName(item.name);
                }}
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                title="Delete"
                className="p-0.5 rounded text-slate-500 hover:text-rose-450 hover:bg-white/5 transition cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete ${item.name}?`)) {
                    socket.emit("file-delete", { fileId: item._id });
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {creatingInId === item._id && creatingType && renderCreationInput(item._id, depth + 1)}

          {item.isFolder && isExpanded && (
            <div className="mt-0.5 file-tree-guide ml-[14px]">
              {renderTree(item._id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#05070f] text-white flex items-center justify-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-12rem] top-[-10rem] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute right-[-10rem] top-20 h-72 w-72 rounded-full bg-fuchsia-500/5 blur-3xl" />
          <div className="mesh-overlay absolute inset-0 opacity-20" />
        </div>
        
        <div className="relative text-center z-10 glass-panel p-8 rounded-2xl border border-white/[0.08] bg-[#0c0f1d]/50 backdrop-blur-xl shadow-2xl animate-rise max-w-sm w-full mx-4">
          <div className="relative flex items-center justify-center mx-auto h-12 w-12 mb-5">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/10 animate-pulse" />
            <div className="h-8 w-8 rounded-full border-2 border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <h3 className="text-base font-semibold text-white tracking-wide">Connecting Workspace</h3>
          <p className="mt-2 text-xs text-slate-450">Loading synchronized directories & session state...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen h-screen flex flex-col overflow-hidden bg-[#09090b] text-slate-100">
      {/* Slim Top Navigation Bar */}
      <header className="relative z-40 flex h-12 items-center justify-between border-b border-[#27272a] bg-[#18181b] px-4 select-none flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Logo badge */}
          <div className="flex h-7 w-7 items-center justify-center rounded border border-[#27272a] bg-[#27272a]/40 text-[10px] font-bold text-slate-200">
            CE
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-200 tracking-wide">Collaborative Editor</span>
            </div>
          </div>
        </div>

        {/* Middle: Room Code & Link Shortener */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-[#27272a] bg-black/30 px-2 py-0.5 text-[10px]">
            <span className="text-slate-500 uppercase tracking-widest text-[8px] font-bold">Room:</span>
            <span className="font-mono text-slate-300 font-medium">{roomId}</span>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-medium transition-all duration-200 cursor-pointer ${
              copied
                ? "border-emerald-800/40 bg-emerald-950/30 text-emerald-400"
                : "border-[#27272a] bg-[#27272a]/30 text-slate-300 hover:bg-[#27272a]/60"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-4">
          {/* Active Collaborators Avatars */}
          <div className="hidden md:block">
            <Presence users={users} />
          </div>

          <div className="h-4 w-[1px] bg-[#27272a] hidden md:block" />

          {/* Toggle sidebar state controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilesOpen((value) => !value)}
              title={filesOpen ? "Collapse Explorer" : "Expand Explorer"}
              className={`p-1 rounded border transition cursor-pointer ${
                filesOpen 
                  ? "border-[#27272a] bg-[#27272a] text-slate-200" 
                  : "border-[#27272a] bg-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <FolderTree className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowChat((value) => !value)}
              title={showChat ? "Collapse Sidebar" : "Expand Sidebar"}
              className={`p-1 rounded border transition cursor-pointer ${
                showChat 
                  ? "border-[#27272a] bg-[#27272a] text-slate-200" 
                  : "border-[#27272a] bg-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              title="Editor Configurations"
              className="p-1 rounded border border-[#27272a] bg-transparent text-slate-400 hover:text-slate-200 hover:bg-[#27272a]/55 transition cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-[#27272a]" />

          {/* User Auth Section */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <Link to="/profile" className="group flex items-center gap-2 cursor-pointer">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.username} className="h-7 w-7 rounded-full border border-cyan-500/20 object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-xs font-semibold text-cyan-400 flex items-center justify-center uppercase">
                    {currentUser.username.slice(0, 2)}
                  </div>
                )}
                <span className="hidden lg:block text-xs font-semibold text-slate-300 group-hover:text-white transition">
                  {currentUser.username}
                </span>
              </Link>
              <button 
                onClick={onLogout} 
                title="Log Out"
                className="p-1 text-slate-500 hover:text-rose-450 transition cursor-pointer bg-transparent"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              <Link to="/login" className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1">
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
              <Link to="/register" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-[#05070f] transition hover:opacity-90 shadow-md flex items-center gap-1">
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Up</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="relative z-10 flex-1 flex overflow-hidden min-h-0">
        
        {/* Left Sidebar: Workspace Explorer */}
        <aside
          className={`w-56 bg-[#18181b] border-r border-[#27272a] flex-col flex-shrink-0 transition-all duration-200 select-none ${
            filesOpen ? "flex" : "hidden"
          }`}
        >
          {/* Header */}
          <div className="border-b border-[#27272a] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Explorer</p>
              <h2 className="text-[11px] font-semibold text-white mt-0.5">Workspace Files</h2>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title="New File at Root"
                className="rounded border border-[#27272a] bg-transparent hover:bg-[#27272a]/50 p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                onClick={() => startCreation(null, "file")}
              >
                <FilePlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="New Folder at Root"
                className="rounded border border-[#27272a] bg-transparent hover:bg-[#27272a]/50 p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                onClick={() => startCreation(null, "folder")}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Explorer Scroll Area */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar">
            
            {/* Quick Actions (Import / Export) */}
            <div className="flex gap-1.5">
              <button
                onClick={() => document.getElementById("file-upload-input").click()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded border border-[#27272a] bg-transparent hover:bg-[#27272a]/50 py-1 text-[9px] font-bold text-slate-300 transition cursor-pointer"
              >
                <Upload className="h-3 w-3 text-slate-400" />
                <span>Import</span>
              </button>
              <input
                type="file"
                id="file-upload-input"
                className="hidden"
                onChange={handleFileUpload}
              />
              
              <button
                onClick={exportWorkspaceAsZip}
                className="flex-1 flex items-center justify-center gap-1.5 rounded border border-[#27272a] bg-transparent hover:bg-[#27272a]/50 py-1 text-[9px] font-bold text-slate-300 transition cursor-pointer"
              >
                <Download className="h-3 w-3 text-slate-400" />
                <span>Export ZIP</span>
              </button>
            </div>

            {/* Quick search input */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3 w-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search filenames..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-[#27272a] bg-black/20 px-2 py-1 pl-7 text-[10px] text-white placeholder:text-zinc-650 outline-none focus:border-zinc-700"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-300">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* File List / Tree hierarchy */}
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">Files</span>
              
              <div
                className="space-y-0.5 min-h-[180px]"
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
                      <p className="text-xs text-slate-600 italic py-2 pl-1">No matching workspace files</p>
                    ) : (
                      searchResults.map((f) => (
                        <div
                          key={f._id}
                          onClick={() => {
                            setActiveFileId(f._id);
                            setSearchQuery("");
                          }}
                          className={`flex items-center gap-2 py-1 px-1.5 rounded cursor-pointer transition hover:bg-[#27272a]/30 text-[11px] ${
                            activeFileId === f._id ? "bg-[#27272a] text-white" : "text-slate-400"
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{f.name}</p>
                            <p className="text-[9px] text-slate-550 truncate">{f.path}</p>
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

        {/* Central Space: Code Editor and Console panel */}
        <main className="flex-1 min-w-0 flex flex-col h-full bg-[#09090b] relative">
          
          {/* Breadcrumb / Editor Tab status bar */}
          <div className="h-9 border-b border-[#27272a] bg-[#18181b]/80 flex items-center justify-between px-4 select-none flex-shrink-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
              <span className="text-[9px] tracking-wide text-slate-500">active file:</span>
              <span className="text-slate-300 font-mono">
                {activeFile ? activeFile.path : "No active file selected"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {activeFile && (activeLanguage === "javascript" || activeLanguage === "python" || activeLanguage === "html" || activeLanguage === "css") && (
                <button
                  onClick={runCode}
                  disabled={execRunning}
                  className="rounded bg-emerald-750 hover:bg-emerald-700 px-2 py-0.5 text-[9px] font-bold text-white flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Play className="h-2.5 w-2.5 fill-current" />
                  <span>Run</span>
                </button>
              )}
              
              <button
                onClick={() => setConsoleOpen(!consoleOpen)}
                className={`rounded border px-2 py-0.5 text-[9px] font-semibold transition cursor-pointer ${
                  consoleOpen 
                    ? "border-[#27272a] bg-[#27272a] text-slate-200"
                    : "border-[#27272a] bg-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Terminal
              </button>
            </div>
          </div>

          {/* Monaco Editor Canvas */}
          <div className="flex-1 min-h-0 flex flex-col min-w-0 relative">
            <div className="flex-1 min-h-[150px] min-w-0">
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
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-[11px] gap-3 max-w-sm mx-auto text-center px-4">
                  <div className="p-2.5 bg-[#18181b] border border-[#27272a] rounded-xl">
                    <FolderTree className="h-6 w-6 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-300">Workspace is ready</h3>
                    <p className="mt-1 text-slate-500 leading-relaxed">Select a file from the explorer sidebar or create a new one to begin real-time collaborative coding.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Drawer Console Pane */}
            {consoleOpen && (
              <div className="h-60 border-t border-[#27272a] bg-[#18181b] flex flex-col min-w-0 flex-shrink-0 text-left z-30">
                
                {/* Pane Tabs Header */}
                <div className="flex items-center justify-between border-b border-[#27272a] px-4 py-1 flex-shrink-0 bg-[#18181b] select-none">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setConsoleTab("output")}
                      className={`text-[10px] font-semibold py-0.5 px-1.5 rounded transition-all ${
                        consoleTab === "output" ? "bg-[#27272a] text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Console
                    </button>
                    {(activeLanguage === "html" || activeLanguage === "css") && (
                      <button
                        onClick={() => setConsoleTab("preview")}
                        className={`text-[10px] font-semibold py-0.5 px-1.5 rounded transition-all ${
                          consoleTab === "preview" ? "bg-[#27272a] text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Web Live Preview
                      </button>
                    )}
                  </div>
                  
                  <button
                    onClick={() => setConsoleOpen(false)}
                    className="p-1 rounded text-slate-500 hover:text-slate-350 transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Content Stream */}
                <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-black/40">
                  {consoleTab === "output" ? (
                    <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text text-left">
                      {execRunning ? (
                        <span className="text-slate-400 animate-pulse font-medium">Compiling & executing code...</span>
                      ) : execError ? (
                        <span className="console-stderr block">{execError}</span>
                      ) : (
                        <span className="console-stdout block">{execOutput}</span>
                      )}
                    </pre>
                  ) : (
                    <iframe
                      title="HTML Live Preview"
                      sandbox="allow-scripts"
                      srcDoc={getCombinedHtmlPreview()}
                      className="w-full h-full border-none bg-white rounded shadow-inner"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Chat Panels & AI Assistant */}
        {showChat && (
          <aside className="w-72 bg-[#18181b] border-l border-[#27272a] flex-col flex-shrink-0 transition-all duration-200 flex select-none">
            
            {/* Right Pane Tab Buttons */}
            <div className="flex border-b border-[#27272a] flex-shrink-0 bg-black/10">
              <button
                onClick={() => setRightPanelTab("chat")}
                className={`flex-1 py-1.5 text-[9px] font-bold tracking-wider uppercase border-r border-[#27272a] flex items-center justify-center gap-1 transition cursor-pointer ${
                  rightPanelTab === "chat" ? "bg-transparent text-white border-b-2 border-slate-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageSquare className="h-3 w-3 text-slate-400" />
                <span>Discussion</span>
              </button>
              <button
                onClick={() => setRightPanelTab("ai")}
                className={`flex-1 py-1.5 text-[9px] font-bold tracking-wider uppercase flex items-center justify-center gap-1 transition cursor-pointer ${
                  rightPanelTab === "ai" ? "bg-transparent text-white border-b-2 border-slate-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Bot className="h-3 w-3 text-slate-400" />
                <span>AI Assistant</span>
              </button>
            </div>
            
            {/* Dynamic Content Panel view */}
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
      </div>

      {/* Editor Settings Configuration Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay p-4">
          <div className="relative w-full max-w-sm rounded-xl border border-[#27272a] bg-[#18181b] p-5 shadow-2xl animate-rise text-left">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-slate-400" />
                <span>Editor Setup</span>
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="p-0.5 rounded text-slate-500 hover:text-slate-350 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Monaco Theme</label>
                <select
                  value={editorSettings.theme}
                  onChange={(e) => updateSetting("theme", e.target.value)}
                  className="w-full rounded border border-[#27272a] bg-black/35 px-3 py-2 text-white outline-none focus:border-zinc-700"
                >
                  <option value="vs-dark">VS Dark (Default)</option>
                  <option value="light">VS Light</option>
                  <option value="hc-black">High Contrast Black</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Font Size ({editorSettings.fontSize}px)</label>
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={editorSettings.fontSize}
                  onChange={(e) => updateSetting("fontSize", parseInt(e.target.value))}
                  className="w-full h-1 bg-black/40 rounded appearance-none cursor-pointer accent-slate-400"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1.5">Tab Size</label>
                <select
                  value={editorSettings.tabSize}
                  onChange={(e) => updateSetting("tabSize", parseInt(e.target.value))}
                  className="w-full rounded border border-[#27272a] bg-black/35 px-3 py-2 text-white outline-none focus:border-zinc-700"
                >
                  <option value="2">2 Spaces</option>
                  <option value="4">4 Spaces</option>
                  <option value="8">8 Spaces</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end pt-3 border-t border-[#27272a]">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded bg-[#27272a] hover:bg-[#27272a]/70 px-4 py-2 text-xs font-semibold text-white transition cursor-pointer"
              >
                Done
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
