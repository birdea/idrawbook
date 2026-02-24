import { CanvasManager } from '../canvas/canvas-manager';
import type { DrawingTool } from '../tools/types';
import { GoogleService } from '../google';
import { APP_CONFIG } from '../config';
import { updateOrientationIcons } from './icon-injector';
import { ToolStateManager } from './tool-state';
import { generatePalette } from './palette';

export class UIManager {
    private canvasManager: CanvasManager;
    private toolStateManager: ToolStateManager;
    private googleService: GoogleService;
    private paletteSettings: any;

    constructor(
        canvasManager: CanvasManager,
        toolStateManager: ToolStateManager,
        googleService: GoogleService,
        paletteSettings: any
    ) {
        this.canvasManager = canvasManager;
        this.toolStateManager = toolStateManager;
        this.googleService = googleService;
        this.paletteSettings = paletteSettings;
    }

    public setupEventListeners(): void {
        this.setupGlobalEvents();
        this.setupMenuEvents();
        this.setupToolEvents();
        this.setupPropertyEvents();
        this.setupKeyboardShortcuts();
    }

    private setupGlobalEvents(): void {
        window.addEventListener('resize', updateOrientationIcons);

        // Custom Color Changed Event (from Palette)
        window.addEventListener('colorChanged', (e: Event) => {
            const detail = (e as CustomEvent<{ color: string }>).detail;
            this.toolStateManager.updateCurrentState({ color: detail.color });
        });

        // Zoom Buttons
        document.getElementById('zoom-in-btn')?.addEventListener('click', () => this.canvasManager.zoomIn());
        document.getElementById('zoom-out-btn')?.addEventListener('click', () => this.canvasManager.zoomOut());

        // Global Indicator Click
        document.getElementById('global-tool-indicator')?.addEventListener('click', () => {
            this.togglePanel('right', true); // Force open if closed, or toggle
        });
    }

