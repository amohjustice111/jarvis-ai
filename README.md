# J.A.R.V.I.S. — Claude Intelligence

A futuristic, responsive personal AI assistant powered by Anthropic Claude.

## Features
- Claude-powered chat through a secure server-side API route
- Browser speech input (Chrome/Edge support)
- Spoken responses using browser text-to-speech
- Responsive holographic-inspired dashboard
- API key stays on the server

## Local development
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add your Anthropic API key as `ANTHROPIC_API_KEY`.
5. Run `npm run dev` and open http://localhost:3000.

## Deploy to Vercel
Import this repository into Vercel, then add `ANTHROPIC_API_KEY` under Project Settings → Environment Variables. Redeploy after adding the variable.

Never put your Anthropic API key in browser code or commit it to GitHub.

## Notes
Voice recognition and speech synthesis use browser capabilities and require microphone permission for voice input. A specific male voice depends on the voices installed on the visitor's device. The desktop companion and wake-word support are planned as a later phase.
