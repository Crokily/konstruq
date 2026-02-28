import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "ai";
import type { Conversation } from "@/lib/chat/history";
import {
  areMessagesEqual,
  CHAT_STORAGE_KEY,
  defaultConversation,
  deriveConversationTitle,
  parseConversationHistory,
  toStoredMessages,
} from "@/lib/chat/history";

interface UseConversationManagerParams {
  messages: Message[];
  isLoading: boolean;
  setMessages: (messages: Message[] | ((messages: Message[]) => Message[])) => void;
}

export function useConversationManager({ messages, isLoading, setMessages }: UseConversationManagerParams) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [isReady, setIsReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;
    const stored = parseConversationHistory(localStorage.getItem(CHAT_STORAGE_KEY));
    const initial = stored[0] ?? defaultConversation();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations(stored.length > 0 ? stored : [initial]);
    setActiveConversationId(initial.id);

    if (messages.length === 0) {
      setMessages(stored.length > 0 ? initial.messages : []);
    }

    setIsReady(true);
  }, [messages.length, setMessages]);

  useEffect(() => {
    if (isReady) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations, isReady]);

  useEffect(() => {
    if (!isReady || !activeConversationId) {
      return;
    }

    const nextMessages = toStoredMessages(messages);
    const nextTitle = deriveConversationTitle(nextMessages);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations((prev) => {
      const index = prev.findIndex((conversation) => conversation.id === activeConversationId);
      if (index < 0) {
        return prev;
      }

      const current = prev[index];
      if (current.messages.length > 0 && nextMessages.length === 0) {
        return prev;
      }

      if (areMessagesEqual(current.messages, nextMessages) && current.title === nextTitle) {
        return prev;
      }

      const updated = [...prev];
      updated[index] = { ...current, messages: nextMessages, title: nextTitle, updatedAt: new Date().toISOString() };
      return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  }, [activeConversationId, isReady, messages]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" });
    }
  }, [messages, isLoading]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 120;
  };

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
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

      if (conversationId === activeConversationId) {
        setActiveConversationId(remaining[0].id);
        setMessages(remaining[0].messages);
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
          ? { ...conversation, title: "New conversation", messages: [], updatedAt: new Date().toISOString() }
          : conversation,
      ),
    );
  };

  return {
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
  };
}
