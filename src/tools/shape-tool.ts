import { BaseTool } from './base-tool';
import { ToolUtils } from './tool-utils';
import { ShapeAction } from '../history';
import type { Point } from './types';
import type { Page } from '../canvas/types';

export class ShapeTool extends BaseTool {
    private isDrawing: boolean = false;
    private startPoint: Point = { x: 0, y: 0 };

    onDown(e: PointerEvent, worldPos: Point, targetPage: Page | null): void {
        if (!targetPage) return;

        let pressure = e.pressure;
        if (e.pointerType === 'mouse') pressure = 0.5;

        this.startPoint = {
            x: worldPos.x - targetPage.x,
            y: worldPos.y - targetPage.y,
            pressure
        };
        this.isDrawing = true;

        // Clear offscreen canvas for preview
        this.context.offscreenCtx.clearRect(0, 0, this.context.offscreenCanvas.width, this.context.offscreenCanvas.height);
    }

    onMove(e: PointerEvent, _worldPos: Point, targetPage: Page | null): void {
        if (!this.isDrawing || !targetPage) return;

        this.context.render(); // Redraw main canvas to clear previous preview

        // Draw preview on context (renderer usually draws offscreen canvas on top, or we draw directly on main ctx on top)
        // In DrawingHandler logic, it was:
        // this.context.render();
        // ToolUtils.setupContext(this.context.ctx, ...);
        // ToolUtils.draw...(this.context.ctx, startScreen, currentScreen);

        // We need to coordinate with renderer.
        // Rendering logic in DrawingHandler.continueDrawing for shapes:
        // 1. context.render() -> clears and draws pages
        // 2. setupContext(context.ctx) -> sets styles on main ctx
        // 3. draw shape on main ctx

        ToolUtils.setupContext(this.context.ctx, this.context.currentTool, this.context.config);

        const startScreen = this.context.worldToScreen(targetPage.x + this.startPoint.x, targetPage.y + this.startPoint.y);
        const rect = this.context.canvas.getBoundingClientRect();
        const currentScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

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

    onUp(e: PointerEvent, worldPos: Point, targetPage: Page | null): void {
        if (!this.isDrawing || !targetPage) {
            this.isDrawing = false;
            return;
        }

        this.context.canvas.releasePointerCapture(e.pointerId);
        this.isDrawing = false;

        const localPos: Point = {
            x: worldPos.x - targetPage.x,
            y: worldPos.y - targetPage.y
        };

        ToolUtils.setupContext(targetPage.ctx, this.context.currentTool, this.context.config);
        let action: ShapeAction | null = null;

        // We need shape type. context.currentTool is type DrawingTool.
        // We cast it if valid, or check. ShapeTool should only be active for shapes.
        const shapeType = this.context.currentTool;

        if (shapeType === 'line' || shapeType === 'rect' || shapeType === 'circle') {
            switch (shapeType) {
                case 'line':
                    ToolUtils.drawLine(targetPage.ctx, this.startPoint, localPos);
                    break;
                case 'rect':
                    ToolUtils.drawRect(targetPage.ctx, this.startPoint, localPos);
                    break;
                case 'circle':
                    ToolUtils.drawCircle(targetPage.ctx, this.startPoint, localPos);
                    break;
            }
            // Use same shapeType for action
            action = new ShapeAction(shapeType, this.startPoint, localPos, this.context.config, targetPage.id);
        }

        if (action) {
            this.context.pushAction(action);
            this.context.onUpdateCallback?.(targetPage.id);
        }
        this.context.render();
    }
}
