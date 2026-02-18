import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasManager } from '../canvas/canvas-manager';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: {
        workerSrc: ''
    },
    getDocument: vi.fn(() => ({
        promise: Promise.resolve({
            numPages: 2,
            getPage: vi.fn((pageNumber) => Promise.resolve({
                getViewport: vi.fn(() => ({ width: 100, height: 200 })),
                render: vi.fn(() => ({
                    promise: Promise.resolve()
                }))
            }))
        })
    }))
}));

// Mock toast
vi.mock('../ui/toast', () => ({
    showToast: vi.fn()
}));

// Mock createImageBitmap
global.createImageBitmap = vi.fn().mockImplementation(() => {
    return Promise.resolve({
        width: 100,
        height: 100,
        close: () => { }
    });
});

describe('CanvasManager - File Loading', () => {
    let canvasManager: CanvasManager;
    let container: HTMLElement;

    beforeEach(() => {
        // Mock matchMedia
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(), // deprecated
                removeListener: vi.fn(), // deprecated
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });

        container = document.createElement('div');
        container.id = 'canvas-container';
        document.body.appendChild(container);

        // Mock HTMLCanvasElement.prototype.getContext globally
        HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId) => {
            return {
                scale: vi.fn(),
                translate: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                clearRect: vi.fn(),
                drawImage: vi.fn(),
                canvas: document.createElement('canvas'),
                measureText: vi.fn(() => ({ width: 0 })),
                fillText: vi.fn(),
                stroke: vi.fn(),
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                setTransform: vi.fn(),
                fillRect: vi.fn(),
                strokeRect: vi.fn(),
            };
        }) as any;

        const canvas = document.createElement('canvas');
        canvas.id = 'main-canvas';
        container.appendChild(canvas);

        canvasManager = new CanvasManager('main-canvas', () => { });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('loadFromBlob', () => {
        it('should load image and clear canvas by default', async () => {
            const blob = new Blob([''], { type: 'image/png' });

            // Spy on internal methods or page manager
            const clearSpy = vi.spyOn(canvasManager['pageManager'], 'clear');
            const addPageSpy = vi.spyOn(canvasManager, 'addPage');

            await canvasManager.loadFromBlob(blob);

            expect(createImageBitmap).toHaveBeenCalledWith(blob);
            expect(clearSpy).toHaveBeenCalled();
            expect(addPageSpy).toHaveBeenCalledWith(100, 100);
        });

        it('should load image and append page if shouldClear is false', async () => {
            const blob = new Blob([''], { type: 'image/png' });
            const clearSpy = vi.spyOn(canvasManager['pageManager'], 'clear');

            await canvasManager.loadFromBlob(blob, false);

            expect(clearSpy).not.toHaveBeenCalled();
        });


        it('should load PDF and render all pages', async () => {
            const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

            // Mock Blob.arrayBuffer which is not implemented in jsdom by default for Blob constructor?
            // Actually it is, but let's mock it to be safe or control output
            blob.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(10));

            // Spy on internal methods
            const clearSpy = vi.spyOn(canvasManager['pageManager'], 'clear');
            const addPageSpy = vi.spyOn(canvasManager, 'addPage');
            const renderSpy = vi.spyOn(canvasManager, 'render');

            await canvasManager.loadFromBlob(blob, true);

            const pdfjs = await import('pdfjs-dist');
            // Check if getDocument was called
            expect(pdfjs.getDocument).toHaveBeenCalled();

            // Check clearing
            expect(clearSpy).toHaveBeenCalled();

            // Check pages added (mock has 2 pages)
            expect(addPageSpy).toHaveBeenCalledTimes(2);

            // Check render called at the end
            expect(renderSpy).toHaveBeenCalled();
        });

        it('should handle unsupported file types', async () => {
            const blob = new Blob([''], { type: 'text/plain' });
            const { showToast } = await import('../ui/toast');

            await canvasManager.loadFromBlob(blob);

            expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Unsupported file type'));
        });

        it('should handle errors gracefully', async () => {
            const blob = new Blob([''], { type: 'image/png' });
            (global.createImageBitmap as any).mockRejectedValue(new Error('Failed'));
            const { showToast } = await import('../ui/toast');

            await canvasManager.loadFromBlob(blob);

            expect(showToast).toHaveBeenCalledWith('Failed to open file.');
        });
    });
});
