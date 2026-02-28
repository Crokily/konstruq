"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { MessageRenderer } from "@/components/chat/message-renderer";
import { useChatRuntime } from "@/components/chat/chat-runtime-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const suggestionPrompts = [
  "What data do I have?",
  "Show project budget overview",
  "Compare planned vs actual costs",
  "Which projects are behind schedule?",
];

const STORAGE_KEY = "konstruq-chat-history-v1";

type ChatRole = "system" | "user" | "assistant" | "data";

interface StoredMessage {
  id: string;
  role: ChatRole;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultConversation(): Conversation {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function toStoredMessages(messages: Array<{ id?: string; role: string; content: string }>): StoredMessage[] {
  return messages
    .filter((message) =>
      (message.role === "system" ||
        message.role === "user" ||
        message.role === "assistant" ||
        message.role === "data") &&
      typeof message.content === "string"
    )
    .map((message, index) => ({
      // Use deterministic ids so history sync doesn't loop if upstream message ids are unstable.
      id: `${message.role}-${index}-${message.content}`,
      role: message.role as ChatRole,
      content: message.content,
    }));
}

function areMessagesEqual(a: StoredMessage[], b: StoredMessage[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i].role !== b[i].role || a[i].content !== b[i].content) {
      return false;
    }
  }

  return true;
}

function deriveTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user" && message.content.trim().length > 0);

  if (!firstUser) {
    return "New conversation";
  }

  const normalized = firstUser.content.replace(/\s+/g, " ").trim();
  return normalized.length > 36 ? `${normalized.slice(0, 36)}...` : normalized;
}

function parseConversationHistory(raw: string | null): Conversation[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    const conversations = parsed
      .map((item): Conversation | null => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const candidate = item as Partial<Conversation>;
        if (
          typeof candidate.id !== "string" ||
          typeof candidate.title !== "string" ||
          typeof candidate.createdAt !== "string" ||
          typeof candidate.updatedAt !== "string" ||
          !Array.isArray(candidate.messages)
        ) {
          return null;
        }

        return {
          id: candidate.id,
          title: candidate.title,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
          messages: toStoredMessages(candidate.messages as Array<{ id?: string; role: string; content: string }>),
        };
      })
      .filter((item): item is Conversation => item !== null);

    return conversations.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

function formatConversationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Now";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function ChatPage() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    append,
    error,
    reload,
    setMessages,
  } = useChatRuntime();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [isReady, setIsReady] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const stored = parseConversationHistory(localStorage.getItem(STORAGE_KEY));

    if (stored.length === 0) {
      const initial = defaultConversation();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConversations([initial]);
      setActiveConversationId(initial.id);
      if (!isLoading && messages.length === 0) {
        setMessages([]);
      }
    } else {
      const initial = stored[0];
      setConversations(stored);
      setActiveConversationId(initial.id);
      if (!isLoading && messages.length === 0) {
        setMessages(initial.messages);
      }
    }

    setIsReady(true);
  }, [isLoading, messages.length, setMessages]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations, isReady]);

  useEffect(() => {
    if (!isReady || !activeConversationId) {
      return;
    }

    const nextMessages = toStoredMessages(messages);
    const nextTitle = deriveTitle(nextMessages);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations((prev) => {
      const index = prev.findIndex((conversation) => conversation.id === activeConversationId);
      if (index < 0) {
        return prev;
      }

      const current = prev[index];

      if (current.messages.length > 0 && nextMessages.length === 0) {
        // Prevent hydration race from overwriting stored history with an empty in-memory array.
        return prev;
      }

      const sameMessages = areMessagesEqual(current.messages, nextMessages);
      const sameTitle = current.title === nextTitle;

      if (sameMessages && sameTitle) {
        return prev;
      }

      const updated = [...prev];
      updated[index] = {
        ...current,
        messages: nextMessages,
        title: nextTitle,
        updatedAt: new Date().toISOString(),
      };

      return updated.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }, [activeConversationId, isReady, messages]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" });
  }, [messages, isLoading]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 120;
  };

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  const createConversation = () => {
    if (isLoading) {
      return;
    }

    const conversation = defaultConversation();
    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(conversation.id);
    setMessages([]);
  };

  const switchConversation = (conversationId: string) => {
    if (conversationId === activeConversationId) {
      return;
    }

    const target = conversations.find((conversation) => conversation.id === conversationId);
    if (!target) {
      return;
    }

    setActiveConversationId(conversationId);
    setMessages(target.messages);
  };

  const deleteConversation = (conversationId: string) => {
    setConversations((prev) => {
      const remaining = prev.filter((conversation) => conversation.id !== conversationId);

      if (remaining.length === 0) {
        const initial = defaultConversation();
        setActiveConversationId(initial.id);
        setMessages([]);
        return [initial];
      }

      const nextActive = remaining[0];
      if (conversationId === activeConversationId) {
        setActiveConversationId(nextActive.id);
        setMessages(nextActive.messages);
      }

      return remaining;
    });

  };

  const clearCurrentConversation = () => {
    if (!activeConversationId) {
      return;
    }

    setMessages([]);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              title: "New conversation",
              messages: [],
              updatedAt: new Date().toISOString(),
            }
          : conversation
      )
    );
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isLoading) {
      return;
    }

    void append({ role: "user", content: suggestion });
  };

  const isInputEmpty = input.trim().length === 0;
  const streamingAssistantMessageId =
    isLoading && messages.length > 0 && messages[messages.length - 1].role === "assistant"
      ? messages[messages.length - 1].id
      : null;
  const visibleMessages = streamingAssistantMessageId
    ? messages.filter((message) => message.id !== streamingAssistantMessageId)
    : messages;

  return (
    <section className="h-[calc(100vh-9.5rem)] min-h-[560px]">
      <div className="flex h-full overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm">
        <aside className="hidden w-80 shrink-0 border-r border-border bg-muted/20 lg:flex lg:flex-col">
          <div className="border-b border-border px-4 py-4">
            <Button
              type="button"
              onClick={createConversation}
              disabled={isLoading}
              className="h-10 w-full bg-amber-500 text-amber-950 hover:bg-amber-400"
            >
              <MessageSquarePlus className="h-4 w-4" />
              New conversation
            </Button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border px-2 py-2 text-left transition",
                  conversation.id === activeConversationId
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-border bg-background hover:bg-muted"
                )}
              >
                <button
                  type="button"
                  onClick={() => switchConversation(conversation.id)}
                  className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left"
                >
                  <p className="truncate text-sm font-medium text-foreground">{conversation.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatConversationTime(conversation.updatedAt)} · {conversation.messages.length} messages
                  </p>
                </button>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Conversation menu"
                      className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => deleteConversation(conversation.id)}
                    >
                      Delete conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Konstruq AI</p>
              <p className="text-xs text-muted-foreground">
                {activeConversation ? activeConversation.title : "New conversation"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={createConversation}
                disabled={isLoading}
                className="lg:hidden"
              >
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

          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-5 py-6 sm:px-6"
          >
            {visibleMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Konstruq AI Assistant
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ask questions about your construction project data
                </p>

                <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                  {suggestionPrompts.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-muted px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-amber-500/50 hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {visibleMessages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                      <div className={cn("space-y-1", isUser ? "max-w-[80%]" : "max-w-[90%]")}>
                        <p
                          className={cn(
                            "text-xs font-medium",
                            isUser ? "text-right text-amber-500" : "text-muted-foreground"
                          )}
                        >
                          {isUser ? "You" : "Konstruq AI"}
                        </p>
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-3 text-sm leading-relaxed break-words",
                            isUser
                              ? "whitespace-pre-wrap bg-amber-500 text-amber-950"
                              : "overflow-hidden border border-border bg-muted text-foreground"
                          )}
                        >
                          {isUser ? <>{message.content}</> : <MessageRenderer content={message.content} />}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isLoading ? (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Konstruq AI</p>
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                        <span className="text-xs text-muted-foreground">Generating...</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {error ? (
              <div className="mt-5 flex justify-start">
                <div className="max-w-[90%] rounded-xl border border-rose-500/30 bg-rose-950/50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    <div>
                      <p className="text-sm text-rose-200">Something went wrong. Please try again.</p>
                      {error.message ? (
                        <p className="mt-1 text-xs text-rose-400/70">{error.message}</p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void reload()}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-rose-300/30 px-2.5 py-1.5 text-xs text-rose-100 transition hover:bg-rose-500/20"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Retry
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 border-t border-border/70 bg-card px-4 py-4 sm:px-6">
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <input
                name="prompt"
                value={input}
                onChange={handleInputChange}
                placeholder="Ask about your construction data..."
                className="h-11 flex-1 rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-amber-500"
              />
              <Button
                type="submit"
                disabled={isInputEmpty || isLoading || !isReady}
                className="h-11 bg-amber-500 px-4 text-amber-950 hover:bg-amber-400"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
