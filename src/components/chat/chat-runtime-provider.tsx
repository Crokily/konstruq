"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useChat } from "ai/react";
import { useChatProject } from "@/lib/chat/project-context";

type ChatRuntimeValue = ReturnType<typeof useChat>;

const ChatRuntimeContext = createContext<ChatRuntimeValue | null>(null);

interface ChatRuntimeProviderProps {
  children: ReactNode;
  projectId?: string;
}

export function ChatRuntimeProvider({ children, projectId: projectIdProp }: ChatRuntimeProviderProps) {
  const selectedProjectId = useChatProject((state) => state.projectId);
  const projectId = projectIdProp ?? selectedProjectId;

  const chat = useChat({
    api: "/api/chat",
    id: "konstruq-dashboard-chat",
    keepLastMessageOnError: true,
    body: projectId ? { projectId } : undefined,
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
