import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { 
  Puzzle, 
  Box, 
  Layers, 
  Palette, 
  Search, 
  Download, 
  Eye, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Trash2, 
  ExternalLink, 
  Sliders, 
  Sparkles, 
  HardDrive, 
  Info, 
  X, 
  CheckCircle2, 
  SlidersHorizontal,
  Flame,
  Globe,
  Tag,
  FileCode,
  ShieldAlert,
  ArrowDownToLine,
  Power
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type AddonCategory = "all" | "mods" | "datapacks" | "resourcepacks" | "installed";
export type AddonSource = "all" | "modrinth";

export interface AddonItem {
  id: string;
  slug?: string;
  source: "modrinth" | "curated";
  sourceLabel: string;
  category: "mod" | "datapack" | "resourcepack";
  name: string;
  author: string;
  description: string;
  downloads: number;
  stars?: number;
  icon: string | null;
  categories: string[];
  versions?: string[];
  loaders?: string[];
  externalUrl?: string;
}

export interface InstalledItem {
  name: string;
  filename: string;
  type: "plugin" | "mod" | "datapack" | "resourcepack";
  sizeMB: number;
  modified?: string;
  enabled: boolean;
}

const POPULAR_TAGS: Record<string, string[]> = {
  mods: ["JEI", "Sodium", "Lithium", "FerriteCore", "Iris Shaders", "Appleskin", "JourneyMap", "Waystones", "Clumps", "Spark", "Curios", "Farmer's Delight"],
  datapacks: ["Terralith", "Incendium", "Nullscape", "Structory", "BlazeandCave", "Vanilla Tweaks", "Stellarity", "Graves", "Dungeons and Taverns"],
  resourcepacks: ["Faithful 32x", "Bare Bones", "Fresh Animations", "Stay True", "Dramatic Skys", "Default 3D", "Better Leaves", "Visible Ores"]
};

const MC_VERSIONS = [
  "All Versions",
  "26.2",
  "26.1.2",
  "26.1.1",
  "1.21.11",
  "1.21.10",
  "1.21.9",
  "1.21.8",
  "1.21.7",
  "1.21.6",
  "1.21.5",
  "1.21.4",
  "1.21.3",
  "1.21.1",
  "1.21",
  "1.20.6",
  "1.20.5",
  "1.20.4",
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
  "1.16.3",
  "1.16.2",
  "1.16.1",
  "1.15.2",
  "1.15.1",
  "1.15",
  "1.14.4",
  "1.14.3",
  "1.14.2",
  "1.14.1",
  "1.14",
  "1.13.2",
  "1.13.1",
  "1.13",
  "1.12.2",
  "1.11.2",
  "1.10.2",
  "1.9.4",
  "1.8.8",
  "1.7.10"
];

// High-fidelity fallback catalog for instant snappy loading
const CURATED_ADDONS: AddonItem[] = [
  // Mods
  {
    id: "sodium",
    slug: "sodium",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "mod",
    name: "Sodium",
    author: "jellysquid3",
    description: "State of the art client & server rendering engine overhaul that dramatically improves frame rates and reduces stuttering.",
    downloads: 42000000,
    stars: 12400,
    icon: "https://cdn.modrinth.com/data/AANobbMI/icon.png",
    categories: ["Optimization", "Performance"],
    loaders: ["Fabric", "NeoForge"]
  },
  {
    id: "lithium",
    slug: "lithium",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "mod",
    name: "Lithium",
    author: "jellysquid3",
    description: "General-purpose physics, chunk generation, AI pathfinding, and mob optimization mod for servers and clients.",
    downloads: 38000000,
    stars: 9800,
    icon: "https://cdn.modrinth.com/data/gvQqBUqZ/icon.png",
    categories: ["Optimization", "Server Performance"],
    loaders: ["Fabric", "NeoForge", "Quilt"]
  },
  {
    id: "jei",
    slug: "jei",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "mod",
    name: "Just Enough Items (JEI)",
    author: "mezz",
    description: "Item and recipe viewer for Minecraft mods with intuitive search, bookmarking, and crafting lookups.",
    downloads: 54000000,
    stars: 7600,
    icon: "https://cdn.modrinth.com/data/u6dRKJwZ/icon.png",
    categories: ["Utility", "Crafting"],
    loaders: ["Fabric", "Forge", "NeoForge"]
  },
  {
    id: "ferrite-core",
    slug: "ferrite-core",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "mod",
    name: "FerriteCore",
    author: "malte0811",
    description: "Reduces memory / RAM usage of Minecraft dramatically by optimizing blockstate and model caches.",
    downloads: 29000000,
    stars: 5300,
    icon: "https://cdn.modrinth.com/data/pZ2wcfyf/icon.png",
    categories: ["Optimization", "Memory"],
    loaders: ["Fabric", "Forge", "NeoForge"]
  },
  // Datapacks
  {
    id: "terralith",
    slug: "terralith",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "datapack",
    name: "Terralith",
    author: "Starmute",
    description: "Massive world generation overhaul adding 100+ brand new realistic and fantastical biomes without needing client mods.",
    downloads: 6200000,
    stars: 4800,
    icon: "https://cdn.modrinth.com/data/8shAZBQu/icon.png",
    categories: ["World Generation", "Biomes", "Adventure"],
    loaders: ["Datapack", "Vanilla"]
  },
  {
    id: "incendium",
    slug: "incendium",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "datapack",
    name: "Incendium",
    author: "Starmute",
    description: "Complete overhaul of the Nether dimension with custom terrain generation, custom structures, and unique items.",
    downloads: 3100000,
    stars: 2900,
    icon: "https://cdn.modrinth.com/data/mOgUtBDg/icon.png",
    categories: ["World Generation", "Nether", "Structures"],
    loaders: ["Datapack", "Vanilla"]
  },
  {
    id: "nullscape",
    slug: "nullscape",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "datapack",
    name: "Nullscape",
    author: "Starmute",
    description: "Overhauls The End dimension with colossal floating terrain, crystal peaks, and void biomes.",
    downloads: 2800000,
    stars: 2400,
    icon: "https://cdn.modrinth.com/data/LPjGiSO4/icon.png",
    categories: ["World Generation", "The End", "Adventure"],
    loaders: ["Datapack", "Vanilla"]
  },
  // Resource Packs
  {
    id: "faithful-32x",
    slug: "faithful-32x",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "resourcepack",
    name: "Faithful 32x",
    author: "Faithful Team",
    description: "The classic higher resolution 32x32 textures that stay true to default Minecraft aesthetics.",
    downloads: 14200000,
    stars: 8900,
    icon: "https://cdn.modrinth.com/data/R2QvvHjC/icon.png",
    categories: ["Vanilla+", "Textures", "Resolution"],
    loaders: ["Resource Pack", "Vanilla"]
  },
  {
    id: "bare-bones",
    slug: "bare-bones",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "resourcepack",
    name: "Bare Bones",
    author: "RobotPantaloons",
    description: "A texture pack with the purpose of bringing your world to the look of the official Minecraft trailers.",
    downloads: 9800000,
    stars: 7100,
    icon: "https://cdn.modrinth.com/data/2DYQC5GQ/icon.png",
    categories: ["Trailers", "Simplistic", "Vibrant"],
    loaders: ["Resource Pack", "Vanilla"]
  },
  {
    id: "fresh-animations",
    slug: "fresh-animations",
    source: "modrinth",
    sourceLabel: "Modrinth",
    category: "resourcepack",
    name: "Fresh Animations",
    author: "FreshLX",
    description: "Dynamic and expressive animations for Minecraft creatures, making mobs feel alive and energetic.",
    downloads: 21000000,
    stars: 14500,
    icon: "https://cdn.modrinth.com/data/lhGA9TYQ/icon.png",
    categories: ["Animation", "Entities", "Vanilla+"],
    loaders: ["Resource Pack", "Vanilla"]
  }
];

// Isolated axios instance for public APIs (Modrinth, Hangar) to avoid sending JWT and receiving 401s
const externalClient = axios.create();
delete externalClient.defaults.headers.common["Authorization"];
delete externalClient.defaults.headers.common["authorization"];

export default function AddonsManager({ 
  serverId, 
  initialCategory = "all" 
}: { 
  serverId: string; 
  initialCategory?: AddonCategory;
}) {
  const [selectedCategory, setSelectedCategory] = useState<AddonCategory>(initialCategory || "all");
  const [sourceProvider, setSourceProvider] = useState<AddonSource>("all");
  const [selectedVersion, setSelectedVersion] = useState<string>("All Versions");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [items, setItems] = useState<AddonItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Installed Items State
  const [installedList, setInstalledList] = useState<InstalledItem[]>([]);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [isLoadingInstalled, setIsLoadingInstalled] = useState<boolean>(false);
  const [installedSubFilter, setInstalledSubFilter] = useState<"all" | "mods" | "resourcepacks" | "datapacks">("all");
  const [installedSearch, setInstalledSearch] = useState<string>("");
  const [uninstallingName, setUninstallingName] = useState<string | null>(null);

  // Server Resource Pack Settings State
  const [serverProps, setServerProps] = useState<{ url: string; hash: string; prompt: string; required: boolean }>({
    url: "",
    hash: "",
    prompt: "",
    required: false
  });
  const [isSavingProps, setIsSavingProps] = useState<boolean>(false);
  const [showPropsConfig, setShowPropsConfig] = useState<boolean>(false);

  // Detail Modal / Drawer State
  const [detailItem, setDetailItem] = useState<AddonItem | null>(null);
  const [detailVersions, setDetailVersions] = useState<any[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  const triggerToast = (message: string, type: "success" | "error" = "success") => {
    setStatusToast({ message, type });
    setTimeout(() => setStatusToast(null), 4500);
  };

  // Fetch server.properties resource pack settings
  const fetchServerProps = async () => {
    try {
      const res = await axios.get(`/api/servers/${serverId}/resource-pack`);
      if (res.data) {
        setServerProps({
          url: res.data.url || "",
          hash: res.data.hash || "",
          prompt: res.data.prompt || "",
          required: Boolean(res.data.required)
        });
      }
    } catch (e) {
      console.warn("Could not fetch resource pack properties:", e);
    }
  };

  const handleSaveServerProps = async () => {
    setIsSavingProps(true);
    try {
      await axios.post(`/api/servers/${serverId}/resource-pack`, serverProps);
      triggerToast("Server resource pack settings saved!", "success");
    } catch (e: any) {
      triggerToast(e.response?.data?.error || "Failed to save resource pack settings", "error");
    } finally {
      setIsSavingProps(false);
    }
  };

  // Fetch installed items from server disk
  const fetchInstalled = async () => {
    try {
      setIsLoadingInstalled(true);
      const res = await axios.get(`/api/servers/${serverId}/installed-packages`);
      const data = res.data || {};

      const combined: InstalledItem[] = [];
      const map: Record<string, boolean> = {};

      (data.plugins || []).forEach((p: any) => {
        combined.push({ ...p, type: "plugin" });
        map[p.name.toLowerCase()] = true;
        map[p.filename.toLowerCase()] = true;
      });

      (data.mods || []).forEach((m: any) => {
        combined.push({ ...m, type: "mod" });
        map[m.name.toLowerCase()] = true;
        map[m.filename.toLowerCase()] = true;
      });

      (data.datapacks || []).forEach((d: any) => {
        combined.push({ ...d, type: "datapack" });
        map[d.name.toLowerCase()] = true;
        map[d.filename.toLowerCase()] = true;
      });

      (data.resourcepacks || []).forEach((r: any) => {
        combined.push({ ...r, type: "resourcepack" });
        map[r.name.toLowerCase()] = true;
        map[r.filename.toLowerCase()] = true;
      });

      setInstalledList(combined);
      setInstalledMap(map);
    } catch (e: any) {
      console.warn("Could not fetch installed items:", e.message);
    } finally {
      setIsLoadingInstalled(false);
    }
  };

  useEffect(() => {
    fetchInstalled();
    fetchServerProps();
  }, [serverId]);

  // Search & Query API (Modrinth with fallback)
  useEffect(() => {
    if (selectedCategory === "installed") return;

    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const results: AddonItem[] = [];

        // Determine project types for Modrinth (no plugins in Add-ons)
        let modrinthFacetTypes: string[] = [];
        if (selectedCategory === "all") {
          modrinthFacetTypes = ["mod", "datapack", "resourcepack"];
        } else if (selectedCategory === "mods") {
          modrinthFacetTypes = ["mod"];
        } else if (selectedCategory === "datapacks") {
          modrinthFacetTypes = ["datapack"];
        } else if (selectedCategory === "resourcepacks") {
          modrinthFacetTypes = ["resourcepack"];
        }

        // 1. Query Modrinth API
        try {
          const facetsArray: any[] = [];
          if (modrinthFacetTypes.length > 0) {
            facetsArray.push(modrinthFacetTypes.map(t => `project_type:${t}`));
          }
          if (selectedVersion !== "All Versions") {
            facetsArray.push([`versions:${selectedVersion}`]);
          }

          const params: any = {
            query: searchQuery.trim(),
            limit: 28,
            index: "downloads"
          };
          if (facetsArray.length > 0) {
            params.facets = JSON.stringify(facetsArray);
          }

          const res = await externalClient.get("https://api.modrinth.com/v2/search", {
            params,
            timeout: 6000
          });

          if (res.data?.hits) {
            res.data.hits.forEach((hit: any) => {
              let cat: AddonItem["category"] = "mod";
              if (hit.project_type === "datapack") cat = "datapack";
              else if (hit.project_type === "resourcepack") cat = "resourcepack";

              // Skip plugin project types
              if (hit.project_type === "plugin") return;

              results.push({
                id: hit.project_id || hit.slug,
                slug: hit.slug,
                source: "modrinth",
                sourceLabel: "Modrinth",
                category: cat,
                name: hit.title,
                author: hit.author,
                description: hit.description || "No description provided.",
                downloads: hit.downloads || 0,
                stars: hit.follows || 0,
                icon: hit.icon_url,
                categories: hit.categories || [],
                versions: hit.versions || [],
                loaders: hit.display_categories || hit.categories || []
              });
            });
          }
        } catch (mErr: any) {
          console.warn("Modrinth search failed, continuing:", mErr.message);
        }

        // 2. If remote returned empty or failed, match from curated catalog
        if (results.length === 0) {
          const filteredCurated = CURATED_ADDONS.filter(item => {
            const matchCat = selectedCategory === "all" || 
              (selectedCategory === "mods" && item.category === "mod") ||
              (selectedCategory === "datapacks" && item.category === "datapack") ||
              (selectedCategory === "resourcepacks" && item.category === "resourcepack");

            const matchQuery = !searchQuery.trim() || 
              item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.categories.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));

            return matchCat && matchQuery;
          });
          results.push(...filteredCurated);
        }

        if (isMounted) {
          setItems(results);
        }
      } catch (err: any) {
        console.error("Addons query error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchData();
    }, 280);

    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
    };
  }, [selectedCategory, selectedVersion, searchQuery]);

  // Install Add-on Handler
  const handleInstallAddon = async (item: AddonItem, specificVersionId?: string) => {
    setInstallingId(item.id);
    try {
      if (item.category === "mod") {
        await axios.post(`/api/servers/${serverId}/mods/install`, {
          pluginId: item.id,
          pluginName: item.name
        });
      } else if (item.category === "datapack") {
        await axios.post(`/api/servers/${serverId}/datapacks/install`, {
          projectId: item.id,
          title: item.name,
          versionId: specificVersionId
        });
      } else if (item.category === "resourcepack") {
        await axios.post(`/api/servers/${serverId}/resourcepacks/install`, {
          projectId: item.id,
          title: item.name,
          setInProperties: true,
          versionId: specificVersionId
        });
      }

      triggerToast(`Installed ${item.name} successfully!`, "success");
      await fetchInstalled();
    } catch (err: any) {
      triggerToast(err.response?.data?.error || err.message || `Failed to install ${item.name}`, "error");
    } finally {
      setInstallingId(null);
    }
  };

  // Uninstall / Delete Add-on Handler
  const handleUninstall = async (pkg: InstalledItem) => {
    setUninstallingName(pkg.filename);
    try {
      await axios.post(`/api/servers/${serverId}/packages/uninstall`, {
        type: pkg.type,
        filename: pkg.filename,
        clearServerProperties: pkg.type === "resourcepack"
      });
      triggerToast(`Removed ${pkg.filename} from server`, "success");
      await fetchInstalled();
      if (pkg.type === "resourcepack") {
        await fetchServerProps();
      }
    } catch (err: any) {
      triggerToast(err.response?.data?.error || err.message || "Failed to remove package", "error");
    } finally {
      setUninstallingName(null);
    }
  };

  // Inspect detail item modal
  const handleOpenDetail = async (item: AddonItem) => {
    setDetailItem(item);
    setDetailVersions([]);
    setIsLoadingDetail(true);

    try {
      if (item.source === "modrinth") {
        const res = await externalClient.get(`https://api.modrinth.com/v2/project/${item.slug || item.id}/version`, { timeout: 6000 });
        if (Array.isArray(res.data)) {
          setDetailVersions(res.data.slice(0, 10));
        }
      }
    } catch (e) {
      console.warn("Could not fetch version detail:", e);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "plugin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            <Puzzle className="w-3 h-3" /> Plugin
          </span>
        );
      case "mod":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300">
            <Box className="w-3 h-3" /> Mod
          </span>
        );
      case "datapack":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
            <Layers className="w-3 h-3" /> Datapack
          </span>
        );
      case "resourcepack":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-sky-500/15 border border-sky-500/30 text-sky-300">
            <Palette className="w-3 h-3" /> Resource Pack
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-zinc-800 border border-white/10 text-slate-300">
            <Tag className="w-3 h-3" /> Addon
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pt-6 sm:pt-7 pb-8 px-4 sm:px-6 space-y-5 text-foreground bg-transparent custom-scrollbar">
      {/* Toast Notification */}
      {statusToast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 border backdrop-blur-lg animate-in fade-in slide-in-from-bottom-5 ${
            statusToast.type === "error"
              ? "bg-rose-950/90 text-rose-200 border-rose-500/40"
              : "bg-emerald-950/90 text-emerald-200 border-emerald-500/40"
          }`}
        >
          {statusToast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{statusToast.message}</span>
        </div>
      )}

      {/* CATEGORY TABS BAR */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 custom-scrollbar shrink-0">
        {[
          { key: "all", label: "All Add-ons", icon: Globe, count: null },
          { key: "mods", label: "Mods", icon: Box, count: null },
          { key: "datapacks", label: "Datapacks", icon: Layers, count: null },
          { key: "resourcepacks", label: "Resource Packs", icon: Palette, count: null },
          { key: "installed", label: "Installed", icon: HardDrive, count: installedList.filter(p => p.type !== "plugin").length },
        ].map(tab => {
          const Icon = tab.icon;
          const isSelected = selectedCategory === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSelectedCategory(tab.key as AddonCategory)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all whitespace-nowrap border shrink-0 ${
                isSelected
                  ? "bg-theme-600 text-white border-theme-500 shadow-md shadow-theme-600/30"
                  : "bg-zinc-950/90 text-slate-300 hover:text-white border-white/15 hover:border-white/30"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`px-2 py-0.5 text-[11px] rounded-full font-mono ${
                  isSelected ? "bg-white/20 text-white" : "bg-zinc-800 text-slate-300"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SEARCH, SOURCE PROVIDER & VERSION FILTER */}
      {selectedCategory !== "installed" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${selectedCategory === "all" ? "mods, datapacks, resource packs..." : selectedCategory}...`}
              className="w-full bg-zinc-950/80 border border-white/15 focus:border-theme-500 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white font-mono outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Version Filter */}
          <div className="md:col-span-4">
            <select
              value={selectedVersion}
              onChange={e => setSelectedVersion(e.target.value)}
              className="w-full bg-zinc-950/80 border border-white/15 focus:border-theme-500 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white font-mono outline-none cursor-pointer"
            >
              {MC_VERSIONS.map(v => (
                <option key={v} value={v} className="bg-zinc-950 text-white">
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* POPULAR QUICK-SEARCH TAGS */}
      {selectedCategory !== "installed" && POPULAR_TAGS[selectedCategory] && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono custom-scrollbar">
          <span className="text-slate-500 font-bold shrink-0">Popular:</span>
          {POPULAR_TAGS[selectedCategory].map(tag => (
            <button
              key={tag}
              onClick={() => setSearchQuery(tag)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 hover:border-white/20 transition-all shrink-0 active:scale-95"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* CONTENT VIEW: INSTALLED OR BROWSER */}
      {selectedCategory === "installed" ? (
        /* INSTALLED ADD-ONS TAB */
        <div className="space-y-5">
          {/* Header and Sub-filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold font-mono text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-theme-400" />
                Installed Packages ({installedList.filter(p => p.type !== "plugin").length})
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Manage all installed mods, resource packs, and datapacks on your server
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPropsConfig(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                  showPropsConfig
                    ? "bg-sky-600/30 text-sky-300 border-sky-500/50 shadow-sm"
                    : "bg-zinc-900 text-slate-300 hover:text-white border-white/10 hover:border-white/20"
                }`}
                title="Configure Server Resource Pack in server.properties"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Resource Pack Config</span>
              </button>

              <button
                onClick={() => fetchInstalled()}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-slate-300 hover:text-white border border-white/10 rounded-xl transition-all"
                title="Refresh Installed Packages"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInstalled ? "animate-spin text-theme-400" : ""}`} />
              </button>
            </div>
          </div>

          {/* Sub-Filters and Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Sub-Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {[
                { key: "all", label: "All Installed", count: installedList.filter(p => p.type !== "plugin").length, icon: HardDrive },
                { key: "mods", label: "Mods", count: installedList.filter(p => p.type === "mod").length, icon: Box },
                { key: "resourcepacks", label: "Resource Packs", count: installedList.filter(p => p.type === "resourcepack").length, icon: Palette },
                { key: "datapacks", label: "Datapacks", count: installedList.filter(p => p.type === "datapack").length, icon: Layers },
              ].map(sub => {
                const SubIcon = sub.icon;
                const isSubActive = installedSubFilter === sub.key;
                return (
                  <button
                    key={sub.key}
                    onClick={() => setInstalledSubFilter(sub.key as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap border shrink-0 ${
                      isSubActive
                        ? "bg-white/15 text-white border-white/30 shadow-sm"
                        : "bg-zinc-950/60 text-slate-400 hover:text-white border-white/5 hover:border-white/15"
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                      isSubActive ? "bg-white/25 text-white" : "bg-zinc-800 text-slate-400"
                    }`}>
                      {sub.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Search in Installed */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={installedSearch}
                onChange={e => setInstalledSearch(e.target.value)}
                placeholder="Filter installed..."
                className="w-full bg-zinc-950/80 border border-white/10 focus:border-theme-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white font-mono outline-none"
              />
              {installedSearch && (
                <button
                  onClick={() => setInstalledSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Server.properties Resource Pack Configuration Card */}
          {(showPropsConfig || installedSubFilter === "resourcepacks") && (
            <div className="p-4 sm:p-5 bg-sky-950/30 border border-sky-500/20 rounded-2xl space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-sky-400" />
                  <h4 className="text-sm font-bold font-mono text-white">
                    Server.properties Resource Pack
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-sky-300/80">
                  Sends texture pack to joining players automatically
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold">Direct Resource Pack URL</label>
                  <input
                    type="text"
                    value={serverProps.url}
                    onChange={e => setServerProps(p => ({ ...p, url: e.target.value }))}
                    placeholder="https://example.com/pack.zip"
                    className="w-full bg-zinc-950 border border-white/15 focus:border-sky-400 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-bold">SHA-1 Checksum Hash (Optional)</label>
                  <input
                    type="text"
                    value={serverProps.hash}
                    onChange={e => setServerProps(p => ({ ...p, hash: e.target.value }))}
                    placeholder="e.g. 40-character SHA1 hash"
                    className="w-full bg-zinc-950 border border-white/15 focus:border-sky-400 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-300 font-bold">Prompt Message (Optional)</label>
                  <input
                    type="text"
                    value={serverProps.prompt}
                    onChange={e => setServerProps(p => ({ ...p, prompt: e.target.value }))}
                    placeholder="e.g. Please accept our custom textures for the best experience!"
                    className="w-full bg-zinc-950 border border-white/15 focus:border-sky-400 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-sky-500/10">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-300">
                  <input
                    type="checkbox"
                    checked={serverProps.required}
                    onChange={e => setServerProps(p => ({ ...p, required: e.target.checked }))}
                    className="rounded border-white/20 bg-zinc-900 text-sky-500 focus:ring-0"
                  />
                  <span>Require players to accept resource pack to join</span>
                </label>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {serverProps.url && (
                    <button
                      onClick={() => setServerProps({ url: "", hash: "", prompt: "", required: false })}
                      className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 text-xs font-mono font-bold transition-all"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={handleSaveServerProps}
                    disabled={isSavingProps}
                    className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-mono font-bold transition-all shadow flex items-center gap-1.5"
                  >
                    {isSavingProps ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Properties</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* List of Installed Packages */}
          {isLoadingInstalled ? (
            <div className="p-12 text-center font-mono text-sm text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-theme-400" />
              <span>Scanning server folders for installed packages...</span>
            </div>
          ) : (() => {
            const filtered = installedList
              .filter(pkg => pkg.type !== "plugin")
              .filter(pkg => {
                const matchCategory = 
                  installedSubFilter === "all" ||
                  (installedSubFilter === "mods" && pkg.type === "mod") ||
                  (installedSubFilter === "resourcepacks" && pkg.type === "resourcepack") ||
                  (installedSubFilter === "datapacks" && pkg.type === "datapack");

                const matchQuery = !installedSearch.trim() ||
                  pkg.name.toLowerCase().includes(installedSearch.toLowerCase()) ||
                  pkg.filename.toLowerCase().includes(installedSearch.toLowerCase());

                return matchCategory && matchQuery;
              });

            if (filtered.length === 0) {
              return (
                <div className="p-10 border border-dashed border-white/15 rounded-2xl text-center font-mono text-slate-400 space-y-3">
                  <p className="text-white font-bold text-sm">
                    {installedSearch 
                      ? "No matching packages found"
                      : installedSubFilter === "all" 
                        ? "No add-on packages installed on server yet"
                        : `No ${installedSubFilter} installed yet`}
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {installedSearch
                      ? "Try clearing your search query above."
                      : "Browse our catalog from Modrinth to install mods, resource packs, and datapacks with 1 click."}
                  </p>
                  {!installedSearch && (
                    <button
                      onClick={() => setSelectedCategory(installedSubFilter === "all" ? "all" : (installedSubFilter as any))}
                      className="px-4 py-2 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-md active:scale-95 inline-flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Browse & Install {installedSubFilter === "all" ? "Add-ons" : installedSubFilter}</span>
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(pkg => {
                  const isDeleting = uninstallingName === pkg.filename;
                  return (
                    <div
                      key={pkg.filename}
                      className="p-4 bg-zinc-950/80 border border-white/10 hover:border-white/20 rounded-2xl space-y-3 transition-all shadow-lg flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getCategoryBadge(pkg.type)}
                            <span className="text-[11px] font-mono text-slate-500">
                              {pkg.sizeMB} MB
                            </span>
                          </div>
                          <h4 className="text-sm font-bold font-mono text-white truncate" title={pkg.filename}>
                            {pkg.name}
                          </h4>
                          <p className="text-[11px] font-mono text-slate-400 truncate">
                            {pkg.filename}
                          </p>
                        </div>

                        <button
                          onClick={() => handleUninstall(pkg)}
                          disabled={isDeleting}
                          className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 rounded-xl transition-all shrink-0 active:scale-95 disabled:opacity-50"
                          title="Uninstall / Delete"
                        >
                          {isDeleting ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-400">
                        <span className="inline-flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                        <span className="text-[11px] text-slate-500 uppercase tracking-wider">{pkg.type}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : (
        /* EXPLORE & DISCOVER ADD-ONS GRID */
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-16 text-center font-mono text-sm text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-theme-400" />
              <span>Fetching add-ons from Modrinth & Paper Hangar...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 border border-dashed border-white/15 rounded-2xl text-center font-mono text-slate-400 space-y-2">
              <p className="text-white font-bold">No Add-ons Found</p>
              <p className="text-xs">Try adjusting your search query or selecting "All Versions".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => {
                const isInstalled = Boolean(
                  installedMap[item.name.toLowerCase()] || 
                  (item.slug && installedMap[item.slug.toLowerCase()])
                );
                const isThisInstalling = installingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 bg-zinc-950/85 backdrop-blur-xl border border-white/15 hover:border-white/30 rounded-2xl flex flex-col justify-between transition-all shadow-xl hover:-translate-y-0.5 group"
                  >
                    <div className="space-y-3">
                      {/* Top Row: Icon + Category Badge + Source */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.icon ? (
                            <img
                              src={item.icon}
                              alt={item.name}
                              className="w-11 h-11 rounded-xl object-cover bg-zinc-900 border border-white/10 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl border border-white/10 bg-zinc-900 flex items-center justify-center text-slate-400 shrink-0">
                              <Puzzle className="w-5 h-5" />
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold font-mono text-white truncate group-hover:text-theme-300 transition-colors">
                              {item.name}
                            </h3>
                            <p className="text-[11px] font-mono text-slate-400 truncate">
                              by <strong className="text-slate-300">{item.author}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {getCategoryBadge(item.category)}
                          <span className="text-[10px] font-mono text-slate-500">
                            {item.sourceLabel}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs font-mono text-slate-300 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Tags & Loaders */}
                      {item.loaders && item.loaders.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.loaders.slice(0, 4).map(l => (
                            <span key={l} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] font-mono text-slate-400">
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata & Action Buttons */}
                    <div className="pt-4 mt-3 border-t border-white/5 flex items-center justify-between gap-3">
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
                        <span title="Total Downloads">
                          ⬇ {item.downloads > 1000000 ? `${(item.downloads / 1000000).toFixed(1)}M` : item.downloads > 1000 ? `${(item.downloads / 1000).toFixed(0)}k` : item.downloads}
                        </span>
                        {item.stars !== undefined && item.stars > 0 && (
                          <span title="Stars / Follows">
                            ★ {item.stars}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="p-2 bg-transparent hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl transition-all"
                          title="View Details & Versions"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleInstallAddon(item)}
                          disabled={isThisInstalling}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-md ${
                            isInstalled
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                              : "bg-theme-600 hover:bg-theme-500 text-white border border-theme-500 shadow-theme-600/20"
                          } disabled:opacity-50`}
                        >
                          {isThisInstalling ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isInstalled ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{isInstalled ? "Reinstall" : "Install"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DETAIL & VERSION DRAWER / MODAL */}
      <AnimatePresence>
        {detailItem && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-zinc-950 border border-white/20 p-6 rounded-3xl max-w-xl w-full shadow-2xl space-y-5 max-h-[85vh] flex flex-col justify-between"
            >
              <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {detailItem.icon ? (
                      <img
                        src={detailItem.icon}
                        alt={detailItem.name}
                        className="w-12 h-12 rounded-2xl object-cover bg-zinc-900 border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl border border-white/10 bg-zinc-900 flex items-center justify-center text-slate-400">
                        <Puzzle className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-bold font-mono text-white">
                        {detailItem.name}
                      </h3>
                      <p className="text-xs font-mono text-slate-400">
                        By {detailItem.author} • {detailItem.sourceLabel}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setDetailItem(null)}
                    className="p-1.5 text-slate-400 hover:text-white bg-zinc-900 rounded-xl"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3.5 bg-black/50 border border-white/5 rounded-2xl text-xs font-mono text-slate-300 leading-relaxed">
                  {detailItem.description}
                </div>

                {/* Available Versions List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-mono text-white flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-theme-400" />
                    Available Releases & Builds
                  </h4>

                  {isLoadingDetail ? (
                    <div className="p-6 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-theme-400" />
                      Loading version history...
                    </div>
                  ) : detailVersions.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {detailVersions.map((ver: any) => (
                        <div
                          key={ver.id}
                          className="p-3 bg-zinc-900/90 border border-white/5 rounded-xl flex items-center justify-between gap-3 text-xs font-mono"
                        >
                          <div className="min-w-0">
                            <span className="text-white font-bold block truncate">
                              {ver.name || ver.version_number}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Minecraft {(ver.game_versions || []).slice(0, 3).join(", ")}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              handleInstallAddon(detailItem, ver.id);
                              setDetailItem(null);
                            }}
                            className="px-3 py-1 bg-theme-600 hover:bg-theme-500 text-white rounded-lg font-bold shrink-0 transition-all text-xs"
                          >
                            Install
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-slate-500">
                      Standard release will be auto-resolved upon 1-click install.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="px-4 py-2 bg-zinc-900 text-slate-300 rounded-xl text-xs font-mono font-bold"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleInstallAddon(detailItem);
                    setDetailItem(null);
                  }}
                  className="px-5 py-2 bg-theme-600 hover:bg-theme-500 text-white rounded-xl text-xs font-mono font-bold shadow-lg shadow-theme-600/30 active:scale-95 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Direct 1-Click Install
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
