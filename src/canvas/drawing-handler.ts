import type { ICanvasContext, Page } from './types';
import { ToolUtils } from '../tools/tool-utils';
import { StrokeAction, ShapeAction, FillAction } from '../history';
import type { Point } from '../tools/types';

/**
 * Handles all drawing operations: freehand strokes, shape drawing, and fill.
 * Separated from InputManager to isolate drawing state and logic.
 */
export class DrawingHandler {
    private isDrawing: boolean = false;
    private startPoint: Point = { x: 0, y: 0 };
    private currentStrokePoints: Point[] = [];
    private context: ICanvasContext;
    private rafId: number | null = null;

    constructor(context: ICanvasContext) {
        this.context = context;
    }

    public getIsDrawing(): boolean {
        return this.isDrawing;
    }

    public cancelDrawing(): void {
        this.isDrawing = false;
        this.currentStrokePoints = [];
        this.context.render();
    }

    public isFreehandTool(): boolean {
        return ['pencil', 'brush', 'pen', 'eraser'].includes(this.context.currentTool);
    }

    public startFill(targetPage: Page, worldPos: Point, pressure: number): void {
        const localPoint: Point = {
            x: worldPos.x - targetPage.x,
            y: worldPos.y - targetPage.y,
            pressure
        };
        ToolUtils.floodFill(targetPage.ctx, localPoint, this.context.config.color);
        const action = new FillAction(localPoint, this.context.config, targetPage.id);
        this.context.historyManager.push(action);
        this.context.render();
        this.context.onUpdateCallback?.(targetPage.id);
    }

    public startDrawing(targetPage: Page, worldPos: Point, pressure: number): void {
        this.startPoint = {
            x: worldPos.x - targetPage.x,
            y: worldPos.y - targetPage.y,
            pressure
        };
        this.isDrawing = true;

        if (this.isFreehandTool()) {
            this.currentStrokePoints = [this.startPoint];
            ToolUtils.setupContext(targetPage.ctx, this.context.currentTool, this.context.config);
            targetPage.ctx.beginPath();
            targetPage.ctx.arc(this.startPoint.x, this.startPoint.y, this.context.config.size / 20, 0, Math.PI * 2);
        } else {
            this.context.offscreenCtx.clearRect(0, 0, this.context.offscreenCanvas.width, this.context.offscreenCanvas.height);
        }
    }

    public continueDrawing(screenX: number, screenY: number, pressure: number): void {
        if (!this.isDrawing) return;

        const currentWorldPos = this.context.screenToWorld(screenX, screenY);
        currentWorldPos.pressure = pressure;

        const activePageId = this.context.getActivePageId();
        if (!activePageId) return;
        const page = this.context.getPages().get(activePageId)!;

        const localPos: Point = {
            x: currentWorldPos.x - page.x,
            y: currentWorldPos.y - page.y,
            pressure
        };

        if (this.isFreehandTool()) {
            const lastPoint = this.currentStrokePoints[this.currentStrokePoints.length - 1];
            ToolUtils.setupContext(page.ctx, this.context.currentTool, this.context.config);
            ToolUtils.drawSegment(page.ctx, lastPoint, localPos, this.context.currentTool, this.context.config);

            page.ctx.shadowBlur = 0;
            page.ctx.globalAlpha = 1.0;
            page.ctx.globalCompositeOperation = 'source-over';

            this.currentStrokePoints.push(localPos);

            // Use requestAnimationFrame to throttle rendering
            if (!this.rafId) {
                this.rafId = requestAnimationFrame(() => {
                    this.context.render();
                    this.rafId = null;
                });
            }
        } else {
            this.context.render();
            ToolUtils.setupContext(this.context.ctx, this.context.currentTool, this.context.config);

            const startScreen = this.context.worldToScreen(page.x + this.startPoint.x, page.y + this.startPoint.y);
            const currentScreen = { x: screenX, y: screenY };

            switch (this.context.currentTool) {
                case 'line':
                    ToolUtils.drawLine(this.context.ctx, startScreen, currentScreen);
                    break;
                case 'rect':
                    ToolUtils.drawRect(this.context.ctx, startScreen, currentScreen);
                    break;
                case 'circle':
                    ToolUtils.drawCircle(this.context.ctx, startScreen, currentScreen);
                    break;
            }
        }
    }

    public finishDrawing(e: PointerEvent): void {
        // Cancel any pending render animation frame
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        const activePageId = this.context.getActivePageId();
        if (!this.isDrawing || !activePageId) {
            this.isDrawing = false;
            return;
        }

        this.context.canvas.releasePointerCapture(e.pointerId);
        this.isDrawing = false;

        const page = this.context.getPages().get(activePageId)!;

        if (this.isFreehandTool()) {
            page.ctx.closePath();
            if (this.currentStrokePoints.length > 0) {
                const action = new StrokeAction([...this.currentStrokePoints], this.context.config, this.context.currentTool, activePageId);
                this.context.historyManager.push(action);
                this.context.onUpdateCallback?.(activePageId);
            }
        } else {
            const rect = this.context.canvas.getBoundingClientRect();
            const currentWorldPos = this.context.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            const localPos: Point = {
                x: currentWorldPos.x - page.x,
                y: currentWorldPos.y - page.y
            };

            ToolUtils.setupContext(page.ctx, this.context.currentTool, this.context.config);
            let action: ShapeAction | null = null;

            switch (this.context.currentTool) {
                case 'line':
                    ToolUtils.drawLine(page.ctx, this.startPoint, localPos);
                    action = new ShapeAction('line', this.startPoint, localPos, this.context.config, activePageId);
                    break;
                case 'rect':
                    ToolUtils.drawRect(page.ctx, this.startPoint, localPos);
                    action = new ShapeAction('rect', this.startPoint, localPos, this.context.config, activePageId);
                    break;
                case 'circle':
                    ToolUtils.drawCircle(page.ctx, this.startPoint, localPos);
                    action = new ShapeAction('circle', this.startPoint, localPos, this.context.config, activePageId);
                    break;
            }

            if (action) {
                this.context.historyManager.push(action);
                this.context.onUpdateCallback?.(activePageId);
            }
            this.context.render();
        }
    }
}
