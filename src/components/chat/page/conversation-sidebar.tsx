import { MessageSquarePlus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/chat/history";
import { formatConversationTime } from "@/lib/chat/history";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  isLoading: boolean;
  onCreateConversation: () => void;
  onSwitchConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  isLoading,
  onCreateConversation,
  onSwitchConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  return (
    <aside className="hidden w-80 shrink-0 border-r border-border bg-muted/20 lg:flex lg:flex-col">
      <div className="border-b border-border px-4 py-4">
        <Button
          type="button"
          onClick={onCreateConversation}
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
                : "border-border bg-background hover:bg-muted",
            )}
          >
            <button
              type="button"
              onClick={() => onSwitchConversation(conversation.id)}
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
                <DropdownMenuItem variant="destructive" onClick={() => onDeleteConversation(conversation.id)}>
                  Delete conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </aside>
  );
}
