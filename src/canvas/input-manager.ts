import type { ICanvasContext, Page } from './types';
import { ToolUtils } from '../tools';
import { StrokeAction, ShapeAction, FillAction } from '../history';
import { TextAction } from '../text-tool';
import type { Point } from '../tools';

export class InputManager {
    private isDrawing: boolean = false;
    private isPanning: boolean = false;
    private isMovingPage: boolean = false;
    private startPoint: Point = { x: 0, y: 0 };
    private activePointers: Map<number, Point> = new Map();
    private lastPinchDistance: number | null = null;
    private lastPinchCenter: Point | null = null;
    private currentStrokePoints: Point[] = [];
    private lastMousePos: Point = { x: 0, y: 0 };
    private context: ICanvasContext;
    private rafId: number | null = null;

    constructor(context: ICanvasContext) {
        this.context = context;
        this.setupListeners();
    }

    private setupListeners() {
        const canvas = this.context.canvas;
        canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
        canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
        canvas.addEventListener('pointerout', this.handlePointerUp.bind(this));
        canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    private handleWheel(e: WheelEvent) {
        e.preventDefault();

        if (this.context.textTool?.isEditing()) {
            this.context.textTool.commitText();
        }

        const rect = this.context.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = -e.deltaY;
        const factor = Math.pow(1.1, delta / 100);

        const newScale = Math.max(0.1, Math.min(10, this.context.scale * factor));

        this.context.offset.x = mouseX - (mouseX - this.context.offset.x) * (newScale / this.context.scale);
        this.context.offset.y = mouseY - (mouseY - this.context.offset.y) * (newScale / this.context.scale);
        this.context.scale = newScale;

        this.context.render();
    }

    private handlePointerDown(e: PointerEvent) {
        e.preventDefault();
        this.context.canvas.setPointerCapture(e.pointerId);
        const rect = this.context.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.lastMousePos = { x, y };

        this.activePointers.set(e.pointerId, { x, y });

        if (this.activePointers.size >= 2) {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.currentStrokePoints = [];
                this.context.render();
            }
            this.isPanning = false;
            this.isMovingPage = false;

            const pointers = Array.from(this.activePointers.values());
            const p1 = pointers[0];
            const p2 = pointers[1];
            this.lastPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            this.lastPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            return;
        }

        if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
            this.isPanning = true;
            this.context.canvas.style.cursor = 'grabbing';
            return;
        }

        let pressure = e.pressure;
        if (e.pointerType === 'mouse') pressure = 0.5;

        const worldPos = this.context.screenToWorld(x, y);
        let targetPage: Page | null = null;

        for (const page of this.context.getPages().values()) {
            if (worldPos.x >= page.x && worldPos.x <= page.x + page.width &&
                worldPos.y >= page.y && worldPos.y <= page.y + page.height) {
                targetPage = page;
                break;
            }
        }

        if (this.context.currentTool === 'hand') {
            if (targetPage) {
                this.context.setActivePageId(targetPage.id);
                this.isMovingPage = true;
                this.context.canvas.style.cursor = 'move';
                this.context.onUpdateCallback?.(targetPage.id);
            } else {
                this.isPanning = true;
                this.context.canvas.style.cursor = 'grabbing';
            }
            return;
        }

        if (this.context.currentTool === 'text') {
            if (targetPage) {
                this.context.setActivePageId(targetPage.id);
                if (this.context.textTool?.isEditing()) {
                    this.context.textTool.commitText();
                }
                const localPos = {
                    x: worldPos.x - targetPage.x,
                    y: worldPos.y - targetPage.y,
                };
                const pageInfo = { x: targetPage.x, y: targetPage.y, width: targetPage.width, height: targetPage.height };

                const actions = this.context.historyManager.getActions();
                let hitIndex = -1;
                let hitAction: TextAction | null = null;
                for (let i = actions.length - 1; i >= 0; i--) {
                    const a = actions[i];
                    if (a instanceof TextAction && a.pageId === targetPage.id) {
                        if (a.hitTest(localPos.x, localPos.y, targetPage.ctx)) {
                            hitIndex = i;
                            hitAction = a;
                            break;
                        }
                    }
                }

                if (hitAction instanceof TextAction && hitIndex >= 0) {
                    this.context.textTool?.startReEditing(hitAction, hitIndex, pageInfo);
                } else {
                    this.context.textTool?.startEditing(
                        { pageId: targetPage.id, localX: localPos.x, localY: localPos.y },
                        pageInfo
                    );
                }
            } else {
                if (this.context.textTool?.isEditing()) {
                    this.context.textTool.commitText();
                }
            }
            return;
        }

