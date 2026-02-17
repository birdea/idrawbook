import { BaseTool } from './base-tool';
import type { ICanvasContext } from '../canvas/types';
import type { Point } from './types';
import type { Page } from '../canvas/types';

export class HandTool extends BaseTool {
    private isPanning: boolean = false;
    private movingPageId: string | null = null;

    constructor(context: ICanvasContext) {
        super(context);
    }

    activate(): void {
        this.context.canvas.style.cursor = 'grab';
    }

    deactivate(): void {
        this.context.canvas.style.cursor = 'crosshair';
        this.isPanning = false;
        this.movingPageId = null;
    }

    onDown(_e: PointerEvent, _worldPos: Point, targetPage: Page | null): void {
        if (targetPage) {
            this.context.setActivePageId(targetPage.id);
            this.movingPageId = targetPage.id;
            this.context.canvas.style.cursor = 'move';
        } else {
            this.isPanning = true;
            this.context.canvas.style.cursor = 'grabbing';
        }
    }

    onMove(e: PointerEvent, _worldPos: Point, _targetPage: Page | null): void {
        if (this.movingPageId) {
            const page = this.context.getPages().get(this.movingPageId);
            if (page) {
                // Calculate delta from movementX/Y (screen pixels)
                // Convert to world? Page x/y are world coords.
                // Screen delta (dx, dy) -> World delta (dx/scale, dy/scale)
                const dx = e.movementX / this.context.scale;
                const dy = e.movementY / this.context.scale;

                page.x += dx;
                page.y += dy;

                this.context.render();
                this.context.onUpdateCallback?.(this.movingPageId);
            }
        } else if (this.isPanning) {
            this.context.offset.x += e.movementX;
            this.context.offset.y += e.movementY;
            this.context.render();
        }
    }

    onUp(_e: PointerEvent, _worldPos: Point, _targetPage: Page | null): void {
        this.isPanning = false;
        this.movingPageId = null;
        this.context.canvas.style.cursor = 'grab';
    }
}
