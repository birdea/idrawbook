export function floodFill(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number,
    targetR: number,
    targetG: number,
    targetB: number
): boolean { // Returns true if changes were made
    const startPos = (startY * width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    // If target color is same as start color, return
    if (startR === targetR && startG === targetG && startB === targetB && startA === 255) {
        return false;
    }

    const stack: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(width * height);

    const matchStartColor = (x: number, y: number) => {
        const pos = (y * width + x) * 4;
        return data[pos] === startR &&
            data[pos + 1] === startG &&
            data[pos + 2] === startB &&
            data[pos + 3] === startA;
    };

    const colorPixel = (x: number, y: number) => {
        const pos = (y * width + x) * 4;
        data[pos] = targetR;
        data[pos + 1] = targetG;
        data[pos + 2] = targetB;
        data[pos + 3] = 255;
    };

    while (stack.length) {
        const [x, y] = stack.pop()!;
        if (visited[y * width + x]) continue;
        visited[y * width + x] = 1;

        if (matchStartColor(x, y)) {
            colorPixel(x, y);

            if (x > 0) stack.push([x - 1, y]);
            if (x < width - 1) stack.push([x + 1, y]);
            if (y > 0) stack.push([x, y - 1]);
            if (y < height - 1) stack.push([x, y + 1]);
        }
    }
    return true;
}
