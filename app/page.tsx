"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type SpeechRecognitionResult = { transcript: string };
type SpeechRecognitionResultItem = ArrayLike<SpeechRecognitionResult> & { isFinal: boolean };
type SpeechRecognitionEvent = Event & { resultIndex: number; results: ArrayLike<SpeechRecognitionResultItem> };
type SpeechRecognitionErrorEvent = Event & { error?: string };
type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
declare global { interface Window { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike } }

const captionColors = ["#72e7ff", "#ffd166", "#ff8fab", "#b8f2a1", "#c7a6ff", "#ffad66"];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionColor, setCaptionColor] = useState(captionColors[0]);
  const [error, setError] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordIndex = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis-chat-history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed.filter((item): item is Message =>
          item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string"
        ).slice(-100));
      }
    } catch { localStorage.removeItem("jarvis-chat-history"); }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("jarvis-chat-history", JSON.stringify(messages.slice(-100))); } catch { /* Storage may be unavailable. */ }
  }, [messages]);

  useEffect(() => () => {
    listeningRef.current = false;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    if (captionTimer.current) clearTimeout(captionTimer.current);
    recognition.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (captionTimer.current) clearTimeout(captionTimer.current);
    setCaption("");
    wordIndex.current = 0;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.96;
    const voices = window.speechSynthesis.getVoices();
    const male = voices.find(v => /male|david|mark|guy|daniel|alex/i.test(v.name));
    if (male) utterance.voice = male;
    utterance.onboundary = (event) => {
      if (event.name !== "word") return;
      const remaining = text.slice(event.charIndex);
      const nextWord = remaining.match(/^[\s,.;:!?—-]*([^\s,.;:!?—-]+)/)?.[1];
      if (!nextWord) return;
      const color = captionColors[wordIndex.current % captionColors.length];
      wordIndex.current += 1;
      setCaptionColor(color);
      setCaption(nextWord);
    };
    utterance.onend = () => {
      captionTimer.current = setTimeout(() => setCaption(""), 900);
    };
    utterance.onerror = () => {
      captionTimer.current = setTimeout(() => setCaption(""), 900);
    };
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(text: string) {
    const value = text.trim();
    if (!value || busyRef.current) return;
    const next: Message[] = [...messages, { role: "user", content: value }];
    setMessages(next);
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection error");
      const answer = String(data.answer || "I am sorry, I could not prepare a reply.");
      setMessages([...next, { role: "assistant", content: answer }]);
      speak(answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "JARVIS could not connect. Please try again.");
      speak("I am sorry. I could not connect just now. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function toggleMicrophone() {
    if (listeningRef.current) {
      listeningRef.current = false;
      setListening(false);
      if (restartTimer.current) clearTimeout(restartTimer.current);
      recognition.current?.stop();
      return;
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      setError("Voice input is not supported here. Please open JARVIS in Chrome or Edge and allow microphone access.");
      return;
    }
    const instance = new Speech();
    instance.lang = "en-US";
    instance.continuous = true;
    instance.interimResults = false;
    instance.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal) {
          const spoken = result[0]?.transcript?.trim();
          if (spoken) void sendMessage(spoken);
        }
      }
    };
    instance.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        listeningRef.current = false;
        setListening(false);
        setError("Please allow microphone access in your browser settings, then tap the microphone again.");
      }
    };
    instance.onend = () => {
      if (!listeningRef.current) return;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        if (listeningRef.current) {
          try { instance.start(); } catch { /* Browser may still be closing the previous session. */ }
        }
      }, 650);
    };
    recognition.current?.stop();
    recognition.current = instance;
    listeningRef.current = true;
    setListening(true);
    setError("");
    try { instance.start(); }
    catch {
      listeningRef.current = false;
      setListening(false);
      setError("Could not start the microphone. Please check its permission and try again.");
    }
  }

  return (
    <main className="call-screen">
      <img className="jarvis-photo" src="/jarvis-avatar.webp" alt="JARVIS" />
      <div className="photo-shade" />
      <div className="call-topline"><span className="call-live-dot" /> JARVIS <span className="call-private">PRIVATE VIDEO SESSION</span></div>
      <div className="caption-area" aria-live="polite" aria-atomic="true">
        {caption && <span className="spoken-word" style={{ color: captionColor }}>{caption}</span>}
      </div>
      {error && <div className="voice-error" role="status">{error}</div>}
      <div className="mic-area">
        <button
          type="button"
          className={listening ? "main-mic active" : "main-mic"}
          onClick={toggleMicrophone}
          aria-label={listening ? "Stop hands-free listening" : "Start hands-free listening"}
          title={listening ? "Tap to stop listening" : "Tap to talk to JARVIS"}
        >
          {listening ? <MicOff size={29} strokeWidth={2.1} /> : <Mic size={29} strokeWidth={2.1} />}
        </button>
        <span className="mic-hint">{listening ? (busy ? "JARVIS IS THINKING" : "LISTENING · TAP TO PAUSE") : "TAP TO TALK"}</span>
      </div>
      <span className="screen-reader-status">{busy ? "JARVIS is preparing a reply" : listening ? "Microphone is listening" : "JARVIS is ready"}</span>
    </main>
  );
}
