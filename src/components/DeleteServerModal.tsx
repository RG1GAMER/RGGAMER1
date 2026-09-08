import React, { useState, useEffect } from "react";
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Server,
  X,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  UserX
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export interface DeleteServerModalProps {
  isOpen: boolean;
  server: {
    id: string;
    name: string;
    runtimeType?: string;
    port?: number;
    node?: string;
    owner?: string;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const DELETION_STAGES = [
  { threshold: 0, label: "Initiating administrative destruction sequence..." },
  { threshold: 20, label: "Stopping active container runtime & background process..." },
  { threshold: 45, label: "Dismantling network routes, ports & Playit tunnel..." },
  { threshold: 70, label: "Purging filesystem volumes, world saves & SFTP credentials..." },
  { threshold: 90, label: "Revoking fleet database records & daemon bindings..." },
  { threshold: 100, label: "Server permanently deleted by administrative authorization." }
];

export default function DeleteServerModal({
  isOpen,
  server,
  onClose,
  onSuccess
}: DeleteServerModalProps) {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(DELETION_STAGES[0].label);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Administrative confirmation form states
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  // Strict role verification: Only 'owner' or 'admin' roles can authorize removal
  const userRole = user?.role ? String(user.role).toLowerCase() : "";
  const isAuthorizedAdmin = userRole === "owner" || userRole === "admin";

  const expectedName = server?.name ? server.name.trim() : "";
  const isNameVerified = confirmationPhrase.trim() === expectedName;
  const canAuthorize = isAuthorizedAdmin && isNameVerified && hasAcknowledged && !isDeleting;

  useEffect(() => {
    if (isOpen) {
      setIsDeleting(false);
      setProgress(0);
      setCurrentStage(DELETION_STAGES[0].label);
      setErrorMsg(null);
      setIsComplete(false);
      setConfirmationPhrase("");
      setAdminPassword("");
      setShowPassword(false);
      setHasAcknowledged(false);
    }
  }, [isOpen]);

  if (!isOpen || !server) return null;

  const handleAuthorizeAndDestroy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAuthorize) return;

    setIsDeleting(true);
    setErrorMsg(null);
    setProgress(5);
    setCurrentStage("Verifying administrative authority...");

    let intervalId: NodeJS.Timeout | null = null;

    intervalId = setInterval(() => {
      setProgress((prev) => {
        let next = prev;
        if (prev < 25) {
          next = prev + 5;
        } else if (prev < 50) {
          next = prev + 4;
        } else if (prev < 75) {
          next = prev + 3;
        } else if (prev < 92) {
          next = prev + 1;
        }

        const match = [...DELETION_STAGES].reverse().find((s) => next >= s.threshold);
        if (match) setCurrentStage(match.label);

        return next;
      });
    }, 200);

    try {
      await axios.delete(`/api/servers/${server.id}`, {
        data: {
          confirmationPhrase: confirmationPhrase.trim(),
          adminPassword: adminPassword.trim() || undefined
        }
      });

      if (intervalId) clearInterval(intervalId);
      setProgress(100);
      setCurrentStage("Server permanently deleted by administrative authorization.");
      setIsComplete(true);

      // Brief pause to show completion before notifying caller
      setTimeout(() => {
        onSuccess();
      }, 750);
    } catch (err: any) {
      if (intervalId) clearInterval(intervalId);
      setIsDeleting(false);
      setErrorMsg(
        err.response?.data?.error || err.message || "Administrative server deletion failed."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        className="bg-[#121214] border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl relative overflow-hidden ring-1 ring-red-500/20"
      >
        {/* Glow ambient background accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

        {!isDeleting ? (
          <>
            {/* Administrative Header Banner */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-foreground">Administrative Confirmation</h2>
                    <span className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                      Destructive Action
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mandatory authorization required for game server destruction
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Operator Authorization Credential Chip */}
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-muted/70 border border-border-subtle flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Active Operator:</span>
                <span className="font-mono font-bold text-foreground">
                  {user?.username || "Unknown"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span>Role:</span>
                {isAuthorizedAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold uppercase">
                    <ShieldCheck className="w-3 h-3" />
                    {userRole || "Admin"} (Authorized)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 font-bold uppercase">
                    <UserX className="w-3 h-3" />
                    {userRole || "User"} (Unauthorized)
                  </span>
                )}
              </div>
            </div>

            {/* Error Message if previous attempt failed */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* If NOT an Admin or Owner: Display Access Denied View */}
            {!isAuthorizedAdmin ? (
              <div className="space-y-4 my-4">
                <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-red-400">
                    <Lock className="w-4 h-4" />
                    Administrative Authorization Blocked
                  </div>
                  <p className="text-xs leading-relaxed text-red-300/90">
                    Only users with <strong className="text-white">Owner</strong> or{" "}
                    <strong className="text-white">Admin</strong> roles are permitted to authorize
                    the permanent removal of game servers.
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    Your current account role is{" "}
                    <span className="font-mono font-bold text-foreground">
                      "{userRole || "user"}"
                    </span>
                    . Please contact a system administrator or the server owner if this instance
                    needs to be decommissioned.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 bg-muted hover:bg-muted-hover text-foreground font-semibold text-xs rounded-xl border border-border-subtle transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* If Authorized Admin or Owner: Present Mandatory Administrative Confirmation Form */
              <form onSubmit={handleAuthorizeAndDestroy} className="space-y-4">
                {/* Server Target & Scope Details */}
                <div className="p-4 rounded-2xl bg-muted/60 border border-border-subtle space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Server className="w-4 h-4 text-theme-500" />
                      {server.name}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-background border border-border-subtle text-muted-foreground">
                      ID: {server.id}
                    </span>
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border-subtle">
                    <p className="flex items-center gap-1.5 text-red-400/90 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Destructive Impact Breakdown:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground/90 pl-1">
                      <li>Filesystem volume, world maps, and configs will be wiped immediately.</li>
                      <li>Runtime containers, daemon port bindings, and Playit tunnel severed.</li>
                      <li>This administrative operation cannot be reversed.</li>
                    </ul>
                  </div>
                </div>

                {/* Requirement 1: Server Name Confirmation Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-foreground">
                      1. Type Server Name to Confirm:
                    </label>
                    <span className="font-mono text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded select-all font-bold">
                      {expectedName}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={confirmationPhrase}
                      onChange={(e) => setConfirmationPhrase(e.target.value)}
                      placeholder={`Type "${expectedName}"`}
                      className={`w-full rounded-xl border p-3 text-xs font-mono outline-none transition-all ${
                        isNameVerified
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                          : "border-border bg-muted/60 text-foreground focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      }`}
                    />
                    {isNameVerified && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verified</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Requirement 2: Administrator Password / Credential Re-verification */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    2. Administrator Password Confirmation:
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Enter your administrator password"
                      className="w-full rounded-xl border border-border bg-muted/60 p-3 pr-10 text-xs font-mono text-foreground focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Re-verify administrative credentials to authorize high-impact destruction.
                  </p>
                </div>

                {/* Requirement 3: Mandatory Acknowledgment Checkbox */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/5 border border-red-500/20 cursor-pointer hover:bg-red-500/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={hasAcknowledged}
                      onChange={(e) => setHasAcknowledged(e.target.checked)}
                      className="mt-0.5 text-red-600 rounded border-border focus:ring-red-500"
                    />
                    <span className="text-[11px] leading-relaxed text-foreground font-medium">
                      I, as an authorized{" "}
                      <strong className="text-red-400 font-bold uppercase">{userRole || "Administrator"}</strong>
                      , acknowledge that this action will permanently destroy all server data and cannot be recovered.
                    </span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 bg-muted hover:bg-muted-hover text-foreground font-semibold text-xs rounded-xl border border-border-subtle transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!canAuthorize}
                    className={`px-5 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg ${
                      canAuthorize
                        ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/25 active:scale-95 cursor-pointer"
                        : "bg-red-950/40 text-red-400/40 border border-red-500/10 cursor-not-allowed"
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Authorize & Destroy Server</span>
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          /* Active In-Modal Loading Bar & Progress Display */
          <div className="py-4 space-y-5 text-center">
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-red-500/20 blur-md animate-pulse" />
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center relative">
                  {isComplete ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  ) : (
                    <Loader2 className="w-7 h-7 text-red-500 animate-spin" />
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground">
                {isComplete ? "Server Deletion Completed" : `Decommissioning "${server.name}"`}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 font-medium min-h-[18px]">
                {currentStage}
              </p>
            </div>

            {/* Loading Bar with Percentage */}
            <div className="space-y-2 text-left">
              <div className="w-full bg-muted/80 rounded-full h-3.5 p-0.5 border border-border-subtle overflow-hidden relative shadow-inner">
                <motion.div
                  className={`h-full rounded-full relative overflow-hidden transition-all duration-200 shadow-md ${
                    isComplete
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-red-600 via-amber-500 to-red-500"
                  }`}
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </motion.div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono font-bold px-1">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Administrative sequence active
                </span>
                <span className={isComplete ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground/80 italic pt-1">
              Please do not navigate away while administrative resource decommissioning completes.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
