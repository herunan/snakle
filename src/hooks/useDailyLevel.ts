import { useMemo } from 'react';
import { GRID_SIZE } from '../utils/constants';
import type { Point } from '../utils/constants';
import { SeededRNG, getDailySeed } from '../utils/random';

// Helper to check if the grid is fully connected
function isConnected(walls: Point[], gridSize: number): boolean {
    const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    walls.forEach(w => {
        if (w.x >= 0 && w.x < gridSize && w.y >= 0 && w.y < gridSize) {
            grid[w.y][w.x] = true; // true means wall
        }
    });

    // Find a start point (non-wall)
    let start: Point | null = null;
    let freeCount = 0;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (!grid[y][x]) {
                freeCount++;
                if (!start) start = { x, y };
            }
        }
    }

    if (freeCount === 0) return false; // No free space
    if (!start) return false;

    // BFS
    const queue: Point[] = [start];
    const visited = new Set<string>();
    visited.add(`${start.x},${start.y}`);
    let visitedCount = 0;

    while (queue.length > 0) {
        const p = queue.shift()!;
        visitedCount++;

        const neighbors = [
            { x: p.x, y: p.y - 1 },
            { x: p.x, y: p.y + 1 },
            { x: p.x - 1, y: p.y },
            { x: p.x + 1, y: p.y },
        ];

        for (const n of neighbors) {
            // Handle wrapping for connectivity check
            const nx = (n.x + gridSize) % gridSize;
            const ny = (n.y + gridSize) % gridSize;

            if (!grid[ny][nx] && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                queue.push({ x: nx, y: ny });
            }
        }
    }

    return visitedCount === freeCount;
}

export function useDailyLevel() {
    const walls = useMemo(() => {
        // Debug mode check
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('debug') === 'true') {
                return [{ x: 5, y: 5 }]; // Single block obstacle
            }
        }

        const dateSeed = getDailySeed();
        let attempt = 0;

        while (attempt < 100) {
            // Mix seed with attempt to get different results on retry
            const rng = new SeededRNG(`${dateSeed}-${attempt}`);
            const generatedWalls: Point[] = [];
            const patternType = rng.nextInt(0, 3); // 0: Scattered, 1: Lines, 2: Box/Donut, 3: Maze-ish

            if (patternType === 0) {
                // Scattered Blocks
                const count = rng.nextInt(10, 25);
                for (let i = 0; i < count; i++) {
                    generatedWalls.push({
                        x: rng.nextInt(0, GRID_SIZE - 1),
                        y: rng.nextInt(0, GRID_SIZE - 1),
                    });
                }
            } else if (patternType === 1) {
                // Lines
                const isVertical = rng.next() > 0.5;
                const count = rng.nextInt(2, 4);
                for (let c = 0; c < count; c++) {
                    const fixed = rng.nextInt(2, GRID_SIZE - 3);
                    for (let i = 0; i < GRID_SIZE; i++) {
                        if (rng.next() > 0.2) { // 80% chance of wall
                            generatedWalls.push(isVertical ? { x: fixed, y: i } : { x: i, y: fixed });
                        }
                    }
                }
            } else if (patternType === 2) {
                // Box / Donut
                const inset = rng.nextInt(3, 6);

                // Top/Bottom
                for (let x = inset; x < GRID_SIZE - inset; x++) {
                    generatedWalls.push({ x, y: inset });
                    generatedWalls.push({ x, y: GRID_SIZE - inset - 1 });
                }
                // Left/Right
                for (let y = inset; y < GRID_SIZE - inset; y++) {
                    generatedWalls.push({ x: inset, y });
                    generatedWalls.push({ x: GRID_SIZE - inset - 1, y });
                }

                // Make gaps
                const gapCount = rng.nextInt(2, 4);
                for (let i = 0; i < gapCount; i++) {
                    // Remove a random wall
                    if (generatedWalls.length > 0) {
                        const idx = rng.nextInt(0, generatedWalls.length - 1);
                        generatedWalls.splice(idx, 1);
                        // Remove neighbors to make it wider
                        if (idx < generatedWalls.length) generatedWalls.splice(idx, 1);
                    }
                }
            } else {
                // Spiral-ish
                let x = Math.floor(GRID_SIZE / 2);
                let y = Math.floor(GRID_SIZE / 2);
                let steps = 1;
                let dir = 0; // 0: up, 1: right, 2: down, 3: left
                const dirs = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

                for (let i = 0; i < GRID_SIZE * 2; i++) {
                    for (let s = 0; s < steps; s++) {
                        x += dirs[dir].x;
                        y += dirs[dir].y;
                        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                            if (rng.next() > 0.3) {
                                generatedWalls.push({ x, y });
                            }
                        }
                    }
                    dir = (dir + 1) % 4;
                    if (i % 2 === 0) steps++;
                }
            }

            // Ensure snake spawn (10,10) and surrounding area is clear
            const finalWalls = generatedWalls.filter(w => {
                // Clear 3x3 area around snake spawn
                const dx = Math.abs(w.x - 10);
                const dy = Math.abs(w.y - 10);
                return !(dx <= 1 && dy <= 2);
            });

            if (isConnected(finalWalls, GRID_SIZE)) {
                return finalWalls;
            }

            attempt++;
        }

        return []; // Fallback to empty if all fail
    }, []);

    return walls;
}
