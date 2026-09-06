import fs from "fs-extra";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const SERVERS_DIR = path.join(DATA_DIR, "servers");

/**
 * Scan .data/servers and recover any server directories that are missing from servers.json
 */
export const recoverServersFromDisk = async (existingServers: any[] = []): Promise<any[]> => {
  try {
    if (!(await fs.pathExists(SERVERS_DIR))) {
      return existingServers;
    }

    const serverDirs = await fs.readdir(SERVERS_DIR, { withFileTypes: true });
    const knownIds = new Set((existingServers || []).map((s: any) => s.id));
    const recoveredList = [...(existingServers || [])];
    let changed = false;

    for (const entry of serverDirs) {
      if (!entry.isDirectory()) continue;
      const sId = entry.name;
      const sDir = path.join(SERVERS_DIR, sId);

      // Check if we already have this server in our list
      const existingIndex = recoveredList.findIndex((s: any) => s.id === sId);

      // 1. Try reading local per-server metadata backup first
      const metaPath = path.join(sDir, ".server_metadata.json");
      let localMeta: any = null;
      if (await fs.pathExists(metaPath)) {
        try {
          localMeta = await fs.readJson(metaPath);
        } catch {}
      }

      if (existingIndex === -1) {
        // Server directory exists on disk but is missing from servers.json
        if (localMeta && localMeta.id === sId) {
          // Recover exact server record from local metadata
          localMeta.isPermanent = true;
          localMeta.lifespan = "infinity";
          localMeta.autoDelete = false;
          recoveredList.push(localMeta);
          changed = true;
        } else {
          // Reconstruct server from server.properties and disk files
          const propsPath = path.join(sDir, "server.properties");
          let port = 25565;
          let motd = "A Minecraft Server";
          let levelName = "world";
          let gamemode = "survival";
          let difficulty = "easy";

          if (await fs.pathExists(propsPath)) {
            try {
              const rawProps = await fs.readFile(propsPath, "utf-8");
              for (const line of rawProps.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) continue;
                const eq = trimmed.indexOf("=");
                if (eq !== -1) {
                  const k = trimmed.substring(0, eq).trim();
                  const v = trimmed.substring(eq + 1).trim();
                  if (k === "server-port") port = parseInt(v, 10) || 25565;
                  if (k === "motd") motd = v;
                  if (k === "level-name") levelName = v;
                  if (k === "gamemode") gamemode = v;
                  if (k === "difficulty") difficulty = v;
                }
              }
            } catch {}
          }

          // Check if Node/Python or Minecraft
          const isNode = await fs.pathExists(path.join(sDir, "package.json"));
          const isPython = await fs.pathExists(path.join(sDir, "requirements.txt")) || await fs.pathExists(path.join(sDir, "main.py"));
          
          let detectedType = "PAPER";
          if (isNode) detectedType = "NODEJS";
          else if (isPython) detectedType = "PYTHON";

          const reconstructed: any = {
            id: sId,
            name: motd || `Server-${port}`,
            motd,
            levelName,
            gamemode,
            difficulty,
            owner: "admin",
            ownerId: "admin",
            ownerUsername: "admin",
            ram: 2,
            cpu: 100,
            disk: 10,
            port,
            ipAlias: "",
            runtimeType: "local",
            nodeId: "local",
            type: detectedType,
            version: "latest",
            serverJar: "server.jar",
            status: "offline",
            isPermanent: true,
            lifespan: "infinity",
            autoDelete: false,
            createdAt: new Date().toISOString(),
            containerId: null
          };

          // Save .server_metadata.json into folder
          await fs.writeJson(metaPath, reconstructed, { spaces: 2 }).catch(() => {});
          recoveredList.push(reconstructed);
          changed = true;
        }
      } else {
        // Ensure infinity & permanence tags exist
        const s = recoveredList[existingIndex];
        if (!s.isPermanent || s.lifespan !== "infinity") {
          s.isPermanent = true;
          s.lifespan = "infinity";
          s.autoDelete = false;
          changed = true;
        }
        // Keep per-server local metadata up to date
        await fs.writeJson(metaPath, s, { spaces: 2 }).catch(() => {});
      }
    }

    if (changed) {
      const filePath = path.join(DATA_DIR, "servers.json");
      const vaultPath = path.join(DATA_DIR, "servers_persistent_vault.json");
      const backupPath = path.join(DATA_DIR, "servers.json.bak");
      await fs.writeJson(filePath, recoveredList, { spaces: 2 }).catch(() => {});
      await fs.writeJson(vaultPath, recoveredList, { spaces: 2 }).catch(() => {});
      await fs.writeJson(backupPath, recoveredList, { spaces: 2 }).catch(() => {});
    }

    return recoveredList;
  } catch (err) {
    console.error("[recoverServersFromDisk] Notice:", err);
    return existingServers;
  }
};

