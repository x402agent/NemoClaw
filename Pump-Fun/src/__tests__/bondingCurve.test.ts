import BN from "bn.js";

import {
  getBuyTokenAmountFromSolAmount,
  getBuySolAmountFromTokenAmount,
  getSellSolAmountFromTokenAmount,
  newBondingCurve,
  bondingCurveMarketCap,
} from "../bondingCurve";

import {
  makeGlobal,
  makeBondingCurve,
  makeMigratedBondingCurve,
  makeBondingCurveWithCreator,
} from "./fixtures";

const global = makeGlobal();
const mintSupply = global.tokenTotalSupply;

describe("bondingCurve", () => {
  // ── newBondingCurve ────────────────────────────────────────────────

  describe("newBondingCurve", () => {
    it("creates a bonding curve from global config", () => {
      const bc = newBondingCurve(global);
      expect(bc.virtualTokenReserves.eq(global.initialVirtualTokenReserves)).toBe(true);
      expect(bc.virtualSolReserves.eq(global.initialVirtualSolReserves)).toBe(true);
      expect(bc.realTokenReserves.eq(global.initialRealTokenReserves)).toBe(true);
      expect(bc.realSolReserves.eq(new BN(0))).toBe(true);
      expect(bc.complete).toBe(false);
    });
  });

  // ── getBuyTokenAmountFromSolAmount ─────────────────────────────────

  describe("getBuyTokenAmountFromSolAmount", () => {
    it("returns 0 for 0 SOL", () => {
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: new BN(0),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("returns tokens for a small buy (1 SOL)", () => {
      const oneSol = new BN("1000000000");
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: oneSol,
      });
      expect(result.gt(new BN(0))).toBe(true);
      // Rough sanity: buying 1 SOL should give roughly ~34M tokens at initial price
      expect(result.gt(new BN("30000000000000"))).toBe(true);
      expect(result.lt(new BN("40000000000000"))).toBe(true);
    });

    it("handles null bondingCurve (new token)", () => {
      const oneSol = new BN("1000000000");
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply: null,
        bondingCurve: null,
        amount: oneSol,
      });
      expect(result.gt(new BN(0))).toBe(true);
    });

    it("returns 0 for migrated bonding curve", () => {
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeMigratedBondingCurve(),
        amount: new BN("1000000000"),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("caps output at realTokenReserves", () => {
      // Try to buy with an enormous SOL amount that would exceed real reserves
      const hugeSol = new BN("999999999999999");
      const bc = makeBondingCurve();
      const result = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount: hugeSol,
      });
      expect(result.lte(bc.realTokenReserves)).toBe(true);
    });

    it("applies higher fees with a creator set", () => {
      const oneSol = new BN("1000000000");
      const bcNoCreator = makeBondingCurve();
      const bcWithCreator = makeBondingCurveWithCreator();

      const tokensNoCreator = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bcNoCreator,
        amount: oneSol,
      });
      const tokensWithCreator = getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bcWithCreator,
        amount: oneSol,
      });
      // Creator fee means fewer tokens
      expect(tokensWithCreator.lt(tokensNoCreator)).toBe(true);
    });
  });

  // ── getBuySolAmountFromTokenAmount ─────────────────────────────────

  describe("getBuySolAmountFromTokenAmount", () => {
    it("returns 0 for 0 tokens", () => {
      const result = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: new BN(0),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("returns SOL cost for a token amount", () => {
      const tokenAmount = new BN("1000000"); // 1 whole token
      const result = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: tokenAmount,
      });
      expect(result.gt(new BN(0))).toBe(true);
    });

    it("handles null bondingCurve (new token)", () => {
      const result = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply: null,
        bondingCurve: null,
        amount: new BN("1000000"),
      });
      expect(result.gt(new BN(0))).toBe(true);
    });

    it("returns 0 for migrated bonding curve", () => {
      const result = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeMigratedBondingCurve(),
        amount: new BN("1000000"),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });
  });

  // ── getSellSolAmountFromTokenAmount ────────────────────────────────

  describe("getSellSolAmountFromTokenAmount", () => {
    it("returns 0 for 0 tokens", () => {
      const result = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: new BN(0),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("returns SOL for selling tokens", () => {
      const tokenAmount = new BN("1000000"); // 1 whole token
      const result = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeBondingCurve(),
        amount: tokenAmount,
      });
      expect(result.gt(new BN(0))).toBe(true);
    });

    it("returns 0 for migrated bonding curve", () => {
      const result = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: makeMigratedBondingCurve(),
        amount: new BN("1000000"),
      });
      expect(result.eq(new BN(0))).toBe(true);
    });

    it("sell price < buy price (spread)", () => {
      const oneToken = new BN("1000000");
      const bc = makeBondingCurve();
      const buyCost = getBuySolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount: oneToken,
      });
      const sellRevenue = getSellSolAmountFromTokenAmount({
        global,
        feeConfig: null,
        mintSupply,
        bondingCurve: bc,
        amount: oneToken,
      });
      expect(sellRevenue.lt(buyCost)).toBe(true);
    });
  });

  // ── bondingCurveMarketCap ──────────────────────────────────────────

  describe("bondingCurveMarketCap", () => {
    it("calculates market cap correctly", () => {
      const bc = makeBondingCurve();
      const marketCap = bondingCurveMarketCap({
        mintSupply,
        virtualSolReserves: bc.virtualSolReserves,
        virtualTokenReserves: bc.virtualTokenReserves,
      });
      expect(marketCap.gt(new BN(0))).toBe(true);
      // At initial state: 30 SOL * 1B / 1.073B ≈ ~27.96 SOL
      const expectedApprox = new BN("27959925000"); // ~27.96 SOL
      // Within 10%
      expect(marketCap.gt(expectedApprox.muln(9).divn(10))).toBe(true);
      expect(marketCap.lt(expectedApprox.muln(11).divn(10))).toBe(true);
    });

    it("throws on zero virtual token reserves", () => {
      expect(() =>
        bondingCurveMarketCap({
          mintSupply,
          virtualSolReserves: new BN("30000000000"),
          virtualTokenReserves: new BN(0),
        }),
      ).toThrow("Division by zero");
    });
  });
});
