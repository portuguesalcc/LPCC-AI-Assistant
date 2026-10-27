"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import ThemeToggle from "./theme-toggle";

type Message = {
  role: "user" | "assistant";
  text: string;
};

const SUGGESTIONS = [
  "Que serviços disponibiliza a Liga?",
  "Como posso pedir apoio social?",
  "Como posso ser voluntário ou ajudar a Liga?",
];

const PHONE = "808 910 132";
const MAX_RECORDING_SECONDS = 60;

// Prefer formats Gemini accepts; browsers support different ones.
const RECORDING_TYPES = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

/** Turns plain URLs and e-mail addresses into links. */
function linkify(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^https?:\/\//.test(part)) {
      const href = part.replace(/[.,;:]+$/, "");
      return (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer">
          {href}
        </a>
      );
    }
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(part)) {
      const email = part.replace(/[.,;:]+$/, "");
      return (
        <a key={key} href={`mailto:${email}`}>
          {email}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/** Renders the small subset of Markdown the model uses (paragraphs, bullets, bold). */
function renderText(text: string): ReactNode {
  const inline = (line: string) =>
    line.split(/\*\*(.+?)\*\*/g).map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{linkify(part, `b${i}`)}</strong> : (
        <Fragment key={i}>{linkify(part, `t${i}`)}</Fragment>
      ),
    );

  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length}>
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/) ?? line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
    } else {
      flush();
      if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return blocks;
}

function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function speak(text: string, onEnd?: () => void) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(
    text.replace(/[*#•]/g, "").replace(/https?:\/\/\S+/g, "o link indicado"),
  );
  utterance.lang = "pt-PT";
  const voices = synth.getVoices();
  utterance.voice =
    voices.find((v) => v.lang === "pt-PT") ?? voices.find((v) => v.lang.startsWith("pt")) ?? null;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  synth.speak(utterance);
}

const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

const StopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 20.5 21 12 3 3.5v7l12 1.5-12 1.5z" />
  </svg>
);

const SpeakerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </svg>
);

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, transcribing]);

  // Some browsers load speech voices asynchronously.
  useEffect(() => {
    if (canSpeak()) window.speechSynthesis.getVoices();
    return () => {
      if (canSpeak()) window.speechSynthesis.cancel();
    };
  }, []);

  // Grow the text box with its content.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function toggleSpeak(index: number, text: string) {
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }
    setSpeakingIndex(index);
    speak(text, () => setSpeakingIndex((current) => (current === index ? null : current)));
  }

  async function send(text: string, fromVoice = false) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const history = [...messagesRef.current, { role: "user" as const, text: trimmed }];
    setMessages(history);
    setInput("");
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, text }) => ({ role, text })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ocorreu um erro. Tente novamente.");

      const reply: Message = { role: "assistant", text: data.text };
      setMessages([...history, reply]);
      // Questions asked by voice are answered out loud.
      if (fromVoice) {
        const index = history.length;
        setSpeakingIndex(index);
        speak(data.text, () => setSpeakingIndex((c) => (c === index ? null : c)));
      }
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Sem ligação à internet. Verifique a ligação e tente novamente."
          : err instanceof Error
            ? err.message
            : "Ocorreu um erro. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }

  function newConversation() {
    if (canSpeak()) window.speechSynthesis.cancel();
    setSpeakingIndex(null);
    setMessages([]);
    setInput("");
    setError(null);
  }

  async function startRecording() {
    setError(null);
    if (canSpeak()) window.speechSynthesis.cancel();
    setSpeakingIndex(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador não permite usar o microfone. Pode escrever a sua pergunta.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "Não foi possível usar o microfone. Confirme que deu autorização ao navegador para usar o microfone.",
      );
      return;
    }

    const mimeType = RECORDING_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      setRecording(false);
      const audio = new Blob(chunks, { type: recorder.mimeType });
      if (audio.size === 0) return;

      setTranscribing(true);
      try {
        const form = new FormData();
        form.append("audio", audio);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Não foi possível perceber a gravação.");
        if (!data.text) throw new Error("Não consegui ouvir. Pode tentar outra vez, falando perto do microfone?");
        setTranscribing(false);
        await send(data.text, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível perceber a gravação.");
      } finally {
        setTranscribing(false);
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORDING_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  const waiting = busy || transcribing;
  const started = messages.length > 0;

  return (
    <div className="app">
      <header className="header">
        <img className="logo" src="/lpcc-logo.png" alt="Liga Portuguesa Contra o Cancro" />
        <div className="header-title">
          <h1>Assistente Virtual</h1>
          <p>Estamos aqui para ajudar</p>
        </div>
        {started && (
          <button className="ghost-btn" onClick={newConversation}>
            Nova conversa
          </button>
        )}
        <ThemeToggle />
      </header>

      <main className="messages" ref={listRef} aria-live="polite">
        {!started && (
          <section className="welcome">
            <img className="welcome-avatar" src="/avatar.png" alt="" />
            <h2>Olá! Como posso ajudar?</h2>
            <p>
              Sou o assistente virtual da Liga Portuguesa Contra o Cancro. Respondo a perguntas
              sobre os nossos serviços e apoios.
            </p>
            <p className="how">
              <strong>Escreve</strong> a tua pergunta, ou carrega em <strong>Falar</strong> e
              diz a tua pergunta em voz alta.
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)} disabled={waiting}>
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`row ${m.role}`}>
            {m.role === "assistant" && <img className="avatar" src="/avatar.png" alt="" />}
            <div className="bubble">
              <span className="sr-only">{m.role === "user" ? "Você disse:" : "Assistente:"}</span>
              {renderText(m.text)}
              {m.role === "assistant" && (
                <div className="bubble-actions">
                  {canSpeak() && (
                    <button className="listen" onClick={() => toggleSpeak(i, m.text)}>
                      {speakingIndex === i ? <StopIcon /> : <SpeakerIcon />}
                      {speakingIndex === i ? "Parar" : "Ouvir"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {waiting && (
          <div className="row assistant">
            <img className="avatar" src="/avatar.png" alt="" />
            <div className="bubble typing">
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {transcribing ? "A ouvir a sua mensagem…" : "A procurar a resposta…"}
            </div>
          </div>
        )}
      </main>

      <div className="bottom">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {recording ? (
          <div className="recording-bar" role="status">
            <span className="rec-dot" aria-hidden="true" />
            <span className="rec-text">
              A gravar… Fale agora.
              <span className="rec-time">
                {" "}0:{String(seconds).padStart(2, "0")}
              </span>
            </span>
            <button className="stop-btn" onClick={stopRecording}>
              <StopIcon /> Parar e enviar
            </button>
          </div>
        ) : (
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              placeholder="Escreva a sua pergunta…"
              aria-label="Escreva aqui a sua pergunta"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            {input.trim() ? (
              <button type="submit" className="action-btn send" disabled={waiting}>
                <SendIcon /> Enviar
              </button>
            ) : (
              <button
                type="button"
                className="action-btn mic"
                onClick={startRecording}
                disabled={waiting}
              >
                <MicIcon /> Falar
              </button>
            )}
          </form>
        )}

        <p className="disclaimer">
          Este assistente usa inteligência artificial e pode cometer erros. Não substitui o seu
          médico. Em caso de urgência, ligue <a href="tel:112">112</a>.
        </p>

        <footer className="footer">
          <span>
            Prefere falar com uma pessoa? Ligue para o geral{" "}
            <a href={`tel:${PHONE.replace(/\s/g, "")}`}>{PHONE}</a>
          </span>
          <span>
            Não guardamos as conversas · <a href="/privacidade">Privacidade</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
