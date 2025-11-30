import React, { useState, useEffect, useCallback } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { useSnake } from '../hooks/useSnake';
import { useDailyLevel } from '../hooks/useDailyLevel';
import { Board } from './Board';
import { GRID_SIZE, INITIAL_SPEED, MIN_SPEED, SPEED_DECREMENT, MIN_FRUITS, MAX_FRUITS } from '../utils/constants';
import type { Point } from '../utils/constants';
import { Share2, Play } from 'lucide-react';
import { SeededRNG, getDailySeed, getDailyNumber } from '../utils/random';

export const Game: React.FC = () => {
    const { snake, changeDirection, moveSnake, isAlive, grow, resetSnake } = useSnake();
    const [gameMode, setGameMode] = useState<'DAILY' | 'TUTORIAL' | 'CLASSIC'>('DAILY');
    const walls = useDailyLevel(gameMode);
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
    const [kiwi, setKiwi] = useState<Point | null>(null);
    const [kiwiCount, setKiwiCount] = useState(0);
    const [totalKiwisToday, setTotalKiwisToday] = useState(0);
    const [kiwisSpawnedSoFar, setKiwisSpawnedSoFar] = useState(0);
    const [lastKiwiSpawnIndex, setLastKiwiSpawnIndex] = useState(-1);
    const touchStartRef = React.useRef<{ x: number, y: number } | null>(null);
    const [classicHighScore, setClassicHighScore] = useState(0);
    const [showMainMenuConfirm, setShowMainMenuConfirm] = useState(false);

    // Load Classic high score on mount
    useEffect(() => {
        const savedHighScore = localStorage.getItem('snakle_classic_high_score');
        if (savedHighScore) {
            setClassicHighScore(parseInt(savedHighScore, 10));
        }
    }, []);

    // Save/Load Daily game state
    useEffect(() => {
        if (gameMode === 'DAILY') {
            const today = getDailySeed();
            const savedState = localStorage.getItem(`snakle_daily_${today}`);

            if (savedState && gameState === 'START') {
                const state = JSON.parse(savedState);
                // Restore state if not completed
                if (!state.completed) {
                    setScore(state.score || 0);
                    setLives(state.lives || 0);
                    setElapsedTime(state.elapsedTime || 0);
                    setKiwiCount(state.kiwiCount || 0);
                }
            }
        }
    }, [gameMode, gameState]);

    // Save Daily state on changes
    useEffect(() => {
        if (gameMode === 'DAILY' && gameState === 'PLAYING') {
            const today = getDailySeed();
            const state = {
                score,
                lives,
                elapsedTime,
                kiwiCount,
                completed: false
            };
            localStorage.setItem(`snakle_daily_${today}`, JSON.stringify(state));
        }
    }, [score, lives, elapsedTime, kiwiCount, gameMode, gameState]);

    // Initialize Game Logic based on Mode
    useEffect(() => {
        const isDebug = new URLSearchParams(window.location.search).get('debug') === 'true';

        // Reset state for new mode
        setFruitSequence([]);
        setFruitIndex(0);
        setKiwi(null);
        setKiwiCount(0);
        setTotalKiwisToday(0);
        setKiwisSpawnedSoFar(0);
        setLastKiwiSpawnIndex(-1);
        setScore(0);
        setLives(0);
        setElapsedTime(0);
        setStartTime(null);

        if (gameMode === 'TUTORIAL') {
            setTargetFruits(3);
            setTotalKiwisToday(1);
            setFruitSequence(Array.from({ length: 50 }, () => ({
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
            })));
        } else if (gameMode === 'CLASSIC') {
            const rng = new SeededRNG(Math.random().toString()); // Random seed for classic
            setTargetFruits(Infinity);
            // Enable kiwis in Classic mode (30% chance)
            const isKiwiDay = rng.next() < 0.3;
            if (isKiwiDay) {
                setTotalKiwisToday(rng.nextInt(1, 3));
            } else {
                setTotalKiwisToday(0);
            }
            const increment = Math.max(1, Math.floor((INITIAL_SPEED - MIN_SPEED) / 50)); // Slower speed ramp for unlimited
            setSpeedIncrement(increment);

            // Generate random fruit sequence
            const sequence: Point[] = [];
            for (let i = 0; i < 1000; i++) { // More fruits for unlimited
                sequence.push({
                    x: rng.nextInt(0, GRID_SIZE - 1),
                    y: rng.nextInt(0, GRID_SIZE - 1),
                });
            }
            setFruitSequence(sequence);
        } else {
            // Daily Mode
            const rng = new SeededRNG(getDailySeed());

            if (isDebug) {
                setTargetFruits(3);
                setTotalKiwisToday(1);
            } else {
                const target = rng.nextInt(MIN_FRUITS, MAX_FRUITS);
                setTargetFruits(target);
                const increment = Math.max(1, Math.floor((INITIAL_SPEED - MIN_SPEED) / target));
                setSpeedIncrement(increment);

                // Kiwi Logic: Every 3-5 days (approx 30% chance)
                const isKiwiDay = rng.next() < 0.3;
                if (isKiwiDay) {
                    setTotalKiwisToday(rng.nextInt(1, 3));
                } else {
                    setTotalKiwisToday(0);
                }
            }

            // Generate deterministic fruit sequence
            const sequence: Point[] = [];
            for (let i = 0; i < 500; i++) {
                sequence.push({
                    x: rng.nextInt(0, GRID_SIZE - 1),
                    y: rng.nextInt(0, GRID_SIZE - 1),
                });
            }
            setFruitSequence(sequence);
        }
    }, [gameMode]);

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

    // Spawn Kiwi (Temporary Fruit)
    useEffect(() => {
        if (gameState !== 'PLAYING') return;

        // Check if we should spawn a kiwi
        if (totalKiwisToday > 0 && !kiwi && kiwisSpawnedSoFar < totalKiwisToday) {
            const interval = Math.floor(targetFruits / (totalKiwisToday + 1));
            let shouldSpawn = false;

            for (let k = 1; k <= totalKiwisToday; k++) {
                if (fruitIndex === interval * k) {
                    shouldSpawn = true;
                    break;
                }
            }

            if (shouldSpawn && fruitIndex !== lastKiwiSpawnIndex) {
                setLastKiwiSpawnIndex(fruitIndex);
                setKiwisSpawnedSoFar(prev => prev + 1);
                // Spawn logic...
                let newKiwi: Point;
                let attempts = 0;
                while (attempts < 100) {
                    newKiwi = {
                        x: Math.floor(Math.random() * GRID_SIZE),
                        y: Math.floor(Math.random() * GRID_SIZE),
                    };
                    const onSnake = snake.some(s => s.x === newKiwi.x && s.y === newKiwi.y);
                    const onWall = walls.some(w => w.x === newKiwi.x && w.y === newKiwi.y);
                    const onFruit = fruit && fruit.x === newKiwi.x && fruit.y === newKiwi.y;

                    if (!onSnake && !onWall && !onFruit) {
                        setKiwi(newKiwi);
                        const timer = setTimeout(() => {
                            setKiwi(null);
                        }, 5000);
                        return () => clearTimeout(timer);
                    }
                    attempts++;
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fruitIndex, gameState, snake, walls, fruit, kiwi, totalKiwisToday, kiwisSpawnedSoFar, lastKiwiSpawnIndex, targetFruits]);

    // Initial fruit
    useEffect(() => {
        if (!fruit && walls.length > 0 && fruitSequence.length > 0) spawnFruit();
    }, [walls, fruitSequence]);

    // Start Game Sequence
    // Start Game Sequence
    const startGame = (mode: 'DAILY' | 'TUTORIAL' | 'CLASSIC') => {
        setGameMode(mode);
        // Wait for effect to update state? No, effect runs on gameMode change.
        // But we need to wait for walls to update too.
        // Actually, setting gameMode triggers re-render, which triggers useDailyLevel, which updates walls.
        // AND triggers useEffect to set fruits.
        // So we should delay starting countdown slightly or just rely on React.

        // Better: Set mode, then in a useEffect, if mode changed and we are in START, move to countdown?
        // Or just set mode here, and let the user click "Play" after selecting mode?
        // User request: "first time players get the option to play tutortial or play the daily. but also have classic mode"
        // Implies buttons on start screen that start the game.

        // Let's make the buttons set mode AND start game.
        // We need to ensure state is ready.
        // Since useDailyLevel is memoized on mode, it updates immediately on render.
        // The fruit generation effect also runs on mode change.
        // We can just set state to COUNTDOWN in a setTimeout to allow one render cycle?

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

            // Check victory condition (Only for non-Classic modes)
            if (gameMode !== 'CLASSIC' && score + 1 >= targetFruits) {
                setGameState('VICTORY');
                if (gameMode === 'TUTORIAL') {
                    localStorage.setItem('snakle_has_played', 'true');
                } else if (gameMode === 'DAILY') {
                    // Mark Daily as completed
                    const today = getDailySeed();
                    const state = { score: score + 1, lives, elapsedTime, kiwiCount, completed: true };
                    localStorage.setItem(`snakle_daily_${today}`, JSON.stringify(state));
                }
                return;
            }

            spawnFruit();
        }

        // Check Walls (Internal)
        if (walls.some(w => w.x === head.x && w.y === head.y)) {
            setLives(l => l + 1);
            setGameState('DEATH');
            // Mark Daily as completed on death
            if (gameMode === 'DAILY') {
                const today = getDailySeed();
                const state = { score, lives: lives + 1, elapsedTime, kiwiCount, completed: true };
                localStorage.setItem(`snakle_daily_${today}`, JSON.stringify(state));
            }
        }

        // Check Kiwi
        if (kiwi && head.x === kiwi.x && head.y === kiwi.y) {
            setKiwi(null);
            setKiwiCount(c => c + 1);
            setScore(s => s + 5); // Bonus points for Kiwi? Or just counter. Let's add score too.
        }

    }, [snake, isAlive, fruit, walls, grow, spawnFruit, resetSnake, gameState, score, targetFruits, kiwi]);

    // Handle death screen dismissal and restart
    const handleDeathDismiss = () => {
        if (gameMode === 'DAILY') {
            // Daily mode: restart the game
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
            return;
        }

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

    // Touch Controls (Joystick/Swipe)
    const handleTouchStart = (e: React.TouchEvent) => {
        if (gameState !== 'PLAYING') return;
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (gameState !== 'PLAYING' || !touchStartRef.current) return;
        const touch = e.touches[0];
        const diffX = touch.clientX - touchStartRef.current.x;
        const diffY = touch.clientY - touchStartRef.current.y;
        const threshold = 30; // Sensitivity

        if (Math.abs(diffX) > threshold || Math.abs(diffY) > threshold) {
            if (Math.abs(diffX) > Math.abs(diffY)) {
                // Horizontal
                changeDirection(diffX > 0 ? 'RIGHT' : 'LEFT');
            } else {
                // Vertical
                changeDirection(diffY > 0 ? 'DOWN' : 'UP');
            }
            // Reset origin to current position for continuous swiping
            touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }
    };

    const handleTouchEnd = () => {
        touchStartRef.current = null;
    };

    const handleShare = async () => {
        const deviceTag = isMobile ? '📱Hard' : '⌨️ Easy';
        let text = '';

        if (gameMode === 'CLASSIC') {
            text = `🐍 Snakle Classic •${deviceTag}\n🍎 ${score}`;
            if (kiwiCount > 0) {
                text += `\n🥝 ${kiwiCount}`;
            }
            text += `\nhttps://snakle.surge.sh`;
        } else {
            // Daily/Tutorial mode
            text = `🐍 Snakle •${isMobile ? '📱' : ' ⌨️ '}${isMobile ? 'Hard' : 'Easy'}\n❤️ ${lives}\n⏱️ ${formatTime(elapsedTime)}`;
            if (kiwiCount > 0) {
                text += `\n🥝 ${kiwiCount}`;
            }
            text += `\nhttps://snakle.surge.sh`;
        }

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
        setFruitIndex(0);
        setScore(0);
        setLives(0);
        setElapsedTime(0);
        setStartTime(null);
        setKiwiCount(0);
        setLastKiwiSpawnIndex(-1);
        setKiwi(null);

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

    const handleMainMenu = () => {
        if (gameState === 'PLAYING') {
            setShowMainMenuConfirm(true);
        } else {
            returnToMainMenu();
        }
    };

    const returnToMainMenu = () => {
        setShowMainMenuConfirm(false);

        if (gameMode === 'DAILY' && gameState === 'PLAYING') {
            // Increment lives when abandoning Daily game
            setLives(l => l + 1);
            const today = getDailySeed();
            const state = { score, lives: lives + 1, elapsedTime, kiwiCount, completed: false };
            localStorage.setItem(`snakle_daily_${today}`, JSON.stringify(state));
        }

        if (gameMode === 'CLASSIC' && score > classicHighScore) {
            setClassicHighScore(score);
            localStorage.setItem('snakle_classic_high_score', score.toString());
        }

        setGameState('START');
        setScore(0);
        setLives(0);
        setElapsedTime(0);
        setStartTime(null);
        setKiwi(null);
        setKiwiCount(0);
        resetSnake();
    };


    return (
        <div
            className="flex flex-col items-center justify-start h-screen w-screen bg-gray-900 text-white overflow-hidden touch-none select-none pt-8 pb-32"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Title at top */}
            {/* Title at top - Removed mt-4 */}
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-4">
                SNAKLE
            </h1>

            {/* Main Menu Button - Top Right */}
            {gameState !== 'START' && (
                <button
                    onClick={handleMainMenu}
                    className="absolute top-0 right-4 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-all z-30"
                >
                    Main Menu
                </button>
            )}

            {/* Scoreboard - Lives left, Fruits middle, Time right */}
            {gameState !== 'START' && (
                <div className="mb-4 flex gap-6 md:gap-12 text-base md:text-lg font-bold font-mono">
                    {gameMode !== 'CLASSIC' && (
                        <div className="flex items-center gap-2 text-red-400">
                            <span>❤️</span> {lives}
                        </div>
                    )}
                    {gameMode === 'CLASSIC' && classicHighScore > 0 && (
                        <div className="flex items-center gap-2 text-yellow-400">
                            <span>🏆</span> {classicHighScore}
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-green-400">
                        <span>🍎</span> {gameMode === 'CLASSIC' ? score : `${score}/${targetFruits}`}
                    </div>
                    {(kiwisSpawnedSoFar > 0 || kiwi) && (
                        <div className="flex items-center gap-2 text-yellow-400">
                            <span>🥝</span> {gameMode === 'CLASSIC' ? kiwiCount : `${kiwiCount}/${kiwisSpawnedSoFar}`}
                        </div>
                    )}
                    {gameMode !== 'CLASSIC' && (
                        <div className="flex items-center gap-2 text-blue-400">
                            <span>⏱️</span> {formatTime(elapsedTime)}
                        </div>
                    )}
                </div>
            )}

            <div className="relative" style={{ filter: gameState === 'DEATH' ? 'grayscale(1)' : 'none' }}>
                <Board snake={snake} fruit={fruit} walls={walls} kiwi={kiwi} />

                {/* Main Menu Button removed from here - now in title area */}

                {/* Start Screen */}
                {gameState === 'START' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-20 px-6">
                        <p className="text-gray-300 text-left text-sm md:text-base mb-6 max-w-md leading-relaxed">
                            Eat the fruit without eating yourself. You can go through walls.
                            <br /><br />
                            <span className="text-yellow-400">Controls:</span>
                            <br />
                            📱 Hold finger on screen and move around
                            <br />
                            ⌨️ Arrow keys
                        </p>

                        <div className="flex flex-col gap-4 w-full max-w-xs">
                            <button
                                onClick={() => startGame('DAILY')}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                            >
                                <Play size={24} /> Snakle Daily #{getDailyNumber()}
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => startGame('CLASSIC')}
                                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold transition-all opacity-80 hover:opacity-100"
                                >
                                    Classic Mode
                                </button>
                                <button
                                    onClick={() => startGame('TUTORIAL')}
                                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-bold transition-all opacity-80 hover:opacity-100"
                                >
                                    Tutorial
                                </button>
                            </div>
                        </div>
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
                        className="absolute inset-0 flex items-center justify-center z-20 cursor-pointer"
                        onClick={gameMode !== 'CLASSIC' ? handleDeathDismiss : undefined}
                    >
                        <div className="text-center">
                            <h2 className="text-6xl md:text-8xl font-bold text-red-600 drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                                WASTED
                            </h2>
                            {gameMode === 'CLASSIC' ? (
                                <>
                                    <p className="text-3xl md:text-4xl text-white font-bold mt-6">
                                        Score: {score}
                                    </p>
                                    <div className="flex gap-3 justify-center mt-6">
                                        <button
                                            onClick={handleShare}
                                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full text-lg font-bold transition-all transform hover:scale-105"
                                        >
                                            <Share2 size={20} /> Share
                                        </button>
                                        <button
                                            onClick={handleDeathDismiss}
                                            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-full text-lg font-bold transition-all transform hover:scale-105"
                                        >
                                            <Play size={20} /> Try Again
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-white/60 text-sm md:text-base mt-4">Click or tap to continue</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Victory Screen */}
                {gameState === 'VICTORY' && (
                    <div className="absolute inset-0 bg-gradient-to-br from-green-900/95 to-blue-900/95 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-20 p-4">
                        <h1 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-3">
                            You ate all the fruit!
                        </h1>
                        <div className="text-center mb-4 space-y-2">
                            <p className="text-xl md:text-2xl font-bold text-white">
                                {gameMode === 'DAILY' ? `Snakle #${getDailyNumber()}` : gameMode === 'TUTORIAL' ? 'Tutorial' : 'Classic'} 🍎 {score}{kiwiCount > 0 ? ` 🥝 ${kiwiCount}` : ''}
                            </p>
                            {gameMode !== 'CLASSIC' && (
                                <>
                                    <p className="text-base md:text-lg text-gray-300">
                                        ❤️ {lives} Live{lives !== 1 ? 's' : ''} Used
                                    </p>
                                    <p className="text-base md:text-lg text-gray-300">
                                        ⏱️ {formatTime(elapsedTime)}
                                    </p>
                                </>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 items-center">
                            <div className="flex gap-3">
                                {isMobile && gameMode !== 'TUTORIAL' && (
                                    <button
                                        onClick={handleShare}
                                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-base font-bold transition-all transform hover:scale-105 shadow-lg shadow-blue-600/30"
                                    >
                                        <Share2 size={20} /> Share
                                    </button>
                                )}
                                {gameMode === 'CLASSIC' && (
                                    <button
                                        onClick={handleReplay}
                                        className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 rounded-full text-base font-bold transition-all transform hover:scale-105"
                                    >
                                        <Play size={18} /> Play Again
                                    </button>
                                )}
                                {gameMode === 'DAILY' && (
                                    <button
                                        onClick={() => startGame('CLASSIC')}
                                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-full text-base font-bold transition-all transform hover:scale-105"
                                    >
                                        <Play size={18} /> Play Classic
                                    </button>
                                )}
                                {gameMode === 'TUTORIAL' && (
                                    <>
                                        <button
                                            onClick={() => startGame('CLASSIC')}
                                            className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-full text-base font-bold transition-all transform hover:scale-105"
                                        >
                                            <Play size={18} /> Play Classic
                                        </button>
                                        <button
                                            onClick={() => startGame('DAILY')}
                                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-base font-bold transition-all transform hover:scale-105"
                                        >
                                            <Play size={18} /> Play Daily
                                        </button>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={handleMainMenu}
                                className="text-xs text-gray-400 hover:text-white underline mt-2"
                            >
                                Main Menu
                            </button>
                            {gameMode === 'DAILY' && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Next Snakle in {getTimeToNextPuzzle()}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Menu Confirmation Dialog */}
            {showMainMenuConfirm && (
                <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 rounded-lg">
                    <div className="bg-gray-800 p-6 rounded-lg max-w-sm mx-4 text-center">
                        <h2 className="text-xl font-bold text-white mb-3">Return to Main Menu?</h2>
                        <p className="text-gray-300 text-sm mb-4">
                            {gameMode === 'CLASSIC'
                                ? "You will lose all progress!"
                                : "This will use a life!"}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowMainMenuConfirm(false)}
                                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={returnToMainMenu}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-bold transition-all"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
