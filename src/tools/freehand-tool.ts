import { BaseTool } from './base-tool';
import { ToolUtils } from './tool-utils';
import { StrokeAction } from '../history';
import type { Point } from './types';
import type { Page } from '../canvas/types';

export class FreehandTool extends BaseTool {
    private isDrawing: boolean = false;
    private startPoint: Point = { x: 0, y: 0 };
    private currentStrokePoints: Point[] = [];
    private rafId: number | null = null;

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
        this.currentStrokePoints = [this.startPoint];

        ToolUtils.setupContext(targetPage.ctx, this.context.currentTool, this.context.config);
        targetPage.ctx.beginPath();
        targetPage.ctx.arc(this.startPoint.x, this.startPoint.y, this.context.config.size / 20, 0, Math.PI * 2);
    }

    onMove(e: PointerEvent, worldPos: Point, targetPage: Page | null): void {
        if (!this.isDrawing || !targetPage) return;

        let pressure = e.pressure;
        if (e.pointerType === 'mouse') pressure = 0.5;

        const localPos: Point = {
            x: worldPos.x - targetPage.x,
            y: worldPos.y - targetPage.y,
            pressure
        };

        const lastPoint = this.currentStrokePoints[this.currentStrokePoints.length - 1];
        ToolUtils.setupContext(targetPage.ctx, this.context.currentTool, this.context.config);
        ToolUtils.drawSegment(targetPage.ctx, lastPoint, localPos, this.context.currentTool, this.context.config);

        targetPage.ctx.shadowBlur = 0;
        targetPage.ctx.globalAlpha = 1.0;
        targetPage.ctx.globalCompositeOperation = 'source-over';

        this.currentStrokePoints.push(localPos);

        if (!this.rafId) {
            this.rafId = requestAnimationFrame(() => {
                this.context.render();
                this.rafId = null;
            });
        }
    }

    onUp(e: PointerEvent, _worldPos: Point, targetPage: Page | null): void {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (!this.isDrawing || !targetPage) {
            this.isDrawing = false;
            return;
        }

        this.context.canvas.releasePointerCapture(e.pointerId);
        this.isDrawing = false;

        targetPage.ctx.closePath();
        if (this.currentStrokePoints.length > 0) {
            const action = new StrokeAction(
                [...this.currentStrokePoints],
                this.context.config,
                this.context.currentTool,
                targetPage.id
            );
            this.context.pushAction(action);
            this.context.onUpdateCallback?.(targetPage.id);
        }
    }

    cancel(): void {
        this.isDrawing = false;
        this.currentStrokePoints = [];
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.context.render();
    }
}
