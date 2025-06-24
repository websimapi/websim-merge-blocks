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
    let isGameOver = false;

    // --- Hourglass Physics Simulation ---
    let sandParticles = [];
    let animationFrameId = null;
    const NUM_PARTICLES = 25; // Reduced particle count
    let GRAVITY = 0.0002; // Will be set dynamically
    const DAMPING = 0.7; // Energy loss on collision

    const createSandParticles = () => {
        sandContainer.innerHTML = '';
        sandParticles = [];
        for (let i = 0; i < NUM_PARTICLES; i++) {
            const particleElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            particleElement.setAttribute('r', 2 + Math.random() * 0.5); // Slightly larger particles
            particleElement.classList.add('sand-particle');
            sandContainer.appendChild(particleElement);

            sandParticles.push({
                el: particleElement,
                x: 30 + (Math.random() - 0.5) * 38, // Start scattered in top bulb
                y: 25 - Math.random() * 15,         // Y pos in top bulb
                vx: 0,
                vy: 0,
            });
        }
    };
    
    const updateSandPhysics = () => {
        const effectiveGravity = isHourglassFlipped ? -GRAVITY : GRAVITY;
        const neckY = 40;
        const topBound = 12;
        const bottomBound = 68;
        let particlesAtRest = 0;
        
        // Define hourglass wall lines for collision
        // (x1, y1, x2, y2)
        const walls = [
            [10, 10, 28, 40], // Top left
            [50, 10, 32, 40], // Top right
            [28, 40, 10, 70], // Bottom left
            [32, 40, 50, 70], // Bottom right
        ];

        sandParticles.forEach(p => {
            // Apply gravity
            p.vy += effectiveGravity;
            
            // Nudge towards center when near the neck
            const distFromNeckY = Math.abs(p.y - neckY);
            if (distFromNeckY < 5) {
                p.vx += (30 - p.x) * 0.01; // Funneling effect

                // Add random horizontal velocity when passing through neck to spread out
                if (Math.abs(p.y - neckY) < 1) {
                    p.vx += (Math.random() - 0.5) * 0.1;
                }
            }

            // Update position
            p.x += p.vx;
            p.y += p.vy;

            // Collision with floor/ceiling
            if (!isHourglassFlipped && p.y > bottomBound) {
                p.y = bottomBound;
                p.vy *= -DAMPING;
                p.vx *= DAMPING; // Friction
                if (Math.abs(p.vy) < 0.01) particlesAtRest++; // Count particle as "at rest"
            } else if (isHourglassFlipped && p.y < topBound) {
                p.y = topBound;
                p.vy *= -DAMPING;
                p.vx *= DAMPING; // Friction
                if (Math.abs(p.vy) < 0.01) particlesAtRest++; // Count particle as "at rest"
            } else {
                 // Simple collision with side walls (using a bounding box approach)
                if (p.x < 12) { p.x = 12; p.vx *= -DAMPING; }
                if (p.x > 48) { p.x = 48; p.vx *= -DAMPING; }
            }

            // Update SVG element
            p.el.setAttribute('cx', p.x);
            p.el.setAttribute('cy', p.y);
        });
        
        // Check if all sand has settled
        if (particlesAtRest === NUM_PARTICLES) {
            if (spawnTimeout) clearTimeout(spawnTimeout);
             // Use timeout to prevent instant re-triggering
            spawnTimeout = setTimeout(spawnRandomBlock, 250);
        }

        animationFrameId = requestAnimationFrame(updateSandPhysics);
    };

    const stopHourglassAnimation = () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    };
    // --- End Hourglass Physics ---

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
        if (isGameOver) return;
        
        const emptyCells = getEmptyCells();
        if (emptyCells.length === 0) {
            console.log("No empty cells to spawn a new block.");
            gameOver();
            return;
        }
        
        // Flip the hourglass first
        isHourglassFlipped = !isHourglassFlipped;
        hourglassFlipper.classList.toggle('flipped', isHourglassFlipped);
        
        // After flip animation, spawn block
        setTimeout(() => {
            const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            boardState[randomIndex] = getNewBlockValue(); 
            renderBoard(); // Render after spawning to show the new block
            
             // Re-check for game over after spawning a new block
            if (getEmptyCells().length === 0) {
                gameOver();
            }

        }, 300); // Half of flip animation duration
    };

    const handleBlockClick = (clickedIndex) => {
        if (isGameOver) return;

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
        if (isGameOver) return;

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

    const gameOver = () => {
        isGameOver = true;
        gameOverlay.classList.remove('hidden');
        if (spawnTimeout) clearTimeout(spawnTimeout);
        stopHourglassAnimation();
    }

    let currentDifficulty = 'easy'; // Keep track of current difficulty

    const startGame = (difficulty) => {
        currentDifficulty = difficulty; // Store difficulty
        const config = GAME_CONFIG[difficulty];
        gridSize = config.gridSize;
        
        // Clear any existing game timer
        if (spawnTimeout) {
            clearTimeout(spawnTimeout);
        }

        // Calculate gravity based on desired fall time (spawnRate)
        // Formula derived from d = 0.5 * a * t^2
        const distance = 56; // Approximate pixel distance for sand to fall
        const timeInFrames = (config.spawnRate / 1000) * 60; // 60fps
        GRAVITY = (2 * distance) / (timeInFrames * timeInFrames);

        // Reset game state
        score = 0;
        scoreElement.textContent = score;
        selectedBlockIndex = -1;
        isHourglassFlipped = false;
        hourglassFlipper.classList.remove('flipped');
        isGameOver = false;
        gameOverlay.classList.add('hidden');


        // Initialize board state with all zeros
        boardState = new Array(gridSize * gridSize).fill(0);
        
        // Spawn initial blocks
        for (let i = 0; i < config.initialBlocks; i++) {
            const emptyCells = getEmptyCells();
            if (emptyCells.length > 0) {
                 const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
                 boardState[randomIndex] = getNewBlockValue();
            }
        }

        titleScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        
        // Create sand particles and start the physics simulation
        createSandParticles();
        stopHourglassAnimation(); // Ensure no lingering animations
        updateSandPhysics();
        
        // Initial spawn is triggered by sand settling for the first time
        // The timeout here gives the particles a moment to initialize before the first check
        spawnTimeout = setTimeout(spawnRandomBlock, 250);


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
        // Stop spawning blocks and physics simulation when returning to menu
        if (spawnTimeout) {
            clearTimeout(spawnTimeout);
            spawnTimeout = null;
        }
        stopHourglassAnimation();
        sandContainer.innerHTML = ''; // Clear sand particles
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

    // If the user clicks outside the game board area, deselect the block.
    // Clicks on blocks or empty cells are handled by their own listeners.
    gameScreen.addEventListener('click', (e) => {
        // If the click is on the screen but not on the board itself, deselect
        if (e.target === gameScreen || e.target === gameOverlay) {
             deselectBlock();
        }
    });
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