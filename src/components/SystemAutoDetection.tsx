import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Scan,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
  Server,
  Radio,
  Terminal,
  Volume2,
  VolumeX,
  Layers,
  HelpCircle,
  ShieldCheck,
  Zap,
  Activity
} from "lucide-react";

interface DetectionItem {
  id: string;
  name: string;
  category: "vps" | "console" | "hardware" | "virtualization" | "network";
  status: "detected" | "missing" | "warning";
  value?: string;
  details: string;
  required: boolean;
  actionHint?: string;
}

interface DeepDetectionReport {
  timestamp: string;
  overallStatus: "success" | "warning" | "error";
  summary: {
    totalChecks: number;
    detectedCount: number;
    missingCount: number;
    warningCount: number;
  };
  headline: string;
  speechText: string;
  vps: {
    providerName: string;
    providerType: string;
    hypervisor: string;
    details: string;
  };
  console: {
    consoleType: string;
    shell: string;
    details: string;
    features: string[];
  };
  items: DetectionItem[];
  environment: any;
}

interface SystemAutoDetectionProps {
  onDetectionComplete?: (report: DeepDetectionReport) => void;
}

export default function SystemAutoDetection({ onDetectionComplete }: SystemAutoDetectionProps) {
  const [report, setReport] = useState<DeepDetectionReport | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Play clear, crisp speech announcement with exact concise words
  const speakStatus = (type: "successful" | "missing" | "failed" | string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();

      let textToSpeak = "Successful";
      if (type === "successful" || type === "success") {
        textToSpeak = "Successful";
      } else if (type === "missing" || type === "no_detection" || type === "not_added") {
        textToSpeak = "Yeh add nahi hai";
      } else if (type === "failed" || type === "error") {
        textToSpeak = "Failed";
      } else if (typeof type === "string") {
        textToSpeak = type;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferredVoice = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Natural") ||
              v.name.includes("Google") ||
              v.name.includes("Samantha") ||
              v.name.includes("Alex") ||
              v.name.includes("Daniel"))
        ) || voices.find((v) => v.lang.startsWith("en") || v.lang.startsWith("hi")) || voices[0];

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  };

  const runAutoDetection = async (isManual = true) => {
    setIsScanning(true);
    setScanProgress(20);

    const progressTimer = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressTimer);
          return 90;
        }
        return prev + 25;
      });
    }, 150);

    try {
      const res = await axios.get("/api/system/auto-detect");
      clearInterval(progressTimer);
      setScanProgress(100);

      const data: DeepDetectionReport = res.data;
      setReport(data);
      setLastScanTime(new Date().toLocaleTimeString());

      if (onDetectionComplete) {
        onDetectionComplete(data);
      }

      if (isManual) {
        if (data.overallStatus === "error") {
          speakStatus("failed");
        } else if (data.summary.missingCount > 0) {
          speakStatus("missing");
        } else {
          speakStatus("successful");
        }
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      setScanProgress(100);
      console.error("Auto-detection failed:", err);
      if (isManual) {
        speakStatus("failed");
      }
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(0);
      }, 400);
    }
  };

  // Run initial detection on mount
  useEffect(() => {
    runAutoDetection(false);
  }, []);

  const filteredItems = report?.items
    ? report.items.filter((item) => {
        if (selectedFilter === "all") return true;
        if (selectedFilter === "vps") return item.category === "vps" || item.category === "virtualization";
        if (selectedFilter === "console") return item.category === "console";
        if (selectedFilter === "hardware") return item.category === "hardware" || item.category === "network";
        return item.category === selectedFilter;
      })
    : [];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "vps":
      case "virtualization":
        return <Server className="w-4 h-4 text-theme-400" />;
      case "console":
        return <Terminal className="w-4 h-4 text-emerald-400" />;
      case "hardware":
        return <Cpu className="w-4 h-4 text-amber-400" />;
      case "network":
        return <Radio className="w-4 h-4 text-cyan-400" />;
      default:
        return <Layers className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <section className="bg-card border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden mb-8">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-theme-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 border-b border-border-subtle pb-5 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-theme-500/10 border border-theme-500/30 flex items-center justify-center text-theme-400 shadow-sm">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                VPS & Console Auto Detection
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-theme-500/20 text-theme-400 border border-theme-500/30 font-semibold uppercase">
                  Auto-Detect
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically detects host VPS provider, virtualization architecture, hardware specs, and interactive terminal console.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 ${
              voiceEnabled
                ? "bg-theme-500/10 text-theme-400 border-theme-500/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
            title={voiceEnabled ? "Voice Feedback Active" : "Voice Feedback Muted"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{voiceEnabled ? "Voice Active" : "Muted"}</span>
          </button>

          <button
            type="button"
            disabled={isScanning}
            onClick={() => runAutoDetection(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-theme-600 hover:bg-theme-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Detecting VPS & Console..." : "Detect VPS & Console"}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isScanning && (
        <div className="mb-6 relative z-10">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono mb-1.5">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-theme-500" />
              </span>
              Detecting VPS Provider, Hypervisor, Virtualization & Console Subsystem...
            </span>
            <span className="font-bold text-theme-400">{scanProgress}%</span>
          </div>
          <div className="w-full bg-muted h-2 rounded-full overflow-hidden p-0.5 border border-border-subtle">
            <div
              className="h-full rounded-full bg-theme-500 transition-all duration-300 shadow-sm"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Highlighted VPS & Console Feature Cards */}
      {report && !isScanning && (
        <div className="mb-6 space-y-4 relative z-10">
          {/* Main Top Success Summary Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-foreground relative overflow-hidden">
            <div className="flex items-start justify-between gap-3.5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-emerald-400">
                      Detection Successful! (VPS & Console Detected)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                      Live & Verified
                    </span>
                  </div>
                  <p className="text-xs text-emerald-300/90 mt-1 leading-relaxed">
                    {report.headline}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => speakStatus(report.overallStatus === "error" ? "failed" : (report.summary?.missingCount > 0 ? "missing" : "successful"))}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-all text-xs font-semibold shrink-0 active:scale-95 cursor-pointer"
                title="Speak current status"
              >
                <Volume2 className="w-4 h-4" />
                <span>Hear Voice</span>
              </button>
            </div>
          </div>

          {/* Dual VPS & Console Spotlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: VPS / Cloud Provider */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-theme-500/10 via-card to-background border border-theme-500/30 relative overflow-hidden flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-theme-500/20 border border-theme-500/40 flex items-center justify-center text-theme-400">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-theme-400 font-bold">
                        Detected VPS Platform
                      </span>
                      <h4 className="text-sm font-bold text-foreground">
                        {report.vps?.providerName || "Standard Linux VPS"}
                      </h4>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-theme-500/20 text-theme-300 border border-theme-500/30 font-semibold uppercase">
                    {report.vps?.hypervisor || "KVM"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {report.vps?.details || "Linux virtual private server environment active."}
                </p>
              </div>

              <div className="pt-3 border-t border-border-subtle/50 flex flex-wrap items-center gap-3 text-[11px] font-mono text-muted-foreground">
                <span>CPU: <strong className="text-foreground">{report.environment.hardware?.cpuCores} Cores</strong></span>
                <span>•</span>
                <span>RAM: <strong className="text-foreground">{report.environment.hardware?.totalMemoryGB} GB</strong></span>
                <span>•</span>
                <span>OS: <strong className="text-foreground">{report.environment.distro}</strong></span>
              </div>
            </div>

            {/* Card 2: Interactive Terminal Console */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-card to-background border border-emerald-500/30 relative overflow-hidden flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                        Detected Console Subsystem
                      </span>
                      <h4 className="text-sm font-bold text-foreground">
                        {report.console?.consoleType || "Interactive Web Console"}
                      </h4>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold uppercase">
                    Active
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {report.console?.details || "Virtual terminal attached with live stdout/stdin stream support."}
                </p>
              </div>

              <div className="pt-3 border-t border-border-subtle/50 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="text-muted-foreground">Shell:</span>
                <span className="text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {report.console?.shell || "/bin/bash"}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  (Stdout Stream & ANSI Color Ready)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === "all"
                ? "bg-theme-500 text-white shadow-sm shadow-theme-500/20"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            All Details ({report?.items.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter("vps")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === "vps"
                ? "bg-theme-600 text-white"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            VPS & Virtualization
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter("console")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === "console"
                ? "bg-emerald-600 text-white"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            Console Engine
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter("hardware")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedFilter === "hardware"
                ? "bg-amber-600 text-white"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            VPS Specs & Network
          </button>
        </div>

        <div className="text-[11px] font-mono text-muted-foreground">
          Architecture & Console Diagnostics Matrix
        </div>
      </div>

      {/* Detection Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 relative z-10">
        {filteredItems.map((item) => {
          const isDetected = item.status === "detected";
          const isMissing = item.status === "missing";

          return (
            <div
              key={item.id}
              onClick={() => speakStatus(isDetected ? "successful" : "missing")}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer active:scale-[0.99] ${
                isDetected
                  ? "bg-muted/30 border-border-subtle hover:border-theme-500/30"
                  : isMissing
                  ? "bg-rose-500/5 border-rose-500/30 hover:border-rose-500/50"
                  : "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50"
              }`}
              title={isDetected ? "Click to hear status: Successful" : "Click to hear status: Yeh add nahi hai"}
            >
              <div>
                {/* Item Top Row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-background/80 border border-border-subtle flex items-center justify-center">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{item.name}</h4>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border flex items-center gap-1 shrink-0 ${
                      isDetected
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : isMissing
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {isDetected ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Detected</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        <span>Yeh Add Nahi Hai</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Detected Value */}
                {item.value && (
                  <div className="mt-1 mb-2">
                    <span
                      className="text-xs font-mono font-semibold px-2 py-1 rounded-md inline-block max-w-full truncate bg-background/80 text-foreground border border-border-subtle"
                      title={item.value}
                    >
                      {item.value}
                    </span>
                  </div>
                )}

                {/* Details text */}
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  {item.details}
                </p>
              </div>

              {item.actionHint && (
                <div className="mt-3 pt-2.5 border-t border-border-subtle/40 flex items-start gap-1.5 text-[11px] text-amber-300/80">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{item.actionHint}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
