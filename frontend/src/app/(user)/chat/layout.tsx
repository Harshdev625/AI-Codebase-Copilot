'use client';

import React from 'react';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  // Chat layout is a simple pass-through
  // The UserLayout above handles AppShell with fullBleed variant for chat
  return children;
}

