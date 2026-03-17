import BN from "bn.js";

import {
  calculateBuyPriceImpact,
  calculateSellPriceImpact,
  getGraduationProgress,
  getTokenPrice,
  getBondingCurveSummary,
} from "../analytics";

import {
  makeGlobal,
  makeBondingCurve,
  makeGraduatedBondingCurve,
} from "./fixtures";

const global = makeGlobal();
const mintSupply = global.tokenTotalSupply;

describe("analytics", () => {
  // ── calculateBuyPriceImpact ────────────────────────────────────────

  describe("calculateBuyPriceImpact", () => {
    it("returns positive price impact for a buy", () => {
      const result = calculateBuyPriceImpact({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        solAmount: new BN("1000000000"), // 1 SOL
      });
      expect(result.impactBps).toBeGreaterThan(0);
      expect(result.outputAmount.gt(new BN(0))).toBe(true);
      expect(result.priceBefore.gt(new BN(0))).toBe(true);
      expect(result.priceAfter.gt(result.priceBefore)).toBe(true);
    });

    it("larger buy → larger price impact", () => {
      const bc = makeBondingCurve();
      const small = calculateBuyPriceImpact({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        solAmount: new BN("100000000"), // 0.1 SOL
      });
      const large = calculateBuyPriceImpact({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        solAmount: new BN("10000000000"), // 10 SOL
      });
      expect(large.impactBps).toBeGreaterThan(small.impactBps);
    });
  });

  // ── calculateSellPriceImpact ───────────────────────────────────────

  describe("calculateSellPriceImpact", () => {
    it("returns positive price impact for a sell", () => {
      const result = calculateSellPriceImpact({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        tokenAmount: new BN("1000000000000"), // 1M tokens
      });
      expect(result.impactBps).toBeGreaterThan(0);
      expect(result.outputAmount.gt(new BN(0))).toBe(true);
    });
  });

  // ── getGraduationProgress ──────────────────────────────────────────

  describe("getGraduationProgress", () => {
    it("shows 0% progress for fresh curve", () => {
      const result = getGraduationProgress(global, makeBondingCurve());
      expect(result.progressBps).toBe(0);
      expect(result.isGraduated).toBe(false);
      expect(result.tokensRemaining.eq(global.initialRealTokenReserves)).toBe(true);
    });

    it("shows 100% for graduated curve", () => {
      const result = getGraduationProgress(global, makeGraduatedBondingCurve());
      expect(result.progressBps).toBe(10_000);
      expect(result.isGraduated).toBe(true);
      expect(result.tokensRemaining.eq(new BN(0))).toBe(true);
    });

    it("shows partial progress for partially sold curve", () => {
      // Sell half the real tokens
      const halfSold = makeBondingCurve({
        realTokenReserves: global.initialRealTokenReserves.divn(2),
        realSolReserves: new BN("40000000000"),
      });
      const result = getGraduationProgress(global, halfSold);
      expect(result.progressBps).toBeGreaterThan(4900);
      expect(result.progressBps).toBeLessThan(5100);
      expect(result.isGraduated).toBe(false);
    });

    it("handles zero initialRealTokenReserves", () => {
      const zeroGlobal = makeGlobal({ initialRealTokenReserves: new BN(0) });
      const result = getGraduationProgress(zeroGlobal, makeBondingCurve());
      expect(result.progressBps).toBe(0);
    });
  });

  // ── getTokenPrice ──────────────────────────────────────────────────

  describe("getTokenPrice", () => {
    it("returns buy and sell prices for 1 token", () => {
      const result = getTokenPrice({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
      });
      expect(result.buyPricePerToken.gt(new BN(0))).toBe(true);
      expect(result.sellPricePerToken.gt(new BN(0))).toBe(true);
      expect(result.marketCap.gt(new BN(0))).toBe(true);
      expect(result.isGraduated).toBe(false);
      // Buy price should be higher than sell price (spread)
      expect(result.buyPricePerToken.gt(result.sellPricePerToken)).toBe(true);
    });
  });

  // ── getBondingCurveSummary ─────────────────────────────────────────

  describe("getBondingCurveSummary", () => {
    it("returns a complete summary", () => {
      const bc = makeBondingCurve();
      const summary = getBondingCurveSummary({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
      });
      expect(summary.marketCap.gt(new BN(0))).toBe(true);
      expect(summary.progressBps).toBe(0);
      expect(summary.isGraduated).toBe(false);
      expect(summary.buyPricePerToken.gt(new BN(0))).toBe(true);
      expect(summary.sellPricePerToken.gt(new BN(0))).toBe(true);
      expect(summary.virtualSolReserves.eq(bc.virtualSolReserves)).toBe(true);
      expect(summary.virtualTokenReserves.eq(bc.virtualTokenReserves)).toBe(true);
    });
  });
});
