// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import {
  Globe,
  Play,
  Square,
  Loader2,
  Link as LinkIcon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Server,
  Users,
  ShieldAlert,
  ArrowRight,
  Copy,
  Check,
  History,
  Terminal,
  Info,
  Key,
  Plus,
  Sparkles,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
  Sliders,
  Layers,
  ArrowUpDown,
  RotateCcw,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { PlayitDiagnostics, PlayitTunnelHealthStatus, PlayitAuditEntry, SavedPlayitAgent } from "../types/playit";

export default function PlayitTunnel({ serverId }: { serverId: string }) {
  const [status, setStatus] = useState<"running" | "stopped" | "checking">("checking");
  const [claimLink, setClaimLink] = useState<string | null>(null);
  const [publicAddress, setPublicAddress] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [healthData, setHealthData] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<PlayitDiagnostics | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [secretInfo, setSecretInfo] = useState<{ secretKey: string | null; isConfigured: boolean; maskedKey: string | null }>({
    secretKey: null,
    isConfigured: false,
    maskedKey: null
  });
  const [savedAgents, setSavedAgents] = useState<SavedPlayitAgent[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [serverRuntimeType, setServerRuntimeType] = useState<string>("docker");

  const [activeTab, setActiveTab] = useState<"terminal" | "audit">("terminal");
  const [auditLogs, setAuditLogs] = useState<PlayitAuditEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Modals
  const [showNewTunnelModal, setShowNewTunnelModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectTab, setConnectTab] = useState<"new" | "saved">("new");
  const [secretInput, setSecretInput] = useState("");
  const [agentNameInput, setAgentNameInput] = useState("");
  const [saveProfileChecked, setSaveProfileChecked] = useState(true);
  const [showSecretText, setShowSecretText] = useState(false);
  const [isSubmittingSecret, setIsSubmittingSecret] = useState(false);
  const [switchingAgentId, setSwitchingAgentId] = useState<string | null>(null);
  const [modalFeedback, setModalFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [playerWarningModal, setPlayerWarningModal] = useState<{
    isOpen: boolean;
    action: "restart" | "force_recover" | "new_tunnel" | "switch_agent";
    targetAgentId?: string;
  }>({ isOpen: false, action: "restart" });

  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedClaim, setCopiedClaim] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const [isVerifyingClaim, setIsVerifyingClaim] = useState(false);
  const [claimSuccessNotice, setClaimSuccessNotice] = useState(false);

  useEffect(() => {
    fetchStatus();
    // Fast polling (2s) when claimLink is present or tunnel is starting, standard polling (5s) otherwise
    const pollInterval = (claimLink || (status === "running" && !publicAddress)) ? 2000 : 5000;
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [serverId, claimLink, status, publicAddress]);

  // Trigger celebration banner when claim transitions to live public address
  useEffect(() => {
    if (publicAddress && !claimLink) {
      // Check if we just transitioned
      setClaimSuccessNotice(true);
      const timer = setTimeout(() => setClaimSuccessNotice(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [publicAddress]);

  const handleVerifyClaimNow = async () => {
    setIsVerifyingClaim(true);
    try {
      await axios.post(`/api/servers/${serverId}/playit/test`);
      await fetchStatus();
    } catch (e) {
      console.error("Failed to verify claim", e);
    } finally {
      setIsVerifyingClaim(false);
    }
  };

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const fetchStatus = async () => {
    try {
      const serverRes = await axios.get(`/api/servers/${serverId}`);
      setServerRuntimeType(serverRes.data.runtimeType || "docker");

      const res = await axios.get(`/api/servers/${serverId}/playit`);
      setStatus(res.data.status);
      setClaimLink(res.data.claimLink || null);
      setPublicAddress(res.data.publicAddress || null);
      if (res.data.logs !== undefined) {
        setLogs(res.data.logs);
      }
      if (res.data.health) {
        setHealthData(res.data.health);
      }
      if (res.data.playerCount !== undefined) {
        setPlayerCount(res.data.playerCount);
      }
      if (res.data.secretInfo) {
        setSecretInfo(res.data.secretInfo);
      }
      if (res.data.savedAgents) {
        setSavedAgents(res.data.savedAgents);
      }
    } catch (e) {
      console.error("Failed to fetch Playit status", e);
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const res = await axios.get(`/api/servers/${serverId}/playit/audit`);
      setAuditLogs(res.data.auditLogs || []);
    } catch (e) {
      console.error("Failed to fetch audit logs", e);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleRunHealthTest = async () => {
    setIsTesting(true);
    try {
      const res = await axios.post(`/api/servers/${serverId}/playit/test`);
      setDiagnostics(res.data);
      if (res.data.claimLink) setClaimLink(res.data.claimLink);
      if (res.data.playitPublicAddress) setPublicAddress(res.data.playitPublicAddress);
      await fetchStatus();
    } catch (e) {
      console.error("Failed to run health check", e);
    } finally {
      setIsTesting(false);
    }
  };

  const generateTunnel = async () => {
    setIsProcessing(true);
    setLogs("");
    setClaimLink(null);
    try {
      await axios.post(`/api/servers/${serverId}/playit/start`);
      setStatus("running");
      await fetchStatus();
    } catch (e) {
      console.error("Failed to start tunnel", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopTunnel = async () => {
    setIsProcessing(true);
    try {
      await axios.post(`/api/servers/${serverId}/playit/stop`);
      setStatus("stopped");
      setClaimLink(null);
      setLogs("");
      await fetchStatus();
    } catch (e) {
      console.error("Failed to stop tunnel", e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Option 1: New Tunnel (Purani tunnel delete ho jaye aur new create ho kar connect ho jaye)
  const requestNewTunnel = () => {
    if (playerCount > 0) {
      setPlayerWarningModal({ isOpen: true, action: "new_tunnel" });
    } else {
      setShowNewTunnelModal(true);
    }
  };

  const executeNewTunnel = async () => {
    setShowNewTunnelModal(false);
    setPlayerWarningModal({ isOpen: false, action: "restart" });
    setIsProcessing(true);
    setLogs("");
    setClaimLink(null);
    setPublicAddress(null);
    try {
      await axios.post(`/api/servers/${serverId}/playit/reset`);
      setStatus("running");
      await fetchStatus();
    } catch (e: any) {
      console.error("Failed to create new tunnel", e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Option 2: Connect Custom Agent Secret Key
  const handleConnectAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim()) {
      setModalFeedback({ type: "error", message: "Please paste your Playit Agent Secret Key." });
      return;
    }

    setIsSubmittingSecret(true);
    setModalFeedback(null);
    try {
      const res = await axios.post(`/api/servers/${serverId}/playit/connect-agent`, {
        secretKey: secretInput.trim(),
        agentName: agentNameInput.trim() || undefined,
        saveProfile: saveProfileChecked
      });

      if (res.data.savedAgents) setSavedAgents(res.data.savedAgents);
      if (res.data.secretInfo) setSecretInfo(res.data.secretInfo);

      setModalFeedback({
        type: "success",
        message: "Agent Secret connected successfully! Initializing tunnel..."
      });

      setSecretInput("");
      setAgentNameInput("");
      setStatus("running");
      await fetchStatus();

      setTimeout(() => {
        setShowConnectModal(false);
        setModalFeedback(null);
      }, 1200);
    } catch (err: any) {
      setModalFeedback({
        type: "error",
        message: err.response?.data?.error || err.response?.data?.details || "Failed to connect Playit Agent."
      });
    } finally {
      setIsSubmittingSecret(false);
    }
  };

  // Switch to saved agent
  const handleSwitchAgent = async (agent: SavedPlayitAgent) => {
    if (playerCount > 0) {
      setPlayerWarningModal({
        isOpen: true,
        action: "switch_agent",
        targetAgentId: agent.id
      });
      return;
    }
    await executeSwitchAgent(agent.id);
  };

  const executeSwitchAgent = async (agentId: string) => {
    setPlayerWarningModal({ isOpen: false, action: "restart" });
    setSwitchingAgentId(agentId);
    setModalFeedback(null);
    try {
      const res = await axios.post(`/api/servers/${serverId}/playit/switch-agent`, { agentId });
      if (res.data.savedAgents) setSavedAgents(res.data.savedAgents);
      if (res.data.secretInfo) setSecretInfo(res.data.secretInfo);

      setModalFeedback({
        type: "success",
        message: "Successfully switched Playit Agent profile!"
      });
      setStatus("running");
      await fetchStatus();

      setTimeout(() => {
        setShowConnectModal(false);
        setModalFeedback(null);
      }, 1000);
    } catch (err: any) {
      setModalFeedback({
        type: "error",
        message: err.response?.data?.error || "Failed to switch agent."
      });
    } finally {
      setSwitchingAgentId(null);
    }
  };

  // Delete saved agent
  const handleDeleteSavedAgent = async (agentId: string) => {
    try {
      const res = await axios.delete(`/api/servers/${serverId}/playit/saved-agents/${agentId}`);
      if (res.data.savedAgents) setSavedAgents(res.data.savedAgents);
    } catch (err: any) {
      console.error("Failed to delete saved agent profile", err);
    }
  };

  const requestRestart = () => {
    if (playerCount > 0) {
      setPlayerWarningModal({ isOpen: true, action: "restart" });
    } else {
      executeRestart(false);
    }
  };

  const requestForceRecover = () => {
    if (playerCount > 0) {
      setPlayerWarningModal({ isOpen: true, action: "force_recover" });
    } else {
      executeForceRecover();
    }
  };

  const executeRestart = async (force: boolean) => {
    setPlayerWarningModal({ isOpen: false, action: "restart" });
    setIsProcessing(true);
    try {
      await axios.post(`/api/servers/${serverId}/playit/restart`, { force });
      await fetchStatus();
    } catch (e: any) {
      console.error("Failed to restart Playit agent", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeForceRecover = async () => {
    setPlayerWarningModal({ isOpen: false, action: "force_recover" });
    setIsProcessing(true);
    try {
      const res = await axios.post(`/api/servers/${serverId}/playit/force-recover`);
      if (res.data.diagnostics) setDiagnostics(res.data.diagnostics);
      await fetchStatus();
    } catch (e: any) {
      console.error("Failed to force recover Playit", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, isClaim = false) => {
    navigator.clipboard.writeText(text);
    if (isClaim) {
      setCopiedClaim(true);
      setTimeout(() => setCopiedClaim(false), 2000);
    } else {
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    }
  };

  const currentHealth: PlayitTunnelHealthStatus =
    diagnostics?.status || healthData?.currentHealthStatus || (status === "running" ? "healthy" : "agent_offline");

  const renderHealthBadge = (healthStatus: PlayitTunnelHealthStatus) => {
    switch (healthStatus) {
      case "healthy":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Healthy & Online
          </span>
        );
      case "agent_offline":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Agent Offline
          </span>
        );
      case "minecraft_offline":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Minecraft Offline
          </span>
        );
      case "local_port_unreachable":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Local Port Unreachable
          </span>
        );
      case "tunnel_unhealthy":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Tunnel Degraded
          </span>
        );
      case "recovering":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Recovering Agent...
          </span>
        );
      case "needs_admin_attention":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Needs Attention
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border-subtle">
            Unknown
          </span>
        );
    }
  };

  const displayedHostPort = diagnostics?.hostPort || healthData?.dockerHostPublishedPort || "25565";
  const displayedContainerPort = diagnostics?.containerPort || healthData?.internalContainerPort || "25565";
  const isTcpReachable = diagnostics ? diagnostics.localTcpReachable : healthData ? healthData.localTcpReachable : status === "running";
  const failureReason = diagnostics?.failureReason || healthData?.failureReason;
  const recommendedAction = diagnostics?.recommendedAction || healthData?.recommendedAction;

  // Identify active matched agent profile
  const activeProfile = savedAgents.find(
    (a) => secretInfo.secretKey && a.secretKey && a.secretKey.trim() === secretInfo.secretKey.trim()
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-8 h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-6">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                <Globe className="w-6 h-6 text-theme-500" />
                Playit.gg Tunnel & Agents
              </h1>
              {renderHealthBadge(currentHealth)}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              Expose your Minecraft server with high-performance Playit tunnels, multiple agent switching, and auto-healing.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRunHealthTest}
              disabled={isTesting || isProcessing}
              className="flex items-center gap-2 px-3.5 py-2 bg-muted hover:bg-muted-hover text-foreground font-semibold text-xs rounded-xl border border-border-subtle transition-all active:scale-95 disabled:opacity-50"
              title="Test Local TCP and Tunnel Health"
            >
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-theme-500" /> : <Activity className="w-3.5 h-3.5 text-theme-500" />}
              <span>{isTesting ? "Testing..." : "Test Connection"}</span>
            </button>

            {status === "running" && (
              <button
                onClick={requestRestart}
                disabled={isProcessing || isTesting}
                className="flex items-center gap-2 px-3.5 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 font-semibold text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50"
                title="Restart Playit background agent process"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Restart</span>
              </button>
            )}
          </div>
        </div>

        {/* Failure / Advisory Banner if unhealthy */}
        {failureReason && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 md:p-5 rounded-2xl border ${
              currentHealth === "healthy"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : currentHealth === "needs_admin_attention" || currentHealth === "agent_offline"
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">Diagnostic Notice</h3>
                  <p className="text-xs mt-1 opacity-90">{failureReason}</p>
                  {recommendedAction && (
                    <p className="text-xs mt-1 font-semibold text-foreground/90">
                      Recommendation: {recommendedAction}
                    </p>
                  )}
                </div>
              </div>

              {(currentHealth === "needs_admin_attention" || currentHealth === "tunnel_unhealthy") && (
                <button
                  onClick={requestForceRecover}
                  disabled={isProcessing}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-all shadow-md active:scale-95 shrink-0"
                >
                  Force Recovery
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Claim Success Celebration Banner */}
        {claimSuccessNotice && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="p-5 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-card border-2 border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-emerald-500/10"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-foreground font-bold text-sm flex items-center gap-2">
                  <span>Playit Agent Claimed & Connected!</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-bold">Online</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Playit tunnel live ho chuki hai. Niche diye gaye public IP se players directly connect kar sakte hain.
                </p>
                {publicAddress && (
                  <div className="mt-2 font-mono text-xs font-bold text-emerald-300 bg-background/80 px-3 py-1.5 rounded-xl border border-emerald-500/30 inline-flex items-center gap-2">
                    <span>{publicAddress}</span>
                    <button
                      onClick={() => copyToClipboard(publicAddress)}
                      className="hover:text-white transition-colors"
                      title="Copy Public IP"
                    >
                      {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setClaimSuccessNotice(false)}
              className="px-3.5 py-1.5 bg-muted hover:bg-muted-hover text-muted-foreground text-xs font-semibold rounded-xl self-end sm:self-center transition-colors"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* Claim Link Alert if unlinked / newly generated */}
        {claimLink && (
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-5 bg-gradient-to-r from-theme-600/20 via-theme-500/10 to-card border-2 border-theme-500/40 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-lg shadow-theme-500/5"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-theme-500/20 border border-theme-500/30 flex items-center justify-center shrink-0 text-theme-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-foreground font-bold text-sm">
                    New Playit Agent Ready to Claim!
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Waiting for Claim
                  </span>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  Apne Playit.gg account par is agent ko claim karein taaki Minecraft port tunnel connect ho sake. Claim complete hone ke baad tunnel automatically connect ho jayegi.
                </p>
                <div className="flex items-center gap-2 font-mono text-[11px] text-theme-300 bg-background/60 px-2.5 py-1.5 rounded-xl border border-border-subtle w-fit flex-wrap">
                  <span className="truncate max-w-xs">{claimLink}</span>
                  <button
                    onClick={() => copyToClipboard(claimLink, true)}
                    className="p-1 hover:text-white transition-colors rounded hover:bg-muted"
                    title="Copy claim link"
                  >
                    {copiedClaim ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <a
                href={claimLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-theme-600 hover:bg-theme-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 text-center"
              >
                <span>Claim on Playit.gg</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={handleVerifyClaimNow}
                disabled={isVerifyingClaim || isProcessing}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-muted hover:bg-muted-hover text-foreground border border-border-subtle font-bold text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50"
                title="Check if agent claim has completed and connect tunnel"
              >
                {isVerifyingClaim ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-theme-400" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-theme-400" />
                )}
                <span>Check Status</span>
              </button>

              <button
                onClick={requestNewTunnel}
                disabled={isProcessing}
                className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs text-muted-foreground hover:text-red-400 font-semibold rounded-xl hover:bg-red-500/10 transition-colors"
                title="Purana claim link cancel karke naya tunnel create karein"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset / New</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Diagnostics & Status Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Local Minecraft & TCP Reachability */}
          <div className="bg-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Server className="w-4 h-4 text-theme-500" /> Minecraft Server
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
                {serverRuntimeType.toUpperCase()}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Local TCP Reachability:</span>
                <span className="font-semibold flex items-center gap-1">
                  {isTcpReachable ? (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Reachable (127.0.0.1)
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Unreachable
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Port Publication:</span>
                <span className="font-mono text-foreground font-semibold flex items-center gap-1">
                  {displayedContainerPort} <ArrowRight className="w-3 h-3 text-muted-foreground" /> {displayedHostPort}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Online Players:</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-theme-500" />
                  {playerCount} active
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Tunnel Endpoint & Public Address */}
          <div className="bg-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-theme-500" /> Public Ingress
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
                Playit.gg
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-xs">
                <span className="text-muted-foreground block mb-1">Public Server IP:</span>
                {publicAddress ? (
                  <div className="flex items-center justify-between gap-2 p-2 bg-muted rounded-xl border border-border-subtle">
                    <span className="font-mono text-xs font-bold text-theme-400 truncate select-all">
                      {publicAddress}
                    </span>
                    <button
                      onClick={() => copyToClipboard(publicAddress)}
                      className="p-1 hover:bg-muted-hover rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title="Copy address"
                    >
                      {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic block p-1">
                    {claimLink ? "Claim link generated above" : "Tunnel not active"}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Process State:</span>
                <span className="font-semibold text-foreground capitalize">{status}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Active Agent & Secret Status */}
          <div className="bg-card border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Key className="w-4 h-4 text-theme-500" /> Active Agent Secret
              </span>
              {activeProfile ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-theme-500/10 text-theme-400 border border-theme-500/20 truncate max-w-[120px]">
                  {activeProfile.name}
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {secretInfo.isConfigured ? "Direct TOML" : "Unclaimed"}
                </span>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Configured Key:</span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {secretInfo.maskedKey || "None (Fresh Setup)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Saved Profiles:</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-theme-500" />
                  {savedAgents.length} available
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 gap-2 border-t border-border-subtle/60">
                <button
                  onClick={requestNewTunnel}
                  disabled={isProcessing}
                  className="text-[11px] text-muted-foreground hover:text-red-400 font-semibold flex items-center gap-1 transition-colors"
                  title="Purana secret delete karke fresh new tunnel connect karein"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Delete & New</span>
                </button>
                <button
                  onClick={() => {
                    setShowConnectModal(true);
                    setConnectTab(savedAgents.length > 0 ? "saved" : "new");
                  }}
                  className="text-xs text-theme-400 hover:text-theme-300 font-semibold flex items-center gap-1"
                >
                  <span>Manage / Switch</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Controls Card */}
        <div className="bg-card border border-border-subtle rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                <span>Tunnel Process & Agent Control</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Naya tunnel create karein, purane agent ko reset karein, ya alag alag Playit agents ko ek click me connect karein.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Option: Start / Stop Tunnel */}
              {status !== "running" ? (
                <button
                  onClick={generateTunnel}
                  disabled={isProcessing || status === "checking"}
                  className="flex items-center gap-2 px-4 py-2.5 bg-theme-600 hover:bg-theme-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>Start Tunnel</span>
                </button>
              ) : (
                <button
                  onClick={stopTunnel}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  title="Stop Playit background process"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-red-400" />}
                  <span>Stop Tunnel</span>
                </button>
              )}

              {/* Option 1: New Tunnel (Delete old & create fresh tunnel link) */}
              <button
                onClick={requestNewTunnel}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2.5 bg-theme-500/10 hover:bg-theme-500/20 text-theme-400 border border-theme-500/30 font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                title="Purana agent secret delete karke fresh new tunnel generate karein"
              >
                <Sparkles className="w-4 h-4 text-theme-400" />
                <span>New Tunnel</span>
              </button>

              {/* Option 2: Connect Agent / Switch Agent Secret */}
              <button
                onClick={() => {
                  setShowConnectModal(true);
                  setModalFeedback(null);
                }}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2.5 bg-muted hover:bg-muted-hover text-foreground border border-border-subtle font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 disabled:opacity-50"
                title="Custom agent secret key connect karein ya saved agent profile switch karein"
              >
                <Key className="w-4 h-4 text-theme-500" />
                <span>Connect / Switch Agent</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tabbed View: Terminal Logs & Recovery Audit */}
        <div className="bg-card border border-border-subtle rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-muted/40 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("terminal")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "terminal"
                    ? "bg-theme-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Playit Logs</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("audit");
                  fetchAuditLogs();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "audit"
                    ? "bg-theme-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Recovery & Action Audit</span>
              </button>
            </div>

            {activeTab === "terminal" && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded border-border-subtle text-theme-600 focus:ring-0"
                  />
                  <span>Auto-scroll</span>
                </label>
                <button
                  onClick={() => copyToClipboard(logs)}
                  className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy logs"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="p-4">
            {activeTab === "terminal" ? (
              <div className="h-[360px] bg-background rounded-xl p-4 font-mono text-[12px] leading-relaxed text-zinc-300 overflow-y-auto whitespace-pre-wrap border border-border-subtle selection:bg-theme-600 selection:text-white">
                {logs || (
                  <div className="flex items-center justify-center h-full text-muted-foreground italic">
                    Playit agent is idle. Click 'Start Tunnel' or 'New Tunnel' to initialize.
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            ) : (
              <div className="h-[360px] overflow-y-auto pr-1 space-y-2">
                {isLoadingAudit ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-theme-500" />
                    <span>Loading audit records...</span>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 text-xs">
                    <Info className="w-5 h-5 text-muted-foreground/60" />
                    <span>No recovery or action events recorded yet.</span>
                  </div>
                ) : (
                  auditLogs.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3.5 bg-muted/40 rounded-xl border border-border-subtle text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              entry.success ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          {entry.action.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        Triggered by <span className="font-semibold text-foreground">{entry.performedBy}</span> ({entry.trigger}) &bull; Active players: {entry.playerCount}
                      </p>
                      <p className="text-foreground/90 font-medium">{entry.reason}</p>
                      {entry.details && (
                        <p className="text-[11px] text-muted-foreground font-mono bg-background/50 p-1.5 rounded-lg">
                          {entry.details}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: New Tunnel Confirmation (Option 1) */}
      <AnimatePresence>
        {showNewTunnelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border-subtle rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-theme-400">
                <div className="w-10 h-10 rounded-2xl bg-theme-500/10 border border-theme-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-theme-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Create New Tunnel</h3>
                  <p className="text-xs text-muted-foreground">Delete previous agent & generate new link</p>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-2xl border border-border-subtle text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  Is option se purana <strong>playit.toml</strong> agent secret delete ho jayega aur ek <strong>brand new claim link</strong> generate hoga.
                </p>
                <p className="text-theme-400 font-medium">
                  Aapko Playit.gg par ja kar naye agent ko claim karna hoga taaki naya public tunnel IP connect ho sake.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  onClick={() => setShowNewTunnelModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted-hover text-muted-foreground text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeNewTunnel}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-2 bg-theme-600 hover:bg-theme-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                >
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Delete Old & Create New Tunnel</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Connect Agent / Switch Agent Secret (Option 2) */}
      <AnimatePresence>
        {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border-subtle rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-theme-500/10 border border-theme-500/20 flex items-center justify-center text-theme-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Connect / Switch Playit Agent</h3>
                    <p className="text-xs text-muted-foreground">Ek hi server par alag alag agents link karein</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowConnectModal(false);
                    setModalFeedback(null);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs inside modal */}
              <div className="flex items-center gap-2 p-1 bg-muted rounded-xl border border-border-subtle">
                <button
                  onClick={() => {
                    setConnectTab("new");
                    setModalFeedback(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    connectTab === "new"
                      ? "bg-theme-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Connect Secret Key</span>
                </button>
                <button
                  onClick={() => {
                    setConnectTab("saved");
                    setModalFeedback(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    connectTab === "saved"
                      ? "bg-theme-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Saved Agents ({savedAgents.length})</span>
                </button>
              </div>

              {/* Feedback Message */}
              {modalFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    modalFeedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}
                >
                  {modalFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{modalFeedback.message}</span>
                </div>
              )}

              {/* Tab 1: Connect New Secret */}
              {connectTab === "new" ? (
                <form onSubmit={handleConnectAgentSubmit} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1">
                        <span>Playit Agent Secret Key</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSecretText(!showSecretText)}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {showSecretText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showSecretText ? "Hide Key" : "Show Key"}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showSecretText ? "text" : "password"}
                        value={secretInput}
                        onChange={(e) => setSecretInput(e.target.value)}
                        placeholder="Paste secret key (e.g. 018f3a... or playit.toml)"
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-theme-500 transition-colors"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                      Playit.gg dashboard se apna <strong>Agent Secret Key</strong> copy karein (Dashboard &rarr; Agents &rarr; Select Agent &rarr; Settings &rarr; Secret Key).
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">
                      Agent Profile Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={agentNameInput}
                      onChange={(e) => setAgentNameInput(e.target.value)}
                      placeholder="e.g. Main Survival Agent, EU Proxy, Bedwars Agent"
                      className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-theme-500 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="saveProfileCheck"
                      checked={saveProfileChecked}
                      onChange={(e) => setSaveProfileChecked(e.target.checked)}
                      className="rounded border-border-subtle text-theme-600 focus:ring-0"
                    />
                    <label htmlFor="saveProfileCheck" className="text-xs text-muted-foreground cursor-pointer select-none">
                      Save this agent in server library for 1-click switching later
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                    <button
                      type="button"
                      onClick={() => setShowConnectModal(false)}
                      className="px-4 py-2 bg-muted hover:bg-muted-hover text-muted-foreground text-xs font-semibold rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingSecret || !secretInput.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 bg-theme-600 hover:bg-theme-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {isSubmittingSecret ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Connect Agent</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Tab 2: Saved Agents List */
                <div className="space-y-3">
                  {savedAgents.length === 0 ? (
                    <div className="p-8 text-center bg-muted/30 border border-border-subtle rounded-2xl">
                      <Layers className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-foreground">No Saved Agents Yet</p>
                      <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">
                        Aapne is server par koi agent profile save nahi ki. 'Connect Secret Key' tab se naya agent add karein.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {savedAgents.map((agent) => {
                        const isActive =
                          secretInfo.secretKey &&
                          agent.secretKey &&
                          agent.secretKey.trim() === secretInfo.secretKey.trim();
                        const isSwitching = switchingAgentId === agent.id;

                        return (
                          <div
                            key={agent.id}
                            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              isActive
                                ? "bg-theme-500/10 border-theme-500/40 ring-1 ring-theme-500/20"
                                : "bg-card hover:bg-muted/40 border-border-subtle"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground truncate">
                                  {agent.name}
                                </span>
                                {isActive && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-theme-500/20 text-theme-400 border border-theme-500/30 shrink-0">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
                                Key: {agent.secretKey ? `${agent.secretKey.substring(0, 6)}••••${agent.secretKey.substring(agent.secretKey.length - 4)}` : "••••"}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {!isActive ? (
                                <button
                                  onClick={() => handleSwitchAgent(agent)}
                                  disabled={isSwitching || switchingAgentId !== null}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-600 hover:bg-theme-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                >
                                  {isSwitching ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                  )}
                                  <span>Switch</span>
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 px-2 py-1">
                                  <Check className="w-3.5 h-3.5" /> Connected
                                </span>
                              )}

                              <button
                                onClick={() => handleDeleteSavedAgent(agent.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                                title="Delete from saved agents"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2 border-t border-border-subtle flex justify-between items-center">
                    <button
                      onClick={() => setConnectTab("new")}
                      className="text-xs text-theme-400 hover:text-theme-300 font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Another Agent</span>
                    </button>
                    <button
                      onClick={() => setShowConnectModal(false)}
                      className="px-4 py-2 bg-muted hover:bg-muted-hover text-muted-foreground text-xs font-semibold rounded-xl transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Safety Warning Modal for Active Players */}
      <AnimatePresence>
        {playerWarningModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border-subtle rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-amber-500">
                <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                <h3 className="text-base font-bold text-foreground">Active Players Online</h3>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                There are currently <strong className="text-foreground">{playerCount} active player(s)</strong> connected to this server.
                Modifying or switching the Playit tunnel will temporarily drop active player connections and require them to reconnect.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  onClick={() => setPlayerWarningModal({ isOpen: false, action: "restart" })}
                  className="px-4 py-2 bg-muted hover:bg-muted-hover text-muted-foreground text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (playerWarningModal.action === "force_recover") {
                      executeForceRecover();
                    } else if (playerWarningModal.action === "new_tunnel") {
                      executeNewTunnel();
                    } else if (playerWarningModal.action === "switch_agent" && playerWarningModal.targetAgentId) {
                      executeSwitchAgent(playerWarningModal.targetAgentId);
                    } else {
                      executeRestart(true);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                >
                  Proceed Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
