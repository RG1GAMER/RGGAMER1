import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Package,
  Plus,
  Upload,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  Trash2,
  Sparkles,
  Layers,
  AlertCircle,
  ExternalLink,
  FolderArchive,
  Image,
  FileText,
  Info,
  ChevronRight,
  RefreshCw,
  Search,
  X,
  Pencil,
  Save,
  Edit3,
  Puzzle,
} from "lucide-react";

export interface PluginPackItem {
  id: string;
  name: string;
  description: string;
  picture: string;
  author: string;
  isPreset?: boolean;
  plugins: Array<{ name: string; source?: string; id?: string }>;
}

interface PluginPackViewProps {
  serverId: string;
  onBackToPlugins: () => void;
  onPluginInstalled?: (pluginName: string) => void;
  installedPluginNames?: string[];
  initialPackId?: string | null;
  onStartEditInManager?: (pack: PluginPackItem) => void;
}

const PRESET_PICTURES = [
  { label: "Survival Woods", url: "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600&auto=format&fit=crop&q=80" },
  { label: "Cyber Neon", url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80" },
  { label: "Golden Economy", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80" },
  { label: "Security Shield", url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80" },
  { label: "Multiplayer Hub", url: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80" },
  { label: "Fantasy Castle", url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80" }
];

export default function PluginPackView({
  serverId,
  onBackToPlugins,
  onPluginInstalled,
  installedPluginNames = [],
  initialPackId = null,
  onStartEditInManager,
}: PluginPackViewProps) {
  const [packs, setPacks] = useState<PluginPackItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activePack, setActivePack] = useState<PluginPackItem | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>("");
  
  // Create pack modal state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [newPackName, setNewPackName] = useState<string>("");
  const [newPackDesc, setNewPackDesc] = useState<string>("");
  const [newPackPicture, setNewPackPicture] = useState<string>(PRESET_PICTURES[0].url);
  const [newPackPluginsInput, setNewPackPluginsInput] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // ZIP upload modal state
  const [isZipModalOpen, setIsZipModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingZip, setIsUploadingZip] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Installing states
  const [installingPackId, setInstallingPackId] = useState<string | null>(null);
  const [installingSingle, setInstallingSingle] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Edit pack modal state
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editPackId, setEditPackId] = useState<string>("");
  const [editPackName, setEditPackName] = useState<string>("");
  const [editPackDesc, setEditPackDesc] = useState<string>("");
  const [editPackPicture, setEditPackPicture] = useState<string>("");
  const [editPackPlugins, setEditPackPlugins] = useState<Array<{ name: string; source?: string; id?: string }>>([]);
  const [editNewPluginInput, setEditNewPluginInput] = useState<string>("");
  const [editBulkPluginsInput, setEditBulkPluginsInput] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Active pack save & unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSavingActive, setIsSavingActive] = useState<boolean>(false);

  // Add plugin to active pack state
  const [addPluginInput, setAddPluginInput] = useState<string>("");

  const fetchPacks = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/servers/${serverId}/plugins/packs`);
      if (Array.isArray(res.data)) {
        setPacks(res.data);
        if (initialPackId) {
          const match = res.data.find((p: PluginPackItem) => p.id === initialPackId);
          if (match) setActivePack(match);
        }
      }
    } catch (err: any) {
      console.error("Failed to load plugin packs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacks();
  }, [serverId]);

  const handleCreatePack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackName.trim()) return;

    setIsCreating(true);
    try {
      // Parse plugins from input
      const rawPlugins = newPackPluginsInput
        .split(/[\n,]+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((name) => ({ name, source: "spigot", id: name.toLowerCase() }));

      const payload = {
        name: newPackName.trim(),
        description: newPackDesc.trim(),
        picture: newPackPicture.trim() || PRESET_PICTURES[0].url,
        plugins: rawPlugins,
      };

      const res = await axios.post(`/api/servers/${serverId}/plugins/packs`, payload);
      if (res.data?.success && res.data.pack) {
        setPacks((prev) => [...prev, res.data.pack]);
        setActivePack(res.data.pack);
        setIsCreateOpen(false);
        setNewPackName("");
        setNewPackDesc("");
        setNewPackPluginsInput("");
        setToastMsg({ text: `Plugin Pack "${res.data.pack.name}" created successfully!`, type: "success" });
      }
    } catch (err: any) {
      setToastMsg({ text: err.response?.data?.error || "Failed to create plugin pack", type: "error" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePack = async (packId: string) => {
    if (!confirm("Are you sure you want to delete this custom plugin pack?")) return;
    try {
      await axios.delete(`/api/servers/${serverId}/plugins/packs/${packId}`);
      setPacks((prev) => prev.filter((p) => p.id !== packId));
      if (activePack?.id === packId) {
        setActivePack(null);
      }
      setToastMsg({ text: "Plugin pack deleted", type: "success" });
    } catch (err: any) {
      setToastMsg({ text: err.response?.data?.error || "Failed to delete pack", type: "error" });
    }
  };

  const handleInstallEntirePack = async (pack: PluginPackItem) => {
    setInstallingPackId(pack.id);
    setToastMsg(null);
    try {
      const res = await axios.post(`/api/servers/${serverId}/plugins/install-pack`, {
        packId: pack.id,
        plugins: pack.plugins,
      });

      setToastMsg({
        text: res.data?.message || `Installed pack "${pack.name}" successfully!`,
        type: "success",
      });

      pack.plugins.forEach((p) => {
        onPluginInstalled?.(p.name);
      });
    } catch (err: any) {
      setToastMsg({
        text: err.response?.data?.error || "Failed to install plugin pack",
        type: "error",
      });
    } finally {
      setInstallingPackId(null);
    }
  };

  const handleInstallSinglePluginInPack = async (pluginName: string) => {
    setInstallingSingle(pluginName);
    try {
      const res = await axios.post(`/api/servers/${serverId}/plugins/install`, {
        source: "modrinth",
        pluginId: pluginName.toLowerCase(),
        pluginName: pluginName,
      });
      setToastMsg({
        text: res.data?.message || `${pluginName} installed successfully!`,
        type: "success",
      });
      onPluginInstalled?.(pluginName);
    } catch (err: any) {
      setToastMsg({
        text: err.response?.data?.error || `Failed to install ${pluginName}`,
        type: "error",
      });
    } finally {
      setInstallingSingle(null);
    }
  };

  const handleAddPluginToActivePack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePack || !addPluginInput.trim()) return;
    const newPlugin = { name: addPluginInput.trim(), source: "modrinth", id: addPluginInput.trim().toLowerCase() };
    const updatedPack = {
      ...activePack,
      plugins: [...activePack.plugins, newPlugin],
    };
    setActivePack(updatedPack);
    setPacks((prev) => prev.map((p) => (p.id === activePack.id ? updatedPack : p)));
    setAddPluginInput("");
    setHasUnsavedChanges(true);
  };

  const handleRemovePluginFromActivePack = (pluginName: string) => {
    if (!activePack) return;
    const updatedPack = {
      ...activePack,
      plugins: activePack.plugins.filter((p) => p.name.toLowerCase() !== pluginName.toLowerCase()),
    };
    setActivePack(updatedPack);
    setPacks((prev) => prev.map((p) => (p.id === activePack.id ? updatedPack : p)));
    setHasUnsavedChanges(true);
  };

  // Open Edit Pack Modal pre-filled with pack details
  const handleOpenEditModal = (pack: PluginPackItem) => {
    setEditPackId(pack.id);
    setEditPackName(pack.name);
    setEditPackDesc(pack.description || "");
    setEditPackPicture(pack.picture || PRESET_PICTURES[0].url);
    setEditPackPlugins(pack.plugins ? pack.plugins.map((p) => ({ ...p })) : []);
    setEditNewPluginInput("");
    setEditBulkPluginsInput("");
    setIsEditOpen(true);
  };

  // Save Pack from Edit Modal ("Save Pack" button when work is done)
  const handleSaveEditPack = async (e?: React.FormEvent, andReturnToManager = false) => {
    if (e) e.preventDefault();
    if (!editPackName.trim() || !editPackId) return;

    setIsSavingEdit(true);
    try {
      const payload = {
        name: editPackName.trim(),
        description: editPackDesc.trim(),
        picture: editPackPicture.trim() || PRESET_PICTURES[0].url,
        plugins: editPackPlugins,
      };

      const res = await axios.put(`/api/servers/${serverId}/plugins/packs/${editPackId}`, payload);
      const savedPack = res.data?.pack || {
        ...payload,
        id: editPackId,
        author: activePack?.author || "Admin",
      };

      setPacks((prev) => prev.map((p) => (p.id === editPackId ? savedPack : p)));
      if (activePack?.id === editPackId) {
        setActivePack(savedPack);
        setHasUnsavedChanges(false);
      }

      setIsEditOpen(false);
      setToastMsg({
        text: `Plugin Pack "${savedPack.name}" saved successfully!`,
        type: "success",
      });

      if (andReturnToManager && onBackToPlugins) {
        onBackToPlugins();
      }
    } catch (err: any) {
      setToastMsg({
        text: err.response?.data?.error || "Failed to save plugin pack",
        type: "error",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Save Active Pack directly from Pack Detail View
  const handleSaveActivePack = async (eOrReturn?: React.MouseEvent | boolean) => {
    const andReturnToManager = typeof eOrReturn === "boolean" ? eOrReturn : false;
    if (!activePack) return;
    setIsSavingActive(true);
    try {
      const payload = {
        name: activePack.name,
        description: activePack.description,
        picture: activePack.picture,
        plugins: activePack.plugins,
      };

      const res = await axios.put(`/api/servers/${serverId}/plugins/packs/${activePack.id}`, payload);
      const savedPack = res.data?.pack || activePack;

      setPacks((prev) => prev.map((p) => (p.id === activePack.id ? savedPack : p)));
      setActivePack(savedPack);
      setHasUnsavedChanges(false);

      setToastMsg({
        text: `Plugin Pack "${savedPack.name}" saved successfully!`,
        type: "success",
      });

      if (andReturnToManager && onBackToPlugins) {
        onBackToPlugins();
      }
    } catch (err: any) {
      setToastMsg({
        text: err.response?.data?.error || "Failed to save plugin pack",
        type: "error",
      });
    } finally {
      setIsSavingActive(false);
    }
  };

  // Add single plugin in edit modal
  const handleAddPluginToEditList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNewPluginInput.trim()) return;
    const name = editNewPluginInput.trim();
    if (!editPackPlugins.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setEditPackPlugins((prev) => [...prev, { name, source: "modrinth", id: name.toLowerCase() }]);
    }
    setEditNewPluginInput("");
  };

  // Remove plugin from edit modal list
  const handleRemovePluginFromEditList = (indexToRemove: number) => {
    setEditPackPlugins((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Bulk add plugins in edit modal
  const handleBulkAddPluginsToEditList = () => {
    if (!editBulkPluginsInput.trim()) return;
    const rawNames = editBulkPluginsInput
      .split(/[\n,]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    setEditPackPlugins((prev) => {
      const existingNames = new Set(prev.map((p) => p.name.toLowerCase()));
      const toAdd = rawNames
        .filter((name) => !existingNames.has(name.toLowerCase()))
        .map((name) => ({ name, source: "modrinth", id: name.toLowerCase() }));
      return [...prev, ...toAdd];
    });
    setEditBulkPluginsInput("");
  };

  const handleUploadZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploadingZip(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await axios.post(`/api/servers/${serverId}/plugins/upload-zip`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadMessage({
        text: res.data?.message || "Plugins extracted and installed successfully!",
        type: "success",
      });
      setSelectedFile(null);
      setTimeout(() => {
        setIsZipModalOpen(false);
        setUploadMessage(null);
        onBackToPlugins();
      }, 1500);
    } catch (err: any) {
      setUploadMessage({
        text: err.response?.data?.error || "Failed to upload and extract plugins ZIP file",
        type: "error",
      });
    } finally {
      setIsUploadingZip(false);
    }
  };

  const filteredPacks = packs.filter(
    (p) =>
      p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.plugins.some((pl) => pl.name.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="space-y-6 text-foreground animate-in fade-in duration-200">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between shadow-xl backdrop-blur-md ${
            toastMsg.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/90 border-rose-500/40 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{toastMsg.text}</span>
          </div>
          <button
            onClick={() => setToastMsg(null)}
            className="text-xs opacity-70 hover:opacity-100 font-mono font-bold px-2 py-1 bg-black/40 rounded-lg cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activePack) {
                setActivePack(null);
              } else {
                onBackToPlugins();
              }
            }}
            className="p-2.5 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground transition-all flex items-center gap-2 text-xs font-mono font-bold cursor-pointer active:scale-95"
            title={activePack ? "Back to All Plugin Packs" : "Back to Normal Plugins Browser"}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{activePack ? "Back to Packs" : "Back to Plugins"}</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500 shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground font-mono">
                {activePack ? activePack.name : "Plugin Packs (Modpack Style)"}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activePack
                ? "Manage plugins inside this pack, install in 1-click, or customize."
                : "Ek click me pura plugin pack install karein ya apna custom pack banayein."}
            </p>
          </div>
        </div>

        {/* Top Actions: Create Pack & Upload ZIP */}
        <div className="flex items-center gap-2 flex-wrap">
          {activePack && (
            <>
              <button
                onClick={() => handleOpenEditModal(activePack)}
                className="px-3.5 py-2 rounded-xl bg-theme-500/15 hover:bg-theme-500/25 border border-theme-500/30 text-theme-600 dark:text-theme-400 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title="Edit this pack's name, description, picture or plugins"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Pack</span>
              </button>

              <button
                onClick={handleSaveActivePack}
                disabled={isSavingActive}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 ${
                  hasUnsavedChanges
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30 ring-2 ring-emerald-400 animate-pulse"
                    : "bg-muted border border-border hover:bg-muted-hover text-foreground"
                }`}
                title="Save changes to this plugin pack"
              >
                {isSavingActive ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{hasUnsavedChanges ? "Save Pack *" : "Save Pack"}</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsZipModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Upload ZIP from PC</span>
            <span className="sm:hidden">ZIP</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-theme-500 to-theme-600 hover:from-theme-600 hover:to-theme-700 text-white border border-theme-400/30 text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Pack</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: ACTIVE PACK DETAIL VIEW (Requested by User: Picture on Side, Plugins on Right, Install/Delete) */}
      {activePack ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Side Column: Pack Picture & Metadata */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-lg space-y-4 p-5">
              {/* Cover Picture */}
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-border-subtle group">
                <img
                  src={activePack.picture}
                  alt={activePack.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/60 border border-white/20 backdrop-blur-md">
                    {activePack.isPreset ? "Official Preset" : "Custom Pack"}
                  </span>
                  <span className="text-[11px] font-mono opacity-80">
                    By {activePack.author}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold font-mono tracking-tight text-foreground">
                    {activePack.name}
                  </h3>
                  <button
                    onClick={() => handleOpenEditModal(activePack)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-theme-500 hover:bg-muted transition-colors cursor-pointer"
                    title="Edit Pack Info"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {activePack.description || "No description provided for this pack."}
                </p>
              </div>

              {/* Stats & Plugin Count */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div className="p-2.5 rounded-xl bg-muted/60 border border-border-subtle text-center">
                  <span className="text-[10px] font-mono text-muted-foreground block uppercase">Total Plugins</span>
                  <span className="text-lg font-black font-mono text-foreground">{activePack.plugins.length}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/60 border border-border-subtle text-center">
                  <span className="text-[10px] font-mono text-muted-foreground block uppercase">Pack Status</span>
                  <span className={`text-xs font-bold font-mono flex items-center justify-center gap-1 mt-1 ${hasUnsavedChanges ? "text-amber-500" : "text-emerald-500"}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> {hasUnsavedChanges ? "Unsaved Edits" : "Ready / Saved"}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Install Full Pack */}
              <button
                onClick={() => handleInstallEntirePack(activePack)}
                disabled={installingPackId === activePack.id}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-mono font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
              >
                {installingPackId === activePack.id ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Installing Pack Plugins...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Install Full Pack ({activePack.plugins.length} Plugins)</span>
                  </>
                )}
              </button>

              {/* Browse & Add Manual Plugins in Plugin Manager (Requested by user) */}
              <button
                onClick={() => {
                  if (onStartEditInManager) {
                    onStartEditInManager(activePack);
                  } else {
                    handleOpenEditModal(activePack);
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-theme-500/20 to-theme-600/20 hover:from-theme-500/30 hover:to-theme-600/30 text-theme-600 dark:text-theme-400 border border-theme-500/40 text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm"
                title="Open main Plugin Manager to search, install and add manual plugins into this pack"
              >
                <Puzzle className="w-4 h-4 text-theme-500" />
                <span>Browse & Add Manual Plugins in Manager</span>
              </button>

              {/* Edit Pack & Save Pack Dual Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleOpenEditModal(activePack)}
                  className="w-full py-2.5 px-3 rounded-xl bg-theme-500/15 hover:bg-theme-500/25 text-theme-600 dark:text-theme-400 border border-theme-500/30 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  title="Edit pack name, description, photo or plugins list"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Pack</span>
                </button>

                <button
                  onClick={() => handleSaveActivePack(false)}
                  disabled={isSavingActive}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                    hasUnsavedChanges
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400"
                      : "bg-muted hover:bg-muted-hover border border-border text-foreground"
                  }`}
                  title="Save changes to this plugin pack"
                >
                  {isSavingActive ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{hasUnsavedChanges ? "Save Pack *" : "Save Pack"}</span>
                </button>
              </div>

              {/* Save & Return to Normal Plugin Manager button */}
              <button
                type="button"
                onClick={() => handleSaveActivePack(true)}
                disabled={isSavingActive}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                title="Save changes and return to the normal Plugin Manager below File Manager"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save & Go to Plugin Manager</span>
              </button>

              {/* Delete Pack (if custom) */}
              {!activePack.isPreset && (
                <button
                  onClick={() => handleDeletePack(activePack.id)}
                  className="w-full py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete This Pack</span>
                </button>
              )}
            </div>
          </div>

          {/* Right / Center Column: Plugins in Pack */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
                <div>
                  <h4 className="text-base font-bold font-mono text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-theme-500" />
                    <span>Plugins Included in this Pack</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Har plugin ko individually install karein ya pack se delete karein.
                  </p>
                </div>

                {/* Add new plugin to pack input */}
                <form onSubmit={handleAddPluginToActivePack} className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={addPluginInput}
                    onChange={(e) => setAddPluginInput(e.target.value)}
                    placeholder="Plugin name add karein..."
                    className="bg-muted border border-border focus:border-theme-500 rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-theme-500 hover:bg-theme-600 text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0"
                  >
                    + Add
                  </button>
                </form>
              </div>

              {/* Unsaved Edits Notification Bar */}
              {hasUnsavedChanges && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-amber-600 dark:text-amber-400">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Pack me changes kiye gaye hain. Kaam poora hone par <strong>&quot;Save Pack&quot;</strong> dabayein.</span>
                  </div>
                  <button
                    onClick={handleSaveActivePack}
                    disabled={isSavingActive}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-60"
                  >
                    {isSavingActive ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{isSavingActive ? "Saving..." : "Save Pack"}</span>
                  </button>
                </div>
              )}

              {/* Plugins List */}
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                {activePack.plugins.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto opacity-40 mb-2" />
                    <p className="text-xs font-mono">No plugins added to this pack yet.</p>
                  </div>
                ) : (
                  activePack.plugins.map((plugin, idx) => {
                    const isAlreadyInstalled = installedPluginNames.some(
                      (name) => name.toLowerCase().includes(plugin.name.toLowerCase())
                    );
                    const isInstallingThis = installingSingle === plugin.name;

                    return (
                      <div
                        key={idx}
                        className="p-3 sm:p-3.5 rounded-2xl bg-muted/40 hover:bg-muted/70 border border-border transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-card border border-border flex items-center justify-center text-[11px] font-mono font-bold text-muted-foreground shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs sm:text-sm font-bold font-mono text-foreground truncate">
                                {plugin.name}
                              </h5>
                              {isAlreadyInstalled && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                                  <Check className="w-3 h-3" /> Installed
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Source: {plugin.source || "Bukkit / Modrinth"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Install Single Plugin Button */}
                          <button
                            onClick={() => handleInstallSinglePluginInPack(plugin.name)}
                            disabled={isInstallingThis}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                              isAlreadyInstalled
                                ? "bg-muted text-muted-foreground border-border hover:bg-muted-hover hover:text-foreground"
                                : "bg-theme-500 hover:bg-theme-600 text-white border-theme-400/30 shadow-sm"
                            }`}
                          >
                            {isInstallingThis ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span>{isAlreadyInstalled ? "Re-Install" : "Install"}</span>
                          </button>

                          {/* Delete Plugin from Pack Button */}
                          <button
                            onClick={() => handleRemovePluginFromActivePack(plugin.name)}
                            className="p-1.5 rounded-xl bg-card border border-border hover:bg-rose-500/15 hover:border-rose-500/30 text-muted-foreground hover:text-rose-500 transition-all cursor-pointer"
                            title="Remove plugin from this pack"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 2: ALL PACKS CATALOG GRID */
        <div className="space-y-4">
          {/* Search bar inside packs catalog */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search plugin packs (e.g. Survival, Bedrock Geyser, Economy, Security)..."
              className="w-full bg-card border border-border focus:border-theme-500 rounded-2xl py-2.5 pl-10 pr-4 text-xs sm:text-sm text-foreground font-mono placeholder:text-muted-foreground outline-none transition-colors shadow-sm"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin text-theme-500 mr-2" />
              <span className="font-mono text-sm">Loading plugin packs...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="bg-card border border-border hover:border-theme-500/50 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Pack Cover Image */}
                    <div className="relative aspect-video overflow-hidden bg-muted">
                      <img
                        src={pack.picture}
                        alt={pack.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/60 border border-white/20 text-white backdrop-blur-md">
                          {pack.isPreset ? "Preset Pack" : "Custom Pack"}
                        </span>
                      </div>
                      <div className="absolute bottom-2.5 left-3 right-3 text-white">
                        <h4 className="text-base font-bold font-mono tracking-tight leading-tight line-clamp-1 drop-shadow-sm">
                          {pack.name}
                        </h4>
                        <span className="text-[11px] font-mono text-white/80">
                          {pack.plugins.length} Plugins • By {pack.author}
                        </span>
                      </div>
                    </div>

                    {/* Pack Description */}
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {pack.description}
                      </p>

                      {/* Preview Chips */}
                      <div className="flex flex-wrap gap-1">
                        {pack.plugins.slice(0, 4).map((pl, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-muted border border-border-subtle text-foreground"
                          >
                            {pl.name}
                          </span>
                        ))}
                        {pack.plugins.length > 4 && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-muted/60 text-muted-foreground">
                            +{pack.plugins.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions: Install Pack, Edit Pack, and Details */}
                  <div className="p-4 pt-0 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleInstallEntirePack(pack)}
                        disabled={installingPackId === pack.id}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border border-emerald-400/30 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-60"
                        title="Install this pack on your server"
                      >
                        {installingPackId === pack.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>Install Pack</span>
                      </button>

                      <button
                        onClick={() => {
                          if (onStartEditInManager) {
                            onStartEditInManager(pack);
                          } else {
                            handleOpenEditModal(pack);
                          }
                        }}
                        className="py-2.5 px-3 rounded-xl bg-theme-500/15 hover:bg-theme-500/25 border border-theme-500/30 text-theme-600 dark:text-theme-400 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        title="Edit pack and select manual plugins from Plugin Manager"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Pack</span>
                      </button>
                    </div>

                    <button
                      onClick={() => setActivePack(pack)}
                      className="w-full py-2 px-3 rounded-xl bg-muted hover:bg-muted-hover border border-border text-foreground text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>View Details ({pack.plugins.length} Plugins)</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CREATE PLUGIN PACK */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold font-mono text-foreground">
                  Create New Plugin Pack
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePack} className="space-y-4">
              <div>
                <label className="text-xs font-mono font-bold text-foreground block mb-1">
                  Pack Name *
                </label>
                <input
                  type="text"
                  required
                  value={newPackName}
                  onChange={(e) => setNewPackName(e.target.value)}
                  placeholder="e.g. My Survival Essentials Pack"
                  className="w-full bg-muted border border-border focus:border-theme-500 rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-foreground block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newPackDesc}
                  onChange={(e) => setNewPackDesc(e.target.value)}
                  placeholder="Is pack me kaunse features hain aur server me kya kaam aayega..."
                  className="w-full bg-muted border border-border focus:border-theme-500 rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-foreground block mb-1">
                  Pack Picture / Cover Image
                </label>
                <input
                  type="text"
                  value={newPackPicture}
                  onChange={(e) => setNewPackPicture(e.target.value)}
                  placeholder="Image URL..."
                  className="w-full bg-muted border border-border focus:border-theme-500 rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none mb-2"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {PRESET_PICTURES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewPackPicture(preset.url)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer shrink-0 ${
                        newPackPicture === preset.url
                          ? "bg-theme-500 text-white border-theme-400"
                          : "bg-muted text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-foreground block mb-1">
                  Plugins List (New line ya commas me likhein)
                </label>
                <textarea
                  rows={4}
                  value={newPackPluginsInput}
                  onChange={(e) => setNewPackPluginsInput(e.target.value)}
                  placeholder="EssentialsX&#10;WorldEdit&#10;LuckPerms&#10;Vault&#10;CoreProtect"
                  className="w-full bg-muted border border-border focus:border-theme-500 rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground text-xs font-mono font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newPackName.trim()}
                  className="px-5 py-2 rounded-xl bg-theme-500 hover:bg-theme-600 text-white font-mono font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isCreating ? "Creating Pack..." : "Create & Save Pack"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: UPLOAD ZIP FROM PC */}
      {isZipModalOpen && (
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
                onClick={() => setIsZipModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadMessage && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                  uploadMessage.type === "success"
                    ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
                    : "bg-rose-950/80 border-rose-500/40 text-rose-200"
                }`}
              >
                {uploadMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{uploadMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleUploadZip} className="space-y-4">
              <div className="border-2 border-dashed border-border hover:border-theme-500 rounded-2xl p-6 text-center transition-all bg-muted/30">
                <FolderArchive className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-60" />
                <p className="text-xs font-mono font-bold text-foreground mb-1">
                  {selectedFile ? selectedFile.name : "Select a .zip archive from your computer"}
                </p>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Zip file ke andar ke sabhi .jar plugins automatically /plugins folder me extract aur install ho jayenge.
                </p>
                <input
                  type="file"
                  accept=".zip,.tar,.gz"
                  id="plugin-zip-upload-input"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
                <label
                  htmlFor="plugin-zip-upload-input"
                  className="px-4 py-2 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground text-xs font-mono font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{selectedFile ? "Choose Different File" : "Browse Computer Files (.zip)"}</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsZipModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground text-xs font-mono font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isUploadingZip}
                  className="px-5 py-2 rounded-xl bg-theme-500 hover:bg-theme-600 text-white font-mono font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploadingZip ? (
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

      {/* MODAL 3: EDIT PLUGIN PACK */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-mono text-foreground">
                    Edit Plugin Pack
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Pack details aur plugins edit karein. Kam pora hone par &quot;Save Pack&quot; dabayein.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPack} className="space-y-4">
              <div>
                <label className="text-xs font-mono font-bold text-foreground block mb-1">
                  Pack Name *
                </label>
                <input
                  type="text"
                  required
                  value={editPackName}
                  onChange={(e) => setEditPackName(e.target.value)}
                  placeholder="e.g. My Survival Essentials Pack"
                  className="w-full bg-muted border border-border focus:border-theme-500 rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-foreground block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editPackDesc}
                  onChange={(e) => setEditPackDesc(e.target.value)}
                  placeholder="Is pack me kaunse features hain aur server me kya kaam aayega..."
                  className="w-full bg-muted border border-border focus:border-theme-500 rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-foreground block mb-1">
                  Pack Picture / Cover Image
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-16 h-10 rounded-lg overflow-hidden bg-muted border border-border shrink-0">
                    <img
                      src={editPackPicture || PRESET_PICTURES[0].url}
                      alt="Pack preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                  <input
                    type="text"
                    value={editPackPicture}
                    onChange={(e) => setEditPackPicture(e.target.value)}
                    placeholder="Image URL..."
                    className="flex-1 bg-muted border border-border focus:border-theme-500 rounded-xl px-3.5 py-2 text-xs text-foreground font-mono outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  {PRESET_PICTURES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditPackPicture(preset.url)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer shrink-0 ${
                        editPackPicture === preset.url
                          ? "bg-theme-500 text-white border-theme-400"
                          : "bg-muted text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plugins Editor inside Edit Modal */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-theme-500" />
                    <span>Pack Plugins ({editPackPlugins.length})</span>
                  </label>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Click &quot;X&quot; to remove any plugin
                  </span>
                </div>

                {/* Current Plugin Chips */}
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-muted/40 border border-border min-h-[60px] max-h-[140px] overflow-y-auto custom-scrollbar">
                  {editPackPlugins.length === 0 ? (
                    <span className="text-[11px] font-mono text-muted-foreground italic py-1">
                      Is pack me abhi koi plugins nahi hain. Niche add karein.
                    </span>
                  ) : (
                    editPackPlugins.map((p, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono bg-card border border-border text-foreground group hover:border-rose-500/40"
                      >
                        <span>{p.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePluginFromEditList(idx)}
                          className="text-muted-foreground hover:text-rose-500 cursor-pointer p-0.5"
                          title="Remove plugin"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Add Single Plugin Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editNewPluginInput}
                    onChange={(e) => setEditNewPluginInput(e.target.value)}
                    placeholder="Ek plugin add karein (e.g. WorldEdit)..."
                    className="flex-1 bg-muted border border-border focus:border-theme-500 rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPluginToEditList(e);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddPluginToEditList}
                    disabled={!editNewPluginInput.trim()}
                    className="px-3 py-1.5 bg-theme-500 hover:bg-theme-600 text-white rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>

                {/* Bulk Add Textarea */}
                <div className="pt-1">
                  <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                    Ya multiple plugins ek saath paste karein (commas ya new lines me):
                  </label>
                  <div className="flex items-start gap-2">
                    <textarea
                      rows={2}
                      value={editBulkPluginsInput}
                      onChange={(e) => setEditBulkPluginsInput(e.target.value)}
                      placeholder="EssentialsX, LuckPerms, Vault, CoreProtect..."
                      className="flex-1 bg-muted border border-border focus:border-theme-500 rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleBulkAddPluginsToEditList}
                      disabled={!editBulkPluginsInput.trim()}
                      className="px-3 py-3 bg-muted hover:bg-muted-hover border border-border text-foreground hover:text-theme-500 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      + Add All
                    </button>
                  </div>
                </div>

                {/* Option to open in Plugins Manager directly to browse & install manual plugins */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onStartEditInManager && editPackId) {
                        const target = packs.find((p) => p.id === editPackId) || activePack || {
                          id: editPackId,
                          name: editPackName,
                          description: editPackDesc,
                          picture: editPackPicture,
                          author: "Admin",
                          plugins: editPackPlugins,
                        };
                        onStartEditInManager({
                          ...target,
                          name: editPackName,
                          description: editPackDesc,
                          picture: editPackPicture,
                          plugins: editPackPlugins,
                        });
                        setIsEditOpen(false);
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-theme-500/15 hover:bg-theme-500/25 border border-theme-500/30 text-theme-600 dark:text-theme-400 text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                    title="Open main Plugin Manager under File Manager to search and install manual plugins into this pack"
                  >
                    <Puzzle className="w-4 h-4 text-theme-500" />
                    <span>Open in Plugins Manager to Browse & Add Manual Plugins</span>
                  </button>
                </div>
              </div>

              {/* Modal Bottom Actions: Cancel & Save Pack */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground text-xs font-mono font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => handleSaveEditPack(e, false)}
                    disabled={isSavingEdit || !editPackName.trim()}
                    className="px-4 py-2 rounded-xl bg-muted hover:bg-muted-hover border border-border text-foreground font-mono font-bold text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSavingEdit ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save Pack</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleSaveEditPack(e, true)}
                    disabled={isSavingEdit || !editPackName.trim()}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-mono font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    title="Save pack changes and return to normal Plugin Manager"
                  >
                    {isSavingEdit ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save & Go to Plugin Manager</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
