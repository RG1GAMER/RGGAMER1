import os from "os";
import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";

const execAsync = promisify(exec);

export type DetectedEnvironmentType = "sandbox" | "codespaces" | "pc" | "vps" | "docker_container";

export interface EnvironmentInfo {
  environmentType: DetectedEnvironmentType;
  environmentName: string;
  environmentBadge: string;
  recommendedRuntime: "local" | "docker";
  isSandbox: boolean;
  isCodespaces: boolean;
  isPC: boolean;
  isVPS: boolean;
  platform: string;
  distro: string;
  arch: string;
  hostname: string;
  uptime: number;
  hardware: {
    totalMemoryGB: number;
    freeMemoryGB: number;
    cpuCores: number;
    cpuModel: string;
  };
  capabilities: {
    dockerAvailable: boolean;
    dockerVersion?: string;
    javaAvailable: boolean;
    javaVersion?: string;
    nodeAvailable: boolean;
    nodeVersion?: string;
    pythonAvailable: boolean;
    pythonVersion?: string;
    playitAvailable: boolean;
    publicIp?: string;
    localIp?: string;
  };
  autoTunedSettings: {
    suggestedDefaultRuntime: "local" | "docker";
    defaultPort: number;
    allowDockerSelection: boolean;
    notes: string[];
  };
}

let cachedEnvInfo: EnvironmentInfo | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Detects if the current process is running in a web sandbox (CodeSandbox, Sandbox.io, StackBlitz, etc.)
 */
function checkIsSandbox(): boolean {
  // Check known Sandbox environment variables
  if (
    process.env.CODESANDBOX_SSE === "true" ||
    process.env.CSB === "true" ||
    process.env.SANDBOX_URL ||
    process.env.SANDBOX_ID ||
    process.env.HOSTNAME?.includes("csb") ||
    process.env.HOSTNAME?.includes("sandbox") ||
    process.env.WEB_CONTAINER === "true" ||
    process.env.STACKBLITZ === "true" ||
    process.env.REPLIT_DB_URL ||
    process.env.REPL_ID
  ) {
    return true;
  }

  // If in a non-root environment where Docker is strictly missing and memory/proc are containerized
  const isCloudRun = !!process.env.K_SERVICE || !!process.env.CLOUD_RUN_JOB;
  if (isCloudRun) {
    return true;
  }

  return false;
}

/**
 * Detects if running inside GitHub Codespaces or GitHub Actions
 */
function checkIsCodespaces(): boolean {
  return (
    process.env.CODESPACES === "true" ||
    process.env.GITHUB_CODESPACE === "true" ||
    !!process.env.CODESPACE_NAME ||
    process.env.GITHUB_ACTIONS === "true"
  );
}

/**
 * Detects if running on a local desktop / personal computer (Windows, Mac, or Linux desktop)
 */
function checkIsPC(): boolean {
  const p = process.platform;
  if (p === "win32" || p === "darwin") return true;

  // Linux Desktop check
  if (
    process.env.DESKTOP_SESSION ||
    process.env.XDG_CURRENT_DESKTOP ||
    process.env.GDMSESSION ||
    process.env.USERPROFILE
  ) {
    return true;
  }

  // Not a VPS / Cloud VM if hostname is typical local PC and not sandbox/codespaces
  return false;
}

/**
 * Check if Docker daemon is running and responsive
 */
async function checkDockerAvailability(): Promise<{ available: boolean; version?: string }> {
  try {
    const socketPath =
      process.platform === "win32"
        ? "//./pipe/docker_engine"
        : process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock";

    if (process.platform !== "win32" && !fs.existsSync(socketPath) && !fs.existsSync("/run/docker.sock")) {
      return { available: false };
    }

    const { stdout } = await execAsync("docker --version", { timeout: 3000 });
    const versionMatch = stdout.match(/Docker version\s+([0-9.]+)/i);
    return {
      available: true,
      version: versionMatch ? versionMatch[1] : stdout.trim()
    };
  } catch {
    return { available: false };
  }
}

/**
 * Check installed Java runtime
 */
async function checkJavaAvailability(): Promise<{ available: boolean; version?: string }> {
  try {
    // 1. Check workspace portable JREs first
    const binDir = path.join(process.cwd(), ".data", "bin");
    if (await fs.pathExists(binDir)) {
      const dirs = await fs.readdir(binDir);
      const jreDir = dirs.find((d) => d.startsWith("jre-"));
      if (jreDir) {
        return { available: true, version: `${jreDir} (Portable OpenJDK)` };
      }
    }

    const { stdout, stderr } = await execAsync("java -version", { timeout: 3000 });
    const output = stdout || stderr || "";
    const match = output.match(/version\s+"?([0-9._]+)"?/i);
    return {
      available: true,
      version: match ? `Java ${match[1]}` : "Installed"
    };
  } catch {
    return { available: false };
  }
}

/**
 * Check installed Node.js runtime
 */
function checkNodeAvailability(): { available: boolean; version?: string } {
  return {
    available: true,
    version: process.version
  };
}

/**
 * Check installed Python runtime
 */
async function checkPythonAvailability(): Promise<{ available: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync("python3 --version || python --version", { timeout: 3000 });
    return {
      available: true,
      version: stdout.trim()
    };
  } catch {
    return { available: false };
  }
}

/**
 * Check Playit.gg binary availability
 */
async function checkPlayitAvailability(): Promise<boolean> {
  try {
    if (await fs.pathExists(path.join(process.cwd(), ".data", "bin", "playit"))) {
      return true;
    }
    const { stdout } = await execAsync("which playit", { timeout: 2000 });
    return !!stdout.trim();
  } catch {
    return false;
  }
}

/**
 * Resolve local and public IP addresses
 */
