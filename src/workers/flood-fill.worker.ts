import { floodFill } from './flood-fill.core';

self.onmessage = (e: MessageEvent) => {
    const { data, width, height, startX, startY, targetR, targetG, targetB } = e.data;

    // The data passed is likely a Uint8ClampedArray or similar buffer view
    // We modify it in place
    floodFill(data, width, height, startX, startY, targetR, targetG, targetB);

    (self as any).postMessage({ data }, [data.buffer]);
};
