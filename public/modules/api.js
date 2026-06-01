// ============================================ //
// API FUNCTIONS (with JWT nonce support)
// ============================================ //

import { CONTRACT_ABI, getMintProvider } from './config.js';
import { MINT_CHAIN } from './chains.js';

// Konfigurācija
const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 1000;

// 🔥 Safe JSON parsing
async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }
}

// 🔥 Safe error body reading
async function safeErrorText(response) {
  try {
    const reader = response.body?.getReader();
    if (!reader) return '';
    
    const { value } = await reader.read();
    if (!value) return '';
    
    return new TextDecoder().decode(value).substring(0, 200);
  } catch {
    return '';
  }
}

// Helper funkcija fetch ar timeout un retry
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS, retries = RETRY_COUNT) {
  const method = (options.method || 'GET').toUpperCase();
  const canRetry = method === 'GET';
  
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      if (response.status >= 500 && canRetry && attempt < retries) {
        console.warn(`Request failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      
      const isRetryable = 
        error.name === 'AbortError' ||
        error instanceof TypeError;
      
      if (isRetryable && canRetry && attempt < retries) {
        console.warn(`Connection issue, retrying...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      
      if (error.name === 'AbortError') {
        throw new Error('Request took too long. Please check your connection.');
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Unable to complete request. Please try again.');
}

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("auth_token");
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetchWithTimeout(url, { 
    ...options, 
    headers 
  });
  
  if (response.status === 401) {
    console.warn("Session expired");
    localStorage.removeItem("auth_token");
    
    window.dispatchEvent(new CustomEvent("auth:expired", { 
      detail: { message: "Your session has expired. Please reconnect your wallet." }
    }));
    
    throw new Error("SESSION_EXPIRED");
  }
  
  if (!response.ok) {
    const errorText = await safeErrorText(response);
    
    if (response.status === 404) {
      throw new Error(`Service not available (404): ${errorText}`);
    } else if (response.status === 429) {
      throw new Error(`Too many requests (429): ${errorText}`);
    } else if (response.status >= 500) {
      throw new Error(`Server error (${response.status}): ${errorText}`);
    }
    
    throw new Error(`Request failed (${response.status}): ${errorText}`);
  }
  
  return response;
}

// ============================================ //
// NONCE HANDLING (JWT nonce, bez papildu galvenēm)
// ============================================ //

/**
 * Iegūst nonce (tagad JWT) no servera pirms pieteikšanās.
 * Vairs neizmanto X-Session-ID – serveris atgriež pašpietiekamu JWT.
 */
async function getNonce() {
  const res = await fetch('/api/auth/nonce');
  if (!res.ok) {
    const text = await safeErrorText(res);
    throw new Error(`Failed to get nonce: ${text}`);
  }
  const data = await safeJson(res);
  return data.nonce; // tas ir JWT
}

// ============================================ //
// AUTH FUNCTIONS
// ============================================ //

export async function login(signer, account) {
  if (!signer) return false;
  
  try {
    // 1. Iegūstam nonce JWT no servera
    const nonceToken = await getNonce();
    
    // 2. Veidojam ziņojumu, kas sākas ar šo JWT
    const message = `${nonceToken} - Login to NFT Wallet Visualizer`;
    
    // 3. Parakstām ziņojumu ar maku
    const signature = await signer.signMessage(message);
    
    // 4. Nosūtām uz serveri (vairs nav X-Session-ID galvenes)
    const res = await fetchWithTimeout('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: account, message, signature })
    });
    
    if (!res.ok) {
      const errorText = await safeErrorText(res);
      throw new Error(`Login failed: ${errorText}`);
    }
    
    const data = await safeJson(res);
    
    if (data.token) {
      localStorage.setItem("auth_token", data.token);
      console.log("✅ Login successful");
      return true;
    }
    return false;
  } catch (error) {
    console.error("Login error:", error);
    return false;
  }
}

export async function getContractAddress() {
  try {
    const res = await fetchWithTimeout('/api/getContractAddress');
    
    if (!res.ok) {
      throw new Error(`Failed to get contract address`);
    }
    
    const data = await safeJson(res);
    if (!data.address) throw new Error('Contract address not found');
    return data.address;
  } catch (error) {
    console.error("Failed to get contract address:", error);
    return null;
  }
}

export async function getNFTPrice() {
  try {
    const contractAddress = await getContractAddress();
    if (!contractAddress) return "Price unavailable";
    
    const provider = await getMintProvider();
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
    const priceWei = await contract.mintPrice();
    const priceEth = ethers.formatEther(priceWei);
    
    return `${priceEth} ETH + gas`;
  } catch (error) {
    console.error("Failed to get NFT price:", error);
    return "Price unavailable";
  }
}

export async function getTokens(account, chain) {
  if (!account) return [];
  try {
    const url = `/api/getTokens?account=${encodeURIComponent(account)}&chain=${chain}`;
    const res = await apiFetch(url);
    
    const data = await safeJson(res);
    
    if (!data?.tokens) return [];
    
    return data.tokens.map(t => {
      const decimals = t.decimals || 18;
      const rawBalance = t.balance || "0";
      
      let formattedBalance = 0;
      try {
        formattedBalance = Number(ethers.formatUnits(rawBalance, decimals));
        if (!Number.isFinite(formattedBalance)) {
          formattedBalance = 0;
        }
      } catch {
        formattedBalance = 0;
      }
      
      return {
        address: t.contract || t.contractAddress || "",
        balance: formattedBalance,
        symbol: t.symbol || 'TKN',
        isNFT: false
      };
    }).filter(t => t.balance > 0);
  } catch(e) { 
    console.error("GetTokens Error:", e); 
    return []; 
  }
}

export async function getAllNFTs(account, chain) {
  if (!account) return [];
  try {
    const allNFTs = [];
    let pageKey = null;
    const MAX_PAGES = 10;
    const seenPageKeys = new Set();
    
    for (let i = 0; i < MAX_PAGES; i++) {
      let url = `/api/getAllNFTs?account=${encodeURIComponent(account)}&chain=${chain}`;
      if (pageKey) {
        url += `&pageKey=${pageKey}`;
      }
      
      const res = await apiFetch(url);
      const data = await safeJson(res);
      
      let nfts = [];
      if (data?.result?.nfts) nfts = data.result.nfts;
      else if (data?.nfts) nfts = data.nfts;
      else if (Array.isArray(data)) nfts = data;
      
      if (!nfts || nfts.length === 0) break;
      
      allNFTs.push(...nfts);
      
      const newPageKey = data?.result?.pageKey || data?.pageKey;
      
      if (!newPageKey) break;
      
      if (seenPageKeys.has(newPageKey)) {
        console.warn('Duplicate page detected, stopping');
        break;
      }
      seenPageKeys.add(newPageKey);
      
      pageKey = newPageKey;
    }
    
    console.log(`✅ Loaded ${allNFTs.length} NFTs from ${chain}`);
    
    return allNFTs.map(nft => ({
      address: nft.contract?.address || nft.contractAddress || nft.address || '',
      symbol: nft.contract?.symbol || nft.symbol || 'NFT',
      balance: 1,
      isNFT: true,
      tokenId: nft.id?.tokenId || nft.tokenId || nft.id || ''
    }));
  } catch(e) { 
    console.error("GetAllNFTs Error:", e); 
    return []; 
  }
}
