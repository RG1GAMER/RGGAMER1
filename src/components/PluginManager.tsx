import React, { useEffect, useState } from "react";
import { LoadingOverlay } from "../components/LoadingOverlay";
import axios from "axios";
import {
  Search,
  Download,
  RefreshCw,
  Layers,
  Cpu,
  Server,
  Box,
  ExternalLink,
  Tag,
  Flame,
  CheckCircle2,
  AlertCircle,
  Puzzle,
  Archive,
  FolderTree,
  Sparkles
} from "lucide-react";

export interface PluginItem {
  id: string;
  source: "modrinth" | "spigot" | "hangar" | "bukkit";
  sourceLabel: string;
  name: string;
  tag: string;
  downloads: number;
  author: string;
  supports: string[];
  icon: string | null;
  rating?: number;
  customIconType?: string;
}

// Popular essential plugins tags
const POPULAR_ESSENTIALS = [
  "EssentialsX",
  "WorldEdit",
  "Vault",
  "LuckPerms",
  "CoreProtect",
  "ViaVersion",
  "ClearLag",
  "Multiverse-Core",
  "Geyser-Spigot",
  "Chunky",
  "GSit",
  "PlaceholderAPI",
  "AuthMe",
  "TAB",
  "GriefPrevention",
];

// Rich curated database matching exact screenshot list for instant responsiveness & high fidelity
const CURATED_ESSENTIALS: PluginItem[] = [
  {
    id: "essentialsx",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX",
    tag: "The essential plugin suite for Paper and Spigot servers.",
    downloads: 735432,
    author: "mdcfe",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: "https://cdn.modrinth.com/data/G1qbF45k/icon.png",
    customIconType: "potion",
  },
  {
    id: "essentialsx-chat",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX Chat",
    tag: "The chat formatting module for EssentialsX. (requires main module)",
    downloads: 185288,
    author: "mdcfe",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: "https://cdn.modrinth.com/data/G1qbF45k/icon.png",
    customIconType: "potion",
  },
  {
    id: "essentialsx-spawn",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX Spawn",
    tag: "The player spawning control module for EssentialsX. (requires main module)",
    downloads: 166466,
    author: "mdcfe",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: "https://cdn.modrinth.com/data/G1qbF45k/icon.png",
    customIconType: "potion",
  },
  {
    id: "EssentialsX/Essentials",
    source: "hangar",
    sourceLabel: "Paper Hangar",
    name: "Essentials",
    tag: "The essential plugin suite for Paper! (and Spigot)",
    downloads: 108068,
    author: "EssentialsX",
    supports: ["PaperMC", "Bukkit", "Purpur", "Folia"],
    icon: "https://cdn.modrinth.com/data/G1qbF45k/icon.png",
    customIconType: "potion",
  },
  {
    id: "staff-essentials",
    source: "bukkit",
    sourceLabel: "Bukkit / Spigot",
    name: "Staff Essentials",
    tag: "This plugin has all your needs for staff in one place!",
    downloads: 59572,
    author: "Author #17046",
    supports: ["Bukkit", "PaperMC", "Spigot", "CraftBukkit"],
    icon: null,
  },
  {
    id: "promotionessentials",
    source: "bukkit",
    sourceLabel: "Bukkit / Spigot",
    name: "PromotionEssentials",
    tag: "Promote players with Time, Signs, Passwords, Tokens, Money and Kills!",
    downloads: 41240,
    author: "Author #24426",
    supports: ["Bukkit", "PaperMC", "Spigot", "CraftBukkit"],
    icon: null,
  },
  {
    id: "essentialsc-folia",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsC [1.20.6-26.2+ | Folia Support ]",
    tag: "No Legacy Bloat. Folia Support. Maintained.",
    downloads: 30577,
    author: "_GodlyCow",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: null,
  },
  {
    id: "essentialsx-gui",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX-GUI",
    tag: "EssentialsX-GUI is an EssentialsX addon that adds some GUIs for Essentials features, like homes, kits, warps, etc..",
    downloads: 27563,
    author: "Sniper_TVmc",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: null,
  },
  {
    id: "essentialsx-selectors",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX Selectors: @a, @p, @r (Addon)",
    tag: "Adds @a, @p, and @r to EssentialsX Commands! Also adds \"@a[thing=value]\"!",
    downloads: 26376,
    author: "DogLoverPink",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: null,
  },
  {
    id: "bungeeessentials",
    source: "bukkit",
    sourceLabel: "Bukkit / Spigot",
    name: "BungeeEssentials",
    tag: "Many customizable and useful features for your server!",
    downloads: 22208,
    author: "Author #18078",
    supports: ["Bukkit", "PaperMC", "Spigot", "CraftBukkit"],
    icon: null,
  },
  {
    id: "essentialsx-protect",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX Protect",
    tag: "The config-based gameplay control module for EssentialsX. (requires main module)",
    downloads: 17497,
    author: "mdcfe",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: "https://cdn.modrinth.com/data/G1qbF45k/icon.png",
    customIconType: "potion",
  },
  {
    id: "cmi-essentials",
    source: "spigot",
    sourceLabel: "Bukkit / Spigot",
    name: "CMI - 300+ Commands/Insane Kits/Portals/Essentials/Economy/MySQL & SqLite/Much More!",
    tag: "For 1.7.10 - 1.21.x Over 300 must have commands/features for your server!",
    downloads: 13963,
    author: "Author #24572",
    supports: ["Bukkit", "PaperMC", "Spigot", "CraftBukkit"],
    icon: null,
  },
  {
    id: "essentialsx-discord",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX Discord",
    tag: "The Discord chat integration module for EssentialsX. (requires main module)",
    downloads: 8564,
    author: "mdcfe",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: "https://cdn.modrinth.com/data/G1qbF45k/icon.png",
    customIconType: "potion",
  },
  {
    id: "smp-essentials",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "SMP Essentials",
    tag: "SMP Essentials is A Minecraft plugin Built To Make Hosting A Minecraft SMP's easier and faster!",
    downloads: 8199,
    author: "logogaming",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: null,
  },
  {
    id: "serveressentials-skript",
    source: "bukkit",
    sourceLabel: "Bukkit / Spigot",
    name: "ServerEssentials [Essentials For Skript]",
    tag: "ServerEssentials",
    downloads: 4766,
    author: "Author #33885",
    supports: ["Bukkit", "PaperMC", "Spigot", "CraftBukkit"],
    icon: null,
  },
  {
    id: "essentialsx-antibuild",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX AntiBuild",
    tag: "The permission-based interactions control module for EssentialsX. (requires main module)",
    downloads: 4713,
    author: "mdcfe",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: "https://cdn.modrinth.com/data/G1qbF45k/icon.png",
    customIconType: "potion",
  },
  {
    id: "proxy-essentials",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "Proxy Essentials",
    tag: "The SimpleCloud Proxy Essentials Plugin enhances your server network with customizable MOTD (Server Info) and Tablist features, offering extensive customization options through simple configuration files.",
    downloads: 4030,
    author: "FllipEis",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: null,
  },
  {
    id: "essentialsx-discordlink",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX Discord Link",
    tag: "The Discord account linking module for EssentialsX. (requires main and Discord modules)",
    downloads: 3144,
    author: "mdcfe",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: "https://cdn.modrinth.com/data/G1qbF45k/icon.png",
    customIconType: "potion",
  },
  {
    id: "essentialsx-geo",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "EssentialsX Geo",
    tag: "The geolocation module for EssentialsX. (requires main module)",
    downloads: 2590,
    author: "mdcfe",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: "https://cdn.modrinth.com/data/G1qbF45k/icon.png",
    customIconType: "potion",
  },
  {
    id: "mchubessentials",
    source: "bukkit",
    sourceLabel: "Bukkit / Spigot",
    name: "McHubEssentials",
    tag: "Double Jump, Farting, Plugin Hiding, Much Swag",
    downloads: 2353,
    author: "Author #6525",
    supports: ["Bukkit", "PaperMC", "Spigot", "CraftBukkit"],
    icon: null,
  },
  {
    id: "spunky-smp-essentials",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "Spunky SMP Essentials",
    tag: "Advanced SMP Essentials plugin with /spawn, /home, /tpa, and more. Perfect for servers",
    downloads: 2024,
    author: "spunkyinsaan",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: null,
  },
  {
    id: "luckperms",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "LuckPerms",
    tag: "An advanced permissions plugin for Minecraft servers (Bukkit, Spigot, Paper, Fabric, Forge).",
    downloads: 1450200,
    author: "Luck",
    supports: ["Bukkit", "PaperMC", "Spigot", "Purpur", "Folia"],
    icon: "https://cdn.modrinth.com/data/Vebnzrzj/icon.png",
  },
  {
    id: "worldedit",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "WorldEdit",
    tag: "A Minecraft map editor and world manipulation tool for fast terrain shaping.",
    downloads: 2800100,
    author: "EngineHub",
    supports: ["Bukkit", "PaperMC", "Spigot", "Purpur"],
    icon: "https://cdn.modrinth.com/data/1eAoo2KR/icon.png",
  },
  {
    id: "vault",
    source: "spigot",
    sourceLabel: "Bukkit / Spigot",
    name: "Vault",
    tag: "Permissions, Chat, & Economy API to allow plugins to easily hook into economy services.",
    downloads: 3200500,
    author: "Sleaker",
    supports: ["Bukkit", "PaperMC", "Spigot", "CraftBukkit"],
    icon: null,
  },
  {
    id: "viaversion",
    source: "hangar",
    sourceLabel: "Paper Hangar",
    name: "ViaVersion",
    tag: "Allows newer Minecraft client versions to connect to older server versions.",
    downloads: 1890000,
    author: "ViaVersion",
    supports: ["PaperMC", "Bukkit", "Spigot", "Purpur", "Velocity"],
    icon: null,
  },
  {
    id: "coreprotect",
    source: "spigot",
    sourceLabel: "Bukkit / Spigot",
    name: "CoreProtect",
    tag: "Fast, efficient, block logging and anti-griefing data rollback tool.",
    downloads: 1200400,
    author: "Intelli",
    supports: ["Bukkit", "PaperMC", "Spigot"],
    icon: null,
  }
];

