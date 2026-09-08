import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";
import {
  Globe,
  ExternalLink,
  Check,
  Copy,
  AlertCircle,
  ShieldCheck,
  Download,
  Play,
  X,
  RefreshCw,
  Layers,
  Sparkles,
  ArrowRight,
  Info
} from "lucide-react";
import { SavedPlayitAgent } from "../types/playit";

interface PlayitFirstStartModalProps {
  serverId: string;
  serverName: string;
  isOpen: boolean;
  onClose: () => void;
  onProceedStart: (options: { installPlugin: boolean; withPlayit: boolean }) => Promise<void>;
}

export const PlayitFirstStartModal: React.FC<PlayitFirstStartModalProps> = ({
  serverId,
  serverName,
  isOpen,
  onClose,
  onProceedStart
}) => {
  // Plugin state
  const [installPluginChecked, setInstallPluginChecked] = useState(true);
  const [isPluginInstalled, setIsPluginInstalled] = useState(false);
  const [pluginFileName, setPluginFileName] = useState<string | null>(null);
  const [isInstallingPlugin, setIsInstallingPlugin] = useState(false);
  const [pluginFeedback, setPluginFeedback] = useState<string | null>(null);

  // Playit agent state
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [agentMode, setAgentMode] = useState<"detecting" | "new_agent" | "existing_agents">("detecting");
  const [savedAgents, setSavedAgents] = useState<SavedPlayitAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [playitStatus, setPlayitStatus] = useState<string>("stopped");
  const [claimLink, setClaimLink] = useState<string | null>(null);
  const [publicAddress, setPublicAddress] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);

  // Action / creation state
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false);
  const [copiedClaim, setCopiedClaim] = useState(false);
  const [customSecretInput, setCustomSecretInput] = useState("");
  const [isSubmittingCustomSecret, setIsSubmittingCustomSecret] = useState(false);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [hasOpenedTabOnce, setHasOpenedTabOnce] = useState(false);

  // Custom agent switch feedback
  const [agentFeedback, setAgentFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const pollIntervalRef = useRef<any>(null);

  // Load status and check plugin on modal open
  useEffect(() => {
    if (!isOpen) return;

    checkPluginStatus();
    fetchPlayitData(true);

    pollIntervalRef.current = setInterval(() => {
      fetchPlayitData(false);
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, serverId]);

  // Check if official playit plugin is installed in plugins/
  const checkPluginStatus = async () => {
    try {
      const res = await axios.get(`/api/servers/${serverId}/playit/plugin-status`);
      setIsPluginInstalled(!!res.data.installed);
      setPluginFileName(res.data.fileName || null);
    } catch {
      setIsPluginInstalled(false);
    }
  };

  // Fetch Playit status, agent info, and saved agents
  const fetchPlayitData = async (isInitial = false) => {
    if (isInitial) setIsLoadingStatus(true);
    try {
      const res = await axios.get(`/api/servers/${serverId}/playit`);
      setPlayitStatus(res.data.status || "stopped");
      const currentClaim = res.data.claimLink || null;
      setClaimLink(currentClaim);
      setPublicAddress(res.data.publicAddress || null);

      const saved: SavedPlayitAgent[] = res.data.savedAgents || [];
      setSavedAgents(saved);

      const secretInfo = res.data.secretInfo || {};
      setIsConfigured(!!secretInfo.isConfigured);
      setMaskedKey(secretInfo.maskedKey || null);

      // Auto-open new tab if a claimLink was just generated and hasn't opened yet
      if (currentClaim && !hasOpenedTabOnce && isGeneratingAgent) {
        setHasOpenedTabOnce(true);
        window.open(currentClaim, "_blank");
      }

      // Auto-detect mode on initial fetch
      if (isInitial) {
        if (saved.length > 0 || secretInfo.isConfigured) {
          setAgentMode("existing_agents");
          if (saved.length > 0) {
            setSelectedAgentId(saved[0].id);
          } else {
            setSelectedAgentId("current_configured");
          }
        } else {
          setAgentMode("new_agent");
        }
      }
    } catch (e) {
      console.error("Failed to load playit data", e);
    } finally {
      if (isInitial) setIsLoadingStatus(false);
    }
  };

  // 1-Click Install Official Plugin
  const handleInstallPluginNow = async () => {
    setIsInstallingPlugin(true);
    setPluginFeedback(null);
    try {
      const res = await axios.post(`/api/servers/${serverId}/playit/install-plugin`);
      setIsPluginInstalled(true);
      setPluginFileName(res.data.fileName || "playit-minecraft-plugin.jar");
      setPluginFeedback("Official Playit.gg plugin installed directly into plugins/ folder!");
    } catch (err: any) {
      setPluginFeedback("Failed to install plugin: " + (err.response?.data?.error || err.message));
    } finally {
      setIsInstallingPlugin(false);
    }
  };

  // Create / Generate New Playit Agent
  const handleCreateNewAgent = async () => {
    setIsGeneratingAgent(true);
    setHasOpenedTabOnce(false);
    setClaimLink(null);
    setAgentFeedback(null);
    try {
      await axios.post(`/api/servers/${serverId}/playit/reset`);
      // Start polling faster for the claim link
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const res = await axios.get(`/api/servers/${serverId}/playit`);
          if (res.data.claimLink) {
            setClaimLink(res.data.claimLink);
            setHasOpenedTabOnce(true);
            window.open(res.data.claimLink, "_blank");
            clearInterval(pollTimer);
            setIsGeneratingAgent(false);
          }
        } catch {}
        if (attempts > 15) {
          clearInterval(pollTimer);
          setIsGeneratingAgent(false);
        }
      }, 1500);
    } catch (err: any) {
      setAgentFeedback({
        type: "error",
        text: "Could not create agent: " + (err.response?.data?.error || err.message)
      });
      setIsGeneratingAgent(false);
    }
  };

  // Connect / Select Existing Agent Profile
  const handleSelectExistingAgent = async (agentId: string) => {
    setSelectedAgentId(agentId);
    if (agentId === "current_configured") return;

    setAgentFeedback(null);
    try {
      await axios.post(`/api/servers/${serverId}/playit/switch-agent`, { agentId });
      setAgentFeedback({
        type: "success",
        text: "Selected agent profile activated for public tunnel!"
      });
      await fetchPlayitData(false);
    } catch (err: any) {
      setAgentFeedback({
        type: "error",
        text: "Failed to switch agent: " + (err.response?.data?.error || err.message)
      });
    }
  };

  // Submit custom agent secret key
  const handleConnectCustomSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSecretInput.trim()) return;

    setIsSubmittingCustomSecret(true);
    setAgentFeedback(null);
    try {
      await axios.post(`/api/servers/${serverId}/playit/connect-agent`, {
        secretKey: customSecretInput.trim(),
        name: `Agent-${Date.now().toString().slice(-4)}`,
        saveProfile: true
      });
      setCustomSecretInput("");
      setAgentFeedback({
        type: "success",
        text: "Custom agent secret connected and tunnel linked!"
      });
      await fetchPlayitData(false);
    } catch (err: any) {
      setAgentFeedback({
        type: "error",
        text: "Error linking secret key: " + (err.response?.data?.error || err.message)
      });
    } finally {
      setIsSubmittingCustomSecret(false);
    }
  };

  // Open Claim or Dashboard in new tab
  const handleOpenNewTab = (url: string) => {
    window.open(url, "_blank");
  };

  const handleCopyClaim = () => {
    if (!claimLink) return;
    navigator.clipboard.writeText(claimLink);
    setCopiedClaim(true);
    setTimeout(() => setCopiedClaim(false), 2000);
  };

  // Proceed with Start
  const handleFinalStart = async (withPlayit: boolean) => {
    setIsStartingServer(true);
    try {
      // 1. If user confirmed plugin install and it's not installed yet, install it
      if (withPlayit && installPluginChecked && !isPluginInstalled) {
        try {
          await axios.post(`/api/servers/${serverId}/playit/install-plugin`);
        } catch (e) {
          console.warn("Plugin install step encountered error, continuing server start:", e);
        }
      }

      // 2. Mark first start completed
      await axios.post(`/api/servers/${serverId}/first-start-done`).catch(() => {});

      // 3. Trigger start server in parent
      await onProceedStart({
        installPlugin: installPluginChecked,
        withPlayit
      });

      onClose();
    } catch (err) {
      console.error("Failed to start server", err);
    } finally {
      setIsStartingServer(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden my-auto text-foreground"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500">
                <Globe size={22} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  First Server Start: Playit.gg Setup
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-theme-500/15 text-theme-500 border border-theme-500/30 font-semibold">
                    Recommended
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Configure free public tunnel ingress and official plugin for <strong className="text-foreground">{serverName}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Step 1: Official Plugin Installation Confirmation */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500 shrink-0 mt-0.5">
                    <Download size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">
                        Official Playit.gg Plugin
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground border border-border font-medium">
                        v0.2.0 Latest Release
                      </span>
                      {isPluginInstalled && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                          <Check size={10} /> Installed in plugins/
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Download official Playit Minecraft plugin directly into your server&apos;s <code className="text-theme-500 bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono border border-border">plugins/</code> directory from official releases so players can connect instantly without port forwarding.
                    </p>
                  </div>
                </div>

                {/* Switch Toggle (Active = Red, Inactive = Blue) */}
                <div className="shrink-0 flex items-center">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={installPluginChecked}
                    onClick={() => setInstallPluginChecked(!installPluginChecked)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      installPluginChecked
                        ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)] jtg-toggle-on"
                        : "bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] jtg-toggle-off"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        installPluginChecked ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Status or instant install action */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs border-t border-border">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Info size={13} className="text-theme-500" />
                  {isPluginInstalled ? (
                    <span className="text-emerald-500 font-medium">
                      Plugin active: <strong className="font-mono">{pluginFileName || "playit-minecraft-plugin.jar"}</strong>
                    </span>
                  ) : installPluginChecked ? (
                    <span>Will be auto-installed into <strong className="text-foreground">plugins/</strong> before server boots.</span>
                  ) : (
                    <span className="text-amber-500 font-medium">Plugin installation skipped.</span>
                  )}
                </span>

                {!isPluginInstalled && (
                  <button
                    type="button"
                    disabled={isInstallingPlugin}
                    onClick={handleInstallPluginNow}
                    className="px-3 py-1 bg-muted hover:bg-muted-hover text-foreground rounded-lg text-xs font-medium border border-border transition-colors flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                  >
                    {isInstallingPlugin ? (
                      <RefreshCw size={12} className="animate-spin text-theme-500" />
                    ) : (
                      <Download size={12} className="text-theme-500" />
                    )}
                    <span>Install Now</span>
                  </button>
                )}
              </div>

              {pluginFeedback && (
                <div className="text-xs p-2.5 rounded-lg bg-theme-500/10 text-foreground border border-theme-500/30 flex items-center gap-2">
                  <Check size={14} className="text-theme-500 shrink-0" />
                  <span>{pluginFeedback}</span>
                </div>
              )}
            </div>

            {/* Step 2: Agent & Tunnel Selection / Creation */}
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      Playit Agent &amp; Public Tunnel
                      {publicAddress && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-theme-500/15 text-theme-500 border border-theme-500/30 font-bold">
                          Online: {publicAddress}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Auto-detected agent profiles and tunnel connectivity.
                    </p>
                  </div>
                </div>

                {/* Tabs to switch modes */}
                <div className="flex items-center rounded-lg bg-muted p-0.5 border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setAgentMode("new_agent")}
                    className={`px-3 py-1 rounded-md transition-all ${
                      agentMode === "new_agent"
                        ? "bg-theme-600 text-white font-semibold shadow-sm [data-btn-accent='true'] btn-primary-action"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    New Agent
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgentMode("existing_agents")}
                    className={`px-3 py-1 rounded-md transition-all ${
                      agentMode === "existing_agents"
                        ? "bg-theme-600 text-white font-semibold shadow-sm [data-btn-accent='true'] btn-primary-action"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Select Agent {savedAgents.length > 0 && `(${savedAgents.length})`}
                  </button>
                </div>
              </div>

              {/* Mode A: New Agent Generation (Auto opens link in new tab) */}
              {agentMode === "new_agent" && (
                <div className="space-y-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-foreground space-y-2">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <Sparkles size={14} className="text-theme-500" />
                      Generate New Agent &amp; Claim in New Tab:
                    </p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Click below to generate a new agent session. The official Playit.gg claim link will <strong>automatically open in a new tab</strong> where you can claim and connect the Minecraft port.
                    </p>

                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={isGeneratingAgent}
                        onClick={handleCreateNewAgent}
                        className="btn-primary-action px-4 py-2 bg-theme-600 hover:bg-theme-500 text-white font-semibold rounded-lg text-xs shadow-md shadow-theme-600/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        {isGeneratingAgent ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <ExternalLink size={14} />
                        )}
                        <span>Create Agent &amp; Open Claim Link</span>
                      </button>

                      {claimLink && (
                        <button
                          type="button"
                          onClick={() => handleOpenNewTab(claimLink)}
                          className="px-3.5 py-2 bg-muted hover:bg-muted-hover text-foreground font-medium rounded-lg text-xs border border-border transition-colors flex items-center gap-1.5"
                        >
                          <ExternalLink size={13} className="text-theme-500" />
                          <span>Open Link Again</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Claim Link Display if Present */}
                  {claimLink && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-xl bg-theme-500/10 border border-theme-500/30 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-theme-500 flex items-center gap-1.5">
                          <AlertCircle size={14} className="text-theme-500 shrink-0" />
                          Claim Link Ready (Opened in New Tab)
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyClaim}
                          className="px-2 py-1 bg-card hover:bg-muted text-foreground rounded text-[11px] font-mono border border-border flex items-center gap-1 transition-colors"
                        >
                          {copiedClaim ? <Check size={12} className="text-theme-500" /> : <Copy size={12} />}
                          <span>{copiedClaim ? "Copied" : "Copy URL"}</span>
                        </button>
                      </div>

                      <div className="p-2 bg-card rounded border border-theme-500/30 font-mono text-[11px] text-theme-500 font-semibold break-all select-all">
                        {claimLink}
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        Playit.gg tab me <strong>&quot;Add to account&quot;</strong> karein. Claim hone ke baad tunnel automatically live ho jayegi.
                      </p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Mode B: Auto-detected Agents / Existing Selection */}
              {agentMode === "existing_agents" && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs text-foreground">
                    <p className="font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-theme-500" />
                      Auto-detected Agent Profiles ({savedAgents.length + (isConfigured ? 1 : 0)} found):
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      Select which Playit agent to bind for this server, or connect a new Secret Key.
                    </p>
                  </div>

                  {/* Agent Profiles Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Currently configured secret if present */}
                    {isConfigured && (
                      <button
                        type="button"
                        onClick={() => handleSelectExistingAgent("current_configured")}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          selectedAgentId === "current_configured"
                            ? "bg-theme-500/15 border-theme-500 shadow-md shadow-theme-500/10 ring-1 ring-theme-500/30 text-foreground"
                            : "bg-card border-border hover:border-theme-500/40 hover:bg-muted/30 text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1">
                            Current Active Agent
                          </span>
                          {selectedAgentId === "current_configured" && (
                            <Check size={14} className="text-theme-500" />
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground mt-1">
                          Key: {maskedKey || "Saved in playit.toml"}
                        </p>
                      </button>
                    )}

                    {/* Saved agent list */}
                    {savedAgents.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => handleSelectExistingAgent(agent.id)}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          selectedAgentId === agent.id
                            ? "bg-theme-500/15 border-theme-500 shadow-md shadow-theme-500/10 ring-1 ring-theme-500/30 text-foreground"
                            : "bg-card border-border hover:border-theme-500/40 hover:bg-muted/30 text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground truncate max-w-[140px]">
                            {agent.name}
                          </span>
                          {selectedAgentId === agent.id && (
                            <Check size={14} className="text-theme-500" />
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground mt-1">
                          Key: {agent.secretKey ? `${agent.secretKey.slice(0, 8)}...` : "Configured"}
                        </p>
                      </button>
                    ))}
                  </div>

                  {/* Option to enter a new secret key */}
                  <form onSubmit={handleConnectCustomSecret} className="pt-2 flex items-center gap-2">
                    <input
                      type="password"
                      placeholder="Paste Playit Agent Secret Key..."
                      value={customSecretInput}
                      onChange={(e) => setCustomSecretInput(e.target.value)}
                      className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-theme-500 focus:ring-1 focus:ring-theme-500/30"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingCustomSecret || !customSecretInput.trim()}
                      className="px-3 py-1.5 bg-muted hover:bg-muted-hover text-foreground rounded-lg text-xs font-medium border border-border transition-colors disabled:opacity-50 shrink-0"
                    >
                      {isSubmittingCustomSecret ? "Connecting..." : "Add Agent Key"}
                    </button>
                  </form>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span>Manage all agents on Playit account:</span>
                    <button
                      type="button"
                      onClick={() => handleOpenNewTab("https://playit.gg/manage/agents")}
                      className="text-theme-500 hover:text-theme-600 font-medium flex items-center gap-1"
                    >
                      <span>Open Playit Dashboard</span>
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </div>
              )}

              {agentFeedback && (
                <div
                  className={`text-xs p-2.5 rounded-lg border flex items-center gap-2 ${
                    agentFeedback.type === "success"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500 font-medium"
                      : "bg-red-500/15 border-red-500/30 text-red-500 font-medium"
                  }`}
                >
                  {agentFeedback.type === "success" ? (
                    <Check size={14} className="shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="shrink-0" />
                  )}
                  <span>{agentFeedback.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/40 flex-wrap gap-2">
            <button
              type="button"
              disabled={isStartingServer}
              onClick={() => handleFinalStart(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg hover:bg-muted"
            >
              Start Without Playit (Skip)
            </button>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                disabled={isStartingServer}
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isStartingServer}
                onClick={() => handleFinalStart(true)}
                className="btn-primary-action px-5 py-2 rounded-xl text-xs font-bold text-white bg-theme-600 hover:bg-theme-500 shadow-lg shadow-theme-600/25 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isStartingServer ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Booting Server...</span>
                  </>
                ) : (
                  <>
                    <Play size={13} className="fill-white" />
                    <span>Start Server With Playit</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
