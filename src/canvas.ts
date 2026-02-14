import type { DrawingTool, ToolConfig, Point } from './tools';
import { ToolUtils } from './tools';
import { HistoryManager, StrokeAction, ShapeAction } from './history';
import type { DrawingAction } from './history';

export class CanvasManager {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private offscreenCanvas: HTMLCanvasElement;
    private offscreenCtx: CanvasRenderingContext2D;
    private isDrawing: boolean = false;
    private isPanning: boolean = false;
    private startPoint: Point = { x: 0, y: 0 };
    private currentTool: DrawingTool = 'pencil';
    private config: ToolConfig = { size: 5, color: '#000000', opacity: 100 };

    // Viewport state
    private scale: number = 1.0;
    private offset: Point = { x: 0, y: 0 };
    private lastMousePos: Point = { x: 0, y: 0 };

    // World canvas (holds the persistent drawing)
    private worldCanvas: HTMLCanvasElement;
    private worldCtx: CanvasRenderingContext2D;

    // History
    private historyManager: HistoryManager;
    private currentStrokePoints: Point[] = [];

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

        // Offscreen canvas for previewing shapes (line, rect, circle)
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;

        // World canvas (large buffer for the actual drawing)
        this.worldCanvas = document.createElement('canvas');
        this.worldCtx = this.worldCanvas.getContext('2d', { willReadFrequently: true })!;

        // Initialize world size (e.g., 5000x5000 for a large workspace)
        this.worldCanvas.width = 5000;
        this.worldCanvas.height = 5000;
        this.worldCtx.fillStyle = 'white';
        this.worldCtx.fillRect(0, 0, this.worldCanvas.width, this.worldCanvas.height);

        // History
        this.historyManager = new HistoryManager();

