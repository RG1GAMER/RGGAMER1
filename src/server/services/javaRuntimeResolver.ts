import fs from "fs-extra";
import path from "path";

export interface JavaRequirementInfo {
  majorVersion: string; // e.g. "8", "11", "16", "17", "21", "25"
  displayName: string;  // e.g. "Java 25 (OpenJDK 25)"
  dockerTag: string;    // e.g. "java25"
  minJavaVersion: number;
}

/**
 * Normalizes user-entered Java version strings like "java-25", "Java 25", "25", "auto", etc.
 */
export function normalizeJavaVersion(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = String(raw).trim().toLowerCase();
  if (cleaned === "auto" || cleaned === "default" || cleaned === "") return "";
  return cleaned.replace(/^java-?/, "").trim();
}

/**
 * Determines the required Java major version for a given Minecraft/Proxy/Application version and software type.
 */
export function resolveJavaMajorVersion(
  minecraftVersion?: string | null,
  softwareType?: string | null,
  explicitJavaVersion?: string | null
): string {
  const normalizedExplicit = normalizeJavaVersion(explicitJavaVersion);
  if (normalizedExplicit && ["8", "11", "16", "17", "21", "25"].includes(normalizedExplicit)) {
    return normalizedExplicit;
  }

  const sType = String(softwareType || "PAPER").toUpperCase();
  if (["NODEJS", "NODE", "PYTHON", "PYTHON3"].includes(sType)) {
    return "";
  }

  const v = String(minecraftVersion || "latest").toLowerCase().trim();

  // Minecraft 26.x (e.g. 26.1, 26.1.2, 26.2), 1.25+, 1.26+, snapshots (26w..), latest
  if (
    v === "latest" ||
    v === "" ||
    v === "default" ||
    v.startsWith("26") ||
    v.startsWith("1.26") ||
    v.startsWith("1.25") ||
    v.startsWith("1.22") ||
    v.startsWith("1.23") ||
    v.startsWith("1.24") ||
    v.startsWith("25") ||
    v.includes("26w") ||
    v.includes("25w")
  ) {
    return "25";
  }

  // Minecraft 1.20.5, 1.20.6, 1.21.x
  if (v.startsWith("1.21") || v.startsWith("1.20.6") || v.startsWith("1.20.5")) {
    return "21";
  }

  // Minecraft 1.18.x - 1.20.4
  if (v.startsWith("1.18") || v.startsWith("1.19") || v.startsWith("1.20")) {
    return "17";
  }

  // Minecraft 1.17.x
  if (v.startsWith("1.17")) {
    return "17"; // Java 17 is backwards-compatible with Java 16 requirements and broadly available
  }

  // Minecraft 1.16.x
  if (v.startsWith("1.16")) {
    return "11";
  }

  // Minecraft 1.15.x and earlier
  if (
    v.startsWith("1.7") ||
    v.startsWith("1.8") ||
    v.startsWith("1.9") ||
    v.startsWith("1.10") ||
    v.startsWith("1.11") ||
    v.startsWith("1.12") ||
    v.startsWith("1.13") ||
    v.startsWith("1.14") ||
    v.startsWith("1.15")
  ) {
    return "8";
  }

  // Proxies default to modern Java 21 or 25
  if (["VELOCITY", "BUNGEECORD", "WATERFALL"].includes(sType)) {
    return "21";
  }

  // Default fallback for modern Minecraft servers
  return "25";
}

/**
 * Returns full metadata for the resolved Java requirement.
 */
export function getJavaRequirement(
  minecraftVersion?: string | null,
  softwareType?: string | null,
  explicitJavaVersion?: string | null
): JavaRequirementInfo {
  const major = resolveJavaMajorVersion(minecraftVersion, softwareType, explicitJavaVersion);
  const num = parseInt(major, 10) || 25;
  return {
    majorVersion: major || "25",
    displayName: major ? `Java ${major} (OpenJDK ${major})` : "Default Runtime",
    dockerTag: `java${major || "25"}`,
    minJavaVersion: num
  };
}

/**
 * Resolves Docker container image details based on server configuration.
 */
export function resolveDockerImages(serverData: {
  type?: string;
  version?: string;
  javaVersion?: string;
  dockerImage?: string;
}): { shortImage: string; fullImage: string; javaTag: string } {
  const serverType = (serverData.type || "PAPER").toUpperCase();
  const isNode = ["NODEJS", "NODE"].includes(serverType);
  const isPython = ["PYTHON", "PYTHON3"].includes(serverType);
  const isProxy = ["VELOCITY", "BUNGEECORD", "WATERFALL"].includes(serverType);

  if (isNode) {
    const nodeVer = serverData.version || "20";
    return {
      shortImage: `node:${nodeVer}-alpine`,
      fullImage: `docker.io/library/node:${nodeVer}-alpine`,
      javaTag: ""
    };
  }

  if (isPython) {
    const pyVer = serverData.version || "3.11";
    return {
      shortImage: `python:${pyVer}-slim`,
      fullImage: `docker.io/library/python:${pyVer}-slim`,
      javaTag: ""
    };
  }

  const javaMajor = resolveJavaMajorVersion(serverData.version, serverData.type, serverData.javaVersion);
  const javaTag = `java${javaMajor || "25"}`;

  let shortImage = isProxy ? "itzg/bungeecord:latest" : `itzg/minecraft-server:${javaTag}`;
  let fullImage = isProxy ? "docker.io/itzg/bungeecord:latest" : `docker.io/itzg/minecraft-server:${javaTag}`;

  if (serverData.dockerImage && String(serverData.dockerImage).trim() !== "") {
    const customImg = String(serverData.dockerImage).trim();
    // If it's an itzg image, ensure the Java tag matches what the server version requires
    if (customImg.includes("itzg/minecraft-server")) {
      shortImage = `itzg/minecraft-server:${javaTag}`;
      fullImage = `docker.io/itzg/minecraft-server:${javaTag}`;
    } else {
      shortImage = customImg;
      fullImage = customImg.startsWith("docker.io/") ? customImg : `docker.io/${customImg}`;
    }
  }

  return { shortImage, fullImage, javaTag };
}

