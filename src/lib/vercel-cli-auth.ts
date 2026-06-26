import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type VercelAuthFile = {
  token?: string;
  expiresAt?: number;
};

/** Resolve Vercel CLI global config directories (matches @vercel/cli-config). */
function vercelConfigDirs(): string[] {
  const home = os.homedir();
  const dirs: string[] = [];

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      dirs.push(path.join(appData, "xdg.data", "com.vercel.cli"));
      dirs.push(path.join(appData, "com.vercel.cli"));
    }
    dirs.push(path.join(home, ".vercel"));
  } else {
    dirs.push(path.join(home, ".local", "share", "com.vercel.cli"));
    dirs.push(path.join(home, ".config", "com.vercel.cli"));
    dirs.push(path.join(home, ".vercel"));
  }

  return dirs;
}

function readAuthFile(filePath: string): VercelAuthFile | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as VercelAuthFile;
  } catch {
    return null;
  }
}

/**
 * Read the OAuth token from `vercel login` (same credential the CLI uses for `vercel api`).
 * Returns null when not logged in or token expired.
 */
export function readVercelCliToken(): string | null {
  if (process.env.VERCEL_TOKEN?.trim()) {
    return process.env.VERCEL_TOKEN.trim();
  }

  for (const dir of vercelConfigDirs()) {
    const auth = readAuthFile(path.join(dir, "auth.json"));
    if (!auth?.token) continue;
    if (auth.expiresAt) {
      const expiresMs =
        auth.expiresAt > 1_000_000_000_000 ? auth.expiresAt : auth.expiresAt * 1000;
      if (expiresMs < Date.now()) continue;
    }
    return auth.token;
  }

  return null;
}

export function requireVercelCliToken(): string {
  const token = readVercelCliToken();
  if (!token) {
    throw new Error(
      "Not logged in to Vercel. Run `vercel login` once, then retry."
    );
  }
  return token;
}
