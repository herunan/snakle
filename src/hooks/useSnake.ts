import { useState, useCallback } from 'react';
import type { Point, Direction } from '../utils/constants';
import { DIRECTIONS, GRID_SIZE } from '../utils/constants';

const INITIAL_SNAKE: Point[] = [
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
];

export function useSnake() {
    const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
    const [direction, setDirection] = useState<Direction>('UP');
    const [isAlive, setIsAlive] = useState(true);

    const moveSnake = useCallback(() => {
        if (!isAlive) return;

        setSnake((prevSnake) => {
            const head = prevSnake[0];
            const newHead = {
                x: head.x + DIRECTIONS[direction].x,
                y: head.y + DIRECTIONS[direction].y,
            };

            // Wall Wrapping
            if (newHead.x < 0) newHead.x = GRID_SIZE - 1;
            if (newHead.x >= GRID_SIZE) newHead.x = 0;
            if (newHead.y < 0) newHead.y = GRID_SIZE - 1;
            if (newHead.y >= GRID_SIZE) newHead.y = 0;

            // Self Collision
            if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
                setIsAlive(false);
                return prevSnake;
            }

            const newSnake = [newHead, ...prevSnake.slice(0, -1)];
            return newSnake;
        });
    }, [direction, isAlive]);

    const changeDirection = useCallback((newDirection: Direction) => {
        setDirection((prev) => {
            // Prevent 180 degree turns
            const isOpposite =
                (newDirection === 'UP' && prev === 'DOWN') ||
                (newDirection === 'DOWN' && prev === 'UP') ||
                (newDirection === 'LEFT' && prev === 'RIGHT') ||
                (newDirection === 'RIGHT' && prev === 'LEFT');

            if (isOpposite) return prev;
            return newDirection;
        });
    }, []);

    const grow = useCallback(() => {
        setSnake((prev) => {
            // Duplicate the tail to grow
            return [...prev, prev[prev.length - 1]];
        })
    }, []);

    const resetSnake = useCallback(() => {
        setSnake(INITIAL_SNAKE);
        setDirection('UP');
        setIsAlive(true);
    }, []);

    return {
        snake,
        direction,
        isAlive,
        moveSnake,
        changeDirection,
        grow,
        resetSnake,
        setSnake,
        setDirection,
        setIsAlive
    };
}
