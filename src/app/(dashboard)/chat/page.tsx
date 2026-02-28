"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import type { Message } from "ai";
import { Button } from "@/components/ui/button";
import { useChatRuntime } from "@/components/chat/chat-runtime-provider";
import { ChatComposer } from "@/components/chat/page/chat-composer";
import { ConversationSidebar } from "@/components/chat/page/conversation-sidebar";
import { ChatThread } from "@/components/chat/page/chat-thread";
import { useConversationManager } from "@/components/chat/page/use-conversation-manager";
import { SUGGESTION_PROMPTS } from "@/lib/chat/history";

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append, error, reload, setMessages } =
    useChatRuntime();
  const {
    activeConversation,
    activeConversationId,
    clearCurrentConversation,
    conversations,
    createConversation,
    deleteConversation,
    handleScroll,
    isReady,
    messagesEndRef,
    scrollContainerRef,
    switchConversation,
  } = useConversationManager({ messages, isLoading, setMessages });

  function sanitizeStreamingAssistantContent(content: string): string {
    const completeBlocksRemoved = content.replace(/```(chart|table|kpi)\n[\s\S]*?```/g, "");
    const trailingBlockStart = completeBlocksRemoved.search(/```(chart|table|kpi)\n[\s\S]*$/);
    const safeText =
      trailingBlockStart >= 0
        ? completeBlocksRemoved.slice(0, trailingBlockStart)
        : completeBlocksRemoved;

    return safeText.trim();
  }

  const visibleMessages: Message[] = messages.map((message, index) => {
    const isStreamingAssistant =
      isLoading && index === messages.length - 1 && message.role === "assistant";

    if (!isStreamingAssistant || typeof message.content !== "string") {
      return message;
    }

    const sanitized = sanitizeStreamingAssistantContent(message.content);
    return { ...message, content: sanitized.length > 0 ? sanitized : "Generating..." };
  });

  return (
    <section className="h-[calc(100vh-9.5rem)] min-h-[560px]">
      <div className="flex h-full overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm">
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          isLoading={isLoading}
          onCreateConversation={createConversation}
          onSwitchConversation={switchConversation}
          onDeleteConversation={deleteConversation}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Konstruq AI</p>
              <p className="text-xs text-muted-foreground">{activeConversation?.title ?? "New conversation"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={createConversation} disabled={isLoading} className="lg:hidden">
                <MessageSquarePlus className="h-3.5 w-3.5" />
                New
              </Button>
              {messages.length > 0 ? (
                <button
                  type="button"
                  onClick={clearCurrentConversation}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
            <ChatThread
              messages={visibleMessages}
              isLoading={isLoading}
              error={error ?? undefined}
              onRetry={() => void reload()}
              suggestions={SUGGESTION_PROMPTS}
              onSuggestionClick={(suggestion) => void append({ role: "user", content: suggestion })}
            />
            <div ref={messagesEndRef} />
          </div>

          <ChatComposer
            input={input}
            isLoading={isLoading}
            isReady={isReady}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </section>
  );
}
