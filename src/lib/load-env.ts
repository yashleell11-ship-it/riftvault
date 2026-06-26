import { loadEnvConfig, type LoadedEnvFiles } from "@next/env";

let loaded = false;

/** Backfill keys left empty by an earlier file (e.g. Vercel pull placeholders). */
function backfillEmptyEnv(loadedEnvFiles: LoadedEnvFiles) {
  for (const file of [...loadedEnvFiles].reverse()) {
    for (const [key, value] of Object.entries(file.env)) {
      if (!value) continue;
      const current = process.env[key];
      if (current === undefined || current === "") {
        process.env[key] = value;
      }
    }
  }
}

/**
 * Load `.env*` files with the same precedence as Next.js.
 * Standalone scripts (tsx, Prisma seed, etc.) do not get this automatically.
 */
export function loadProjectEnv(projectDir = process.cwd()) {
  if (loaded) return;
  const dev = process.env.NODE_ENV === "development";
  const { loadedEnvFiles } = loadEnvConfig(projectDir, dev);
  backfillEmptyEnv(loadedEnvFiles);
  loaded = true;
}

loadProjectEnv();
