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
    <div className="flex h-full min-h-[320px] flex-col bg-transparent text-slate-300 font-sans relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute right-[-20%] top-[-10%] h-64 w-64 rounded-full bg-orange-500/5 blur-[80px]" />
        <div className="absolute left-[-20%] bottom-[-10%] h-64 w-64 rounded-full bg-purple-500/5 blur-[80px]" />
      </div>



      {/* Message Feed */}
      <div className="relative z-10 flex-1 space-y-4 overflow-y-auto px-5 py-5 custom-scrollbar">
        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-70 hover:opacity-100 transition-opacity duration-500 pb-10">
            <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-orange-500/10 to-purple-500/10 border border-white/[0.05] flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
              <MessageSquare className="h-6 w-6 text-orange-400/80" />
            </div>
            <p className="text-center text-base font-semibold text-slate-200">
              {chatTab === "room"
                ? "Start the conversation"
                : targetUser
                ? `Private chat with ${targetUser}`
                : "Select a collaborator"}
            </p>
            <p className="text-center text-sm text-slate-500 mt-2 max-w-[200px] leading-relaxed">
              {chatTab === "room"
                ? "Share ideas, code snippets, or handoff notes with the entire room."
                : "Messages sent here are visible only to you and the recipient."}
            </p>
          </div>
        )}

        {filteredMessages.map((msg, idx) => {
          const isSelf = msg.user === displayName;
          const isAudio = msg.text?.startsWith("[audio]:");

          return (
            <div
              key={`${msg.user}-${idx}`}
              className={`flex w-full ${isSelf ? "justify-end" : "justify-start"} animate-rise`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-left relative shadow-lg ${
                  isSelf
                    ? "rounded-tr-sm bg-gradient-to-br from-orange-600/90 to-blue-600/90 text-white shadow-orange-900/20"
                    : msg.isPrivate
                    ? "rounded-tl-sm bg-gradient-to-br from-purple-900/60 to-fuchsia-900/60 border border-purple-500/30 text-white shadow-purple-900/20"
                    : "rounded-tl-sm bg-[#1e2030]/80 text-slate-200 border border-white/[0.05] backdrop-blur-md"
                }`}
              >
                {!isSelf && (
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                    <span className={msg.isPrivate ? "text-purple-300" : "text-orange-400"}>
                      {msg.user}
                    </span>
                    {msg.isPrivate && (
                      <span className="flex items-center gap-0.5 text-purple-300/80 bg-purple-500/20 px-1.5 py-0.5 rounded text-xs uppercase tracking-wider">
                        <Lock className="h-2 w-2" /> Private
                      </span>
                    )}
                  </div>
                )}
                
                {isAudio ? (
                  <div className="mt-1">
                    <audio
                      src={msg.text.slice(8)}
                      controls
                      className="max-w-full h-8 opacity-90 sepia-[0.3] hue-rotate-[180deg]"
                    />
                  </div>
                ) : msg.text.includes("```") ? (
                  <div className="text-sm bg-[#000000]/60 p-3 rounded-lg border border-white/[0.05] font-mono text-slate-300 mt-2 overflow-x-auto whitespace-pre shadow-inner">
                    {msg.text}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
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
      <div className="relative z-10 border-t border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl px-4 py-4 flex-shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
        <div className="relative rounded-xl border border-white/[0.08] bg-[#0a0a0a]/80 shadow-inner focus-within:border-orange-500/40 focus-within:ring-1 focus-within:ring-orange-500/20 transition-all overflow-hidden group">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              isRecording
                ? "Recording audio..."
                : chatTab === "dm"
                ? `Message ${targetUser || "recipient"} privately...`
                : "Type your message..."
            }
            disabled={isRecording}
            className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none resize-none h-[48px] custom-scrollbar"
            rows={1}
          />
          <div className="flex items-center justify-between bg-black/20 pt-2 pb-2 px-3 border-t border-white/[0.03]">
            <div className="flex items-center gap-1.5">
              {/* Voice record toggle */}
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  title="Record voice message"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors cursor-pointer"
                >
                  <Mic className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  title="Stop recording"
                  className="flex items-center gap-1.5 p-1.5 px-3 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold pulse-recording cursor-pointer transition-all hover:bg-rose-500/30"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>STOP REC</span>
                </button>
              )}

              {/* Snippet insert button */}
              <button
                type="button"
                onClick={shareSnippet}
                title="Share code snippet"
                className="flex items-center gap-1.5 p-1.5 rounded-lg text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors cursor-pointer text-xs font-semibold tracking-wide"
              >
                <Code className="h-4 w-4" />
                <span className="hidden sm:inline">Snippet</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isRecording}
              className="flex items-center justify-center p-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-orange-600 shadow-md shadow-orange-900/30"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
