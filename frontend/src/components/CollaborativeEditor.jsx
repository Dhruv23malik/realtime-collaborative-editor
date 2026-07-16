import { useEffect, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";

const COLORS = [
  "#22d3ee", // cyan
  "#e879f9", // fuchsia
  "#fbbf24", // amber
  "#34d499", // emerald
  "#f87171", // rose
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
];

const getUserColor = (username) => {
  if (!username) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};

export default function CollaborativeEditor({
  socket,
  roomId,
  fileId,
  code: initialCode,
  language,
  username = "Guest",
  editorSettings = { theme: "vs-dark", fontSize: 13, tabSize: 2 },
}) {
  const [code, setCode] = useState(initialCode);
  const isRemoteUpdate = useRef(false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const remoteDecorationsRef = useRef({}); // { [socketId]: decorationIds[] }

  const userColor = getUserColor(username);

  // Sync with initialCode when the active file shifts or loads
  useEffect(() => {
    isRemoteUpdate.current = true;
    setCode(initialCode);
    isRemoteUpdate.current = false;
  }, [initialCode]);

  // Clean up decorations on unmount or file switch
  useEffect(() => {
    return () => {
      if (editorRef.current && monacoRef.current) {
        const editor = editorRef.current;
        Object.keys(remoteDecorationsRef.current).forEach((socketId) => {
          editor.deltaDecorations(remoteDecorationsRef.current[socketId], []);
        });
        remoteDecorationsRef.current = {};
      }
    };
  }, [fileId]);

  // Handle remote code and cursor updates
  useEffect(() => {
    if (!socket) return;

    const handleCodeUpdate = ({ fileId: incomingFileId, code: newCode }) => {
      if (incomingFileId === fileId) {
        isRemoteUpdate.current = true;
        setCode(newCode);
        isRemoteUpdate.current = false;
      }
    };

    const handleCursorUpdate = ({ socketId, user, fileId: incomingFileId, position, selection, color }) => {
      // Only show cursors on the currently active file
      if (incomingFileId !== fileId || !editorRef.current || !monacoRef.current) return;

      const editor = editorRef.current;
      const monaco = monacoRef.current;
      const otherUsername = user?.username || "Guest";

      // Dynamically insert CSS classes for user-specific colors & cursor tooltip names
      const styleId = `cursor-style-${socketId}`;
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `
        .remote-cursor-${socketId} {
          --user-color: ${color};
        }
        .remote-cursor-tooltip.remote-cursor-${socketId}::before {
          content: "${otherUsername}";
        }
        .remote-selection-${socketId} {
          --user-selection-color: ${color}2c; /* Add transparency (hex + 2c = ~17% opacity) */
        }
      `;

      const newDecorations = [];

      // Add selection decoration if ranges differ
      const hasSelection = selection && (
        selection.startLineNumber !== selection.endLineNumber ||
        selection.startColumn !== selection.endColumn
      );

      if (hasSelection) {
        newDecorations.push({
          range: new monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          ),
          options: {
            className: `remote-selection remote-selection-${socketId}`,
            hoverMessage: { value: `${otherUsername}'s selection` },
          },
        });
      }

      // Add cursor decoration
      if (position) {
        newDecorations.push({
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            className: `remote-cursor-caret remote-cursor-${socketId}`,
            before: {
              content: "",
              inlineClassName: `remote-cursor-tooltip remote-cursor-${socketId}`,
            },
            hoverMessage: { value: otherUsername },
          },
        });
      }

      const oldDecorations = remoteDecorationsRef.current[socketId] || [];
      remoteDecorationsRef.current[socketId] = editor.deltaDecorations(
        oldDecorations,
        newDecorations
      );
    };

    socket.on("code-update", handleCodeUpdate);
    socket.on("cursor-update", handleCursorUpdate);

    // Clean up cursor decorations of users who disconnect
    const handleUsersUpdate = (userList) => {
      if (!editorRef.current) return;
      const editor = editorRef.current;
      const activeSockets = new Set(userList.map((u) => u.socketId));

      Object.keys(remoteDecorationsRef.current).forEach((socketId) => {
        if (!activeSockets.has(socketId)) {
          editor.deltaDecorations(remoteDecorationsRef.current[socketId], []);
          delete remoteDecorationsRef.current[socketId];
          const styleEl = document.getElementById(`cursor-style-${socketId}`);
          if (styleEl) styleEl.remove();
        }
      });
    };

    socket.on("users-update", handleUsersUpdate);

    return () => {
      socket.off("code-update", handleCodeUpdate);
      socket.off("cursor-update", handleCursorUpdate);
      socket.off("users-update", handleUsersUpdate);
    };
  }, [socket, fileId]);

  const handleChange = (value) => {
    if (value === undefined) return;
    setCode(value);

    if (!isRemoteUpdate.current && socket) {
      socket.emit("code-change", { roomId, fileId, code: value });
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Remeasure fonts once they are fully loaded to resolve cursor/caret misalignment
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => {
        try {
          monaco.editor.remeasureFonts();
        } catch (e) {
          console.warn("Failed to remeasure fonts in Monaco:", e);
        }
      });
    }

    // Listen to changes to emit cursor coordinates
    editor.onDidChangeCursorPosition((e) => {
      const position = e.position;
      const selection = editor.getSelection();
      socket.emit("cursor-activity", {
        fileId,
        position,
        selection,
        color: userColor,
      });
    });

    editor.onDidChangeCursorSelection((e) => {
      const position = editor.getPosition();
      const selection = e.selection;
      socket.emit("cursor-activity", {
        fileId,
        position,
        selection,
        color: userColor,
      });
    });
  };

  return (
    <div className="h-full w-full bg-[#0b1020]">
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={handleChange}
        theme={editorSettings.theme}
        onMount={handleEditorDidMount}
        options={{
          fontSize: editorSettings.fontSize,
          tabSize: editorSettings.tabSize,
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
