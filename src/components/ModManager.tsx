import React, { useEffect, useState } from "react"; 
import { LoadingOverlay } from "../components/LoadingOverlay";
import axios from "axios";
import { 
  Search, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Box, 
  X, 
  PanelLeft, 
  PanelLeftClose,
  Sparkles
} from "lucide-react";
import SearchQueueBar from "./SearchQueueBar";

interface Mod {
  id: string;
  name: string;
  tag: string;
  downloads: number;
  icon: string | null;
}

export default function ModManager({ serverId }: { serverId: string }) {
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(false);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [lastInstalledName, setLastInstalledName] = useState<string | null>(null);
  const [isSideQueueOpen, setIsSideQueueOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("jtg_mods_side_queue");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleSideQueue = () => {
    setIsSideQueueOpen(prev => {
      const next = !prev;
      try { localStorage.setItem("jtg_mods_side_queue", String(next)); } catch {}
      return next;
    });
  };

  const searchMods = async (searchQuery: string = "jei") => {
    try {
      setLoading(true);
      
      const q = searchQuery.trim() || 'jei';
      const results: Mod[] = [];
      
      const externalAxios = axios.create();
      delete externalAxios.defaults.headers.common['Authorization'];
      
      await externalAxios.get(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(q)}&facets=[["project_type:mod"]]&limit=15`)
        .then(res => {
          res.data.hits.forEach((hit: any) => {
            results.push({
              id: hit.project_id,
              name: hit.title,
              tag: hit.description,
              downloads: hit.downloads,
              icon: hit.icon_url
            });
          });
        }).catch(() => {});
      
      results.sort((a, b) => b.downloads - a.downloads);
      setMods(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchMods();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchMods(query);
  };

  const handleClear = () => {
    setQuery("");
    searchMods("");
  };

  const handleInstall = async (mod: Mod) => {
    try {
      setIsInstalling(mod.id);
      setStatusMsg(null);
      
      const res = await axios.post(`/api/servers/${serverId}/mods/install`, {
        modId: mod.id,
        modName: mod.name
      });
      
      setStatusMsg({
        text: res.data.message || `Successfully installed ${mod.name}!`,
        type: "success"
      });
      setLastInstalledName(mod.name);
    } catch (e: any) {
      setStatusMsg({
        text: e.response?.data?.error || "Failed to install mod.",
        type: "error"
      });
    } finally {
      setIsInstalling(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 text-foreground bg-transparent">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500 shrink-0">
                <Box className="w-5 h-5" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold font-mono text-foreground">
                Mod Manager
              </h2>
            </div>
            <p className="text-[11px] font-mono font-bold text-theme-500 uppercase tracking-wider mt-1">
              Search and install mods from Modrinth in one click.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleSideQueue}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                isSideQueueOpen
                  ? "bg-muted border-border text-foreground"
                  : "bg-theme-500/15 border-theme-500/30 text-theme-600 dark:text-theme-400"
              }`}
              title={isSideQueueOpen ? "Hide Side Queue" : "Show Side Queue"}
            >
              {isSideQueueOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
              <span>{isSideQueueOpen ? "Side Queue" : "Open Queue"}</span>
            </button>

            <button
              onClick={() => searchMods(query)}
              className="px-3.5 py-1.5 rounded-xl bg-card border border-border hover:bg-muted text-foreground text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-theme-500" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className={`p-3.5 rounded-2xl border text-xs sm:text-sm font-mono flex items-center justify-between shadow-lg ${
            statusMsg.type === "success" 
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200" 
              : "bg-rose-950/90 border-rose-500/40 text-rose-200"
          }`}>
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)} className="text-xs opacity-70 hover:opacity-100 ml-3 font-bold cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* 2-Column Layout: Side Queue + Middle Search Bar & Mod List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* SIDE COLUMN: AUTO SEARCH QUEUE */}
          {isSideQueueOpen && (
            <div className="lg:col-span-4 xl:col-span-4">
              <SearchQueueBar
                storageKey={`mods_${serverId}`}
                title="Mods Auto Search"
                itemTypeLabel="mod"
                layout="sidebar"
                onSearchItem={(term) => {
                  setQuery(term);
                  searchMods(term);
                }}
                currentQuery={query}
                lastInstalledName={lastInstalledName}
                onToggleCollapse={toggleSideQueue}
              />
            </div>
          )}

          {/* MIDDLE COLUMN: MAIN SEARCH BAR & RESULTS */}
          <div className={`${isSideQueueOpen ? "lg:col-span-8 xl:col-span-8" : "lg:col-span-12"} space-y-4`}>
            {/* Dedicated Middle Search Bar Card */}
            <div className="bg-card border border-border rounded-3xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-foreground uppercase tracking-wider">
                  <Search className="w-4 h-4 text-theme-500" />
                  <span>Search Modrinth Mods</span>
                </div>
                {!isSideQueueOpen && (
                  <button
                    onClick={toggleSideQueue}
                    className="px-2.5 py-1 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <PanelLeft className="w-3.5 h-3.5 text-theme-500" />
                    <span>Show Side Queue</span>
                  </button>
                )}
              </div>

              {/* Form with Clear / Delete button */}
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search for mods (e.g. JEI, Sodium, Iris, Waystones)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-muted border border-border focus:border-theme-500 rounded-2xl py-2.5 pl-10 pr-9 text-xs sm:text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none transition-colors"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-theme-500 hover:bg-theme-600 text-white rounded-2xl text-xs sm:text-sm font-mono font-bold transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Mods List Cards */}
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl divide-y divide-border">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 font-mono">
                  <RefreshCw className="w-6 h-6 animate-spin text-theme-500" />
                  <span>Searching Modrinth repositories...</span>
                </div>
              ) : mods.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 font-mono">
                  <AlertCircle className="w-8 h-8 opacity-40 text-muted-foreground" />
                  <span className="font-bold text-foreground">No mods found.</span>
                  <span className="text-xs">Try a different search query.</span>
                </div>
              ) : (
                mods.map((mod) => (
                  <div key={mod.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {mod.icon ? (
                        <img 
                          src={mod.icon} 
                          alt={mod.name} 
                          className="w-11 h-11 rounded-xl object-cover border border-border bg-muted shrink-0" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl border border-border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <Box className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold font-mono text-foreground truncate">{mod.name}</h4>
                        <p className="text-xs text-muted-foreground font-mono line-clamp-1 mt-0.5">{mod.tag}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {mod.downloads.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleInstall(mod)}
                      disabled={isInstalling !== null}
                      className="px-4 py-2 bg-theme-500 hover:bg-theme-600 text-white rounded-xl text-xs font-mono font-bold transition-all shrink-0 active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {isInstalling === mod.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Installing...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Install</span>
                        </>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {isInstalling !== null && (
        <LoadingOverlay
          message="Installing Mod..."
          subMessage="Downloading from Modrinth and installing to mods directory..."
        />
      )}
    </div>
  );
}
