// ============================================ //
// UI FUNCTIONS
// ============================================ //

import { UI } from './state.js';

export function showWarning(message, show = true) {
  if (UI.warningBanner) {
    UI.warningBanner.textContent = message;
    if (show) UI.warningBanner.classList.add('show');
    else UI.warningBanner.classList.remove('show');
  }
}

export function showToast(message, type = 'info') {
  UI.statusMsg.textContent = message;
  console.log(`[${type}] ${message}`);
}

export function showProgress() { 
  UI.progressBarContainer.style.display = 'block'; 
  UI.progressBar.style.transform = 'scaleX(0)'; 
}

export function hideProgress() { 
  UI.progressBar.style.transform = 'scaleX(1)'; 
  setTimeout(() => { 
    UI.progressBarContainer.style.display = 'none'; 
    UI.progressBar.style.transform = 'scaleX(0)'; 
  }, 500); 
}

export function setProgress(percent) { 
  UI.progressBar.style.transform = `scaleX(${Math.min(percent / 100, 1)})`; 
}

export function setButtonLoading(button, isLoading) { 
  if (isLoading) { button.classList.add('loading'); button.disabled = true; } 
  else { button.classList.remove('loading'); button.disabled = false; } 
}

export function updateTokenListUI(tokens) {
  if (!UI.tokenListContent) return;
  if (!tokens || tokens.length === 0) { 
    UI.tokenListContent.innerHTML = '<tr><td colspan="2" style="color:#777;">No assets<\/td><\/tr>'; 
    return; 
  }
  const fragment = document.createDocumentFragment();
  const maxTokens = tokens.length;
  tokens.slice(0, maxTokens).forEach(t => {
    const tr = document.createElement('tr');
    const addrTd = document.createElement('td'); 
    addrTd.textContent = t.address;
    addrTd.title = t.address;
    const balTd = document.createElement('td'); 
    balTd.textContent = t.isNFT ? t.balance : t.balance.toFixed(4);
    tr.appendChild(addrTd); 
    tr.appendChild(balTd);
    fragment.appendChild(tr);
  });
  UI.tokenListContent.innerHTML = '';
  UI.tokenListContent.appendChild(fragment);
}