        if (!targetPage) {
            this.context.setActivePageId(null);
            return;
        }

        this.context.setActivePageId(targetPage.id);
        this.startPoint = {
            x: worldPos.x - targetPage.x,
            y: worldPos.y - targetPage.y,
            pressure
        };

        if (this.context.currentTool === 'fill') {
            ToolUtils.floodFill(targetPage.ctx, this.startPoint, this.context.config.color);
            const action = new FillAction(this.startPoint, this.context.config, targetPage.id);
            this.context.historyManager.push(action);
            this.context.render();
            this.context.onUpdateCallback?.(targetPage.id);
            return;
        }

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

    private handlePointerMove(e: PointerEvent) {
        const rect = this.context.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.activePointers.has(e.pointerId)) {
            this.activePointers.set(e.pointerId, { x, y });
        }

        if (this.activePointers.size >= 2) {
            e.preventDefault();
            const pointers = Array.from(this.activePointers.values());
            const p1 = pointers[0];
            const p2 = pointers[1];

            const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const currentCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

            if (this.lastPinchDistance !== null && this.lastPinchCenter !== null) {
                const zoomFactor = currentDistance / this.lastPinchDistance;
                const newScale = Math.max(0.1, Math.min(10, this.context.scale * zoomFactor));

                const dx = currentCenter.x - this.lastPinchCenter.x;
                const dy = currentCenter.y - this.lastPinchCenter.y;

                this.context.offset.x = currentCenter.x - (currentCenter.x - this.context.offset.x) * (newScale / this.context.scale);
                this.context.offset.y = currentCenter.y - (currentCenter.y - this.context.offset.y) * (newScale / this.context.scale);
                this.context.scale = newScale;

                this.context.offset.x += dx;
                this.context.offset.y += dy;

                this.context.render();
            }

            this.lastPinchDistance = currentDistance;
            this.lastPinchCenter = currentCenter;
            return;
        }

        if (this.isPanning || this.isMovingPage || this.isDrawing) {
            e.preventDefault();
        }

        if (this.isPanning) {
            if (this.context.textTool?.isEditing()) {
                this.context.textTool.commitText();
            }
            this.context.offset.x += x - this.lastMousePos.x;
            this.context.offset.y += y - this.lastMousePos.y;
            this.lastMousePos = { x, y };
            this.context.render();
            return;
        }

        if (this.isMovingPage) {
            const activePageId = this.context.getActivePageId();
            if (activePageId) {
                const page = this.context.getPages().get(activePageId);
                if (page) {
                    const dx = (x - this.lastMousePos.x) / this.context.scale;
                    const dy = (y - this.lastMousePos.y) / this.context.scale;
                    page.x += dx;
                    page.y += dy;
                    this.lastMousePos = { x, y };
                    this.context.render();
                    this.context.onUpdateCallback?.(activePageId);
                }
            }
            return;
        }

        if (!this.isDrawing) return;

        const currentWorldPos = this.context.screenToWorld(x, y);
        let pressure = e.pressure;
        if (e.pointerType === 'mouse') pressure = 0.5;
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
            // Prevents multiple redraws per frame, improving performance
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
            const currentScreen = { x, y };

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
        this.lastMousePos = { x, y };
    }

    private handlePointerUp(e: PointerEvent) {
        e.preventDefault();
        this.activePointers.delete(e.pointerId);

        if (this.activePointers.size < 2) {
            this.lastPinchDistance = null;
            this.lastPinchCenter = null;
        }

        if (this.activePointers.size > 0) return;

        // Cancel any pending render animation frame
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (this.isPanning) {
            this.isPanning = false;
            this.updateCursor();
        }
        if (this.isMovingPage) {
            this.isMovingPage = false;
            this.updateCursor();
        }

        const activePageId = this.context.getActivePageId();
        if (this.isDrawing && activePageId) {
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

    public updateCursor() {
        if (this.context.currentTool === 'hand') {
            this.context.canvas.style.cursor = 'grab';
        } else if (this.context.currentTool === 'text') {
            this.context.canvas.style.cursor = 'text';
        } else {
            this.context.canvas.style.cursor = 'crosshair';
        }
    }

    private isFreehandTool() {
        return ['pencil', 'brush', 'pen', 'eraser'].includes(this.context.currentTool);
    }
}
