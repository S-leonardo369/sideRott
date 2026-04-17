const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let overlayWindow = null;
let isOverlayVisible = false;
let slideAnimationTimeout = null;
let slideAnimationId = 0; // Incremented each time to cancel in-flight animations

function getOverlayBounds(config) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height, x, y } = primaryDisplay.workArea;
  const overlayWidthPercent = config.overlayWidth || 25;
  const overlayWidth = Math.round(width * (overlayWidthPercent / 100));

  if (config.overlayPosition === 'left') {
    return { x: x, y: y, width: overlayWidth, height: height };
  }
  return { x: x + width - overlayWidth, y: y, width: overlayWidth, height: height };
}

function createOverlayWindow(config) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const bounds = getOverlayBounds(config);

  overlayWindow = new BrowserWindow({
    x: bounds.x + (config.overlayPosition === 'left' ? -bounds.width : bounds.width),
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      webSecurity: false  // Allow <video> to load cross-origin YouTube CDN URLs from file:// page
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'pop-up-menu');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });

  overlayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    isOverlayVisible = false;
  });

  return overlayWindow;
}

function showOverlay(config) {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow(config);
  }

  if (isOverlayVisible) return;

  const bounds = getOverlayBounds(config);
  const offscreenX = config.overlayPosition === 'left'
    ? bounds.x - bounds.width
    : bounds.x + bounds.width;

  overlayWindow.setBounds({ x: offscreenX, y: bounds.y, width: bounds.width, height: bounds.height });
  overlayWindow.showInactive();

  overlayWindow.webContents.send('overlay:pre-show');

  if (slideAnimationTimeout) clearTimeout(slideAnimationTimeout);
  const myId = ++slideAnimationId; // Any older animation will see myId !== slideAnimationId and stop

  const animationDuration = 250;
  const steps = 16;
  const stepTime = animationDuration / steps;
  let currentStep = 0;

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function animateStep() {
    if (myId !== slideAnimationId) return; // Cancelled by a newer animation
    currentStep++;
    const progress = easeOutExpo(currentStep / steps);
    const currentX = Math.round(offscreenX + (bounds.x - offscreenX) * progress);

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setBounds({ x: currentX, y: bounds.y, width: bounds.width, height: bounds.height });
    }

    if (currentStep < steps) {
      slideAnimationTimeout = setTimeout(animateStep, stepTime);
    } else {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setBounds(bounds);
        overlayWindow.webContents.send('overlay:shown');
      }
      isOverlayVisible = true;
    }
  }

  animateStep();
}

function hideOverlay(config) {
  if (!overlayWindow || overlayWindow.isDestroyed() || !isOverlayVisible) return;

  const bounds = getOverlayBounds(config);
  const offscreenX = config.overlayPosition === 'left'
    ? bounds.x - bounds.width
    : bounds.x + bounds.width;

  overlayWindow.webContents.send('overlay:pre-hide');

  if (slideAnimationTimeout) clearTimeout(slideAnimationTimeout);
  const myId = ++slideAnimationId;

  const animationDuration = 200;
  const steps = 12;
  const stepTime = animationDuration / steps;
  let currentStep = 0;

  function easeInQuad(t) {
    return t * t;
  }

  function animateStep() {
    if (myId !== slideAnimationId) return; // Cancelled by a newer animation
    currentStep++;
    const progress = easeInQuad(currentStep / steps);
    const currentX = Math.round(bounds.x + (offscreenX - bounds.x) * progress);

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setBounds({ x: currentX, y: bounds.y, width: bounds.width, height: bounds.height });
    }

    if (currentStep < steps) {
      slideAnimationTimeout = setTimeout(animateStep, stepTime);
    } else {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.hide();
        overlayWindow.webContents.send('overlay:hidden');
      }
      isOverlayVisible = false;
    }
  }

  animateStep();
}

function toggleOverlay(config) {
  if (isOverlayVisible) {
    hideOverlay(config);
  } else {
    showOverlay(config);
  }
}

function repositionOverlay(config) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const bounds = getOverlayBounds(config);
  if (isOverlayVisible) {
    overlayWindow.setBounds(bounds);
  } else {
    // Park off-screen at the new display geometry so the next show animation
    // starts from the correct position (handles display add/remove/DPI changes)
    const offscreenX = config.overlayPosition === 'left'
      ? bounds.x - bounds.width
      : bounds.x + bounds.width;
    overlayWindow.setBounds({ x: offscreenX, y: bounds.y, width: bounds.width, height: bounds.height });
  }
}

function getOverlayWindow() {
  return overlayWindow;
}

function isVisible() {
  return isOverlayVisible;
}

function destroyOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
    overlayWindow = null;
    isOverlayVisible = false;
  }
}

module.exports = {
  createOverlayWindow,
  showOverlay,
  hideOverlay,
  toggleOverlay,
  repositionOverlay,
  getOverlayWindow,
  isVisible,
  destroyOverlay
};
