import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import axios from "axios";
import {
  ArrowLeft, Server, AlertTriangle, AlignLeft, MemoryStick as MemoryStickIcon,
  Cpu, Zap, Sparkles, HardDrive, Globe, User, Radio, GitBranch, Check,
  ChevronDown, Search, Rocket, SlidersHorizontal, FastForward, Network,
  Wrench, Feather, Info, Code2, TerminalSquare, Gamepad2, Layers, HelpCircle,
  Puzzle, Settings, CheckCircle2, Box, Tag
} from "lucide-react";
import { SOFTWARE_CATALOG, SOFTWARE_BUILDS_MAP, SoftwareItem } from "../components/SoftwareManager";

const pageStyles = `
  .deploy-theme {
    background: var(--bg-background); color: var(--text-foreground); font-family: 'IBM Plex Sans', sans-serif;
    min-height: 100vh;
  }
  .deploy-theme .font-display { font-family: 'Chakra Petch', sans-serif; }
  .deploy-theme .font-mono { font-family: 'IBM Plex Mono', monospace; }
  
  .deploy-theme .bg-grid {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: linear-gradient(var(--border-border-subtle) 1px, transparent 1px),
                      linear-gradient(90deg, var(--border-border-subtle) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 95% 70% at 50% 0%, #000 25%, transparent 78%);
    -webkit-mask-image: radial-gradient(ellipse 95% 70% at 50% 0%, #000 25%, transparent 78%);
  }
  .deploy-theme .scanline {
    position: fixed; left: 0; right: 0; height: 140px; top: -140px; z-index: 1; pointer-events: none;
    background: linear-gradient(to bottom, transparent, var(--border-border-subtle), transparent);
    animation: scan 10s linear infinite;
  }
  @keyframes scan { to { top: 100vh; } }
  .deploy-theme .noise {
    position: fixed; inset: 0; z-index: 60; pointer-events: none; opacity: .025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  
  .deploy-theme .corner { position: absolute; width: 12px; height: 12px; }
  .deploy-theme .c-tl { top: -1px; left: -1px; border-top: 2px solid var(--theme-500); border-left: 2px solid var(--theme-500); }
  .deploy-theme .c-tr { top: -1px; right: -1px; border-top: 2px solid var(--theme-500); border-right: 2px solid var(--theme-500); }
  .deploy-theme .c-bl { bottom: -1px; left: -1px; border-bottom: 2px solid var(--theme-500); border-left: 2px solid var(--theme-500); }
  .deploy-theme .c-br { bottom: -1px; right: -1px; border-bottom: 2px solid var(--theme-500); border-right: 2px solid var(--theme-500); }

  .deploy-theme .inp {
    width: 100%; background: var(--bg-card); border: 1px solid var(--border-border); padding: .85rem 1rem; color: var(--text-foreground); outline: none; transition: border-color .25s, box-shadow .25s; font-size: .95rem; border-radius: 0.5rem;
  }
  .deploy-theme .inp::placeholder { color: var(--text-muted-foreground); opacity: 0.6; }
  .deploy-theme .inp:focus { border-color: var(--theme-500); box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-500) 25%, transparent); }
  
  .deploy-theme .sel-card {
    position: relative; background: var(--bg-card); border: 1px solid var(--border-border); cursor: pointer; transition: all .28s cubic-bezier(.16,1,.3,1); overflow: hidden; border-radius: 0.75rem;
  }
  .deploy-theme .sel-card:hover { transform: translateY(-3px); border-color: var(--theme-500); }
  .deploy-theme .sel-card.selected { border-color: var(--theme-500); background: color-mix(in srgb, var(--theme-500) 10%, var(--bg-card)); box-shadow: 0 0 0 1px var(--theme-500), 0 14px 40px -14px color-mix(in srgb, var(--theme-500) 30%, transparent); }
  .deploy-theme .sel-card .tick {
    position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; border-radius: 9999px; background: var(--theme-500); color: #fff; display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(.3); transition: all .3s cubic-bezier(.34,1.56,.64,1);
  }
  .deploy-theme .sel-card.selected .tick { opacity: 1; transform: scale(1); }
  .deploy-theme .soft-card .ic { color: var(--text-muted-foreground); transition: all .3s; }
  .deploy-theme .soft-card:hover .ic { color: var(--text-foreground); }
  .deploy-theme .soft-card.selected .ic { color: var(--theme-400); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--theme-500) 50%, transparent)); }

  .deploy-theme .btn-primary-action { 
    position: relative; overflow: hidden; 
    background: var(--btn-color-600, var(--theme-600)); 
    color: var(--btn-color-text, #ffffff); 
    border-radius: 0.5rem;
    transition: all 0.25s ease;
  }
  .deploy-theme .btn-primary-action:hover:not(:disabled) { 
    background: var(--btn-color-500, var(--theme-500));
    box-shadow: 0 10px 25px -5px color-mix(in srgb, var(--btn-color-500, var(--theme-500)) 40%, transparent);
    transform: translateY(-1px);
  }
  .deploy-theme .btn-primary-action:disabled { opacity: .4; cursor: not-allowed; }
  
  .deploy-theme .btn-ghost { background: var(--bg-muted); border: 1px solid var(--border-border); color: var(--text-muted-foreground); transition: all .25s; border-radius: 0.5rem; }
  .deploy-theme .btn-ghost:hover:not(:disabled) { border-color: var(--theme-500); color: var(--text-foreground); background: var(--bg-muted-hover); }
  .deploy-theme .btn-ghost:disabled { opacity: .3; cursor: not-allowed; }

  .deploy-theme .dot { width: 38px; height: 38px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-border); background: var(--bg-card); font-size: 12px; color: var(--text-muted-foreground); transition: all .35s cubic-bezier(.16,1,.3,1); }
  .deploy-theme .dot.active { border-color: var(--theme-500); color: var(--theme-400); background: color-mix(in srgb, var(--theme-500) 15%, var(--bg-card)); box-shadow: 0 0 0 1px var(--theme-500), 0 0 22px -4px color-mix(in srgb, var(--theme-500) 50%, transparent); }
  .deploy-theme .dot.done { background: var(--theme-500); color: #ffffff; border-color: var(--theme-500); }
  .deploy-theme .conn-fill { height: 100%; background: var(--theme-500); width: 0; transition: width .5s cubic-bezier(.16,1,.3,1); }
  
  .deploy-theme .anim-forward { animation: sR .5s cubic-bezier(.16,1,.3,1); }
  .deploy-theme .anim-back { animation: sL .5s cubic-bezier(.16,1,.3,1); }
  @keyframes sR { from { opacity: 0; transform: translateX(46px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes sL { from { opacity: 0; transform: translateX(-46px); } to { opacity: 1; transform: translateX(0); } }
  
  .deploy-theme .pulse-dot { animation: pd 2.4s infinite; }
  @keyframes pd { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--theme-500) 50%, transparent); } 50% { box-shadow: 0 0 0 6px rgba(0,0,0,0); } }
`;

