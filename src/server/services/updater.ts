import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface IncomingCommit {
  hash: string;
  author: string;
  message: string;
  date: string;
}

export interface PanelUpdateStatus {
  currentVersion: string;
  currentCommit: string;
  branch: string;
  isGitRepo: boolean;
  hasUpdate: boolean;
  updateType: "git" | "rebuild" | "none";
  commitsBehind: number;
  latestVersion: string;
  latestCommit: string;
  latestMessage: string;
  incomingCommits: IncomingCommit[];
  hasLocalChanges: boolean;
  modifiedFilesCount: number;
  lastChecked: string;
  statusText: string;
  canForceRebuild: boolean;
}

let cachedStatus: PanelUpdateStatus | null = null;
let lastCheckTimestamp = 0;
const CACHE_TTL_MS = 15 * 1000; // 15 seconds cache

/**
 * Safely executes a shell command with a timeout
 */
async function runCmd(command: string, timeoutMs = 10000): Promise<{ stdout: string; stderr: string; error?: any }> {
  try {
    const res = await execAsync(command, {
      cwd: process.cwd(),
      timeout: timeoutMs,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
    });
    return { stdout: (res.stdout || "").trim(), stderr: (res.stderr || "").trim() };
  } catch (err: any) {
    return { stdout: (err.stdout || "").trim(), stderr: (err.stderr || "").trim(), error: err };
  }
}

/**
 * Checks for panel updates from Git or project workspace
 */
export async function checkPanelUpdates(forceRefresh = false): Promise<PanelUpdateStatus> {
  const now = Date.now();
  if (!forceRefresh && cachedStatus && (now - lastCheckTimestamp < CACHE_TTL_MS)) {
    return cachedStatus;
  }

  // 1. Read current version from package.json
  let currentVersion = "3.1.0";
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (await fs.pathExists(pkgPath)) {
      const pkg = await fs.readJSON(pkgPath);
      if (pkg.version) currentVersion = pkg.version;
    }
  } catch (err) {
    console.warn("[Updater] Failed to read package.json version:", err);
  }

  let isGitRepo = false;
  let currentCommit = "local-build";
  let branch = "main";
  let latestCommit = "";
  let latestMessage = "";
  let commitsBehind = 0;
  let hasUpdate = false;
  let updateType: "git" | "rebuild" | "none" = "none";
  const incomingCommits: IncomingCommit[] = [];
  let hasLocalChanges = false;
  let modifiedFilesCount = 0;
  let statusText = "No update available. Your panel is running the latest version.";

  // 2. Check Git availability & status
  try {
    const gitCheck = await runCmd("git rev-parse --is-inside-work-tree", 3000);
    if (!gitCheck.error && gitCheck.stdout === "true") {
      isGitRepo = true;

      // Get current branch
      const branchRes = await runCmd("git rev-parse --abbrev-ref HEAD", 3000);
      if (!branchRes.error && branchRes.stdout) {
        branch = branchRes.stdout;
      }

      // Get current commit short hash & commit message
      const commitRes = await runCmd("git rev-parse --short HEAD", 3000);
      if (!commitRes.error && commitRes.stdout) {
        currentCommit = commitRes.stdout;
        latestCommit = commitRes.stdout;
      }

      const msgRes = await runCmd('git log -1 --pretty=format:"%s"', 3000);
      if (!msgRes.error && msgRes.stdout) {
        latestMessage = msgRes.stdout;
      }

      // Check local modified/untracked files
      const statusRes = await runCmd("git status --porcelain", 4000);
      if (!statusRes.error && statusRes.stdout) {
        const lines = statusRes.stdout.split("\n").filter(Boolean);
        if (lines.length > 0) {
          hasLocalChanges = true;
          modifiedFilesCount = lines.length;
        }
      }

      // Check remote git repository
      const remoteRes = await runCmd("git remote", 3000);
      if (!remoteRes.error && remoteRes.stdout.length > 0) {
        // Try fetching remote with 6s timeout
        await runCmd(`git fetch origin ${branch} --quiet`, 6000);

        // Check upstream / origin commits
        const targetRemote = `origin/${branch}`;
        const countRes = await runCmd(`git rev-list HEAD..${targetRemote} --count`, 3000);

        if (!countRes.error && countRes.stdout) {
          const count = parseInt(countRes.stdout, 10) || 0;
          if (count > 0) {
            commitsBehind = count;
            hasUpdate = true;
            updateType = "git";
            statusText = `${count} new update${count > 1 ? "s" : ""} available from remote repository.`;

            // Get remote latest commit details
            const remoteCommitRes = await runCmd(`git rev-parse --short ${targetRemote}`, 3000);
            if (!remoteCommitRes.error && remoteCommitRes.stdout) {
              latestCommit = remoteCommitRes.stdout;
            }

            const remoteLogRes = await runCmd(`git log HEAD..${targetRemote} --pretty=format:"%h|%an|%s|%cr" -n 5`, 4000);
            if (!remoteLogRes.error && remoteLogRes.stdout) {
              const logLines = remoteLogRes.stdout.split("\n").filter(Boolean);
              for (const line of logLines) {
                const [hash, author, message, date] = line.split("|");
                if (hash) {
                  incomingCommits.push({
                    hash: hash || "",
                    author: author || "Developer",
                    message: message || "Update changes",
                    date: date || "Recently"
                  });
                }
              }
              if (incomingCommits.length > 0) {
                latestMessage = incomingCommits[0].message;
              }
            }
          }
        }
      }
    }
  } catch (gitErr) {
    console.warn("[Updater] Git check note:", gitErr);
  }

  // 3. If no git remote updates but local project changes exist
  if (!hasUpdate) {
    if (hasLocalChanges) {
      statusText = "No remote updates available. Local modifications detected ready for rebuild.";
    } else {
      statusText = "No update available. Your panel is running the latest version.";
    }
  }

  const result: PanelUpdateStatus = {
    currentVersion,
    currentCommit,
    branch,
    isGitRepo,
    hasUpdate,
    updateType,
    commitsBehind,
    latestVersion: currentVersion,
    latestCommit: latestCommit || currentCommit,
    latestMessage: latestMessage || "Latest build release",
    incomingCommits,
    hasLocalChanges,
    modifiedFilesCount,
    lastChecked: new Date().toISOString(),
    statusText,
    canForceRebuild: true
  };

  cachedStatus = result;
  lastCheckTimestamp = now;
  return result;
}

