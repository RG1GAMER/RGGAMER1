import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import {
  Cpu,
  HardDrive,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Layers,
  Radio,
  Clock,
  Sparkles,
  Gauge
} from "lucide-react";
import { formatBytesToDisplay, ServerResourceStats } from "../types/stats";

interface ServerResourceDashboardProps {
  serverId: string;
  server?: any;
  status?: string;
  limitRam?: number;
}

interface SparklineDataPoint {
  cpu: number;
  ramPercent: number;
  time: number;
}

export default function ServerResourceDashboard({
  serverId,
  server,
  status = "offline",
  limitRam = 2
}: ServerResourceDashboardProps) {
  const [stats, setStats] = useState<ServerResourceStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(2500); // 2.5s default
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("jtg_res_dash_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const [history, setHistory] = useState<SparklineDataPoint[]>([]);
  const isOnline = (server?.status || status) === "online";

  // Toggle collapse and save preference
  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("jtg_res_dash_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const fetchStats = useCallback(
    async (isManual = false) => {
      if (!serverId) return;
      if (isManual) setIsRefreshing(true);

      try {
        const res = await axios.get(`/api/servers/${serverId}/stats`);
        if (res.data) {
          const data: ServerResourceStats = res.data;
          setStats(data);

          // Calculate RAM % for history
          const safeLimitRamMB = (data.limitRam && data.limitRam > 0) ? data.limitRam : (limitRam * 1024);
          const usedRamMB = data.ram || (data.memory?.usedBytes ? data.memory.usedBytes / (1024 * 1024) : 0);
          const ramPercent = Math.max(0, Math.min(100, (usedRamMB / safeLimitRamMB) * 100));
          const cpuVal = typeof data.cpu === "number" ? data.cpu : (data.cpuStats?.percent || 0);

          setHistory((prev) => {
            const next = [...prev, { cpu: cpuVal, ramPercent, time: Date.now() }];
            return next.slice(-20); // Keep last 20 data points for live sparkline
          });
        }
      } catch (err) {
        // Non-blocking
      } finally {
        setLoading(false);
        if (isManual) {
          setTimeout(() => setIsRefreshing(false), 400);
        }
      }
    },
    [serverId, limitRam]
  );

  // Polling loop
  useEffect(() => {
    fetchStats();
    if (!isOnline || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchStats();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchStats, isOnline, refreshInterval]);

  // Derived metrics calculations
  const cpuPercent = useMemo(() => {
    if (!isOnline || !stats) return 0;
    const rawCpu = typeof stats.cpu === "number" ? stats.cpu : (stats.cpuStats?.percent || 0);
    return Math.max(0, parseFloat(rawCpu.toFixed(1)));
  }, [isOnline, stats]);

  const cpuLimit = useMemo(() => {
    return stats?.limitCpu || server?.cpu || 100;
  }, [stats, server]);

  const cpuLoadRatio = useMemo(() => {
    if (!isOnline || cpuLimit <= 0) return 0;
    return Math.min(100, Math.max(0, (cpuPercent / cpuLimit) * 100));
  }, [isOnline, cpuPercent, cpuLimit]);

  const ramUsedBytes = useMemo(() => {
    if (!isOnline || !stats) return 0;
    if (stats.memory?.usedBytes !== undefined) {
      return stats.memory.usedBytes;
    }
    return (stats.ram || 0) * 1024 * 1024;
  }, [isOnline, stats]);

  const ramLimitBytes = useMemo(() => {
    if (stats?.memory?.limitBytes && stats.memory.limitBytes > 0) {
      return stats.memory.limitBytes;
    }
    const gbs = typeof server?.ram === "number" && server.ram > 0 ? server.ram : limitRam;
    return gbs * 1024 * 1024 * 1024;
  }, [stats, server, limitRam]);

  const ramPercent = useMemo(() => {
    if (!isOnline || ramLimitBytes <= 0) return 0;
    const pct = (ramUsedBytes / ramLimitBytes) * 100;
    return Math.max(0, parseFloat(pct.toFixed(1)));
  }, [isOnline, ramUsedBytes, ramLimitBytes]);

  const isRamOverLimit = Boolean(stats?.memory?.overLimit || ramUsedBytes > ramLimitBytes);

  const diskUsedGB = useMemo(() => {
    if (!stats) return 0.05;
    return typeof stats.disk === "number" ? stats.disk : (stats.diskStats?.usedBytes ? stats.diskStats.usedBytes / (1024 * 1024 * 1024) : 0.05);
  }, [stats]);

  const diskLimitGB = useMemo(() => {
    return stats?.limitDisk || server?.disk || 10;
  }, [stats, server]);

  const diskPercent = useMemo(() => {
    if (diskLimitGB <= 0) return 0;
    return Math.min(100, Math.max(0, parseFloat(((diskUsedGB / diskLimitGB) * 100).toFixed(1))));
  }, [diskUsedGB, diskLimitGB]);

  const networkRxFormatted = useMemo(() => {
    return formatBytesToDisplay(stats?.network?.rxBytes || 0);
  }, [stats]);

  const networkTxFormatted = useMemo(() => {
    return formatBytesToDisplay(stats?.network?.txBytes || 0);
  }, [stats]);

  // Color helpers
  const getCpuColor = (ratio: number) => {
    if (!isOnline) return { text: "text-zinc-500", bar: "bg-zinc-700", glow: "border-zinc-800" };
    if (ratio >= 90) return { text: "text-rose-400", bar: "bg-rose-500", glow: "border-rose-500/40" };
    if (ratio >= 70) return { text: "text-amber-400", bar: "bg-amber-500", glow: "border-amber-500/40" };
    return { text: "text-theme-400", bar: "bg-theme-500", glow: "border-theme-500/40" };
  };

  const getRamColor = (pct: number, overLimit: boolean) => {
    if (!isOnline) return { text: "text-zinc-500", bar: "bg-zinc-700", glow: "border-zinc-800" };
    if (overLimit || pct >= 95) return { text: "text-rose-400", bar: "bg-rose-500", glow: "border-rose-500/40" };
    if (pct >= 80) return { text: "text-amber-400", bar: "bg-amber-500", glow: "border-amber-500/40" };
    return { text: "text-emerald-400", bar: "bg-emerald-500", glow: "border-emerald-500/40" };
  };

  const cpuColors = getCpuColor(cpuLoadRatio);
  const ramColors = getRamColor(ramPercent, isRamOverLimit);

  // Mini sparkline SVG renderer
  const renderSparkline = (dataKey: "cpu" | "ramPercent", strokeColor: string) => {
    if (history.length < 2) {
      return <div className="h-6 w-full opacity-20 flex items-center justify-center text-[9px] font-mono">Collecting live telemetry...</div>;
    }

    const width = 120;
    const height = 24;
    const maxVal = dataKey === "cpu" ? Math.max(100, ...history.map((h) => h.cpu)) : 100;
    const points = history
      .map((pt, i) => {
        const x = (i / (history.length - 1)) * width;
        const val = pt[dataKey];
        const y = height - (Math.min(maxVal, Math.max(0, val)) / maxVal) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    return (
      <svg className="w-full h-6 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="w-full bg-card/60 backdrop-blur-xl border-b border-theme-500/20 shadow-sm transition-all duration-300 relative z-10">
      {/* Header bar with Real-time Status, Quick Ticker & Controls */}
      <div className="px-3.5 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06]">
        {/* Left: Section Identity & Live Status Pulse */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-theme-500/10 border border-theme-500/30 text-theme-400 font-mono text-xs font-bold shadow-sm shadow-theme-500/10">
            <span className="relative flex h-2 w-2">
              {isOnline && refreshInterval > 0 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline ? "bg-theme-500" : "bg-zinc-600"
                }`}
              />
            </span>
            <span className="tracking-wide">
              {isOnline ? (refreshInterval > 0 ? "LIVE METRICS" : "MONITOR PAUSED") : "SERVER OFFLINE"}
            </span>
          </div>

          {/* Quick Real-Time Pill Ticker (when collapsed or compact) */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5" title="Current CPU Load">
              <Cpu className="w-3.5 h-3.5 text-theme-400" />
              <span className="text-muted-foreground hidden xs:inline">CPU:</span>
              <span className={`font-bold ${cpuColors.text}`}>
                {isOnline ? `${cpuPercent}%` : "0%"}
              </span>
            </div>

            <span className="text-white/20">•</span>

            <div className="flex items-center gap-1.5" title="Current Memory Allocation">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-muted-foreground hidden xs:inline">RAM:</span>
              <span className={`font-bold ${ramColors.text}`}>
                {isOnline ? `${ramPercent}%` : "0%"}
              </span>
              <span className="text-muted-foreground text-[10px] hidden sm:inline">
                ({formatBytesToDisplay(ramUsedBytes)} / {formatBytesToDisplay(ramLimitBytes)})
              </span>
            </div>

            {stats?.source && stats.source !== "unavailable" && (
              <>
                <span className="text-white/20 hidden md:inline">•</span>
                <span className="text-[10px] text-muted-foreground hidden md:inline uppercase bg-white/[0.04] px-2 py-0.5 rounded border border-white/10">
                  {stats.source.replace(/-/g, " ")}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Controls (Interval, Manual Refresh, Collapse Toggle) */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Refresh interval selector */}
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="bg-muted/80 hover:bg-muted text-foreground border border-border rounded-lg text-xs font-mono px-2 py-1 outline-none transition-colors cursor-pointer"
            title="Telemetry polling frequency"
          >
            <option value={1000}>1s (Ultra)</option>
            <option value={2500}>2.5s (Live)</option>
            <option value={5000}>5s (Normal)</option>
            <option value={0}>Paused</option>
          </select>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-muted/80 hover:bg-muted text-foreground border border-border transition-all active:scale-95 disabled:opacity-50"
            title="Refresh resource metrics now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-theme-400" : ""}`} />
          </button>

          {/* Expand / Collapse Dashboard Button */}
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/80 hover:bg-muted text-foreground border border-border text-xs font-medium transition-all active:scale-95"
            title={isCollapsed ? "Expand resource usage dashboard" : "Collapse resource usage dashboard"}
          >
            <span className="hidden sm:inline">{isCollapsed ? "Details" : "Hide"}</span>
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Metrics Grid */}
      {!isCollapsed && (
        <div className="p-3.5 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. CPU CONSUMPTION CARD */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border-subtle hover:border-theme-500/30 transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-theme-500/10 border border-theme-500/30 flex items-center justify-center text-theme-400 shadow-sm">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    CPU Consumption
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Allocation Cap: {cpuLimit}%
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                  !isOnline
                    ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                    : cpuLoadRatio >= 85
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    : cpuLoadRatio >= 60
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-theme-500/20 text-theme-300 border-theme-500/30"
                }`}
              >
                {!isOnline ? "Offline" : cpuLoadRatio >= 85 ? "Heavy" : cpuLoadRatio >= 60 ? "Moderate" : "Optimal"}
              </span>
            </div>

            {/* Percentage Display */}
            <div className="flex items-baseline justify-between mt-1 mb-2">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${cpuColors.text}`}>
                  {isOnline ? `${cpuPercent}%` : "0.0%"}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  / {cpuLimit}%
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono text-muted-foreground">
                  {isOnline ? `${cpuLoadRatio.toFixed(0)}% Load` : "Idle"}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden p-0.5 border border-white/10 mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${cpuColors.bar}`}
                style={{ width: `${Math.min(100, Math.max(isOnline ? 3 : 0, cpuLoadRatio))}%` }}
              />
            </div>

            {/* Sparkline Visualizer */}
            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-mono">Live Curve:</span>
              <div className="w-28">{renderSparkline("cpu", "#38bdf8")}</div>
            </div>
          </div>

          {/* 2. RAM / MEMORY CONSUMPTION CARD */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border-subtle hover:border-emerald-500/30 transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    RAM Consumption
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Allocated: {formatBytesToDisplay(ramLimitBytes)}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                  !isOnline
                    ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                    : isRamOverLimit
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse"
                    : ramPercent >= 80
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                }`}
              >
                {!isOnline ? "Offline" : isRamOverLimit ? "Over Limit" : ramPercent >= 80 ? "High" : "Healthy"}
              </span>
            </div>

            {/* Percentage Display */}
            <div className="flex items-baseline justify-between mt-1 mb-2">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${ramColors.text}`}>
                  {isOnline ? `${ramPercent}%` : "0.0%"}
                </span>
              </div>
              <div className="text-right font-mono text-xs text-foreground font-semibold truncate">
                {isOnline ? formatBytesToDisplay(ramUsedBytes) : "0 MB"}
                <span className="text-muted-foreground text-[10px] font-normal"> / {formatBytesToDisplay(ramLimitBytes)}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden p-0.5 border border-white/10 mb-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${ramColors.bar}`}
                style={{ width: `${Math.min(100, Math.max(isOnline ? 3 : 0, ramPercent))}%` }}
              />
            </div>

            {/* Sparkline Visualizer */}
            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-mono">Memory Trend:</span>
              <div className="w-28">{renderSparkline("ramPercent", "#34d399")}</div>
            </div>
          </div>

          {/* 3. STORAGE & DISK USAGE CARD */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border-subtle hover:border-amber-500/30 transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Storage Footprint
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Limit: {diskLimitGB} GB
                  </div>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border bg-amber-500/15 text-amber-300 border-amber-500/30">
                {diskPercent}% Used
              </span>
            </div>

            {/* Space Display */}
            <div className="flex items-baseline justify-between mt-1 mb-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-amber-400">
                  {diskUsedGB.toFixed(2)}
                  <span className="text-sm font-semibold ml-1">GB</span>
                </span>
              </div>
              <div className="text-right font-mono text-xs text-muted-foreground">
                {(diskLimitGB - diskUsedGB).toFixed(2)} GB Free
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden p-0.5 border border-white/10 mb-3">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(3, diskPercent))}%` }}
              />
            </div>

            {/* Storage Details */}
            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>World & Plugins</span>
              <span className="text-foreground font-semibold">{diskPercent}% of {diskLimitGB} GB</span>
            </div>
          </div>

          {/* 4. NETWORK & RUNTIME ACTIVITY CARD */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border-subtle hover:border-indigo-500/30 transition-all flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Network & I/O
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Runtime: {server?.runtimeType || "Direct"}
                  </div>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                isOnline ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" : "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}>
                {isOnline ? "Active" : "Closed"}
              </span>
            </div>

            {/* Network Traffic Numbers */}
            <div className="grid grid-cols-2 gap-2 my-1">
              <div className="p-2 rounded-xl bg-background/50 border border-white/[0.06]">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                  <ArrowDownRight className="w-3 h-3 text-emerald-400" />
                  Inbound (Rx)
                </div>
                <div className="text-sm font-bold font-mono text-foreground mt-0.5 truncate">
                  {isOnline ? networkRxFormatted : "0 MB"}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-background/50 border border-white/[0.06]">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                  <ArrowUpRight className="w-3 h-3 text-theme-400" />
                  Outbound (Tx)
                </div>
                <div className="text-sm font-bold font-mono text-foreground mt-0.5 truncate">
                  {isOnline ? networkTxFormatted : "0 MB"}
                </div>
              </div>
            </div>

            {/* Engine Source Badge */}
            <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>Engine Isolation</span>
              <span className="text-indigo-400 font-semibold truncate max-w-[130px]">
                {stats?.source === "docker-container" ? "Docker Sandbox" : "Local OpenJDK Process"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
