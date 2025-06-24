// Main game coordinator
import { GameState } from './game-state.js';
import { HourglassManager } from './hourglass.js';
import { DragHandler } from './drag-handler.js';
import { BoardRenderer } from './board-renderer.js';
import { CombinationsDisplay } from './combinations-display.js';
import { GameHistory } from './game-history.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const titleScreen = document.getElementById('title-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const gameBoard = document.getElementById('game-board');
    const homeBtn = document.getElementById('home-btn');
    const gameOverlay = document.getElementById('game-overlay');
    const header = document.querySelector('header');
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    const themeInput = document.getElementById('theme-input');
    const combinationsContainer = document.getElementById('combinations-container');
    const finalScoreEl = document.getElementById('final-score');
    const watchReplayBtn = document.getElementById('watch-replay-btn');
    const playSeededBtn = document.getElementById('play-seeded-btn');
    const mainMenuBtn = document.getElementById('main-menu-btn');
    const replayControls = document.getElementById('replay-controls');
    const replayStatus = document.getElementById('replay-status');
    const exitReplayBtn = document.getElementById('exit-replay-btn');

    const levelDescriptors = [
        "a basic", "an improved", "an advanced", "a superior", "a masterful", 
        "an ultimate", "a legendary", "a mythical", "a divine", "a supreme",
        "an arch", "a celestial", "an ethereal", "an astral", "a cosmic"
    ];

    // Game modules
    const gameState = new GameState();
    const hourglassManager = new HourglassManager(gameState);
    const gameHistory = new GameHistory();
    let isReplaying = false;

    const dragHandler = new DragHandler(gameState, gameBoard);
    const combinationsDisplay = new CombinationsDisplay(gameState);
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
    dragHandler.onDragComplete = (result) => {
        if (result && result.changed) {
            gameHistory.recordAction(result);
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
                gameHistory.recordAction({ type: 'spawn', index: boardIndex, value: newValue });
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
        gameHistory.save('lastGameReplay');
        finalScoreEl.textContent = `Final Score: ${gameState.score}`;
        gameScreen.classList.remove('active');
        gameOverScreen.classList.add('active');
    }

    function handleBlockClick(clickedIndex) {
        if (isReplaying || dragHandler.isDragging) return;
        
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
        let action = {};

        if (isNeighbor && sameValue) {
            const mergedValue = gameState.getBlockValue(clickedIndex) + 1;
            action = { type: 'merge', from: selectedIndex, to: clickedIndex, value: mergedValue };
            gameState.placeBlock(clickedIndex, mergedValue);
            gameState.removeBlock(selectedIndex);
            gameState.updateScore(mergedValue);
            gameState.deselectBlock();
            boardChanged = true;
        } else if (isNeighbor && sumValue % 2 === 0) {
            const halfValue = sumValue / 2;
            action = { type: 'split', from: selectedIndex, to: clickedIndex, value: halfValue };
            gameState.placeBlock(selectedIndex, halfValue);
            gameState.placeBlock(clickedIndex, halfValue);
            gameState.updateScore(halfValue * 2);
            gameState.deselectBlock();
            boardChanged = true;
        } else {
            gameState.selectBlock(clickedIndex);
        }

        boardRenderer.renderBlocks();
        if (boardChanged) {
            gameHistory.recordAction(action);
            checkAllBlockImages();
            combinationsDisplay.update();
        }
    }

    function handleEmptyCellClick(clickedIndex) {
        if (isReplaying || dragHandler.isDragging) return;

        const isIndicatorCell = gameState.nextSpawnIndices.includes(clickedIndex);
        if (isIndicatorCell) {
            if (gameState.currentDifficulty === 'easy' || gameState.currentDifficulty === 'zen') {
                spawnEarly(clickedIndex);
            }
            // On other difficulties, or if it's an indicator, we do nothing else.
            return;
        }
        
        let boardChanged = false;
        let action = {};

        if (!gameState.hasSelectedBlock()) {
            const newValue = gameState.getNewBlockValue();
            action = { type: 'spawn', index: clickedIndex, value: newValue };
            gameState.placeBlock(clickedIndex, newValue);
            boardChanged = true;
        } else {
            const selectedIndex = gameState.getSelectedBlockIndex();
            const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);

            if (isNeighbor) {
                action = { type: 'move', from: selectedIndex, to: clickedIndex };
                gameState.placeBlock(clickedIndex, gameState.getBlockValue(selectedIndex));
                gameState.removeBlock(selectedIndex);
                gameState.deselectBlock();
                boardChanged = true;
            } else {
                gameState.deselectBlock();
            }
        }
        
        boardRenderer.renderBlocks();

        if (boardChanged) {
            gameHistory.recordAction(action);
            checkAllBlockImages();
            combinationsDisplay.update();
        }
    }

    function spawnEarly(index) {
        if (isReplaying || (gameState.currentDifficulty !== 'easy' && gameState.currentDifficulty !== 'zen') || !gameState.nextSpawnIndices.includes(index)) {
            return;
        }

        // Place the new block
        const newValue = gameState.getNewBlockValue();
        gameState.placeBlock(index, newValue);
        gameHistory.recordAction({ type: 'spawn', index, value: newValue });

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
            gameHistory.recordImage(value, result.url);
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

    function startGame(difficulty, seedHistory = null) {
        const theme = seedHistory ? seedHistory.theme : (themeInput.value.trim() || null);
        const config = gameState.initializeGame(difficulty, theme);
        
        if (seedHistory) {
            gameState.setSeed(seedHistory);
        }
        
        hourglassManager.destroy();

        if (difficulty === 'hard') {
            combinationsContainer.style.display = 'none';
        } else {
            combinationsContainer.style.display = 'block';
        }

        // Spawn initial blocks
        if (!seedHistory) {
             for (let i = 0; i < config.initialBlocks; i++) {
                 const emptyCells = gameState.getEmptyCells();
                 if (emptyCells.length > 0) {
                    const randomEmptyCellIndex = Math.floor(Math.random() * emptyCells.length);
                    const boardIndex = emptyCells.splice(randomEmptyCellIndex, 1)[0];
                    const newValue = gameState.getNewBlockValue();
                    gameState.placeBlock(boardIndex, newValue);
                 }
            }
        }

        // Start history recording
        gameHistory.start(difficulty, theme, gameState.boardState, gameState.blockImages);
        // Record initial spawns if it's a new game
        if (!seedHistory) {
            gameState.boardState.forEach((value, index) => {
                if (value > 0) {
                    gameHistory.recordAction({ type: 'spawn', index, value });
                }
            });
        }
        
        // Now render, check for all images, and update combinations
        boardRenderer.render();
        checkAllBlockImages();
        combinationsDisplay.update();
        prepareNextSpawn();

        titleScreen.classList.remove('active');
        gameOverScreen.classList.remove('active');
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
        gameOverScreen.classList.remove('active');
        header.classList.remove('in-game');
        gameBoard.innerHTML = '';
        hourglassManager.destroy();
        gameState.reset();
        combinationsContainer.style.display = 'block';
    }

    // --- REPLAY LOGIC ---
    let replayTimeout;
    function watchReplay() {
        const history = gameHistory.load('lastGameReplay');
        if (!history) {
            alert("No replay data found!");
            return;
        }

        isReplaying = true;
        const config = gameState.initializeGame(history.difficulty, history.theme);
        
        // Setup initial state from history
        gameState.boardState = [...history.initialBoard];
        gameState.blockImages = history.images || {};
        
        // Display game
        titleScreen.classList.remove('active');
        gameOverScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        replayControls.classList.add('active');

        // Render initial board
        boardRenderer.render();
        combinationsDisplay.update();

        // Play actions
        let actionIndex = 0;
        const playNextAction = () => {
            if (actionIndex >= history.actions.length) {
                replayStatus.textContent = 'Replay Finished!';
                isReplaying = false;
                return;
            }

            const action = history.actions[actionIndex];
            replayStatus.textContent = `Action ${actionIndex + 1} / ${history.actions.length}`;
            
            // Apply action to game state
            switch (action.type) {
                case 'spawn':
                    gameState.placeBlock(action.index, action.value);
                    break;
                case 'move':
                    gameState.placeBlock(action.to, gameState.getBlockValue(action.from));
                    gameState.removeBlock(action.from);
                    break;
                case 'merge':
                    gameState.placeBlock(action.to, action.value);
                    gameState.removeBlock(action.from);
                    break;
                case 'split':
                    gameState.placeBlock(action.from, action.value);
                    gameState.placeBlock(action.to, action.value);
                    break;
            }
            
            boardRenderer.renderBlocks();
            combinationsDisplay.update();

            actionIndex++;
            replayTimeout = setTimeout(playNextAction, 750);
        };
        playNextAction();
    }

    function exitReplay() {
        clearTimeout(replayTimeout);
        isReplaying = false;
        replayControls.classList.remove('active');
        showTitleScreen();
    }

    // Event listeners
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            startGame(button.dataset.difficulty);
        });
    });

    homeBtn.addEventListener('click', () => {
        if (isReplaying || confirm('Are you sure you want to quit and return to the main menu? Your score will be lost.')) {
            exitReplay();
            showTitleScreen();
        }
    });

    gameOverlay.addEventListener('click', () => {
        if(isReplaying) return;
        gameState.deselectBlock();
        boardRenderer.renderBlocks();
    });
    
    document.addEventListener('click', (event) => {
        if (isReplaying) return;
        if (gameScreen.classList.contains('active') && !gameBoard.contains(event.target) && !combinationsContainer.contains(event.target)) {
            gameState.deselectBlock();
            boardRenderer.renderBlocks();
        }
    });

    watchReplayBtn.addEventListener('click', watchReplay);

    playSeededBtn.addEventListener('click', () => {
        const history = gameHistory.load('lastGameReplay');
        if (history) {
            startGame(history.difficulty, history);
        } else {
            alert("No game data found to play with!");
        }
    });

    mainMenuBtn.addEventListener('click', showTitleScreen);
    exitReplayBtn.addEventListener('click', exitReplay);

    window.addEventListener('resize', () => {
        if (gameScreen.classList.contains('active')) {
            boardRenderer.render();
        }
    });
});