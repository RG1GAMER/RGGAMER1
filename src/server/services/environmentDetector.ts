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

/**
 * Detects the specific VPS or Cloud Hosting Provider
 */
async function detectVPSProvider(): Promise<{
  providerName: string;
  providerType: "vps" | "cloud_vm" | "cloud_container" | "dedicated" | "local_pc" | "codespaces";
  details: string;
  hypervisor: string;
}> {
  // 1. Google Cloud Platform / Cloud Run / GCE
  if (process.env.K_SERVICE || process.env.CLOUD_RUN_JOB || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT) {
    return {
      providerName: "Google Cloud (Cloud Run / GCE)",
      providerType: "cloud_container",
      details: "Google Cloud Platform managed container infrastructure with auto-scaling compute.",
      hypervisor: "Google gVisor / OCI Sandbox"
    };
  }

  // 2. GitHub Codespaces / Actions
  if (process.env.CODESPACES === "true" || process.env.GITHUB_CODESPACE === "true") {
    return {
      providerName: "GitHub Codespaces (Microsoft Azure)",
      providerType: "codespaces",
      details: "GitHub Cloud Development VM containerized on Azure infrastructure.",
      hypervisor: "Docker / Azure Container"
    };
  }

  // 3. AWS EC2 / Lightsail / ECS
  if (process.env.AWS_EXECUTION_ENV || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION) {
    return {
      providerName: "Amazon Web Services (AWS EC2 / Lightsail)",
      providerType: "cloud_vm",
      details: "AWS Elastic Compute Cloud (EC2 / Lightsail) virtual private server instance.",
      hypervisor: "AWS Nitro / Xen Hypervisor"
    };
  }

  // 4. DigitalOcean
  if (process.env.DIGITALOCEAN_ORIGIN || (process.env.USER && process.env.USER.includes("do-user"))) {
    return {
      providerName: "DigitalOcean Droplet",
      providerType: "vps",
      details: "DigitalOcean cloud VPS instance with high-speed SSD storage.",
      hypervisor: "KVM Virtualization"
    };
  }

  // 5. CodeSandbox / Web Sandbox
  if (
    process.env.CODESANDBOX_SSE === "true" ||
    process.env.CSB === "true" ||
    process.env.SANDBOX_URL ||
    process.env.SANDBOX_ID ||
    process.env.WEB_CONTAINER === "true"
  ) {
    return {
      providerName: "Cloud Web Sandbox / Container",
      providerType: "cloud_container",
      details: "Isolated cloud development sandbox container.",
      hypervisor: "MicroVM / OCI Container"
    };
  }

  // Check hardware DMI & system vendors if Linux
  if (process.platform === "linux") {
    try {
      let sysVendor = "";
      let productName = "";
      let biosVendor = "";

      if (await fs.pathExists("/sys/class/dmi/id/sys_vendor")) {
        sysVendor = (await fs.readFile("/sys/class/dmi/id/sys_vendor", "utf8")).trim().toLowerCase();
      }
      if (await fs.pathExists("/sys/class/dmi/id/product_name")) {
        productName = (await fs.readFile("/sys/class/dmi/id/product_name", "utf8")).trim().toLowerCase();
      }
      if (await fs.pathExists("/sys/class/dmi/id/bios_vendor")) {
        biosVendor = (await fs.readFile("/sys/class/dmi/id/bios_vendor", "utf8")).trim().toLowerCase();
      }

      // Check systemd-detect-virt if available
      let virtOut = "";
      try {
        const { stdout } = await execAsync("systemd-detect-virt 2>/dev/null || true", { timeout: 1500 });
        virtOut = stdout.trim().toLowerCase();
      } catch {}

      // Hetzner
      if (sysVendor.includes("hetzner") || productName.includes("hetzner") || biosVendor.includes("hetzner")) {
        return {
          providerName: "Hetzner Cloud VPS",
          providerType: "vps",
          details: "Hetzner Cloud high-performance NVMe virtual private server.",
          hypervisor: virtOut || "KVM"
        };
      }

      // Contabo
      if (sysVendor.includes("contabo") || productName.includes("contabo") || biosVendor.includes("contabo")) {
        return {
          providerName: "Contabo VPS",
          providerType: "vps",
          details: "Contabo Cloud VPS with dedicated storage and multi-core CPU.",
          hypervisor: virtOut || "KVM"
        };
      }

      // OVHcloud / SoYouStart / Kimsufi
      if (sysVendor.includes("ovh") || productName.includes("ovh") || biosVendor.includes("ovh")) {
        return {
          providerName: "OVHcloud VPS / Dedicated",
          providerType: "vps",
          details: "OVHcloud anti-DDoS protected virtual or dedicated server.",
          hypervisor: virtOut || "KVM / OpenStack"
        };
      }

      // Oracle Cloud Infrastructure (OCI)
      if (sysVendor.includes("oracle") || productName.includes("oraclecloud") || biosVendor.includes("oracle")) {
        return {
          providerName: "Oracle Cloud (OCI) Compute Instance",
          providerType: "cloud_vm",
          details: "Oracle Cloud Infrastructure compute instance.",
          hypervisor: virtOut || "KVM"
        };
      }

      // Microsoft Azure
      if (sysVendor.includes("microsoft") || productName.includes("virtual machine") || biosVendor.includes("microsoft")) {
        return {
          providerName: "Microsoft Azure Virtual Machine",
          providerType: "cloud_vm",
          details: "Microsoft Azure enterprise cloud virtual machine.",
          hypervisor: virtOut || "Hyper-V / Azure Hypervisor"
        };
      }

      // Google Compute Engine (GCE)
      if (sysVendor.includes("google") || productName.includes("google compute engine")) {
        return {
          providerName: "Google Compute Engine (GCP VPS)",
          providerType: "vps",
          details: "Google Cloud Platform Compute Engine Virtual Private Server.",
          hypervisor: virtOut || "KVM"
        };
      }

      // Linode / Akamai
      if (sysVendor.includes("linode") || productName.includes("linode")) {
        return {
          providerName: "Linode / Akamai Cloud VPS",
          providerType: "vps",
          details: "Linode high-speed cloud compute instance.",
          hypervisor: virtOut || "KVM"
        };
      }

      // Vultr
      if (sysVendor.includes("vultr") || productName.includes("vultr")) {
        return {
          providerName: "Vultr Cloud Compute",
          providerType: "vps",
          details: "Vultr SSD / NVMe cloud virtual server.",
          hypervisor: virtOut || "KVM"
        };
      }

      // KVM / QEMU Generic VPS
      if (sysVendor.includes("qemu") || productName.includes("kvm") || virtOut === "kvm" || virtOut === "qemu") {
        return {
          providerName: "Linux KVM / QEMU Virtual Private Server (VPS)",
          providerType: "vps",
          details: "Hardware-accelerated KVM virtual private server with dedicated resources.",
          hypervisor: "KVM (Kernel-based Virtual Machine)"
        };
      }

      // VMware / ESXi
      if (sysVendor.includes("vmware") || virtOut === "vmware") {
        return {
          providerName: "VMware vSphere / ESXi Virtual Server",
          providerType: "vps",
          details: "Enterprise VMware hypervisor virtual machine.",
          hypervisor: "VMware ESXi Hypervisor"
        };
      }

      // Docker / LXC Container
      if (virtOut === "docker" || virtOut === "lxc" || (await fs.pathExists("/.dockerenv"))) {
        return {
          providerName: "Docker / LXC Container Instance",
          providerType: "cloud_container",
          details: "Containerized Linux guest environment with shared kernel isolation.",
          hypervisor: virtOut === "lxc" ? "LXC Container" : "Docker / OCI Engine"
        };
      }

      // Bare Metal / Physical Server
      if (virtOut === "none" || (!virtOut && !sysVendor.includes("virtual"))) {
        return {
          providerName: "Bare Metal Dedicated Linux Server",
          providerType: "dedicated",
          details: "Physical bare-metal server with direct hardware access (no hypervisor overhead).",
          hypervisor: "None (Physical Bare Metal)"
        };
      }
    } catch {}
  }

  // Windows / Mac or fallback
  if (process.platform === "win32") {
    return {
      providerName: "Windows Server / Desktop Host",
      providerType: "local_pc",
      details: "Microsoft Windows operating system host environment.",
      hypervisor: "Native OS / Hyper-V"
    };
  }

  if (process.platform === "darwin") {
    return {
      providerName: "Apple macOS Host System",
      providerType: "local_pc",
      details: "Apple Darwin Unix operating system workstation.",
      hypervisor: "Native Apple Silicon / Darwin"
    };
  }

  return {
    providerName: "Standard Linux Virtual Private Server (VPS)",
    providerType: "vps",
    details: "Linux virtual server host running Node.js runtime.",
    hypervisor: "Linux Virtualization"
  };
}

