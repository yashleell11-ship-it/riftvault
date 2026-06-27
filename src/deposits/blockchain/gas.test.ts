import { describe, it, expect } from "vitest";
import type { PublicClient } from "viem";
import {
  estimateUsdtTransferGas,
  estimateNativeTransferGas,
  gasFundingShortfall,
  refundableBnbAmount,
  canAffordNativeTransfer,
  getPinnedGasPrice,
  MIN_GAS_FUNDING_BUFFER_WEI,
} from "@/deposits/blockchain/gas";

const FROM = "0x1111111111111111111111111111111111111111" as const;
const TO = "0x2222222222222222222222222222222222222222" as const;

/** Minimal mock of the viem PublicClient surface gas.ts touches. */
function mockClient(opts: {
  gasPrice: bigint;
  estimateGas?: bigint;
  estimateThrows?: boolean;
}): PublicClient {
  return {
    getGasPrice: async () => opts.gasPrice,
    estimateContractGas: async () => {
      if (opts.estimateThrows) throw new Error("estimate failed");
      return opts.estimateGas ?? 60_000n;
    },
  } as unknown as PublicClient;
}

describe("getPinnedGasPrice", () => {
  it("applies a 1.30x margin over the network price", async () => {
    const client = mockClient({ gasPrice: 3_000_000_000n }); // 3 gwei
    const { rawGasPrice, gasPrice } = await getPinnedGasPrice(client);
    expect(rawGasPrice).toBe(3_000_000_000n);
    expect(gasPrice).toBe((3_000_000_000n * 13n) / 10n);
  });

  it("floors a near-zero network price at 1 gwei before margin", async () => {
    const client = mockClient({ gasPrice: 1n });
    const { rawGasPrice, gasPrice } = await getPinnedGasPrice(client);
    expect(rawGasPrice).toBe(1_000_000_000n);
    expect(gasPrice).toBe((1_000_000_000n * 13n) / 10n);
  });
});

describe("estimateUsdtTransferGas", () => {
  it("pins gasLimit (1.20x) and gasPrice (1.30x) and bounds cost by fundingTarget", async () => {
    // estimate above the 100k ERC20 floor so the 1.20x margin is observable
    const client = mockClient({ gasPrice: 5_000_000_000n, estimateGas: 120_000n });
    const plan = await estimateUsdtTransferGas(client, FROM, TO, 1_000n);

    expect(plan.rawGasLimit).toBe(120_000n);
    expect(plan.gasLimit).toBe((120_000n * 12n) / 10n);
    expect(plan.gasPrice).toBe((5_000_000_000n * 13n) / 10n);
    expect(plan.gasCost).toBe(plan.gasLimit * plan.gasPrice);
    // funding always covers the pinned max tx cost
    expect(plan.fundingTarget).toBeGreaterThanOrEqual(plan.gasCost);
  });

  it("never trusts an estimate below the ERC20 floor (100k)", async () => {
    const client = mockClient({ gasPrice: 3_000_000_000n, estimateGas: 21_000n });
    const plan = await estimateUsdtTransferGas(client, FROM, TO, 1_000n);
    expect(plan.rawGasLimit).toBe(100_000n);
  });

  it("falls back to 100k gas when estimation throws", async () => {
    const client = mockClient({ gasPrice: 3_000_000_000n, estimateThrows: true });
    const plan = await estimateUsdtTransferGas(client, FROM, TO, 1_000n);
    expect(plan.rawGasLimit).toBe(100_000n);
    expect(plan.gasLimit).toBe((100_000n * 12n) / 10n);
  });

  it("funds max(gasCost, MIN_BUFFER) and never below the 0.00002 BNB floor", async () => {
    // Even at the 1-gwei price floor the pinned cost (~0.000156 BNB) exceeds
    // the buffer, so fundingTarget == gasCost here; assert the max() semantics
    // and that funding is always >= the absolute safety floor.
    const client = mockClient({ gasPrice: 1n, estimateGas: 100_000n });
    const plan = await estimateUsdtTransferGas(client, FROM, TO, 1_000n);
    const expected =
      plan.gasCost > MIN_GAS_FUNDING_BUFFER_WEI ? plan.gasCost : MIN_GAS_FUNDING_BUFFER_WEI;
    expect(plan.fundingTarget).toBe(expected);
    expect(plan.fundingTarget).toBeGreaterThanOrEqual(MIN_GAS_FUNDING_BUFFER_WEI);
    expect(plan.fundingTarget).toBeGreaterThanOrEqual(plan.gasCost);
  });
});

