import BN from "bn.js";

import {
  computeFeesBps,
  calculateFeeTier,
  getFee,
  ONE_BILLION_SUPPLY,
} from "../fees";

import {
  makeGlobal,
  makeBondingCurve,
  makeFeeConfig,
  makeBondingCurveWithCreator,
} from "./fixtures";

const global = makeGlobal();
const mintSupply = global.tokenTotalSupply;
const bc = makeBondingCurve();

describe("fees", () => {
  // ── computeFeesBps ─────────────────────────────────────────────────

  describe("computeFeesBps", () => {
    it("uses global defaults when feeConfig is null", () => {
      const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
        global,
        feeConfig: null,
        mintSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });
      expect(protocolFeeBps.eq(global.feeBasisPoints)).toBe(true);
      expect(creatorFeeBps.eq(global.creatorFeeBasisPoints)).toBe(true);
    });

    it("uses tiered fees from feeConfig when provided", () => {
      const feeConfig = makeFeeConfig();
      const { protocolFeeBps, creatorFeeBps } = computeFeesBps({
        global,
        feeConfig,
        mintSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });
      // At initial state the market cap is ~28 SOL, which is below 100 SOL tier
      // so the first tier (200 bps protocol, 100 bps creator) applies
      expect(protocolFeeBps.eq(new BN(200))).toBe(true);
      expect(creatorFeeBps.eq(new BN(100))).toBe(true);
    });
  });

  // ── calculateFeeTier ───────────────────────────────────────────────

  describe("calculateFeeTier", () => {
    const feeConfig = makeFeeConfig();

    it("throws for empty feeTiers", () => {
      expect(() =>
        calculateFeeTier({ feeTiers: [], marketCap: new BN(0) }),
      ).toThrow("feeTiers must not be empty");
    });

    it("selects lowest tier for small market cap", () => {
      const result = calculateFeeTier({
        feeTiers: feeConfig.feeTiers,
        marketCap: new BN(50_000_000_000), // 50 SOL
      });
      expect(result.protocolFeeBps.eq(new BN(200))).toBe(true);
    });

    it("selects mid tier when threshold met", () => {
      const result = calculateFeeTier({
        feeTiers: feeConfig.feeTiers,
        marketCap: new BN("100000000000"), // exactly 100 SOL
      });
      expect(result.protocolFeeBps.eq(new BN(100))).toBe(true);
    });

    it("selects highest tier for large market cap", () => {
      const result = calculateFeeTier({
        feeTiers: feeConfig.feeTiers,
        marketCap: new BN("5000000000000"), // 5000 SOL
      });
      expect(result.protocolFeeBps.eq(new BN(50))).toBe(true);
    });

    it("returns first tier fees when below first threshold", () => {
      const tiers = [
        {
          marketCapLamportsThreshold: new BN("1000000000000"),
          fees: {
            lpFeeBps: new BN(0),
            protocolFeeBps: new BN(100),
            creatorFeeBps: new BN(50),
          },
        },
      ];
      // Market cap below the only tier threshold
      const result = calculateFeeTier({
        feeTiers: tiers,
        marketCap: new BN(0),
      });
      expect(result.protocolFeeBps.eq(new BN(100))).toBe(true);
    });
  });

  // ── getFee ─────────────────────────────────────────────────────────

  describe("getFee", () => {
    it("calculates fee for a trade amount (no creator)", () => {
      const amount = new BN("1000000000"); // 1 SOL
      const result = getFee({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount,
        isNewBondingCurve: false,
      });
      // Only protocol fee (1%), creator is default pubkey so no creator fee
      // ceil(1_000_000_000 * 100 / 10_000) = 10_000_000
      expect(result.eq(new BN(10_000_000))).toBe(true);
    });

    it("includes creator fee when creator is set", () => {
      const amount = new BN("1000000000");
      const bcWithCreator = makeBondingCurveWithCreator();
      const result = getFee({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bcWithCreator,
        amount,
        isNewBondingCurve: false,
      });
      // Protocol (1%) + Creator (0.5%) = 1.5%
      // ceil(1B * 100 / 10000) + ceil(1B * 50 / 10000) = 10M + 5M = 15M
      expect(result.eq(new BN(15_000_000))).toBe(true);
    });

    it("includes creator fee for new bonding curves", () => {
      const amount = new BN("1000000000");
      const result = getFee({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount,
        isNewBondingCurve: true,
      });
      // New bonding curve always includes creator fee
      expect(result.eq(new BN(15_000_000))).toBe(true);
    });
  });

  // ── ONE_BILLION_SUPPLY ─────────────────────────────────────────────

  describe("ONE_BILLION_SUPPLY", () => {
    it("equals 1e15 (1B tokens with 6 decimals)", () => {
      expect(ONE_BILLION_SUPPLY.eq(new BN("1000000000000000"))).toBe(true);
    });
  });
});
