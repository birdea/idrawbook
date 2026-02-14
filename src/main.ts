import './style.css';
import { CanvasManager } from './canvas';
import { ICONS } from './icons';
import type { DrawingTool } from './tools';
import { GoogleService, type GoogleUser } from './google';

document.addEventListener('DOMContentLoaded', () => {
  const canvasManager = new CanvasManager('main-canvas');

  // Google Integration
  const googleService = new GoogleService((user: GoogleUser | null) => {
    updateGoogleUI(user);
  });

  // Inject Icons
  const iconMap: Record<string, string> = {
    'clear-btn': ICONS.clear,
    'tool-pencil': ICONS.pencil,
    'tool-brush': ICONS.brush,
    'tool-pen': ICONS.pen,
    'tool-eraser': ICONS.eraser,
    'tool-line': ICONS.line,
    'tool-rect': ICONS.rect,
    'tool-circle': ICONS.circle,
    'tool-hand': ICONS.hand,
    'google-login-btn': ICONS.google,
    'export-main-btn': ICONS.download,
  };

  Object.entries(iconMap).forEach(([id, svg]) => {
    const btn = document.getElementById(id);
    if (btn) {
      if (id === 'export-main-btn') {
        btn.innerHTML = `${svg} <span>Export</span>`;
      } else {
        btn.innerHTML = svg;
      }
    }
  });

  // Tool Selection Helper
  function switchTool(tool: DrawingTool) {
    toolButtons.forEach(btn => {
      if (btn.getAttribute('data-tool') === tool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    canvasManager.setTool(tool);
  }

  // Tool Selection
  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool') as DrawingTool;
      switchTool(tool);
    });
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
      switchTool('hand');
    }
  });

  // Property Controls
  const sizeInput = document.getElementById('stroke-size') as HTMLInputElement;
  const opacityInput = document.getElementById('stroke-opacity') as HTMLInputElement;
  const colorPicker = document.getElementById('color-picker') as HTMLInputElement;

  sizeInput.oninput = (e) => canvasManager.setConfig({ size: parseInt((e.target as HTMLInputElement).value) });
  opacityInput.oninput = (e) => canvasManager.setConfig({ opacity: parseInt((e.target as HTMLInputElement).value) });
  colorPicker.onchange = (e) => {
    const color = (e.target as HTMLInputElement).value;
    canvasManager.setConfig({ color });
    updateActiveSwatch(color);
  };

  // Color Swatches
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const color = swatch.getAttribute('data-color')!;
      canvasManager.setConfig({ color });
      colorPicker.value = color;
    });
  });

  function updateActiveSwatch(color: string) {
    swatches.forEach(s => {
      if (s.getAttribute('data-color') === color) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
  }

  // Action Buttons
  document.getElementById('clear-btn')?.addEventListener('click', () => {
    if (confirm('Clear entire canvas?')) {
      canvasManager.clear();
    }
  });

  document.getElementById('google-login-btn')?.addEventListener('click', () => {
    googleService.login();
  });

  document.getElementById('user-profile')?.addEventListener('click', () => {
    if (confirm('Sign out of Google?')) {
      googleService.logout();
    }
  });

  document.getElementById('export-pc-btn')?.addEventListener('click', () => {
    canvasManager.exportImage();
  });

  // Drive Modal Logic
  const driveModal = document.getElementById('drive-modal');
  const filenameInput = document.getElementById('drive-filename') as HTMLInputElement;
  const folderDisplayName = document.getElementById('selected-folder-name');
  let selectedFolderId = '';

  document.getElementById('export-drive-btn')?.addEventListener('click', async () => {
    // Reset modal state
    filenameInput.value = `iDrawBook_${Date.now()}.png`;
    selectedFolderId = '';
    if (folderDisplayName) folderDisplayName.textContent = 'My Drive (Root)';

    // Show modal
    driveModal?.classList.remove('hidden');
  });

  document.getElementById('change-folder-btn')?.addEventListener('click', async () => {
    const folderId = await googleService.showPicker();
    if (folderId) {
      selectedFolderId = folderId;
      if (folderDisplayName) folderDisplayName.textContent = 'Folder Selected';
    }
  });

  // Modal Actions
  const closeModal = () => driveModal?.classList.add('hidden');
  const modalClose = document.getElementById('modal-close');
  if (modalClose) modalClose.onclick = closeModal;

  const modalCancel = document.getElementById('modal-cancel-btn');
  if (modalCancel) modalCancel.onclick = closeModal;

  const modalSave = document.getElementById('modal-save-btn');
  if (modalSave) {
    modalSave.onclick = async () => {
      const filename = filenameInput.value || `iDrawBook_${Date.now()}.png`;
      const blob = await canvasManager.getBlob();
      if (blob) {
        const success = await googleService.uploadToDrive(blob, filename, selectedFolderId);
        if (success) closeModal();
      }
    };
  }

  function updateGoogleUI(user: GoogleUser | null) {
    const loginBtn = document.getElementById('google-login-btn');
    const profile = document.getElementById('user-profile');
    const avatar = document.getElementById('user-avatar') as HTMLImageElement;
    const name = document.getElementById('user-name');
    const driveBtn = document.getElementById('export-drive-btn');

    if (user) {
      loginBtn?.classList.add('hidden');
      profile?.classList.remove('hidden');
      if (avatar) avatar.src = user.picture;
      if (name) name.textContent = user.name;
      driveBtn?.classList.remove('hidden');
    } else {
      loginBtn?.classList.remove('hidden');
      profile?.classList.add('hidden');
      driveBtn?.classList.add('hidden');
      driveModal?.classList.add('hidden');
    }
  }
});
