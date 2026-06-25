'use client';

import React from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useTheme } from 'next-themes';

interface MonacoDiffViewerProps {
  originalContent: string;
  modifiedContent: string;
  language?: string;
  filePath?: string;
}

export function MonacoDiffViewer({ originalContent, modifiedContent, language, filePath }: MonacoDiffViewerProps) {
  const { resolvedTheme } = useTheme();

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

  return (
    <div className="h-full w-full">
      <DiffEditor
        height="100%"
        width="100%"
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
        language={getLanguage()}
        original={originalContent}
        modified={modifiedContent}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          renderSideBySide: true,
          ignoreTrimWhitespace: false,
        }}
      />
    </div>
  );
}
