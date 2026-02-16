export interface Page {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
}



import type { DrawingTool, ToolConfig, Point } from '../tools';
import type { HistoryManager } from '../history';
import type { TextTool } from '../text-tool';

export interface ICanvasContext {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    offscreenCanvas: HTMLCanvasElement;
    offscreenCtx: CanvasRenderingContext2D;

    scale: number;
    offset: { x: number, y: number };

    currentTool: DrawingTool;
    config: ToolConfig;

    historyManager: HistoryManager;
    textTool: TextTool | null;

    // Page Access
    getPages(): Map<string, Page>;
    getActivePageId(): string | null;
    setActivePageId(id: string | null): void;

    // Methods
    render(): void;
    onUpdateCallback: ((pageId?: string) => void) | null;

    screenToWorld(x: number, y: number): Point;
    worldToScreen(wx: number, wy: number): Point;
}