/**
 * Detects the Console & Terminal subsystem
 */
async function detectConsoleSystem(): Promise<{
  consoleType: string;
  shell: string;
  terminalStatus: "detected" | "warning";
  details: string;
  features: string[];
}> {
  const shell = process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "/bin/bash");
  const isTTY = Boolean(process.stdout.isTTY || process.stdin.isTTY);
  
  // Check if bash/sh is available
  let bashVersion = "Standard Shell";
  try {
    const { stdout } = await execAsync("bash --version 2>/dev/null || sh --version 2>/dev/null || true", { timeout: 1500 });
    const match = stdout.match(/GNU bash, version\s+([0-9.]+)/i);
    if (match) {
      bashVersion = `GNU Bash v${match[1]}`;
    }
  } catch {}

  const features: string[] = [
    "WebSocket Stream Bridge",
    "ANSI Color Rendering",
    "Real-time Stdout / Stderr Interceptor",
    "Interactive Command Dispatcher"
  ];

  if (process.env.PM2_HOME || process.env.pm_id) {
    features.push("PM2 Process Supervisor");
  }

  return {
    consoleType: "Interactive Linux Web Terminal & Process Stream",
    shell: `${shell} (${bashVersion})`,
    terminalStatus: "detected",
    details: `Interactive virtual console attached. Supports live log streaming, ANSI escape codes, and stdin command transmission.`,
    features
  };
}

