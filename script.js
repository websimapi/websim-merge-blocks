document.addEventListener('DOMContentLoaded', () => {
    const titleScreen = document.getElementById('title-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameBoard = document.getElementById('game-board');
    const gameOverlay = document.getElementById('game-overlay');
    const backButton = document.getElementById('back-btn');
    const scoreElement = document.getElementById('score');
    const header = document.querySelector('header');
    const sandContainer = document.getElementById('sand-container');
    const hourglassFlipper = document.getElementById('hourglass-flipper');

    const difficultyButtons = document.querySelectorAll('.difficulty-btn');

    const GAME_CONFIG = {
        easy: { gridSize: 4, initialBlocks: 2, spawnRate: 15000 },
        medium: { gridSize: 5, initialBlocks: 5, spawnRate: 12000 },
        hard: { gridSize: 6, initialBlocks: 6, spawnRate: 8000 },
    };

    let gridSize = 0;
    let boardState = [];
    let score = 0;
    let spawnTimeout = null;
    let selectedBlockIndex = -1;
    let isHourglassFlipped = false;
    let particles = [];
    const PARTICLE_COUNT = 50; // Reduced from 100

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
        // Stop any pending spawns, as this one is happening now.
        if (spawnTimeout) clearTimeout(spawnTimeout);

        // Flip the hourglass visuals
        isHourglassFlipped = !isHourglassFlipped;
        hourglassFlipper.classList.toggle('flipped', isHourglassFlipped);
        
        // After the flip animation completes, spawn the block and restart the sand timer.
        setTimeout(() => {
            const emptyCells = getEmptyCells();
            if (emptyCells.length === 0) {
                console.log("No empty cells to spawn a new block.");
                // Potentially end game here in the future
                return;
            }
            const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            boardState[randomIndex] = getNewBlockValue(); 
            renderBoard(); // Render after spawning to show the new block
            
            // When a block spawns, reset the hourglass animation and set the timer for the next one.
            const spawnRate = GAME_CONFIG[currentDifficulty].spawnRate;
            startHourglassAnimation(spawnRate);
        }, 600); // Duration of the flip animation
    };

    const handleBlockClick = (clickedIndex) => {
        if (boardState[clickedIndex] === 0) {
            // Clicked an empty cell, so handle it as an empty cell click
            handleEmptyCellClick(clickedIndex);
            return;
        }

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

    const handleEmptyCellClick = (clickedIndex) => {
        if (selectedBlockIndex === -1) {
            // Nothing is selected, so clicking an empty cell does nothing.
            return;
        }

        // A block is selected, and an empty cell is clicked.
        // Check if it's a valid move target.
        const isNeighbor = areNeighbors(selectedBlockIndex, clickedIndex);

        if (isNeighbor) {
            // It's a neighbor, so move the block.
            boardState[clickedIndex] = boardState[selectedBlockIndex];
            boardState[selectedBlockIndex] = 0;
            selectedBlockIndex = -1; // Deselect after moving.
            renderBoard();
        } else {
            // It's not a neighbor. Deselect the block as per instructions.
            deselectBlock();
        }
    };

    const deselectBlock = () => {
        if (selectedBlockIndex !== -1) {
            selectedBlockIndex = -1;
            renderBoard();
        }
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
            
            // Add click listener to the background cell for moves
            cell.addEventListener('click', () => {
                handleEmptyCellClick(i);
            });

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

    let currentDifficulty = 'easy'; // Keep track of current difficulty

    const startHourglassAnimation = (durationMs) => {
        let maxAnimationTime = 0;
        const durationSec = durationMs / 1000;
    
        particles.forEach(particle => {
            // Remove the falling class to reset the animation
            particle.classList.remove('falling');
    
            // Force a reflow to make sure the class removal is registered before adding it back
            void particle.offsetWidth;
    
            // Stagger particle fall start time over the first 80% of the duration
            const delay = Math.random() * (durationSec * 0.8);
            // Sand should finish falling just before the next spawn
            const animDuration = durationSec * 0.9;
    
            particle.style.animationDelay = `${delay}s`;
            particle.style.animationDuration = `${animDuration}s`;
            
            // Add the class back to start the animation
            particle.classList.add('falling');
    
            // Track the time until the last particle finishes
            if (delay + animDuration > maxAnimationTime) {
                maxAnimationTime = delay + animDuration;
            }
        });
    
        // Set a timeout for the next spawn based on when the last particle will have fallen.
        if (spawnTimeout) clearTimeout(spawnTimeout);
        spawnTimeout = setTimeout(spawnRandomBlock, maxAnimationTime * 1000);
    };

    const createParticles = () => {
        sandContainer.innerHTML = '';
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            // Random start X near the neck, Y in top bulb
            const initialX = 30 + (Math.random() - 0.5) * 15;
            const initialY = 15 + Math.random() * 10;
            
            particle.setAttribute('cx', initialX);
            particle.setAttribute('cy', initialY);
            particle.setAttribute('r', 1.5 + Math.random());
            particle.classList.add('sand-particle');
            
            sandContainer.appendChild(particle);
            particles.push(particle);
        }
    };

    const startGame = (difficulty) => {
        currentDifficulty = difficulty; // Store difficulty
        const config = GAME_CONFIG[difficulty];
        gridSize = config.gridSize;
        
        // Clear any existing game timer
        if (spawnTimeout) {
            clearTimeout(spawnTimeout);
        }

        // Reset game state
        score = 0;
        scoreElement.textContent = score;
        selectedBlockIndex = -1;
        isHourglassFlipped = false;
        hourglassFlipper.classList.remove('flipped');

        // Initialize board state with all zeros
        boardState = new Array(gridSize * gridSize).fill(0);
        
        // Spawn initial blocks without flipping hourglass
        const spawnRate = config.spawnRate;
        for (let i = 0; i < config.initialBlocks; i++) {
            const emptyCells = getEmptyCells();
            if (emptyCells.length > 0) {
                 const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
                 boardState[randomIndex] = getNewBlockValue();
            }
        }

        // Create the persistent particle elements for the hourglass
        createParticles();

        titleScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        
        // Start the first hourglass cycle. This will schedule the first spawn.
        startHourglassAnimation(spawnRate);
        
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
        if (spawnTimeout) {
            clearTimeout(spawnTimeout);
            spawnTimeout = null;
        }
        sandContainer.innerHTML = ''; // Clear sand
        particles = [];
        selectedBlockIndex = -1; // Reset selection
        isHourglassFlipped = false;
        hourglassFlipper.classList.remove('flipped');
    }

    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            startGame(button.dataset.difficulty);
        });
    });
    
    backButton.addEventListener('click', showTitleScreen);

    // Clicks on blocks or empty cells are handled by their own listeners.
    gameOverlay.addEventListener('click', deselectBlock);
    document.addEventListener('click', (event) => {
        // This handles clicks completely outside the game-screen (e.g., on the header)
        if (gameScreen.classList.contains('active') && !gameScreen.contains(event.target)) {
            deselectBlock();
        }
    });

    // Re-render on window resize to adjust block sizes
    window.addEventListener('resize', () => {
        if (gameScreen.classList.contains('active')) {
            renderBoard();
        }
    });
});