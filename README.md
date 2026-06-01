# 🌐 NFT Multichain Wallet Visualizer

Šis projekts ir veiksmīgi pārnests no Vercel uz **Cloudflare Pages** un pilnībā pielāgots modernajai **Vite** moduļu sistēmai zibensātrai darbībai.

Dynamic Wallet Visualizer ir Web3 priekšgala (frontend) aplikācija, kas pārvērš lietotāja kriptovalūtu maciņa datus (ETH bilanci, žetonu skaitu un transakciju vēsturi) unikālā, interaktīvā un dzīvā mākslas vizualizācijā. Aplikācija piedāvā iespēju šo vizualizāciju ierakstīt HD video formātā un nomintot kā dinamisku NFT **Base Sepolia** testa tīklā.

---

## ☁️ Cloudflare Pages Būvēšanas Iestatījumi

Pārliecinieties, ka jūsu Cloudflare Pages projekta būvēšanas iestatījumi (Build settings) ir konfigurēti precīzi šādi, lai Vite varētu pareizi optimizēt moduļus:

* **Framework preset:** `None`
* **Build command:** `npm run build`
* **Build output directory:** `dist`
* **Root directory:** `/` (projekta sakne)

Katru reizi, kad veiksiet izmaiņas šeit, GitHub, Cloudflare fonā automātiski pārbūvēs un atjauninās dzīvo mājaslapu.

---
Environment Variables:

ALCHEMY_API_KEY

ALCHEMY_RPC_URL

CONTRACT_ADDRESS
	
JWT_SECRET
	
PINATA_GATEWAY
	
PINATA_JWT
	
SERVER_PRIVATE_KEY

UPSTASH_REDIS_REST_URL

UPSTASH_REDIS_REST_TOKEN


## ⚙️ Atkarību Atjaunināšana (GitHub Actions)

Tā kā projekta izstrāde un labojumi tiek veikti pa tiešo GitHub vidē (bez lokālas vides uzstādīšanas), repozitorijā ir nepieciešams izveidot automatizētu rīku atkarību un slēdzeņu faila (`package-lock.json`) sakārtošanai.

### 1. Workflow faila izveide
Izveidojiet failu ceļā `.github/workflows/update-lock.yml` ar šādu saturu:

```yaml
name: Update package-lock.json

on:
  workflow_dispatch:   # ļauj manuāli palaist no GitHub Actions paneļa

permissions:
  contents: write

jobs:
  update-lock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install
      - name: Commit & Push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add package-lock.json
          git commit -m "Update package-lock.json with safe ws" || echo "No changes to commit"
          git push

