import React, { useState, useEffect } from "react"; 
import { LoadingOverlay } from "../components/LoadingOverlay";
import DeleteServerModal from "./DeleteServerModal";
import { Trash2, AlertTriangle, User, Save, Globe, RefreshCw, Sliders, Lock, Network, Key, Copy, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { AnimatePresence, motion } from "framer-motion";
import SearchableDropdown from "./SearchableDropdown";
import SubUsersManager from "./SubUsersManager";

export default function ServerSettings({ serverId, server }: { serverId: string, server: any }) {
  const { runtimeLocked, defaultRuntime, isDev } = useSettings();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAction, setIsDeletingAction] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [owner, setOwner] = useState(server?.owner || "");
  const [ipAlias, setIpAlias] = useState(server?.ipAlias || "");
  const [ram, setRam] = useState<number | string>(server?.ram || 4);
  const [ramUnit, setRamUnit] = useState<"GB" | "MB">("GB");
  const [ramInputMB, setRamInputMB] = useState<number | string>(
    server?.ramMB ? server.ramMB : Math.round((server?.ram || 4) * 1024)
  );
  const [cpu, setCpu] = useState<number | string>(server?.cpu || 150);
  const [disk, setDisk] = useState<number | string>(server?.disk || 10);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAlias, setIsSavingAlias] = useState(false);
  const [isSavingResources, setIsSavingResources] = useState(false);

  // SFTP Details State
  const [sftpInfo, setSftpInfo] = useState<any>(null);
  const [sftpLoading, setSftpLoading] = useState(true);
  const [sftpError, setSftpError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isResettingSftp, setIsResettingSftp] = useState(false);
  const [showConfirmResetSftp, setShowConfirmResetSftp] = useState(false);
  
  const [isMigratingRuntime, setIsMigratingRuntime] = useState(false);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchSftpInfo = async () => {
    try {
      setSftpLoading(true);
      const res = await axios.get(`/api/servers/${serverId}/sftp`);
      setSftpInfo(res.data);
      setSftpError(null);
    } catch (e: any) {
      if (e.response?.status === 404) {
        setSftpInfo(null);
      } else {
        setSftpError("Failed to fetch SFTP details. The SFTP service might be unavailable.");
      }
    } finally {
      setSftpLoading(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const createSftpAccount = async () => {
    try {
      setSftpLoading(true);
      const res = await axios.post(`/api/servers/${serverId}/sftp/create`);
      setSftpInfo(res.data);
    } catch (e: any) {
      setSftpError(e.response?.data?.error || "Failed to create SFTP account");
    } finally {
      setSftpLoading(false);
    }
  };

  const executeResetPassword = async () => {
    try {
      setIsResettingSftp(true);
      setShowConfirmResetSftp(false);
      const res = await axios.post(`/api/servers/${serverId}/sftp/reset-password`);
      setSftpInfo(res.data);
    } catch (e: any) {
      setSftpError(e.response?.data?.error || "Failed to reset password");
    } finally {
      setIsResettingSftp(false);
    }
  };

  useEffect(() => {
    fetchSftpInfo();
  }, [serverId]);

  useEffect(() => {
    if (server) {
      setOwner(server.owner || "");
      setIpAlias(server.ipAlias || "");
      setRam(server.ram || 4);
      setRamInputMB(server.ramMB ? server.ramMB : Math.round((server.ram || 4) * 1024));
      setCpu(server.cpu || 150);
      setDisk(server.disk || 10);
    }
  }, [server]);
  
  useEffect(() => {
    if (user?.role === "admin" || user?.role === "owner") {
      axios.get("/api/auth/users").then(res => {
        setUsers(res.data);
      }).catch(() => {});
    }
  }, [user]);

  if (!server) return null;
  const canManage = user?.role === "admin" || user?.role === "owner" || server.owner === user?.id;

  const handleDelete = async () => {
    try {
      setIsDeletingAction(true);
      await axios.delete(`/api/servers/${serverId}`);
      navigate("/servers");
    } catch(e) {
      alert("Failed to delete server");
      setIsDeletingAction(false);
      setShowDeleteConfirm(false);
    }
  };


  const handleUpdateOwner = async () => {
    try {
      setIsSaving(true);
      await axios.put(`/api/servers/${serverId}/owner`, { owner });
      alert("Owner updated successfully");
    } catch(e) {
      alert("Failed to update owner");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateIpAlias = async () => {
    try {
      setIsSavingAlias(true);
      await axios.put(`/api/servers/${serverId}/ipalias`, { ipAlias });
      alert("IP Alias updated successfully");
    } catch(e) {
      alert("Failed to update IP Alias");
    } finally {
      setIsSavingAlias(false);
    }
  };

  const handleUpdateResources = async () => {
    try {
      setIsSavingResources(true);
      const parsedRamMB = typeof ramInputMB === "number" ? ramInputMB : parseInt(String(ramInputMB), 10) || 4096;
      const parsedRamGB = typeof ram === "number" ? ram : parseFloat(String(ram)) || 4;
      const parsedCpu = typeof cpu === "number" ? cpu : parseInt(String(cpu), 10) || 100;
      const parsedDisk = typeof disk === "number" ? disk : parseInt(String(disk), 10) || 10;

      const targetRam = ramUnit === "MB" ? parsedRamMB : parsedRamGB;
      await axios.put(`/api/servers/${serverId}/resources`, { ram: targetRam, cpu: parsedCpu, disk: parsedDisk });
      alert("Server resource allocation updated successfully!");
    } catch(e: any) {
      alert("Failed to update resources: " + (e.response?.data?.error || e.message));
    } finally {
      setIsSavingResources(false);
    }
  };

  return (
    <>
    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar text-foreground bg-transparent">
      <div className="max-w-3xl space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-2">Settings</h2>
          <p className="text-muted-foreground text-sm mb-6">Manage advanced configuration and access credentials for this unit.</p>
        </div>

        {/* SFTP DETAILS SECTION AT THE TOP */}
        <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-30 group hover:bg-black/60 transition-colors mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-theme-500 font-bold flex items-center gap-2">
              <Network className="w-5 h-5 text-theme-500" /> SFTP Connection Details
            </h3>
            {sftpInfo && (
              <span className="flex items-center gap-1.5 text-xs font-mono bg-theme-500/10 text-theme-400 px-2.5 py-1 rounded-full border border-theme-500/20">
                <ShieldCheck className="w-3.5 h-3.5" /> SFTP Ready
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            Secure File Transfer Protocol (SFTP) credentials for connecting external FTP/SFTP clients like FileZilla, WinSCP, or Cyberduck.
          </p>

          {sftpError && (
            <div className="mb-6 p-4 bg-theme-500/10 border border-theme-500/20 rounded-xl flex items-start text-theme-400">
              <AlertTriangle className="w-5 h-5 mr-3 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{sftpError}</p>
            </div>
          )}

          {sftpLoading ? (
            <div className="py-8 flex items-center justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-7 h-7 border-2 border-theme-600 border-t-transparent rounded-full" />
            </div>
          ) : !sftpInfo ? (
            <div className="p-6 rounded-2xl bg-muted/40 border border-border flex flex-col items-center justify-center text-center">
              <ShieldCheck className="w-10 h-10 text-theme-500 mb-3" />
              <h4 className="font-bold text-foreground mb-1">No SFTP Credentials Found</h4>
              <p className="text-xs text-muted-foreground max-w-md mb-4">
                An SFTP account has not been provisioned for this server yet. Create one now to securely access your server files.
              </p>
              <button
                onClick={createSftpAccount}
                className="px-5 py-2.5 bg-theme-600 hover:bg-theme-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-theme-600/20 text-xs flex items-center gap-2"
              >
                <Key className="w-4 h-4" /> Generate SFTP Credentials
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Host</label>
                  <div className="flex">
                    <div className="flex-1 bg-card border border-border border-r-0 rounded-l-xl px-3.5 py-2.5 font-mono text-sm text-foreground truncate">
                      {sftpInfo.host}
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleCopy(sftpInfo.host, 'host')}
                      className="px-3.5 bg-muted border border-border rounded-r-xl hover:bg-muted-hover transition-colors flex items-center justify-center"
                      title="Copy Host"
                    >
                      {copiedField === 'host' ? <Check className="w-4 h-4 text-theme-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Port</label>
                  <div className="flex">
                    <div className="flex-1 bg-card border border-border border-r-0 rounded-l-xl px-3.5 py-2.5 font-mono text-sm text-foreground">
                      {sftpInfo.port}
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleCopy(sftpInfo.port.toString(), 'port')}
                      className="px-3.5 bg-muted border border-border rounded-r-xl hover:bg-muted-hover transition-colors flex items-center justify-center"
                      title="Copy Port"
                    >
                      {copiedField === 'port' ? <Check className="w-4 h-4 text-theme-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Username</label>
                  <div className="flex">
                    <div className="flex-1 bg-card border border-border border-r-0 rounded-l-xl px-3.5 py-2.5 font-mono text-sm text-foreground truncate">
                      {sftpInfo.username}
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleCopy(sftpInfo.username, 'username')}
                      className="px-3.5 bg-muted border border-border rounded-r-xl hover:bg-muted-hover transition-colors flex items-center justify-center"
                      title="Copy Username"
                    >
                      {copiedField === 'username' ? <Check className="w-4 h-4 text-theme-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Password</label>
                  {sftpInfo.password?.startsWith("(Hidden") ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-card border border-border rounded-xl px-3.5 py-2.5 font-mono text-sm text-muted-foreground italic flex items-center justify-between">
                        <span>••••••••••••••••</span>
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowConfirmResetSftp(true)}
                        disabled={isResettingSftp}
                        className="px-3.5 py-2.5 bg-theme-600 hover:bg-theme-500 text-white font-bold rounded-xl transition-all shadow-md shadow-theme-600/20 flex items-center justify-center shrink-0 disabled:opacity-50 text-xs"
                      >
                        {isResettingSftp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                        Generate
                      </button>
                    </div>
                  ) : (
                    <div className="flex">
                      <div className="flex-1 bg-card border border-border border-r-0 rounded-l-xl px-3.5 py-2.5 font-mono text-sm truncate text-theme-500 font-bold bg-theme-600/5">
                        {showPassword ? sftpInfo.password : "••••••••••••••••"}
                      </div>
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="px-3 bg-card border border-theme-600/20 border-r-0 hover:bg-muted transition-colors flex items-center justify-center text-theme-500"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleCopy(sftpInfo.password, 'password')}
                        className="px-3.5 bg-theme-600/10 border border-theme-600/20 rounded-r-xl hover:bg-theme-600/20 transition-colors flex items-center justify-center text-theme-500"
                        title="Copy Password"
                      >
                        {copiedField === 'password' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-theme-500" />
                  <span>Use port <strong className="text-foreground">{sftpInfo.port}</strong> with SFTP (SSH File Transfer Protocol).</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmResetSftp(true)}
                  disabled={isResettingSftp}
                  className="text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1.5 self-start sm:self-auto transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResettingSftp ? "animate-spin" : ""}`} />
                  Reset SFTP Password
                </button>
              </div>
            </div>
          )}
        </div>

        {canManage ? (
          <>

            {isDev && (
              <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-30 group hover:bg-black/60 transition-colors mb-8">
                <h3 className="text-foreground font-bold mb-2 flex items-center">
                  <RefreshCw className={`w-5 h-5 mr-2 text-theme-500 ${isMigratingRuntime ? "animate-spin" : ""}`} /> Runtime Migration & Conversion
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Current execution runtime: <strong className="text-theme-400 uppercase font-mono">{server.runtimeType === 'local' ? 'Local Process' : 'Docker Container'}</strong>.
                  <span className="text-zinc-400/80 block mt-1">
                    You can seamlessly switch this unit between Docker Container isolation and Node.js Local Process execution. Make sure the server is stopped before migrating.
                  </span>
                </p>

                {migrationMessage && (
                  <div className={`mb-4 p-3 rounded-xl text-sm font-medium border ${migrationMessage.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`}>
                    {migrationMessage.text}
                  </div>
                )}
                
                {runtimeLocked ? (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
                    <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-200">Runtime Switching Locked</p>
                      <p className="mt-0.5 text-amber-300/80">
                        The execution engine is locked to <strong className="uppercase">{defaultRuntime === 'local' ? 'Local Process' : 'Docker Container'}</strong> by installation configuration (`install.sh`).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!showMigrateConfirm ? (
                      <button 
                        disabled={isMigratingRuntime}
                        onClick={() => setShowMigrateConfirm(true)}
                        className="bg-theme-600 hover:bg-theme-500 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-50 text-sm flex items-center gap-2 shadow-lg shadow-theme-600/20"
                      >
                        <RefreshCw className={`w-4 h-4 ${isMigratingRuntime ? "animate-spin" : ""}`} />
                        {isMigratingRuntime ? "Migrating Runtime..." : `Convert to ${server.runtimeType === 'local' ? 'Docker Container' : 'Local Process'}`}
                      </button>
                    ) : (
                      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-theme-500/30 space-y-3">
                        <p className="text-sm text-zinc-200">
                          Convert this server to <strong className="text-theme-400">{server.runtimeType === 'local' ? 'Docker Container' : 'Local Process'}</strong>?
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={isMigratingRuntime}
                            onClick={async () => {
                              const target = server.runtimeType === 'local' ? 'docker' : 'local';
                              setIsMigratingRuntime(true);
                              setMigrationMessage(null);
                              setShowMigrateConfirm(false);
                              try {
                                const token = localStorage.getItem("jtg_token") || localStorage.getItem("token");
                                const headers: any = {};
                                if (token) headers["Authorization"] = `Bearer ${token}`;
                                const res = await axios.put(`/api/servers/${serverId}/migrate-runtime`, { targetRuntime: target }, { headers });
                                setMigrationMessage({
                                  text: `Successfully converted runtime to ${target === 'local' ? 'Local Process' : 'Docker Container'}!`,
                                  type: "success"
                                });
                                if (server) {
                                  server.runtimeType = target;
                                }
                                setTimeout(() => {
                                  window.location.reload();
                                }, 1000);
                              } catch (err: any) {
                                setMigrationMessage({
                                  text: err.response?.data?.error || err.message || "Failed to migrate server runtime.",
                                  type: "error"
                                });
                                setIsMigratingRuntime(false);
                              }
                            }}
                            className="bg-theme-600 hover:bg-theme-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                          >
                            {isMigratingRuntime ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                            Confirm Conversion
                          </button>
                          <button
                            disabled={isMigratingRuntime}
                            onClick={() => setShowMigrateConfirm(false)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            
            
            
            {/* HARDWARE RESOURCES & RAM ALLOCATION */}
            {(user?.role === "admin" || user?.role === "owner" || server.owner === user?.id) && (
              <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-25 group hover:bg-black/60 transition-colors mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-theme-500 font-bold flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-theme-500" /> Hardware Resources & Memory (RAM)
                  </h3>
                  <span className="text-xs font-mono text-zinc-400">
                    Current: <strong className="text-white font-bold">{server.ram || 4} GB</strong> ({Math.round((server.ram || 4) * 1024)} MB)
                  </span>
                </div>
                <p className="text-muted-foreground text-sm mb-6">
                  Dynamically adjust memory limits (custom MB or GB), CPU processing cores, and NVMe disk quotas for this server instance.
                </p>

                <div className="space-y-6">
                  {/* Custom RAM Selection */}
                  <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/10 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                          RAM Allocation Limit
                        </label>
                        <span className="text-xs font-mono text-muted-foreground block mt-0.5">
                          Safe bounds: 512 MB to 131,072 MB (128 GB)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Unit Switcher */}
                        <div className="flex bg-zinc-900 border border-border rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRamUnit("MB");
                              const cur = typeof ram === "number" ? ram : (parseFloat(String(ram)) || 4);
                              setRamInputMB(Math.round(cur * 1024));
                            }}
                            className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md transition-all ${
                              ramUnit === "MB" ? "bg-theme-600 text-white shadow" : "text-muted-foreground hover:text-white"
                            }`}
                          >
                            MB
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRamUnit("GB");
                              const cur = typeof ramInputMB === "number" ? ramInputMB : (parseInt(String(ramInputMB), 10) || 4096);
                              setRam(Number((cur / 1024).toFixed(2)));
                            }}
                            className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md transition-all ${
                              ramUnit === "GB" ? "bg-theme-600 text-white shadow" : "text-muted-foreground hover:text-white"
                            }`}
                          >
                            GB
                          </button>
                        </div>

                        {/* Input Box */}
                        <div className="relative w-32">
                          {ramUnit === "MB" ? (
                            <input 
                              type="number" 
                              min="512" 
                              max="131072"
                              step="256"
                              value={ramInputMB} 
                              onChange={e => {
                                const valStr = e.target.value;
                                if (valStr === "") {
                                  setRamInputMB("");
                                  setRam("");
                                  return;
                                }
                                const val = parseInt(valStr, 10);
                                if (!isNaN(val)) {
                                  setRamInputMB(val);
                                  setRam(Number((val / 1024).toFixed(3)));
                                }
                              }}
                              className="w-full bg-card border border-border focus:border-theme-600 rounded-lg px-3 py-1 text-xs text-foreground font-mono outline-none pr-10"
                            />
                          ) : (
                            <input 
                              type="number" 
                              min="0.5" 
                              max="128"
                              step="0.5"
                              value={ram} 
                              onChange={e => {
                                const valStr = e.target.value;
                                if (valStr === "") {
                                  setRam("");
                                  setRamInputMB("");
                                  return;
                                }
                                const val = parseFloat(valStr);
                                if (!isNaN(val)) {
                                  setRam(val);
                                  setRamInputMB(Math.round(val * 1024));
                                }
                              }}
                              className="w-full bg-card border border-border focus:border-theme-600 rounded-lg px-3 py-1 text-xs text-foreground font-mono outline-none pr-10"
                            />
                          )}
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono pointer-events-none">
                            {ramUnit}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Equivalent Display */}
                    <div className="text-xs font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
                      <span>Equivalent: <strong className="text-theme-400 font-bold">
                        {ramUnit === "MB" 
                          ? `${typeof ramInputMB === "number" ? (ramInputMB / 1024).toFixed(2) : (parseInt(String(ramInputMB), 10) ? (parseInt(String(ramInputMB), 10) / 1024).toFixed(2) : 0)} GB` 
                          : `${typeof ram === "number" ? Math.round(ram * 1024) : (parseFloat(String(ram)) ? Math.round(parseFloat(String(ram)) * 1024) : 0)} MB`}
                      </strong></span>
                      {(() => {
                        const curMB = typeof ramInputMB === "number" ? ramInputMB : (parseInt(String(ramInputMB), 10) || 0);
                        const curGB = typeof ram === "number" ? ram : (parseFloat(String(ram)) || 0);
                        const isOutside = ramUnit === "MB" ? (curMB < 512 || curMB > 131072) : (curGB < 0.5 || curGB > 128);
                        if (isOutside && (curMB > 0 || curGB > 0)) {
                          return <span className="text-rose-400 font-semibold text-[11px]">⚠️ Outside recommended range (512 MB – 128 GB)</span>;
                        }
                        return null;
                      })()}
                    </div>
                    
                    {/* Quick RAM presets */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                      {[
                        { mb: 1024, gb: 1, label: "1024 MB (1G)" },
                        { mb: 2048, gb: 2, label: "2048 MB (2G)" },
                        { mb: 3072, gb: 3, label: "3072 MB (3G)" },
                        { mb: 4096, gb: 4, label: "4096 MB (4G)" },
                        { mb: 6144, gb: 6, label: "6144 MB (6G)" },
                        { mb: 8192, gb: 8, label: "8192 MB (8G)" },
                        { mb: 12288, gb: 12, label: "12288 MB (12G)" },
                        { mb: 16384, gb: 16, label: "16384 MB (16G)" },
                        { mb: 24576, gb: 24, label: "24576 MB (24G)" },
                        { mb: 32768, gb: 32, label: "32768 MB (32G)" },
                        { mb: 49152, gb: 48, label: "49152 MB (48G)" },
                        { mb: 65536, gb: 64, label: "65536 MB (64G)" },
                      ].map((preset) => {
                        const isSelected = ramUnit === "MB" ? ramInputMB === preset.mb : ram === preset.gb;
                        return (
                          <button
                            key={preset.mb}
                            type="button"
                            onClick={() => {
                              setRam(preset.gb);
                              setRamInputMB(preset.mb);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                              isSelected 
                                ? "bg-theme-600 text-white border-theme-500 shadow-md shadow-theme-600/30" 
                                : "bg-card/60 text-muted-foreground hover:text-foreground border-border hover:border-zinc-500"
                            }`}
                          >
                            {ramUnit === "MB" ? `${preset.mb} MB` : `${preset.gb} GB`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CPU and Disk */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        CPU Limit (%)
                      </label>
                      <input 
                        type="number" 
                        min="10" 
                        max="1600"
                        step="10"
                        value={cpu} 
                        onChange={e => {
                          const val = e.target.value;
                          setCpu(val === "" ? "" : parseInt(val, 10));
                        }}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-2.5 text-foreground font-mono text-sm outline-none"
                      />
                      <span className="text-[11px] text-muted-foreground font-mono mt-1 block">100% = 1 full CPU core</span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Disk Limit (GB)
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        max="1000"
                        value={disk} 
                        onChange={e => {
                          const val = e.target.value;
                          setDisk(val === "" ? "" : parseInt(val, 10));
                        }}
                        className="w-full bg-card border border-border focus:border-theme-600 rounded-xl px-4 py-2.5 text-foreground font-mono text-sm outline-none"
                      />
                      <span className="text-[11px] text-muted-foreground font-mono mt-1 block">Max server folder storage quota</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button 
                      onClick={handleUpdateResources}
                      disabled={isSavingResources || ((ramUnit === "MB" ? ramInputMB === (server.ramMB || Math.round((server.ram || 4) * 1024)) : ram === server.ram) && cpu === server.cpu && disk === server.disk)}
                      className="px-6 py-2.5 bg-theme-600 hover:bg-theme-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center text-sm shadow-lg shadow-theme-600/20 active:scale-95"
                    >
                      <Save className={`w-4 h-4 mr-2 ${isSavingResources ? "animate-spin" : ""}`} />
                      {isSavingResources ? "Applying..." : "Save Resources"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-20 group hover:bg-black/60 transition-colors mb-8">
              <h3 className="text-theme-500 font-bold mb-2 flex items-center">
                <Globe className="w-5 h-5 mr-2" /> Server IP Alias
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Set a custom domain or IP to display on the console page.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={ipAlias} 
                    onChange={e => setIpAlias(e.target.value)} 
                    placeholder="e.g. play.example.com"
                    className="w-full bg-card border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2 text-foreground transition-all shadow-inner outline-none font-mono"
                  />
                </div>
                <button 
                  onClick={handleUpdateIpAlias}
                  disabled={isSavingAlias || ipAlias === (server.ipAlias || "")}
                  className="px-6 py-2 bg-theme-600/10 hover:bg-theme-600/20 text-theme-500 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" /> Save
                </button>
              </div>
            </div>

            {(user?.role === "admin" || user?.role === "owner") ? (
              <>

                <div className="bg-black/40 dark:bg-black/40 backdrop-blur-xl border border-border p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(0,0,0,0.5)] ring-1 ring-border-subtle relative z-10 group hover:bg-black/60 transition-colors mb-8">
                  <h3 className="text-theme-500 font-bold mb-2 flex items-center">
                    <User className="w-5 h-5 mr-2" /> Server Ownership
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Transfer the ownership of this server to another user.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <SearchableDropdown
                        value={owner}
                        onChange={setOwner}
                        options={users.map(u => ({ value: u.id, label: `${u.username} (${u.role})` }))}
                        placeholder="Select an owner..."
                        searchPlaceholder="Search users..."
                        className="bg-card"
                      />
                    </div>
                    <button 
                      onClick={handleUpdateOwner}
                      disabled={isSaving || owner === server.owner}
                      className="px-6 py-2 bg-theme-600/10 hover:bg-theme-600/20 text-theme-500 font-medium rounded-xl border border-theme-600/20 transition-all disabled:opacity-50 flex items-center"
                    >
                      <Save className="w-4 h-4 mr-2" /> Save
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {/* SUB-USERS ACCESS MANAGEMENT */}
            <SubUsersManager serverId={serverId} embedded={true} />

            {/* DANGER ZONE - DELETE SERVER */}
            {(user?.role === "admin" || user?.role === "owner" || server.owner === user?.id) && (
              <div className="bg-red-950/20 backdrop-blur-xl border border-red-500/30 p-6 md:p-8 rounded-3xl shadow-[0_0_40px_-15px_rgba(239,68,68,0.2)] ring-1 ring-red-500/20 relative z-10">
                <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
                  <div>
                    <h3 className="text-red-400 font-bold mb-1 flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-red-500" /> Danger Zone: Delete Server
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-xl">
                      Permanently terminate and delete this server instance. All world saves, files, and configurations will be removed immediately.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95 flex items-center gap-2 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Server
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
           <div className="text-muted-foreground text-sm p-4 bg-muted rounded-xl border border-border-subtle">
             You do not have permission to manage this server's settings.
           </div>
        )}
      </div>

      <DeleteServerModal
        isOpen={showDeleteConfirm}
        server={server}
        onClose={() => setShowDeleteConfirm(false)}
        onSuccess={() => {
          setShowDeleteConfirm(false);
          navigate("/servers");
        }}
      />

      {isSaving && <LoadingOverlay message="Saving Ownership..." subMessage="Updating server assignment permissions..." />}
      {isSavingAlias && <LoadingOverlay message="Saving IP Alias..." subMessage="Registering domain alias configuration..." />}
      {isResettingSftp && <LoadingOverlay message="Resetting SFTP Credentials..." subMessage="Generating secure cryptographic password and updating server auth..." />}

      <AnimatePresence>
        {showConfirmResetSftp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#121214] border border-orange-500/30 shadow-2xl shadow-orange-500/10 rounded-2xl p-6 max-w-md w-full relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-theme-500" />
              <div className="flex items-start mb-4">
                <div className="bg-orange-500/10 p-3 rounded-full mr-4">
                  <AlertTriangle className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">Reset SFTP Password</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Are you sure you want to reset your SFTP password? The old password will immediately become invalid and any active sessions will be disconnected.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowConfirmResetSftp(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted-hover text-foreground font-medium rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeResetPassword}
                  className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 font-bold rounded-xl transition-colors border border-orange-500/30 text-sm"
                >
                  Reset Password
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
