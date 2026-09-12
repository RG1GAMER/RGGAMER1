import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { readJSON, writeJSON } from "../services/db.js";
import {
  createServerRuntime,
  startServerRuntime,
  stopServerRuntime,
  restartServerRuntime,
  deleteServerRuntime,
  getServerRuntimeStatus,
  getServerRuntimeStats,
  sendServerRuntimeCommand,
  attachServerRuntimeSocket
} from "../services/runtime.js";
import { getLocalProcessInfo } from "../services/local.js";
import { createSftpUser, deleteSftpUser } from "../services/sftp.js";
import { downloadJar } from "../services/jarDownloader.js";
import { getJavaVersionForMinecraft, getDataVersionForMinecraft, getWorldDataVersion } from "../services/minecraft.js";
import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import { ZipArchive } from "archiver";
import extract from "extract-zip";
import { extractArchive } from "../utils/extract.js";
import { getServerDiskUsageGB } from "../services/metrics.js";
import { ServerResourceStats, ServerMetricSource, ServerMemoryStats, ServerCpuStats, ServerDiskStats } from "../../types/stats.js";
import {
  secureDirectoryPermissions,
  secureFilePermissions,
  secureExecutablePermissions,
  secureChmod
} from "../utils/permissions.js";
import {
  startPlayitAgent,
  stopPlayitAgent,
  runServerPlayitHealthCheck,
  addPlayitAudit,
  getTrackedPlayerCount
} from "../services/playitHealth.js";
import { ensureDefaultWorldStructure, ensureAternosStandardServerFiles } from "./world.js";

export const isUserServerAuthorized = (user: any, server: any): boolean => {
  if (!user || !server) return false;
  if (user.role === "admin" || user.role === "owner") return true;
  // If server has no owner specified, it belongs to the active user or panel
  if (!server.owner && !server.ownerId && !server.ownerUsername) return true;
  if (server.owner && String(server.owner) === String(user.id)) return true;
  if (server.ownerId && String(server.ownerId) === String(user.id)) return true;
  if (user.username) {
    const un = user.username.toLowerCase();
    if (server.owner && typeof server.owner === "string" && server.owner.toLowerCase() === un) return true;
    if (server.ownerId && typeof server.ownerId === "string" && server.ownerId.toLowerCase() === un) return true;
    if (server.ownerUsername && typeof server.ownerUsername === "string" && server.ownerUsername.toLowerCase() === un) return true;
  }
  return false;
};

export const getServers = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const servers = await readJSON("servers.json") || [];
  
  // Filter for normal users with comprehensive authorization
  const userServers = (user.role === "admin" || user.role === "owner") 
    ? servers 
    : servers.filter((s: any) => isUserServerAuthorized(user, s));

  // Update statuses
  const updatedServers = await Promise.all(userServers.map(async (server: any) => {
    if (server.containerId) {
      const status = await getServerRuntimeStatus(server);
      const isRunning = !!status?.State?.Running;
      server.status = isRunning ? "online" : "offline";
      server.startedAt = isRunning ? (status?.State?.StartedAt || server.startedAt || new Date().toISOString()) : null;
      if (server.runtimeType === 'local') {
          const info = getLocalProcessInfo(server.id);
          if (info) {
              server.pid = info.pid;
              server.jarPath = info.jarPath;
              server.logPath = info.logPath;
          }
      }
    }
    return server;
  }));

  res.json(updatedServers);
};

export const getServer = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const servers = await readJSON("servers.json") || [];
  const server = servers.find((s: any) => s.id === id);
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (!isUserServerAuthorized(user, server)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const status = await getServerRuntimeStatus(server);
  const isRunning = !!status?.State?.Running || server.status === "online";
  server.status = isRunning ? "online" : "offline";
  server.startedAt = isRunning ? (status?.State?.StartedAt || server.startedAt || new Date().toISOString()) : null;
  if (server.runtimeType === 'local') {
      const info = getLocalProcessInfo(server.id);
      if (info) {
          server.pid = info.pid;
          server.jarPath = info.jarPath;
          server.logPath = info.logPath;
      }
  }
  res.json(server);
};

export const getServerStats = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;
  const servers = (await readJSON("servers.json")) || [];
  const server = servers.find((s: any) => s.id === id);
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }
  if (!isUserServerAuthorized(user, server)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const status = await getServerRuntimeStatus(server);
  const isRunning = !!status?.State?.Running || server.status === "online";
  const startedAt = isRunning ? (status?.State?.StartedAt || server.startedAt || new Date().toISOString()) : null;
  let uptimeSeconds = 0;
  if (isRunning && startedAt) {
    const startedMs = new Date(startedAt).getTime();
    if (!isNaN(startedMs) && startedMs > 0) {
      uptimeSeconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
    }
  }

  const diskUsageGB = await getServerDiskUsageGB(server.id);
  const diskUsedBytes = Math.round(diskUsageGB * 1024 * 1024 * 1024);
  const ramGB = typeof server.ram === "number" && server.ram > 0 ? server.ram : 2;
  const configuredLimitBytes = Math.round(ramGB * 1024 * 1024 * 1024);
  const configuredLimitMB = Math.round(ramGB * 1024);
  const configuredDiskLimitGB = typeof server.disk === "number" && server.disk > 0 ? server.disk : 10;
  const configuredDiskLimitBytes = Math.round(configuredDiskLimitGB * 1024 * 1024 * 1024);
  const configuredCpuLimit = typeof server.cpu === "number" && server.cpu > 0 ? server.cpu : 100;

  const collectedAt = new Date().toISOString();
  let runtimeStats: any = null;
  if (isRunning && (server.containerId || server.runtimeType === "local")) {
    try {
      runtimeStats = await getServerRuntimeStats(server);
    } catch {}
  }

  const defaultSource: ServerMetricSource =
    server.runtimeType === "local"
      ? (server.type === "nodejs" || server.type === "node" || server.type === "python" ? "local-process" : "local-java-process")
      : "docker-container";

  const source: ServerMetricSource = isRunning ? (runtimeStats?.source || defaultSource) : "unavailable";

  const memStats: ServerMemoryStats = runtimeStats?.memory || {
    usedBytes: isRunning ? Math.round((runtimeStats?.ram || 0) * 1024 * 1024) : 0,
    limitBytes: configuredLimitBytes,
    cacheBytes: 0,
    rawUsageBytes: isRunning ? Math.round((runtimeStats?.ram || 0) * 1024 * 1024) : 0,
    overLimit: false,
    includesHostMemory: false
  };

  // Enforce configured server limit on memory stats
  memStats.limitBytes = configuredLimitBytes;
  memStats.overLimit = memStats.usedBytes > configuredLimitBytes;
  memStats.includesHostMemory = false;

  const cpuPercent = isRunning ? (typeof runtimeStats?.cpu === "number" ? runtimeStats.cpu : 0) : 0;
  const cpuStats: ServerCpuStats = {
    percent: cpuPercent,
    includesHostCpu: false
  };

  const diskStats: ServerDiskStats = {
    usedBytes: diskUsedBytes,
    limitBytes: configuredDiskLimitBytes
  };

  const networkStats = runtimeStats?.network || {
    rxBytes: 0,
    txBytes: 0
  };

  const responseData: ServerResourceStats = {
    serverId: server.id,
    status: isRunning ? "running" : "offline",
    source,
    collectedAt,
    memory: memStats,
    cpuStats,
    diskStats,
    network: networkStats,

    // Backward-compatible flat properties:
    cpu: cpuPercent,
    ram: Math.round(memStats.usedBytes / (1024 * 1024)),
    disk: diskUsageGB,
    isRunning,
    startedAt,
    uptimeSeconds,
    limitRam: configuredLimitMB,
    limitCpu: configuredCpuLimit,
    limitDisk: configuredDiskLimitGB
  };

  res.json(responseData);
};

export const checkPort = async (req: Request, res: Response) => {
  const { port } = req.query;
  if (!port) return res.status(400).json({ error: "Port is required" });
  
  const servers = await readJSON("servers.json") || [];
  const inUse = servers.some((s: any) => s.port == port);
  
  res.json({ inUse });
};

// Resource-scoped locks to prevent race conditions on server creation per-port and per-user
const activePortLocks = new Set<number>();
const activeUserLocks = new Set<string>();

export const createServer = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== "admin" && user.role !== "owner") {
    return res.status(403).json({ error: "Only admins can create servers" });
  }
  const { name, ram, port, version, theme, cpu, disk, owner, ownerId, ipAlias, type, nodeId, runtimeType, javaVersion, dockerImage, serverJar, startupCommand } = req.body;
  if (!name || !ram || !port) {
    res.status(400).json({ error: "Missing required fields (name, ram, port)" });
    return;
  }

  const numericPort = parseInt(String(port), 10);
  if (isNaN(numericPort) || numericPort < 1 || numericPort > 65535) {
    return res.status(400).json({ error: "Invalid port number. Port must be between 1 and 65535." });
  }

  if (activePortLocks.has(numericPort)) {
    return res.status(409).json({ error: `Server creation for port ${numericPort} is currently in progress. Please try again in a few seconds.` });
  }

  if (activeUserLocks.has(user.id)) {
    return res.status(409).json({ error: "You already have a server creation in progress. Please wait for it to complete." });
  }

  activePortLocks.add(numericPort);
  activeUserLocks.add(user.id);

  try {
    const settings = await readJSON("settings.json") || {};
    const isDev = process.env.NODE_ENV === "development" || 
                  process.env.PORT === "30000" || 
                  process.env.PANEL_DEV_MODE === "true" ||
                  process.env.DEV_MODE === "true";
    const defaultRuntime = settings.defaultRuntime || process.env.DEFAULT_RUNTIME || "docker";
    const finalRuntimeType = (isDev && runtimeType) ? runtimeType : defaultRuntime;

    const id = crypto.randomUUID();
    const finalType = type || "PAPER";
    const finalVersion = version || "latest";
    const resolvedJavaVersion = javaVersion || (
      ["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(finalType.toUpperCase()) ? "" : getJavaVersionForMinecraft(finalVersion, finalType)
    );

    // Enforce owner assignment: only admins can assign to another user, otherwise defaults strictly to user.id
    const isAdmin = user.role === "admin" || user.role === "owner";
    const assignedOwner = isAdmin ? (owner || ownerId || user.id) : user.id;

    const serverData = {
      id,
      name,
      owner: assignedOwner,
      ownerId: assignedOwner,
      ownerUsername: user.username || "",
      ram,
      cpu: cpu || 100,
      disk: disk || 10,
      port: numericPort,
      ipAlias: ipAlias || "",
      runtimeType: finalRuntimeType,
      nodeId: nodeId || "local",
      type: finalType,
      version: finalVersion,
      javaVersion: resolvedJavaVersion,
      dockerImage: dockerImage || "",
      serverJar: serverJar || "server.jar",
      startupCommand: startupCommand || "",
      theme: theme || "default",
      status: "installing",
      isPermanent: true,
      lifespan: "infinity",
      autoDelete: false,
      expiresAt: null,
      createdAt: new Date().toISOString(),
      containerId: null as string | null,
    };

    const servers = await readJSON("servers.json") || [];
    
    if (servers.find((s: any) => s.port == numericPort)) {
      res.status(400).json({ error: "Port is already in use by another server." });
      return;
    }

    servers.push(serverData);
    await writeJSON("servers.json", servers);

    // Initialize clean server directory
    // In accordance with Aternos architecture:
    // When a new server is created, the directory and file manager start completely empty.
    // All files (server.properties, eula.txt, world/ folder, configs, plugins) are generated when the server is started for the first time.
    try {
      const serverDir = path.join(process.cwd(), ".data", "servers", id);
      await fs.ensureDir(serverDir);
      await secureDirectoryPermissions(serverDir);
    } catch (seedErr) {
      console.warn("Failed to initialize server directory:", seedErr);
    }

    try {
      const containerId = await createServerRuntime(serverData);
      serverData.containerId = containerId;
      serverData.status = "offline";
      
      const currentServers = await readJSON("servers.json") || [];
      const updatedList = currentServers.map((s: any) => s.id === id ? serverData : s);
      if (!updatedList.some((s: any) => s.id === id)) {
        updatedList.push(serverData);
      }
      await writeJSON("servers.json", updatedList);
      await createSftpUser(id).catch(e => console.error("SFTP user creation failed:", e));
      res.json(serverData);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } finally {
    activePortLocks.delete(numericPort);
    activeUserLocks.delete(user.id);
  }
};

export const updateOwner = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (user.role !== "admin" && user.role !== "owner") {
    return res.status(403).json({ error: "Only admins can update owner" });
  }

  const { id } = req.params;
  const { owner } = req.body;

  if (!owner) return res.status(400).json({ error: "Owner required" });

  const servers = await readJSON("servers.json") || [];
  const server = servers.find((s: any) => s.id === id);

  if (!server) return res.status(404).json({ error: "Server not found" });

  server.owner = owner;
  await writeJSON("servers.json", servers);
  
  res.json({ success: true });
};

export const updateIpAlias = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { ipAlias } = req.body;

  const servers = await readJSON("servers.json") || [];
  const server = servers.find((s: any) => s.id === id);

  if (!server) return res.status(404).json({ error: "Server not found" });

  if (user.role !== "admin" && user.role !== "owner" && server.owner !== user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  server.ipAlias = ipAlias;
  await writeJSON("servers.json", servers);
  
  res.json({ success: true });
};

