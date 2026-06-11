'use client';

import React, { useRef, useEffect } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useTheme } from 'next-themes';

interface MonacoViewerProps {
  content: string;
  language?: string;
  filePath?: string;
  readOnly?: boolean;
  initialLine?: number;
}

export function MonacoViewer({ content, language, filePath, readOnly = true, initialLine }: MonacoViewerProps) {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<any>(null);
  
  const getLanguage = () => {
    if (language) return language;
    if (!filePath) return 'plaintext';
    
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'json':
        return 'json';
      case 'py':
        return 'python';
      case 'md':
        return 'markdown';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      default:
        return 'plaintext';
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    if (initialLine) {
      setTimeout(() => {
        editor.revealLineInCenter(initialLine);
        editor.setPosition({ lineNumber: initialLine, column: 1 });
        // Optional: Add highlight decorator
        editor.deltaDecorations([], [
          {
            range: new monaco.Range(initialLine, 1, initialLine, 1),
            options: {
              isWholeLine: true,
              className: 'bg-primary/20',
              linesDecorationsClassName: 'bg-primary/50 w-1 ml-1'
            }
          }
        ]);
      }, 100);
    }
  };

  useEffect(() => {
    if (editorRef.current && initialLine) {
      editorRef.current.revealLineInCenter(initialLine);
      editorRef.current.setPosition({ lineNumber: initialLine, column: 1 });
    }
  }, [initialLine, filePath]);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        width="100%"
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
        language={getLanguage()}
        path={filePath}
        value={content}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 16 },
        }}
      />
    </div>
  );
}
