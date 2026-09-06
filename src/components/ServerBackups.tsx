import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  Archive, 
  Download, 
  Trash2, 
  RefreshCw, 
  Plus, 
  Clock, 
  FileArchive, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw,
  Sparkles,
  Layers,
  UploadCloud,
  FileUp,
  Settings,
  Gamepad2,
  Compass,
  Puzzle,
  Sliders,
  ShieldCheck,
  Info,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

interface Backup {
  filename: string;
  size: number;
  createdAt: string;
}

interface RestoreSummary {
  serverName?: string;
  motd?: string;
  gamemode?: string;
  difficulty?: string;
  activeWorld?: string;
  maxPlayers?: number;
  detectedSoftware?: string;
  pluginsFound?: number;
  modsFound?: number;
  worldsFound?: string[];
  configsFound?: number;
  totalFilesRestored?: number;
}

export default function ServerBackups({ serverId }: { serverId: string }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [includeCache, setIncludeCache] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("Initializing backup...");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [deleteFilename, setDeleteFilename] = useState<string | null>(null);
  const [restoreFilename, setRestoreFilename] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStage, setRestoreStage] = useState("Initializing restore...");

  // External Backup Upload States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("Uploading archive...");
  const [restoreImmediately, setRestoreImmediately] = useState(true);
  const [preservePort, setPreservePort] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [restoreResultSummary, setRestoreResultSummary] = useState<RestoreSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/servers/${serverId}/backups`);
      setBackups(res.data);
    } catch (e) {
      console.error("Fetch backups error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [serverId]);

  const handleCreateBackup = async () => {
    setStatusMsg(null);
    setIsCreating(true);
    setBackupProgress(10);
    setProgressStage("Scanning worlds, plugins, and configs...");

    let intervalId: NodeJS.Timeout | null = null;

    try {
      intervalId = setInterval(() => {
        setBackupProgress((prev) => {
          if (prev < 35) {
            setProgressStage("Analyzing server directory structures...");
            return prev + 5;
          } else if (prev < 70) {
            setProgressStage(includeCache ? "Compressing full server files & runtime..." : "Compressing worlds, configurations, and plugins...");
            return prev + 4;
          } else if (prev < 92) {
            setProgressStage("Finalizing ZIP archive...");
            return prev + 2;
          }
          return prev;
        });
      }, 350);

      await axios.post(`/api/servers/${serverId}/backups`, { includeCache });

      if (intervalId) clearInterval(intervalId);
      setBackupProgress(100);
      setProgressStage("Backup generated successfully!");
      
      await new Promise((r) => setTimeout(r, 500));
      await fetchBackups();
      setStatusMsg({ text: "Backup created successfully.", type: "success" });
    } catch (e: any) {
      if (intervalId) clearInterval(intervalId);
      setStatusMsg({ text: e.response?.data?.error || "Failed to create backup.", type: "error" });
      console.error("Backup creation error:", e);
    } finally {
      setIsCreating(false);
      setBackupProgress(0);
      setProgressStage("");
    }
  };

  const handleDownload = (filename: string) => {
    const token = localStorage.getItem("jtg_token") || localStorage.getItem("token");
    const downloadUrl = `/api/servers/${serverId}/backups/${encodeURIComponent(filename)}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    
    setStatusMsg({ text: `Downloading ${filename}...`, type: "success" });

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (filename: string) => {
    setDeleteFilename(null);
    setStatusMsg(null);
    try {
      await axios.delete(`/api/servers/${serverId}/backups/${encodeURIComponent(filename)}`);
      await fetchBackups();
      setStatusMsg({ text: "Backup deleted.", type: "success" });
    } catch (e: any) {
      setStatusMsg({ text: e.response?.data?.error || "Failed to delete backup.", type: "error" });
    }
  };

  const handleRestore = async (filename: string) => {
    setIsRestoring(true);
    setStatusMsg(null);
    setRestoreProgress(10);
    setRestoreStage("Stopping server & preparing filesystem...");

    let intervalId: NodeJS.Timeout | null = null;
    intervalId = setInterval(() => {
      setRestoreProgress((prev) => {
        if (prev < 30) {
          setRestoreStage("Unpacking compressed backup archive...");
          return prev + 5;
        } else if (prev < 70) {
          setRestoreStage("Restoring worlds, configs, and plugins...");
          return prev + 4;
        } else if (prev < 92) {
          setRestoreStage("Applying server.properties & verifying layout...");
          return prev + 2;
        }
        return prev;
      });
    }, 300);

    try {
      const res = await axios.post(`/api/servers/${serverId}/backups/${encodeURIComponent(filename)}/restore`);
      if (intervalId) clearInterval(intervalId);
      setRestoreProgress(100);
      setRestoreStage("Server restored & settings synchronized!");
      setRestoreFilename(null);
      
      if (res.data?.details) {
        setRestoreResultSummary(res.data.details);
      }

      await new Promise((r) => setTimeout(r, 600));
      await fetchBackups();
      setStatusMsg({ text: "Server restored successfully and all settings synchronized!", type: "success" });
    } catch (e: any) {
      if (intervalId) clearInterval(intervalId);
      setStatusMsg({ text: e.response?.data?.error || "Failed to restore backup.", type: "error" });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(0);
      setRestoreStage("");
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".zip") || file.name.endsWith(".tar.gz") || file.name.endsWith(".tgz") || file.name.endsWith(".tar")) {
        setSelectedFile(file);
      } else {
        setStatusMsg({ text: "Please select a valid .zip or compressed backup archive.", type: "error" });
      }
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStage("Uploading external backup archive...");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("action", restoreImmediately ? "restore_and_apply" : "save_backup");
    formData.append("preservePort", preservePort ? "true" : "false");

    try {
      const res = await axios.post(`/api/servers/${serverId}/backups/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(Math.min(percent, 85));
            if (percent >= 85) {
              setUploadStage(restoreImmediately ? "Extracting, normalizing worlds & synchronizing settings..." : "Saving backup to server repository...");
            }
          }
        },
      });

      setUploadProgress(100);
      setUploadStage(restoreImmediately ? "Configuration applied successfully!" : "Backup saved successfully!");
      
      await new Promise((r) => setTimeout(r, 600));

      if (res.data?.details) {
        setRestoreResultSummary(res.data.details);
      }

      setIsUploadModalOpen(false);
      setSelectedFile(null);
      await fetchBackups();
      setStatusMsg({ 
        text: res.data.message || (restoreImmediately ? "External backup restored and all settings configured!" : "Backup archive saved successfully."), 
        type: "success" 
      });
    } catch (err: any) {
      console.error("Backup upload error:", err);
      setStatusMsg({ 
        text: err.response?.data?.error || "Failed to upload and apply backup archive.", 
        type: "error" 
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage("");
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 text-foreground">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground-muted mb-1 flex items-center gap-2.5">
              <Archive className="w-6 h-6 text-theme-500" /> Server Backups & Migration
            </h2>
            <p className="text-sm text-muted-foreground">
              Create local backups or upload external server backups (Aternos, Falix, Pterodactyl, etc.) with automatic configuration setup.
            </p>
          </div>
          <button
            onClick={fetchBackups}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted-hover text-muted-foreground hover:text-foreground text-xs font-medium rounded-lg transition-colors border border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh List
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className={`p-4 rounded-xl border text-sm flex items-center justify-between shadow-md ${
            statusMsg.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}>
            <div className="flex items-center gap-2">
              {statusMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)} className="text-xs opacity-70 hover:opacity-100 ml-3 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Restore Result Summary Card (Shown when settings are detected & applied) */}
        {restoreResultSummary && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/90 border border-theme-500/40 rounded-xl p-5 shadow-xl space-y-4 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-theme-500/20 text-theme-400 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    Backup Restored & Configured Successfully!
                  </h4>
                  <p className="text-xs text-muted-foreground">All server settings, worlds, properties, and plugins have been synchronized.</p>
                </div>
              </div>
              <button 
                onClick={() => setRestoreResultSummary(null)} 
                className="text-xs text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-zinc-800/60 p-3 rounded-lg border border-zinc-700/50">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  <Gamepad2 className="w-3.5 h-3.5 text-theme-400" /> Gamemode & Diff
                </span>
                <span className="text-xs font-semibold uppercase text-zinc-200">
                  {restoreResultSummary.gamemode || "Survival"} ({restoreResultSummary.difficulty || "Easy"})
                </span>
              </div>

              <div className="bg-zinc-800/60 p-3 rounded-lg border border-zinc-700/50">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  <Compass className="w-3.5 h-3.5 text-emerald-400" /> Active World
                </span>
                <span className="text-xs font-semibold text-zinc-200 truncate block" title={restoreResultSummary.activeWorld}>
                  {restoreResultSummary.activeWorld || "world"}
                </span>
              </div>

              <div className="bg-zinc-800/60 p-3 rounded-lg border border-zinc-700/50">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  <Puzzle className="w-3.5 h-3.5 text-amber-400" /> Plugins & Mods
                </span>
                <span className="text-xs font-semibold text-zinc-200">
                  {restoreResultSummary.pluginsFound || 0} plugins, {restoreResultSummary.modsFound || 0} mods
                </span>
              </div>

              <div className="bg-zinc-800/60 p-3 rounded-lg border border-zinc-700/50">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" /> Configs Synced
                </span>
                <span className="text-xs font-semibold text-zinc-200">
                  {restoreResultSummary.configsFound || 1} config files
                </span>
              </div>
            </div>

            {restoreResultSummary.motd && (
              <div className="bg-black/40 px-3 py-2 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-2">
                <span className="text-muted-foreground font-sans text-[11px]">MOTD:</span>
                <span className="truncate">{restoreResultSummary.motd}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Action Cards Grid: Create Backup & Upload External Backup */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1: Create Local Backup */}
          <div className="bg-muted-subtle border border-border-subtle p-5 rounded-xl flex flex-col justify-between gap-4 shadow-lg">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-theme-600/10 text-theme-500 rounded-lg shrink-0 border border-theme-500/20">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    Create Backup
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-theme-500/10 text-theme-400 rounded border border-theme-500/20">
                      ZIP
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Snapshot worlds, configs, plugins, and players.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeCache}
                    onChange={(e) => setIncludeCache(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-theme-600 focus:ring-0"
                  />
                  <span>Include engine binaries & server jar (+100MB)</span>
                </label>
              </div>
            </div>

            <button 
              onClick={handleCreateBackup}
              disabled={isCreating}
              className="w-full px-4 py-2.5 bg-theme-600 hover:bg-theme-700 border border-theme-500/50 text-foreground text-xs font-semibold rounded-lg transition-all shadow-md flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-95"
            >
              {isCreating ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Creating Backup...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" /> Create Backup Now</>
              )}
            </button>
          </div>

          {/* Card 2: Upload External Server Backup */}
          <div className="bg-muted-subtle border border-border-subtle p-5 rounded-xl flex flex-col justify-between gap-4 shadow-lg">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 border border-amber-500/20">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    Upload External Backup
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                      Migration
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Upload any external server backup (Aternos, Falix, etc.) and auto-sync settings.
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Auto-detects properties, worlds, plugins, and configs</span>
              </div>
            </div>

            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-500 border border-amber-500/50 text-white text-xs font-semibold rounded-lg transition-all shadow-md flex items-center justify-center shrink-0 active:scale-95"
            >
              <UploadCloud className="w-4 h-4 mr-2" /> Upload External Backup (.zip)
            </button>
          </div>

        </div>

        {/* Backups List Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center">
              <Clock className="w-4 h-4 mr-2" /> Available Backups ({backups.length})
            </h3>
          </div>
          
          <div className="bg-muted-subtle border border-border-subtle rounded-xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 text-theme-600 animate-spin" />
                <span className="text-xs text-muted-foreground">Loading backup archive records...</span>
              </div>
            ) : backups.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Archive className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <h4 className="text-foreground-muted font-medium mb-1">No backups found</h4>
                <p className="text-muted-foreground text-sm">Create a backup or upload an external server archive above.</p>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {backups.map((backup) => {
                  const isExternalUploaded = backup.filename.startsWith("uploaded_");
                  return (
                    <div key={backup.filename} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted-subtle/80 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 border rounded-lg shrink-0 ${
                          isExternalUploaded 
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                            : "bg-zinc-800/80 border-zinc-700/50 text-theme-400"
                        }`}>
                          <Archive className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-mono text-sm font-semibold text-foreground-muted truncate max-w-xs sm:max-w-md" title={backup.filename}>
                              {backup.filename}
                            </p>
                            {isExternalUploaded && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                                External / Uploaded
                              </span>
                            )}
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-1 gap-3">
                            <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] border border-zinc-700/50 text-zinc-300">
                              {formatSize(backup.size)}
                            </span>
                            <span>•</span>
                            <span>{new Date(backup.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                        {/* Download Button */}
                        <button 
                          onClick={() => handleDownload(backup.filename)}
                          className="flex-1 md:flex-none flex justify-center items-center px-3.5 py-1.5 bg-theme-600 hover:bg-theme-500 text-foreground text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 active:scale-95"
                          title="Download ZIP archive directly to your device"
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" /> Download (.zip)
                        </button>

                        {/* Restore Button */}
                        {(user?.role === "admin" || user?.role === "owner" || user) && (
                          restoreFilename === backup.filename ? (
                            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg text-xs">
                              <span className="text-amber-400 font-medium">Restore & Apply?</span>
                              <button
                                onClick={() => handleRestore(backup.filename)}
                                disabled={isRestoring}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-2 py-0.5 rounded text-xs transition-all active:scale-95 disabled:opacity-50"
                              >
                                {isRestoring ? "Restoring..." : "Yes, Restore"}
                              </button>
                              <button
                                onClick={() => setRestoreFilename(null)}
                                disabled={isRestoring}
                                className="bg-muted hover:bg-muted-hover text-muted-foreground px-2 py-0.5 rounded text-xs transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRestoreFilename(backup.filename)}
                              className="px-2.5 py-1.5 bg-muted hover:bg-muted-hover text-muted-foreground hover:text-amber-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 border border-border"
                              title="Restore server and sync settings from this backup archive"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Restore
                            </button>
                          )
                        )}

                        {/* Delete Button */}
                        {(user?.role === "admin" || user?.role === "owner" || user) && (
                          deleteFilename === backup.filename ? (
                            <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-lg text-xs">
                              <span className="text-rose-400 font-medium">Delete?</span>
                              <button
                                onClick={() => handleDelete(backup.filename)}
                                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2 py-0.5 rounded text-xs transition-all active:scale-95"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeleteFilename(null)}
                                className="bg-muted hover:bg-muted-hover text-muted-foreground px-2 py-0.5 rounded text-xs transition-all"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeleteFilename(backup.filename)}
                              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/20"
                              title="Delete Backup"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Upload External Backup Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-100 text-base">Upload External Server Backup</h3>
                    <p className="text-xs text-zinc-400">Migrate from Aternos, Falix, Pterodactyl, or custom ZIP</p>
                  </div>
                </div>
                <button 
                  onClick={() => !isUploading && setIsUploadModalOpen(false)}
                  disabled={isUploading}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drag and drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver 
                    ? "border-amber-500 bg-amber-500/10" 
                    : selectedFile 
                      ? "border-emerald-500/50 bg-emerald-500/5" 
                      : "border-zinc-700 hover:border-zinc-500 bg-zinc-800/40"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  accept=".zip,.tar.gz,.tgz,.tar"
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-full">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <span className="font-semibold text-sm text-zinc-200">{selectedFile.name}</span>
                    <span className="text-xs text-zinc-400 font-mono">{formatSize(selectedFile.size)}</span>
                    <span className="text-[11px] text-emerald-400 font-medium">Click or drop another file to change</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-zinc-800 text-amber-400 rounded-full border border-zinc-700">
                      <FileUp className="w-8 h-8" />
                    </div>
                    <span className="font-semibold text-sm text-zinc-200">Drag & Drop backup .zip file here</span>
                    <span className="text-xs text-zinc-400">or click to browse your device</span>
                    <span className="text-[10px] text-zinc-500 mt-1">Supports full server zip, Aternos backup, world zip, configs</span>
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3 bg-zinc-800/50 p-3.5 rounded-xl border border-zinc-700/50">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={restoreImmediately}
                    onChange={(e) => setRestoreImmediately(e.target.checked)}
                    disabled={isUploading}
                    className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">Restore & Apply Settings Immediately (Recommended)</span>
                    <span className="text-[11px] text-zinc-400 block">
                      Extracts worlds, plugins, mods, and automatically syncs server.properties (gamemode, difficulty, pvp, motd, level-name).
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer select-none pt-2 border-t border-zinc-700/50">
                  <input
                    type="checkbox"
                    checked={preservePort}
                    onChange={(e) => setPreservePort(e.target.checked)}
                    disabled={isUploading}
                    className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">Preserve Current Allocated Port</span>
                    <span className="text-[11px] text-zinc-400 block">
                      Keeps your current panel connection port & Playit tunnel unchanged so external players can reconnect without issues.
                    </span>
                  </div>
                </label>
              </div>

              {/* Upload Progress Bar when uploading */}
              {isUploading && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{uploadStage}</span>
                    <span className="font-mono font-bold text-amber-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={isUploading}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleUploadSubmit}
                  disabled={!selectedFile || isUploading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 border border-amber-500/50 text-white text-xs font-semibold rounded-lg transition-all shadow-md flex items-center justify-center disabled:opacity-50 active:scale-95"
                >
                  {isUploading ? (
                    <><RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> Processing Backup...</>
                  ) : (
                    <><UploadCloud className="w-3.5 h-3.5 mr-2" /> Upload & Apply Backup</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backup Creation Progress Modal */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700/60 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-theme-600/20 text-theme-400 rounded-xl">
                  <Archive className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 text-base">Creating Server Backup</h3>
                  <p className="text-xs text-zinc-400">Packaging and compressing files into a ZIP archive...</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">{progressStage}</span>
                  <span className="font-mono font-bold text-theme-400">{backupProgress}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-theme-600 to-theme-400 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${backupProgress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-center text-[11px] text-zinc-500 gap-1.5 pt-1">
                <RefreshCw className="w-3 h-3 animate-spin text-theme-500" />
                <span>Do not close this window during archive compression</span>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Backup Restoration Progress Modal */}
        {isRestoring && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700/60 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-theme-600/20 text-theme-400 rounded-xl">
                  <RotateCcw className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 text-base">Restoring Server Backup</h3>
                  <p className="text-xs text-zinc-400">Extracting world data and synchronizing configurations...</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">{restoreStage}</span>
                  <span className="font-mono font-bold text-theme-400">{restoreProgress}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-theme-600 to-theme-400 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${restoreProgress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-center text-[11px] text-zinc-500 gap-1.5 pt-1">
                <RefreshCw className="w-3 h-3 animate-spin text-theme-500" />
                <span>Do not restart or close the browser during restoration</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
