import React, { useEffect, useState } from "react";
import { LoadingOverlay } from "../components/LoadingOverlay";
import axios from "axios";
import SearchQueueBar from "./SearchQueueBar";
import PluginPackView, { PluginPackItem } from "./PluginPackView";
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
  Sparkles,
  Package,
  Upload,
  Eye,
  EyeOff,
  PanelLeft,
  PanelLeftClose,
  X,
  Plus,
  FolderArchive,
  Save,
  Pencil,
  Trash2,
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

const CURATED_ESSENTIALS: PluginItem[] = [
  {
    id: "essentialsx",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "EssentialsX",
    tag: "The essential plugin suite for Spigot and Paper servers, providing over 100 commands for player management, homes, warps, kits, economy, and server administration.",
    downloads: 14200000,
    author: "EssentialsX Team",
    supports: ["PaperMC", "Spigot", "Purpur", "Bukkit"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "worldedit",
    source: "bukkit",
    sourceLabel: "BukkitDev",
    name: "WorldEdit",
    tag: "In-game Minecraft map editor and terraforming tool. Quickly build, copy, paste, create geometric shapes, brushes, and manipulate millions of blocks in seconds.",
    downloads: 38900000,
    author: "EngineHub",
    supports: ["PaperMC", "Spigot", "Purpur", "Folia", "Bukkit"],
    icon: "https://media.forgecdn.net/avatars/61/805/636163385750058988.png",
  },
  {
    id: "luckperms",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "LuckPerms",
    tag: "An advanced permissions plugin for Minecraft servers. High performance, web editor UI, database sync, inheritance tree, and extensive API for server networks.",
    downloads: 7800000,
    author: "Luck",
    supports: ["PaperMC", "Purpur", "Spigot", "Folia", "Velocity"],
    icon: "https://cdn.modrinth.com/data/Vebnzrzj/icon.png",
  },
  {
    id: "vault",
    source: "bukkit",
    sourceLabel: "BukkitDev",
    name: "Vault",
    tag: "A Permissions, Chat, and Economy API to give plugins easy hooks into economy systems and permission managers without requiring direct dependencies.",
    downloads: 41200000,
    author: "Sleaker",
    supports: ["PaperMC", "Spigot", "CraftBukkit"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "coreprotect",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "CoreProtect",
    tag: "Fast, efficient, block logging and anti-griefing rollback tool. Inspect container transactions, block placements, roll back griefers, and restore terrain instantly.",
    downloads: 6500000,
    author: "Intelli",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "geyser-spigot",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "Geyser-Spigot",
    tag: "Enables Minecraft Bedrock Edition players (mobile, console, Windows 10) to connect and play on your Java Edition server with seamless packet translation.",
    downloads: 4100000,
    author: "GeyserMC",
    supports: ["PaperMC", "Spigot", "Purpur", "Folia"],
    icon: "https://cdn.modrinth.com/data/w0itDdHh/icon.png",
  },
  {
    id: "floodgate",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "Floodgate",
    tag: "Companion plugin for Geyser allowing Bedrock clients to join without needing an official Java Edition Minecraft account, preserving unique Bedrock UUIDs.",
    downloads: 2900000,
    author: "GeyserMC",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: "https://cdn.modrinth.com/data/bWrNNfkb/icon.png",
  },
  {
    id: "chunky",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "Chunky",
    tag: "Pre-generates chunks rapidly to eliminate exploration lag and reduce server tick drops when players explore uncharted terrain in your Minecraft world.",
    downloads: 3200000,
    author: "pop4959",
    supports: ["PaperMC", "Spigot", "Purpur", "Folia"],
    icon: "https://cdn.modrinth.com/data/fALzjamp/icon.png",
  },
  {
    id: "viaversion",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "ViaVersion",
    tag: "Allows newer Minecraft client versions to connect to older server versions seamlessly without modifying game protocols or breaking vanilla packet compatibility.",
    downloads: 12100000,
    author: "Formally",
    supports: ["PaperMC", "Spigot", "Purpur", "BungeeCord"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "viabackwards",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "ViaBackwards",
    tag: "Allows older Minecraft client versions to connect to newer server versions alongside ViaVersion for total cross-version client connectivity.",
    downloads: 7300000,
    author: "Formally",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "multiverse-core",
    source: "bukkit",
    sourceLabel: "BukkitDev",
    name: "Multiverse-Core",
    tag: "The original world management solution for Bukkit servers. Easily create, import, delete, and teleport between multiple worlds, Nether, and End dimensions.",
    downloads: 18500000,
    author: "Multiverse Team",
    supports: ["PaperMC", "Spigot", "CraftBukkit"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "authmereloaded",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "AuthMeReloaded",
    tag: "Comprehensive authentication system preventing unregistered visitors or unauthorized logins on cracked or hybrid servers with password hashing and session guards.",
    downloads: 4800000,
    author: "AuthMe-Team",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "clearlag",
    source: "bukkit",
    sourceLabel: "BukkitDev",
    name: "ClearLag",
    tag: "Utility plugin designed to optimize tick rates by reducing entity lag, clearing ground items, managing mob limits, and tracking TPS spikes dynamically.",
    downloads: 9400000,
    author: "bobacadodl",
    supports: ["PaperMC", "Spigot", "Bukkit"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "decentholograms",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "DecentHolograms",
    tag: "Lightweight, ultra-fast hologram display plugin supporting clickable lines, animations, item displays, pages, and PlaceholderAPI integrations.",
    downloads: 2200000,
    author: "DecentSoftware",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "placeholderapi",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "PlaceholderAPI",
    tag: "High performance string replacement library supporting thousands of placeholders across plugins for scoreboards, chat, tablists, and menus.",
    downloads: 16800000,
    author: "HelpChat",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "citizens",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "Citizens2",
    tag: "The definitive NPC creation plugin. Create living, walking, interacting NPCs, shopkeepers, quest givers, and guards in your Minecraft world.",
    downloads: 5100000,
    author: "fullwall",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "griefprevention",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "GriefPrevention",
    tag: "Self-service claim plugin preventing all forms of griefing. Players claim land using golden shovels with chest and container protections built-in.",
    downloads: 8200000,
    author: "RoboMWM",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "spark",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "spark",
    tag: "A performance profiling plugin and mod for Minecraft servers, clients, and proxies. Inspect CPU usage, memory leaks, and tick rate bottlenecks.",
    downloads: 19500000,
    author: "Luck",
    supports: ["PaperMC", "Purpur", "Spigot", "Folia", "Fabric"],
    icon: "https://cdn.modrinth.com/data/l6YH9Als/icon.png",
  },
  {
    id: "skinsrestorer",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "SkinsRestorer",
    tag: "Restores custom skins for offline-mode (cracked) servers and gives online-mode players the ability to customize their skins with easy in-game commands.",
    downloads: 3600000,
    author: "SkinsRestorer",
    supports: ["PaperMC", "Spigot", "Purpur", "BungeeCord"],
    icon: "https://cdn.modrinth.com/data/MYyq4k5r/icon.png",
  },
  {
    id: "chunkyborder",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "ChunkyBorder",
    tag: "Addon for Chunky to set world borders, map boundaries, and keep players within pre-generated world regions with customizable border effects.",
    downloads: 1200000,
    author: "pop4959",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: "https://cdn.modrinth.com/data/A2N9tK0w/icon.png",
  },
  {
    id: "tab-bridge",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "TAB",
    tag: "An all-in-one player list (TAB), nametag, bossbar, scoreboard, and ping display plugin with RGB colors, animations, and high performance.",
    downloads: 4300000,
    author: "NEZNAMY",
    supports: ["PaperMC", "Spigot", "Purpur", "Velocity"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "protocollib",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "ProtocolLib",
    tag: "Provides read and write access to the Minecraft protocol, used by hundreds of plugins for packet manipulation, custom entity displays, and security.",
    downloads: 19800000,
    author: "dmulloy2",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: null,
    customIconType: "potion",
  },
  {
    id: "fastasyncworldedit",
    source: "modrinth",
    sourceLabel: "Modrinth",
    name: "FastAsyncWorldEdit (FAWE)",
    tag: "Blazing fast WorldEdit built for asynchronous editing to eliminate block placing lag on high-traffic or large creative builds.",
    downloads: 2400000,
    author: "IntellectualSites",
    supports: ["PaperMC", "Purpur", "Folia"],
    icon: "https://cdn.modrinth.com/data/1066qf8Y/icon.png",
  },
  {
    id: "discordsrv",
    source: "spigot",
    sourceLabel: "SpigotMC",
    name: "DiscordSRV",
    tag: "The most powerful Minecraft-to-Discord bridge plugin. Connects in-game chat to Discord channels, voice chat, console logs, and role sync.",
    downloads: 2800000,
    author: "Scarsz",
    supports: ["PaperMC", "Spigot", "Purpur"],
    icon: null,
    customIconType: "potion",
  },
];

interface PluginManagerProps {
  serverId: string;
}

export default function PluginManager({ serverId }: PluginManagerProps) {
  const [plugins, setPlugins] = useState<PluginItem[]>(CURATED_ESSENTIALS);
  const [loading, setLoading] = useState(false);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeSource, setActiveSource] = useState<"all" | "hangar" | "bukkit" | "spigot" | "modrinth">("all");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error"; externalLink?: string } | null>(null);
  const [lastInstalledName, setLastInstalledName] = useState<string | null>(null);

  // Plugin Packs view state (requested by user)
  const [isPackViewOpen, setIsPackViewOpen] = useState(false);

  // Popular essentials cover collapse state (requested by user: "popular plugins ha wo upr ho or o sa hid kar na ka options ho conver ma ho")
  const [isPopularCoverHidden, setIsPopularCoverHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem("jtg_hide_popular_cover") === "true";
    } catch {
      return false;
    }
  });

  // Dedicated side queue panel toggle state ("auto search bar alg chay ha side ma")
  const [isSideQueueOpen, setIsSideQueueOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("jtg_plugins_side_queue");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  // Installed plugins tracking
  const [installedPluginNames, setInstalledPluginNames] = useState<string[]>([]);

  // Direct ZIP upload modal state from header
  const [isQuickZipModalOpen, setIsQuickZipModalOpen] = useState(false);
  const [quickZipFile, setQuickZipFile] = useState<File | null>(null);
  const [isUploadingQuickZip, setIsUploadingQuickZip] = useState(false);

  // Active Pack Editing in Plugin Manager state (Requested by user:
  // "ham plugins peck editt kar to munel plugins install kar sa ka or ja plugins options ha wo as ka name ha ja or plugins per install kar jab save kar a to plugins manger normal ho ja jo file manger ka nechy ha")
  const [editingPack, setEditingPack] = useState<PluginPackItem | null>(null);
  const [isSavingPack, setIsSavingPack] = useState(false);
  const [isEditingPackMeta, setIsEditingPackMeta] = useState(false);
  const [editPackName, setEditPackName] = useState("");
  const [editPackDesc, setEditPackDesc] = useState("");
  const [editPackPicture, setEditPackPicture] = useState("");

  // Fetch installed plugins from backend
  const fetchInstalledPlugins = async () => {
    try {
      const res = await axios.get(`/api/servers/${serverId}/installed-packages`);
      if (Array.isArray(res.data)) {
        setInstalledPluginNames(res.data.map((p: any) => p.name || p));
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchInstalledPlugins();
  }, [serverId, lastInstalledName]);

  const togglePopularCover = () => {
    setIsPopularCoverHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("jtg_hide_popular_cover", String(next));
      } catch {}
      return next;
    });
  };

  const toggleSideQueue = () => {
    setIsSideQueueOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("jtg_plugins_side_queue", String(next));
      } catch {}
      return next;
    });
  };

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

      // Filter curated essentials
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
                      supports: hit.categories
                        ?.filter((c: string) => ["bukkit", "spigot", "paper", "purpur", "folia"].includes(c.toLowerCase()))
                        .map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)) || ["Bukkit", "PaperMC", "Spigot"],
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
                res.data.result.forEach((p: any) => {
                  const pid = p.name.toLowerCase();
                  if (!existingIds.has(pid)) {
                    existingIds.add(pid);
                    results.push({
                      id: p.name,
                      source: "hangar",
                      sourceLabel: "PaperMC Hangar",
                      name: p.name,
                      tag: p.description || "Official PaperMC ecosystem plugin repository",
                      downloads: p.stats?.downloads || 0,
                      author: p.namespace?.owner || "Paper Community",
                      supports: ["PaperMC", "Folia", "Velocity"],
                      icon: p.avatarUrl || null,
                    });
                  }
                });
              }
            })
            .catch(() => {})
        );
      }

      // SpigotMC / Bukkit query fallback
      if (activeSource === "all" || activeSource === "spigot" || activeSource === "bukkit") {
        promises.push(
          externalAxios
            .get(
              `https://api.spiget.org/v2/search/resources/${encodeURIComponent(q || "essentials")}?size=15&sort=-downloads`,
              { timeout: 5000 }
            )
            .then((res) => {
              if (Array.isArray(res.data)) {
                res.data.forEach((item: any) => {
                  const pid = String(item.id);
                  if (!existingIds.has(pid) && !existingIds.has(item.name.toLowerCase())) {
                    existingIds.add(pid);
                    results.push({
                      id: pid,
                      source: "spigot",
                      sourceLabel: "SpigotMC",
                      name: item.name,
                      tag: item.tag || "SpigotMC resource",
                      downloads: item.downloads || 0,
                      author: "Spigot Author",
                      supports: item.testedVersions || ["Spigot", "PaperMC"],
                      icon: item.icon?.url ? `https://www.spigotmc.org/${item.icon.url}` : null,
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

  const handleClearQuery = () => {
    setQuery("");
    searchPlugins("");
  };

  const handleStartEditPackInManager = (pack: PluginPackItem) => {
    setEditingPack(pack);
    setEditPackName(pack.name);
    setEditPackDesc(pack.description || "");
    setEditPackPicture(pack.picture || "");
    setIsPackViewOpen(false); // Return to Plugin Manager under File Manager
    setStatusMsg({
      text: `Ab aap pack "${pack.name}" edit kar rahe hain. Niche manual plugins browse karein aur "+ Add to Pack" ya "Install" dabayein. Kaam poora hone par "Save Pack" dabayein.`,
      type: "success",
    });
  };

  const handleAddPluginToEditingPack = (plugin: PluginItem, showToast = true) => {
    if (!editingPack) return;
    const currentName = editPackName.trim() || editingPack.name;
    const alreadyIn = editingPack.plugins.some(
      (p) =>
        p.name.toLowerCase() === plugin.name.toLowerCase() ||
        (p.id && plugin.id && p.id.toLowerCase() === plugin.id.toLowerCase())
    );
    if (alreadyIn) {
      if (showToast) {
        setStatusMsg({
          text: `"${plugin.name}" pehle se pack "${currentName}" me shamil hai.`,
          type: "success",
        });
      }
      return;
    }

    const updatedPlugins = [
      ...editingPack.plugins,
      { name: plugin.name, source: plugin.source, id: plugin.id },
    ];

    setEditingPack({
      ...editingPack,
      plugins: updatedPlugins,
    });

    if (showToast) {
      setStatusMsg({
        text: `✓ "${plugin.name}" ko pack "${currentName}" me add kar diya gaya! (${updatedPlugins.length} plugins in pack). Kaam poora hone par "Save Pack" dabayein.`,
        type: "success",
      });
    }
  };

  const handleRemovePluginFromEditingPack = (pluginName: string) => {
    if (!editingPack) return;
    const currentName = editPackName.trim() || editingPack.name;
    const updatedPlugins = editingPack.plugins.filter(
      (p) => p.name.toLowerCase() !== pluginName.toLowerCase()
    );
    setEditingPack({
      ...editingPack,
      plugins: updatedPlugins,
    });
    setStatusMsg({
      text: `"${pluginName}" ko pack "${currentName}" se hata diya gaya (${updatedPlugins.length} plugins remaining).`,
      type: "success",
    });
  };

  const handleSavePackFromManager = async () => {
    if (!editingPack) return;
    try {
      setIsSavingPack(true);
      setStatusMsg(null);
      const finalName = editPackName.trim() || editingPack.name;
      await axios.put(`/api/servers/${serverId}/plugins/packs/${editingPack.id}`, {
        name: finalName,
        description: editPackDesc,
        picture: editPackPicture || editingPack.picture,
        plugins: editingPack.plugins,
        visibility: editingPack.visibility || (editingPack.isPrivate ? "private" : "public"),
        isPrivate: editingPack.isPrivate,
      });

      const count = editingPack.plugins.length;

      // Reset editing pack -> returns Plugin Manager back to normal view!
      setEditingPack(null);
      setIsEditingPackMeta(false);

      setStatusMsg({
        text: `Plugin Pack "${finalName}" successfully save ho gaya (${count} plugins). Plugin Manager ab normal ho gaya hai!`,
        type: "success",
      });
    } catch (err: any) {
      setStatusMsg({
        text: err.response?.data?.error || "Failed to save plugin pack.",
        type: "error",
      });
    } finally {
      setIsSavingPack(false);
    }
  };

  const handleCancelEditPack = () => {
    setEditingPack(null);
    setIsEditingPackMeta(false);
    setStatusMsg({
      text: "Pack editing cancel kar di gayi. Plugin Manager normal view me wapas aa gaya.",
      type: "success",
    });
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

      // If currently editing a pack, automatically add this installed plugin to the pack!
      if (editingPack) {
        handleAddPluginToEditingPack(plugin, false);
      }

      const currentPackName = editingPack ? (editPackName.trim() || editingPack.name) : null;

      setStatusMsg({
        text: currentPackName
          ? `✓ ${plugin.name} successfully installed into /plugins and added to pack "${currentPackName}"! Kaam poora hone par "Save Pack" dabayein.`
          : res.data?.message || `${plugin.name} installed successfully into /plugins! Restart your server to load it.`,
        type: "success",
      });
      setLastInstalledName(plugin.name);
      setInstalledPluginNames((prev) => [...prev, plugin.name]);
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

  const handleQuickUploadZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickZipFile) return;

    setIsUploadingQuickZip(true);
    setStatusMsg(null);

    const formData = new FormData();
    formData.append("file", quickZipFile);

    try {
      const res = await axios.post(`/api/servers/${serverId}/plugins/upload-zip`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatusMsg({
        text: res.data?.message || "ZIP file extracted and plugins installed successfully!",
        type: "success",
      });
      setQuickZipFile(null);
      setIsQuickZipModalOpen(false);
      fetchInstalledPlugins();
    } catch (err: any) {
      setStatusMsg({
        text: err.response?.data?.error || "Failed to upload and extract plugins ZIP file",
        type: "error",
      });
    } finally {
      setIsUploadingQuickZip(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8 text-foreground bg-transparent w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
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
              className="text-xs opacity-70 hover:opacity-100 ml-3 font-mono font-bold px-2 py-1 bg-black/40 rounded-lg cursor-pointer"
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
              <span className="text-xs text-muted-foreground">
                After downloading, upload it into the <strong className="text-foreground">/plugins</strong> folder in File Manager.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Mode Toggle: Plugins Browser vs Plugin Packs System */}
      {isPackViewOpen ? (
        <PluginPackView
          serverId={serverId}
          onBackToPlugins={() => setIsPackViewOpen(false)}
          onPluginInstalled={(pluginName) => {
            setLastInstalledName(pluginName);
            setInstalledPluginNames((prev) => [...prev, pluginName]);
          }}
          installedPluginNames={installedPluginNames}
          onStartEditInManager={handleStartEditPackInManager}
        />
      ) : (
        <>
          {/* Header Section */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {editingPack ? (
              <div>
                <div className="flex items-center gap-3">
                  {editPackPicture || editingPack.picture ? (
                    <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-theme-500/40 shadow-md shrink-0">
                      <img
                        src={editPackPicture || editingPack.picture}
                        alt={editPackName || editingPack.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-theme-500/15 border-2 border-theme-500/40 flex items-center justify-center text-theme-500 shrink-0 shadow-md">
                      <Package className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wide">
                        Editing Pack Mode
                      </span>
                      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono flex items-center gap-2">
                        <span>{editPackName || editingPack.name}</span>
                        <button
                          onClick={() => setIsEditingPackMeta(!isEditingPackMeta)}
                          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-theme-500 cursor-pointer transition-colors"
                          title="Rename pack or edit photo"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </h1>
                    </div>
                    <p className="text-[11px] sm:text-xs font-mono text-muted-foreground mt-0.5">
                      Manual plugins browse karein aur pack me install karein. Kaam poora hone par &quot;Save Pack&quot; dabayein.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-theme-500/10 border border-theme-500/20 flex items-center justify-center text-theme-500 shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono">
                    Paper & Bukkit Plugin Manager
                  </h1>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] sm:text-xs font-mono font-bold tracking-wider text-muted-foreground uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-theme-500" />
                  <span>DIRECT INTEGRATION WITH PAPERMC HANGAR, BUKKITDEV, SPIGOTMC & MODRINTH</span>
                </div>
              </div>
            )}

            {/* Quick Actions at Top: Plugin Packs, Side Queue Toggle, Refresh */}
            <div className="flex items-center gap-2 flex-wrap">
              {editingPack ? (
                <>
                  <button
                    onClick={handleCancelEditPack}
                    className="px-3.5 py-2 bg-muted hover:bg-muted-hover border border-border text-foreground rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePackFromManager}
                    disabled={isSavingPack}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-mono font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer disabled:opacity-60"
                    title="Save changes to this plugin pack and return Plugin Manager to normal view"
                  >
                    {isSavingPack ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Save Pack ({editingPack.plugins.length})</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Plugin Packs System Button (High Visibility) */}
                  <button
                    onClick={() => setIsPackViewOpen(true)}
                    className="px-3.5 py-2 bg-gradient-to-r from-theme-500 to-theme-600 hover:from-theme-600 hover:to-theme-700 text-white rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer ring-1 ring-white/20"
                    title="Open Plugin Packs (Modpack Style) Shelf & Creator"
                  >
                    <Package className="w-4 h-4" />
                    <span>Plugin Packs</span>
                  </button>

                  {/* Upload ZIP button */}
                  <button
                    onClick={() => setIsQuickZipModalOpen(true)}
                    className="px-3 py-2 bg-card border border-border hover:bg-muted text-foreground rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                    title="Upload ZIP file containing plugins from your PC"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-500" />
                    <span className="hidden sm:inline">Upload ZIP</span>
                  </button>
                </>
              )}

              {/* Toggle Side Queue Button */}
              <button
                onClick={toggleSideQueue}
                className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                  isSideQueueOpen
                    ? "bg-muted border-border text-foreground"
                    : "bg-theme-500/15 border-theme-500/30 text-theme-600 dark:text-theme-400"
                }`}
                title={isSideQueueOpen ? "Hide Side Queue" : "Show Side Queue"}
              >
                {isSideQueueOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isSideQueueOpen ? "Side Queue" : "Open Queue"}</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => searchPlugins(query)}
                className="px-3.5 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 shadow-sm shrink-0 active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-theme-500" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Active Pack Sticky / Floating Edit Banner */}
          {editingPack && (
            <div className="p-4 sm:p-5 rounded-3xl bg-card border-2 border-theme-500/40 shadow-xl shadow-theme-500/10 space-y-3 animate-in fade-in slide-in-from-top-2">
              {/* Optional Quick Metadata Edit Inline */}
              {isEditingPackMeta && (
                <div className="p-3.5 bg-muted/60 border border-border rounded-2xl space-y-2 mb-2">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-foreground">
                    <span>Edit Pack Name & Cover Picture:</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingPackMeta(false)}
                      className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground block mb-0.5">Pack Name</label>
                      <input
                        type="text"
                        value={editPackName}
                        onChange={(e) => setEditPackName(e.target.value)}
                        placeholder="Pack Name..."
                        className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none focus:border-theme-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-muted-foreground block mb-0.5">Cover Image URL</label>
                      <input
                        type="text"
                        value={editPackPicture}
                        onChange={(e) => setEditPackPicture(e.target.value)}
                        placeholder="Image URL..."
                        className="w-full bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none focus:border-theme-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-theme-500/20 border border-theme-500/40 flex items-center justify-center text-theme-500 shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono text-foreground truncate">
                        {editPackName || editingPack.name}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-theme-500/20 text-theme-600 dark:text-theme-400 font-bold shrink-0">
                        {editingPack.plugins.length} Plugins
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Niche kisi bhi plugin par <strong className="text-theme-500">&quot;+ Add to Pack&quot;</strong> ya <strong className="text-theme-500">&quot;Install&quot;</strong> dabayein. Kaam poora hone par &quot;Save Pack&quot; dabayein.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCancelEditPack}
                    className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted-hover border border-border text-foreground text-xs font-mono font-semibold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePackFromManager}
                    disabled={isSavingPack}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60"
                  >
                    {isSavingPack ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save Pack</span>
                  </button>
                </div>
              </div>

              {/* Live Plugin Chips in Pack */}
              <div className="pt-2 border-t border-border flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
                <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase mr-1">
                  Pack Plugins:
                </span>
                {editingPack.plugins.length === 0 ? (
                  <span className="text-xs font-mono text-muted-foreground italic">
                    Abhi koi plugin nahi hai. Niche list se add karein.
                  </span>
                ) : (
                  editingPack.plugins.map((p, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono bg-muted border border-border text-foreground group"
                    >
                      <Puzzle className="w-3 h-3 text-theme-500" />
                      <span className="font-semibold">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePluginFromEditingPack(p.name)}
                        className="text-muted-foreground hover:text-rose-500 cursor-pointer p-0.5 rounded transition-colors"
                        title={`Remove ${p.name} from pack`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              POPULAR PLUGINS COVER BANNER ("conver ma ho" with Hide/Show Option)
              "or jo popular plugins ha wo upr ho or o sa hid kar na ka options ho conver ma ho 
              or ak conver ma bukil sid ma ak options ho palugins peck jes modpeck ho ta a ws sa ham pluginspeck ban sa ka"
          ----------------------------------------------------- */}
          {isPopularCoverHidden ? (
            /* Collapsed / Hidden State */
            <div className="bg-card/70 border border-border rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold font-mono text-foreground">
                    Popular Paper & Bukkit Essentials Cover
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-2">
                    (Hidden - Click to Expand)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPackViewOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted-hover border border-border text-foreground text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5 text-theme-500" />
                  <span>Plugin Packs</span>
                </button>

                <button
                  onClick={togglePopularCover}
                  className="px-3 py-1.5 rounded-xl bg-theme-500/15 hover:bg-theme-500/25 border border-theme-500/30 text-theme-600 dark:text-theme-400 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Show Cover</span>
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Cover Banner */
            <div className="relative isolate overflow-hidden bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xl transition-all space-y-4">
              {/* Background gradient decorative texture */}
              <div className="absolute inset-0 bg-gradient-to-r from-theme-500/10 via-emerald-500/5 to-transparent pointer-events-none" />
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-theme-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Cover Banner Top Row: Title + Right Side Options (Plugin Packs + Hide Toggle) */}
              <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-mono font-bold text-foreground uppercase tracking-wider">
                  <Flame className="w-4 h-4 text-theme-500" />
                  <span>POPULAR PAPER & BUKKIT ESSENTIALS</span>
                  <span className="text-[11px] text-muted-foreground font-normal normal-case ml-1">
                    (Click any to search instantly)
                  </span>
                </div>

                {/* Right side options inside the cover ("bukil sid ma ak options ho palugins peck") */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Plugin Packs Button inside cover banner */}
                  <button
                    onClick={() => setIsPackViewOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-theme-500 hover:bg-theme-600 text-white text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    title="Open Plugin Packs (Modpack Style) creator & library"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Plugin Packs (Modpack Style)</span>
                  </button>

                  {/* Upload ZIP from PC button */}
                  <button
                    onClick={() => setIsQuickZipModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="Upload local ZIP file"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    <span className="hidden sm:inline">Upload ZIP</span>
                  </button>

                  {/* Hide Cover Button ("o sa hid kar na ka options ho") */}
                  <button
                    onClick={togglePopularCover}
                    className="px-3 py-1.5 rounded-xl bg-muted border border-border hover:bg-muted-hover text-muted-foreground hover:text-foreground text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Hide this popular plugins cover banner"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Cover</span>
                  </button>
                </div>
              </div>

              {/* Popular Essentials Pills */}
              <div className="flex flex-wrap gap-2 pt-1 relative z-10">
                {[
                  "EssentialsX",
                  "WorldEdit",
                  "LuckPerms",
                  "Vault",
                  "CoreProtect",
                  "Geyser-Spigot",
                  "Floodgate",
                  "Chunky",
                  "ViaVersion",
                  "ViaBackwards",
                  "Multiverse-Core",
                  "AuthMeReloaded",
                  "ClearLag",
                  "DecentHolograms",
                  "PlaceholderAPI",
                  "Citizens",
                  "GriefPrevention",
                  "spark",
                  "SkinsRestorer",
                  "TAB",
                  "ProtocolLib",
                  "FastAsyncWorldEdit",
                  "DiscordSRV",
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handlePillClick(tag)}
                    className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted-hover text-foreground border border-border hover:border-theme-500/50 text-xs font-mono transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              MAIN LAYOUT: SIDE AUTO SEARCH BAR + MIDDLE SEARCH BAR
              "mo ja auto search bar alg chay ha side ma or main jo secrch bar ha 
               jes ma ham kod lik ta ha per delet kar ka dobar lik ta ha wo bich ma alg chay ha sab ma"
          ----------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* SIDE COLUMN: AUTO SEARCH QUEUE ("auto search bar alg chay ha side ma") */}
            {isSideQueueOpen && (
              <div className="lg:col-span-4 xl:col-span-4 transition-all">
                <SearchQueueBar
                  storageKey={`plugins_${serverId}`}
                  title="Plugins Auto Search"
                  itemTypeLabel="plugin"
                  layout="sidebar"
                  onSearchItem={(term) => {
                    setQuery(term);
                    searchPlugins(term);
                  }}
                  currentQuery={query}
                  lastInstalledName={lastInstalledName}
                  onToggleCollapse={toggleSideQueue}
                />
              </div>
            )}

            {/* MIDDLE / CENTER COLUMN: MAIN SEARCH BAR & SEARCH RESULTS
                "main jo secrch bar ha jes ma ham kod lik ta ha per delet kar ka dobar lik ta ha wo bich ma alg chay ha sab ma" */}
            <div className={`${isSideQueueOpen ? "lg:col-span-8 xl:col-span-8" : "lg:col-span-12"} space-y-5 transition-all`}>
              {/* MAIN DEDICATED SEARCH BAR CARD IN THE MIDDLE */}
              <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                {/* Header of Search Card */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-foreground uppercase tracking-wider">
                    <Search className="w-4 h-4 text-theme-500" />
                    <span>Search Repositories (PaperMC, Bukkit, Spigot, Modrinth)</span>
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

                {/* The Input with Clear ('X') button so user can delete & re-write easily */}
                <form onSubmit={handleSearch} className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search plugins... (e.g. EssentialsX, WorldEdit, Geyser, Economy)"
                      className="w-full bg-muted border border-border focus:border-theme-500 focus:ring-1 focus:ring-theme-500 rounded-2xl py-3 pl-11 pr-10 text-xs sm:text-sm text-foreground font-mono placeholder:text-muted-foreground outline-none transition-all shadow-inner"
                    />
                    {/* Clear / Delete Button (Allows user to delete typed text and re-write) */}
                    {query && (
                      <button
                        type="button"
                        onClick={handleClearQuery}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted-hover transition-colors cursor-pointer"
                        title="Clear search text"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-3 bg-theme-500 hover:bg-theme-600 text-white rounded-2xl text-xs sm:text-sm font-mono font-bold transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                  >
                    Search
                  </button>
                </form>

                {/* Source Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                  <button
                    onClick={() => setActiveSource("all")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      activeSource === "all"
                        ? "bg-theme-500 text-white border-theme-400 shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    All Sources
                  </button>

                  <button
                    onClick={() => setActiveSource("hangar")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      activeSource === "hangar"
                        ? "bg-theme-500 text-white border-theme-400 shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5 text-blue-400" /> PaperMC Hangar
                  </button>

                  <button
                    onClick={() => setActiveSource("bukkit")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      activeSource === "bukkit"
                        ? "bg-theme-500 text-white border-theme-400 shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-400" /> BukkitDev
                  </button>

                  <button
                    onClick={() => setActiveSource("spigot")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      activeSource === "spigot"
                        ? "bg-theme-500 text-white border-theme-400 shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    <Server className="w-3.5 h-3.5 text-orange-400" /> SpigotMC
                  </button>

                  <button
                    onClick={() => setActiveSource("modrinth")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      activeSource === "modrinth"
                        ? "bg-theme-500 text-white border-theme-400 shadow-sm"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    <Box className="w-3.5 h-3.5 text-emerald-400" /> Modrinth
                  </button>
                </div>
              </div>

              {/* Plugins List Results */}
              <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl divide-y divide-border">
                {loading ? (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 font-mono">
                    <RefreshCw className="w-6 h-6 animate-spin text-theme-500" />
                    <span>Searching PaperMC Hangar, Bukkit, Spigot & Modrinth repositories...</span>
                  </div>
                ) : plugins.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                    <Puzzle className="w-8 h-8 text-muted-foreground/60" />
                    <span className="font-mono text-sm font-bold text-foreground">No plugins matched your search</span>
                    <span className="text-xs text-muted-foreground">Try a different query or select All Sources</span>
                  </div>
                ) : (
                  plugins.map((plugin) => {
                    const directUrl = getDirectUrl(plugin);
                    const isAlreadyInstalled = installedPluginNames.some((name) =>
                      name.toLowerCase().includes(plugin.name.toLowerCase())
                    );
                    const isInEditingPack = editingPack
                      ? editingPack.plugins.some(
                          (p) =>
                            p.name.toLowerCase() === plugin.name.toLowerCase() ||
                            (p.id && plugin.id && p.id.toLowerCase() === plugin.id.toLowerCase())
                        )
                      : false;

                    return (
                      <div
                        key={`${plugin.source}-${plugin.id}`}
                        className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 hover:bg-muted/40 transition-colors"
                      >
                        {/* Left Side: Icon + Details */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Plugin Avatar/Box */}
                          <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                            {plugin.icon ? (
                              <img
                                src={plugin.icon}
                                alt={plugin.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : plugin.customIconType === "potion" || plugin.name.toLowerCase().includes("essentials") ? (
                              <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-500">
                                <Flame className="w-4 h-4" />
                              </div>
                            ) : (
                              <Puzzle className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>

                          {/* Middle Content */}
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="text-base sm:text-lg font-bold text-foreground font-mono truncate">
                                {plugin.name}
                              </h3>
                              {/* Source Badge Pill */}
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-muted border border-border text-foreground">
                                {plugin.source === "modrinth" && <Box className="w-3 h-3 text-emerald-500" />}
                                {plugin.source === "hangar" && <Cpu className="w-3 h-3 text-blue-500" />}
                                {plugin.source === "spigot" && <Server className="w-3 h-3 text-orange-500" />}
                                {plugin.source === "bukkit" && <Archive className="w-3 h-3 text-amber-500" />}
                                {plugin.sourceLabel}
                              </span>

                              {isAlreadyInstalled && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" /> Installed
                                </span>
                              )}

                              {editingPack && isInEditingPack && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  <Layers className="w-3 h-3 text-amber-500" /> In Pack
                                </span>
                              )}
                            </div>

                            {/* Tag / Description */}
                            <p className="text-xs text-muted-foreground font-mono line-clamp-2 leading-relaxed">
                              {plugin.tag}
                            </p>

                            {/* Metadata Row: Supports, Downloads, Author, Details */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] font-mono text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <span>Supports:</span>
                                {plugin.supports.map((sup) => (
                                  <span
                                    key={sup}
                                    className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-bold text-foreground"
                                  >
                                    {sup}
                                  </span>
                                ))}
                              </div>

                              {plugin.downloads > 0 && (
                                <span className="flex items-center gap-1 text-foreground">
                                  <Download className="w-3 h-3 text-muted-foreground" />
                                  {plugin.downloads.toLocaleString()}
                                </span>
                              )}

                              <span>by {plugin.author}</span>

                              {directUrl && (
                                <a
                                  href={directUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-theme-500 hover:text-theme-600 transition-colors inline-flex items-center gap-0.5 font-bold"
                                >
                                  Details ↗
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Pack Add/Remove Button & Install Button */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap">
                          {editingPack && (
                            <button
                              onClick={() => {
                                if (isInEditingPack) {
                                  handleRemovePluginFromEditingPack(plugin.name);
                                } else {
                                  handleAddPluginToEditingPack(plugin);
                                }
                              }}
                              className={`px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                                isInEditingPack
                                  ? "bg-amber-500/15 hover:bg-rose-500/20 text-amber-600 dark:text-amber-400 hover:text-rose-500 border border-amber-500/30 hover:border-rose-500/40"
                                  : "bg-theme-500 hover:bg-theme-600 text-white shadow-md shadow-theme-500/20 border border-theme-400/30"
                              }`}
                              title={
                                isInEditingPack
                                  ? `Click to remove ${plugin.name} from pack`
                                  : `Add ${plugin.name} to pack`
                              }
                            >
                              {isInEditingPack ? (
                                <>
                                  <X className="w-3.5 h-3.5" />
                                  <span>Remove from Pack</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Add to Pack</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => handleInstall(plugin)}
                            disabled={isInstalling !== null}
                            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all flex items-center gap-2 active:scale-95 shadow-sm disabled:opacity-50 cursor-pointer ${
                              isAlreadyInstalled
                                ? "bg-muted hover:bg-muted-hover text-foreground border border-border"
                                : "bg-theme-500 hover:bg-theme-600 text-white border border-theme-400/30"
                            }`}
                            title={
                              editingPack
                                ? `Install ${plugin.name} and add to pack`
                                : `Install ${plugin.name} on server`
                            }
                          >
                            {isInstalling === plugin.id ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Installing...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                <span>{isAlreadyInstalled ? "Re-Install" : "Install"}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Compatibility Banner */}
              <div className="p-5 bg-card border border-border rounded-3xl space-y-2 shadow-sm">
                <h4 className="text-sm font-bold text-foreground font-mono flex items-center gap-2">
                  <Layers className="w-4 h-4 text-theme-500" />
                  Paper, Bukkit & Spigot Compatibility
                </h4>
                <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                  All PaperMC, Bukkit, CraftBukkit, Spigot and Purpur servers run standard <code className="text-theme-500 font-mono font-bold">.jar</code> plugins located inside the <code className="text-theme-500 font-mono font-bold">/plugins</code> directory. Installed plugins will automatically load when you start or restart your server.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* QUICK ZIP UPLOAD MODAL */}
      {isQuickZipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500">
                  <FolderArchive className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold font-mono text-foreground">
                  Upload Plugins ZIP from PC
                </h3>
              </div>
              <button
                onClick={() => setIsQuickZipModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickUploadZip} className="space-y-4">
              <div className="border-2 border-dashed border-border hover:border-theme-500 rounded-2xl p-6 text-center transition-all bg-muted/30">
                <FolderArchive className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-60" />
                <p className="text-xs font-mono font-bold text-foreground mb-1">
                  {quickZipFile ? quickZipFile.name : "Select a .zip archive from your computer"}
                </p>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Apne computer se .zip file choose karein. Zip ke sabhi .jar plugins automatically /plugins folder me extract aur install ho jayenge.
                </p>
                <input
                  type="file"
                  accept=".zip,.tar,.gz"
                  id="plugin-zip-quick-input"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setQuickZipFile(e.target.files[0]);
                    }
                  }}
                />
                <label
                  htmlFor="plugin-zip-quick-input"
                  className="px-4 py-2 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground text-xs font-mono font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{quickZipFile ? "Choose Different File" : "Browse Computer Files (.zip)"}</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsQuickZipModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground text-xs font-mono font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!quickZipFile || isUploadingQuickZip}
                  className="px-5 py-2 rounded-xl bg-theme-500 hover:bg-theme-600 text-white font-mono font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploadingQuickZip ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting & Installing...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Upload & Install Plugins</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isInstalling !== null && (
        <LoadingOverlay
          message="Installing Plugin..."
          subMessage="Downloading plugin JAR and verifying server compatibility..."
        />
      )}
    </div>
  );
}
