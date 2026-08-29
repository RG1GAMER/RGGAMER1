import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  GitCommit,
  Clock,
  Terminal,
  Zap,
  ArrowDownCircle,
  FileCode2,
  RotateCw,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";

interface IncomingCommit {
  hash: string;
  author: string;
  message: string;
  date: string;
}

interface PanelUpdateStatus {
  currentVersion: string;
  currentCommit: string;
  branch: string;
  isGitRepo: boolean;
  hasUpdate: boolean;
  updateType: "git" | "rebuild" | "none";
  commitsBehind: number;
  latestVersion: string;
  latestCommit: string;
  latestMessage: string;
  incomingCommits: IncomingCommit[];
  hasLocalChanges: boolean;
  modifiedFilesCount: number;
  lastChecked: string;
  statusText: string;
  canForceRebuild: boolean;
}

interface UpdateStep {
  step: number;
  total: number;
  stepName: string;
  status: "pending" | "running" | "success" | "error";
  details?: string;
}

const DEFAULT_STEPS: UpdateStep[] = [
  { step: 1, total: 5, stepName: "Checking Environment & Dependencies", status: "pending" },
  { step: 2, total: 5, stepName: "Synchronizing Source Code", status: "pending" },
  { step: 3, total: 5, stepName: "Verifying Package Modules", status: "pending" },
  { step: 4, total: 5, stepName: "Building Application Bundles", status: "pending" },
  { step: 5, total: 5, stepName: "Finalizing Update & Health Check", status: "pending" }
];

