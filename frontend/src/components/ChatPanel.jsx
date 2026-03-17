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
    <div className="flex h-full w-full flex-col bg-slate-950/80 text-slate-100">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-tight text-slate-100">
            Chat
          </span>
          <span className="text-[11px] text-slate-500">
            Collaborate in real time
          </span>
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
          {messages.length}{" "}
          {messages.length === 1 ? "message" : "messages"}
        </span>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-xs">
        {messages.map((msg, idx) => {
          const isSelf = msg.user === username;
          return (
            <div
              key={idx}
              className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-md border px-2 py-1.5 shadow-sm transition-opacity ${
                  isSelf
                    ? "border-sky-500/40 bg-sky-500/15 text-slate-50"
                    : "border-slate-800 bg-slate-900/80 text-slate-100"
                }`}
              >
                <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelf ? "bg-sky-400" : "bg-emerald-400"
                    }`}
                  />
                  <span
                    className={`${
                      isSelf ? "text-sky-300" : "text-emerald-300"
                    }`}
                  >
                    {msg.user}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[11px] leading-snug text-slate-100">
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}

        {/* 👇 THIS IS THE “END OF MESSAGES LIST” */}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="border-t border-slate-800 bg-slate-950/80 px-3 py-2">
        <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/80 px-2 py-1.5 shadow-inner">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Message collaborators..."
            className="mr-1 flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm transition-opacity hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!input.trim()}
          >
            <span>Send</span>
            <span className="text-[10px]">↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}