import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import {
  MessageRenderer,
  type MessageWidgetAddRequest,
  type MessageWidgetAddState,
} from "@/components/chat/message-renderer";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: string;
  content: unknown;
}

interface ChatThreadProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | undefined;
  onRetry: () => void;
  suggestions: readonly string[];
  loadingLabel?: string;
  onSuggestionClick: (suggestion: string) => void;
  onAddWidget?: (widget: MessageWidgetAddRequest) => void | Promise<void>;
  getAddWidgetState?: (blockKey: string) => MessageWidgetAddState;
}

export function ChatThread({
  messages,
  isLoading,
  error,
  onRetry,
  suggestions,
  loadingLabel = "Generating...",
  onSuggestionClick,
  onAddWidget,
  getAddWidgetState,
}: ChatThreadProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Konstruq AI Assistant</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ask questions about your construction project data</p>
        <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestionClick(suggestion)}
              disabled={isLoading}
              className="rounded-lg border border-border bg-muted px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-amber-500/50 hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        {messages.map((message) => {
          const isUser = message.role === "user";

          return (
            <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
              <div className={cn("space-y-1", isUser ? "max-w-[80%]" : "max-w-[96%] xl:max-w-[90%]")}>
                <p className={cn("text-xs font-medium", isUser ? "text-right text-amber-500" : "text-muted-foreground")}>
                  {isUser ? "You" : "Konstruq AI"}
                </p>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed break-words",
                    isUser
                      ? "whitespace-pre-wrap bg-amber-500 text-amber-950"
                      : "overflow-hidden border border-border bg-muted text-foreground",
                  )}
                >
                  {isUser ? (
                    <>{message.content}</>
                  ) : (
                    <MessageRenderer
                      content={String(message.content)}
                      onAddWidget={onAddWidget}
                      getAddWidgetState={getAddWidgetState}
                    />
                  )}
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
                <span className="text-xs text-muted-foreground">{loadingLabel}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-5 flex justify-start">
          <div className="max-w-[90%] rounded-xl border border-rose-500/30 bg-rose-950/50 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div>
                <p className="text-sm text-rose-200">Something went wrong. Please try again.</p>
                {error.message ? <p className="mt-1 text-xs text-rose-400/70">{error.message}</p> : null}
                <button
                  type="button"
                  onClick={onRetry}
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
    </>
  );
}
