import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getReserveDayKey } from "../src/lib/reserve";
import { calcReferralCommission, calcTradingReward } from "../src/lib/earn";
import { creditWallet } from "../src/lib/wallet";
import { creditRvlt, RVLT } from "../src/lib/token";

const prisma = new PrismaClient();

const collections = [
  {
    name: "Void Relics",
    slug: "void-relics",
    description: "Artifacts pulled from the digital rift — ancient code made visible.",
    imageUrl: "https://picsum.photos/seed/void-relics/400/400",
    floorPrice: 0.12,
  },
  {
    name: "Neon Cartography",
    slug: "neon-cartography",
    description: "Maps of cities that never existed, rendered in electric light.",
    imageUrl: "https://picsum.photos/seed/neon-carto/400/400",
    floorPrice: 0.08,
  },
  {
    name: "Obsidian Seeds",
    slug: "obsidian-seeds",
    description: "Crystalline fragments that grow new worlds overnight.",
    imageUrl: "https://picsum.photos/seed/obsidian-seeds/400/400",
    floorPrice: 0.25,
  },
];

const rarities = ["common", "uncommon", "rare", "epic", "legendary"] as const;

function rarityPrice(base: number, rarity: string) {
  const mult: Record<string, number> = {
    common: 1,
    uncommon: 1.4,
    rare: 2.2,
    epic: 4,
    legendary: 8,
  };
  return Math.round(base * (mult[rarity] ?? 1) * 100) / 100;
}

