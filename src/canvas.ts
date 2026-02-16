import { jsPDF } from 'jspdf';
import type { DrawingTool, ToolConfig, Point } from './tools';

import { ToolUtils } from './tools';
import { HistoryManager, StrokeAction, ShapeAction, FillAction } from './history';
import type { DrawingAction } from './history';
import { TextTool, TextAction } from './text-tool';

export interface Page {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
}

export class CanvasManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private offscreenCanvas: HTMLCanvasElement;
    private offscreenCtx: CanvasRenderingContext2D;
    private isDrawing: boolean = false;
    private isPanning: boolean = false;
    private isMovingPage: boolean = false;
    private startPoint: Point = { x: 0, y: 0 };
    private currentTool: DrawingTool = 'pencil';
    private config: ToolConfig = { size: 5, color: '#000000', opacity: 100, hardness: 100, pressure: 50 };

    // Viewport state
    private scale: number = 1.0;
    private offset: Point = { x: 0, y: 0 };
    private lastMousePos: Point = { x: 0, y: 0 };

    // Pages
    private pages: Map<string, Page> = new Map();
    private activePageId: string | null = null;
    private pageGap: number = 40;

    // Multi-touch tracking
    private activePointers: Map<number, Point> = new Map();
    private lastPinchDistance: number | null = null;
    private lastPinchCenter: Point | null = null;

    // History
    private historyManager: HistoryManager;
    private currentStrokePoints: Point[] = [];
    private onUpdate: ((pageId?: string) => void) | null = null;

    // Text Tool
    private textTool: TextTool | null = null;

    // Helper to generate unique IDs
    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    constructor(canvasId: string, onUpdate?: () => void) {
        this.onUpdate = onUpdate || null;
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

        // Offscreen canvas for previewing shapes (line, rect, circle)
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;

        // Initialize with one default page
        this.addPage(1024, 1024);

        // History
        this.historyManager = new HistoryManager();

        // Text Tool
        this.textTool = new TextTool(
            'canvas-container',
            () => ({
                scale: this.scale,
                offsetX: this.offset.x,
                offsetY: this.offset.y,
            }),
            () => this.canvas.getBoundingClientRect(),
            (action: TextAction, replaceIndex: number) => {
                const page = this.pages.get(action.placement.pageId);
                if (!page) return;

                if (replaceIndex >= 0) {
                    // Re-edit: replace or remove existing action
                    if (action.text.trim().length === 0) {
                        // Text was cleared — remove the action
                        this.historyManager.removeAction(replaceIndex);
                    } else {
                        this.historyManager.replaceAction(replaceIndex, action);
                    }
                    // Full redraw since we modified history in-place
                    this.redraw(this.historyManager.getActions());
                } else {
                    // New text action
                    action.draw(page.ctx);
                    this.historyManager.push(action);
                    this.render();
                }
                this.onUpdate?.(action.placement.pageId);
            },
            this.config
        );

        this.resize();
        this.setupListeners();
        this.render();
    }

    public addPage(width: number, height: number): string {
        const id = this.generateId();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

        // Fill white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        // Determine position: place next to the last page with gap
        let x = 0;
        let y = 0; // Center vertically relative to 0? Or just stack horizontally

        if (this.pages.size > 0) {
            // Find right-most edge
            let maxX = 0;
            this.pages.forEach(p => {
                if (p.x + p.width > maxX) maxX = p.x + p.width;
            });
            x = maxX + this.pageGap;
        }

        // Center vertically visually if it matters, but let's keep top aligned 0 for now
        // Or specific requirement: "right or bottom". Let's do right.

        const page: Page = { id, x, y, width, height, canvas, ctx };
        this.pages.set(id, page);

        // Retrieve page to ensure it's set
        if (!this.activePageId) {
            this.activePageId = id;
        }

        // Center view on new page if it's not the first one
        if (this.pages.size > 1) {
            this.focusPage(id);
        } else {
            // First page, center completely
            this.resize();
        }

        this.onUpdate?.(id);
        this.render();
        return id;
    }

    private reLayoutPages() {
        let currentX = 0;
        // Keep horizontal stacking
        this.pages.forEach(page => {
            page.x = currentX;
            currentX += page.width + this.pageGap;
        });
    }

    public removePage(id: string) {
        if (!this.pages.has(id)) return;

        this.pages.delete(id);
        this.reLayoutPages(); // Fix gaps

        if (this.pages.size > 0) {
            if (this.activePageId === id || !this.activePageId) {
                // Pick next available
                this.activePageId = this.pages.keys().next().value!;
            }
            this.focusPage(this.activePageId);
        } else {
            this.activePageId = null;
        }

        this.onUpdate?.();
        this.render();
    }

    private focusAnimationId: number | null = null;
    public focusPage(id: string) {
        const page = this.pages.get(id);
        if (!page) return;

        this.activePageId = id;
        this.onUpdate?.(id); // Update UI immediately to show selection

        // Target offset to center the page
        const targetX = (this.canvas.width - page.width * this.scale) / 2 - (page.x * this.scale);
        const targetY = (this.canvas.height - page.height * this.scale) / 2 - (page.y * this.scale);

        // Smooth transition
        if (this.focusAnimationId) cancelAnimationFrame(this.focusAnimationId);

        const animate = () => {
            const dx = targetX - this.offset.x;
            const dy = targetY - this.offset.y;

            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                this.offset.x = targetX;
                this.offset.y = targetY;
                this.render();
                this.focusAnimationId = null;
                this.onUpdate?.(id); // Final update to sync UI selection
                return;
            }

            this.offset.x += dx * 0.15;
            this.offset.y += dy * 0.15;
            this.render();
            this.focusAnimationId = requestAnimationFrame(animate);
        };

        this.focusAnimationId = requestAnimationFrame(animate);
    }

    public getActivePageId(): string | null {
        return this.activePageId;
    }

    // Removed resizeWorld, replaced by clear/reset or just clear all pages? 
    // Requirement says "Book has 0 to n pages".
    // clear() should probably remove all pages or just clear their content?
    // "New Book" usually implies clearing everything.
    public clearBook() {
        this.pages.clear();
        this.historyManager.clear();
        this.activePageId = null;
        this.onUpdate?.(); // Update preview list (empty)
        this.render();
    }

    // Wrapper for old clear() behavior if needed, but "New Book" now effectively resets
    public clear() {
        this.clearBook();
        this.addPage(1024, 1024);
    }

    public getPixelSize() {
        // Just return size of active page or total bounds?
        // Used for UI display.
        if (this.activePageId) {
            const page = this.pages.get(this.activePageId)!;
            return { width: page.width, height: page.height };
        }
        return { width: 0, height: 0 };
    }

    public setHistoryLimit(limit: number) {
        this.historyManager.setLimit(limit);
    }


    public getPages(): Page[] {
        return Array.from(this.pages.values());
    }

    public undo() {
        const actions = this.historyManager.undo();
        if (actions) {
            this.redraw(actions);
        }
    }

    public redo() {
        const actions = this.historyManager.redo();
        if (actions) {
            this.redraw(actions);
        }
    }

    public canUndo(): boolean {
        return this.historyManager.canUndo();
    }

    public canRedo(): boolean {
        return this.historyManager.canRedo();
    }

    private redraw(actions: DrawingAction[]) {
        // Redraw is complex with multiple pages and global history.
        // Simplified: Clear all pages, re-apply actions.

        this.pages.forEach(page => {
            page.ctx.fillStyle = 'white';
            page.ctx.fillRect(0, 0, page.width, page.height);
        });

        for (const action of actions) {
            if ((action as any).pageId && this.pages.has((action as any).pageId)) {
                const p = this.pages.get((action as any).pageId)!;
                action.draw(p.ctx);
            }
        }
        this.render();
        // Since we don't know which page changed, we might need to update all thumbnails?
        // Or just last affected.
        this.onUpdate?.();
    }

    public resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.offscreenCanvas.width = rect.width;
        this.offscreenCanvas.height = rect.height;

        // Center the initial view if needed
        if (this.offset.x === 0 && this.offset.y === 0 && this.pages.size > 0) {
            // focus first page
            const first = this.pages.values().next().value!;
            this.focusPage(first.id);
        }
        this.render();
    }
    public setTool(tool: DrawingTool) {
        // Commit text if switching away from text tool
        if (this.currentTool === 'text' && tool !== 'text' && this.textTool?.isEditing()) {
            this.textTool.commitText();
        }
        this.currentTool = tool;
        this.updateCursor();
    }

    private updateCursor() {
        if (this.currentTool === 'hand') {
            this.canvas.style.cursor = 'grab';
        } else if (this.currentTool === 'text') {
            this.canvas.style.cursor = 'text';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    public setConfig(config: Partial<ToolConfig>) {
        this.config = { ...this.config, ...config };
        this.textTool?.updateToolConfig(this.config);
    }

    private setupContext(ctx: CanvasRenderingContext2D) {
        ToolUtils.setupContext(ctx, this.currentTool, this.config);
    }

    private setupListeners() {
        // Use Pointer Events for Pressure Support
        this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.canvas.addEventListener('pointerout', this.handlePointerUp.bind(this)); // Handle leaving canvas

        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('resize', this.resize.bind(this));
    }

    private screenToWorld(x: number, y: number): Point {
        return {
            x: (x - this.offset.x) / this.scale,
            y: (y - this.offset.y) / this.scale
        };
    }

    private handleWheel(e: WheelEvent) {
        e.preventDefault();

        // Commit text before zoom
        if (this.textTool?.isEditing()) {
            this.textTool.commitText();
        }

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = -e.deltaY;
        const factor = Math.pow(1.1, delta / 100);

        const newScale = Math.max(0.1, Math.min(10, this.scale * factor));

        // Zoom centered on mouse
        this.offset.x = mouseX - (mouseX - this.offset.x) * (newScale / this.scale);
        this.offset.y = mouseY - (mouseY - this.offset.y) * (newScale / this.scale);
        this.scale = newScale;

        this.render();
        this.updateZoomIndicator();
    }

    private handlePointerDown(e: PointerEvent) {
        e.preventDefault(); // Prevent native behavior
        this.canvas.setPointerCapture(e.pointerId);
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.lastMousePos = { x, y };

        // Track this pointer
        this.activePointers.set(e.pointerId, { x, y });

        // If multi-touch, stop any single-pointer action (drawing, panning)
        if (this.activePointers.size >= 2) {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.currentStrokePoints = [];
                this.render();
            }
            this.isPanning = false;
            this.isMovingPage = false;

            const pointers = Array.from(this.activePointers.values());
            const p1 = pointers[0];
            const p2 = pointers[1];
            this.lastPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            this.lastPinchCenter = {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2
            };
            return;
        }

        // Right button or Middle button for panning (mouse only)
        if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        this.startPoint = this.screenToWorld(x, y);
        // Include pressure in start point
        // PointerType 'mouse' usually has pressure 0.5 when down, or 0.
        // We'll normalize: if 0 and key down, assume 0.5. If pen, use real pressure.
        let pressure = e.pressure;
        if (e.pointerType === 'mouse') pressure = 0.5;

        // Hit test pages
        const worldPos = this.screenToWorld(x, y);
        let targetPage: Page | null = null;

        // Iterate reverse to hit top-most if overlap (though we layout side-by-side)
        for (const page of this.pages.values()) {
            if (worldPos.x >= page.x && worldPos.x <= page.x + page.width &&
                worldPos.y >= page.y && worldPos.y <= page.y + page.height) {
                targetPage = page;
                break;
            }
        }

        if (this.currentTool === 'hand') {
            if (targetPage) {
                this.activePageId = targetPage.id;
                this.isMovingPage = true;
                this.canvas.style.cursor = 'move';
                this.onUpdate?.(targetPage.id);
            } else {
                this.isPanning = true;
                this.canvas.style.cursor = 'grabbing';
            }
            return;
        }

        // Text tool handling
        if (this.currentTool === 'text') {
            if (targetPage) {
                this.activePageId = targetPage.id;
                if (this.textTool?.isEditing()) {
                    this.textTool.commitText();
                }
                const localPos = {
                    x: worldPos.x - targetPage.x,
                    y: worldPos.y - targetPage.y,
                };
                const pageInfo = { x: targetPage.x, y: targetPage.y, width: targetPage.width, height: targetPage.height };

                // Hit-test existing TextActions for re-editing
                const actions = this.historyManager.getActions();
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

                if (hitAction !== null && hitIndex >= 0) {
                    // Re-edit existing text
                    this.textTool?.startReEditing(hitAction, hitIndex, pageInfo);
                } else {
                    // New text editing
                    this.textTool?.startEditing(
                        { pageId: targetPage.id, localX: localPos.x, localY: localPos.y },
                        pageInfo
                    );
                }
            } else {
                if (this.textTool?.isEditing()) {
                    this.textTool.commitText();
                }
            }
            return;
        }

        if (!targetPage) {
            // Clicked on empty space
            this.activePageId = null;
            // Maybe pan?
            return;
        }

        this.activePageId = targetPage.id;

        // Convert to Page Local Coords
        this.startPoint = {
            x: worldPos.x - targetPage.x,
            y: worldPos.y - targetPage.y,
            pressure
        };

        if (this.currentTool === 'fill') {
            ToolUtils.floodFill(targetPage.ctx, this.startPoint, this.config.color);
            const action = new FillAction(this.startPoint, this.config);
            (action as any).pageId = targetPage.id; // Inject pageId
            this.historyManager.push(action);
            this.render();
            this.onUpdate?.(targetPage.id);
            return;
        }

        this.isDrawing = true;

        if (this.isFreehandTool()) {
            this.currentStrokePoints = [this.startPoint];

            ToolUtils.setupContext(targetPage.ctx, this.currentTool, this.config);
            targetPage.ctx.beginPath();
            targetPage.ctx.arc(this.startPoint.x, this.startPoint.y, this.config.size / 20, 0, Math.PI * 2);

        } else {
            // Shape preview on offscreen (which overlays viewport)
            this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        }
    }

    private handlePointerMove(e: PointerEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Update active pointer position
        if (this.activePointers.has(e.pointerId)) {
            this.activePointers.set(e.pointerId, { x, y });
        }

        // Multi-touch Gestures (Pinch to Zoom & Pan)
        if (this.activePointers.size >= 2) {
            e.preventDefault();
            const pointers = Array.from(this.activePointers.values());
            const p1 = pointers[0];
            const p2 = pointers[1];

            const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const currentCenter = {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2
            };

            if (this.lastPinchDistance !== null && this.lastPinchCenter !== null) {
                // Calculate scale change
                const zoomFactor = currentDistance / this.lastPinchDistance;
                const newScale = Math.max(0.1, Math.min(10, this.scale * zoomFactor));

                // Center displacement
                const dx = currentCenter.x - this.lastPinchCenter.x;
                const dy = currentCenter.y - this.lastPinchCenter.y;

                // Apply zoom centered on the pinch midpoint
                this.offset.x = currentCenter.x - (currentCenter.x - this.offset.x) * (newScale / this.scale);
                this.offset.y = currentCenter.y - (currentCenter.y - this.offset.y) * (newScale / this.scale);
                this.scale = newScale;

                // Apply translation (pan)
                this.offset.x += dx;
                this.offset.y += dy;

                this.render();
                this.updateZoomIndicator();
            }

            this.lastPinchDistance = currentDistance;
            this.lastPinchCenter = currentCenter;
            return;
        }

        // Standard Single Pointer Actions
        if (this.isPanning || this.isMovingPage || this.isDrawing) {
            e.preventDefault();
        }

        if (this.isPanning) {
            // Commit text before panning
            if (this.textTool?.isEditing()) {
                this.textTool.commitText();
            }
            this.offset.x += x - this.lastMousePos.x;
            this.offset.y += y - this.lastMousePos.y;
            this.lastMousePos = { x, y };
            this.render();
            return;
        }

        if (this.isMovingPage && this.activePageId) {
            const page = this.pages.get(this.activePageId);
            if (page) {
                const dx = (x - this.lastMousePos.x) / this.scale;
                const dy = (y - this.lastMousePos.y) / this.scale;
                page.x += dx;
                page.y += dy;
                this.lastMousePos = { x, y };
                this.render();
                this.onUpdate?.(this.activePageId);
            }
            return;
        }

        if (!this.isDrawing) return;

        const currentWorldPos = this.screenToWorld(x, y);
        let pressure = e.pressure;
        if (e.pointerType === 'mouse') pressure = 0.5;
        currentWorldPos.pressure = pressure;

        // Check active page
        if (!this.activePageId) return;
        const page = this.pages.get(this.activePageId)!;

        // Local coords
        const localPos: Point = {
            x: currentWorldPos.x - page.x,
            y: currentWorldPos.y - page.y,
            pressure
        };

        if (this.isFreehandTool()) {
            const lastPoint = this.currentStrokePoints[this.currentStrokePoints.length - 1];

            ToolUtils.setupContext(page.ctx, this.currentTool, this.config);
            ToolUtils.drawSegment(page.ctx, lastPoint, localPos, this.currentTool, this.config);

            // Reset
            page.ctx.shadowBlur = 0;
            page.ctx.globalAlpha = 1.0;
            page.ctx.globalCompositeOperation = 'source-over';

            this.currentStrokePoints.push(localPos);
            this.render();
        } else {
            this.render(); // Clear and redraw world
            this.setupContext(this.ctx);

            const startScreen = this.worldToScreen(page.x + this.startPoint.x, page.y + this.startPoint.y);
            const currentScreen = { x, y };

            switch (this.currentTool) {
                case 'line':
                    ToolUtils.drawLine(this.ctx, startScreen, currentScreen);
                    break;
                case 'rect':
                    ToolUtils.drawRect(this.ctx, startScreen, currentScreen);
                    break;
                case 'circle':
                    ToolUtils.drawCircle(this.ctx, startScreen, currentScreen);
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

        // If we just finished a multi-touch gesture, don't finalize any drawing
        if (this.activePointers.size > 0) return;

        if (this.isPanning) {
            this.isPanning = false;
            this.updateCursor();
        }
        if (this.isMovingPage) {
            this.isMovingPage = false;
            this.updateCursor();
        }
        if (this.isDrawing && this.activePageId) {
            this.canvas.releasePointerCapture(e.pointerId);
            this.isDrawing = false;

            const page = this.pages.get(this.activePageId)!;

            if (this.isFreehandTool()) {
                page.ctx.closePath();
                if (this.currentStrokePoints.length > 0) {
                    const action = new StrokeAction([...this.currentStrokePoints], this.config, this.currentTool);
                    (action as any).pageId = this.activePageId;
                    this.historyManager.push(action);
                    this.onUpdate?.(this.activePageId);
                }
            } else {
                // Finalize shape
                const rect = this.canvas.getBoundingClientRect();
                const currentWorldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
                const localPos: Point = {
                    x: currentWorldPos.x - page.x,
                    y: currentWorldPos.y - page.y
                };

                this.setupContext(page.ctx);
                let action: ShapeAction | null = null;

                switch (this.currentTool) {
                    case 'line':
                        ToolUtils.drawLine(page.ctx, this.startPoint, localPos);
                        action = new ShapeAction('line', this.startPoint, localPos, this.config);
                        break;
                    case 'rect':
                        ToolUtils.drawRect(page.ctx, this.startPoint, localPos);
                        action = new ShapeAction('rect', this.startPoint, localPos, this.config);
                        break;
                    case 'circle':
                        ToolUtils.drawCircle(page.ctx, this.startPoint, localPos);
                        action = new ShapeAction('circle', this.startPoint, localPos, this.config);
                        break;
                }

                if (action) {
                    (action as any).pageId = this.activePageId;
                    this.historyManager.push(action);
                    this.onUpdate?.(this.activePageId);
                }
                this.render();
            }
        }
    }

    private isFreehandTool() {
        return ['pencil', 'brush', 'pen', 'eraser'].includes(this.currentTool);
    }



    private worldToScreen(wx: number, wy: number): Point {
        return {
            x: wx * this.scale + this.offset.x,
            y: wy * this.scale + this.offset.y
        };
    }

    private render() {
        // Clear main canvas with workspace background
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Use a slightly darker gray than apple-bg for contrast
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.ctx.fillStyle = isDark ? '#121212' : '#e0e0e2';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Transform for World
        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.offset.x, this.offset.y);

        this.pages.forEach(page => {
            // Shadow
            this.ctx.save();
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            this.ctx.shadowBlur = 30;
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 10;

            // Draw page white bg
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(page.x, page.y, page.width, page.height);
            this.ctx.restore();

            // Content
            this.ctx.drawImage(page.canvas, page.x, page.y);

            // Highlight active? (optional visual feedback)
            if (page.id === this.activePageId) {
                this.ctx.save();
                this.ctx.lineWidth = 2 / this.scale;
                this.ctx.strokeStyle = '#0071e3';
                this.ctx.strokeRect(page.x, page.y, page.width, page.height);
                this.ctx.restore();
            }
        });

        // Restore identity
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    private updateZoomIndicator() {
        const indicator = document.getElementById('zoom-level');
        if (indicator) {
            indicator.textContent = `${Math.round(this.scale * 100)}%`;
        }
    }

    public zoomIn() {
        this.scale = Math.min(10, this.scale * 1.1);
        this.render();
        this.updateZoomIndicator();
    }

    public zoomOut() {
        this.scale = Math.max(0.1, this.scale / 1.1);
        this.render();
        this.updateZoomIndicator();
    }

    public exportImage() {
        // Export Active Page
        if (!this.activePageId) {
            alert('No active page to export.');
            return;
        }
        const page = this.pages.get(this.activePageId)!;
        const link = document.createElement('a');
        link.download = 'idrawbook-' + this.activePageId + '-' + Date.now() + '.png';
        link.href = page.canvas.toDataURL();
        link.click();
    }

    public getBlob(format: 'png' | 'jpeg' | 'pdf' = 'png', quality: number = 0.9): Promise<Blob | null> {
        return new Promise(resolve => {
            if (!this.activePageId) {
                resolve(null);
                return;
            }
            const page = this.pages.get(this.activePageId)!;

            if (format === 'pdf') {
                const orientation = page.width > page.height ? 'l' : 'p';
                // jsPDF expects dimensions in points or units, 'px' aligns 1:1 with canvas roughly if set correctly
                const pdf = new jsPDF({
                    orientation,
                    unit: 'px',
                    format: [page.width, page.height]
                });

                // Use JPEG for PDF to support compression/quality
                // Note: jsPDF addImage might need base64 or other formats
                const imgData = page.canvas.toDataURL('image/jpeg', quality);
                pdf.addImage(imgData, 'JPEG', 0, 0, page.width, page.height);
                resolve(pdf.output('blob'));
            } else {
                const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
                page.canvas.toBlob(blob => {
                    resolve(blob);
                }, mimeType, quality);
            }
        });
    }

    public getThumbnail(width: number = 200, pageId?: string): string {
        let targetCanvas: HTMLCanvasElement;

        if (pageId && this.pages.has(pageId)) {
            targetCanvas = this.pages.get(pageId)!.canvas;
        } else if (this.activePageId && this.pages.has(this.activePageId)) {
            targetCanvas = this.pages.get(this.activePageId)!.canvas;
        } else if (this.pages.size > 0) {
            targetCanvas = this.pages.values().next().value!.canvas;
        } else {
            return ''; // No pages
        }

        const ratio = targetCanvas.height / targetCanvas.width;
        const height = width * ratio;

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = width;
        thumbCanvas.height = height;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
            // Draw white background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(targetCanvas, 0, 0, width, height);
        }
        return thumbCanvas.toDataURL('image/jpeg', 0.7);
    }
}
