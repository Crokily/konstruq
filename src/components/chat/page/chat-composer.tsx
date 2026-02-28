import type { ChangeEvent, FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatComposerProps {
  input: string;
  isLoading: boolean;
  isReady: boolean;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ChatComposer({
  input,
  isLoading,
  isReady,
  onInputChange,
  onSubmit,
}: ChatComposerProps) {
  const isInputEmpty = input.trim().length === 0;

  return (
    <div className="shrink-0 border-t border-border/70 bg-card px-4 py-4 sm:px-6">
      <form onSubmit={onSubmit} className="flex items-center gap-3">
        <input
          name="prompt"
          value={input}
          onChange={onInputChange}
          placeholder="Ask about your construction data..."
          className="h-11 flex-1 rounded-lg border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-amber-500"
        />
        <Button
          type="submit"
          disabled={isInputEmpty || isLoading || !isReady}
          className="h-11 bg-amber-500 px-4 text-amber-950 hover:bg-amber-400"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </Button>
      </form>
    </div>
  );
}
