"use client";

import { useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChartFromSpec } from "@/components/chat/chart-from-spec";
import type { ChartSpec, ChartSpecMetric } from "@/components/chat/chart-from-spec";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MessageRendererProps {
  content: string;
}

type BlockType = "chart" | "table" | "kpi";

interface TableSpec {
  headers: string[];
  rows: string[][];
}

interface KpiItem {
  label: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  description?: string;
}

interface KpiSpec {
  items: KpiItem[];
}

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

function parseChartSpec(raw: string): ChartSpec | null {
  const parsed = parseJson(raw);

  if (!isRecord(parsed)) {
    return null;
  }

  const rawMetrics = Array.isArray(parsed.metrics) ? parsed.metrics : [];
  const metrics = rawMetrics
    .map((metric): ChartSpecMetric | null => {
      if (!isRecord(metric) || typeof metric.key !== "string" || metric.key.trim().length === 0) {
        return null;
      }

      return {
        key: metric.key,
        label: typeof metric.label === "string" && metric.label.trim().length > 0 ? metric.label : metric.key,
        color: typeof metric.color === "string" ? metric.color : undefined,
      };
    })
    .filter((metric): metric is ChartSpecMetric => metric !== null);

  const data = Array.isArray(parsed.data)
    ? parsed.data.filter((row): row is Record<string, unknown> => isRecord(row))
    : [];

  return {
    type: typeof parsed.type === "string" ? (parsed.type as ChartSpec["type"]) : "bar",
    title: typeof parsed.title === "string" ? parsed.title : "Chart",
    xAxisKey: typeof parsed.xAxisKey === "string" ? parsed.xAxisKey : "name",
    metrics,
    data,
  };
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

function getKpiTrendInfo(trend: KpiItem["trend"]) {
  if (trend === "up") {
    return { symbol: "▲", className: "text-emerald-400" };
  }

  if (trend === "down") {
    return { symbol: "▼", className: "text-rose-400" };
  }

  return { symbol: "—", className: "text-muted-foreground" };
}

function FallbackCodeBlock({ content }: { content: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">
      {content}
    </pre>
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

export function MessageRenderer({ content }: MessageRendererProps) {
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
          const parsedSpec = parseChartSpec(segment.content);

          if (!parsedSpec) {
            return <FallbackCodeBlock key={segment.key} content={segment.content} />;
          }

          return (
            <div
              key={segment.key}
              className="overflow-hidden rounded-xl border border-border bg-muted/30 p-3"
            >
              <ChartFromSpec spec={parsedSpec} />
            </div>
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
