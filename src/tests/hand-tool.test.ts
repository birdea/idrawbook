import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HandTool } from '../tools/hand-tool';
import type { ICanvasContext, Page } from '../canvas/types';

describe('HandTool', () => {
    let context: ICanvasContext;
    let tool: HandTool;
    let canvas: HTMLCanvasElement;
    let page: Page;

    beforeEach(() => {
        canvas = document.createElement('canvas');
        page = {
            id: 'page1',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            canvas: document.createElement('canvas'),
            ctx: {} as CanvasRenderingContext2D
        };

        context = {
            canvas: canvas,
            scale: 1,
            offset: { x: 0, y: 0 },
            render: vi.fn(),
            setActivePageId: vi.fn(),
            getPages: vi.fn().mockReturnValue(new Map([['page1', page]])),
            onUpdateCallback: vi.fn()
        } as unknown as ICanvasContext;

        tool = new HandTool(context);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should set grab cursor on activate', () => {
        tool.activate();
        expect(canvas.style.cursor).toBe('grab');
    });

    it('should reset cursor on deactivate', () => {
        tool.deactivate();
        expect(canvas.style.cursor).toBe('crosshair');
    });

    it('should start panning when clicking on empty space', () => {
        tool.onDown({} as PointerEvent, { x: 0, y: 0 }, null);
        expect(canvas.style.cursor).toBe('grabbing');
        expect((tool as any).isPanning).toBe(true);
    });

    it('should start moving page when clicking on page', () => {
        tool.onDown({} as PointerEvent, { x: 0, y: 0 }, page);
        expect(context.setActivePageId).toHaveBeenCalledWith('page1');
        expect(canvas.style.cursor).toBe('move');
        expect((tool as any).movingPageId).toBe('page1');
    });

    it('should move map offset when panning', () => {
        tool.onDown({} as PointerEvent, { x: 0, y: 0 }, null);

        const event = { movementX: 10, movementY: 20 } as any;
        tool.onMove(event, { x: 0, y: 0 }, null);

        expect(context.offset.x).toBe(10);
        expect(context.offset.y).toBe(20);
        expect(context.render).toHaveBeenCalled();
    });

    it('should move page when moving page', () => {
        tool.onDown({} as PointerEvent, { x: 0, y: 0 }, page);

        const event = { movementX: 10, movementY: 20 } as any;
        tool.onMove(event, { x: 0, y: 0 }, null);

        expect(page.x).toBe(10);
        expect(page.y).toBe(20);
        expect(context.render).toHaveBeenCalled();
        expect(context.onUpdateCallback).toHaveBeenCalledWith('page1');
    });

    it('should stop panning/moving on up', () => {
        tool.onDown({} as PointerEvent, { x: 0, y: 0 }, page);
        tool.onUp({} as PointerEvent, { x: 0, y: 0 }, null);

        expect((tool as any).isPanning).toBe(false);
        expect((tool as any).movingPageId).toBe(null);
        expect(canvas.style.cursor).toBe('grab');
    });
});