export interface DetectionItem {
  id: string;
  name: string;
  category: "vps" | "console" | "hardware" | "virtualization" | "network";
  status: "detected" | "missing" | "warning";
  value?: string;
  details: string;
  required: boolean;
  actionHint?: string;
}

export interface DeepDetectionReport {
  timestamp: string;
  overallStatus: "success" | "warning" | "error";
  summary: {
    totalChecks: number;
    detectedCount: number;
    missingCount: number;
    warningCount: number;
  };
  headline: string;
  speechText: string;
  vps: {
    providerName: string;
    providerType: string;
    hypervisor: string;
    details: string;
  };
  console: {
    consoleType: string;
    shell: string;
    details: string;
    features: string[];
  };
  items: DetectionItem[];
  environment: EnvironmentInfo;
}

/**
 * Performs auto-detection focused strictly on VPS Type, Console, Virtualization, and Hardware Architecture.
 */
export async function performDeepAutoDetection(): Promise<DeepDetectionReport> {
  const envInfo = await detectEnvironment(true);
  const vpsInfo = await detectVPSProvider();
  const consoleInfo = await detectConsoleSystem();
  const items: DetectionItem[] = [];

  // 1. VPS / Cloud Provider Detection
  items.push({
    id: "vps_provider",
    name: "VPS & Cloud Hosting Provider",
    category: "vps",
    status: "detected",
    value: vpsInfo.providerName,
    details: `${vpsInfo.details} (Host: ${envInfo.hostname})`,
    required: true
  });

  // 2. Virtualization & Hypervisor Engine
  items.push({
    id: "virtualization_type",
    name: "Virtualization & Hypervisor",
    category: "virtualization",
    status: "detected",
    value: vpsInfo.hypervisor,
    details: `Compute Virtualization: ${vpsInfo.hypervisor} • Host Platform: ${envInfo.platform} (${envInfo.arch})`,
    required: true
  });

  // 3. Server Console & Terminal Subsystem
  items.push({
    id: "console_subsystem",
    name: "Server Console & Terminal Engine",
    category: "console",
    status: "detected",
    value: consoleInfo.consoleType,
    details: `${consoleInfo.details} • Active Shell: ${consoleInfo.shell}`,
    required: true
  });

  // 4. Operating System & Linux Kernel
  let kernelVersion = "";
  try {
    const { stdout } = await execAsync("uname -r 2>/dev/null || true", { timeout: 1500 });
    kernelVersion = stdout.trim();
  } catch {}

  items.push({
    id: "os_kernel",
    name: "Operating System & Kernel",
    category: "vps",
    status: "detected",
    value: `${envInfo.distro} (${envInfo.arch})`,
    details: `Distribution: ${envInfo.distro}${kernelVersion ? ` • Kernel: ${kernelVersion}` : ""} • Architecture: ${envInfo.arch}`,
    required: true
  });

  // 5. VPS Hardware: CPU Cores & Model
  items.push({
    id: "vps_cpu",
    name: "VPS CPU & Processing Cores",
    category: "hardware",
    status: "detected",
    value: `${envInfo.hardware.cpuCores} vCPU / Core(s) (${envInfo.hardware.cpuModel})`,
    details: `Assigned Processing Units: ${envInfo.hardware.cpuCores} core(s) • Model: ${envInfo.hardware.cpuModel}`,
    required: true
  });

  // 6. VPS Hardware: RAM & Memory Allocation
  items.push({
    id: "vps_ram",
    name: "VPS RAM & Memory Allocation",
    category: "hardware",
    status: "detected",
    value: `${envInfo.hardware.totalMemoryGB} GB Total (${envInfo.hardware.freeMemoryGB} GB Free Available)`,
    details: `Total Physical / Virtual RAM: ${envInfo.hardware.totalMemoryGB} GB • Free Memory: ${envInfo.hardware.freeMemoryGB} GB`,
    required: true
  });

  // 7. Public & Local Network Addressing
  items.push({
    id: "network_ip",
    name: "Public WAN IP & Local Network Gateway",
    category: "network",
    status: "detected",
    value: envInfo.capabilities.publicIp ? `Public IP: ${envInfo.capabilities.publicIp}` : `Local IP: ${envInfo.capabilities.localIp || "127.0.0.1"}`,
    details: `Public WAN IP: ${envInfo.capabilities.publicIp || "Cloud NAT / Internal"} • Local Gateway IP: ${envInfo.capabilities.localIp || "127.0.0.1"}`,
    required: true
  });

  // 8. Process Supervisor & Daemon Runtime
  const supervisorName = process.env.PM2_HOME || process.env.pm_id ? "PM2 Process Manager" : "Node.js System Service Daemon";
  items.push({
    id: "process_supervisor",
    name: "Console Process Supervisor & Uptime",
    category: "console",
    status: "detected",
    value: `${supervisorName} (Uptime: ${Math.floor(envInfo.uptime / 60)} min)`,
    details: `Process supervisory layer running. Features: ${consoleInfo.features.join(", ")}`,
    required: true
  });

  // Summary counts
  const detectedCount = items.filter((i) => i.status === "detected").length;
  const missingCount = items.filter((i) => i.status === "missing").length;
  const warningCount = items.filter((i) => i.status === "warning").length;

  const headline = `VPS & Console Detected: ${vpsInfo.providerName} • ${consoleInfo.consoleType}`;
  const speechText = `Successful! Detected ${vpsInfo.providerName} with active console.`;

  return {
    timestamp: new Date().toISOString(),
    overallStatus: "success",
    summary: {
      totalChecks: items.length,
      detectedCount,
      missingCount,
      warningCount
    },
    headline,
    speechText,
    vps: {
      providerName: vpsInfo.providerName,
      providerType: vpsInfo.providerType,
      hypervisor: vpsInfo.hypervisor,
      details: vpsInfo.details
    },
    console: {
      consoleType: consoleInfo.consoleType,
      shell: consoleInfo.shell,
      details: consoleInfo.details,
      features: consoleInfo.features
    },
    items,
    environment: envInfo
  };
}
