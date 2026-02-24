import { BaseTool } from './base-tool';
import type { Point } from './types';
import type { Page } from '../canvas/types';

const WAND_CURSOR_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
  `<line x1="3" y1="21" x2="13" y2="11" stroke="white" stroke-width="3" stroke-linecap="round"/>` +
  `<line x1="3" y1="21" x2="13" y2="11" stroke="black" stroke-width="1.5" stroke-linecap="round"/>` +
  `<path d="M13 11l1.5-3 1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5Z" stroke="white" stroke-width="2.5" fill="white"/>` +
  `<path d="M13 11l1.5-3 1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5Z" stroke="black" stroke-width="1.5" fill="none"/>` +
  `</svg>`
);

const TOLERANCE = 32; // Per-channel color tolerance (0–255)

export class SelectTool extends BaseTool {
  private selectionMask: Uint8Array | null = null;
  private maskWidth: number = 0;
  private maskHeight: number = 0;
  private maskPage: Page | null = null;
  private overlayCanvas: HTMLCanvasElement = document.createElement('canvas');

  activate(): void {
    this.context.canvas.style.cursor =
      `url("data:image/svg+xml,${WAND_CURSOR_SVG}") 3 21, crosshair`;
    this.context.postRenderCallback = () => this.renderOverlay();
  }

  deactivate(): void {
    this.context.postRenderCallback = null;
    this.selectionMask = null;
    this.maskPage = null;
    this.context.render();
  }

  cancel(): void {
    this.selectionMask = null;
    this.maskPage = null;
    this.context.render();
  }

  onDown(_e: PointerEvent, worldPos: Point, targetPage: Page | null): void {
    if (!targetPage) {
      this.clearSelection();
      return;
    }

    const localX = Math.floor(worldPos.x - targetPage.x);
    const localY = Math.floor(worldPos.y - targetPage.y);

    if (
      localX < 0 || localY < 0 ||
      localX >= targetPage.width || localY >= targetPage.height
    ) {
      this.clearSelection();
      return;
    }

    const { width, height } = targetPage;
    const imageData = targetPage.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const seedPos = (localY * width + localX) * 4;
    const seedR = data[seedPos];
    const seedG = data[seedPos + 1];
    const seedB = data[seedPos + 2];
    const seedA = data[seedPos + 3];

    const mask = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);
    const stack: [number, number][] = [[localX, localY]];

    const matchesSeed = (pixelIdx: number): boolean => {
      const p = pixelIdx * 4;
      return (
        Math.abs(data[p] - seedR) <= TOLERANCE &&
        Math.abs(data[p + 1] - seedG) <= TOLERANCE &&
        Math.abs(data[p + 2] - seedB) <= TOLERANCE &&
        Math.abs(data[p + 3] - seedA) <= TOLERANCE
      );
    };

    while (stack.length) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;
      if (visited[idx]) continue;
      visited[idx] = 1;

      if (matchesSeed(idx)) {
        mask[idx] = 1;
        if (x > 0) stack.push([x - 1, y]);
        if (x < width - 1) stack.push([x + 1, y]);
        if (y > 0) stack.push([x, y - 1]);
        if (y < height - 1) stack.push([x, y + 1]);
      }
    }

    this.selectionMask = mask;
    this.maskWidth = width;
    this.maskHeight = height;
    this.maskPage = targetPage;
    this.buildOverlay();
    this.context.render();
  }

  onMove(_e: PointerEvent, _worldPos: Point, _targetPage: Page | null): void { }
  onUp(_e: PointerEvent, _worldPos: Point, _targetPage: Page | null): void { }

  private clearSelection(): void {
    this.selectionMask = null;
    this.maskPage = null;
    this.context.render();
  }

  private buildOverlay(): void {
    if (!this.selectionMask) return;
    const w = this.maskWidth;
    const h = this.maskHeight;
    const mask = this.selectionMask;

    this.overlayCanvas.width = w;
    this.overlayCanvas.height = h;
    const ctx = this.overlayCanvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    const d = imgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!mask[idx]) continue;

        // Pixel is on the selection border when any 4-connected neighbor is outside
        const isBorder = (
          x === 0 || x === w - 1 || y === 0 || y === h - 1 ||
          !mask[(y - 1) * w + x] || !mask[(y + 1) * w + x] ||
          !mask[y * w + (x - 1)] || !mask[y * w + (x + 1)]
        );

        const p = idx * 4;
        if (isBorder) {
          // Alternating blue/white checkerboard gives a static "marching ants" look
          if ((x + y) % 8 < 4) {
            d[p] = 0; d[p + 1] = 113; d[p + 2] = 227; d[p + 3] = 255; // #0071e3 (Apple blue)
          } else {
            d[p] = 255; d[p + 1] = 255; d[p + 2] = 255; d[p + 3] = 255; // white
          }
        } else {
          // Semi-transparent fill for interior pixels
          d[p] = 0; d[p + 1] = 113; d[p + 2] = 227; d[p + 3] = 50;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  private renderOverlay(): void {
    if (!this.selectionMask || !this.maskPage) return;
    const { ctx, scale, offset } = this.context;
    const page = this.maskPage;

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);
    ctx.drawImage(this.overlayCanvas, page.x, page.y);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Returns the current selection mask (for external use, e.g. copy/cut). */
  public getSelectionMask(): { mask: Uint8Array; width: number; height: number; page: Page } | null {
    if (!this.selectionMask || !this.maskPage) return null;
    return {
      mask: this.selectionMask,
      width: this.maskWidth,
      height: this.maskHeight,
      page: this.maskPage,
    };
  }
}
