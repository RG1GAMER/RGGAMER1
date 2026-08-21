import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { 
  Palette, 
  Search, 
  Download, 
  Eye, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Box, 
  Layers, 
  Flame, 
  Trash2, 
  ExternalLink, 
  Sliders, 
  FileText, 
  CheckCircle2,
  X,
  HardDrive,
  Info,
  Link as LinkIcon,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type InstallerTab = "mods" | "resourcepacks" | "datapacks" | "installed";

interface PackageItem {
  id: string;
  slug?: string;
  name: string;
  author?: string;
  description: string;
  downloads: number;
  icon: string | null;
  categories: string[];
  versions?: string[];
  follows?: number;
  projectType?: string;
  gallery?: string[];
}

interface InstalledPackage {
  name: string;
  filename: string;
  isDirectory?: boolean;
  size: number;
  sizeMB: number;
  modified?: string;
  enabled?: boolean;
}

interface InstalledData {
  mods: InstalledPackage[];
  plugins: InstalledPackage[];
  resourcepacks: InstalledPackage[];
  datapacks: InstalledPackage[];
  serverPropertiesResourcePack: {
    url: string;
    sha1: string;
    required: boolean;
    prompt: string;
  };
}

const POPULAR_TAGS: Record<InstallerTab, string[]> = {
  resourcepacks: [
    "Faithful 32x",
    "Bare Bones",
    "Fresh Animations",
    "Stay True",
    "Dramatic Skys",
    "Default 3D",
    "Better Leaves",
    "Fast Better Grass",
    "Compliance 32x",
    "Visual Workbench",
    "3D Crops",
    "Complementary Shaders"
  ],
  mods: [
    "JEI",
    "Sodium",
    "Lithium",
    "FerriteCore",
    "Iris Shaders",
    "Appleskin",
    "JourneyMap",
    "Waystones",
    "Clumps",
    "Spark"
  ],
  datapacks: [
    "Terralith",
    "Incendium",
    "Nullscape",
    "Structory",
    "BlazeandCave",
    "Vanilla Tweaks",
    "Stellarity",
    "Graves"
  ],
  installed: []
};

const MC_VERSIONS = [
  "All Versions",
  "1.21.5",
  "1.21.4",
  "1.21.3",
  "1.21.2",
  "1.21.1",
  "1.21",
  "1.20.6",
  "1.20.5",
  "1.20.4",
  "1.20.3",
  "1.20.2",
  "1.20.1",
  "1.20",
  "1.19.4",
  "1.19.3",
  "1.19.2",
  "1.19.1",
  "1.19",
  "1.18.2",
  "1.18.1",
  "1.18",
  "1.17.1",
  "1.17",
  "1.16.5",
  "1.16.4",
  "1.15.2",
  "1.14.4",
  "1.13.2",
  "1.12.2",
  "1.8.9",
  "1.7.10"
];

export default function ResourcePackManager({ 
  serverId, 
  initialTab = "resourcepacks" 
}: { 
  serverId: string; 
  initialTab?: InstallerTab;
}) {
  const [activeTab, setActiveTab] = useState<InstallerTab>(initialTab);
  const [items, setItems] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [versionOptions, setVersionOptions] = useState<string[]>(MC_VERSIONS);
  const [selectedVersion, setSelectedVersion] = useState("All Versions");
  const [sortBy, setSortBy] = useState<"downloads" | "follows" | "newest" | "updated">("downloads");
  const [setInProperties, setSetInProperties] = useState(true);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});

  // Fetch live Minecraft versions from Modrinth on mount
  useEffect(() => {
    const fetchGameVersions = async () => {
      try {
        const externalAxios = axios.create();
        delete externalAxios.defaults.headers.common["Authorization"];
        const res = await externalAxios.get("https://api.modrinth.com/v2/tag/game_version", { timeout: 6000 });
        if (Array.isArray(res.data) && res.data.length > 0) {
          const releases = res.data
            .filter((v: any) => v.version_type === "release")
            .map((v: any) => v.version);
          
          if (releases.length > 0) {
            const combined = Array.from(new Set(["All Versions", ...releases, ...MC_VERSIONS]));
            setVersionOptions(combined);
          }
        }
      } catch (e) {
        // Fallback to static MC_VERSIONS
      }
    };
    fetchGameVersions();
  }, []);

  // Installed tab data
  const [installedData, setInstalledData] = useState<InstalledData | null>(null);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [uninstalling, setUninstalling] = useState<string | null>(null);

  // Detail Modal
  const [selectedModalItem, setSelectedModalItem] = useState<PackageItem | null>(null);
  const [modalVersions, setModalVersions] = useState<any[]>([]);
  const [loadingModalVersions, setLoadingModalVersions] = useState(false);

  // Sync tab if initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Load installed items
  const fetchInstalledData = async () => {
    try {
      setLoadingInstalled(true);
      const res = await axios.get(`/api/servers/${serverId}/installed-packages`);
      setInstalledData(res.data);
      
      const newMap: Record<string, boolean> = {};
      if (res.data.resourcepacks) {
        res.data.resourcepacks.forEach((p: InstalledPackage) => {
          newMap[p.name.toLowerCase()] = true;
          newMap[p.filename.toLowerCase()] = true;
        });
      }
      if (res.data.datapacks) {
        res.data.datapacks.forEach((p: InstalledPackage) => {
          newMap[p.name.toLowerCase()] = true;
          newMap[p.filename.toLowerCase()] = true;
        });
      }
      if (res.data.mods) {
        res.data.mods.forEach((p: InstalledPackage) => {
          newMap[p.name.toLowerCase()] = true;
          newMap[p.filename.toLowerCase()] = true;
        });
      }
      setInstalledMap(newMap);
    } catch (e) {
      console.error("Failed to load installed packages:", e);
    } finally {
      setLoadingInstalled(false);
    }
  };

  useEffect(() => {
    fetchInstalledData();
  }, [serverId]);

  // Search packages from Modrinth
  const searchPackages = async (searchQuery: string = "", tagQuery?: string) => {
    if (activeTab === "installed") return;

    try {
      setLoading(true);
      const q = (tagQuery !== undefined ? tagQuery : searchQuery).trim();
      const results: PackageItem[] = [];

      let projectType = "resourcepack";
      if (activeTab === "mods") projectType = "mod";
      if (activeTab === "datapacks") projectType = "datapack";

      let facets = `[["project_type:${projectType}"]]`;
      if (selectedVersion && selectedVersion !== "All Versions") {
        facets = `[["project_type:${projectType}"],["versions:${selectedVersion}"]]`;
      }

      let sortIndex = "downloads";
      if (sortBy === "follows") sortIndex = "follows";
      if (sortBy === "newest") sortIndex = "newest";
      if (sortBy === "updated") sortIndex = "updated";

      const externalAxios = axios.create();
      delete externalAxios.defaults.headers.common["Authorization"];

      const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(q)}&facets=${encodeURIComponent(facets)}&index=${sortIndex}&limit=24`;

      const res = await externalAxios.get(url, { timeout: 10000 });
      if (res.data && res.data.hits) {
        res.data.hits.forEach((hit: any) => {
          results.push({
            id: hit.project_id,
            slug: hit.slug,
            name: hit.title,
            author: hit.author,
            description: hit.description,
            downloads: hit.downloads || 0,
            follows: hit.follows || 0,
            icon: hit.icon_url,
            categories: hit.categories || hit.display_categories || [],
            versions: hit.versions || [],
            projectType: hit.project_type,
            gallery: hit.gallery || []
          });
        });
      }

      setItems(results);
    } catch (e) {
      console.error("Modrinth search error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "installed") {
      searchPackages(query);
    } else {
      fetchInstalledData();
    }
  }, [activeTab, selectedVersion, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchPackages(query);
  };

  const handlePopularClick = (tag: string) => {
    setQuery(tag);
    searchPackages(tag, tag);
  };

  // Install handler
  const handleInstall = async (item: PackageItem) => {
    setStatusMsg(null);
    setIsInstalling(item.id);

    try {
      if (activeTab === "resourcepacks") {
        const res = await axios.post(`/api/servers/${serverId}/resourcepacks/install`, {
          projectId: item.id,
          title: item.name,
          setInProperties
        });
        setStatusMsg({
          text: res.data.message || `${item.name} installed successfully!`,
          type: "success"
        });
      } else if (activeTab === "datapacks") {
        const res = await axios.post(`/api/servers/${serverId}/datapacks/install`, {
          projectId: item.id,
          title: item.name
        });
        setStatusMsg({
          text: res.data.message || `${item.name} installed into datapacks!`,
          type: "success"
        });
      } else if (activeTab === "mods") {
        const res = await axios.post(`/api/servers/${serverId}/mods/install`, {
          pluginId: item.id,
          pluginName: item.name
        });
        setStatusMsg({
          text: res.data.message || `${item.name} installed into mods folder!`,
          type: "success"
        });
      }

      setInstalledMap((prev) => ({
        ...prev,
        [item.name.toLowerCase()]: true,
        [item.id.toLowerCase()]: true
      }));

      fetchInstalledData();
    } catch (e: any) {
      setStatusMsg({
        text: e.response?.data?.error || `Failed to install ${item.name}.`,
        type: "error"
      });
    } finally {
      setIsInstalling(null);
    }
  };

  // Uninstall / Delete package
  const handleUninstall = async (type: "resourcepack" | "datapack" | "mod" | "plugin", filename?: string, clearProps?: boolean) => {
    setUninstalling(filename || "props");
    try {
      const res = await axios.post(`/api/servers/${serverId}/packages/uninstall`, {
        type,
        filename,
        clearServerProperties: clearProps
      });
      setStatusMsg({
        text: res.data.message || "Removed successfully.",
        type: "success"
      });
      fetchInstalledData();
    } catch (e: any) {
      setStatusMsg({
        text: e.response?.data?.error || "Failed to remove package.",
        type: "error"
      });
    } finally {
      setUninstalling(null);
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (item: PackageItem) => {
    setSelectedModalItem(item);
    setLoadingModalVersions(true);
    try {
      const externalAxios = axios.create();
      delete externalAxios.defaults.headers.common["Authorization"];
      const verRes = await externalAxios.get(`https://api.modrinth.com/v2/project/${item.id}/version`, { timeout: 8000 });
      setModalVersions(verRes.data || []);
    } catch (e) {
      setModalVersions([]);
    } finally {
      setLoadingModalVersions(false);
    }
  };

  // Format downloads: e.g. 44040.3k or 44.0M
  const formatDownloads = (num: number) => {
    if (!num) return "0";
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return String(num);
  };

  const getPlaceholderText = () => {
    if (activeTab === "resourcepacks") return "Search resource & texture packs (e.g. Faithful, Bare Bones)...";
    if (activeTab === "mods") return "Search mods (e.g. JEI, Sodium, Iris, JourneyMap)...";
    if (activeTab === "datapacks") return "Search datapacks (e.g. Terralith, Incendium, Nullscape)...";
    return "Search installed items...";
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 text-foreground bg-transparent">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header and Nav Tabs */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span className="p-1.5 bg-theme-500/10 text-theme-400 rounded-lg border border-theme-500/20">
                <Palette className="w-5 h-5" />
              </span>
              Resource Pack Installer
            </h2>
            <p className="text-xs md:text-sm text-zinc-400 mt-1 max-w-2xl">
              One-click installer powered by Modrinth. Discover thousands of community mods, texture packs, and datapacks.
            </p>
          </div>

          {/* Navigation Pill Group */}
          <div className="inline-flex p-1 bg-black/60 backdrop-blur-md rounded-full border border-theme-500/30 shadow-inner self-stretch lg:self-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab("mods")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                activeTab === "mods"
                  ? "bg-white text-black shadow-md font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Mods
            </button>
            <button
              onClick={() => setActiveTab("resourcepacks")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                activeTab === "resourcepacks"
                  ? "bg-white text-black shadow-md font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Resource Packs
            </button>
            <button
              onClick={() => setActiveTab("datapacks")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                activeTab === "datapacks"
                  ? "bg-white text-black shadow-md font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Datapacks
            </button>
            <button
              onClick={() => setActiveTab("installed")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "installed"
                  ? "bg-white text-black shadow-md font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Installed
              {installedData && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === "installed" ? "bg-black text-white" : "bg-white/20 text-white"}`}>
                  {(installedData.resourcepacks?.length || 0) + (installedData.datapacks?.length || 0) + (installedData.mods?.length || 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {statusMsg && (
          <div className={`p-4 rounded-2xl border text-sm flex items-center justify-between shadow-lg ${
            statusMsg.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" 
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}>
            <div className="flex items-center gap-2.5">
              {statusMsg.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)} className="text-xs opacity-70 hover:opacity-100 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Search and Filter Box (Shown for Marketplace Tabs) */}
        {activeTab !== "installed" && (
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            {/* Search Input Bar */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 focus-within:border-theme-400/80 transition-all shadow-inner">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder={getPlaceholderText()}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none py-1"
              />
              <button 
                type="submit"
                className="px-4 py-1.5 bg-white hover:bg-zinc-200 text-black rounded-lg text-xs font-bold transition-colors shrink-0 shadow-sm"
              >
                Search
              </button>
            </form>

            {/* Filter and Settings Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                {/* Version Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-medium">MC Version:</span>
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="bg-black/50 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-theme-400 cursor-pointer"
                  >
                    {versionOptions.map((v) => (
                      <option key={v} value={v} className="bg-zinc-900 text-white">
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-medium">Sort By:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-black/50 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-theme-400 cursor-pointer"
                  >
                    <option value="downloads" className="bg-zinc-900 text-white">Most Downloaded</option>
                    <option value="follows" className="bg-zinc-900 text-white">Most Followed</option>
                    <option value="newest" className="bg-zinc-900 text-white">Newest</option>
                    <option value="updated" className="bg-zinc-900 text-white">Recently Updated</option>
                  </select>
                </div>
              </div>

              {/* Set in server.properties Checkbox */}
              {activeTab === "resourcepacks" && (
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={setInProperties}
                    onChange={(e) => setSetInProperties(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 text-theme-500 focus:ring-0 focus:outline-none bg-black/50 accent-theme-500 cursor-pointer"
                  />
                  <span>Set in server.properties</span>
                </label>
              )}
            </div>

            {/* Popular Tags List */}
            {POPULAR_TAGS[activeTab]?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10 text-xs">
                <span className="flex items-center gap-1 font-bold text-zinc-400 uppercase tracking-wider text-[11px] shrink-0">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  Popular:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                  {POPULAR_TAGS[activeTab].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handlePopularClick(tag)}
                      className="px-2.5 py-0.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-300 hover:text-white text-xs transition-colors shrink-0"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Section: Marketplace Grid */}
        {activeTab !== "installed" && (
          <div>
            {loading ? (
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin mb-3 text-theme-400" />
                <p className="text-sm font-medium">Fetching packages from Modrinth...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 flex flex-col items-center justify-center bg-black/40 rounded-2xl border border-white/10">
                <AlertCircle className="w-10 h-10 mb-3 text-zinc-500" />
                <p className="text-base font-semibold text-zinc-300">No packages found</p>
                <p className="text-xs text-zinc-500 mt-1">Try another search keyword or switch version filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const isInstalled = !!installedMap[item.name.toLowerCase()] || !!installedMap[item.id.toLowerCase()];
                  const installing = isInstalling === item.id;

                  return (
                    <div 
                      key={item.id}
                      className="bg-black/60 backdrop-blur-md border border-white/15 hover:border-theme-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 shadow-md group relative overflow-hidden"
                    >
                      {/* Top Row: Icon + Title + Author */}
                      <div>
                        <div className="flex items-start gap-3 mb-2.5">
                          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                            {item.icon ? (
                              <img src={item.icon} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-theme-900/40 to-black flex items-center justify-center text-theme-400 font-bold text-base">
                                {item.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-white truncate group-hover:text-theme-300 transition-colors">
                              {item.name}
                            </h3>
                            <p className="text-xs text-zinc-400 truncate">
                              by {item.author || "Community"}
                            </p>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed mb-3 min-h-[3.6rem]">
                          {item.description || "No description provided."}
                        </p>

                        {/* Category & Resolution Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {item.categories.slice(0, 3).map((cat) => (
                            <span 
                              key={cat}
                              className="px-2 py-0.5 rounded-md bg-white/[0.07] border border-white/10 text-[10px] font-mono text-zinc-300 uppercase tracking-wider"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Controls Bar */}
                      <div>
                        <div className="h-px bg-white/10 mb-3" />
                        <div className="flex items-center justify-between gap-2">
                          {/* Downloads Count */}
                          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
                            <Download className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{formatDownloads(item.downloads)}</span>
                          </div>

                          {/* Action Buttons: View Details & Install */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDetails(item)}
                              title="View details & versions"
                              className="p-1.5 bg-white/[0.06] hover:bg-white/[0.15] border border-white/10 rounded-lg text-zinc-300 hover:text-white transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              disabled={installing}
                              onClick={() => handleInstall(item)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm ${
                                isInstalled
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                                  : "bg-white hover:bg-zinc-200 text-black"
                              }`}
                            >
                              {installing ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Installing...</span>
                                </>
                              ) : isInstalled ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Installed</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Install</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Installed Section View */}
        {activeTab === "installed" && (
          <div className="space-y-6">
            {loadingInstalled ? (
              <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin mb-3 text-theme-400" />
                <p className="text-sm">Loading installed packages from server filesystem...</p>
              </div>
            ) : (
              <>
                {/* Active server.properties Resource Pack Card */}
                {installedData?.serverPropertiesResourcePack?.url && (
                  <div className="bg-black/60 backdrop-blur-md border border-theme-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-theme-400 bg-theme-500/10 px-2 py-0.5 rounded border border-theme-500/20">
                          Active in server.properties
                        </span>
                        <h4 className="text-base font-bold text-white mt-2 break-all">
                          {installedData.serverPropertiesResourcePack.url}
                        </h4>
                        {installedData.serverPropertiesResourcePack.sha1 && (
                          <p className="text-xs font-mono text-zinc-400">
                            SHA-1: <span className="text-zinc-300">{installedData.serverPropertiesResourcePack.sha1}</span>
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleUninstall("resourcepack", undefined, true)}
                        className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear from Config
                      </button>
                    </div>
                  </div>
                )}

                {/* Resource Packs Folder */}
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="w-5 h-5 text-theme-400" />
                      <h3 className="text-base font-bold text-white">Resource Packs (/resourcepacks)</h3>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      {installedData?.resourcepacks?.length || 0} installed
                    </span>
                  </div>

                  {!installedData?.resourcepacks || installedData.resourcepacks.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">No resource pack files found in /resourcepacks directory.</p>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {installedData.resourcepacks.map((rp) => (
                        <div key={rp.filename} className="py-3 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{rp.name}</p>
                            <p className="text-xs font-mono text-zinc-500">{rp.filename} • {rp.sizeMB} MB</p>
                          </div>
                          <button
                            disabled={uninstalling === rp.filename}
                            onClick={() => handleUninstall("resourcepack", rp.filename)}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Datapacks Folder */}
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-amber-400" />
                      <h3 className="text-base font-bold text-white">World Datapacks</h3>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      {installedData?.datapacks?.length || 0} installed
                    </span>
                  </div>

                  {!installedData?.datapacks || installedData.datapacks.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">No datapacks found in active world datapacks folder.</p>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {installedData.datapacks.map((dp) => (
                        <div key={dp.filename} className="py-3 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{dp.name}</p>
                            <p className="text-xs font-mono text-zinc-500">{dp.filename} • {dp.sizeMB} MB</p>
                          </div>
                          <button
                            disabled={uninstalling === dp.filename}
                            onClick={() => handleUninstall("datapack", dp.filename)}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors"
                            title="Delete datapack"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mods Folder */}
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Box className="w-5 h-5 text-blue-400" />
                      <h3 className="text-base font-bold text-white">Mods (/mods)</h3>
                    </div>
                    <span className="text-xs font-mono text-zinc-400">
                      {installedData?.mods?.length || 0} installed
                    </span>
                  </div>

                  {!installedData?.mods || installedData.mods.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">No mods installed in /mods folder.</p>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {installedData.mods.map((mod) => (
                        <div key={mod.filename} className="py-3 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{mod.name}</p>
                            <p className="text-xs font-mono text-zinc-500">{mod.filename} • {mod.sizeMB} MB</p>
                          </div>
                          <button
                            disabled={uninstalling === mod.filename}
                            onClick={() => handleUninstall("mod", mod.filename)}
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg transition-colors"
                            title="Delete mod"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Details & Version Picker Modal */}
        <AnimatePresence>
          {selectedModalItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-[#121214] border border-theme-500/30 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4 bg-black/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {selectedModalItem.icon ? (
                        <img src={selectedModalItem.icon} alt={selectedModalItem.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-theme-900/40 to-black flex items-center justify-center text-theme-400 font-bold text-base">
                          {selectedModalItem.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">{selectedModalItem.name}</h3>
                      <p className="text-xs text-zinc-400">by {selectedModalItem.author || "Community"} • {formatDownloads(selectedModalItem.downloads)} downloads</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedModalItem(null)}
                    className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar text-sm text-zinc-300">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Description</h4>
                    <p className="text-zinc-300 text-sm leading-relaxed">{selectedModalItem.description}</p>
                  </div>

                  {/* Categories */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Tags & Capabilities</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedModalItem.categories.map((c) => (
                        <span key={c} className="px-2.5 py-0.5 rounded-full bg-white/10 text-xs font-mono text-white">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Available Versions from Modrinth */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Available Versions</h4>
                    {loadingModalVersions ? (
                      <div className="py-6 text-center text-zinc-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-theme-400" />
                        <span>Loading versions...</span>
                      </div>
                    ) : modalVersions.length === 0 ? (
                      <p className="text-xs text-zinc-500">No version files returned.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto divide-y divide-white/10 border border-white/10 rounded-xl bg-black/40 custom-scrollbar">
                        {modalVersions.slice(0, 10).map((v: any) => {
                          const primaryFile = v.files?.find((f: any) => f.primary) || v.files?.[0];
                          return (
                            <div key={v.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                              <div>
                                <span className="font-semibold text-white">{v.name || v.version_number}</span>
                                <p className="text-[11px] font-mono text-zinc-400">
                                  MC: {v.game_versions?.slice(0, 3).join(", ")} {v.game_versions?.length > 3 ? "..." : ""}
                                </p>
                              </div>
                              {primaryFile && (
                                <a
                                  href={primaryFile.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Download
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-3">
                  <a
                    href={`https://modrinth.com/${selectedModalItem.projectType || "resourcepack"}/${selectedModalItem.slug || selectedModalItem.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open on Modrinth
                  </a>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedModalItem(null)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        handleInstall(selectedModalItem);
                        setSelectedModalItem(null);
                      }}
                      className="px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Install Latest
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
