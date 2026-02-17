import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CanvasManager } from '../canvas/canvas-manager';


// Mock TextAction
vi.mock('../actions/text-action', () => {
    return {
        TextAction: vi.fn().mockImplementation(function (this: any) {
            this.hitTest = vi.fn().mockReturnValue(true);
            this.pageId = 'page1';
            this.draw = vi.fn();
            this.text = 'mock text';
            this.placement = { pageId: 'page1', localX: 0, localY: 0 };
        })
    };
});

// Mock TextTool
vi.mock('../tools/text-tool', () => {
    return {
        TextTool: vi.fn().mockImplementation(function () {
            return {
                isEditing: vi.fn().mockReturnValue(false),
                commitText: vi.fn(),
                startEditing: vi.fn(),
                startReEditing: vi.fn(),
                getEditingActionIndex: vi.fn().mockReturnValue(-1),
                activate: vi.fn(),
                deactivate: vi.fn().mockImplementation(function (this: any) {
                    if (this.isEditing()) this.commitText();
                }),
                onDown: vi.fn(),
                onMove: vi.fn(),
                onUp: vi.fn(),
                cancel: vi.fn()
            };
        })
    };
});

// Mock jsPDF
const mockSave = vi.fn();
const mockAddPage = vi.fn();
const mockAddImage = vi.fn();
const mockOutput = vi.fn().mockReturnValue(new Blob());

vi.mock('jspdf', () => {
    return {
        jsPDF: vi.fn().mockImplementation(function () {
            return {
                save: mockSave,
                addPage: mockAddPage,
                addImage: mockAddImage,
                output: mockOutput,
                internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } }
            };
        })
    };
});

describe('CanvasManager', () => {
    let canvas: HTMLCanvasElement;
    let manager: CanvasManager;
    let container: HTMLElement;
    let onUpdateSpy: any;

    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            }))
        });

        document.body.innerHTML = '<div id="app"><canvas id="main-canvas"></canvas><div id="zoom-level"></div></div>';
        canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
        canvas.setPointerCapture = vi.fn();
        canvas.releasePointerCapture = vi.fn();
        container = document.getElementById('app') as HTMLElement;

        const mockContext = {
            canvas: canvas,
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            strokeRect: vi.fn(),
            fill: vi.fn(),
            closePath: vi.fn(),
            rect: vi.fn(),
            arc: vi.fn(),
            setTransform: vi.fn(),
            scale: vi.fn(),
            translate: vi.fn(),
            getImageData: vi.fn().mockReturnValue({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
            putImageData: vi.fn(),
            createImageData: vi.fn(),
            shadowBlur: 0,
            globalAlpha: 1,
            globalCompositeOperation: 'source-over'
        } as unknown as CanvasRenderingContext2D;

        HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext);

        onUpdateSpy = vi.fn();

        // Mock getBoundingClientRec
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
            width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => { }
        });

        // Mock requestAnimationFrame
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0);
            return 0;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { });

        Object.defineProperty(canvas, 'parentElement', {
            value: container,
            writable: true
        });
        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
            width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => { }
        });

        manager = new CanvasManager('main-canvas', onUpdateSpy);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should initialize with one page', () => {
        const pages = (manager as any).pageManager.getAll();
        expect(pages.length).toBe(1);
    });

    it('should add a page', () => {
        manager.addPage(500, 500);
        const pages = (manager as any).pageManager.getAll();
        expect(pages.length).toBe(2);
    });

    it('should set tool via manager', () => {
        manager.setTool('brush');
        expect(manager.currentTool).toBe('brush');
    });

    it('should update config', () => {
        manager.setConfig({ size: 20 });
        expect(manager.config.size).toBe(20);
    });

    it('should handle pointer down (start drawing)', () => {
        manager.setTool('pencil');
        canvas.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, pointerId: 1, clientX: 100, clientY: 100, pressure: 0.5, pointerType: 'pen'
        }));
        // Just ensure no crash. Detailed logic is inside FreehandTool which is mocked implicitly or real?
        // Wait, ToolManager imports real FreehandTool.
        // And FreehandTool is NOT mocked here.
        // So FreehandTool runs.
        // It should call historyManager.push eventually on UP.
    });

    it('should handle pointer up (finish drawing)', () => {
        manager.setTool('pencil');
        // Star
        canvas.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, pointerId: 1, clientX: 100, clientY: 100
        }));
        // Move
        canvas.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true, pointerId: 1, clientX: 110, clientY: 110
        }));

        // Mock HistoryManager push
        const historyMock = vi.spyOn(manager.historyManager, 'push');

        // Up
        canvas.dispatchEvent(new PointerEvent('pointerup', {
            bubbles: true, pointerId: 1, clientX: 110, clientY: 110
        }));

        expect(historyMock).toHaveBeenCalled();
    });

    it('should commit text on tool change', () => {
        manager.setTool('text');
        const textTool = manager.textTool as any;
        textTool.isEditing.mockReturnValue(true);

        manager.setTool('pen');
        expect(textTool.commitText).toHaveBeenCalled();
    });

    it('should dispatch onDown to text tool on click', () => {
        manager.setTool('text');
        const textTool = manager.textTool as any;

        // Click
        canvas.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, pointerId: 1, clientX: 10, clientY: 10
        }));

        expect(textTool.onDown).toHaveBeenCalled();
    });

    it('should pan with hand tool', () => {
        manager.setTool('hand');

        canvas.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, pointerId: 1, clientX: 2000, clientY: 100 // Outside page
        }));

        expect(canvas.style.cursor).toBe('grabbing');

        canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
        expect(canvas.style.cursor).toBe('grab');
    });

    it('should move page with hand tool', () => {
        manager.setTool('hand');

        // Click on page (0,0)
        canvas.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, pointerId: 1, clientX: 10, clientY: 10
        }));

        expect(canvas.style.cursor).toBe('move');
    });
});