async function resolveIPAddresses(): Promise<{ localIp: string; publicIp?: string }> {
  let localIp = "127.0.0.1";
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    const list = ifaces[name];
    if (list) {
      for (const iface of list) {
        if (iface.family === "IPv4" && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
    }
    if (localIp !== "127.0.0.1") break;
  }

  let publicIp: string | undefined = undefined;
  try {
    const res = await axios.get("https://api.ipify.org?format=json", { timeout: 2000 });
    if (res.data && res.data.ip) {
      publicIp = res.data.ip;
    }
  } catch {
    // Non-fatal if offline or blocked
  }

  return { localIp, publicIp };
}

/**
 * Get Linux OS distribution name if applicable
 */
async function getDistroName(): Promise<string> {
  const p = process.platform;
  if (p === "win32") return "Microsoft Windows";
  if (p === "darwin") return "Apple macOS";

  try {
    if (await fs.pathExists("/etc/os-release")) {
      const content = await fs.readFile("/etc/os-release", "utf8");
      const match = content.match(/PRETTY_NAME="([^"]+)"/);
      if (match) return match[1];
    }
  } catch {}

  return "Linux";
}

/**
 * Main Environment Auto-Detection Function
 */
export async function detectEnvironment(forceRefresh = false): Promise<EnvironmentInfo> {
  const now = Date.now();
  if (cachedEnvInfo && !forceRefresh && now - lastCheckTime < CACHE_TTL_MS) {
    return cachedEnvInfo;
  }

  const isSb = checkIsSandbox();
  const isCode = !isSb && checkIsCodespaces();
  const isPc = !isSb && !isCode && checkIsPC();
  const isVps = !isSb && !isCode && !isPc;

  const [dockerStatus, javaStatus, pythonStatus, playitAvail, ipInfo, distro] = await Promise.all([
    checkDockerAvailability(),
    checkJavaAvailability(),
    checkPythonAvailability(),
    checkPlayitAvailability(),
    resolveIPAddresses(),
    getDistroName()
  ]);

  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  let envType: DetectedEnvironmentType = "vps";
  let envName = "Linux VPS / Cloud Server";
  let envBadge = "VPS Server";
  let recommendedRuntime: "local" | "docker" = dockerStatus.available ? "docker" : "local";
  const notes: string[] = [];

  if (isSb) {
    envType = "sandbox";
    envName = "CodeSandbox / Cloud Web Sandbox";
    envBadge = "Cloud Sandbox";
    recommendedRuntime = "local";
    notes.push("Sandbox environment detected: Local Process Runtime auto-enabled for instant zero-dependency execution.");
    notes.push("Native Java OpenJDK auto-installer active for all Minecraft versions (Paper, Purpur, Velocity, Spigot).");
  } else if (isCode) {
    envType = "codespaces";
    envName = "GitHub Codespaces / DevContainer";
    envBadge = "GitHub Codespaces";
    recommendedRuntime = dockerStatus.available ? "docker" : "local";
    notes.push("GitHub Codespaces detected: Use port forwarding tab (ports 3000, 25565) to share servers with friends.");
    if (dockerStatus.available) {
      notes.push("Docker daemon is active inside Codespaces container.");
    }
  } else if (isPc) {
    envType = "pc";
    envName = process.platform === "win32" ? "Windows PC / Local Workstation" : (process.platform === "darwin" ? "macOS Desktop" : "Linux PC / Workstation");
    envBadge = "Local PC";
    recommendedRuntime = dockerStatus.available ? "docker" : "local";
    notes.push("Running locally on Personal Computer / Desktop Control Panel.");
    if (process.platform === "win32") {
      notes.push("Windows native process mode active. Ensure Minecraft ports (25565) are permitted in Windows Defender Firewall.");
    }
  } else {
    envType = "vps";
    envName = `${distro} (Cloud / Dedicated VPS)`;
    envBadge = "Production VPS";
    recommendedRuntime = dockerStatus.available ? "docker" : "local";
    notes.push(`Production VPS detected (${distro}). Optimal performance mode enabled.`);
    if (dockerStatus.available) {
      notes.push("Docker engine detected and ready for isolated container virtualization.");
    } else {
      notes.push("Local high-speed native process mode active (Adoptium JRE automatic manager enabled).");
    }
  }

  const envInfo: EnvironmentInfo = {
    environmentType: envType,
    environmentName: envName,
    environmentBadge: envBadge,
    recommendedRuntime,
    isSandbox: isSb,
    isCodespaces: isCode,
    isPC: isPc,
    isVPS: isVps,
    platform: process.platform,
    distro,
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: Math.round(os.uptime()),
    hardware: {
      totalMemoryGB: parseFloat((totalMem / (1024 * 1024 * 1024)).toFixed(1)),
      freeMemoryGB: parseFloat((freeMem / (1024 * 1024 * 1024)).toFixed(1)),
      cpuCores: cpus.length || 1,
      cpuModel: cpus[0]?.model || "Generic CPU"
    },
    capabilities: {
      dockerAvailable: dockerStatus.available,
      dockerVersion: dockerStatus.version,
      javaAvailable: javaStatus.available,
      javaVersion: javaStatus.version,
      nodeAvailable: checkNodeAvailability().available,
      nodeVersion: checkNodeAvailability().version,
      pythonAvailable: pythonStatus.available,
      pythonVersion: pythonStatus.version,
      playitAvailable: playitAvail,
      publicIp: ipInfo.publicIp,
      localIp: ipInfo.localIp
    },
    autoTunedSettings: {
      suggestedDefaultRuntime: recommendedRuntime,
      defaultPort: 25565,
      allowDockerSelection: dockerStatus.available,
      notes
    }
  };

  cachedEnvInfo = envInfo;
  lastCheckTime = now;
  return envInfo;
}
