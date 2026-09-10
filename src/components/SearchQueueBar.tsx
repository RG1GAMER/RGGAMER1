import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowRight, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sparkles, 
  X, 
  ListPlus,
  Play,
  RotateCcw,
  Check,
  SidebarClose,
  PanelLeftClose,
  Layers
} from "lucide-react";

export interface QueueItem {
  id: string;
  name: string;
  completed?: boolean;
}

interface SearchQueueBarProps {
  storageKey: string;
  title?: string;
  itemTypeLabel?: string; // e.g. "plugin", "mod", "datapack", "addon"
  onSearchItem: (term: string) => void;
  currentQuery?: string;
  className?: string;
  lastInstalledName?: string | null;
  layout?: "horizontal" | "sidebar";
  onToggleCollapse?: () => void;
}

export default function SearchQueueBar({
  storageKey,
  title = "Auto Search Queue",
  itemTypeLabel = "item",
  onSearchItem,
  currentQuery = "",
  className = "",
  lastInstalledName = null,
  layout = "horizontal",
  onToggleCollapse,
}: SearchQueueBarProps) {
  const [items, setItems] = useState<QueueItem[]>(() => {
    try {
      const saved = localStorage.getItem(`jtg_queue_${storageKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`jtg_queue_idx_${storageKey}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [inputVal, setInputVal] = useState("");
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [autoAdvanceOnInstall, setAutoAdvanceOnInstall] = useState(true);
  const activeBoxRef = useRef<HTMLDivElement>(null);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`jtg_queue_${storageKey}`, JSON.stringify(items));
      localStorage.setItem(`jtg_queue_idx_${storageKey}`, String(currentIndex));
    } catch (e) {
      console.warn("Failed to persist queue to localStorage", e);
    }
  }, [items, currentIndex, storageKey]);

  // Scroll active box into view when index changes
  useEffect(() => {
    if (activeBoxRef.current) {
      activeBoxRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex]);

  // When lastInstalledName changes from parent (installation success), mark as completed and advance
  useEffect(() => {
    if (!lastInstalledName || items.length === 0) return;

    // Check if the current item matches or if any item in the queue matches
    const installedNorm = lastInstalledName.trim().toLowerCase();
    const currItem = items[currentIndex];

    if (currItem && currItem.name.trim().toLowerCase() === installedNorm) {
      // Mark current as completed
      setItems((prev) =>
        prev.map((it, idx) => (idx === currentIndex ? { ...it, completed: true } : it))
      );

      // Auto advance to next item if enabled
      if (autoAdvanceOnInstall && currentIndex < items.length - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        onSearchItem(items[nextIdx].name);
      }
    } else {
      // Find matching item in queue
      const matchIdx = items.findIndex(
        (it) => it.name.trim().toLowerCase() === installedNorm
      );
      if (matchIdx !== -1) {
        setItems((prev) =>
          prev.map((it, idx) => (idx === matchIdx ? { ...it, completed: true } : it))
        );
      }
    }
  }, [lastInstalledName]);

  const addItemsFromText = (rawText: string) => {
    if (!rawText.trim()) return;

    // Split by newlines, commas, semicolons, tabs
    const splitNames = rawText
      .split(/[\n,;\t]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (splitNames.length === 0) return;

    const newEntries: QueueItem[] = splitNames.map((name) => ({
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      completed: false,
    }));

    setItems((prev) => {
      const updated = [...prev, ...newEntries];
      // If queue was previously empty, trigger search for the first new item
      if (prev.length === 0 && updated.length > 0) {
        setTimeout(() => {
          onSearchItem(updated[0].name);
        }, 50);
      }
      return updated;
    });

    setInputVal("");
    setBulkText("");
    setIsBulkOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItemsFromText(inputVal);
    }
  };

  const goToIndex = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= items.length) return;
    setCurrentIndex(targetIdx);
    onSearchItem(items[targetIdx].name);
  };

  const handleNext = () => {
    if (items.length === 0) return;
    const nextIdx = (currentIndex + 1) % items.length;
    goToIndex(nextIdx);
  };

  const handlePrev = () => {
    if (items.length === 0) return;
    const prevIdx = (currentIndex - 1 + items.length) % items.length;
    goToIndex(prevIdx);
  };

  const removeItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setItems((prev) => {
      const targetIdx = prev.findIndex((i) => i.id === id);
      const filtered = prev.filter((i) => i.id !== id);

      // Adjust index
      if (targetIdx === currentIndex) {
        const newIdx = Math.min(currentIndex, Math.max(0, filtered.length - 1));
        setCurrentIndex(newIdx);
        if (filtered.length > 0) {
          onSearchItem(filtered[newIdx].name);
        }
      } else if (targetIdx < currentIndex) {
        setCurrentIndex((prevIdx) => Math.max(0, prevIdx - 1));
      }

      return filtered;
    });
  };

  const clearQueue = () => {
    setItems([]);
    setCurrentIndex(0);
  };

  const markCurrentCompleted = () => {
    if (!items[currentIndex]) return;
    setItems((prev) =>
      prev.map((it, idx) => (idx === currentIndex ? { ...it, completed: !it.completed } : it))
    );
  };

  const activeItem = items[currentIndex];

  /* ----------------------------------------------------
     LAYOUT 1: SIDEBAR MODE ("auto search bar alg chay ha side ma")
  ----------------------------------------------------- */
  if (layout === "sidebar") {
    return (
      <div className={`bg-card/95 border border-border rounded-3xl p-4 sm:p-5 shadow-lg flex flex-col space-y-4 text-foreground relative isolate overflow-hidden h-full ${className}`}>
        {/* Decorative subtle accent */}
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-28 h-28 bg-theme-500/10 rounded-full blur-xl pointer-events-none" />

        {/* Sidebar Header */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500 shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold tracking-tight text-foreground font-mono">
                  {title}
                </h3>
                {items.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-theme-500/15 text-theme-600 dark:text-theme-400 border border-theme-500/30">
                    {currentIndex + 1}/{items.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Hide Side Queue Panel"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Input: Add Box or Bulk */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={`Name likh kar Enter karein...`}
              className="w-full bg-muted border border-border focus:border-theme-500 focus:ring-1 focus:ring-theme-500 rounded-xl py-2 px-3 text-xs text-foreground font-mono placeholder:text-muted-foreground outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => addItemsFromText(inputVal)}
              disabled={!inputVal.trim()}
              className="p-2 bg-theme-600 hover:bg-theme-500 text-white disabled:opacity-40 rounded-xl text-xs font-mono font-bold transition-all shrink-0 cursor-pointer active:scale-95 shadow-sm"
              title="Add Box"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsBulkOpen(!isBulkOpen)}
            className="w-full py-1.5 px-2.5 rounded-xl bg-muted/60 hover:bg-muted border border-border text-[11px] font-mono font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ListPlus className="w-3.5 h-3.5 text-theme-500" />
            <span>Paste 10 to 30 Names at Once</span>
          </button>

          {/* Bulk Textarea Popup */}
          {isBulkOpen && (
            <div className="p-3 bg-card border border-border rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 shadow-md">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>Ek sath 10 se 30 names paste karein:</span>
                <button
                  onClick={() => setIsBulkOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="EssentialsX&#10;WorldEdit&#10;LuckPerms&#10;Vault&#10;CoreProtect"
                className="w-full bg-muted border border-border focus:border-theme-500 rounded-lg p-2 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none resize-y"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setIsBulkOpen(false)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => addItemsFromText(bulkText)}
                  disabled={!bulkText.trim()}
                  className="px-3 py-1 bg-theme-600 hover:bg-theme-500 text-white rounded-lg text-[11px] font-mono font-bold transition-all disabled:opacity-40"
                >
                  Add Boxes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls & Navigation: Next Arrow & Prev */}
        {items.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border">
            {/* Highlighted Next Arrow Button */}
            <button
              onClick={handleNext}
              disabled={items.length <= 1}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-theme-500 to-theme-600 hover:from-theme-600 hover:to-theme-700 text-white shadow-sm shadow-theme-500/25 border border-theme-400/30 text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ring-1 ring-white/20"
              title="Load & search next plugin in queue"
            >
              <span>Next Arrow</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-3 gap-1.5">
              {/* Prev Button */}
              <button
                onClick={handlePrev}
                disabled={items.length <= 1}
                className="py-1.5 px-2 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground disabled:opacity-40 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              {/* Mark Done Button */}
              <button
                onClick={markCurrentCompleted}
                className={`py-1.5 px-2 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  activeItem?.completed
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted border-border hover:bg-muted-hover text-muted-foreground hover:text-foreground"
                }`}
                title="Mark Done"
              >
                <Check className="w-3 h-3" />
                <span>Done</span>
              </button>

              {/* Clear Button */}
              <button
                onClick={clearQueue}
                className="py-1.5 px-2 rounded-xl bg-muted border border-border hover:bg-rose-500/15 hover:border-rose-500/30 text-muted-foreground hover:text-rose-500 transition-all flex items-center justify-center gap-1 cursor-pointer text-xs font-mono"
                title="Clear all queue items"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}

        {/* Vertical Stack of Item Boxes */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 max-h-[360px]">
          {items.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-border rounded-2xl text-xs font-mono text-muted-foreground space-y-1">
              <Layers className="w-6 h-6 mx-auto opacity-40 mb-1" />
              <p>Queue khali hai.</p>
              <p className="text-[10px]">Upar plugin ka name likh kar box banayein.</p>
            </div>
          ) : (
            items.map((item, idx) => {
              const isActive = idx === currentIndex;
              return (
                <div
                  key={item.id}
                  ref={isActive ? activeBoxRef : null}
                  onClick={() => goToIndex(idx)}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs font-mono font-semibold border transition-all cursor-pointer select-none shadow-sm active:scale-95 ${
                    isActive
                      ? "bg-theme-500/20 border-theme-500 text-foreground ring-1 ring-theme-500/40 shadow-theme-500/10"
                      : item.completed
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/50"
                      : "bg-muted/40 border-border hover:border-border-strong hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  title={`Click to search: ${item.name}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-theme-600 text-white"
                          : item.completed
                          ? "bg-emerald-500 text-white"
                          : "bg-card text-muted-foreground border border-border"
                      }`}
                    >
                      {item.completed ? <Check className="w-2.5 h-2.5" /> : idx + 1}
                    </span>
                    <span className={`truncate ${isActive ? "font-bold text-foreground" : ""}`}>
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-theme-500 animate-ping" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => removeItem(item.id, e)}
                      className="opacity-50 hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-colors"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Auto-advance checkbox */}
        {items.length > 0 && (
          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoAdvanceOnInstall}
                onChange={(e) => setAutoAdvanceOnInstall(e.target.checked)}
                className="w-3 h-3 accent-theme-600 rounded"
              />
              <span>Auto-advance on install</span>
            </label>
          </div>
        )}
      </div>
    );
  }

  /* ----------------------------------------------------
     LAYOUT 2: HORIZONTAL MODE (Top Bar default)
  ----------------------------------------------------- */
  return (
    <div className={`bg-card/90 border border-border rounded-2xl p-4 sm:p-5 shadow-md space-y-3.5 transition-all text-foreground relative isolate overflow-hidden ${className}`}>
      {/* Decorative subtle gradient background accent */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-36 h-36 bg-theme-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-theme-500/15 border border-theme-500/30 flex items-center justify-center text-theme-500 shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-foreground font-mono">
                {title}
              </h2>
              {items.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-theme-500/15 text-theme-600 dark:text-theme-400 border border-theme-500/30">
                  {currentIndex + 1} of {items.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Name likh kar Enter dabayein (10 se 30 names add karein). 1-by-1 auto search aur Next Arrow ke sath install karein.
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation Arrows */}
        {items.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Mark Done Toggle */}
            <button
              onClick={markCurrentCompleted}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                activeItem?.completed
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted border-border hover:bg-muted-hover text-muted-foreground hover:text-foreground"
              }`}
              title="Mark this item as completed"
            >
              <Check className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {activeItem?.completed ? "Done" : "Mark Done"}
              </span>
            </button>

            {/* Prev Arrow */}
            <button
              onClick={handlePrev}
              disabled={items.length <= 1}
              className="px-2.5 py-1.5 rounded-xl bg-muted border border-border hover:bg-muted-hover text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-mono font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
              title="Previous Item in Queue"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Next Arrow (Highlighted as requested by the user) */}
            <button
              onClick={handleNext}
              disabled={items.length <= 1}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-theme-500 to-theme-600 hover:from-theme-600 hover:to-theme-700 text-white shadow-sm shadow-theme-500/25 border border-theme-400/30 text-xs font-mono font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ring-1 ring-white/20"
              title="Next Arrow: Load & search next plugin in queue"
            >
              <span>Next Arrow</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Clear Button */}
            <button
              onClick={clearQueue}
              className="p-1.5 rounded-xl bg-muted border border-border hover:bg-rose-500/15 hover:border-rose-500/30 text-muted-foreground hover:text-rose-500 transition-all cursor-pointer"
              title="Clear all queue items"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Input Row: Add Single or Bulk */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={`Likh kar Enter dabayein (e.g. EssentialsX, WorldEdit, LuckPerms, Vault)...`}
              className="w-full bg-background border border-border focus:border-theme-500 focus:ring-1 focus:ring-theme-500 rounded-xl py-2 px-3.5 text-xs sm:text-sm text-foreground font-mono placeholder:text-muted-foreground outline-none transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => addItemsFromText(inputVal)}
            disabled={!inputVal.trim()}
            className="px-3.5 py-2 bg-theme-600 hover:bg-theme-500 text-white disabled:opacity-40 disabled:hover:bg-theme-600 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Box</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBulkOpen(!isBulkOpen)}
            className="px-3 py-2 bg-muted hover:bg-muted-hover border border-border text-foreground-muted hover:text-foreground rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Paste multiple items (10-30 lines at once)"
          >
            <ListPlus className="w-3.5 h-3.5 text-theme-500" />
            <span className="hidden sm:inline">Bulk 10-30</span>
          </button>
        </div>

        {/* Bulk Textarea Popup / Collapse */}
        {isBulkOpen && (
          <div className="p-3 bg-background border border-border rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Paste 10 to 30 {itemTypeLabel} names (ek line par ek, ya commas se separate):</span>
              <button
                onClick={() => setIsBulkOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              rows={4}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="EssentialsX&#10;WorldEdit&#10;LuckPerms&#10;Vault&#10;CoreProtect&#10;AuthMe&#10;Chunky&#10;Geyser-Spigot&#10;Floodgate&#10;ClearLag"
              className="w-full bg-card border border-border focus:border-theme-500 rounded-lg p-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsBulkOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => addItemsFromText(bulkText)}
                disabled={!bulkText.trim()}
                className="px-4 py-1.5 bg-theme-600 hover:bg-theme-500 text-white rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-40"
              >
                Add All Boxes ({bulkText.split(/[\n,;\t]+/).filter((s) => s.trim().length > 0).length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Boxes / Chips Display (The interactive queue) */}
      {items.length > 0 ? (
        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <span>Current Search:</span>
              <strong className="text-theme-600 dark:text-theme-400 font-bold underline">
                {activeItem ? activeItem.name : "None"}
              </strong>
            </span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px]">
              <input
                type="checkbox"
                checked={autoAdvanceOnInstall}
                onChange={(e) => setAutoAdvanceOnInstall(e.target.checked)}
                className="w-3 h-3 accent-theme-600 rounded"
              />
              <span>Auto-advance on install</span>
            </label>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 custom-scrollbar">
            {items.map((item, idx) => {
              const isActive = idx === currentIndex;
              return (
                <div
                  key={item.id}
                  ref={isActive ? activeBoxRef : null}
                  onClick={() => goToIndex(idx)}
                  className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all shrink-0 cursor-pointer select-none shadow-sm active:scale-95 ${
                    isActive
                      ? "bg-theme-500/20 border-theme-500 text-foreground ring-2 ring-theme-500/40 shadow-theme-500/10"
                      : item.completed
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/50"
                      : "bg-muted/60 border-border hover:border-border-strong hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  title={`Click to search: ${item.name}`}
                >
                  {/* Step Number or Status Icon */}
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-theme-600 text-white"
                        : item.completed
                        ? "bg-emerald-500 text-white"
                        : "bg-background text-muted-foreground border border-border"
                    }`}
                  >
                    {item.completed ? <Check className="w-2.5 h-2.5" /> : idx + 1}
                  </span>

                  {/* Name */}
                  <span className={`truncate max-w-[140px] sm:max-w-[200px] ${isActive ? "font-bold text-foreground" : ""}`}>
                    {item.name}
                  </span>

                  {/* Active Indicator Pulse */}
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-theme-500 animate-ping shrink-0" />
                  )}

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={(e) => removeItem(item.id, e)}
                    className="opacity-60 hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-colors shrink-0"
                    title="Remove from queue"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl border border-dashed border-border text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-theme-500 shrink-0" />
            <span>Koi {itemTypeLabel} queue mein nahi hai. Upar box mein name likh kar Enter dabayein ya "Bulk 10-30" se ek sath list paste karein.</span>
          </div>
        </div>
      )}
    </div>
  );
}
