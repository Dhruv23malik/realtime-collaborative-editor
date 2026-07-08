import { useEffect, useRef, useState } from "react";

export default function ChatPanel({ socket, roomId, currentUser, users = [], activeFileName = "", activeCode = "", activeLanguage = "javascript" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [guestName] = useState(() => `Guest-${Math.floor(Math.random() * 1000)}`);
  
  // DM states
  const [chatTab, setChatTab] = useState("room"); // "room" or "dm"
  const [targetUser, setTargetUser] = useState(""); // Username of target DM user
  
  // Voice Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioChunks = useRef([]);

  const messagesEndRef = useRef(null);
  const displayName = currentUser ? currentUser.username : guestName;

  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (message) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleChatHistory = (history) => {
      if (history && Array.isArray(history)) {
        setMessages(history);
      }
    };

    socket.on("chat-message", handleChatMessage);
    socket.on("chat-history", handleChatHistory);

    return () => {
      socket.off("chat-message", handleChatMessage);
      socket.off("chat-history", handleChatHistory);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (textPayload = "", isPrivateOverride = null, targetOverride = null) => {
    const messageText = textPayload || input;
    if (!messageText.trim() || !socket) return;

    const isPrivate = isPrivateOverride !== null ? isPrivateOverride : (chatTab === "dm");
    const toUser = targetOverride !== null ? targetOverride : (chatTab === "dm" ? targetUser : null);

    if (isPrivate && !toUser) {
      alert("Please select a user to send a direct message.");
      return;
    }

    socket.emit("chat-message", {
      roomId,
      user: displayName,
      text: messageText,
      toUser,
      isPrivate,
    });

    if (!textPayload) {
      setInput("");
    }
  };

  // Code snippet sharing action
  const shareSnippet = () => {
    if (!activeCode) {
      alert("Active file is empty. Open a file with code to share a snippet.");
      return;
    }
    const selection = window.getSelection()?.toString();
    const codeToShare = selection || activeCode;
    const formattedSnippet = `\`\`\`${activeLanguage}\n// Code shared from ${activeFileName}:\n${codeToShare}\n\`\`\``;
    setInput((prev) => (prev ? prev + "\n" + formattedSnippet : formattedSnippet));
  };

  // Voice message operations
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = reader.result;
          sendMessage(`[audio]:${base64Data}`);
        };
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone permission denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Filter messages based on selected tab and selected user for DMs
  const filteredMessages = messages.filter((msg) => {
    if (chatTab === "room") {
      return !msg.isPrivate;
    } else {
      // DM Tab
      if (!msg.isPrivate) return false;
      if (!targetUser) return true; // Show all DMs if no user selected
      return (
        (msg.user === displayName && msg.toUser === targetUser) ||
        (msg.user === targetUser && msg.toUser === displayName)
      );
    }
  });

  // Extract other users currently online in room
  const otherUsers = users.filter((u) => u.username !== displayName);

  return (
    <div className="flex h-full min-h-[320px] flex-col bg-transparent text-slate-100">
      <div className="border-b border-white/8 px-5 py-4 flex-shrink-0">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
            Discussion
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
            Workspace Chat
          </h3>
        </div>

        {/* Tab Selection */}
        <div className="mt-4 flex rounded-2xl bg-slate-950/45 p-1 border border-white/5">
          <button
            onClick={() => setChatTab("room")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-xl transition ${
              chatTab === "room"
                ? "bg-white/10 text-white border border-white/5"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Room Chat
          </button>
          <button
            onClick={() => {
              setChatTab("dm");
              if (otherUsers.length > 0 && !targetUser) {
                setTargetUser(otherUsers[0].username);
              }
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-xl transition ${
              chatTab === "dm"
                ? "bg-white/10 text-white border border-white/5"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Direct Messages DMs
          </button>
        </div>

        {/* DM User Selector */}
        {chatTab === "dm" && (
          <div className="mt-3">
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
              Select Recipient:
            </label>
            {otherUsers.length > 0 ? (
              <select
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-300"
              >
                {otherUsers.map((u) => (
                  <option key={u.socketId || u.username} value={u.username}>
                    {u.username} {u.socketId ? "• online" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-rose-400 font-semibold py-1">
                ⚠️ No other users in this room currently.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Message Feed */}
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 custom-scrollbar">
        {filteredMessages.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/12 bg-slate-950/20 px-4 py-5 text-sm leading-6 text-slate-400">
            {chatTab === "room"
              ? "Start the thread with a quick status note or a handoff for your collaborator."
              : targetUser
              ? `Send a private message to ${targetUser}. Only the two of you can view this stream.`
              : "Select an online room member above to start direct messaging."}
          </div>
        )}

        {filteredMessages.map((msg, idx) => {
          const isSelf = msg.user === displayName;
          const isAudio = msg.text?.startsWith("[audio]:");

          return (
            <div
              key={`${msg.user}-${idx}`}
              className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-[22px] border px-3.5 py-3.5 shadow-md ${
                  isSelf
                    ? "border-cyan-400/20 bg-cyan-400/10 text-white"
                    : msg.isPrivate
                    ? "border-fuchsia-400/25 bg-fuchsia-400/10 text-slate-100"
                    : "border-white/10 bg-white/6 text-slate-100"
                }`}
              >
                <div className="mb-1.5 flex items-center gap-2 text-[0.72rem] font-bold">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSelf ? "bg-cyan-300" : msg.isPrivate ? "bg-fuchsia-400" : "bg-emerald-300"
                    }`}
                  />
                  <span className={isSelf ? "text-cyan-100" : msg.isPrivate ? "text-fuchsia-200" : "text-emerald-200"}>
                    {msg.user} {msg.isPrivate ? `🔒 (to ${msg.toUser})` : ""}
                  </span>
                </div>
                
                {isAudio ? (
                  <div className="mt-1">
                    <audio
                      src={msg.text.slice(8)}
                      controls
                      className="max-w-full h-8 opacity-90"
                    />
                  </div>
                ) : msg.text.includes("```") ? (
                  // Custom rendering for code snippets
                  <div className="text-xs text-left bg-slate-950 p-2.5 rounded-xl border border-white/5 font-mono text-cyan-200 mt-1 whitespace-pre overflow-x-auto max-w-full">
                    {msg.text}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
                    {msg.text}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input controls */}
      <div className="border-t border-white/8 px-4 py-4 flex-shrink-0">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-2 shadow-inner shadow-slate-950/20">
          <div className="flex flex-col gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={
                isRecording
                  ? "🔴 Recording audio..."
                  : chatTab === "dm"
                  ? `Message ${targetUser || "recipient"} privately...`
                  : "Type a quick update for the room..."
              }
              disabled={isRecording}
              className="w-full bg-transparent px-3 pt-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">{displayName}</span>

                {/* Voice record toggle */}
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    title="Record voice message"
                    className="p-1 rounded-full text-slate-400 hover:text-rose-400 transition cursor-pointer"
                  >
                    🎙️
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    title="Stop recording"
                    className="p-1 px-2.5 rounded-full bg-rose-500 text-white text-[10px] font-bold pulse-recording cursor-pointer"
                  >
                    ⏹️ STOP
                  </button>
                )}

                {/* Snippet insert button */}
                <button
                  type="button"
                  onClick={shareSnippet}
                  title="Share current file/selection as code snippet"
                  className="p-1 rounded-full text-slate-400 hover:text-cyan-300 transition cursor-pointer text-xs"
                >
                  Code 💻
                </button>
              </div>

              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!input.trim() || isRecording}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
