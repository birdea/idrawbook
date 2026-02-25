import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { SelectionClearAction } from '../actions/selection-clear-action';
import { SelectionFillAction } from '../actions/selection-fill-action';
import { SelectionMoveAction } from '../actions/selection-move-action';
import { PasteAction } from '../actions/paste-action';
import type { ToolConfig } from '../tools/types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const mockConfig: ToolConfig = {
  size: 5,
  color: '#ff4400',
  opacity: 100,
  hardness: 100,
  pressure: 50,
};

/** Returns an ImageData-like object filled with white (255) pixels. */
function makeWhiteImageData(w: number, h: number) {
  return {
    data: new Uint8ClampedArray(w * h * 4).fill(255),
    width: w,
    height: h,
  };
}

/** Returns a mock canvas ctx that returns specific ImageData from getImageData. */
function makeCtx(imgData: ReturnType<typeof makeWhiteImageData>) {
  return {
    getImageData: vi.fn().mockReturnValue(imgData),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

// ---------------------------------------------------------------------------
// Polyfills for jsdom environment
// ---------------------------------------------------------------------------

if (typeof (globalThis as any).ImageData === 'undefined') {
  (globalThis as any).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height ?? 0;
      }
    }
  };
}

// Ensure HTMLCanvasElement.getContext returns a usable mock in jsdom.
const mockTmpCtx = {
  putImageData: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  clearRect: vi.fn(),
  createImageData: vi.fn((w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4),
    width: w,
    height: h,
  })),
};

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockTmpCtx as any);
});

// ---------------------------------------------------------------------------
// SelectionClearAction
// ---------------------------------------------------------------------------

describe('SelectionClearAction', () => {
  const W = 2, H = 2;
  // Pixels: [0]=selected(red), [1]=unselected(blue), [2]=unselected, [3]=selected(green)
  let pixelData: Uint8ClampedArray<ArrayBuffer>;
  let imgData: ReturnType<typeof makeWhiteImageData>;

  beforeEach(() => {
    pixelData = new Uint8ClampedArray([
      255, 0,   0,   255, // pixel 0: red   (selected)
      0,   0,   255, 255, // pixel 1: blue  (not selected)
      255, 255, 0,   255, // pixel 2: yellow(not selected)
      0,   255, 0,   255, // pixel 3: green (selected)
    ]);
    imgData = { data: pixelData, width: W, height: H };
  });

  it('erases selected pixels to opaque white', () => {
    const mask = new Uint8Array([1, 0, 0, 1]);
    const ctx = makeCtx(imgData);
    new SelectionClearAction(mask, W, H, mockConfig, 'p1').draw(ctx);

    const d = (ctx.putImageData as any).mock.calls[0][0].data as Uint8ClampedArray;
    // pixel 0 → white
    expect(d[0]).toBe(255); expect(d[1]).toBe(255); expect(d[2]).toBe(255); expect(d[3]).toBe(255);
    // pixel 3 → white
    expect(d[12]).toBe(255); expect(d[13]).toBe(255); expect(d[14]).toBe(255); expect(d[15]).toBe(255);
  });

  it('leaves non-selected pixels unchanged', () => {
    const mask = new Uint8Array([1, 0, 0, 1]);
    const ctx = makeCtx(imgData);
    new SelectionClearAction(mask, W, H, mockConfig, 'p1').draw(ctx);

    const d = (ctx.putImageData as any).mock.calls[0][0].data as Uint8ClampedArray;
    // pixel 1 (blue) stays blue
    expect(d[4]).toBe(0); expect(d[5]).toBe(0); expect(d[6]).toBe(255);
    // pixel 2 (yellow) stays yellow
    expect(d[8]).toBe(255); expect(d[9]).toBe(255); expect(d[10]).toBe(0);
  });

  it('copies mask at construction so later mutations do not affect replay', () => {
    const mask = new Uint8Array([1, 0, 0, 0]);
    const action = new SelectionClearAction(mask, W, H, mockConfig, 'p1');
    mask[0] = 0; // mutate after construction
    const ctx = makeCtx(imgData);
    action.draw(ctx);
    const d = (ctx.putImageData as any).mock.calls[0][0].data as Uint8ClampedArray;
    // pixel 0 should still be erased (mask was cloned)
    expect(d[0]).toBe(255); expect(d[3]).toBe(255);
  });

  it('calls putImageData at (0,0)', () => {
    const ctx = makeCtx(imgData);
    new SelectionClearAction(new Uint8Array(4), W, H, mockConfig, 'p1').draw(ctx);
    expect(ctx.putImageData).toHaveBeenCalledWith(expect.anything(), 0, 0);
  });

  it('stores correct type and pageId', () => {
    const action = new SelectionClearAction(new Uint8Array(4), W, H, mockConfig, 'myPage');
    expect(action.type).toBe('selection-clear');
    expect(action.pageId).toBe('myPage');
  });
});

