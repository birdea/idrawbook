import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HistoryManager, StrokeAction, ShapeAction, FillAction, type DrawingAction } from '../history';
import { ToolUtils } from '../tools/tool-utils';
import type { ToolConfig, Point } from '../tools/types';

describe('HistoryManager', () => {
    let history: HistoryManager;

    beforeEach(() => {
        history = new HistoryManager(5);
    });

    it('should initialize with default limits', () => {
        const h = new HistoryManager();
        expect(h.canUndo()).toBe(false);
        expect(h.canRedo()).toBe(false);
    });

    it('should push actions and support undo check', () => {
        const mockAction = { type: 'stroke', config: {}, draw: () => { } } as unknown as DrawingAction;
        history.push(mockAction);
        expect(history.canUndo()).toBe(true);
        expect(history.canRedo()).toBe(false);
    });

    it('should undo and return remaining actions', () => {
        const action1 = { type: 'stroke', config: {}, draw: () => { } } as unknown as DrawingAction;
        const action2 = { type: 'line', config: {}, draw: () => { } } as unknown as DrawingAction;

        history.push(action1);
        history.push(action2);

        const remaining = history.undo();
        expect(remaining).toHaveLength(1);
        expect(remaining?.[0]).toBe(action1);
        expect(history.canRedo()).toBe(true);
    });

    it('should redo and return all actions', () => {
        const action1 = { type: 'stroke', config: {}, draw: () => { } } as unknown as DrawingAction;

        history.push(action1);
        history.undo();

        const restored = history.redo();
        expect(restored).toHaveLength(1);
        expect(restored?.[0]).toBe(action1);
        expect(history.canRedo()).toBe(false);
    });

    it('should respect history limit', () => {
        history.setLimit(2);

        const action1 = { type: 'stroke' } as any;
        const action2 = { type: 'line' } as any;
        const action3 = { type: 'rect' } as any;

        history.push(action1);
        history.push(action2);
        history.push(action3);

        const actions = history.getActions();
        expect(actions).toHaveLength(2);
        expect(actions[0]).toBe(action2);
        expect(actions[1]).toBe(action3);
    });

    it('should clear redo stack on new push', () => {
        const action1 = { type: 'stroke' } as any;
        const action2 = { type: 'line' } as any;

        history.push(action1);
        history.undo();
        expect(history.canRedo()).toBe(true);

        history.push(action2);
        expect(history.canRedo()).toBe(false);
    });

    it('should clear history', () => {
        history.push({ type: 'stroke' } as any);
        history.clear();
        expect(history.canUndo()).toBe(false);
        expect(history.canRedo()).toBe(false);
    });

    it('should replace action', () => {
        const action1 = { type: 'stroke' } as any;
        const action2 = { type: 'line' } as any;

        history.push(action1);
        history.replaceAction(0, action2);

        expect(history.getActions()[0]).toBe(action2);
        expect(history.canRedo()).toBe(false); // Should clear redo
    });

    it('should ignore replace action invalid index', () => {
        const action1 = { type: 'stroke' } as any;
        history.push(action1);
        history.replaceAction(5, { type: 'line' } as any);
        expect(history.getActions()[0]).toBe(action1);
    });

    it('should remove action', () => {
        const action1 = { type: 'stroke' } as any;
        const action2 = { type: 'line' } as any;

        history.push(action1);
        history.push(action2);

        history.removeAction(0);

        expect(history.getActions()).toHaveLength(1);
        expect(history.getActions()[0]).toBe(action2);
    });

    it('should manage snapshots', () => {
        const action1 = { type: 'stroke' } as any;
        const action2 = { type: 'line' } as any;
        const action3 = { type: 'rect' } as any;

        history.push(action1);
        history.addSnapshot('snap1'); // index 0

        history.push(action2);
        history.push(action3);
        history.addSnapshot('snap2'); // index 2

        expect(history.getLatestSnapshot(1)).toEqual({ index: 0, data: 'snap1' });
        expect(history.getLatestSnapshot(2)).toEqual({ index: 0, data: 'snap1' }); // covers 0..1?
        // getLatestSnapshot(count) finds snapshot with index <= count - 1
        // count=1 -> targetIndex=0. snap1 index=0. Match.
        // count=2 -> targetIndex=1. snap1 index=0. Match. snap2 index=2 > 1.

        expect(history.getLatestSnapshot(3)).toEqual({ index: 2, data: 'snap2' });
        expect(history.getLatestSnapshot(100)).toEqual({ index: 2, data: 'snap2' });
    });

    it('should invalidated snapshots on history change', () => {
        history.push({ type: '1' } as any);
        history.addSnapshot('s1');
        history.push({ type: '2' } as any);

        history.undo(); // Undo removes action? No, undo just moves pointer usually, but here implementation pops from undoStack.
        // implementation: undoStack vs redoStack.
        // undo() pops from undoStack.

        // Wait, does undo invalidate snapshots? The code does NOT seem to invalidate snapshots on undo/redo explicitly in `undo` method?
        // Let's check source.
        // undo(): pop from undoStack.
        // redostack push.
        // valid actions are now 0..length-1.
        // If we restore from snapshot, we restore state.

        // But the question is: if I undo, is the snapshot for that undone action still valid?
        // Snapshot is associated with index. If index is removed from undoStack...
        // Actually undoStack size decreases.
        // Code: push() checks undoStack.length > maxHistory.

        // But `undo` method doesn't touch snapshots array.
        // However, getLatestSnapshot uses `actionCount` which is effectively current undostack length when looking for recovery?
        // If I undo, undoStack.length becomes smaller.
        // If I call getLatestSnapshot(newLength), it will find snapshots with index < newLength.

        // Tests for replace/remove action explicitly filter snapshots.

        history.removeAction(0);
        // Snapshot at index 0 (s1) should be removed because s.index < index (0 < 0 is false).
        // Wait: `this.snapshots = this.snapshots.filter(s => s.index < index);`
        // If index=0, keeps nothing?
        // logic: s.index < 0 -> false. So clears everything. Correct.

        expect(history.getLatestSnapshot(1)).toBeNull();
    });

    it('should get count', () => {
        expect(history.getCount()).toBe(0);
        history.push({} as any);
        expect(history.getCount()).toBe(1);
    });
});

