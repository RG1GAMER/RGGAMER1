import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, ChevronRight, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { useLocation, matchPath, Link } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import GlobalSearchModal from "./GlobalSearchModal";
import NotificationsDropdown from "./NotificationsDropdown";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("jtg_main_sidebar_collapsed") === "true";
  });
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const location = useLocation();
  const { panelName, panelLogo } = useSettings();

  const handleSlideAway = () => {
    setIsCollapsed(true);
    localStorage.setItem("jtg_main_sidebar_collapsed", "true");
    setDrawerOpen(false);
  };

  const handleRestoreSidebar = () => {
    setIsCollapsed(false);
    localStorage.setItem("jtg_main_sidebar_collapsed", "false");
    setDrawerOpen(false);
  };

  const toggleSidebarMenu = () => {
    setDrawerOpen(prev => !prev);
  };

  const pName = panelName || 'JTG PANEL';
  const nameParts = pName.split(' ');
  const firstWord = nameParts[0]?.toUpperCase() || 'JTG';
  const restWords = nameParts.slice(1).join(' ').toUpperCase();

  // Responsive mobile detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setDrawerOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Automatically dismiss mobile menu whenever navigating to any page ("jab click kar da to hat ja")
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleToggle = () => {
      if (window.innerWidth >= 768) {
        if (isCollapsed) {
          setDrawerOpen(prev => !prev);
        } else {
          handleSlideAway();
        }
      } else {
        setDrawerOpen(prev => !prev);
      }
    };
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, [isCollapsed]);

  const isServerView = matchPath("/servers/:id/*", location.pathname) && !matchPath("/servers/create", location.pathname);
  const isCreateServer = matchPath("/servers/create", location.pathname);
  const isAdminSettings = matchPath("/admin/settings", location.pathname);

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/') return 'Overview';
    if (path === '/servers') return 'Servers';
    if (path === '/servers/create') return 'Deploy Server';
    if (path.startsWith('/servers/')) return 'Server Management';
    if (path === '/admin/servers') return 'Fleet';
    if (path === '/account') return 'Account';
    if (path === '/api-keys') return 'API Keys';
    return '';
  };

  if (isServerView || isCreateServer || isAdminSettings) {
    return (
      <div className="flex h-[100dvh] w-full bg-transparent text-foreground font-sans overflow-hidden selection:bg-theme-600/30">
        <main className="flex-1 w-full h-full relative z-10 overflow-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={`flex h-[100dvh] w-full bg-transparent text-foreground font-sans overflow-hidden selection:bg-theme-600/30`}>
      {/* Backdrop Overlay for Slide Drawer (Mobile and Desktop in Full Slide mode) */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 cursor-pointer"
          onClick={() => setDrawerOpen(false)}
          title="Click to dismiss menu"
        />
      )}
      
      {/* Slide Drawer (Mobile & Desktop Full Slide mode) - Slides in and auto-hides when any option is clicked */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 flex-shrink-0 transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        <Sidebar 
          isDrawer={true} 
          onClose={() => setDrawerOpen(false)} 
          toggleCollapse={handleRestoreSidebar} 
        />
      </div>

      {/* Desktop Persistent Docked Sidebar (Only visible when NOT in Full Slide mode) */}
      <div 
        className={`hidden md:flex flex-shrink-0 transition-all duration-300 ease-in-out relative ${
          isCollapsed ? 'w-0 -translate-x-full opacity-0 pointer-events-none overflow-hidden border-r-0' : 'w-64 translate-x-0 opacity-100'
        }`}
      >
        {!isCollapsed && (
          <Sidebar 
            isDrawer={false} 
            toggleCollapse={handleSlideAway} 
          />
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-transparent">
        
        {/* NAV: Sticky Top Header */}
        <header className="sticky top-0 z-40 border-b border-line bg-ink/95 backdrop-blur-md flex-shrink-0 shadow-sm">
            <div className="px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    {/* 3-Lines Hamburger Menu Button */}
                    {/* ONLY VISIBLE ON DESKTOP WHEN SLID AWAY / FULL SLIDE MODE (prevents duplicate button when docked!) */}
                    <button 
                        onClick={toggleSidebarMenu}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer items-center justify-center shrink-0 shadow-sm active:scale-95 ${
                            isCollapsed 
                                ? 'flex bg-theme-500/25 border border-theme-400 text-theme-100 ring-2 ring-theme-500/40 shadow-theme-500/25' 
                                : 'flex md:hidden bg-theme-500/10 hover:bg-theme-500/20 active:bg-theme-500/30 border border-theme-500/30 text-theme-300 hover:text-white'
                        }`}
                        title={isCollapsed ? "Show Navigation Options (3 Lines)" : "Menu"}
                        aria-label="Toggle Navigation Menu"
                    >
                        <Menu className="w-5 h-5 text-theme-400" />
                    </button>

                    {/* Show logo in top bar for all screens */}
                    <Link to="/" className="flex items-center gap-2.5 group min-w-0">
                        {panelLogo ? (
                            <img src={panelLogo} alt="Logo" className="w-7 h-7 object-contain shrink-0" />
                        ) : (
                            <div className="w-7 h-7 rounded-lg bg-theme-600 text-white flex items-center justify-center group-hover:rotate-45 transition-transform duration-500 shadow-sm shadow-theme-600/25 shrink-0">
                                <div className="w-3.5 h-3.5 bg-white/90 rounded-sm"></div>
                            </div>
                        )}
                        <span className="font-display font-bold text-base sm:text-lg tracking-wide uppercase text-foreground truncate">{firstWord} {restWords && <span className="text-dim font-medium">{restWords}</span>}</span>
                    </Link>

                    {/* Desktop Full-Slide Mode Indicator Badge */}
                    {isCollapsed && (
                        <button 
                            onClick={handleRestoreSidebar}
                            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-theme-500/15 hover:bg-theme-500/25 border border-theme-500/35 text-[11px] font-mono text-theme-300 font-medium cursor-pointer transition-colors shadow-sm"
                            title="Click to restore sidebar to docked view"
                        >
                            <PanelLeftOpen className="w-3.5 h-3.5 text-theme-400" />
                            <span>Full Slide</span>
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 sm:gap-4 ml-auto shrink-0">
                    {/* ALL SYSTEMS GO status badge (no timer) */}
                    <div className="hidden md:flex items-center gap-2 font-mono text-[10px] text-dim tracking-widest mr-4 px-3 py-1.5 rounded bg-panel/50 border border-line">
                        <span className="w-1.5 h-1.5 bg-theme-500 rounded-full pulse-dot"></span> ALL SYSTEMS GO
                    </div>
                    <GlobalSearchModal />
                    <NotificationsDropdown />
                </div>
            </div>
        </header>

        {/* Main Content */}
        <main className={`flex-1 w-full h-full relative z-0 overflow-x-hidden overflow-y-auto pb-safe custom-scrollbar`}>
          {location.pathname === "/" ? children : (
            <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Desktop Quick-Expand Edge Slide Tab when in Full Slide mode */}
      {isCollapsed && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-40 p-2 pl-1.5 pr-2.5 rounded-r-xl bg-card/95 hover:bg-theme-600 text-theme-300 hover:text-white shadow-2xl border-y border-r border-theme-500/40 backdrop-blur-xl transition-all duration-200 group items-center gap-1 cursor-pointer select-none"
          title="Slide Out JTG Panel Menu Options"
        >
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform text-theme-400 group-hover:text-white" />
          <span className="text-[10px] font-mono font-bold tracking-wider uppercase [writing-mode:vertical-lr] rotate-180 py-1">
            Menu
          </span>
        </button>
      )}
    </div>
  );
}
