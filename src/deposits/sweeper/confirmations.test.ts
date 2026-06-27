import { describe, it, expect } from "vitest";
import type { PublicClient } from "viem";
import { getTxLiveness, isReceiptWaitTimeout } from "@/deposits/sweeper/confirmations";

const HASH = "0xabc0000000000000000000000000000000000000000000000000000000000001" as const;

function mockClient(opts: {
  receipt?: unknown;
  receiptThrows?: boolean;
  tx?: unknown;
  txThrows?: boolean;
}): PublicClient {
  return {
    getTransactionReceipt: async () => {
      if (opts.receiptThrows) throw new Error("not found");
      if (opts.receipt === undefined) throw new Error("not found");
      return opts.receipt;
    },
    getTransaction: async () => {
      if (opts.txThrows) throw new Error("not found");
      if (opts.tx === undefined) throw new Error("not found");
      return opts.tx;
    },
  } as unknown as PublicClient;
}

describe("getTxLiveness", () => {
  it("returns 'mined' when a receipt exists", async () => {
    const client = mockClient({ receipt: { status: "success", blockNumber: 100n } });
    expect(await getTxLiveness(client, HASH)).toBe("mined");
  });

  it("returns 'pending' when no receipt but tx is in the mempool", async () => {
    const client = mockClient({ receiptThrows: true, tx: { hash: HASH, nonce: 7 } });
    expect(await getTxLiveness(client, HASH)).toBe("pending");
  });

  it("returns 'dropped' when neither a receipt nor a mempool tx exists", async () => {
    const client = mockClient({ receiptThrows: true, txThrows: true });
    expect(await getTxLiveness(client, HASH)).toBe("dropped");
  });

  it("treats a reverted receipt as mined (it had a block)", async () => {
    const client = mockClient({ receipt: { status: "reverted", blockNumber: 50n } });
    expect(await getTxLiveness(client, HASH)).toBe("mined");
  });
});

describe("isReceiptWaitTimeout", () => {
  it("recognises viem's timeout error by name", () => {
    const err = new Error("boom");
    err.name = "WaitForTransactionReceiptTimeoutError";
    expect(isReceiptWaitTimeout(err)).toBe(true);
  });

  it("recognises the timeout by message text", () => {
    expect(
      isReceiptWaitTimeout(new Error("Timed out while waiting for transaction to be confirmed."))
    ).toBe(true);
  });

  it("is false for unrelated errors and non-errors", () => {
    expect(isReceiptWaitTimeout(new Error("nonce too low"))).toBe(false);
    expect(isReceiptWaitTimeout("nope")).toBe(false);
    expect(isReceiptWaitTimeout(null)).toBe(false);
  });
});
