"use client";

import { useMemo } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChartBlock } from "@/components/chat/chart-block";
import { Button } from "@/components/ui/button";
import type { NormalizeChartSpecResult } from "@/lib/charting/spec";
import { normalizeChartSpec } from "@/lib/charting/spec";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MessageRendererProps {
  content: string;
  onAddWidget?: (widget: MessageWidgetAddRequest) => void | Promise<void>;
  getAddWidgetState?: (blockKey: string) => MessageWidgetAddState;
}

type BlockType = "chart" | "table" | "kpi";

interface TableSpec {
  headers: string[];
  rows: string[][];
}

export interface MessageKpiItem {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  description?: string;
}

interface KpiSpec {
  items: MessageKpiItem[];
}

export type MessageWidgetAddState = "idle" | "loading" | "success" | "added";

export interface MessageChartAddRequest {
  kind: "chart";
  blockKey: string;
  title: string;
  spec: NormalizeChartSpecResult["spec"];
}

export interface MessageKpiAddRequest {
  kind: "kpi";
  blockKey: string;
  title: string;
  item: MessageKpiItem;
}

export type MessageWidgetAddRequest = MessageChartAddRequest | MessageKpiAddRequest;

type MessageSegment =
  | { kind: "text"; content: string; key: string }
  | { kind: "block"; blockType: BlockType; content: string; key: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const codeBlockRegex = /```(chart|table|kpi)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        kind: "text",
        content: content.slice(lastIndex, match.index),
        key: `text-${lastIndex}`,
      });
    }

    const blockType = match[1] as BlockType;
    const blockContent = match[2] ?? "";

    segments.push({
      kind: "block",
      blockType,
      content: blockContent.trim(),
      key: `block-${match.index}`,
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({
      kind: "text",
      content: content.slice(lastIndex),
      key: `text-${lastIndex}`,
    });
  }

  return segments;
}

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseChartSpec(raw: string): NormalizeChartSpecResult | null {
  return normalizeChartSpec(parseJson(raw));
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function isStringMatrix(value: unknown): value is string[][] {
  return (
    Array.isArray(value) &&
    value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"))
  );
}

function parseTableSpec(raw: string): TableSpec | null {
  const parsed = parseJson(raw);

  if (!isRecord(parsed) || !isNonEmptyStringArray(parsed.headers) || !isStringMatrix(parsed.rows)) {
    return null;
  }

  return {
    headers: parsed.headers,
    rows: parsed.rows,
  };
}

function isKpiTrend(value: unknown): value is "up" | "down" | "neutral" {
  return value === "up" || value === "down" || value === "neutral";
}

function parseKpiSpec(raw: string): KpiSpec | null {
  const parsed = parseJson(raw);

  if (!isRecord(parsed) || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    return null;
  }

  const items: KpiSpec["items"] = [];

  for (const item of parsed.items) {
    if (
      !isRecord(item) ||
      typeof item.label !== "string" ||
      item.label.trim().length === 0 ||
      typeof item.value !== "string" ||
      item.value.trim().length === 0
    ) {
      return null;
    }

    items.push({
      label: item.label,
      value: item.value,
      trend: isKpiTrend(item.trend) ? item.trend : undefined,
      description: typeof item.description === "string" ? item.description : undefined,
    });
  }

  if (items.length === 0) {
    return null;
  }

  return { items };
}

function getKpiTrendInfo(trend: MessageKpiItem["trend"]) {
  if (trend === "up") {
    return { symbol: "▲", className: "text-emerald-400" };
  }

  if (trend === "down") {
    return { symbol: "▼", className: "text-rose-400" };
  }

  return { symbol: "—", className: "text-muted-foreground" };
}

function hashContent(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function getAddWidgetBlockKey(
  blockType: "chart" | "kpi",
  content: string,
  itemIndex?: number,
): string {
  return `${blockType}-${hashContent(
    `${blockType}:${itemIndex ?? 0}:${content.trim()}`,
  )}`;
}

function AddToDashboardButton({
  onClick,
  state,
  className,
}: {
  onClick: () => void;
  state: MessageWidgetAddState;
  className?: string;
}) {
  if (state === "loading") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
        className={className ?? "h-8 gap-1.5 px-2.5 text-xs"}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Adding...
      </Button>
    );
  }

  if (state === "success") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
        className={className ?? "h-8 gap-1.5 px-2.5 text-xs"}
      >
        <Check className="h-3.5 w-3.5" />
        Added
      </Button>
    );
  }

  if (state === "added") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
        className={className ?? "h-8 gap-1.5 px-2.5 text-xs"}
      >
        Added ✓
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      className={className ?? "h-8 gap-1.5 px-2.5 text-xs"}
    >
      <Plus className="h-3.5 w-3.5" />
      Add to Dashboard
    </Button>
  );
}

function FallbackCodeBlock({ content }: { content: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">
      {content}
    </pre>
  );
}

function InvalidChartBlock() {
  return (
    <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-700 dark:text-amber-300">
      Chart hidden: missing or invalid source references. Ask again and require source-linked chart output.
    </div>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="text-sm leading-relaxed text-foreground">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-amber-400 underline decoration-amber-400/50 underline-offset-2 transition-colors hover:text-amber-300"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="text-foreground">{children}</em>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-foreground">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => <h1 className="text-xl font-semibold text-foreground">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-foreground">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground">{children}</blockquote>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isBlock = typeof className === "string" && className.length > 0;

    if (isBlock) {
      return <code className={className}>{children}</code>;
    }

    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-border text-left text-sm text-foreground">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  th: ({ children }) => <th className="border border-border px-2 py-1.5 font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1.5 text-foreground">{children}</td>,
};

export function MessageRenderer({
  content,
  onAddWidget,
  getAddWidgetState,
}: MessageRendererProps) {
  const segments = useMemo(() => parseSegments(content), [content]);

  return (
    <div className="space-y-3">
      {segments.map((segment) => {
        if (segment.kind === "text") {
          if (segment.content.trim().length === 0) {
            return null;
          }

          return (
            <div key={segment.key} className="space-y-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {segment.content}
              </ReactMarkdown>
            </div>
          );
        }

        if (segment.blockType === "chart") {
          const parsedSpecResult = parseChartSpec(segment.content);

          if (!parsedSpecResult) {
            return <InvalidChartBlock key={segment.key} />;
          }

          const blockKey = getAddWidgetBlockKey("chart", segment.content);
          const addWidgetState = getAddWidgetState?.(blockKey) ?? "idle";

          return (
            <ChartBlock
              key={segment.key}
              result={parsedSpecResult}
              headerActions={
                onAddWidget ? (
                  <AddToDashboardButton
                    state={addWidgetState}
                    onClick={() =>
                      void onAddWidget({
                        kind: "chart",
                        blockKey,
                        title: parsedSpecResult.spec.title,
                        spec: parsedSpecResult.spec,
                      })
                    }
                  />
                ) : null
              }
            />
          );
        }

        if (segment.blockType === "table") {
          const parsedSpec = parseTableSpec(segment.content);

          if (!parsedSpec) {
            return <FallbackCodeBlock key={segment.key} content={segment.content} />;
          }

          return (
            <div key={segment.key} className="overflow-x-auto rounded-lg border border-border">
              <Table className="min-w-full">
                <TableHeader className="bg-muted [&_tr]:border-b-border">
                  <TableRow className="border-border hover:bg-transparent">
                    {parsedSpec.headers.map((header, headerIndex) => (
                      <TableHead
                        key={`${segment.key}-header-${headerIndex}`}
                        className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground"
                      >
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedSpec.rows.map((row, rowIndex) => (
                    <TableRow key={`${segment.key}-row-${rowIndex}`} className="border-border hover:bg-muted/60">
                      {row.map((cell, cellIndex) => (
                        <TableCell
                          key={`${segment.key}-cell-${rowIndex}-${cellIndex}`}
                          className="px-3 py-2 text-sm text-foreground"
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        }

        if (segment.blockType === "kpi") {
          const parsedSpec = parseKpiSpec(segment.content);

          if (!parsedSpec) {
            return <FallbackCodeBlock key={segment.key} content={segment.content} />;
          }

          return (
            <div key={segment.key} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {parsedSpec.items.map((item, itemIndex) => {
                const trendInfo = getKpiTrendInfo(item.trend);
                const blockKey = getAddWidgetBlockKey("kpi", segment.content, itemIndex);
                const addWidgetState = getAddWidgetState?.(blockKey) ?? "idle";

                return (
                  <div
                    key={`${segment.key}-kpi-${itemIndex}`}
                    className="rounded-lg border border-border bg-muted px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                        <p className="text-lg font-semibold text-foreground">{item.value}</p>
                      </div>
                      <span className={`pt-0.5 text-sm ${trendInfo.className}`} aria-hidden>
                        {trendInfo.symbol}
                      </span>
                    </div>
                    {item.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    ) : null}
                    {onAddWidget ? (
                      <AddToDashboardButton
                        state={addWidgetState}
                        onClick={() =>
                          void onAddWidget({
                            kind: "kpi",
                            blockKey,
                            title: item.label,
                            item,
                          })
                        }
                        className="mt-3 h-8 w-full justify-center gap-1.5 px-2.5 text-xs"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        }

        const parsedBlock = parseJson(segment.content);
        const formattedContent =
          parsedBlock === null ? segment.content : JSON.stringify(parsedBlock, null, 2) ?? segment.content;

        return <FallbackCodeBlock key={segment.key} content={formattedContent} />;
      })}
    </div>
  );
}
