// Main game coordinator
import { GameState } from './game-state.js';
import { HourglassManager } from './hourglass.js';
import { DragHandler } from './drag-handler.js';
import { BoardRenderer } from './board-renderer.js';
import { CombinationsDisplay } from './combinations-display.js';

document.addEventListener('DOMContentLoaded', () => {
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

    // Set up drag completion callback
    dragHandler.onDragComplete = () => {
        boardRenderer.render();
        checkAllBlockImages();
        combinationsDisplay.update();
    };

    function executeTurn() {
        // 1. Spawn blocks in the pre-determined locations
        const upcomingSpawns = gameState.getUpcomingSpawns();
        upcomingSpawns.forEach(boardIndex => {
            gameState.placeBlock(boardIndex, gameState.getNewBlockValue());
        });
        gameState.clearUpcomingSpawns();

        // 2. Render board, check images, update combinations
        boardRenderer.render();
        checkAllBlockImages();
        combinationsDisplay.update();

        // 3. Prepare for the next turn
        prepareNextSpawn();
        
        // 4. Reset hourglass
        if (gameState.currentDifficulty !== 'zen') {
             hourglassManager.reset();
        }
    }

    function prepareNextSpawn() {
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
        
        // Find empty cells that are not already marked for a future spawn
        const availableCells = gameState.getEmptyCellsForSpawning();
        
        if (availableCells.length < numToSpawn) {
            if (difficulty === 'zen') {
                console.log("Grid full in Zen mode - continuing without spawning");
                gameState.setUpcomingSpawns([]);
                boardRenderer.render();
                hourglassManager.reset();
                return;
            } else {
                console.log("Game Over - Not enough empty cells for the next spawn.");
                gameOver();
                return;
            }
        }

        const spawnIndices = [];
        for (let i = 0; i < numToSpawn; i++) {
            const randomEmptyCellIndex = Math.floor(Math.random() * availableCells.length);
            const boardIndex = availableCells.splice(randomEmptyCellIndex, 1)[0];
            spawnIndices.push(boardIndex);
        }

        gameState.setUpcomingSpawns(spawnIndices);
        boardRenderer.render(); // Re-render to show spawn animations
    }

    function gameOver() {
        hourglassManager.destroy();
        alert(`Game Over! Final Score: ${gameState.score}`);
        showTitleScreen();
    }

    function handleBlockClick(clickedIndex) {
        if (dragHandler.isDragging) return;
        
        if (!gameState.hasSelectedBlock()) {
            gameState.selectBlock(clickedIndex);
            boardRenderer.render();
            return;
        }

        if (gameState.getSelectedBlockIndex() === clickedIndex) {
            gameState.deselectBlock();
            boardRenderer.render();
            return;
        }

        const selectedIndex = gameState.getSelectedBlockIndex();
        const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);
        const selectedValue = gameState.getBlockValue(selectedIndex);
        const clickedValue = gameState.getBlockValue(clickedIndex);
        const sameValue = selectedValue === clickedValue;
        const sumValue = selectedValue + clickedValue;

        if (isNeighbor && sameValue) {
            const mergedValue = gameState.getBlockValue(clickedIndex) + 1;
            gameState.placeBlock(clickedIndex, mergedValue);
            gameState.removeBlock(selectedIndex);
            gameState.updateScore(mergedValue);
            gameState.deselectBlock();
        } else if (isNeighbor && sumValue % 2 === 0) {
            const halfValue = sumValue / 2;
            gameState.placeBlock(selectedIndex, halfValue);
            gameState.placeBlock(clickedIndex, halfValue);
            gameState.updateScore(halfValue * 2);
            gameState.deselectBlock();
        } else {
            gameState.selectBlock(clickedIndex);
        }

        boardRenderer.render();
        checkAllBlockImages();
        combinationsDisplay.update();
    }

    function handleEmptyCellClick(clickedIndex) {
        if (dragHandler.isDragging) return;
        
        if (!gameState.hasSelectedBlock()) {
            gameState.placeBlock(clickedIndex, gameState.getNewBlockValue());
            boardRenderer.render();
            checkAllBlockImages();
            combinationsDisplay.update();
            prepareNextSpawn(); // A new block was placed, so we need to set up the next spawn.
            return;
        }

        const selectedIndex = gameState.getSelectedBlockIndex();
        const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);

        if (isNeighbor && !gameState.isUpcomingSpawn(clickedIndex)) {
            gameState.placeBlock(clickedIndex, gameState.getBlockValue(selectedIndex));
            gameState.removeBlock(selectedIndex);
            gameState.deselectBlock();
            boardRenderer.render();
            checkAllBlockImages();
            combinationsDisplay.update();
        } else {
            gameState.deselectBlock();
            boardRenderer.render();
        }
    }

    async function generateImageForValue(value) {
        if (!gameState.theme || gameState.getImageForValue(value)) {
            return;
        }

        // Set status to loading to prevent multiple requests
        gameState.setImageForValue(value, 'loading');
        boardRenderer.render(); // Show loading indicator

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

        boardRenderer.render();
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

    function startGame(difficulty) {
        const theme = themeInput.value.trim() || null;
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
        checkAllBlockImages();
        combinationsDisplay.update();
        
        // Prepare the first random spawn
        prepareNextSpawn();

        titleScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        
        setTimeout(() => {
            hourglassManager.create(config.sandGrains, executeTurn);
        }, 100);

        requestAnimationFrame(() => {
            boardRenderer.render();
        });
    }
    
    function showTitleScreen() {
        titleScreen.classList.add('active');
        gameScreen.classList.remove('active');
        header.classList.remove('in-game');
        gameBoard.innerHTML = '';
        hourglassManager.destroy();
        gameState.reset();
        combinationsContainer.style.display = 'block';
    }

    // Event listeners
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            startGame(button.dataset.difficulty);
        });
    });

    homeBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to quit and return to the main menu? Your score will be lost.')) {
            showTitleScreen();
        }
    });

    gameOverlay.addEventListener('click', () => {
        gameState.deselectBlock();
        boardRenderer.render();
    });
    
    document.addEventListener('click', (event) => {
        if (gameScreen.classList.contains('active') && !gameScreen.contains(event.target)) {
            gameState.deselectBlock();
            boardRenderer.render();
        }
    });

    window.addEventListener('resize', () => {
        if (gameScreen.classList.contains('active')) {
            boardRenderer.render();
        }
    });
});