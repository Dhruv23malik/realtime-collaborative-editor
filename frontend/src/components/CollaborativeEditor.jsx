import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

const STARTER_SNIPPETS = {
  javascript: `function welcomeRoom(roomId) {
  console.log(\`Connected to room: \${roomId}\`);
}

welcomeRoom("studio-live");`,
  python: `def welcome_room(room_id: str) -> None:
    print(f"Connected to room: {room_id}")

welcome_room("studio-live")`,
  html: `<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Collaborative Studio</h1>
    </main>
  </body>
</html>`,
  css: `:root {
  color-scheme: dark;
}

body {
  margin: 0;
  font-family: "Sora", sans-serif;
}`,
  json: `{
  "room": "studio-live",
  "status": "connected"
}`,
  cpp: `#include <iostream>

int main() {
  std::cout << "Connected to studio-live" << std::endl;
  return 0;
}`,
};

export default function CollaborativeEditor({ socket, language }) {
  const [code, setCode] = useState(STARTER_SNIPPETS.javascript);
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    setCode((currentCode) => {
      if (!currentCode.trim() || Object.values(STARTER_SNIPPETS).includes(currentCode)) {
        return STARTER_SNIPPETS[language] ?? STARTER_SNIPPETS.javascript;
      }
      return currentCode;
    });
  }, [language]);

  useEffect(() => {
    if (!socket) return;

    socket.on("code-update", (newCode) => {
      isRemoteUpdate.current = true;
      setCode(newCode);
      isRemoteUpdate.current = false;
    });

    return () => {
      socket.off("code-update");
    };
  }, [socket]);

  const handleChange = (value) => {
    if (value === undefined) return;

    setCode(value);

    if (!isRemoteUpdate.current && socket) {
      socket.emit("code-change", value);
    }
  };

  return (
    <div className="h-full w-full bg-[#0b1020]">
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={handleChange}
        theme="vs-dark"
        options={{
          fontSize: 15,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          minimap: { enabled: false },
          automaticLayout: true,
          padding: { top: 20 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          roundedSelection: true,
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
        }}
      />
    </div>
  );
}
