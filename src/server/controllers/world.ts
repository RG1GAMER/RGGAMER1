import { Request, Response } from "express";
import path from "path";
import fs from "fs-extra";
import nbt from "prismarine-nbt";
import { promisify } from "util";
import * as archiverPkg from "archiver";
import { extractArchive } from "../utils/extract.js";

const archiver = (archiverPkg as any).default || archiverPkg;
const parseNbt = promisify(nbt.parse);

async function getLevelName(serverDir: string) {
  const propsPath = path.join(serverDir, "server.properties");
  if (fs.existsSync(propsPath)) {
    const props = await fs.readFile(propsPath, "utf-8");
    const match = props.match(/^level-name=(.*)$/m);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  return "world";
}

async function setLevelNameInProperties(serverDir: string, newLevelName: string) {
  const propsPath = path.join(serverDir, "server.properties");
  if (fs.existsSync(propsPath)) {
    let props = await fs.readFile(propsPath, "utf-8");
    if (/^level-name=.*$/m.test(props)) {
      props = props.replace(/^level-name=.*$/m, `level-name=${newLevelName}`);
    } else {
      props += `\nlevel-name=${newLevelName}\n`;
    }
    await fs.writeFile(propsPath, props, "utf-8");
  } else {
    // create basic server.properties if not present
    await fs.writeFile(propsPath, `level-name=${newLevelName}\n`, "utf-8");
  }
}

interface ScoredWorldCandidate {
  worldDir: string;
  score: number;
  hasLevelDat: boolean;
  detectedName: string;
  detectedFiles: string[];
}

/**
 * Robustly searches a directory tree for the folder that directly contains standard Minecraft world files.
 * Uses high-confidence heuristics and scoring to detect Java and Bedrock worlds across any folder depth.
 */
async function locateMinecraftWorldFolder(rootDir: string): Promise<ScoredWorldCandidate | null> {
  const candidates: ScoredWorldCandidate[] = [];

  const evaluateDir = async (dir: string, depth = 0) => {
    if (depth > 8) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const lowerNames = entries.map((e) => e.name.toLowerCase());
      let score = 0;
      let hasLevelDat = false;

      const hasLevelDatFile = lowerNames.includes("level.dat") || lowerNames.includes("level.dat_old") || lowerNames.includes("level.dat_mcr");
      if (hasLevelDatFile) {
        score += 50;
        hasLevelDat = true;
      }

      const hasRegionDir = entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "region");
      if (hasRegionDir) {
        score += 60;
        // Check if region contains .mca files for extra confidence
        try {
          const regionEntries = await fs.readdir(path.join(dir, entries.find((e) => e.name.toLowerCase() === "region")!.name));
          if (regionEntries.some((f) => f.toLowerCase().endsWith(".mca") || f.toLowerCase().endsWith(".mcr"))) {
            score += 40;
          }
        } catch {}
      }

      // Check for .mca directly in dir
      if (entries.some((e) => e.name.toLowerCase().endsWith(".mca") || e.name.toLowerCase().endsWith(".mcr"))) {
        score += 60;
      }

      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "data")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "datapacks")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "advancements")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "entities")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "poi")) score += 25;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "playerdata")) score += 20;
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "stats")) score += 20;
      if (entries.some((e) => e.isDirectory() && (e.name.toLowerCase() === "dim1" || e.name.toLowerCase() === "dim-1" || e.name.toLowerCase() === "dimensions"))) score += 30;
      if (lowerNames.includes("session.lock")) score += 15;
      if (lowerNames.includes("uid.dat")) score += 10;
      if (lowerNames.includes("icon.png") || lowerNames.includes("world_icon.jpeg")) score += 10;

      // Bedrock world markers
      if (entries.some((e) => e.isDirectory() && e.name.toLowerCase() === "db") && (lowerNames.includes("levelname.txt") || hasLevelDatFile)) {
        score += 70;
      }

      if (score >= 20) {
        let detectedName = path.basename(dir);
        if (dir === rootDir || detectedName.startsWith("temp_")) {
          detectedName = "world";
        }
        candidates.push({
          worldDir: dir,
          score,
          hasLevelDat,
          detectedName,
          detectedFiles: entries.map((e) => e.name),
        });
      }

      // Recurse down subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await evaluateDir(path.join(dir, entry.name), depth + 1);
        }
      }
    } catch {}
  };

  await evaluateDir(rootDir, 0);

  if (candidates.length === 0) {
    return null;
  }

  // Sort by highest score first, then prefer directories that contain 'region' or 'level.dat'
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export const getWorldInfo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const levelName = await getLevelName(serverDir);
    const worldDir = path.join(serverDir, levelName);
    const levelDatPath = path.join(worldDir, "level.dat");

    let worldVersion = "Unknown";
    let dataVersion = 0;
    let worldName = levelName;

    if (fs.existsSync(levelDatPath)) {
      try {
        const buffer = await fs.readFile(levelDatPath);
        const { parsed } = (await parseNbt(buffer)) as any;
        if (parsed?.value?.Data?.value) {
          const data = parsed.value.Data.value;
          if (data.Version?.value?.Name?.value) {
            worldVersion = data.Version.value.Name.value;
          }
          if (data.DataVersion?.value) {
            dataVersion = data.DataVersion.value;
          }
          if (data.LevelName?.value) {
            worldName = data.LevelName.value;
          }
        }
      } catch (nbtErr) {
        console.warn("Could not read level.dat for worldInfo:", nbtErr);
      }
    }

    res.json({
      levelName,
      worldName,
      worldVersion,
      dataVersion,
      exists: fs.existsSync(worldDir),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Lists all active and secondary world dimensions/folders inside the server root
 */
export const listWorlds = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    if (!fs.existsSync(serverDir)) {
      return res.json([]);
    }

    const levelName = await getLevelName(serverDir);
    const entries = await fs.readdir(serverDir, { withFileTypes: true });

    const worldList: any[] = [];

    // Helper to inspect a world directory
    const inspectWorld = async (folderName: string, defaultDimension: string = "overworld") => {
      const wPath = path.join(serverDir, folderName);
      if (!fs.existsSync(wPath)) return null;

      let sizeBytes = 0;
      let chunkCount = 0;
      let hasLevelDat = false;
      let worldVersion = "Unknown";
      let dataVersion = 0;
      let displayName = folderName;
      let isOptimized = fs.existsSync(path.join(wPath, ".optimized"));

      try {
        const levelDatPath = path.join(wPath, "level.dat");
        if (fs.existsSync(levelDatPath)) {
          hasLevelDat = true;
          try {
            const buf = await fs.readFile(levelDatPath);
            const { parsed } = (await parseNbt(buf)) as any;
            if (parsed?.value?.Data?.value) {
              const d = parsed.value.Data.value;
              if (d.Version?.value?.Name?.value) worldVersion = d.Version.value.Name.value;
              if (d.DataVersion?.value) dataVersion = d.DataVersion.value;
              if (d.LevelName?.value) displayName = d.LevelName.value;
            }
          } catch {}
        }

        // Count chunks in region/
        const regionPath = path.join(wPath, "region");
        if (fs.existsSync(regionPath)) {
          const rFiles = await fs.readdir(regionPath);
          chunkCount = rFiles.filter(f => f.endsWith(".mca") || f.endsWith(".mcr")).length;
        }

        // Calculate size of world folder
        const calculateDirSize = async (dir: string): Promise<number> => {
          let total = 0;
          try {
            const files = await fs.readdir(dir, { withFileTypes: true });
            for (const f of files) {
              const fp = path.join(dir, f.name);
              if (f.isDirectory()) {
                total += await calculateDirSize(fp);
              } else {
                const st = await fs.stat(fp);
                total += st.size;
              }
            }
          } catch {}
          return total;
        };

        sizeBytes = await calculateDirSize(wPath);
      } catch (err) {
        console.warn("inspectWorld error:", err);
      }

      let dimension = defaultDimension;
      const lower = folderName.toLowerCase();
      if (lower.endsWith("_nether") || lower.includes("nether") || lower === "dim-1") dimension = "nether";
      else if (lower.endsWith("_the_end") || lower.includes("the_end") || lower.includes("end") || lower === "dim1") dimension = "the_end";

      return {
        name: folderName,
        displayName: displayName || folderName,
        isPrimary: folderName === levelName,
        dimension,
        sizeMB: Number((sizeBytes / (1024 * 1024)).toFixed(2)),
        chunkCount,
        hasLevelDat,
        worldVersion,
        dataVersion,
        optimized: isOptimized,
        hasDatapacks: fs.existsSync(path.join(wPath, "datapacks")),
      };
    };

    // 1. Primary world
    const primaryWorld = await inspectWorld(levelName, "overworld");
    if (primaryWorld) {
      worldList.push(primaryWorld);
    } else {
      worldList.push({
        name: levelName,
        displayName: levelName,
        isPrimary: true,
        dimension: "overworld",
        sizeMB: 0,
        chunkCount: 0,
        hasLevelDat: false,
        worldVersion: "Not Generated",
        dataVersion: 0,
        optimized: false,
        hasDatapacks: false
      });
    }

    // 2. Discover companion dimensions (e.g. world_nether, world_the_end or survival_nether, survival_the_end)
    // and other distinct world directories
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== levelName) {
        const fullP = path.join(serverDir, entry.name);
        const hasRegion = fs.existsSync(path.join(fullP, "region"));
        const hasLevel = fs.existsSync(path.join(fullP, "level.dat"));
        const hasDim = fs.existsSync(path.join(fullP, "DIM-1")) || fs.existsSync(path.join(fullP, "DIM1"));
        const isCompanion = entry.name === `${levelName}_nether` || entry.name === `${levelName}_the_end` || entry.name.startsWith(levelName + "_");
        
        if (hasRegion || hasLevel || hasDim || isCompanion) {
          const inspected = await inspectWorld(entry.name);
          if (inspected) {
            worldList.push(inspected);
          }
        }
      }
    }

    // 3. If Vanilla structure is used (world/DIM-1 and world/DIM1 inside primary world)
    const primaryDir = path.join(serverDir, levelName);
    const hasNetherInList = worldList.some(w => w.dimension === "nether");
    const hasEndInList = worldList.some(w => w.dimension === "the_end");

    if (!hasNetherInList && fs.existsSync(path.join(primaryDir, "DIM-1"))) {
      const dim1Dir = path.join(primaryDir, "DIM-1");
      let dim1Size = 0;
      let dim1Chunks = 0;
      try {
        const regDir = path.join(dim1Dir, "region");
        if (fs.existsSync(regDir)) {
          const rFiles = await fs.readdir(regDir);
          dim1Chunks = rFiles.filter(f => f.endsWith(".mca") || f.endsWith(".mcr")).length;
        }
        const calcSize = async (d: string): Promise<number> => {
          let tot = 0;
          try {
            const files = await fs.readdir(d, { withFileTypes: true });
            for (const f of files) {
              const fp = path.join(d, f.name);
              if (f.isDirectory()) tot += await calcSize(fp);
              else {
                const st = await fs.stat(fp);
                tot += st.size;
              }
            }
          } catch {}
          return tot;
        };
        dim1Size = await calcSize(dim1Dir);
      } catch {}

      worldList.push({
        name: `${levelName}/DIM-1`,
        displayName: `${levelName} Nether`,
        isPrimary: false,
        dimension: "nether",
        sizeMB: Number((dim1Size / (1024 * 1024)).toFixed(2)),
        chunkCount: dim1Chunks,
        hasLevelDat: false,
        worldVersion: primaryWorld?.worldVersion || "Vanilla",
        dataVersion: primaryWorld?.dataVersion || 0,
        optimized: fs.existsSync(path.join(dim1Dir, ".optimized")),
        hasDatapacks: false
      });
    }

    if (!hasEndInList && fs.existsSync(path.join(primaryDir, "DIM1"))) {
      const dimEndDir = path.join(primaryDir, "DIM1");
      let dimEndSize = 0;
      let dimEndChunks = 0;
      try {
        const regDir = path.join(dimEndDir, "region");
        if (fs.existsSync(regDir)) {
          const rFiles = await fs.readdir(regDir);
          dimEndChunks = rFiles.filter(f => f.endsWith(".mca") || f.endsWith(".mcr")).length;
        }
        const calcSize = async (d: string): Promise<number> => {
          let tot = 0;
          try {
            const files = await fs.readdir(d, { withFileTypes: true });
            for (const f of files) {
              const fp = path.join(d, f.name);
              if (f.isDirectory()) tot += await calcSize(fp);
              else {
                const st = await fs.stat(fp);
                tot += st.size;
              }
            }
          } catch {}
          return tot;
        };
        dimEndSize = await calcSize(dimEndDir);
      } catch {}

      worldList.push({
        name: `${levelName}/DIM1`,
        displayName: `${levelName} The End`,
        isPrimary: false,
        dimension: "the_end",
        sizeMB: Number((dimEndSize / (1024 * 1024)).toFixed(2)),
        chunkCount: dimEndChunks,
        hasLevelDat: false,
        worldVersion: primaryWorld?.worldVersion || "Vanilla",
        dataVersion: primaryWorld?.dataVersion || 0,
        optimized: fs.existsSync(path.join(dimEndDir, ".optimized")),
        hasDatapacks: false
      });
    }

    // Return structured response with both list and activeWorld
    res.json({
      worlds: worldList,
      activeWorld: levelName
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Sets the active world in server.properties
 */
export const setActiveWorld = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { worldName } = req.body;
    if (!worldName) {
      return res.status(400).json({ error: "worldName is required" });
    }

    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    if (!fs.existsSync(serverDir)) {
      return res.status(404).json({ error: "Server directory not found" });
    }

    await setLevelNameInProperties(serverDir, worldName);
    res.json({ success: true, message: `Active world set to '${worldName}'. Restart server to load.`, activeWorld: worldName });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

/**
 * Optimizes a Minecraft world by cleaning unused/empty chunks, temporary files, and lock files
 */
export const optimizeWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { worldName } = req.body;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);

  try {
    const serversJSON = await fs.readFile(path.join(process.cwd(), ".data", "servers.json"), "utf8");
    const servers = JSON.parse(serversJSON);
    const server = servers.find((s: any) => s.id === id);
    if (!server) return res.status(404).json({ error: "Server not found" });

    if (server.status === "running" || server.status === "starting" || server.status === "online") {
      return res.status(400).json({ error: "Server must be stopped before optimizing worlds." });
    }

    const levelName = worldName || (await getLevelName(serverDir));
    const targetDir = path.join(serverDir, levelName);

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: `World folder '${levelName}' not found.` });
    }

    let cleanedFilesCount = 0;
    let savedBytes = 0;

    // 1. Remove stale lock files
    const lockFiles = [
      path.join(targetDir, "session.lock"),
      path.join(serverDir, `${levelName}_nether`, "session.lock"),
      path.join(serverDir, `${levelName}_the_end`, "session.lock")
    ];
    for (const lf of lockFiles) {
      if (fs.existsSync(lf)) {
        await fs.remove(lf);
        cleanedFilesCount++;
      }
    }

    // 2. Scan region folder and clean 0-byte or corrupted temporary chunk files
    const regionDir = path.join(targetDir, "region");
    if (fs.existsSync(regionDir)) {
      const regionFiles = await fs.readdir(regionDir);
      for (const rf of regionFiles) {
        const rPath = path.join(regionDir, rf);
        const st = await fs.stat(rPath);
        if (st.size === 0 || rf.endsWith(".tmp") || rf.endsWith(".bak")) {
          savedBytes += st.size;
          await fs.remove(rPath);
          cleanedFilesCount++;
        }
      }
    }

    // 3. Clean temporary entity or POI cache files
    const poiDir = path.join(targetDir, "poi");
    if (fs.existsSync(poiDir)) {
      const poiFiles = await fs.readdir(poiDir);
      for (const pf of poiFiles) {
        const pPath = path.join(poiDir, pf);
        const st = await fs.stat(pPath);
        if (st.size === 0 || pf.endsWith(".tmp")) {
          savedBytes += st.size;
          await fs.remove(pPath);
          cleanedFilesCount++;
        }
      }
    }

    // 4. Mark world as optimized
    await fs.writeFile(
      path.join(targetDir, ".optimized"),
      JSON.stringify({
        optimizedAt: new Date().toISOString(),
        cleanedFilesCount,
        savedBytes
      }, null, 2),
      "utf-8"
    );

    res.json({
      success: true,
      message: `World '${levelName}' optimized successfully. Cleaned ${cleanedFilesCount} cache/lock files.`,
      cleanedFilesCount,
      savedBytes
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to optimize world" });
  }
};

