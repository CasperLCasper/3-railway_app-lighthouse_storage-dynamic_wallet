// ============================================ //
// CHAIN CONFIGURATIONS
// ============================================ //

// 🔥 Deep freeze helper - prevents mutation of nested objects (ar circular ref protection)
function deepFreeze(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) {
    return obj;
  }
  
  seen.add(obj);
  Object.freeze(obj);
  
  Object.values(obj).forEach(value => {
    deepFreeze(value, seen);
  });
  
  return obj;
}

const baseSepoliaConfig = {
  name: 'Base Sepolia',
  chainId: 84532,
  chainIdHex: '0x14a34',
  rpc: [
    'https://sepolia.base.org',
    'https://base-sepolia-rpc.publicnode.com'
  ],
  nativeCurrency: 'ETH',
  blockExplorer: 'https://sepolia.basescan.org',
  alchemyNetwork: 'base-sepolia'
};

export const VIZ_CHAINS = {
  sepolia: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    rpc: [
      'https://sepolia.drpc.org',
      'https://ethereum-sepolia-rpc.publicnode.com'
    ],
    nativeCurrency: 'ETH',
    blockExplorer: 'https://sepolia.etherscan.io',
    alchemyNetwork: 'eth-sepolia'
  },
  mumbai: {
    name: 'Polygon Mumbai',
    chainId: 80001,
    chainIdHex: '0x13881',
    rpc: [
      'https://rpc-mumbai.maticvigil.com',
      'https://polygon-mumbai-bor-rpc.publicnode.com'
    ],
    nativeCurrency: 'MATIC',
    blockExplorer: 'https://mumbai.polygonscan.com',
    alchemyNetwork: 'polygon-mumbai'
  },
  bscTestnet: {
    name: 'BNB Chain Testnet',
    chainId: 97,
    chainIdHex: '0x61',
    rpc: [
      'https://data-seed-prebsc-1-s1.binance.org:8545',
      'https://bsc-testnet-rpc.publicnode.com'
    ],
    nativeCurrency: 'tBNB',
    blockExplorer: 'https://testnet.bscscan.com'
  },
  arbitrumSepolia: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    chainIdHex: '0x66eee',
    rpc: [
      'https://sepolia-rollup.arbitrum.io/rpc',
      'https://arbitrum-sepolia-rpc.publicnode.com'
    ],
    nativeCurrency: 'ETH',
    blockExplorer: 'https://sepolia.arbiscan.io',
    alchemyNetwork: 'arb-sepolia'
  },
  optimismSepolia: {
    name: 'Optimism Sepolia',
    chainId: 11155420,
    chainIdHex: '0xaa37dc',
    rpc: [
      'https://sepolia.optimism.io',
      'https://optimism-sepolia-rpc.publicnode.com'
    ],
    nativeCurrency: 'ETH',
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
    alchemyNetwork: 'opt-sepolia'
  },
  baseSepolia: baseSepoliaConfig,
  avalancheFuji: {
    name: 'Avalanche Fuji',
    chainId: 43113,
    chainIdHex: '0xa869',
    rpc: [
      'https://api.avax-test.network/ext/bc/C/rpc',
      'https://avalanche-fuji-rpc.publicnode.com'
    ],
    nativeCurrency: 'AVAX',
    blockExplorer: 'https://testnet.snowtrace.io',
    alchemyNetwork: 'avalanche-fuji'
  }
};

// 🔥 MINT_CHAIN izmanto to pašu config (nav duplikācijas)
export const MINT_CHAIN = VIZ_CHAINS.baseSepolia;

// 🔥 Deep freeze for production safety - prevents mutation of nested objects
deepFreeze(VIZ_CHAINS);
deepFreeze(MINT_CHAIN);

// Helper function to get RPC URL (returns first available)
export function getRpcUrl(chainKey) {
  const chain = VIZ_CHAINS[chainKey];
  if (!chain) return null;
  return Array.isArray(chain.rpc) ? chain.rpc[0] : chain.rpc;
}

// 🔥 Helper function to get all RPC URLs - returns immutable copy
export function getAllRpcUrls(chainKey) {
  const chain = VIZ_CHAINS[chainKey];
  if (!chain) return [];
  return Array.isArray(chain.rpc) ? [...chain.rpc] : [chain.rpc];
}

// 🔥 Helper to get chain config by hex chainId - returns immutable copy with new rpc array
export function getChainByHexId(hexId) {
  for (const [key, chain] of Object.entries(VIZ_CHAINS)) {
    if (chain.chainIdHex === hexId) {
      // 🔥 Return a COPY with a NEW rpc array (prevents mutation)
      return {
        key,
        ...chain,
        rpc: [...chain.rpc]
      };
    }
  }
  return null;
}

// 🔥 Helper to get chain config by numeric chainId - returns immutable copy with new rpc array
export function getChainById(chainId) {
  for (const [key, chain] of Object.entries(VIZ_CHAINS)) {
    if (chain.chainId === chainId) {
      // 🔥 Return a COPY with a NEW rpc array (prevents mutation)
      return {
        key,
        ...chain,
        rpc: [...chain.rpc]
      };
    }
  }
  return null;
}
