import { ethers } from 'ethers';
import { requireAuth } from "../_lib/auth.js";
import { checkRateLimit } from "../_lib/rateLimit.js";
import { getCache, deleteCache } from "../_lib/cache.js";

const WALLET_NFT_ABI = [
  "function mintWithSignature(address wallet, string calldata metadataUri, uint256 nonceParam, bytes calldata signature) external payable",
  "function mintPrice() public view returns (uint256)",
  "function getNonce(address wallet) public view returns (uint256)"
];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const user = await requireAuth(request, env);
    if (user instanceof Response) return user;
    if (!user || !user.address) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" }
      });
    }

    const rateKey = `mint:${user.address.toLowerCase()}`;
    if (!(await checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 }, env))) {
      return new Response(JSON.stringify({ success: false, error: 'Too many requests' }), {
        status: 429, headers: { "Content-Type": "application/json" }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    const { wallet, metadataUri } = body;
    if (!wallet || !metadataUri || !ethers.isAddress(wallet)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid input' }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    if (user.address.toLowerCase() !== wallet.toLowerCase()) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized wallet' }), {
        status: 403, headers: { "Content-Type": "application/json" }
      });
    }

    // Notīrām CID no jebkādiem prefiksiem
    let cleanMetadataCID = metadataUri.trim();
    if (cleanMetadataCID.startsWith('ipfs://')) {
      cleanMetadataCID = cleanMetadataCID.substring(7);
    } else if (cleanMetadataCID.startsWith('https://')) {
      const parts = cleanMetadataCID.split('/');
      cleanMetadataCID = parts[parts.length - 1];
    }
    if (cleanMetadataCID.includes('/')) {
      cleanMetadataCID = cleanMetadataCID.split('/')[0];
    }

    const lastUploadKey = `lastUploadCID:${user.address.toLowerCase()}`;
    const lastCID = await getCache(lastUploadKey, env);

    if (!lastCID || lastCID !== cleanMetadataCID) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired metadata CID. Please re-upload metadata.'
      }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    await deleteCache(lastUploadKey, env);

    const CONTRACT_ADDRESS = env.CONTRACT_ADDRESS;
    const SERVER_PRIVATE_KEY = env.SERVER_PRIVATE_KEY;
    const ALCHEMY_RPC_URL = env.ALCHEMY_RPC_URL;

    if (!CONTRACT_ADDRESS || !SERVER_PRIVATE_KEY || !ALCHEMY_RPC_URL) {
      return new Response(JSON.stringify({ success: false, error: 'Server configuration incomplete' }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }

    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, WALLET_NFT_ABI, provider);
    
    let mintPrice;
    let currentNonce;
    try {
      mintPrice = await contract.mintPrice();
      currentNonce = await contract.getNonce(wallet); 
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: 'Cannot read contract state: ' + err.message }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    // 🌟 Šeit mēs izveidojam tiešo HTTPS saiti, ko saglabāt līgumā!
    const fullIpfsUri = `https://gateway.pinata.cloud/ipfs/${cleanMetadataCID}`;
    const serverWallet = new ethers.Wallet(SERVER_PRIVATE_KEY);

    const domain = {
      name: 'WalletVisualizer',
      version: '1',
      chainId: 84532, // Base Sepolia
      verifyingContract: CONTRACT_ADDRESS
    };

    const types = {
      MintRequest: [
        { name: 'wallet', type: 'address' },
        { name: 'metadataUri', type: 'string' },
        { name: 'nonce', type: 'uint256' }
      ]
    };

    const value = {
      wallet: wallet,
      metadataUri: fullIpfsUri,
      nonce: currentNonce
    };

    const signature = await serverWallet.signTypedData(domain, types, value);

    const iface = new ethers.Interface(WALLET_NFT_ABI);
    const data = iface.encodeFunctionData('mintWithSignature', [wallet, fullIpfsUri, currentNonce, signature]);

    let estimatedGas;
    try {
      estimatedGas = await provider.estimateGas({
        from: wallet,
        to: CONTRACT_ADDRESS,
        data: data,
        value: mintPrice
      });
      estimatedGas = (estimatedGas * 120n) / 100n;
    } catch (err) {
      estimatedGas = 180000n; 
    }

    return new Response(JSON.stringify({
      success: true,
      transaction: {
        to: CONTRACT_ADDRESS,
        data: data,
        value: mintPrice.toString(),
        gasLimit: estimatedGas.toString()
      }
    }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Server error: ' + error.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
}
