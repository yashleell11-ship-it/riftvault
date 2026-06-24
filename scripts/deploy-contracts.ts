import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const NFT = await ethers.getContractFactory("RiftVaultNFT");
  const nft = await NFT.deploy();
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("RiftVaultNFT:", nftAddress);

  const Marketplace = await ethers.getContractFactory("RiftVaultMarketplace");
  const marketplace = await Marketplace.deploy(deployer.address);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("RiftVaultMarketplace:", marketplaceAddress);

  const out = {
    network: "sepolia",
    nft: nftAddress,
    marketplace: marketplaceAddress,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "..", "contracts", "deployments.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Saved", outPath);
  console.log("\nAdd to .env:");
  console.log(`NEXT_PUBLIC_NFT_CONTRACT_ADDRESS="${nftAddress}"`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS="${marketplaceAddress}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
