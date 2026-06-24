import { prisma } from "@/lib/db";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";

export type TenantBranding = {
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  accentHex: string | null;
};

const DEFAULT: TenantBranding = {
  slug: "riftvault",
  name: SITE_NAME,
  tagline: SITE_TAGLINE,
  logoUrl: null,
  accentHex: null,
};

export async function getTenantBranding(): Promise<TenantBranding> {
  const slug = process.env.NEXT_PUBLIC_TENANT_SLUG ?? "riftvault";

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug, active: true },
    });

    if (!tenant) return { ...DEFAULT, slug };

    return {
      slug: tenant.slug,
      name: tenant.name,
      tagline: tenant.tagline ?? SITE_TAGLINE,
      logoUrl: tenant.logoUrl,
      accentHex: tenant.accentHex,
    };
  } catch {
    return { ...DEFAULT, slug };
  }
}
