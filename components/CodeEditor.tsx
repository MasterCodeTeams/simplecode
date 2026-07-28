"use client";

import Editor, { OnMount } from "@monaco-editor/react";
import { useRef, useCallback } from "react";

function langFromPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", json: "json", html: "html", css: "css", scss: "scss",
    md: "markdown", yml: "yaml", yaml: "yaml", java: "java", go: "go",
    rb: "ruby", php: "php", c: "c", cpp: "cpp", cs: "csharp", sh: "shell",
    rs: "rust", sql: "sql", xml: "xml", kt: "kotlin", swift: "swift",
  };
  return map[ext || ""] || "plaintext";
}

export default function CodeEditor({
  path,
  value,
  onChange,
  aiEnabled = true,
  readOnly = false,
}: {
  path: string;
  value: string;
  onChange: (val: string) => void;
  aiEnabled?: boolean;
  readOnly?: boolean;
}) {
  const providerRef = useRef<any>(null);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      // AI ghost-text suggestion (mirip Copilot) — muncul otomatis, tekan Tab untuk terima
      if (providerRef.current) providerRef.current.dispose();

      if (!aiEnabled) return;

      providerRef.current = monaco.languages.registerInlineCompletionsProvider(
        { pattern: "**" },
        {
          async provideInlineCompletions(model, position) {
            const codeBefore = model.getValueInRange({
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });
            const codeAfter = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: model.getLineCount(),
              endColumn: model.getLineMaxColumn(model.getLineCount()),
            });

            // jangan minta saran kalau baris kosong / baru ganti file (biar hemat kuota gratis)
            if (codeBefore.trim().length < 3) return { items: [] };

            try {
              const res = await fetch("/api/ai/suggest", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  filename: path,
                  language: langFromPath(path),
                  codeBefore,
                  codeAfter,
                }),
              });
              if (!res.ok) return { items: [] };
              const data = await res.json();
              if (!data.suggestion) return { items: [] };

              return {
                items: [
                  {
                    insertText: data.suggestion,
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    ),
                  },
                ],
              };
            } catch {
              return { items: [] };
            }
          },
          freeInlineCompletions() {},
        }
      );
    },
    [path, aiEnabled]
  );

  return (
    <div className="editor-wrapper w-full">
      <Editor
        key={path}
        path={path}
        defaultLanguage={langFromPath(path)}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          inlineSuggest: { enabled: true },
          tabSize: 2,
          padding: { top: 12 },
          readOnly,
        }}
      />
    </div>
  );
}
