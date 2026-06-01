// ============================================ //
// RECORDING FUNCTIONS
// ============================================ //

import { UI } from './state.js';
import { showWarning, showToast, showProgress, setProgress, hideProgress, setButtonLoading, updateTokenListUI } from './ui.js';
import { stopAnimation, drawFrame, animate } from './visualizer.js';

export function pickSupportedMimeType() {
  const candidates = ['video/webm', 'video/mp4'];
  for (const c of candidates) { 
    try { 
      if (MediaRecorder.isTypeSupported(c)) return c; 
    } catch (e) {} 
  }
  return '';
}

export function cleanupRecording(app, previousShowInfo, originalParticles = null) {
  if (originalParticles) app.particles = originalParticles;
  app.showInfo = previousShowInfo;
  if (app.showInfo && UI.tokenListContainer) UI.tokenListContainer.style.display = 'block';
  updateTokenListUI(app.tokens);
  setButtonLoading(UI.recordBtn, false);
  UI.renderBtn.disabled = false;
  UI.connectBtn.disabled = false;
  UI.generateNFTBtn.disabled = false;
  hideProgress();
  UI.recordTimer.textContent = 'Recording: 0 / 15 s';
  app.isRecording = false;
  showWarning('', false);
}

export async function startRecording(app) {
  if (app.isRecording) return;
  app.isRecording = true;
  
  showWarning('⚠️ Recording in progress...', true);
  setButtonLoading(UI.recordBtn, true);
  
  const previousShowInfo = app.showInfo;
  app.showInfo = false;
  if (UI.tokenListContainer) UI.tokenListContainer.style.display = 'none';
  
  // Saglabājam oriģinālās daļiņas, bet NEIEROBEŽOJAM to skaitu
  const originalParticles = app.particles;
  
  let stream;
  try { 
    stream = UI.canvas.captureStream(30);
  } catch (err) { 
    showToast('Recording not supported', 'error'); 
    cleanupRecording(app, previousShowInfo, originalParticles);
    return; 
  }
  
  const mime = pickSupportedMimeType();
  let recorder;
  try { 
    recorder = new MediaRecorder(stream, { mimeType: mime });
  } catch (err) { 
    alert('Recording not available'); 
    cleanupRecording(app, previousShowInfo, originalParticles); 
    return; 
  }
  
  const chunks = [];
  let animationFrameId = null;
  
  // Ierakstīšanas laikā rādām PILNU vizualizāciju (arī tokenu info)
  function recordAnimation() {
    if (!app.isRecording) return;
    drawFrame(app, app.frameCount++, true);
    animationFrameId = requestAnimationFrame(recordAnimation);
  }
  
  recorder.ondataavailable = (e) => { 
    if (e.data && e.data.size) chunks.push(e.data); 
  };
  
  recorder.onerror = (ev) => { 
    console.error(ev); 
    showToast('Recording error', 'error'); 
  };
  
  recorder.onstart = () => { 
    showToast('Recording...', 'info'); 
    recordAnimation(); 
  };
  
  recorder.start(1000);
  
  const startTime = performance.now();
  const duration = 15000;
  
  const updateProgress = (timestamp) => {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    setProgress(progress * 100);
    const seconds = Math.floor(elapsed / 1000);
    UI.recordTimer.textContent = `Recording: ${seconds} / 15 s`;
    if (elapsed < duration) {
      requestAnimationFrame(updateProgress);
    } else {
      try { 
        if (recorder.state === 'recording') recorder.stop(); 
      } catch (e) {}
    }
  };
  requestAnimationFrame(updateProgress);
  
  recorder.onstop = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    const blob = new Blob(chunks, { type: chunks.length ? chunks[0].type : 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    a.download = `visualization_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { 
      document.body.removeChild(a); 
      URL.revokeObjectURL(url); 
    }, 100);
    
    app.particles = originalParticles;
    app.showInfo = previousShowInfo;
    if (app.showInfo && UI.tokenListContainer) UI.tokenListContainer.style.display = 'block';
    updateTokenListUI(app.tokens);
    showToast('Recording finished!', 'success');
    UI.recordTimer.textContent = 'Recording: 0 / 15 s';
    hideProgress();
    setButtonLoading(UI.recordBtn, false);
    UI.renderBtn.disabled = false;
    UI.connectBtn.disabled = false;
    UI.generateNFTBtn.disabled = false;
    app.isRecording = false;
    showWarning('', false);
    
    if (app.animFrameId) cancelAnimationFrame(app.animFrameId);
    animate(app);
  };
  
  recorder.onerror = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    cleanupRecording(app, previousShowInfo, originalParticles);
  };
}
