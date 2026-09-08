// @ts-nocheck
// @ts-nocheck
import React, { useEffect, useState } from "react"; 
import { LoadingOverlay } from "../components/LoadingOverlay";
import { useParams, Link, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Terminal, Folder, Play, Square, RefreshCw, ArrowLeft, Sliders, Archive, AlertTriangle, Copy, Check, Menu, X, Users, LogOut, Lock, Globe, Zap, Sparkles, Radio, LayoutDashboard, Plus, Server as ServerIcon, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";

import ServerConsole from "../components/ServerConsole";
import ServerResourceDashboard from "../components/ServerResourceDashboard";
import FileManager from "../components/FileManager";
import ServerSettings from "../components/ServerSettings";
import ServerProperties from "../components/ServerProperties";
import ServerBackups from "../components/ServerBackups";
import PluginManager from "../components/PluginManager";
import ModManager from "../components/ModManager";
import PlayerManager from "../components/PlayerManager";
import SubUsersManager from "../components/SubUsersManager";
import ServerSFTP from "../components/ServerSFTP";
import PlayitTunnel from "./PlayitTunnel";
import WorldManager from "../components/WorldManager";
import ResourcePackManager from "../components/ResourcePackManager";
import AddonsManager from "../components/AddonsManager";
import SoftwareManager from "../components/SoftwareManager";
import { PlayitFirstStartModal } from "../components/PlayitFirstStartModal";
import { Map, Palette } from "lucide-react";
import { Puzzle, Box, Network, Cpu, Layers as LayersIcon } from "lucide-react";
import { Settings } from "lucide-react";
import { useSettings } from "../context/SettingsContext";


export default function ServerView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enablePlayit } = useSettings();
  const { user } = useAuth();
  const [server, setServer] = useState<any>(null);
  const [totalSystemRam, setTotalSystemRam] = useState<number>(0);
  const [showRamWarning, setShowRamWarning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    return localStorage.getItem("jtg_server_sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) {
      if (desktopSidebarCollapsed) {
        setSidebarOpen(prev => !prev);
      } else {
        setDesktopSidebarCollapsed(true);
        localStorage.setItem("jtg_server_sidebar_collapsed", "true");
      }
    } else {
      setSidebarOpen(prev => !prev);
    }
  };

  // Auto-close mobile sidebar on page navigation ("jab click kar da to hat ja")
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Playit Agent & Tunnel State
  const [playitStatus, setPlayitStatus] = useState<"running" | "stopped" | "checking">("checking");
  const [playitPublicAddress, setPlayitPublicAddress] = useState<string | null>(null);
  const [isPlayitProcessing, setIsPlayitProcessing] = useState(false);
  const [copiedPlayit, setCopiedPlayit] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>("start");
  const [showPlayitFirstStartModal, setShowPlayitFirstStartModal] = useState(false);

  const handleCopyIp = () => {
    if (!server) return;
    const textToCopy = server.ipAlias ? `${server.ipAlias}:${server.port}` : `${window.location.hostname}:${server.port}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPlayitAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playitPublicAddress) return;
    navigator.clipboard.writeText(playitPublicAddress);
    setCopiedPlayit(true);
    setTimeout(() => setCopiedPlayit(false), 2000);
  };

  const fetchServer = async () => {
    try {
      const res = await axios.get(`/api/servers/${id}`);
      setServer(res.data);
    } catch(e) {}
  };

  const fetchPlayitStatus = async () => {
    try {
      const res = await axios.get(`/api/servers/${id}/playit`);
      setPlayitStatus(res.data.status || "stopped");
      setPlayitPublicAddress(res.data.publicAddress || null);
    } catch (e) {
      setPlayitStatus("stopped");
    }
  };

  useEffect(() => {
    fetchServer();
    fetchPlayitStatus();
    axios.get("/api/system/stats").then(res => {
      setTotalSystemRam(res.data.totalMemory / (1024 * 1024 * 1024));
    }).catch(() => {});
    const interval = setInterval(() => {
      fetchServer();
      fetchPlayitStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const executeAction = async (action: string) => {
    setIsProcessing(true);
    try {
       if (action === 'start-both') {
         setIsPlayitProcessing(true);
         await Promise.allSettled([
           axios.post(`/api/servers/${id}/start`),
           axios.post(`/api/servers/${id}/playit/start`)
         ]);
         await Promise.allSettled([fetchServer(), fetchPlayitStatus()]);
       } else {
         await axios.post(`/api/servers/${id}/${action}`);
         await fetchServer();
       }
    } catch(e) {} finally {
       setIsProcessing(false);
       setIsPlayitProcessing(false);
    }
  };

  const handleAction = async (action: string) => {
    // If it's the very first time starting this server, trigger the Playit Setup & Plugin confirmation modal!
    if (
      (action === 'start' || action === 'start-both') &&
      server &&
      !server.hasStartedOnce &&
      !server.firstStartDone &&
      (server.status === 'offline' || server.status === 'stopped')
    ) {
      setPendingAction(action);
      setShowPlayitFirstStartModal(true);
      return;
    }

    if ((action === 'start' || action === 'start-both') && totalSystemRam > 0 && server?.ram > totalSystemRam && !showRamWarning) {
      setPendingAction(action);
      setShowRamWarning(true);
      return;
    }
    executeAction(action);
  };

  const handleProceedFirstStart = async (options: { installPlugin: boolean; withPlayit: boolean }) => {
    setShowPlayitFirstStartModal(false);
    if (options.withPlayit) {
      await executeAction('start-both');
    } else {
      await executeAction('start');
    }
    await fetchServer();
    await fetchPlayitStatus();
  };

  const handlePlayitStart = async () => {
    setIsPlayitProcessing(true);
    try {
      await axios.post(`/api/servers/${id}/playit/start`);
      setPlayitStatus("running");
      await fetchPlayitStatus();
    } catch (e) {
      console.error("Failed to start playit", e);
    } finally {
      setIsPlayitProcessing(false);
    }
  };

  const handlePlayitStop = async () => {
    setIsPlayitProcessing(true);
    try {
      await axios.post(`/api/servers/${id}/playit/stop`);
      setPlayitStatus("stopped");
      await fetchPlayitStatus();
    } catch (e) {
      console.error("Failed to stop playit", e);
    } finally {
      setIsPlayitProcessing(false);
    }
  };

  if (!server) return (
    <div className="h-full flex items-center justify-center p-8">
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-2 border-theme-600 border-t-transparent rounded-full"
      />
    </div>
  );

  if (server.suspended) return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-theme-500/20 bg-black/40 dark:bg-black/40 backdrop-blur-md p-8 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-theme-500/10 flex items-center justify-center border border-theme-500/20 mb-4">
          <Lock className="w-8 h-8 text-theme-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Server Suspended</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          This server has been suspended by an administrator. You cannot access or manage this server until the suspension is removed.
        </p>
        <Link 
          to="/servers" 
          className="inline-flex items-center justify-center px-6 py-2.5 bg-muted hover:bg-muted-hover text-foreground text-sm font-medium rounded-lg transition-colors border border-border"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );

  const serverTypeUpper = server?.type?.toUpperCase() || "";
  const isGenericApp = ["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(serverTypeUpper);
  const isProxy = ["VELOCITY", "BUNGEECORD", "WATERFALL"].includes(serverTypeUpper);

  let tabs: any[] = [];
  if (isGenericApp) {
    tabs = [
      { name: "Console", path: `/servers/${id}`, exactPath: "", icon: <Terminal size={18} /> },
      { name: "File Manager", path: `/servers/${id}/files`, exactPath: "files", icon: <Folder size={18} /> },
      { name: "Software", path: `/servers/${id}/software`, exactPath: "software", icon: <LayersIcon size={18} /> },
      { name: "Backup", path: `/servers/${id}/backup`, exactPath: "backup", icon: <Archive size={18} /> },
      { name: "Settings", path: `/servers/${id}/settings`, exactPath: "settings", icon: <Settings size={18} /> },
    ];
  } else {
    tabs = [
      { name: "Terminal", path: `/servers/${id}`, exactPath: "", icon: <Terminal size={18} /> },
      { name: "Players", path: `/servers/${id}/players`, exactPath: "players", icon: <Users size={18} /> },
      { name: "File Manager", path: `/servers/${id}/files`, exactPath: "files", icon: <Folder size={18} /> },
    ];

    if (!isProxy) {
      tabs.splice(1, 0, { name: "Properties", path: `/servers/${id}/properties`, exactPath: "properties", icon: <Sliders size={18} /> });
      tabs.splice(2, 0, { name: "World", path: `/servers/${id}/world`, exactPath: "world", icon: <Map size={18} /> });
      tabs.splice(3, 0, { name: "Add-ons", path: `/servers/${id}/addons`, exactPath: "addons", icon: <Box size={18} /> });
    }

    if (["PAPER", "SPIGOT", "PURPUR", "BUNGEECORD", "VELOCITY", "WATERFALL"].includes(serverTypeUpper)) {
      tabs.push({ name: "Plugins", path: `/servers/${id}/plugins`, exactPath: "plugins", icon: <Puzzle size={18} /> });
    }

    if (["FORGE", "FABRIC", "NEOFORGE", "QUILT"].includes(serverTypeUpper)) {
      tabs.push({ name: "Mods", path: `/servers/${id}/mods`, exactPath: "mods", icon: <Box size={18} /> });
    }

    tabs.push(
      { name: "Settings", path: `/servers/${id}/settings`, exactPath: "settings", icon: <Settings size={18} /> },
      { name: "Software", path: `/servers/${id}/software`, exactPath: "software", icon: <LayersIcon size={18} /> },
      { name: "Backup", path: `/servers/${id}/backup`, exactPath: "backup", icon: <Archive size={18} /> }
    );

    if (enablePlayit) {
      tabs.push(
        { name: "Playit Tunnel", path: `/servers/${id}/playit`, exactPath: "playit", icon: <Globe size={18} /> }
      );
    }
  }

  const navTabs: any[] = [
    { name: "Overview", path: `/`, exactPath: "overview", icon: <LayoutDashboard size={18} /> },
    { name: "All Servers", path: `/servers`, exactPath: "servers", icon: <ServerIcon size={18} /> },
    { name: "Deploy Server", path: `/servers/create`, exactPath: "create", icon: <Plus size={18} /> },
  ];

  if (user?.role === "admin" || user?.role === "owner") {
    navTabs.push(
      { name: "Fleet", path: `/admin/servers`, exactPath: "fleet", icon: <Box size={18} /> },
      { name: "Nodes", path: `/nodes`, exactPath: "nodes", icon: <Cpu size={18} /> },
      { name: "Admin Settings", path: `/admin/settings`, exactPath: "admin", icon: <Settings size={18} /> }
    );
  }

  navTabs.push(
    { name: "Account", path: `/account`, exactPath: "account", icon: <Users size={18} /> }
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex h-full bg-transparent overflow-hidden"
    >
            
      
      {/* Drawer Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity cursor-pointer" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 bg-card/95 md:bg-card/90 backdrop-blur-3xl border-r border-theme-500/20 flex flex-col shadow-2xl shadow-theme-900/50 transition-all duration-300 ease-in-out shrink-0 ${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'
        } ${
          !desktopSidebarCollapsed ? 'md:relative md:translate-x-0 md:w-64 md:opacity-100' : ''
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-theme-500/20 shrink-0 bg-card/80">
          <div className="flex items-center gap-3 min-w-0">
             <Link to="/servers" className="p-1.5 bg-theme-900/40 hover:bg-theme-500/20 border border-theme-500/30 shadow-sm rounded-lg text-theme-400 hover:text-theme-100 transition-all shrink-0" title="Back to Servers">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-theme-300 via-theme-200 to-theme-400 bg-clip-text text-transparent truncate pr-2">{server.name}</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Desktop Slide-away / Collapse Button when docked */}
            {!desktopSidebarCollapsed && (
              <button 
                onClick={() => {
                  setDesktopSidebarCollapsed(true);
                  localStorage.setItem("jtg_server_sidebar_collapsed", "true");
                }}
                className="hidden md:flex p-1.5 text-theme-400 hover:text-theme-100 bg-theme-500/10 hover:bg-theme-500/20 border border-theme-500/30 rounded-lg transition-colors cursor-pointer"
                title="Slide Away Sidebar (Full Screen Terminal)"
              >
                <PanelLeftClose size={16} />
              </button>
            )}

            {/* Close Button in drawer mode (mobile, or desktop when in full slide mode) */}
            <button 
              onClick={() => setSidebarOpen(false)}
              className={`${desktopSidebarCollapsed ? 'flex' : 'md:hidden flex'} p-1.5 text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors cursor-pointer`}
              title="Close Menu"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 custom-scrollbar">
          {/* Status & Quick Actions */}
          <div className="mb-4 p-3 bg-muted/60 rounded-xl border border-theme-500/20 shadow-inner">
             <div className="flex items-center space-x-2 mb-3 flex-wrap gap-y-1">
                <span className="flex h-2.5 w-2.5 relative shrink-0">
                   {server.status === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-400 opacity-75"></span>}
                   <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${server.status === 'online' ? 'bg-theme-500' : 'bg-red-500'}`}></span>
                </span>
                <span className={`text-xs font-semibold capitalize ${server.status === 'online' ? 'text-theme-400' : 'text-zinc-400'}`}>{server.status}</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.2 rounded" title="Permanent Server - Infinite Lifespan">
                  ∞ Permanent
                </span>
                <span className="text-xs text-zinc-600">•</span>
                <button onClick={handleCopyIp} className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-theme-900/40 hover:bg-theme-500/20 border border-theme-500/30 transition-colors group cursor-pointer truncate" title="Copy Connection Info">
                  <span className="text-[11px] font-mono text-theme-300 group-hover:text-theme-200 transition-colors truncate">
                    {server.ipAlias ? `${server.ipAlias}:${server.port}` : server.port}
                  </span>
                  {copied ? <Check size={12} className="text-theme-400 shrink-0" /> : <Copy size={12} className="text-theme-400 group-hover:text-theme-300 transition-colors shrink-0" />}
                </button>
             </div>
             <div className="grid grid-cols-2 gap-2">
                {server.status !== 'online' ? (
                  <button disabled={isProcessing} onClick={() => { handleAction('start'); setSidebarOpen(false); }} className="py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold rounded-lg transition-all border border-emerald-500/40 flex items-center justify-center text-xs shadow-md shadow-emerald-500/10 disabled:opacity-50">
                    {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/50 border-t-emerald-400 rounded-full animate-spin mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5 fill-emerald-400/20" />} Start
                  </button>
                ) : (
                  <button disabled={isProcessing} onClick={() => { handleAction('stop'); setSidebarOpen(false); }} className="py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold rounded-lg transition-all border border-red-500/40 flex items-center justify-center text-xs shadow-md shadow-red-500/10 disabled:opacity-50">
                    {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-red-400/50 border-t-red-400 rounded-full animate-spin mr-1.5" /> : <Square className="w-3.5 h-3.5 mr-1.5 fill-red-400/20" />} Stop
                  </button>
                )}
                <button disabled={isProcessing} onClick={() => { handleAction('restart'); setSidebarOpen(false); }} className="py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium rounded-lg transition-all border border-amber-500/40 flex items-center justify-center text-xs shadow-md shadow-amber-500/10 disabled:opacity-50">
                  {isProcessing ? <div className="w-3.5 h-3.5 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />} Restart
                </button>

                {/* Playit Start Agent + Tunnel Quick Action */}
                {playitStatus !== 'running' ? (
                  <button 
                    disabled={isPlayitProcessing} 
                    onClick={() => { handlePlayitStart(); setSidebarOpen(false); }} 
                    className="col-span-2 py-1.5 bg-theme-600/20 hover:bg-theme-600/30 text-theme-300 font-semibold rounded-lg transition-all border border-theme-500/40 flex items-center justify-center text-xs shadow-md shadow-theme-500/10 disabled:opacity-50 gap-1.5"
                    title="Start Playit.gg Agent & Public Tunnel"
                  >
                    {isPlayitProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-theme-400/50 border-t-theme-400 rounded-full animate-spin" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-theme-400" />
                    )}
                    <span>Start Playit Agent + Tunnel</span>
                  </button>
                ) : (
                  <button 
                    disabled={isPlayitProcessing} 
                    onClick={() => { handlePlayitStop(); setSidebarOpen(false); }} 
                    className="col-span-2 py-1.5 bg-emerald-500/15 hover:bg-rose-500/20 text-emerald-300 hover:text-rose-300 font-semibold rounded-lg transition-all border border-emerald-500/30 hover:border-rose-500/30 flex items-center justify-center text-xs shadow-md shadow-emerald-500/10 disabled:opacity-50 gap-1.5 group"
                    title={playitPublicAddress ? `Playit Online: ${playitPublicAddress} (Click to Stop)` : "Playit Tunnel Online (Click to Stop)"}
                  >
                    {isPlayitProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-emerald-400/50 border-t-emerald-400 rounded-full animate-spin" />
                    ) : (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                    <span className="group-hover:hidden truncate max-w-[170px]">
                      {playitPublicAddress ? `Playit: ${playitPublicAddress}` : "Playit: Active"}
                    </span>
                    <span className="hidden group-hover:inline">Stop Playit Tunnel</span>
                  </button>
                )}

                <button
                  onClick={() => { setShowPlayitFirstStartModal(true); setSidebarOpen(false); }}
                  className="col-span-2 py-1.5 bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs rounded-lg border border-border hover:border-theme-500/40 flex items-center justify-center gap-1.5 transition-colors"
                  title="Open Playit Agent & Plugin Assistant"
                >
                  <Sparkles className="w-3.5 h-3.5 text-theme-500" />
                  <span>Playit Setup &amp; Plugin Assistant</span>
                </button>
             </div>
          </div>
          
          <div className="h-px bg-gradient-to-r from-transparent via-theme-500/20 to-transparent mb-3" />
          
          <div className="text-xs font-semibold text-theme-400/70 mb-2 px-3 tracking-wider uppercase">Menu</div>
          
          {tabs.map(tab => {
             const isActive = location.pathname === tab.path || location.pathname === `${tab.path}/`;
             return (
              <Link 
                key={tab.name}
                to={tab.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg ${isActive ? 'bg-gradient-to-r from-theme-500/20 to-theme-500/10 text-theme-200 shadow-md shadow-theme-500/10 border border-theme-500/40' : 'text-zinc-400 hover:text-theme-300 hover:bg-theme-900/30 border border-transparent'}`}
              >
                <div className={`${isActive ? 'text-theme-400' : 'text-zinc-400'} transition-colors`}>
                  {React.cloneElement(tab.icon, { className: "w-4 h-4" })}
                </div>
                <span>{tab.name}</span>
              </Link>
            );
          })}
          
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />
          
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-3 tracking-wider uppercase">Navigation</div>

          {navTabs.map(tab => {
             return (
              <Link 
                key={tab.name}
                to={tab.path}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 text-sm font-medium transition-all rounded-lg text-muted-foreground hover:text-foreground-muted hover:bg-white/[0.05] border border-transparent"
              >
                <div className="text-muted-foreground transition-colors">
                  {React.cloneElement(tab.icon, { className: "w-4 h-4" })}
                </div>
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative isolate">
        {/* Top Header with Hamburger and Power Controls */}
        <div className="bg-card/90 backdrop-blur-2xl border-b border-theme-500/20 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 shrink-0 shadow-lg relative z-20">
          
          {/* Left: 3-Lines Hamburger Menu Button + Server Name + Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button 
              onClick={toggleSidebar}
              className={`p-2.5 border shadow-sm rounded-xl transition-all items-center justify-center shrink-0 active:scale-95 cursor-pointer ${
                desktopSidebarCollapsed 
                  ? 'flex bg-theme-500/25 border-theme-400 text-theme-100 ring-2 ring-theme-500/40 shadow-theme-500/25' 
                  : 'flex md:hidden bg-theme-500/10 hover:bg-theme-500/20 active:bg-theme-500/30 border-theme-500/30 text-theme-300 hover:text-white'
              }`}
              title={desktopSidebarCollapsed ? "Show Server Menu Options (3 Lines)" : "Menu"}
              aria-label="Toggle Server Navigation Menu"
            >
              <Menu size={20} className="text-theme-400" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-theme-300 via-theme-200 to-theme-400 bg-clip-text text-transparent truncate leading-none">
                {server.name}
              </h1>

              {/* Desktop Full-Slide Mode Indicator */}
              {desktopSidebarCollapsed && (
                <button 
                  onClick={() => {
                    setDesktopSidebarCollapsed(false);
                    localStorage.setItem("jtg_server_sidebar_collapsed", "false");
                  }}
                  className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-theme-500/15 hover:bg-theme-500/25 border border-theme-500/35 text-[11px] font-mono text-theme-300 font-medium cursor-pointer transition-colors shadow-sm"
                  title="Click to restore sidebar menu"
                >
                  <PanelLeftOpen size={12} className="text-theme-400" />
                  <span>Full Slide</span>
                </button>
              )}

              {/* Status Pill (Online = Red, Offline = Blue) */}
              <div className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border shrink-0 ${
                server.status === 'online' 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}>
                <span className="flex h-2 w-2 relative shrink-0">
                  {server.status === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${server.status === 'online' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'}`}></span>
                </span>
                <span className={`text-[11px] font-mono capitalize font-bold ${server.status === 'online' ? 'text-red-400' : 'text-blue-400'}`}>
                  {server.status}
                </span>
              </div>
            </div>
          </div>
          
          {/* Right: IP Copy Badge + Big Convenient Power Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 ml-auto shrink-0 flex-wrap sm:flex-nowrap">
            {/* IP Badge */}
            <button 
              onClick={handleCopyIp} 
              className="flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-theme-900/40 hover:bg-theme-500/20 border border-theme-500/30 transition-all group cursor-pointer shrink-0 shadow-sm" 
              title="Click to copy server address"
            >
              <span className="text-xs font-mono text-theme-300 group-hover:text-theme-200 transition-colors truncate max-w-[130px] sm:max-w-[200px]">
                {server.ipAlias ? `${server.ipAlias}:${server.port}` : `:${server.port}`}
              </span>
              {copied ? <Check size={13} className="text-theme-400 shrink-0" /> : <Copy size={13} className="text-theme-400 group-hover:text-theme-300 transition-colors shrink-0" />}
            </button>

            {/* Start / Stop Button */}
            {server.status !== 'online' ? (
              <button 
                disabled={isProcessing} 
                onClick={() => handleAction('start')} 
                className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono font-bold rounded-xl transition-all border border-emerald-500/40 flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-40 shrink-0 gap-1.5"
                title="Start Server"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-emerald-400/50 border-t-emerald-400 rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-emerald-400/20 text-emerald-400" />
                )}
                <span>Start</span>
              </button>
            ) : (
              <button 
                disabled={isProcessing} 
                onClick={() => handleAction('stop')} 
                className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-mono font-bold rounded-xl transition-all border border-rose-500/40 flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-rose-500/10 active:scale-95 disabled:opacity-40 shrink-0 gap-1.5"
                title="Stop Server"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-rose-400/50 border-t-rose-400 rounded-full animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-rose-400/20 text-rose-400" />
                )}
                <span>Stop</span>
              </button>
            )}

            {/* Playit Start Agent + Tunnel Button (Right next to Server Start Button) */}
            {enablePlayit && (
              <>
                {playitStatus !== 'running' ? (
                  <button 
                    disabled={isPlayitProcessing} 
                    onClick={handlePlayitStart} 
                    className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-theme-600/20 hover:bg-theme-600/30 text-theme-300 font-mono font-bold rounded-xl transition-all border border-theme-500/40 flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-theme-600/10 active:scale-95 disabled:opacity-40 shrink-0 gap-1.5"
                    title="Start Playit.gg Agent & Public Ingress Tunnel"
                  >
                    {isPlayitProcessing ? (
                      <div className="w-3.5 h-3.5 border-2 border-theme-400/50 border-t-theme-400 rounded-full animate-spin" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-theme-400" />
                    )}
                    <span>Playit Start</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={handlePlayitStop}
                      disabled={isPlayitProcessing}
                      className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-500/15 hover:bg-rose-500/20 text-emerald-300 hover:text-rose-300 font-mono font-bold rounded-xl transition-all border border-emerald-500/30 hover:border-rose-500/30 flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-40 gap-1.5 group"
                      title={playitPublicAddress ? `Playit Online: ${playitPublicAddress} (Click to Stop)` : "Playit Tunnel Active (Click to Stop)"}
                    >
                      {isPlayitProcessing ? (
                        <div className="w-3.5 h-3.5 border-2 border-emerald-400/50 border-t-emerald-400 rounded-full animate-spin" />
                      ) : (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                      <span className="group-hover:hidden flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        Playit Live
                      </span>
                      <span className="hidden group-hover:inline">Stop Playit</span>
                    </button>
                    {playitPublicAddress && (
                      <button
                        onClick={handleCopyPlayitAddress}
                        className="px-2 py-1.5 sm:py-2 bg-theme-900/40 hover:bg-theme-500/20 border border-theme-500/30 text-theme-300 hover:text-theme-100 rounded-xl transition-all font-mono text-xs hidden lg:flex items-center gap-1 shrink-0"
                        title="Copy Playit Public Address"
                      >
                        <span className="truncate max-w-[120px]">{playitPublicAddress}</span>
                        {copiedPlayit ? <Check size={12} className="text-theme-400" /> : <Copy size={12} className="text-theme-400" />}
                      </button>
                    )}
                  </div>
                )}

                {/* Combo Button: Start Both (Server + Playit) when both are offline */}
                {server.status !== 'online' && playitStatus !== 'running' && (
                  <button 
                    disabled={isProcessing || isPlayitProcessing} 
                    onClick={() => handleAction('start-both')} 
                    className="hidden xl:flex px-3 py-1.5 sm:py-2 bg-gradient-to-r from-emerald-500/20 via-theme-500/20 to-theme-500/30 hover:from-emerald-500/30 hover:to-theme-500/40 text-theme-200 font-mono font-bold rounded-xl transition-all border border-theme-500/40 items-center justify-center text-xs shadow-lg shadow-theme-500/10 active:scale-95 disabled:opacity-40 shrink-0 gap-1.5"
                    title="Start both Server and Playit Agent + Tunnel together"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-theme-400" />
                    <span>Start Both</span>
                  </button>
                )}
              </>
            )}

            {/* Restart Button */}
            <button 
              disabled={isProcessing} 
              onClick={() => handleAction('restart')} 
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono font-bold rounded-xl transition-all border border-amber-500/40 flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-amber-500/10 active:scale-95 disabled:opacity-40 shrink-0 gap-1.5"
              title="Restart Server"
            >
              {isProcessing ? (
                <div className="w-3.5 h-3.5 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              )}
              <span>Restart</span>
            </button>
          </div>
        </div>

        <div className="flex-1 relative flex flex-col min-h-0 bg-transparent">
          <div className="flex-1 flex flex-col relative overflow-hidden bg-transparent min-h-0">
            <Routes>
              <Route 
                path="/" 
                element={
                  <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                    <ServerResourceDashboard
                      serverId={id!}
                      server={server}
                      status={server.status}
                      limitRam={server.ram}
                    />
                    <div className="flex-1 flex flex-col min-h-0">
                      <ServerConsole serverId={id!} server={server} />
                    </div>
                  </div>
                } 
              />
              <Route path="/players" element={<PlayerManager serverId={id!} />} />
              <Route path="/properties" element={<ServerProperties serverId={id!} />} />
              <Route path="/world" element={<WorldManager serverId={id!} server={server} onNavigateToFileManager={() => navigate(`/servers/${id}/files`)} />} />
              <Route path="/files" element={<FileManager serverId={id!} />} />
              <Route path="/sftp" element={<ServerSFTP serverId={id!} server={server} />} />
              <Route path="/subusers" element={<SubUsersManager serverId={id!} />} />
              <Route path="/settings" element={<ServerSettings serverId={id!} server={server} />} />
              <Route path="/software" element={<SoftwareManager serverId={id!} server={server} onServerUpdated={fetchServer} />} />
              <Route path="/backup" element={<ServerBackups serverId={id!} />} />
              <Route path="/addons" element={<AddonsManager serverId={id!} initialCategory="all" />} />
              <Route path="/plugins" element={<PluginManager serverId={id!} />} />
              <Route path="/mods" element={<AddonsManager serverId={id!} initialCategory="mods" />} />
              <Route path="/resourcepacks" element={<AddonsManager serverId={id!} initialCategory="resourcepacks" />} />
              <Route path="/datapacks" element={<AddonsManager serverId={id!} initialCategory="datapacks" />} />
              {enablePlayit && <Route path="/playit" element={<PlayitTunnel serverId={id!} />} />}
            </Routes>
        </div>
      </div>

      {/* Desktop Quick-Expand Edge Slide Tab when in Full Slide mode */}
      {desktopSidebarCollapsed && (
        <button
          onClick={() => {
            setSidebarOpen(true);
          }}
          className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-40 p-2 pl-1.5 pr-2.5 rounded-r-xl bg-card/95 hover:bg-theme-600 text-theme-300 hover:text-white shadow-2xl border-y border-r border-theme-500/40 backdrop-blur-xl transition-all duration-200 group items-center gap-1 cursor-pointer select-none"
          title="Slide Out Server Menu Options"
        >
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform text-theme-400 group-hover:text-white" />
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase [writing-mode:vertical-lr] rotate-180 py-1">
            Menu
          </span>
        </button>
      )}

      </div>

      <AnimatePresence>
        {showRamWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card border border-border shadow-2xl shadow-theme-500/10 rounded-2xl p-6 max-w-md w-full relative overflow-hidden text-foreground"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-theme-500 to-theme-600" />
              <div className="flex items-start mb-4">
                <div className="bg-theme-500/10 p-3 rounded-full mr-4">
                  <AlertTriangle className="w-6 h-6 text-theme-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">High RAM Allocation</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    This instance is configured to use up to <strong className="text-foreground">{server?.ram}GB</strong> of RAM, but this system only has <strong className="text-foreground">{totalSystemRam.toFixed(1)}GB</strong> physically available. 
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed mt-2">
                    The container uses memory on-demand, but if actual memory usage exceeds the host's physical RAM, the server will crash/be terminated by the OS.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowRamWarning(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted-hover text-foreground font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowRamWarning(false);
                    executeAction(pendingAction || 'start');
                  }}
                  className="px-4 py-2 bg-theme-500/20 hover:bg-theme-500/30 text-theme-400 font-bold rounded-xl transition-colors border border-theme-500/30"
                >
                  Start Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Playit Setup & First Start Modal */}
      {server && (
        <PlayitFirstStartModal
          serverId={server.id}
          serverName={server.name}
          isOpen={showPlayitFirstStartModal}
          onClose={() => setShowPlayitFirstStartModal(false)}
          onProceedStart={handleProceedFirstStart}
        />
      )}

      {isProcessing && (
        <LoadingOverlay
          message="Executing Server Action..."
          subMessage="Sending signal to runtime daemon & updating instance state..."
        />
      )}
    </motion.div>
  );
}

