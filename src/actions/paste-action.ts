import type { ActionType, DrawingAction } from './types';
import type { ToolConfig } from '../tools/types';

/**
 * Replays a clipboard paste by drawing stored ImageData at a fixed position.
 * Uses an offscreen canvas so alpha compositing is handled correctly by drawImage.
 */
export class PasteAction implements DrawingAction {
  type: ActionType = 'paste';
  config: ToolConfig;
  pageId: string;

  private imageData: ImageData;
  private x: number;
  private y: number;

  constructor(
    imageData: ImageData,
    x: number,
    y: number,
    config: ToolConfig,
    pageId: string,
  ) {
    // Copy data so external mutations don't corrupt undo history
    this.imageData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height,
    );
    this.x = x;
    this.y = y;
    this.config = { ...config };
    this.pageId = pageId;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const tmp = document.createElement('canvas');
    tmp.width = this.imageData.width;
    tmp.height = this.imageData.height;
    const tmpCtx = tmp.getContext('2d')!;
    tmpCtx.putImageData(this.imageData, 0, 0);
    ctx.drawImage(tmp, this.x, this.y);
  }
}
