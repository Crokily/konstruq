"use client";

import { useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChartFromSpec } from "@/components/chat/chart-from-spec";
import type { ChartSpec, ChartSpecMetric } from "@/components/chat/chart-from-spec";

interface MessageRendererProps {
  content: string;
}

type BlockType = "chart" | "table" | "kpi";

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

function FallbackCodeBlock({ content }: { content: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs leading-relaxed text-slate-200">
      {content}
    </pre>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="text-sm leading-relaxed text-slate-100">{children}</p>,
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
  strong: ({ children }) => <strong className="font-semibold text-slate-50">{children}</strong>,
  em: ({ children }) => <em className="text-slate-200">{children}</em>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-slate-100">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-slate-100">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => <h1 className="text-xl font-semibold text-slate-100">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold text-slate-100">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-slate-100">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-slate-600 pl-3 italic text-slate-300">{children}</blockquote>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs text-slate-100">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isBlock = typeof className === "string" && className.length > 0;

    if (isBlock) {
      return <code className={className}>{children}</code>;
    }

    return (
      <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-[0.85em] text-slate-100">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-slate-700 text-left text-sm text-slate-100">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-800/70">{children}</thead>,
  th: ({ children }) => <th className="border border-slate-700 px-2 py-1.5 font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-slate-700 px-2 py-1.5 text-slate-200">{children}</td>,
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
              className="overflow-hidden rounded-xl border border-slate-700/90 bg-slate-900/50 p-3"
            >
              <ChartFromSpec spec={parsedSpec} />
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
