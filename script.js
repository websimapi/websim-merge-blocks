// Main game coordinator
import { GameState } from './game-state.js';
import { HourglassManager } from './hourglass.js';
import { DragHandler } from './drag-handler.js';
import { BoardRenderer } from './board-renderer.js';
import { CombinationsDisplay } from './combinations-display.js';
import { Carousel } from './carousel.js';

document.addEventListener('DOMContentLoaded', async () => {
    // DOM elements
    const titleScreen = document.getElementById('title-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameBoard = document.getElementById('game-board');
    const homeBtn = document.getElementById('home-btn');
    const gameOverlay = document.getElementById('game-overlay');
    const header = document.querySelector('header');
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    const themeInput = document.getElementById('theme-input');
    const combinationsContainer = document.getElementById('combinations-container');
    const carouselWrapper = document.getElementById('game-carousel-wrapper');
    const mergeModal = document.getElementById('merge-modal');
    const mergeWarning = document.getElementById('merge-warning');
    const mergeDifficultyButtons = document.getElementById('merge-difficulty-buttons');
    const mergeConfirmBtn = document.getElementById('merge-confirm-btn');
    const mergeCancelBtn = document.getElementById('merge-cancel-btn');

    // Multiplayer setup
    const room = new WebsimSocket();
    await room.initialize();

    // Initialize Title Screen Carousel
    new Carousel('game-carousel', room);

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
    const boardRenderer = new BoardRenderer(
        gameState, 
        gameBoard, 
        dragHandler,
        handleBlockClick,
        handleEmptyCellClick
    );

    // Callbacks for carousel interaction
    carousel.onMergeRequest = handleMergeRequest;
    let pendingMergeData = null;

    dragHandler.onIndicatorDrop = (index) => {
        spawnEarly(index);
    };

    // Set up drag completion callback
    dragHandler.onDragComplete = (boardChanged) => {
        if (boardChanged) {
            boardRenderer.renderBlocks();
            manageBlockImages();
            combinationsDisplay.update();
            updatePresence();
        } else {
            // Re-render to clear selection state if drag was invalid
            boardRenderer.renderBlocks();
        }
    };

    function updatePresence() {
        if (!room.clientId) return;

        const presenceData = {
            inGame: gameScreen.classList.contains('active'),
            difficulty: gameState.currentDifficulty,
            theme: gameState.theme,
            gridSize: gameState.gridSize,
            boardState: gameState.boardState,
            blockImages: gameState.blockImages,
            score: gameState.score,
        };
        room.updatePresence(presenceData);
    }

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
                gameState.placeBlock(boardIndex, gameState.getNewBlockValue());
            }
        });
        
        gameState.nextSpawnIndices = [];

        boardRenderer.render();
        manageBlockImages();
        combinationsDisplay.update();
        updatePresence();
        prepareNextSpawn();
    }

    function gameOver() {
        hourglassManager.destroy();
        alert(`Game Over! Final Score: ${gameState.score}`);
        showTitleScreen();
    }

    function handleMergeRequest(startPlayer, endPlayer) {
        if (!startPlayer || !endPlayer) return;

        pendingMergeData = { startPlayer, endPlayer };

        if (gameScreen.classList.contains('active')) {
            mergeWarning.textContent = 'This will end your current game and you will lose all progress. Are you sure?';
        } else {
            mergeWarning.textContent = '';
        }

        // Set default difficulty and highlight button
        const defaultDifficulty = 'easy';
        pendingMergeData.difficulty = defaultDifficulty;
        document.querySelectorAll('#merge-difficulty-buttons .difficulty-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.difficulty === defaultDifficulty);
        });
        
        mergeModal.style.display = 'flex';
    }

    function startMergedGame() {
        if (!pendingMergeData) return;

        const { startPlayer, endPlayer, difficulty } = pendingMergeData;
        const theme = startPlayer.theme || endPlayer.theme || 'blocks';
        themeInput.value = theme;

        const combinedBlocks = [
            ...startPlayer.boardState.filter(v => v > 0),
            ...endPlayer.boardState.filter(v => v > 0)
        ];

        // Create a custom game setup function for merged games
        const setupMergedGame = async () => {
            const config = gameState.initializeGame(difficulty, theme);
            hourglassManager.destroy();

            if (difficulty === 'hard') {
                combinationsContainer.style.display = 'none';
            } else {
                combinationsContainer.style.display = 'block';
            }

            // Place combined blocks onto the new board
            const emptyCells = gameState.getEmptyCells();
            // Shuffle for random placement
            for (let i = emptyCells.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
            }

            const blocksToPlace = Math.min(combinedBlocks.length, emptyCells.length);
            for (let i = 0; i < blocksToPlace; i++) {
                gameState.placeBlock(emptyCells[i], combinedBlocks[i]);
            }
            
            // Now render, check for all images, and update combinations
            boardRenderer.render();
            manageBlockImages();
            combinationsDisplay.update();
            updatePresence();
            prepareNextSpawn();

            titleScreen.classList.remove('active');
            gameScreen.classList.add('active');
            header.classList.add('in-game');
            carouselWrapper.classList.add('in-game');
            document.body.classList.add('game-active');
            
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
        };
        
        // Start the game process
        setupMergedGame();
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

        if (isNeighbor && sameValue) {
            const mergedValue = gameState.getBlockValue(clickedIndex) + 1;
            gameState.placeBlock(clickedIndex, mergedValue);
            gameState.removeBlock(selectedIndex);
            gameState.updateScore(mergedValue);
            gameState.deselectBlock();
            boardChanged = true;
        } else if (isNeighbor && sumValue % 2 === 0) {
            const halfValue = sumValue / 2;
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
            manageBlockImages();
            combinationsDisplay.update();
            updatePresence();
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
            gameState.placeBlock(clickedIndex, gameState.getNewBlockValue());
            boardChanged = true;
        } else {
            const selectedIndex = gameState.getSelectedBlockIndex();
            const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);

            if (isNeighbor) {
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
            manageBlockImages();
            combinationsDisplay.update();
            updatePresence();
        }
    }

    function spawnEarly(index) {
        if ((gameState.currentDifficulty !== 'easy' && gameState.currentDifficulty !== 'zen') || !gameState.nextSpawnIndices.includes(index)) {
            return;
        }

        // Place the new block
        gameState.placeBlock(index, gameState.getNewBlockValue());

        // Remove from the spawn queue
        const queueIndex = gameState.nextSpawnIndices.indexOf(index);
        if (queueIndex > -1) {
            gameState.nextSpawnIndices.splice(queueIndex, 1);
        }

        // Re-render the board to show the new block and remove the indicator
        boardRenderer.render();
        manageBlockImages();
        combinationsDisplay.update();
        updatePresence();
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
        } catch (error) {
            console.error(`Failed to generate image for value ${value}:`, error);
            // Revert status if generation fails
            gameState.setImageForValue(value, null);
        }

        boardRenderer.renderBlocks();
        combinationsDisplay.update();
    }

    function manageBlockImages() {
        if (!gameState.theme) return;

        const uniqueValues = [...new Set(gameState.boardState.filter(v => v > 0))];
        
        // Ensure images for current values are loading/loaded
        uniqueValues.forEach(value => {
            if (!gameState.getImageForValue(value)) {
                generateImageForValue(value);
            }
        });

        // Pre-load for next levels
        if (uniqueValues.length > 0) {
            const maxVal = Math.max(...uniqueValues);
            const nextVal1 = maxVal + 1;
            const nextVal2 = maxVal + 2;

            if (levelDescriptors[nextVal1 - 1] && !gameState.getImageForValue(nextVal1)) {
                generateImageForValue(nextVal1);
            }
            if (levelDescriptors[nextVal2 - 1] && !gameState.getImageForValue(nextVal2)) {
                generateImageForValue(nextVal2);
            }
        }
    }

    async function startGame(difficulty, clickedButton = null) {
        const theme = themeInput.value.trim() || null;
        
        // Pre-load initial images if a theme is selected
        if (theme && clickedButton) {
            const originalText = clickedButton.textContent;
            clickedButton.textContent = 'Loading...';
            difficultyButtons.forEach(btn => btn.disabled = true);
            
            gameState.theme = theme;
            gameState.blockImages = {};

            // Use Promise.allSettled to ensure we proceed even if one fails
            await Promise.allSettled([
                generateImageForValue(1),
                generateImageForValue(2)
            ]);
            
            clickedButton.textContent = originalText;
            difficultyButtons.forEach(btn => btn.disabled = false);
        }

        const config = gameState.initializeGame(difficulty, theme);
        hourglassManager.destroy();

        if (difficulty === 'hard') {
            combinationsContainer.style.display = 'none';
        } else {
            combinationsContainer.style.display = 'block';
        }

        // Spawn initial blocks without generating images for them yet
        for (let i = 0; i < config.initialBlocks; i++) {
             const emptyCells = gameState.getEmptyCells();
             if (emptyCells.length > 0) {
                const randomEmptyCellIndex = Math.floor(Math.random() * emptyCells.length);
                const boardIndex = emptyCells.splice(randomEmptyCellIndex, 1)[0];
                gameState.placeBlock(boardIndex, gameState.getNewBlockValue());
             }
        }
        
        // Now render, check for all images, and update combinations
        boardRenderer.render();
        manageBlockImages();
        combinationsDisplay.update();
        updatePresence();
        prepareNextSpawn();

        titleScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        carouselWrapper.classList.add('in-game');
        document.body.classList.add('game-active');
        
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
        header.classList.remove('in-game');
        gameBoard.innerHTML = '';
        hourglassManager.destroy();
        gameState.reset();
        updatePresence();
        combinationsContainer.style.display = 'block';
        carouselWrapper.classList.remove('in-game');
        document.body.classList.remove('game-active');
    }

    // Event listeners
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            startGame(button.dataset.difficulty, button);
        });
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

    // Merge modal listeners
    mergeCancelBtn.addEventListener('click', () => {
        mergeModal.style.display = 'none';
        pendingMergeData = null;
    });

    mergeConfirmBtn.addEventListener('click', () => {
        mergeModal.style.display = 'none';
        startMergedGame();
        pendingMergeData = null;
    });

    document.querySelectorAll('#merge-difficulty-buttons .difficulty-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (pendingMergeData) {
                pendingMergeData.difficulty = button.dataset.difficulty;
                document.querySelectorAll('#merge-difficulty-buttons .difficulty-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                button.classList.add('selected');
            }
        });
    });
});