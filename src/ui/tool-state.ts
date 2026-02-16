import type { DrawingTool, ToolConfig } from '../tools';
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

    constructor(canvasManager: CanvasManager) {
        this.canvasManager = canvasManager;
    }

    public getToolState(tool: string): ToolState | undefined {
        return this.toolStates[tool];
    }

    public getCurrentTool(): DrawingTool {
        return this.currentActiveTool;
    }

    public switchTool(tool: DrawingTool) {
        if (tool === 'hand' && this.currentActiveTool !== 'hand') {
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

    public updateCurrentState(update: Partial<ToolState>) {
        const state = this.toolStates[this.currentActiveTool];
        if (state) {
            Object.assign(state, update);
            this.canvasManager.setConfig(state);
            this.updateGlobalIndicator();
        }
    }

    private updateUIInputs(state: ToolState) {
        const sizeInput = document.getElementById('stroke-size') as HTMLInputElement;
        const opacityInput = document.getElementById('stroke-opacity') as HTMLInputElement;
        const hardnessInput = document.getElementById('stroke-hardness') as HTMLInputElement;
        const pressureInput = document.getElementById('stroke-pressure') as HTMLInputElement;
        const colorPicker = document.getElementById('color-picker') as HTMLInputElement;

        if (sizeInput) sizeInput.value = state.size.toString();
        if (opacityInput) opacityInput.value = state.opacity.toString();
        if (hardnessInput) hardnessInput.value = state.hardness.toString();
        if (pressureInput) pressureInput.value = state.pressure.toString();
        if (colorPicker) colorPicker.value = state.color;
    }

    private updateActiveBtn(tool: DrawingTool) {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            if (btn.getAttribute('data-tool') === tool) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    public updateGlobalIndicator() {
        const indicator = document.getElementById('global-tool-indicator');
        if (!indicator) return;

        const state = this.toolStates[this.currentActiveTool];
        if (state) {
            const colorEl = indicator.querySelector('.tool-indicator-color') as HTMLElement;
            const sizeEl = indicator.querySelector('.tool-indicator-size') as HTMLElement;

            indicator.style.display = 'flex';
            if (colorEl) colorEl.style.backgroundColor = state.color;
            if (sizeEl) {
                if (state.size === 0 && this.currentActiveTool === 'fill') {
                    sizeEl.style.display = 'none';
                } else {
                    sizeEl.style.display = 'block';
                    sizeEl.textContent = state.size.toString();
                }
            }
        } else {
            indicator.style.display = 'none';
        }
    }
}
