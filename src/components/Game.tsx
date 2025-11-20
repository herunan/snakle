import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { useSnake } from '../hooks/useSnake';
import { useDailyLevel } from '../hooks/useDailyLevel';
import { Board } from './Board';
import { GRID_SIZE, INITIAL_SPEED, MIN_SPEED, SPEED_DECREMENT } from '../utils/constants';
import type { Point } from '../utils/constants';
import { Share2, Play } from 'lucide-react';

export const Game: React.FC = () => {
    const { snake, changeDirection, moveSnake, isAlive, grow, resetSnake } = useSnake();
    const walls = useDailyLevel();
    const [fruit, setFruit] = useState<Point | null>(null);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(0);
    const [speed, setSpeed] = useState(INITIAL_SPEED);
    const [gameState, setGameState] = useState<'START' | 'COUNTDOWN' | 'PLAYING' | 'GAMEOVER'>('START');
    const [countdown, setCountdown] = useState(3);

    // Swipe handling
    const touchStart = useRef<Point | null>(null);
    const minSwipeDistance = 30;

    const onTouchStart = (e: React.TouchEvent) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart.current) return;
        const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        const dx = touchEnd.x - touchStart.current.x;
        const dy = touchEnd.y - touchStart.current.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > minSwipeDistance) {
                changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
            }
        } else {
            if (Math.abs(dy) > minSwipeDistance) {
                changeDirection(dy > 0 ? 'DOWN' : 'UP');
            }
        }
        touchStart.current = null;
    };

    // Spawn fruit
    const spawnFruit = useCallback(() => {
        let newFruit: Point;
        let attempts = 0;
        while (attempts < 100) {
            newFruit = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE),
            };
            const onSnake = snake.some(s => s.x === newFruit.x && s.y === newFruit.y);
            const onWall = walls.some(w => w.x === newFruit.x && w.y === newFruit.y);
            if (!onSnake && !onWall) {
                setFruit(newFruit);
                return;
            }
            attempts++;
        }
    }, [snake, walls]);

    // Initial fruit
    useEffect(() => {
        if (!fruit && walls.length > 0) spawnFruit();
    }, [walls]);

    // Start Game Sequence
    const startGame = () => {
        setGameState('COUNTDOWN');
        setCountdown(3);
        let count = 3;
        const timer = setInterval(() => {
            count--;
            setCountdown(count);
            if (count === 0) {
                clearInterval(timer);
                setGameState('PLAYING');
            }
        }, 1000);
    };

    // Game Loop
    useGameLoop(() => {
        if (gameState !== 'PLAYING') return;
        moveSnake();
    }, gameState === 'PLAYING' ? speed : null);

    // Logic Check
    useEffect(() => {
        if (!isAlive && gameState === 'PLAYING') {
            // Died
            setLives(l => l + 1);
            setGameState('GAMEOVER');

            setTimeout(() => {
                resetSnake();
                setGameState('COUNTDOWN');
                setCountdown(3);
                let count = 3;
                const timer = setInterval(() => {
                    count--;
                    setCountdown(count);
                    if (count === 0) {
                        clearInterval(timer);
                        setGameState('PLAYING');
                    }
                }, 1000);
            }, 1000);
        }

        if (gameState !== 'PLAYING') return;

        const head = snake[0];

        // Check Fruit
        if (fruit && head.x === fruit.x && head.y === fruit.y) {
            grow();
            setScore(s => s + 1);
            setSpeed(s => Math.max(MIN_SPEED, s - SPEED_DECREMENT));
            spawnFruit();
        }

        // Check Walls (Internal)
        if (walls.some(w => w.x === head.x && w.y === head.y)) {
            setLives(l => l + 1);
            setGameState('COUNTDOWN'); // Quick restart
            resetSnake();
            // Re-trigger countdown
            setCountdown(3);
            let count = 3;
            const timer = setInterval(() => {
                count--;
                setCountdown(count);
                if (count === 0) {
                    clearInterval(timer);
                    setGameState('PLAYING');
                }
            }, 1000);
        }

    }, [snake, isAlive, fruit, walls, grow, spawnFruit, resetSnake, gameState]);

    // Controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState !== 'PLAYING') return;
            switch (e.key) {
                case 'ArrowUp': changeDirection('UP'); break;
                case 'ArrowDown': changeDirection('DOWN'); break;
                case 'ArrowLeft': changeDirection('LEFT'); break;
                case 'ArrowRight': changeDirection('RIGHT'); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [changeDirection, gameState]);

    const handleShare = async () => {
        const text = `Snakle #${new Date().toISOString().split('T')[0]}\n🍎 ${score} Fruits\n💀 ${lives} Lives`;
        try {
            await navigator.clipboard.writeText(text);
            alert('Copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    return (
        <div
            className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white touch-none"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            <div className="mb-6 flex gap-8 text-xl font-bold font-mono">
                <div className="flex items-center gap-2 text-green-400">
                    <span>🍎</span> {score}
                </div>
                <div className="flex items-center gap-2 text-red-400">
                    <span>💀</span> {lives}
                </div>
            </div>

            <div className="relative">
                <Board snake={snake} fruit={fruit} walls={walls} />

                {/* Overlays */}
                {gameState === 'START' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-20">
                        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-8">
                            SNAKLE
                        </h1>
                        <button
                            onClick={startGame}
                            className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 rounded-full text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-green-600/30"
                        >
                            <Play size={24} /> PLAY
                        </button>
                        <p className="mt-4 text-gray-400 text-sm">Swipe or use Arrow Keys</p>
                    </div>
                )}

                {gameState === 'COUNTDOWN' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
                        <div className="text-8xl font-bold text-white animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                            {countdown}
                        </div>
                    </div>
                )}
            </div>

            {/* Controls / Footer */}
            <div className="mt-8 flex gap-4">
                <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-700"
                >
                    <Share2 size={16} /> Share Result
                </button>
            </div>
        </div>
    );
};
