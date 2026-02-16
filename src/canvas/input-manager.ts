import type { ICanvasContext, Page } from './types';
import { TextAction } from '../text-action';
import type { Point } from '../tools';
import { DrawingHandler } from './drawing-handler';

export class InputManager {
    private isPanning: boolean = false;
    private isMovingPage: boolean = false;
    private activePointers: Map<number, Point> = new Map();
    private lastPinchDistance: number | null = null;
    private lastPinchCenter: Point | null = null;
    private lastMousePos: Point = { x: 0, y: 0 };
    private context: ICanvasContext;
    private drawingHandler: DrawingHandler;

    get isDrawing(): boolean {
        return this.drawingHandler.getIsDrawing();
    }

    constructor(context: ICanvasContext) {
        this.context = context;
        this.drawingHandler = new DrawingHandler(context);
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

    private findTargetPage(worldPos: Point): Page | null {
        for (const page of this.context.getPages().values()) {
            if (worldPos.x >= page.x && worldPos.x <= page.x + page.width &&
                worldPos.y >= page.y && worldPos.y <= page.y + page.height) {
                return page;
            }
        }
        return null;
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
            if (this.drawingHandler.getIsDrawing()) {
                this.drawingHandler.cancelDrawing();
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
        const targetPage = this.findTargetPage(worldPos);

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
            this.handleTextToolDown(targetPage, worldPos);
            return;
        }

        if (!targetPage) {
            this.context.setActivePageId(null);
            return;
        }

        this.context.setActivePageId(targetPage.id);

        if (this.context.currentTool === 'fill') {
            this.drawingHandler.startFill(targetPage, worldPos, pressure);
            return;
        }

        this.drawingHandler.startDrawing(targetPage, worldPos, pressure);
    }

    private handleTextToolDown(targetPage: Page | null, worldPos: Point): void {
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
            this.handlePinchMove();
            return;
        }

        if (this.isPanning || this.isMovingPage || this.drawingHandler.getIsDrawing()) {
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

        if (this.drawingHandler.getIsDrawing()) {
            let pressure = e.pressure;
            if (e.pointerType === 'mouse') pressure = 0.5;
            this.drawingHandler.continueDrawing(x, y, pressure);
            this.lastMousePos = { x, y };
        }
    }

    private handlePinchMove(): void {
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
    }

    private handlePointerUp(e: PointerEvent) {
        e.preventDefault();
        this.activePointers.delete(e.pointerId);

        if (this.activePointers.size < 2) {
            this.lastPinchDistance = null;
            this.lastPinchCenter = null;
        }

        if (this.activePointers.size > 0) return;

        if (this.isPanning) {
            this.isPanning = false;
            this.updateCursor();
        }
        if (this.isMovingPage) {
            this.isMovingPage = false;
            this.updateCursor();
        }

        this.drawingHandler.finishDrawing(e);
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
}