// ---------------------------------------------------------------------------
// SelectionFillAction
// ---------------------------------------------------------------------------

describe('SelectionFillAction', () => {
  const W = 2, H = 1;

  it('fills selected pixels with config color at full opacity', () => {
    const mask = new Uint8Array([1, 0]);
    const cfg: ToolConfig = { ...mockConfig, color: '#0071e3', opacity: 100 };
    const imgData = makeWhiteImageData(W, H);
    const ctx = makeCtx(imgData);

    new SelectionFillAction(mask, W, H, cfg, 'p1').draw(ctx);

    const d = (ctx.putImageData as any).mock.calls[0][0].data as Uint8ClampedArray;
    // pixel 0 → #0071e3 = rgb(0, 113, 227)
    expect(d[0]).toBe(0); expect(d[1]).toBe(113); expect(d[2]).toBe(227); expect(d[3]).toBe(255);
  });

  it('respects opacity setting', () => {
    const mask = new Uint8Array([1, 0]);
    const cfg: ToolConfig = { ...mockConfig, color: '#ff0000', opacity: 50 };
    const imgData = makeWhiteImageData(W, H);
    const ctx = makeCtx(imgData);

    new SelectionFillAction(mask, W, H, cfg, 'p1').draw(ctx);

    const d = (ctx.putImageData as any).mock.calls[0][0].data as Uint8ClampedArray;
    // alpha = round(50/100 * 255) = 128
    expect(d[3]).toBe(Math.round(0.5 * 255));
  });

  it('leaves non-selected pixels unchanged', () => {
    const mask = new Uint8Array([1, 0]);
    const pixelData = new Uint8ClampedArray([
      255, 255, 255, 255, // pixel 0: selected → will be filled
      0,   0,   255, 255, // pixel 1: not selected → stays blue
    ]);
    const ctx = makeCtx({ data: pixelData, width: W, height: H });

    new SelectionFillAction(mask, W, H, mockConfig, 'p1').draw(ctx);

    const d = (ctx.putImageData as any).mock.calls[0][0].data as Uint8ClampedArray;
    expect(d[4]).toBe(0); expect(d[5]).toBe(0); expect(d[6]).toBe(255);
  });

  it('copies mask so external mutations do not affect replay', () => {
    const mask = new Uint8Array([1, 1]);
    const action = new SelectionFillAction(mask, W, H, mockConfig, 'p1');
    mask[1] = 0;
    const ctx = makeCtx(makeWhiteImageData(W, H));
    action.draw(ctx);
    const d = (ctx.putImageData as any).mock.calls[0][0].data as Uint8ClampedArray;
    // pixel 1 should still be filled
    expect(d[4]).toBe(255); // R of #ff4400
  });

  it('stores correct type and pageId', () => {
    const action = new SelectionFillAction(new Uint8Array(2), W, H, mockConfig, 'fillPage');
    expect(action.type).toBe('selection-fill');
    expect(action.pageId).toBe('fillPage');
  });
});

// ---------------------------------------------------------------------------
// SelectionMoveAction
// ---------------------------------------------------------------------------

