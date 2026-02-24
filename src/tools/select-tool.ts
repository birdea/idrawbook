import { BaseTool } from './base-tool';
import type { Point } from './types';
import type { Page } from '../canvas/types';
import { SelectionClearAction } from '../actions/selection-clear-action';
import { SelectionFillAction } from '../actions/selection-fill-action';
import { SelectionMoveAction } from '../actions/selection-move-action';

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

  // Move-mode state
  private isMoving: boolean = false;
  private moveStartWorld: Point | null = null;
  private moveDx: number = 0;
  private moveDy: number = 0;
  /** Full-page-sized ImageData; transparent (alpha=0) outside selection. Captured at move start. */
  private maskedPixels: ImageData | null = null;

  activate(): void {
    this.context.canvas.style.cursor =
      `url("data:image/svg+xml,${WAND_CURSOR_SVG}") 3 21, crosshair`;
    this.context.postRenderCallback = () => this.renderOverlay();
  }

  deactivate(): void {
    if (this.isMoving) this.cancelMove();
    this.context.postRenderCallback = null;
    this.selectionMask = null;
    this.maskPage = null;
    this.context.render();
  }

  cancel(): void {
    if (this.isMoving) {
      this.cancelMove();
      return;
    }
    this.selectionMask = null;
    this.maskPage = null;
    this.context.render();
  }

  onDown(_e: PointerEvent, worldPos: Point, targetPage: Page | null): void {
    // If a selection exists and the click is inside it on the same page → start move
    if (this.selectionMask && this.maskPage && targetPage?.id === this.maskPage.id) {
      const lx = Math.floor(worldPos.x - targetPage.x);
      const ly = Math.floor(worldPos.y - targetPage.y);
      if (
        lx >= 0 && ly >= 0 &&
        lx < this.maskWidth && ly < this.maskHeight &&
        this.selectionMask[ly * this.maskWidth + lx]
      ) {
        this.startMove(worldPos, targetPage);
        return;
      }
    }

    // Otherwise: flood-fill selection
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

  onMove(_e: PointerEvent, worldPos: Point, targetPage: Page | null): void {
    if (this.isMoving) {
      if (!this.moveStartWorld) return;
      this.moveDx = Math.round(worldPos.x - this.moveStartWorld.x);
      this.moveDy = Math.round(worldPos.y - this.moveStartWorld.y);
      this.buildOverlay();
      this.context.render();
      return;
    }

    // Hover: switch to move cursor when pointer is over an active selection
    if (this.selectionMask && this.maskPage && targetPage?.id === this.maskPage.id) {
      const lx = Math.floor(worldPos.x - targetPage.x);
      const ly = Math.floor(worldPos.y - targetPage.y);
      if (
        lx >= 0 && ly >= 0 &&
        lx < this.maskWidth && ly < this.maskHeight &&
        this.selectionMask[ly * this.maskWidth + lx]
      ) {
        this.context.canvas.style.cursor = 'move';
        return;
      }
    }
    this.context.canvas.style.cursor =
      `url("data:image/svg+xml,${WAND_CURSOR_SVG}") 3 21, crosshair`;
  }

  onUp(_e: PointerEvent, _worldPos: Point, _targetPage: Page | null): void {
    if (this.isMoving) this.commitMove();
  }

  // ---------------------------------------------------------------------------
  // Move helpers
  // ---------------------------------------------------------------------------

  private startMove(worldPos: Point, page: Page): void {
    const w = this.maskWidth;
    const h = this.maskHeight;
    const mask = this.selectionMask!;

    // Capture selected pixels (transparent outside selection)
    const pageData = page.ctx.getImageData(0, 0, w, h);
    const pixels = new ImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      if (mask[i]) {
        const p = i * 4;
        pixels.data[p] = pageData.data[p];
        pixels.data[p + 1] = pageData.data[p + 1];
        pixels.data[p + 2] = pageData.data[p + 2];
        pixels.data[p + 3] = pageData.data[p + 3];
      }
      // else stays (0,0,0,0) – transparent
    }
    this.maskedPixels = pixels;

    // Erase source pixels for live preview
    for (let i = 0; i < w * h; i++) {
      if (mask[i]) {
        const p = i * 4;
        pageData.data[p] = 255;
        pageData.data[p + 1] = 255;
        pageData.data[p + 2] = 255;
        pageData.data[p + 3] = 255;
      }
    }
    page.ctx.putImageData(pageData, 0, 0);

    this.isMoving = true;
    this.moveStartWorld = { x: worldPos.x, y: worldPos.y };
    this.moveDx = 0;
    this.moveDy = 0;

    this.context.canvas.style.cursor = 'move';
    this.buildOverlay();
    this.context.render();
  }

  private commitMove(): void {
    if (!this.selectionMask || !this.maskPage || !this.maskedPixels) {
      this.isMoving = false;
      return;
    }

    const page = this.maskPage;
    const w = this.maskWidth;
    const h = this.maskHeight;

    // Restore original pixels so the action can replay from a clean state
    const pageData = page.ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < w * h; i++) {
      if (this.selectionMask[i]) {
        const p = i * 4;
        pageData.data[p] = this.maskedPixels.data[p];
        pageData.data[p + 1] = this.maskedPixels.data[p + 1];
        pageData.data[p + 2] = this.maskedPixels.data[p + 2];
        pageData.data[p + 3] = this.maskedPixels.data[p + 3];
      }
    }
    page.ctx.putImageData(pageData, 0, 0);

    if (this.moveDx !== 0 || this.moveDy !== 0) {
      const action = new SelectionMoveAction(
        this.selectionMask,
        w,
        h,
        this.maskedPixels,
        this.moveDx,
        this.moveDy,
        this.context.config,
        page.id,
      );
      action.draw(page.ctx);
      this.context.pushAction(action);

      // Shift selection mask to follow the moved region
      const newMask = new Uint8Array(w * h);
      const dx = this.moveDx;
      const dy = this.moveDy;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (this.selectionMask[y * w + x]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              newMask[ny * w + nx] = 1;
            }
          }
        }
      }
      this.selectionMask = newMask;
      this.context.onUpdateCallback?.();
    }

    this.isMoving = false;
    this.moveStartWorld = null;
    this.maskedPixels = null;
    this.moveDx = 0;
    this.moveDy = 0;

    this.context.canvas.style.cursor =
      `url("data:image/svg+xml,${WAND_CURSOR_SVG}") 3 21, crosshair`;
    this.buildOverlay();
    this.context.render();
  }

  private cancelMove(): void {
    if (!this.maskPage || !this.maskedPixels || !this.selectionMask) {
      this.isMoving = false;
      return;
    }

    // Restore the temporarily erased pixels
    const page = this.maskPage;
    const w = this.maskWidth;
    const h = this.maskHeight;
    const pageData = page.ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < w * h; i++) {
      if (this.selectionMask[i]) {
        const p = i * 4;
        pageData.data[p] = this.maskedPixels.data[p];
        pageData.data[p + 1] = this.maskedPixels.data[p + 1];
        pageData.data[p + 2] = this.maskedPixels.data[p + 2];
        pageData.data[p + 3] = this.maskedPixels.data[p + 3];
      }
    }
    page.ctx.putImageData(pageData, 0, 0);

    this.isMoving = false;
    this.moveStartWorld = null;
    this.maskedPixels = null;
    this.moveDx = 0;
    this.moveDy = 0;

    this.context.canvas.style.cursor =
      `url("data:image/svg+xml,${WAND_CURSOR_SVG}") 3 21, crosshair`;
    this.buildOverlay();
    this.context.render();
  }

  // ---------------------------------------------------------------------------
  // Overlay rendering
  // ---------------------------------------------------------------------------

  private buildOverlay(): void {
    if (!this.selectionMask) return;
    const w = this.maskWidth;
    const h = this.maskHeight;
    const mask = this.selectionMask;
    const dx = this.isMoving ? this.moveDx : 0;
    const dy = this.isMoving ? this.moveDy : 0;

    this.overlayCanvas.width = w;
    this.overlayCanvas.height = h;
    const ctx = this.overlayCanvas.getContext('2d')!;
    // Canvas resize already clears; explicit clear for safety on same-size reuse
    ctx.clearRect(0, 0, w, h);

    // During move: draw the actual pixel data at the offset position first
    if (this.isMoving && this.maskedPixels) {
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      tmp.getContext('2d')!.putImageData(this.maskedPixels, 0, 0);
      ctx.drawImage(tmp, dx, dy);
    }

    // Build border/fill as a separate ImageData and composite on top
    const borderCanvas = document.createElement('canvas');
    borderCanvas.width = w;
    borderCanvas.height = h;
    const bCtx = borderCanvas.getContext('2d')!;
    const imgData = bCtx.createImageData(w, h);
    const d = imgData.data;

    // Helper: does the shifted mask have a pixel at (x, y)?
    const hasPixel = (x: number, y: number): boolean => {
      const sx = x - dx;
      const sy = y - dy;
      if (sx < 0 || sx >= w || sy < 0 || sy >= h) return false;
      return mask[sy * w + sx] === 1;
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!hasPixel(x, y)) continue;

        const isBorder = (
          x === 0 || x === w - 1 || y === 0 || y === h - 1 ||
          !hasPixel(x - 1, y) || !hasPixel(x + 1, y) ||
          !hasPixel(x, y - 1) || !hasPixel(x, y + 1)
        );

        const p = (y * w + x) * 4;
        if (isBorder) {
          if ((x + y) % 8 < 4) {
            d[p] = 0; d[p + 1] = 113; d[p + 2] = 227; d[p + 3] = 255; // #0071e3
          } else {
            d[p] = 255; d[p + 1] = 255; d[p + 2] = 255; d[p + 3] = 255; // white
          }
        } else if (!this.isMoving) {
          // Semi-transparent fill only when static (let pixel preview show during move)
          d[p] = 0; d[p + 1] = 113; d[p + 2] = 227; d[p + 3] = 50;
        }
      }
    }

    bCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(borderCanvas, 0, 0);
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

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

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

  /** Returns true when there is an active selection. */
  public hasSelection(): boolean {
    return this.selectionMask !== null && this.maskPage !== null;
  }

  /**
   * Clears (erases to white) the selected pixels and records an undoable action.
   * Returns false when there is no active selection.
   */
  public deleteSelection(): boolean {
    if (!this.selectionMask || !this.maskPage) return false;

    const action = new SelectionClearAction(
      this.selectionMask,
      this.maskWidth,
      this.maskHeight,
      this.context.config,
      this.maskPage.id,
    );
    action.draw(this.maskPage.ctx);
    this.context.pushAction(action);

    this.selectionMask = null;
    this.maskPage = null;
    this.context.render();
    this.context.onUpdateCallback?.();
    return true;
  }

  /**
   * Fills the selected pixels with the current config color and records an undoable action.
   * Returns false when there is no active selection.
   */
  public fillSelection(): boolean {
    if (!this.selectionMask || !this.maskPage) return false;

    const action = new SelectionFillAction(
      this.selectionMask,
      this.maskWidth,
      this.maskHeight,
      this.context.config,
      this.maskPage.id,
    );
    action.draw(this.maskPage.ctx);
    this.context.pushAction(action);

    this.selectionMask = null;
    this.maskPage = null;
    this.context.render();
    this.context.onUpdateCallback?.();
    return true;
  }

  /**
   * Inverts the current selection mask.
   * If there is no active selection, selects the entire page instead.
   */
  public invertSelection(page: Page): void {
    if (!this.selectionMask || !this.maskPage || this.maskPage.id !== page.id) {
      this.selectAll(page);
      return;
    }

    for (let i = 0; i < this.selectionMask.length; i++) {
      this.selectionMask[i] = this.selectionMask[i] ? 0 : 1;
    }

    this.buildOverlay();
    this.context.render();
  }

  /**
   * Selects all pixels on the given page.
   */
  public selectAll(page: Page): void {
    this.selectionMask = new Uint8Array(page.width * page.height).fill(1);
    this.maskWidth = page.width;
    this.maskHeight = page.height;
    this.maskPage = page;
    this.buildOverlay();
    this.context.render();
  }

  /** Clears the current selection (same as cancel). */
  public deselect(): void {
    this.cancel();
  }

  /**
   * Copies the selected pixels to the system clipboard as a PNG image.
   * Only the selected region is written; non-selected pixels are transparent.
   * Returns false when there is no active selection or clipboard write fails.
   */
  public async copySelection(): Promise<boolean> {
    if (!this.selectionMask || !this.maskPage) return false;

    const mask = this.selectionMask;
    const w = this.maskWidth;
    const h = this.maskHeight;
    const page = this.maskPage;

    // Compute bounding box of the selection
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (minX > maxX || minY > maxY) return false;

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;

    const srcData = page.ctx.getImageData(minX, minY, bw, bh);
    const sd = srcData.data;

    // Build masked copy: transparent where not selected
    const tmp = document.createElement('canvas');
    tmp.width = bw;
    tmp.height = bh;
    const tmpCtx = tmp.getContext('2d')!;
    const imgData = tmpCtx.createImageData(bw, bh);
    const d = imgData.data;

    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (mask[(minY + y) * w + (minX + x)]) {
          const p = (y * bw + x) * 4;
          d[p] = sd[p];
          d[p + 1] = sd[p + 1];
          d[p + 2] = sd[p + 2];
          d[p + 3] = sd[p + 3];
        }
        // else stays 0,0,0,0 (transparent)
      }
    }
    tmpCtx.putImageData(imgData, 0, 0);

    const blob = await new Promise<Blob | null>(resolve => tmp.toBlob(resolve, 'image/png'));
    if (!blob) return false;

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
      return false;
    }
    return true;
  }

  /**
   * Cuts the selected pixels: copies to clipboard then erases the selection.
   * Returns false when there is no active selection or clipboard write fails.
   */
  public async cutSelection(): Promise<boolean> {
    const copied = await this.copySelection();
    if (!copied) return false;
    return this.deleteSelection();
  }

  private clearSelection(): void {
    this.selectionMask = null;
    this.maskPage = null;
    this.context.render();
  }
}
