"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useChat } from "ai/react";

type ChatRuntimeValue = ReturnType<typeof useChat>;

const ChatRuntimeContext = createContext<ChatRuntimeValue | null>(null);

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const chat = useChat({
    api: "/api/chat",
    id: "konstruq-dashboard-chat",
    keepLastMessageOnError: true,
  });

  return <ChatRuntimeContext.Provider value={chat}>{children}</ChatRuntimeContext.Provider>;
}

export function useChatRuntime() {
  const context = useContext(ChatRuntimeContext);

  if (!context) {
    throw new Error("useChatRuntime must be used within ChatRuntimeProvider");
  }

  return context;
}
