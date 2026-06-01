export function getAlchemyNFTUrl({ apiKey, network, owner, contract, pageKey }) {
  if (!network) {
    console.error('Network is required for Alchemy URL');
    return '';
  }
  
  let url = `https://${network}.g.alchemy.com/nft/v2/${apiKey}/getNFTsForOwner`;
  url += `?owner=${owner}&withMetadata=true`;

  if (contract) {
    url += `&contractAddresses[]=${contract}`;
  }

  if (pageKey) {
    url += `&pageKey=${pageKey}`;
  }

  return url;
}
