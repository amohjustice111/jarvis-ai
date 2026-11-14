# J.A.R.V.I.S. — Personal AI Assistant

A futuristic, responsive personal AI assistant powered by Google's Gemini API.

## Features
- Gemini-powered chat through a secure server-side API route
- Browser speech input (Chrome/Edge support)
- Spoken responses using browser text-to-speech
- Responsive holographic-inspired dashboard
- API key stays on the server

## AI provider and free usage
JARVIS uses the `gemini-3.5-flash-lite` model through the Gemini Developer API. Google lists free input and output tokens for eligible free-tier usage, subject to model and account rate limits. Free-tier terms and availability can change. Google may use free-tier submitted content to improve its products; do not send sensitive or confidential information.

Create an API key in Google AI Studio: https://aistudio.google.com/app/apikey

## Local development
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add your Google AI Studio key as `GEMINI_API_KEY`.
5. Run `npm run dev` and open http://localhost:3000.

## Deploy to Vercel
Open the JARVIS project in Vercel, then go to Settings → Environment Variables. Add:
- Name: `GEMINI_API_KEY`
- Value: your Google AI Studio API key
- Environment: Production (and Preview/Development if you use them)

Save the variable and redeploy. Never put the API key in browser code or commit it to GitHub.

## Voice notes
Voice recognition and speech synthesis use browser capabilities and require microphone permission for voice input. A specific male voice depends on the voices installed on the visitor's device. The desktop companion and wake-word support are planned as a later phase.
