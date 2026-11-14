"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, AudioLines, Bot, Cpu, Mic, MicOff, Send, ShieldCheck, Trash2, Volume2, VolumeX, Wifi, Zap } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type SpeechRecognitionResult = { transcript: string };
type SpeechRecognitionEvent = Event & { resultIndex: number; results: ArrayLike<ArrayLike<SpeechRecognitionResult & { isFinal: boolean }>> };
type SpeechRecognitionErrorEvent = Event & { error?: string };
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
declare global { interface Window { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike } }

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [alwaysListening, setAlwaysListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [status, setStatus] = useState("SYSTEM ONLINE");
  const [error, setError] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const alwaysListeningRef = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis-chat-history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed.filter((item): item is Message =>
            item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string"
          ).slice(-100));
        }
      }
    } catch {
      localStorage.removeItem("jarvis-chat-history");
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    try { localStorage.setItem("jarvis-chat-history", JSON.stringify(messages.slice(-100))); } catch { /* Storage may be unavailable. */ }
  }, [messages, historyLoaded]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  useEffect(() => () => {
    alwaysListeningRef.current = false;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    recognition.current?.stop();
  }, []);

  function clearConversation() {
    if (busy) return;
    setMessages([]);
    setError("");
    window.speechSynthesis?.cancel();
  }

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
    if (alwaysListeningRef.current) {
      setError("Pause always listening before using one-time voice input.");
      return;
    }
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

  function toggleAlwaysListening() {
    if (alwaysListeningRef.current) {
      alwaysListeningRef.current = false;
      setAlwaysListening(false);
      setListening(false);
      if (restartTimer.current) clearTimeout(restartTimer.current);
      recognition.current?.stop();
      setStatus("SYSTEM ONLINE");
      return;
    }

    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      setError("Always listening is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const instance = new Speech();
    instance.lang = "en-US";
    instance.continuous = true;
    instance.interimResults = false;
    instance.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.[0] || !result.isFinal) continue;
        const heard = result[0].transcript.trim();
        const wakeMatch = heard.match(/\\b(?:hey\\s+)?jarvis\\b[:,.!]?\\s*/i);
        if (!wakeMatch) continue;
        const command = heard.slice(wakeMatch[0].length).trim();
        if (command) {
          void sendMessage(command);
        } else {
          speak("I'm listening. How can I help?");
          setStatus("JARVIS IS LISTENING");
        }
      }
    };
    instance.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        alwaysListeningRef.current = false;
        setAlwaysListening(false);
        setListening(false);
        setStatus("MICROPHONE PERMISSION NEEDED");
        setError("Microphone permission was denied. Allow microphone access in your browser's site settings, then try again.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError("Voice recognition paused. Check your connection and microphone permission.");
      }
    };
    instance.onend = () => {
      if (!alwaysListeningRef.current) {
        setListening(false);
        return;
      }
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (!alwaysListeningRef.current) return;
        try { instance.start(); } catch { /* The browser may still be closing the previous recognition session. */ }
      }, 700);
    };

    recognition.current?.stop();
    recognition.current = instance;
    alwaysListeningRef.current = true;
    setAlwaysListening(true);
    setListening(true);
    setError("");
    setStatus("WAKE WORD ACTIVE");
    try {
      instance.start();
    } catch {
      alwaysListeningRef.current = false;
      setAlwaysListening(false);
      setListening(false);
      setError("Could not start always listening. Check microphone permission and try again.");
      setStatus("SYSTEM ONLINE");
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><AudioLines size={21}/></span><span>J.A.R.V.I.S.<small>GEMINI INTELLIGENCE</small></span></a>
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
          <div className="core-caption">{alwaysListening ? "AWAITING HEY JARVIS" : listening ? "LISTENING" : busy ? "THINKING" : "READY WHEN YOU ARE"}</div>
        </div>
        <div className="metrics">
          <div><span><Activity size={14}/> SYSTEM</span><strong>{status}</strong></div>
          <div><span><Cpu size={14}/> INTELLIGENCE</span><strong>GEMINI AI</strong></div>
          <div><span><ShieldCheck size={14}/> SECURITY</span><strong>KEY PROTECTED</strong></div>
          <div><span><Wifi size={14}/> NETWORK</span><strong>CONNECTED</strong></div>
        </div>
      </section>

      <section className="console">
        <div className="console-head"><div><span className="console-light"/> JARVIS CONSOLE</div><span>ENCRYPTED CHANNEL <ShieldCheck size={13}/></span><button type="button" className={alwaysListening ? "always-button active" : "always-button"} onClick={toggleAlwaysListening}>{alwaysListening ? "PAUSE ALWAYS LISTENING" : "ENABLE ALWAYS LISTENING"}</button><button type="button" className="clear-button" onClick={clearConversation} disabled={busy} title="Clear saved conversation"><Trash2 size={13}/> CLEAR CHAT</button></div>
        <div className="conversation">
          {messages.length === 0 && <div className="welcome"><Bot size={25}/><div><strong>Good day. I am JARVIS.</strong><p>Gemini intelligence is standing by. What can I help you with?</p></div></div>}
          {messages.map((message, index) => <div className={`message ${message.role}`} key={index}><span>{message.role === "user" ? "YOU" : "JARVIS"}</span><p>{message.content}</p></div>)}
          {busy && <div className="thinking"><span/><span/><span/> JARVIS IS THINKING</div>}
          {error && <div className="error-msg">{error}</div>}
          <div ref={bottom}/>
        </div>
        <form className="composer" onSubmit={e => { e.preventDefault(); void sendMessage(); }}>
          <button type="button" className={listening && !alwaysListening ? "mic-button listening" : "mic-button"} onClick={toggleMic} aria-label="Speak to JARVIS">{listening ? <MicOff size={19}/> : <Mic size={19}/>}</button>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Message JARVIS or use your voice..." aria-label="Message JARVIS"/>
          <button className="send-button" type="submit" disabled={busy || !input.trim()} aria-label="Send message"><Send size={18}/></button>
        </form>
        <div className="console-foot"><span><Zap size={12}/> POWERED BY GOOGLE GEMINI</span><span>{alwaysListening ? "SAY HEY JARVIS TO GIVE A COMMAND" : "MICROPHONE PERMISSION REQUIRED"}</span></div>
      </section>
      <footer>J.A.R.V.I.S. <span>•</span> JUST A RATHER VERY INTELLIGENT SYSTEM <span>•</span> PERSONAL ASSISTANT</footer>
    </main>
  );
}