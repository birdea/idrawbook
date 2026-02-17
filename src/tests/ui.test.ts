import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showToast } from '../ui/toast';
import { injectIcons, updateOrientationIcons } from '../ui/icon-injector';
import { generatePalette, updateActiveSwatch } from '../ui/palette';
import { ToolStateManager } from '../ui/tool-state';
import { CanvasManager } from '../canvas/canvas-manager';

// Mock CanvasManager
vi.mock('../canvas/canvas-manager', () => {
    return {
        CanvasManager: class {
            setConfig = vi.fn();
            setTool = vi.fn();
            constructor() { }
        }
    };
});

// Mock svg-icons
vi.mock('../ui/svg-icons', () => ({
    ICONS: {
        clear: 'svg-clear',
        pencil: 'svg-pencil',
        brush: 'svg-brush',
        pen: 'svg-pen',
        text: 'svg-text',
        eraser: 'svg-eraser',
        bucket: 'svg-bucket',
        line: 'svg-line',
        rect: 'svg-rect',
        circle: 'svg-circle',
        hand: 'svg-hand',
        google: 'svg-google',
        download: 'svg-download',
        chevron: 'svg-chevron',
        chevronRight: 'svg-chevron-right',
        sidebarLeft: 'svg-sidebar-left',
        plus: 'svg-plus',
        minus: 'svg-minus',
        undo: 'svg-undo',
        redo: 'svg-redo',
        sidebarBottom: 'svg-sidebar-bottom',
        sidebarRight: 'svg-sidebar-right',
    }
}));

