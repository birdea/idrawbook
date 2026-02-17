import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updatePreview } from '../ui/preview';
import { CanvasManager } from '../canvas/canvas-manager';
import type { Page } from '../canvas/types';

// Mock CanvasManager
vi.mock('../canvas/canvas-manager', () => {
    return {
        CanvasManager: vi.fn().mockImplementation(function () {
            return {
                pageManager: {
                    getAll: vi.fn().mockReturnValue([]),
                    get: vi.fn(),
                    getActivePageId: vi.fn(),
                    setActivePage: vi.fn(),
                },
                getActivePageId: vi.fn(),
                getThumbnail: vi.fn().mockReturnValue('data:image/png;base64,mock'),
                focusPage: vi.fn(),
                removePage: vi.fn(),
            };
        })
    };
});

describe('Preview UI', () => {
    let canvasManagerMock: any;
    let updateHistoryButtonsMock: any;
    let previewList: HTMLElement;
    let canvasInfo: HTMLElement;


    beforeEach(() => {
        // Mock scrollIntoView
        Element.prototype.scrollIntoView = vi.fn();

        document.body.innerHTML = `
            <div class="preview-list"></div>
            <div id="canvas-info"></div>
        `;
        previewList = document.querySelector('.preview-list') as HTMLElement;
        canvasInfo = document.getElementById('canvas-info') as HTMLElement;

        canvasManagerMock = new CanvasManager('canvas', () => { });
        updateHistoryButtonsMock = vi.fn();

        // Setup initial pages
        const pages: Page[] = [
            { id: '1', width: 100, height: 100, x: 0, y: 0, canvas: {} as HTMLCanvasElement, ctx: {} as CanvasRenderingContext2D },
            { id: '2', width: 200, height: 200, x: 200, y: 0, canvas: {} as HTMLCanvasElement, ctx: {} as CanvasRenderingContext2D }
        ];

        canvasManagerMock.pageManager.getAll.mockReturnValue(pages);
        canvasManagerMock.getActivePageId.mockReturnValue('1');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should create preview items for pages', () => {
        updatePreview(canvasManagerMock, updateHistoryButtonsMock);

        const items = previewList.querySelectorAll('.preview-item');
        expect(items.length).toBe(2);
        expect((items[0] as HTMLElement).dataset.pageId).toBe('1');
        expect((items[1] as HTMLElement).dataset.pageId).toBe('2');
    });

    it('should mark active page', () => {
        canvasManagerMock.getActivePageId.mockReturnValue('2');
        updatePreview(canvasManagerMock, updateHistoryButtonsMock);

        const activeItem = previewList.querySelector('.preview-item.active');
        expect(activeItem).not.toBeNull();
        expect((activeItem as HTMLElement).dataset.pageId).toBe('2');
    });

    it('should remove preview items for deleted pages', () => {
        // First render with 2 pages
        updatePreview(canvasManagerMock, updateHistoryButtonsMock);
        expect(previewList.children.length).toBe(2);

        // Update with 1 page
        const pages = [{ id: '1', width: 100, height: 100 }];
        canvasManagerMock.pageManager.getAll.mockReturnValue(pages);

        updatePreview(canvasManagerMock, updateHistoryButtonsMock);
        expect(previewList.children.length).toBe(1);
        expect((previewList.children[0] as HTMLElement).dataset.pageId).toBe('1');
    });

    it('should update canvas info text', () => {
        updatePreview(canvasManagerMock, updateHistoryButtonsMock);
        expect(canvasInfo.textContent).toContain('Page (1/2)');
    });

    it('should handle click on preview item', () => {
        updatePreview(canvasManagerMock, updateHistoryButtonsMock);

        const item = previewList.querySelector('.preview-item') as HTMLElement;
        item.click();

        expect(canvasManagerMock.focusPage).toHaveBeenCalledWith('1');
    });

    it('should handle delete button click', () => {
        window.confirm = vi.fn().mockReturnValue(true);
        updatePreview(canvasManagerMock, updateHistoryButtonsMock);

        const deleteBtn = previewList.querySelector('.delete-page-btn') as HTMLElement;
        deleteBtn.click();

        expect(window.confirm).toHaveBeenCalled();
        expect(canvasManagerMock.removePage).toHaveBeenCalledWith('1');
    });

    it('should NOT delete if confirm cancelled', () => {
        window.confirm = vi.fn().mockReturnValue(false);
        updatePreview(canvasManagerMock, updateHistoryButtonsMock);

        const deleteBtn = previewList.querySelector('.delete-page-btn') as HTMLElement;
        deleteBtn.click();

        expect(canvasManagerMock.removePage).not.toHaveBeenCalled();
    });
});
