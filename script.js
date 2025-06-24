// Main game coordinator
import { GameState } from './game-state.js';
import { HourglassManager } from './hourglass.js';
import { DragHandler } from './drag-handler.js';
import { BoardRenderer } from './board-renderer.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const titleScreen = document.getElementById('title-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameBoard = document.getElementById('game-board');
    const homeBtn = document.getElementById('home-btn');
    const gameOverlay = document.getElementById('game-overlay');
    const header = document.querySelector('header');
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');

    // Game modules
    const gameState = new GameState();
    const hourglassManager = new HourglassManager(gameState);
    const dragHandler = new DragHandler(gameState, gameBoard);
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
    };

    function spawnRandomBlock() {
        let numToSpawn = 1;
        const difficulty = gameState.currentDifficulty;

        if (difficulty === 'medium') {
            if (Math.random() < 0.5) {
                numToSpawn = 2;
            }
        } else if (difficulty === 'hard') {
            if (Math.random() < 0.9) { // 90% chance for 2 or 3 blocks
                if (Math.random() < 0.5) { // 50% of the 90% for 3 blocks
                    numToSpawn = 3;
                } else {
                    numToSpawn = 2;
                }
            } else { // 10% chance for 1 block
                numToSpawn = 1;
            }
        }
        
        const emptyCells = gameState.getEmptyCells();
        const availableSlots = emptyCells.length;

        // Cap the number of blocks to spawn by the number of available slots
        const actualNumToSpawn = Math.min(numToSpawn, availableSlots);

        if (actualNumToSpawn === 0) {
            if (difficulty === 'zen') {
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
        for (let i = 0; i < actualNumToSpawn; i++) {
            const randomEmptyCellIndex = Math.floor(Math.random() * emptyCells.length);
            const boardIndex = emptyCells.splice(randomEmptyCellIndex, 1)[0];
            gameState.placeBlock(boardIndex, gameState.getNewBlockValue());
        }

        boardRenderer.render();
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
    }

    function handleEmptyCellClick(clickedIndex) {
        if (dragHandler.isDragging) return;
        
        if (!gameState.hasSelectedBlock()) {
            gameState.placeBlock(clickedIndex, gameState.getNewBlockValue());
            boardRenderer.render();
            return;
        }

        const selectedIndex = gameState.getSelectedBlockIndex();
        const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);

        if (isNeighbor) {
            gameState.placeBlock(clickedIndex, gameState.getBlockValue(selectedIndex));
            gameState.removeBlock(selectedIndex);
            gameState.deselectBlock();
            boardRenderer.render();
        } else {
            gameState.deselectBlock();
            boardRenderer.render();
        }
    }

    function startGame(difficulty) {
        const config = gameState.initializeGame(difficulty);
        hourglassManager.destroy();

        for (let i = 0; i < config.initialBlocks; i++) {
            spawnRandomBlock();
        }

        titleScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        
        setTimeout(() => {
            hourglassManager.create(config.sandGrains, spawnRandomBlock);
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