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
    const [directionQueue, setDirectionQueue] = useState<Direction[]>([]);

    const moveSnake = useCallback(() => {
        if (!isAlive) return;

        let moveDirection = direction;

        // Process queued direction before moving
        if (directionQueue.length > 0) {
            const nextDir = directionQueue[0];
            const isOpposite =
                (nextDir === 'UP' && direction === 'DOWN') ||
                (nextDir === 'DOWN' && direction === 'UP') ||
                (nextDir === 'LEFT' && direction === 'RIGHT') ||
                (nextDir === 'RIGHT' && direction === 'LEFT');

            if (!isOpposite) {
                moveDirection = nextDir;
                setDirection(nextDir);
            }
            setDirectionQueue(prev => prev.slice(1));
        }

        setSnake((prevSnake) => {
            const head = prevSnake[0];
            const newHead = {
                x: head.x + DIRECTIONS[moveDirection].x,
                y: head.y + DIRECTIONS[moveDirection].y,
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
    }, [direction, isAlive, directionQueue]);

    const changeDirection = useCallback((newDirection: Direction) => {
        // Add to queue instead of changing directly (max queue size of 1)
        setDirectionQueue(prev => {
            // Only keep the most recent direction in queue
            if (prev.length === 0) {
                return [newDirection];
            }
            // Replace with new direction if already queued
            return [newDirection];
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
        setDirectionQueue([]);
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
