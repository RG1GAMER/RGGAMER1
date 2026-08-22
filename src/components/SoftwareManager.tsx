import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Puzzle,
  Settings,
  Wrench,
  Layers,
  CheckCircle2,
  Tag,
  ArrowLeft,
  Download,
  ExternalLink,
  Info,
  RefreshCw,
  AlertTriangle,
  Check,
  Zap,
  Flame,
  FileCode,
  ShieldCheck,
  ChevronRight
} from "lucide-react";

export interface SoftwareItem {
  id: string;
  name: string;
  category: "java" | "bedrock" | "other";
  badge?: string;
  badgeType?: "plugin" | "mod" | "hybrid";
  icon: any;
  description: string;
  website: string;
  defaultJar: string;
}

export const SOFTWARE_CATALOG: SoftwareItem[] = [
  // Java Edition
  {
    id: "vanilla",
    name: "Vanilla",
    category: "java",
    icon: Box,
    description: "The official unmodified Minecraft server provided directly by Mojang Studios.",
    website: "https://www.minecraft.net/",
    defaultJar: "server.jar"
  },
  {
    id: "snapshot",
    name: "Snapshot",
    category: "java",
    icon: Box,
    description: "Weekly development test builds from Mojang to test upcoming features before official release.",
    website: "https://www.minecraft.net/",
    defaultJar: "server.jar"
  },
  {
    id: "paper",
    name: "Paper/Bukkit",
    category: "java",
    badge: "For plugins",
    badgeType: "plugin",
    icon: CheckCircle2,
    description: "Paper is the next generation of Minecraft server, compatible with Spigot plugins and offering uncompromising performance.",
    website: "https://papermc.io/",
    defaultJar: "paper.jar"
  },
  {
    id: "spigot",
    name: "Spigot/Bukkit",
    category: "java",
    badge: "For plugins",
    badgeType: "plugin",
    icon: Puzzle,
    description: "The classic Minecraft server software modified to support Bukkit and Spigot plugins with standard optimizations.",
    website: "https://www.spigotmc.org/",
    defaultJar: "spigot.jar"
  },
  {
    id: "purpur",
    name: "Purpur/Bukkit",
    category: "java",
    badge: "For plugins",
    badgeType: "plugin",
    icon: Puzzle,
    description: "Drop-in replacement for Paper servers designed for configurability, fun gameplay tweaks and top performance.",
    website: "https://purpurmc.org/",
    defaultJar: "purpur.jar"
  },
  {
    id: "fabric",
    name: "Fabric",
    category: "java",
    badge: "For mods",
    badgeType: "mod",
    icon: Settings,
    description: "Lightweight, experimental modding toolchain for Minecraft with fast load times and rapid update cycles.",
    website: "https://fabricmc.net/",
    defaultJar: "fabric-server-launch.jar"
  },
  {
    id: "quilt",
    name: "Quilt",
    category: "java",
    badge: "For mods",
    badgeType: "mod",
    icon: Settings,
    description: "Next-generation modular modding ecosystem compatible with most Fabric mods with enhanced developer tools.",
    website: "https://quiltmc.org/",
    defaultJar: "quilt-server-launch.jar"
  },
  {
    id: "neoforge",
    name: "NeoForge",
    category: "java",
    badge: "For mods",
    badgeType: "mod",
    icon: Settings,
    description: "Community-driven continuation and modern fork of Forge for modern Minecraft versions with improved APIs.",
    website: "https://neoforged.net/",
    defaultJar: "server.jar"
  },
  {
    id: "forge",
    name: "Forge",
    category: "java",
    badge: "For mods",
    badgeType: "mod",
    icon: Settings,
    description: "The traditional modding platform that powered Minecraft modpacks for over a decade.",
    website: "https://files.minecraftforge.net/",
    defaultJar: "forge-universal.jar"
  },
  {
    id: "modpacks",
    name: "Modpacks",
    category: "java",
    icon: Layers,
    description: "Custom curated collections of mods, quests, and configs ready for one-click server deployment.",
    website: "https://curseforge.com/minecraft/modpacks",
    defaultJar: "server.jar"
  },
  {
    id: "arclight",
    name: "Arclight",
    category: "java",
    badge: "For plugins/mods",
    badgeType: "hybrid",
    icon: Wrench,
    description: "High-performance hybrid server implementation that allows running Bukkit/Spigot plugins alongside Forge/Fabric mods.",
    website: "https://github.com/IzzelAliz/Arclight",
    defaultJar: "arclight.jar"
  },

  // Bedrock Edition
  {
    id: "bedrock",
    name: "Bedrock",
    category: "bedrock",
    icon: Box,
    description: "Official Minecraft Bedrock Dedicated Server (BDS) for Windows 10, Xbox, iOS, Android, and consoles.",
    website: "https://www.minecraft.net/download/server/bedrock",
    defaultJar: "bedrock_server"
  },
  {
    id: "bedrock_preview",
    name: "Bedrock Preview",
    category: "bedrock",
    icon: Box,
    description: "Bedrock dedicated server preview/beta release for testing unreleased features with Bedrock Preview clients.",
    website: "https://www.minecraft.net/download/server/bedrock",
    defaultJar: "bedrock_server"
  },
  {
    id: "pocketmine",
    name: "Pocketmine",
    category: "bedrock",
    badge: "For plugins",
    badgeType: "plugin",
    icon: Puzzle,
    description: "High performance custom C/PHP server software for Minecraft: Bedrock Edition with full plugin support.",
    website: "https://pmmp.io/",
    defaultJar: "PocketMine-MP.phar"
  }
];

