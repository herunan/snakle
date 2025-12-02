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
    const { snake, changeDirection, moveSnake, isAlive, grow, resetSnake, setSnake, setDirection, setIsAlive } = useSnake();
    const [gameMode, setGameMode] = useState<'DAILY' | 'CLASSIC'>('DAILY');
    const walls = useDailyLevel(gameMode);
    const [fruit, setFruit] = useState<Point | null>(null);
    const [score, setScore] = useState(0);
    const [classicScore, setClassicScore] = useState(0);
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
    const countdownTimerRef = React.useRef<any>(null);


    // Load Classic high score on mount
    useEffect(() => {
        const savedHighScore = localStorage.getItem('snakle_classic_high_score');
        if (savedHighScore) {
            setClassicHighScore(parseInt(savedHighScore, 10));
        }
    }, []);

    // Save/Load Daily game state


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



    // Initialize Mode Config (Moved from useEffect to startGame to fix race conditions)
    const getModeConfig = (mode: 'DAILY' | 'CLASSIC', isDebug: boolean) => {
        let target = 0;
        let totalKiwis = 0;
        let increment = SPEED_DECREMENT;
        let sequence: Point[] = [];
        let savedState = null;

        if (mode === 'CLASSIC') {
            const rng = new SeededRNG(Math.random().toString());
            target = Infinity;
            // Enable kiwis in Classic mode (Sporadic: ~1 per 15 fruits)
            // We'll handle the "sporadic" part in the spawn logic or here by setting a high total but controlling spawn rate?
            // Actually, let's set totalKiwis to a high number but control frequency in the effect.
            totalKiwis = 999;
            increment = Math.max(1, Math.floor((INITIAL_SPEED - MIN_SPEED) / 50));

            for (let i = 0; i < 1000; i++) {
                sequence.push({
                    x: rng.nextInt(0, GRID_SIZE - 1),
                    y: rng.nextInt(0, GRID_SIZE - 1),
                });
            }
        } else {
            // Daily Mode
            const rng = new SeededRNG(getDailySeed());

            if (isDebug) {
                target = 3;
                totalKiwis = 1;
            } else {
                target = rng.nextInt(MIN_FRUITS, MAX_FRUITS);
                increment = Math.max(1, Math.floor((INITIAL_SPEED - MIN_SPEED) / target));

                const isKiwiDay = rng.next() < 0.3;
                if (isKiwiDay) {
                    totalKiwis = rng.nextInt(1, 3);
                }

                const today = getDailySeed();
                const stored = localStorage.getItem(`snakle_daily_${today}`);
                if (stored) {
                    savedState = JSON.parse(stored);
                }
            }

            for (let i = 0; i < 500; i++) {
                sequence.push({
                    x: rng.nextInt(0, GRID_SIZE - 1),
                    y: rng.nextInt(0, GRID_SIZE - 1),
                });
            }
        }

        return { target, totalKiwis, increment, sequence, savedState };
    };

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
            let shouldSpawn = false;

            if (gameMode === 'CLASSIC') {
                // Sporadic spawning for Classic: ~1 every 15 fruits
                // We can check if fruitIndex is a multiple of 15 (plus some randomness if desired, but fixed is easier)
                if (fruitIndex > 0 && fruitIndex % 15 === 0) {
                    shouldSpawn = true;
                }
            } else {
                // Daily logic
                const interval = Math.floor(targetFruits / (totalKiwisToday + 1));
                for (let k = 1; k <= totalKiwisToday; k++) {
                    if (fruitIndex === interval * k) {
                        shouldSpawn = true;
                        break;
                    }
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
                        return;
                    }
                    attempts++;
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fruitIndex, gameState, snake, walls, fruit, kiwi, totalKiwisToday, kiwisSpawnedSoFar, lastKiwiSpawnIndex, targetFruits]);

    // Kiwi Timer
    useEffect(() => {
        if (kiwi) {
            const timer = setTimeout(() => {
                setKiwi(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [kiwi]);

    // Initial fruit
    useEffect(() => {
        // Classic mode has no walls, so we just check for fruitSequence
        if (!fruit && fruitSequence.length > 0) spawnFruit();
    }, [fruitSequence, spawnFruit, fruit]);

    // Start Game Sequence
    const startGame = (mode: 'DAILY' | 'CLASSIC') => {
        setGameMode(mode);
        const isDebug = new URLSearchParams(window.location.search).get('debug') === 'true';

        // Initialize Mode Config
        const config = getModeConfig(mode, isDebug);
        setTargetFruits(config.target);
        setTotalKiwisToday(config.totalKiwis);
        setSpeedIncrement(config.increment);
        setFruitSequence(config.sequence);

        // Default State
        let nextScore = 0;
        let nextLives = 0;
        let nextElapsedTime = 0;
        let nextKiwiCount = 0;
        let nextFruitIndex = 0;
        let nextSpeed = INITIAL_SPEED;

        // Reset transient state
        setFruit(null);
        setKiwi(null);
        setKiwisSpawnedSoFar(0);
        setLastKiwiSpawnIndex(-1);
        setClassicScore(0);

        if (mode === 'DAILY' && config.savedState) {
            const state = config.savedState;
            if (!state.completed) {
                nextScore = state.score || 0;
                nextLives = (state.lives || 0) + 1; // Penalty
                nextElapsedTime = state.elapsedTime || 0;
                nextKiwiCount = state.kiwiCount || 0;
                nextFruitIndex = nextScore;

                // Calculate speed based on apples (score)
                nextSpeed = Math.max(MIN_SPEED, INITIAL_SPEED - (nextScore * config.increment));
            }
        }

        // Apply State
        setScore(nextScore);
        setLives(nextLives);
        setElapsedTime(nextElapsedTime);
        setKiwiCount(nextKiwiCount);
        setFruitIndex(nextFruitIndex);
        setSpeed(nextSpeed); // Will be refined by effect for Daily

        // Reconstruct Snake
        const baseSnake = [
            { x: 10, y: 10 },
            { x: 10, y: 11 },
            { x: 10, y: 12 },
        ];
        // Length = 3 + apples + kiwis
        const totalLength = 3 + nextScore + nextKiwiCount;
        const tail = baseSnake[baseSnake.length - 1];
        // We need totalLength segments. baseSnake has 3.
        // So we add totalLength - 3 segments.
        const extraSegments = Array(Math.max(0, totalLength - 3)).fill(tail);
        setSnake([...baseSnake, ...extraSegments]);
        setDirection('UP');
        setIsAlive(true);

        setGameState('COUNTDOWN');
        setCountdown(3);

        // Clear any existing countdown
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

        let count = 3;
        countdownTimerRef.current = setInterval(() => {
            count--;
            setCountdown(count);
            if (count === 0) {
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                setGameState('PLAYING');
                // Set start time correctly accounting for elapsed time
                setStartTime(Date.now() - (nextElapsedTime * 1000));
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
            // Save state on death (completed: false so it can be resumed)
            if (gameMode === 'DAILY') {
                const today = getDailySeed();
                const state = { score, lives: lives + 1, elapsedTime, kiwiCount, completed: false };
                localStorage.setItem(`snakle_daily_${today}`, JSON.stringify(state));
            }
            return;
        }

        if (gameState !== 'PLAYING') return;

        const head = snake[0];

        // Check Fruit
        if (fruit && head.x === fruit.x && head.y === fruit.y) {
            grow();
            setScore(s => s + 1);

            if (gameMode === 'CLASSIC') {
                setClassicScore(s => s + 1);
                // Speed based on tail length (capped at 50 segments)
                const newSpeed = Math.max(MIN_SPEED, INITIAL_SPEED - (Math.min(snake.length, 50) * speedIncrement));
                setSpeed(newSpeed);
            } else {
                // Daily: Speed based on apple score
                setSpeed(s => Math.max(MIN_SPEED, s - speedIncrement));
            }

            // Check victory condition (Only for non-Classic modes)
            if (gameMode !== 'CLASSIC' && score + 1 >= targetFruits) {
                setGameState('VICTORY');
                if (gameMode === 'DAILY') {
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
            // Mark Daily as NOT completed on death, so it can be resumed
            if (gameMode === 'DAILY') {
                const today = getDailySeed();
                const state = { score, lives: lives + 1, elapsedTime, kiwiCount, completed: false };
                localStorage.setItem(`snakle_daily_${today}`, JSON.stringify(state));
            }
        }

        // Check Kiwi
        if (kiwi && head.x === kiwi.x && head.y === kiwi.y) {
            setKiwi(null);
            setKiwiCount(c => c + 1);
            grow(); // Grow snake by 1 segment

            if (gameMode === 'CLASSIC') {
                // Classic: Add 5 to score but only 1 to tail (already called grow() above)
                setClassicScore(s => s + 5);
                // Speed based on tail length (capped at 50 segments)
                const newSpeed = Math.max(MIN_SPEED, INITIAL_SPEED - (Math.min(snake.length, 50) * speedIncrement));
                setSpeed(newSpeed);
            }
            // Daily: Don't add to score (Apples only)
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
            text = `🐍 Snakle Classic •${deviceTag}\n🍎 ${classicScore}`;
            if (kiwiCount > 0) {
                text += `\n🥝 ${kiwiCount}`;
            }
            text += `\nhttps://snakle.surge.sh`;
        } else {
            // Daily mode
            text = `🐍 Snakle #${getDailyNumber()} •${isMobile ? '📱' : ' ⌨️ '}${isMobile ? 'Hard' : 'Easy'}\n❤️ ${lives}\n⏱️ ${formatTime(elapsedTime)}`;
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
        // For Classic, we want to restart completely to reset score/lives
        if (gameMode === 'CLASSIC') {
            startGame('CLASSIC');
            return;
        }

        // Replay without resetting score/lives/time (for Daily resume logic if needed, but usually we don't replay Daily from victory)
        resetSnake();
        setFruitIndex(0);
        // ... (rest of logic only if we kept it, but for Classic we want full restart)
    };

    // Handle game mode switching with appropriate consequences
    const handleModeSwitch = (newMode: 'DAILY' | 'CLASSIC') => {
        // Confirm if playing
        if (gameState === 'PLAYING' || gameState === 'COUNTDOWN') {
            if (gameMode === 'DAILY') {
                if (!confirm('Switching modes will cost you a life in Daily Challenge! Are you sure?')) {
                    return;
                }
            } else {
                if (!confirm('Switch modes? This will end your current game.')) {
                    return;
                }
            }
        }

        // Handle consequences for leaving current mode
        if (gameMode === 'DAILY' && (gameState === 'PLAYING' || gameState === 'DEATH')) {
            // Save state (penalty applied on resume)
            const today = getDailySeed();
            // If in DEATH, lives were already incremented, so use current lives
            // If in PLAYING, use current lives (penalty added on resume)
            const state = { score, lives, elapsedTime, kiwiCount, completed: false };
            localStorage.setItem(`snakle_daily_${today}`, JSON.stringify(state));
        } else if (gameMode === 'CLASSIC' && score > classicHighScore) {
            // Save Classic high score if switching away
            setClassicHighScore(score);
            localStorage.setItem('snakle_classic_high_score', score.toString());
        }

        // Reset key state items that won't be reset by mode change effect
        setScore(0);
        setLives(0);
        setElapsedTime(0);
        setStartTime(null);
        setKiwiCount(0);

        // Start the new game mode
        startGame(newMode);
    };


    return (
        <div
            className="flex flex-col items-center justify-start h-screen w-screen bg-gray-900 text-white overflow-hidden touch-none select-none pt-8 pb-32"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Header: Title and Mode Button Centered */}
            <div className="flex items-center justify-center gap-4 mb-2 relative z-30">
                <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
                    SNAKLE
                </h1>
                {gameState !== 'START' && (
                    <button
                        onClick={() => handleModeSwitch(gameMode === 'DAILY' ? 'CLASSIC' : 'DAILY')}
                        className={`px-3 py-1 rounded text-white font-bold transition-all text-xs ${gameMode === 'DAILY'
                            ? 'bg-purple-600 hover:bg-purple-500'
                            : 'bg-blue-600 hover:bg-blue-500'
                            }`}
                    >
                        {gameMode === 'DAILY' ? 'Play Classic' : 'Play Daily'}
                    </button>
                )}
            </div>

            {/* Mode Selection Buttons - Removed (integrated into header) */}


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

            <div className="relative">
                <div style={{ filter: gameState === 'DEATH' ? 'blur(5px)' : 'none', transition: 'filter 0.3s ease' }}>
                    <Board snake={snake} fruit={fruit} walls={walls} kiwi={kiwi} />
                </div>

                {/* Main Menu Button removed from here - now in title area */}

                {/* Start Screen Overlay */}
                {gameState === 'START' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-20 px-6 text-center">
                        <p className="text-gray-300 text-sm md:text-base mb-6 max-w-md leading-relaxed">
                            {gameMode === 'DAILY' ? (
                                <>
                                    Eat fruit without eating yourself and obstacles. You can go through walls. Use as few lives as possible.
                                    <br /><br />
                                    <span className="text-yellow-400">Controls:</span>
                                    <br />
                                    📱 Hold finger on screen and move around
                                    <br />
                                    ⌨️ Arrow keys
                                </>
                            ) : (
                                <>
                                    Classic Snakle! Eat fruit without eating yourself. You can go through walls. You get one life.
                                </>
                            )}
                        </p>

                        <button
                            onClick={() => startGame(gameMode)}
                            className={`px-8 py-4 rounded-xl text-xl font-bold transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 ${gameMode === 'DAILY'
                                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                                }`}
                        >
                            <Play size={24} /> Play {gameMode === 'DAILY' ? 'Daily' : 'Classic'}
                        </button>

                        <div className="mt-6">
                            <button
                                onClick={() => setGameMode(gameMode === 'DAILY' ? 'CLASSIC' : 'DAILY')}
                                className="text-sm text-gray-400 hover:text-white underline decoration-dotted underline-offset-4"
                            >
                                Switch to {gameMode === 'DAILY' ? 'Classic' : 'Daily'} Mode
                            </button>
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
                            {gameMode === 'CLASSIC' ? (
                                <>
                                    <h1 className="text-4xl md:text-6xl font-bold text-red-500 mb-6">
                                        GAME OVER
                                    </h1>
                                    <p className="text-3xl md:text-4xl text-white font-bold mb-8">
                                        🍎 {classicScore}
                                    </p>
                                    <div className="flex gap-3 justify-center mt-6">
                                        <button
                                            onClick={handleShare}
                                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full text-lg font-bold transition-all transform hover:scale-105"
                                        >
                                            <Share2 size={20} /> Share
                                        </button>
                                        <button
                                            onClick={() => startGame('CLASSIC')}
                                            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-full text-lg font-bold transition-all transform hover:scale-105"
                                        >
                                            <Play size={20} /> Play Classic
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-4xl md:text-6xl font-bold text-red-500 mb-6">
                                        WASTED
                                    </h1>
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
                            )}
                            {gameMode !== 'CLASSIC' && (
                                <p className="text-green-400 text-sm md:text-base mt-4">Tap or click to continue</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Victory Screen */}
                {gameState === 'VICTORY' && (
                    <div className="absolute inset-0 bg-gradient-to-br from-green-900/95 to-blue-900/95 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-20 p-4">
                        <h1 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-6">
                            You ate all the fruit!
                        </h1>
                        <div className="text-center mb-6 space-y-1">
                            <p className="text-2xl md:text-3xl font-bold text-white">
                                🍎 {score}/{targetFruits}{kiwiCount > 0 ? ` 🥝 ${kiwiCount}/${totalKiwisToday}` : ''}
                            </p>
                            <p className="text-xl md:text-2xl text-gray-300">
                                ❤️ {lives}
                            </p>
                            <p className="text-xl md:text-2xl text-gray-300">
                                ⏱️ {formatTime(elapsedTime)}
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 items-center">
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-base font-bold transition-all transform hover:scale-105 shadow-lg shadow-blue-600/30"
                            >
                                <Share2 size={20} /> Share
                            </button>
                            <button
                                onClick={() => startGame('DAILY')}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-base font-bold transition-all transform hover:scale-105"
                            >
                                <Play size={18} /> Play Daily
                            </button>
                        </div>
                        {gameMode === 'DAILY' && (
                            <p className="text-sm text-gray-400 mt-2">
                                Next Snakle in {getTimeToNextPuzzle()}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
