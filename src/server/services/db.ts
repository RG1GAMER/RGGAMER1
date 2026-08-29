import fs from "fs-extra";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

export const readJSON = async (filename: string) => {
  const filePath = path.join(DATA_DIR, filename);
  const backupPath = path.join(DATA_DIR, `${filename}.bak`);
  try {
    if (await fs.pathExists(filePath)) {
      const data = await fs.readJson(filePath);
      if (data !== null && data !== undefined) {
        return data;
      }
    }
  } catch (err) {
    console.warn(`[DB Read Notice] Issue reading ${filename}, attempting fallback from backup:`, err);
  }

  try {
    if (await fs.pathExists(backupPath)) {
      const backupData = await fs.readJson(backupPath);
      if (backupData !== null && backupData !== undefined) {
        // Restore main file from healthy backup
        await fs.writeJson(filePath, backupData, { spaces: 2 }).catch(() => {});
        return backupData;
      }
    }
  } catch {}

  return null;
};

export const writeJSON = async (filename: string, data: any) => {
  const filePath = path.join(DATA_DIR, filename);
  const backupPath = path.join(DATA_DIR, `${filename}.bak`);
  const tempPath = path.join(DATA_DIR, `${filename}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);

  try {
    await fs.ensureDir(DATA_DIR);
    // 1. Write to temporary file
    await fs.writeJson(tempPath, data, { spaces: 2 });
    // 2. Atomically rename temp file to target file
    await fs.move(tempPath, filePath, { overwrite: true });
    // 3. Keep a backup copy for resilience
    await fs.copy(filePath, backupPath, { overwrite: true }).catch(() => {});
  } catch (err) {
    try {
      if (await fs.pathExists(tempPath)) await fs.remove(tempPath);
    } catch {}
    // Direct write fallback
    await fs.writeJson(filePath, data, { spaces: 2 });
  }
};