export const SOFTWARE_BUILDS_MAP: { version: string; build: number }[] = [
  { version: "26.2", build: 112 },
  { version: "26.1.2", build: 74 },
  { version: "26.1.1", build: 29 },
  { version: "1.21.11", build: 132 },
  { version: "1.21.10", build: 130 },
  { version: "1.21.9", build: 59 },
  { version: "1.21.8", build: 60 },
  { version: "1.21.7", build: 32 },
  { version: "1.21.6", build: 48 },
  { version: "1.21.5", build: 114 },
  { version: "1.21.4", build: 232 },
  { version: "1.21.3", build: 83 },
  { version: "1.21.1", build: 133 },
  { version: "1.21", build: 130 },
  { version: "1.20.6", build: 151 },
  { version: "1.20.5", build: 22 },
  { version: "1.20.4", build: 499 },
  { version: "1.20.2", build: 318 },
  { version: "1.20.1", build: 196 },
  { version: "1.20", build: 17 },
  { version: "1.19.4", build: 550 },
  { version: "1.19.3", build: 448 },
  { version: "1.19.2", build: 307 },
  { version: "1.19.1", build: 111 },
  { version: "1.19", build: 81 },
  { version: "1.18.2", build: 388 },
  { version: "1.18.1", build: 216 },
  { version: "1.18", build: 66 },
  { version: "1.17.1", build: 411 },
  { version: "1.17", build: 79 },
  { version: "1.16.5", build: 794 },
  { version: "1.16.4", build: 416 },
  { version: "1.16.3", build: 253 },
  { version: "1.16.2", build: 189 },
  { version: "1.16.1", build: 138 },
  { version: "1.15.2", build: 393 },
  { version: "1.15.1", build: 62 },
  { version: "1.15", build: 21 },
  { version: "1.14.4", build: 245 },
  { version: "1.14.3", build: 134 },
  { version: "1.14.2", build: 107 },
  { version: "1.14.1", build: 50 },
  { version: "1.14", build: 17 },
  { version: "1.13.2", build: 657 },
  { version: "1.13.1", build: 386 },
  { version: "1.13", build: 173 },
  { version: "1.12.2", build: 1620 },
  { version: "1.11.2", build: 1106 },
  { version: "1.10.2", build: 918 },
  { version: "1.9.4", build: 775 },
  { version: "1.8.8", build: 445 },
  { version: "1.7.10", build: 2025 }
];

interface SoftwareManagerProps {
  serverId: string;
  server: any;
  onServerUpdated?: () => void;
}

