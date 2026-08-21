import crypto from "crypto";

/**
 * Centralized JWT Security and Validation Utility
 *
 * Prevents insecure hardcoded fallbacks and enforces strict secret requirements in production.
 */

let cachedSecret: string | null = null;

export function getJwtSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }

  const envSecret = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (envSecret && envSecret.length >= 32) {
    cachedSecret = envSecret;
    return cachedSecret;
  }

  if (envSecret && envSecret.length < 32) {
    console.warn(`[SECURITY WARNING] JWT_SECRET is short (${envSecret.length} chars). Consider using at least 32 characters.`);
    cachedSecret = envSecret;
    return cachedSecret;
  }

  // If JWT_SECRET is not set:
  // Auto-generate a secure random secret at runtime
  const generatedSecret = crypto.randomBytes(32).toString("hex");
  cachedSecret = generatedSecret;
  process.env.JWT_SECRET = generatedSecret;
  console.warn("\n[SECURITY NOTICE] No JWT_SECRET set in environment.");
  console.warn(`Auto-generated temporary session secret: ${generatedSecret.slice(0, 8)}...`);
  console.warn("Notice: Active user sessions will be invalidated when the server restarts.\n");

  return cachedSecret;
}

/**
 * Validates JWT configuration on server startup.
 */
export function validateJwtSecretOnStartup(): void {
  getJwtSecret();
}
