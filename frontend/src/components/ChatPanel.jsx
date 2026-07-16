import { useEffect, useRef, useState } from "react";
import { 
  MessageSquare, 
  Lock, 
  Mic, 
  Square, 
  Code, 
  Send, 
  AlertTriangle 
} from "lucide-react";

export default function ChatPanel({ 
  socket, 
  roomId, 
  currentUser, 
  users = [], 
  activeFileName = "", 
  activeCode = "", 
  activeLanguage = "javascript" 
}) {
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
    const formattedSnippet = `\`\`\`${activeLanguage}\n// Shared from ${activeFileName}:\n${codeToShare}\n\`\`\``;
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
    <div className="flex h-full min-h-[320px] flex-col bg-transparent text-slate-350">
      <div className="border-b border-[#27272a] px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Discussion
          </span>
        </div>

        {/* Tab Selection */}
        <div className="mt-3 flex rounded bg-black/20 p-0.5 border border-[#27272a]">
          <button
            onClick={() => setChatTab("room")}
            className={`flex-1 py-0.5 text-[10px] font-medium rounded transition-all ${
              chatTab === "room"
                ? "bg-[#27272a] text-white"
                : "text-slate-450 hover:text-slate-200"
            }`}
          >
            Room
          </button>
          <button
            onClick={() => {
              setChatTab("dm");
              if (otherUsers.length > 0 && !targetUser) {
                setTargetUser(otherUsers[0].username);
              }
            }}
            className={`flex-1 py-0.5 text-[10px] font-medium rounded transition-all ${
              chatTab === "dm"
                ? "bg-[#27272a] text-white"
                : "text-slate-450 hover:text-slate-200"
            }`}
          >
            DMs
          </button>
        </div>

        {/* DM User Selector */}
        {chatTab === "dm" && (
          <div className="mt-2.5">
            {otherUsers.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase font-bold text-slate-500 whitespace-nowrap">
                  Recipient:
                </span>
                <select
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  className="w-full rounded border border-[#27272a] bg-black/35 px-2 py-0.5 text-[10px] text-white outline-none focus:border-zinc-700"
                >
                  {otherUsers.map((u) => (
                    <option key={u.socketId || u.username} value={u.username}>
                      {u.username} {u.socketId ? "• active" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1 rounded border border-rose-900/35 bg-rose-950/20 px-2.5 py-1 text-[10px] text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>No active collaborators to DM</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message Feed */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 custom-scrollbar">
        {filteredMessages.length === 0 && (
          <div className="rounded border border-dashed border-[#27272a] bg-black/10 px-4 py-5 text-center text-[11px] leading-relaxed text-slate-400">
            {chatTab === "room"
              ? "Start the thread with a status update or handoff note for collaborators."
              : targetUser
              ? `Direct message with ${targetUser}. Only the two of you can view this stream.`
              : "Select a collaborator above to start direct messaging."}
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
                className={`max-w-[88%] rounded-lg border px-3 py-2 text-left ${
                  isSelf
                    ? "border-[#27272a] bg-[#27272a]/65 text-slate-100"
                    : msg.isPrivate
                    ? "border-fuchsia-900/40 bg-fuchsia-950/25 text-slate-200"
                    : "border-[#27272a] bg-transparent text-slate-200"
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isSelf ? "bg-slate-450" : msg.isPrivate ? "bg-fuchsia-500" : "bg-emerald-500"
                    }`}
                  />
                  <span className={isSelf ? "text-slate-400" : msg.isPrivate ? "text-fuchsia-400" : "text-emerald-400"}>
                    {msg.user}
                  </span>
                  {msg.isPrivate && (
                    <span className="flex items-center gap-0.5 text-fuchsia-405 font-medium">
                      <Lock className="h-2 w-2" /> (Private)
                    </span>
                  )}
                </div>
                
                {isAudio ? (
                  <div className="mt-1">
                    <audio
                      src={msg.text.slice(8)}
                      controls
                      className="max-w-full h-7 opacity-85"
                    />
                  </div>
                ) : msg.text.includes("```") ? (
                  <div className="text-[10px] bg-black/40 p-2 rounded border border-[#27272a] font-mono text-slate-300 mt-1.5 overflow-x-auto whitespace-pre">
                    {msg.text}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-[11px] leading-relaxed">
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
      <div className="border-t border-[#27272a] px-3 py-3 flex-shrink-0">
        <div className="rounded border border-[#27272a] bg-black/25 p-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={
              isRecording
                ? "Recording audio..."
                : chatTab === "dm"
                ? `Message ${targetUser || "recipient"} privately...`
                : "Type an update for the room..."
            }
            disabled={isRecording}
            className="w-full bg-transparent px-2 py-0.5 text-[10px] text-white placeholder:text-zinc-650 focus:outline-none"
          />
          <div className="mt-1.5 flex items-center justify-between border-t border-[#27272a]/40 pt-1.5 px-1.5">
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-slate-500 font-medium">
                {displayName}
              </span>

              {/* Voice record toggle */}
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  title="Record voice message"
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#27272a]/40 transition cursor-pointer"
                >
                  <Mic className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  title="Stop recording"
                  className="flex items-center gap-1 p-1 px-2 rounded bg-rose-700 text-white text-[9px] font-bold pulse-recording cursor-pointer"
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  <span>STOP</span>
                </button>
              )}

              {/* Snippet insert button */}
              <button
                type="button"
                onClick={shareSnippet}
                title="Share current file/selection as code snippet"
                className="flex items-center gap-1 p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#27272a]/40 transition cursor-pointer text-[9px]"
              >
                <Code className="h-3 w-3" />
                <span className="hidden sm:inline">Share Code</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isRecording}
              className="flex items-center justify-center p-1 rounded bg-[#27272a] hover:bg-[#27272a]/70 text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
