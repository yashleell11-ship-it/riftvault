import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPinataConfigured, uploadFileToPinata, uploadJsonToPinata, ipfsToHttp } from "@/lib/pinata";

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

export async function POST(req: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contentType = req.headers.get("content-type") ?? "";

  let name: string, description: string | undefined, imageUrl: string, rarity: string, collectionId: string, tokenId: string;

  if (contentType.includes("multipart/form-data")) {
    // File upload path (with optional Pinata)
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    name = (form.get("name") as string | null) ?? "";
    description = (form.get("description") as string | null) ?? undefined;
    rarity = (form.get("rarity") as string | null) ?? "common";
    collectionId = (form.get("collectionId") as string | null) ?? "";
    tokenId = (form.get("tokenId") as string | null) ?? "";
    const imageFile = form.get("image") as File | null;
    const imageUrlField = (form.get("imageUrl") as string | null) ?? "";

    if (!name || !collectionId || !tokenId) {
      return NextResponse.json({ error: "name, collectionId, tokenId are required" }, { status: 400 });
    }

    if (imageFile && imageFile.size > 0 && isPinataConfigured()) {
      const ipfsCid = await uploadFileToPinata(imageFile, `${name.replace(/\s+/g, "-")}.${imageFile.name.split(".").pop()}`);
      // Also pin metadata JSON to IPFS
      const metadataUri = await uploadJsonToPinata(
        { name, description: description ?? "", image: ipfsCid, attributes: [{ trait_type: "Rarity", value: rarity }] },
        `${name.replace(/\s+/g, "-")}-metadata`
      );
      imageUrl = ipfsToHttp(ipfsCid);
      tokenId = metadataUri; // store metadata URI as tokenId when minted via IPFS
    } else if (imageFile && imageFile.size > 0) {
      // No Pinata — use a placeholder gateway URL (dev convenience)
      imageUrl = imageUrlField || "https://placehold.co/400x400/0a0e1a/00e5c3?text=NFT";
    } else {
      imageUrl = imageUrlField;
    }
  } else {
    // JSON path (existing behavior — image URL provided directly)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    name = (body.name as string) ?? "";
    description = (body.description as string) ?? undefined;
    imageUrl = (body.imageUrl as string) ?? "";
    rarity = (body.rarity as string) ?? "common";
    collectionId = (body.collectionId as string) ?? "";
    tokenId = (body.tokenId as string) ?? "";

    if (!name || !imageUrl || !collectionId || !tokenId) {
      return NextResponse.json({ error: "name, imageUrl, collectionId, tokenId are required" }, { status: 400 });
    }
    try { new URL(imageUrl); } catch { return NextResponse.json({ error: "imageUrl must be a valid URL" }, { status: 400 }); }
  }

  if (!RARITIES.includes(rarity as typeof RARITIES[number])) rarity = "common";

  const nft = await prisma.nft.create({ data: { name, description, imageUrl, rarity, collectionId, tokenId, status: "available" } });
  return NextResponse.json({ nft }, { status: 201 });
}
