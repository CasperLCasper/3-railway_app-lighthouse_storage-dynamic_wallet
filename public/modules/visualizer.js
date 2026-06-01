// ============================================ //
// VISUALIZER FUNCTIONS
// ============================================ //

import { UI } from './state.js';
import { showToast, showProgress, setProgress, hideProgress, setButtonLoading, updateTokenListUI } from './ui.js';
import { MAX_PARTICLES, CONNECTION_DISTANCE, VIZ_LOW_POWER_MODE } from './config.js';
import { getTokens, getAllNFTs } from './api.js';

export function getCanvasDimensions() {
  const isMobile = VIZ_LOW_POWER_MODE;
  let width = isMobile ? 1080 : 1920;
  let height = isMobile ? 720 : 1080;
  return { width, height, isMobile };
}

export function resizeCanvas(app) {
  const { width, height } = getCanvasDimensions();
  if (UI.canvas.width === width && UI.canvas.height === height) return;
  
  UI.canvas.width = width;
  UI.canvas.height = height;
  UI.canvas.style.width = '100%';
  UI.canvas.style.height = 'auto';
  app.canvasWidth = width;
  app.canvasHeight = height;
  app.ctx = UI.canvas.getContext('2d');
  app.particleCache.clear();
}

export function cleanup(app) {
  if (app.animFrameId) {
    cancelAnimationFrame(app.animFrameId);
    app.animFrameId = null;
  }
  app.isAnimationActive = false;
  app.particles = [];
  app.initialParticles = [];
  app.nftCenters = [];
  app.particleCache.clear();
  if (app.ctx) {
    app.ctx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);
  }
}

export function hashStringToInt(str, mod = 1000) { 
  let h = 2166136261 >>> 0; 
  for (let i = 0; i < str.length; i++) {
    // Izmantojam codePointAt, lai pareizi apstrādātu pilnus Unicode simbolus
    h ^= str.codePointAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  } 
  return h % mod; 
}

export function seededRandomFloat(seedStr) { 
  return hashStringToInt(seedStr, 10000) / 10000; 
}

export function createParticleCache(app, particle) {
  const cacheKey = `${particle.hue}_${particle.r}_${particle.balanceFactor}`;
  
  if (app.particleCache.has(cacheKey)) {
    return app.particleCache.get(cacheKey);
  }
  
  const size = Math.ceil(particle.r * 5);
  const cacheCanvas = document.createElement('canvas');
  cacheCanvas.width = size;
  cacheCanvas.height = size;
  const cctx = cacheCanvas.getContext('2d');
  
  const cx = size / 2;
  const cy = size / 2;
  const gradient = cctx.createRadialGradient(cx, cy, 0, cx, cy, particle.r * 2.2);
  gradient.addColorStop(0, `hsla(${particle.hue}, 100%, 82%, 1)`);
  gradient.addColorStop(0.6, `hsla(${particle.hue}, 100%, 70%, 0.9)`);
  gradient.addColorStop(1, `hsla(${particle.hue + 20}, 100%, 55%, 0.4)`);
  
  cctx.fillStyle = gradient;
  cctx.beginPath();
  cctx.arc(cx, cy, particle.r, 0, Math.PI * 2);
  cctx.fill();
  
  const cached = { canvas: cacheCanvas, size, offset: size / 2 };
  app.particleCache.set(cacheKey, cached);
  return cached;
}

export function updateNFTCenters(app) {
  app.nftCenters = [];
  const nftTokens = app.tokens.filter(t => t.isNFT);
  const W = app.canvasWidth || UI.canvas.width;
  const H = app.canvasHeight || UI.canvas.height;
  const cx0 = W / 2, cy0 = H / 2;
  
  nftTokens.forEach((nft, idx) => {
    const angle = seededRandomFloat(nft.address + 'position') * Math.PI * 2;
    const radius = 80 + seededRandomFloat(nft.address + 'radius') * 150;
    app.nftCenters.push({
      x: cx0 + Math.cos(angle) * radius,
      y: cy0 + Math.sin(angle) * radius,
      radius: 15,
      influence: 0.02,
      token: nft
    });
  });
}

