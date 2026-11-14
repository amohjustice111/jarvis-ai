"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, AudioLines, Bot, Cpu, Mic, MicOff, Send, ShieldCheck, Volume2, VolumeX, Wifi, Zap } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type SpeechRecognitionResult = { transcript: string };
type SpeechRecognitionEvent = Event & { results: ArrayLike<ArrayLike<SpeechRecognitionResult>> };
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
declare global { interface Window { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike } }

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [status, setStatus] = useState("SYSTEM ONLINE");
  const [error, setError] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  function speak(text: string) {
    if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.96;
    const voices = window.speechSynthesis.getVoices();
    const male = voices.find(v => /male|david|mark|guy|daniel|alex/i.test(v.name));
    if (male) utterance.voice = male;
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(text = input) {
    const value = text.trim();
    if (!value || busy) return;
    const next: Message[] = [...messages, { role: "user", content: value }];
    setMessages(next); setInput(""); setBusy(true); setError(""); setStatus("PROCESSING REQUEST");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection error");
      const updated = [...next, { role: "assistant" as const, content: data.answer }];
      setMessages(updated); speak(data.answer); setStatus("SYSTEM ONLINE");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("ATTENTION REQUIRED");
    } finally { setBusy(false); }
  }

  function toggleMic() {
    if (listening) { recognition.current?.stop(); setListening(false); return; }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) { setError("Voice input is not supported in this browser. Try Chrome or Edge."); return; }
    const instance = new Speech();
    instance.lang = "en-US"; instance.continuous = false; instance.interimResults = false;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      setInput(transcript);
      if (transcript) void sendMessage(transcript);
    };
    instance.onerror = () => { setListening(false); setError("Microphone access failed. Check your browser permission."); };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    try { instance.start(); setListening(true); setError(""); } catch { setError("Could not start the microphone."); }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><AudioLines size={21}/></span><span>J.A.R.V.I.S.<small>CLAUDE INTELLIGENCE</small></span></a>
        <div className="top-status"><span className="pulse-dot"/> SECURE SESSION <i/> <span className="online-text">ONLINE</span></div>
        <button className="icon-button" aria-label={voiceOn ? "Mute voice" : "Enable voice"} onClick={() => { setVoiceOn(!voiceOn); if (voiceOn) window.speechSynthesis?.cancel(); }} title="Voice output">{voiceOn ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
      </header>

      <section className="hero">
        <div className="eyebrow"><span/> PERSONAL ARTIFICIAL INTELLIGENCE</div>
        <h1>At your service<span>.</span></h1>
        <p className="subtitle">Your world, intelligently connected.</p>
        <div className="core-wrap">
          <div className={busy || listening ? "core active" : "core"}>
            <div className="core-ring ring-one"/><div className="core-ring ring-two"/><div className="core-ring ring-three"/>
            <div className="core-center"><AudioLines size={43} strokeWidth={1.25}/><span>J</span></div>
            <div className="orbit orbit-a"/><div className="orbit orbit-b"/>
          </div>
          <div className="core-caption">{listening ? "LISTENING" : busy ? "THINKING" : "READY WHEN YOU ARE"}</div>
        </div>
        <div className="metrics">
          <div><span><Activity size={14}/> SYSTEM</span><strong>{status}</strong></div>
          <div><span><Cpu size={14}/> INTELLIGENCE</span><strong>CLAUDE AI</strong></div>
          <div><span><ShieldCheck size={14}/> SECURITY</span><strong>KEY PROTECTED</strong></div>
          <div><span><Wifi size={14}/> NETWORK</span><strong>CONNECTED</strong></div>
        </div>
      </section>

      <section className="console">
        <div className="console-head"><div><span className="console-light"/> JARVIS CONSOLE</div><span>ENCRYPTED CHANNEL <ShieldCheck size={13}/></span></div>
        <div className="conversation">
          {messages.length === 0 && <div className="welcome"><Bot size={25}/><div><strong>Good day. I am JARVIS.</strong><p>Claude intelligence is standing by. What can I help you with?</p></div></div>}
          {messages.map((message, index) => <div className={`message ${message.role}`} key={index}><span>{message.role === "user" ? "YOU" : "JARVIS"}</span><p>{message.content}</p></div>)}
          {busy && <div className="thinking"><span/><span/><span/> JARVIS IS THINKING</div>}
          {error && <div className="error-msg">{error}</div>}
          <div ref={bottom}/>
        </div>
        <form className="composer" onSubmit={e => { e.preventDefault(); void sendMessage(); }}>
          <button type="button" className={listening ? "mic-button listening" : "mic-button"} onClick={toggleMic} aria-label="Speak to JARVIS">{listening ? <MicOff size={19}/> : <Mic size={19}/>}</button>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Message JARVIS or use your voice..." aria-label="Message JARVIS"/>
          <button className="send-button" type="submit" disabled={busy || !input.trim()} aria-label="Send message"><Send size={18}/></button>
        </form>
        <div className="console-foot"><span><Zap size={12}/> POWERED BY ANTHROPIC CLAUDE</span><span>VOICE INPUT REQUIRES MICROPHONE PERMISSION</span></div>
      </section>
      <footer>J.A.R.V.I.S. <span>•</span> JUST A RATHER VERY INTELLIGENT SYSTEM <span>•</span> PERSONAL ASSISTANT</footer>
    </main>
  );
}