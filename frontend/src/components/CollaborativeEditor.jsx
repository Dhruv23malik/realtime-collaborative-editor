import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

export default function CollaborativeEditor({ socket, language }) {
  const [code, setCode] = useState("// Start typing here...");
  const isRemoteUpdate = useRef(false);

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
    <div className="h-full w-full bg-slate-950">
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={handleChange}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          automaticLayout: true,
          theme: "vs-dark",
        }}
      />
    </div>
  );
}
