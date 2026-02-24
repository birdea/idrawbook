import type { ActionType, DrawingAction } from './types';
import type { ToolConfig } from '../tools/types';

/**
 * Records a selection move: erases the original masked area (white fill) then
 * composites the captured pixels at the offset position.
 * Both mask and pixel data are snapshotted at creation time for safe undo/redo replay.
 */
export class SelectionMoveAction implements DrawingAction {
  type: ActionType = 'selection-move';
  config: ToolConfig;
  pageId: string;

  private mask: Uint8Array;
  private maskWidth: number;
  private maskHeight: number;
  /** Full-page-sized ImageData; non-selected pixels are transparent (alpha 0). */
  private maskedPixels: ImageData;
  private dx: number;
  private dy: number;

  constructor(
    mask: Uint8Array,
    maskWidth: number,
    maskHeight: number,
    maskedPixels: ImageData,
    dx: number,
    dy: number,
    config: ToolConfig,
    pageId: string,
  ) {
    this.mask = mask.slice();
    this.maskWidth = maskWidth;
    this.maskHeight = maskHeight;
    this.maskedPixels = new ImageData(
      new Uint8ClampedArray(maskedPixels.data),
      maskedPixels.width,
      maskedPixels.height,
    );
    this.dx = dx;
    this.dy = dy;
    this.config = { ...config };
    this.pageId = pageId;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const w = this.maskWidth;
    const h = this.maskHeight;

    // Step 1: Erase original selection area (fill with white)
    const pageData = ctx.getImageData(0, 0, w, h);
    const d = pageData.data;
    for (let i = 0; i < w * h; i++) {
      if (this.mask[i]) {
        const p = i * 4;
        d[p] = 255; d[p + 1] = 255; d[p + 2] = 255; d[p + 3] = 255;
      }
    }
    ctx.putImageData(pageData, 0, 0);

    // Step 2: Composite moved pixels at the offset position.
    // maskedPixels is full-page-sized with transparent pixels outside the selection,
    // so drawImage with offset naturally clips and composites correctly.
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    tmp.getContext('2d')!.putImageData(this.maskedPixels, 0, 0);
    ctx.drawImage(tmp, this.dx, this.dy);
  }
}
