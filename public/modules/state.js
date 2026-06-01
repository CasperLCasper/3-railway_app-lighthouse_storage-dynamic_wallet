// ============================================ //
// APP STATE
// ============================================ //

// App stāvokļa objekts
export const AppState = {
  provider: null,
  signer: null,
  account: null,
  showInfo: true,
  tokens: [],
  ethBalance: 0,
  txCount: 0,
  particles: [],
  initialParticles: [],
  animFrameId: null,
  currentAddonStyle: 'classic',
  frameCount: 0,
  isRecording: false,
  lastImageURL: null,
  lastVideoURL: null,
  lastMetadataURL: null,
  isAnimationActive: false,
  nftCenters: [],
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 0,
  currentVizChain: 'sepolia',
  particleCache: new Map()
};

// UI elementu references – tagad const, jo mēs nemainīsim pašu objektu, tikai tā īpašības
export const UI = {};

// Inicializē UI references (pievieno īpašības esošajam objektam)
export function initUI() {
  UI.connectBtn = document.getElementById('connectBtn');
  UI.renderBtn = document.getElementById('renderBtn');
  UI.recordBtn = document.getElementById('recordBtn');
  UI.generateNFTBtn = document.getElementById('generateNFTBtn');
  UI.accountDisplay = document.getElementById('accountDisplay');
  UI.recordTimer = document.getElementById('recordTimer');
  UI.statusMsg = document.getElementById('statusMsg');
  UI.progressBarContainer = document.getElementById('progressBarContainer');
  UI.progressBar = document.getElementById('progressBar');
  UI.ipfsPreview = document.getElementById('ipfsPreview');
  UI.previewImage = document.getElementById('previewImage');
  UI.previewVideo = document.getElementById('previewVideo');
  UI.previewMetadata = document.getElementById('previewMetadata');
  UI.styleIndicator = document.getElementById('styleIndicator');
  UI.indicatorText = document.getElementById('indicatorText');
  UI.warningBanner = document.getElementById('warningBanner');
  UI.canvas = document.getElementById('snapshotCanvas');
  UI.fullscreenIcon = document.getElementById('fullscreenIcon');
  UI.toggleInfoIcon = document.getElementById('toggleInfoIcon');
  UI.tokenListContainer = document.getElementById('tokenListContainer');
  UI.tokenListContent = document.getElementById('tokenListContent');
  UI.chainSelect = document.getElementById('chainSelect');
  UI.chainStatus = document.getElementById('chainStatus');
}
