const GATEWAY = "https://gateway.pinata.cloud/ipfs";

export function isPinataConfigured(): boolean {
  return !!process.env.PINATA_JWT;
}

export async function uploadFileToPinata(file: File, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("pinataMetadata", JSON.stringify({ name: filename }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Pinata upload failed: ${await res.text()}`);
  const data = (await res.json()) as { IpfsHash: string };
  return `ipfs://${data.IpfsHash}`;
}

export async function uploadJsonToPinata(obj: object, name: string): Promise<string> {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataMetadata: { name }, pinataContent: obj }),
  });

  if (!res.ok) throw new Error(`Pinata JSON upload failed: ${await res.text()}`);
  const data = (await res.json()) as { IpfsHash: string };
  return `ipfs://${data.IpfsHash}`;
}

/** Convert ipfs:// URI to a public HTTP gateway URL */
export function ipfsToHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) return `${GATEWAY}/${uri.slice(7)}`;
  return uri;
}
