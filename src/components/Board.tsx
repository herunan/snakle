import React from 'react';
import { GRID_SIZE } from '../utils/constants';
import type { Point } from '../utils/constants';
import { clsx } from 'clsx';

interface BoardProps {
    snake: Point[];
    fruit: Point | null;
    walls: Point[];
}

export const Board: React.FC<BoardProps> = ({ snake, fruit, walls }) => {
    // Create a 1D array representing the grid
    const cells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
        const x = i % GRID_SIZE;
        const y = Math.floor(i / GRID_SIZE);
        return { x, y };
    });

    return (
        <div
            className="grid gap-0.5 bg-gray-800 p-1 rounded-lg shadow-2xl border border-gray-700"
            style={{
                gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                width: 'min(90vw, 500px)',
                aspectRatio: '1/1',
            }}
        >
            {cells.map((cell) => {
                const isSnakeHead = snake[0].x === cell.x && snake[0].y === cell.y;
                const isSnakeBody = snake.some((s, index) => index !== 0 && s.x === cell.x && s.y === cell.y);
                const isFruit = fruit?.x === cell.x && fruit?.y === cell.y;
                const isWall = walls.some((w) => w.x === cell.x && w.y === cell.y);

                return (
                    <div
                        key={`${cell.x}-${cell.y}`}
                        className={clsx(
                            'w-full h-full rounded-sm transition-all duration-100',
                            {
                                'bg-gray-900': !isSnakeBody && !isSnakeHead && !isFruit && !isWall,
                                'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] z-10': isSnakeHead,
                                'bg-green-600/80': isSnakeBody,
                                'bg-red-500 rounded-full scale-75 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse': isFruit,
                                'bg-indigo-500/50 border border-indigo-400/30': isWall,
                            }
                        )}
                    />
                );
            })}
        </div>
    );
};
