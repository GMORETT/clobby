"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "clobby:chat-muted";

function loadMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function storeMuted(muted: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // ignore
  }
}

/**
 * Chat notification sound. Uses WebAudio to synthesize a soft two-note "pop"
 * so we don't need to ship an audio asset. Respects browser autoplay policy:
 * the AudioContext is created lazily and resumed on the first user gesture.
 */
export function useChatSound() {
  const [muted, setMuted] = useState<boolean>(() => loadMuted());
  const ctxRef = useRef<AudioContext | null>(null);

  // Ensure context exists & is running. Must be triggered by a user gesture
  // the first time (browser autoplay policy).
  const ensureContext = useCallback(async () => {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctxRef.current) ctxRef.current = new Ctor();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    return ctx;
  }, []);

  // Unlock the context on the first user interaction anywhere on the page
  useEffect(() => {
    const unlock = () => {
      void ensureContext();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ensureContext]);

  const play = useCallback(async () => {
    if (muted) return;
    const ctx = await ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.08; // subtle
    master.connect(ctx.destination);

    // Two-note bloop: 880Hz then 1174Hz (A5 → D6), 60ms apart, 120ms decay
    const tone = (freq: number, startOffset: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + startOffset);
      gain.gain.linearRampToValueAtTime(1, now + startOffset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 0.12);
      osc.connect(gain).connect(master);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + 0.14);
    };

    tone(880, 0);
    tone(1174.66, 0.06);
  }, [ensureContext, muted]);

  const playPreview = useCallback(async () => {
    const ctx = await ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.08;
    master.connect(ctx.destination);
    const tone = (freq: number, startOffset: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + startOffset);
      gain.gain.linearRampToValueAtTime(1, now + startOffset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 0.12);
      osc.connect(gain).connect(master);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + 0.14);
    };
    tone(880, 0);
    tone(1174.66, 0.06);
  }, [ensureContext]);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      storeMuted(next);
      // When unmuting, play a preview so the user hears confirmation
      if (!next) void playPreview();
      return next;
    });
  }, [playPreview]);

  return { muted, toggleMuted, play };
}
