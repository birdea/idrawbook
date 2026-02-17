import type { Page } from './types';
import type { Point } from '../tools/types';
import { APP_CONFIG } from '../config';

export class CanvasRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
        this.ctx = ctx;
        this.canvas = canvas;
    }

    public render(pages: Map<string, Page>, scale: number, offset: Point, activePageId: string | null) {
        // Clear main canvas with workspace background
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Use a slightly darker gray than apple-bg for contrast
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.ctx.fillStyle = isDark ? '#121212' : '#e0e0e2';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Transform for World
        this.ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);

        // Calculate visible world bounds for culling
        // Add a small margin to prevent artifacts at edges
        const margin = APP_CONFIG.RENDERER_MARGIN;
        const viewportLeft = -offset.x / scale - margin;
        const viewportTop = -offset.y / scale - margin;
        const viewportRight = (this.canvas.width - offset.x) / scale + margin;
        const viewportBottom = (this.canvas.height - offset.y) / scale + margin;

        pages.forEach(page => {
            // Check intersection (Culling)
            // If page is completely outside the viewport, skip rendering
            if (
                page.x > viewportRight ||
                page.x + page.width < viewportLeft ||
                page.y > viewportBottom ||
                page.y + page.height < viewportTop
            ) {
                return;
            }
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
            if (page.id === activePageId) {
                this.ctx.save();
                this.ctx.lineWidth = 2 / scale;
                this.ctx.strokeStyle = '#0071e3';
                this.ctx.strokeRect(page.x, page.y, page.width, page.height);
                this.ctx.restore();
            }
        });

        // Restore identity
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
}
