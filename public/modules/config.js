// ============================================ //
// CONFIGURATION
// ============================================ //

import { getRpcUrl } from './chains.js';

export const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

export const CONTRACT_ABI = [
  "function mintPrice() view returns (uint256)"
];

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const hasLowMemory = typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4;
const hasFewCores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency < 2;

export const VIZ_LOW_POWER_MODE = isMobile && (hasLowMemory || hasFewCores);
export const LOW_POWER_MODE = VIZ_LOW_POWER_MODE;

const PARTICLE_CONFIG = VIZ_LOW_POWER_MODE
  ? {
      MAX_PARTICLES: 100,
      CONNECTION_DISTANCE: 80
    }
  : {
      MAX_PARTICLES: 250,
      CONNECTION_DISTANCE: 100
    };

export const MAX_PARTICLES = PARTICLE_CONFIG.MAX_PARTICLES;
export const CONNECTION_DISTANCE = PARTICLE_CONFIG.CONNECTION_DISTANCE;

let _mintProvider = null;
let _providerPromise = null;

export async function getMintProvider() {
  try {
    if (_mintProvider) {
      await _mintProvider.getBlockNumber();
      return _mintProvider;
    }
  } catch {
    console.warn('Mint provider dead, recreating...');
    _mintProvider = null;
    _providerPromise = null;
  }

  if (_providerPromise) {
    return _providerPromise;
  }

  _providerPromise = (async () => {
    try {
      const provider = new ethers.JsonRpcProvider(
        getRpcUrl('baseSepolia')
      );
      
      await provider.getBlockNumber();
      
      _mintProvider = provider;
      
      return provider;
    } finally {
      _providerPromise = null;
    }
  })();

  return _providerPromise;
}
