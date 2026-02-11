import { useEffect, useRef, useState } from "react";

export default function ChatPanel({ socket }) {
  const [messages, setMessages] = useState(() => {
  const saved = localStorage.getItem("chatMessages");
  return saved ? JSON.parse(saved) : [];
});

  const [input, setInput] = useState("");
  const [username] = useState(
    "Guest-" + Math.floor(Math.random() * 1000)
  );

  // 🔹 Reference to bottom of chat
  const messagesEndRef = useRef(null);
  const isFirstLoad = useRef(true);

  // 🔹 Listen for incoming messages
  useEffect(() => {
    if (!socket) return;

    socket.on("chat-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => socket.off("chat-message");
  }, [socket]);

  useEffect(() => {
  if (isFirstLoad.current) {
    isFirstLoad.current = false;
    return;
  }

  localStorage.setItem("chatMessages", JSON.stringify(messages));
}, [messages]);


  // 🔹 Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socket) return;

    socket.emit("chat-message", {
      user: username,
      text: input,
    });

    setInput("");
  };

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        background: "#020617",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: "10px",
          borderBottom: "1px solid #334155",
          fontWeight: "bold",
        }}
      >
        Chat
      </div>

      {/* MESSAGES */}
      <div
        style={{
          flex: 1,
          padding: "10px",
          overflowY: "auto",
          fontSize: "14px",
        }}
      >
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: "6px" }}>
            <strong>{msg.user}:</strong> {msg.text}
          </div>
        ))}

        {/* 👇 THIS IS THE “END OF MESSAGES LIST” */}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #334155",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: "8px",
            border: "none",
            outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "8px 12px",
            border: "none",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}