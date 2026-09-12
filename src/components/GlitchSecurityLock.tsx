import React, { useState, useEffect, useCallback, useRef } from "react";
import { ShieldAlert, Lock, Unlock, AlertTriangle, KeyRound, Volume2, VolumeX, Terminal, ShieldCheck, RefreshCw } from "lucide-react";
import { useSettings } from "../context/SettingsContext";

// Simple Web Audio API sound generator for cyber glitch & feedback sounds
class SoundFx {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playBeep(freq = 440, type: OscillatorType = "sine", duration = 0.08, gainVal = 0.1) {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  playError() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      // Harsh digital low buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  playSuccess() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      // High pleasant unlock chime chords
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        setTimeout(() => {
          this.playBeep(freq, "triangle", 0.2, 0.15);
        }, idx * 70);
      });
    } catch {}
  }

  playAlarm() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }
}

const sfx = new SoundFx();

export const GlitchSecurityLock: React.FC = () => {
  const { isGlitchLocked, glitchReason, unlockGlitchLock } = useSettings();
  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [isUnlockedSuccess, setIsUnlockedSuccess] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showPinMask, setShowPinMask] = useState(true);
  const [glitchTicker, setGlitchTicker] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sound sync
  useEffect(() => {
    sfx.enabled = soundEnabled;
  }, [soundEnabled]);

  // When locked, trigger initial alarm beep and focus input
  useEffect(() => {
    if (isGlitchLocked) {
      setPin("");
      setErrorMsg(null);
      setIsUnlockedSuccess(false);
      sfx.playAlarm();
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isGlitchLocked]);

  // Glitch jitter counter
  useEffect(() => {
    if (!isGlitchLocked) return;
    const interval = setInterval(() => {
      setGlitchTicker(prev => (prev + 1) % 100);
    }, 150);
    return () => clearInterval(interval);
  }, [isGlitchLocked]);

  const verifyPin = useCallback((pinToTest: string) => {
    if (pinToTest.length !== 4) return;

    if (unlockGlitchLock(pinToTest)) {
      setErrorMsg(null);
      setIsUnlockedSuccess(true);
      sfx.playSuccess();
    } else {
      sfx.playError();
      setErrorMsg("INCORRECT PIN - ACCESS DENIED");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin("");
    }
  }, [unlockGlitchLock]);

  // Auto verify when 4 digits are typed
  const handleDigit = useCallback((digit: string) => {
    if (pin.length >= 4) return;
    sfx.playBeep(600 + pin.length * 80, "sine", 0.05, 0.08);
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg(null);
    if (nextPin.length === 4) {
      setTimeout(() => verifyPin(nextPin), 80);
    }
  }, [pin, verifyPin]);

  const handleBackspace = useCallback(() => {
    sfx.playBeep(350, "sine", 0.05, 0.05);
    setPin(prev => prev.slice(0, -1));
    setErrorMsg(null);
  }, []);

  const handleClear = useCallback(() => {
    sfx.playBeep(300, "sine", 0.05, 0.05);
    setPin("");
    setErrorMsg(null);
  }, []);

  // Physical keyboard support
  useEffect(() => {
    if (!isGlitchLocked || isUnlockedSuccess) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default browser operations during lockdown
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Escape" || e.key === "Delete") {
        e.preventDefault();
        handleClear();
      } else if (e.key === "Enter" && pin.length === 4) {
        e.preventDefault();
        verifyPin(pin);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGlitchLocked, isUnlockedSuccess, pin, handleDigit, handleBackspace, handleClear, verifyPin]);

  if (!isGlitchLocked) return null;

  return (
    <div 
      className="fixed inset-0 z-[999999] bg-[#050508] text-red-500 font-mono select-none overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at center, rgba(185, 28, 28, 0.25) 0%, rgba(5, 5, 8, 0.95) 75%),
          repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35) 1px, transparent 1px, transparent 3px)
        `
      }}
    >
      {/* Glitch Scanline Effect */}
      <div 
        className="pointer-events-none fixed inset-0 z-10 opacity-30 mix-blend-screen"
        style={{
          background: "linear-gradient(rgba(255, 0, 0, 0) 50%, rgba(255, 0, 0, 0.4) 51%)",
          backgroundSize: "100% 4px",
          animation: "scanline 8s linear infinite"
        }}
      />

      {/* Flashing Red Cyber Perimeter */}
      <div className="pointer-events-none fixed inset-0 border-4 border-red-600/70 shadow-[inset_0_0_80px_rgba(220,38,38,0.5)] animate-pulse" />

      {/* Top Header Bar */}
      <div className="w-full max-w-xl flex items-center justify-between border-b border-red-500/40 pb-3 mb-6 relative z-20">
        <div className="flex items-center gap-2 text-xs text-red-400 font-bold tracking-widest uppercase">
          <ShieldAlert className="w-4 h-4 text-red-500 animate-bounce" />
          <span>SECURITY LOCKDOWN // ANTI-TAMPER ACTIVE</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(prev => !prev)}
            className="p-1.5 rounded bg-red-950/60 border border-red-500/40 text-red-400 hover:text-red-200 transition-colors"
            title={soundEnabled ? "Mute Alert Sound" : "Enable Alert Sound"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-900/60 border border-red-500/60 text-red-300 font-bold tracking-wider animate-pulse">
            LOCKED
          </span>
        </div>
      </div>

      {/* Main Glitch Lockdown Container */}
      <div 
        className={`w-full max-w-xl bg-black/85 backdrop-blur-md border-2 border-red-600/80 rounded-2xl p-6 sm:p-8 shadow-[0_0_60px_rgba(220,38,38,0.4)] relative z-20 transition-transform duration-100 ${
          shake ? "translate-x-2 -translate-y-1 rotate-1 scale-[0.99] border-red-500 shadow-[0_0_100px_rgba(255,0,0,0.8)]" : ""
        }`}
      >
        {/* CRT Noise Grid Backing */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none opacity-20 bg-[radial-gradient(#ef4444_1px,transparent_1px)] [background-size:16px_16px]" />

        {isUnlockedSuccess ? (
          /* Success Screen */
          <div className="text-center py-8 relative z-10 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-green-950/80 border-2 border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.6)] flex items-center justify-center mx-auto mb-5 text-green-400">
              <ShieldCheck size={44} className="animate-pulse" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-green-400 tracking-wider uppercase mb-2">
              AUTHORIZATION GRANTED
            </h2>
            <p className="text-sm text-green-300/90 font-mono tracking-widest uppercase mb-4">
              [OWNER MASTER PIN VERIFIED // TAMPER LOCK RELEASED]
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-green-400/80">
              <RefreshCw size={14} className="animate-spin" />
              <span>Restoring full panel access and UI controls...</span>
            </div>
          </div>
        ) : (
          /* Active Lockdown Form */
          <div className="relative z-10">
            {/* Warning Icon & Big Title */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-950/90 border border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center justify-center text-red-400 shrink-0">
                <Lock size={26} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-red-400 uppercase flex items-center gap-2">
                  PANEL ACCESS LOCKED
                </h1>
                <p className="text-xs text-red-400/75 tracking-wider uppercase font-semibold">
                  Unauthorized Modification & Tamper Defense
                </p>
              </div>
            </div>

            {/* Urdu / Hindi / English Explanation */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-red-950/40 border border-red-500/40 mb-6 text-xs leading-relaxed space-y-2 text-red-200/90">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-300">
                    Yeh panel Owner ke Master PIN ke baghair modify ya access nahi kiya ja sakta.
                  </p>
                  <p className="text-[11px] text-red-300/80 mt-1">
                    Bina permission ke panel settings ya controls ko modify karne ki koshish block kardi gayi hai. Aage kaam karne ke liye Owner se 4-digit security PIN le kar enter karein.
                  </p>
                </div>
              </div>

              {glitchReason && (
                <div className="text-[10px] text-red-400/70 border-t border-red-500/20 pt-1.5 flex items-center gap-1.5">
                  <Terminal size={12} />
                  <span className="truncate">SYSTEM EVENT: {glitchReason}</span>
                </div>
              )}
            </div>

            {/* Hidden Input for Keyboard Typing */}
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPin(val);
                setErrorMsg(null);
                if (val.length === 4) {
                  verifyPin(val);
                }
              }}
              className="sr-only"
              autoFocus
            />

            {/* 4-Digit Digital Display Slots */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-red-300 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <KeyRound size={13} />
                  ENTER 4-DIGIT SECURITY PIN:
                </span>
                <button
                  type="button"
                  onClick={() => setShowPinMask(prev => !prev)}
                  className="text-[10px] text-red-400/80 hover:text-red-200 underline font-mono"
                >
                  {showPinMask ? "SHOW DIGITS" : "MASK DIGITS"}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 sm:gap-4">
                {[0, 1, 2, 3].map(idx => {
                  const digit = pin[idx];
                  const isFilled = digit !== undefined;
                  const isCurrent = pin.length === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => inputRef.current?.focus()}
                      className={`h-16 sm:h-20 rounded-xl border-2 flex items-center justify-center text-2xl sm:text-3xl font-black transition-all cursor-pointer ${
                        isFilled
                          ? "bg-red-950/80 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                          : isCurrent
                          ? "bg-black/60 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse"
                          : "bg-black/40 border-red-900/60 text-red-900"
                      }`}
                    >
                      {isFilled ? (showPinMask ? "●" : digit) : isCurrent ? "_" : ""}
                    </div>
                  );
                })}
              </div>

              {/* Error Warning Banner */}
              {errorMsg && (
                <div className="mt-3 py-1.5 px-3 rounded-lg bg-red-950 border border-red-500/80 text-xs text-red-300 font-bold tracking-wider text-center animate-shake">
                  ⚠ {errorMsg} (Contact Owner for PIN: 7588)
                </div>
              )}
            </div>

            {/* Cyber Touch Keypad */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(num)}
                  disabled={pin.length >= 4}
                  className="py-3 sm:py-3.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 active:bg-red-800/80 border border-red-500/30 hover:border-red-500/70 text-red-200 text-lg sm:text-xl font-bold font-mono transition-all shadow-sm active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                className="py-3 sm:py-3.5 rounded-xl bg-red-950/20 hover:bg-red-950/60 active:bg-red-900/40 border border-red-900/40 text-red-400 text-xs sm:text-sm font-bold tracking-wider font-mono transition-all active:scale-95 cursor-pointer"
              >
                CLEAR
              </button>

              <button
                type="button"
                onClick={() => handleDigit("0")}
                disabled={pin.length >= 4}
                className="py-3 sm:py-3.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 active:bg-red-800/80 border border-red-500/30 hover:border-red-500/70 text-red-200 text-lg sm:text-xl font-bold font-mono transition-all shadow-sm active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                className="py-3 sm:py-3.5 rounded-xl bg-red-950/20 hover:bg-red-950/60 active:bg-red-900/40 border border-red-900/40 text-red-400 text-xs sm:text-sm font-bold tracking-wider font-mono transition-all active:scale-95 cursor-pointer"
              >
                DEL
              </button>
            </div>

            {/* Unlock Button */}
            <button
              type="button"
              onClick={() => verifyPin(pin)}
              disabled={pin.length !== 4}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-sm sm:text-base tracking-widest uppercase transition-all shadow-[0_0_25px_rgba(220,38,38,0.6)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock size={18} />
              <span>VERIFY & UNLOCK PANEL</span>
            </button>

            {/* Owner Hint Footer */}
            <div className="mt-4 pt-3 border-t border-red-500/20 flex items-center justify-between text-[11px] text-red-400/60">
              <span>Owner Master PIN Required</span>
              <span className="font-mono text-red-400/90 font-bold">PIN: 7588</span>
            </div>
          </div>
        )}
      </div>

      {/* Ticker at the bottom */}
      <div className="w-full max-w-xl mt-4 text-center text-[10px] text-red-500/50 font-mono tracking-widest uppercase">
        SECURITY LOCKOUT PROTOCOL V4.0 // GLITCH DETECTOR ACTIVE [{glitchTicker}]
      </div>
    </div>
  );
};
