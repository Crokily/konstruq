export const SUGGESTION_PROMPTS = [
  "What data do I have?",
  "Show project budget overview",
  "Compare planned vs actual costs",
  "Which projects are behind schedule?",
] as const;

export const CHAT_STORAGE_KEY = "konstruq-chat-history-v1";

export type ChatRole = "system" | "user" | "assistant" | "data";

export interface StoredMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
  projectId?: string;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultConversation(): Conversation {
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function toStoredMessages(messages: Array<{ id?: string; role: string; content: string }>): StoredMessage[] {
  return messages
    .filter((message) =>
      (message.role === "system" ||
        message.role === "user" ||
        message.role === "assistant" ||
        message.role === "data") &&
      typeof message.content === "string"
    )
    .map((message, index) => ({
      id: `${message.role}-${index}-${message.content}`,
      role: message.role as ChatRole,
      content: message.content,
    }));
}

export function areMessagesEqual(a: StoredMessage[], b: StoredMessage[]): boolean {
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

export function deriveConversationTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((message) => message.role === "user" && message.content.trim().length > 0);

  if (!firstUser) {
    return "New conversation";
  }

  const normalized = firstUser.content.replace(/\s+/g, " ").trim();
  return normalized.length > 36 ? `${normalized.slice(0, 36)}...` : normalized;
}

export function parseConversationHistory(raw: string | null): Conversation[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
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
          projectId:
            typeof candidate.projectId === "string" && candidate.projectId.length > 0
              ? candidate.projectId
              : undefined,
        };
      })
      .filter((item): item is Conversation => item !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export function formatConversationTime(value: string) {
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
