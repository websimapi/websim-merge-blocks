import { GameState } from './game-state.js';
import { HourglassManager } from './hourglass.js';
import { DragHandler } from './drag-handler.js';
import { BoardRenderer } from './board-renderer.js';
import { CombinationsDisplay } from './combinations-display.js';
import { UIManager } from './ui-manager.js';
import { MultiplayerManager } from './multiplayer-manager.js';
import { ImageManager } from './image-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Game state
    const gameState = new GameState();

    // DOM Elements
    const elements = {
        titleScreen: document.getElementById('title-screen'),
        gameScreen: document.getElementById('game-screen'),
        gameBoard: document.getElementById('game-board'),
        gameOverlay: document.getElementById('game-overlay'),
        homeBtn: document.getElementById('home-btn'),
        header: document.querySelector('header'),
        difficultyButtons: document.querySelectorAll('.difficulty-btn'),
        themeInput: document.getElementById('theme-input'),
        combinationsContainer: document.getElementById('combinations-container'),
        carouselTrack: document.getElementById('carousel-track'),
        playerList: document.getElementById('player-list')
    };

    // Game Modules
    const hourglassManager = new HourglassManager(gameState);
    const dragHandler = new DragHandler(gameState, elements.gameBoard);
    const combinationsDisplay = new CombinationsDisplay(gameState);
    const boardRenderer = new BoardRenderer(
        gameState,
        elements.gameBoard,
        dragHandler,
        (index) => handleBlockClick(index),
        (index) => handleEmptyCellClick(index)
    );
    
    const uiManager = new UIManager(elements, hourglassManager, gameState);

    const imageManager = new ImageManager(gameState, boardRenderer, combinationsDisplay);
    
    const multiplayerManager = await MultiplayerManager.create(gameState, elements.carouselTrack, elements.playerList);
    
    multiplayerManager.updateMyPresence({ isPlaying: false, score: 0 });

    // --- Main Game Logic ---

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

        if (actualNumToSpawn > 0) {
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
                hourglassManager.reset();
                return;
            } else {
                gameOver();
                return;
            }
        }

        spawnIndices.forEach(boardIndex => {
            if (gameState.nextSpawnIndices.includes(boardIndex)) {
                gameState.placeBlock(boardIndex, gameState.getNewBlockValue());
            }
        });
        
        gameState.nextSpawnIndices = [];

        boardRenderer.render();
        imageManager.manageBlockImages();
        combinationsDisplay.update();
        multiplayerManager.updateMyPresence();
        prepareNextSpawn();
    }

    function gameOver() {
        hourglassManager.destroy();
        alert(`Game Over! Final Score: ${gameState.score}`);
        uiManager.showTitleScreen();
        multiplayerManager.onGameOver();
    }

    async function startGame(difficulty, clickedButton) {
        const theme = elements.themeInput.value.trim() || null;
        
        if (theme && clickedButton) {
            await uiManager.showLoading(clickedButton, async () => {
                await imageManager.preloadInitialImages(theme);
            });
        }

        const config = gameState.initializeGame(difficulty, theme);

        if (difficulty === 'hard') {
            elements.combinationsContainer.style.display = 'none';
        } else {
            elements.combinationsContainer.style.display = 'block';
        }

        for (let i = 0; i < config.initialBlocks; i++) {
             const emptyCells = gameState.getEmptyCells();
             if (emptyCells.length > 0) {
                const randomEmptyCellIndex = Math.floor(Math.random() * emptyCells.length);
                const boardIndex = emptyCells.splice(randomEmptyCellIndex, 1)[0];
                gameState.placeBlock(boardIndex, gameState.getNewBlockValue());
             }
        }
        
        boardRenderer.render();
        imageManager.manageBlockImages();
        combinationsDisplay.update();
        prepareNextSpawn();
        
        uiManager.showGameScreen();
        multiplayerManager.updateMyPresence({ isPlaying: true });

        setTimeout(() => {
            hourglassManager.create(
                config.sandGrains, 
                spawnRandomBlock,
                uiManager.updateSpawnIndicators
            );
        }, 100);

        requestAnimationFrame(() => boardRenderer.render());
    }
    
    // --- Event Handlers ---

    function handleBlockClick(clickedIndex) {
        if (dragHandler.isDragging) return;
        
        if (!gameState.hasSelectedBlock()) {
            gameState.selectBlock(clickedIndex);
            boardRenderer.renderBlocks();
            return;
        }

        const selectedIndex = gameState.getSelectedBlockIndex();
        if (selectedIndex === clickedIndex) {
            gameState.deselectBlock();
            boardRenderer.renderBlocks();
            return;
        }

        let boardChanged = false;
        if (gameState.areNeighbors(selectedIndex, clickedIndex)) {
            const selectedValue = gameState.getBlockValue(selectedIndex);
            const clickedValue = gameState.getBlockValue(clickedIndex);
            
            if (selectedValue === clickedValue) { // Merge
                const mergedValue = clickedValue + 1;
                gameState.placeBlock(clickedIndex, mergedValue);
                gameState.removeBlock(selectedIndex);
                gameState.updateScore(mergedValue);
                boardChanged = true;
            } else if ((selectedValue + clickedValue) % 2 === 0) { // Split
                const halfValue = (selectedValue + clickedValue) / 2;
                gameState.placeBlock(selectedIndex, halfValue);
                gameState.placeBlock(clickedIndex, halfValue);
                gameState.updateScore(halfValue * 2);
                boardChanged = true;
            }
        }
        
        gameState.selectBlock(boardChanged ? -1 : clickedIndex);
        boardRenderer.renderBlocks();

        if (boardChanged) {
            imageManager.manageBlockImages();
            combinationsDisplay.update();
            multiplayerManager.updateMyPresence();
        }
    }

    function handleEmptyCellClick(clickedIndex) {
        if (dragHandler.isDragging) return;

        const isIndicatorCell = gameState.nextSpawnIndices.includes(clickedIndex);
        if (isIndicatorCell && (gameState.currentDifficulty === 'easy' || gameState.currentDifficulty === 'zen')) {
            spawnEarly(clickedIndex);
            return;
        }
        if (isIndicatorCell) return;
        
        let boardChanged = false;
        if (!gameState.hasSelectedBlock()) {
            gameState.placeBlock(clickedIndex, gameState.getNewBlockValue());
            boardChanged = true;
        } else {
            const selectedIndex = gameState.getSelectedBlockIndex();
            if (gameState.areNeighbors(selectedIndex, clickedIndex)) {
                gameState.placeBlock(clickedIndex, gameState.getBlockValue(selectedIndex));
                gameState.removeBlock(selectedIndex);
                boardChanged = true;
            }
            gameState.deselectBlock();
        }
        
        boardRenderer.renderBlocks();

        if (boardChanged) {
            imageManager.manageBlockImages();
            combinationsDisplay.update();
            multiplayerManager.updateMyPresence();
        }
    }
    
    function spawnEarly(index) {
        gameState.placeBlock(index, gameState.getNewBlockValue());
        const queueIndex = gameState.nextSpawnIndices.indexOf(index);
        if (queueIndex > -1) {
            gameState.nextSpawnIndices.splice(queueIndex, 1);
        }
        boardRenderer.render();
        imageManager.manageBlockImages();
        combinationsDisplay.update();
        multiplayerManager.updateMyPresence();
    }
    
    // --- Drag Handler Callbacks ---

    dragHandler.onDragComplete = (boardChanged) => {
        if (boardChanged) {
            boardRenderer.renderBlocks();
            imageManager.manageBlockImages();
            combinationsDisplay.update();
            multiplayerManager.updateMyPresence();
        } else {
            boardRenderer.renderBlocks(); // Re-render to clear selection
        }
    };
    
    dragHandler.onIndicatorDrop = (index) => {
        spawnEarly(index);
    };

    // --- Event Listeners ---

    elements.difficultyButtons.forEach(button => {
        button.addEventListener('click', () => startGame(button.dataset.difficulty, button));
    });

    elements.homeBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to quit? Your score will be lost.')) {
            uiManager.showTitleScreen();
            multiplayerManager.onGameOver();
        }
    });

    const deselect = () => {
        if (gameState.hasSelectedBlock()) {
            gameState.deselectBlock();
            boardRenderer.renderBlocks();
        }
    };
    
    elements.gameOverlay.addEventListener('click', deselect);
    document.addEventListener('click', (event) => {
        if (elements.gameScreen.classList.contains('active') && !elements.gameBoard.contains(event.target) && !elements.combinationsContainer.contains(event.target)) {
            deselect();
        }
    });

    window.addEventListener('resize', () => {
        if (elements.gameScreen.classList.contains('active')) {
            boardRenderer.render();
        }
    });
});