/**
 * Calculates safe JVM memory flags and container memory limits.
 */
export function calculateSafeJvmMemory(ramGB: number): {
  xms: string;
  xmx: string;
  maxHeapMB: number;
  containerLimitBytes: number;
} {
  const safeRam = Math.max(1, Number(ramGB) || 2);
  const totalMB = safeRam * 1024;
  // Leave a small buffer for JVM off-heap metaspace/native overhead
  const heapMB = safeRam >= 4 ? totalMB - 512 : Math.max(512, Math.floor(totalMB * 0.85));
  return {
    xms: "128M",
    xmx: `${heapMB}M`,
    maxHeapMB: heapMB,
    containerLimitBytes: safeRam * 1024 * 1024 * 1024
  };
}

/**
 * Diagnostic crash detector that parses console output to determine root causes.
 */
export interface CrashDiagnostic {
  isCrash: boolean;
  type?: "JAVA_VERSION_MISMATCH" | "OOM" | "PORT_BIND_ERROR" | "WORLD_VERSION_MISMATCH" | "CORRUPT_CONFIG" | "GENERAL_ERROR";
  title?: string;
  message?: string;
  suggestedFix?: string;
  requiredJavaVersion?: string;
}

export function diagnoseServerLogs(logs: string | string[]): CrashDiagnostic | null {
  const text = Array.isArray(logs) ? logs.join("\n") : String(logs || "");
  if (!text) return null;

  // 1. Java version mismatch checks
  // Example: "Minecraft 26.1 and newer requires running the server with Java 25 or above."
  const javaReqMatch = text.match(/requires running the server with Java (\d+) or above/i);
  if (javaReqMatch) {
    const requiredJava = javaReqMatch[1];
    return {
      isCrash: true,
      type: "JAVA_VERSION_MISMATCH",
      title: "Java Runtime Incompatibility",
      message: `The server software requires Java ${requiredJava} or newer to run, but is currently using an older Java runtime.`,
      suggestedFix: `The runtime will automatically be updated to Java ${requiredJava}. You can also change this in Server Settings > Runtime.`,
      requiredJavaVersion: requiredJava
    };
  }

  // UnsupportedClassVersionError check:
  // class file version 69.0 = Java 25
  // class file version 65.0 = Java 21
  // class file version 61.0 = Java 17
  // class file version 60.0 = Java 16
  // class file version 55.0 = Java 11
  // class file version 52.0 = Java 8
  const classVerMatch = text.match(/has been compiled by a more recent version of the Java Runtime \(class file version (\d+\.\d+)\)/i);
  if (classVerMatch) {
    const classVer = parseFloat(classVerMatch[1]);
    let reqJava = "25";
    if (classVer >= 69.0) reqJava = "25";
    else if (classVer >= 65.0) reqJava = "21";
    else if (classVer >= 61.0) reqJava = "17";
    else if (classVer >= 60.0) reqJava = "16";
    else if (classVer >= 55.0) reqJava = "11";

    return {
      isCrash: true,
      type: "JAVA_VERSION_MISMATCH",
      title: "Java Runtime Incompatibility",
      message: `A server file or plugin was compiled for Java ${reqJava} (class file version ${classVerMatch[1]}), but the current environment is running an older Java version.`,
      suggestedFix: `Upgrade server runtime to Java ${reqJava}.`,
      requiredJavaVersion: reqJava
    };
  }

  // 2. Out of Memory
  if (/java\.lang\.OutOfMemoryError/i.test(text) || /Container killed by OOM/i.test(text)) {
    return {
      isCrash: true,
      type: "OOM",
      title: "Out of Memory (OOM)",
      message: "The server process exceeded its allocated RAM heap limit and terminated.",
      suggestedFix: "Increase the server RAM allocation in Server Settings or remove memory-heavy plugins/mods."
    };
  }

  // 3. Port binding error
  if (/FAILED TO BIND TO PORT/i.test(text) || /Address already in use/i.test(text)) {
    return {
      isCrash: true,
      type: "PORT_BIND_ERROR",
      title: "Port Conflict",
      message: "The server failed to bind to its configured network port because another process is already using it.",
      suggestedFix: "Change the server port in server.properties or verify no duplicate instance is running."
    };
  }

  return null;
}
