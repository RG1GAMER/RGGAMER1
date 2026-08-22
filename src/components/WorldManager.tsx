import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Globe,
  Upload,
  Download,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Archive,
  Loader2,
  Layers,
  Zap,
  SlidersHorizontal,
  FolderTree,
  PackageCheck,
  Plus,
  Play,
  Check,
  Flame,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  HardDrive,
  BookOpen,
  Info
} from "lucide-react";

interface WorldItem {
  name: string;
  displayName: string;
  dimension: "overworld" | "nether" | "the_end" | string;
  sizeMB: number;
  chunkCount: number;
  hasLevelDat: boolean;
  worldVersion: string;
  dataVersion: number;
  optimized: boolean;
  hasDatapacks: boolean;
  isPrimary: boolean;
}

export default function WorldManager({
  serverId,
  server,
  onNavigateToFileManager,
}: {
  serverId: string;
  server: any;
  onNavigateToFileManager?: (path?: string) => void;
}) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // World States
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [activeWorldName, setActiveWorldName] = useState<string>("world");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>("");

  // Modals
  const [showOptimizeModal, setShowOptimizeModal] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  // Guide accordion toggles
  const [openUploadGuide, setOpenUploadGuide] = useState(false);
  const [openOptimizeGuide, setOpenOptimizeGuide] = useState(false);

  // Generate State
  const [genSeed, setGenSeed] = useState("");
  const [genWorldType, setGenWorldType] = useState("DEFAULT");
  const [genHardcore, setGenHardcore] = useState(false);
  const [genStructures, setGenStructures] = useState(true);
  const [genTargetWorld, setGenTargetWorld] = useState("world");

  // Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [targetFolderName, setTargetFolderName] = useState<string>("world");
  const [autoUpdateProperties, setAutoUpdateProperties] = useState(true);

  const isServerRunning =
    server?.status === "online" ||
    server?.status === "running" ||
    server?.status === "starting";

  const fetchWorldData = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`/api/servers/${serverId}/worlds`);
      const rawData = res.data;
      let list: WorldItem[] = [];
      let activeName = "world";

      if (Array.isArray(rawData)) {
        list = rawData;
        const primary = rawData.find((w: any) => w.isPrimary);
        if (primary) activeName = primary.name;
      } else if (rawData && Array.isArray(rawData.worlds)) {
        list = rawData.worlds;
        activeName = rawData.activeWorld || "world";
      }

      // Ensure the standard trio (Overworld, Nether, End) always appears clearly
      const overworldItem = list.find(
        (w) => w.name === activeName || w.dimension === "overworld" || w.isPrimary
      ) || {
        name: activeName,
        displayName: "World (Overworld)",
        dimension: "overworld",
        sizeMB: 0,
        chunkCount: 0,
        hasLevelDat: true,
        worldVersion: "Latest",
        dataVersion: 3953,
        optimized: false,
        hasDatapacks: false,
        isPrimary: true,
      };

      const netherItem = list.find(
        (w) =>
          w.name === `${activeName}_nether` ||
          w.dimension === "nether" ||
          w.name.includes("nether")
      ) || {
        name: `${activeName}_nether`,
        displayName: "World Nether",
        dimension: "nether",
        sizeMB: 0,
        chunkCount: 0,
        hasLevelDat: false,
        worldVersion: "Latest",
        dataVersion: 3953,
        optimized: false,
        hasDatapacks: false,
        isPrimary: false,
      };

      const endItem = list.find(
        (w) =>
          w.name === `${activeName}_the_end` ||
          w.dimension === "the_end" ||
          w.name.includes("the_end") ||
          w.name.includes("end")
      ) || {
        name: `${activeName}_the_end`,
        displayName: "World End",
        dimension: "the_end",
        sizeMB: 0,
        chunkCount: 0,
        hasLevelDat: false,
        worldVersion: "Latest",
        dataVersion: 3953,
        optimized: false,
        hasDatapacks: false,
        isPrimary: false,
      };

      // Custom other worlds if any
      const otherWorlds = list.filter(
        (w) =>
          w.name !== overworldItem.name &&
          w.name !== netherItem.name &&
          w.name !== endItem.name
      );

      setWorlds([overworldItem, netherItem, endItem, ...otherWorlds]);
      setActiveWorldName(activeName);
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorldData();
  }, [serverId]);

  // Set Active World
  const handleSetActiveWorld = async (worldName: string) => {
    try {
      setIsProcessing(true);
      const res = await axios.post(`/api/servers/${serverId}/world/set-active`, { worldName });
      showToast(res.data?.message || `Active world switched to ${worldName}`, "success");
      await fetchWorldData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || "Failed to switch world", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Optimize World
  const handleOptimizeWorld = async (worldName: string) => {
    setIsProcessing(true);
    setProcessStep(`Optimizing world '${worldName}' (removing unused chunks & repairing region files)...`);
    try {
      const res = await axios.post(`/api/servers/${serverId}/world/optimize`, { worldName });
      showToast(res.data?.message || `World '${worldName}' optimized successfully!`, "success");
      setShowOptimizeModal(null);
      await fetchWorldData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || "Failed to optimize world", "error");
    } finally {
      setIsProcessing(false);
      setProcessStep("");
    }
  };

  // Generate World
  const handleGenerateWorld = async () => {
    setIsProcessing(true);
    setProcessStep(`Generating new world files for '${genTargetWorld}'...`);
    try {
      const res = await axios.post(`/api/servers/${serverId}/world/generate`, {
        worldName: genTargetWorld,
        seed: genSeed,
        worldType: genWorldType,
        hardcore: genHardcore,
        generateStructures: genStructures,
      });
      showToast(res.data?.message || `World '${genTargetWorld}' generated successfully!`, "success");
      setShowGenerateModal(null);
      await fetchWorldData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || "Failed to generate world", "error");
    } finally {
      setIsProcessing(false);
      setProcessStep("");
    }
  };

  // Upload World (.zip or folder)
  const handleUploadWorld = async () => {
    if (!uploadFile) return;

    setIsProcessing(true);
    setUploadProgress(0);

    try {
      if (isServerRunning) {
        setProcessStep("Stopping server safely before uploading world...");
        try {
          await axios.post(`/api/servers/${serverId}/stop`);
          await new Promise((r) => setTimeout(r, 1500));
        } catch (stopErr) {
          console.warn("Stop warning:", stopErr);
        }
      }

      setProcessStep("Uploading world archive...");
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("path", "/");

      await axios.post(`/api/servers/${serverId}/files/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      setUploadProgress(null);
      setProcessStep("Extracting world and configuring dimensions...");
      const chosenName = targetFolderName.trim() || "world";

      const importRes = await axios.post(`/api/servers/${serverId}/world/import`, {
        zipPath: uploadFile.name,
        targetFolderName: chosenName,
        autoUpdateProperties,
      });

      showToast(importRes.data?.message || `World uploaded into /${chosenName} successfully!`, "success");
      setUploadFile(null);
      setShowUploadModal(null);
      await fetchWorldData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || "Failed to import world", "error");
    } finally {
      setIsProcessing(false);
      setProcessStep("");
      setUploadProgress(null);
    }
  };

  // Delete World Dimension
  const handleDeleteDimension = async (worldName: string) => {
    setIsProcessing(true);
    try {
      await axios.post(`/api/servers/${serverId}/files/delete`, {
        paths: [`/${worldName}`],
      });
      showToast(`Dimension '${worldName}' reset/deleted successfully!`, "success");
      setShowDeleteModal(null);
      await fetchWorldData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || "Failed to delete dimension", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar w-full p-4 sm:p-6 md:p-8 space-y-6 max-w-5xl mx-auto text-foreground">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 sm:right-6 sm:bottom-6 sm:max-w-md px-4 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-semibold z-50 animate-in fade-in slide-in-from-bottom-5 border backdrop-blur-md ${
            toast.type === "error"
              ? "bg-rose-950/95 text-rose-200 border-rose-500/40"
              : "bg-emerald-950/95 text-emerald-200 border-emerald-500/40"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* HEADER (Exact Screenshot Style) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Pink/Red Globe Outline Icon */}
            <div className="w-8 h-8 rounded-full border border-rose-500/30 bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
              <Globe className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
              Worlds
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setGenTargetWorld("world");
                setShowGenerateModal("world");
              }}
              className="px-4 py-2 bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/40 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all flex items-center gap-2 active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Generate World
            </button>

            <button
              onClick={fetchWorldData}
              className="p-2 bg-transparent hover:bg-white/5 text-slate-200 border border-white/20 hover:border-white/40 rounded-xl transition-all shadow-sm active:scale-95"
              title="Refresh worlds"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-rose-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Subtitle in clean monospace */}
        <p className="text-xs sm:text-sm font-mono text-slate-400">
          Manage your Minecraft server dimensions: Overworld, Nether, and The End.
        </p>

        {/* Thin Divider Line */}
        <div className="h-px bg-white/10 w-full pt-1" />
      </div>

      {/* Warning when server is running */}
      {isServerRunning && (
        <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-xs sm:text-sm text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Server is Online:</strong> Generating or uploading new world files will automatically stop the server to prevent chunk file corruption.
          </span>
        </div>
      )}

      {/* DIMENSION CARDS CONTAINER (Clean Single-Line Format per World) */}
      <div className="space-y-3">
        {/* CARD 1: OVERWORLD */}
        {(() => {
          const overworld = worlds.find((w) => w.dimension === "overworld" || w.isPrimary) || worlds[0];
          const name = overworld?.name || "world";
          const size = overworld?.sizeMB || 0;
          const chunkCount = overworld?.chunkCount || 0;

          return (
            <div className="bg-zinc-950/90 backdrop-blur-xl border border-white/15 hover:border-white/25 rounded-2xl p-4 sm:p-5 transition-all shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Wireframe Globe Icon + Title & Badges + Inline Concise Metadata */}
                <div className="flex items-center gap-3.5 min-w-0 flex-wrap sm:flex-nowrap">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                    <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-white font-mono whitespace-nowrap">
                      World (Overworld)
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border border-white/20 bg-zinc-900 text-slate-300">
                      Overworld
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                      Active World
                    </span>
                    <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 pl-1">
                      <span>•</span>
                      <span>Folder: /{name}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        {size} MB
                      </span>
                      <span>•</span>
                      <span>{chunkCount} {chunkCount === 1 ? "region file" : "region files"}</span>
                    </div>
                  </div>
                </div>

                {/* Mobile-only metadata line */}
                <div className="flex sm:hidden items-center gap-2 text-xs font-mono text-slate-400 flex-wrap -mt-2">
                  <span>Folder: /{name}</span>
                  <span>•</span>
                  <span>{size} MB</span>
                  <span>•</span>
                  <span>{chunkCount} {chunkCount === 1 ? "region" : "regions"}</span>
                </div>

                {/* Right: Action Buttons Group */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Upload */}
                  <button
                    onClick={() => {
                      setTargetFolderName(name);
                      setShowUploadModal(name);
                    }}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/30 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>

                  {/* Download */}
                  <a
                    href={`/api/servers/${serverId}/world/download?worldName=${encodeURIComponent(name)}`}
                    download={`${name}.zip`}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-rose-500/10 text-rose-300/80 hover:text-rose-200 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>

                  {/* Generate */}
                  <button
                    onClick={() => {
                      setGenTargetWorld(name);
                      setShowGenerateModal(name);
                    }}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/30 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Generate
                  </button>

                  {/* Optimize */}
                  <button
                    onClick={() => setShowOptimizeModal(name)}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-amber-500/10 text-amber-300/90 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Optimize
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* CARD 2: NETHER */}
        {(() => {
          const nether = worlds.find((w) => w.dimension === "nether" || w.name.includes("nether")) || worlds[1];
          const name = nether?.name || "world_nether";
          const size = nether?.sizeMB || 0;
          const chunkCount = nether?.chunkCount || 0;

          return (
            <div className="bg-zinc-950/90 backdrop-blur-xl border border-white/15 hover:border-white/25 rounded-2xl p-4 sm:p-5 transition-all shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Flame Icon + Title & Badges + Inline Concise Metadata */}
                <div className="flex items-center gap-3.5 min-w-0 flex-wrap sm:flex-nowrap">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-center shrink-0 text-rose-500 shadow-inner">
                    <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-white font-mono whitespace-nowrap">
                      World Nether
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border border-white/20 bg-zinc-900 text-slate-300">
                      Nether
                    </span>
                    <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 pl-1">
                      <span>•</span>
                      <span>Folder: /{name}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        {size} MB
                      </span>
                      <span>•</span>
                      <span>{chunkCount} {chunkCount === 1 ? "region file" : "region files"}</span>
                    </div>
                  </div>
                </div>

                {/* Mobile-only metadata line */}
                <div className="flex sm:hidden items-center gap-2 text-xs font-mono text-slate-400 flex-wrap -mt-2">
                  <span>Folder: /{name}</span>
                  <span>•</span>
                  <span>{size} MB</span>
                  <span>•</span>
                  <span>{chunkCount} {chunkCount === 1 ? "region" : "regions"}</span>
                </div>

                {/* Right: Action Buttons Group */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Upload */}
                  <button
                    onClick={() => {
                      setTargetFolderName(name);
                      setShowUploadModal(name);
                    }}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/30 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>

                  {/* Download */}
                  <a
                    href={`/api/servers/${serverId}/world/download?worldName=${encodeURIComponent(name)}`}
                    download={`${name}.zip`}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-rose-500/10 text-rose-300/80 hover:text-rose-200 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>

                  {/* Generate */}
                  <button
                    onClick={() => {
                      setGenTargetWorld(name);
                      setShowGenerateModal(name);
                    }}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/30 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Generate
                  </button>

                  {/* Optimize */}
                  <button
                    onClick={() => setShowOptimizeModal(name)}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-amber-500/10 text-amber-300/90 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Optimize
                  </button>

                  {/* Play / Reset Icon Button */}
                  <button
                    onClick={() => handleOptimizeWorld(name)}
                    className="p-1.5 bg-transparent hover:bg-white/5 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 rounded-xl transition-all shadow-sm active:scale-95"
                    title="Reload dimension chunks"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>

                  {/* Trash Icon Button */}
                  <button
                    onClick={() => setShowDeleteModal(name)}
                    className="p-1.5 bg-transparent hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-white/20 hover:border-rose-500/40 rounded-xl transition-all shadow-sm active:scale-95"
                    title="Delete / Reset Nether Dimension"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* CARD 3: THE END */}
        {(() => {
          const end = worlds.find((w) => w.dimension === "the_end" || w.name.includes("end")) || worlds[2];
          const name = end?.name || "world_the_end";
          const size = end?.sizeMB || 0;
          const chunkCount = end?.chunkCount || 0;

          return (
            <div className="bg-zinc-950/90 backdrop-blur-xl border border-white/15 hover:border-white/25 rounded-2xl p-4 sm:p-5 transition-all shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Star / Sparkle Icon + Title & Badges + Inline Concise Metadata */}
                <div className="flex items-center gap-3.5 min-w-0 flex-wrap sm:flex-nowrap">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-400 shadow-inner">
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-white font-mono whitespace-nowrap">
                      World End
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border border-white/20 bg-zinc-900 text-slate-300">
                      The End
                    </span>
                    <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 pl-1">
                      <span>•</span>
                      <span>Folder: /{name}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        {size} MB
                      </span>
                      <span>•</span>
                      <span>{chunkCount} {chunkCount === 1 ? "region file" : "region files"}</span>
                    </div>
                  </div>
                </div>

                {/* Mobile-only metadata line */}
                <div className="flex sm:hidden items-center gap-2 text-xs font-mono text-slate-400 flex-wrap -mt-2">
                  <span>Folder: /{name}</span>
                  <span>•</span>
                  <span>{size} MB</span>
                  <span>•</span>
                  <span>{chunkCount} {chunkCount === 1 ? "region" : "regions"}</span>
                </div>

                {/* Right: Action Buttons Group */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Upload */}
                  <button
                    onClick={() => {
                      setTargetFolderName(name);
                      setShowUploadModal(name);
                    }}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/30 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </button>

                  {/* Download */}
                  <a
                    href={`/api/servers/${serverId}/world/download?worldName=${encodeURIComponent(name)}`}
                    download={`${name}.zip`}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-rose-500/10 text-rose-300/80 hover:text-rose-200 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>

                  {/* Generate */}
                  <button
                    onClick={() => {
                      setGenTargetWorld(name);
                      setShowGenerateModal(name);
                    }}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-white/5 text-white border border-white/20 hover:border-white/30 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Generate
                  </button>

                  {/* Optimize */}
                  <button
                    onClick={() => setShowOptimizeModal(name)}
                    className="px-3.5 py-1.5 bg-transparent hover:bg-amber-500/10 text-amber-300/90 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Optimize
                  </button>

                  {/* Play / Reset Icon Button */}
                  <button
                    onClick={() => handleOptimizeWorld(name)}
                    className="p-1.5 bg-transparent hover:bg-white/5 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 rounded-xl transition-all shadow-sm active:scale-95"
                    title="Reload dimension chunks"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>

                  {/* Trash Icon Button */}
                  <button
                    onClick={() => setShowDeleteModal(name)}
                    className="p-1.5 bg-transparent hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-white/20 hover:border-rose-500/40 rounded-xl transition-all shadow-sm active:scale-95"
                    title="Delete / Reset End Dimension"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* OPTIMIZE MODAL */}
      {showOptimizeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/20 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-mono">World option: Optimize</h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Target dimension: <code className="text-amber-400 font-bold">/{showOptimizeModal}</code>
                </p>
              </div>
            </div>

            <div className="p-4 bg-black/60 border border-white/10 rounded-2xl text-xs text-slate-300 space-y-2 font-mono">
              <p className="font-bold text-white">Optimize Execution:</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>Detects and purges empty chunks generated around players.</li>
                <li>Cleans stale <code className="text-zinc-200">session.lock</code> files.</li>
                <li>Reduces world folder storage footprint and boosts chunk load speed.</li>
              </ul>
            </div>

            {isProcessing && processStep && (
              <div className="p-3 bg-theme-500/10 border border-theme-500/20 rounded-xl text-xs font-mono text-theme-300 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-theme-400" />
                <span>{processStep}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowOptimizeModal(null)}
                disabled={isProcessing}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-mono font-bold border border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleOptimizeWorld(showOptimizeModal)}
                disabled={isProcessing}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 shadow-lg shadow-amber-600/30 active:scale-95"
              >
                {isProcessing ? "Optimizing..." : "Start Optimize"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE WORLD MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/20 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-theme-500/20 text-theme-400 rounded-2xl">
                <SlidersHorizontal className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-mono">Generate World</h3>
                <p className="text-xs text-slate-400 font-mono">Configure seeds, biome types, and terrain structures</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-200 mb-1">World Folder Name</label>
                <input
                  type="text"
                  value={genTargetWorld}
                  onChange={(e) => setGenTargetWorld(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 focus:border-theme-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  placeholder="world or survival"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-200 mb-1">World Seed (Optional)</label>
                <input
                  type="text"
                  value={genSeed}
                  onChange={(e) => setGenSeed(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 focus:border-theme-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  placeholder="Leave blank for random generation"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-200 mb-1">World Type</label>
                <select
                  value={genWorldType}
                  onChange={(e) => setGenWorldType(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 focus:border-theme-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                >
                  <option value="DEFAULT">Default (Normal Terrain)</option>
                  <option value="FLAT">Flat (Superflat)</option>
                  <option value="LARGE_BIOMES">Large Biomes</option>
                  <option value="AMPLIFIED">Amplified (Extreme Mountains)</option>
                  <option value="SINGLE_BIOME_SURFACE">Single Biome</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={genStructures}
                    onChange={(e) => setGenStructures(e.target.checked)}
                    className="w-4 h-4 rounded text-theme-600"
                  />
                  <span>Generate Structures</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={genHardcore}
                    onChange={(e) => setGenHardcore(e.target.checked)}
                    className="w-4 h-4 rounded text-theme-600"
                  />
                  <span>Hardcore Mode</span>
                </label>
              </div>
            </div>

            {isProcessing && processStep && (
              <div className="p-3 bg-theme-500/10 border border-theme-500/20 rounded-xl text-xs font-mono text-theme-300 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-theme-400" />
                <span>{processStep}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowGenerateModal(null)}
                disabled={isProcessing}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-mono font-bold border border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateWorld}
                disabled={isProcessing}
                className="px-5 py-2 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 shadow-lg shadow-theme-600/30 active:scale-95"
              >
                {isProcessing ? "Generating..." : "Generate New World"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD WORLD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/20 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-mono">Upload World</h3>
                <p className="text-xs text-slate-400 font-mono">Upload a custom Minecraft map archive (.zip)</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-200 mb-1">Target Dimension Folder</label>
                <input
                  type="text"
                  value={targetFolderName}
                  onChange={(e) => setTargetFolderName(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 focus:border-theme-500 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
                  placeholder="world or world_nether"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-200 mb-1">Select .zip Archive</label>
                <label className="p-6 border-2 border-dashed border-white/20 hover:border-theme-500 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-black/40 hover:bg-black/60 transition-all text-center block">
                  <Archive className="w-8 h-8 text-slate-400" />
                  <span className="text-xs font-mono font-bold text-white">
                    {uploadFile ? uploadFile.name : "Click to browse world .zip archive"}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Supports .zip containing level.dat and region/
                  </span>
                  <input
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoUpdateProperties}
                    onChange={(e) => setAutoUpdateProperties(e.target.checked)}
                    className="w-4 h-4 rounded text-theme-600"
                  />
                  <span>Set as active level-name in server.properties</span>
                </label>
              </div>
            </div>

            {uploadProgress !== null && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-theme-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {isProcessing && processStep && (
              <div className="p-3 bg-theme-500/10 border border-theme-500/20 rounded-xl text-xs font-mono text-theme-300 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-theme-400" />
                <span>{processStep}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowUploadModal(null)}
                disabled={isProcessing}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-mono font-bold border border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadWorld}
                disabled={isProcessing || !uploadFile}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? "Uploading & Extracting..." : "Upload & Apply World"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE / RESET MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-rose-500/30 p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-mono">Reset Dimension?</h3>
                <p className="text-xs text-slate-400 font-mono">Folder: /{showDeleteModal}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Are you sure you want to delete or reset this dimension directory? All region chunks, block changes, and entity data in this dimension will be cleared. Minecraft will regenerate clean terrain next time players enter.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowDeleteModal(null)}
                disabled={isProcessing}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-mono font-bold border border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDimension(showDeleteModal)}
                disabled={isProcessing}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-lg shadow-rose-600/30 active:scale-95"
              >
                {isProcessing ? "Resetting..." : "Confirm Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
