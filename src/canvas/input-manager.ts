import type { ICanvasContext, Page } from './types';
import type { Point } from '../tools/types';

export class InputManager {
    private isPanning: boolean = false;
    private activePointers: Map<number, Point> = new Map();
    private lastPinchDistance: number | null = null;
    private lastPinchCenter: Point | null = null;
    private lastMousePos: Point = { x: 0, y: 0 };
    private context: ICanvasContext;

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

        // If using text tool and editing, commit on zoom
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

    private async handlePointerDown(e: PointerEvent) {
        e.preventDefault();
        this.context.canvas.setPointerCapture(e.pointerId);
        const rect = this.context.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.lastMousePos = { x, y };

        this.activePointers.set(e.pointerId, { x, y });

        // Multi-touch gestures
        if (this.activePointers.size >= 2) {
            // Cancel current tool operation if any
            this.context.toolManager.getCurrentTool().cancel();

            this.isPanning = false;

            const pointers = Array.from(this.activePointers.values());
            const p1 = pointers[0];
            const p2 = pointers[1];
            this.lastPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            this.lastPinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            return;
        }

        // Global Middle/Right Click Panning
        if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
            this.isPanning = true;
            this.context.canvas.style.cursor = 'grabbing';
            return;
        }

        const worldPos = this.context.screenToWorld(x, y);
        const targetPage = this.findTargetPage(worldPos);

        // Update active page based on tool interaction
        if (targetPage) {
            this.context.setActivePageId(targetPage.id);
        } else {
            // If clicking on empty space, maybe don't change active page unless tool supports it?
            // But usually it's good to deselect page or keep last?
            // Original logic: if !targetPage, setActivePageId(null).
            if (this.context.currentTool !== 'hand') {
                // Keep null if drawing on void?
                // Or just let tool handle it.
            }
        }

        // Delegate to tool
        await this.context.toolManager.getCurrentTool().onDown(e, worldPos, targetPage);
    }

    private async handlePointerMove(e: PointerEvent) {
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

        const worldPos = this.context.screenToWorld(x, y);
        const targetPage = this.findTargetPage(worldPos);

        // Update lastMousePos before calling tool? Or after?
        // Some tools might use delta calculation if they tracked it, but they use e.movementX/Y usually or internal state.

        await this.context.toolManager.getCurrentTool().onMove(e, worldPos, targetPage);

        this.lastMousePos = { x, y };
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

    private async handlePointerUp(e: PointerEvent) {
        e.preventDefault();
        this.activePointers.delete(e.pointerId);

        if (this.activePointers.size < 2) {
            this.lastPinchDistance = null;
            this.lastPinchCenter = null;
        }

        if (this.activePointers.size > 0) return;

        if (this.isPanning) {
            this.isPanning = false;
            this.updateCursor(); // Restore cursor
            return;
        }

        const rect = this.context.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPos = this.context.screenToWorld(x, y);
        const targetPage = this.findTargetPage(worldPos);

        await this.context.toolManager.getCurrentTool().onUp(e, worldPos, targetPage);
    }

    public updateCursor() {
        // Delegate cursor update to current tool if needed, or reset to tool's defaul
        // The ToolManager handled tool activation which sets cursor.
        // But if we were panning (override cursor), we need to restore it.
        const tool = this.context.toolManager.getCurrentTool();

        // We can just call activate again?
        tool.activate();
    }
}
