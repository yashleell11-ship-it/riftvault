import type { TenantBranding } from "@/lib/tenant";

export function TenantStyles({ tenant }: { tenant: TenantBranding }) {
  if (!tenant.accentHex) return null;

  return (
    <style>{`
      :root {
        --color-accent: ${tenant.accentHex};
        --color-accent-dim: color-mix(in srgb, ${tenant.accentHex} 75%, black);
      }
    `}</style>
  );
}