describe('Action Classes', () => {
    const mockCtx = {} as CanvasRenderingContext2D;
    const mockConfig: ToolConfig = {
        size: 5,
        color: '#000000',
        opacity: 100,
        hardness: 100,
        pressure: 50
    };
    const mockPoint: Point = { x: 0, y: 0 };

    beforeEach(() => {
        vi.spyOn(ToolUtils, 'drawStroke').mockImplementation(() => { });
        vi.spyOn(ToolUtils, 'drawLine').mockImplementation(() => { });
        vi.spyOn(ToolUtils, 'drawRect').mockImplementation(() => { });
        vi.spyOn(ToolUtils, 'drawCircle').mockImplementation(() => { });
        vi.spyOn(ToolUtils, 'floodFill').mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('StrokeAction should call ToolUtils.drawStroke', () => {
        const action = new StrokeAction([mockPoint], mockConfig, 'pencil', 'page-1');
        action.draw(mockCtx);
        expect(ToolUtils.drawStroke).toHaveBeenCalledWith(mockCtx, [mockPoint], 'pencil', expect.objectContaining(mockConfig));
    });

    it('ShapeAction (line) should call ToolUtils.drawLine', () => {
        const action = new ShapeAction('line', mockPoint, mockPoint, mockConfig, 'page-1');
        action.draw(mockCtx);
        expect(ToolUtils.drawLine).toHaveBeenCalled();
    });

    it('ShapeAction (rect) should call ToolUtils.drawRect', () => {
        const action = new ShapeAction('rect', mockPoint, mockPoint, mockConfig, 'page-1');
        action.draw(mockCtx);
        expect(ToolUtils.drawRect).toHaveBeenCalled();
    });

    it('ShapeAction (circle) should call ToolUtils.drawCircle', () => {
        const action = new ShapeAction('circle', mockPoint, mockPoint, mockConfig, 'page-1');
        action.draw(mockCtx);
        expect(ToolUtils.drawCircle).toHaveBeenCalled();
    });

    it('FillAction should call ToolUtils.floodFill', async () => {
        const action = new FillAction(mockPoint, mockConfig, 'page-1');
        await action.draw(mockCtx);
        expect(ToolUtils.floodFill).toHaveBeenCalled();
    });
});
