import { mistral } from "@ai-sdk/mistral";
import { auth } from "@clerk/nextjs/server";
import { streamText, type CoreMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { createDataTools } from "./_lib/data-tools";
import { trimMessages } from "./_lib/history";
import { CHAT_SYSTEM_PROMPT } from "./_lib/system-prompt";
import { resolveAppUserId } from "./_lib/user";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await resolveAppUserId(userId);

    if (!appUserId) {
      return NextResponse.json(
        { error: "Unable to resolve user" },
        { status: 500 },
      );
    }

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json(
        { error: "MISTRAL_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { messages?: CoreMessage[] };
    const incomingMessages = Array.isArray(body.messages)
      ? (body.messages as CoreMessage[])
      : [];

    const result = streamText({
      model: mistral("mistral-large-latest"),
      system: CHAT_SYSTEM_PROMPT,
      messages: trimMessages(incomingMessages),
      tools: createDataTools(appUserId),
      maxSteps: 8,
      onFinish({ usage }) {
        if (!usage) {
          return;
        }

        console.log(
          `[Chat] tokens: prompt=${usage.promptTokens}, completion=${usage.completionTokens}, total=${usage.totalTokens}`,
        );
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage(error) {
        console.error("Chat stream failed:", error);
        return "AI response failed. Please try again.";
      },
    });
  } catch (error) {
    console.error("Chat route failed:", error);
    return NextResponse.json(
      { error: "Unable to process chat request right now" },
      { status: 500 },
    );
  }
}
