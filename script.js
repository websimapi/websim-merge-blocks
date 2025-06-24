// Main game coordinator
import { GameState } from './game-state.js';
import { HourglassManager } from './hourglass.js';
import { DragHandler } from './drag-handler.js';
import { BoardRenderer } from './board-renderer.js';
import { CombinationsDisplay } from './combinations-display.js';
import { ReplayManager } from './replay-manager.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const titleScreen = document.getElementById('title-screen');
    const gameScreen = document.getElementById('game-screen');
    const replayScreen = document.getElementById('replay-screen');
    const replayMenuScreen = document.getElementById('replay-menu-screen');
    const gameBoard = document.getElementById('game-board');
    const replayBoard = document.getElementById('replay-board');
    const replayMenuBoard = document.getElementById('replay-menu-board');
    const homeBtn = document.getElementById('home-btn');
    const gameOverlay = document.getElementById('game-overlay');
    const header = document.querySelector('header');
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    const themeInput = document.getElementById('theme-input');
    const combinationsContainer = document.getElementById('combinations-container');
    
    // Replay elements
    const finalScoreSpan = document.getElementById('final-score');
    const watchReplayBtn = document.getElementById('watch-replay-btn');
    const restartWithImagesBtn = document.getElementById('restart-with-images-btn');
    const newGameBtn = document.getElementById('new-game-btn');
    const replayBoardWrapper = document.getElementById('replay-board-wrapper');
    const replayStatus = document.getElementById('replay-status');

    // Replay menu elements
    const replayMenuBtn = document.getElementById('replay-menu-btn');
    const watchReplayMenuBtn = document.getElementById('watch-replay-menu-btn');
    const continueDifficultyButtons = document.querySelectorAll('.continue-difficulty-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const replayMenuBoardWrapper = document.getElementById('replay-menu-board-wrapper');
    const replayMenuStatus = document.getElementById('replay-menu-status');
    const noReplayMessage = document.getElementById('no-replay-message');
    const replayDetails = document.getElementById('replay-details');
    const replayTheme = document.getElementById('replay-theme');
    const replayDifficulty = document.getElementById('replay-difficulty');
    const replayFinalScore = document.getElementById('replay-final-score');

    const levelDescriptors = [
        "a basic", "an improved", "an advanced", "a superior", "a masterful", 
        "an ultimate", "a legendary", "a mythical", "a divine", "a supreme",
        "an arch", "a celestial", "an ethereal", "an astral", "a cosmic"
    ];

    // Game modules
    const gameState = new GameState();
    const hourglassManager = new HourglassManager(gameState);
    const dragHandler = new DragHandler(gameState, gameBoard);
    const combinationsDisplay = new CombinationsDisplay(gameState);
    const replayManager = new ReplayManager();
    const boardRenderer = new BoardRenderer(
        gameState, 
        gameBoard, 
        dragHandler,
        handleBlockClick,
        handleEmptyCellClick
    );

    dragHandler.onIndicatorDrop = (index) => {
        spawnEarly(index);
    };

    // Set up drag completion callback
    dragHandler.onDragComplete = (boardChanged) => {
        if (boardChanged) {
            boardRenderer.renderBlocks();
            checkAllBlockImages();
            combinationsDisplay.update();
        } else {
            // Re-render to clear selection state if drag was invalid
            boardRenderer.renderBlocks();
        }
    };

    function prepareNextSpawn() {
        gameState.nextSpawnIndices = [];
        
        let numToSpawn = 1;
        const difficulty = gameState.currentDifficulty;

        if (difficulty === 'medium') {
            if (Math.random() < 0.5) numToSpawn = 2;
        } else if (difficulty === 'hard') {
            if (Math.random() < 0.9) {
                numToSpawn = Math.random() < 0.5 ? 3 : 2;
            } else {
                numToSpawn = 1;
            }
        }
        
        const emptyCells = gameState.getEmptyCells();
        const availableSlots = emptyCells.length;

        const actualNumToSpawn = Math.min(numToSpawn, availableSlots);

        if (actualNumToSpawn === 0 && availableSlots > 0 && gameState.nextSpawnIndices.length === 0) {
             // Edge case: if we can't spawn the desired number, but there's space,
             // and no spawns are queued, queue at least one.
             const randomEmptyCellIndex = Math.floor(Math.random() * emptyCells.length);
             const boardIndex = emptyCells.splice(randomEmptyCellIndex, 1)[0];
             gameState.nextSpawnIndices.push(boardIndex);
        } else {
            for (let i = 0; i < actualNumToSpawn; i++) {
                const randomEmptyCellIndex = Math.floor(Math.random() * emptyCells.length);
                const boardIndex = emptyCells.splice(randomEmptyCellIndex, 1)[0];
                gameState.nextSpawnIndices.push(boardIndex);
            }
        }

        boardRenderer.renderIndicators();
    }

    function spawnRandomBlock() {
        const spawnIndices = gameState.nextSpawnIndices;

        if (spawnIndices.length === 0 && gameState.getEmptyCells().length === 0) {
            if (gameState.currentDifficulty === 'zen') {
                console.log("Grid full in Zen mode - continuing without spawning");
                hourglassManager.reset();
                return;
            } else {
                console.log("Game Over - No empty cells to spawn a new block.");
                gameOver();
                return;
            }
        }

        // Spawn the blocks
        spawnIndices.forEach(boardIndex => {
            // Only spawn if the index is still in the queue (wasn't spawned early)
            if (gameState.nextSpawnIndices.includes(boardIndex)) {
                const newValue = gameState.getNewBlockValue();
                gameState.placeBlock(boardIndex, newValue);
                replayManager.recordSpawn(boardIndex, newValue);
            }
        });
        
        gameState.nextSpawnIndices = [];

        boardRenderer.render();
        checkAllBlockImages();
        combinationsDisplay.update();
        prepareNextSpawn();
    }

    function gameOver() {
        hourglassManager.destroy();
        finalScoreSpan.textContent = gameState.score;
        
        gameScreen.classList.remove('active');
        replayScreen.classList.add('active');
        header.classList.remove('in-game');
    }

    function handleBlockClick(clickedIndex) {
        if (dragHandler.isDragging) return;
        
        if (!gameState.hasSelectedBlock()) {
            gameState.selectBlock(clickedIndex);
            boardRenderer.renderBlocks();
            return;
        }

        if (gameState.getSelectedBlockIndex() === clickedIndex) {
            gameState.deselectBlock();
            boardRenderer.renderBlocks();
            return;
        }

        const selectedIndex = gameState.getSelectedBlockIndex();
        const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);
        const selectedValue = gameState.getBlockValue(selectedIndex);
        const clickedValue = gameState.getBlockValue(clickedIndex);
        const sameValue = selectedValue === clickedValue;
        const sumValue = selectedValue + clickedValue;
        let boardChanged = false;
        let scoreGained = 0;

        if (isNeighbor && sameValue) {
            const mergedValue = gameState.getBlockValue(clickedIndex) + 1;
            gameState.placeBlock(clickedIndex, mergedValue);
            gameState.removeBlock(selectedIndex);
            scoreGained = mergedValue;
            gameState.updateScore(scoreGained);
            replayManager.recordMove('merge', selectedIndex, clickedIndex, selectedValue, clickedValue, mergedValue, scoreGained);
            gameState.deselectBlock();
            boardChanged = true;
        } else if (isNeighbor && sumValue % 2 === 0) {
            const halfValue = sumValue / 2;
            gameState.placeBlock(selectedIndex, halfValue);
            gameState.placeBlock(clickedIndex, halfValue);
            scoreGained = halfValue * 2;
            gameState.updateScore(scoreGained);
            replayManager.recordMove('split', selectedIndex, clickedIndex, selectedValue, clickedValue, halfValue, scoreGained);
            gameState.deselectBlock();
            boardChanged = true;
        } else {
            gameState.selectBlock(clickedIndex);
        }

        boardRenderer.renderBlocks();
        if (boardChanged) {
            checkAllBlockImages();
            combinationsDisplay.update();
        }
    }

    function handleEmptyCellClick(clickedIndex) {
        if (dragHandler.isDragging) return;

        const isIndicatorCell = gameState.nextSpawnIndices.includes(clickedIndex);
        if (isIndicatorCell) {
            if (gameState.currentDifficulty === 'easy' || gameState.currentDifficulty === 'zen') {
                spawnEarly(clickedIndex);
            }
            // On other difficulties, or if it's an indicator, we do nothing else.
            return;
        }
        
        let boardChanged = false;

        if (!gameState.hasSelectedBlock()) {
            const newValue = gameState.getNewBlockValue();
            gameState.placeBlock(clickedIndex, newValue);
            replayManager.recordSpawn(clickedIndex, newValue);
            boardChanged = true;
        } else {
            const selectedIndex = gameState.getSelectedBlockIndex();
            const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);

            if (isNeighbor) {
                const selectedValue = gameState.getBlockValue(selectedIndex);
                gameState.placeBlock(clickedIndex, selectedValue);
                gameState.removeBlock(selectedIndex);
                replayManager.recordMove('relocate', selectedIndex, clickedIndex, selectedValue, 0, selectedValue, 0);
                gameState.deselectBlock();
                boardChanged = true;
            } else {
                gameState.deselectBlock();
            }
        }
        
        boardRenderer.renderBlocks();

        if (boardChanged) {
            checkAllBlockImages();
            combinationsDisplay.update();
        }
    }

    function spawnEarly(index) {
        if ((gameState.currentDifficulty !== 'easy' && gameState.currentDifficulty !== 'zen') || !gameState.nextSpawnIndices.includes(index)) {
            return;
        }

        // Place the new block
        const newValue = gameState.getNewBlockValue();
        gameState.placeBlock(index, newValue);
        replayManager.recordSpawn(index, newValue, true);

        // Remove from the spawn queue
        const queueIndex = gameState.nextSpawnIndices.indexOf(index);
        if (queueIndex > -1) {
            gameState.nextSpawnIndices.splice(queueIndex, 1);
        }

        // Re-render the board to show the new block and remove the indicator
        boardRenderer.render();
        checkAllBlockImages();
        combinationsDisplay.update();
    }

    async function generateImageForValue(value) {
        if (!gameState.theme || gameState.getImageForValue(value)) {
            return;
        }

        // Set status to loading to prevent multiple requests
        gameState.setImageForValue(value, 'loading');
        boardRenderer.renderBlocks(); // Show loading indicator

        try {
            const descriptor = levelDescriptors[value - 1] || `an evolved`;
            const result = await websim.imageGen({
                prompt: `A cute, simple icon of ${descriptor} ${gameState.theme}. Sticker style, on a white background. Do not include any text or numbers.`,
                transparent: false,
                aspect: "square"
            });
            gameState.setImageForValue(value, result.url);
            replayManager.recordImageGeneration(value, result.url);
        } catch (error) {
            console.error(`Failed to generate image for value ${value}:`, error);
            // Revert status if generation fails
            gameState.setImageForValue(value, null);
        }

        boardRenderer.renderBlocks();
        combinationsDisplay.update();
    }

    function checkAllBlockImages() {
        if (!gameState.theme) return;

        const uniqueValues = [...new Set(gameState.boardState.filter(v => v > 0))];
        uniqueValues.forEach(value => {
            if (!gameState.getImageForValue(value)) {
                generateImageForValue(value);
            }
        });
    }

    function startGame(difficulty, useStoredImages = false) {
        const theme = themeInput.value.trim() || null;
        const config = gameState.initializeGame(difficulty, theme);
        hourglassManager.destroy();

        if (useStoredImages) {
            gameState.blockImages = replayManager.getStoredImageUrls();
        }

        if (difficulty === 'hard') {
            combinationsContainer.style.display = 'none';
        } else {
            combinationsContainer.style.display = 'block';
        }

        // Spawn initial blocks and track their placement
        const initialBoardState = [...gameState.boardState]; // Copy empty board state
        for (let i = 0; i < config.initialBlocks; i++) {
             const emptyCells = gameState.getEmptyCells();
             if (emptyCells.length > 0) {
                const randomEmptyCellIndex = Math.floor(Math.random() * emptyCells.length);
                const boardIndex = emptyCells.splice(randomEmptyCellIndex, 1)[0];
                const newValue = gameState.getNewBlockValue();
                gameState.placeBlock(boardIndex, newValue);
                initialBoardState[boardIndex] = newValue;
             }
        }
        
        // Initialize replay tracking with the final board state after initial spawns
        replayManager.startNewGame(difficulty, theme, initialBoardState);
        
        // Pass gameState reference to replay manager for accurate state tracking
        replayManager.gameState = gameState;
        
        // Now render, check for all images, and update combinations
        boardRenderer.render();
        checkAllBlockImages();
        combinationsDisplay.update();
        prepareNextSpawn();

        titleScreen.classList.remove('active');
        replayScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        
        setTimeout(() => {
            hourglassManager.create(
                config.sandGrains, 
                spawnRandomBlock,
                updateSpawnIndicators
            );
        }, 100);

        requestAnimationFrame(() => {
            boardRenderer.render();
        });
    }
    
    function updateSpawnIndicators(progress) {
        const indicators = document.querySelectorAll('.spawn-indicator');
        indicators.forEach(indicator => {
            indicator.style.opacity = 0.2 + (progress * 0.7);
        });
    }
    
    function showTitleScreen() {
        titleScreen.classList.add('active');
        gameScreen.classList.remove('active');
        replayScreen.classList.remove('active');
        replayMenuScreen.classList.remove('active');
        header.classList.remove('in-game');
        gameBoard.innerHTML = '';
        hourglassManager.destroy();
        gameState.reset();
        combinationsContainer.style.display = 'block';
    }

    function showReplayMenu() {
        const storedReplay = replayManager.loadFromStorage();
        
        if (!storedReplay) {
            noReplayMessage.style.display = 'block';
            replayDetails.style.display = 'none';
            watchReplayMenuBtn.style.display = 'none';
            document.getElementById('continue-with-images-section').style.display = 'none';
        } else {
            noReplayMessage.style.display = 'none';
            replayDetails.style.display = 'block';
            watchReplayMenuBtn.style.display = 'block';
            document.getElementById('continue-with-images-section').style.display = 'block';
            
            // Calculate final score from replay events
            let finalScore = 0;
            storedReplay.events.forEach(event => {
                if (event.type === 'move' && event.data.scoreGained) {
                    finalScore += event.data.scoreGained;
                }
            });
            
            replayTheme.textContent = storedReplay.theme || 'Blocks';
            replayDifficulty.textContent = storedReplay.difficulty;
            replayFinalScore.textContent = finalScore;
        }
        
        titleScreen.classList.remove('active');
        replayMenuScreen.classList.add('active');
    }

    // Event listeners
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            startGame(button.dataset.difficulty);
        });
    });

    // Replay menu event listeners
    replayMenuBtn.addEventListener('click', () => {
        showReplayMenu();
    });

    watchReplayMenuBtn.addEventListener('click', () => {
        replayMenuBoardWrapper.style.display = 'block';
        replayMenuStatus.textContent = 'Playing Replay...';
        
        const replayMenuBoardRenderer = new BoardRenderer(
            gameState,
            replayMenuBoard,
            null, // No drag handler for replay
            () => {}, // No block click for replay
            () => {}  // No empty cell click for replay
        );

        replayManager.playReplay(gameState, replayMenuBoardRenderer, () => {
            replayMenuStatus.textContent = 'Replay Complete!';
        });
    });

    continueDifficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const storedReplay = replayManager.loadFromStorage();
            if (storedReplay) {
                themeInput.value = storedReplay.theme || '';
                startGame(button.dataset.difficulty, true);
            }
        });
    });

    backToHomeBtn.addEventListener('click', () => {
        replayMenuBoardWrapper.style.display = 'none';
        showTitleScreen();
    });

    // Replay event listeners
    watchReplayBtn.addEventListener('click', () => {
        replayBoardWrapper.style.display = 'block';
        replayStatus.textContent = 'Playing Replay...';
        
        const replayBoardRenderer = new BoardRenderer(
            gameState,
            replayBoard,
            null, // No drag handler for replay
            () => {}, // No block click for replay
            () => {}  // No empty cell click for replay
        );

        replayManager.playReplay(gameState, replayBoardRenderer, () => {
            replayStatus.textContent = 'Replay Complete!';
        });
    });

    restartWithImagesBtn.addEventListener('click', () => {
        const storedReplay = replayManager.loadFromStorage();
        if (storedReplay) {
            themeInput.value = storedReplay.theme || '';
            startGame(storedReplay.difficulty, true);
        }
    });

    newGameBtn.addEventListener('click', () => {
        replayManager.clearReplay();
        showTitleScreen();
    });

    homeBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to quit and return to the main menu? Your score will be lost.')) {
            showTitleScreen();
        }
    });

    gameOverlay.addEventListener('click', () => {
        gameState.deselectBlock();
        boardRenderer.renderBlocks();
    });
    
    document.addEventListener('click', (event) => {
        if (gameScreen.classList.contains('active') && !gameBoard.contains(event.target) && !combinationsContainer.contains(event.target)) {
            gameState.deselectBlock();
            boardRenderer.renderBlocks();
        }
    });

    window.addEventListener('resize', () => {
        if (gameScreen.classList.contains('active')) {
            boardRenderer.render();
        }
    });
});