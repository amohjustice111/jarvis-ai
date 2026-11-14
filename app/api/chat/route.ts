import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "JARVIS is not configured yet. Add ANTHROPIC_API_KEY in your hosting environment." }, { status: 503 });
    }

    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const safeMessages = messages
      .filter((item: { role?: string; content?: string }) =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" && item.content.trim().length > 0
      )
      .slice(-20)
      .map((item: { role: "user" | "assistant"; content: string }) => ({
        role: item.role,
        content: item.content.slice(0, 12000)
      }));

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Send a message to begin." }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: "You are J.A.R.V.I.S., a capable, warm, precise personal AI assistant inspired by a futuristic cinematic assistant. Address the user respectfully. Be clear, useful, and honest about limitations. Ask before taking actions that affect files, accounts, devices, or other people. Never claim to have performed an action you have not performed.",
      messages: safeMessages
    });

    const answer = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("JARVIS chat error:", error);
    return NextResponse.json({ error: "JARVIS could not complete that request. Please try again." }, { status: 500 });
  }
}