import { ethers } from "ethers";
import { getOptionalUser } from "../_lib/auth.js";
import { getCache, setCache } from "../_lib/cache.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

// Chain konfigurācija paliek nemainīga
const getChainConfig = (chain) => {
  const configs = {
    sepolia: { type: 'alchemy', network: 'eth-sepolia' },
    mumbai: { type: 'alchemy', network: 'polygon-mumbai' },
    bscTestnet: { type: 'bscscan', network: 'bsc-testnet' },
    arbitrumSepolia: { type: 'alchemy', network: 'arb-sepolia' },
    optimismSepolia: { type: 'alchemy', network: 'opt-sepolia' },
    baseSepolia: { type: 'alchemy', network: 'base-sepolia' },
    avalancheFuji: { type: 'alchemy', network: 'avalanche-fuji' }
  };
  return configs[chain] || configs.sepolia;
};

const getAlchemyNFTUrl = ({ apiKey, network, owner, contract, pageKey }) => {
  let url = `https://${network}.g.alchemy.com/nft/v2/${apiKey}/getNFTs?owner=${owner}`;
  if (contract) url += `&contractAddresses[]=${contract}`;
  if (pageKey) url += `&pageKey=${pageKey}`;
  return url;
};

const getBSCScanNFTs = async (owner, apiKey) => {
  const url = `https://api-testnet.bscscan.com/api?module=account&action=tokennfttx&address=${owner}&sort=desc&apikey=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== '1' || !data.result) return [];
  
  const uniqueNFTs = new Map();
  data.result.forEach(tx => {
    const key = `${tx.contractAddress}_${tx.tokenID}`;
    if (!uniqueNFTs.has(key)) {
      uniqueNFTs.set(key, {
        contract: { address: tx.contractAddress, symbol: tx.tokenSymbol || 'NFT' },
        id: { tokenId: tx.tokenID },
        balance: 1
      });
    }
  });
  
  return Array.from(uniqueNFTs.values());
};

const MAX_PAGES = 5;

// Izmantojam onRequestGet, lai apstrādātu tikai GET pieprasījumus
export async function onRequestGet(context) {
  let chain = 'sepolia'; 

  try {
    const { request, env } = context;
    
    const url = new URL(request.url);
    const accountParam = url.searchParams.get("account");
    const contract = url.searchParams.get("contract");
    chain = url.searchParams.get("chain") || 'sepolia';

    const user = await getOptionalUser(request, env);
    let account = accountParam || (user ? user.address : null); 

    if (!account) {
      return new Response(JSON.stringify({ error: "Missing account. Please provide it in query or log in." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let safeAccount;
    try {
      safeAccount = ethers.getAddress(account);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid Ethereum address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let safeContract = null;
    if (contract) {
      try {
        safeContract = ethers.getAddress(contract);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid contract address" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Rate limiting ar await - tagad strādā arī ar Redis!
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateKey = user ? `user_${user.address}_nfts_${chain}` : `ip_${ip}_nfts_${chain}`;

    if (!(await checkRateLimit({ key: rateKey }, env))) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Cache pārbaude
    const cacheKey = safeContract
      ? `nfts_${safeAccount}_${safeContract}_${chain}`
      : `nfts_${safeAccount}_${chain}`;

    // ✅ Asinhronais getCache ar await
    const cached = await getCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const API_KEY = env.ALCHEMY_API_KEY;
    const BSCSCAN_API_KEY = env.BSCSCAN_API_KEY;
    
    const chainConfig = getChainConfig(chain);
    let allNFTs = [];

    if (chainConfig.type === 'bscscan') {
      allNFTs = await getBSCScanNFTs(safeAccount, BSCSCAN_API_KEY);
    } else {
      let pageKey = null;
      for (let i = 0; i < MAX_PAGES; i++) {
        const alchemyUrl = getAlchemyNFTUrl({
          apiKey: API_KEY,
          network: chainConfig.network,
          owner: safeAccount,
          contract: safeContract,
          pageKey
        });

        const response = await fetch(alchemyUrl);
        if (!response.ok) break;
        
        const data = await response.json();
        const nfts = data?.ownedNfts || [];
        allNFTs.push(...nfts);
        
        if (!data?.pageKey) break;
        pageKey = data.pageKey;
      }
    }

    const formatted = allNFTs.map(nft => ({
      contract: {
        address: nft.contract?.address || "",
        symbol: nft.contract?.symbol || "NFT"
      },
      id: {
        tokenId: nft.id?.tokenId || ""
      },
      balance: 1,
      chain: chain
    }));

    const result = { result: { nfts: formatted }, chain: chain };
    
    // ✅ Asinhronais setCache ar await
    await setCache(cacheKey, result, env);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("NFT ERROR for chain:", chain, err);
    return new Response(JSON.stringify({
      error: "Failed to fetch NFTs",
      result: { nfts: [] }
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
