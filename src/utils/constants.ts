export const GRID_SIZE = 20; // 20x20 grid
export const INITIAL_SPEED = 150; // ms per move
export const MIN_SPEED = 80; // Max speed
export const SPEED_DECREMENT = 2; // Speed increase per fruit
export const MIN_FRUITS = 10; // Minimum fruits to collect
export const MAX_FRUITS = 20; // Maximum fruits to collect

export type Point = {
    x: number;
    y: number;
};

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export const DIRECTIONS: Record<Direction, Point> = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
};
