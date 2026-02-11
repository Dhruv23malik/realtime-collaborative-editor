import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import CollaborativeEditor from "./components/CollaborativeEditor";
import ChatPanel from "./components/ChatPanel";

const SOCKET_URL = "http://localhost:3001";

export default function App() {
  const [users, setUsers] = useState(0);
  const [socket, setSocket] = useState(null);
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);

    s.on("users-update", (count) => {
      setUsers(count);
    });

    return () => s.disconnect();
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* NAVBAR */}
      <div
        style={{
          height: 56,
          background: "#0f172a",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          fontWeight: "bold",
        }}
      >
        <span>CollabCode</span>

        <div style={{ display: "flex", gap: 16 }}>
          <span>👥 {users} online</span>
          <button
            onClick={() => setShowChat((v) => !v)}
            style={{
              background: "#2563eb",
              border: "none",
              color: "white",
              padding: "6px 12px",
              cursor: "pointer",
              borderRadius: 4,
            }}
          >
            {showChat ? "Hide Chat" : "Show Chat"}
          </button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* FILES */}
        <div
          style={{
            width: 220,
            background: "#1e293b",
            color: "white",
            padding: 12,
            flexShrink: 0,
          }}
        >
          <strong>FILES</strong>
          <div style={{ marginTop: 8 }}>index.js</div>
          <div>app.js</div>
          <div>utils.js</div>
        </div>

        {/* EDITOR + CHAT */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* EDITOR */}
          <div style={{ flex: 1 }}>
            <CollaborativeEditor
              key={showChat ? "chat-open" : "chat-closed"}
              socket={socket}
            />
          </div>

          {/* CHAT PANEL */}
          {showChat && (
            <div
              style={{
                width: 280,
                flexShrink: 0,
                borderLeft: "1px solid #334155",
                background: "#7b93c0ff",
                display: showChat ? "block" : "none",
              }}
            >
              <ChatPanel socket={socket} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