export function SystemUpdateManager({ panelName }: { panelName?: string }) {
  const [status, setStatus] = useState<PanelUpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const [showCommitList, setShowCommitList] = useState<boolean>(false);

  // Update Execution Modal State
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateModalOpen, setUpdateModalOpen] = useState<boolean>(false);
  const [updateSteps, setUpdateSteps] = useState<UpdateStep[]>(DEFAULT_STEPS);
  const [logs, setLogs] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(5);

  const token = localStorage.getItem("jtg_token") || localStorage.getItem("token");

  // Fetch / Check updates
  const fetchUpdateStatus = async (force = false, showUserFeedback = false) => {
    try {
      setIsChecking(true);
      setFeedbackMsg(null);
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await axios.get(`/api/system/update/check${force ? "?force=true" : ""}`, { headers });
      const data: PanelUpdateStatus = res.data;
      setStatus(data);

      if (showUserFeedback) {
        if (data.hasUpdate) {
          setFeedbackMsg({
            text: `Update found! ${data.commitsBehind} new update(s) ready to install.`,
            type: "info"
          });
        } else {
          setFeedbackMsg({
            text: "No update available - Your panel is running the latest version.",
            type: "success"
          });
        }
      }
    } catch (err: any) {
      console.warn("Failed to check panel updates:", err);
      if (showUserFeedback) {
        setFeedbackMsg({
          text: err.response?.data?.error || "Could not check updates at this moment.",
          type: "error"
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    fetchUpdateStatus(false, false);
  }, []);

  // Socket.IO event listener for live build/update progress
  useEffect(() => {
    if (!token) return;
    const socket = io({
      auth: { token }
    });

    socket.on("system_update_step", (data: any) => {
      setUpdateSteps((prev) =>
        prev.map((s) => {
          if (s.step === data.step) {
            return {
              ...s,
              status: data.status,
              details: data.details || s.details
            };
          }
          if (s.step < data.step) {
            return { ...s, status: "success" };
          }
          return s;
        })
      );
    });

    socket.on("system_update_log", (data: any) => {
      if (data?.line) {
        setLogs((prev) => [...prev, data.line]);
      }
    });

    socket.on("system_update_completed", (data: any) => {
      setIsCompleted(true);
      setIsUpdating(false);
      setUpdateSteps((prev) => prev.map((s) => ({ ...s, status: "success" })));
      setLogs((prev) => [...prev, "✓ " + (data?.message || "Panel successfully updated and compiled.")]);
      fetchUpdateStatus(true, false);
    });

    socket.on("system_update_error", (data: any) => {
      setUpdateError(data?.error || "Update encountered an error");
      setIsUpdating(false);
      setLogs((prev) => [...prev, "✗ Error: " + (data?.error || "Failed update")]);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Countdown when update finishes
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCompleted && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((c) => c - 1);
      }, 1000);
    } else if (isCompleted && countdown === 0) {
      window.location.reload();
    }
    return () => clearTimeout(timer);
  }, [isCompleted, countdown]);

  // Trigger Update or Rebuild
  const handleStartUpdate = async (forceRebuild = false) => {
    // If no update available and user clicked normal update, provide explicit feedback
    if (!forceRebuild && status && !status.hasUpdate) {
      setFeedbackMsg({
        text: "No update available - Your panel is running the latest version.",
        type: "success"
      });
      return;
    }

    setUpdateSteps(
      DEFAULT_STEPS.map((s) => ({ ...s, status: "pending", details: undefined }))
    );
    setLogs(["[Init] Starting panel update & build sequence..."]);
    setIsCompleted(false);
    setUpdateError(null);
    setCountdown(5);
    setIsUpdating(true);
    setUpdateModalOpen(true);

    try {
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await axios.post(
        "/api/system/update",
        { forceRebuild, stashChanges: true },
        { headers }
      );
    } catch (err: any) {
      setUpdateError(err.response?.data?.error || err.message || "Failed to trigger update");
      setIsUpdating(false);
    }
  };

  return (
    <section className="bg-card border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center text-foreground">
            <RefreshCw className="mr-3 text-theme-500 w-5 h-5" /> Panel Updates & Synchronization
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Keep your {panelName || "Panel"} synchronized with your project repository, rebuild changes, and check for updates.
          </p>
        </div>

        {/* Check for Updates Button */}
        <button
          type="button"
          disabled={isChecking || isUpdating}
          onClick={() => fetchUpdateStatus(true, true)}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted-hover border border-border rounded-xl text-xs font-semibold text-foreground transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin text-theme-500" : ""}`} />
          <span>{isChecking ? "Checking..." : "Check for Updates"}</span>
        </button>
      </div>

      {/* Interactive Status & Version Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-xs">
        {/* Version Badge */}
        <div className="p-3.5 rounded-xl bg-background/60 border border-border-subtle flex flex-col justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">Installed Version</span>
          <div className="mt-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-theme-400 shrink-0" />
            <span className="font-bold text-foreground text-sm">v{status?.currentVersion || "3.1.0"}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
            Commit: {status?.currentCommit || "local"}
          </span>
        </div>

        {/* Git Branch */}
        <div className="p-3.5 rounded-xl bg-background/60 border border-border-subtle flex flex-col justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">Active Branch</span>
          <div className="mt-1 flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-theme-400 shrink-0" />
            <span className="font-bold text-foreground text-sm font-mono truncate">{status?.branch || "main"}</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">
            {status?.isGitRepo ? "Git Linked" : "Local Workspace"}
          </span>
        </div>

        {/* Project Modifications */}
        <div className="p-3.5 rounded-xl bg-background/60 border border-border-subtle flex flex-col justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">Local Changes</span>
          <div className="mt-1 flex items-center gap-1.5">
            <FileCode2 className={`w-4 h-4 ${status?.hasLocalChanges ? "text-amber-400" : "text-emerald-400"} shrink-0`} />
            <span className="font-bold text-foreground text-sm">
              {status?.hasLocalChanges ? `${status.modifiedFilesCount} files modified` : "Clean"}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">
            {status?.hasLocalChanges ? "Ready for rebuild" : "All files synced"}
          </span>
        </div>

        {/* Last Checked */}
        <div className="p-3.5 rounded-xl bg-background/60 border border-border-subtle flex flex-col justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">Last Checked</span>
          <div className="mt-1 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-theme-400 shrink-0" />
            <span className="font-semibold text-foreground text-xs">
              {status?.lastChecked ? new Date(status.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 truncate">
            {isChecking ? "Checking now..." : "Automatic verification"}
          </span>
        </div>
      </div>

      {/* Feedback Notification Banner */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`p-3.5 rounded-xl mb-6 text-xs font-semibold flex items-center gap-2 border ${
              feedbackMsg.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : feedbackMsg.type === "info"
                ? "bg-theme-500/10 text-theme-400 border-theme-500/30"
                : feedbackMsg.type === "warning"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
            }`}
          >
            {feedbackMsg.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {feedbackMsg.type === "info" && <Zap className="w-4 h-4 shrink-0" />}
            {feedbackMsg.type === "warning" && <AlertCircle className="w-4 h-4 shrink-0" />}
            {feedbackMsg.type === "error" && <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Status Display: UP TO DATE vs UPDATE AVAILABLE */}
      {status?.hasUpdate ? (
        /* Update Available Card */
        <div className="p-5 rounded-2xl bg-theme-500/10 border border-theme-500/30 relative overflow-hidden mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-theme-500 text-white shadow-sm">
                  Update Available
                </span>
                <span className="text-xs text-theme-400 font-mono">
                  {status.commitsBehind} commit{status.commitsBehind > 1 ? "s" : ""} behind upstream
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground mt-1">
                New version build is available for {panelName || "JTG Panel"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                {status.latestMessage || "New bug fixes, security updates, and performance optimizations are ready."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {status.incomingCommits && status.incomingCommits.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCommitList(!showCommitList)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-background/60 hover:bg-background border border-border-subtle text-xs font-semibold text-foreground transition-all"
                >
                  <GitCommit className="w-3.5 h-3.5 text-theme-400" />
                  <span>View Changes ({status.incomingCommits.length})</span>
                  {showCommitList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStartUpdate(false)}
                className="flex items-center gap-2 px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>Update Panel Now</span>
              </button>
            </div>
          </div>

          {/* Collapsible incoming commits list */}
          <AnimatePresence>
            {showCommitList && status.incomingCommits && status.incomingCommits.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-theme-500/20 space-y-2"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Incoming Changelog & Commits:
                </p>
                <div className="space-y-1.5">
                  {status.incomingCommits.map((c, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-background/40 border border-border-subtle/40 text-xs">
                      <span className="font-mono text-[11px] font-bold text-theme-400 shrink-0 px-1.5 py-0.5 rounded bg-theme-500/10">
                        {c.hash}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-medium truncate">{c.message}</p>
                        <p className="text-[10px] text-muted-foreground">{c.author} • {c.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* Up To Date Banner */
        <div className="p-5 rounded-2xl bg-muted/40 border border-border-subtle relative overflow-hidden mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    No update available
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                    Up to date
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your panel is running the latest version with all security patches, features, and fixes installed.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setFeedbackMsg({
                    text: "No update available - Your panel is running the latest version.",
                    type: "success"
                  });
                }}
                className="px-4 py-2.5 bg-muted hover:bg-muted-hover border border-border text-foreground font-semibold text-xs rounded-xl transition-all active:scale-95"
              >
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  Update Panel
                </span>
              </button>

              {/* Force Rebuild & Sync Changes */}
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStartUpdate(true)}
                title="Rebuild and compile any local project changes immediately"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-theme-600/15 hover:bg-theme-600/25 text-theme-400 border border-theme-600/30 text-xs font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Rebuild & Apply Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description Info */}
      <div className="p-4 rounded-xl bg-background/40 border border-border-subtle/60 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-theme-400" /> How Panel Updates Work:
        </p>
        <p>• <strong>Automatic Version Tracking:</strong> The panel automatically inspects your repository commits and package dependencies.</p>
        <p>• <strong>Project Changes Link:</strong> If you modify files or features anywhere in your panel project, clicking <strong>"Rebuild & Apply Changes"</strong> will re-compile your bundles and make all updates live immediately.</p>
        <p>• <strong>Zero-Downtime Safe Execution:</strong> Updates run securely in the background, validating environment space, node compatibility, and build integrity before restarting services.</p>
      </div>

      {/* Live Interactive Update Modal */}
      <AnimatePresence>
        {updateModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border-subtle p-6 md:p-8 rounded-2xl max-w-2xl w-full shadow-2xl relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-400">
                    <RefreshCw className={`w-5 h-5 ${isUpdating ? "animate-spin" : ""}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">
                      {isCompleted
                        ? "Panel Update Complete!"
                        : updateError
                        ? "Update Encountered an Issue"
                        : "Updating & Building Panel..."}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {isCompleted
                        ? "All changes successfully compiled and applied."
                        : updateError
                        ? "Please review the terminal log output below."
                        : "Applying project changes, syncing modules, and compiling assets..."}
                    </p>
                  </div>
                </div>

                {!isUpdating && (
                  <button
                    type="button"
                    onClick={() => setUpdateModalOpen(false)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted-hover border border-border text-foreground transition-all"
                  >
                    Close
                  </button>
                )}
              </div>

              {/* Steps Progress List */}
              <div className="space-y-2.5 mb-5">
                {updateSteps.map((s) => (
                  <div
                    key={s.step}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                      s.status === "success"
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                        : s.status === "running"
                        ? "bg-theme-500/10 border-theme-500/40 text-theme-300 ring-1 ring-theme-500/30"
                        : s.status === "error"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : "bg-muted/30 border-border-subtle/50 text-muted-foreground opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0">
                        {s.status === "success" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        {s.status === "running" && <RefreshCw className="w-3.5 h-3.5 text-theme-400 animate-spin" />}
                        {s.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                        {s.status === "pending" && <span className="text-muted-foreground">{s.step}</span>}
                      </div>
                      <span className="font-semibold">{s.stepName}</span>
                    </div>

                    <span className="text-[11px] font-mono opacity-80">
                      {s.details || (s.status === "success" ? "Done" : s.status === "running" ? "In progress..." : "Queued")}
                    </span>
                  </div>
                ))}
              </div>

              {/* Console Output Log Terminal */}
              <div className="rounded-xl bg-black/80 border border-zinc-800 p-3.5 font-mono text-[11px] h-36 overflow-y-auto custom-scrollbar space-y-1 mb-5">
                <div className="text-zinc-500 flex items-center gap-1.5 pb-1 border-b border-zinc-800/80 mb-1">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Update Execution Output Stream:</span>
                </div>
                {logs.map((line, idx) => (
                  <div key={idx} className="text-zinc-300 leading-relaxed font-mono">
                    <span className="text-zinc-600 mr-2">&gt;</span>
                    {line}
                  </div>
                ))}
              </div>

              {/* Action Footer */}
              <div className="flex items-center justify-between pt-2">
                {isCompleted ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Reloading panel in {countdown}s...
                    </span>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
                    >
                      Reload Now
                    </button>
                  </div>
                ) : updateError ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs text-rose-400 font-semibold truncate max-w-sm">
                      {updateError}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartUpdate(true)}
                      className="px-4 py-2 bg-theme-600 hover:bg-theme-500 text-white font-semibold text-xs rounded-xl transition-all"
                    >
                      Retry Rebuild
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-theme-500" /> Compiling assets in background...
                    </span>
                    <span className="font-mono text-[11px]">Please do not close this window</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