export const readJSON = async (filename: string) => {
  const filePath = path.join(DATA_DIR, filename);
  const backupPath = path.join(DATA_DIR, `${filename}.bak`);
  const vaultPath = path.join(DATA_DIR, filename === "servers.json" ? "servers_persistent_vault.json" : `${filename}.vault`);

  let loadedData: any = null;

  try {
    if (await fs.pathExists(filePath)) {
      const data = await fs.readJson(filePath);
      if (data !== null && data !== undefined) {
        loadedData = data;
      }
    }
  } catch (err) {
    console.warn(`[DB Read Notice] Issue reading ${filename}, attempting fallback:`, err);
  }

  // Fallback 1: Backup copy
  if (loadedData === null || (Array.isArray(loadedData) && loadedData.length === 0 && filename === "servers.json")) {
    try {
      if (await fs.pathExists(backupPath)) {
        const backupData = await fs.readJson(backupPath);
        if (backupData !== null && backupData !== undefined && (!Array.isArray(backupData) || backupData.length > 0)) {
          loadedData = backupData;
          await fs.writeJson(filePath, backupData, { spaces: 2 }).catch(() => {});
        }
      }
    } catch {}
  }

  // Fallback 2: Persistent vault copy
  if (loadedData === null || (Array.isArray(loadedData) && loadedData.length === 0 && filename === "servers.json")) {
    try {
      if (await fs.pathExists(vaultPath)) {
        const vaultData = await fs.readJson(vaultPath);
        if (vaultData !== null && vaultData !== undefined && (!Array.isArray(vaultData) || vaultData.length > 0)) {
          loadedData = vaultData;
          await fs.writeJson(filePath, vaultData, { spaces: 2 }).catch(() => {});
        }
      }
    } catch {}
  }

  // For servers.json: Self-healing scan of server directories on disk
  if (filename === "servers.json") {
    const list = Array.isArray(loadedData) ? loadedData : [];
    const recovered = await recoverServersFromDisk(list);
    return recovered;
  }

  return loadedData;
};

export const writeJSON = async (filename: string, data: any) => {
  const filePath = path.join(DATA_DIR, filename);
  const backupPath = path.join(DATA_DIR, `${filename}.bak`);
  const vaultPath = path.join(DATA_DIR, filename === "servers.json" ? "servers_persistent_vault.json" : `${filename}.vault`);
  const tempPath = path.join(DATA_DIR, `${filename}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);

  try {
    await fs.ensureDir(DATA_DIR);

    // If writing servers.json, ensure each server object has permanence metadata & local copy
    if (filename === "servers.json" && Array.isArray(data)) {
      for (const s of data) {
        if (s && s.id) {
          s.isPermanent = true;
          s.lifespan = "infinity";
          s.autoDelete = false;
          // Also save per-server metadata in .data/servers/:id/.server_metadata.json
          const sDir = path.join(SERVERS_DIR, s.id);
          if (await fs.pathExists(sDir)) {
            await fs.writeJson(path.join(sDir, ".server_metadata.json"), s, { spaces: 2 }).catch(() => {});
          }
        }
      }
    }

    // 1. Write to temporary file
    await fs.writeJson(tempPath, data, { spaces: 2 });
    // 2. Atomically rename temp file to target file
    await fs.move(tempPath, filePath, { overwrite: true });
    // 3. Keep backup and persistent vault copies for resilience
    await fs.copy(filePath, backupPath, { overwrite: true }).catch(() => {});
    await fs.copy(filePath, vaultPath, { overwrite: true }).catch(() => {});
  } catch (err) {
    try {
      if (await fs.pathExists(tempPath)) await fs.remove(tempPath);
    } catch {}
    // Direct write fallback
    await fs.writeJson(filePath, data, { spaces: 2 });
    await fs.writeJson(backupPath, data, { spaces: 2 }).catch(() => {});
    await fs.writeJson(vaultPath, data, { spaces: 2 }).catch(() => {});
  }
};