        this.resize();
        this.setupListeners();
        this.render();
    }

    public setHistoryLimit(limit: number) {
        this.historyManager.setLimit(limit);
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

    private redraw(actions: DrawingAction[]) {
        // Clear world canvas
        this.worldCtx.fillStyle = 'white';
        this.worldCtx.fillRect(0, 0, this.worldCanvas.width, this.worldCanvas.height);

        // Redraw all actions
        for (const action of actions) {
            action.draw(this.worldCtx);
        }
        this.render();
    }

    public resize() {
        const rect = this.canvas.parentElement!.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.offscreenCanvas.width = rect.width;
        this.offscreenCanvas.height = rect.height;

        // Center the initial view if needed
        if (this.offset.x === 0 && this.offset.y === 0) {
            this.offset.x = (this.canvas.width - 2000 * this.scale) / 2;
            this.offset.y = (this.canvas.height - 2000 * this.scale) / 2;
        }

        this.render();
    }

    public setTool(tool: DrawingTool) {
        this.currentTool = tool;
        this.updateCursor();
    }

    private updateCursor() {
        if (this.currentTool === 'hand') {
            this.canvas.style.cursor = 'grab';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    public setConfig(config: Partial<ToolConfig>) {
        this.config = { ...this.config, ...config };
    }

    private setupContext(ctx: CanvasRenderingContext2D) {
        ctx.lineWidth = this.config.size;
        ctx.strokeStyle = this.config.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = this.config.opacity / 100;

        if (this.currentTool === 'eraser' && ctx === this.worldCtx) {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    private setupListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
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

    private handleMouseDown(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.lastMousePos = { x, y };

        // Right button or Middle button or Hand tool for panning
        if (e.button === 1 || e.button === 2 || this.currentTool === 'hand') {
            this.isPanning = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        this.isDrawing = true;
        this.startPoint = this.screenToWorld(x, y);

        if (this.isFreehandTool()) {
            this.currentStrokePoints = [this.startPoint];
            this.setupContext(this.worldCtx);
            this.worldCtx.beginPath();
            this.worldCtx.moveTo(this.startPoint.x, this.startPoint.y);
        } else {
            // Preview uses offscreen canvas (current world state)
            this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
            this.offscreenCtx.drawImage(this.worldCanvas, 0, 0);
        }
    }

    private handleMouseMove(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isPanning) {
            this.offset.x += x - this.lastMousePos.x;
            this.offset.y += y - this.lastMousePos.y;
            this.lastMousePos = { x, y };
            this.render();
            return;
        }

        if (!this.isDrawing) return;

        const currentWorldPos = this.screenToWorld(x, y);

        if (this.isFreehandTool()) {
            this.currentStrokePoints.push(currentWorldPos);
            this.setupContext(this.worldCtx);
            this.worldCtx.lineTo(currentWorldPos.x, currentWorldPos.y);
            this.worldCtx.stroke();
            this.render(); // Redraw view with new strokes
        } else {
            // Draw shape preview on main canvas
            this.render(); // Clear main and draw world
            this.setupContext(this.ctx);
            // ctx transform is set in render(), but we need to match world coords
            switch (this.currentTool) {
                case 'line':
                    ToolUtils.drawLine(this.ctx, this.startPoint, currentWorldPos);
                    break;
                case 'rect':
                    ToolUtils.drawRect(this.ctx, this.startPoint, currentWorldPos);
                    break;
                case 'circle':
                    ToolUtils.drawCircle(this.ctx, this.startPoint, currentWorldPos);
                    break;
            }
        }
        this.lastMousePos = { x, y };
    }

    private handleMouseUp(e: MouseEvent) {
        if (this.isPanning) {
            this.isPanning = false;
            this.updateCursor();
        }
        if (this.isDrawing) {
            this.isDrawing = false;
            if (this.isFreehandTool()) {
                this.worldCtx.closePath();
                // Push StrokeAction
                if (this.currentStrokePoints.length > 0) {
                    this.historyManager.push(new StrokeAction([...this.currentStrokePoints], this.config));
                }
            } else {
                // Finalize shape on world canvas
                const currentWorldPos = this.screenToWorld(e.clientX - this.canvas.getBoundingClientRect().left, e.clientY - this.canvas.getBoundingClientRect().top);
                this.setupContext(this.worldCtx);

                let action: ShapeAction | null = null;

                switch (this.currentTool) {
                    case 'line':
                        ToolUtils.drawLine(this.worldCtx, this.startPoint, currentWorldPos);
                        action = new ShapeAction('line', this.startPoint, currentWorldPos, this.config);
                        break;
                    case 'rect':
                        ToolUtils.drawRect(this.worldCtx, this.startPoint, currentWorldPos);
                        action = new ShapeAction('rect', this.startPoint, currentWorldPos, this.config);
                        break;
                    case 'circle':
                        ToolUtils.drawCircle(this.worldCtx, this.startPoint, currentWorldPos);
                        action = new ShapeAction('circle', this.startPoint, currentWorldPos, this.config);
                        break;
                }

                if (action) {
                    this.historyManager.push(action);
                }
                this.render();
            }
        }
    }

    private isFreehandTool() {
        return ['pencil', 'brush', 'pen', 'eraser'].includes(this.currentTool);
    }

    public clear() {
        this.historyManager.clear(); // Clear history too? Usually YES for New File.
        this.worldCtx.fillStyle = 'white';
        this.worldCtx.fillRect(0, 0, this.worldCanvas.width, this.worldCanvas.height);
        this.render();
    }

    private render() {
        // Clear main canvas with workspace background
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Use a slightly darker gray than apple-bg for contrast
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.ctx.fillStyle = isDark ? '#121212' : '#e0e0e2';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the world into the viewport
        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.offset.x, this.offset.y);

        // Add shadow to the world canvas
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        this.ctx.shadowBlur = 30;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 10;

        this.ctx.drawImage(this.worldCanvas, 0, 0);
        this.ctx.restore();
    }

    private updateZoomIndicator() {
        const indicator = document.getElementById('zoom-level');
        if (indicator) {
            indicator.textContent = `${Math.round(this.scale * 100)}%`;
        }
    }

    public exportImage() {
        const link = document.createElement('a');
        link.download = 'idrawbook-' + Date.now() + '.png';
        link.href = this.worldCanvas.toDataURL();
        link.click();
    }

    public getBlob(): Promise<Blob | null> {
        return new Promise(resolve => {
            this.worldCanvas.toBlob(blob => {
                resolve(blob);
            }, 'image/png');
        });
    }
}