describe("underfunding invariant", () => {
  // The cardinal guarantee: a wallet funded to plan.fundingTarget can ALWAYS
  // pay the sweep tx, which is signed with plan.gasLimit/plan.gasPrice. The
  // most adversarial case is gasUsed == gasLimit (tx consumes the whole limit).
  it("fundingTarget >= worst-case tx cost across a wide gas-price range", async () => {
    const prices = [1n, 1_000_000_000n, 3_000_000_000n, 5_000_000_000n, 10_000_000_000n, 50_000_000_000n];
    const estimates = [60_000n, 80_000n, 100_000n, 150_000n];

    for (const gasPrice of prices) {
      for (const estimateGas of estimates) {
        const client = mockClient({ gasPrice, estimateGas });
        const plan = await estimateUsdtTransferGas(client, FROM, TO, 1_000n);
        const worstCaseTxCost = plan.gasLimit * plan.gasPrice; // gasUsed <= gasLimit
        expect(plan.fundingTarget).toBeGreaterThanOrEqual(worstCaseTxCost);
      }
    }
  });

  it("survives a gas-price spike between planning and the next plan", async () => {
    // Plan at low price, then a spike: a fresh plan must demand more, and the
    // sweeper re-plans every attempt so the higher target is always honoured.
    const low = await estimateUsdtTransferGas(
      mockClient({ gasPrice: 3_000_000_000n, estimateGas: 100_000n }),
      FROM,
      TO,
      1_000n
    );
    const high = await estimateUsdtTransferGas(
      mockClient({ gasPrice: 30_000_000_000n, estimateGas: 100_000n }),
      FROM,
      TO,
      1_000n
    );
    expect(high.fundingTarget).toBeGreaterThan(low.fundingTarget);
    expect(high.fundingTarget).toBeGreaterThanOrEqual(high.gasLimit * high.gasPrice);
  });
});

describe("gasFundingShortfall", () => {
  it("returns 0 when balance already meets the target", () => {
    expect(gasFundingShortfall(100n, 100n)).toBe(0n);
    expect(gasFundingShortfall(200n, 100n)).toBe(0n);
  });
  it("returns the exact deficit when short (incl. 1-wei underfund)", () => {
    expect(gasFundingShortfall(99n, 100n)).toBe(1n);
    expect(gasFundingShortfall(6_212_800_000_000n, 6_212_880_000_000n)).toBe(80_000_000n);
  });
});

describe("estimateNativeTransferGas", () => {
  it("uses 21000 gas and reserves exactly gasCost (no MIN_BUFFER inflation)", async () => {
    const client = mockClient({ gasPrice: 3_000_000_000n });
    const plan = await estimateNativeTransferGas(client);
    expect(plan.gasLimit).toBe(21_000n);
    expect(plan.gasPrice).toBe((3_000_000_000n * 13n) / 10n);
    // reserve == pinned gasCost (NOT max'd with the buffer), so leftover BNB
    // above the actual refund-tx cost is never stranded at the deposit address.
    expect(plan.fundingTarget).toBe(plan.gasCost);
    expect(plan.gasCost).toBe(21_000n * ((3_000_000_000n * 13n) / 10n));
  });
});

describe("refundableBnbAmount", () => {
  it("reserves gas and returns the remainder", () => {
    expect(refundableBnbAmount(1_000n, 100n)).toBe(900n);
  });
  it("returns 0 when below the minimum refund threshold", () => {
    expect(refundableBnbAmount(150n, 100n, 1_000n)).toBe(0n);
  });
  it("returns 0 when balance does not even cover the reserve", () => {
    expect(refundableBnbAmount(50n, 100n)).toBe(0n);
  });
});

describe("canAffordNativeTransfer", () => {
  it("is true only when balance covers value + gas reserve", () => {
    expect(canAffordNativeTransfer(1_000n, 900n, 100n)).toBe(true); // exact
    expect(canAffordNativeTransfer(1_000n, 901n, 100n)).toBe(false);
    expect(canAffordNativeTransfer(999n, 900n, 100n)).toBe(false);
  });
});
