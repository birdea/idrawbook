import type { ActionType, DrawingAction } from './types';
import type { ToolConfig } from '../tools/types';

/**
 * Clears (erases to white) all pixels covered by the selection mask.
 * The mask is a snapshot taken at creation time so undo/redo replay correctly.
 */
export class SelectionClearAction implements DrawingAction {
  type: ActionType = 'selection-clear';
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

    for (let i = 0; i < this.maskWidth * this.maskHeight; i++) {
      if (this.mask[i]) {
        const p = i * 4;
        d[p] = 255;
        d[p + 1] = 255;
        d[p + 2] = 255;
        d[p + 3] = 255; // opaque white
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }
}
