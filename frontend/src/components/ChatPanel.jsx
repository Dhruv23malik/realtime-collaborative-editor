import { useEffect, useRef, useState } from "react";

export default function ChatPanel({ socket }) {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chatMessages");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [username] = useState(`Guest-${Math.floor(Math.random() * 1000)}`);
  const messagesEndRef = useRef(null);
  const isFirstLoad = useRef(true);

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
    <div className="flex h-full min-h-[320px] flex-col bg-transparent text-slate-100">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
              Team chat
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
              Conversation next to the code
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Quick notes, handoffs, and in-room updates without leaving the editor.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-300">
            {messages.length} msg
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/12 bg-slate-950/20 px-4 py-5 text-sm leading-6 text-slate-400">
            Start the thread with a quick status note or a handoff for your collaborator.
          </div>
        )}

        {messages.map((msg, idx) => {
          const isSelf = msg.user === username;

          return (
            <div
              key={`${msg.user}-${idx}`}
              className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-[22px] border px-3 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.18)] ${
                  isSelf
                    ? "border-cyan-300/20 bg-cyan-300/12 text-white"
                    : "border-white/10 bg-white/6 text-slate-100"
                }`}
              >
                <div className="mb-1.5 flex items-center gap-2 text-[0.72rem] font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSelf ? "bg-cyan-300" : "bg-emerald-300"
                    }`}
                  />
                  <span className={isSelf ? "text-cyan-100" : "text-emerald-200"}>
                    {msg.user}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
                  {msg.text}
                </p>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/8 px-4 py-4">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-2 shadow-inner shadow-slate-950/20">
          <div className="flex flex-col gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a quick update for the room..."
              className="w-full bg-transparent px-3 pt-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-xs text-slate-500">{username}</span>
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim()}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