export function drawFrame(app, frame, showTokensFrame) {
  const addon = window.ADDON_STYLES[app.currentAddonStyle];
  const W = app.canvasWidth || UI.canvas.width;
  const H = app.canvasHeight || UI.canvas.height;
  const ctx = app.ctx || UI.canvas.getContext('2d');
  
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  
  const cx0 = W / 2, cy0 = H / 2;
  const txSpeedFactor = Math.min(1 + Math.log(app.txCount + 1) / 15, 2.0);
  
  for (const p of app.particles) {
    let gravityDelta = { x: 0, y: 0 };
    for (const nft of app.nftCenters) {
      const dx = nft.x - (p.x || 0);
      const dy = nft.y - (p.y || 0);
      const distSq = dx * dx + dy * dy;
      if (distSq > 0 && distSq < 62500) {
        const force = nft.influence * (1 - Math.sqrt(distSq) / 250) * txSpeedFactor;
        gravityDelta.x += dx * force;
        gravityDelta.y += dy * force;
      }
    }
    
    p.angleVelocity = (p.angleVelocity || p.speed) + (gravityDelta.x + gravityDelta.y) * 0.0005;
    p.angleVelocity = Math.min(Math.max(p.angleVelocity, 0.001), 0.025);
    p.angle += p.angleVelocity * txSpeedFactor;
    
    p.x = cx0 + Math.cos(p.angle) * p.radius;
    p.y = cy0 + Math.sin(p.angle) * p.radius;
  }
  
  const thresholdSq = CONNECTION_DISTANCE * CONNECTION_DISTANCE;
  const lineGroups = new Map();
  
  for (let i = 0; i < app.particles.length; i++) {
    const p1 = app.particles[i];
    for (let j = i + 1; j < app.particles.length; j++) {
      const p2 = app.particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < thresholdSq) {
        const avgBalance = (Math.min(p1.token.balance, 20) + Math.min(p2.token.balance, 20)) / 40;
        let hue = (p1.hue + p2.hue) / 2 + frame * 0.3;
        const modified = addon.connectionColorModifier(hue, 100, 70, 0.5, app.frameCount);
        const colorKey = `${Math.floor(modified.hue / 30)}_${modified.sat}_${modified.light}`;
        
        if (!lineGroups.has(colorKey)) {
          lineGroups.set(colorKey, { paths: [], color: `hsla(${modified.hue}, ${modified.sat}%, ${modified.light}%, ${modified.alpha})`, lineWidth: 1.2 + 1.8 * avgBalance });
        }
        lineGroups.get(colorKey).paths.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
    }
  }
  
  for (const group of lineGroups.values()) {
    ctx.beginPath();
    ctx.lineWidth = group.lineWidth;
    ctx.strokeStyle = group.color;
    for (const path of group.paths) {
      ctx.moveTo(path.x1, path.y1);
      ctx.lineTo(path.x2, path.y2);
    }
    ctx.stroke();
  }
  
  const useCachedGradient = addon.particleColorModifier === null || addon.particleColorModifier === undefined;
  
  for (let idx = 0; idx < app.particles.length; idx++) {
    const p = app.particles[idx];
    
    if (useCachedGradient) {
      let cached = p.cachedGradient;
      if (!cached) {
        cached = createParticleCache(app, p);
        p.cachedGradient = cached;
      }
      ctx.drawImage(cached.canvas, p.x - cached.offset, p.y - cached.offset);
    } else {
      const modified = addon.particleColorModifier(p.hue, 100, 70, idx, p.balanceFactor, app.frameCount);
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
      gradient.addColorStop(0, `hsla(${modified.hue}, ${modified.sat}%, ${modified.light + 12}%, 1)`);
      gradient.addColorStop(0.6, `hsla(${modified.hue}, ${modified.sat}%, ${modified.light}%, 0.9)`);
      gradient.addColorStop(1, `hsla(${modified.hue + 20}, ${modified.sat}%, ${modified.light - 15}%, 0.4)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  for (const nft of app.nftCenters) {
    ctx.beginPath();
    ctx.arc(nft.x, nft.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 0, 0.3)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(nft.x, nft.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 215, 0, 0.8)`;
    ctx.fill();
  }
  
  if (!VIZ_LOW_POWER_MODE || frame % 2 === 0) {
    addon.drawExtraEffects(ctx, W, H, frame, app.particles, cx0, cy0);
  }
  
  if (showTokensFrame && app.showInfo) {
    ctx.fillStyle = '#0ff';
    ctx.font = '20px Inter';
    ctx.fillText(`ETH: ${app.ethBalance.toFixed(4)}`, 15, 70);
    ctx.font = '14px Inter';
    ctx.fillStyle = addon.color;
    ctx.fillText(`${addon.displayName} ACTIVE`, 15, 100);
    ctx.font = '11px Inter';
    ctx.fillStyle = '#888';
    const tokenCount = app.tokens.filter(t => !t.isNFT).length;
    ctx.fillText(`TX: ${app.txCount} | Assets: ${app.tokens.length} (${tokenCount} tokens, ${app.nftCenters.length} NFTs)`, 15, 125);
  }
}

export function animate(app, frame = 0) { 
  drawFrame(app, frame, true); 
  app.animFrameId = requestAnimationFrame(() => animate(app, frame + 1)); 
}

export function stopAnimation(app) { 
  if (app.animFrameId) cancelAnimationFrame(app.animFrameId); 
  app.animFrameId = null; 
}

export async function initParticlesOnce(app) {
  app.initialParticles = [];
  const particleCount = Math.min(MAX_PARTICLES, 40 + (app.tokens.filter(t => !t.isNFT).length || 0) * 8);
  const seedBase = (app.account || '') + String(app.ethBalance) + String(app.txCount);
  
  updateNFTCenters(app);
  
  for (let i = 0; i < particleCount; i++) {
    const tokenIndex = i % (app.tokens.length || 1);
    const t = app.tokens.length ? app.tokens[tokenIndex] : { balance: 1, address: String(i), symbol: 'T', isNFT: false };
    const balanceFactor = t.isNFT ? 1 : Math.min(t.balance || 0, 20) / 20;
    
    let hue = hashStringToInt((t.address || '') + seedBase + i) % 360;
    const ethFactor = Math.min(app.ethBalance / 10, 1);
    hue = (hue + ethFactor * 100) % 360;
    
    const txSpeedFactor = Math.min(1 + Math.log(app.txCount + 1) / 15, 2.0);
    const speedBase = 0.0015 + 0.004 * (hashStringToInt((t.symbol || t.address) + seedBase + i, 10) / 10);
    const speed = speedBase * txSpeedFactor;
    
    const r = t.isNFT ? 12 : 2 + 5 * balanceFactor;
    const angle = seededRandomFloat(seedBase + i + 'angle') * 2 * Math.PI;
    const radius = 60 + seededRandomFloat(seedBase + i + 'radius') * 380;
    
    app.initialParticles.push({ 
      angle, radius, r, hue, speed, 
      angleVelocity: speed,
      token: t, balanceFactor,
      x: 0, y: 0
    });
  }
}

export function cloneParticles(app) { 
  return app.initialParticles.map(p => ({ ...p, x: 0, y: 0 })); 
}

export async function renderSnapshot(app, chain) {
  if (!app.account) return;

  setButtonLoading(UI.renderBtn, true);
  stopAnimation(app);
  cleanup(app);
  showProgress();
  app.particleCache.clear();
  showToast(`Loading ${chain} wallet data...`, 'info');

  app.tokens = [];
  app.ethBalance = 0;
  app.txCount = 0;

  const steps = [
    { name: 'ETH balance...', func: async () => { app.ethBalance = Number(ethers.formatEther(await app.provider.getBalance(app.account))) || 0; }},
    { name: 'Transaction count...', func: async () => { app.txCount = Number(await app.provider.getTransactionCount(app.account)) || 0; }},
    { name: 'ERC-20 tokens...', func: async () => { app.tokens = await getTokens(app.account, chain); }},
    { name: 'NFTs...', func: async () => { 
        const nfts = await getAllNFTs(app.account, chain);
        app.tokens = [...app.tokens, ...nfts];
        updateNFTCenters(app);
    }},
    { name: 'Creating visualization...', func: async () => { await initParticlesOnce(app); app.particles = cloneParticles(app); }}
  ];

  let currentStep = 0, totalSteps = steps.length;
  let visualProgress = 0, running = true;

  const animateProgress = () => {
    if (!running) return;
    const targetProgress = currentStep / totalSteps;
    visualProgress += (targetProgress - visualProgress) * 0.05;
    UI.progressBar.style.transform = `scaleX(${visualProgress})`;
    requestAnimationFrame(animateProgress);
  };
  requestAnimationFrame(animateProgress);

  try {
    for (const step of steps) {
      showToast(step.name, 'info');
      await step.func();
      currentStep++;
    }
    
    if (app.showInfo && UI.tokenListContainer) { 
      UI.tokenListContainer.style.display = 'block'; 
      updateTokenListUI(app.tokens); 
    }
    
    running = false;
    UI.progressBar.style.transform = 'scaleX(1)';
    showToast(`Ready! ${app.tokens.length} assets found on ${chain} (${app.nftCenters.length} NFTs)`, 'success');
    hideProgress();
    animate(app);
  } catch (e) {
    running = false;
    hideProgress();
    console.error(e);
    showToast('Render failed: ' + e.message, 'error');
  } finally { setButtonLoading(UI.renderBtn, false); }
}
