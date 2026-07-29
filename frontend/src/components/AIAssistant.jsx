import { useState, useRef, useEffect } from "react";
import { 
  Bot, 
  Key, 
  Sparkles, 
  AlertCircle, 
  Send, 
  CheckCircle2, 
  Copy, 
  BookOpen, 
  Cpu,
  Flame
} from "lucide-react";

export default function AIAssistant({ activeFileName, activeCode, activeLanguage }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am your AI Coding Assistant. Paste your Gemini API key in the panel settings to connect me to real Gemini models, or ask me questions directly using my built-in local static engine! I can analyze the active file and help you write, debug, and optimize code.",
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
          ? "API Key saved successfully! I am now powered by real-time Gemini intelligence."
          : "API Key removed. I will now fall back to the local analysis engine.",
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
        issues.push("- Potential syntax issue: Unbalanced curly brackets \`{}\` detected. Check your block nestings.");
      }
      
      if (issues.length === 0) {
        issues.push("- No obvious basic issues found in the file! (API key is recommended for deeper static analysis)");
      }

      return `### Debug Analysis for \`${fileName}\`:
Here are some observations from the static scan:
${issues.join("\n")}

*Note: For complete AST checking, runtime validation, and auto-fixes, please supply a Gemini API Key.*`;
    }

    if (promptLower.includes("optimize") || promptLower.includes("performance") || promptLower.includes("refactor")) {
      return `### Optimization Tips for \`${fileName}\`:
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
          content: `Error querying AI Assistant: ${err.message}. Double-check your API key or connection.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Renders simple markdown formatting manually
  const renderMessageContent = (content) => {
    const lines = content.split("\n");
    let inCodeBlock = false;
    let codeContent = [];
    let codeLang = "";

    return lines.map((line, idx) => {
      // Check for code blocks
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const contentToRender = codeContent.join("\n");
          codeContent = [];
          return (
            <div key={idx} className="my-2.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-slate-950 p-3 font-mono text-sm text-cyan-200">
              <div className="flex justify-between items-center text-xs text-slate-500 mb-1.5 border-b border-white/[0.05] pb-1.5 font-sans font-semibold">
                <span className="uppercase">{codeLang || "code"}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(contentToRender)}
                  className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                >
                  <Copy className="h-2.5 w-2.5" />
                  <span>Copy</span>
                </button>
              </div>
              <pre className="overflow-x-auto">{contentToRender}</pre>
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
          <h4 key={idx} className="text-xs font-semibold text-white mt-3 mb-1 bg-white/[0.02] py-0.5 px-1.5 rounded inline-block">
            {line.replace("### ", "")}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={idx} className="text-sm font-bold text-white mt-4 mb-1.5 border-b border-white/[0.05] pb-0.5">
            {line.replace("## ", "")}
          </h3>
        );
      }
      if (line.startsWith("##")) {
        return (
          <h3 key={idx} className="text-sm font-bold text-white mt-4 mb-1.5 border-b border-white/[0.05] pb-0.5">
            {line.replace(/#+\s*/, "")}
          </h3>
        );
      }

      // Render bullet items
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-slate-300 my-1 leading-relaxed">
            {line.replace(/^[-*]\s*/, "")}
          </li>
        );
      }

      // Check inline code tags like `code`
      const parts = line.split("`");
      if (parts.length > 1) {
        return (
          <p key={idx} className="text-xs text-slate-300 my-1.5 leading-relaxed">
            {parts.map((part, pIdx) => {
              if (pIdx % 2 === 1) {
                return (
                  <code key={pIdx} className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs text-cyan-300 font-medium">
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
        <p key={idx} className="text-xs text-slate-300 my-1.5 leading-relaxed">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="flex h-full flex-col bg-transparent text-slate-350">
      <div className="border-b border-[#27272a] px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              AI Assistant
            </span>
          </div>

          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="flex items-center gap-1 rounded border border-[#27272a] bg-transparent hover:bg-[#27272a]/50 px-2 py-0.5 text-xs text-slate-300 transition-all cursor-pointer font-semibold"
          >
            <Key className="h-3 w-3 text-slate-450" />
            <span>{apiKey ? "Edit Key" : "Set API Key"}</span>
          </button>
        </div>

        {showKeyInput && (
          <div className="mt-2.5 rounded border border-[#27272a] bg-black/20 p-2.5">
            <p className="text-xs text-slate-500 mb-2 leading-relaxed">
              Provide your Google Gemini API Key to enable high-quality code analysis:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                defaultValue={apiKey}
                id="gemini-key-input"
                className="flex-1 rounded border border-[#27272a] bg-[#18181b] px-2 py-0.5 text-xs text-white outline-none focus:border-zinc-750"
              />
              <button
                onClick={() => {
                  const val = document.getElementById("gemini-key-input")?.value || "";
                  saveApiKey(val.trim());
                }}
                className="rounded bg-[#27272a] hover:bg-[#27272a]/70 px-2.5 py-0.5 text-xs font-semibold text-white transition cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main chat messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 custom-scrollbar">
        {messages.map((msg, idx) => {
          const isAI = msg.role === "assistant";
          const isKeyMsg = msg.content.includes("API Key");
          const isErrorMsg = msg.content.includes("Error");

          return (
            <div key={idx} className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[90%] rounded-lg border px-3 py-2 text-left ${
                  isAI
                    ? isKeyMsg
                      ? "border-emerald-900/35 bg-emerald-950/20 text-slate-200"
                      : isErrorMsg
                      ? "border-rose-900/35 bg-rose-950/20 text-slate-200"
                      : "border-[#27272a] bg-transparent text-slate-200"
                    : "border-[#27272a] bg-[#27272a]/65 text-slate-100"
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  {isAI ? (
                    <>
                      {isKeyMsg ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : isErrorMsg ? (
                        <AlertCircle className="h-3 w-3 text-rose-500" />
                      ) : (
                        <Bot className="h-3 w-3 text-slate-450" />
                      )}
                      <span>AI Assistant</span>
                    </>
                  ) : (
                    <span>You</span>
                  )}
                </div>
                <div>{renderMessageContent(msg.content)}</div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-[#27272a] bg-transparent px-3 py-2 text-slate-400 text-sm flex items-center gap-1.5">
              <div className="h-1 w-1 rounded-full bg-slate-450 animate-bounce" />
              <div className="h-1 w-1 rounded-full bg-slate-450 animate-bounce [animation-delay:0.2s]" />
              <div className="h-1 w-1 rounded-full bg-slate-450 animate-bounce [animation-delay:0.4s]" />
              <span>Analyzing context...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Prompt shortcuts */}
      <div className="px-4 pb-2.5 flex flex-wrap gap-1 border-t border-[#27272a] pt-2.5 bg-transparent">
        <button
          onClick={() => handleSend("Explain the active file code")}
          disabled={loading || !activeFileName}
          className="flex items-center gap-1 rounded border border-[#27272a] bg-transparent hover:bg-[#27272a]/40 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <BookOpen className="h-3 w-3 text-slate-450" />
          <span>Explain</span>
        </button>
        <button
          onClick={() => handleSend("Find errors in the active file and suggest fixes")}
          disabled={loading || !activeFileName}
          className="flex items-center gap-1 rounded border border-[#27272a] bg-transparent hover:bg-[#27272a]/40 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Cpu className="h-3 w-3 text-slate-455" />
          <span>Debug</span>
        </button>
        <button
          onClick={() => handleSend("How can I optimize this code for performance?")}
          disabled={loading || !activeFileName}
          className="flex items-center gap-1 rounded border border-[#27272a] bg-transparent hover:bg-[#27272a]/40 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Flame className="h-3 w-3 text-slate-455" />
          <span>Optimize</span>
        </button>
      </div>

      {/* Input container */}
      <div className="border-t border-[#27272a] px-3 py-3 flex-shrink-0">
        <div className="rounded border border-[#27272a] bg-black/25 p-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
            placeholder="Ask a question about the active workspace..."
            className="w-full bg-transparent px-2 py-0.5 text-xs text-white placeholder:text-zinc-650 focus:outline-none"
            disabled={loading}
          />
          <div className="mt-1.5 flex items-center justify-between border-t border-[#27272a]/40 pt-1.5 px-1.5">
            <span className="text-xs text-slate-500 font-medium">
              {activeFileName ? `Context: ${activeFileName}` : "Global Chat"}
            </span>
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center p-1 rounded bg-[#27272a] hover:bg-[#27272a]/70 text-slate-200 transition disabled:opacity-35"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
