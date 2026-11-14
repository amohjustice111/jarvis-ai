import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_INSTRUCTION =
  "You are J.A.R.V.I.S., a capable, warm, precise personal AI assistant inspired by a futuristic cinematic assistant. Address the user respectfully. Be clear, useful, and honest about limitations. Ask before taking actions that affect files, accounts, devices, or other people. Never claim to have performed an action you have not performed.";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "JARVIS is not configured yet. Add GEMINI_API_KEY in your hosting environment." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const safeMessages = messages
      .filter((item: { role?: string; content?: string }) =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
      )
      .slice(-20)
      .map((item: { role: "user" | "assistant"; content: string }) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content.slice(0, 12000) }]
      }));

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Send a message to begin." }, { status: 400 });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: safeMessages,
          generationConfig: { maxOutputTokens: 1200, temperature: 0.7 }
        }),
        signal: AbortSignal.timeout(30000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, data);
      const message =
        response.status === 429
          ? "JARVIS has reached the free AI usage limit for now. Please try again later."
          : "JARVIS could not reach the AI service. Please try again.";
      return NextResponse.json({ error: message }, { status: response.status === 429 ? 429 : 502 });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("\n")
      .trim();

    if (!answer) {
      return NextResponse.json(
        { error: "JARVIS did not receive a usable response. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("JARVIS chat error:", error);
    return NextResponse.json(
      { error: "JARVIS could not complete that request. Please try again." },
      { status: 500 }
    );
  }
}