describe('UI Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    describe('Toasts', () => {
        it('should show toast', () => {
            document.body.innerHTML = '<div id="toast-container"></div>';
            showToast('Only a test');

            const container = document.getElementById('toast-container');
            expect(container?.children.length).toBe(1);
            expect(container?.innerHTML).toContain('Only a test');

            const toast = container?.children[0] as HTMLElement;

            // Check class addition after timeout
            vi.advanceTimersByTime(20);
            expect(toast.classList.contains('show')).toBe(true);

            // Check removal
            vi.advanceTimersByTime(3000);
            expect(toast.classList.contains('show')).toBe(false);

            vi.advanceTimersByTime(400);
            expect(container?.children.length).toBe(0);
        });

        it('should do nothing if container missing', () => {
            showToast('test');
            // No error
        });
    });

    describe('Icon Injector', () => {
        it('should inject icons', () => {
            document.body.innerHTML = '<button id="clear-btn"></button><button id="tool-pencil"></button>';
            injectIcons();

            expect(document.getElementById('clear-btn')?.innerHTML).toBe('svg-clear');
            expect(document.getElementById('tool-pencil')?.innerHTML).toBe('svg-pencil');
        });

        it('should handle special export button', () => {
            document.body.innerHTML = '<button id="export-main-btn"></button>';
            injectIcons();
            expect(document.getElementById('export-main-btn')?.innerHTML).toContain('Export');
            expect(document.getElementById('export-main-btn')?.innerHTML).toContain('svg-download');
        });

        it('should update orientation icons', () => {
            Object.defineProperty(window, 'matchMedia', {
                writable: true,
                value: vi.fn().mockImplementation(query => ({
                    matches: query === '(orientation: portrait)', // Simulate portrait
                    media: query,
                    onchange: null,
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                }))
            });

            document.body.innerHTML = `
                <div id="menu-header-toggle-right"></div>
                <div id="menu-toggle-right"></div>
                <div class="properties-panel" style="display: block;"></div>
                <div id="menu-toggle-left"></div>
                <div class="tool-panel" style="display: none;"></div>
            `;

            updateOrientationIcons();

            expect(document.getElementById('menu-header-toggle-right')?.innerHTML).toBe('svg-sidebar-bottom');
            expect(document.getElementById('menu-toggle-right')?.innerHTML).toContain('Hide Bottom Bar');
            expect(document.getElementById('menu-toggle-left')?.innerHTML).toContain('Show Toolbar (L)');
        });
    });

    describe('Palette', () => {
        let mockCanvasManager: CanvasManager;

        beforeEach(() => {
            mockCanvasManager = new CanvasManager('test', () => { });
        });

        it('should generate palette', () => {
            document.body.innerHTML = '<div id="color-grid"></div><input id="color-picker">';
            const updateIndicator = vi.fn();

            generatePalette({ count: 5, columns: 2 }, mockCanvasManager, () => 'pencil', updateIndicator);

            const grid = document.getElementById('color-grid');
            expect(grid?.children.length).toBe(5);
            expect((grid?.children[0] as HTMLElement).classList.contains('active')).toBe(true);
        });

        it('should handle color click', () => {
            document.body.innerHTML = '<div id="color-grid"></div><input id="color-picker">';
            const updateIndicator = vi.fn();

            generatePalette({ count: 5, columns: 2 }, mockCanvasManager, () => 'pencil', updateIndicator);

            const swatch = document.getElementById('color-grid')?.children[2] as HTMLElement; // Click 3rd color
            swatch.click();

            expect(swatch.classList.contains('active')).toBe(true);
            expect(mockCanvasManager.setConfig).toHaveBeenCalledWith({ color: expect.any(String) });
            expect(updateIndicator).toHaveBeenCalled();
        });

        it('should update active swatch', () => {
            document.body.innerHTML = `
                <div class="color-swatch" data-color="#ff0000"></div>
                <div class="color-swatch" data-color="#00ff00"></div>
            `;

            updateActiveSwatch('#00ff00');

            const swatches = document.querySelectorAll('.color-swatch');
            expect(swatches[0].classList.contains('active')).toBe(false);
            expect(swatches[1].classList.contains('active')).toBe(true);
        });
    });

    describe('ToolStateManager', () => {
        let manager: ToolStateManager;
        let mockCanvasManager: CanvasManager;

        beforeEach(() => {
            mockCanvasManager = new CanvasManager('test', () => { });

            document.body.innerHTML = `
                <input id="stroke-size" />
                <input id="stroke-opacity" />
                <input id="stroke-hardness" />
                <input id="stroke-pressure" />
                <input id="color-picker" />
                <div class="tool-btn" data-tool="pencil"></div>
                <div class="tool-btn" data-tool="brush"></div>
                <div id="global-tool-indicator">
                    <div class="tool-indicator-color"></div>
                    <div class="tool-indicator-size"></div>
                </div>
            `;

            manager = new ToolStateManager(mockCanvasManager);
        });

        it('should initialize and cache DOM', () => {
            // Logic in constructor
            expect((manager as any).domCache.sizeInput).not.toBeNull();
        });

        it('should switch tool', () => {
            manager.switchTool('brush');

            expect(manager.getCurrentTool()).toBe('brush');
            expect(mockCanvasManager.setTool).toHaveBeenCalledWith('brush');
            expect(mockCanvasManager.setConfig).toHaveBeenCalled();

            // UI Update
            const brushBtn = document.querySelector('.tool-btn[data-tool="brush"]');
            expect(brushBtn?.classList.contains('active')).toBe(true);

            const sizeInput = document.getElementById('stroke-size') as HTMLInputElement;
            expect(sizeInput.value).toBe('10'); // Brush default
        });

        it('should toggle hand tool', () => {
            manager.switchTool('pencil');
            manager.toggleHandTool(); // to hand
            expect(manager.getCurrentTool()).toBe('hand');

            manager.toggleHandTool(); // back to pencil
            expect(manager.getCurrentTool()).toBe('pencil');
        });

        it('should get tool state', () => {
            const state = manager.getToolState('pencil');
            expect(state).toBeDefined();
            expect(state?.size).toBe(5);
        });
    });
});
