import './style.css';
import { CanvasManager } from './canvas/canvas-manager';
import type { DrawingTool } from './tools';
import { GoogleService, type GoogleUser } from './google';
import { APP_CONFIG } from './config';
import { injectIcons, updateOrientationIcons } from './ui/icons';
import { generatePalette } from './ui/palette';
import { updateGoogleUI } from './ui/google-ui';
import { updatePreview } from './ui/preview';
import { ToolStateManager } from './ui/tool-state';
import { ModalManager } from './ui/modals';

document.addEventListener('DOMContentLoaded', () => {
  // Initialization
  let canvasManager: CanvasManager;
  let toolStateManager: ToolStateManager;
  let googleService: GoogleService;

  const paletteSettings = { count: 20, columns: 10 };

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
  toolStateManager = new ToolStateManager(canvasManager);
  googleService = new GoogleService((user: GoogleUser | null) => updateGoogleUI(user));
  new ModalManager(canvasManager, googleService);

  // Initial UI Setup
  injectIcons();
  updateOrientationIcons();
  generatePalette(paletteSettings, canvasManager, () => toolStateManager.getCurrentTool(), () => toolStateManager.updateGlobalIndicator());
  handleUpdate();
  toolStateManager.updateGlobalIndicator();

  // --- Global Event Listeners ---
  window.addEventListener('resize', updateOrientationIcons);

  // Custom Color Changed Event (from Palette)
  window.addEventListener('colorChanged', (e: Event) => {
    const detail = (e as CustomEvent<{ color: string }>).detail;
    toolStateManager.updateCurrentState({ color: detail.color });
  });

  // Zoom Buttons
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => canvasManager.zoomIn());
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => canvasManager.zoomOut());

  // Menu Bar Dropdowns
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      menuItems.forEach(other => { if (other !== item) other.classList.remove('active'); });
      item.classList.toggle('active');
    });
  });

  window.addEventListener('click', () => {
    menuItems.forEach(item => item.classList.remove('active'));
  });

  document.querySelectorAll('.menu-dropdown').forEach(dropdown => {
    dropdown.addEventListener('click', (e) => e.stopPropagation());
  });

  document.querySelectorAll('.menu-dropdown button').forEach(btn => {
    btn.addEventListener('click', () => {
      menuItems.forEach(item => item.classList.remove('active'));
    });
  });

  // Collapsible Sections
  document.querySelectorAll('.prop-header').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.prop-section')?.classList.toggle('collapsed');
    });
  });

  // Settings Save Logic
  document.getElementById('settings-save-btn')?.addEventListener('click', () => {
    const limitInput = document.getElementById('history-limit') as HTMLInputElement;
    const limit = parseInt(limitInput.value);
    const colorCountInput = document.getElementById('color-count') as HTMLInputElement;
    const colorColsInput = document.getElementById('color-columns') as HTMLInputElement;

    if (limit && limit >= 10 && limit <= 500) {
      canvasManager.setHistoryLimit(limit);
    }

    if (colorCountInput && colorColsInput) {
      paletteSettings.count = parseInt(colorCountInput.value) || 20;
      paletteSettings.columns = parseInt(colorColsInput.value) || 10;
      generatePalette(paletteSettings, canvasManager, () => toolStateManager.getCurrentTool(), () => toolStateManager.updateGlobalIndicator());
    }
    document.getElementById('settings-modal')?.classList.add('hidden');
  });

  // Tool Switching
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool') as DrawingTool;
      if (tool === 'hand') {
        toolStateManager.toggleHandTool();
      } else {
        toolStateManager.switchTool(tool);
      }
    });
  });

  // Tool Inputs
  const sizeInput = document.getElementById('stroke-size') as HTMLInputElement;
  const opacityInput = document.getElementById('stroke-opacity') as HTMLInputElement;
  const hardnessInput = document.getElementById('stroke-hardness') as HTMLInputElement;
  const pressureInput = document.getElementById('stroke-pressure') as HTMLInputElement;
  const colorPicker = document.getElementById('color-picker') as HTMLInputElement;

  if (sizeInput) sizeInput.oninput = (e) => toolStateManager.updateCurrentState({ size: parseInt((e.target as HTMLInputElement).value) });
  if (opacityInput) opacityInput.oninput = (e) => toolStateManager.updateCurrentState({ opacity: parseInt((e.target as HTMLInputElement).value) });
  if (hardnessInput) hardnessInput.oninput = (e) => toolStateManager.updateCurrentState({ hardness: parseInt((e.target as HTMLInputElement).value) });
  if (pressureInput) pressureInput.oninput = (e) => toolStateManager.updateCurrentState({ pressure: parseInt((e.target as HTMLInputElement).value) });
  if (colorPicker) colorPicker.onchange = (e) => toolStateManager.updateCurrentState({ color: (e.target as HTMLInputElement).value });

  // Other Actions
  document.getElementById('menu-undo')?.addEventListener('click', () => canvasManager.undo());
  document.getElementById('menu-redo')?.addEventListener('click', () => canvasManager.redo());
  document.getElementById('main-undo-btn')?.addEventListener('click', () => canvasManager.undo());
  document.getElementById('main-redo-btn')?.addEventListener('click', () => canvasManager.redo());

  document.getElementById('menu-delete')?.addEventListener('click', () => {
    if (confirm('Delete current book?')) canvasManager.clear();
  });

  document.getElementById('menu-google-login')?.addEventListener('click', () => googleService.login());
  document.getElementById('menu-google-logout')?.addEventListener('click', () => googleService.logout());
  document.getElementById('google-login-btn')?.addEventListener('click', () => googleService.login());
  document.getElementById('user-profile')?.addEventListener('click', () => {
    if (confirm('Sign out of Google?')) googleService.logout();
  });

  document.getElementById('menu-about')?.addEventListener('click', () => {
    alert(`${APP_CONFIG.APP_NAME} v${APP_CONFIG.VERSION}\nA premium web-based drawing application.`);
  });

  // Toolbar Toggles
  const toggleToolbar = (side: 'left' | 'right') => {
    const selector = side === 'left' ? '.tool-panel' : '.properties-panel';
    const panel = document.querySelector(selector) as HTMLElement;
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      updateOrientationIcons();
    }
  };

  document.getElementById('menu-header-toggle-left')?.addEventListener('click', () => toggleToolbar('left'));
  document.getElementById('menu-header-toggle-right')?.addEventListener('click', () => toggleToolbar('right'));
  document.getElementById('menu-toggle-left')?.addEventListener('click', () => toggleToolbar('left'));
  document.getElementById('menu-toggle-right')?.addEventListener('click', () => toggleToolbar('right'));

  // Shortcuts
  window.addEventListener('keydown', (e) => {
    // Check for Ctrl (and support Cmd as often requested by Mac users, but user specifically asked for Ctrl)
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();

      // Undo/Redo
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) canvasManager.redo();
        else canvasManager.undo();
        return;
      }

      // Tool Switching
      if (key === 'h') { e.preventDefault(); toolStateManager.toggleHandTool(); return; }
      if (key === 'p') { e.preventDefault(); toolStateManager.switchTool('pencil'); return; }
      if (key === 'b') { e.preventDefault(); toolStateManager.switchTool('brush'); return; }
      if (key === 'e') { e.preventDefault(); toolStateManager.switchTool('eraser'); return; }
      if (key === 'f') { e.preventDefault(); toolStateManager.switchTool('fill'); return; }
      if (key === 't') { e.preventDefault(); toolStateManager.switchTool('text'); return; }

      // Toolbar toggles
      if (key === 'l') {
        e.preventDefault();
        toggleToolbar('left');
        return;
      }
      if (key === 'r') {
        e.preventDefault();
        toggleToolbar('right');
        return;
      }
    }
  });

  // Global Indicator Click
  document.getElementById('global-tool-indicator')?.addEventListener('click', () => {
    const propPanel = document.querySelector('.properties-panel') as HTMLElement;
    if (propPanel.style.display === 'none') {
      propPanel.style.display = 'flex';
      document.getElementById('section-stroke')?.classList.remove('collapsed');
      document.getElementById('section-color')?.classList.remove('collapsed');
      propPanel.scrollTop = 0;
    } else {
      propPanel.style.display = 'none';
    }
    updateOrientationIcons();
  });

  // Final Config Sync
  document.title = APP_CONFIG.APP_NAME;
  const logoEl = document.querySelector('.logo');
  if (logoEl) logoEl.textContent = APP_CONFIG.APP_NAME;
  const versionInfo = document.querySelector('.version-info');
  if (versionInfo) versionInfo.textContent = `v${APP_CONFIG.VERSION}`;
  const headerVersion = document.querySelector('.version-display');
  if (headerVersion) headerVersion.textContent = `v${APP_CONFIG.VERSION}`;
});