    private setupMenuEvents(): void {
        // Menu Bar Dropdowns
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                menuItems.forEach(other => { if (other !== item) other.classList.remove('active'); });
                item.classList.toggle('active');
            });
        });

        window.addEventListener('click', () => {
            menuItems.forEach(item => item.classList.remove('active'));
        });

        document.querySelectorAll('.menu-dropdown').forEach(dropdown => {
            dropdown.addEventListener('click', (e) => e.stopPropagation());
        });

        document.querySelectorAll('.menu-dropdown button').forEach(btn => {
            btn.addEventListener('click', () => {
                menuItems.forEach(item => item.classList.remove('active'));
            });
        });

        // File Menu
        document.getElementById('menu-settings')?.addEventListener('click', () => {
            document.getElementById('settings-modal')?.classList.remove('hidden');
        });

        // Settings Save Logic
        document.getElementById('settings-save-btn')?.addEventListener('click', () => {
            const limitInput = document.getElementById('history-limit') as HTMLInputElement;
            const limit = parseInt(limitInput.value);
            const colorCountInput = document.getElementById('color-count') as HTMLInputElement;
            const colorColsInput = document.getElementById('color-columns') as HTMLInputElement;

            if (limit && limit >= 10 && limit <= 500) {
                this.canvasManager.setHistoryLimit(limit);
            }

            if (colorCountInput && colorColsInput) {
                this.paletteSettings.count = parseInt(colorCountInput.value) || 20;
                this.paletteSettings.columns = parseInt(colorColsInput.value) || 10;
                generatePalette(
                    this.paletteSettings,
                    this.canvasManager,
                    () => this.toolStateManager.getCurrentTool(),
                    () => this.toolStateManager.updateGlobalIndicator()
                );
            }
            document.getElementById('settings-modal')?.classList.add('hidden');
        });

        // Edit Menu
        document.getElementById('menu-undo')?.addEventListener('click', () => this.canvasManager.undo());
        document.getElementById('menu-redo')?.addEventListener('click', () => this.canvasManager.redo());
        document.getElementById('main-undo-btn')?.addEventListener('click', () => this.canvasManager.undo());
        document.getElementById('main-redo-btn')?.addEventListener('click', () => this.canvasManager.redo());
        document.getElementById('menu-select')?.addEventListener('click', () => this.toolStateManager.toggleSelectTool());

        document.getElementById('menu-close-book')?.addEventListener('click', () => {
            if (confirm('Close current book? Unsaved changes will be lost.')) this.canvasManager.clear();
        });

        document.getElementById('menu-close-page')?.addEventListener('click', () => {
            const activePageId = this.canvasManager.getActivePageId();
            if (activePageId && confirm('Delete current page?')) {
                this.canvasManager.removePage(activePageId);
            }
        });

        // Google Authentication
        document.getElementById('menu-google-login')?.addEventListener('click', () => this.googleService.login());
        document.getElementById('menu-google-logout')?.addEventListener('click', () => this.googleService.logout());
        document.getElementById('google-login-btn')?.addEventListener('click', () => this.googleService.login());
        document.getElementById('user-profile')?.addEventListener('click', () => {
            if (confirm('Sign out of Google?')) this.googleService.logout();
        });

        // Help Menu
        document.getElementById('menu-about')?.addEventListener('click', () => {
            alert(`${APP_CONFIG.APP_NAME} v${APP_CONFIG.VERSION} \nA premium web - based drawing application.`);
        });

        // Toolbar Toggles via Menu
        document.getElementById('menu-header-toggle-left')?.addEventListener('click', () => this.togglePanel('left'));
        document.getElementById('menu-header-toggle-right')?.addEventListener('click', () => this.togglePanel('right'));
        document.getElementById('menu-toggle-left')?.addEventListener('click', () => this.togglePanel('left'));
        document.getElementById('menu-toggle-right')?.addEventListener('click', () => this.togglePanel('right'));
    }

    private setupToolEvents(): void {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.getAttribute('data-tool') as DrawingTool;
                if (tool === 'hand') {
                    this.toolStateManager.toggleHandTool();
                } else if (tool === 'select') {
                    this.toolStateManager.toggleSelectTool();
                } else {
                    this.toolStateManager.switchTool(tool);
                }
            });
        });

        // Tool Inputs
        const sizeInput = document.getElementById('stroke-size') as HTMLInputElement;
        const opacityInput = document.getElementById('stroke-opacity') as HTMLInputElement;
        const hardnessInput = document.getElementById('stroke-hardness') as HTMLInputElement;
        const pressureInput = document.getElementById('stroke-pressure') as HTMLInputElement;
        const colorPicker = document.getElementById('color-picker') as HTMLInputElement;

        if (sizeInput) sizeInput.oninput = (e) => this.toolStateManager.updateCurrentState({ size: parseInt((e.target as HTMLInputElement).value) });
        if (opacityInput) opacityInput.oninput = (e) => this.toolStateManager.updateCurrentState({ opacity: parseInt((e.target as HTMLInputElement).value) });
        if (hardnessInput) hardnessInput.oninput = (e) => this.toolStateManager.updateCurrentState({ hardness: parseInt((e.target as HTMLInputElement).value) });
        if (pressureInput) pressureInput.oninput = (e) => this.toolStateManager.updateCurrentState({ pressure: parseInt((e.target as HTMLInputElement).value) });
        if (colorPicker) colorPicker.onchange = (e) => this.toolStateManager.updateCurrentState({ color: (e.target as HTMLInputElement).value });
    }

    private setupPropertyEvents(): void {
        document.querySelectorAll('.prop-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.prop-section')?.classList.toggle('collapsed');
            });
        });
    }

    private setupKeyboardShortcuts(): void {
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                const key = e.key.toLowerCase();

                // Undo/Redo
                if (key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) this.canvasManager.redo();
                    else this.canvasManager.undo();
                    return;
                }

                // Tool Switching
                if (key === 'h') { e.preventDefault(); this.toolStateManager.toggleHandTool(); return; }
                if (key === 'w') { e.preventDefault(); this.toolStateManager.toggleSelectTool(); return; }
                if (key === 'p') { e.preventDefault(); this.toolStateManager.switchTool('pencil'); return; }
                if (key === 'b') { e.preventDefault(); this.toolStateManager.switchTool('brush'); return; }
                if (key === 'e') { e.preventDefault(); this.toolStateManager.switchTool('eraser'); return; }
                if (key === 'f') { e.preventDefault(); this.toolStateManager.switchTool('fill'); return; }
                if (key === 't') { e.preventDefault(); this.toolStateManager.switchTool('text'); return; }

                // Toolbar toggles
                if (key === 'l') { e.preventDefault(); this.togglePanel('left'); return; }
                if (key === 'r') { e.preventDefault(); this.togglePanel('right'); return; }
            }
        });
    }

    public togglePanel(side: 'left' | 'right', forceExpandProps: boolean = false): void {
        const selector = side === 'left' ? '.tool-panel' : '.properties-panel';
        const panel = document.querySelector(selector) as HTMLElement;
        if (!panel) return;

        if (panel.style.display === 'none') {
            panel.style.display = 'flex';
            if (forceExpandProps && side === 'right') {
                document.getElementById('section-stroke')?.classList.remove('collapsed');
                document.getElementById('section-color')?.classList.remove('collapsed');
                panel.scrollTop = 0;
            }
        } else {
            // If forcing expand, don't close, just ensure visible (already handled above)
            // But if we are toggling, we close it.
            // If forceExpandProps is true, we probably came from the indicator click. 
            // The indicator click logic was: if hidden -> show and expand. if visible -> hide.
            // So toggle logic is fine.
            panel.style.display = 'none';
        }
        updateOrientationIcons();
    }
}
