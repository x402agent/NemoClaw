/**
 * NemoClaw Agent Registration
 *
 * Registers the NemoClaw agent on the 8004 Trustless Agent Registry
 * and optionally with Pump.fun. Idempotent — checks if already registered.
 */
import { Keypair, PublicKey, Connection } from '@solana/web3.js';
import { loadConfig } from './config.js';

interface RegistrationResult {
  registered: boolean;
  assetPubkey: string | null;
  alreadyExists: boolean;
  pumpfunVerified: boolean;
  error: string | null;
}

/**
 * Build the agent metadata for 8004 registry.
 */
function buildAgentMetadata(config: ReturnType<typeof loadConfig>) {
  return {
    name: config.agentName,
    description: config.agentDescription,
    image: '', // Can be set to IPFS image CID later
    services: [
      { type: 'A2A' as const, value: `solana:${config.developerWallet}` },
      ...(config.agentTokenMint
        ? [{ type: 'WALLET' as const, value: config.agentTokenMint }]
        : []),
    ],
    skills: ['advanced_reasoning_planning/strategic_planning'],
    domains: ['finance_and_business/finance'],
    x402Support: true,
    properties: {
      version: config.agentVersion,
      runtime: 'nemoclaw',
      model: '8bit/DeepSolana',
      sandbox: 'openshell',
      agentTokenMint: config.agentTokenMint,
      walletAddress: config.developerWallet,
      capabilities: [
        'solana-trading',
        'pump-fun-sdk',
        'telegram-bot',
        'wallet-narration',
        'defi-agents',
      ],
    },
  };
}

/**
 * Register with the 8004 Agent Registry.
 */
async function register8004(
  config: ReturnType<typeof loadConfig>,
): Promise<{ registered: boolean; assetPubkey: string | null; alreadyExists: boolean; error: string | null }> {
  try {
    // Dynamic import to handle cases where 8004-solana isn't installed yet
    const { SolanaSDK, buildRegistrationFileJson, ServiceType, IPFSClient } = await import('8004-solana');

    if (!config.walletPrivateKey) {
      console.log('[registry] No SOLANA_PRIVATE_KEY — running in read-only mode');
      console.log('[registry] Set SOLANA_PRIVATE_KEY to enable on-chain registration');

      // Check if agent already exists by wallet
      const sdk = new SolanaSDK({
        cluster: config.registryCluster,
        rpcUrl: config.solanaRpcUrl,
      });

      if (config.developerWallet) {
        try {
          const existing = await sdk.getAgentByWallet(config.developerWallet);
          if (existing) {
            console.log('[registry] Agent already registered at wallet %s', config.developerWallet);
            return {
              registered: true,
              assetPubkey: typeof existing === 'object' && 'asset' in (existing as any)
                ? (existing as any).asset
                : config.developerWallet,
              alreadyExists: true,
              error: null,
            };
          }
        } catch {
          // Not found — that's ok
        }
      }

      return { registered: false, assetPubkey: null, alreadyExists: false, error: 'No private key for signing' };
    }

    // Parse private key
    const secretKey = Uint8Array.from(JSON.parse(config.walletPrivateKey));
    const signer = Keypair.fromSecretKey(secretKey);

    const sdk = new SolanaSDK({
      cluster: config.registryCluster,
      rpcUrl: config.solanaRpcUrl,
      signer,
    });

    // Check if already registered
    if (config.developerWallet) {
      try {
        const existing = await sdk.getAgentByWallet(config.developerWallet);
        if (existing) {
          console.log('[registry] Agent already registered — skipping');
          return {
            registered: true,
            assetPubkey: typeof existing === 'object' && 'asset' in (existing as any)
              ? (existing as any).asset
              : config.developerWallet,
            alreadyExists: true,
            error: null,
          };
        }
      } catch {
        // Not registered yet
      }
    }

    // Build metadata
    const metadata = buildRegistrationFileJson(buildAgentMetadata(config));

    // Upload to IPFS if Pinata is configured
    let tokenUri = '';
    if (config.ipfsPinataJwt) {
      const ipfs = new IPFSClient({ pinataEnabled: true, pinataJwt: config.ipfsPinataJwt });
      const cid = await ipfs.addJson(metadata);
      tokenUri = `ipfs://${cid}`;
      console.log('[registry] Metadata uploaded to IPFS: %s', tokenUri);
    } else {
      // Store metadata as a data URI (no IPFS needed)
      const encoded = Buffer.from(JSON.stringify(metadata)).toString('base64');
      tokenUri = `data:application/json;base64,${encoded}`;
      console.log('[registry] Using inline metadata (no IPFS configured)');
    }

    // Register on-chain
    console.log('[registry] Registering agent on 8004 registry (%s)...', config.registryCluster);
    const result = await sdk.registerAgent(tokenUri, { atomEnabled: true });

    // Extract asset pubkey — SDK may return different shapes
    let assetStr: string;
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      if (r.asset && typeof (r.asset as any).toBase58 === 'function') {
        assetStr = (r.asset as PublicKey).toBase58();
      } else if (typeof r.asset === 'string') {
        assetStr = r.asset;
      } else if (typeof r.signature === 'string') {
        // Registration succeeded but asset key not returned directly
        assetStr = signer.publicKey.toBase58();
      } else {
        assetStr = JSON.stringify(r);
      }
    } else {
      assetStr = String(result);
    }

    console.log('[registry] Agent registered!');
    console.log('[registry]   Asset: %s', assetStr);
    if ((result as any)?.signature) {
      console.log('[registry]   Signature: %s', (result as any).signature);
    }

    // Set agent wallet if different from signer
    if (config.developerWallet && config.developerWallet !== signer.publicKey.toBase58()) {
      try {
        const walletPubkey = new PublicKey(config.developerWallet);
        const assetPubkey = new PublicKey(assetStr);
        await sdk.setAgentWallet(assetPubkey, walletPubkey);
        console.log('[registry] Agent wallet set to %s', config.developerWallet);
      } catch (err) {
        console.warn('[registry] Failed to set agent wallet:', err);
      }
    }

    return {
      registered: true,
      assetPubkey: assetStr,
      alreadyExists: false,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[registry] 8004 registration failed:', message);
    return { registered: false, assetPubkey: null, alreadyExists: false, error: message };
  }
}

