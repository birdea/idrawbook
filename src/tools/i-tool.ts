import type { Page } from '../canvas/types';
import type { Point } from './types';

export interface ITool {
    onDown(e: PointerEvent, worldPos: Point, targetPage: Page | null): void;
    onMove(e: PointerEvent, worldPos: Point, targetPage: Page | null): void;
    onUp(e: PointerEvent, worldPos: Point, targetPage: Page | null): void;
    activate(): void;
    deactivate(): void;
    cancel(): void;
    // Optional: onEnter, onLeave if needed later
}
