import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import { loadEnvConfig, type LoadedEnvFiles } from "@next/env";

const LISTENER_OVERRIDE_FILE = ".env.payments.local";

let loaded = false;

/** Vercel `env pull` writes encrypted secrets as empty strings — treat as unset. */
function stripEmptyEnv(keys: Iterable<string>) {
  for (const key of keys) {
    if (process.env[key] === "") {
      delete process.env[key];
    }
  }
}

/** Backfill keys from later env files when still unset. */
function backfillUnsetEnv(loadedEnvFiles: LoadedEnvFiles) {
  for (const file of [...loadedEnvFiles].reverse()) {
    for (const [key, value] of Object.entries(file.env)) {
      if (!value) continue;
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

/** Optional local-only secrets file (gitignored). Highest priority for standalone scripts. */
function loadListenerOverride(projectDir: string) {
  const filePath = path.join(projectDir, LISTENER_OVERRIDE_FILE);
  if (!fs.existsSync(filePath)) return false;

  const parsed = parse(fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (value) process.env[key] = value;
  }
  return true;
}

/**
 * Load `.env*` files with the same precedence as Next.js.
 * Standalone scripts (tsx, Prisma seed, etc.) do not get this automatically.
 */
export function loadProjectEnv(projectDir = process.cwd()) {
  if (loaded) return;
  const dev = process.env.NODE_ENV === "development";
  const { loadedEnvFiles } = loadEnvConfig(projectDir, dev);

  const keys = new Set<string>();
  for (const file of loadedEnvFiles) {
    for (const key of Object.keys(file.env)) keys.add(key);
  }
  stripEmptyEnv(keys);
  backfillUnsetEnv(loadedEnvFiles);
  loadListenerOverride(projectDir);

  loaded = true;
}

export function listenerOverridePath(projectDir = process.cwd()) {
  return path.join(projectDir, LISTENER_OVERRIDE_FILE);
}

loadProjectEnv();