/**
 * Generates a brand new Minecraft world with customized settings
 */
export const generateWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    worldName = "world",
    seed = "",
    worldType = "default",
    hardcore = false,
    generateStructures = true,
    difficulty = "easy"
  } = req.body;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);

  try {
    const serversJSON = await fs.readFile(path.join(process.cwd(), ".data", "servers.json"), "utf8");
    const servers = JSON.parse(serversJSON);
    const server = servers.find((s: any) => s.id === id);
    if (!server) return res.status(404).json({ error: "Server not found" });

    if (server.status === "running" || server.status === "starting" || server.status === "online") {
      return res.status(400).json({ error: "Server must be stopped before generating a new world." });
    }

    const cleanWorldName = worldName.trim().replace(/[/\\?%*:|"<>]/g, "-") || "world";
    const targetDir = path.join(serverDir, cleanWorldName);

    // Create safety backup of existing world if present
    if (fs.existsSync(targetDir)) {
      const backupDir = path.join(process.cwd(), ".data", "backups", id);
      await fs.ensureDir(backupDir);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupZipPath = path.join(backupDir, `pre_world_gen_${cleanWorldName}_${timestamp}.zip`);

      try {
        const output = fs.createWriteStream(backupZipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.pipe(output);
        archive.directory(targetDir, false);
        await archive.finalize();
      } catch (bErr) {
        console.warn("Safety backup on generate warning:", bErr);
      }

      // Remove existing world directory so server regenerates freshly
      await fs.remove(targetDir);
    }

    // Also remove associated nether / end folders if present
    const netherDir = path.join(serverDir, `${cleanWorldName}_nether`);
    const endDir = path.join(serverDir, `${cleanWorldName}_the_end`);
    if (fs.existsSync(netherDir)) await fs.remove(netherDir);
    if (fs.existsSync(endDir)) await fs.remove(endDir);

    // Update server.properties with new world parameters
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

    updateProp("level-name", cleanWorldName);
    updateProp("level-seed", seed);
    updateProp("level-type", worldType);
    updateProp("hardcore", String(hardcore));
    updateProp("generate-structures", String(generateStructures));
    updateProp("difficulty", difficulty);

    await fs.writeFile(propsPath, props, "utf-8");

    res.json({
      success: true,
      message: `New world '${cleanWorldName}' configured with seed '${seed || "Random"}' and type '${worldType}'. It will generate automatically on next server start.`,
      worldName: cleanWorldName
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to generate world" });
  }
};

/**
 * Downloads a complete world as a zipped archive stream
 */
export const downloadWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const worldName = (req.query.name as string) || (await getLevelName(path.join(process.cwd(), ".data", "servers", id)));
  const serverDir = path.join(process.cwd(), ".data", "servers", id);
  const targetWorldDir = path.join(serverDir, worldName);

  try {
    if (!fs.existsSync(targetWorldDir)) {
      return res.status(404).json({ error: `World folder '${worldName}' not found.` });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${worldName}.zip"`);
    res.setHeader("Content-Type", "application/zip");

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err: any) => {
      console.error("Archive error on downloadWorld:", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

    archive.pipe(res);
    archive.directory(targetWorldDir, false);
    await archive.finalize();
  } catch (e: any) {
    console.error("Download world error:", e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

/**
 * Datapacks and Resource Packs API
 */
export const getDatapacks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const levelName = await getLevelName(serverDir);
    const dpDir = path.join(serverDir, levelName, "datapacks");

    if (!fs.existsSync(dpDir)) {
      await fs.ensureDir(dpDir);
      return res.json([]);
    }

    const files = await fs.readdir(dpDir, { withFileTypes: true });
    const datapacks = [];

    for (const f of files) {
      const fullPath = path.join(dpDir, f.name);
      const isDirectory = f.isDirectory();
      const isZip = f.name.endsWith(".zip");
      const isDisabled = f.name.endsWith(".disabled");

      if (isDirectory || isZip || isDisabled) {
        const stats = await fs.stat(fullPath);
        datapacks.push({
          name: f.name.replace(/\.disabled$/, "").replace(/\.zip$/, ""),
          filename: f.name,
          isDirectory,
          sizeMB: Number((stats.size / (1024 * 1024)).toFixed(2)),
          enabled: !isDisabled,
          modified: stats.mtime
        });
      }
    }

    res.json(datapacks);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const toggleDatapack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { filename, enabled } = req.body;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const levelName = await getLevelName(serverDir);
    const dpDir = path.join(serverDir, levelName, "datapacks");

    const oldPath = path.join(dpDir, filename);
    if (!fs.existsSync(oldPath)) return res.status(404).json({ error: "Datapack not found" });

    let newFilename = filename;
    if (enabled && filename.endsWith(".disabled")) {
      newFilename = filename.replace(/\.disabled$/, "");
    } else if (!enabled && !filename.endsWith(".disabled")) {
      newFilename = `${filename}.disabled`;
    }

    const newPath = path.join(dpDir, newFilename);
    await fs.rename(oldPath, newPath);

    res.json({ success: true, newFilename, enabled });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteDatapack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { filename } = req.body;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const levelName = await getLevelName(serverDir);
    const dpDir = path.join(serverDir, levelName, "datapacks");

    const targetPath = path.join(dpDir, filename);
    if (fs.existsSync(targetPath)) {
      await fs.remove(targetPath);
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const getResourcePackSettings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
    const propsPath = path.join(serverDir, "server.properties");

    let url = "";
    let hash = "";
    let prompt = "";
    let required = false;

    if (fs.existsSync(propsPath)) {
      const props = await fs.readFile(propsPath, "utf-8");
      const urlMatch = props.match(/^resource-pack=(.*)$/m);
      if (urlMatch) url = urlMatch[1].trim();

      const hashMatch = props.match(/^resource-pack-sha1=(.*)$/m);
      if (hashMatch) hash = hashMatch[1].trim();

      const promptMatch = props.match(/^resource-pack-prompt=(.*)$/m);
      if (promptMatch) prompt = promptMatch[1].trim();

      const reqMatch = props.match(/^require-resource-pack=(.*)$/m);
      if (reqMatch) required = reqMatch[1].trim().toLowerCase() === "true";
    }

    res.json({ url, hash, prompt, required });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const saveResourcePackSettings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { url = "", hash = "", prompt = "", required = false } = req.body;
    const serverDir = path.join(process.cwd(), ".data", "servers", id);
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

    updateProp("resource-pack", url);
    updateProp("resource-pack-sha1", hash);
    updateProp("resource-pack-prompt", prompt);
    updateProp("require-resource-pack", String(required));

    await fs.writeFile(propsPath, props, "utf-8");

    res.json({ success: true, url, hash, prompt, required });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const analyzeWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { zipPath } = req.body;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);

  try {
    if (!zipPath) {
      return res.status(400).json({ error: "Missing zipPath parameter" });
    }

    let zipFullPath = path.join(serverDir, zipPath);
    if (!fs.existsSync(zipFullPath)) {
      return res.status(400).json({ error: "Zip file not found in server directory" });
    }

    // If zipFullPath is a directory, look for the actual archive file inside
    if ((await fs.stat(zipFullPath)).isDirectory()) {
      const filesInside = await fs.readdir(zipFullPath);
      const matched = filesInside.find((f) => /\.(zip|tar|gz|tgz|jar|rar|7z)$/i.test(f));
      if (matched) {
        zipFullPath = path.join(zipFullPath, matched);
      } else {
        // The directory itself might contain world files
        const directDetect = await locateMinecraftWorldFolder(zipFullPath);
        if (directDetect) {
          return res.json({
            status: "valid",
            worldDataVersion: 0,
            worldName: directDetect.detectedName || "world",
            folderName: directDetect.detectedName || "world",
            hasLevelDat: directDetect.hasLevelDat,
            detectedFiles: directDetect.detectedFiles.slice(0, 12),
          });
        }
        return res.status(400).json({ error: "No archive file found inside folder" });
      }
    }

    const tempExtractDir = path.join(serverDir, `temp_analyze_${Date.now()}`);
    await extractArchive(zipFullPath, tempExtractDir);

    const detected = await locateMinecraftWorldFolder(tempExtractDir);

    let worldDataVersion = 0;
    let worldName = detected?.detectedName || "world";
    let detectedFiles: string[] = [];

    if (detected) {
      detectedFiles = detected.detectedFiles || [];

      const levelDatPath = path.join(detected.worldDir, "level.dat");
      if (fs.existsSync(levelDatPath)) {
        try {
          const buffer = await fs.readFile(levelDatPath);
          const { parsed } = (await parseNbt(buffer)) as any;
          if (parsed?.value?.Data?.value?.DataVersion?.value) {
            worldDataVersion = parsed.value.Data.value.DataVersion.value;
          }
          if (parsed?.value?.Data?.value?.LevelName?.value) {
            worldName = parsed.value.Data.value.LevelName.value;
          }
        } catch (err) {
          console.warn("Could not parse level.dat nbt during analyze:", err);
        }
      }
    }

    // Clean up temporary extract directory
    await fs.remove(tempExtractDir);

    if (!detected) {
      return res.json({
        status: "invalid",
        message: "No Minecraft world folder found. The archive must contain world files (such as region, data, datapacks, advancements, or level.dat).",
      });
    }

    res.json({
      status: "valid",
      worldDataVersion,
      worldName: worldName || detected.detectedName,
      folderName: detected.detectedName,
      hasLevelDat: detected.hasLevelDat,
      detectedFiles: detectedFiles.slice(0, 12),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const importWorld = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { zipPath, targetFolderName, autoUpdateProperties = true } = req.body;
  const serverDir = path.join(process.cwd(), ".data", "servers", id);

  try {
    // 1. Verify server is stopped
    const serversJSON = await fs.readFile(
      path.join(process.cwd(), ".data", "servers.json"),
      "utf8"
    );
    const servers = JSON.parse(serversJSON);
    const server = servers.find((s: any) => s.id === id);
    if (!server) return res.status(404).json({ error: "Server not found" });

    if (
      server.status === "running" ||
      server.status === "starting" ||
      server.status === "online"
    ) {
      return res
        .status(400)
        .json({ error: "Server is currently running. Please stop it first." });
    }

    let zipFullPath = path.join(serverDir, zipPath);
    let origPathToDelete = zipFullPath;
    if (!fs.existsSync(zipFullPath)) {
      return res.status(400).json({ error: "Zip file not found" });
    }

    // If zipFullPath is a directory, find the archive file inside
    if ((await fs.stat(zipFullPath)).isDirectory()) {
      const filesInside = await fs.readdir(zipFullPath);
      const matched = filesInside.find((f) => /\.(zip|tar|gz|tgz|jar|rar|7z)$/i.test(f));
      if (matched) {
        zipFullPath = path.join(zipFullPath, matched);
      }
    }

    // 2. Extract world to temporary folder
    const tempExtractDir = path.join(serverDir, `temp_world_${Date.now()}`);
    await extractArchive(zipFullPath, tempExtractDir);

    // 3. Locate the actual Minecraft world directory inside the extracted contents
    const detected = await locateMinecraftWorldFolder(tempExtractDir);
    if (!detected) {
      await fs.remove(tempExtractDir);
      return res.status(400).json({
        error: "Invalid world archive: No Minecraft world folder structure (advancements, data, datapacks, region, level.dat) found.",
      });
    }

    // 4. Determine final destination folder name in server root (defaults to 'world' or user's chosen folder)
    const configuredLevel = await getLevelName(serverDir);
    const chosenFolderName = (targetFolderName || "world" || detected.detectedName || configuredLevel)
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "-");

    const finalWorldDestination = path.join(serverDir, chosenFolderName);

    // 5. Create automatic safety backup of current server state before replacing
    const backupDir = path.join(process.cwd(), ".data", "backups", id);
    await fs.ensureDir(backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupZipPath = path.join(
      backupDir,
      `pre_world_import_${timestamp}.zip`
    );

    try {
      const output = fs.createWriteStream(backupZipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.pipe(output);
      archive.directory(serverDir, false);
      await archive.finalize();
    } catch (bErr) {
      console.warn("Safety backup warning:", bErr);
    }

    // 6. Clean existing target world directory if it exists and move detected world folder directly to root
    if (fs.existsSync(finalWorldDestination)) {
      await fs.remove(finalWorldDestination);
    }
    await fs.ensureDir(finalWorldDestination);

    // Move / Copy the verified world files directly into root/{chosenFolderName}
    await fs.copy(detected.worldDir, finalWorldDestination);

    // 7. Clean up temporary extract folder
    await fs.remove(tempExtractDir);

    // 8. Delete the original uploaded zip file and any wrapper folder
    if (fs.existsSync(zipFullPath)) {
      await fs.remove(zipFullPath);
    }
    if (origPathToDelete !== zipFullPath && fs.existsSync(origPathToDelete)) {
      await fs.remove(origPathToDelete);
    }

    // 9. Remove stale session.lock files
    const lockFiles = [
      path.join(finalWorldDestination, "session.lock"),
      path.join(serverDir, `${chosenFolderName}_nether`, "session.lock"),
      path.join(serverDir, `${chosenFolderName}_the_end`, "session.lock"),
    ];
    for (const lockFile of lockFiles) {
      if (fs.existsSync(lockFile)) {
        await fs.remove(lockFile);
      }
    }

    // 10. Automatically update server.properties level-name so server loads the new world
    if (autoUpdateProperties) {
      await setLevelNameInProperties(serverDir, chosenFolderName);
    }

    res.json({
      success: true,
      message: `World files placed directly into '/${chosenFolderName}' in File Manager, level-name updated, and zip file deleted.`,
      worldFolder: chosenFolderName,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to import world" });
  }
};
