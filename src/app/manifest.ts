import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RiftVault — NFT Marketplace",
    short_name: "RiftVault",
    description: "Discover, reserve, and trade digital artifacts.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0c10",
    theme_color: "#00e5c3",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
