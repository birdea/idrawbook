import type { ActionType, DrawingAction } from './types';
import type { ToolConfig } from '../tools/types';

/**
 * Paints all pixels covered by the selection mask with the config color/opacity.
 * The mask is a snapshot taken at creation time so undo/redo replay correctly.
 */
export class SelectionFillAction implements DrawingAction {
  type: ActionType = 'selection-fill';
  config: ToolConfig;
  pageId: string;

  private mask: Uint8Array;
  private maskWidth: number;
  private maskHeight: number;

  constructor(
    mask: Uint8Array,
    maskWidth: number,
    maskHeight: number,
    config: ToolConfig,
    pageId: string,
  ) {
    this.mask = mask.slice(); // copy so later mask changes don't affect replay
    this.maskWidth = maskWidth;
    this.maskHeight = maskHeight;
    this.config = { ...config };
    this.pageId = pageId;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const imageData = ctx.getImageData(0, 0, this.maskWidth, this.maskHeight);
    const d = imageData.data;

    const hex = this.config.color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = Math.round((this.config.opacity / 100) * 255);

    for (let i = 0; i < this.maskWidth * this.maskHeight; i++) {
      if (this.mask[i]) {
        const p = i * 4;
        d[p] = r;
        d[p + 1] = g;
        d[p + 2] = b;
        d[p + 3] = a;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }
}
