import { mistral } from "@ai-sdk/mistral";
import { streamText } from "ai";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `You are Konstruq AI, a construction data analysis assistant.
You help construction professionals analyze project data including costs, schedules, earned value metrics, and financial performance.
You can produce charts, tables, and KPI summaries when asked.
Be concise and data-driven in your responses.`;

export async function POST(request: NextRequest) {
  const { messages } = await request.json();

  const result = streamText({
    model: mistral("mistral-large-latest"),
    system: SYSTEM_PROMPT,
    messages,
  });

  return result.toDataStreamResponse();
}
