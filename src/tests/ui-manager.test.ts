import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UIManager } from '../ui/ui-manager';
import { CanvasManager } from '../canvas/canvas-manager';
import { ToolStateManager } from '../ui/tool-state';
import { GoogleService } from '../google';

// Mock dependencies
vi.mock('../canvas/canvas-manager', () => ({
    CanvasManager: class {
        zoomIn = vi.fn();
        zoomOut = vi.fn();
        undo = vi.fn();
        redo = vi.fn();
        clear = vi.fn();
        setHistoryLimit = vi.fn();
        setTool = vi.fn();
    }
}));

vi.mock('../ui/tool-state', () => ({
    ToolStateManager: class {
        updateCurrentState = vi.fn();
        toggleHandTool = vi.fn();
        switchTool = vi.fn();
        getCurrentTool = vi.fn();
        updateGlobalIndicator = vi.fn();
    }
}));

vi.mock('../google', () => ({
    GoogleService: class {
        login = vi.fn();
        logout = vi.fn();
    }
}));

vi.mock('../ui/palette', () => ({
    generatePalette: vi.fn(),
}));

vi.mock('../ui/icon-injector', () => ({
    updateOrientationIcons: vi.fn(),
}));

describe('UIManager', () => {
    let uiManager: UIManager;
    let canvasManagerMock: CanvasManager;
    let toolStateManagerMock: ToolStateManager;
    let googleServiceMock: GoogleService;
    let paletteSettings: any;

    beforeEach(() => {
        document.body.innerHTML = `
            <button id="zoom-in-btn"></button>
            <button id="zoom-out-btn"></button>
            <div id="global-tool-indicator"></div>
            <div class="menu-item"></div>
            <div class="menu-dropdown"><button></button></div>
            <div id="menu-settings"></div>
            <div id="settings-modal" class="hidden"></div>
            <button id="settings-save-btn"></button>
            <input id="history-limit" value="20" />
            <input id="color-count" value="10" />
            <input id="color-columns" value="5" />
            <div id="menu-undo"></div>
            <div id="menu-redo"></div>
            <div id="main-undo-btn"></div>
            <div id="main-redo-btn"></div>
            <div id="menu-delete"></div>
            <div id="menu-google-login"></div>
            <div id="menu-google-logout"></div>
            <div id="google-login-btn"></div>
            <div id="user-profile"></div>
            <div id="menu-about"></div>
            <div id="menu-header-toggle-left"></div>
            <div id="menu-header-toggle-right"></div>
            <div id="menu-toggle-left"></div>
            <div id="menu-toggle-right"></div>
            <div class="tool-panel" style="display: none;"></div>
            <div class="properties-panel" style="display: none;"></div>
            <div id="section-stroke" class="collapsed"></div>
            <div id="section-color" class="collapsed"></div>
            
            <button class="tool-btn" data-tool="pencil"></button>
            <button class="tool-btn" data-tool="hand"></button>
            
            <input id="stroke-size" />
            <input id="stroke-opacity" />
            <input id="stroke-hardness" />
            <input id="stroke-pressure" />
            <input id="color-picker" />
            
            <div class="prop-section">
                <div class="prop-header"></div>
            </div>
        `;

        canvasManagerMock = new CanvasManager('test', () => { });
        toolStateManagerMock = new ToolStateManager(canvasManagerMock);
        googleServiceMock = new GoogleService(() => { });
        paletteSettings = { count: 20, columns: 10 };

        uiManager = new UIManager(canvasManagerMock, toolStateManagerMock, googleServiceMock, paletteSettings);
        uiManager.setupEventListeners();
    });

    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    it('should handle resize', () => {
        window.dispatchEvent(new Event('resize'));
    });

    it('should handle zoom buttons', () => {
        document.getElementById('zoom-in-btn')?.click();
        expect(canvasManagerMock.zoomIn).toHaveBeenCalled();
        document.getElementById('zoom-out-btn')?.click();
        expect(canvasManagerMock.zoomOut).toHaveBeenCalled();
    });

    it('should handle all keyboard shortcuts', () => {
        // Undo/Redo
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
        expect(canvasManagerMock.undo).toHaveBeenCalled();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }));
        expect(canvasManagerMock.redo).toHaveBeenCalled();

        // Tools
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true }));
        expect(toolStateManagerMock.toggleHandTool).toHaveBeenCalled();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }));
        expect(toolStateManagerMock.switchTool).toHaveBeenCalledWith('pencil');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
        expect(toolStateManagerMock.switchTool).toHaveBeenCalledWith('brush');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true }));
        expect(toolStateManagerMock.switchTool).toHaveBeenCalledWith('eraser');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }));
        expect(toolStateManagerMock.switchTool).toHaveBeenCalledWith('fill');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true }));
        expect(toolStateManagerMock.switchTool).toHaveBeenCalledWith('text');

        // Panels
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true }));
        // Can't easily check internal state change without mocking togglePanel or checking side effects
        // But we can check if it calls updateOrientationIcons which is mocked
        // Or check element style directly
        const toolPanel = document.querySelector('.tool-panel') as HTMLElement;
        expect(toolPanel.style.display).not.toBe('none'); // Assuming it toggles to flex

        // Reset
        toolPanel.style.display = 'none';
    });

    it('should handle tool buttons', () => {
        const pencilBtn = document.querySelector('.tool-btn[data-tool="pencil"]') as HTMLElement;
        pencilBtn.click();
        expect(toolStateManagerMock.switchTool).toHaveBeenCalledWith('pencil');

        const handBtn = document.querySelector('.tool-btn[data-tool="hand"]') as HTMLElement;
        handBtn.click();
        expect(toolStateManagerMock.toggleHandTool).toHaveBeenCalled();
    });

    it('should handle settings save', () => {
        document.getElementById('settings-save-btn')?.click();
        expect(canvasManagerMock.setHistoryLimit).toHaveBeenCalledWith(20);
        expect(paletteSettings.count).toBe(10);
    });

    it('should handle google login/logout', () => {
        document.getElementById('menu-google-login')?.click();
        expect(googleServiceMock.login).toHaveBeenCalled();

        document.getElementById('menu-google-logout')?.click();
        expect(googleServiceMock.logout).toHaveBeenCalled();
    });

    it('should toggle panels', () => {
        uiManager.togglePanel('left');
        const panel = document.querySelector('.tool-panel') as HTMLElement;
        expect(panel.style.display).toBe('flex');

        uiManager.togglePanel('left');
        expect(panel.style.display).toBe('none');
    });

    it('should expand properties panel when forcing expand', () => {
        const propsPanel = document.querySelector('.properties-panel') as HTMLElement;
        propsPanel.style.display = 'none';

        uiManager.togglePanel('right', true);

        expect(propsPanel.style.display).toBe('flex');
        expect(document.getElementById('section-stroke')?.classList.contains('collapsed')).toBe(false);
        expect(document.getElementById('section-color')?.classList.contains('collapsed')).toBe(false);
    });

    it('should handle prop header toggle', () => {
        const header = document.querySelector('.prop-header') as HTMLElement;
        header.click();
        const section = document.querySelector('.prop-section') as HTMLElement;
        expect(section.classList.contains('collapsed')).toBe(true);
    });

    it('should handle custom color event', () => {
        window.dispatchEvent(new CustomEvent('colorChanged', { detail: { color: '#123456' } }));
        expect(toolStateManagerMock.updateCurrentState).toHaveBeenCalledWith({ color: '#123456' });
    });

    it('should setup menu item interactions', () => {
        const menuItem = document.querySelector('.menu-item') as HTMLElement;
        menuItem.click();
        expect(menuItem.classList.contains('active')).toBe(true);

        // Click elsewhere
        document.body.click();
        expect(menuItem.classList.contains('active')).toBe(false);
    });
});
