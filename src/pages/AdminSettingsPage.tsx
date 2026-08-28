// @ts-nocheck
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { motion } from "framer-motion";
import { 
  Check, Shield, User, Trash2, Layout, Upload, RefreshCw, Key, 
  CheckCircle2, AlertCircle, Sparkles, ExternalLink, Cpu, Image, 
  Settings, ArrowLeft, Menu, X, Lock, Palette, UserPlus,
  Activity, AlertTriangle, Loader2, Save, MousePointerClick, Sliders,
  Server, HardDrive, Terminal, Globe, Laptop, Radio, Cloud, Boxes, Network
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AdminControls from '../components/AdminControls';
import { ImageCropper } from "../components/ImageCropper";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { initializeApp, deleteApp } from "firebase/app";

export default function AdminSettingsPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  // Backward-compatible normalization for deep-linked or bookmarked tab IDs
  const normalizeTab = (rawTab: string | null): string => {
    if (!rawTab) return "appearance";
    const lower = rawTab.toLowerCase().trim();
    if (lower === "branding" || lower === "appearance") return "appearance";
    if (lower === "features" || lower === "runtime" || lower === "platform") return "platform";
    if (lower === "auth" || lower === "users" || lower === "access") return "access";
    if (lower === "system") return "system";
    return "appearance";
  };

  const initialTab = normalizeTab(
    searchParams.get("tab") || (typeof window !== "undefined" ? window.location.hash.replace("#", "") : null)
  );

  const [activeTab, setActiveTab] = useState(initialTab);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, updateUser } = useAuth();
  const { 
    panelName, panelLogo, panelBackgroundImage, panelBackgroundBlur, 
    enablePlayit, enableTutorial, enableLoginAnimation, enableRegistration, theme, setTheme, 
    buttonColor, setButtonColor, uiTheme, setUiTheme,
    enableGoogleLogin, firebaseApiKey, firebaseAuthDomain, firebaseProjectId, 
    firebaseStorageBucket, firebaseMessagingSenderId, firebaseAppId, defaultRuntime, runtimeLocked,
    isDev, fetchSettings, setDefaultRuntime,
    playitServiceMode, playitServiceName, healthCheckIntervalMinutes,
    restartDelaySeconds, maxRecoveryAttempts, allowRecoveryWhilePlayersOnline
  } = useSettings();

  // Exactly 4 consolidated top-level admin tabs
  const adminTabs = [
    { id: "appearance", label: "Appearance", icon: <Image size={20} /> },
    { id: "platform", label: "Platform", icon: <Cpu size={20} /> },
    { id: "access", label: "Access & Users", icon: <Key size={20} /> },
    { id: "system", label: "System", icon: <RefreshCw size={20} /> },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
    setMobileOpen(false);
  };

  useEffect(() => {
    const paramTab = searchParams.get("tab");
    if (paramTab) {
      const canonical = normalizeTab(paramTab);
      if (canonical !== activeTab) {
        setActiveTab(canonical);
      }
    }
  }, [searchParams]);
  
  const [users, setUsers] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");

  // Username Change State
  const [newCustomUsername, setNewCustomUsername] = useState(user?.username || "");
  const [isChangingUsername, setIsChangingUsername] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (user?.username) {
      setNewCustomUsername(user.username);
    }
  }, [user?.username]);

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomUsername || newCustomUsername.trim().length < 3) {
      setUsernameMsg({ text: "Username must be at least 3 characters", type: "error" });
      return;
    }
    setIsChangingUsername(true);
    setUsernameMsg(null);
    try {
      const res = await axios.put("/api/auth/username", { newUsername: newCustomUsername.trim() });
      if (updateUser) {
        updateUser({ username: res.data.username });
      }
      setUsernameMsg({ text: "Username updated successfully!", type: "success" });
      if (user.role === "admin" || user.role === "owner") {
        fetchUsers();
      }
    } catch (err: any) {
      setUsernameMsg({ text: err.response?.data?.error || "Failed to update username", type: "error" });
    } finally {
      setIsChangingUsername(false);
    }
  };

  const [newPanelName, setNewPanelName] = useState(panelName);
  const [newEnablePlayit, setNewEnablePlayit] = useState(enablePlayit);
  const [newEnableTutorial, setNewEnableTutorial] = useState(enableTutorial);
  const [newEnableLoginAnimation, setNewEnableLoginAnimation] = useState(enableLoginAnimation);
  const [newEnableRegistration, setNewEnableRegistration] = useState(enableRegistration);
  const [newTheme, setNewTheme] = useState(theme);
  const [newDefaultRuntime, setNewDefaultRuntime] = useState(defaultRuntime || 'docker');
  const [isUpdatingRuntime, setIsUpdatingRuntime] = useState(false);
  const [runtimeStatusMsg, setRuntimeStatusMsg] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(null);

  // Playit Policy Local State
  const [newPlayitMode, setNewPlayitMode] = useState(playitServiceMode || "managed_process");
  const [newPlayitServiceName, setNewPlayitServiceName] = useState(playitServiceName || "playit");
  const [newCheckInterval, setNewCheckInterval] = useState(healthCheckIntervalMinutes || 5);
  const [newRestartDelay, setNewRestartDelay] = useState(restartDelaySeconds || 20);
  const [newMaxAttempts, setNewMaxAttempts] = useState(maxRecoveryAttempts || 3);
  const [newAllowOnlineRecovery, setNewAllowOnlineRecovery] = useState(allowRecoveryWhilePlayersOnline || false);
  const [isSavingPlayitPolicy, setIsSavingPlayitPolicy] = useState(false);
  const [playitPolicyMsg, setPlayitPolicyMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (playitServiceMode !== undefined) setNewPlayitMode(playitServiceMode);
    if (playitServiceName !== undefined) setNewPlayitServiceName(playitServiceName);
    if (healthCheckIntervalMinutes !== undefined) setNewCheckInterval(healthCheckIntervalMinutes);
    if (restartDelaySeconds !== undefined) setNewRestartDelay(restartDelaySeconds);
    if (maxRecoveryAttempts !== undefined) setNewMaxAttempts(maxRecoveryAttempts);
    if (allowRecoveryWhilePlayersOnline !== undefined) setNewAllowOnlineRecovery(allowRecoveryWhilePlayersOnline);
  }, [playitServiceMode, playitServiceName, healthCheckIntervalMinutes, restartDelaySeconds, maxRecoveryAttempts, allowRecoveryWhilePlayersOnline]);

  // Firebase Config Local State
  const [fbEnableGoogleLogin, setFbEnableGoogleLogin] = useState<boolean>(enableGoogleLogin || false);
  const [fbApiKey, setFbApiKey] = useState<string>(firebaseApiKey || "");
  const [fbAuthDomain, setFbAuthDomain] = useState<string>(firebaseAuthDomain || "");
  const [fbProjectId, setFbProjectId] = useState<string>(firebaseProjectId || "");
  const [fbStorageBucket, setFbStorageBucket] = useState<string>(firebaseStorageBucket || "");
  const [fbMessagingSenderId, setFbMessagingSenderId] = useState<string>(firebaseMessagingSenderId || "");
  const [fbAppId, setFbAppId] = useState<string>(firebaseAppId || "");
  const [isSavingFirebase, setIsSavingFirebase] = useState(false);
  const [fbStatusMsg, setFbStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppingType, setCroppingType] = useState<"logo" | "background" | null>(null);
  const [bgAspectRatio, setBgAspectRatio] = useState<number>(16/9);
  const [tempBgBlur, setTempBgBlur] = useState<number>(10);
  const [customBgUrlInput, setCustomBgUrlInput] = useState<string>("");
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [adminUserNewPassword, setAdminUserNewPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUpdatingSystem, setIsUpdatingSystem] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSystemUpdate = async () => {
    try {
      setIsUpdatingSystem(true);
      await axios.post("/api/system/update");
      setIsUpdatingSystem(false);
    } catch (e) {
      alert("Failed to update system. Please check logs.");
      setIsUpdatingSystem(false);
    }
  };

  useEffect(() => {
    setNewPanelName(panelName);
    setNewEnablePlayit(enablePlayit);
    setNewEnableTutorial(enableTutorial);
    setNewEnableLoginAnimation(enableLoginAnimation);
    setNewEnableRegistration(enableRegistration);
    setNewTheme(theme);
    setFbEnableGoogleLogin(enableGoogleLogin || false);
    setFbApiKey(firebaseApiKey || "");
    setFbAuthDomain(firebaseAuthDomain || "");
    setFbProjectId(firebaseProjectId || "");
    setFbStorageBucket(firebaseStorageBucket || "");
    setFbMessagingSenderId(firebaseMessagingSenderId || "");
    setFbAppId(firebaseAppId || "");
    setCustomBgUrlInput(panelBackgroundImage || "");
    setNewDefaultRuntime(defaultRuntime || 'docker');
  }, [defaultRuntime, panelName, panelBackgroundImage, enablePlayit, enableTutorial, enableLoginAnimation, enableRegistration, theme, setTheme, enableGoogleLogin, firebaseApiKey, firebaseAuthDomain, firebaseProjectId, firebaseStorageBucket, firebaseMessagingSenderId, firebaseAppId]);

  const [envData, setEnvData] = useState<any>(null);
  const [isRefreshingEnv, setIsRefreshingEnv] = useState<boolean>(false);

  const fetchEnvironmentData = async (forceRefresh = false) => {
    try {
      setIsRefreshingEnv(true);
      const res = await axios.get(`/api/system/environment${forceRefresh ? '?refresh=true' : ''}`);
      setEnvData(res.data);
    } catch (e) {
      console.warn("Failed to fetch environment info", e);
    } finally {
      setIsRefreshingEnv(false);
    }
  };

  useEffect(() => {
    fetchEnvironmentData();
  }, []);

  const handleSaveFirebaseSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingFirebase(true);
    setFbStatusMsg(null);
    try {
      await axios.put("/api/system/settings", {
        enableGoogleLogin: fbEnableGoogleLogin,
        firebaseApiKey: fbApiKey,
        firebaseAuthDomain: fbAuthDomain,
        firebaseProjectId: fbProjectId,
        firebaseStorageBucket: fbStorageBucket,
        firebaseMessagingSenderId: fbMessagingSenderId,
        firebaseAppId: fbAppId
      });
      await fetchSettings();
      setFbStatusMsg({ text: "Firebase & Google Login settings saved successfully!", type: "success" });
    } catch (err: any) {
      setFbStatusMsg({ text: err.response?.data?.error || "Failed to save Firebase config", type: "error" });
    } finally {
      setIsSavingFirebase(false);
    }
  };

  const handleTestFirebaseConfig = async () => {
    setFbStatusMsg(null);
    if (!fbApiKey || !fbProjectId) {
      setFbStatusMsg({ text: "Please enter at least API Key and Project ID to test.", type: "error" });
      return;
    }
    try {
      const testAppName = "test-fb-app-" + Date.now();
      const testApp = initializeApp({
        apiKey: fbApiKey,
        authDomain: fbAuthDomain,
        projectId: fbProjectId,
        storageBucket: fbStorageBucket,
        messagingSenderId: fbMessagingSenderId,
        appId: fbAppId
      }, testAppName);
      
      await deleteApp(testApp);
      setFbStatusMsg({ text: "Firebase Configuration verified valid!", type: "success" });
    } catch (err: any) {
      setFbStatusMsg({ text: "Firebase config error: " + (err.message || String(err)), type: "error" });
    }
  };

  const fetchUsers = async () => {
    if (user.role !== "admin" && user.role !== "owner") return;
    try {
      const res = await axios.get("/api/system/users");
      setUsers(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchUsers();
    if (panelBackgroundBlur !== undefined) setTempBgBlur(panelBackgroundBlur);
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "background" = "logo") => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', async () => {
        const base64 = reader.result?.toString() || null;
        if (base64) {
          if (type === "logo") {
            setSelectedImage(base64);
            setCroppingType(type);
          } else if (type === "background") {
            setIsProcessing(true);
            try {
              await axios.put("/api/system/settings", { panelBackgroundImage: base64 });
              await fetchSettings();
            } catch(err) {
              console.error(err);
            } finally {
              setIsProcessing(false);
            }
          }
        }
      });
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (bgFileInputRef.current) bgFileInputRef.current.value = "";
  };

  const handleCropComplete = async (croppedImageBase64: string) => {
    const type = croppingType;
    setSelectedImage(null);
    setCroppingType(null);
    if (type === "logo") {
      setIsUpdatingLogo(true);
      try {
        await axios.put("/api/system/settings", { panelLogo: croppedImageBase64 });
        await fetchSettings();
      } catch (err: any) {
        alert(err.response?.data?.error || "Error updating logo");
      } finally {
        setIsUpdatingLogo(false);
      }
    } else if (type === "background") {
      setIsProcessing(true);
      try {
        await axios.put("/api/system/settings", { panelBackgroundImage: croppedImageBase64 });
        await fetchSettings();
      } catch (err: any) {
        alert(err.response?.data?.error || "Error updating background");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    try {
      await axios.post("/api/system/users", { username, password, role });
      setUsername("");
      setPassword("");
      fetchUsers();
      alert("User created successfully");
    } catch (e: any) {
      alert(e.response?.data?.error || "Error creating user");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const changeUserPassword = async (id: string) => {
    try {
      if (adminUserNewPassword.length < 8) {
         alert("Password must be at least 8 characters");
         return;
      }
      await axios.put(`/api/system/users/${id}/password`, { newPassword: adminUserNewPassword });
      alert("Password changed successfully");
      setEditingUserId(null);
      setAdminUserNewPassword("");
      if (user.id === id) {
        logout();
      }
    } catch(e: any) {
      alert(e.response?.data?.error || "Error changing password");
    }
  };

  const deleteUser = async (id: string) => {
    try {
      await axios.delete(`/api/system/users/${id}`);
      fetchUsers();
    } catch (e: any) {
      alert(e.response?.data?.error || "Error deleting user");
    }
  };

  const changeUserRole = async (id: string, newRole: string) => {
    try {
      await axios.put(`/api/system/users/${id}/role`, { role: newRole });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error changing user role");
    }
  };

  const renderGoogleFirebase = () => (
    <div className="bg-card border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10 border-b border-border-subtle pb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center text-foreground">
            <Key className="mr-3 text-theme-500 w-6 h-6" /> Google & Firebase Authentication
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Configure Firebase API Keys to enable 1-click Google Sign-In for admins and users.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-muted p-2 rounded-xl border border-border">
          <span className="text-xs font-semibold text-muted-foreground">Enable Google Login:</span>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input 
              type="checkbox" 
              checked={fbEnableGoogleLogin} 
              onChange={(e: any) => setFbEnableGoogleLogin(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-600"></div>
          </label>
        </div>
      </div>

      {/* Quick Guide Banner */}
      <div className="p-4 rounded-xl bg-theme-600/10 border border-theme-600/20 mb-6 text-xs text-amber-200/90 leading-relaxed">
        <div className="font-bold text-amber-300 text-sm mb-1 flex items-center gap-2">
          <Sparkles size={16} /> How to Setup Google Login in 1 Minute (No Code Needed!):
        </div>
        <ol className="list-decimal list-inside space-y-1 mt-2 text-muted-foreground">
          <li>Open <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-theme-500 underline font-medium hover:text-amber-300 inline-flex items-center gap-1">Firebase Console <ExternalLink size={12} /></a> and create a free project.</li>
          <li>Go to <strong>Authentication &rarr; Sign-in method</strong> and enable <strong>Google</strong>.</li>
          <li>Under <strong>Settings &rarr; Authorized Domains</strong>, add your panel's domain or IP address.</li>
          <li>Go to <strong>Project Settings &rarr; General &rarr; Your apps</strong>, create a Web App and copy the Firebase config credentials below!</li>
        </ol>
      </div>

      {fbStatusMsg && (
        <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 text-sm font-medium ${fbStatusMsg.type === "success" ? "bg-theme-600/10 border border-theme-600/30 text-theme-500" : "bg-theme-500/10 border border-theme-500/30 text-theme-400"}`}>
          {fbStatusMsg.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{fbStatusMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleSaveFirebaseSettings} className="space-y-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Firebase API Key <span className="text-theme-400">*</span>
            </label>
            <input 
              type="text" 
              placeholder="AIzaSy..." 
              value={fbApiKey} 
              onChange={(e: any) => setFbApiKey(e.target.value)} 
              className="w-full bg-muted border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2.5 text-sm text-foreground font-mono transition-all shadow-inner outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Auth Domain <span className="text-theme-400">*</span>
            </label>
            <input 
              type="text" 
              placeholder="your-project.firebaseapp.com" 
              value={fbAuthDomain} 
              onChange={(e: any) => setFbAuthDomain(e.target.value)} 
              className="w-full bg-muted border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2.5 text-sm text-foreground font-mono transition-all shadow-inner outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Project ID <span className="text-theme-400">*</span>
            </label>
            <input 
              type="text" 
              placeholder="your-project-id" 
              value={fbProjectId} 
              onChange={(e: any) => setFbProjectId(e.target.value)} 
              className="w-full bg-muted border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2.5 text-sm text-foreground font-mono transition-all shadow-inner outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Storage Bucket (Optional)
            </label>
            <input 
              type="text" 
              placeholder="your-project.appspot.com" 
              value={fbStorageBucket} 
              onChange={(e: any) => setFbStorageBucket(e.target.value)} 
              className="w-full bg-muted border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2.5 text-sm text-foreground font-mono transition-all shadow-inner outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              Messaging Sender ID (Optional)
            </label>
            <input 
              type="text" 
              placeholder="1234567890" 
              value={fbMessagingSenderId} 
              onChange={(e: any) => setFbMessagingSenderId(e.target.value)} 
              className="w-full bg-muted border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2.5 text-sm text-foreground font-mono transition-all shadow-inner outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
              App ID (Optional)
            </label>
            <input 
              type="text" 
              placeholder="1:1234567890:web:abcdef" 
              value={fbAppId} 
              onChange={(e: any) => setFbAppId(e.target.value)} 
              className="w-full bg-muted border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2.5 text-sm text-foreground font-mono transition-all shadow-inner outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4">
          <button 
            type="submit" 
            disabled={isSavingFirebase}
            className="bg-theme-600 hover:bg-amber-600 text-zinc-950 font-bold px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            {isSavingFirebase ? "Saving Config..." : "Save Firebase Credentials"}
          </button>

          <button 
            type="button" 
            onClick={handleTestFirebaseConfig}
            className="bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98]"
          >
            Test Connection
          </button>
        </div>
      </form>
    </div>
  );

  if (!user || (user.role !== "admin" && user.role !== "owner")) {
    return (
        <div className="w-full flex items-center justify-center py-20 text-muted-foreground">
            You do not have permission to view this page.
        </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full bg-transparent text-foreground font-sans overflow-hidden selection:bg-theme-600/30">
      
      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar for Admin Settings */}
      <div className={`fixed inset-y-0 left-0 z-[70] transform flex-shrink-0 bg-ink backdrop-blur-md text-white font-body border-r border-line transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 w-64 h-full flex flex-col`}>
         <div className="h-16 flex items-center justify-between border-b border-line px-6 flex-shrink-0">
            <span className="font-display font-bold text-lg tracking-wide uppercase text-white">ADMIN <span className="text-dim font-medium">PANEL</span></span>
            <button onClick={() => setMobileOpen(false)} className="md:hidden text-dim hover:text-white transition-colors">
              <X size={20} />
            </button>
         </div>
    
         <nav className="flex-1 w-full px-3 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
           <p className="px-3 mb-4 font-mono text-[10px] text-faint tracking-widest uppercase">Settings</p>
           
           {adminTabs.map(tab => {
               const isActive = activeTab === tab.id;
               return (
                   <button
                       key={tab.id}
                       onClick={() => handleTabChange(tab.id)}
                       className={`relative flex w-full items-center px-3 py-3 rounded transition-colors group overflow-hidden`}
                   >
                       {isActive && (
                           <motion.div 
                               layoutId="activeAdminTab" 
                               className="absolute inset-0 bg-white/[0.05]" 
                               initial={false} 
                               transition={{ type: "spring", stiffness: 300, damping: 30 }}
                           />
                       )}
                       {isActive && (
                           <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-white" />
                       )}
                       <div className={`relative z-10 transition-colors duration-200 ${isActive ? 'text-white' : 'text-dim group-hover:text-white'}`}>
                           {tab.icon}
                       </div>
                       <span className={`ml-3 relative z-10 font-mono text-xs tracking-wider transition-colors duration-200 ${isActive ? 'text-white font-semibold' : 'text-dim group-hover:text-white'}`}>
                           {tab.label.toUpperCase()}
                       </span>
                   </button>
               );
           })}
    
           <div className="mt-8 pt-4 border-t border-line/40">
              <Link to="/" className="relative flex items-center px-3 py-3 rounded transition-colors group overflow-hidden">
                 <div className="relative z-10 text-dim group-hover:text-white transition-colors duration-200">
                     <ArrowLeft size={20} />
                 </div>
                 <span className="ml-3 font-mono text-xs tracking-wider transition-colors duration-200 text-dim group-hover:text-white">BACK TO APP</span>
              </Link>
           </div>
         </nav>
      </div>
    
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-transparent">
         <header className="sticky top-0 z-40 border-b border-line bg-ink backdrop-blur-md flex-shrink-0 h-16 flex items-center px-4 md:px-8">
            <button 
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 -ml-2 mr-3 text-dim hover:text-white hover:bg-line/50 rounded-lg transition-colors flex items-center justify-center"
            >
                <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display font-bold text-xl uppercase text-white tracking-wide">
               {adminTabs.find(t => t.id === activeTab)?.label}
            </h1>
         </header>
    
         <main className="flex-1 w-full h-full relative z-0 overflow-x-hidden overflow-y-auto pb-safe custom-scrollbar p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto w-full pb-12">
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                  {/* ========================================================================= */}
                  {/* TAB 1: APPEARANCE (Consolidates Branding + Appearance/Themes/Backgrounds) */}
                  {/* ========================================================================= */}
                  {activeTab === "appearance" && (
                    <div className="space-y-8">
                      {/* Sub-section 1: Branding & Identity */}
                      <section className="bg-card border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="mb-6 border-b border-border-subtle pb-4">
                          <h2 className="text-xl font-bold flex items-center text-foreground">
                            <Layout className="mr-3 text-theme-500 w-5 h-5" /> Branding & Identity
                          </h2>
                          <p className="text-xs text-muted-foreground mt-1">
                            Customize the public name, branding logos, and visual identification of this panel instance.
                          </p>
                        </div>
                        
                        <div className="flex flex-col gap-8 relative z-10">
                          <form 
                            onSubmit={async (e: any) => {
                              e.preventDefault();
                              setIsSavingSettings(true);
                              try {
                                await axios.put("/api/system/settings", { panelName: newPanelName });
                                fetchSettings();
                              } catch (err: any) {
                                alert(err.response?.data?.error || "Error updating settings");
                              } finally {
                                setIsSavingSettings(false);
                              }
                            }}
                          >
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Panel Name</label>
                            <div className="flex gap-3">
                              <input 
                                required 
                                value={newPanelName} 
                                onChange={(e: any) => setNewPanelName(e.target.value)} 
                                type="text" 
                                placeholder="Enter panel name"
                                className="flex-1 bg-muted border border-border focus:border-theme-600 focus:ring-1 focus:ring-theme-600/50 rounded-xl px-4 py-2.5 text-foreground transition-all shadow-inner outline-none"
                              />
                              <button disabled={isSavingSettings} type="submit" className="bg-theme-700 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-[0.98] whitespace-nowrap disabled:opacity-50">
                                {isSavingSettings ? "Saving..." : "Save Name"}
                              </button>
                            </div>
                          </form>

                          <div className="pt-4 border-t border-border-subtle/50">
                            <label className="block text-sm font-medium text-muted-foreground mb-3">Panel Logo</label>
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                              <div className="w-20 h-20 rounded-2xl bg-muted border border-border-subtle flex items-center justify-center overflow-hidden flex-shrink-0 relative group shadow-inner">
                                {panelLogo ? (
                                  <img src={panelLogo} alt="Panel Logo" className="w-full h-full object-cover" />
                                ) : (
                                  <Layout className="w-8 h-8 text-muted-foreground/50" />
                                )}
                                {panelLogo && (
                                  <button 
                                    onClick={async () => {
                                      try {
                                        await axios.put("/api/system/settings", { panelLogo: "" });
                                        fetchSettings();
                                      } catch(e) {}
                                    }}
                                    className="absolute inset-0 bg-theme-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                    title="Remove logo"
                                  >
                                    <Trash2 size={20} className="text-white" />
                                  </button>
                                )}
                              </div>
                              
                              <div className="flex-1 w-full text-center sm:text-left">
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  ref={fileInputRef}
                                  onChange={(e: any) => handleFileChange(e, "logo")}
                                />
                                <button 
                                  disabled={isUpdatingLogo}
                                  onClick={() => fileInputRef.current?.click()}
                                  className="inline-flex items-center justify-center gap-2 bg-muted hover:bg-muted-hover text-foreground border border-border font-medium px-5 py-2.5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 w-full sm:w-auto mb-2"
                                >
                                  {isUpdatingLogo ? <div className="w-4 h-4 rounded-full border-2 border-muted-foreground border-t-foreground animate-spin"></div> : <Upload size={18} />}
                                  {isUpdatingLogo ? "Uploading..." : (panelLogo ? "Replace Logo" : "Upload Logo")}
                                </button>
                                <p className="text-xs text-muted-foreground">We recommend a square image, PNG or JPG format, at least 256x256px.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Sub-section: Overall UI Base Theme & Surface Colors */}
                      <section className="bg-card/80 backdrop-blur-xl border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="mb-6 border-b border-border-subtle pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h2 className="text-xl font-bold flex items-center text-foreground">
                              <Layout className="mr-3 text-theme-500 w-5 h-5" /> UI Base Colors & Interface Theme
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                              Panel ki overall background, cards, sidebars aur interface surface ke colors customize karein (Dark, Pure Black, Light/White, Midnight Navy, etc.).
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-muted border border-border-subtle text-foreground flex items-center gap-1.5 shadow-sm">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shadow-sm border border-border" 
                                style={{ 
                                  backgroundColor: uiTheme === 'light' ? '#f4f4f6' : (uiTheme === 'black' ? '#000000' : (uiTheme === 'navy' ? '#0b1329' : (uiTheme === 'slate' ? '#1e293b' : (uiTheme === 'purple' ? '#140c2b' : (uiTheme === 'emerald' ? '#07261b' : (uiTheme === 'crimson' ? '#26070c' : (uiTheme === 'amber' ? '#241808' : '#121217'))))))),
                                }} 
                              />
                              <span className="capitalize font-semibold">{uiTheme || 'dark'} UI</span>
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 relative z-10">
                          {[
                            { id: "dark", label: "Dark Onyx (Default)", desc: "Modern deep charcoal dark theme", bg: "#09090b", card: "#121217", text: "#ffffff", border: "rgba(255,255,255,0.1)" },
                            { id: "black", label: "Obsidian OLED Black", desc: "Pitch black background with crisp onyx cards", bg: "#000000", card: "#09090b", text: "#ffffff", border: "rgba(255,255,255,0.15)" },
                            { id: "light", label: "Clean Studio Light", desc: "Pure crisp white & light surface theme", bg: "#f4f4f6", card: "#ffffff", text: "#09090b", border: "rgba(0,0,0,0.12)" },
                            { id: "navy", label: "Cyber Midnight Navy", desc: "Deep oceanic blue dark interface", bg: "#020617", card: "#0b1329", text: "#f8fafc", border: "rgba(59,130,246,0.25)" },
                            { id: "slate", label: "Slate Gunmetal", desc: "Refined zinc and metallic slate dark", bg: "#0f172a", card: "#1e293b", text: "#f1f5f9", border: "rgba(148,163,184,0.25)" },
                            { id: "purple", label: "Royal Deep Violet", desc: "Atmospheric neon purple night", bg: "#080414", card: "#140c2b", text: "#faf5ff", border: "rgba(168,85,247,0.25)" },
                            { id: "emerald", label: "Forest Emerald Dark", desc: "Cyberpunk matrix pine green dark", bg: "#02140d", card: "#07261b", text: "#ecfdf5", border: "rgba(16,185,129,0.25)" },
                            { id: "crimson", label: "Crimson Blood Dark", desc: "Intense dark ruby wine interface", bg: "#140305", card: "#26070c", text: "#fff1f2", border: "rgba(244,63,94,0.25)" },
                            { id: "amber", label: "Espresso Amber Dark", desc: "Warm gold & roasted coffee dark theme", bg: "#120c04", card: "#241808", text: "#fffbeb", border: "rgba(245,158,11,0.25)" },
                          ].map((themeOption) => {
                            const isSelected = (uiTheme || 'dark') === themeOption.id;
                            return (
                              <button
                                key={themeOption.id}
                                type="button"
                                onClick={async () => {
                                  try {
                                    setUiTheme(themeOption.id);
                                    document.documentElement.setAttribute('data-ui-theme', themeOption.id);
                                    await axios.put("/api/system/settings", { uiTheme: themeOption.id });
                                  } catch(e) {}
                                }}
                                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group flex flex-col justify-between gap-3 ${isSelected ? 'bg-card border-theme-500 ring-2 ring-theme-500/50 shadow-lg shadow-theme-500/10' : 'bg-muted/40 border-border hover:border-theme-500/40 hover:bg-muted/70'}`}
                              >
                                <div className="flex items-center justify-between">
                                  {/* Color preview chip */}
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-10 h-7 rounded-lg border shadow-sm flex items-center justify-center p-1"
                                      style={{ backgroundColor: themeOption.bg, borderColor: themeOption.border }}
                                    >
                                      <div 
                                        className="w-full h-full rounded flex items-center justify-center text-[9px] font-bold"
                                        style={{ backgroundColor: themeOption.card, color: themeOption.text }}
                                      >
                                        UI
                                      </div>
                                    </div>
                                    <span className={`text-xs font-bold ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
                                      {themeOption.label}
                                    </span>
                                  </div>

                                  {isSelected && (
                                    <span className="w-5 h-5 rounded-full bg-theme-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                                      <Check size={12} className="stroke-[3]" />
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-muted-foreground leading-snug">
                                  {themeOption.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      {/* Sub-section: Button Colors & Styling (Requested above Theme & Accent Colors) */}
                      <section className="bg-card/80 backdrop-blur-xl border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="mb-6 border-b border-border-subtle pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h2 className="text-xl font-bold flex items-center text-foreground">
                              <MousePointerClick className="mr-3 text-theme-500 w-5 h-5" /> Button Colors & Action Styles
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                              Panel ke tamam primary buttons aur action controls ke colors customize karein (Red, Black, Blue, Green, Purple, Cyan, White, etc.).
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-muted border border-border-subtle text-foreground flex items-center gap-1.5 shadow-sm">
                              <span 
                                className="w-2 h-2 rounded-full shadow-sm" 
                                style={{ 
                                  backgroundColor: buttonColor === 'theme' 
                                    ? 'var(--theme-500)' 
                                    : (buttonColor === 'white' ? '#fff' : (buttonColor === 'black' ? '#09090b' : (buttonColor === 'blue' ? '#3b82f6' : (buttonColor === 'green' ? '#10b981' : (buttonColor === 'purple' ? '#a855f7' : (buttonColor === 'cyan' ? '#06b6d4' : (buttonColor === 'orange' ? '#f97316' : (buttonColor === 'amber' ? '#f59e0b' : (buttonColor === 'rose' ? '#f43f5e' : (buttonColor === 'indigo' ? '#6366f1' : '#ef4444')))))))))) 
                                }} 
                              />
                              <span className="capitalize font-semibold">{buttonColor === 'theme' ? 'Sync with Theme' : `${buttonColor} Buttons`}</span>
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-6 relative z-10">
                          {/* Color Palette Buttons Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                            {[
                              { id: "theme", label: "Match Theme", color: "linear-gradient(135deg, #ef4444, #3b82f6, #10b981)", isSpecial: true },
                              { id: "red", label: "Crimson Red", color: "#ef4444" },
                              { id: "black", label: "Obsidian Black", color: "#09090b" },
                              { id: "blue", label: "Cobalt Blue", color: "#3b82f6" },
                              { id: "green", label: "Emerald Green", color: "#10b981" },
                              { id: "purple", label: "Electric Purple", color: "#a855f7" },
                              { id: "cyan", label: "Cyber Cyan", color: "#06b6d4" },
                              { id: "orange", label: "Sunset Orange", color: "#f97316" },
                              { id: "amber", label: "Amber Gold", color: "#f59e0b" },
                              { id: "rose", label: "Vivid Rose", color: "#f43f5e" },
                              { id: "indigo", label: "Indigo Violet", color: "#6366f1" },
                              { id: "white", label: "Pure White", color: "#ffffff" },
                            ].map((btnOption) => {
                              const isSelected = (buttonColor || 'theme') === btnOption.id;
                              return (
                                <button
                                  key={btnOption.id}
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      setButtonColor(btnOption.id);
                                      document.documentElement.setAttribute('data-button-color', btnOption.id);
                                      await axios.put("/api/system/settings", { buttonColor: btnOption.id });
                                    } catch(e) {}
                                  }}
                                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left group ${isSelected ? 'bg-card border-theme-500 ring-2 ring-theme-500/50 shadow-md shadow-theme-500/10' : 'bg-muted/40 border-border hover:border-theme-500/40 hover:bg-muted/70'}`}
                                >
                                  <span 
                                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/10"
                                    style={btnOption.isSpecial ? { background: btnOption.color } : { backgroundColor: btnOption.color }}
                                  >
                                    {isSelected && (
                                      <Check 
                                        size={12} 
                                        className={btnOption.id === 'white' ? 'text-zinc-950 stroke-[3]' : 'text-white stroke-[3]'} 
                                      />
                                    )}
                                  </span>
                                  <span className={`text-xs font-medium truncate ${isSelected ? 'text-foreground font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                    {btnOption.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Live Interactive Button Preview */}
                          <div className="p-4 rounded-xl bg-background/80 border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-theme-400" /> Live Button Style Preview
                              </span>
                              <p className="text-[11px] text-muted-foreground">
                                Selected color live applies across dashboard buttons, modal confirms, and power controls.
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                              <button 
                                type="button"
                                className="px-4 py-2 bg-theme-600 hover:bg-theme-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Primary Action</span>
                              </button>
                              
                              <button 
                                type="button"
                                className="px-3.5 py-2 bg-muted hover:bg-muted-hover text-foreground font-semibold text-xs rounded-xl border border-border transition-all active:scale-95"
                              >
                                Secondary
                              </button>
                              
                              <span className="px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border border-theme-500/40 text-theme-400 bg-theme-500/10">
                                Active Status
                              </span>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Sub-section 2: Themes & Visual Styling */}
                      <section className="bg-card/80 backdrop-blur-xl border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="mb-6 border-b border-border-subtle pb-4">
                          <h2 className="text-xl font-bold flex items-center text-foreground">
                            <Palette className="mr-3 text-theme-500 w-5 h-5" /> Theme & Accent Colors
                          </h2>
                          <p className="text-xs text-muted-foreground mt-1">
                            Choose an accent theme applied across buttons, badges, borders, and UI highlights.
                          </p>
                        </div>
                        
                        <div className="relative z-10">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                            {[
                              { name: "red", label: "Crimson Red", color: "#ef4444" },
                              { name: "blue", label: "Cobalt Blue", color: "#3b82f6" },
                              { name: "purple", label: "Electric Purple", color: "#a855f7" },
                              { name: "cyan", label: "Cyber Cyan", color: "#06b6d4" },
                              { name: "green", label: "Emerald Green", color: "#10b981" },
                              { name: "amber", label: "Amber Gold", color: "#f59e0b" },
                              { name: "orange", label: "Sunset Orange", color: "#f97316" },
                              { name: "rose", label: "Vivid Rose", color: "#f43f5e" },
                              { name: "black", label: "Obsidian Black", color: "#09090b" },
                              { name: "white", label: "Pure White", color: "#ffffff" }
                            ].map(t => (
                              <button
                                key={t.name}
                                type="button"
                                onClick={async () => {
                                  try {
                                    setTheme(t.name);
                                    document.documentElement.setAttribute('data-theme', t.name);
                                    await axios.put("/api/system/settings", { theme: t.name });
                                  } catch(e) {}
                                }}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left ${theme === t.name ? 'bg-card border-theme-500 ring-1 ring-theme-500 shadow-md shadow-theme-500/10' : 'bg-muted/40 border-border hover:border-theme-500/40 hover:bg-muted/70'}`}
                              >
                                <span 
                                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/10"
                                  style={{ backgroundColor: t.color }}
                                >
                                  {theme === t.name && (
                                    <Check 
                                      size={12} 
                                      className={t.name === 'white' ? 'text-zinc-950 stroke-[3]' : 'text-white stroke-[3]'} 
                                    />
                                  )}
                                </span>
                                <span className={`text-xs font-medium truncate ${theme === t.name ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                                  {t.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Sub-section 3: Background & Wallpaper Customization */}
                        <div className="mt-8 pt-8 border-t border-border-subtle">
                          <div className="mb-6">
                            <h3 className="text-base font-bold flex items-center text-foreground">
                              <Image className="mr-2 text-theme-500 w-4 h-4" /> Custom Dashboard Background
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Upload custom wallpapers, select clean white backgrounds, configure blur, or pick curated presets.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Column: Image Upload/URL */}
                            <div className="space-y-6">
                              <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-3">Upload Custom Image</label>
                                <div className="flex gap-4 items-end">
                                  <div className="w-32 h-20 rounded-xl border-2 border-dashed border-border-subtle bg-muted overflow-hidden relative group flex-shrink-0 flex items-center justify-center">
                                    {panelBackgroundImage === 'solid-white' ? (
                                      <div className="w-full h-full bg-gradient-to-br from-white via-zinc-100 to-zinc-200 flex items-center justify-center font-mono text-[10px] text-zinc-800 font-bold">
                                        Solid White
                                      </div>
                                    ) : panelBackgroundImage ? (
                                      <img src={panelBackgroundImage} alt="Background Preview" className="w-full h-full object-cover" style={{ filter: `blur(${panelBackgroundBlur}px)` }} />
                                    ) : (
                                      <Image className="w-6 h-6 text-muted-foreground/50" />
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden" 
                                      ref={bgFileInputRef}
                                      onChange={(e: any) => handleFileChange(e, "background")}
                                    />
                                    <button 
                                      disabled={isProcessing}
                                      onClick={() => bgFileInputRef.current?.click()}
                                      className="w-full flex items-center justify-center gap-2 bg-theme-600 hover:bg-theme-700 text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 text-sm"
                                    >
                                      {isProcessing ? <div className="w-4 h-4 rounded-full border-2 border-theme-200 border-t-white animate-spin"></div> : <Upload size={16} />}
                                      {isProcessing ? "Uploading..." : "Upload Image"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle">
                                <button 
                                  disabled={isProcessing}
                                  onClick={async () => {
                                    setIsProcessing(true);
                                    try {
                                      await axios.put("/api/system/settings", { panelBackgroundImage: "solid-white", panelBackgroundBlur: 0 });
                                      setCustomBgUrlInput("solid-white");
                                      await fetchSettings();
                                    } catch(e) {} finally {
                                      setIsProcessing(false);
                                    }
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-white text-zinc-950 font-bold hover:bg-zinc-100 px-3.5 py-2 rounded-xl transition-all shadow-sm text-xs border border-zinc-200"
                                >
                                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 border border-zinc-400" />
                                  <span>Solid White Background</span>
                                </button>

                                <button 
                                  disabled={isProcessing}
                                  onClick={async () => {
                                    setIsProcessing(true);
                                    try {
                                      await axios.put("/api/system/settings", { panelBackgroundImage: "", panelBackgroundBlur: 0 });
                                      setCustomBgUrlInput("");
                                      await fetchSettings();
                                    } catch(e) {} finally {
                                      setIsProcessing(false);
                                    }
                                  }}
                                  className="flex items-center justify-center gap-1.5 bg-muted hover:bg-muted-hover text-foreground border border-border font-medium px-3.5 py-2 rounded-xl transition-all shadow-sm text-xs"
                                >
                                  Reset Default
                                </button>
                              </div>

                              {/* Custom URL Input */}
                              <div className="space-y-2 pt-2">
                                <label className="block text-xs font-medium text-muted-foreground">Or Enter Custom Image URL</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="url"
                                    placeholder="https://example.com/wallpaper.jpg"
                                    value={customBgUrlInput}
                                    onChange={(e) => setCustomBgUrlInput(e.target.value)}
                                    className="flex-1 text-sm bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-theme-600"
                                  />
                                  <button
                                    onClick={async () => {
                                      if (!customBgUrlInput.trim()) return;
                                      setIsProcessing(true);
                                      try {
                                        await axios.put("/api/system/settings", { panelBackgroundImage: customBgUrlInput.trim() });
                                        await fetchSettings();
                                      } catch(e) {} finally {
                                        setIsProcessing(false);
                                      }
                                    }}
                                    className="bg-theme-600/20 hover:bg-theme-600/30 text-theme-300 font-medium px-4 py-2 rounded-xl text-sm border border-theme-600/30 transition-all"
                                  >
                                    Apply URL
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Blur Slider & Presets */}
                            <div className="space-y-6 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-xs font-bold text-theme-300 uppercase tracking-widest">Background Blur ({tempBgBlur}px)</label>
                                  <span className="text-xs text-muted-foreground">{tempBgBlur === 0 ? "Sharp" : tempBgBlur > 20 ? "Heavy Blur" : "Soft Blur"}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-4">Adjust background blur for crisp dashboard readability.</p>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="50" 
                                  value={tempBgBlur}
                                  onChange={(e: any) => setTempBgBlur(Number(e.target.value))}
                                  onMouseUp={async () => {
                                    setIsProcessing(true);
                                    try {
                                      await axios.put("/api/system/settings", { panelBackgroundBlur: tempBgBlur });
                                      await fetchSettings();
                                    } catch(e) {} finally {
                                      setIsProcessing(false);
                                    }
                                  }}
                                  onTouchEnd={async () => {
                                    setIsProcessing(true);
                                    try {
                                      await axios.put("/api/system/settings", { panelBackgroundBlur: tempBgBlur });
                                      await fetchSettings();
                                    } catch(e) {} finally {
                                      setIsProcessing(false);
                                    }
                                  }}
                                  className="w-full accent-theme-600"
                                />
                              </div>
                              
                              {/* Preset Themes */}
                              <div className="space-y-3 pt-2 border-t border-border-subtle">
                                <div className="flex items-center justify-between">
                                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest">Wallpaper Presets</label>
                                  <span className="text-[11px] text-theme-400 font-mono">White & Dark Options</span>
                                </div>

                                {/* White / Light Wallpaper Presets */}
                                <div className="space-y-1.5">
                                  <div className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-white shadow-sm" />
                                    <span>White & Light Wallpapers:</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { name: "Minimal Studio White", url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1600&auto=format&fit=crop" },
                                      { name: "Clean Minimal Light", url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1600&auto=format&fit=crop" },
                                      { name: "White Marble Luxury", url: "https://images.unsplash.com/photo-1533035353720-f1c6a75cd8ab?q=80&w=1600&auto=format&fit=crop" },
                                      { name: "Geometric Light Mesh", url: "https://images.unsplash.com/photo-1507499739999-097706ad8914?q=80&w=1600&auto=format&fit=crop" },
                                    ].map((preset) => (
                                      <button
                                        key={preset.name}
                                        onClick={async () => {
                                          setIsProcessing(true);
                                          setCustomBgUrlInput(preset.url);
                                          try {
                                            await axios.put("/api/system/settings", { panelBackgroundImage: preset.url });
                                            await fetchSettings();
                                          } catch(e) {} finally {
                                            setIsProcessing(false);
                                          }
                                        }}
                                        className="flex items-center gap-2 p-1.5 rounded-xl bg-background border border-border hover:border-theme-500/50 hover:bg-muted/50 transition-all text-left group"
                                      >
                                        <img src={preset.url} alt={preset.name} className="w-7 h-7 rounded-lg object-cover group-hover:scale-105 transition-transform" />
                                        <span className="text-[11px] font-medium text-foreground group-hover:text-theme-400 truncate">{preset.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Dark Wallpaper Presets */}
                                <div className="space-y-1.5 pt-1">
                                  <div className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-zinc-800 border border-zinc-600" />
                                    <span>Dark Atmospheric Wallpapers:</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { name: "Deep Space", url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1600&auto=format&fit=crop" },
                                      { name: "Cyberpunk City", url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop" },
                                      { name: "Dark Abstract", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600&auto=format&fit=crop" },
                                      { name: "Neon Horizon", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1600&auto=format&fit=crop" },
                                    ].map((preset) => (
                                      <button
                                        key={preset.name}
                                        onClick={async () => {
                                          setIsProcessing(true);
                                          setCustomBgUrlInput(preset.url);
                                          try {
                                            await axios.put("/api/system/settings", { panelBackgroundImage: preset.url });
                                            await fetchSettings();
                                          } catch(e) {} finally {
                                            setIsProcessing(false);
                                          }
                                        }}
                                        className="flex items-center gap-2 p-1.5 rounded-xl bg-background border border-border hover:border-theme-500/50 hover:bg-muted/50 transition-all text-left group"
                                      >
                                        <img src={preset.url} alt={preset.name} className="w-7 h-7 rounded-lg object-cover group-hover:scale-105 transition-transform" />
                                        <span className="text-[11px] font-medium text-foreground group-hover:text-theme-400 truncate">{preset.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                  )}
        
                  {/* ========================================================================= */}
                  {/* TAB 2: PLATFORM (Consolidates Feature Toggles + Dev Runtime Engine)       */}
                  {/* ========================================================================= */}
                  {activeTab === "platform" && (
                    <div className="space-y-8">
                      {/* Sub-section 1: Feature Modules */}
                      <section className="bg-card border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="mb-6 border-b border-border-subtle pb-4">
                          <h2 className="text-xl font-bold flex items-center text-foreground">
                            <Settings className="mr-3 text-theme-500 w-5 h-5" /> Feature Modules & Addons
                          </h2>
                          <p className="text-xs text-muted-foreground mt-1">
                            Enable or disable optional system integrations, tutorials, and public registration.
                          </p>
                        </div>
                        
                        <div className="flex flex-col gap-4 relative z-10">
                          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-muted/50 border border-border-subtle">
                            <div>
                              <h3 className="font-semibold text-foreground text-sm">Playit Tunnel Integration</h3>
                              <p className="text-xs text-muted-foreground mt-1">Allow users to expose their local servers to the internet using playit.gg tunnels.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                              <input 
                                type="checkbox" 
                                checked={newEnablePlayit} 
                                onChange={async (e: any) => {
                                  const val = e.target.checked;
                                  setNewEnablePlayit(val);
                                  try {
                                    await axios.put("/api/system/settings", { enablePlayit: val });
                                    fetchSettings();
                                  } catch (err) { console.error(err); }
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-600"></div>
                            </label>
                          </div>

                          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-muted/50 border border-border-subtle">
                            <div>
                              <h3 className="font-semibold text-foreground text-sm">Onboarding Tutorial</h3>
                              <p className="text-xs text-muted-foreground mt-1">Show a guided tour to new users when they log in for the first time.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                              <input 
                                type="checkbox" 
                                checked={newEnableTutorial} 
                                onChange={async (e: any) => {
                                  const val = e.target.checked;
                                  setNewEnableTutorial(val);
                                  try {
                                    await axios.put("/api/system/settings", { enableTutorial: val });
                                    fetchSettings();
                                  } catch (err) { console.error(err); }
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-600"></div>
                            </label>
                          </div>

                          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-muted/50 border border-border-subtle">
                            <div>
                              <h3 className="font-semibold text-foreground text-sm">Cinematic Login Intro</h3>
                              <p className="text-xs text-muted-foreground mt-1">Enable the animated sequence on the login screen.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                              <input 
                                type="checkbox" 
                                checked={newEnableLoginAnimation} 
                                onChange={async (e: any) => {
                                  const val = e.target.checked;
                                  setNewEnableLoginAnimation(val);
                                  try {
                                    await axios.put("/api/system/settings", { enableLoginAnimation: val });
                                    fetchSettings();
                                  } catch (err) { console.error(err); }
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-600"></div>
                            </label>
                          </div>

                          <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-muted/50 border border-border-subtle">
                            <div>
                              <h3 className="font-semibold text-foreground text-sm">User Registration</h3>
                              <p className="text-xs text-muted-foreground mt-1">Allow new users to register an account on the panel.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                              <input 
                                type="checkbox" 
                                checked={newEnableRegistration} 
                                onChange={async (e: any) => {
                                  const val = e.target.checked;
                                  setNewEnableRegistration(val);
                                  try {
                                    await axios.put("/api/system/settings", { enableRegistration: val });
                                    fetchSettings();
                                  } catch (err) { console.error(err); }
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-600"></div>
                            </label>
                          </div>
                        </div>
                      </section>

                      {/* Sub-section: Playit Health Monitoring & Recovery Policy */}
                      <section className="bg-card border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="mb-6 border-b border-border-subtle pb-4">
                          <h2 className="text-xl font-bold flex items-center text-foreground">
                            <Activity className="mr-3 text-theme-500 w-5 h-5" /> Playit Tunnel Health & Recovery Policy
                          </h2>
                          <p className="text-xs text-muted-foreground mt-1">
                            Configure automatic health checks, recovery rules, and player-safety protections for Playit.gg tunnels.
                          </p>
                        </div>

                        {playitPolicyMsg && (
                          <div className={`p-4 rounded-xl mb-6 text-xs font-semibold flex items-center gap-2 border ${
                            playitPolicyMsg.type === "success" 
                              ? "bg-theme-600/10 text-theme-500 border-theme-600/20" 
                              : "bg-red-500/10 text-red-500 border-red-500/20"
                          }`}>
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            {playitPolicyMsg.text}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Service Execution Mode
                            </label>
                            <select
                              value={newPlayitMode}
                              onChange={(e) => setNewPlayitMode(e.target.value)}
                              className="w-full bg-muted border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-theme-500"
                            >
                              <option value="managed_process">Managed Process (PM2 / Panel Process)</option>
                              <option value="systemd">Systemd Service (Host systemctl)</option>
                              <option value="docker_container">Docker Container</option>
                            </select>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              How the Playit agent process is supervised and restarted on this host.
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Service / Unit Name
                            </label>
                            <input
                              type="text"
                              value={newPlayitServiceName}
                              onChange={(e) => setNewPlayitServiceName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                              placeholder="playit"
                              className="w-full bg-muted border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-theme-500"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Systemd unit or process name identifier (alphanumeric and underscores).
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Health Check Interval (Minutes)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={newCheckInterval}
                              onChange={(e) => setNewCheckInterval(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-muted border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-theme-500"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                              How often the background health monitor tests TCP reachability & tunnel status (default 5 min).
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Recovery Restart Delay (Seconds)
                            </label>
                            <input
                              type="number"
                              min={5}
                              max={60}
                              value={newRestartDelay}
                              onChange={(e) => setNewRestartDelay(Math.max(5, Number(e.target.value)))}
                              className="w-full bg-muted border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-theme-500"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Wait time after restarting Playit before validating connectivity (default 20s).
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Max Consecutive Recovery Attempts
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={newMaxAttempts}
                              onChange={(e) => setNewMaxAttempts(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-muted border border-border-subtle rounded-xl px-4 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:border-theme-500"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Threshold before marking tunnel as 'Needs Admin Attention' (default 3).
                            </p>
                          </div>

                          <div className="flex flex-col justify-center">
                            <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-muted/60 border border-border-subtle">
                              <div>
                                <h4 className="font-semibold text-foreground text-xs">Allow Recovery While Players Online</h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  If disabled (recommended), auto-recovery is skipped when active players are detected.
                                </p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
                                <input
                                  type="checkbox"
                                  checked={newAllowOnlineRecovery}
                                  onChange={(e) => setNewAllowOnlineRecovery(e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-600"></div>
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-border-subtle">
                          <button
                            type="button"
                            disabled={isSavingPlayitPolicy}
                            onClick={async () => {
                              setIsSavingPlayitPolicy(true);
                              setPlayitPolicyMsg(null);
                              try {
                                await axios.put("/api/system/settings", {
                                  playitServiceMode: newPlayitMode,
                                  playitServiceName: newPlayitServiceName,
                                  healthCheckIntervalMinutes: newCheckInterval,
                                  restartDelaySeconds: newRestartDelay,
                                  maxRecoveryAttempts: newMaxAttempts,
                                  allowRecoveryWhilePlayersOnline: newAllowOnlineRecovery
                                });
                                await fetchSettings();
                                setPlayitPolicyMsg({ text: "Playit health monitoring policy saved successfully!", type: "success" });
                              } catch (err: any) {
                                setPlayitPolicyMsg({ text: err.response?.data?.error || "Failed to save policy", type: "error" });
                              } finally {
                                setIsSavingPlayitPolicy(false);
                              }
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-theme-600 hover:bg-theme-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                          >
                            {isSavingPlayitPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Save Policy</span>
                          </button>
                        </div>
                      </section>

                      {/* Sub-section 2: Runtime Engine */}
                      <section className="bg-card border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
                        <div className="mb-6 border-b border-border-subtle pb-4">
                          <h2 className="text-xl font-bold flex items-center text-foreground">
                            <Cpu className="mr-3 text-theme-500 w-5 h-5" /> Server Runtime Engine
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">
                              Select default execution backend for game server processes (Docker container isolation vs. Host Node.js direct execution).
                            </p>
                          </div>

                          <div className="relative z-10 space-y-6">
                            {runtimeLocked && (
                              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
                                <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-semibold text-amber-200">Runtime Configuration Locked by Installer</p>
                                  <p className="mt-1 text-amber-300/80 leading-relaxed">
                                    The execution engine was configured and locked during installation ({panelName || 'JTG Panel'}).
                                    To switch between Docker and Local Process runtime, re-run <code className="bg-black/30 px-1 py-0.5 rounded font-mono">bash install.sh</code> or edit <code className="bg-black/30 px-1 py-0.5 rounded font-mono">.env</code>.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Environment Auto-Detection Card */}
                            <div className="p-5 rounded-2xl bg-muted/40 border border-border-subtle relative overflow-hidden">
                              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-theme-500/10 border border-theme-500/30 flex items-center justify-center text-theme-400">
                                    {envData?.environmentType === "sandbox" ? (
                                      <Boxes className="w-5 h-5" />
                                    ) : envData?.environmentType === "codespaces" ? (
                                      <Terminal className="w-5 h-5" />
                                    ) : envData?.environmentType === "pc" ? (
                                      <Laptop className="w-5 h-5" />
                                    ) : (
                                      <Server className="w-5 h-5" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-sm text-foreground">
                                        {envData?.environmentName || "Host Environment Detection"}
                                      </h4>
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-theme-500/20 text-theme-400 border border-theme-500/30 uppercase">
                                        {envData?.environmentBadge || "Auto-Detecting..."}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Platform: <span className="text-foreground font-mono">{envData?.distro || envData?.platform || "Linux"} ({envData?.arch || "x64"})</span> • Host: <span className="text-foreground font-mono">{envData?.hostname || "local"}</span>
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  disabled={isRefreshingEnv}
                                  onClick={() => fetchEnvironmentData(true)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted-hover text-foreground border border-border text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingEnv ? "animate-spin text-theme-500" : ""}`} />
                                  <span>{isRefreshingEnv ? "Detecting..." : "Re-Detect Environment"}</span>
                                </button>
                              </div>

                              {/* Specs & Capabilities Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
                                <div className="p-3 rounded-xl bg-background/60 border border-border-subtle">
                                  <div className="text-muted-foreground text-[11px]">CPU & Cores</div>
                                  <div className="font-bold text-foreground mt-0.5 truncate">{envData?.hardware?.cpuCores || 1} Cores</div>
                                  <div className="text-[10px] text-muted-foreground truncate">{envData?.hardware?.cpuModel || "Standard"}</div>
                                </div>
                                <div className="p-3 rounded-xl bg-background/60 border border-border-subtle">
                                  <div className="text-muted-foreground text-[11px]">System Memory</div>
                                  <div className="font-bold text-foreground mt-0.5">{envData?.hardware?.totalMemoryGB || 0} GB RAM</div>
                                  <div className="text-[10px] text-emerald-400">{envData?.hardware?.freeMemoryGB || 0} GB Available</div>
                                </div>
                                <div className="p-3 rounded-xl bg-background/60 border border-border-subtle">
                                  <div className="text-muted-foreground text-[11px]">Docker Daemon</div>
                                  <div className="font-bold mt-0.5 flex items-center gap-1.5">
                                    <span className={`w-2 h-2 rounded-full ${envData?.capabilities?.dockerAvailable ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-zinc-500"}`} />
                                    <span className={envData?.capabilities?.dockerAvailable ? "text-emerald-400 font-mono" : "text-muted-foreground"}>
                                      {envData?.capabilities?.dockerAvailable ? (envData?.capabilities?.dockerVersion || "Active") : "Not Active"}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {envData?.capabilities?.dockerAvailable ? "Containers Ready" : "Local Process Active"}
                                  </div>
                                </div>
                                <div className="p-3 rounded-xl bg-background/60 border border-border-subtle">
                                  <div className="text-muted-foreground text-[11px]">Java Runtime</div>
                                  <div className="font-bold text-foreground mt-0.5 truncate">
                                    {envData?.capabilities?.javaAvailable ? envData?.capabilities?.javaVersion : "Adoptium OpenJDK"}
                                  </div>
                                  <div className="text-[10px] text-theme-400">Auto-Provisioning JRE</div>
                                </div>
                              </div>

                              {/* Environment Notes & Insights */}
                              {envData?.autoTunedSettings?.notes?.length > 0 && (
                                <div className="p-3 rounded-xl bg-background/40 border border-border-subtle/60 text-xs space-y-1">
                                  {envData.autoTunedSettings.notes.map((note: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2 text-muted-foreground">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-theme-500 shrink-0 mt-0.5" />
                                      <span>{note}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <h4 className="font-semibold text-foreground flex items-center gap-2">Default Server Runtime</h4>
                              <p className="text-xs text-muted-foreground mt-1 mb-4">
                                Choose the execution environment for <strong className="text-foreground">newly created servers</strong>.
                              </p>

                              {runtimeStatusMsg && (
                                <div className={`mb-4 p-3 rounded-xl text-sm font-medium border flex items-center gap-2 ${
                                  runtimeStatusMsg.type === "success" 
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                    : runtimeStatusMsg.type === "warning"
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                }`}>
                                  {runtimeStatusMsg.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                                  {runtimeStatusMsg.type === "warning" && <AlertCircle className="w-4 h-4 shrink-0" />}
                                  {runtimeStatusMsg.type === "error" && <AlertCircle className="w-4 h-4 shrink-0" />}
                                  <span>{runtimeStatusMsg.text}</span>
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                  type="button"
                                  disabled={isUpdatingRuntime || runtimeLocked}
                                  onClick={async () => {
                                    if (runtimeLocked) return;
                                    setIsUpdatingRuntime(true);
                                    setRuntimeStatusMsg(null);
                                    setNewDefaultRuntime("docker");
                                    if (setDefaultRuntime) setDefaultRuntime("docker");
                                    try {
                                      const token = localStorage.getItem("jtg_token") || localStorage.getItem("token");
                                      const headers: any = {};
                                      if (token) headers["Authorization"] = `Bearer ${token}`;
                                      await axios.put("/api/system/settings", { defaultRuntime: "docker" }, { headers });
                                      await fetchSettings();
                                      setRuntimeStatusMsg({ text: "Default runtime updated to Docker (Container Isolation).", type: "success" });
                                    } catch(err: any) {
                                      setRuntimeStatusMsg({ text: err.response?.data?.error || err.message || "Failed to update runtime", type: "error" });
                                    } finally {
                                      setIsUpdatingRuntime(false);
                                    }
                                  }}
                                  className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                                    newDefaultRuntime === 'docker' 
                                      ? 'bg-theme-500/10 border-theme-500 shadow-lg shadow-theme-500/10 ring-1 ring-theme-500' 
                                      : 'bg-muted/50 border-border hover:border-border-subtle hover:bg-muted'
                                  } ${runtimeLocked && newDefaultRuntime !== 'docker' ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className={`text-base font-bold flex items-center gap-2 ${newDefaultRuntime === 'docker' ? 'text-theme-400' : 'text-foreground'}`}>
                                        Docker (Container Isolation)
                                      </span>
                                      {newDefaultRuntime === 'docker' && (
                                        <span className="text-[10px] font-mono uppercase bg-theme-500 text-white px-2 py-0.5 rounded-full font-semibold">Active</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                      Runs server workloads in sandboxed Docker containers. Full port isolation, PTY terminal support, high security.
                                    </p>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-border-subtle/40 flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>Engine: Docker Engine</span>
                                    <span className="font-mono text-emerald-400 font-semibold">Isolated</span>
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  disabled={isUpdatingRuntime || runtimeLocked}
                                  onClick={async () => {
                                    if (runtimeLocked) return;
                                    setIsUpdatingRuntime(true);
                                    setRuntimeStatusMsg(null);
                                    setNewDefaultRuntime("local");
                                    if (setDefaultRuntime) setDefaultRuntime("local");
                                    try {
                                      const token = localStorage.getItem("jtg_token") || localStorage.getItem("token");
                                      const headers: any = {};
                                      if (token) headers["Authorization"] = `Bearer ${token}`;
                                      await axios.put("/api/system/settings", { defaultRuntime: "local" }, { headers });
                                      await fetchSettings();
                                      setRuntimeStatusMsg({ text: "Default runtime updated to Local Process (Node.js Direct).", type: "success" });
                                    } catch(err: any) {
                                      setRuntimeStatusMsg({ text: err.response?.data?.error || err.message || "Failed to update runtime", type: "error" });
                                    } finally {
                                      setIsUpdatingRuntime(false);
                                    }
                                  }}
                                  className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                                    newDefaultRuntime === 'local' 
                                      ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500' 
                                      : 'bg-muted/50 border-border hover:border-border-subtle hover:bg-muted'
                                  } ${runtimeLocked && newDefaultRuntime !== 'local' ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className={`text-base font-bold flex items-center gap-2 ${newDefaultRuntime === 'local' ? 'text-amber-400' : 'text-foreground'}`}>
                                        Local Process (Direct Process)
                                      </span>
                                      {newDefaultRuntime === 'local' && (
                                        <span className="text-[10px] font-mono uppercase bg-amber-500 text-black px-2 py-0.5 rounded-full font-semibold">Active</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                      Runs server workloads directly on the host system via Node.js process spawning. Ideal for environments without Docker.
                                    </p>
                                  </div>
                                  <div className="mt-4 pt-3 border-t border-border-subtle/40 flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>Host Java / Node Execution</span>
                                    <span className="font-mono text-amber-400 font-semibold">Direct Host</span>
                                  </div>
                                </button>
                              </div>
                            </div>

                            <div className="p-4 rounded-xl bg-card border border-border-subtle text-xs text-muted-foreground space-y-1">
                              <p className="font-semibold text-foreground">💡 How Runtime Switching Works:</p>
                              <p>• Setting the default runtime here determines what environment is chosen automatically when creating new servers.</p>
                              <p>• Existing servers can also be migrated individually between Docker and Local Process under each server's <strong>Settings &gt; Runtime Migration</strong> tab.</p>
                            </div>
                          </div>
                        </section>
                    </div>
                  )}
        
                  {/* ========================================================================= */}
                  {/* TAB 3: ACCESS & USERS (Consolidates Auth / Firebase + User Management)    */}
                  {/* ========================================================================= */}
                  {activeTab === "access" && (
                    <div className="space-y-8">
                      {/* Sub-section 1: Authentication Settings */}
                      <div>
                        {renderGoogleFirebase()}
                      </div>

                      {/* Sub-section 2: User Management & RBAC */}
                      <div>
                        <AdminControls 
                            user={user}
                            users={users}
                            username={username}
                            setUsername={setUsername}
                            password={password}
                            setPassword={setPassword}
                            role={role}
                            setRole={setRole}
                            isCreatingUser={isCreatingUser}
                            createUser={createUser}
                            editingUserId={editingUserId}
                            setEditingUserId={setEditingUserId}
                            adminUserNewPassword={adminUserNewPassword}
                            setAdminUserNewPassword={setAdminUserNewPassword}
                            changeUserPassword={changeUserPassword}
                            deleteUser={deleteUser}
                            changeUserRole={changeUserRole}
                        />
                      </div>
                    </div>
                  )}
        
                  {/* ========================================================================= */}
                  {/* TAB 4: SYSTEM (System Updates & Maintenance)                              */}
                  {/* ========================================================================= */}
                  {activeTab === "system" && (
                    <section className="bg-card border border-border-subtle rounded-2xl p-6 md:p-8 shadow-xl">
                      <div className="mb-6 border-b border-border-subtle pb-4">
                        <h2 className="text-xl font-bold flex items-center text-foreground">
                          <RefreshCw className="mr-3 text-theme-500 w-5 h-5" /> System Update & Maintenance
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          Manage core system updates, rebuilds, and maintenance procedures for the JTG Panel.
                        </p>
                      </div>
                      <div className="relative z-10">
                        <p className="text-muted-foreground text-sm mb-6 max-w-2xl">
                          Trigger an automatic update of the JTG Panel. This will run git pull and rebuild the system. The panel will be unavailable for a few seconds during this process.
                        </p>
                        <button 
                          onClick={handleSystemUpdate}
                          disabled={isUpdatingSystem}
                          className="px-6 py-2.5 bg-theme-600/10 hover:bg-theme-600/20 text-theme-500 font-medium rounded-xl border border-theme-600/20 transition-all shadow-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${isUpdatingSystem ? "animate-spin" : ""}`} />
                          {isUpdatingSystem ? "Updating System..." : "Update Panel"}
                        </button>
                      </div>
                    </section>
                  )}
              </motion.div>
            </div>
         </main>
      </div>
    
      {selectedImage && (
        <ImageCropper
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          onCancel={() => { setSelectedImage(null); setCroppingType(null); }}
          aspectRatio={croppingType === "background" ? bgAspectRatio : 1}
          title={croppingType === "background" ? "Crop Background" : "Crop Logo"}
        />
      )}
    
      {isUpdatingLogo && <LoadingOverlay message="Updating Branding Logo..." subMessage="Optimizing image and updating panel branding..." />}
      {isSavingSettings && <LoadingOverlay message="Saving System Settings..." subMessage="Persisting panel configuration and runtime preferences..." />}
      {isChangingPassword && <LoadingOverlay message="Updating Admin Credentials..." subMessage="Re-hashing security credentials with bcrypt..." />}
      {isCreatingUser && <LoadingOverlay message="Creating User Account..." subMessage="Registering permissions and security roles..." />}
      {isUpdatingSystem && <LoadingOverlay message="Updating System Configuration..." subMessage="Syncing environment parameters..." />}
      {isProcessing && !isUpdatingLogo && !isSavingSettings && !isChangingPassword && !isCreatingUser && !isUpdatingSystem && (
        <LoadingOverlay message="Applying Changes..." subMessage="Updating server fleet and security rules..." />
      )}
    </div>
  );
}