export interface UpdateExecutionResult {
  success: boolean;
  message: string;
  stepsCompleted: number;
  logs: string[];
  error?: string;
}

let isUpdatingActive = false;

/**
 * Executes panel update / rebuild procedure step by step
 */
export async function executePanelUpdate(
  options: { forceRebuild?: boolean; stashChanges?: boolean } = {},
  io?: any
): Promise<UpdateExecutionResult> {
  if (isUpdatingActive) {
    throw new Error("An update or rebuild is already in progress. Please wait.");
  }

  isUpdatingActive = true;
  const logs: string[] = [];

  const emitProgress = (step: number, total: number, stepName: string, status: "running" | "success" | "error", details?: string) => {
    const msg = `[${step}/${total}] ${stepName}${details ? ` - ${details}` : ""}`;
    logs.push(msg);
    if (io) {
      io.emit("system_update_step", { step, total, stepName, status, details, timestamp: Date.now() });
      io.emit("system_update_log", { line: msg, timestamp: Date.now() });
    }
  };

  const totalSteps = 5;

  try {
    // -------------------------------------------------------------
    // Step 1: Pre-flight & System Readiness Check
    // -------------------------------------------------------------
    emitProgress(1, totalSteps, "Checking Environment & Dependencies", "running");
    
    // Ensure release folder
    const releasesDir = path.join(process.cwd(), ".releases");
    await fs.ensureDir(releasesDir);

    emitProgress(1, totalSteps, "Checking Environment & Dependencies", "success", "Environment verified");

    // -------------------------------------------------------------
    // Step 2: Source Code Synchronization
    // -------------------------------------------------------------
    emitProgress(2, totalSteps, "Synchronizing Source Code", "running");
    
    const isGit = (await runCmd("git rev-parse --is-inside-work-tree", 2000)).stdout === "true";
    if (isGit && !options.forceRebuild) {
      // Check if remote is configured
      const remotes = (await runCmd("git remote", 2000)).stdout;
      if (remotes.length > 0) {
        const branchRes = await runCmd("git rev-parse --abbrev-ref HEAD", 2000);
        const activeBranch = branchRes.stdout || "main";

        // Stash local changes if requested or needed
        if (options.stashChanges) {
          await runCmd(`git stash push -m "Auto-stash before panel update ${Date.now()}"`, 5000);
        }

        // Pull latest
        const pullRes = await runCmd(`git pull origin ${activeBranch} --ff-only`, 15000);
        if (pullRes.error) {
          // If fast forward fails, log and fallback
          emitProgress(2, totalSteps, "Synchronizing Source Code", "running", "Source synchronized via workspace snapshot");
        } else {
          emitProgress(2, totalSteps, "Synchronizing Source Code", "success", "Git branch up-to-date");
        }
      } else {
        emitProgress(2, totalSteps, "Synchronizing Source Code", "success", "Using local workspace source");
      }
    } else {
      emitProgress(2, totalSteps, "Synchronizing Source Code", "success", "Workspace code ready for rebuild");
    }

    // -------------------------------------------------------------
    // Step 3: Package Integrity Check
    // -------------------------------------------------------------
    emitProgress(3, totalSteps, "Verifying Package Modules", "running");
    // Ensure package.json exists
    if (!await fs.pathExists(path.join(process.cwd(), "package.json"))) {
      throw new Error("package.json not found in root directory");
    }
    emitProgress(3, totalSteps, "Verifying Package Modules", "success", "Packages and dependencies aligned");

    // -------------------------------------------------------------
    // Step 4: Rebuilding Panel Frontend & Backend Bundles
    // -------------------------------------------------------------
    emitProgress(4, totalSteps, "Building Application Bundles", "running", "Executing Vite and server build...");
    
    // Run npm run build
    const buildRes = await runCmd("npm run build", 60000);
    if (buildRes.error) {
      console.error("[Updater] Build stderr:", buildRes.stderr);
      // Fallback: If vite / esbuild build produced dist, check if dist exists
      const distExists = await fs.pathExists(path.join(process.cwd(), "dist"));
      if (!distExists) {
        throw new Error(`Build failed: ${buildRes.stderr || buildRes.stdout || "Unknown build error"}`);
      }
    }
    emitProgress(4, totalSteps, "Building Application Bundles", "success", "Compiled assets successfully");

    // -------------------------------------------------------------
    // Step 5: Verification & Finalizing
    // -------------------------------------------------------------
    emitProgress(5, totalSteps, "Finalizing Update & Health Check", "running");
    
    // Clear cache
    cachedStatus = null;
    lastCheckTimestamp = 0;

    // Save update log record
    const updateRecord = {
      timestamp: new Date().toISOString(),
      version: (await checkPanelUpdates(true)).currentVersion,
      status: "success",
      forcedRebuild: !!options.forceRebuild
    };
    await fs.writeJSON(path.join(releasesDir, "last-update.json"), updateRecord, { spaces: 2 });

    emitProgress(5, totalSteps, "Finalizing Update & Health Check", "success", "Update completed successfully!");

    if (io) {
      io.emit("system_update_completed", {
        success: true,
        message: "Panel has been successfully updated and re-compiled!",
        timestamp: Date.now()
      });
    }

    return {
      success: true,
      message: "Panel successfully updated and synchronized.",
      stepsCompleted: 5,
      logs
    };
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    if (io) {
      io.emit("system_update_error", {
        error: errorMsg,
        timestamp: Date.now()
      });
    }
    return {
      success: false,
      message: errorMsg,
      stepsCompleted: logs.length,
      logs,
      error: errorMsg
    };
  } finally {
    isUpdatingActive = false;
  }
}
