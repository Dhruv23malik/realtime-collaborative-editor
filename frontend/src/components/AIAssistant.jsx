import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Settings,
  Sparkles,
  AlertCircle,
  Send,
  CheckCircle2,
  Copy,
  Check,
  Clipboard,
  ClipboardCheck,
  Wand2,
  X,
  RefreshCw,
  Code2,
  MessageSquare
} from "lucide-react";

// ─── Tiny Markdown Renderer ───────────────────────────────────────────────────
function CodeBlock({ lang, code, onApply }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 overflow-hidden rounded-md border border-[#27272a] bg-[#09090b] shadow-sm">
      <div className="flex items-center justify-between border-b border-[#27272a] bg-[#121214] px-3 py-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {lang || "code"}
        </span>
        <div className="flex items-center gap-2">
          {onApply && (
            <button
              onClick={() => onApply(code)}
              title="Apply to active file in Monaco"
              className="flex items-center gap-1 rounded-sm border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400 hover:bg-orange-500/20 transition-all cursor-pointer"
            >
              <Wand2 className="h-2.5 w-2.5" />
              Apply
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition cursor-pointer"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-slate-300 custom-scrollbar">
        {code}
      </pre>
    </div>
  );
}

function renderMarkdown(content, onApply) {
  const lines = content.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <CodeBlock key={`cb-${i}`} lang={lang} code={codeLines.join("\n")} onApply={onApply} />
      );
      continue;
    }

    // h3
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-xs font-semibold text-white">
          {line.slice(4)}
        </h4>
      );
      i++;
      continue;
    }
    // h2
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mt-4 mb-1.5 border-b border-[#27272a] pb-1 text-sm font-semibold text-white">
          {line.slice(3)}
        </h3>
      );
      i++;
      continue;
    }
    // h1
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="mt-4 mb-2 text-sm font-semibold text-white">
          {line.slice(2)}
        </h2>
      );
      i++;
      continue;
    }

    // Bullet
    if (/^[-*] /.test(line.trim())) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-xs text-slate-300 my-0.5 leading-relaxed">
          {renderInline(line.replace(/^[-*]\s/, ""))}
        </li>
      );
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line.trim())) {
      elements.push(
        <li key={i} className="ml-4 list-decimal text-xs text-slate-300 my-0.5 leading-relaxed">
          {renderInline(line.replace(/^\d+\.\s/, ""))}
        </li>
      );
      i++;
      continue;
    }

    // Bold **text**
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
      i++;
      continue;
    }

    // Default paragraph
    elements.push(
      <p key={i} className="text-xs text-slate-300 my-0.5 leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }
  return elements;
}

