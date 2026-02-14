import './style.css';
import { CanvasManager } from './canvas';
import { ICONS } from './icons';
import type { DrawingTool } from './tools';
import { GoogleService, type GoogleUser } from './google';

document.addEventListener('DOMContentLoaded', () => {
  const canvasManager = new CanvasManager('main-canvas');

  // --- Google Integration ---
  const googleService = new GoogleService((user: GoogleUser | null) => {
    updateGoogleUI(user);
  });

  // --- Icon Injection ---
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
    'menu-google-icon': ICONS.google,
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

  // --- Menu Bar Logic ---
  const menuItems = document.querySelectorAll('.menu-item');

  // Toggle Dropdowns
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close others
      menuItems.forEach(other => {
        if (other !== item) other.classList.remove('active');
      });
      item.classList.toggle('active');
    });
  });

  // Close Dropdowns on outside click
  window.addEventListener('click', () => {
    menuItems.forEach(item => item.classList.remove('active'));
  });

  // PREVENT closing when clicking inside the dropdown
  document.querySelectorAll('.menu-dropdown').forEach(dropdown => {
    dropdown.addEventListener('click', (e) => e.stopPropagation());
  });

  // Close dropdown when a button inside is clicked (action taken)
  document.querySelectorAll('.menu-dropdown button').forEach(btn => {
    btn.addEventListener('click', () => {
      menuItems.forEach(item => item.classList.remove('active'));
    });
  });


  // --- Menu Actions ---

  // FILE
  document.getElementById('menu-new')?.addEventListener('click', () => {
    if (confirm('Create new book? Unsaved changes will be lost.')) {
      canvasManager.clear();
    }
  });

  document.getElementById('menu-delete')?.addEventListener('click', () => {
    if (confirm('Delete current book?')) {
      canvasManager.clear();
    }
  });

  // Settings Modal
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = () => settingsModal?.classList.add('hidden');

  document.getElementById('menu-settings')?.addEventListener('click', () => {
    settingsModal?.classList.remove('hidden');
    // Load current config if needed (not persisted yet outside runtime)
  });

  document.getElementById('settings-close')?.addEventListener('click', settingsClose);
  document.getElementById('settings-cancel-btn')?.addEventListener('click', settingsClose);

  document.getElementById('settings-save-btn')?.addEventListener('click', () => {
    const limitInput = document.getElementById('history-limit') as HTMLInputElement;
    const limit = parseInt(limitInput.value);
    if (limit && limit >= 10 && limit <= 500) {
      canvasManager.setHistoryLimit(limit);
      settingsClose();
    } else {
      alert('Please enter a valid history limit (10-500).');
    }
  });


  // EDIT
  document.getElementById('menu-undo')?.addEventListener('click', () => canvasManager.undo());
  document.getElementById('menu-redo')?.addEventListener('click', () => canvasManager.redo());

  // Shortcuts for Undo/Redo
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        canvasManager.redo();
      } else {
        canvasManager.undo();
      }
    }
  });

  // VIEW (Toggle Toolbars)
  const toolPanel = document.querySelector('.tool-panel') as HTMLElement;
  const propPanel = document.querySelector('.properties-panel') as HTMLElement;

  function toggleLeftToolbar() {
    const btn = document.getElementById('menu-toggle-left')!;
    if (toolPanel.style.display === 'none') {
      toolPanel.style.display = 'flex';
      btn.innerHTML = 'Hide Toolbar (L) <span class="shortcut">^L</span>';
    } else {
      toolPanel.style.display = 'none';
      btn.innerHTML = 'Show Toolbar (L) <span class="shortcut">^L</span>';
    }
  }

  function toggleRightToolbar() {
    const btn = document.getElementById('menu-toggle-right')!;
    if (propPanel.style.display === 'none') {
      propPanel.style.display = 'flex';
      btn.innerHTML = 'Hide Toolbar (R) <span class="shortcut">^R</span>';
    } else {
      propPanel.style.display = 'none';
      btn.innerHTML = 'Show Toolbar (R) <span class="shortcut">^R</span>';
    }
  }

  document.getElementById('menu-toggle-left')?.addEventListener('click', toggleLeftToolbar);
  document.getElementById('menu-toggle-right')?.addEventListener('click', toggleRightToolbar);

  window.addEventListener('keydown', (e) => {
    // Toggle Left: Ctrl+L
    if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      toggleLeftToolbar();
    }
    // Toggle Right: Ctrl+R
    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      toggleRightToolbar();
    }
  });


  // HELP
  document.getElementById('menu-search')?.addEventListener('click', () => {
    const query = prompt('Search features...');
    if (query) {
      alert(`Searching for: ${query} (Feature not fully implemented)`);
    }
  });


  // ACCOUNT
  // Existing Google Login button in header calls googleService.login()
  // New Menu Login
  document.getElementById('menu-google-login')?.addEventListener('click', () => {
    googleService.login();
  });

  document.getElementById('menu-google-logout')?.addEventListener('click', () => {
    googleService.logout();
  });


  // HELP
  document.getElementById('menu-about')?.addEventListener('click', () => {
    alert('iDrawBook v1.0.0\nA premium web-based drawing application.');
  });


  // --- Existing App Logic ---

  let lastTool: DrawingTool = 'pencil'; // Track previous tool for toggling

  function switchTool(tool: DrawingTool) {
    // If switching TO hand, save current tool if it's NOT hand
    if (tool === 'hand') {
      const currentActive = document.querySelector('.tool-btn.active')?.getAttribute('data-tool') as DrawingTool;
      if (currentActive && currentActive !== 'hand') {
        lastTool = currentActive;
      }
    }

    toolButtons.forEach(btn => {
      if (btn.getAttribute('data-tool') === tool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    canvasManager.setTool(tool);
  }

  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool') as DrawingTool;
      // If clicking Hand button specifically
      if (tool === 'hand') {
        const currentActive = document.querySelector('.tool-btn.active')?.getAttribute('data-tool');
        if (currentActive === 'hand') {
          // If already hand, toggle back
          switchTool(lastTool);
          return;
        }
      }
      switchTool(tool);
    });
  });

  window.addEventListener('keydown', (e) => {
    // Shortcuts with Ctrl/Cmd
    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toLowerCase();

      switch (key) {
        case 'h':
          e.preventDefault();
          // Toggle Hand
          const currentActive = document.querySelector('.tool-btn.active')?.getAttribute('data-tool');
          if (currentActive === 'hand') {
            switchTool(lastTool);
          } else {
            switchTool('hand');
          }
          break;
        case 'p':
          e.preventDefault();
          switchTool('pencil');
          break;
        case 'b':
          e.preventDefault();
          switchTool('brush');
          break;
        case 'e':
          e.preventDefault();
          switchTool('eraser');
          break;
        // Existing View/Edit shortcuts handled elsewhere (z, l, r)
      }
    }
  });

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

  // Drive Modal
  const driveModal = document.getElementById('drive-modal');
  const filenameInput = document.getElementById('drive-filename') as HTMLInputElement;
  const folderDisplayName = document.getElementById('selected-folder-name');
  let selectedFolderId = '';

  document.getElementById('export-drive-btn')?.addEventListener('click', async () => {
    filenameInput.value = `iDrawBook_${Date.now()}.png`;
    selectedFolderId = '';
    if (folderDisplayName) folderDisplayName.textContent = 'My Drive (Root)';
    driveModal?.classList.remove('hidden');
  });

  document.getElementById('change-folder-btn')?.addEventListener('click', async () => {
    const folderId = await googleService.showPicker();
    if (folderId) {
      selectedFolderId = folderId;
      if (folderDisplayName) folderDisplayName.textContent = 'Folder Selected';
    }
  });

  const closeModal = () => driveModal?.classList.add('hidden');
  document.getElementById('modal-close')!.onclick = closeModal;
  document.getElementById('modal-cancel-btn')!.onclick = closeModal;

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
    // Menu User UI
    const menuLogin = document.getElementById('menu-google-login');
    const menuInfo = document.getElementById('menu-user-info');
    const menuAvatar = document.getElementById('menu-user-avatar') as HTMLImageElement;
    const menuName = document.getElementById('menu-user-name');

    if (user) {
      // Menu
      menuLogin?.classList.add('hidden');
      menuInfo?.classList.remove('hidden');
      if (menuAvatar) menuAvatar.src = user.picture;
      if (menuName) menuName.textContent = user.name;

    } else {
      // Menu
      menuLogin?.classList.remove('hidden');
      menuInfo?.classList.add('hidden');

      // Should likely close the modal if open, but existing logic handles modal access separately
      // However, the modal is hidden if not logged in via old logic. 
      // We should ensure modal hides if not logged in.
      document.getElementById('drive-modal')?.classList.add('hidden');
    }
  }

  // New Save Book Logic (Trigger Export Modal)
  document.getElementById('menu-save')?.addEventListener('click', () => {
    // Check login first? Or just show modal and let modal logic handle?
    // Let's just open the modal, consistent with old export-drive-btn
    const filenameInput = document.getElementById('drive-filename') as HTMLInputElement;
    const folderDisplayName = document.getElementById('selected-folder-name');

    filenameInput.value = `iDrawBook_${Date.now()}.png`;
    selectedFolderId = ''; // Keep previous folder? No, let's reset for now or keep var
    // actually selectedFolderId is scoped in 'Drive Modal' block below which is not accessible here easily unless we move it up.
    // Let's use the existing event listener block structure or move variables.
    if (folderDisplayName) folderDisplayName.textContent = 'My Drive (Root)';
    driveModal?.classList.remove('hidden');
  });
});
