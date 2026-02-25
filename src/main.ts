import './style.css';
import { CanvasManager } from './canvas/canvas-manager';
import { GoogleService, type GoogleUser } from './google';
import { APP_CONFIG } from './config';

import { injectIcons } from './ui/icon-injector';
import { updateOrientationIcons } from './ui/icon-injector';
import { generatePalette } from './ui/palette';
import { updateGoogleUI } from './ui/google-ui';
import { updatePreview } from './ui/preview';
import { ToolStateManager } from './ui/tool-state';
import { ModalManager } from './ui/modals';
import { UIManager } from './ui/ui-manager';
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0,
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

document.addEventListener('DOMContentLoaded', () => {
  // Initialization
  let canvasManager: CanvasManager;
  let toolStateManager: ToolStateManager;
  let googleService: GoogleService;
  let uiManager: UIManager;

  const paletteSettings = { ...APP_CONFIG.PALETTE_SETTINGS };

  const updateHistoryButtons = () => {
    const undoBtn = document.getElementById('main-undo-btn') as HTMLButtonElement;
    const redoBtn = document.getElementById('main-redo-btn') as HTMLButtonElement;
    const menuUndo = document.getElementById('menu-undo') as HTMLButtonElement;
    const menuRedo = document.getElementById('menu-redo') as HTMLButtonElement;

    if (canvasManager) {
      const canUndo = canvasManager.canUndo();
      const canRedo = canvasManager.canRedo();
      if (undoBtn) undoBtn.disabled = !canUndo;
      if (redoBtn) redoBtn.disabled = !canRedo;
      if (menuUndo) menuUndo.disabled = !canUndo;
      if (menuRedo) menuRedo.disabled = !canRedo;
    }
  };

  const handleUpdate = () => {
    updatePreview(canvasManager, updateHistoryButtons);
  };

  canvasManager = new CanvasManager('main-canvas', handleUpdate);
  canvasManager.onZoomChange = (zoomPercent: number) => {
    const indicator = document.getElementById('zoom-level');
    if (indicator) indicator.textContent = `${zoomPercent}% `;
  };
  toolStateManager = new ToolStateManager(canvasManager);
  googleService = new GoogleService((user: GoogleUser | null) => updateGoogleUI(user));
  new ModalManager(canvasManager, googleService);

  uiManager = new UIManager(canvasManager, toolStateManager, googleService, paletteSettings);
  uiManager.setupEventListeners();

  // Initial UI Setup
  injectIcons();
  updateOrientationIcons();
  generatePalette(paletteSettings, canvasManager, () => toolStateManager.getCurrentTool(), () => toolStateManager.updateGlobalIndicator());
  handleUpdate();
  toolStateManager.updateGlobalIndicator();

  // Final Config Sync
  document.title = APP_CONFIG.APP_NAME;
  const logoEl = document.querySelector('.logo');
  if (logoEl) logoEl.textContent = APP_CONFIG.APP_NAME;
  const versionInfo = document.querySelector('.version-info');
  if (versionInfo) versionInfo.textContent = `v${APP_CONFIG.VERSION} `;
  const headerVersion = document.querySelector('.version-display');
  if (headerVersion) headerVersion.textContent = `v${APP_CONFIG.VERSION} `;
  if (headerVersion) headerVersion.textContent = `v${APP_CONFIG.VERSION} `;
});
