import { CanvasManager } from '../canvas/canvas-manager';
import { ICONS } from '../icons';
import type { Page } from '../canvas/types';

export const updatePreview = (canvasManager: CanvasManager, updateHistoryButtons: () => void) => {
    if (!canvasManager) return;
    const previewList = document.querySelector('.preview-list');
    if (!previewList) return;

    const pages: Page[] = canvasManager.pageManager.getAll();
    const currentItems = Array.from(previewList.children) as HTMLElement[];

    currentItems.forEach((item: Element) => {
        const id = (item as HTMLElement).dataset.pageId;
        if (!pages.find((p: Page) => p.id === id)) {
            item.remove();
        }
    });

    const activePageId = canvasManager.getActivePageId();

    pages.forEach((page: Page, index: number) => {
        let item = previewList.querySelector(`.preview-item[data-page-id="${page.id}"]`) as HTMLElement;

        if (!item) {
            item = document.createElement('div');
            item.className = 'preview-item';
            item.dataset.pageId = page.id;
            item.addEventListener('click', () => {
                canvasManager.focusPage(page.id);
            });
            previewList.appendChild(item);
        }

        if (page.id === activePageId) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active');
        }

        const thumbUrl = canvasManager.getThumbnail(100, page.id);
        item.innerHTML = `
      <div class="preview-thumb-container">
        <img src="${thumbUrl}" alt="Page ${index + 1}">
      </div>
      <div class="preview-info">
        <div class="page-title">Page ${index + 1}</div>
        <div class="page-size">${page.width} x ${page.height} px</div>
      </div>
      <button class="delete-page-btn" title="Remove Page">${ICONS.x}</button>
    `;

        item.querySelector('.delete-page-btn')?.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            if (confirm('Remove this page?')) {
                canvasManager.removePage(page.id);
            }
        });
    });

    const canvasInfoDisplay = document.getElementById('canvas-info');
    if (canvasInfoDisplay) {
        const activeIdx = pages.findIndex((p: Page) => p.id === activePageId);
        const activePage = pages[activeIdx];
        if (activePage) {
            canvasInfoDisplay.textContent = `Page (${activeIdx + 1}/${pages.length}) : ${activePage.width} x ${activePage.height} px`;
        } else {
            canvasInfoDisplay.textContent = `Page (0/0) : 0 x 0 px`;
        }
    }

    updateHistoryButtons();
};
