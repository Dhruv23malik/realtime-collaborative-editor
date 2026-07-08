import { useState, useRef, useEffect } from "react";

export default function AIAssistant({ activeFileName, activeCode, activeLanguage }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "👋 Hello! I am your AI Coding Assistant. Paste your Gemini API key in Settings to connect me to real Gemini models, or ask me questions directly using my built-in local engine! I can analyze the active file and help you code.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem("gemini_api_key", key);
    setShowKeyInput(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: key
          ? "✅ Gemini API Key saved! I am now powered by real-time Gemini intelligence."
          : "⚠️ API Key removed. I will now fall back to the local analysis engine.",
      },
    ]);
  };

  const generateLocalResponse = (prompt, code, fileName, language) => {
    const promptLower = prompt.toLowerCase();

    if (promptLower.includes("explain") || promptLower.includes("what does")) {
      return `### Code Explanation for \`${fileName}\` (${language}):
The active script contains code that works with **${language}** constructs. Here is a breakdown:
1. **Purpose:** It implements features within your workspace.
2. **Logic Flow:**
   - Evaluates active parameters.
   - Executes routines matching the target definition.
3. **Key Blocks:**
   \`\`\`${language}
${code ? code.split("\n").slice(0, 8).join("\n") + "\n// ... [rest of file]" : "// Empty file"}
   \`\`\`
   
*Provide an API Key in the settings tab to receive full, real-time Gemini explanations.*`;
    }

    if (promptLower.includes("error") || promptLower.includes("debug") || promptLower.includes("fix")) {
      const issues = [];
      if (!code || code.trim() === "") {
        issues.push("- The active file is currently empty. Write some code to start debugging!");
      }
      if (code && code.includes("console.log") && !code.includes("return") && language === "javascript") {
        issues.push("- Suggestion: Consider returning values from functions instead of just logging them to improve reusability.");
      }
      if (code && (code.match(/\{/g) || []).length !== (code.match(/\}/g) || []).length) {
        issues.push("- Potential syntax issue: Unbalanced curly brackets `{}` detected. Check your block nestings.");
      }
      
      if (issues.length === 0) {
        issues.push("- No obvious basic issues found in the file! (API key is recommended for deeper static analysis)");
      }

      return `### 🔍 Debug Analysis for \`${fileName}\`:
Here are some observations from the static scan:
${issues.join("\n")}

*Note: For complete AST checking, runtime validation, and auto-fixes, please supply a Gemini API Key.*`;
    }

    if (promptLower.includes("optimize") || promptLower.includes("performance") || promptLower.includes("refactor")) {
      return `### ⚡ Optimization Tips for \`${fileName}\`:
1. **Reduce Overhead:** Cache nested lookups or expensive selector accesses.
2. **Asynchronous I/O:** Ensure blocking filesystem operations are run asynchronously.
3. **Memory Management:** Clean up intervals, listeners, or socket connections on teardown.
4. **Code Quality:** Use ES6 features (de-structuring, spread operators) to improve legibility.

*Add your Gemini API Key in the panel header to auto-refactor the script using Gemini.*`;
    }

    return `### Response (Local Engine):
I've analyzed your prompt: "${prompt}".

Here is a template matching \`${fileName}\` (${language}):
\`\`\`${language}
// AI Suggestion based on your prompt
function optimizeWorkspace() {
  // Let's refine collaboration
  console.log("Analyzing file: ${fileName}");
}
\`\`\`

*Paste your Gemini API Key in the settings at the top of this panel to get real-time, smart answers to any query.*`;
  };

  const handleSend = async (customPrompt = "") => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim()) return;

    const userMessage = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      if (apiKey) {
        // Call Real Gemini API
        const systemPrompt = `You are a helpful programming assistant. Help the user program in the context of their active file.
File Name: ${activeFileName}
Language: ${activeLanguage}
Code Contents:
\`\`\`${activeLanguage}
${activeCode}
\`\`\`
Provide detailed explanations, code snippets, or error fixes inside clean Markdown formats.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: `${systemPrompt}\n\nUser Question: ${textToSend}` },
                  ],
                },
              ],
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: generatedText },
        ]);
      } else {
        // Fallback to local engine
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulating response delay
        const responseText = generateLocalResponse(textToSend, activeCode, activeFileName, activeLanguage);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: responseText },
        ]);
      }
    } catch (err) {
      console.error("AI assistant request error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Error querying AI Assistant: ${err.message}. Double-check your API key or connection.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Renders simple markdown formatting manually to keep it styling-free
  const renderMessageContent = (content) => {
    const lines = content.split("\n");
    let inCodeBlock = false;
    let codeContent = [];
    let codeLang = "";

    return lines.map((line, idx) => {
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const contentToRender = codeContent.join("\n");
          codeContent = [];
          return (
            <div key={idx} className="my-2 overflow-x-auto rounded-xl border border-white/10 bg-slate-950 p-3.5 font-mono text-xs text-cyan-200">
              <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1 border-b border-white/5 pb-1">
                <span>{codeLang || "code"}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(contentToRender)}
                  className="hover:text-white transition cursor-pointer"
                >
                  Copy
                </button>
              </div>
              <pre>{contentToRender}</pre>
            </div>
          );
        } else {
          inCodeBlock = true;
          codeLang = line.replace("```", "").trim();
          return null;
        }
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return null;
      }

      // Check header format
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className="text-base font-semibold text-white mt-3 mb-1.5">
            {line.replace("### ", "")}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={idx} className="text-lg font-bold text-white mt-4 mb-2">
            {line.replace("## ", "")}
          </h3>
        );
      }
      if (line.startsWith("##")) {
        return (
          <h3 key={idx} className="text-lg font-bold text-white mt-4 mb-2">
            {line.replace(/#+\s*/, "")}
          </h3>
        );
      }

      // Render bullet items
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li key={idx} className="ml-4 list-disc text-sm text-slate-300 my-1">
            {line.replace(/^[-*]\s*/, "")}
          </li>
        );
      }

      // Check code tags like `code`
      const parts = line.split("`");
      if (parts.length > 1) {
        return (
          <p key={idx} className="text-sm text-slate-300 my-1.5 leading-6">
            {parts.map((part, pIdx) => {
              if (pIdx % 2 === 1) {
                return (
                  <code key={pIdx} className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs text-cyan-300">
                    {part}
                  </code>
                );
              }
              return part;
            })}
          </p>
        );
      }

      return (
        <p key={idx} className="text-sm text-slate-300 my-1.5 leading-6">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="flex h-full flex-col bg-transparent text-slate-100">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-slate-400">
              Co-Pilot
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
              AI Assistant
            </h3>
          </div>

          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="rounded-full border border-white/10 hover:border-cyan-400/30 bg-white/6 hover:bg-white/10 px-3 py-1.5 text-xs text-slate-300 transition-all cursor-pointer"
          >
            {apiKey ? "🔑 Edit Key" : "🔑 Set API Key"}
          </button>
        </div>

        {showKeyInput && (
          <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-3">
            <p className="text-xs text-slate-400 mb-2">
              Provide your Google Gemini API Key to enable real AI capability:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                defaultValue={apiKey}
                id="gemini-key-input"
                className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-300"
              />
              <button
                onClick={() => {
                  const val = document.getElementById("gemini-key-input")?.value || "";
                  saveApiKey(val.trim());
                }}
                className="rounded-xl bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 text-xs font-semibold text-slate-950 transition cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main chat messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 custom-scrollbar">
        {messages.map((msg, idx) => {
          const isAI = msg.role === "assistant";
          return (
            <div key={idx} className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[90%] rounded-3xl border px-4 py-3.5 shadow-md ${
                  isAI
                    ? "border-white/8 bg-white/5 text-slate-100"
                    : "border-cyan-400/20 bg-cyan-400/10 text-white"
                }`}
              >
                <div className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
                  <span>{isAI ? "🤖 Gemini Co-Pilot" : "👤 You"}</span>
                </div>
                <div>{renderMessageContent(msg.content)}</div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-3xl border border-white/8 bg-white/5 px-4 py-3 text-slate-400 text-xs flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" />
              <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
              <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Prompt shortcuts */}
      <div className="px-5 pb-2 flex flex-wrap gap-2 border-t border-white/5 pt-3 bg-white/[0.01]">
        <button
          onClick={() => handleSend("Explain the active file code")}
          disabled={loading || !activeFileName}
          className="rounded-full border border-white/8 hover:border-cyan-400/30 bg-white/4 hover:bg-white/8 px-3 py-1 text-xs text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
        >
          📖 Explain Code
        </button>
        <button
          onClick={() => handleSend("Find errors in the active file and suggest fixes")}
          disabled={loading || !activeFileName}
          className="rounded-full border border-white/8 hover:border-rose-400/30 bg-white/4 hover:bg-white/8 px-3 py-1 text-xs text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
        >
          🔍 Debug Code
        </button>
        <button
          onClick={() => handleSend("How can I optimize this code for performance?")}
          disabled={loading || !activeFileName}
          className="rounded-full border border-white/8 hover:border-amber-400/30 bg-white/4 hover:bg-white/8 px-3 py-1 text-xs text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
        >
          ⚡ Optimize Code
        </button>
      </div>

      {/* Input container */}
      <div className="border-t border-white/8 px-4 py-4">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-2">
          <div className="flex flex-col gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
              placeholder="Ask a question about the active workspace..."
              className="w-full bg-transparent px-3 pt-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              disabled={loading}
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[10px] text-slate-500">
                {activeFileName ? `Context: ${activeFileName}` : "No file active"}
              </span>
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ask Assistant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
