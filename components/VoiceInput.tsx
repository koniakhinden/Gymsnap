"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/components/ui/cn";

// Minimal typing for the Web Speech API (not in the standard TS DOM lib).
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const LANGS = [
  { code: "en-US", label: "EN" },
  { code: "uk-UA", label: "UA" },
] as const;
type LangCode = (typeof LANGS)[number]["code"];

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Split a spoken phrase into separate items on commas / "and" in EN/RU/UK.
function parseItems(text: string): string[] {
  return text
    .split(/,|\band\b|\bи\b|\bта\b|\bі\b|&/giu)
    .map((s) => s.trim())
    .filter(Boolean);
}

// A mic button + language picker that dictates ingredient names.
export default function VoiceInput({ onItems }: { onItems: (items: string[]) => void }) {
  // Render nothing until mounted so the server HTML (which can't detect the
  // Speech API) matches the first client render — avoids a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [lang, setLang] = useState<LangCode>("en-US");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem("gymsnap_voice_lang") : null;
    if (saved && LANGS.some((l) => l.code === saved)) setLang(saved as LangCode);
  }, []);

  if (!mounted || getCtor() === null) return null;

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? "";
      const items = parseItems(transcript);
      if (items.length) onItems(items);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function changeLang(next: LangCode) {
    setLang(next);
    if (typeof window !== "undefined") window.localStorage.setItem("gymsnap_voice_lang", next);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={listening ? "Stop voice input" : "Voice input"}
        title="Say ingredients out loud"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border transition-colors",
          listening
            ? "animate-pulse border-accent bg-accent text-surface"
            : "border-border bg-surface text-ink-tertiary hover:border-accent"
        )}
      >
        <Mic size={16} strokeWidth={2} />
      </button>
      <select
        aria-label="Voice language"
        value={lang}
        onChange={(e) => changeLang(e.target.value as LangCode)}
        className="h-10 rounded-btn border border-border bg-surface px-1 text-xs text-ink-secondary"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