export default function PluginManager({ serverId }: { serverId: string }) {
  const [plugins, setPlugins] = useState<PluginItem[]>(CURATED_ESSENTIALS);
  const [loading, setLoading] = useState(false);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeSource, setActiveSource] = useState<"all" | "hangar" | "bukkit" | "spigot" | "modrinth">("all");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error"; externalLink?: string } | null>(null);

  const getDirectUrl = (plugin: PluginItem) => {
    switch (plugin.source) {
      case "modrinth":
        return `https://modrinth.com/project/${plugin.id}`;
      case "spigot":
        return `https://www.spigotmc.org/resources/${plugin.id}`;
      case "hangar":
        return `https://hangar.papermc.io/${plugin.id}`;
      case "bukkit":
        return `https://dev.bukkit.org/projects/${plugin.id}`;
      default:
        return `https://modrinth.com/plugins`;
    }
  };

  const searchPlugins = async (searchQuery: string = "") => {
    try {
      setLoading(true);
      const q = searchQuery.trim().toLowerCase();

      // If searching essentials or empty, combine curated + live results
      let filteredCurated = CURATED_ESSENTIALS;
      if (q) {
        filteredCurated = CURATED_ESSENTIALS.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.tag.toLowerCase().includes(q) ||
            p.author.toLowerCase().includes(q)
        );
      }

      if (activeSource !== "all") {
        filteredCurated = filteredCurated.filter((p) => {
          if (activeSource === "hangar") return p.source === "hangar";
          if (activeSource === "bukkit") return p.source === "bukkit";
          if (activeSource === "spigot") return p.source === "spigot" || p.source === "bukkit";
          if (activeSource === "modrinth") return p.source === "modrinth";
          return true;
        });
      }

      const results: PluginItem[] = [...filteredCurated];
      const existingIds = new Set(results.map((r) => r.id.toLowerCase()));

      // Clean axios instance for external queries
      const externalAxios = axios.create();
      delete externalAxios.defaults.headers.common["Authorization"];

      const promises = [];

      // Modrinth live search
      if (activeSource === "all" || activeSource === "modrinth") {
        promises.push(
          externalAxios
            .get(
              `https://api.modrinth.com/v2/search?query=${encodeURIComponent(q || "essentials")}&facets=[["project_type:plugin"]]&limit=20`,
              { timeout: 5000 }
            )
            .then((res) => {
              if (res.data?.hits) {
                res.data.hits.forEach((hit: any) => {
                  if (!existingIds.has(hit.project_id.toLowerCase())) {
                    existingIds.add(hit.project_id.toLowerCase());
                    results.push({
                      id: hit.project_id,
                      source: "modrinth",
                      sourceLabel: "Modrinth",
                      name: hit.title,
                      tag: hit.description,
                      downloads: hit.downloads || 0,
                      author: hit.author || "Community",
                      supports: hit.categories?.filter((c: string) => ["bukkit", "spigot", "paper", "purpur", "folia"].includes(c.toLowerCase())).map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)) || ["Bukkit", "PaperMC", "Spigot"],
                      icon: hit.icon_url || null,
                    });
                  }
                });
              }
            })
            .catch(() => {})
        );
      }

      // PaperMC Hangar live search
      if (activeSource === "all" || activeSource === "hangar") {
        promises.push(
          externalAxios
            .get(
              `https://hangar.papermc.io/api/v1/projects?q=${encodeURIComponent(q || "essentials")}&limit=15`,
              { timeout: 5000 }
            )
            .then((res) => {
              if (res.data?.result) {
                res.data.result.forEach((hit: any) => {
                  const slugId = `${hit.namespace?.owner}/${hit.namespace?.slug}`;
                  if (!existingIds.has(slugId.toLowerCase()) && !existingIds.has(hit.name.toLowerCase())) {
                    existingIds.add(slugId.toLowerCase());
                    results.push({
                      id: slugId,
                      source: "hangar",
                      sourceLabel: "Paper Hangar",
                      name: hit.name,
                      tag: hit.description,
                      downloads: hit.stats?.downloads || 0,
                      author: hit.namespace?.owner || "Hangar",
                      supports: ["PaperMC", "Bukkit", "Purpur", "Folia"],
                      icon: hit.avatarUrl || null,
                    });
                  }
                });
              }
            })
            .catch(() => {})
        );
      }

      // SpigotMC / Spiget live search
      if (activeSource === "all" || activeSource === "spigot" || activeSource === "bukkit") {
        promises.push(
          externalAxios
            .get(
              `https://api.spiget.org/v2/search/resources/${encodeURIComponent(q || "essentials")}?field=name&size=15&page=1`,
              { timeout: 5000 }
            )
            .then((res) => {
              if (Array.isArray(res.data)) {
                res.data.forEach((hit: any) => {
                  const idStr = hit.id.toString();
                  if (!existingIds.has(idStr) && !existingIds.has(hit.name.toLowerCase())) {
                    existingIds.add(idStr);
                    results.push({
                      id: idStr,
                      source: "spigot",
                      sourceLabel: "Bukkit / Spigot",
                      name: hit.name,
                      tag: hit.tag || "Minecraft server plugin",
                      downloads: hit.downloads || 0,
                      author: `Author #${hit.author?.id || "Author"}`,
                      supports: ["Bukkit", "PaperMC", "Spigot", "CraftBukkit"],
                      icon: hit.icon?.url ? `https://spigotmc.org/${hit.icon.url}` : null,
                    });
                  }
                });
              }
            })
            .catch(() => {})
        );
      }

      await Promise.all(promises);

      // Sort by downloads descending
      results.sort((a, b) => b.downloads - a.downloads);
      setPlugins(results);
    } catch (e) {
      console.error(e);
      setPlugins(CURATED_ESSENTIALS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchPlugins(query);
  }, [activeSource]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchPlugins(query);
  };

  const handlePillClick = (term: string) => {
    setQuery(term);
    searchPlugins(term);
  };

  const handleInstall = async (plugin: PluginItem) => {
    setStatusMsg(null);
    try {
      setIsInstalling(plugin.id);

      const res = await axios.post(`/api/servers/${serverId}/plugins/install`, {
        source: plugin.source,
        pluginId: plugin.id,
        pluginName: plugin.name,
      });

      setStatusMsg({
        text: res.data?.message || `${plugin.name} installed successfully into /plugins! Restart your server to load it.`,
        type: "success",
      });
    } catch (e: any) {
      const fallbackUrl = e.response?.data?.externalLink || getDirectUrl(plugin);
      setStatusMsg({
        text:
          e.response?.data?.error ||
          `Failed to automatically install ${plugin.name}. You can download the .jar directly:`,
        type: "error",
        externalLink: fallbackUrl,
      });
    } finally {
      setIsInstalling(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8 text-foreground bg-transparent w-full max-w-5xl mx-auto space-y-6">
      {/* Toast Alert */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex flex-col gap-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 ${
            statusMsg.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/90 border-rose-500/40 text-rose-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {statusMsg.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{statusMsg.text}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-xs opacity-70 hover:opacity-100 ml-3 font-mono font-bold px-2 py-1 bg-black/40 rounded-lg"
            >
              Dismiss
            </button>
          </div>
          {statusMsg.externalLink && (
            <div className="pt-2 border-t border-rose-500/20 flex flex-wrap items-center gap-3">
              <a
                href={statusMsg.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold rounded-lg border border-rose-500/40 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download Manually (.jar)
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
              </a>
              <span className="text-xs text-zinc-400">
                After downloading, upload it into the <strong className="text-zinc-200">/plugins</strong> folder in File Manager.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Header Section (Exact Screenshot Style) */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {/* Red Stacked Layers Icon */}
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
              Paper & Bukkit Plugin Manager
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] sm:text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
            <Sparkles className="w-3.5 h-3.5 text-theme-400" />
            <span>DIRECT INTEGRATION WITH PAPERMC HANGAR, BUKKITDEV, SPIGOTMC & MODRINTH</span>
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => searchPlugins(query)}
          className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-slate-200 border border-white/10 hover:border-white/20 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 shadow-sm shrink-0 active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-theme-400" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Popular Paper & Bukkit Essentials Card (Exact Screenshot Style) */}
      <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono font-bold text-white uppercase tracking-wider">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>POPULAR PAPER & BUKKIT ESSENTIALS:</span>
          </div>
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">Click to search</span>
        </div>

        {/* Tag Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {POPULAR_ESSENTIALS.map((term) => (
            <button
              key={term}
              onClick={() => handlePillClick(term)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all flex items-center gap-1.5 active:scale-95 ${
                query.toLowerCase() === term.toLowerCase()
                  ? "bg-theme-500 text-black border-theme-400 shadow-md shadow-theme-500/20"
                  : "bg-zinc-900/90 text-slate-300 border-white/10 hover:border-white/30 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <Tag className="w-3 h-3 opacity-70 text-rose-400" />
              <span>{term}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filter Container (Exact Screenshot Style) */}
      <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        {/* Search Bar with Search Button */}
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PaperMC, Bukkit, Spigot & Modrinth plugins (e.g. EssentialsX, WorldEdit, LuckPerms, Vault)..."
              className="w-full bg-black/60 border border-white/10 focus:border-theme-500 rounded-2xl py-3 pl-10 pr-4 text-xs sm:text-sm text-white font-mono placeholder:text-slate-500 outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white border border-white/10 hover:border-white/20 rounded-2xl text-xs sm:text-sm font-mono font-bold transition-all flex items-center gap-2 shadow-sm shrink-0 active:scale-95"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </form>

        {/* Source Filter Buttons */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
          <button
            onClick={() => setActiveSource("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 border ${
              activeSource === "all"
                ? "bg-theme-500 text-black border-theme-400 shadow-md shadow-theme-500/20"
                : "bg-zinc-900/70 text-slate-300 border-white/10 hover:border-white/20 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> All Sources
          </button>

          <button
            onClick={() => setActiveSource("hangar")}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 border ${
              activeSource === "hangar"
                ? "bg-theme-500 text-black border-theme-400 shadow-md shadow-theme-500/20"
                : "bg-zinc-900/70 text-slate-300 border-white/10 hover:border-white/20 hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-blue-400" /> PaperMC (Hangar)
          </button>

          <button
            onClick={() => setActiveSource("bukkit")}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 border ${
              activeSource === "bukkit"
                ? "bg-theme-500 text-black border-theme-400 shadow-md shadow-theme-500/20"
                : "bg-zinc-900/70 text-slate-300 border-white/10 hover:border-white/20 hover:text-white"
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-amber-400" /> Bukkit / CraftBukkit
          </button>

          <button
            onClick={() => setActiveSource("spigot")}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 border ${
              activeSource === "spigot"
                ? "bg-theme-500 text-black border-theme-400 shadow-md shadow-theme-500/20"
                : "bg-zinc-900/70 text-slate-300 border-white/10 hover:border-white/20 hover:text-white"
            }`}
          >
            <Server className="w-3.5 h-3.5 text-orange-400" /> SpigotMC
          </button>

          <button
            onClick={() => setActiveSource("modrinth")}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 border ${
              activeSource === "modrinth"
                ? "bg-theme-500 text-black border-theme-400 shadow-md shadow-theme-500/20"
                : "bg-zinc-900/70 text-slate-300 border-white/10 hover:border-white/20 hover:text-white"
            }`}
          >
            <Box className="w-3.5 h-3.5 text-emerald-400" /> Modrinth Plugins
          </button>
        </div>
      </div>

      {/* Plugins List (Exact Screenshot Structure) */}
      <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl divide-y divide-white/5">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3 font-mono">
            <RefreshCw className="w-6 h-6 animate-spin text-theme-400" />
            <span>Searching PaperMC Hangar, Bukkit, Spigot & Modrinth repositories...</span>
          </div>
        ) : plugins.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Puzzle className="w-8 h-8 text-slate-500" />
            <span className="font-mono text-sm font-bold text-white">No plugins matched your search</span>
            <span className="text-xs text-slate-500">Try a different query or select All Sources</span>
          </div>
        ) : (
          plugins.map((plugin) => {
            const directUrl = getDirectUrl(plugin);
            return (
              <div
                key={`${plugin.source}-${plugin.id}`}
                className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 hover:bg-white/[0.02] transition-colors"
              >
                {/* Left Side: Icon + Details */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Plugin Avatar/Box */}
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                    {plugin.icon ? (
                      <img
                        src={plugin.icon}
                        alt={plugin.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : plugin.customIconType === "potion" || plugin.name.toLowerCase().includes("essentials") ? (
                      /* Red Potion Icon from screenshot */
                      <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-500">
                        <Flame className="w-4 h-4" />
                      </div>
                    ) : (
                      <Puzzle className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Middle Content */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-white font-mono truncate">
                        {plugin.name}
                      </h3>
                      {/* Source Badge Pill */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-zinc-900 border border-white/10 text-slate-300">
                        {plugin.source === "modrinth" && <Box className="w-3 h-3 text-emerald-400" />}
                        {plugin.source === "hangar" && <Cpu className="w-3 h-3 text-blue-400" />}
                        {plugin.source === "spigot" && <Server className="w-3 h-3 text-orange-400" />}
                        {plugin.source === "bukkit" && <Archive className="w-3 h-3 text-amber-400" />}
                        {plugin.sourceLabel}
                      </span>
                    </div>

                    {/* Tag / Description */}
                    <p className="text-xs text-slate-300 font-mono line-clamp-2 leading-relaxed">
                      {plugin.tag}
                    </p>

                    {/* Metadata Row: Supports, Downloads, Author, Details */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Supports:</span>
                        {plugin.supports.map((sup) => (
                          <span
                            key={sup}
                            className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px] font-bold text-slate-300"
                          >
                            {sup}
                          </span>
                        ))}
                      </div>

                      {plugin.downloads > 0 && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Download className="w-3 h-3 text-slate-400" />
                          {plugin.downloads.toLocaleString()}
                        </span>
                      )}

                      <span>by {plugin.author}</span>

                      {directUrl && (
                        <a
                          href={directUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-theme-400 hover:text-theme-300 transition-colors inline-flex items-center gap-0.5 font-bold"
                        >
                          Details ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side: Install Button (Exact Screenshot Style) */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => handleInstall(plugin)}
                    disabled={isInstalling !== null}
                    className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-white/10 hover:border-white/20 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50"
                  >
                    {isInstalling === plugin.id ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-theme-400" />
                        <span>Installing...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>Install</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Compatibility Banner (Exact Text from User Prompt) */}
      <div className="p-5 bg-gradient-to-r from-theme-950/40 via-zinc-950 to-zinc-900/60 border border-white/10 rounded-3xl space-y-2">
        <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
          <Layers className="w-4 h-4 text-theme-400" />
          Paper, Bukkit & Spigot Compatibility
        </h4>
        <p className="text-xs text-slate-300 font-mono leading-relaxed">
          All PaperMC, Bukkit, CraftBukkit, Spigot and Purpur servers run standard <code className="text-theme-400 font-mono font-bold">.jar</code> plugins located inside the <code className="text-theme-400 font-mono font-bold">/plugins</code> directory. Installed plugins will automatically load when you start or restart your server.
        </p>
      </div>

      {isInstalling !== null && (
        <LoadingOverlay
          message="Installing Plugin..."
          subMessage="Downloading plugin JAR and verifying server compatibility..."
        />
      )}
    </div>
  );
}
