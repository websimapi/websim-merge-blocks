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
    const themeInput = document.getElementById('theme-input');
    const loadingOverlay = document.getElementById('loading-overlay');

    const levelDescriptors = [
        "a basic", "an improved", "an advanced", "a superior", "a masterful", 
        "an ultimate", "a legendary", "a mythical", "a divine", "a supreme",
        "an arch", "a celestial", "an ethereal", "an astral", "a cosmic"
    ];

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
        checkAllBlockImages();
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
            const value = gameState.getNewBlockValue();
            const newBlock = { value: value, id: String(value) };
            gameState.placeBlock(boardIndex, newBlock);
        }

        boardRenderer.render();
        checkAllBlockImages();
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

        const selectedIndex = gameState.getSelectedBlockIndex();

        if (selectedIndex === clickedIndex) {
            gameState.deselectBlock();
            boardRenderer.render();
            return;
        }

        const selectedBlock = gameState.getBlock(selectedIndex);
        const clickedBlock = gameState.getBlock(clickedIndex);

        const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);
        const selectedValue = selectedBlock.value;
        const clickedValue = clickedBlock.value;
        const sameValue = selectedValue === clickedValue;
        const sumValue = selectedValue + clickedValue;

        if (isNeighbor && sameValue) {
            const mergedValue = clickedValue + 1;
            const newBlock = { value: mergedValue, id: String(mergedValue) };
            gameState.placeBlock(clickedIndex, newBlock);
            gameState.removeBlock(selectedIndex);
            gameState.updateScore(mergedValue);
            gameState.deselectBlock();
        } else if (isNeighbor && !sameValue && sumValue % 2 === 0) {
            const halfValue = sumValue / 2;
            const subId = `${Math.min(selectedValue, clickedValue)}-${Math.max(selectedValue, clickedValue)}`;
            const subBlock = { value: halfValue, id: subId };
            
            gameState.placeBlock(selectedIndex, subBlock);
            gameState.placeBlock(clickedIndex, subBlock);
            gameState.updateScore(halfValue * 2);
            gameState.deselectBlock();
        } else {
            gameState.selectBlock(clickedIndex);
        }

        boardRenderer.render();
        checkAllBlockImages();
    }

    function handleEmptyCellClick(clickedIndex) {
        if (dragHandler.isDragging) return;
        
        if (!gameState.hasSelectedBlock()) {
            const value = gameState.getNewBlockValue();
            const newBlock = { value: value, id: String(value) };
            gameState.placeBlock(clickedIndex, newBlock);
            boardRenderer.render();
            checkAllBlockImages();
            return;
        }

        const selectedIndex = gameState.getSelectedBlockIndex();
        const isNeighbor = gameState.areNeighbors(selectedIndex, clickedIndex);

        if (isNeighbor) {
            gameState.placeBlock(clickedIndex, gameState.getBlock(selectedIndex));
            gameState.removeBlock(selectedIndex);
            gameState.deselectBlock();
            boardRenderer.render();
            checkAllBlockImages();
        } else {
            gameState.deselectBlock();
            boardRenderer.render();
        }
    }

    async function generateImageForNormalBlock(value) {
        const id = String(value);
        if (!gameState.theme || gameState.getImageForBlockId(id)) {
            return;
        }
        gameState.setImageForBlockId(id, 'loading');
        boardRenderer.render();

        try {
            const descriptor = levelDescriptors[value - 1] || `an evolved`;
            const result = await websim.imageGen({
                prompt: `A cute, simple icon of ${descriptor} ${gameState.theme}. Sticker style, on a white background. Do not include any text or numbers.`,
                transparent: false,
                aspect: "square"
            });
            gameState.setImageForBlockId(id, result.url);
        } catch (error) {
            console.error(`Failed to generate image for value ${value}:`, error);
            gameState.setImageForBlockId(id, null);
        }
        boardRenderer.render();
    }

    async function generateImageForSubCombination(subId) {
        if (!gameState.theme || gameState.getImageForBlockId(subId)) {
            return;
        }
        gameState.setImageForBlockId(subId, 'loading');
        boardRenderer.render();
        loadingOverlay.classList.add('active');

        try {
            const [val1, val2] = subId.split('-').map(Number);
            const imageUrl1 = gameState.getImageForBlockId(String(val1));
            const imageUrl2 = gameState.getImageForBlockId(String(val2));

            if (!imageUrl1 || !imageUrl2 || imageUrl1 === 'loading' || imageUrl2 === 'loading') {
                console.warn(`Parent images for ${subId} not ready, will retry.`);
                gameState.setImageForBlockId(subId, null);
                loadingOverlay.classList.remove('active');
                boardRenderer.render();
                return;
            }

            // Step 1 & 2: Get descriptions
            const descriptionPrompt = `Describe this image of a "${gameState.theme}" icon in detail for an image generation AI. Focus on style, color, and key visual elements.`;
            const [desc1Completion, desc2Completion] = await Promise.all([
                websim.chat.completions.create({ messages: [{ role: 'user', content: [{ type: 'text', text: descriptionPrompt }, { type: 'image_url', image_url: { url: imageUrl1 }}]}] }),
                websim.chat.completions.create({ messages: [{ role: 'user', content: [{ type: 'text', text: descriptionPrompt }, { type: 'image_url', image_url: { url: imageUrl2 }}]}] })
            ]);

            const desc1 = desc1Completion.content;
            const desc2 = desc2Completion.content;

            // Step 3: Combine descriptions
            const combinePrompt = `Combine these two image descriptions into a single, coherent prompt for a new image generation. The new image should be a creative fusion of the two original concepts. The theme is "${gameState.theme}". The final prompt should start with "A cute, simple icon of...". Don't mention the original items. Just describe the new fused item.
Description 1: ${desc1}
Description 2: ${desc2}`;
            const combinedDescCompletion = await websim.chat.completions.create({ messages: [{ role: 'user', content: combinePrompt }] });
            const finalPrompt = combinedDescCompletion.content;

            // Step 4: Generate new image
            const result = await websim.imageGen({
                prompt: `${finalPrompt} Sticker style, on a white background. Do not include any text or numbers.`,
                transparent: false,
                aspect: "square"
            });
            gameState.setImageForBlockId(subId, result.url);

        } catch (error) {
            console.error(`Failed to generate image for sub-combination ${subId}:`, error);
            gameState.setImageForBlockId(subId, null);
        } finally {
            loadingOverlay.classList.remove('active');
            boardRenderer.render();
        }
    }

    function checkAllBlockImages() {
        if (!gameState.theme) return;

        const uniqueBlocks = [];
        const seenIds = new Set();
        gameState.boardState.forEach(block => {
            if (block && !seenIds.has(block.id)) {
                uniqueBlocks.push(block);
                seenIds.add(block.id);
            }
        });

        uniqueBlocks.forEach(block => {
            const id = block.id;
            if (!gameState.getImageForBlockId(id)) {
                if (id.includes('-')) {
                    // It's a sub-combination
                    generateImageForSubCombination(id);
                } else {
                    // It's a normal block
                    generateImageForNormalBlock(block.value);
                }
            }
        });
    }

    function startGame(difficulty) {
        const theme = themeInput.value.trim() || null;
        const config = gameState.initializeGame(difficulty, theme);
        hourglassManager.destroy();

        for (let i = 0; i < config.initialBlocks; i++) {
            spawnRandomBlock(); // This will also trigger image checks
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

    // We make the overlay clickable to deselect blocks
    const gameScreenDiv = document.getElementById('game-screen');
    gameScreenDiv.addEventListener('click', (event) => {
        // if the click is on the game-screen background itself (and not on the board)
        if (event.target === gameScreenDiv || event.target === document.getElementById('game-container')) {
             gameState.deselectBlock();
             boardRenderer.render();
        }
    });

    gameOverlay.addEventListener('click', (event) => {
        // This is a backup for clicks on the board but not on a block.
        const boardRect = gameBoard.getBoundingClientRect();
        if (
            event.clientX >= boardRect.left && event.clientX <= boardRect.right &&
            event.clientY >= boardRect.top && event.clientY <= boardRect.bottom
        ) {
            gameState.deselectBlock();
            boardRenderer.render();
        }
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