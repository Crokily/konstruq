import type { CoreMessage } from "ai";

const MAX_HISTORY_MESSAGES = 30;

export function trimMessages(messages: CoreMessage[]): CoreMessage[] {
  const trimmed =
    messages.length > MAX_HISTORY_MESSAGES
      ? messages.slice(-MAX_HISTORY_MESSAGES)
      : [...messages];
  const firstUserIndex = trimmed.findIndex((message) => message.role === "user");
  return firstUserIndex > 0 ? trimmed.slice(firstUserIndex) : trimmed;
}
