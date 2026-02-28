"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatRuntime } from "@/components/chat/chat-runtime-provider";
import { ChatComposer } from "@/components/chat/page/chat-composer";
import { ConversationSidebar } from "@/components/chat/page/conversation-sidebar";
import { ChatThread } from "@/components/chat/page/chat-thread";
import { useConversationManager } from "@/components/chat/page/use-conversation-manager";
import { SUGGESTION_PROMPTS } from "@/lib/chat/history";

const TOOL_STATUS_LABELS: Record<string, string> = {
  listDatasets: "Scanning datasets...",
  getDatasetSchema: "Reading schema...",
  queryDatasetRows: "Querying data...",
  searchDatasets: "Searching datasets...",
  aggregateColumn: "Calculating aggregates...",
};

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

  const visibleMessages =
    isLoading && messages.at(-1)?.role === "assistant"
      ? messages.filter((message) => message.id !== messages.at(-1)?.id)
      : messages;

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant") as
    | ({
        toolInvocations?: Array<{ toolName: string; state: "call" | "partial-call" | "result" }>;
      } & (typeof messages)[number])
    | undefined;
  const activeTool = lastAssistantMessage?.toolInvocations?.find(
    (tool) => tool.state === "call" || tool.state === "partial-call",
  );
  const loadingLabel = activeTool
    ? TOOL_STATUS_LABELS[activeTool.toolName] ?? "Working..."
    : "Generating...";

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
              loadingLabel={loadingLabel}
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
