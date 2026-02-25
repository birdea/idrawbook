import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { SelectTool } from '../tools/select-tool';
import type { ICanvasContext, Page } from '../canvas/types';
import type { ToolConfig } from '../tools/types';

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

if (typeof (globalThis as any).ClipboardItem === 'undefined') {
  (globalThis as any).ClipboardItem = class ClipboardItem {
    items: Record<string, Blob | Promise<Blob>>;
    constructor(items: Record<string, Blob | Promise<Blob>>) { this.items = items; }
  };
}

// ---------------------------------------------------------------------------
// jsdom canvas mock – getContext('2d') must return a real-enough object so
// SelectTool's overlay canvas and temp canvases don't throw on null.
// ---------------------------------------------------------------------------
const mockOverlayCtx = {
  clearRect: vi.fn(),
  createImageData: vi.fn((w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4),
    width: w,
    height: h,
  })),
  putImageData: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4).fill(255),
    width: w,
    height: h,
  })),
};

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockOverlayCtx as any);
});

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

const PAGE_W = 4, PAGE_H = 4;

const mockConfig: ToolConfig = {
  size: 5,
  color: '#ff0000',
  opacity: 100,
  hardness: 100,
  pressure: 50,
};


function makePage(id = 'page1', x = 0, y = 0, w = PAGE_W, h = PAGE_H): Page {
  return {
    id,
    x,
    y,
    width: w,
    height: h,
    canvas: document.createElement('canvas'),
    ctx: {
      getImageData: vi.fn((_sx: number, _sy: number, sw: number, sh: number) => ({
        data: new Uint8ClampedArray(sw * sh * 4).fill(255),
        width: sw,
        height: sh,
      })),
      putImageData: vi.fn(),
      createImageData: vi.fn((w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      })),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D,
  } as unknown as Page;
}