async function main() {
  await prisma.governanceVote.deleteMany();
  await prisma.governanceProposal.deleteMany();
  await prisma.bridgeIntent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.kycProfile.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.airdropClaim.deleteMany();
  await prisma.airdropCampaign.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.earning.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.nft.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 12);
  const dayKey = getReserveDayKey();

  const demoUser = await prisma.user.create({
    data: {
      email: "demo@riftvault.io",
      displayName: "Demo Trader",
      passwordHash,
      emailVerified: new Date(),
      level: 2,
      role: "admin",
      isCreator: true,
    },
  });

  const collector = await prisma.user.create({
    data: {
      email: "collector@riftvault.io",
      displayName: "Night Collector",
      passwordHash,
      emailVerified: new Date(),
      level: 1,
      referredById: demoUser.id,
    },
  });

  const recruit = await prisma.user.create({
    data: {
      email: "recruit@riftvault.io",
      displayName: "Rift Recruit",
      passwordHash,
      emailVerified: new Date(),
      level: 1,
      referredById: collector.id,
    },
  });

  for (const col of collections) {
    const collection = await prisma.collection.create({ data: col });

    for (let i = 1; i <= 8; i++) {
      const rarity = rarities[i % rarities.length];
      const price = rarityPrice(col.floorPrice, rarity);
      const seed = `${col.slug}-${i}`;

      let status: string;
      let ownerId: string | null = null;

      if (i <= 2) {
        status = "available";
      } else if (i <= 5) {
        status = "listed";
        ownerId = demoUser.id;
      } else if (i === 6) {
        status = "reserved";
        ownerId = demoUser.id;
      } else {
        status = "available";
      }

      const nft = await prisma.nft.create({
        data: {
          tokenId: String(i),
          name: `${col.name} #${i}`,
          description: `A ${rarity} artifact from the ${col.name} collection.`,
          imageUrl: `https://picsum.photos/seed/${seed}/600/600`,
          rarity,
          collectionId: collection.id,
          status,
          ownerId,
        },
      });

      if (status === "listed") {
        await prisma.listing.create({
          data: {
            nftId: nft.id,
            sellerId: demoUser.id,
            price,
            currency: "USDT",
            status: "active",
          },
        });
      }

      if (status === "reserved" && ownerId) {
        await prisma.reservation.create({
          data: {
            userId: ownerId,
            nftId: nft.id,
            dayKey,
          },
        });
      }
    }
  }

  const sampleListed = await prisma.nft.findFirst({
    where: { status: "listed" },
    include: { listing: true },
  });

  if (sampleListed?.listing) {
    const price = sampleListed.listing.price;
    const currency = sampleListed.listing.currency;
    const l1Commission = calcReferralCommission(price, 1);

    const order = await prisma.order.create({
      data: {
        nftId: sampleListed.id,
        buyerId: collector.id,
        sellerId: demoUser.id,
        price,
        currency,
        status: "completed",
      },
    });

    await prisma.earning.createMany({
      data: [
        {
          userId: demoUser.id,
          orderId: order.id,
          type: "trading",
          amount: calcTradingReward(price),
          currency,
          description: "Trading reward (2.5% of sale)",
        },
        {
          userId: demoUser.id,
          orderId: order.id,
          type: "referral",
          amount: l1Commission,
          currency,
          description: "Referral commission (level 1)",
        },
      ],
    });

    await creditWallet(prisma, {
      userId: demoUser.id,
      amount: 500,
      currency: "USDT",
      type: "deposit",
      description: "Seed demo balance",
    });

    await creditWallet(prisma, {
      userId: collector.id,
      amount: 100,
      currency: "USDT",
      type: "deposit",
      description: "Seed demo balance",
    });

    await creditWallet(prisma, {
      userId: demoUser.id,
      amount: calcTradingReward(price),
      currency,
      type: "reward",
      description: "Trading reward",
      orderId: order.id,
    });

    await creditWallet(prisma, {
      userId: demoUser.id,
      amount: l1Commission,
      currency,
      type: "reward",
      description: "Referral commission (L1)",
      orderId: order.id,
    });
  }

  const now = new Date();
  const monthAhead = new Date(now);
  monthAhead.setMonth(monthAhead.getMonth() + 1);

  await prisma.airdropCampaign.createMany({
    data: [
      {
        slug: "rift-launch",
        name: "RiftVault Launch Drop",
        description:
          "Welcome bonus for verified traders. Claim once per account during the launch window.",
        tokenAmount: 25,
        currency: "USDT",
        minLevel: 1,
        requiresEmailVerified: true,
        maxClaims: 500,
        startsAt: now,
        endsAt: monthAhead,
        active: true,
      },
      {
        slug: "vault-pioneer",
        name: "Vault Pioneer",
        description: "Exclusive drop for level 2+ pioneers who helped grow the marketplace.",
        tokenAmount: 50,
        currency: "USDT",
        minLevel: 2,
        requiresEmailVerified: true,
        maxClaims: 100,
        startsAt: now,
        endsAt: monthAhead,
        active: true,
      },
      {
        slug: "rvlt-genesis",
        name: "RVLT Genesis Drop",
        description:
          "Claim RVLT platform tokens. Stake them to build loyalty — utility only, no returns promised.",
        tokenAmount: 500,
        currency: RVLT,
        minLevel: 1,
        requiresEmailVerified: true,
        maxClaims: 1000,
        startsAt: now,
        endsAt: monthAhead,
        active: true,
      },
    ],
  });

  // Seed RVLT balance for demo user
  await creditRvlt(prisma, {
    userId: demoUser.id,
    amount: 1000,
    type: "deposit",
    description: "Seed RVLT balance",
  });
  await creditRvlt(prisma, {
    userId: collector.id,
    amount: 250,
    type: "deposit",
    description: "Seed RVLT balance",
  });

  await prisma.tenant.create({
    data: {
      slug: "riftvault",
      name: "RiftVault",
      tagline: "Discover, reserve, and trade digital artifacts on-chain",
      accentHex: "#00e5c3",
      active: true,
    },
  });

  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 14);

  await prisma.governanceProposal.create({
    data: {
      title: "Lower marketplace fee to 2%",
      description:
        "Proposal to reduce the platform trading fee from 2.5% to 2% for LV3+ sellers. Vote with staked RVLT.",
      creatorId: demoUser.id,
      endsAt,
      status: "active",
    },
  });

  await prisma.kycProfile.create({
    data: {
      userId: demoUser.id,
      tier: 2,
      status: "approved",
      legalName: "Demo Trader",
      country: "UAE",
      submittedAt: new Date(),
      reviewedAt: new Date(),
    },
  });

  console.log("Seed complete.");
  console.log("Demo login: demo@riftvault.io / password123");
  console.log("Collector (L1 of demo): collector@riftvault.io / password123");
  console.log("Recruit (L2 of demo): recruit@riftvault.io / password123");
  console.log("Reserve pool: NFTs with status 'available' (2 per collection + extras)");
  void recruit;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
