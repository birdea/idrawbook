import type { ICanvasContext, Page } from './types';
import { PageManager } from './page-manager';
import { CanvasRenderer } from './renderer';
import { InputManager } from './input-manager';
import { HistoryManager } from '../history';
import { type DrawingAction } from '../actions';
import { TextTool } from '../tools/text-tool';
import type { ToolConfig, DrawingTool, Point } from '../tools/types';
import { showToast } from '../ui/toast';
import { ToolManager } from './tool-manager';

export class CanvasManager implements ICanvasContext {
    public canvas: HTMLCanvasElement;
    public container: HTMLElement;
    public ctx: CanvasRenderingContext2D;
    public offscreenCanvas: HTMLCanvasElement;
    public offscreenCtx: CanvasRenderingContext2D;

    // State
    public scale: number = 1.0;
    public offset: Point = { x: 0, y: 0 };
    public currentTool: DrawingTool = 'pencil';
    public config: ToolConfig = { size: 5, color: '#000000', opacity: 100, hardness: 100, pressure: 50 };

    // Managers
    public pageManager: PageManager;
    public toolManager: ToolManager;
    public historyManager: HistoryManager;
    public textTool: TextTool | null = null;
    private renderer: CanvasRenderer;

    public onUpdateCallback: ((pageId?: string) => void) | null = null;
    public onZoomChange: ((zoomPercent: number) => void) | null = null;

    constructor(canvasId: string, onUpdate?: () => void) {
        this.onUpdateCallback = onUpdate || null;
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Failed to get 2d context from main canvas');
        this.ctx = ctx;

        if (!this.canvas.parentElement) throw new Error('Canvas must have a parent element');
        this.container = this.canvas.parentElement;

        this.offscreenCanvas = document.createElement('canvas');
        const offCtx = this.offscreenCanvas.getContext('2d');
        if (!offCtx) throw new Error('Failed to get 2d context from offscreen canvas');
        this.offscreenCtx = offCtx;

        this.renderer = new CanvasRenderer(this.ctx, this.canvas);
        this.pageManager = new PageManager(
            () => this.render(),
            (id) => this.onUpdateCallback?.(id)
        );
        this.historyManager = new HistoryManager();

        this.toolManager = new ToolManager(this);
        this.textTool = this.toolManager.getTool('text') as TextTool;

        new InputManager(this);

        // Initialize
        this.resize();
        this.addPage(1024, 1024);
        this.render();

        window.addEventListener('resize', () => this.resize());
    }

    public getPages(): Map<string, Page> {
        return this.pageManager.getPageMap();
    }

    public getActivePageId(): string | null {
        return this.pageManager.getActivePageId();
    }

    public setActivePageId(id: string | null): void {
        if (id) this.pageManager.setActivePage(id);
    }

    public render(): void {
        this.renderer.render(
            this.getPages(),
            this.scale,
            this.offset,
            this.getActivePageId()
        );
        this.updateZoomIndicator();
    }

    public screenToWorld(x: number, y: number): Point {
        return {
            x: (x - this.offset.x) / this.scale,
            y: (y - this.offset.y) / this.scale
        };
    }

    public worldToScreen(wx: number, wy: number): Point {
        return {
            x: wx * this.scale + this.offset.x,
            y: wy * this.scale + this.offset.y
        };
    }

    // Public API
    public addPage(width: number, height: number): string {
        const id = this.pageManager.addPage(width, height);
        this.focusPage(id);
        return id;
    }

    public removePage(id: string) {
        this.pageManager.removePage(id);
    }

    public focusPage(id: string) {
        const page = this.pageManager.get(id);
        if (!page) return;

        this.pageManager.setActivePage(id);
        this.onUpdateCallback?.(id);

        const targetX = (this.canvas.width - page.width * this.scale) / 2 - (page.x * this.scale);
        const targetY = (this.canvas.height - page.height * this.scale) / 2 - (page.y * this.scale);

        this.offset.x = targetX;
        this.offset.y = targetY;
        this.render();
    }

    public clear(pageWidth: number = 1024, pageHeight: number = 1024) {
        this.pageManager.clear();
        this.historyManager.clear();
        this.addPage(pageWidth, pageHeight);
    }

    public async undo() {
        const actions = this.historyManager.undo();
        if (actions) await this.redraw(actions);
    }

    public async redo() {
        const actions = this.historyManager.redo();
        if (actions) await this.redraw(actions);
    }

