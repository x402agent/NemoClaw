import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

import {
  bondingCurvePda,
  bondingCurveV2Pda,
  creatorVaultPda,
  pumpPoolAuthorityPda,
  canonicalPumpPoolPda,
  userVolumeAccumulatorPda,
  getEventAuthorityPda,
  feeSharingConfigPda,
  ammCreatorVaultPda,
  feeProgramGlobalPda,
  socialFeePda,
  ammUserVolumeAccumulatorPda,
  poolV2Pda,
  getGlobalParamsPda,
  getMayhemStatePda,
  getSolVaultPda,
  getTokenVaultPda,
  GLOBAL_PDA,
  AMM_GLOBAL_PDA,
  PUMP_FEE_CONFIG_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA,
  PUMP_EVENT_AUTHORITY_PDA,
  PUMP_AMM_EVENT_AUTHORITY_PDA,
  PUMP_FEE_EVENT_AUTHORITY_PDA,
  AMM_FEE_CONFIG_PDA,
  AMM_GLOBAL_CONFIG_PDA,
} from "../pda";

import { TEST_PUBKEY, TEST_CREATOR } from "./fixtures";

describe("pda", () => {
  // ── Static PDAs ────────────────────────────────────────────────────

  describe("static PDAs", () => {
    it("GLOBAL_PDA is a valid PublicKey", () => {
      expect(GLOBAL_PDA).toBeInstanceOf(PublicKey);
    });

    it("AMM_GLOBAL_PDA is a valid PublicKey", () => {
      expect(AMM_GLOBAL_PDA).toBeInstanceOf(PublicKey);
    });

    it("PUMP_FEE_CONFIG_PDA is a valid PublicKey", () => {
      expect(PUMP_FEE_CONFIG_PDA).toBeInstanceOf(PublicKey);
    });

    it("GLOBAL_VOLUME_ACCUMULATOR_PDA is a valid PublicKey", () => {
      expect(GLOBAL_VOLUME_ACCUMULATOR_PDA).toBeInstanceOf(PublicKey);
    });

    it("AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA is a valid PublicKey", () => {
      expect(AMM_GLOBAL_VOLUME_ACCUMULATOR_PDA).toBeInstanceOf(PublicKey);
    });

    it("PUMP_EVENT_AUTHORITY_PDA is a valid PublicKey", () => {
      expect(PUMP_EVENT_AUTHORITY_PDA).toBeInstanceOf(PublicKey);
    });

    it("PUMP_AMM_EVENT_AUTHORITY_PDA is a valid PublicKey", () => {
      expect(PUMP_AMM_EVENT_AUTHORITY_PDA).toBeInstanceOf(PublicKey);
    });

    it("PUMP_FEE_EVENT_AUTHORITY_PDA is a valid PublicKey", () => {
      expect(PUMP_FEE_EVENT_AUTHORITY_PDA).toBeInstanceOf(PublicKey);
    });

    it("AMM_FEE_CONFIG_PDA is a valid PublicKey", () => {
      expect(AMM_FEE_CONFIG_PDA).toBeInstanceOf(PublicKey);
    });

    it("AMM_GLOBAL_CONFIG_PDA is a valid PublicKey", () => {
      expect(AMM_GLOBAL_CONFIG_PDA).toBeInstanceOf(PublicKey);
    });
  });

  // ── Derived PDAs ───────────────────────────────────────────────────

  describe("derived PDAs", () => {
    const mint = NATIVE_MINT;

    it("bondingCurvePda is deterministic", () => {
      const a = bondingCurvePda(mint);
      const b = bondingCurvePda(mint);
      expect(a.equals(b)).toBe(true);
    });

    it("bondingCurvePda differs for different mints", () => {
      const a = bondingCurvePda(mint);
      const b = bondingCurvePda(TEST_PUBKEY);
      expect(a.equals(b)).toBe(false);
    });

    it("creatorVaultPda is deterministic", () => {
      const a = creatorVaultPda(TEST_CREATOR);
      const b = creatorVaultPda(TEST_CREATOR);
      expect(a.equals(b)).toBe(true);
    });

    it("pumpPoolAuthorityPda returns a valid PublicKey", () => {
      const result = pumpPoolAuthorityPda(mint);
      expect(result).toBeInstanceOf(PublicKey);
    });

    it("canonicalPumpPoolPda returns a valid PublicKey", () => {
      const result = canonicalPumpPoolPda(mint);
      expect(result).toBeInstanceOf(PublicKey);
    });

    it("userVolumeAccumulatorPda is deterministic", () => {
      const a = userVolumeAccumulatorPda(TEST_CREATOR);
      const b = userVolumeAccumulatorPda(TEST_CREATOR);
      expect(a.equals(b)).toBe(true);
    });

    it("getEventAuthorityPda returns consistent results", () => {
      const programId = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
      const a = getEventAuthorityPda(programId);
      const b = getEventAuthorityPda(programId);
      expect(a.equals(b)).toBe(true);
    });

    it("feeSharingConfigPda is deterministic", () => {
      const a = feeSharingConfigPda(mint);
      const b = feeSharingConfigPda(mint);
      expect(a.equals(b)).toBe(true);
    });

    it("ammCreatorVaultPda is deterministic", () => {
      const a = ammCreatorVaultPda(TEST_CREATOR);
      const b = ammCreatorVaultPda(TEST_CREATOR);
      expect(a.equals(b)).toBe(true);
    });

    it("bondingCurveV2Pda is deterministic", () => {
      const a = bondingCurveV2Pda(mint);
      const b = bondingCurveV2Pda(mint);
      expect(a.equals(b)).toBe(true);
    });

    it("bondingCurveV2Pda differs from bondingCurvePda", () => {
      expect(bondingCurveV2Pda(mint).equals(bondingCurvePda(mint))).toBe(false);
    });

    it("poolV2Pda is deterministic", () => {
      const a = poolV2Pda(mint);
      const b = poolV2Pda(mint);
      expect(a.equals(b)).toBe(true);
    });

    it("poolV2Pda differs from canonicalPumpPoolPda", () => {
      expect(poolV2Pda(mint).equals(canonicalPumpPoolPda(mint))).toBe(false);
    });

    it("feeProgramGlobalPda returns a valid PublicKey", () => {
      const result = feeProgramGlobalPda();
      expect(result).toBeInstanceOf(PublicKey);
    });

    it("socialFeePda is deterministic for same userId+platform", () => {
      const a = socialFeePda("12345", 2);
      const b = socialFeePda("12345", 2);
      expect(a.equals(b)).toBe(true);
    });

    it("socialFeePda differs for different userIds", () => {
      const a = socialFeePda("12345", 2);
      const b = socialFeePda("67890", 2);
      expect(a.equals(b)).toBe(false);
    });

    it("socialFeePda differs for different platforms", () => {
      const a = socialFeePda("12345", 0);
      const b = socialFeePda("12345", 2);
      expect(a.equals(b)).toBe(false);
    });

    it("ammUserVolumeAccumulatorPda is deterministic", () => {
      const a = ammUserVolumeAccumulatorPda(TEST_CREATOR);
      const b = ammUserVolumeAccumulatorPda(TEST_CREATOR);
      expect(a.equals(b)).toBe(true);
    });

    it("ammUserVolumeAccumulatorPda differs from userVolumeAccumulatorPda", () => {
      expect(
        ammUserVolumeAccumulatorPda(TEST_CREATOR).equals(
          userVolumeAccumulatorPda(TEST_CREATOR),
        ),
      ).toBe(false);
    });

    it("getGlobalParamsPda returns a valid PublicKey", () => {
      expect(getGlobalParamsPda()).toBeInstanceOf(PublicKey);
    });

    it("getMayhemStatePda is deterministic", () => {
      const a = getMayhemStatePda(mint);
      const b = getMayhemStatePda(mint);
      expect(a.equals(b)).toBe(true);
    });

    it("getSolVaultPda returns a valid PublicKey", () => {
      expect(getSolVaultPda()).toBeInstanceOf(PublicKey);
    });

    it("getTokenVaultPda is deterministic", () => {
      const a = getTokenVaultPda(mint);
      const b = getTokenVaultPda(mint);
      expect(a.equals(b)).toBe(true);
    });
  });
});