const RAM = [
  {v:1,label:'Small Testing'},{v:2,label:'Light Server'},{v:3,label:'Vanilla Small'},
  {v:4,label:'Starter Survival'},{v:6,label:'Survival + Plugins'},{v:8,label:'Medium Community'},
  {v:12,label:'High Modded'},{v:16,label:'Large Network'},
  {v:24,label:'Heavy Modpack'},{v:32,label:'High-Traffic'},
  {v:48,label:'Enterprise'},{v:64,label:'Extreme Performance'}
];
const CPU_MAP: Record<number, number> = {1:100,2:100,3:120,4:150,6:180,8:200,12:250,16:300,24:400,32:500,48:700,64:800};

// APPLICATION SOFTWARE
const APPLICATION_SOFTWARE = [
  { id: 'nodejs', name: 'Node.js', desc: 'JS / TS Runtime & Discord Bots', icon: Code2 },
  { id: 'python', name: 'Python', desc: 'Python 3.x Runtime & Scripts', icon: TerminalSquare }
];

const STEPS = ['IDENTITY', 'SOFTWARE', 'VERSION', 'RESOURCES', 'ACCESS', 'REVIEW'];

function CustomDropdown({ value, options, onChange, renderValue, renderOption, placeholder }: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filtered = options.filter((o: any) => 
    (o.label || o.name || o.value || o.v || '').toString().toLowerCase().includes(search.toLowerCase())
  );
  
  const selected = options.find((o: any) => (o.value || o.v) === value);

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        type="button" 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 inp text-left !py-3"
      >
        <span className="flex items-center gap-3 min-w-0">
          {selected ? renderValue(selected) : <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="p-2 border-b border-border bg-muted/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                autoFocus
                className="w-full bg-background border border-border pl-8 pr-2 py-2 text-sm outline-none focus:border-theme-500 rounded-lg transition-colors text-foreground" 
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1 custom-scrollbar">
            {filtered.length > 0 ? filtered.map((o: any, i: number) => {
               const val = o.value || o.v;
               const isSel = val === value;
               return (
                 <div key={i} onClick={() => { onChange(val); setOpen(false); setSearch(''); }}>
                   {renderOption(o, isSel)}
                 </div>
               );
            }) : <p className="px-3 py-3 text-[11px] text-muted-foreground font-mono">NO RESULTS</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const getInitials = (name: string) => name ? name.slice(0, 2).toUpperCase() : '??';

export default function CreateServer() {
  const { defaultRuntime, runtimeLocked, isDev, panelName, panelLogo } = useSettings();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const pName = panelName || 'JTG PANEL';
  const nameParts = pName.split(' ');
  const firstWord = nameParts[0]?.toUpperCase() || 'JTG';
  const restWords = nameParts.slice(1).join(' ').toUpperCase();
  
  // Data
  const [nodes, setNodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [versionSearch, setVersionSearch] = useState('');
  
  // Form State (0 to 5)
  const [currentStep, setCurrentStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [deployed, setDeployed] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [nameError, setNameError] = useState(false);
  const [dir, setDir] = useState('forward');
  
  const [portStatus, setPortStatus] = useState('idle');
  const portCheckIdRef = useRef(0);
  
  // Edition filter inside software step: 'java' | 'bedrock' | 'other'
  const [softwareTab, setSoftwareTab] = useState<'java' | 'bedrock' | 'other'>('java');

  const [state, setState] = useState<{
    name: string;
    desc: string;
    ram: number | string;
    cpu: number | string;
    disk: number | string;
    ip: string;
    port: number | string;
    runtimeType: string;
    owner: string;
    node: string;
    software: string;
    version: string;
    auto: boolean;
  }>({
    name: '', desc: '', ram: 4, cpu: 150, disk: 10, ip: '', port: 25565, runtimeType: 'docker', 
    owner: user?.id || '', node: '', software: 'paper', version: '26.2', auto: true
  });

  useEffect(() => {
    if (defaultRuntime) {
      setState(s => ({ ...s, runtimeType: defaultRuntime }));
    }
  }, [defaultRuntime]);

  // Check port in step 4 (ACCESS)
  useEffect(() => {
    if (currentStep !== 4) return;
    
    const portNum = Number(state.port);
    if (!state.port || isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      setPortStatus('invalid');
      return;
    }
    
    const checkId = ++portCheckIdRef.current;
    setPortStatus('checking');
    
    const timer = setTimeout(() => {
      axios.get(`/api/servers/check-port?port=${portNum}`)
        .then(res => {
          if (checkId === portCheckIdRef.current) {
            setPortStatus(res.data.inUse ? 'used' : 'available');
          }
        })
        .catch(() => {
          if (checkId === portCheckIdRef.current) {
            setPortStatus('error');
          }
        });
    }, 400);
    
    return () => clearTimeout(timer);
  }, [state.port, currentStep]);

  useEffect(() => {
    const link1 = document.createElement("link");
    link1.href = "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500&display=swap";
    link1.rel = "stylesheet";
    document.head.appendChild(link1);
    
    axios.get("/api/nodes").then((res) => {
      setNodes(res.data);
      if (res.data.length > 0 && !state.node) {
        setState(s => ({ ...s, node: res.data[0].id }));
      }
    }).catch(() => {});
    
    if (user?.role === "admin" || user?.role === "owner") {
      axios.get("/api/auth/users").then((res) => setUsers(res.data)).catch(() => {});
    }
    
    return () => {
      document.head.removeChild(link1);
    };
  }, []);

  const updateState = (key: string, val: any) => {
    setState(prev => ({ ...prev, [key]: val }));
  };

  const handleSelectSoftware = (softId: string) => {
    const isApp = softId === 'nodejs' || softId === 'python';
    const isBedrock = softId === 'bedrock' || softId === 'bedrock_preview' || softId === 'pocketmine';
    
    updateState('software', softId);
    if (isApp) {
      if (state.port === 25565 || state.port === 19132) updateState('port', 3000);
      updateState('version', 'latest');
    } else if (isBedrock) {
      if (state.port === 25565 || state.port === 3000) updateState('port', 19132);
      updateState('version', 'latest');
    } else {
      if (state.port === 3000 || state.port === 19132) updateState('port', 25565);
      if (!state.version || state.version === 'latest') updateState('version', '26.2');
    }
  };

  const handleRamClick = (ramVal: number) => {
    let newCpu = state.cpu;
    if (state.auto) {
      newCpu = CPU_MAP[ramVal] || 100;
    }
    setState(prev => ({ ...prev, ram: ramVal, cpu: newCpu }));
  };

  const handleAutoToggle = () => {
    const nextAuto = !state.auto;
    setState(prev => ({ 
      ...prev, 
      auto: nextAuto, 
      cpu: nextAuto ? (CPU_MAP[Number(prev.ram)] || 100) : prev.cpu 
    }));
  };

  const validateStep = async () => {
    if (currentStep === 0 && !state.name.trim()) {
      setNameError(true);
      return false;
    }
    
    if (currentStep === 4) {
      const portNum = Number(state.port);
      if (!state.port || isNaN(portNum) || portNum <= 0 || portNum > 65535) {
        alert("Please enter a valid Server Port (1-65535).");
        return false;
      }
      if (portStatus === 'used') {
        alert("Port is already in use by another server.");
        return false;
      }
      if (portStatus === 'error') {
        alert("Could not verify this port. Try again.");
        return false;
      }
    }
    return true;
  };

  const showStep = (n: number) => {
    setDir(n > currentStep ? 'forward' : 'back');
    setCurrentStep(n);
    setMaxVisited(Math.max(maxVisited, n));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = async () => {
    const isValid = await validateStep();
    if (!isValid) return;
    if (currentStep < STEPS.length - 1) {
      showStep(currentStep + 1);
    } else {
      launch();
    }
  };
  
  const [deployStage, setDeployStage] = useState('Initializing deployment...');
  const deployTimerRef = useRef<any>(null);
  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (deployTimerRef.current) clearInterval(deployTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const launch = async () => {
    if (deployed) return;
    setDeployProgress(8);
    setDeployStage('Configuring instance parameters...');
    
    if (deployTimerRef.current) clearInterval(deployTimerRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    let isCompleted = false;

    deployTimerRef.current = setInterval(() => {
      setDeployProgress(p => {
        if (isCompleted) return 100;
        
        let increment = 0;
        if (p < 30) {
          increment = Math.random() * 4 + 3;
          setDeployStage('Configuring instance parameters...');
        } else if (p < 60) {
          increment = Math.random() * 3 + 2;
          setDeployStage('Allocating server filesystem & assets...');
        } else if (p < 80) {
          increment = Math.random() * 2.5 + 1.5;
          setDeployStage('Provisioning runtime container...');
        } else if (p < 90) {
          increment = Math.random() * 1.5 + 0.8;
          setDeployStage('Finalizing network bindings & port allocations...');
        } else if (p < 95) {
          increment = Math.random() * 0.8 + 0.4;
          setDeployStage('Configuring environment permissions & SFTP...');
        } else if (p < 98) {
          increment = Math.random() * 0.5 + 0.25;
          setDeployStage('Synchronizing runtime daemon state...');
        } else if (p < 99) {
          increment = 0.15;
          setDeployStage('Finalizing container launch...');
        } else {
          increment = 0.02;
        }

        const next = Math.min(99.4, p + increment);
        return next;
      });
    }, 280);

    const markSuccessAndRedirect = () => {
      if (isCompleted) return;
      isCompleted = true;
      if (deployTimerRef.current) clearInterval(deployTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      setDeployStage('Instance ready!');
      setDeployProgress(100);

      setTimeout(() => {
        setDeployed(true);
      }, 400);

      setTimeout(() => {
        navigate("/servers");
      }, 1400);
    };

    pollTimerRef.current = setInterval(async () => {
      if (isCompleted) {
        clearInterval(pollTimerRef.current);
        return;
      }
      try {
        const checkRes = await axios.get("/api/servers");
        if (Array.isArray(checkRes.data)) {
          const match = checkRes.data.find((s: any) => 
            (s.name === state.name || Number(s.port) === Number(state.port)) &&
            (Date.now() - new Date(s.createdAt || 0).getTime() < 120000)
          );
          if (match) {
            markSuccessAndRedirect();
          }
        }
      } catch {}
    }, 2500);

    try {
      const parsedRam = typeof state.ram === 'number' ? state.ram : parseFloat(String(state.ram)) || 4;
      const parsedCpu = typeof state.cpu === 'number' ? state.cpu : parseInt(String(state.cpu), 10) || 150;
      const parsedDisk = typeof state.disk === 'number' ? state.disk : parseInt(String(state.disk), 10) || 10;
      const parsedPort = typeof state.port === 'number' ? state.port : parseInt(String(state.port), 10) || 25565;

      const payload = {
        name: state.name,
        description: state.desc,
        ram: parsedRam,
        cpuLimit: parsedCpu,
        diskLimit: parsedDisk,
        port: parsedPort,
        ipAlias: state.ip,
        type: state.software,
        version: state.version,
        ownerId: state.owner || user?.id,
        runtimeType: state.runtimeType,
        nodeId: state.node
      };
      await axios.post("/api/servers", payload, { timeout: 60000 });
      markSuccessAndRedirect();
    } catch (e: any) {
      if (isCompleted) return;
      if (deployTimerRef.current) clearInterval(deployTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setDeployProgress(0);
      setDeployStage('');
      alert(e.response?.data?.error || e.message || "Failed to deploy container");
    }
  };

  const renderReviewRow = (k: string, v: string) => (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border last:border-0">
      <span className="text-muted-foreground tracking-widest text-[11px] font-mono">{k}</span>
      <span className="text-foreground text-right truncate font-mono font-medium">{v}</span>
    </div>
  );

  const currentSelectedSoftware = SOFTWARE_CATALOG.find(s => s.id === state.software) || 
    APPLICATION_SOFTWARE.find(s => s.id === state.software) || 
    { name: state.software, id: state.software, category: 'java' };

  return (
    <div className="deploy-theme">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
      <div className="noise"></div>
      <div className="bg-grid"></div>
      <div className="scanline"></div>
      
      {/* Progress Line */}
      <div 
        style={{ 
          position: 'fixed', top: 0, left: 0, height: '3px', width: '100%', zIndex: 100, 
          background: 'var(--theme-500)', transformOrigin: 'left', 
          transform: `scaleX(${(currentStep + 1) / STEPS.length})`, 
          boxShadow: '0 0 12px var(--theme-500)', transition: 'transform .5s cubic-bezier(.16,1,.3,1)' 
        }} 
      />

      <div className="relative z-10">
        <nav className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
          <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
            <button onClick={() => navigate('/servers')} className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted-foreground hover:text-foreground transition-colors border border-border hover:border-theme-500 px-3 py-1.5 rounded-lg">
              <ArrowLeft className="w-3.5 h-3.5" /> INSTANCES
            </button>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/servers'); }} className="flex items-center gap-3 group">
              {panelLogo ? (
                <img src={panelLogo} alt={pName} className="w-7 h-7 object-contain rounded" />
              ) : (
                <div className="w-7 h-7 bg-theme-600 rounded-md flex items-center justify-center group-hover:rotate-45 transition-transform duration-500 text-white font-bold text-xs shadow-md shadow-theme-500/20">
                  <div className="w-3 h-3 bg-white rounded-sm"></div>
                </div>
              )}
              <span className="font-display font-bold text-lg tracking-wide uppercase text-foreground">
                {firstWord} {restWords && <span className="text-muted-foreground font-medium">{restWords}</span>}
              </span>
            </a>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-5 pt-10 pb-16">
          <header className="mb-8">
            <p className="font-mono text-[11px] tracking-[0.3em] text-muted-foreground mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-theme-500 rounded-full pulse-dot"></span> NEW CONTAINER
            </p>
            <h1 className="font-display font-bold tracking-tight text-3xl md:text-4xl text-foreground">DEPLOY INSTANCE</h1>
          </header>

          {/* Stepper (1 2 3 4 5 6) */}
          <div className="mb-6 overflow-x-auto pb-2">
            <div className="flex items-start min-w-[540px]">
              {STEPS.map((s, i) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: '64px' }}>
                    <button 
                      type="button" 
                      onClick={() => { if (i <= maxVisited && i !== currentStep && !deployed) showStep(i); }}
                      className={`dot font-mono ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}`}
                    >
                      {i < currentStep ? <Check className="w-4 h-4 stroke-[3]" /> : String(i + 1).padStart(2, '0')}
                    </button>
                    <span className={`mt-2 font-mono text-[9px] tracking-widest text-center uppercase font-bold ${i === currentStep ? 'text-theme-400 font-extrabold' : i < currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {s}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 bg-border mt-[19px] mx-1 overflow-hidden rounded-full">
                      <div className="conn-fill" style={{ width: i < currentStep ? '100%' : '0%' }}></div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Body */}
          <div className="relative border border-border bg-card/75 backdrop-blur-xl p-6 md:p-9 mt-4 rounded-2xl shadow-xl">
            <span className="corner c-tl"></span><span className="corner c-tr"></span>
            <span className="corner c-bl"></span><span className="corner c-br"></span>

            <div className={`${dir === 'forward' ? 'anim-forward' : 'anim-back'}`}>
              
              {/* STEP 1 (Index 0): IDENTITY */}
              {currentStep === 0 && (
                <div className="step-content">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="font-mono text-xs text-theme-400 font-bold">01</span>
                    <h2 className="font-display font-bold tracking-wide text-sm text-foreground">SERVER IDENTITY & DETAILS</h2>
                    <span className="flex-1 h-px bg-border"></span>
                  </div>
                  
                  <label className="flex items-center gap-2 text-sm text-foreground/90 font-medium mb-2.5">
                    <Server className="w-4 h-4 text-theme-400" /> Instance Name <span className="text-theme-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    className={`inp ${nameError ? 'border-theme-500 ring-2 ring-theme-500/20' : ''}`} 
                    placeholder="e.g. Survival SMP" 
                    value={state.name}
                    onChange={(e) => { updateState('name', e.target.value); setNameError(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNext(); } }}
                  />
                  {nameError && (
                    <p className="mt-2 text-xs text-theme-400 font-mono flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Instance name is required.
                    </p>
                  )}

                  <label className="flex items-center gap-2 text-sm text-foreground/90 font-medium mb-2.5 mt-7">
                    <AlignLeft className="w-4 h-4 text-theme-400" /> Description
                  </label>
                  <textarea 
                    className="inp" 
                    style={{ resize: 'vertical', minHeight: '96px', fontFamily: '"IBM Plex Sans", sans-serif' }}
                    placeholder="Short description of this server (optional)"
                    value={state.desc}
                    onChange={(e) => updateState('desc', e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-2 mb-7 font-mono">Helps identify this server in your panel.</p>

                  {(user?.role === "admin" || user?.role === "owner") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4 pt-4 border-t border-border">
                      <div>
                        <label className="flex items-center gap-2 text-sm text-foreground/90 font-medium mb-2.5">
                          <User className="w-4 h-4 text-theme-400" /> Server Owner
                        </label>
                        <CustomDropdown
                          value={state.owner}
                          options={users.map(u => ({ v: u.id, name: u.username, tag: u.role, role: u.role }))}
                          onChange={(v: string) => updateState('owner', v)}
                          placeholder="Select an owner..."
                          renderValue={(o: any) => (
                            <span className="truncate text-foreground font-mono text-sm">{o.name} <span className="text-muted-foreground">({o.tag})</span></span>
                          )}
                          renderOption={(o: any, sel: boolean) => (
                            <button type="button" className={`w-full flex items-center justify-between px-3 py-2.5 text-left font-mono rounded-lg transition-colors ${sel ? 'bg-theme-500/15 text-theme-300 font-bold' : 'hover:bg-muted text-foreground'}`}>
                              <span className="text-sm">{o.name} ({o.tag})</span>
                              {sel && <Check className="w-4 h-4 text-theme-400" />}
                            </button>
                          )}
                        />
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm text-foreground/90 font-medium mb-2.5">
                          <Radio className="w-4 h-4 text-theme-400" /> Target Node
                        </label>
                        <CustomDropdown
                          value={state.node}
                          options={nodes.map(n => ({ v: n.id, label: n.name + ' (' + n.ip + ')' }))}
                          onChange={(v: string) => updateState('node', v)}
                          placeholder="Select a node..."
                          renderValue={(o: any) => (
                            <span className="text-foreground truncate font-mono text-sm">{o.label}</span>
                          )}
                          renderOption={(o: any, sel: boolean) => (
                            <button type="button" className={`w-full flex items-center justify-between px-3 py-2.5 font-mono text-sm rounded-lg transition-colors ${sel ? 'text-theme-300 bg-theme-500/15 font-bold' : 'text-foreground hover:bg-muted'}`}>
                              <span>{o.label}</span>
                              {sel && <Check className="w-4 h-4 text-theme-400" />}
                            </button>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2 (Index 1): SOFTWARE */}
              {currentStep === 1 && (
                <div className="step-content space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-xs text-theme-400 font-bold">02</span>
                    <h2 className="font-display font-bold tracking-wide text-sm uppercase text-foreground">CHOOSE SERVER SOFTWARE</h2>
                    <span className="flex-1 h-px bg-border"></span>
                  </div>

                  {/* Software Edition Tabs */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                    <button
                      type="button"
                      onClick={() => setSoftwareTab('java')}
                      className={`px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-lg transition-all ${
                        softwareTab === 'java' 
                          ? 'bg-theme-600 text-white shadow-md shadow-theme-500/20' 
                          : 'bg-muted text-muted-foreground hover:text-foreground border border-border hover:border-theme-500/40'
                      }`}
                    >
                      JAVA EDITION
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoftwareTab('bedrock')}
                      className={`px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-lg transition-all ${
                        softwareTab === 'bedrock' 
                          ? 'bg-theme-600 text-white shadow-md shadow-theme-500/20' 
                          : 'bg-muted text-muted-foreground hover:text-foreground border border-border hover:border-theme-500/40'
                      }`}
                    >
                      BEDROCK EDITION (WIN10/MCPE)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoftwareTab('other')}
                      className={`px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-lg transition-all ${
                        softwareTab === 'other' 
                          ? 'bg-theme-600 text-white shadow-md shadow-theme-500/20' 
                          : 'bg-muted text-muted-foreground hover:text-foreground border border-border hover:border-theme-500/40'
                      }`}
                    >
                      APPS & BOTS
                    </button>
                  </div>

                  {/* TAB 1: Java Edition */}
                  {softwareTab === 'java' && (
                    <div className="space-y-4 pt-1">
                      <h3 className="text-base sm:text-lg font-bold font-mono text-foreground">
                        Java Edition
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
                        {SOFTWARE_CATALOG.filter(s => s.category === "java").map(soft => {
                          const Icon = soft.icon;
                          const isSelected = state.software === soft.id;
                          return (
                            <button
                              key={soft.id}
                              type="button"
                              onClick={() => handleSelectSoftware(soft.id)}
                              className={`relative group p-5 rounded-xl text-center flex flex-col items-center justify-center border transition-all ${
                                isSelected 
                                  ? 'bg-theme-500/15 border-theme-500 text-theme-300 ring-1 ring-theme-500 shadow-lg shadow-theme-500/20' 
                                  : 'bg-card hover:bg-muted border-border hover:border-theme-500/40 text-foreground'
                              }`}
                            >
                              {soft.badge && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono font-semibold text-theme-400 bg-theme-500/10 px-1.5 py-0.5 rounded">
                                  <Info className="w-3 h-3 text-theme-400" />
                                  <span>{soft.badge}</span>
                                </div>
                              )}
                              
                              <div className="w-12 h-12 rounded-xl bg-theme-500/20 text-theme-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                                <Icon className="w-7 h-7 stroke-[2]" />
                              </div>

                              <div className={`text-sm sm:text-base font-bold font-mono ${isSelected ? 'text-theme-300' : 'text-foreground'}`}>
                                {soft.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Bedrock Edition */}
                  {softwareTab === 'bedrock' && (
                    <div className="space-y-4 pt-1">
                      <h3 className="text-base sm:text-lg font-bold font-mono text-foreground">
                        Bedrock Edition (Win10/MCPE)
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {SOFTWARE_CATALOG.filter(s => s.category === "bedrock").map(soft => {
                          const Icon = soft.icon;
                          const isSelected = state.software === soft.id;
                          return (
                            <button
                              key={soft.id}
                              type="button"
                              onClick={() => handleSelectSoftware(soft.id)}
                              className={`relative group p-5 rounded-xl text-center flex flex-col items-center justify-center border transition-all ${
                                isSelected 
                                  ? 'bg-theme-500/15 border-theme-500 text-theme-300 ring-1 ring-theme-500 shadow-lg shadow-theme-500/20' 
                                  : 'bg-card hover:bg-muted border-border hover:border-theme-500/40 text-foreground'
                              }`}
                            >
                              {soft.badge && (
                                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono font-semibold text-theme-400 bg-theme-500/10 px-1.5 py-0.5 rounded">
                                  <Info className="w-3 h-3 text-theme-400" />
                                  <span>{soft.badge}</span>
                                </div>
                              )}
                              
                              <div className="w-12 h-12 rounded-xl bg-theme-500/20 text-theme-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                                <Icon className="w-7 h-7 stroke-[2]" />
                              </div>

                              <div className={`text-sm sm:text-base font-bold font-mono ${isSelected ? 'text-theme-300' : 'text-foreground'}`}>
                                {soft.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Applications & Bots */}
                  {softwareTab === 'other' && (
                    <div className="space-y-4 pt-1">
                      <h3 className="text-base sm:text-lg font-bold font-mono text-foreground">
                        Application & Bot Runtimes
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {APPLICATION_SOFTWARE.map(soft => {
                          const Icon = soft.icon;
                          const isSelected = state.software === soft.id;
                          return (
                            <button
                              key={soft.id}
                              type="button"
                              onClick={() => handleSelectSoftware(soft.id)}
                              className={`p-5 rounded-xl text-left flex items-start gap-4 border transition-all ${
                                isSelected 
                                  ? 'bg-theme-500/15 border-theme-500 text-theme-300 ring-1 ring-theme-500 shadow-lg shadow-theme-500/20' 
                                  : 'bg-card hover:bg-muted border-border hover:border-theme-500/40 text-foreground'
                              }`}
                            >
                              <div className="w-10 h-10 rounded-lg bg-theme-500/20 text-theme-400 flex items-center justify-center shrink-0">
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-sm font-bold font-mono text-foreground">{soft.name}</div>
                                <div className="text-xs text-muted-foreground mt-1 leading-snug">{soft.desc}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3 (Index 2): VERSION */}
              {currentStep === 2 && (
                <div className="step-content space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-theme-400 font-bold">03</span>
                      <h2 className="font-display font-bold tracking-wide text-lg text-foreground">
                        {currentSelectedSoftware.name}
                      </h2>
                    </div>

                    {/* Version Search */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search version..."
                        value={versionSearch}
                        onChange={(e) => setVersionSearch(e.target.value)}
                        className="w-full bg-card border border-border pl-8 pr-3 py-1.5 text-xs font-mono text-foreground outline-none focus:border-theme-500 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Grid of Version Tags */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                    {SOFTWARE_BUILDS_MAP.filter(b => b.version.toLowerCase().includes(versionSearch.toLowerCase())).map((item, idx) => {
                      const isSelected = state.version === item.version;
                      const isTop = idx === 0;

                      return (
                        <button
                          key={item.version}
                          type="button"
                          onClick={() => updateState('version', item.version)}
                          className={`px-3.5 py-2.5 rounded-xl border font-mono text-left flex items-center gap-2 transition-all ${
                            isSelected
                              ? 'bg-theme-500/20 border-theme-500 text-theme-300 shadow-md shadow-theme-500/20 ring-1 ring-theme-500'
                              : 'bg-card hover:bg-muted border-border hover:border-theme-500/40 text-foreground'
                          }`}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-theme-400 shrink-0" />
                          ) : (
                            <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
                            {item.version} ({item.build})
                          </span>
                          {isTop && (
                            <span className="ml-auto text-[9px] bg-theme-500/20 text-theme-300 px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                              New
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4 (Index 3): RESOURCES */}
              {currentStep === 3 && (
                <div className="step-content">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="font-mono text-xs text-theme-400 font-bold">04</span>
                    <h2 className="font-display font-bold tracking-wide text-sm uppercase text-foreground">RESOURCE ALLOCATION</h2>
                    <span className="flex-1 h-px bg-border"></span>
                  </div>

                  <div className="flex items-center justify-between gap-4 mb-4">
                    <label className="flex items-center gap-2 text-sm text-foreground font-medium">
                      <MemoryStickIcon className="w-4 h-4 text-theme-400" /> RAM Allocation (Memory)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">Custom RAM:</span>
                      <div className="relative w-28">
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          className="inp font-mono !py-1.5 !px-2.5 text-xs text-foreground bg-card border border-border focus:border-theme-500"
                          value={state.ram}
                          onChange={(e) => {
                            const valStr = e.target.value;
                            if (valStr === '') {
                              setState(prev => ({ ...prev, ram: '' }));
                              return;
                            }
                            const val = parseFloat(valStr);
                            if (!isNaN(val)) {
                              const newCpu = state.auto ? (CPU_MAP[val] || Math.max(100, Math.min(1600, Math.round(val * 50 + 50)))) : state.cpu;
                              setState(prev => ({ ...prev, ram: val, cpu: newCpu }));
                            }
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px] font-mono pointer-events-none">GB</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {RAM.map(r => (
                      <button 
                        key={r.v} 
                        type="button" 
                        onClick={() => handleRamClick(r.v)}
                        className={`sel-card p-4 text-left ${r.v === Number(state.ram) ? 'selected' : ''}`}
                      >
                        <span className="tick"><Check className="w-3 h-3 stroke-[3]" /></span>
                        <div className="font-display font-bold text-2xl text-foreground">
                          {r.v}<span className="text-sm text-muted-foreground ml-1">GB</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{r.label}</div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                    <div>
                      <label className="flex items-center gap-2 text-sm text-foreground font-medium mb-2.5">
                        <Cpu className="w-4 h-4 text-theme-400" /> CPU Limit (%)
                      </label>
                      <div className="flex gap-2.5">
                        <div className="relative flex-1">
                          <input 
                            type="number" min="10" 
                            className="inp font-mono pr-10" 
                            value={state.cpu}
                            onChange={(e) => { 
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              updateState('cpu', val); 
                              updateState('auto', false); 
                            }}
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">%</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={handleAutoToggle}
                          className={`px-4 py-3 font-display font-bold text-sm tracking-widest transition-all flex items-center gap-2 whitespace-nowrap rounded-lg border ${state.auto ? 'bg-theme-600 text-white border-theme-600 shadow-md shadow-theme-500/20' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}
                        >
                          {state.auto ? <><Zap className="w-4 h-4" /> AUTO</> : <><SlidersHorizontal className="w-4 h-4" /> MANUAL</>}
                        </button>
                      </div>
                      <p className={`text-[11px] mt-2.5 font-mono flex items-center gap-1.5 ${state.auto ? 'text-theme-400' : 'text-muted-foreground'}`}>
                        {state.auto 
                          ? <><Sparkles className="w-3.5 h-3.5" /> Auto-optimized for {state.ram || 0}GB</> 
                          : <><SlidersHorizontal className="w-3.5 h-3.5" /> Manual override active</>
                        }
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm text-foreground font-medium mb-2.5">
                        <HardDrive className="w-4 h-4 text-theme-400" /> Disk Limit (GB)
                      </label>
                      <input 
                        type="number" min="1" 
                        className="inp font-mono" 
                        value={state.disk}
                        onChange={(e) => updateState('disk', e.target.value === '' ? '' : Number(e.target.value))}
                      />
                      <p className="text-[11px] text-muted-foreground mt-2.5 font-mono flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" /> Storage limit for worlds, logs and data.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5 (Index 4): ACCESS & NETWORK */}
              {currentStep === 4 && (
                <div className="step-content">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="font-mono text-xs text-theme-400 font-bold">05</span>
                    <h2 className="font-display font-bold tracking-wide text-sm uppercase text-foreground">PORT & NETWORK ACCESS</h2>
                    <span className="flex-1 h-px bg-border"></span>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-foreground font-medium mb-2.5">
                    <Network className="w-4 h-4 text-theme-400" /> Server Port
                  </label>
                  <div className="relative mb-4">
                    <input 
                      type="number" className={`inp font-mono ${portStatus === 'used' || portStatus === 'invalid' ? '!border-red-500/60 ring-2 ring-red-500/20' : portStatus === 'available' ? '!border-emerald-500/60 ring-2 ring-emerald-500/20' : ''}`} placeholder="25565" 
                      value={state.port || ''} onChange={e => updateState('port', e.target.value ? Number(e.target.value) : '')}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] tracking-widest flex items-center">
                      {portStatus === 'checking' && <span className="text-muted-foreground">CHECKING...</span>}
                      {portStatus === 'available' && <span className="text-emerald-400 font-bold">AVAILABLE</span>}
                      {portStatus === 'used' && <span className="text-red-400 font-bold">IN USE</span>}
                      {portStatus === 'invalid' && <span className="text-red-400 font-bold">INVALID</span>}
                      {portStatus === 'error' && <span className="text-red-400 font-bold">ERROR</span>}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-2 mb-6 font-mono">
                    {portStatus === 'used' ? "This port is already in use." : portStatus === 'invalid' ? "Port must be between 1 and 65535." : portStatus === 'error' ? "Could not verify this port. Try again." : "The main port the server will bind to."}
                  </p>

                  <label className="flex items-center gap-2 text-sm text-foreground font-medium mb-2.5">
                    <Globe className="w-4 h-4 text-theme-400" /> IP Alias
                  </label>
                  <input 
                    type="text" className="inp font-mono" placeholder="play.myserver.com" 
                    value={state.ip} onChange={e => updateState('ip', e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-2 mb-6 font-mono">Optional domain hostname to display on dashboard.</p>

                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="flex items-center gap-2 text-sm text-foreground font-medium">
                        <Cpu className="w-4 h-4 text-theme-400" /> Execution Runtime Engine
                      </label>
                      <span className="text-[10px] font-mono bg-theme-500/20 text-theme-400 border border-theme-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                        Auto-Configured
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={runtimeLocked}
                        onClick={() => updateState('runtimeType', 'docker')}
                        className={`sel-card p-4 text-left flex flex-col justify-between ${state.runtimeType === 'docker' ? 'selected' : ''} ${runtimeLocked && state.runtimeType !== 'docker' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="tick"><Check className="w-3 h-3 stroke-[3]" /></span>
                        <div>
                          <div className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                            Docker Container
                            {state.runtimeType === 'docker' && <span className="text-[9px] bg-theme-500 text-white px-1.5 py-0.2 rounded font-mono uppercase">Active</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">Isolated sandbox container with resource enforcement & port virtualization.</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={runtimeLocked}
                        onClick={() => updateState('runtimeType', 'local')}
                        className={`sel-card p-4 text-left flex flex-col justify-between ${state.runtimeType === 'local' ? 'selected' : ''} ${runtimeLocked && state.runtimeType !== 'local' ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="tick"><Check className="w-3 h-3 stroke-[3]" /></span>
                        <div>
                          <div className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                            Local Process (Direct)
                            {state.runtimeType === 'local' && <span className="text-[9px] bg-amber-500 text-black font-bold px-1.5 py-0.2 rounded font-mono uppercase">Active</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">Native OS execution with auto-installed OpenJDK JRE. Zero Docker dependency.</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6 (Index 5): REVIEW */}
              {currentStep === 5 && (
                <div className="step-content">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="font-mono text-xs text-theme-400 font-bold">06</span>
                    <h2 className="font-display font-bold tracking-wide text-sm uppercase text-foreground">SPECIFICATION REVIEW</h2>
                    <span className="flex-1 h-px bg-border"></span>
                  </div>
                  
                  {!deployed && deployProgress === 0 && (
                    <div className="font-mono text-[13px] border border-border bg-card/60 rounded-xl overflow-hidden shadow-inner">
                      {renderReviewRow('INSTANCE', state.name || '—')}
                      {renderReviewRow('SOFTWARE', currentSelectedSoftware.name || state.software)}
                      {renderReviewRow('VERSION', state.version || '26.2')}
                      {renderReviewRow('PORT', String(state.port))}
                      {renderReviewRow('RAM', state.ram + ' GB')}
                      {renderReviewRow('CPU ' + (state.auto ? '(AUTO)' : '(MANUAL)'), state.cpu + ' %')}
                      {renderReviewRow('DISK', state.disk + ' GB')}
                      {renderReviewRow('IP ALIAS', state.ip || '—')}
                      {(user?.role === "admin" || user?.role === "owner") && renderReviewRow('NODE ID', state.node || '—')}
                    </div>
                  )}

                  {deployProgress > 0 && !deployed && (
                    <div className="mt-6 border border-border bg-card p-5 rounded-xl shadow-lg">
                      <div className="flex justify-between items-center mb-2.5">
                        <span className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-theme-500 animate-pulse"></span>
                          {deployStage || "Provisioning container..."}
                        </span>
                        <span className="text-sm font-mono text-foreground font-bold">{Math.round(deployProgress)}%</span>
                      </div>
                      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-theme-500 transition-all duration-300 rounded-full" style={{ width: `${deployProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  {deployed && (
                    <div className="mt-6 border border-theme-500/50 bg-theme-500/10 p-6 rounded-2xl text-center">
                      <div className="w-12 h-12 mx-auto mb-3 bg-theme-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-theme-500/30">
                        <Check className="w-6 h-6 stroke-[3]" />
                      </div>
                      <p className="font-display font-bold text-lg text-foreground">Instance Deployed Successfully</p>
                      <p className="text-muted-foreground text-sm mt-1 font-mono">
                        {state.name} → {state.ram}GB ({currentSelectedSoftware.name} {state.version})
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* NAV BUTTONS */}
            <div className="flex items-center justify-between gap-3 mt-9 pt-7 border-t border-border">
              <button 
                type="button" 
                onClick={() => { if (currentStep > 0) showStep(currentStep - 1); }}
                disabled={currentStep === 0 || deployed || deployProgress > 0}
                className="btn-ghost px-5 py-3 text-sm font-medium flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> BACK
              </button>
              
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground hidden sm:block">
                STEP {currentStep + 1} / {STEPS.length}
              </span>
              
              <button 
                type="button" 
                onClick={handleNext}
                disabled={deployed || deployProgress > 0}
                className="btn-primary-action px-7 py-3 text-sm font-display font-bold tracking-widest flex items-center gap-2 cursor-pointer"
              >
                <span>{currentStep === STEPS.length - 1 ? (deployed ? 'DEPLOYED' : 'LAUNCH') : 'NEXT'}</span>
                {currentStep === STEPS.length - 1 ? <Rocket className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4 rotate-180" />}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
