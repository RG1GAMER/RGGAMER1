import React, { useState, useEffect } from "react";
import { ExternalLink, X, ChevronRight, ChevronLeft, Zap, Radio, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface AdItem {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  ctaText: string;
  link: string;
  tag?: string;
  discount?: string;
}

export const DEFAULT_ADS: AdItem[] = [
  {
    id: "ad-1",
    badge: "FEATURED AD",
    badgeColor: "border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]",
    title: "⚡ RYZEN 9 7950X DEDICATED HOSTING",
    description: "Ultra-low latency NVMe Minecraft & game server nodes. 99.99% SLA uptime.",
    ctaText: "CLAIM 40% OFF ↗",
    link: "https://playit.gg",
    discount: "40% OFF",
    tag: "CLOUD NODES"
  },
  {
    id: "ad-2",
    badge: "SPONSORED",
    badgeColor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]",
    title: "🛡️ ENTERPRISE DDOS SHIELD v4",
    description: "Real-time layer 3/4/7 packet scrubbing. Zero downtime defense for game fleets.",
    ctaText: "LEARN MORE ↗",
    link: "https://playit.gg",
    discount: "ACTIVE",
    tag: "SECURITY"
  },
  {
    id: "ad-3",
    badge: "PARTNER PROMO",
    badgeColor: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]",
    title: "🌐 24/7 PLAYIT GLOBAL TUNNELING",
    description: "Public IP without opening router ports. Connect players worldwide seamlessly.",
    ctaText: "ACTIVATE TUNNEL ↗",
    link: "https://playit.gg",
    discount: "FREE TIER",
    tag: "NETWORKING"
  }
];

interface CornerAdWidgetProps {
  ads?: AdItem[];
  className?: string;
}

export default function CornerAdWidget({ ads = DEFAULT_ADS, className = "" }: CornerAdWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-slide ads every 6 seconds unless hovered or paused
  useEffect(() => {
    if (isMinimized || isDismissed || isPaused || ads.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [ads.length, isMinimized, isDismissed, isPaused]);

  if (isDismissed) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setIsDismissed(false)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-theme-500/30 bg-zinc-950/90 px-3 py-1.5 font-mono text-[11px] text-zinc-300 shadow-xl backdrop-blur-md transition-colors hover:border-theme-500 hover:text-white"
        title="Show Sponsored Corner Ad"
      >
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
        <span>SPONSOR AD</span>
        <Maximize2 className="h-3 w-3 text-zinc-400" />
      </motion.button>
    );
  }

  const currentAd = ads[currentIndex] || ads[0];

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 max-w-sm select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        {isMinimized ? (
          <motion.div
            key="minimized"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-zinc-950/95 px-3.5 py-2 shadow-[0_0_20px_rgba(245,158,11,0.15)] backdrop-blur-md cursor-pointer hover:border-amber-400"
            onClick={() => setIsMinimized(false)}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
            </span>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] font-bold tracking-widest text-amber-400">
                LIVE ADVERTISEMENT
              </span>
              <span className="truncate text-xs font-semibold text-zinc-200 max-w-[180px]">
                {currentAd.title}
              </span>
            </div>
            <Maximize2 className="ml-1 h-3.5 w-3.5 text-zinc-400 hover:text-white" />
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative overflow-hidden rounded-2xl border border-zinc-700/50 bg-zinc-950/95 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(var(--theme-rgb-600),0.15)] backdrop-blur-xl"
          >
            {/* Cyberpunk corner brackets */}
            <span className="absolute top-0 left-0 h-2.5 w-2.5 border-t-2 border-l-2 border-amber-400/80 pointer-events-none" />
            <span className="absolute top-0 right-0 h-2.5 w-2.5 border-t-2 border-r-2 border-amber-400/80 pointer-events-none" />
            <span className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2 border-amber-400/80 pointer-events-none" />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 border-amber-400/80 pointer-events-none" />

            {/* Glowing top line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />

            {/* Header row */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
                </span>
                <span className="font-mono text-[10px] font-bold tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Radio className="h-3 w-3 text-amber-400 animate-pulse" />
                  CORNER AD PROMO
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-widest border ${currentAd.badgeColor}`}>
                  {currentAd.badge}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                  title="Minimize Ad"
                >
                  <span className="block h-0.5 w-2.5 bg-current" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
                  title="Close Corner Ad"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Ad Content */}
            <div className="relative">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h4 className="font-sans font-bold text-sm text-zinc-100 leading-tight">
                  {currentAd.title}
                </h4>
                {currentAd.discount && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
                    {currentAd.discount}
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400 font-light leading-relaxed mb-3">
                {currentAd.description}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-900">
                <a
                  href={currentAd.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 font-mono text-[11px] font-bold text-zinc-950 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-[0.98]"
                >
                  <Zap className="h-3 w-3 fill-zinc-950" />
                  <span>{currentAd.ctaText}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>

                {/* Slides indicator & navigation */}
                <div className="flex items-center gap-1 text-zinc-500">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length)
                    }
                    className="p-1 hover:text-white transition-colors"
                    title="Previous Ad"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono text-[10px] text-zinc-400">
                    {currentIndex + 1}/{ads.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentIndex((prev) => (prev + 1) % ads.length)
                    }
                    className="p-1 hover:text-white transition-colors"
                    title="Next Ad"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
