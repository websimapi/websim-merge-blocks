document.addEventListener('DOMContentLoaded', () => {
    const titleScreen = document.getElementById('title-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameBoard = document.getElementById('game-board');
    const gameOverlay = document.getElementById('game-overlay');
    const backButton = document.getElementById('back-btn');
    const scoreElement = document.getElementById('score');
    const header = document.querySelector('header');

    const difficultyButtons = document.querySelectorAll('.difficulty-btn');

    const GAME_CONFIG = {
        easy: { gridSize: 4, initialBlocks: 2, sandGrains: 15 },
        medium: { gridSize: 5, initialBlocks: 5, sandGrains: 20 },
        hard: { gridSize: 6, initialBlocks: 6, sandGrains: 25 },
    };

    let gridSize = 0;
    let boardState = [];
    let score = 0;
    let spawnInterval = null;
    let selectedBlockIndex = -1;
    let hourglassEngine = null;
    let hourglassWorld = null;
    let sandGrains = [];
    let hourglassCanvas = null;
    let hourglassRender = null;
    let currentDifficulty = 'easy';

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

    const createHourglass = (numGrains) => {
        const canvas = document.getElementById('hourglass-canvas');
        const engine = Matter.Engine.create();
        const world = engine.world;
        
        // Set gravity based on difficulty - weaker for easy mode
        if (currentDifficulty === 'easy') {
            engine.world.gravity.y = 0.15;
        } else if (currentDifficulty === 'medium') {
            engine.world.gravity.y = 0.5;
        } else { // hard mode
            engine.world.gravity.y = 0.7;
        }
        
        // Set up canvas dimensions
        canvas.width = 120;
        canvas.height = 200;
        
        const render = Matter.Render.create({
            canvas: canvas,
            engine: engine,
            options: {
                width: 120,
                height: 200,
                wireframes: false,
                background: 'transparent',
                showAngleIndicator: false,
                showVelocity: false
            }
        });

        // Create hourglass shape
        const wallThickness = 4;
        const centerX = 60;
        const centerY = 100;
        
        // Outer walls
        const topWall = Matter.Bodies.rectangle(centerX, 10, 100, wallThickness, { 
            isStatic: true, 
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1
        });
        const bottomWall = Matter.Bodies.rectangle(centerX, 190, 100, wallThickness, { 
            isStatic: true, 
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1
        });
        const leftWall = Matter.Bodies.rectangle(10, centerY, wallThickness, 200, { 
            isStatic: true, 
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1
        });
        const rightWall = Matter.Bodies.rectangle(110, centerY, wallThickness, 200, { 
            isStatic: true, 
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1
        });
        
        // Top funnel - angled walls that narrow toward center
        const topFunnelLeft = Matter.Bodies.rectangle(30, 75, 60, wallThickness, { 
            isStatic: true, 
            angle: Math.PI / 6, // 30 degrees
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1
        });
        const topFunnelRight = Matter.Bodies.rectangle(90, 75, 60, wallThickness, { 
            isStatic: true, 
            angle: -Math.PI / 6, // -30 degrees
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1
        });
        
        // Bottom funnel - angled walls that widen from center
        const bottomFunnelLeft = Matter.Bodies.rectangle(30, 125, 60, wallThickness, { 
            isStatic: true, 
            angle: -Math.PI / 6, // -30 degrees
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1
        });
        const bottomFunnelRight = Matter.Bodies.rectangle(90, 125, 60, wallThickness, { 
            isStatic: true, 
            angle: Math.PI / 6, // 30 degrees
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1
        });
        
        // Small opening at center - make hole larger and walls longer with rounded tips
        const centerLeftWall = Matter.Bodies.rectangle(55, centerY, wallThickness, 24, { 
            isStatic: true, 
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1,
            chamfer: { radius: 2 } // Round the corners/tips
        });
        const centerRightWall = Matter.Bodies.rectangle(65, centerY, wallThickness, 24, { 
            isStatic: true, 
            render: { fillStyle: '#8B4513' },
            friction: 0.1,
            frictionStatic: 0.1,
            chamfer: { radius: 2 } // Round the corners/tips
        });

        // Add walls to world
        Matter.World.add(world, [
            topWall, bottomWall, leftWall, rightWall,
            topFunnelLeft, topFunnelRight,
            bottomFunnelLeft, bottomFunnelRight,
            centerLeftWall, centerRightWall
        ]);

        // Create sand grains
        sandGrains = [];
        for (let i = 0; i < numGrains; i++) {
            const grain = Matter.Bodies.circle(
                25 + Math.random() * 70, 
                25 + Math.random() * 40, 
                2.5, // Increased from 1.5 to 2.5
                {
                    render: { fillStyle: '#F4A460' },
                    restitution: 0.3, // Increased restitution to help particles bounce apart
                    friction: 0.3, // Reduced friction slightly
                    frictionAir: 0.01,
                    collisionFilter: {
                        group: -1 // Negative group makes particles repel each other slightly
                    },
                    chamfer: { radius: 1 } // Slight rounding for smoother collisions
                }
            );
            sandGrains.push(grain);
            Matter.World.add(world, grain);
        }

        // Start the physics engine
        Matter.Engine.run(engine);
        Matter.Render.run(render);

        // Store references
        hourglassEngine = engine;
        hourglassWorld = world;
        hourglassCanvas = canvas;
        hourglassRender = render;

        // Check for sand falling through
        checkSandFall();
    };

    const checkSandFall = () => {
        const checkInterval = setInterval(() => {
            if (!hourglassEngine) {
                clearInterval(checkInterval);
                return;
            }

            // Count sand grains in bottom chamber (y > 140)
            const bottomGrains = sandGrains.filter(grain => grain.position.y > 140);
            
            // If all grains are in bottom chamber, spawn new block and reset
            if (bottomGrains.length === sandGrains.length) {
                spawnRandomBlock();
                resetHourglass();
            }
        }, 100);
    };

    const resetHourglass = () => {
        if (!hourglassWorld) return;

        // Remove all sand grains
        sandGrains.forEach(grain => {
            Matter.World.remove(hourglassWorld, grain);
        });

        // Create new sand grains in top chamber
        const config = GAME_CONFIG[currentDifficulty];
        sandGrains = [];
        for (let i = 0; i < config.sandGrains; i++) {
            const grain = Matter.Bodies.circle(
                25 + Math.random() * 70, 
                25 + Math.random() * 40, 
                2.5, // Increased from 1.5 to 2.5
                {
                    render: { fillStyle: '#F4A460' },
                    restitution: 0.3, // Increased restitution to help particles bounce apart
                    friction: 0.3, // Reduced friction slightly
                    frictionAir: 0.01,
                    collisionFilter: {
                        group: -1 // Negative group makes particles repel each other slightly
                    },
                    chamfer: { radius: 1 } // Slight rounding for smoother collisions
                }
            );
            sandGrains.push(grain);
            Matter.World.add(hourglassWorld, grain);
        }
    };

    const destroyHourglass = () => {
        if (hourglassRender) {
            Matter.Render.stop(hourglassRender);
            hourglassRender = null;
        }
        if (hourglassEngine) {
            Matter.Engine.clear(hourglassEngine);
            hourglassEngine = null;
        }
        hourglassWorld = null;
        sandGrains = [];
    };

    const startGame = (difficulty) => {
        currentDifficulty = difficulty;
        const config = GAME_CONFIG[difficulty];
        gridSize = config.gridSize;
        
        // Clear any existing hourglass
        destroyHourglass();

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
        
        // Create hourglass timer
        setTimeout(() => {
            createHourglass(config.sandGrains);
        }, 100);

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
        // Destroy hourglass when returning to menu
        destroyHourglass();
        selectedBlockIndex = -1; // Reset selection
    }

    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            startGame(button.dataset.difficulty);
        });
    });
    
    backButton.addEventListener('click', showTitleScreen);

    // If the user clicks outside the game board area, deselect the block.
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