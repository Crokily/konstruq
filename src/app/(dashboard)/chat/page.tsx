"use client";

import { useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { AlertCircle, Loader2, Send, Trash2 } from "lucide-react";
import { MessageRenderer } from "@/components/chat/message-renderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const suggestionPrompts = [
  "What data do I have?",
  "Show project budget overview",
  "Compare planned vs actual costs",
  "Which projects are behind schedule?",
];

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append, error, setMessages } =
    useChat({
      api: "/api/chat",
    });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSuggestionClick = (suggestion: string) => {
    if (isLoading) {
      return;
    }

    void append({ role: "user", content: suggestion });
  };

  const isInputEmpty = input.trim().length === 0;

  return (
    <section className="h-[calc(100vh-4rem)]">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-medium text-foreground">Konstruq AI</p>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          {messages.length === 0 ? (
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
              {messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={cn("flex", isUser ? "justify-end" : "justify-start")}
                  >
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
                      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                      <span className="text-xs text-muted-foreground">Thinking...</span>
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
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        <div className="shrink-0 border-t border-border bg-card px-4 py-4 sm:px-6">
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
              disabled={isInputEmpty || isLoading}
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
    </section>
  );
}
