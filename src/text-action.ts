import type { ToolConfig } from './tools';
import type { DrawingAction, ActionType } from './history';

export interface TextConfig {
    fontSize: number;
    color: string;
    lineHeight: number;
    hAlign: 'left' | 'center' | 'right';
    fontFamily: string;
}

export interface TextPlacement {
    pageId: string;
    localX: number;
    localY: number;
}

export class TextAction implements DrawingAction {
    type: ActionType = 'text';
    text: string;
    placement: TextPlacement;
    textConfig: TextConfig;
    config: ToolConfig;
    pageId: string;

    constructor(text: string, placement: TextPlacement, textConfig: TextConfig, config: ToolConfig) {
        this.text = text;
        this.placement = { ...placement };
        this.textConfig = { ...textConfig };
        this.config = { ...config };
        this.pageId = placement.pageId;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        const { fontSize, color, lineHeight, hAlign, fontFamily } = this.textConfig;
        const { localX, localY } = this.placement;

        ctx.save();
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textAlign = hAlign;
        ctx.textBaseline = 'top';

        const lines = this.text.split('\n');
        const lineHeightPx = fontSize * lineHeight;

        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], localX, localY + i * lineHeightPx);
        }

        ctx.restore();
    }

    /** Hit test: check if a page-local point falls within this text's bounding box */
    hitTest(localX: number, localY: number, ctx: CanvasRenderingContext2D): boolean {
        const { fontSize, lineHeight, fontFamily, hAlign } = this.textConfig;
        const lines = this.text.split('\n');
        const lineHeightPx = fontSize * lineHeight;
        const totalHeight = lines.length * lineHeightPx;

        ctx.save();
        ctx.font = `${fontSize}px ${fontFamily}`;

        let maxWidth = 0;
        for (const line of lines) {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
        }
        ctx.restore();

        const pad = 4;
        let x0 = this.placement.localX - pad;
        if (hAlign === 'center') x0 = this.placement.localX - maxWidth / 2 - pad;
        else if (hAlign === 'right') x0 = this.placement.localX - maxWidth - pad;

        const y0 = this.placement.localY - pad;
        const x1 = x0 + maxWidth + pad * 2;
        const y1 = y0 + totalHeight + pad * 2;

        return localX >= x0 && localX <= x1 && localY >= y0 && localY <= y1;
    }
}
