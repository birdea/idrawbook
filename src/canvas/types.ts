export interface Page {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
}



import type { DrawingTool, ToolConfig, Point } from '../tools/types';
import type { HistoryManager } from '../history';
import type { TextTool } from '../tools/text-tool';
import type { ToolManager } from './tool-manager';

import type { DrawingAction } from '../actions/types';

export interface ICanvasContext {
    canvas: HTMLCanvasElement;
    container: HTMLElement;
    ctx: CanvasRenderingContext2D;
    offscreenCanvas: HTMLCanvasElement;
    offscreenCtx: CanvasRenderingContext2D;

    scale: number;
    offset: { x: number, y: number };

    currentTool: DrawingTool;
    config: ToolConfig;

    historyManager: HistoryManager;
    toolManager: ToolManager;
    textTool: TextTool | null; // Deprecated, remove? No, kept for now to avoid too many changes, or remove it?
    // User wants "Refactor" so I should remove it if ToolManager handles it.
    // TextTool is now in ToolManager.
    // But accessing textTool specific methods (getEditingActionIndex) might be needed by CanvasManager?
    // CanvasManager used `textTool.getEditingActionIndex()` in `redraw`.
    // So I can access it via `toolManager.getTool('text') as TextTool`.

    // Page Access

    // Page Access
    getPages(): Map<string, Page>;
    getActivePageId(): string | null;
    setActivePageId(id: string | null): void;

    // Methods
    render(): void;
    redraw(): Promise<void>;
    pushAction(action: DrawingAction): void;
    onUpdateCallback: ((pageId?: string) => void) | null;

    screenToWorld(x: number, y: number): Point;
    worldToScreen(wx: number, wy: number): Point;
}
