"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import type { Message } from "ai";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AddToDashboardPicker } from "@/components/chat/add-to-dashboard-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChatRuntime } from "@/components/chat/chat-runtime-provider";
import { ChatComposer } from "@/components/chat/page/chat-composer";
import { ConversationSidebar } from "@/components/chat/page/conversation-sidebar";
import { ChatThread } from "@/components/chat/page/chat-thread";
import { useConversationManager } from "@/components/chat/page/use-conversation-manager";
import { SUGGESTION_PROMPTS } from "@/lib/chat/history";
import { useAddToDashboard } from "@/lib/chat/use-add-to-dashboard";
import { useChatProject } from "@/lib/chat/project-context";

interface ProjectOption {
  id: string;
  name: string;
}

const ALL_PROJECTS_VALUE = "__all_projects__";

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
  const projectId = useChatProject((state) => state.projectId);
  const setProjectId = useChatProject((state) => state.setProjectId);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);
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
  const {
    dashboards,
    dashboardsError,
    isDashboardsLoading,
    fetchDashboards,
    addToDashboard,
    getWidgetState,
  } = useAddToDashboard({
    projectId,
    resetKey: activeConversationId,
  });

  useEffect(() => {
    let isCancelled = false;

    async function loadProjects() {
      setIsProjectsLoading(true);

      try {
        const response = await fetch("/api/projects");
        const payload = (await response
          .json()
          .catch(() => null)) as Array<{ id?: unknown; name?: unknown }> | null;

        if (!response.ok || !Array.isArray(payload)) {
          return;
        }

        const options = payload
          .map((project): ProjectOption | null => {
            if (typeof project?.id !== "string" || typeof project?.name !== "string") {
              return null;
            }

            return {
              id: project.id,
              name: project.name,
            };
          })
          .filter((project): project is ProjectOption => project !== null);

        if (!isCancelled) {
          setProjects(options);
        }
      } catch {
        if (!isCancelled) {
          setProjects([]);
        }
      } finally {
        if (!isCancelled) {
          setIsProjectsLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      isCancelled = true;
    };
  }, []);

  function sanitizeStreamingAssistantContent(content: string): string {
    const completeBlocksRemoved = content.replace(/```(chart|table|kpi)\n[\s\S]*?```/g, "");
    const trailingBlockStart = completeBlocksRemoved.search(/```(chart|table|kpi)\n[\s\S]*$/);
    const safeText =
      trailingBlockStart >= 0
        ? completeBlocksRemoved.slice(0, trailingBlockStart)
        : completeBlocksRemoved;

    return safeText.trim();
  }

  const visibleMessages: Message[] = messages.map((message, index) => {
    const isStreamingAssistant =
      isLoading && index === messages.length - 1 && message.role === "assistant";

    if (!isStreamingAssistant || typeof message.content !== "string") {
      return message;
    }

    const sanitized = sanitizeStreamingAssistantContent(message.content);
    return { ...message, content: sanitized.length > 0 ? sanitized : "Generating..." };
  });

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
  const selectedProjectValue = projectId.length > 0 ? projectId : ALL_PROJECTS_VALUE;

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
          <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Konstruq AI</p>
              <p className="text-xs text-muted-foreground">{activeConversation?.title ?? "New conversation"}</p>
            </div>
            <div className="w-full sm:w-56">
              <Select
                value={selectedProjectValue}
                onValueChange={(value) => setProjectId(value === ALL_PROJECTS_VALUE ? "" : value)}
                disabled={isProjectsLoading}
              >
                <SelectTrigger size="sm" className="w-full bg-background">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROJECTS_VALUE}>All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex items-center gap-2">
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
              renderAddButton={(blockKey, widget) => (
                <AddToDashboardPicker
                  state={getWidgetState(blockKey)}
                  dashboards={dashboards}
                  dashboardsError={dashboardsError}
                  isDashboardsLoading={isDashboardsLoading}
                  onOpen={fetchDashboards}
                  onSelect={(dashboardId) => addToDashboard(widget, dashboardId)}
                  className={
                    widget.kind === "kpi"
                      ? "mt-3 h-8 w-full justify-center gap-1.5 px-2.5 text-xs"
                      : undefined
                  }
                />
              )}
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