export default function SoftwareManager({ serverId, server, onServerUpdated }: SoftwareManagerProps) {
  // Navigation State
  // "catalog" = Image 1 & 2
  // "versions" = Image 3
  // "install" = Image 4
  const [viewState, setViewState] = useState<"catalog" | "versions" | "install">("catalog");
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareItem>(SOFTWARE_CATALOG[2]); // Default Paper
  const [selectedVersionBuild, setSelectedVersionBuild] = useState<{ version: string; build: number }>(SOFTWARE_BUILDS_MAP[0]);
  
  const [cleanInstall, setCleanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatusText, setInstallStatusText] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const currentType = (server?.type || "paper").toLowerCase();
  const currentVersion = server?.version || "26.2";

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleSelectSoftware = (soft: SoftwareItem) => {
    setSelectedSoftware(soft);
    // If current server matches this software, try to match version
    const match = SOFTWARE_BUILDS_MAP.find(b => b.version === currentVersion) || SOFTWARE_BUILDS_MAP[0];
    setSelectedVersionBuild(match);
    setViewState("versions");
  };

  const handleSelectVersion = (item: { version: string; build: number }) => {
    setSelectedVersionBuild(item);
    setViewState("install");
  };

  const handleExecuteInstall = async () => {
    setIsInstalling(true);
    setInstallProgress(15);
    setInstallStatusText("Preparing software environment...");

    try {
      // 1. Send update request
      setInstallProgress(40);
      setInstallStatusText(`Downloading ${selectedSoftware.name} ${selectedVersionBuild.version} (Build #${selectedVersionBuild.build})...`);

      const payload: any = {
        type: selectedSoftware.id,
        version: selectedVersionBuild.version,
        serverJar: selectedSoftware.defaultJar,
        cleanInstall: cleanInstall
      };

      const res = await axios.put(`/api/servers/${serverId}`, payload);
      
      setInstallProgress(85);
      setInstallStatusText("Updating runtime container and permissions...");

      await new Promise(r => setTimeout(r, 600));

      setInstallProgress(100);
      setInstallStatusText("Installation complete!");
      
      triggerToast(`Successfully installed ${selectedSoftware.name} ${selectedVersionBuild.version}!`, "success");
      
      if (onServerUpdated) {
        onServerUpdated();
      }

      setTimeout(() => {
        setIsInstalling(false);
        setInstallProgress(0);
      }, 1000);
    } catch (err: any) {
      console.error("Software installation error:", err);
      setIsInstalling(false);
      setInstallProgress(0);
      triggerToast(err.response?.data?.error || err.message || "Failed to install software", "error");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pt-5 pb-12 px-4 sm:px-8 space-y-6 text-foreground bg-transparent custom-scrollbar">
      {/* Toast */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-2xl transition-all ${
            toast.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/90 border-rose-500/40 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {toast.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
            <span className="text-xs sm:text-sm font-mono font-bold">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-xs font-mono opacity-70 hover:opacity-100 underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* VIEW 1: SOFTWARE CATALOG (Image 1 & 2) */}
      {viewState === "catalog" && (
        <div className="space-y-8 animate-fadeIn">
          {/* Current Active Status Banner */}
          <div className="p-4 rounded-xl bg-theme-500/10 border border-theme-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-theme-500/20 text-theme-300 border border-theme-500/30 flex items-center justify-center font-bold font-mono">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-theme-400 font-bold">Installed Software</div>
                <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <span className="capitalize">{server?.type || "Paper"}</span>
                  <span className="text-slate-400 font-normal">v{server?.version || "26.2"}</span>
                </div>
              </div>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Select any software below to change or update server version.
            </div>
          </div>

          {/* Section 1: Java Edition */}
          <div className="space-y-4">
            <div className="border-b border-white/10 pb-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                Java Edition
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-6 pt-2">
              {SOFTWARE_CATALOG.filter(s => s.category === "java").map(soft => {
                const Icon = soft.icon;
                const isCurrent = currentType === soft.id.toLowerCase() || (soft.id === "paper" && currentType === "paper");
                
                return (
                  <button
                    key={soft.id}
                    onClick={() => handleSelectSoftware(soft)}
                    className="relative group p-6 rounded-2xl bg-zinc-950/70 hover:bg-zinc-900/90 border border-white/10 hover:border-theme-500/50 transition-all duration-200 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-theme-500/10 active:scale-98 min-h-[140px]"
                  >
                    {/* Badge like 'For plugins' or 'For mods' on top right */}
                    {soft.badge && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[11px] font-mono font-semibold text-blue-400">
                        <Info className="w-3 h-3 text-blue-400" />
                        <span>{soft.badge}</span>
                      </div>
                    )}

                    <div className="w-14 h-14 rounded-2xl bg-blue-900/30 text-blue-400 group-hover:text-blue-300 flex items-center justify-center mb-3 transition-colors">
                      <Icon className="w-8 h-8 stroke-[2]" />
                    </div>

                    <div className="text-base sm:text-lg font-bold font-mono text-blue-300 group-hover:text-white transition-colors">
                      {soft.name}
                    </div>

                    {isCurrent && (
                      <span className="mt-2 text-[10px] font-mono font-bold bg-theme-500/20 text-theme-300 border border-theme-500/40 px-2 py-0.5 rounded-md">
                        Current Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Bedrock Edition */}
          <div className="space-y-4 pt-4">
            <div className="border-b border-white/10 pb-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                Bedrock Edition (Win10/MCPE)
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-6 pt-2">
              {SOFTWARE_CATALOG.filter(s => s.category === "bedrock").map(soft => {
                const Icon = soft.icon;
                const isCurrent = currentType === soft.id.toLowerCase();
                
                return (
                  <button
                    key={soft.id}
                    onClick={() => handleSelectSoftware(soft)}
                    className="relative group p-6 rounded-2xl bg-zinc-950/70 hover:bg-zinc-900/90 border border-white/10 hover:border-theme-500/50 transition-all duration-200 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-theme-500/10 active:scale-98 min-h-[140px]"
                  >
                    {soft.badge && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[11px] font-mono font-semibold text-blue-400">
                        <Info className="w-3 h-3 text-blue-400" />
                        <span>{soft.badge}</span>
                      </div>
                    )}

                    <div className="w-14 h-14 rounded-2xl bg-blue-900/30 text-blue-400 group-hover:text-blue-300 flex items-center justify-center mb-3 transition-colors">
                      <Icon className="w-8 h-8 stroke-[2]" />
                    </div>

                    <div className="text-base sm:text-lg font-bold font-mono text-blue-300 group-hover:text-white transition-colors">
                      {soft.name}
                    </div>

                    {isCurrent && (
                      <span className="mt-2 text-[10px] font-mono font-bold bg-theme-500/20 text-theme-300 border border-theme-500/40 px-2 py-0.5 rounded-md">
                        Current Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: VERSION BUILD TAGS LIST (Image 3) */}
      {viewState === "versions" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewState("catalog")}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                title="Back to software list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                  {selectedSoftware.name}
                </h1>
                <p className="text-xs sm:text-sm font-mono text-slate-400">
                  Select a version build tag to install or view details.
                </p>
              </div>
            </div>

            <button
              onClick={() => setViewState("catalog")}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-slate-200 hover:text-white transition-all self-start sm:self-auto"
            >
              Change Software
            </button>
          </div>

          {/* Grid of Version Tags matching Image 3 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6 pt-2">
            {SOFTWARE_BUILDS_MAP.map((item, idx) => {
              const isServerActive = currentVersion === item.version && currentType === selectedSoftware.id.toLowerCase();
              const isLatestTop = idx === 0;

              return (
                <button
                  key={item.version}
                  onClick={() => handleSelectVersion(item)}
                  className={`group px-4 py-3 rounded-xl border transition-all duration-150 flex items-center gap-2.5 text-left font-mono ${
                    isServerActive
                      ? "bg-blue-950/80 border-blue-500 text-blue-300 shadow-md shadow-blue-500/20"
                      : "bg-zinc-950/80 hover:bg-zinc-900 border-white/10 hover:border-blue-400 text-blue-400 hover:text-blue-200"
                  }`}
                >
                  {isServerActive ? (
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  ) : (
                    <Tag className="w-4 h-4 text-blue-400 group-hover:text-blue-300 shrink-0" />
                  )}
                  
                  <span className="text-sm sm:text-base font-bold whitespace-nowrap">
                    {item.version} ({item.build})
                  </span>

                  {isLatestTop && (
                    <span className="ml-auto text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                      Latest
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: INSTALL & DETAIL VIEW (Image 4) */}
      {viewState === "install" && (
        <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
          {/* Top Bar with Software Title & Install Button */}
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewState("versions")}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                title="Back to versions"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                  {selectedSoftware.name}
                </h1>
              </div>
            </div>

            <button
              onClick={handleExecuteInstall}
              disabled={isInstalling}
              className="px-6 py-2.5 bg-white hover:bg-slate-200 text-black font-mono font-black text-sm rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isInstalling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 stroke-[3]" />
                  <span>Install</span>
                </>
              )}
            </button>
          </div>

          {/* Installation Progress Bar if installing */}
          {isInstalling && (
            <div className="p-4 rounded-xl bg-zinc-950 border border-theme-500/40 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-theme-400 font-bold flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {installStatusText}
                </span>
                <span className="text-white font-bold">{installProgress}%</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-theme-500 h-full transition-all duration-300 rounded-full shadow-lg shadow-theme-500/50"
                  style={{ width: `${installProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Prominent Card matching Image 4 with thick left border */}
          <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950/90 border border-white/10 border-l-4 border-l-white space-y-6 shadow-2xl">
            <p className="text-sm sm:text-base font-mono text-slate-200 leading-relaxed">
              {selectedSoftware.description}
            </p>

            <div>
              <a
                href={selectedSoftware.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm sm:text-base font-mono text-blue-400 hover:text-blue-300 hover:underline transition-colors font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{selectedSoftware.website}</span>
              </a>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-2 font-mono text-sm sm:text-base">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">Version:</span>
                <span className="text-white font-black">
                  {selectedVersionBuild.version} ({selectedVersionBuild.build})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">Minecraft Version:</span>
                <span className="text-white font-black">{selectedVersionBuild.version}</span>
              </div>
            </div>

            {/* Clean Install Checkbox */}
            <div className="pt-4 border-t border-white/10">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={cleanInstall}
                  onChange={(e) => setCleanInstall(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded bg-zinc-900 border-white/20 text-theme-500 focus:ring-0 focus:ring-offset-0"
                />
                <div>
                  <span className="text-xs sm:text-sm font-mono text-slate-200 font-bold group-hover:text-white">
                    Format/Clean old server files before install (Fresh install)
                  </span>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Recommended when switching between different software types (e.g. Spigot to Fabric) to prevent incompatible configs.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