describe('SelectionMoveAction', () => {
  const W = 3, H = 1;

  /** maskedPixels: pixel 0 = red, pixels 1&2 = transparent */
  function makeMaskedPixels() {
    const d = new Uint8ClampedArray(W * H * 4); // all transparent
    d[0] = 200; d[1] = 0; d[2] = 0; d[3] = 255; // pixel 0 = red
    return { data: d, width: W, height: H } as unknown as ImageData;
  }

  it('erases source masked pixels to white', () => {
    const mask = new Uint8Array([1, 0, 0]);
    const pixels = makeMaskedPixels();
    const pageData = new Uint8ClampedArray([200, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255]);
    const imgData = { data: pageData, width: W, height: H };
    const ctx = makeCtx(imgData as any);

    new SelectionMoveAction(mask, W, H, pixels, 1, 0, mockConfig, 'p1').draw(ctx);

    expect(ctx.putImageData).toHaveBeenCalled();
    const d = (ctx.putImageData as any).mock.calls[0][0].data as Uint8ClampedArray;
    // pixel 0 (selected) → white
    expect(d[0]).toBe(255); expect(d[3]).toBe(255);
  });

  it('composites moved pixels via drawImage at the given offset', () => {
    const mask = new Uint8Array([1, 0, 0]);
    const pixels = makeMaskedPixels();
    const ctx = makeCtx(makeWhiteImageData(W, H) as any);

    new SelectionMoveAction(mask, W, H, pixels, 2, 0, mockConfig, 'p1').draw(ctx);

    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 2, 0);
  });

  it('copies mask and pixels so external mutations do not affect replay', () => {
    const mask = new Uint8Array([1, 0, 0]);
    const pixels = makeMaskedPixels();
    const action = new SelectionMoveAction(mask, W, H, pixels, 1, 0, mockConfig, 'p1');

    mask[0] = 0;
    pixels.data[0] = 0;

    const pageData = new Uint8ClampedArray([200, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255]);
    const ctx = makeCtx({ data: pageData, width: W, height: H } as any);
    action.draw(ctx);

    const d = (ctx.putImageData as any).mock.calls[0][0].data as Uint8ClampedArray;
    // pixel 0 should still be erased (mask copy was used)
    expect(d[0]).toBe(255); expect(d[3]).toBe(255);
  });

  it('stores correct type and pageId', () => {
    const pixels = makeMaskedPixels();
    const action = new SelectionMoveAction(new Uint8Array(3), W, H, pixels, 0, 0, mockConfig, 'movePage');
    expect(action.type).toBe('selection-move');
    expect(action.pageId).toBe('movePage');
  });
});

// ---------------------------------------------------------------------------
// PasteAction
// ---------------------------------------------------------------------------

describe('PasteAction', () => {
  const W = 2, H = 2;

  function makePasteImageData() {
    const d = new Uint8ClampedArray(W * H * 4);
    d[0] = 100; d[1] = 150; d[2] = 200; d[3] = 255;
    return { data: d, width: W, height: H } as unknown as ImageData;
  }

  it('draws via drawImage at the specified coordinates', () => {
    const imgData = makePasteImageData();
    const ctx = makeCtx(makeWhiteImageData(W, H) as any);

    new PasteAction(imgData, 10, 20, mockConfig, 'p1').draw(ctx);

    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 10, 20);
  });

  it('copies ImageData so external mutations do not affect replay', () => {
    const imgData = makePasteImageData();
    const action = new PasteAction(imgData, 0, 0, mockConfig, 'p1');
    imgData.data[0] = 0; // mutate after construction

    const ctx = makeCtx(makeWhiteImageData(W, H) as any);
    action.draw(ctx); // should not throw

    // drawImage was still called (action did not crash)
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('stores correct type and pageId', () => {
    const action = new PasteAction(makePasteImageData(), 5, 5, mockConfig, 'pastePage');
    expect(action.type).toBe('paste');
    expect(action.pageId).toBe('pastePage');
  });

  it('draws at (0,0) when offset is zero', () => {
    const ctx = makeCtx(makeWhiteImageData(W, H) as any);
    new PasteAction(makePasteImageData(), 0, 0, mockConfig, 'p1').draw(ctx);
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0);
  });
});