export const deleteServer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Role check: Only admin or owner can delete servers
    if (user.role !== "admin" && user.role !== "owner") {
      return res.status(403).json({ 
        error: "Administrative Authorization Required: Only users with 'owner' or 'admin' roles can authorize the destructive removal of game servers." 
      });
    }

    let servers = await readJSON("servers.json") || [];
    const server = servers.find((s: any) => s.id === id);
    
    if (!server) {
      return res.status(404).json({ error: "Server not found" });
    }

    const { confirmationPhrase, adminPassword } = req.body || {};

    // Validate confirmation phrase if provided
    if (confirmationPhrase) {
      const cleanPhrase = String(confirmationPhrase).trim();
      const expected1 = server.name.trim();
      const expected2 = `DELETE ${server.name.trim()}`;
      if (cleanPhrase !== expected1 && cleanPhrase !== expected2 && cleanPhrase !== server.id) {
        return res.status(400).json({ 
          error: `Administrative confirmation mismatch. Expected '${server.name}', received '${cleanPhrase}'.` 
        });
      }
    }

    // Validate administrator password if provided
    if (adminPassword) {
      const users = await readJSON("users.json") || [];
      const dbUser = users.find((u: any) => u.id === user.id);
      if (dbUser && dbUser.password) {
        const isMatch = await bcrypt.compare(adminPassword, dbUser.password);
        if (!isMatch) {
          return res.status(401).json({ error: "Administrative authorization failed: Invalid administrator password." });
        }
      }
    }

    console.log(`[ADMIN DESTRUCTIVE ACTION] Server '${server.name}' (${server.id}) permanently deleted by authorized ${user.role} '${user.username}' at ${new Date().toISOString()}`);

    if (server.containerId) {
      await deleteServerRuntime(server);
    }
    
    servers = servers.filter((s: any) => s.id !== id);
    await writeJSON("servers.json", servers);
    
    // Remove files
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    try {
      await fs.remove(serverDir);
    } catch (e) {
      console.error("Failed to remove server directory", e);
    }
    
    await deleteSftpUser(id).catch(e => console.error("SFTP user deletion failed:", e));
    
    res.json({ success: true, message: `Server '${server.name}' permanently deleted under administrative authorization.` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const startServer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const servers = await readJSON("servers.json") || [];
    
    const server = servers.find((s: any) => s.id === id);
    if (!server) {
      return res.status(404).json({ error: "Not found" });
    }

    if (!server.containerId) {
      server.containerId = await createServerRuntime(server);
      await writeJSON("servers.json", servers);
    }

    if (server.suspended) {
      return res.status(403).json({ error: "Server is suspended" });
    }
    
    // PRE-FLIGHT CHECKS
    try {
      const serverDir = path.join(process.cwd(), ".data", "servers", server.id);
      await fs.ensureDir(serverDir);
      await secureDirectoryPermissions(serverDir);
      
      const targetType = (server.type || "PAPER").toUpperCase();
      const isGeneric = ["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(targetType);
      
      if (!isGeneric) {
        const jarPath = path.join(serverDir, "server.jar");
        if (!fs.existsSync(jarPath)) {
          const { panelEvents } = await import("../events.js");
          panelEvents.emit("log", id, `[JTG System] Pre-flight: server.jar not found. Downloading ${server.type} (${server.version || "latest"})...\r\n`);
          try {
            await downloadJar(server.type, server.version || "latest", jarPath);
            panelEvents.emit("log", id, `[JTG System] server.jar downloaded successfully.\r\n`);
          } catch (dlErr: any) {
            panelEvents.emit("log", id, `[JTG System] Notice: Automatic JAR download error: ${dlErr?.message || dlErr}\r\n`);
          }
        }
        const isProxy = ["VELOCITY", "BUNGEECORD", "WATERFALL"].includes(targetType);
        if (!isProxy) {
          await ensureAternosStandardServerFiles(serverDir, server);
        } else {
          const eulaPath = path.join(serverDir, "eula.txt");
          if (!fs.existsSync(eulaPath)) {
            await fs.writeFile(eulaPath, "eula=true\n");
          }
          const propsPath = path.join(serverDir, "server.properties");
          if (!fs.existsSync(propsPath)) {
            await fs.writeFile(propsPath, `server-port=${server.port || 25565}\nmotd=${server.name || "A Minecraft Server"}\n`);
          }
          await fs.ensureDir(path.join(serverDir, "plugins"));
        }

        const pluginsDir = path.join(serverDir, "plugins");
        const modsDir = path.join(serverDir, "mods");
        const eulaPath = path.join(serverDir, "eula.txt");
        const propsPath = path.join(serverDir, "server.properties");
        await secureDirectoryPermissions(pluginsDir);
        await secureDirectoryPermissions(modsDir);
        if (fs.existsSync(eulaPath)) await secureFilePermissions(eulaPath);
        if (fs.existsSync(propsPath)) await secureFilePermissions(propsPath);
        if (fs.existsSync(jarPath)) {
          await secureExecutablePermissions(jarPath);
        }
      }
      
      // 1. Check for stale session locks and remove them if server is stopped
      const lockFiles = [
        path.join(serverDir, "world", "session.lock"),
        path.join(serverDir, "world_nether", "session.lock"),
        path.join(serverDir, "world_the_end", "session.lock")
      ];
      for (const lockFile of lockFiles) {
        if (fs.existsSync(lockFile)) {
          try {
            await fs.remove(lockFile);
          } catch (e) {
            return res.status(500).json({ error: `Startup Diagnostic Failed: Permission denied when removing stale ${lockFile}` });
          }
        }
      }
      
      // 2. Check permissions on world folder and verify DataVersion compatibility
      const worldPath = path.join(serverDir, "world");
      if (fs.existsSync(worldPath)) {
        try {
          await fs.access(worldPath, fs.constants.R_OK | fs.constants.W_OK);
        } catch (e) {
          return res.status(500).json({ error: "Startup Diagnostic Failed: Permission denied on world folder." });
        }

        const targetType = (server.type || "PAPER").toUpperCase();
        const isMinecraft = !["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(targetType);
        if (isMinecraft) {
          const worldDataVersion = await getWorldDataVersion(serverDir);
          if (worldDataVersion) {
            const serverDataVersion = getDataVersionForMinecraft(server.version || "latest");
            if (worldDataVersion > serverDataVersion) {
              if (server.ignoreWorldDataVersion !== true) {
                return res.status(400).json({
                  error: `Startup blocked: World version mismatch detected. The world DataVersion (${worldDataVersion}) is newer than the server software version (${server.version || "latest"}, DataVersion ${serverDataVersion}). Starting the server may corrupt chunk and entity data. To force start, please create a backup of your world and enable 'Bypass World DataVersion Safety Check' in Server Settings.`
                });
              } else {
                console.warn(`[SAFETY AUDIT] Starting server '${server.name}' (${server.id}) with Paper.IgnoreWorldDataVersion=true bypass. Enabled by admin: '${server.ignoreWorldDataVersionAdmin || "admin"}'`);
              }
            }
          }
        }
      }
    } catch (preflightErr) {
      console.error(preflightErr);
    }


    try {
      const io = req.app.get("io");
      if (io) io.to(`server_${id}`).emit("clear_logs");
      
      await startServerRuntime(server);
      server.status = "online";
      server.startedAt = new Date().toISOString();
      server.hasStartedOnce = true;
      server.firstStartDone = true;
      await writeJSON("servers.json", servers);
    } catch (startErr: any) {
      if (startErr.statusCode === 404 || (startErr.message && startErr.message.toLowerCase().includes("no such container"))) {
        console.log(`Container missing for server ${server.id}. Recreating...`);
        server.containerId = await createServerRuntime(server);
        await startServerRuntime(server);
        server.status = "online";
        server.startedAt = new Date().toISOString();
        server.hasStartedOnce = true;
        server.firstStartDone = true;
        await writeJSON("servers.json", servers);
      } else {
        throw startErr;
      }
    }
    await attachServerRuntimeSocket(server, server.id);

    // Automatically start Playit tunnel agent alongside server startup
    try {
      startPlayitAgent(server).then(async (result) => {
        if (result.success) {
          console.log(`[Playit] Auto-started Playit agent on server startup for ${server.id} (${server.name})`);
          await addPlayitAudit({
            serverId: id,
            serverName: server.name || id,
            action: "agent_start",
            trigger: "user_action",
            performedBy: user?.username || user?.email || "System Auto-Start",
            previousStatus: "agent_offline",
            newStatus: "recovering",
            playerCount: getTrackedPlayerCount(id),
            reason: "Automatically started Playit tunnel agent alongside server start.",
            success: true
          });
          setTimeout(() => {
            runServerPlayitHealthCheck(id, {
              isManualTrigger: false,
              triggerUser: "System Auto-Start"
            }).catch(() => {});
          }, 5000);
        }
      }).catch((err) => {
        console.warn(`[Playit] Auto-start agent notice for ${server.id}:`, err?.message || err);
      });
    } catch (playitErr) {
      console.warn(`[Playit] Exception during auto-start Playit agent:`, playitErr);
    }

    res.json({ success: true, startedAt: server.startedAt });
  } catch (err: any) {
    console.error("Start server error:", err);
    res.status(500).json({ error: err.message || "Failed to start server" });
  }
};

export const stopServer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const servers = await readJSON("servers.json") || [];
    const server = servers.find((s: any) => s.id === id);
    if (!server || !server.containerId) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      await stopServerRuntime(server);
    } catch (stopErr: any) {
      if (stopErr.statusCode === 404 || (stopErr.message && stopErr.message.toLowerCase().includes("no such container"))) {
        console.log(`Container already missing for server ${server.id}. Assuming stopped.`);
      } else {
        throw stopErr;
      }
    }
    server.status = "offline";
    server.startedAt = null;
    await writeJSON("servers.json", servers);

    // Automatically stop Playit tunnel agent when server is stopped
    try {
      stopPlayitAgent(server).catch((e) => console.warn(`[Playit] Auto-stop error:`, e));
    } catch (playitErr) {
      console.warn(`[Playit] Auto-stop exception:`, playitErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Stop server error:", err);
    res.status(500).json({ error: err.message || "Failed to stop server" });
  }
};

export const restartServer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const servers = await readJSON("servers.json") || [];
    const server = servers.find((s: any) => s.id === id);
    if (!server || !server.containerId) {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const io = req.app.get("io");
      if (io) io.to(`server_${id}`).emit("clear_logs");

      await restartServerRuntime(server);
      server.status = "online";
      server.startedAt = new Date().toISOString();
      await writeJSON("servers.json", servers);
    } catch (startErr: any) {
      if (startErr.statusCode === 404 || (startErr.message && startErr.message.toLowerCase().includes("no such container"))) {
        console.log(`Container missing for server ${server.id}. Recreating...`);
        server.containerId = await createServerRuntime(server);
        await startServerRuntime(server);
        server.status = "online";
        server.startedAt = new Date().toISOString();
        await writeJSON("servers.json", servers);
      } else {
        throw startErr;
      }
    }
    await attachServerRuntimeSocket(server, server.id);

    // Automatically start / restart Playit tunnel agent alongside server restart
    try {
      startPlayitAgent(server).then(async (result) => {
        if (result.success) {
          console.log(`[Playit] Auto-started Playit agent on server restart for ${server.id} (${server.name})`);
          await addPlayitAudit({
            serverId: id,
            serverName: server.name || id,
            action: "manual_restart",
            trigger: "user_action",
            performedBy: user?.username || user?.email || "System Auto-Start",
            previousStatus: "agent_offline",
            newStatus: "recovering",
            playerCount: getTrackedPlayerCount(id),
            reason: "Automatically restarted Playit tunnel agent alongside server restart.",
            success: true
          });
          setTimeout(() => {
            runServerPlayitHealthCheck(id, {
              isManualTrigger: false,
              triggerUser: "System Auto-Start"
            }).catch(() => {});
          }, 5000);
        }
      }).catch((err) => {
        console.warn(`[Playit] Auto-restart agent notice for ${server.id}:`, err?.message || err);
      });
    } catch (playitErr) {
      console.warn(`[Playit] Exception during auto-start Playit agent on restart:`, playitErr);
    }

    res.json({ success: true, startedAt: server.startedAt });
  } catch (err: any) {
    console.error("Restart server error:", err);
    res.status(500).json({ error: err.message || "Failed to restart server" });
  }
};

export const sendCommand = async (req: Request, res: Response) => {
  
  try {
    const { id } = req.params;
    const { command } = req.body;
    const servers = await readJSON("servers.json") || [];
    const server = servers.find((s: any) => s.id === id);
    if (!server || !server.containerId) {
      return res.status(404).json({ error: "Not found" });
    }
    await sendServerRuntimeCommand(server, command);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Command error:", err);
    res.status(500).json({ error: err.message || "Failed to send command" });
  }
};

export const changeServerVersion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { version, type, javaVersion, dockerImage, startupCommand, serverJar, ignoreWorldDataVersion } = req.body;
    const user = (req as any).user;
    
    let servers = await readJSON("servers.json") || [];
    const server = servers.find((s: any) => s.id === id);
    
    if (!server) {
      return res.status(404).json({ error: "Server not found" });
    }

    const newVersion = version || server.version;
    if (!newVersion) return res.status(400).json({ error: "Version is required" });

    if (user.role !== "admin" && user.role !== "owner" && server.owner !== user.id) {
      return res.status(403).json({ error: "Only admins or owners can change version or runtime" });
    }

    if (ignoreWorldDataVersion !== undefined) {
      if (ignoreWorldDataVersion === true) {
        if (user.role !== "admin" && user.role !== "owner") {
          return res.status(403).json({ error: "Only administrators can enable the Paper.IgnoreWorldDataVersion safety bypass." });
        }
        server.ignoreWorldDataVersion = true;
        server.ignoreWorldDataVersionAdmin = user.username || user.id;
        console.warn(`[SAFETY AUDIT] User '${user.username || user.id}' enabled Paper.IgnoreWorldDataVersion safety bypass on server '${server.name}' (${server.id})`);
      } else {
        server.ignoreWorldDataVersion = false;
        delete server.ignoreWorldDataVersionAdmin;
      }
    }

    if (server.containerId) {
      const status = await getServerRuntimeStatus(server);
      if (status?.State?.Running) {
        return res.status(400).json({ error: "Server must be stopped before changing runtime or version. Please stop the server first." });
      }
      // Delete old container
      await deleteServerRuntime(server);
    }
    
    const typeChanged = type && type !== server.type;
    const versionChanged = version && version !== server.version;

    // Automatically delete config files to avoid issues when switching versions/types
    if (typeChanged || versionChanged) {
      const serverDir = path.join(process.cwd(), ".data", "servers", id);
      const filesToDelete = [
        "paper-global.yml", "paper-world-defaults.yml", "paper.yml",
        "config/paper-global.yml", "config/paper-world-defaults.yml",
        "world/data/random_sequences.dat"
      ];
      
      for (const file of filesToDelete) {
        const filePath = path.join(serverDir, file);
        try {
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
          }
        } catch (e) {
          console.error(`Failed to delete ${file}`, e);
        }
      }
    }
    
    server.version = newVersion;
    if (type) {
      server.type = type;
    }
    if (javaVersion !== undefined && javaVersion !== "" && javaVersion !== "auto") {
      server.javaVersion = javaVersion;
    } else {
      server.javaVersion = getJavaVersionForMinecraft(server.version, server.type);
    }

    if (dockerImage !== undefined) {
      server.dockerImage = dockerImage;
    }
    if (server.dockerImage && server.dockerImage.includes("itzg/minecraft-server")) {
      const neededTag = `java${server.javaVersion || "25"}`;
      if (!server.dockerImage.includes(neededTag)) {
        server.dockerImage = `itzg/minecraft-server:${neededTag}`;
      }
    }
    if (startupCommand !== undefined) {
      server.startupCommand = startupCommand;
    }
    if (serverJar !== undefined) {
      server.serverJar = serverJar;
    }

    // Auto-download new version JAR if it's a Minecraft / proxy server and type or version changed
    const targetType = (server.type || "PAPER").toUpperCase();
    const isGeneric = ["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(targetType);
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    if (!isGeneric && (typeChanged || versionChanged)) {
      const jarPath = path.join(serverDir, server.serverJar || "server.jar");
      try {
        await downloadJar(server.type, server.version, jarPath);
      } catch (dlErr) {
        console.warn("[changeServerVersion] Failed to download new jar:", dlErr);
      }
    }

    // Recreate container with new version/java env
    const newContainerId = await createServerRuntime(server);
    server.containerId = newContainerId;
    
    await writeJSON("servers.json", servers);
    
    res.json({ 
      success: true, 
      version: server.version, 
      type: server.type,
      javaVersion: server.javaVersion,
      dockerImage: server.dockerImage,
      startupCommand: server.startupCommand,
      serverJar: server.serverJar,
      ignoreWorldDataVersion: server.ignoreWorldDataVersion
    });
  } catch (err: any) {
    console.error("Change version error", err);
    res.status(500).json({ error: err.message });
  }
};

