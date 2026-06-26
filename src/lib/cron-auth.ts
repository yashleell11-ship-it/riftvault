import { readVercelCliToken } from "@/lib/vercel-cli-auth";

/** Verify a Vercel access token can read this deployment's project (team member). */
export async function verifyVercelProjectAccess(token: string): Promise<boolean> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) return false;

  const teamId = process.env.VERCEL_TEAM_ID;
  const url = new URL(`https://api.vercel.com/v9/projects/${projectId}`);
  if (teamId) url.searchParams.set("teamId", teamId);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Authorize cron/listener triggers:
 * - `Authorization: Bearer <CRON_SECRET>` (production cron / external schedulers)
 * - `Authorization: Bearer <vercel-cli-token>` when token has project access (local listener)
 */
export async function authorizeCronOrVercelCli(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;

  const token = auth.slice("Bearer ".length).trim();
  if (!token) return false;

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && token === cronSecret) return true;

  if (await verifyVercelProjectAccess(token)) return true;

  return false;
}

/** For local scripts: true when Vercel CLI credentials are available. */
export function hasVercelCliCredentials(): boolean {
  return Boolean(readVercelCliToken());
}