function makeContext(overrides: Partial<ICanvasContext> = {}): ICanvasContext {
  const mainCanvas = {
    width: 800,
    height: 600,
    style: { cursor: '' },
  } as unknown as HTMLCanvasElement;

  return {
    canvas: mainCanvas,
    ctx: {
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D,
    scale: 1,
    offset: { x: 0, y: 0 },
    config: mockConfig,
    pushAction: vi.fn(),
    render: vi.fn(),
    onUpdateCallback: vi.fn(),
    postRenderCallback: null,
    ...overrides,
  } as unknown as ICanvasContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SelectTool', () => {
  let context: ICanvasContext;
  let page: Page;
  let tool: SelectTool;

  beforeEach(() => {
    vi.clearAllMocks();
    context = makeContext();
    page = makePage();
    tool = new SelectTool(context);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---- lifecycle -----------------------------------------------------------

  describe('activate / deactivate / cancel', () => {
    it('activate sets wand cursor and registers postRenderCallback', () => {
      tool.activate();
      expect(context.canvas.style.cursor).toContain('crosshair');
      expect(context.postRenderCallback).not.toBeNull();
    });

    it('deactivate clears postRenderCallback and calls render', () => {
      tool.activate();
      tool.deactivate();
      expect(context.postRenderCallback).toBeNull();
      expect(context.render).toHaveBeenCalled();
    });

    it('cancel clears selection and calls render', () => {
      // Create a selection first
      tool.selectAll(page);
      expect(tool.hasSelection()).toBe(true);

      tool.cancel();
      expect(tool.hasSelection()).toBe(false);
      expect(context.render).toHaveBeenCalled();
    });

    it('deselect() is an alias for cancel()', () => {
      tool.selectAll(page);
      tool.deselect();
      expect(tool.hasSelection()).toBe(false);
    });
  });

  // ---- onDown – flood fill selection --------------------------------------

  describe('onDown – flood fill', () => {
    it('clicking on page creates a selection', () => {
      tool.activate();
      tool.onDown({} as PointerEvent, { x: 1, y: 1 }, page);
      expect(tool.hasSelection()).toBe(true);
    });

    it('clicking outside page bounds clears selection', () => {
      tool.activate();
      tool.selectAll(page);
      // Click far outside page (page.x=0, page.y=0, width=4, height=4)
      tool.onDown({} as PointerEvent, { x: 100, y: 100 }, page);
      expect(tool.hasSelection()).toBe(false);
    });

    it('clicking with null targetPage clears selection', () => {
      tool.activate();
      tool.selectAll(page);
      tool.onDown({} as PointerEvent, { x: 1, y: 1 }, null);
      expect(tool.hasSelection()).toBe(false);
    });

    it('creates mask with same dimensions as the page', () => {
      tool.activate();
      tool.onDown({} as PointerEvent, { x: 1, y: 1 }, page);
      const mask = tool.getSelectionMask();
      expect(mask).not.toBeNull();
      expect(mask!.width).toBe(PAGE_W);
      expect(mask!.height).toBe(PAGE_H);
    });
  });

  // ---- getSelectionMask ---------------------------------------------------

  describe('getSelectionMask', () => {
    it('returns null when no selection', () => {
      expect(tool.getSelectionMask()).toBeNull();
    });

    it('returns mask object after selectAll', () => {
      tool.selectAll(page);
      const m = tool.getSelectionMask();
      expect(m).not.toBeNull();
      expect(m!.mask).toBeInstanceOf(Uint8Array);
      expect(m!.width).toBe(PAGE_W);
      expect(m!.height).toBe(PAGE_H);
      expect(m!.page).toBe(page);
    });
  });

  // ---- hasSelection -------------------------------------------------------

  describe('hasSelection', () => {
    it('returns false initially', () => {
      expect(tool.hasSelection()).toBe(false);
    });

    it('returns true after selectAll', () => {
      tool.selectAll(page);
      expect(tool.hasSelection()).toBe(true);
    });

    it('returns false after deselect', () => {
      tool.selectAll(page);
      tool.deselect();
      expect(tool.hasSelection()).toBe(false);
    });
  });

  // ---- selectAll ----------------------------------------------------------

  describe('selectAll', () => {
    it('sets all mask bits to 1', () => {
      tool.selectAll(page);
      const { mask } = tool.getSelectionMask()!;
      expect(mask.every(v => v === 1)).toBe(true);
    });

    it('mask length matches page dimensions', () => {
      tool.selectAll(page);
      const { mask } = tool.getSelectionMask()!;
      expect(mask.length).toBe(PAGE_W * PAGE_H);
    });

    it('calls render', () => {
      tool.selectAll(page);
      expect(context.render).toHaveBeenCalled();
    });
  });

  // ---- invertSelection ----------------------------------------------------

  describe('invertSelection', () => {
    it('flips mask bits', () => {
      tool.selectAll(page);
      tool.invertSelection(page);
      const { mask } = tool.getSelectionMask()!;
      expect(mask.every(v => v === 0)).toBe(true);
    });

    it('calls selectAll when no selection exists (falls back to select-all then invert)', () => {
      // No existing selection → invertSelection should call selectAll internally
      const spy = vi.spyOn(tool, 'selectAll');
      tool.invertSelection(page);
      expect(spy).toHaveBeenCalledWith(page);
    });

    it('calls selectAll when selection is on a different page', () => {
      const otherPage = makePage('other');
      tool.selectAll(page);
      const spy = vi.spyOn(tool, 'selectAll');
      tool.invertSelection(otherPage);
      expect(spy).toHaveBeenCalledWith(otherPage);
    });

    it('calls render', () => {
      tool.selectAll(page);
      vi.clearAllMocks();
      tool.invertSelection(page);
      expect(context.render).toHaveBeenCalled();
    });
  });

  // ---- deleteSelection ----------------------------------------------------

  describe('deleteSelection', () => {
    it('returns false when no selection', () => {
      expect(tool.deleteSelection()).toBe(false);
    });

    it('returns true when selection exists', () => {
      tool.selectAll(page);
      expect(tool.deleteSelection()).toBe(true);
    });

    it('pushes a SelectionClearAction to history', () => {
      tool.selectAll(page);
      tool.deleteSelection();
      expect(context.pushAction).toHaveBeenCalledTimes(1);
      const action = (context.pushAction as any).mock.calls[0][0];
      expect(action.type).toBe('selection-clear');
    });

    it('clears the selection after deletion', () => {
      tool.selectAll(page);
      tool.deleteSelection();
      expect(tool.hasSelection()).toBe(false);
    });

    it('calls render and onUpdateCallback', () => {
      tool.selectAll(page);
      tool.deleteSelection();
      expect(context.render).toHaveBeenCalled();
      expect(context.onUpdateCallback).toHaveBeenCalled();
    });
  });

  // ---- fillSelection ------------------------------------------------------

  describe('fillSelection', () => {
    it('returns false when no selection', () => {
      expect(tool.fillSelection()).toBe(false);
    });

    it('returns true when selection exists', () => {
      tool.selectAll(page);
      expect(tool.fillSelection()).toBe(true);
    });

    it('pushes a SelectionFillAction to history', () => {
      tool.selectAll(page);
      tool.fillSelection();
      const action = (context.pushAction as any).mock.calls[0][0];
      expect(action.type).toBe('selection-fill');
    });

    it('clears the selection after fill', () => {
      tool.selectAll(page);
      tool.fillSelection();
      expect(tool.hasSelection()).toBe(false);
    });

    it('calls render and onUpdateCallback', () => {
      tool.selectAll(page);
      tool.fillSelection();
      expect(context.render).toHaveBeenCalled();
      expect(context.onUpdateCallback).toHaveBeenCalled();
    });
  });

  // ---- cursor hover -------------------------------------------------------

  describe('onMove – cursor hover', () => {
    it('sets move cursor when hovering over selection', () => {
      tool.activate();
      tool.selectAll(page);
      // Hover inside the selection (page at x=0,y=0; mask covers full page)
      tool.onMove({} as PointerEvent, { x: 1, y: 1 }, page);
      expect(context.canvas.style.cursor).toBe('move');
    });

    it('restores wand cursor when hovering outside selection', () => {
      tool.activate();
      tool.selectAll(page);
      // Move cursor → then move outside page
      tool.onMove({} as PointerEvent, { x: 100, y: 100 }, page);
      expect(context.canvas.style.cursor).toContain('crosshair');
    });

    it('restores wand cursor when no selection', () => {
      tool.activate();
      tool.onMove({} as PointerEvent, { x: 1, y: 1 }, page);
      expect(context.canvas.style.cursor).toContain('crosshair');
    });
  });

  // ---- move mode ----------------------------------------------------------

  describe('move mode', () => {
    it('clicking inside selection enters move mode (cursor = move)', () => {
      tool.activate();
      tool.selectAll(page);
      // Down inside selection
      tool.onDown({} as PointerEvent, { x: 1, y: 1 }, page);
      expect(context.canvas.style.cursor).toBe('move');
    });

    it('onMove during move updates dx/dy and calls render', () => {
      tool.activate();
      tool.selectAll(page);
      tool.onDown({} as PointerEvent, { x: 1, y: 1 }, page);
      vi.clearAllMocks();
      tool.onMove({} as PointerEvent, { x: 3, y: 2 }, page);
      expect(context.render).toHaveBeenCalled();
    });

    it('onUp commits move: pushes SelectionMoveAction and restores wand cursor', () => {
      tool.activate();
      tool.selectAll(page);
      tool.onDown({} as PointerEvent, { x: 0, y: 0 }, page);
      tool.onMove({} as PointerEvent, { x: 2, y: 1 }, page); // dx=2, dy=1
      tool.onUp({} as PointerEvent, { x: 2, y: 1 }, page);

      expect(context.pushAction).toHaveBeenCalledTimes(1);
      const action = (context.pushAction as any).mock.calls[0][0];
      expect(action.type).toBe('selection-move');
      expect(context.canvas.style.cursor).toContain('crosshair');
    });

    it('onUp with zero displacement does NOT push an action', () => {
      tool.activate();
      tool.selectAll(page);
      tool.onDown({} as PointerEvent, { x: 1, y: 1 }, page);
      tool.onUp({} as PointerEvent, { x: 1, y: 1 }, page);
      expect(context.pushAction).not.toHaveBeenCalled();
    });

    it('cancel during move restores cursor and does not push action', () => {
      tool.activate();
      tool.selectAll(page);
      tool.onDown({} as PointerEvent, { x: 1, y: 1 }, page);
      tool.cancel();
      expect(context.pushAction).not.toHaveBeenCalled();
      expect(context.canvas.style.cursor).toContain('crosshair');
    });

    it('deactivate during move restores cursor and clears selection', () => {
      tool.activate();
      tool.selectAll(page);
      tool.onDown({} as PointerEvent, { x: 1, y: 1 }, page);
      tool.deactivate();
      expect(context.canvas.style.cursor).toContain('crosshair');
      expect(tool.hasSelection()).toBe(false);
    });

    it('after committed move, selection mask is shifted', () => {
      tool.activate();
      tool.selectAll(page); // full 4×4 mask, all 1s

      // Move by (1, 1)
      tool.onDown({} as PointerEvent, { x: 0, y: 0 }, page);
      tool.onMove({} as PointerEvent, { x: 1, y: 1 }, page);
      tool.onUp({} as PointerEvent, { x: 1, y: 1 }, page);

      // Mask should still exist (shifted)
      expect(tool.hasSelection()).toBe(true);
      const { mask, width } = tool.getSelectionMask()!;
      // Pixels at row 0 or col 0 should now be 0 (shifted out)
      expect(mask[0]).toBe(0); // (0,0) shifted to (-1,-1) → out of bounds
      // Pixel at (1,1) = idx 1*4+1 = 5 should be 1
      expect(mask[1 * width + 1]).toBe(1);
    });
  });

  // ---- clipboard ----------------------------------------------------------

  describe('copySelection / cutSelection', () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        writable: true,
        value: {
          write: vi.fn().mockResolvedValue(undefined),
          read: vi.fn().mockResolvedValue([]),
        },
      });
      // Mock canvas.toBlob
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
        (cb) => cb(new Blob(['data'], { type: 'image/png' }))
      );
    });

    it('copySelection returns false when no selection', async () => {
      expect(await tool.copySelection()).toBe(false);
    });

    it('copySelection returns true and writes to clipboard', async () => {
      tool.selectAll(page);
      const result = await tool.copySelection();
      expect(result).toBe(true);
      expect(navigator.clipboard.write).toHaveBeenCalledTimes(1);
    });

    it('cutSelection returns false when no selection', async () => {
      expect(await tool.cutSelection()).toBe(false);
    });

    it('cutSelection copies then deletes: pushes action and clears selection', async () => {
      tool.selectAll(page);
      const result = await tool.cutSelection();
      expect(result).toBe(true);
      // deleteSelection pushes an action
      expect(context.pushAction).toHaveBeenCalledTimes(1);
      expect(tool.hasSelection()).toBe(false);
    });

    it('copySelection returns false when clipboard write fails', async () => {
      (navigator.clipboard.write as any).mockRejectedValue(new Error('denied'));
      tool.selectAll(page);
      const result = await tool.copySelection();
      expect(result).toBe(false);
    });
  });
});