    public async redraw(actions?: DrawingAction[]) {
        const targetActions = actions || this.historyManager.getActions();
        const snapshot = this.historyManager.getLatestSnapshot(targetActions.length);
        let startIndex = 0;

        if (snapshot) {
            this.applySnapshot(snapshot.data);
            startIndex = snapshot.index + 1;
        } else {
            this.getPages().forEach(page => {
                page.ctx.fillStyle = 'white';
                page.ctx.fillRect(0, 0, page.width, page.height);
            });
        }

        const editingIndex = this.textTool?.getEditingActionIndex() ?? -1;

        for (let index = startIndex; index < targetActions.length; index++) {
            const action = targetActions[index];
            if (index === editingIndex) continue;

            if (action.pageId) {
                const p = this.pageManager.get(action.pageId);
                if (p) await action.draw(p.ctx);
            }
        }
        this.render();
        this.onUpdateCallback?.();
    }

    public pushAction(action: DrawingAction) {
        this.historyManager.push(action);
        if (this.historyManager.getCount() % 20 === 0) {
            this.historyManager.addSnapshot(this.takeSnapshot());
        }
    }

    private takeSnapshot(): Map<string, ImageData> {
        const snapshot = new Map<string, ImageData>();
        this.getPages().forEach(page => {
            snapshot.set(page.id, page.ctx.getImageData(0, 0, page.width, page.height));
        });
        return snapshot;
    }

    private applySnapshot(snapshot: Map<string, ImageData>) {
        this.getPages().forEach(page => {
            const data = snapshot.get(page.id);
            if (data) {
                page.ctx.putImageData(data, 0, 0);
            } else {
                page.ctx.fillStyle = 'white';
                page.ctx.fillRect(0, 0, page.width, page.height);
            }
        });
    }

    public setTool(tool: DrawingTool) {
        this.toolManager.setTool(tool);
    }

    public setConfig(config: Partial<ToolConfig>) {
        this.config = { ...this.config, ...config };
    }

    public resize() {
        if (!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.offscreenCanvas.width = rect.width;
        this.offscreenCanvas.height = rect.height;

        if (this.offset.x === 0 && this.offset.y === 0 && this.pageManager.getAll().length > 0) {
            const first = this.pageManager.getAll()[0];
            this.focusPage(first.id);
        }
        this.render();
    }

    public zoomIn() {
        this.scale = Math.min(10, this.scale * 1.1);
        this.render();
    }

    public zoomOut() {
        this.scale = Math.max(0.1, this.scale / 1.1);
        this.render();
    }

    private updateZoomIndicator() {
        this.onZoomChange?.(Math.round(this.scale * 100));
    }

    public exportImage() {
        const id = this.getActivePageId();
        if (!id) {
            showToast('No active page to export.');
            return;
        }
        const page = this.pageManager.get(id)!;
        const link = document.createElement('a');
        link.download = 'idrawbook-' + id + '-' + Date.now() + '.png';
        link.href = page.canvas.toDataURL();
        link.click();
    }

    // Legacy support methods
    public canUndo() { return this.historyManager.canUndo(); }
    public canRedo() { return this.historyManager.canRedo(); }
    public setHistoryLimit(limit: number) { this.historyManager.setLimit(limit); }
    public getPixelSize() {
        const page = this.pageManager.getActivePage();
        return page ? { width: page.width, height: page.height } : { width: 0, height: 0 };
    }

    // Internal

    public getThumbnail(width: number = 200, pageId?: string): string {
        let targetCanvas: HTMLCanvasElement;
        const page = pageId ? this.pageManager.get(pageId) : this.pageManager.getActivePage();

        if (page) {
            targetCanvas = page.canvas;
        } else if (this.pageManager.getAll().length > 0) {
            targetCanvas = this.pageManager.getAll()[0].canvas;
        } else {
            return '';
        }

        const ratio = targetCanvas.height / targetCanvas.width;
        const height = width * ratio;

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = width;
        thumbCanvas.height = height;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(targetCanvas, 0, 0, width, height);
        }
        return thumbCanvas.toDataURL('image/jpeg', 0.7);
    }

    public async getBlob(format: 'png' | 'jpeg' | 'pdf' = 'png', quality: number = 0.9): Promise<Blob | null> {
        const page = this.pageManager.getActivePage();
        if (!page) {
            return null;
        }

        if (format === 'pdf') {
            // Lazy-load jsPDF only when PDF export is needed
            // Reduces initial bundle size by ~300KB
            const { jsPDF } = await import('jspdf');

            const orientation = page.width > page.height ? 'l' : 'p';
            const pdf = new jsPDF({
                orientation,
                unit: 'px',
                format: [page.width, page.height]
            });
            const imgData = page.canvas.toDataURL('image/jpeg', quality);
            pdf.addImage(imgData, 'JPEG', 0, 0, page.width, page.height);
            return pdf.output('blob');
        } else {
            return new Promise(resolve => {
                const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
                page.canvas.toBlob(blob => {
                    resolve(blob);
                }, mimeType, quality);
            });
        }
    }
}
