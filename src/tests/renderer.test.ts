import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasRenderer } from '../canvas/renderer';
import type { Page } from '../canvas/types';

describe('CanvasRenderer', () => {
    let ctx: CanvasRenderingContext2D;
    let canvas: HTMLCanvasElement;
    let renderer: CanvasRenderer;
    let pages: Map<string, Page>;

    const viewWidth = 1000;
    const viewHeight = 800;

    beforeEach(() => {
        // Mock Canvas and Context
        canvas = { width: viewWidth, height: viewHeight } as HTMLCanvasElement;

        ctx = {
            setTransform: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            drawImage: vi.fn(),
            scale: vi.fn(),
            translate: vi.fn(),
        } as unknown as CanvasRenderingContext2D;

        renderer = new CanvasRenderer(ctx, canvas);
        pages = new Map();

        // Setup Media Query mock to avoid errors
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    it('should render page inside viewport', () => {
        const page1: Page = {
            id: 'p1',
            x: 0,
            y: 0,
            width: 500,
            height: 500,
            canvas: {} as HTMLCanvasElement,
            ctx: {} as CanvasRenderingContext2D
        };
        pages.set('p1', page1);

        // Viewport at 0,0, scale 1. Page is at 0,0 500x500. Inside 1000x800 view.
        renderer.render(pages, 1, { x: 0, y: 0 }, null);

        // Should draw
        expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    });

    it('should not render page outside viewport (culling)', () => {
        const page1: Page = {
            id: 'p1',
            x: 2000,
            y: 0,
            width: 500,
            height: 500,
            canvas: {} as HTMLCanvasElement,
            ctx: {} as CanvasRenderingContext2D
        };
        pages.set('p1', page1);

        // Viewport at 0,0, scale 1. View width 1000.
        // Page starts at 2000. It is outside.
        renderer.render(pages, 1, { x: 0, y: 0 }, null);

        // Should NOT draw
        expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('should handle scaled viewport culling', () => {
        const page1: Page = {
            id: 'p1',
            x: 1000,
            y: 0,
            width: 500,
            height: 500,
            canvas: {} as HTMLCanvasElement,
            ctx: {} as CanvasRenderingContext2D
        };
        pages.set('p1', page1);

        // Case 1: Scale 0.5. Offset 0,0.
        // Screen width 1000.
        // Visible World Width = 1000 / 0.5 = 2000.
        // Page starts at 1000. It should be VISIBLE.
        renderer.render(pages, 0.5, { x: 0, y: 0 }, null);
        expect(ctx.drawImage).toHaveBeenCalledTimes(1);

        // Reset
        (ctx.drawImage as any).mockClear();

        // Case 2: Scale 2. Offset 0,0.
        // Screen width 1000.
        // Visible World Width = 1000 / 2 = 500.
        // Page starts at 1000. It should be CULLED.
        renderer.render(pages, 2, { x: 0, y: 0 }, null);
        expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('should handle panned viewport culling', () => {
        const page1: Page = {
            id: 'p1',
            x: 0,
            y: 0,
            width: 500,
            height: 500,
            canvas: {} as HTMLCanvasElement,
            ctx: {} as CanvasRenderingContext2D
        };
        pages.set('p1', page1);

        // Pan right by 2000 (offset x = -2000)
        // Visible world starts at 2000. Page at 0. Culled.
        renderer.render(pages, 1, { x: -2000, y: 0 }, null);
        expect(ctx.drawImage).not.toHaveBeenCalled();

        // Reset
        (ctx.drawImage as any).mockClear();

        // Pan left so page is centered
        // Page at 0. Offset 0. Visible.
        renderer.render(pages, 1, { x: 0, y: 0 }, null);
        expect(ctx.drawImage).toHaveBeenCalled();
    });
});
