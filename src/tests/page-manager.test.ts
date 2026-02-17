import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PageManager } from '../canvas/page-manager';

describe('PageManager', () => {
    let pageManager: PageManager;
    let requestRender: any;
    let onUpdate: any;

    beforeEach(() => {
        // Mock getContext
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            drawImage: vi.fn(),
        } as any);

        requestRender = vi.fn();
        onUpdate = vi.fn();
        pageManager = new PageManager(requestRender, onUpdate);
    });

    it('should add a page correctly', () => {
        const id = pageManager.addPage(500, 500);
        expect(id).toBeDefined();
        expect(pageManager.getAll().length).toBe(1);
        expect(pageManager.getActivePageId()).toBe(id);
        expect(requestRender).toHaveBeenCalled();
        expect(onUpdate).toHaveBeenCalledWith(id);
    });

    it('should place second page after the first one with gap', () => {
        const id1 = pageManager.addPage(100, 100);
        const id2 = pageManager.addPage(100, 100);

        const page1 = pageManager.get(id1);
        const page2 = pageManager.get(id2);

        expect(page1?.x).toBe(0);
        expect(page2?.x).toBe(140); // 100 + 40 gap
    });

    it('should remove a page and relayout', () => {
        const id1 = pageManager.addPage(100, 100);
        const id2 = pageManager.addPage(100, 100);
        const id3 = pageManager.addPage(100, 100);

        pageManager.removePage(id2);

        expect(pageManager.getAll().length).toBe(2);
        expect(pageManager.get(id1)?.x).toBe(0);
        expect(pageManager.get(id3)?.x).toBe(140); // Relayouted to 0 + 100 + 40
        expect(requestRender).toHaveBeenCalledTimes(4); // 3 add + 1 remove
    });

    it('should update active page when current active is removed', () => {
        const id1 = pageManager.addPage(100, 100);
        const id2 = pageManager.addPage(100, 100);
        pageManager.setActivePage(id1);

        pageManager.removePage(id1);
        expect(pageManager.getActivePageId()).toBe(id2);
    });

    it('should handle removing non-existent page', () => {
        pageManager.addPage(100, 100);
        pageManager.removePage('invalid-id');
        expect(pageManager.getAll().length).toBe(1);
    });

    it('should clear all pages', () => {
        pageManager.addPage(100, 100);
        pageManager.addPage(100, 100);
        pageManager.clear();

        expect(pageManager.getAll().length).toBe(0);
        expect(pageManager.getActivePageId()).toBe(null);
        expect(onUpdate).toHaveBeenCalled();
    });

    it('should support updating onUpdate callback', () => {
        const newOnUpdate = vi.fn();
        pageManager.setOnUpdate(newOnUpdate);
        pageManager.addPage(100, 100);
        expect(newOnUpdate).toHaveBeenCalled();
    });

    it('should handle active page correctly when clear and add', () => {
        pageManager.addPage(100, 100);
        pageManager.clear();
        const id = pageManager.addPage(100, 100);
        expect(pageManager.getActivePageId()).toBe(id);
    });
});
