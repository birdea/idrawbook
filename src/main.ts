import './style.css';
import { CanvasManager } from './canvas';
import { ICONS } from './icons';
import type { DrawingTool } from './tools';
import { GoogleService, type GoogleUser } from './google';

const showToast = (message: string) => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">✨</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
};

document.addEventListener('DOMContentLoaded', () => {
  // Declare canvasManager first to avoid TDZ in updatePreview
  let canvasManager: CanvasManager;

  // Tool State Management
  let lastTool: DrawingTool = 'pencil'; // Track previous tool for toggling
  let currentActiveTool: DrawingTool = 'pencil';

  interface ToolState {
    size: number;
    color: string;
    opacity: number;
    hardness: number;
    pressure: number;
  }

  const toolStates: Record<string, ToolState> = {
    pencil: { size: 5, color: '#000000', opacity: 100, hardness: 100, pressure: 50 },
    brush: { size: 10, color: '#000000', opacity: 100, hardness: 50, pressure: 50 },
    pen: { size: 2, color: '#000000', opacity: 100, hardness: 100, pressure: 50 },
    eraser: { size: 20, color: '#ffffff', opacity: 100, hardness: 100, pressure: 50 },
    fill: { size: 0, color: '#000000', opacity: 100, hardness: 100, pressure: 50 },
    line: { size: 2, color: '#000000', opacity: 100, hardness: 100, pressure: 50 },
    rect: { size: 2, color: '#000000', opacity: 100, hardness: 100, pressure: 50 },
    circle: { size: 2, color: '#000000', opacity: 100, hardness: 100, pressure: 50 },
    text: { size: 12, color: '#000000', opacity: 100, hardness: 100, pressure: 50 },
  };

  const updateGlobalIndicator = () => {
    const indicator = document.getElementById('global-tool-indicator');
    if (!indicator) return;

    if (toolStates[currentActiveTool]) {
      const state = toolStates[currentActiveTool];
      const colorEl = indicator.querySelector('.tool-indicator-color') as HTMLElement;
      const sizeEl = indicator.querySelector('.tool-indicator-size') as HTMLElement;

      indicator.style.display = 'flex'; // Show when applicable tool is active

      if (colorEl) colorEl.style.backgroundColor = state.color;

      if (sizeEl) {
        // Show size for all tools that have state (pencil, brush, pen, eraser, line, rect, circle, text)
        // Fill might have size 0, maybe hide if 0?
        if (state.size === 0 && currentActiveTool === 'fill') {
          sizeEl.style.display = 'none';
        } else {
          sizeEl.style.display = 'block';
          sizeEl.textContent = state.size.toString();
        }
      }
    } else {
      indicator.style.display = 'none'; // Hide for tools without state (e.g. hand)
    }
  };

  // function to update the preview list (thumbnails)
  const updatePreview = () => {
    if (!canvasManager) return;
    // We need to re-render the list entirely or just update?
    // User wants a list of all pages.
    const previewList = document.querySelector('.preview-list');
    if (!previewList) return;

    // Get all pages
    const pages = canvasManager.getPages();

    // Naive re-render for simplicity, or smart diff?
    // Let's try to match by ID to avoid flickering.

    // First, remove items not in pages
    const currentItems = Array.from(previewList.children) as HTMLElement[];
    currentItems.forEach(item => {
      const id = item.dataset.pageId;
      if (!pages.find(p => p.id === id)) {
        item.remove();
      }
    });

    // Get active ID
    const activePageId = canvasManager.getActivePageId();

    // Add or update
    pages.forEach((page, index) => {
      let item = previewList.querySelector(`.preview-item[data-page-id="${page.id}"]`) as HTMLElement;

      if (!item) {
        item = document.createElement('div');
        item.className = 'preview-item';
        item.dataset.pageId = page.id;
        item.addEventListener('click', () => {
          canvasManager.focusPage(page.id);
        });
        previewList.appendChild(item);
      }

      // Update active state
      if (page.id === activePageId) {
        item.classList.add('active');
        // Smooth scroll preview into view if needed
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        item.classList.remove('active');
      }

      // Update thumbnail content repeatedly?
      // Optimization: valid thumbnail only changes on 'update'.
      // ...
      const thumbUrl = canvasManager.getThumbnail(100, page.id);
      item.innerHTML = `
        <div class="preview-thumb-container">
          <img src="${thumbUrl}" alt="Page ${index + 1}">
        </div>
        <div class="preview-info">
          <div class="page-title">Page ${index + 1}</div>
          <div class="page-size">${page.width} x ${page.height} px</div>
        </div>
        <button class="delete-page-btn" title="Remove Page">${ICONS.x}</button>
      `;

      // Add listener to delete button
      item.querySelector('.delete-page-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Remove this page?')) {
          canvasManager.removePage(page.id);
        }
      });
    });

    // Prune if limit exceeded (User feature from before)
    // Actually, "Book has 0 to n items". User requests scrollable list.
    // The "Limit" feature from previous session might conflict?
    // If that limit was for "number of historic snapshots", we might need to rethink.
    // But now we have "Pages".
    // Let's assume "Preview Limit" is deprecated or applies to something else,
    // OR we just show all pages. The requirement "Canvas가 추가되면 ... preview 리스트에 ... 노출돼" implies ALL pages.
    // So I will ignore the limit for the list of CURRENT PAGES.

    // --- Update Canvas Info display ---
    const canvasInfoDisplay = document.getElementById('canvas-info');
    if (canvasInfoDisplay) {
      const activeIdx = pages.findIndex(p => p.id === activePageId);
      const activePage = pages[activeIdx];
      if (activePage) {
        canvasInfoDisplay.textContent = `Page (${activeIdx + 1}/${pages.length}) : ${activePage.width} x ${activePage.height} px`;
      } else {
        canvasInfoDisplay.textContent = `Page (0/0) : 0 x 0 px`;
      }
    }
  };

  // --- Palette Settings ---
  let paletteSettings = {
    count: 20,
    columns: 10
  };

  const baseColors = [
    '#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00',
    '#34C759', '#007AFF', '#5856D6', '#AF52DE', '#A2845E',
    '#1D1D1F', '#F5F5F7', '#FF2D55', '#5AC8FA', '#4CD964',
    '#FF375F', '#FFD60A', '#30D158', '#0A84FF', '#BF5AF2'
  ];

  function generatePalette() {
    const grid = document.getElementById('color-grid');
    if (!grid) return;

    grid.style.setProperty('--cols', paletteSettings.columns.toString());
    grid.innerHTML = '';

    for (let i = 0; i < paletteSettings.count; i++) {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      const color = baseColors[i % baseColors.length];
      swatch.style.background = color;
      swatch.dataset.color = color;

      if (i === 0) swatch.classList.add('active'); // Default black

      swatch.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        canvasManager.setConfig({ color });
        const colorPicker = document.getElementById('color-picker') as HTMLInputElement;
        if (colorPicker) colorPicker.value = color;


        if (toolStates[currentActiveTool]) {
          toolStates[currentActiveTool].color = color;
          updateGlobalIndicator();
        }
      });
      grid.appendChild(swatch);
    }
  }

  // Initialize Canvas Manager with onUpdate callback
  canvasManager = new CanvasManager('main-canvas', () => {
    updatePreview();
  });

  // Initial preview
  // Initial preview
  updatePreview();
  generatePalette();
  generatePalette();
  // Initialize indicators
  updateGlobalIndicator();

  // Zoom Buttons
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => canvasManager.zoomIn());
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => canvasManager.zoomOut());

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
    'tool-text': ICONS.text,
    'tool-eraser': ICONS.eraser,
    'tool-fill': ICONS.bucket,
    'tool-line': ICONS.line,
    'tool-rect': ICONS.rect,
    'tool-circle': ICONS.circle,
    'tool-hand': ICONS.hand,
    'google-login-btn': ICONS.google,
    'export-main-btn': ICONS.download,
    'menu-google-icon': ICONS.google,
    'icon-chevron-stroke': ICONS.chevron,
    'icon-chevron-color': ICONS.chevron,
    'icon-chevron-canvas': ICONS.chevron,
    'menu-header-toggle-left': ICONS.sidebarLeft,
    // 'menu-header-toggle-right' handled dynamically below
    'zoom-in-btn': ICONS.plus,
    'zoom-out-btn': ICONS.minus,
  };

  const updateOrientationIcons = () => {
    const isPortrait = window.matchMedia("(orientation: portrait)").matches;
    const btn = document.getElementById('menu-header-toggle-right');
    if (btn) {
      btn.innerHTML = isPortrait ? ICONS.sidebarBottom : ICONS.sidebarRight;
      btn.setAttribute('data-tooltip', isPortrait ? 'Toggle Bottom Bar (^R)' : 'Toggle Right Sidebar (^R)');
    }

    const menuBtn = document.getElementById('menu-toggle-right');
    const panel = document.querySelector('.properties-panel') as HTMLElement;
    if (menuBtn && panel) {
      const label = isPortrait ? 'Bottom Bar' : 'Toolbar (R)';
      const isHidden = panel.style.display === 'none';
      const verb = isHidden ? 'Show' : 'Hide';
      menuBtn.innerHTML = `${verb} ${label} <span class="shortcut">^R</span>`;
    }
  };
  window.addEventListener('resize', updateOrientationIcons);


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

  // --- Collapsible Sections Logic ---
  const collapsibleHeaders = document.querySelectorAll('.prop-header');
  collapsibleHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.prop-section');
      if (section) {
        section.classList.toggle('collapsed');
      }
    });
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
  // FILE
  const newBookModal = document.getElementById('new-book-modal');
  const closeNewBookModal = () => newBookModal?.classList.add('hidden');

  document.getElementById('menu-new')?.addEventListener('click', () => {
    newBookModal?.classList.remove('hidden');
  });

  document.getElementById('new-book-close')?.addEventListener('click', closeNewBookModal);
  document.getElementById('new-book-cancel-btn')?.addEventListener('click', closeNewBookModal);

  document.getElementById('new-book-create-btn')?.addEventListener('click', () => {
    const wInput = document.getElementById('new-book-width') as HTMLInputElement;
    const hInput = document.getElementById('new-book-height') as HTMLInputElement;
    const width = parseInt(wInput.value);
    const height = parseInt(hInput.value);

    // Initial check for validity
    if (!width || !height || width <= 0 || height <= 0) {
      alert('Please enter valid dimensions.');
      return;
    }

    if (confirm('Create new book? Unsaved changes will be lost.')) {
      canvasManager.clearBook();
      canvasManager.addPage(width, height);

      // Update UI
      const wDisplay = document.getElementById('canvas-width');
      const hDisplay = document.getElementById('canvas-height');
      if (wDisplay) wDisplay.textContent = `${width} px`;
      if (hDisplay) hDisplay.textContent = `${height} px`;

      closeNewBookModal();
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

    const previewLimitInput = document.getElementById('preview-limit') as HTMLInputElement;
    const pLimit = parseInt(previewLimitInput.value);

    const colorCountInput = document.getElementById('color-count') as HTMLInputElement;
    const colorColsInput = document.getElementById('color-columns') as HTMLInputElement;
    const cCount = parseInt(colorCountInput.value);
    const cCols = parseInt(colorColsInput.value);

    let valid = true;

    if (limit && limit >= 10 && limit <= 500) {
      canvasManager.setHistoryLimit(limit);
    } else {
      valid = false;
      alert('Please enter a valid history limit (10-500).');
    }

    if (pLimit && pLimit >= 1 && pLimit <= 100) {
      // Logic handled by updatePreview on next call if needed or immediate pruning
    } else {
      if (valid) alert('Please enter a valid preview limit (1-100).');
      valid = false;
    }

    if (cCount && cCount >= 1 && cCount <= 100) {
      paletteSettings.count = cCount;
    } else {
      if (valid) alert('Please enter a valid color count (1-100).');
      valid = false;
    }

    if (cCols && cCols >= 1 && cCols <= 20) {
      paletteSettings.columns = cCols;
    } else {
      if (valid) alert('Please enter a valid column count (1-20).');
      valid = false;
    }

    if (valid) {
      generatePalette();
      settingsClose();
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
    const isPortrait = window.matchMedia("(orientation: portrait)").matches;
    const label = isPortrait ? 'Bottom Bar' : 'Toolbar (R)';

    if (propPanel.style.display === 'none') {
      propPanel.style.display = 'flex';
      btn.innerHTML = `Hide ${label} <span class="shortcut">^R</span>`;
    } else {
      propPanel.style.display = 'none';
      btn.innerHTML = `Show ${label} <span class="shortcut">^R</span>`;
    }
  }

  document.getElementById('menu-toggle-left')?.addEventListener('click', toggleLeftToolbar);
  document.getElementById('menu-toggle-right')?.addEventListener('click', toggleRightToolbar);

  // Header/Menu Bar Toggles
  document.getElementById('menu-header-toggle-left')?.addEventListener('click', toggleLeftToolbar);
  document.getElementById('menu-header-toggle-right')?.addEventListener('click', toggleRightToolbar);

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

  // switchTool moved below, definitions moved up


  function switchTool(tool: DrawingTool) {
    // Save state of current tool if applicable
    // But since we update state on input change, we might not need to explicit "save" here 
    // unless inputs can change without updating state (which we will prevent).
    // Actually, we should ensuring inputs reflect the NEW tool's state.

    // If switching TO hand, save current tool if it's NOT hand
    if (tool === 'hand') {
      const currentActive = document.querySelector('.tool-btn.active')?.getAttribute('data-tool') as DrawingTool;
      if (currentActive && currentActive !== 'hand') {
        lastTool = currentActive;
      }
    }

    currentActiveTool = tool;

    // Apply state if exists
    if (toolStates[tool]) {
      const state = toolStates[tool];
      canvasManager.setConfig(state);

      // Update UI Inputs
      if (sizeInput) sizeInput.value = state.size.toString();
      if (opacityInput) opacityInput.value = state.opacity.toString();
      if (hardnessInput) hardnessInput.value = state.hardness.toString();
      if (pressureInput) pressureInput.value = state.pressure.toString();
      if (colorPicker) colorPicker.value = state.color;

      updateActiveSwatch(state.color);
    }

    toolButtons.forEach(btn => {
      if (btn.getAttribute('data-tool') === tool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    canvasManager.setTool(tool);
    updateGlobalIndicator();
  }

  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool') as DrawingTool;

      if (tool === 'text') {
        // Allow selection to show indicator, but still show TODO toast
        showToast('TODO : Under Development');
        // Fallthrough to switchTool to update indicator
      }

      // If clicking Hand button specifically
      if (tool === 'hand') {
        const currentActive = document.querySelector('.tool-btn.active')?.getAttribute('data-tool');
        if (currentActive === tool) {
          // If already active, toggle back
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
        case 'f':
          e.preventDefault();
          switchTool('fill');
          break;
        case 'm':
          // Move shortcut removed as per requirement merging into Hand
          break;
        case 't':
          e.preventDefault();
          showToast('TODO : Under Development');
          break;
        // Existing View/Edit shortcuts handled elsewhere (z, l, r)
      }
    }
  });

  const sizeInput = document.getElementById('stroke-size') as HTMLInputElement;
  const opacityInput = document.getElementById('stroke-opacity') as HTMLInputElement;
  const colorPicker = document.getElementById('color-picker') as HTMLInputElement;

  sizeInput.oninput = (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    canvasManager.setConfig({ size: val });
    if (toolStates[currentActiveTool]) {
      toolStates[currentActiveTool].size = val;
      updateGlobalIndicator();
    }
  };
  opacityInput.oninput = (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    canvasManager.setConfig({ opacity: val });
    if (toolStates[currentActiveTool]) {
      toolStates[currentActiveTool].opacity = val;
    }
  };

  const hardnessInput = document.getElementById('stroke-hardness') as HTMLInputElement;
  const pressureInput = document.getElementById('stroke-pressure') as HTMLInputElement;

  if (hardnessInput) {
    hardnessInput.oninput = (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      canvasManager.setConfig({ hardness: val });
      if (toolStates[currentActiveTool]) {
        toolStates[currentActiveTool].hardness = val;
      }
    };
  }

  if (pressureInput) {
    pressureInput.oninput = (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      canvasManager.setConfig({ pressure: val });
      if (toolStates[currentActiveTool]) {
        toolStates[currentActiveTool].pressure = val;
      }
    };
  }
  colorPicker.onchange = (e) => {
    const color = (e.target as HTMLInputElement).value;
    canvasManager.setConfig({ color });
    updateActiveSwatch(color);
    if (toolStates[currentActiveTool]) {
      toolStates[currentActiveTool].color = color;
      updateGlobalIndicator();
    }
  };

  function updateActiveSwatch(color: string) {
    document.querySelectorAll('.color-swatch').forEach(s => {
      if ((s as HTMLElement).dataset.color?.toLowerCase() === color.toLowerCase()) {
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

  // Save Modal Logic
  const saveModal = document.getElementById('save-modal');
  const saveFilenameInput = document.getElementById('save-filename') as HTMLInputElement;
  const saveExtLabel = document.getElementById('save-file-ext');
  const saveFormatRadios = document.querySelectorAll('input[name="save-format"]');
  const saveQualityGroup = document.getElementById('save-quality-group');
  const saveQualityInput = document.getElementById('save-quality') as HTMLInputElement;
  const saveQualityDisplay = document.getElementById('quality-val-display');

  const btnSaveLocal = document.getElementById('btn-save-local');
  const btnSaveDrive = document.getElementById('btn-save-drive');
  const selectedFolderName = document.getElementById('selected-folder-name');

  let selectedFolderId = '';

  const closeSaveModal = () => saveModal?.classList.add('hidden');
  document.getElementById('save-modal-close')?.addEventListener('click', closeSaveModal);

  // Format Change
  saveFormatRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (saveExtLabel) saveExtLabel.textContent = `.${val === 'jpeg' ? 'jpg' : val}`;

      if (val === 'png') {
        saveQualityGroup?.classList.add('hidden');
      } else {
        saveQualityGroup?.classList.remove('hidden');
      }
    });
  });

  // Quality Change
  saveQualityInput?.addEventListener('input', () => {
    if (saveQualityDisplay) saveQualityDisplay.textContent = `${saveQualityInput.value}%`;
  });

  // Save Local
  btnSaveLocal?.addEventListener('click', async () => {
    const filename = (saveFilenameInput.value || 'Untitled') + (saveExtLabel?.textContent || '.png');
    const formatEl = document.querySelector('input[name="save-format"]:checked') as HTMLInputElement;
    const format = formatEl ? formatEl.value : 'png';
    const quality = parseInt(saveQualityInput.value) / 100;

    const originalText = btnSaveLocal.innerHTML;
    btnSaveLocal.textContent = 'Generating...';

    // Default to 'png' if null
    const blob = await canvasManager.getBlob((format || 'png') as any, quality);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      closeSaveModal();
    }
    btnSaveLocal.innerHTML = originalText;
  });

  // Folder Change
  document.getElementById('change-folder-btn')?.addEventListener('click', async () => {
    const folderId = await googleService.showPicker();
    if (folderId) {
      selectedFolderId = folderId;
      if (selectedFolderName) selectedFolderName.textContent = 'Folder Selected';
    }
  });

  // Save Drive
  btnSaveDrive?.addEventListener('click', async () => {
    const filename = (saveFilenameInput.value || 'Untitled') + (saveExtLabel?.textContent || '.png');
    const formatEl = document.querySelector('input[name="save-format"]:checked') as HTMLInputElement;
    const format = formatEl ? formatEl.value : 'png';
    const quality = parseInt(saveQualityInput.value) / 100;

    const originalText = btnSaveDrive.innerHTML;
    btnSaveDrive.textContent = 'Uploading...';

    const blob = await canvasManager.getBlob((format || 'png') as any, quality);
    if (blob) {
      const success = await googleService.uploadToDrive(blob, filename, selectedFolderId);
      if (success) {
        showToast('Saved to Google Drive!');
        closeSaveModal();
      } else {
        showToast('Upload failed.');
      }
    }
    btnSaveDrive.innerHTML = originalText;
  });

  function updateGoogleUI(user: GoogleUser | null) {
    // Menu User UI
    const menuLogin = document.getElementById('menu-google-login');
    const menuInfo = document.getElementById('menu-user-info');
    const menuAvatar = document.getElementById('menu-user-avatar') as HTMLImageElement;
    const menuName = document.getElementById('menu-user-name');

    // Save Modal Drive Elements
    const driveStatus = document.getElementById('drive-status');
    const driveFolderUI = document.getElementById('drive-folder-ui');
    const btnSaveDrive = document.getElementById('btn-save-drive');

    if (user) {
      // Menu
      menuLogin?.classList.add('hidden');
      menuInfo?.classList.remove('hidden');
      if (menuAvatar) menuAvatar.src = user.picture;
      if (menuName) menuName.textContent = user.name;

      // Save Modal
      driveStatus?.classList.remove('hidden');
      driveFolderUI?.classList.remove('hidden');
      btnSaveDrive?.removeAttribute('disabled');

    } else {
      // Menu
      menuLogin?.classList.remove('hidden');
      menuInfo?.classList.add('hidden');

      // Save Modal
      driveStatus?.classList.add('hidden');
      driveFolderUI?.classList.add('hidden');
      btnSaveDrive?.setAttribute('disabled', 'true');
    }
  }

  // New Save Book Logic (Trigger Export Modal)
  // Menu Save
  document.getElementById('menu-save')?.addEventListener('click', () => {
    if (saveFilenameInput && (!saveFilenameInput.value || saveFilenameInput.value === 'Untitled')) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      saveFilenameInput.value = `iDrawBook_${dateStr}_${timeStr}`;
    }
    if (selectedFolderName) selectedFolderName.textContent = 'My Drive (Root)';
    selectedFolderId = '';
    saveModal?.classList.remove('hidden');
  });
  // --- Dynamic Icon Update check ---
  updateOrientationIcons();


  // --- New Page Logic ---
  const addPageBtn = document.getElementById('add-page-btn');
  const newPageModal = document.getElementById('new-page-modal');
  const newPageClose = document.getElementById('new-page-close');
  const newPageCancel = document.getElementById('new-page-cancel-btn');
  const newPageCreate = document.getElementById('new-page-create-btn');

  addPageBtn?.addEventListener('click', () => {
    newPageModal?.classList.remove('hidden');
    // Default to current page size or 1024
    const size = canvasManager.getPixelSize();
    const wInput = document.getElementById('new-page-width') as HTMLInputElement;
    const hInput = document.getElementById('new-page-height') as HTMLInputElement;
    if (wInput) wInput.value = (size.width || 1024).toString();
    if (hInput) hInput.value = (size.height || 1024).toString();
  });

  const closeNewPageModal = () => {
    newPageModal?.classList.add('hidden');
  };

  newPageClose?.addEventListener('click', closeNewPageModal);
  newPageCancel?.addEventListener('click', closeNewPageModal);

  newPageCreate?.addEventListener('click', () => {
    const wInput = document.getElementById('new-page-width') as HTMLInputElement;
    const hInput = document.getElementById('new-page-height') as HTMLInputElement;

    const width = parseInt(wInput.value) || 1024;
    const height = parseInt(hInput.value) || 1024;

    // Limit max size
    const w = Math.min(Math.max(width, 100), 5000);
    const h = Math.min(Math.max(height, 100), 5000);

    canvasManager.addPage(w, h);
    closeNewPageModal();
  });
});
