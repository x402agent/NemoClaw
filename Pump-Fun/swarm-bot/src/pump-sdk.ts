import { createRequire } from 'node:module';
import type * as PumpSdk from '@nirholas/pump-sdk';
import type { Connection } from '@solana/web3.js';

/**
 * Runtime-safe bridge for @nirholas/pump-sdk.
 *
 * The published package currently points ESM imports to dist/esm/index.js,
 * while the file emitted by tsup is dist/esm/index.mjs. Using createRequire()
 * forces Node to load the CJS export path (dist/index.js), which exists.
 */
const require = createRequire(import.meta.url);
const sdk = require('@nirholas/pump-sdk') as typeof PumpSdk;

export type OnlinePumpSdkInstance = InstanceType<typeof PumpSdk.OnlinePumpSdk>;

export function createOnlinePumpSdk(connection: Connection): OnlinePumpSdkInstance {
    return new sdk.OnlinePumpSdk(connection) as OnlinePumpSdkInstance;
}

export const {
    OnlinePumpSdk,
    PUMP_SDK,
    getBuyTokenAmountFromSolAmount,
    getSellSolAmountFromTokenAmount,
    getGraduationProgress,
    bondingCurveMarketCap,
} = sdk;
