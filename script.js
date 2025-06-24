document.addEventListener('DOMContentLoaded', () => {
    const titleScreen = document.getElementById('title-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameBoard = document.getElementById('game-board');
    const backButton = document.getElementById('back-btn');
    const scoreElement = document.getElementById('score');
    const header = document.querySelector('header');

    const difficultyButtons = document.querySelectorAll('.difficulty-btn');

    const GAME_CONFIG = {
        easy: { gridSize: 4, initialBlocks: 2, spawnRate: 15000 },
        medium: { gridSize: 5, initialBlocks: 5, spawnRate: 12000 },
        hard: { gridSize: 6, initialBlocks: 6, spawnRate: 8000 },
    };

    let gridSize = 0;
    let boardState = [];
    let score = 0;
    let spawnInterval = null;
    let selectedBlockIndex = -1;

    const getNewBlockValue = () => {
        // This function determines the value of a new block based on the score.
        // Higher scores have a chance to spawn higher value blocks.

        const rand = Math.random();

        if (score < 100) { // Score 0-99
            // 100% chance for 1
            return 1;
        } else if (score < 500) { // Score 100-499
            // 80% for 1, 20% for 2
            return rand < 0.8 ? 1 : 2;
        } else if (score < 1500) { // Score 500-1499
            // 60% for 1, 30% for 2, 10% for 3
            if (rand < 0.6) return 1;
            if (rand < 0.9) return 2;
            return 3;
        } else if (score < 3000) { // Score 1500-2999
            // 40% for 1, 35% for 2, 20% for 3, 5% for 4
            if (rand < 0.40) return 1;
            if (rand < 0.75) return 2;
            if (rand < 0.95) return 3;
            return 4;
        } else { // Score 3000+
            // 20% for 1, 30% for 2, 30% for 3, 15% for 4, 5% for 5
            if (rand < 0.20) return 1;
            if (rand < 0.50) return 2;
            if (rand < 0.80) return 3;
            if (rand < 0.95) return 4;
            return 5;
        }
    };

    const areNeighbors = (index1, index2) => {
        const row1 = Math.floor(index1 / gridSize);
        const col1 = index1 % gridSize;
        const row2 = Math.floor(index2 / gridSize);
        const col2 = index2 % gridSize;

        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);

        // They are neighbors if they are adjacent, including diagonals.
        // This means both row and column difference must be 1 or less,
        // but they can't be the same cell (where both diffs are 0).
        return rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff > 0);
    };

    const getEmptyCells = () => {
        const emptyCells = [];
        for (let i = 0; i < boardState.length; i++) {
            if (boardState[i] === 0) {
                emptyCells.push(i);
            }
        }
        return emptyCells;
    };

    const spawnRandomBlock = () => {
        const emptyCells = getEmptyCells();
        if (emptyCells.length === 0) {
            console.log("No empty cells to spawn a new block.");
            return;
        }
        const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        boardState[randomIndex] = getNewBlockValue(); 
        renderBoard(); // Render after spawning to show the new block
    };

    const handleBlockClick = (clickedIndex) => {
        if (selectedBlockIndex === -1) {
            // No block is selected, so select this one.
            selectedBlockIndex = clickedIndex;
            renderBoard();
            return;
        }

        if (selectedBlockIndex === clickedIndex) {
            // Clicked the same block, so deselect it.
            selectedBlockIndex = -1;
            renderBoard();
            return;
        }

        // A block is selected (selectedBlockIndex), and another block is clicked (clickedIndex).
        // This is a merge attempt.

        const isNeighbor = areNeighbors(selectedBlockIndex, clickedIndex);
        const sameValue = boardState[selectedBlockIndex] === boardState[clickedIndex];

        if (isNeighbor && sameValue) {
            // Merge condition met!
            const mergedValue = boardState[clickedIndex] + 1;
            boardState[clickedIndex] = mergedValue; // Update second block's value
            boardState[selectedBlockIndex] = 0;   // Empty the first block's cell

            // Update score
            score += mergedValue;
            scoreElement.textContent = score;

            // Deselect after merge
            selectedBlockIndex = -1;
        } else {
            // Not a valid merge. Select the newly clicked block instead.
            selectedBlockIndex = clickedIndex;
        }

        // Re-render the board to show the result of the action.
        renderBoard();
    };

    const renderBoard = () => {
        gameBoard.innerHTML = ''; // Clear board before rendering
        
        // Calculate cell size based on board dimensions and gap
        const boardSize = gameBoard.clientWidth;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
        const cellSize = (boardSize - (gridSize + 1) * gap) / gridSize;

        gameBoard.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
        gameBoard.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;
        gameBoard.style.gap = `${gap}px`;


        // Create background grid cells and number blocks
        for (let i = 0; i < gridSize * gridSize; i++) {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            gameBoard.appendChild(cell);

            if (boardState[i] !== 0) {
                const block = document.createElement('div');
                const value = boardState[i];
                block.classList.add('block', `block-${value}`);
                block.textContent = value;

                // Position the block
                const row = Math.floor(i / gridSize);
                const col = i % gridSize;
                block.style.width = `${cellSize}px`;
                block.style.height = `${cellSize}px`;
                block.style.top = `${gap + row * (cellSize + gap)}px`;
                block.style.left = `${gap + col * (cellSize + gap)}px`;
                
                // Adjust font size based on cell size
                block.style.fontSize = `${cellSize * 0.4}px`;

                // Add click listener for selection
                block.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevents clicks from propagating to board
                    handleBlockClick(i);
                });
                
                // Add selected class if this block is the selected one
                if (i === selectedBlockIndex) {
                    block.classList.add('selected');
                }

                gameBoard.appendChild(block);
            }
        }
    };

    const startGame = (difficulty) => {
        const config = GAME_CONFIG[difficulty];
        gridSize = config.gridSize;
        
        // Clear any existing game interval
        if (spawnInterval) {
            clearInterval(spawnInterval);
        }

        // Reset score
        score = 0;
        scoreElement.textContent = score;
        selectedBlockIndex = -1; // Reset selection on new game

        // Initialize board state with all zeros
        boardState = new Array(gridSize * gridSize).fill(0);
        
        // Spawn initial blocks
        for (let i = 0; i < config.initialBlocks; i++) {
            spawnRandomBlock();
        }

        titleScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        
        // Start spawning blocks periodically
        spawnInterval = setInterval(spawnRandomBlock, config.spawnRate); // Spawn a new block based on difficulty

        // Delay rendering to allow screen transition and correct board size calculation
        requestAnimationFrame(() => {
             renderBoard();
        });
    };
    
    const showTitleScreen = () => {
        titleScreen.classList.add('active');
        gameScreen.classList.remove('active');
        header.classList.remove('in-game');
        gameBoard.innerHTML = '';
        // Stop spawning blocks when returning to menu
        if (spawnInterval) {
            clearInterval(spawnInterval);
            spawnInterval = null;
        }
        selectedBlockIndex = -1; // Reset selection
    }

    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            startGame(button.dataset.difficulty);
        });
    });
    
    backButton.addEventListener('click', showTitleScreen);

    // Re-render on window resize to adjust block sizes
    window.addEventListener('resize', () => {
        if (gameScreen.classList.contains('active')) {
            renderBoard();
        }
    });
});