function renderInline(text) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="text-white font-medium">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={idx} className="rounded bg-[#27272a]/60 px-1 py-0.5 font-mono text-[10px] text-slate-200">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIAssistant({ activeFileName, activeCode, activeLanguage, activeSelection, onApply }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const hasSelection = activeSelection && (activeSelection.startLineNumber !== activeSelection.endLineNumber || activeSelection.startColumn !== activeSelection.endColumn);
  const lineCount = activeCode ? activeCode.split("\n").length : 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem("gemini_api_key", key);
    setShowSettings(false);
  };

  const copyMessage = (idx, content) => {
    navigator.clipboard.writeText(content);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getContextDescription = () => {
    if (!activeFileName) return "no active file";
    if (hasSelection) {
      return `lines ${activeSelection.startLineNumber}-${activeSelection.endLineNumber} of ${activeFileName}`;
    }
    return `${activeFileName}`;
  };

  // ── Local fallback engine ──────────────────────────────────────────────────
  const generateLocalResponse = (prompt, code, fileName, language) => {
    const p = prompt.toLowerCase();
    if (p.includes("explain") || p.includes("what does")) {
      return `### Explanation
**Context:** ${getContextDescription()}

This code snippet implements logic using ${language} constructs. To get a detailed, line-by-line explanation, please configure your Gemini API key in the settings.`;
    }
    if (p.includes("bug") || p.includes("error") || p.includes("fix") || p.includes("debug")) {
      const issues = [];
      if (!code?.trim()) issues.push("- No code found to debug.");
      if (code && (code.match(/\{/g) || []).length !== (code.match(/\}/g) || []).length)
        issues.push("- **Syntax Warning:** Mismatched braces detected.");
      if (!issues.length) issues.push("- Static analysis found no obvious issues.");
      return `### Bug Analysis\n${issues.join("\n")}\n\n*Configure a Gemini API key for advanced contextual bug detection.*`;
    }
    if (p.includes("optimize") || p.includes("performance") || p.includes("refactor")) {
      return `### Refactoring Suggestions
1. **Reduce Time Complexity** — Look for nested loops that can be optimized.
2. **Memory Management** — Clear references and listeners to avoid leaks.
3. **Modern Syntax** — Utilize ES6+ or newer language features where applicable.

*Configure a Gemini API key to receive automated, code-specific refactoring suggestions.*`;
    }
    if (p.includes("test") || p.includes("unit")) {
      return `### Test Generation
\`\`\`javascript
// Test scaffold for ${fileName || "module"}
import { describe, it, expect } from 'vitest';

describe('${fileName || "Module"}', () => {
  it('should function as expected', () => {
    expect(true).toBe(true);
  });
});
\`\`\`
*Configure a Gemini API key to generate comprehensive unit tests based on your logic.*`;
    }
    return `Analyzed query: **"${prompt}"**
Context: ${getContextDescription()}

*Please provide a Gemini API key in the panel settings to unlock intelligent code generation and analysis.*`;
  };

  // ── Streaming Gemini API call ──────────────────────────────────────────────
  const callGeminiStreaming = async (textToSend) => {
    let selectionContext = "";
    if (hasSelection && activeCode) {
      const lines = activeCode.split("\n");
      const selectedLines = lines.slice(activeSelection.startLineNumber - 1, activeSelection.endLineNumber).join("\n");
      selectionContext = `The user has highlighted the following lines (${activeSelection.startLineNumber}-${activeSelection.endLineNumber}):\n\`\`\`${activeLanguage}\n${selectedLines}\n\`\`\`\nFocus your answer heavily on this highlighted section.`;
    }

    const systemPrompt = `You are a professional, highly capable coding assistant integrated directly into a developer's IDE (similar to GitHub Copilot or Cursor).

CURRENT CONTEXT:
- File: ${activeFileName || "None"}
- Language: ${activeLanguage || "unknown"}
- Code:
\`\`\`${activeLanguage}
${activeCode || "(empty file)"}
\`\`\`
${selectionContext}

INSTRUCTIONS:
1. Provide extremely concise, developer-focused answers. Do not use conversational filler (e.g. "Sure, I can help with that!").
2. Use markdown formatting.
3. For code suggestions, use fenced code blocks. If suggesting a fix, provide the complete revised block so the user can easily apply it.
4. Assume the user is an experienced developer.`;

    const body = JSON.stringify({
      contents: [
        {
          parts: [{ text: `${systemPrompt}\n\nUser Request: ${textToSend}` }],
        },
      ],
      generationConfig: {
        temperature: 0.2, // Lower temperature for more focused coding answers
        maxOutputTokens: 4096,
      },
    });

    abortControllerRef.current = new AbortController();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: abortControllerRef.current.signal,
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          accumulated += delta;
          setStreamingContent(accumulated);
        } catch {
          // skip malformed chunks
        }
      }
    }

    return accumulated;
  };

  // ── Main Send Handler ──────────────────────────────────────────────────────
  const handleSend = async (customPrompt = "") => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreamingContent("");

    try {
      let responseText = "";
      if (apiKey) {
        responseText = await callGeminiStreaming(textToSend);
      } else {
        await new Promise((r) => setTimeout(r, 600));
        responseText = generateLocalResponse(textToSend, activeCode, activeFileName, activeLanguage);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: responseText }]);
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `**Error:** ${err.message}`,
          },
        ]);
      }
    } finally {
      setLoading(false);
      setStreamingContent("");
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    if (streamingContent) {
      setMessages((prev) => [...prev, { role: "assistant", content: streamingContent }]);
    }
    setLoading(false);
    setStreamingContent("");
  };

  const handleReset = () => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setLoading(false);
    setStreamingContent("");
  };

  const isEmptyState = messages.length === 0;

  return (
    <div className="flex h-full flex-col bg-[#0f0f11] text-slate-300 font-sans">
      {/* 1. HEADER */}
      <div className="flex items-center justify-between border-b border-[#27272a] bg-[#141417] px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider text-slate-200">
            AI ASSISTANT
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            <div className={`h-1.5 w-1.5 rounded-full ${apiKey ? 'bg-orange-500' : 'bg-slate-500'}`} />
            <span className="text-[10px] text-slate-400 font-medium">
              {apiKey ? 'Gemini Ready' : 'Local Mode'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            title="New Chat"
            className="p-1 rounded-sm text-slate-500 hover:text-slate-200 hover:bg-[#27272a]/60 transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
            className="p-1 rounded-sm text-slate-500 hover:text-slate-200 hover:bg-[#27272a]/60 transition cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-[#27272a] bg-[#1a1a1e] p-3 text-xs flex-shrink-0 animate-in slide-in-from-top-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Gemini API Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="AIzaSy..."
              defaultValue={apiKey}
              id="gemini-key-input"
              className="flex-1 rounded-sm border border-[#27272a] bg-[#09090b] px-2 py-1 text-slate-200 outline-none focus:border-orange-500/50"
            />
            <button
              onClick={() => {
                const val = document.getElementById("gemini-key-input")?.value || "";
                saveApiKey(val.trim());
              }}
              className="rounded-sm bg-[#27272a] hover:bg-orange-500/20 hover:text-orange-400 hover:border-orange-500/30 border border-[#27272a] px-3 py-1 font-medium text-slate-200 transition cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* 2. CONTEXT INDICATOR */}
      <div className="border-b border-[#27272a] bg-[#111113] px-4 py-2 flex-shrink-0">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">
          {hasSelection ? "Selected Code" : "Current Context"}
        </p>
        <div className="flex items-center gap-2 text-xs">
          <Code2 className={`h-3.5 w-3.5 ${hasSelection ? 'text-orange-400' : 'text-slate-400'}`} />
          <span className="font-mono text-slate-200 truncate font-medium">
            {activeFileName || "No active file"}
          </span>
          {activeFileName && (
            <span className="text-slate-500 text-[10px]">
              {hasSelection 
                ? `Lines ${activeSelection.startLineNumber}–${activeSelection.endLineNumber}` 
                : `${lineCount} lines`}
            </span>
          )}
        </div>
      </div>

      {/* Chat Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar">
        
        {/* 3 & 4. EMPTY STATE & QUICK ACTIONS */}
        {isEmptyState && (
          <div className="flex flex-col h-full animate-in fade-in duration-500">
            {/* Minimal Empty State */}
            <div className="flex flex-col items-center justify-center mt-6 mb-8 text-center">
              <span className="text-xl mb-3 text-orange-500/80">✦</span>
              <h3 className="text-sm font-medium text-slate-200 mb-1">AI coding assistant</h3>
              <p className="text-xs text-slate-500 max-w-[220px]">
                Select code or ask a question about your project.
              </p>
            </div>


          </div>
        )}

        {/* 5. RESPONSE DESIGN */}
        {messages.map((msg, idx) => {
          const isAI = msg.role === "assistant";
          const isError = msg.content.includes("**Error:**");

          if (!isAI) {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[85%] rounded-md bg-[#27272a]/60 px-3 py-2 text-xs text-slate-200 border border-[#27272a]">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className="flex flex-col group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-orange-500/90 text-sm">✦</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    AI Assistant
                  </span>
                </div>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-[#27272a] to-transparent ml-3" />
                <button
                  onClick={() => copyMessage(idx, msg.content)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-500 hover:text-slate-300 cursor-pointer ml-2"
                  title="Copy message"
                >
                  {copiedId === idx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className={`text-xs ${isError ? "text-rose-400" : "text-slate-300"}`}>
                {renderMarkdown(msg.content, onApply)}
              </div>
            </div>
          );
        })}

        {/* Streaming / Loading State */}
        {loading && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-orange-500/90 text-sm animate-pulse">✦</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                AI Assistant
              </span>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-[#27272a] to-transparent ml-3" />
            </div>
            <div className="text-xs text-slate-300">
              {streamingContent ? (
                renderMarkdown(streamingContent, onApply)
              ) : (
                <div className="flex items-center gap-1.5 py-1 text-slate-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" />
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.15s]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.3s]" />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#141417] border-t border-[#27272a] flex-shrink-0">
        <div className="relative rounded-md border border-[#27272a] bg-[#09090b] flex items-end focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/20 transition-all shadow-inner">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !loading) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question..."
            className="flex-1 bg-transparent px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none resize-none min-h-[40px] max-h-[160px] custom-scrollbar"
            disabled={loading}
            rows={1}
          />
          <div className="flex items-center p-1.5 flex-shrink-0">
            {loading ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center justify-center p-1.5 rounded-sm bg-[#27272a] hover:bg-[#3f3f46] text-slate-300 transition-colors cursor-pointer"
                title="Stop generation"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="flex items-center justify-center p-1.5 rounded-sm bg-orange-600 hover:bg-orange-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                <Send className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
