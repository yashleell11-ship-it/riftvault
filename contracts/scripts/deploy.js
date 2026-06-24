const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

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

  const Token = await ethers.getContractFactory("RiftVaultToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("RiftVaultToken (RVLT):", tokenAddress);

  const out = {
    network: "sepolia",
    nft: nftAddress,
    marketplace: marketplaceAddress,
    token: tokenAddress,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "..", "deployments.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Saved", outPath);
  console.log("\nAdd to .env:");
  console.log(`NEXT_PUBLIC_NFT_CONTRACT_ADDRESS="${nftAddress}"`);
  console.log(`NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS="${marketplaceAddress}"`);
  console.log(`NEXT_PUBLIC_RVLT_TOKEN_ADDRESS="${tokenAddress}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
