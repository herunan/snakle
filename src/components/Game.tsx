import React, { useState, useEffect, useCallback } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { useSnake } from '../hooks/useSnake';
import { useDailyLevel } from '../hooks/useDailyLevel';
import { Board } from './Board';
import { GRID_SIZE, INITIAL_SPEED, MIN_SPEED, SPEED_DECREMENT, MIN_FRUITS, MAX_FRUITS } from '../utils/constants';
import type { Point } from '../utils/constants';
import { Share2, Play } from 'lucide-react';
import { SeededRNG, getDailySeed } from '../utils/random';

export const Game: React.FC = () => {
    const { snake, changeDirection, moveSnake, isAlive, grow, resetSnake } = useSnake();
    const walls = useDailyLevel();
    const [fruit, setFruit] = useState<Point | null>(null);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(0);
    const [speed, setSpeed] = useState(INITIAL_SPEED);
    const [gameState, setGameState] = useState<'START' | 'COUNTDOWN' | 'PLAYING' | 'DEATH' | 'VICTORY'>('START');
    const [countdown, setCountdown] = useState(3);
    const [targetFruits, setTargetFruits] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [speedIncrement, setSpeedIncrement] = useState(SPEED_DECREMENT);
    const isMobile = typeof window !== 'undefined' && 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0;
    const [fruitIndex, setFruitIndex] = useState(0);
    const [fruitSequence, setFruitSequence] = useState<Point[]>([]);

    // Initialize target fruits count based on daily seed
    useEffect(() => {
        const rng = new SeededRNG(getDailySeed());

        // Debug mode check
        const params = new URLSearchParams(window.location.search);
        if (params.get('debug') === 'true') {
            setTargetFruits(3);
        } else {
            const target = rng.nextInt(MIN_FRUITS, MAX_FRUITS);
            setTargetFruits(target);
            // Speed increment proportional to target fruits (more fruits = slower speed increase)
            const increment = Math.max(1, Math.floor((INITIAL_SPEED - MIN_SPEED) / target));
            setSpeedIncrement(increment);
        }

        // Generate deterministic fruit sequence
        const sequence: Point[] = [];
        // Generate enough fruits for a long game (e.g., 500)
        for (let i = 0; i < 500; i++) {
            sequence.push({
                x: rng.nextInt(0, GRID_SIZE - 1),
                y: rng.nextInt(0, GRID_SIZE - 1),
            });
        }
        setFruitSequence(sequence);
    }, []);

    // Timer logic
    useEffect(() => {
        if (gameState === 'PLAYING') {
            if (!startTime) setStartTime(Date.now());
            const timer = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - (startTime || Date.now())) / 1000));
            }, 100);
            return () => clearInterval(timer);
        }
    }, [gameState, startTime]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const getTimeToNextPuzzle = () => {
        const now = new Date();
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
        const diff = tomorrow.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    // Spawn fruit
    const spawnFruit = useCallback(() => {
        if (fruitSequence.length === 0) return;

        let currentIndex = fruitIndex;
        let attempts = 0;

        // Try to find the next valid fruit in the sequence
        while (attempts < 50) { // Limit lookahead to prevent infinite loops
            const candidate = fruitSequence[currentIndex % fruitSequence.length];
            currentIndex++;

            const onSnake = snake.some(s => s.x === candidate.x && s.y === candidate.y);
            const onWall = walls.some(w => w.x === candidate.x && w.y === candidate.y);

            if (!onSnake && !onWall) {
                setFruit(candidate);
                setFruitIndex(currentIndex);
                return;
            }
            attempts++;
        }

        // Fallback: if sequence fails (rare), generate random valid fruit
        let newFruit: Point;
        attempts = 0;
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
    }, [snake, walls, fruitSequence, fruitIndex]);

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
            // Died - Show WASTED screen
            setLives(l => l + 1);
            setGameState('DEATH');
            return;
        }

        if (gameState !== 'PLAYING') return;

        const head = snake[0];

        // Check Fruit
        if (fruit && head.x === fruit.x && head.y === fruit.y) {
            grow();
            setScore(s => s + 1);
            setSpeed(s => Math.max(MIN_SPEED, s - speedIncrement));

            // Check victory condition
            if (score + 1 >= targetFruits) {
                setGameState('VICTORY');
                return;
            }

            spawnFruit();
        }

        // Check Walls (Internal)
        if (walls.some(w => w.x === head.x && w.y === head.y)) {
            setLives(l => l + 1);
            setGameState('DEATH');
        }

    }, [snake, isAlive, fruit, walls, grow, spawnFruit, resetSnake, gameState, score, targetFruits]);

    // Handle death screen dismissal and restart
    const handleDeathDismiss = () => {
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
    };

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
        const deviceTag = isMobile ? '📱Hard' : ' ⌨️  Easy'; // Spaces around keyboard emoji on desktop
        const text = `🐍 Snakle •${deviceTag}\n❤️ ${lives}\n⏱️ ${formatTime(elapsedTime)}\nhttps://snakle.surge.sh`;
        try {
            await navigator.clipboard.writeText(text);
            alert('Copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    const handleReplay = () => {
        // Replay without resetting score/lives/time
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
    };


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
            {/* Title at top */}
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-4 mt-4">
                SNAKLE
            </h1>

            {/* Scoreboard - Lives left, Fruits middle, Time right */}
            <div className="mb-4 flex gap-6 md:gap-12 text-base md:text-lg font-bold font-mono">
                <div className="flex items-center gap-2 text-red-400">
                    <span>❤️</span> {lives}
                </div>
                <div className="flex items-center gap-2 text-green-400">
                    <span>🍎</span> {score}/{targetFruits}
                </div>
                <div className="flex items-center gap-2 text-blue-400">
                    <span>⏱️</span> {formatTime(elapsedTime)}
                </div>
            </div>

            <div className="relative">
                <Board snake={snake} fruit={fruit} walls={walls} />

                {/* Start Screen */}
                {gameState === 'START' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-20 px-6">
                        <p className="text-gray-300 text-center text-sm md:text-base mb-6 max-w-md leading-relaxed whitespace-pre-line">
                            Collect all {targetFruits} fruits in as few lives as possible. You can teleport through walls!
                        </p>
                        <button
                            onClick={startGame}
                            className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 rounded-full text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-green-600/30"
                        >
                            <Play size={24} /> PLAY
                        </button>
                    </div>
                )}

                {/* Countdown */}
                {gameState === 'COUNTDOWN' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
                        <div className="text-8xl font-bold text-white animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                            {countdown}
                        </div>
                    </div>
                )}

                {/* Death Screen - WASTED */}
                {gameState === 'DEATH' && (
                    <div
                        className="absolute inset-0 bg-black/95 flex items-center justify-center z-20 cursor-pointer grayscale"
                        onClick={handleDeathDismiss}
                    >
                        <div className="text-center">
                            <h2 className="text-6xl md:text-8xl font-bold text-red-600 drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                                WASTED
                            </h2>
                            <p className="text-white/60 text-sm md:text-base mt-4">Click or tap to continue</p>
                        </div>
                    </div>
                )}

                {/* Victory Screen */}
                {gameState === 'VICTORY' && (
                    <div className="absolute inset-0 bg-gradient-to-br from-green-900/95 to-blue-900/95 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-20 p-4">
                        <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-4">
                            VICTORY!
                        </h1>
                        <div className="text-center mb-6 space-y-2">
                            <p className="text-2xl md:text-3xl font-bold text-white">
                                🍎 {score} Fruits Collected
                            </p>
                            <p className="text-lg md:text-xl text-gray-300">
                                ❤️ {lives} Lives Used
                            </p>
                            <p className="text-lg md:text-xl text-gray-300">
                                ⏱️ {formatTime(elapsedTime)}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3">
                            {isMobile && (
                                <button
                                    onClick={handleShare}
                                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-full text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-blue-600/30"
                                >
                                    <Share2 size={24} /> Share Result
                                </button>
                            )}
                            <button
                                onClick={handleReplay}
                                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 rounded-full text-lg font-bold transition-all transform hover:scale-105"
                            >
                                <Play size={20} /> Play Again
                            </button>
                            <p className="text-sm text-gray-400 mt-2">
                                Next Snakle in {getTimeToNextPuzzle()}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* On-Screen Controls - Always visible like Froggle */}
            <div className="mt-8 relative w-48 h-48">
                {/* Diagonal lines background */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-full h-[1px] bg-gray-600 rotate-45 absolute"></div>
                    <div className="w-full h-[1px] bg-gray-600 -rotate-45 absolute"></div>
                </div>

                {/* Up Button */}
                <button
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 flex items-start justify-center pt-2 active:scale-95 transition-transform"
                    onClick={() => changeDirection('UP')}
                >
                    <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[15px] border-b-gray-400"></div>
                </button>

                {/* Down Button */}
                <button
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-16 flex items-end justify-center pb-2 active:scale-95 transition-transform"
                    onClick={() => changeDirection('DOWN')}
                >
                    <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[15px] border-t-gray-400"></div>
                </button>

                {/* Left Button */}
                <button
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-start pl-2 active:scale-95 transition-transform"
                    onClick={() => changeDirection('LEFT')}
                >
                    <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-r-[15px] border-r-gray-400"></div>
                </button>

                {/* Right Button */}
                <button
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-end pr-2 active:scale-95 transition-transform"
                    onClick={() => changeDirection('RIGHT')}
                >
                    <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[15px] border-l-gray-400"></div>
                </button>
            </div>

            {/* Share Button (for non-victory states) - Mobile only */}
            {isMobile && gameState !== 'START' && gameState !== 'VICTORY' && (
                <div className="mt-6 flex gap-4">
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-700"
                    >
                        <Share2 size={16} /> Share Result
                    </button>
                </div>
            )}
        </div>
    );
};
