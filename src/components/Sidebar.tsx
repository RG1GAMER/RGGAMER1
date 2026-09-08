import { Link, useLocation } from "react-router-dom";
import { Server, LayoutDashboard, Plus, LogOut, X, Settings, Key, User, Activity, Box, Search, Bell, Menu, PanelLeftClose } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { motion, AnimatePresence } from "framer-motion";

export function Sidebar({ 
  onClose, 
  isCollapsed, 
  toggleCollapse,
  isDrawer = false
}: { 
  onClose?: () => void;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
  isDrawer?: boolean;
}) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { panelName, panelLogo } = useSettings();
  
  const links = [
    { name: "Overview", path: "/", icon: <LayoutDashboard size={20} /> },
    { name: "Servers", path: "/servers", icon: <Server size={20} /> },
  ];
  
  if (user?.role === "admin" || user?.role === "owner") {
    links.push({ name: "Nodes", path: "/nodes", icon: <Activity size={20} /> });
    links.push({ name: "Deploy", path: "/servers/create", icon: <Plus size={20} /> });
    links.push({ name: "Fleet", path: "/admin/servers", icon: <Box size={20} /> });
    links.push({ name: "API Keys", path: "/api-keys", icon: <Key size={20} /> });
    links.push({ name: "Admin Settings", path: "/admin/settings", icon: <Settings size={20} /> });
  }
  links.push({ name: "Account", path: "/account", icon: <User size={20} /> });

  return (
    <div className="h-full flex flex-col bg-ink backdrop-blur-md text-white font-body border-r border-line transition-all duration-300 z-20 w-64 shadow-2xl shadow-theme-900/40">
      {/* Header (Branding on mobile, toggle on desktop) */}
      <div className="h-16 flex items-center border-b border-line px-4 justify-between flex-shrink-0 relative">
        <div className="flex items-center gap-3 overflow-hidden">
          {panelLogo ? (
            <img src={panelLogo} alt="Logo" className="w-7 h-7 object-contain rounded" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-theme-600 text-white flex items-center justify-center shadow-sm shadow-theme-600/25 shrink-0">
              <div className="w-3.5 h-3.5 bg-white/90 rounded-sm"></div>
            </div>
          )}
          <span className="font-display font-bold text-sm tracking-wide uppercase text-white truncate">
            {panelName || 'JTG PANEL'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Desktop Slide-away / Collapse Button when docked */}
          {toggleCollapse && !isDrawer && (
            <button 
              onClick={toggleCollapse}
              className="hidden md:flex p-1.5 text-theme-400 hover:text-theme-100 bg-theme-500/10 hover:bg-theme-500/20 border border-theme-500/30 rounded-lg transition-colors cursor-pointer"
              title="Slide Away Sidebar (Full Screen Dashboard)"
            >
              <PanelLeftClose size={16} />
            </button>
          )}

          {/* Close Button when acting as a slide-over drawer (both Mobile and Desktop in Full Slide) */}
          {onClose && (
            <button 
              onClick={onClose} 
              className={`flex items-center justify-center p-2 text-dim hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0 cursor-pointer ${isDrawer ? '' : 'md:hidden'}`}
              title="Close Menu"
              aria-label="Close Menu"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 w-full px-3 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
        <p className="px-3 mb-4 font-mono text-[10px] text-faint tracking-widest uppercase">Menu</p>
        {links.map(link => {
          const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
          return (
            <Link 
              key={link.path} 
              to={link.path} 
              onClick={onClose}
              className="relative flex items-center px-3 py-3 rounded transition-colors group overflow-hidden"
            >
              {isActive && (
                <motion.div 
                  layoutId="activeTabSidebar" 
                  className="absolute inset-0 bg-theme-500/15" 
                  initial={false} 
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-theme-500 shadow-sm shadow-theme-500/40" />
              )}
              <div className={`relative z-10 transition-colors duration-200 ${isActive ? 'text-theme-400' : 'text-dim group-hover:text-foreground'}`}>
                {link.icon}
              </div>
              <span className={`ml-3 relative z-10 font-mono text-xs tracking-wider transition-colors duration-200 ${isActive ? 'text-theme-300 font-bold' : 'text-dim group-hover:text-foreground'}`}>
                {link.name.toUpperCase()}
              </span>
            </Link>
          );
        })}
      </nav>
      
      {/* User Profile */}
      <div className="w-full p-4 border-t border-line mt-auto bg-panel">
        <div className="flex items-center justify-between group cursor-pointer hover:bg-muted/40 p-2 -mx-2 rounded-xl transition-colors">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-theme-600 text-white flex items-center justify-center font-display font-bold text-sm flex-shrink-0 shadow-md shadow-theme-600/25">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="truncate">
              <p className="font-mono text-xs font-semibold text-foreground truncate uppercase">{user?.username}</p>
              <p className="font-mono text-[10px] text-faint tracking-widest capitalize truncate">{user?.role || "Admin"}</p>
            </div>
          </div>
          <button 
            onClick={() => { logout(); if (onClose) onClose(); }} 
            className="p-2 text-dim hover:text-theme-400 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 cursor-pointer" 
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
