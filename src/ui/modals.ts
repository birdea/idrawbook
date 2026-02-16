import { CanvasManager } from '../canvas/canvas-manager';
import { GoogleService } from '../google';
import { showToast } from './toast';

export class ModalManager {
    private selectedFolderId: string = '';
    private canvasManager: CanvasManager;
    private googleService: GoogleService;

    constructor(canvasManager: CanvasManager, googleService: GoogleService) {
        this.canvasManager = canvasManager;
        this.googleService = googleService;
        this.setupListeners();
    }

    private setupListeners() {
        // New Book Modal
        const newBookModal = document.getElementById('new-book-modal');
        const closeNewBookModal = () => newBookModal?.classList.add('hidden');
        document.getElementById('menu-new')?.addEventListener('click', () => newBookModal?.classList.remove('hidden'));
        document.getElementById('new-book-close')?.addEventListener('click', closeNewBookModal);
        document.getElementById('new-book-cancel-btn')?.addEventListener('click', closeNewBookModal);
        document.getElementById('new-book-create-btn')?.addEventListener('click', () => {
            const wInput = document.getElementById('new-book-width') as HTMLInputElement;
            const hInput = document.getElementById('new-book-height') as HTMLInputElement;
            const width = parseInt(wInput.value);
            const height = parseInt(hInput.value);

            if (!width || !height || width <= 0 || height <= 0) {
                alert('Please enter valid dimensions.');
                return;
            }

            if (confirm('Create new book? Unsaved changes will be lost.')) {
                this.canvasManager.clear();
                this.canvasManager.pageManager.clear();
                this.canvasManager.addPage(width, height);

                const wDisplay = document.getElementById('canvas-width');
                const hDisplay = document.getElementById('canvas-height');
                if (wDisplay) wDisplay.textContent = `${width} px`;
                if (hDisplay) hDisplay.textContent = `${height} px`;

                closeNewBookModal();
            }
        });

        // Settings Modal
        const settingsModal = document.getElementById('settings-modal');
        const settingsClose = () => settingsModal?.classList.add('hidden');
        document.getElementById('menu-settings')?.addEventListener('click', () => settingsModal?.classList.remove('hidden'));
        document.getElementById('settings-close')?.addEventListener('click', settingsClose);
        document.getElementById('settings-cancel-btn')?.addEventListener('click', settingsClose);

        // Save Modal
        const saveModal = document.getElementById('save-modal');
        const closeSaveModal = () => saveModal?.classList.add('hidden');
        const saveFilenameInput = document.getElementById('save-filename') as HTMLInputElement;
        const saveExtLabel = document.getElementById('save-file-ext');
        const saveQualityInput = document.getElementById('save-quality') as HTMLInputElement;
        const btnSaveLocal = document.getElementById('btn-save-local') as HTMLButtonElement;
        const btnSaveDrive = document.getElementById('btn-save-drive') as HTMLButtonElement;

        document.getElementById('save-modal-close')?.addEventListener('click', closeSaveModal);
        document.getElementById('menu-save')?.addEventListener('click', () => {
            if (saveFilenameInput && (!saveFilenameInput.value || saveFilenameInput.value === 'Untitled')) {
                const now = new Date();
                const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
                const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
                saveFilenameInput.value = `iDrawBook_${dateStr}_${timeStr}`;
            }
            saveModal?.classList.remove('hidden');
        });

        btnSaveLocal?.addEventListener('click', async () => {
            const filename = (saveFilenameInput.value || 'Untitled') + (saveExtLabel?.textContent || '.png');
            const formatEl = document.querySelector('input[name="save-format"]:checked') as HTMLInputElement;
            const format = formatEl ? formatEl.value : 'png';
            const quality = parseInt(saveQualityInput.value) / 100;

            const originalText = btnSaveLocal.innerHTML;
            btnSaveLocal.textContent = 'Generating...';

            const blob = await this.canvasManager.getBlob(format as any, quality);
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

        btnSaveDrive?.addEventListener('click', async () => {
            const filename = (saveFilenameInput.value || 'Untitled') + (saveExtLabel?.textContent || '.png');
            const formatEl = document.querySelector('input[name="save-format"]:checked') as HTMLInputElement;
            const format = formatEl ? formatEl.value : 'png';
            const quality = parseInt(saveQualityInput.value) / 100;

            const originalText = btnSaveDrive.innerHTML;
            btnSaveDrive.textContent = 'Uploading...';

            const blob = await this.canvasManager.getBlob(format as any, quality);
            if (blob) {
                let mimeType = 'image/png';
                if (format === 'jpeg') mimeType = 'image/jpeg';
                if (format === 'pdf') mimeType = 'application/pdf';

                const success = await this.googleService.uploadToDrive(blob, filename, mimeType, this.selectedFolderId);
                if (success) {
                    showToast('Saved to Google Drive!');
                    closeSaveModal();
                } else {
                    showToast('Upload failed.');
                }
            }
            btnSaveDrive.innerHTML = originalText;
        });

        document.getElementById('change-folder-btn')?.addEventListener('click', async () => {
            const folderId = await this.googleService.showPicker();
            if (folderId) {
                this.selectedFolderId = folderId;
                const selectedFolderName = document.getElementById('selected-folder-name');
                if (selectedFolderName) selectedFolderName.textContent = 'Folder Selected';
            }
        });

        // Save Format/Quality handlers
        const saveFormatRadios = document.querySelectorAll('input[name="save-format"]');
        const saveQualityGroup = document.getElementById('save-quality-group');
        const saveQualityDisplay = document.getElementById('quality-val-display');

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

        saveQualityInput?.addEventListener('input', () => {
            if (saveQualityDisplay) saveQualityDisplay.textContent = `${saveQualityInput.value}%`;
        });

        // New Page Modal
        const newPageModal = document.getElementById('new-page-modal');
        const closeNewPageModal = () => newPageModal?.classList.add('hidden');
        document.getElementById('add-page-btn')?.addEventListener('click', () => {
            newPageModal?.classList.remove('hidden');
            const size = this.canvasManager.getPixelSize();
            const wInput = document.getElementById('new-page-width') as HTMLInputElement;
            const hInput = document.getElementById('new-page-height') as HTMLInputElement;
            if (wInput) wInput.value = (size.width || 1024).toString();
            if (hInput) hInput.value = (size.height || 1024).toString();
        });
        document.getElementById('new-page-close')?.addEventListener('click', closeNewPageModal);
        document.getElementById('new-page-cancel-btn')?.addEventListener('click', closeNewPageModal);
        document.getElementById('new-page-create-btn')?.addEventListener('click', () => {
            const wInput = document.getElementById('new-page-width') as HTMLInputElement;
            const hInput = document.getElementById('new-page-height') as HTMLInputElement;
            const width = parseInt(wInput.value) || 1024;
            const height = parseInt(hInput.value) || 1024;
            this.canvasManager.addPage(Math.min(Math.max(width, 100), 5000), Math.min(Math.max(height, 100), 5000));
            closeNewPageModal();
        });
    }
}