/**
 * Verify agent token on Pump.fun.
 */
async function verifyPumpfun(config: ReturnType<typeof loadConfig>): Promise<boolean> {
  if (!config.agentTokenMint || !config.pumpfunRegistration) {
    console.log('[registry] Pump.fun verification skipped (no mint or disabled)');
    return false;
  }

  try {
    const connection = new Connection(config.solanaRpcUrl);

    // Verify the token mint exists on-chain
    const mintPubkey = new PublicKey(config.agentTokenMint);
    const mintInfo = await connection.getAccountInfo(mintPubkey);

    if (!mintInfo) {
      console.warn('[registry] Pump.fun token mint not found on-chain: %s', config.agentTokenMint);
      return false;
    }

    console.log('[registry] Pump.fun token verified on-chain: %s', config.agentTokenMint);
    console.log('[registry]   Account size: %d bytes', mintInfo.data.length);
    console.log('[registry]   Owner: %s', mintInfo.owner.toBase58());

    return true;
  } catch (err) {
    console.error('[registry] Pump.fun verification failed:', err);
    return false;
  }
}

/**
 * Main registration flow — called at deploy time.
 */
export async function registerAgent(): Promise<RegistrationResult> {
  const config = loadConfig();

  console.log('[registry] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[registry] NemoClaw Agent Registration');
  console.log('[registry]   Agent: %s v%s', config.agentName, config.agentVersion);
  console.log('[registry]   Wallet: %s', config.developerWallet || 'not set');
  console.log('[registry]   Mint: %s', config.agentTokenMint || 'not set');
  console.log('[registry]   Cluster: %s', config.registryCluster);
  console.log('[registry] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Step 1: Register with 8004
  const result8004 = await register8004(config);

  // Step 2: Verify on Pump.fun
  const pumpfunVerified = await verifyPumpfun(config);

  const result: RegistrationResult = {
    registered: result8004.registered,
    assetPubkey: result8004.assetPubkey,
    alreadyExists: result8004.alreadyExists,
    pumpfunVerified,
    error: result8004.error,
  };

  console.log('[registry] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[registry] Result:');
  console.log('[registry]   8004 Registry: %s', result.registered ? (result.alreadyExists ? 'already registered' : 'registered') : 'failed');
  if (result.assetPubkey) {
    console.log('[registry]   Asset: %s', result.assetPubkey);
  }
  console.log('[registry]   Pump.fun: %s', pumpfunVerified ? 'verified' : 'not verified');
  console.log('[registry] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return result;
}

// CLI entry point
if (process.argv[1]?.endsWith('register.ts') || process.argv[1]?.endsWith('register.js')) {
  registerAgent()
    .then((r) => process.exit(r.registered ? 0 : 1))
    .catch((err) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
}
