import type { DrawingTool, ToolConfig } from '../tools/types';
import { CanvasManager } from '../canvas/canvas-manager';
import { updateActiveSwatch } from './palette';

export interface ToolState extends ToolConfig { }

export class ToolStateManager {
    private toolStates: Record<string, ToolState> = {
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

    private currentActiveTool: DrawingTool = 'pencil';
    private lastTool: DrawingTool = 'pencil';
    private canvasManager: CanvasManager;

    // DOM Cache
    private domCache: {
        sizeInput: HTMLInputElement | null;
        opacityInput: HTMLInputElement | null;
        hardnessInput: HTMLInputElement | null;
        pressureInput: HTMLInputElement | null;
        colorPicker: HTMLInputElement | null;
        toolBtns: NodeListOf<Element> | null;
        indicator: HTMLElement | null;
        indicatorColor: HTMLElement | null;
        indicatorSize: HTMLElement | null;
    } | null = null;

    constructor(canvasManager: CanvasManager) {
        this.canvasManager = canvasManager;
        this.cacheDOMElements();
    }

    private cacheDOMElements() {
        this.domCache = {
            sizeInput: document.getElementById('stroke-size') as HTMLInputElement,
            opacityInput: document.getElementById('stroke-opacity') as HTMLInputElement,
            hardnessInput: document.getElementById('stroke-hardness') as HTMLInputElement,
            pressureInput: document.getElementById('stroke-pressure') as HTMLInputElement,
            colorPicker: document.getElementById('color-picker') as HTMLInputElement,
            toolBtns: document.querySelectorAll('.tool-btn[data-tool]'),
            indicator: document.getElementById('global-tool-indicator'),
            indicatorColor: document.querySelector('#global-tool-indicator .tool-indicator-color') as HTMLElement,
            indicatorSize: document.querySelector('#global-tool-indicator .tool-indicator-size') as HTMLElement,
        };
    }

    public getToolState(tool: string): ToolState | undefined {
        return this.toolStates[tool];
    }

    public getCurrentTool(): DrawingTool {
        return this.currentActiveTool;
    }

    public switchTool(tool: DrawingTool) {
        if (
            (tool === 'hand' || tool === 'select') &&
            this.currentActiveTool !== 'hand' &&
            this.currentActiveTool !== 'select'
        ) {
            this.lastTool = this.currentActiveTool;
        }

        this.currentActiveTool = tool;

        const state = this.toolStates[tool];
        if (state) {
            this.canvasManager.setConfig(state);
            this.updateUIInputs(state);
            updateActiveSwatch(state.color);
        }

        this.updateActiveBtn(tool);
        this.canvasManager.setTool(tool);
        this.updateGlobalIndicator();
    }

    public toggleHandTool() {
        if (this.currentActiveTool === 'hand') {
            this.switchTool(this.lastTool);
        } else {
            this.switchTool('hand');
        }
    }

    public toggleSelectTool() {
        if (this.currentActiveTool === 'select') {
            this.switchTool(this.lastTool);
        } else {
            this.switchTool('select');
        }
    }

    public updateCurrentState(update: Partial<ToolState>) {
        const state = this.toolStates[this.currentActiveTool];
        if (state) {
            Object.assign(state, update);
            this.canvasManager.setConfig(state);
            this.updateGlobalIndicator();
        }
    }

    private updateUIInputs(state: ToolState) {
        if (!this.domCache) return;
        const { sizeInput, opacityInput, hardnessInput, pressureInput, colorPicker } = this.domCache;

        if (sizeInput) sizeInput.value = state.size.toString();
        if (opacityInput) opacityInput.value = state.opacity.toString();
        if (hardnessInput) hardnessInput.value = state.hardness.toString();
        if (pressureInput) pressureInput.value = state.pressure.toString();
        if (colorPicker) colorPicker.value = state.color;
    }

    private updateActiveBtn(tool: DrawingTool) {
        if (!this.domCache?.toolBtns) return;
        this.domCache.toolBtns.forEach(btn => {
            if (btn.getAttribute('data-tool') === tool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    public updateGlobalIndicator() {
        if (!this.domCache) return;
        const { indicator, indicatorColor, indicatorSize } = this.domCache;
        if (!indicator) return;

        const state = this.toolStates[this.currentActiveTool];
        if (state) {
            indicator.style.display = 'flex';
            if (indicatorColor) indicatorColor.style.backgroundColor = state.color;
            if (indicatorSize) {
                if (state.size === 0 && this.currentActiveTool === 'fill') {
                    indicatorSize.style.display = 'none';
                } else {
                    indicatorSize.style.display = 'block';
                    indicatorSize.textContent = state.size.toString();
                }
            }
        } else {
            indicator.style.display = 'none';
        }
    }
}
