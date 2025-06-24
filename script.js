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
        prepareNextSpawn();
    };

    function prepareNextSpawn() {
        boardRenderer.clearSpawnAnimations();
        gameState.upcomingSpawns = [];
        
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

        if (actualNumToSpawn === 0 && difficulty !== 'zen') {
            console.log("Game Over - No empty cells for next spawn.");
            gameOver();
            return;
        }

        for (let i = 0; i < actualNumToSpawn; i++) {
            const randomEmptyCellIndex = Math.floor(Math.random() * emptyCells.length);
            const boardIndex = emptyCells.splice(randomEmptyCellIndex, 1)[0];
            gameState.upcomingSpawns.push(boardIndex);
        }
        
        boardRenderer.showSpawnAnimations(gameState.upcomingSpawns);
    }

    function executeSpawn() {
        if (gameState.upcomingSpawns.length === 0 && gameState.currentDifficulty !== 'zen' && gameState.getEmptyCells().length === 0) {
             gameOver();
             return;
        }

        for (const boardIndex of gameState.upcomingSpawns) {
            gameState.placeBlock(boardIndex, gameState.getNewBlockValue());
        }
        
        boardRenderer.render();
        checkAllBlockImages();
        combinationsDisplay.update();

        prepareNextSpawn();

        hourglassManager.reset();
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
        
        let moveMade = false;
        if (isNeighbor && sameValue) {
            const mergedValue = gameState.getBlockValue(clickedIndex) + 1;
            gameState.placeBlock(clickedIndex, mergedValue);
            gameState.removeBlock(selectedIndex);
            gameState.updateScore(mergedValue);
            gameState.deselectBlock();
            moveMade = true;
        } else if (isNeighbor && sumValue % 2 === 0) {
            const halfValue = sumValue / 2;
            gameState.placeBlock(selectedIndex, halfValue);
            gameState.placeBlock(clickedIndex, halfValue);
            gameState.updateScore(halfValue * 2);
            gameState.deselectBlock();
            moveMade = true;
        } else {
            gameState.selectBlock(clickedIndex);
        }

        boardRenderer.render();
        checkAllBlockImages();
        combinationsDisplay.update();
        if(moveMade) {
            prepareNextSpawn();
        }
    }

    function handleEmptyCellClick(clickedIndex) {
        if (dragHandler.isDragging) return;
        
        let moveMade = false;
        if (!gameState.hasSelectedBlock()) {
            // This behavior might be too powerful, maybe remove?
            // gameState.placeBlock(clickedIndex, gameState.getNewBlockValue());
            // boardRenderer.render();
            // checkAllBlockImages();
            // combinationsDisplay.update();
            return;
        }

        const selectedIndex = gameState.getSelectedBlockIndex();
        const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);

        if (isNeighbor) {
            gameState.placeBlock(clickedIndex, gameState.getBlockValue(selectedIndex));
            gameState.removeBlock(selectedIndex);
            gameState.deselectBlock();
            moveMade = true;
        } else {
            gameState.deselectBlock();
        }
        
        boardRenderer.render();
        if (moveMade) {
            checkAllBlockImages();
            combinationsDisplay.update();
            prepareNextSpawn();
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
        prepareNextSpawn();

        titleScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        
        setTimeout(() => {
            hourglassManager.create(config.sandGrains, executeSpawn);
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
        boardRenderer.clearSpawnAnimations();
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