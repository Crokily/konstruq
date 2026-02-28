import type { CoreMessage } from "ai";

const MAX_MESSAGE_COUNT = 16;
const MAX_MESSAGES_TOKENS = 22_000;
const MAX_SINGLE_MESSAGE_CHARS = 6_000;

function estimateTextTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function compactMessageContent(raw: string): string {
  const trimmed = raw.trim();

  if (trimmed.length <= MAX_SINGLE_MESSAGE_CHARS) {
    return trimmed;
  }

  const chartBlockMatches = [...trimmed.matchAll(/```chart[\s\S]*?```/g)];
  if (chartBlockMatches.length > 0) {
    const latestChartBlock = chartBlockMatches[chartBlockMatches.length - 1]?.[0] ?? "";
    const prefix = trimmed.slice(0, Math.min(1_500, trimmed.length));
    return `${prefix}\n\n[older content truncated for token budget]\n\n${latestChartBlock}`.slice(
      0,
      MAX_SINGLE_MESSAGE_CHARS,
    );
  }

  return `${trimmed.slice(0, MAX_SINGLE_MESSAGE_CHARS)}\n\n[content truncated for token budget]`;
}

function normalizeMessageContent(content: CoreMessage["content"]): string | null {
  if (typeof content === "string") {
    return compactMessageContent(content);
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          part.type === "text" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .join("\n")
      .trim();

    return text.length > 0 ? compactMessageContent(text) : null;
  }

  return null;
}

export function budgetMessages(messages: CoreMessage[]): CoreMessage[] {
  if (messages.length === 0) {
    return [];
  }

  const recent = messages.slice(-MAX_MESSAGE_COUNT);
  const budgeted: CoreMessage[] = [];
  let usedTokens = 0;

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];

    if (message.role !== "system" && message.role !== "user" && message.role !== "assistant") {
      continue;
    }

    const normalizedContent = normalizeMessageContent(message.content);
    if (!normalizedContent) {
      continue;
    }

    const estimated = estimateTextTokens(normalizedContent);
    if (usedTokens + estimated > MAX_MESSAGES_TOKENS) {
      continue;
    }

    usedTokens += estimated;
    budgeted.push({ role: message.role, content: normalizedContent });
  }

  return budgeted.reverse();
}

export function latestUserTextMessage(messages: CoreMessage[]): string | undefined {
  const userMessages = messages.filter((message) => message.role === "user");
  const last = userMessages[userMessages.length - 1];

  if (!last) {
    return undefined;
  }

  if (typeof last.content === "string") {
    return last.content;
  }

  if (Array.isArray(last.content)) {
    const textParts = last.content
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          part.type === "text" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      })
      .filter((text) => text.length > 0);

    return textParts.length > 0 ? textParts.join("\n") : undefined;
  }

  return undefined;
}
