export const MODAL_TEMPLATES = {
    save: `
  <div id="save-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Save File</h3>
        <button id="save-modal-close" class="close-btn">&times;</button>
      </div>
      <div class="modal-body">

        <!-- File Name -->
        <div class="input-group">
          <label>File Name</label>
          <div class="filename-input-wrapper">
            <input type="text" id="save-filename" value="Untitled" placeholder="Enter filename">
            <span id="save-file-ext" class="extension-label">.png</span>
          </div>
        </div>

        <!-- Format -->
        <div class="input-group">
          <label>Format</label>
          <div class="format-options">
            <label class="radio-label">
              <input type="radio" name="save-format" value="png" checked> PNG
            </label>
            <label class="radio-label">
              <input type="radio" name="save-format" value="jpeg"> JPG
            </label>
            <label class="radio-label">
              <input type="radio" name="save-format" value="pdf"> PDF
            </label>
          </div>
        </div>

        <!-- Quality Slider (Conditional) -->
        <div class="input-group hidden" id="save-quality-group">
          <div class="flex-between">
            <label>Quality</label>
            <span id="quality-val-display">80%</span>
          </div>
          <input type="range" id="save-quality" min="10" max="100" value="80">
        </div>

        <div class="modal-separator"></div>

        <!-- Save Actions -->
        <div class="save-actions-grid">
          <!-- Local Save -->
          <div class="action-block">
            <h4>Local Storage</h4>
            <button id="btn-save-local" class="btn-primary full-width">
              Download
            </button>
          </div>

          <!-- Drive Save (Logged Out) -->
          <div id="drive-login-ui" class="action-block">
            <div class="flex-between">
              <h4>Google Drive</h4>
              <span class="status-badge" style="background: var(--apple-text-secondary);">Logged Out</span>
            </div>
            <p style="font-size: 11px; color: var(--apple-text-secondary); margin: 4px 0;">Sign in to save directly to
              your Drive.</p>
            <button id="google-login-btn" class="btn-secondary full-width">
              <span id="save-google-icon" class="icon-left"
                style="width: 14px; height: 14px; margin-right: 6px;"></span>
              Sign in with Google
            </button>
          </div>

          <!-- Drive Save (Logged In) -->
          <div id="drive-save-ui" class="action-block hidden">
            <div class="flex-between">
              <h4>Google Drive</h4>
              <span id="drive-status" class="status-badge">Logged In</span>
            </div>
            <!-- Folder Selection -->
            <div id="drive-folder-ui" class="folder-select-mini">
              <span class="folder-icon">📂</span>
              <span id="selected-folder-name" class="folder-name">My Drive</span>
              <button id="change-folder-btn" class="btn-link">Change</button>
            </div>
            <button id="btn-save-drive" class="btn-secondary full-width">
              Save to Drive
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
    `,
    mobileBottomBar: `
  <div class="mobile-bottom-bar hidden-desktop" id="mobile-bottom-bar">
    <!-- Buttons will be injected dynamically -->
  </div>
    `,
    mobileGeneric: `
  <div id="mobile-generic-modal" class="modal-overlay hidden">
    <div class="modal-content bottom-sheet">
      <div class="modal-header">
        <h3 id="mobile-modal-title">Settings</h3>
        <button id="mobile-modal-close" class="close-btn">&times;</button>
      </div>
      <div class="modal-body" id="mobile-modal-body">
        <!-- Section content will be moved here dynamically -->
      </div>
    </div>
  </div>
    `,
    settings: `
  <div id="settings-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Settings</h3>
        <button id="settings-close" class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="input-group">
          <label>History Limit (Undo/Redo)</label>
          <input type="number" id="history-limit" value="100" min="10" max="500">
          <span class="hint">Max number of actions to remember.</span>
        </div>

        <div class="input-group">
          <label>Total Colors in Palette</label>
          <input type="number" id="color-count" value="20" min="1" max="100">
        </div>
        <div class="input-group">
          <label>Max Colors per Row</label>
          <input type="number" id="color-columns" value="10" min="1" max="20">
        </div>
      </div>
      <div class="modal-footer" style="justify-content: space-between;">
        <span class="version-info"></span>
        <div style="display: flex; gap: 10px;">
          <button id="settings-cancel-btn" class="btn-text">Cancel</button>
          <button id="settings-save-btn" class="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
    `,
    newBook: `
  <div id="new-book-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <div class="modal-header">
        <h3>New Book</h3>
        <button id="new-book-close" class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="input-group">
          <label>Width (px)</label>
          <input type="number" id="new-book-width" value="1024" min="100" max="10000">
        </div>
        <div class="input-group">
          <label>Height (px)</label>
          <input type="number" id="new-book-height" value="1024" min="100" max="10000">
        </div>
      </div>
      <div class="modal-footer">
        <button id="new-book-cancel-btn" class="btn-text">Cancel</button>
        <button id="new-book-create-btn" class="btn-primary">Create</button>
      </div>
    </div>
  </div>
    `,
    newPage: `
  <div id="new-page-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <div class="modal-header">
        <h3>New Page</h3>
        <button id="new-page-close" class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="input-group">
          <label>Width (px)</label>
          <input type="number" id="new-page-width" value="1024" min="100" max="5000">
        </div>
        <div class="input-group">
          <label>Height (px)</label>
          <input type="number" id="new-page-height" value="1024" min="100" max="5000">
        </div>
      </div>
      <div class="modal-footer">
        <button id="new-page-cancel-btn" class="btn-text">Cancel</button>
        <button id="new-page-create-btn" class="btn-primary">Add Page</button>
      </div>
    </div>
  </div>
    `
};

export function injectModals() {
    Object.values(MODAL_TEMPLATES).forEach(template => {
        document.body.insertAdjacentHTML('beforeend', template);
    });
}
