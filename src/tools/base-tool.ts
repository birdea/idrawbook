import type { ICanvasContext } from '../canvas/types';
import type { ITool } from './itool';
import type { Page } from '../canvas/types';
import type { Point } from './types';

export abstract class BaseTool implements ITool {
    protected context: ICanvasContext;

    constructor(context: ICanvasContext) {
        this.context = context;
    }

    abstract onDown(e: PointerEvent, worldPos: Point, targetPage: Page | null): void;
    abstract onMove(e: PointerEvent, worldPos: Point, targetPage: Page | null): void;
    abstract onUp(e: PointerEvent, worldPos: Point, targetPage: Page | null): void;

    activate(): void {
        this.context.canvas.style.cursor = 'crosshair';
    }
    deactivate(): void { }

    cancel(): void {
        // Default empty implementation
    }
}
