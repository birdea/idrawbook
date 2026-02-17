import { BaseTool } from './base-tool';
import { ToolUtils } from './tool-utils';
import { FillAction } from '../history';
import type { Point } from './types';
import type { Page } from '../canvas/types';

export class FillTool extends BaseTool {
    async onDown(e: PointerEvent, worldPos: Point, targetPage: Page | null): Promise<void> {
        if (!targetPage) return;

        let pressure = e.pressure;
        if (e.pointerType === 'mouse') pressure = 0.5;

        const localPoint: Point = {
            x: worldPos.x - targetPage.x,
            y: worldPos.y - targetPage.y,
            pressure
        };

        await ToolUtils.floodFill(targetPage.ctx, localPoint, this.context.config.color);
        const action = new FillAction(localPoint, this.context.config, targetPage.id);
        this.context.pushAction(action);
        await this.context.render();
        this.context.onUpdateCallback?.(targetPage.id);
    }

    onMove(_e: PointerEvent, _worldPos: Point, _targetPage: Page | null): void {
        // No-op for fill tool
    }

    onUp(_e: PointerEvent, _worldPos: Point, _targetPage: Page | null): void {
        // No-op for fill tool
    }
}
