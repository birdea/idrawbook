import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModalManager } from '../ui/modals';
import { CanvasManager } from '../canvas/canvas-manager';
import { GoogleService } from '../google';

// Mock dependencies
vi.mock('../canvas/canvas-manager', () => ({
    CanvasManager: class {
        clear = vi.fn();
        getBlob = vi.fn();
        addPage = vi.fn();
        getPixelSize = vi.fn(() => ({ width: 800, height: 600 }));
        loadFromBlob = vi.fn();
    }
}));

vi.mock('../google', () => ({
    GoogleService: class {
        uploadToDrive = vi.fn();
        showPicker = vi.fn();
        showFilePicker = vi.fn();
        downloadFile = vi.fn();
    }
}));

vi.mock('../ui/toast', () => ({
    showToast: vi.fn(),
}));

vi.mock('../ui/modal-templates', () => ({
    injectModals: vi.fn(),
}));

describe('ModalManager', () => {
    let modalManager: ModalManager;
    let canvasManagerMock: CanvasManager;
    let googleServiceMock: GoogleService;

    // Helper to setup DOM
    const setupDOM = () => {
        document.body.innerHTML = `
            <!-- Menu Items -->
            <div id="menu-new-book"></div>
            <div id="menu-settings"></div>
            <div id="menu-save-book"></div>
            <div id="menu-save-book"></div>
            <div id="add-page-btn"></div>
            <div id="menu-open-book"></div>
            <div id="menu-open-page"></div>
            
            <!-- New Book Modal -->
            <div id="new-book-modal" class="hidden">
                <input id="new-book-width" value="800" />
                <input id="new-book-height" value="600" />
                <button id="new-book-close"></button>
                <button id="new-book-cancel-btn"></button>
                <button id="new-book-create-btn"></button>
            </div>
            
            <!-- Settings Modal -->
            <div id="settings-modal" class="hidden">
                 <button id="settings-close"></button>
                 <button id="settings-cancel-btn"></button>
            </div>
            
            <!-- Save Modal -->
            <div id="save-modal" class="hidden">
                <input id="save-filename" />
                <span id="save-file-ext">.png</span>
                <input id="save-quality" value="80" />
                <span id="quality-val-display">80%</span>
                <div id="save-quality-group" class="hidden"></div>
                
                <input type="radio" name="save-format" value="png" checked />
                <input type="radio" name="save-format" value="jpeg" />
                <input type="radio" name="save-format" value="pdf" />
                
                <button id="save-modal-close"></button>
                <button id="btn-save-local"></button>
                <button id="btn-save-drive"></button>
                <button id="change-folder-btn"></button>
                <span id="selected-folder-name"></span>
            </div>
            
            <!-- New Page Modal -->
            <div id="new-page-modal" class="hidden">
                <input id="new-page-width" />
                <input id="new-page-height" />
                <button id="new-page-close"></button>
                <button id="new-page-cancel-btn"></button>
                <button id="new-page-create-btn"></button>
            </div>
            
            <!-- Status Display -->
            <div id="canvas-width"></div>
            <div id="canvas-height"></div>
            
            <!-- Open Book Modal -->
            <div id="open-book-modal" class="hidden">
                 <h3>Title</h3>
                 <button id="open-book-close"></button>
                 <button id="open-book-cancel-btn"></button>
                 <input id="local-file-input" type="file" />
                 <button id="btn-open-local"></button>
                 <button id="btn-open-drive"></button>
            </div>
        `;
    };

    beforeEach(() => {
        setupDOM();
        canvasManagerMock = new CanvasManager('test', () => { }) as any;
        googleServiceMock = new GoogleService(() => { }) as any;
        modalManager = new ModalManager(canvasManagerMock, googleServiceMock);

        // Mock window confirm/alert
        vi.spyOn(window, 'confirm').mockImplementation(() => true);
        vi.spyOn(window, 'alert').mockImplementation(() => { });

        // Mock URL.createObjectURL and revokeObjectURL
        if (!window.URL) {
            (window as any).URL = {};
        }
        window.URL.createObjectURL = vi.fn(() => 'blob:url');
        window.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('New Book Modal', () => {
        it('should show modal on menu click', () => {
            document.getElementById('menu-new-book')?.click();
            expect(document.getElementById('new-book-modal')?.classList.contains('hidden')).toBe(false);
        });

        it('should hide modal on close/cancel', () => {
            const modal = document.getElementById('new-book-modal');
            modal?.classList.remove('hidden');

            document.getElementById('new-book-close')?.click();
            expect(modal?.classList.contains('hidden')).toBe(true);

            modal?.classList.remove('hidden');
            document.getElementById('new-book-cancel-btn')?.click();
            expect(modal?.classList.contains('hidden')).toBe(true);
        });

        it('should create new book on confirm', () => {
            const widthInput = document.getElementById('new-book-width') as HTMLInputElement;
            const heightInput = document.getElementById('new-book-height') as HTMLInputElement;
            widthInput.value = '500';
            heightInput.value = '400';

            document.getElementById('new-book-create-btn')?.click();

            expect(window.confirm).toHaveBeenCalled();
            expect(canvasManagerMock.clear).toHaveBeenCalledWith(500, 400);
            expect(document.getElementById('canvas-width')?.textContent).toBe('500 px');
            expect(document.getElementById('new-book-modal')?.classList.contains('hidden')).toBe(true);
        });

        it('should validation dimensions', () => {
            const widthInput = document.getElementById('new-book-width') as HTMLInputElement;
            widthInput.value = '-100';

            document.getElementById('new-book-create-btn')?.click();

            expect(canvasManagerMock.clear).not.toHaveBeenCalled();
        });
    });

    describe('Save Modal', () => {
        it('should prepare default filename on open', () => {
            document.getElementById('menu-save-book')?.click();
            const input = document.getElementById('save-filename') as HTMLInputElement;
            expect(input.value).toContain('iDrawBook_');
        });

        it('should update extension when format changes', () => {
            document.getElementById('menu-save-book')?.click();
            const radioJpeg = document.querySelector('input[name="save-format"][value="jpeg"]') as HTMLInputElement;
            radioJpeg.click();
            radioJpeg.dispatchEvent(new Event('change', { bubbles: true })); // Manually trigger change

            expect(document.getElementById('save-file-ext')?.textContent).toBe('.jpg');
            expect(document.getElementById('save-quality-group')?.classList.contains('hidden')).toBe(false);
        });

        it('save local should download file', async () => {
            (canvasManagerMock.getBlob as any).mockResolvedValue(new Blob(['test']));
            const linkSpy = vi.spyOn(document, 'createElement');

            const saveBtn = document.getElementById('btn-save-local');
            await saveBtn?.click();

            expect(canvasManagerMock.getBlob).toHaveBeenCalled();
            expect(linkSpy).toHaveBeenCalledWith('a');
            expect(window.URL.createObjectURL).toHaveBeenCalled();
        });

        it('save drive should upload file', async () => {
            (canvasManagerMock.getBlob as any).mockResolvedValue(new Blob(['test']));
            (googleServiceMock.uploadToDrive as any).mockResolvedValue(true);

            const saveBtn = document.getElementById('btn-save-drive');
            await saveBtn?.click();

            expect(canvasManagerMock.getBlob).toHaveBeenCalled();
            expect(googleServiceMock.uploadToDrive).toHaveBeenCalled();
        });

        it('should handle folder selection', async () => {
            (googleServiceMock.showPicker as any).mockResolvedValue('folder-123');

            await document.getElementById('change-folder-btn')?.click();

            expect(googleServiceMock.showPicker).toHaveBeenCalled();
            expect((modalManager as any).selectedFolderId).toBe('folder-123');
            expect(document.getElementById('selected-folder-name')?.textContent).toBe('Folder Selected');
        });
    });

    describe('New Page Modal', () => {
        it('should populate dimensions from canvas size', () => {
            document.getElementById('add-page-btn')?.click();

            const wInput = document.getElementById('new-page-width') as HTMLInputElement;
            const hInput = document.getElementById('new-page-height') as HTMLInputElement;

            expect(canvasManagerMock.getPixelSize).toHaveBeenCalled();
            expect(wInput.value).toBe('800'); // Mocked return
            expect(hInput.value).toBe('600');
        });

        it('should add page on create', () => {
            document.getElementById('add-page-btn')?.click();

            const wInput = document.getElementById('new-page-width') as HTMLInputElement;
            wInput.value = '1200';

            document.getElementById('new-page-create-btn')?.click();

            expect(canvasManagerMock.addPage).toHaveBeenCalledWith(1200, 600); // 600 from default populate
            expect(document.getElementById('new-page-modal')?.classList.contains('hidden')).toBe(true);
        });
    });
    describe('Open Book Modal', () => {
        it('should show modal as Open Book', () => {
            document.getElementById('menu-open-book')?.click();
            const modal = document.getElementById('open-book-modal');
            expect(modal?.classList.contains('hidden')).toBe(false);
            expect(modal?.querySelector('h3')?.textContent).toBe('Open Book');
        });

        it('should show modal as Open Page', () => {
            document.getElementById('menu-open-page')?.click();
            const modal = document.getElementById('open-book-modal');
            expect(modal?.classList.contains('hidden')).toBe(false);
            expect(modal?.querySelector('h3')?.textContent).toBe('Open Page');
        });

        it('should load local file as Book (clear)', async () => {
            document.getElementById('menu-open-book')?.click();

            const fileInput = document.getElementById('local-file-input') as HTMLInputElement;
            const file = new File(['test'], 'test.png', { type: 'image/png' });

            // Simulate file selection
            Object.defineProperty(fileInput, 'files', {
                value: [file]
            });

            await fileInput.dispatchEvent(new Event('change'));

            expect(canvasManagerMock.loadFromBlob).toHaveBeenCalledWith(file, true);
        });

        it('should load local file as Page (append)', async () => {
            document.getElementById('menu-open-page')?.click();

            const fileInput = document.getElementById('local-file-input') as HTMLInputElement;
            const file = new File(['test'], 'test.png', { type: 'image/png' });

            // Simulate file selection
            Object.defineProperty(fileInput, 'files', {
                value: [file]
            });

            await fileInput.dispatchEvent(new Event('change'));

            expect(canvasManagerMock.loadFromBlob).toHaveBeenCalledWith(file, false);
        });

        it('should load drive file as Book', async () => {
            document.getElementById('menu-open-book')?.click();
            (googleServiceMock.showFilePicker as any).mockResolvedValue('file-123');
            (googleServiceMock.downloadFile as any).mockResolvedValue(new Blob(['test'], { type: 'image/png' }));

            await document.getElementById('btn-open-drive')?.click();

            expect(googleServiceMock.showFilePicker).toHaveBeenCalled();
            expect(googleServiceMock.downloadFile).toHaveBeenCalledWith('file-123');
            // Wait for async operations in the event listener
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(canvasManagerMock.loadFromBlob).toHaveBeenCalledWith(expect.any(Blob), true);
        });

        it('should load drive file as Page', async () => {
            document.getElementById('menu-open-page')?.click();
            (googleServiceMock.showFilePicker as any).mockResolvedValue('file-123');
            (googleServiceMock.downloadFile as any).mockResolvedValue(new Blob(['test'], { type: 'image/png' }));

            await document.getElementById('btn-open-drive')?.click();

            // Wait for async operations in the event listener
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(canvasManagerMock.loadFromBlob).toHaveBeenCalledWith(expect.any(Blob), false);
        });
    });
    it('should handle drive upload failure', async () => {
        (canvasManagerMock.getBlob as any).mockResolvedValue(new Blob(['test']));
        (googleServiceMock.uploadToDrive as any).mockResolvedValue(false);

        const saveBtn = document.getElementById('btn-save-drive');
        await saveBtn?.click();

        expect(googleServiceMock.uploadToDrive).toHaveBeenCalled();
        // Check if toast was called? mock toast properly if needed.
        // The mock for toast is at top level:
        // vi.mock('../ui/toast', () => ({ showToast: vi.fn() }));
        const { showToast } = await import('../ui/toast');
        expect(showToast).toHaveBeenCalledWith('Upload failed.');
    });
});