// File manager basics
export const getFiles = async (req: Request, res: Response) => {
  const { id } = req.params;
  const dirPath = req.query.path ? String(req.query.path) : "/";
  const targetPath = path.join(process.cwd(), ".data", "servers", id, dirPath);
  
  if (!targetPath.startsWith(path.join(process.cwd(), ".data", "servers", id))) {
    return res.status(403).json({ error: "Invalid path" });
  }

  try {
    const stats = await fs.stat(targetPath).catch(() => null);
    if (!stats) {
      // Return empty if not found
      return res.json([]);
    }
    if (stats.isFile()) {
       const content = await fs.readFile(targetPath, "utf-8");
       return res.json({ isFile: true, content });
    }
    const files = await fs.readdir(targetPath, { withFileTypes: true });
    const visibleFiles = files.filter(f => f.name !== ".server_metadata.json" && f.name !== ".initialized");
    const items = await Promise.all(
      visibleFiles.map(async (f) => {
        let size = 0;
        try {
          if (!f.isDirectory()) {
            const s = await fs.stat(path.join(targetPath, f.name));
            size = s.size;
          }
        } catch {}
        return {
          name: f.name,
          isDirectory: f.isDirectory(),
          size
        };
      })
    );
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};


export const uploadChunk = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { uploadId, chunkIndex, fileName, path: dirPath } = req.body;
  
  if (!req.file || !uploadId || chunkIndex === undefined || !fileName) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const targetPath = path.join(process.cwd(), ".data", "servers", id, dirPath || "/");
  const partFilePath = path.join(targetPath, fileName + '.part');

  if (!partFilePath.startsWith(path.join(process.cwd(), ".data", "servers", id))) {
    return res.status(403).json({ error: "Invalid path" });
  }

  try {
    await fs.ensureDir(targetPath);
    
    // If it's the first chunk, ensure we start fresh
    if (String(chunkIndex) === "0") {
      if (fs.existsSync(partFilePath)) {
        await fs.remove(partFilePath);
      }
    }

    // Read the uploaded chunk and append it
    const chunkData = await fs.readFile(req.file.path);
    await fs.appendFile(partFilePath, chunkData);
    
    // Cleanup multer temp file
    await fs.remove(req.file.path).catch(() => {});
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const redownloadJar = async (req: Request, res: Response) => {
  const { id } = req.params;
  const servers = (await readJSON("servers.json")) || [];
  const server = servers.find((s: any) => s.id === id);
  if (!server) return res.status(404).json({ error: "Server not found" });

  const targetType = (server.type || "PAPER").toUpperCase();
  const isGeneric = ["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(targetType);
  if (isGeneric) {
    return res.status(400).json({ error: "Reinstall JAR is only applicable for Minecraft and Proxy servers" });
  }

  const serverDir = path.join(process.cwd(), ".data", "servers", id);
  await fs.ensureDir(serverDir);
  await secureDirectoryPermissions(serverDir);
  const jarPath = path.join(serverDir, "server.jar");

  try {
    const { panelEvents } = await import("../events.js");
    panelEvents.emit("log", id, `[JTG System] Downloading ${server.type} (${server.version || "latest"}) server JAR...\r\n`);
    await downloadJar(server.type, server.version || "latest", jarPath);
    await secureExecutablePermissions(jarPath);
    
    const eulaPath = path.join(serverDir, "eula.txt");
    if (!fs.existsSync(eulaPath)) {
      await fs.writeFile(eulaPath, "eula=true\n");
    }
    const propsPath = path.join(serverDir, "server.properties");
    if (!fs.existsSync(propsPath)) {
      await fs.writeFile(propsPath, `server-port=${server.port}\nmotd=${server.name || "A Minecraft Server"}\n`);
    }
    await secureFilePermissions(eulaPath);
    await secureFilePermissions(propsPath);

    // If server is on Docker and not currently running, refresh the container
    if (server.runtimeType !== "local" && server.containerId) {
      try {
        const status = await getServerRuntimeStatus(server);
        if (!status?.State?.Running) {
          panelEvents.emit("log", id, `[JTG System] Refreshing Docker container environment...\r\n`);
          await deleteServerRuntime(server);
          server.containerId = await createServerRuntime(server);
          await writeJSON("servers.json", servers);
        }
      } catch (containerErr) {
        console.warn("[redownloadJar] Container refresh notice:", containerErr);
      }
    }

    panelEvents.emit("log", id, `[JTG System] Server JAR successfully installed and configured!\r\n`);
    res.json({ success: true, message: "Server JAR downloaded and configured successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to download JAR" });
  }
};


export const completeUpload = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { uploadId, fileName, path: dirPath, totalChunks } = req.body;
  if (!uploadId || !fileName || !totalChunks) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const targetPath = path.join(process.cwd(), ".data", "servers", id, dirPath || "/");
  const finalFilePath = path.join(targetPath, fileName);
  const partFilePath = path.join(targetPath, fileName + '.part');
  
  if (!finalFilePath.startsWith(path.join(process.cwd(), ".data", "servers", id))) {
    return res.status(403).json({ error: "Invalid path" });
  }

  try {
    if (fs.existsSync(partFilePath)) {
      await fs.move(partFilePath, finalFilePath, { overwrite: true });
    } else {
      // In case totalChunks was 0 or something weird, but usually part file must exist.
      throw new Error("Part file missing");
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const uploadFile = async (req: Request, res: Response) => {
  const { id } = req.params;
  let dirPath = req.body.path || "/";
  
  // If dirPath matches or ends with the uploaded file name, normalize to parent directory
  if (req.file) {
    if (dirPath === req.file.originalname || dirPath === `/${req.file.originalname}` || dirPath === `\\${req.file.originalname}`) {
      dirPath = "/";
    } else if (dirPath.endsWith(req.file.originalname)) {
      dirPath = path.dirname(dirPath);
    }
  }

  const serverBase = path.join(process.cwd(), ".data", "servers", id);
  const targetPath = path.join(serverBase, dirPath);
  
  if (!targetPath.startsWith(serverBase)) {
    return res.status(403).json({ error: "Invalid path" });
  }

  if (req.file) {
    await fs.ensureDir(targetPath);
    const destFile = path.join(targetPath, req.file.originalname);
    await fs.move(req.file.path, destFile, { overwrite: true });
  }
  res.json({ success: true });
};

export const deleteFile = async (req: Request, res: Response) => {
  const { id } = req.params;
  const filePaths = req.body.paths || (req.body.path ? [req.body.path] : []);
  
  try {
    for (const filePath of filePaths) {
      const targetPath = path.join(process.cwd(), ".data", "servers", id, filePath);
      
      if (!targetPath.startsWith(path.join(process.cwd(), ".data", "servers", id))) {
        return res.status(403).json({ error: "Invalid path" });
      }
      
      await fs.remove(targetPath);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const zipFiles = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { dirPath, fileNames, outputName } = req.body;
  
  const baseDir = path.join(process.cwd(), ".data", "servers", id, dirPath || "/");
  const outZipPath = path.join(baseDir, outputName || "archive.zip");

  if (!baseDir.startsWith(path.join(process.cwd(), ".data", "servers", id))) {
    return res.status(403).json({ error: "Invalid path" });
  }

  try {
    const output = fs.createWriteStream(outZipPath);
    // Use fast compression (level: 1) for rapid responsiveness and avoiding Cloudflare HTTP timeouts
    const archive = new ZipArchive({ zlib: { level: 1 } });

    output.on("close", async () => {
      await secureFilePermissions(outZipPath);
      if (!res.headersSent) res.json({ success: true, filename: outputName || "archive.zip" });
    });

    archive.on("error", (err: any) => {
      console.error("Archive error:", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

    archive.pipe(output);

    for (const name of fileNames) {
      const filePath = path.join(baseDir, name);
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) {
        archive.directory(filePath, name);
      } else {
        archive.file(filePath, { name });
      }
    }

    await archive.finalize();
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

export const renameFile = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { oldPath, newPath } = req.body;

  const targetOldPath = path.join(process.cwd(), ".data", "servers", id, oldPath);
  const targetNewPath = path.join(process.cwd(), ".data", "servers", id, newPath);

  if (!targetOldPath.startsWith(path.join(process.cwd(), ".data", "servers", id)) ||
      !targetNewPath.startsWith(path.join(process.cwd(), ".data", "servers", id))) {
    return res.status(403).json({ error: "Invalid path" });
  }

  try {
    await fs.rename(targetOldPath, targetNewPath);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export const downloadFile = async (req: Request, res: Response) => {
  const { id } = req.params;
  let rawPaths: string[] = [];
  if (req.query.paths) {
    rawPaths = Array.isArray(req.query.paths) ? (req.query.paths as string[]) : String(req.query.paths).split(",");
  } else if (req.query.path) {
    rawPaths = [String(req.query.path)];
  }

  if (rawPaths.length === 0) {
    return res.status(400).json({ error: "No path specified" });
  }

  const serverBaseDir = path.join(process.cwd(), ".data", "servers", id);

  try {
    if (rawPaths.length === 1) {
      const singlePath = rawPaths[0];
      const targetPath = path.join(serverBaseDir, singlePath);

      if (!targetPath.startsWith(serverBaseDir)) {
        return res.status(403).json({ error: "Invalid path" });
      }

      const stat = await fs.stat(targetPath).catch(() => null);
      if (!stat) {
        return res.status(404).json({ error: "File not found" });
      }
      if (!stat.isDirectory()) {
        return res.download(targetPath, path.basename(targetPath));
      }
    }

    // Multiple items OR a single directory -> stream as ZIP (level: 1 for instant streaming without timeout)
    const zipName = rawPaths.length === 1 
      ? `${path.basename(rawPaths[0]) || "folder"}.zip`
      : `download-${Date.now()}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = new ZipArchive({ zlib: { level: 1 } });
    archive.on("error", (err: any) => {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
    archive.pipe(res);

    for (const relPath of rawPaths) {
      const targetPath = path.join(serverBaseDir, relPath);
      if (!targetPath.startsWith(serverBaseDir)) continue;
      const itemName = path.basename(targetPath);
      const stat = await fs.stat(targetPath).catch(() => null);
      if (!stat) continue;

      if (stat.isDirectory()) {
        archive.directory(targetPath, itemName);
      } else {
        archive.file(targetPath, { name: itemName });
      }
    }

    await archive.finalize();
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

export const unzipFile = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { path: filePath } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: "Archive file path is required" });
  }

  const serverBaseDir = path.join(process.cwd(), ".data", "servers", id);
  let targetPath = path.join(serverBaseDir, filePath);
  
  if (!targetPath.startsWith(serverBaseDir)) {
    return res.status(403).json({ error: "Invalid path: Access outside server directory is forbidden" });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: `File not found: ${filePath}` });
  }

  try {
    const stat = await fs.stat(targetPath);
    
    // If targetPath is a directory (e.g. a folder named 'Stad 2_0.zip')
    if (stat.isDirectory()) {
      const baseName = path.basename(targetPath);
      const nestedFilePath = path.join(targetPath, baseName);
      
      // Check if there is an actual archive file inside this folder with the same name
      if (fs.existsSync(nestedFilePath) && (await fs.stat(nestedFilePath)).isFile()) {
        targetPath = nestedFilePath;
      } else {
        // Look for any archive file inside this directory
        const filesInside = await fs.readdir(targetPath);
        const archiveInside = filesInside.find(f => /\.(zip|tar|gz|tgz|jar|rar|7z)$/i.test(f));
        if (archiveInside) {
          targetPath = path.join(targetPath, archiveInside);
        } else {
          return res.status(400).json({ error: `'${filePath}' is a folder directory, not an archive file.` });
        }
      }
    }

    const destDir = path.dirname(targetPath);
    const result = await extractArchive(targetPath, destDir);
    res.json({ success: true, method: result.method });
  } catch (e: any) {
    console.error("Extraction error:", e);
    res.status(500).json({ error: e.message || "Failed to extract archive file" });
  }
};


export const createFile = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { filePath } = req.body;
  const targetPath = path.join(process.cwd(), ".data", "servers", id, filePath);
  if (!targetPath.startsWith(path.join(process.cwd(), ".data", "servers", id))) {
    return res.status(403).json({ error: "Invalid path" });
  }
  try {
    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, "", "utf-8");
    await secureFilePermissions(targetPath);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const createDirectory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { filePath } = req.body;
  const targetPath = path.join(process.cwd(), ".data", "servers", id, filePath);
  if (!targetPath.startsWith(path.join(process.cwd(), ".data", "servers", id))) {
    return res.status(403).json({ error: "Invalid path" });
  }
  try {
    await fs.mkdir(targetPath, { recursive: true });
    await secureDirectoryPermissions(targetPath);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const saveFileContent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { filePath, content } = req.body;

  const targetPath = path.join(process.cwd(), ".data", "servers", id, filePath);

  if (!targetPath.startsWith(path.join(process.cwd(), ".data", "servers", id))) {
    return res.status(403).json({ error: "Invalid path" });
  }

  try {
    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, content, "utf-8");
    await secureFilePermissions(targetPath);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

export const getBackups = async (req: Request, res: Response) => {
  const { id } = req.params;
  const backupsDir = path.join(process.cwd(), ".data", "backups", id);
  await fs.ensureDir(backupsDir);

  try {
    const files = await fs.readdir(backupsDir);
    const backups = [];
    for (const file of files) {
      if (file.endsWith(".zip")) {
        const stats = await fs.stat(path.join(backupsDir, file));
        backups.push({
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime,
        });
      }
    }
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(backups);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const createBackup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { includeCache } = req.body || {};
  const serverDir = path.join(process.cwd(), ".data", "servers", id);
  const backupsDir = path.join(process.cwd(), ".data", "backups", id);
  await fs.ensureDir(backupsDir);
  await secureDirectoryPermissions(backupsDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.zip`;
  const backupPath = path.join(backupsDir, filename);

  try {
    const serverExists = await fs.pathExists(serverDir);
    if (!serverExists) {
       await fs.ensureDir(serverDir);
    }

    const output = fs.createWriteStream(backupPath);
    // Fast compression level 1 for quick processing
    const archive = new ZipArchive({ zlib: { level: 1 } });

    output.on("close", async () => {
      await secureFilePermissions(backupPath);
      if (!res.headersSent) res.json({ success: true, filename });
    });

    archive.on("error", (err: any) => {
      console.error("Archive error:", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

    archive.pipe(output);

    // If includeCache is false (default for optimal backups), exclude ephemeral server cache folders
    const ignoreList = includeCache ? [] : ["cache/**", ".cache/**", "versions/**", ".fabric/**", ".quilt/**"];
    archive.glob("**/*", {
      cwd: serverDir,
      dot: true,
      ignore: ignoreList
    });

    await archive.finalize();
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

export const downloadBackup = async (req: Request, res: Response) => {
  const { id, filename } = req.params;
  const backupsDir = path.join(process.cwd(), ".data", "backups", id);
  const backupPath = path.join(backupsDir, filename);

  // basic path traversal prevention
  if (!backupPath.startsWith(backupsDir)) {
    return res.status(403).json({ error: "Invalid path" });
  }

  try {
    const exists = await fs.pathExists(backupPath);
    if (!exists) {
      return res.status(404).json({ error: "Backup not found" });
    }

    const stat = await fs.stat(backupPath);
    const safeFilename = path.basename(filename).replace(/["\r\n]/g, "");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
    res.setHeader("Content-Length", stat.size.toString());
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    const stream = fs.createReadStream(backupPath);
    stream.on("error", (streamErr) => {
      console.error("Backup stream error:", streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to read backup file stream" });
      }
    });
    stream.pipe(res);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Failed to download backup" });
    }
  }
};

export const deleteBackup = async (req: Request, res: Response) => {
  const { id, filename } = req.params;
  const backupPath = path.join(process.cwd(), ".data", "backups", id, filename);

  if (!backupPath.startsWith(path.join(process.cwd(), ".data", "backups", id))) {
    return res.status(403).json({ error: "Invalid path" });
  }

  try {
    await fs.remove(backupPath);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
export const installPlugin = async (req: Request, res: Response) => {

  const { id } = req.params;
  const serversJSON = await readJSON("servers.json");
  const server = serversJSON?.find((s: any) => s.id === id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  
  const pluginCompatibleTypes = ["PAPER", "SPIGOT", "BUKKIT", "PURPUR", "WATERFALL", "BUNGEECORD", "VELOCITY"];
  if (!pluginCompatibleTypes.includes((server.type || "").toUpperCase())) {
     return res.status(400).json({ error: `Cannot install Bukkit/Spigot plugins on a ${server.type} server. This software does not support Bukkit plugins.` });
  }
  const { source, pluginId, pluginName } = req.body;
  
  // Allow direct downloadUrl fallback for backward compatibility
  if (req.body.downloadUrl) {
     try {
        const serverDir = path.join(process.cwd(), ".data", "servers", id);
        const pluginsDir = path.join(serverDir, "plugins");
        await fs.ensureDir(pluginsDir);
        const filePath = path.join(pluginsDir, req.body.filename);
        if (req.body.downloadUrl === 'dummy') {
          await fs.writeFile(filePath, '');
        } else {
          const axios = (await import("axios")).default;
          const response = await axios({ url: req.body.downloadUrl, method: 'GET', responseType: 'stream' });
          const writer = fs.createWriteStream(filePath);
          response.data.pipe(writer);
          await new Promise<void>((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
        }
        return res.json({ success: true, message: "Plugin installed successfully" });
     } catch(e) {
        return res.status(500).json({ error: "Failed to install plugin" });
     }
  }

  if (!source || !pluginId || !pluginName) {
    return res.status(400).json({ error: "Missing source, pluginId, or pluginName" });
  }

  try {
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const pluginsDir = path.join(serverDir, "plugins");
    await fs.ensureDir(pluginsDir);
    let downloadUrl = null;
    let filename = `${pluginName.replace(/[^a-zA-Z0-9]/g, '_')}.jar`;
    const axios = (await import("axios")).default;

    const commonHeaders = {
      'User-Agent': 'JTGPanel/3.1.0 (https://github.com/jishnu; support@jtgpanel.net)'
    };

    // Helper: search Modrinth by plugin name
    const resolveModrinthByName = async (pName: string) => {
      try {
        const mrSearch = await axios.get(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(pName)}&facets=[["project_type:plugin"]]&limit=3`, {
          headers: commonHeaders,
          timeout: 7000
        });
        if (mrSearch.data?.hits?.length > 0) {
          for (const hit of mrSearch.data.hits) {
            const verRes = await axios.get(`https://api.modrinth.com/v2/project/${hit.project_id}/version`, {
              headers: commonHeaders,
              timeout: 7000
            });
            if (verRes.data && verRes.data.length > 0) {
              const file = verRes.data[0].files?.find((f: any) => f.primary) || verRes.data[0].files?.[0];
              if (file && file.url) {
                return { url: file.url, filename: file.filename || `${hit.title || pName}.jar` };
              }
            }
          }
        }
      } catch (e) {}
      return null;
    };

    // Helper: search Hangar by plugin name
    const resolveHangarByName = async (pName: string) => {
      try {
        const hSearch = await axios.get(`https://hangar.papermc.io/api/v1/projects?q=${encodeURIComponent(pName)}&limit=3`, {
          headers: commonHeaders,
          timeout: 7000
        });
        if (hSearch.data?.result?.length > 0) {
          for (const proj of hSearch.data.result) {
            const verRes = await axios.get(`https://hangar.papermc.io/api/v1/projects/${proj.namespace.owner}/${proj.namespace.slug}/versions`, {
              headers: commonHeaders,
              timeout: 7000
            });
            if (verRes.data?.result?.length > 0) {
              const version = verRes.data.result[0];
              const download = version.downloads.PAPER || version.downloads.SPIGOT || version.downloads.VELOCITY || version.downloads.WATERFALL || Object.values(version.downloads)[0];
              if (download && (download as any).downloadUrl) {
                return {
                  url: (download as any).downloadUrl,
                  filename: (download as any).fileInfo?.name || `${proj.name || pName}.jar`
                };
              }
            }
          }
        }
      } catch (e) {}
      return null;
    };

    // Helper: resolve external URL from various services (Hangar, GitHub, Modrinth, Jenkins, Direct JAR, etc.)
    const resolveExternalPluginUrl = async (extUrl: string, pName: string): Promise<{ url: string; filename: string } | null> => {
      if (!extUrl) return null;

      // 1. Direct JAR URL
      if (/\.jar(\?.*)?$/i.test(extUrl)) {
        const cleanName = extUrl.split('/').pop()?.split('?')[0] || `${pName}.jar`;
        return { url: extUrl, filename: cleanName };
      }

      // 2. Hangar PaperMC link (e.g. https://hangar.papermc.io/ViaVersion/ViaBackwards/versions)
      if (extUrl.includes('hangar.papermc.io')) {
        const match = extUrl.match(/hangar\.papermc\.io\/([^\/]+)\/([^\/?#]+)/);
        if (match) {
          const owner = match[1];
          const slug = match[2];
          try {
            const verRes = await axios.get(`https://hangar.papermc.io/api/v1/projects/${owner}/${slug}/versions`, {
              headers: commonHeaders,
              timeout: 8000
            });
            if (verRes.data?.result?.length > 0) {
              const version = verRes.data.result[0];
              const download = version.downloads.PAPER || version.downloads.SPIGOT || version.downloads.VELOCITY || version.downloads.WATERFALL || Object.values(version.downloads)[0];
              if (download && (download as any).downloadUrl) {
                return {
                  url: (download as any).downloadUrl,
                  filename: (download as any).fileInfo?.name || `${slug}.jar`
                };
              }
              if (download && (download as any).externalUrl) {
                const subRes = await resolveExternalPluginUrl((download as any).externalUrl, pName);
                if (subRes) return subRes;
              }
            }
          } catch (e: any) {
            console.error('Hangar external resolve error:', e.message);
          }
        }
      }

      // 3. GitHub Releases
      if (extUrl.includes('github.com')) {
        let apiUrl = null;
        const tagMatch = extUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/releases\/tag\/([^\/?#]+)/);
        const latestMatch = extUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/releases\/latest/);
        const releasesMatch = extUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/releases/);
        const repoMatch = extUrl.match(/github\.com\/([^\/]+)\/([^\/?#]+)/);

        if (tagMatch) {
          apiUrl = `https://api.github.com/repos/${tagMatch[1]}/${tagMatch[2]}/releases/tags/${tagMatch[3]}`;
        } else if (latestMatch) {
          apiUrl = `https://api.github.com/repos/${latestMatch[1]}/${latestMatch[2]}/releases/latest`;
        } else if (releasesMatch) {
          apiUrl = `https://api.github.com/repos/${releasesMatch[1]}/${releasesMatch[2]}/releases`;
        } else if (repoMatch && repoMatch[2] !== 'releases') {
          apiUrl = `https://api.github.com/repos/${repoMatch[1]}/${repoMatch[2]}/releases/latest`;
        }

        if (apiUrl) {
          try {
            const ghRes = await axios.get(apiUrl, {
              headers: { ...commonHeaders, 'Accept': 'application/vnd.github.v3+json' },
              timeout: 8000
            });
            let assets = null;
            if (Array.isArray(ghRes.data) && ghRes.data.length > 0) {
              assets = ghRes.data[0].assets;
            } else if (ghRes.data && ghRes.data.assets) {
              assets = ghRes.data.assets;
            }

            if (assets && assets.length > 0) {
              const jarAsset = assets.find((a: any) => a.name?.endsWith('.jar') && !a.name?.includes('-sources') && !a.name?.includes('-javadoc') && !a.name?.includes('-dev')) 
                            || assets.find((a: any) => a.name?.endsWith('.jar'));
              if (jarAsset) {
                return { url: jarAsset.browser_download_url, filename: jarAsset.name };
              }
            }
          } catch (e: any) {
            console.error('GitHub API resolve error:', e.message);
          }
        }
      }

      // 4. Modrinth Link
      if (extUrl.includes('modrinth.com')) {
        const modrinthMatch = extUrl.match(/modrinth\.com\/(?:plugin|mod|project)\/([^\/?#]+)/);
        if (modrinthMatch) {
          const slug = modrinthMatch[1];
          try {
            const verRes = await axios.get(`https://api.modrinth.com/v2/project/${slug}/version`, {
              headers: commonHeaders,
              timeout: 8000
            });
            if (verRes.data && verRes.data.length > 0) {
              const file = verRes.data[0].files?.find((f: any) => f.primary) || verRes.data[0].files?.[0];
              if (file && file.url) {
                return { url: file.url, filename: file.filename || `${slug}.jar` };
              }
            }
          } catch (e) {}
        }
      }

      // 5. Jenkins / CI server
      if (extUrl.includes('/job/') || extUrl.includes('ci.') || extUrl.includes('jenkins')) {
        try {
          let clean = extUrl.replace(/\/+$/, '');
          if (!clean.includes('/lastSuccessfulBuild') && !clean.includes('/lastBuild')) {
            clean = clean + '/lastSuccessfulBuild';
          }
          const res = await axios.get(`${clean}/api/json`, { headers: commonHeaders, timeout: 6000 });
          if (res.data && res.data.artifacts && res.data.artifacts.length > 0) {
            const jarArt = res.data.artifacts.find((a: any) => a.fileName?.endsWith('.jar') && !a.fileName?.includes('-sources') && !a.fileName?.includes('-javadoc')) 
                        || res.data.artifacts.find((a: any) => a.fileName?.endsWith('.jar'));
            if (jarArt) {
              return { url: `${clean}/artifact/${jarArt.relativePath}`, filename: jarArt.fileName };
            }
          }
        } catch (e) {}
      }

      // 6. Cross-platform fallback search on Modrinth by pluginName
      const mrFallback = await resolveModrinthByName(pName);
      if (mrFallback) return mrFallback;

      // 7. Cross-platform fallback search on Hangar by pluginName
      const hFallback = await resolveHangarByName(pName);
      if (hFallback) return hFallback;

      return null;
    };

    if (source === 'modrinth') {
      try {
        const verRes = await axios.get(`https://api.modrinth.com/v2/project/${pluginId}/version`, {
          headers: commonHeaders,
          timeout: 8000
        });
        if (verRes.data && verRes.data.length > 0) {
          const file = verRes.data[0].files?.find((f: any) => f.primary) || verRes.data[0].files?.[0];
          if (file && file.url) {
            downloadUrl = file.url;
            filename = file.filename || filename;
          }
        }
      } catch (e) {
        console.error('Modrinth fetch failed, attempting fallback search:', e);
      }

      if (!downloadUrl) {
        const fb = await resolveModrinthByName(pluginName) || await resolveHangarByName(pluginName);
        if (fb) {
          downloadUrl = fb.url;
          filename = fb.filename;
        }
      }
    } else if (source === 'spigot') {
      try {
        const apiRes = await axios.get(`https://api.spiget.org/v2/resources/${pluginId}`, {
          headers: commonHeaders,
          timeout: 8000
        });
        if (apiRes.data && apiRes.data.file) {
          if (apiRes.data.file.type === 'external' && apiRes.data.file.externalUrl) {
            const extUrl = apiRes.data.file.externalUrl;
            const resolved = await resolveExternalPluginUrl(extUrl, pluginName);
            if (resolved) {
              downloadUrl = resolved.url;
              filename = resolved.filename;
            } else {
              // Try fallback direct download or search
              const fb = await resolveModrinthByName(pluginName) || await resolveHangarByName(pluginName);
              if (fb) {
                downloadUrl = fb.url;
                filename = fb.filename;
              } else {
                downloadUrl = `https://api.spiget.org/v2/resources/${pluginId}/download`;
              }
            }
          } else {
            downloadUrl = `https://api.spiget.org/v2/resources/${pluginId}/download`;
          }
        } else {
          downloadUrl = `https://api.spiget.org/v2/resources/${pluginId}/download`;
        }
      } catch (e: any) {
        console.error('Spiget resource query error, trying fallback search:', e.message);
        const fb = await resolveModrinthByName(pluginName) || await resolveHangarByName(pluginName);
        if (fb) {
          downloadUrl = fb.url;
          filename = fb.filename;
        } else {
          downloadUrl = `https://api.spiget.org/v2/resources/${pluginId}/download`;
        }
      }
    } else if (source === 'hangar') {
      const [owner, slug] = pluginId.split('/');
      try {
        const verRes = await axios.get(`https://hangar.papermc.io/api/v1/projects/${owner}/${slug}/versions`, {
          headers: commonHeaders,
          timeout: 8000
        });
        if (verRes.data && verRes.data.result && verRes.data.result.length > 0) {
          const version = verRes.data.result[0];
          const download = version.downloads.PAPER || version.downloads.SPIGOT || version.downloads.VELOCITY || version.downloads.WATERFALL || Object.values(version.downloads)[0];
          if (download && (download as any).downloadUrl) {
            downloadUrl = (download as any).downloadUrl;
            if ((download as any).fileInfo && (download as any).fileInfo.name) {
              filename = (download as any).fileInfo.name;
            }
          } else if (download && (download as any).externalUrl) {
            const extUrl = (download as any).externalUrl;
            const resolved = await resolveExternalPluginUrl(extUrl, pluginName);
            if (resolved) {
              downloadUrl = resolved.url;
              filename = resolved.filename;
            }
          }
        }
      } catch (e: any) {
        console.error('Hangar fetch error, trying fallback search:', e.message);
      }

      if (!downloadUrl) {
        const fb = await resolveHangarByName(pluginName) || await resolveModrinthByName(pluginName);
        if (fb) {
          downloadUrl = fb.url;
          filename = fb.filename;
        }
      }
    }

    if (!downloadUrl) {
      let extUrl = "";
      if (source === 'spigot') extUrl = `https://www.spigotmc.org/resources/${pluginId}`;
      else if (source === 'modrinth') extUrl = `https://modrinth.com/project/${pluginId}`;
      else if (source === 'hangar') extUrl = `https://hangar.papermc.io/${pluginId}`;
      return res.status(404).json({ error: `Download URL not found for ${pluginName}. Please download manually.`, externalLink: extUrl });
    }

    const filePath = path.join(pluginsDir, filename);
    await fs.ensureDir(pluginsDir);
    await secureDirectoryPermissions(pluginsDir);

    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 30000,
      headers: commonHeaders
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Ensure permissions
    await secureFilePermissions(filePath);

    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.size === 0) {
      await fs.remove(filePath).catch(() => {});
      return res.status(502).json({ error: "Downloaded plugin file was empty. Please try another source or upload the JAR manually." });
    }

    res.json({ success: true, message: `${pluginName} installed successfully into plugins folder!` });
  } catch (error: any) {
    console.error("Plugin installation failed:", error.message);
    res.status(500).json({ error: "Plugin installation failed: " + (error.response?.data?.message || error.message) });
  }
};

export const installMod = async (req: Request, res: Response) => {

  const { id } = req.params;
  const serversJSON = await readJSON("servers.json");
  const server = serversJSON?.find((s: any) => s.id === id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  
  const modCompatibleTypes = ["FABRIC", "FORGE", "NEOFORGE", "QUILT"];
  if (!modCompatibleTypes.includes((server.type || "").toUpperCase())) {
     return res.status(400).json({ error: `Cannot install Fabric/Forge mods on a ${server.type} server. This software does not support Fabric/Forge mods.` });
  }
  const { pluginId, pluginName } = req.body; 

  if (!pluginId || !pluginName) {
    return res.status(400).json({ error: "Missing pluginId or pluginName" });
  }

  try {
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const modsDir = path.join(serverDir, "mods");
    await fs.ensureDir(modsDir);
    
    let downloadUrl = null;
    let filename = `${pluginName.replace(/[^a-zA-Z0-9]/g, '_')}.jar`;
    const axios = (await import("axios")).default;

    const verRes = await axios.get(`https://api.modrinth.com/v2/project/${pluginId}/version`);
    if (verRes.data && verRes.data.length > 0) {
      const file = verRes.data[0].files.find((f: any) => f.primary) || verRes.data[0].files[0];
      if (file) {
          downloadUrl = file.url;
          filename = file.filename || filename;
      }
    }

    if (!downloadUrl) {
      return res.status(404).json({ error: "Could not find a valid download URL for this mod." });
    }

    const filePath = path.join(modsDir, filename);
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      headers: {
         'User-Agent': 'React-Minecraft-Panel/1.0'
      }
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    res.json({ success: true, message: "Mod installed successfully" });
  } catch (error: any) {
    console.error("Mod installation failed:", error.message);
    res.status(500).json({ error: "Mod installation failed: " + error.message });
  }
};

export const installResourcePack = async (req: Request, res: Response) => {
  const { id } = req.params;
  const serversJSON = await readJSON("servers.json");
  const server = serversJSON?.find((s: any) => s.id === id);
  if (!server) return res.status(404).json({ error: "Server not found" });

  const { projectId, title, setInProperties = true, versionId, downloadUrl: customUrl } = req.body;

  if (!projectId && !customUrl) {
    return res.status(400).json({ error: "Missing projectId or downloadUrl" });
  }

  try {
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const rpDir = path.join(serverDir, "resourcepacks");
    await fs.ensureDir(rpDir);

    let downloadUrl = customUrl || null;
    let filename = `${(title || projectId || "resource_pack").replace(/[^a-zA-Z0-9_\-]/g, '_')}.zip`;
    let sha1Hash = "";
    const axios = (await import("axios")).default;

    if (!downloadUrl && projectId) {
      const urlToFetch = versionId
        ? `https://api.modrinth.com/v2/version/${versionId}`
        : `https://api.modrinth.com/v2/project/${projectId}/version`;

      const verRes = await axios.get(urlToFetch, {
        headers: { 'User-Agent': 'React-Minecraft-Panel/1.0' },
        timeout: 10000
      });

      const versions = Array.isArray(verRes.data) ? verRes.data : [verRes.data];
      if (versions.length > 0) {
        const file = versions[0].files?.find((f: any) => f.primary) || versions[0].files?.[0];
        if (file) {
          downloadUrl = file.url;
          filename = file.filename || filename;
          if (file.hashes?.sha1) {
            sha1Hash = file.hashes.sha1;
          }
        }
      }
    }

    if (!downloadUrl) {
      return res.status(404).json({ error: "Could not find a valid download URL for this resource pack." });
    }

    const filePath = path.join(rpDir, filename);
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      headers: { 'User-Agent': 'React-Minecraft-Panel/1.0' },
      timeout: 60000
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await secureFilePermissions(filePath);

    // Compute SHA1 if not provided
    if (!sha1Hash && fs.existsSync(filePath)) {
      const fileBuffer = await fs.readFile(filePath);
      sha1Hash = crypto.createHash("sha1").update(fileBuffer).digest("hex");
    }

    // Update server.properties if requested
    if (setInProperties) {
      const propsPath = path.join(serverDir, "server.properties");
      let props = fs.existsSync(propsPath) ? await fs.readFile(propsPath, "utf-8") : "";

      const updateProp = (key: string, val: string) => {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(props)) {
          props = props.replace(regex, `${key}=${val}`);
        } else {
          props += `\n${key}=${val}\n`;
        }
      };

      updateProp("resource-pack", downloadUrl);
      if (sha1Hash) {
        updateProp("resource-pack-sha1", sha1Hash);
      }

      await fs.writeFile(propsPath, props, "utf-8");
    }

    res.json({
      success: true,
      message: setInProperties
        ? `${title || filename} installed and set in server.properties!`
        : `${title || filename} downloaded to resourcepacks folder!`,
      filename,
      sha1: sha1Hash,
      downloadUrl
    });
  } catch (error: any) {
    console.error("Resource pack install error:", error.message);
    res.status(500).json({ error: "Resource pack installation failed: " + error.message });
  }
};

export const installDatapack = async (req: Request, res: Response) => {
  const { id } = req.params;
  const serversJSON = await readJSON("servers.json");
  const server = serversJSON?.find((s: any) => s.id === id);
  if (!server) return res.status(404).json({ error: "Server not found" });

  const { projectId, title, versionId, downloadUrl: customUrl } = req.body;

  if (!projectId && !customUrl) {
    return res.status(400).json({ error: "Missing projectId or downloadUrl" });
  }

  try {
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    
    // Get level-name
    const propsPath = path.join(serverDir, "server.properties");
    let levelName = "world";
    if (fs.existsSync(propsPath)) {
      const props = await fs.readFile(propsPath, "utf-8");
      const match = props.match(/^level-name=(.*)$/m);
      if (match && match[1].trim()) levelName = match[1].trim();
    }

    const dpDir = path.join(serverDir, levelName, "datapacks");
    await fs.ensureDir(dpDir);

    let downloadUrl = customUrl || null;
    let filename = `${(title || projectId || "datapack").replace(/[^a-zA-Z0-9_\-]/g, '_')}.zip`;
    const axios = (await import("axios")).default;

    if (!downloadUrl && projectId) {
      const urlToFetch = versionId
        ? `https://api.modrinth.com/v2/version/${versionId}`
        : `https://api.modrinth.com/v2/project/${projectId}/version`;

      const verRes = await axios.get(urlToFetch, {
        headers: { 'User-Agent': 'React-Minecraft-Panel/1.0' },
        timeout: 10000
      });

      const versions = Array.isArray(verRes.data) ? verRes.data : [verRes.data];
      if (versions.length > 0) {
        const file = versions[0].files?.find((f: any) => f.primary) || versions[0].files?.[0];
        if (file) {
          downloadUrl = file.url;
          filename = file.filename || filename;
        }
      }
    }

    if (!downloadUrl) {
      return res.status(404).json({ error: "Could not find a valid download URL for this datapack." });
    }

    const filePath = path.join(dpDir, filename);
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
      headers: { 'User-Agent': 'React-Minecraft-Panel/1.0' },
      timeout: 60000
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await secureFilePermissions(filePath);

    res.json({
      success: true,
      message: `${title || filename} installed into ${levelName}/datapacks!`,
      filename
    });
  } catch (error: any) {
    console.error("Datapack installation failed:", error.message);
    res.status(500).json({ error: "Datapack installation failed: " + error.message });
  }
};

export const getInstalledPackages = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const serverDir = path.join(process.cwd(), ".data", "servers", id);

    // Read level name
    const propsPath = path.join(serverDir, "server.properties");
    let levelName = "world";
    let serverPropsRP = { url: "", sha1: "", required: false, prompt: "" };

    if (fs.existsSync(propsPath)) {
      const props = await fs.readFile(propsPath, "utf-8");
      const lvlMatch = props.match(/^level-name=(.*)$/m);
      if (lvlMatch && lvlMatch[1].trim()) levelName = lvlMatch[1].trim();

      const rpUrl = props.match(/^resource-pack=(.*)$/m);
      const rpSha1 = props.match(/^resource-pack-sha1=(.*)$/m);
      const rpReq = props.match(/^require-resource-pack=(.*)$/m);
      const rpPrompt = props.match(/^resource-pack-prompt=(.*)$/m);

      serverPropsRP = {
        url: rpUrl ? rpUrl[1].trim() : "",
        sha1: rpSha1 ? rpSha1[1].trim() : "",
        required: rpReq ? rpReq[1].trim().toLowerCase() === "true" : false,
        prompt: rpPrompt ? rpPrompt[1].trim() : ""
      };
    }

    const readDirSafely = async (dirPath: string) => {
      if (!fs.existsSync(dirPath)) return [];
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const items = [];
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const full = path.join(dirPath, e.name);
        try {
          const st = await fs.stat(full);
          items.push({
            name: e.name.replace(/\.(jar|zip|disabled)$/i, ""),
            filename: e.name,
            isDirectory: e.isDirectory(),
            size: st.size,
            sizeMB: Number((st.size / (1024 * 1024)).toFixed(2)),
            modified: st.mtime,
            enabled: !e.name.endsWith(".disabled")
          });
        } catch {}
      }
      return items;
    };

    const [mods, plugins, resourcepacks, datapacks] = await Promise.all([
      readDirSafely(path.join(serverDir, "mods")),
      readDirSafely(path.join(serverDir, "plugins")),
      readDirSafely(path.join(serverDir, "resourcepacks")),
      readDirSafely(path.join(serverDir, levelName, "datapacks"))
    ]);

    res.json({
      mods,
      plugins,
      resourcepacks,
      datapacks,
      serverPropertiesResourcePack: serverPropsRP
    });
  } catch (error: any) {
    console.error("Failed to get installed packages:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const uninstallPackage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, filename, clearServerProperties } = req.body;

  try {
    const serverDir = path.join(process.cwd(), ".data", "servers", id);

    if (type === "resourcepack" && clearServerProperties) {
      const propsPath = path.join(serverDir, "server.properties");
      if (fs.existsSync(propsPath)) {
        let props = await fs.readFile(propsPath, "utf-8");
        props = props.replace(/^resource-pack=.*$/m, "resource-pack=");
        props = props.replace(/^resource-pack-sha1=.*$/m, "resource-pack-sha1=");
        await fs.writeFile(propsPath, props, "utf-8");
      }
    }

    if (filename) {
      let targetDir = "";
      if (type === "mod") targetDir = path.join(serverDir, "mods");
      else if (type === "plugin") targetDir = path.join(serverDir, "plugins");
      else if (type === "resourcepack") targetDir = path.join(serverDir, "resourcepacks");
      else if (type === "datapack") {
        const propsPath = path.join(serverDir, "server.properties");
        let levelName = "world";
        if (fs.existsSync(propsPath)) {
          const props = await fs.readFile(propsPath, "utf-8");
          const match = props.match(/^level-name=(.*)$/m);
          if (match && match[1].trim()) levelName = match[1].trim();
        }
        targetDir = path.join(serverDir, levelName, "datapacks");
      }

      if (targetDir) {
        const targetPath = path.join(targetDir, filename);
        if (fs.existsSync(targetPath)) {
          await fs.remove(targetPath);
        }
      }
    }

    res.json({ success: true, message: "Package removed successfully." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateResources = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ram, cpu, disk } = req.body;
    const servers = await readJSON("servers.json") || [];
    const server = servers.find((s: any) => s.id === id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if ((req as any).user.role !== "admin" && (req as any).user.role !== "owner") return res.status(403).json({ error: "Unauthorized" });

    // Safe bounds validation for RAM in MB/GB, CPU, and NVMe Disk
    const rawRam = Number(ram) || (server.ram ? Number(server.ram) : 2);
    // If ram is >= 256, it represents MB; otherwise it is in GB
    const parsedMb = rawRam >= 256 ? Math.round(rawRam) : Math.round(rawRam * 1024);
    const safeRamMB = Math.max(512, Math.min(131072, parsedMb)); // 512 MB to 128 GB safe envelope
    const safeRamGB = Number((safeRamMB / 1024).toFixed(3));
    const safeCpu = Math.max(10, Math.min(3200, Number(cpu) || 100));
    const safeDisk = Math.max(1, Math.min(10000, Number(disk) || 10));

    server.ram = safeRamGB;
    server.ramMB = safeRamMB;
    server.cpu = safeCpu;
    server.disk = safeDisk;

    // Stop and recreate container if running or existing
    if (server.containerId) {
       try {
         const status = await getServerRuntimeStatus(server);
         if (status?.State?.Running) {
            await stopServerRuntime(server);
         }
         await deleteServerRuntime(server);
       } catch(e) {
         console.warn("Failed to delete old runtime on resource update:", e);
       }
       try {
         server.containerId = await createServerRuntime(server);
       } catch(e) {
         console.warn("Failed to recreate runtime on resource update:", e);
       }
    }

    await writeJSON("servers.json", servers);
    res.json(server);
  } catch (error) {
    console.error("Resource update error:", error);
    res.status(500).json({ error: "Failed to update resources" });
  }
};

export const updateSuspend = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { suspendDuration } = req.body; // permanent, 1_month, 2_months, 24_hours, 1_week, or null
    const servers = await readJSON("servers.json") || [];
    const server = servers.find((s: any) => s.id === id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if ((req as any).user.role !== "admin" && (req as any).user.role !== "owner") return res.status(403).json({ error: "Unauthorized" });

    server.suspended = suspendDuration !== null;
    server.suspendDuration = suspendDuration;
    await writeJSON("servers.json", servers);

    if (server.suspended && server.containerId) {
       try {
         await stopServerRuntime(server);
       } catch(e) {}
    }

    res.json(server);
  } catch (error) {
    res.status(500).json({ error: "Failed to suspend server" });
  }
};






export const updateRuntime = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { version, type, javaVersion, dockerImage, serverJar, startupCommand } = req.body;
    const user = (req as any).user;

    let servers = await readJSON("servers.json") || [];
    const serverIndex = servers.findIndex((s: any) => s.id === id);
    if (serverIndex === -1) return res.status(404).json({ error: "Server not found" });
    const server = servers[serverIndex];

    if (user.role !== "admin" && user.role !== "owner" && server.owner !== user.id) {
      return res.status(403).json({ error: "Only admins or owners can change runtime settings" });
    }

    if (server.containerId) {
      const status = await getServerRuntimeStatus(server);
      if (status?.State?.Running) {
        return res.status(400).json({ error: "Server must be stopped before changing runtime. Please stop the server first." });
      }
    }
    
    // We must do a full backup before changing this if requested, but for now we just save it.
    // The instructions say "When an administrator changes the Minecraft version: 1. Stop the server safely... 3. Create a complete backup."
    // Let's call the internal backup logic.
    const backupDir = path.join(process.cwd(), ".data", "backups", id);
    await fs.ensureDir(backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(backupDir, `pre_runtime_update_${timestamp}.zip`);
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    

    if (await fs.pathExists(serverDir)) {
      const archiver = require("archiver");
      const output = fs.createWriteStream(backupFile);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(output);
      archive.directory(serverDir, false);
      
      const serversJSON = await readJSON("servers.json");
      archive.append(JSON.stringify(serversJSON.find((s: any) => s.id === id), null, 2), { name: "server_config_snapshot.json" });
      
      await archive.finalize();
    }


    server.version = version || server.version;
    server.type = type || server.type;
    if (javaVersion !== undefined && javaVersion !== "" && javaVersion !== "auto") {
      server.javaVersion = javaVersion;
    } else {
      server.javaVersion = getJavaVersionForMinecraft(server.version, server.type);
    }
    server.dockerImage = dockerImage || server.dockerImage;
    if (server.dockerImage && server.dockerImage.includes("itzg/minecraft-server")) {
      const neededTag = `java${server.javaVersion || "25"}`;
      if (!server.dockerImage.includes(neededTag)) {
        server.dockerImage = `itzg/minecraft-server:${neededTag}`;
      }
    }
    server.serverJar = serverJar || server.serverJar;
    server.startupCommand = startupCommand || server.startupCommand;

    servers[serverIndex] = server;
    
    if (server.containerId) {
       await deleteServerRuntime(server);
    }
    
    const newContainerId = await createServerRuntime(server);
    server.containerId = newContainerId;
    servers[serverIndex] = server;

    await writeJSON("servers.json", servers);

    res.json({ success: true, server });
  } catch (err: any) {
    console.error("Update runtime error", err);
    res.status(500).json({ error: err.message });
  }
};

export const migrateServerRuntime = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { targetRuntime } = req.body;
  const user = (req as any).user;

  try {
    if (!targetRuntime || (targetRuntime !== "docker" && targetRuntime !== "local")) {
      return res.status(400).json({ error: "Invalid target runtime. Must be 'docker' or 'local'." });
    }

    const servers = await readJSON("servers.json") || [];
    const serverIndex = servers.findIndex((s: any) => s.id === id);
    if (serverIndex === -1) {
      return res.status(404).json({ error: "Server not found" });
    }

    const server = servers[serverIndex];
    if (user.role !== "admin" && user.role !== "owner" && server.owner !== user.id) {
      return res.status(403).json({ error: "Only admins or owners can migrate runtime" });
    }

    // Check if server is running
    if (server.containerId) {
      const status = await getServerRuntimeStatus(server);
      if (status?.State?.Running) {
        return res.status(400).json({ error: "Server must be stopped before migrating runtime. Please stop the server first." });
      }
      // Clean up old runtime instance (container or local process state)
      await deleteServerRuntime(server);
    }

    // Update runtime type
    server.runtimeType = targetRuntime;

    // Create the new runtime container/process metadata
    const newContainerId = await createServerRuntime(server);
    server.containerId = newContainerId;
    servers[serverIndex] = server;

    await writeJSON("servers.json", servers);
    res.json({ success: true, server, runtimeType: targetRuntime });
  } catch (err: any) {
    console.error("Migrate runtime error:", err);
    res.status(500).json({ error: err.message || "Failed to migrate server runtime" });
  }
};



/**
 * Helper to normalize, extract, sync settings, and structure server files from an extracted backup directory
 */
export async function applyAndSyncServerBackupPayload(
  extractedDir: string,
  serverDir: string,
  serverData: any,
  options: { preservePort?: boolean; cleanExisting?: boolean } = {}
) {
  const { preservePort = true, cleanExisting = true } = options;

  // 1. Locate the actual server root inside extractedDir
  // Many backups (Aternos, Pterodactyl, FalixNodes, ZIPs) wrap files in an outer folder
  let payloadDir = extractedDir;
  
  // Check if current directory has indicators of a Minecraft server root
  const isServerRoot = async (dir: string): Promise<boolean> => {
    const hasProps = await fs.pathExists(path.join(dir, "server.properties"));
    const hasWorld = (await fs.pathExists(path.join(dir, "world"))) || (await fs.pathExists(path.join(dir, "region"))) || (await fs.pathExists(path.join(dir, "level.dat")));
    const hasPlugins = await fs.pathExists(path.join(dir, "plugins"));
    const hasMods = await fs.pathExists(path.join(dir, "mods"));
    const files = await fs.readdir(dir).catch(() => []);
    const hasJar = files.some((f) => f.endsWith(".jar"));
    const hasConfig = (await fs.pathExists(path.join(dir, "config"))) || (await fs.pathExists(path.join(dir, "spigot.yml"))) || (await fs.pathExists(path.join(dir, "bukkit.yml")));
    return hasProps || hasWorld || hasPlugins || hasMods || hasJar || hasConfig;
  };

  if (!(await isServerRoot(extractedDir))) {
    // Look 1 level deep inside subdirectories
    const subdirs = (await fs.readdir(extractedDir, { withFileTypes: true })).filter((d) => d.isDirectory());
    for (const sub of subdirs) {
      const candidate = path.join(extractedDir, sub.name);
      if (await isServerRoot(candidate)) {
        payloadDir = candidate;
        break;
      }
    }
  }

  // 2. Prepare destination server directory
  await fs.ensureDir(serverDir);
  if (cleanExisting) {
    // Remove old files except critical session lock or runtime logs
    const existing = await fs.readdir(serverDir);
    for (const item of existing) {
      if (item !== ".logs" && item !== "server.log") {
        await fs.remove(path.join(serverDir, item));
      }
    }
  }

  // 3. Copy all files from payloadDir to serverDir
  await fs.copy(payloadDir, serverDir, { overwrite: true });

  // 4. Handle nested world folders (e.g. if the backup was ONLY a world zip with region/ and level.dat at root)
  const rootHasRegion = await fs.pathExists(path.join(serverDir, "region"));
  const rootHasLevelDat = await fs.pathExists(path.join(serverDir, "level.dat"));
  if (rootHasRegion || rootHasLevelDat) {
    // Move region, data, entities, poi, level.dat into world/
    const targetWorldDir = path.join(serverDir, "world");
    await fs.ensureDir(targetWorldDir);
    const worldItems = ["region", "data", "entities", "poi", "datapacks", "level.dat", "level.dat_old", "session.lock", "advancements", "stats", "playerdata", "DIM-1", "DIM1"];
    for (const wItem of worldItems) {
      const srcP = path.join(serverDir, wItem);
      const dstP = path.join(targetWorldDir, wItem);
      if (await fs.pathExists(srcP) && srcP !== dstP) {
        await fs.move(srcP, dstP, { overwrite: true });
      }
    }
  }

  // 5. Deep server.properties Parsing & Synchronization
  const propsPath = path.join(serverDir, "server.properties");
  const extractedProps: Record<string, string> = {};
  
  if (await fs.pathExists(propsPath)) {
    const rawProps = await fs.readFile(propsPath, "utf-8");
    const lines = rawProps.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const k = trimmed.substring(0, eqIdx).trim();
        const v = trimmed.substring(eqIdx + 1).trim();
        extractedProps[k] = v;
      }
    }
  }

  // Determine updated server metadata
  const servers = (await readJSON("servers.json")) || [];
  const sIdx = servers.findIndex((s: any) => s.id === serverData.id);
  const updatedServer = sIdx !== -1 ? { ...servers[sIdx] } : { ...serverData };

  // Sync properties into server object
  if (extractedProps["motd"]) updatedServer.motd = extractedProps["motd"];
  if (extractedProps["level-name"]) updatedServer.levelName = extractedProps["level-name"];
  if (extractedProps["gamemode"]) updatedServer.gamemode = extractedProps["gamemode"];
  if (extractedProps["difficulty"]) updatedServer.difficulty = extractedProps["difficulty"];
  if (extractedProps["max-players"]) updatedServer.maxPlayers = parseInt(extractedProps["max-players"], 10) || 20;
  if (extractedProps["online-mode"]) updatedServer.onlineMode = extractedProps["online-mode"] === "true";
  if (extractedProps["pvp"]) updatedServer.pvp = extractedProps["pvp"] !== "false";
  if (extractedProps["allow-flight"]) updatedServer.allowFlight = extractedProps["allow-flight"] === "true";
  if (extractedProps["enable-command-block"]) updatedServer.enableCommandBlock = extractedProps["enable-command-block"] === "true";
  if (extractedProps["hardcore"]) updatedServer.hardcore = extractedProps["hardcore"] === "true";

  // Re-write clean standardized server.properties (keeping network port assigned by panel)
  const finalPort = preservePort ? (serverData.port || 25565) : (parseInt(extractedProps["server-port"], 10) || serverData.port || 25565);
  const levelName = extractedProps["level-name"] || updatedServer.levelName || "world";

  const standardProps = [
    `# Minecraft Server Properties - Restored from External Backup`,
    `server-port=${finalPort}`,
    `server-ip=0.0.0.0`,
    `motd=${extractedProps["motd"] || updatedServer.motd || updatedServer.name || "A Minecraft Server"}`,
    `level-name=${levelName}`,
    `gamemode=${extractedProps["gamemode"] || "survival"}`,
    `difficulty=${extractedProps["difficulty"] || "easy"}`,
    `pvp=${extractedProps["pvp"] || "true"}`,
    `max-players=${extractedProps["max-players"] || "20"}`,
    `online-mode=${extractedProps["online-mode"] || "false"}`,
    `allow-flight=${extractedProps["allow-flight"] || "true"}`,
    `enable-command-block=${extractedProps["enable-command-block"] || "true"}`,
    `spawn-protection=${extractedProps["spawn-protection"] || "0"}`,
    `view-distance=${extractedProps["view-distance"] || "10"}`,
    `simulation-distance=${extractedProps["simulation-distance"] || "10"}`,
    `enable-query=true`,
    `query.port=${finalPort}`,
    `enable-rcon=${extractedProps["enable-rcon"] || "false"}`,
    `white-list=${extractedProps["white-list"] || "false"}`,
    `enforce-whitelist=${extractedProps["enforce-whitelist"] || "false"}`,
    `hardcore=${extractedProps["hardcore"] || "false"}`,
    `level-seed=${extractedProps["level-seed"] || ""}`,
    `level-type=${extractedProps["level-type"] || "minecraft:normal"}`
  ].join("\n");

  await fs.writeFile(propsPath, standardProps, "utf-8");

  // 6. EULA Verification
  const eulaPath = path.join(serverDir, "eula.txt");
  await fs.writeFile(eulaPath, "eula=true\n", "utf-8");

  // 7. Ensure Standard Aternos & Minecraft files (ops, whitelist, banned-players, bukkit, spigot)
  await ensureAternosStandardServerFiles(serverDir, updatedServer);
  await ensureDefaultWorldStructure(serverDir, levelName);

  // 8. Auto-detect Server Software & JAR
  const filesInDir = await fs.readdir(serverDir);
  const jarFiles = filesInDir.filter((f) => f.endsWith(".jar"));
  
  let detectedSoftware = updatedServer.type || "PAPER";
  let detectedJar: string | undefined = jarFiles.find((f) => f === "server.jar");

  if (!detectedJar && jarFiles.length > 0) {
    // Pick the most likely server engine jar
    const engineJar = jarFiles.find((f) => 
      f.toLowerCase().includes("paper") ||
      f.toLowerCase().includes("purpur") ||
      f.toLowerCase().includes("spigot") ||
      f.toLowerCase().includes("forge") ||
      f.toLowerCase().includes("fabric") ||
      f.toLowerCase().includes("server")
    ) || jarFiles[0];

    if (engineJar) {
      detectedJar = engineJar;
      const lower = engineJar.toLowerCase();
      if (lower.includes("paper")) detectedSoftware = "PAPER";
      else if (lower.includes("purpur")) detectedSoftware = "PURPUR";
      else if (lower.includes("spigot")) detectedSoftware = "SPIGOT";
      else if (lower.includes("fabric")) detectedSoftware = "FABRIC";
      else if (lower.includes("forge")) detectedSoftware = "FORGE";
      else if (lower.includes("velocity")) detectedSoftware = "VELOCITY";
      else if (lower.includes("bungee")) detectedSoftware = "BUNGEECORD";

      // Symlink or copy to server.jar if server.jar is missing
      const serverJarPath = path.join(serverDir, "server.jar");
      if (!fs.existsSync(serverJarPath)) {
        await fs.copy(path.join(serverDir, engineJar), serverJarPath);
      }
    }
  }

  // Update server in database
  updatedServer.type = detectedSoftware;
  if (sIdx !== -1) {
    servers[sIdx] = updatedServer;
    await writeJSON("servers.json", servers);
  }

  // 9. Recursively set proper permissions
  await secureDirectoryPermissions(serverDir);

  // 10. Compute detection summary stats
  const pluginsDir = path.join(serverDir, "plugins");
  let pluginsFound = 0;
  if (await fs.pathExists(pluginsDir)) {
    const pFiles = await fs.readdir(pluginsDir);
    pluginsFound = pFiles.filter((f) => f.endsWith(".jar")).length;
  }

  const modsDir = path.join(serverDir, "mods");
  let modsFound = 0;
  if (await fs.pathExists(modsDir)) {
    const mFiles = await fs.readdir(modsDir);
    modsFound = mFiles.filter((f) => f.endsWith(".jar")).length;
  }

  const worldsFound: string[] = [];
  for (const f of filesInDir) {
    const fullP = path.join(serverDir, f);
    if ((await fs.stat(fullP)).isDirectory()) {
      if ((await fs.pathExists(path.join(fullP, "region"))) || (await fs.pathExists(path.join(fullP, "level.dat"))) || f === levelName || f.startsWith(`${levelName}_`)) {
        worldsFound.push(f);
      }
    }
  }

  const configsFound = filesInDir.filter((f) => f.endsWith(".yml") || f.endsWith(".json") || f.endsWith(".properties") || f.endsWith(".toml")).length;

  return {
    server: updatedServer,
    summary: {
      serverName: updatedServer.name,
      motd: updatedServer.motd || extractedProps["motd"] || "A Minecraft Server",
      gamemode: updatedServer.gamemode || "survival",
      difficulty: updatedServer.difficulty || "easy",
      activeWorld: levelName,
      maxPlayers: updatedServer.maxPlayers || 20,
      detectedSoftware,
      pluginsFound,
      modsFound,
      worldsFound,
      configsFound,
      totalFilesRestored: filesInDir.length
    }
  };
}

export const uploadExternalBackup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { action = "restore_and_apply", preservePort = "true" } = req.body;
  const shouldPreservePort = preservePort === "true" || preservePort === true;
  const shouldRestore = action === "restore_and_apply" || action === "restore";

  if (!req.file) {
    return res.status(400).json({ error: "No backup archive file uploaded." });
  }

  const uploadedFilePath = req.file.path;
  const originalName = req.file.originalname || `backup-${Date.now()}.zip`;
  const cleanOriginalName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");

  const serverDir = path.join(process.cwd(), ".data", "servers", id);
  const backupsDir = path.join(process.cwd(), ".data", "backups", id);
  await fs.ensureDir(backupsDir);

  try {
    const servers = (await readJSON("servers.json")) || [];
    const server = servers.find((s: any) => s.id === id);
    if (!server) {
      if (fs.existsSync(uploadedFilePath)) await fs.remove(uploadedFilePath);
      return res.status(404).json({ error: "Server not found" });
    }

    if (shouldRestore) {
      const status = await getServerRuntimeStatus({ id } as any);
      if (status?.State?.Running) {
        if (fs.existsSync(uploadedFilePath)) await fs.remove(uploadedFilePath);
        return res.status(400).json({ error: "Please stop the server before uploading and restoring a backup." });
      }
    }

    // Store a permanent copy in .data/backups/:id for user records
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storedBackupFilename = `uploaded_${timestamp}_${cleanOriginalName.endsWith(".zip") ? cleanOriginalName : `${cleanOriginalName}.zip`}`;
    const storedBackupPath = path.join(backupsDir, storedBackupFilename);
    await fs.copy(uploadedFilePath, storedBackupPath);
    await secureFilePermissions(storedBackupPath);

    if (!shouldRestore) {
      // Just save to backups directory
      if (fs.existsSync(uploadedFilePath)) await fs.remove(uploadedFilePath);
      return res.json({
        success: true,
        action: "saved",
        filename: storedBackupFilename,
        message: `Backup archive '${cleanOriginalName}' saved successfully to your backups repository.`
      });
    }

    // Extract to a temporary directory
    const tempExtractDir = path.join(process.cwd(), ".data", "temp", `extract_backup_${Date.now()}`);
    await fs.ensureDir(tempExtractDir);
    await extractArchive(uploadedFilePath, tempExtractDir);

    // Apply & Synchronize Server settings, files, worlds, and properties
    const result = await applyAndSyncServerBackupPayload(tempExtractDir, serverDir, server, {
      preservePort: shouldPreservePort,
      cleanExisting: true
    });

    // Clean up temporary files
    await fs.remove(tempExtractDir);
    if (fs.existsSync(uploadedFilePath)) await fs.remove(uploadedFilePath);

    res.json({
      success: true,
      action: "restored",
      filename: storedBackupFilename,
      message: `External server backup '${cleanOriginalName}' extracted and configured successfully!`,
      details: result.summary,
      server: result.server
    });
  } catch (err: any) {
    if (fs.existsSync(uploadedFilePath)) await fs.remove(uploadedFilePath).catch(() => {});
    console.error("Upload external backup error:", err);
    res.status(500).json({ error: err.message || "Failed to process external server backup" });
  }
};

export const restoreBackup = async (req: Request, res: Response) => {
  const { id, filename } = req.params;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);
  const backupsDir = path.join(process.cwd(), ".data", "backups", id);
  const backupPath = path.join(backupsDir, filename);

  try {
    if (!(await fs.pathExists(backupPath))) {
      return res.status(404).json({ error: "Backup not found" });
    }

    const servers = (await readJSON("servers.json")) || [];
    const server = servers.find((s: any) => s.id === id);
    if (!server) {
      return res.status(404).json({ error: "Server not found" });
    }

    const status = await getServerRuntimeStatus({ id } as any);
    if (status?.State?.Running) {
      return res.status(400).json({ error: "Please stop the server before restoring a backup." });
    }

    // Extract to a temporary directory to perform smart detection & synchronization
    const tempExtractDir = path.join(process.cwd(), ".data", "temp", `restore_${Date.now()}`);
    await fs.ensureDir(tempExtractDir);
    await extractArchive(backupPath, tempExtractDir);

    // Apply & Synchronize
    const result = await applyAndSyncServerBackupPayload(tempExtractDir, serverDir, server, {
      preservePort: true,
      cleanExisting: true
    });

    await fs.remove(tempExtractDir);

    res.json({
      success: true,
      message: "Server restored and all settings synchronized successfully!",
      details: result.summary,
      server: result.server
    });
  } catch (err: any) {
    console.error("Restore backup error:", err);
    res.status(500).json({ error: err.message || "Failed to restore backup" });
  }
};

export const uploadPluginZip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: "No ZIP file uploaded" });
    }
    const uploadedPath = req.file.path;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const pluginsDir = path.join(serverDir, "plugins");
    await fs.ensureDir(pluginsDir);

    const tempExtractDir = path.join(process.cwd(), ".data", "temp", `plugins_zip_${Date.now()}`);
    await fs.ensureDir(tempExtractDir);
    await extractArchive(uploadedPath, tempExtractDir);

    const installedJars: string[] = [];
    const findJars = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await findJars(full);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".jar")) {
          const dest = path.join(pluginsDir, entry.name);
          await fs.copy(full, dest, { overwrite: true });
          installedJars.push(entry.name);
        }
      }
    };
    await findJars(tempExtractDir);

    const topEntries = await fs.readdir(tempExtractDir, { withFileTypes: true });
    for (const top of topEntries) {
      if (top.isDirectory() && top.name.toLowerCase() !== "__macosx") {
        const destFolder = path.join(pluginsDir, top.name);
        await fs.copy(path.join(tempExtractDir, top.name), destFolder, { overwrite: true }).catch(() => {});
      }
    }

    await fs.remove(tempExtractDir).catch(() => {});
    await fs.remove(uploadedPath).catch(() => {});

    if (installedJars.length === 0) {
      return res.status(400).json({ error: "Uploaded ZIP file did not contain any .jar plugin files." });
    }

    res.json({
      success: true,
      message: `Successfully extracted and installed ${installedJars.length} plugins from ZIP archive!`,
      installedPlugins: installedJars
    });
  } catch (err: any) {
    console.error("Plugin ZIP upload error:", err);
    res.status(500).json({ error: err.message || "Failed to process plugin ZIP archive." });
  }
};

const DEFAULT_PLUGIN_PACKS = [
  {
    id: "pack_survival_essentials",
    name: "Survival Essentials Pack",
    description: "Must-have plugins for any survival server: commands, homes, economy, permissions, and world protection.",
    picture: "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600&auto=format&fit=crop&q=80",
    author: "JTG Essentials",
    isPreset: true,
    plugins: [
      { name: "EssentialsX", source: "spigot", id: "essentialsx" },
      { name: "WorldEdit", source: "modrinth", id: "worldedit" },
      { name: "LuckPerms", source: "modrinth", id: "luckperms" },
      { name: "Vault", source: "spigot", id: "vault" },
      { name: "CoreProtect", source: "spigot", id: "coreprotect" },
      { name: "Chunky", source: "modrinth", id: "chunky" }
    ]
  },
  {
    id: "pack_bedrock_crossplay",
    name: "Bedrock Crossplay Pack (Geyser)",
    description: "Allow players on Bedrock Edition (Android, iOS, Xbox, PS4/5, Nintendo Switch) to join your Java server seamlessly.",
    picture: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
    author: "GeyserMC Team",
    isPreset: true,
    plugins: [
      { name: "Geyser-Spigot", source: "modrinth", id: "geyser" },
      { name: "Floodgate", source: "modrinth", id: "floodgate" },
      { name: "ViaVersion", source: "modrinth", id: "viaversion" },
      { name: "ViaBackwards", source: "modrinth", id: "viabackwards" }
    ]
  },
  {
    id: "pack_economy_shops",
    name: "Economy & Player Shops",
    description: "Complete economy infrastructure with virtual currency, chest shops, auction houses, and floating holographic scoreboards.",
    picture: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    author: "Marketplace Suite",
    isPreset: true,
    plugins: [
      { name: "Vault", source: "spigot", id: "vault" },
      { name: "EssentialsX", source: "spigot", id: "essentialsx" },
      { name: "DecentHolograms", source: "spigot", id: "decentholograms" },
      { name: "TAB", source: "modrinth", id: "tab" }
    ]
  },
  {
    id: "pack_security_antigrief",
    name: "Security & Anti-Grief Defense",
    description: "Complete protection against griefers, block stealing, server lag, inventory theft, and unauthorized player joins.",
    picture: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80",
    author: "Security Guard",
    isPreset: true,
    plugins: [
      { name: "CoreProtect", source: "spigot", id: "coreprotect" },
      { name: "LuckPerms", source: "modrinth", id: "luckperms" },
      { name: "ClearLag", source: "bukkit", id: "clearlag" }
    ]
  },
  {
    id: "pack_hub_minigames",
    name: "Hub, Lobbies & Holograms",
    description: "Create an attractive multiplayer lobby with custom floating text, custom player tablists, and world managers.",
    picture: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop&q=80",
    author: "Hub Masters",
    isPreset: true,
    plugins: [
      { name: "DecentHolograms", source: "spigot", id: "decentholograms" },
      { name: "TAB", source: "modrinth", id: "tab" },
      { name: "WorldEdit", source: "modrinth", id: "worldedit" }
    ]
  }
];

const COMMUNITY_PACKS_FILE = path.join(process.cwd(), "src", "data", "community_plugin_packs.json");

const syncCommunityPack = async (pack: any, shouldRemove = false) => {
  try {
    await fs.ensureFile(COMMUNITY_PACKS_FILE);
    let communityPacks: any[] = [];
    try {
      communityPacks = await fs.readJSON(COMMUNITY_PACKS_FILE);
    } catch {}
    if (!Array.isArray(communityPacks)) communityPacks = [];

    if (shouldRemove) {
      communityPacks = communityPacks.filter((p) => p.id !== pack.id);
    } else {
      const idx = communityPacks.findIndex((p) => p.id === pack.id);
      const communityEntry = {
        ...pack,
        isGlobal: true,
        visibility: "public",
        isPrivate: false,
        shareCode: pack.shareCode || `JTG-WORLD-${pack.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`
      };
      if (idx !== -1) {
        communityPacks[idx] = communityEntry;
      } else {
        communityPacks.push(communityEntry);
      }
    }
    await fs.writeJSON(COMMUNITY_PACKS_FILE, communityPacks, { spaces: 2 });
  } catch (e) {
    console.error("Failed to sync community packs file:", e);
  }
};

export const getPluginPacks = async (req: Request, res: Response) => {
  try {
    const packsFile = path.join(process.cwd(), ".data", "plugin_packs.json");
    let customPacks: any[] = [];
    if (await fs.pathExists(packsFile)) {
      try {
        customPacks = await fs.readJSON(packsFile);
      } catch {}
    }

    let communityPacks: any[] = [];
    if (await fs.pathExists(COMMUNITY_PACKS_FILE)) {
      try {
        communityPacks = await fs.readJSON(COMMUNITY_PACKS_FILE);
      } catch {}
    }

    const customIds = new Set(customPacks.map(p => p.id));
    const communityFiltered = (communityPacks || [])
      .filter(p => !customIds.has(p.id))
      .map(p => ({
        ...p,
        isGlobal: true,
        visibility: "public",
        isPrivate: false,
        shareCode: p.shareCode || `JTG-WORLD-${p.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`
      }));

    const allCustomAndCommunityIds = new Set([...customPacks.map(p => p.id), ...communityFiltered.map(p => p.id)]);
    const presets = DEFAULT_PLUGIN_PACKS
      .filter(p => !allCustomAndCommunityIds.has(p.id))
      .map(p => ({
        ...p,
        isGlobal: true,
        visibility: "public",
        isPrivate: false,
        shareCode: `JTG-WORLD-${p.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`
      }));

    const normalizedCustom = customPacks.map(p => {
      const isPriv = p.visibility === "private" || p.isPrivate === true;
      return {
        ...p,
        isPrivate: isPriv,
        visibility: isPriv ? "private" : "public",
        isGlobal: !isPriv,
        shareCode: p.shareCode || `JTG-WORLD-${p.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`
      };
    });

    let combined = [...presets, ...communityFiltered, ...normalizedCustom];

    // If query requests public global only, filter out private / hidden packs
    const filterVisibility = req.query.visibility as string;
    const filterScope = req.query.scope as string;
    if (filterVisibility === "public" || filterScope === "global") {
      combined = combined.filter(p => p.visibility !== "private" && !p.isPrivate);
    }

    res.json(combined);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch plugin packs" });
  }
};

export const createPluginPack = async (req: Request, res: Response) => {
  try {
    const { name, description, picture, plugins, visibility, isPrivate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Pack name is required" });
    }
    const packsFile = path.join(process.cwd(), ".data", "plugin_packs.json");
    await fs.ensureFile(packsFile);
    let customPacks: any[] = [];
    try {
      customPacks = await fs.readJSON(packsFile);
    } catch {}

    const isPriv = visibility === "private" || isPrivate === true;
    const packId = `pack_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const shareCode = `JTG-WORLD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newPack = {
      id: packId,
      name: name.trim(),
      description: description ? description.trim() : "",
      picture: picture && picture.trim() ? picture.trim() : "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600&auto=format&fit=crop&q=80",
      author: (req as any).user?.username || "Admin",
      isPreset: false,
      isPrivate: isPriv,
      visibility: isPriv ? "private" : "public",
      isGlobal: !isPriv,
      shareCode,
      plugins: Array.isArray(plugins) ? plugins : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    customPacks.push(newPack);
    await fs.writeJSON(packsFile, customPacks, { spaces: 2 });

    // If marked public (global world), sync to community packs repo file!
    if (!isPriv) {
      await syncCommunityPack(newPack, false);
    }

    res.json({ success: true, pack: newPack });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create plugin pack" });
  }
};

export const updatePluginPack = async (req: Request, res: Response) => {
  try {
    const { packId } = req.params;
    const { name, description, picture, plugins, author, visibility, isPrivate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Pack name cannot be empty" });
    }

    const packsFile = path.join(process.cwd(), ".data", "plugin_packs.json");
    await fs.ensureFile(packsFile);
    let customPacks: any[] = [];
    try {
      if (await fs.pathExists(packsFile)) {
        customPacks = await fs.readJSON(packsFile);
      }
    } catch {}

    const existingIdx = customPacks.findIndex(p => p.id === packId);
    let updatedPack: any;

    const isPriv = visibility !== undefined
      ? visibility === "private"
      : isPrivate !== undefined
      ? Boolean(isPrivate)
      : existingIdx !== -1
      ? Boolean(customPacks[existingIdx].isPrivate || customPacks[existingIdx].visibility === "private")
      : false;

    if (existingIdx !== -1) {
      updatedPack = {
        ...customPacks[existingIdx],
        name: name.trim(),
        description: description !== undefined ? description.trim() : customPacks[existingIdx].description,
        picture: picture !== undefined && picture.trim() ? picture.trim() : customPacks[existingIdx].picture,
        plugins: Array.isArray(plugins) ? plugins : customPacks[existingIdx].plugins,
        isPrivate: isPriv,
        visibility: isPriv ? "private" : "public",
        isGlobal: !isPriv,
        shareCode: customPacks[existingIdx].shareCode || `JTG-WORLD-${packId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`,
        updatedAt: new Date().toISOString()
      };
      customPacks[existingIdx] = updatedPack;
    } else {
      const defaultPreset = DEFAULT_PLUGIN_PACKS.find(p => p.id === packId);
      if (defaultPreset) {
        updatedPack = {
          ...defaultPreset,
          name: name.trim(),
          description: description !== undefined ? description.trim() : defaultPreset.description,
          picture: picture !== undefined && picture.trim() ? picture.trim() : defaultPreset.picture,
          plugins: Array.isArray(plugins) ? plugins : defaultPreset.plugins,
          isPreset: false,
          isPrivate: isPriv,
          visibility: isPriv ? "private" : "public",
          isGlobal: !isPriv,
          shareCode: `JTG-WORLD-${packId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`,
          author: author || (req as any).user?.username || defaultPreset.author,
          updatedAt: new Date().toISOString()
        };
        customPacks.push(updatedPack);
      } else {
        updatedPack = {
          id: packId,
          name: name.trim(),
          description: description ? description.trim() : "",
          picture: picture && picture.trim() ? picture.trim() : "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600&auto=format&fit=crop&q=80",
          author: author || (req as any).user?.username || "Admin",
          isPreset: false,
          isPrivate: isPriv,
          visibility: isPriv ? "private" : "public",
          isGlobal: !isPriv,
          shareCode: `JTG-WORLD-${packId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`,
          plugins: Array.isArray(plugins) ? plugins : [],
          updatedAt: new Date().toISOString()
        };
        customPacks.push(updatedPack);
      }
    }

    await fs.writeJSON(packsFile, customPacks, { spaces: 2 });

    // Sync or remove from community packs
    if (isPriv) {
      await syncCommunityPack(updatedPack, true);
    } else {
      await syncCommunityPack(updatedPack, false);
    }

    res.json({
      success: true,
      message: `Plugin pack "${updatedPack.name}" saved successfully!`,
      pack: updatedPack
    });
  } catch (err: any) {
    console.error("Update plugin pack error:", err);
    res.status(500).json({ error: err.message || "Failed to save plugin pack" });
  }
};

export const togglePluginPackVisibility = async (req: Request, res: Response) => {
  try {
    const { packId } = req.params;
    const { visibility } = req.body;
    const packsFile = path.join(process.cwd(), ".data", "plugin_packs.json");
    await fs.ensureFile(packsFile);
    let customPacks: any[] = [];
    try {
      if (await fs.pathExists(packsFile)) {
        customPacks = await fs.readJSON(packsFile);
      }
    } catch {}

    let target = customPacks.find((p) => p.id === packId);
    if (!target) {
      // Check preset or community
      let communityPacks: any[] = [];
      try {
        communityPacks = await fs.readJSON(COMMUNITY_PACKS_FILE);
      } catch {}
      const foundCommunity = communityPacks.find((p) => p.id === packId);
      const foundPreset = DEFAULT_PLUGIN_PACKS.find((p) => p.id === packId);
      if (foundCommunity || foundPreset) {
        target = {
          ...(foundCommunity || foundPreset),
          isPreset: false,
          author: (req as any).user?.username || (foundCommunity || foundPreset)?.author || "Admin"
        };
        customPacks.push(target);
      } else {
        return res.status(404).json({ error: "Plugin pack not found" });
      }
    }

    const nextVisibility = visibility ? visibility : (target.visibility === "private" || target.isPrivate ? "public" : "private");
    const isPriv = nextVisibility === "private";

    target.visibility = nextVisibility;
    target.isPrivate = isPriv;
    target.isGlobal = !isPriv;
    target.updatedAt = new Date().toISOString();

    await fs.writeJSON(packsFile, customPacks, { spaces: 2 });

    if (isPriv) {
      await syncCommunityPack(target, true);
    } else {
      await syncCommunityPack(target, false);
    }

    res.json({
      success: true,
      message: isPriv
        ? `Pack "${target.name}" is now Private / Chhupa Hua (Hidden from Global World).`
        : `Pack "${target.name}" is now Public in Global World Hub!`,
      visibility: nextVisibility,
      pack: target
    });
  } catch (err: any) {
    console.error("Toggle visibility error:", err);
    res.status(500).json({ error: err.message || "Failed to toggle visibility" });
  }
};

export const importPluginPack = async (req: Request, res: Response) => {
  try {
    const { packData, shareCode } = req.body;
    let packToImport: any = null;

    if (packData && typeof packData === "object") {
      packToImport = packData;
    } else if (typeof packData === "string") {
      try {
        packToImport = JSON.parse(packData);
      } catch {
        return res.status(400).json({ error: "Invalid JSON format for plugin pack." });
      }
    } else if (shareCode) {
      // Find in community packs or preset
      let communityPacks: any[] = [];
      try {
        communityPacks = await fs.readJSON(COMMUNITY_PACKS_FILE);
      } catch {}
      const match = communityPacks.find((p) => p.shareCode?.toLowerCase() === shareCode.trim().toLowerCase());
      if (match) {
        packToImport = match;
      } else {
        return res.status(404).json({ error: `No global pack found matching share code "${shareCode}".` });
      }
    }

    if (!packToImport || !packToImport.name) {
      return res.status(400).json({ error: "Invalid pack data. Name is required." });
    }

    const packsFile = path.join(process.cwd(), ".data", "plugin_packs.json");
    await fs.ensureFile(packsFile);
    let customPacks: any[] = [];
    try {
      customPacks = await fs.readJSON(packsFile);
    } catch {}

    const newPack = {
      id: `pack_imported_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: packToImport.name,
      description: packToImport.description || "",
      picture: packToImport.picture || "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600&auto=format&fit=crop&q=80",
      author: packToImport.author || (req as any).user?.username || "Community",
      isPreset: false,
      isPrivate: Boolean(packToImport.isPrivate || packToImport.visibility === "private"),
      visibility: packToImport.visibility || (packToImport.isPrivate ? "private" : "public"),
      isGlobal: !(packToImport.isPrivate || packToImport.visibility === "private"),
      shareCode: packToImport.shareCode || `JTG-WORLD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      plugins: Array.isArray(packToImport.plugins) ? packToImport.plugins : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    customPacks.push(newPack);
    await fs.writeJSON(packsFile, customPacks, { spaces: 2 });

    res.json({
      success: true,
      message: `Plugin pack "${newPack.name}" imported successfully (${newPack.plugins.length} plugins)!`,
      pack: newPack
    });
  } catch (err: any) {
    console.error("Import pack error:", err);
    res.status(500).json({ error: err.message || "Failed to import plugin pack" });
  }
};

export const deletePluginPack = async (req: Request, res: Response) => {
  try {
    const { packId } = req.params;
    const packsFile = path.join(process.cwd(), ".data", "plugin_packs.json");
    if (!await fs.pathExists(packsFile)) {
      return res.status(404).json({ error: "No custom packs found" });
    }
    let customPacks: any[] = await fs.readJSON(packsFile);
    const prevLen = customPacks.length;
    customPacks = customPacks.filter(p => p.id !== packId);
    if (customPacks.length === prevLen) {
      return res.status(404).json({ error: "Pack not found or cannot delete preset packs" });
    }
    await fs.writeJSON(packsFile, customPacks, { spaces: 2 });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete plugin pack" });
  }
};

export const installPluginPack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { packId, plugins } = req.body;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const pluginsDir = path.join(serverDir, "plugins");
    await fs.ensureDir(pluginsDir);

    let pluginsToInstall = plugins;
    if (!pluginsToInstall || !Array.isArray(pluginsToInstall)) {
      const packsFile = path.join(process.cwd(), ".data", "plugin_packs.json");
      let allPacks = [...DEFAULT_PLUGIN_PACKS];
      if (await fs.pathExists(packsFile)) {
        try {
          const custom = await fs.readJSON(packsFile);
          allPacks = [...allPacks, ...custom];
        } catch {}
      }
      const found = allPacks.find(p => p.id === packId);
      if (!found) {
        return res.status(404).json({ error: "Plugin pack not found" });
      }
      pluginsToInstall = found.plugins;
    }

    const results: { name: string; success: boolean; error?: string }[] = [];
    const axios = (await import("axios")).default;
    const commonHeaders = {
      'User-Agent': 'JTGPanel/3.1.0 (https://github.com/jishnu; support@jtgpanel.net)'
    };

    for (const plugin of pluginsToInstall) {
      const pName = typeof plugin === 'string' ? plugin : plugin.name;
      try {
        const mrSearch: any = await axios.get(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(pName)}&facets=[["project_type:plugin"]]&limit=1`, {
          headers: commonHeaders,
          timeout: 6000
        }).catch(() => null);

        let dlUrl = null;
        let finalFilename = `${pName.replace(/[^a-zA-Z0-9]/g, '_')}.jar`;

        if (mrSearch && mrSearch.data && mrSearch.data.hits && mrSearch.data.hits.length > 0) {
          const hit = mrSearch.data.hits[0];
          const verRes: any = await axios.get(`https://api.modrinth.com/v2/project/${hit.project_id}/version`, {
            headers: commonHeaders,
            timeout: 6000
          }).catch(() => null);
          if (verRes && verRes.data && verRes.data.length > 0) {
            const latestVer = verRes.data[0];
            const jarFile = latestVer.files?.find((f: any) => f.filename?.endsWith('.jar') && (f.primary || true));
            if (jarFile?.url) {
              dlUrl = jarFile.url;
              finalFilename = jarFile.filename || finalFilename;
            }
          }
        }

        if (dlUrl) {
          const fileDest = path.join(pluginsDir, finalFilename);
          const dlRes = await axios({ url: dlUrl, method: 'GET', responseType: 'stream', timeout: 15000 });
          const writer = fs.createWriteStream(fileDest);
          dlRes.data.pipe(writer);
          await new Promise<void>((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
          results.push({ name: pName, success: true });
        } else {
          // Check PaperMC Hangar
          const hangarSearch = await axios.get(`https://hangar.papermc.io/api/v1/projects?q=${encodeURIComponent(pName)}&limit=1`, {
            headers: commonHeaders,
            timeout: 6000
          }).catch(() => null);
          const hProject = hangarSearch?.data?.result?.[0];
          if (hProject) {
            const hVer = await axios.get(`https://hangar.papermc.io/api/v1/projects/${hProject.name}/versions?limit=1`, {
              headers: commonHeaders,
              timeout: 6000
            }).catch(() => null);
            const latestVer = hVer?.data?.result?.[0];
            const platformDl = latestVer?.downloads?.PAPER || latestVer?.downloads?.WATERFALL || latestVer?.downloads?.VELOCITY;
            if (platformDl?.downloadUrl) {
              const fileDest = path.join(pluginsDir, `${hProject.name}.jar`);
              const dlRes = await axios({ url: platformDl.downloadUrl, method: 'GET', responseType: 'stream', timeout: 15000 });
              const writer = fs.createWriteStream(fileDest);
              dlRes.data.pipe(writer);
              await new Promise<void>((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });
              results.push({ name: pName, success: true });
              continue;
            }
          }
          results.push({ name: pName, success: false, error: "Download link not found automatically" });
        }
      } catch (err: any) {
        results.push({ name: pName, success: false, error: err.message || "Failed to download" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    res.json({
      success: true,
      message: `Installed ${successCount} of ${pluginsToInstall.length} plugins from pack!`,
      results
    });
  } catch (err: any) {
    console.error("Install pack error:", err);
    res.status(500).json({ error: err.message || "Failed to install plugin pack" });
  }
};
