import { StrokeAction, ShapeAction, FillAction } from './actions';
import type { ActionType, DrawingAction } from './actions/types';
export type { ActionType, DrawingAction };
export { StrokeAction, ShapeAction, FillAction };

import { APP_CONFIG } from './config';

export class HistoryManager {
    private undoStack: DrawingAction[] = [];
    private redoStack: DrawingAction[] = [];
    private snapshots: { index: number, data: any }[] = [];
    private maxHistory: number = APP_CONFIG.HISTORY_LIMIT;

    constructor(initialLimit: number = APP_CONFIG.HISTORY_LIMIT) {
        this.maxHistory = initialLimit;
    }

    public setLimit(limit: number) {
        this.maxHistory = limit;
        if (this.undoStack.length > this.maxHistory) {
            const shiftCount = this.undoStack.length - this.maxHistory;
            this.undoStack = this.undoStack.slice(shiftCount);
            // Prune snapshots that are now before the start of the stack
            this.snapshots = this.snapshots
                .map(s => ({ ...s, index: s.index - shiftCount }))
                .filter(s => s.index >= 0);
        }
    }

    public push(action: DrawingAction) {
        this.undoStack.push(action);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
            // Offset existing snapshots
            this.snapshots = this.snapshots
                .map(s => ({ ...s, index: s.index - 1 }))
                .filter(s => s.index >= 0);
        }
        this.redoStack = []; // Clear redo on new action
    }

    public undo(): DrawingAction[] | null {
        if (this.undoStack.length === 0) return null;
        const action = this.undoStack.pop()!;
        this.redoStack.push(action);
        return [...this.undoStack]; // Return remaining actions to redraw
    }

    public redo(): DrawingAction[] | null {
        if (this.redoStack.length === 0) return null;
        const action = this.redoStack.pop()!;
        this.undoStack.push(action);
        return [...this.undoStack]; // Return all actions to redraw
    }

    /** Replace an action at a specific index (for re-editing text) */
    public replaceAction(index: number, newAction: DrawingAction): void {
        if (index >= 0 && index < this.undoStack.length) {
            this.undoStack[index] = newAction;
            this.redoStack = [];
            // Invalidate snapshots after this modification
            this.snapshots = this.snapshots.filter(s => s.index < index);
        }
    }

    /** Remove an action at a specific index (e.g. cleared text during re-edit) */
    public removeAction(index: number): void {
        if (index >= 0 && index < this.undoStack.length) {
            this.undoStack.splice(index, 1);
            this.redoStack = [];
            // Invalidate snapshots after this modification
            this.snapshots = this.snapshots.filter(s => s.index < index);
        }
    }

    public getActions(): DrawingAction[] {
        return [...this.undoStack];
    }

    public canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    public clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.snapshots = [];
    }

    public addSnapshot(data: any) {
        this.snapshots.push({
            index: this.undoStack.length - 1,
            data
        });
    }

    public getLatestSnapshot(actionCount: number): { index: number, data: any } | null {
        // Find latest snapshot that covers at most actionCount actions
        // Snapshot index 19 means it covers actions 0 to 19 (20 actions)
        // So we need index <= actionCount - 1
        const targetIndex = actionCount - 1;
        let latest: { index: number, data: any } | null = null;
        for (const s of this.snapshots) {
            if (s.index <= targetIndex && (latest === null || s.index > latest.index)) {
                latest = s;
            }
        }
        return latest;
    }
    public getCount(): number {
        return this.undoStack.length;
    }
}
