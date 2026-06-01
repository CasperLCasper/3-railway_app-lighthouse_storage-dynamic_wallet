// ============================================ //
// 🎨 THEMES
// ============================================ //

const ADDON_STYLES = {
  classic: { name: 'CLASSIC', displayName: '⭐ CLASSIC', color: '#0ff',
    particleColorModifier: null,
    drawExtraEffects: (ctx, W, H, frame, particles, cx0, cy0) => {},
    connectionColorModifier: (hue, sat, light, alpha, frameCount) => ({ hue, sat, light, alpha }),
    indicatorText: '⭐ CLASSIC MODE - Original visualization' },
  forest: { name: 'FOREST', displayName: '🌲 FOREST', color: '#0f0',
    particleColorModifier: (hue, sat, light, idx, balanceFactor, frameCount) => ({ hue: (hue + 120) % 360, sat: Math.min(100, sat + 20), light: light - 10 }),
    drawExtraEffects: (ctx, W, H, frame, particles, cx0, cy0) => { 
      if (window.LOW_POWER_MODE) return;
      ctx.save(); 
      ctx.globalCompositeOperation = 'lighter'; 
      particles.forEach(p => { 
        const cx = cx0 + Math.cos(p.angle) * p.radius; 
        const cy = cy0 + Math.sin(p.angle) * p.radius; 
        ctx.beginPath(); 
        ctx.arc(cx, cy, p.r * 1.8, 0, Math.PI * 2); 
        ctx.fillStyle = `rgba(0, 255, 0, 0.15)`; 
        ctx.fill(); 
      }); 
      ctx.restore(); 
    },
    connectionColorModifier: (hue, sat, light, alpha, frameCount) => ({ hue: (hue + 120) % 360, sat: Math.min(100, sat + 20), light: light - 10, alpha: alpha * 0.8 }),
    indicatorText: '🌲 FOREST MODE - Green glow effect active' },
  ocean: { name: 'OCEAN', displayName: '🌊 OCEAN', color: '#00f',
    particleColorModifier: (hue, sat, light, idx, balanceFactor, frameCount) => ({ hue: (hue + 200) % 360, sat: Math.min(100, sat + 15), light: light + 5 }),
    drawExtraEffects: (ctx, W, H, frame, particles, cx0, cy0) => { 
      if (window.LOW_POWER_MODE) return;
      ctx.save(); 
      ctx.globalAlpha = 0.25; 
      for(let i = 0; i < 3; i++) { 
        ctx.beginPath(); 
        ctx.arc(W/2 + Math.sin(frame * 0.02 + i) * 50, H/2 + Math.cos(frame * 0.015 + i) * 30, 100 + i * 30, 0, Math.PI * 2); 
        ctx.strokeStyle = `rgba(0, 100, 255, ${0.15 - i * 0.02})`; 
        ctx.stroke(); 
      } 
      ctx.restore(); 
    },
    connectionColorModifier: (hue, sat, light, alpha, frameCount) => ({ hue: (hue + 200) % 360, sat: Math.min(100, sat + 15), light: light + 5, alpha: alpha * 0.9 }),
    indicatorText: '🌊 OCEAN MODE - Wave animations active' },
  sunset: { name: 'SUNSET', displayName: '🌅 SUNSET', color: '#ff6600',
    particleColorModifier: (hue, sat, light, idx, balanceFactor, frameCount) => ({ hue: (hue + 30) % 360, sat: Math.min(100, sat + 25), light: light + 15 }),
    drawExtraEffects: (ctx, W, H, frame, particles, cx0, cy0) => { 
      ctx.save(); 
      const gradient = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 350); 
      gradient.addColorStop(0, 'rgba(255, 100, 0, 0.2)'); 
      gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.1)'); 
      gradient.addColorStop(1, 'rgba(255, 100, 0, 0)'); 
      ctx.fillStyle = gradient; 
      ctx.fillRect(0, 0, W, H); 
      ctx.restore(); 
    },
    connectionColorModifier: (hue, sat, light, alpha, frameCount) => ({ hue: (hue + 30) % 360, sat: Math.min(100, sat + 25), light: light + 15, alpha: alpha * 1.1 }),
    indicatorText: '🌅 SUNSET MODE - Warm fire glow active' },
  galaxy: { name: 'GALAXY', displayName: '✨ GALAXY', color: '#c026ff',
    particleColorModifier: (hue, sat, light, idx, balanceFactor, frameCount) => ({ hue: (hue + 280) % 360, sat: Math.min(100, sat + 30), light: light + 10 }),
    drawExtraEffects: (ctx, W, H, frame, particles, cx0, cy0) => { 
      if (window.LOW_POWER_MODE) return;
      ctx.save(); 
      for(let i = 0; i < 30; i++) { 
        const x = (Math.sin(frame * 0.01 + i) * 0.5 + 0.5) * W; 
        const y = (Math.cos(frame * 0.008 + i * 2) * 0.5 + 0.5) * H; 
        ctx.beginPath(); 
        ctx.arc(x, y, 1.5 + Math.sin(frame * 0.05 + i) * 0.8, 0, Math.PI * 2); 
        ctx.fillStyle = `rgba(200, 100, 255, ${0.3 + Math.sin(frame * 0.03 + i) * 0.2})`; 
        ctx.fill(); 
      } 
      ctx.restore(); 
    },
    connectionColorModifier: (hue, sat, light, alpha, frameCount) => ({ hue: (hue + 280) % 360, sat: Math.min(100, sat + 30), light: light + 10, alpha: alpha * 0.85 }),
    indicatorText: '✨ GALAXY MODE - Sparkle stars active' },
  rainbow: { name: 'RAINBOW', displayName: '🌈 RAINBOW', color: '#ff00ff',
    particleColorModifier: (hue, sat, light, idx, balanceFactor, frameCount) => ({ hue: (hue + idx * 15 + frameCount * 2) % 360, sat: 100, light: 70 }),
    drawExtraEffects: (ctx, W, H, frame, particles, cx0, cy0) => { 
      if (window.LOW_POWER_MODE) return;
      ctx.save(); 
      ctx.globalCompositeOperation = 'lighter'; 
      particles.forEach((p, i) => { 
        const pulse = Math.sin(frame * 0.05 + i) * 0.4 + 0.5; 
        const cx = cx0 + Math.cos(p.angle) * p.radius; 
        const cy = cy0 + Math.sin(p.angle) * p.radius; 
        ctx.beginPath(); 
        ctx.arc(cx, cy, p.r * (1 + pulse * 0.6), 0, Math.PI * 2); 
        ctx.fillStyle = `hsla(${(p.hue + frame) % 360}, 100%, 70%, ${pulse * 0.3})`; 
        ctx.fill(); 
      }); 
      ctx.restore(); 
    },
    connectionColorModifier: (hue, sat, light, alpha, frameCount) => ({ hue: (hue + frameCount * 2) % 360, sat: 100, light: 70, alpha: alpha * 0.7 }),
    indicatorText: '🌈 RAINBOW MODE - Color pulse active' },
  fire: { name: 'FIRE', displayName: '🔥 FIRE', color: '#ff4400',
    particleColorModifier: (hue, sat, light, idx, balanceFactor, frameCount) => ({ hue: (hue + 15) % 360, sat: Math.min(100, sat + 40), light: light + 20 }),
    drawExtraEffects: (ctx, W, H, frame, particles, cx0, cy0) => { 
      if (window.LOW_POWER_MODE) return;
      ctx.save(); 
      ctx.globalCompositeOperation = 'screen'; 
      particles.forEach(p => { 
        const trailX = cx0 + Math.cos(p.angle - p.speed * 12) * p.radius; 
        const trailY = cy0 + Math.sin(p.angle - p.speed * 12) * p.radius; 
        ctx.beginPath(); 
        ctx.moveTo(trailX, trailY); 
        const cx = cx0 + Math.cos(p.angle) * p.radius; 
        const cy = cy0 + Math.sin(p.angle) * p.radius; 
        ctx.lineTo(cx, cy); 
        ctx.lineWidth = p.r * 1.2; 
        ctx.strokeStyle = `rgba(255, 80, 0, 0.5)`; 
        ctx.stroke(); 
      }); 
      ctx.restore(); 
    },
    connectionColorModifier: (hue, sat, light, alpha, frameCount) => ({ hue: (hue + 15) % 360, sat: Math.min(100, sat + 40), light: light + 20, alpha: alpha * 1.2 }),
    indicatorText: '🔥 FIRE MODE - Fire trail effects active' }
};

// Export to global scope (atpakaļsaderībai, ja nepieciešams)
window.ADDON_STYLES = ADDON_STYLES;

// Oficiālais eksports Vite būvētājam
export { ADDON_STYLES };
