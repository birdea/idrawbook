import type { Page } from './types';

export class PageManager {
    private pages: Map<string, Page> = new Map();
    private activePageId: string | null = null;
    private pageGap: number = 40;
    private requestRender: () => void;
    private onUpdate: ((pageId?: string) => void) | null;

    constructor(requestRender: () => void, onUpdate: ((pageId?: string) => void) | null) {
        this.requestRender = requestRender;
        this.onUpdate = onUpdate;
    }

    public get(id: string): Page | undefined {
        return this.pages.get(id);
    }

    public getAll(): Page[] {
        return Array.from(this.pages.values());
    }

    public getPageMap(): Map<string, Page> {
        return this.pages;
    }

    public getActivePageId(): string | null {
        return this.activePageId;
    }

    public getActivePage(): Page | undefined {
        return this.activePageId ? this.pages.get(this.activePageId) : undefined;
    }

    public setActivePage(id: string) {
        if (this.pages.has(id)) {
            this.activePageId = id;
        }
    }

    public addPage(width: number, height: number): string {
        const id = crypto.randomUUID();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Failed to get 2d context for new page');

        // Fill white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        let x = 0;
        const y = 0;

        if (this.pages.size > 0) {
            let maxX = 0;
            this.pages.forEach(p => {
                if (p.x + p.width > maxX) maxX = p.x + p.width;
            });
            x = maxX + this.pageGap;
        }

        const page: Page = { id, x, y, width, height, canvas, ctx };
        this.pages.set(id, page);

        if (!this.activePageId) {
            this.activePageId = id;
        }

        this.onUpdate?.(id);
        this.requestRender();
        return id;
    }

    public removePage(id: string) {
        if (!this.pages.has(id)) return;

        this.pages.delete(id);
        this.reLayoutPages();

        if (this.pages.size > 0) {
            if (this.activePageId === id || !this.activePageId) {
                this.activePageId = this.pages.keys().next().value ?? null;
            }
        } else {
            this.activePageId = null;
        }

        this.onUpdate?.();
        this.requestRender();
    }

    private reLayoutPages() {
        let currentX = 0;
        this.pages.forEach(page => {
            page.x = currentX;
            currentX += page.width + this.pageGap;
        });
    }

    public clear() {
        this.pages.clear();
        this.activePageId = null;
        this.onUpdate?.();
        this.requestRender();
    }

    public setOnUpdate(callback: (pageId?: string) => void) {
        this.onUpdate = callback;
    }
}
