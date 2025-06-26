// Main game coordinator
import { GameState } from './game-state.js';
import { HourglassManager } from './hourglass.js';
import { DragHandler } from './drag-handler.js';
import { BoardRenderer } from './board-renderer.js';
import { CombinationsDisplay } from './combinations-display.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- WEBSIM MULTIPLAYER ---
    const room = new WebsimSocket();
    await room.initialize();

    // DOM elements
    const titleScreen = document.getElementById('title-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameBoard = document.getElementById('game-board');
    const homeBtn = document.getElementById('home-btn');
    const gameOverlay = document.getElementById('game-overlay');
    const header = document.querySelector('header');
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    const themeInput = document.getElementById('theme-input');
    const combinationsContainer = document.getElementById('combinations-container');
    const otherPlayersContainer = document.getElementById('other-players-container');

    // Multiplayer UI
    const hostGameBtn = document.getElementById('host-game-btn');
    const joinGameBtn = document.getElementById('join-game-btn');
    const roomCodeInput = document.getElementById('room-code-input');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const playerList = document.getElementById('player-list');
    const startGameBtn = document.getElementById('start-game-btn');

    const levelDescriptors = [
        "a basic", "an improved", "an advanced", "a superior", "a masterful", 
        "an ultimate", "a legendary", "a mythical", "a divine", "a supreme",
        "an arch", "a celestial", "an ethereal", "an astral", "a cosmic"
    ];

    // Game modules (will be initialized later)
    let gameState, hourglassManager, dragHandler, boardRenderer, combinationsDisplay;
    let localPlayerState = {};
    let otherPlayerRenderers = {};

    function getMyPresence() {
        return room.presence[room.clientId] || {};
    }

    // --- LOBBY LOGIC ---
    hostGameBtn.addEventListener('click', async () => {
        const difficulty = document.querySelector('.difficulty-btn.selected')?.dataset.difficulty || 'easy';
        const theme = themeInput.value.trim() || null;
        
        await room.updateRoomState({
            hostId: room.clientId,
            difficulty,
            theme,
            gameStarted: false,
            blockImages: {},
        });
        
        await room.updatePresence({
            score: 0,
            boardState: null,
            nextSpawnIndices: [],
        });
        
        showLobbyScreen();
    });

    joinGameBtn.addEventListener('click', async () => {
        const code = roomCodeInput.value.trim().toUpperCase();
        if (code) {
            try {
                await room.join(code);
                await room.updatePresence({
                    score: 0,
                    boardState: null,
                    nextSpawnIndices: [],
                });
                showLobbyScreen();
            } catch (e) {
                alert("Failed to join room. Check the code and try again.");
                console.error("Join failed", e);
            }
        }
    });
    
    startGameBtn.addEventListener('click', () => {
        if (room.roomState.hostId === room.clientId) {
            room.updateRoomState({ gameStarted: true });
        }
    });

    copyCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(room.roomId).then(() => {
            copyCodeBtn.textContent = 'Copied!';
            setTimeout(() => copyCodeBtn.textContent = 'Copy', 2000);
        });
    });

    function showLobbyScreen() {
        titleScreen.classList.remove('active');
        lobbyScreen.classList.add('active');
        roomCodeDisplay.textContent = room.roomId;
        updateLobbyUI();
    }

    function updateLobbyUI() {
        if (!lobbyScreen.classList.contains('active')) return;
        
        playerList.innerHTML = '';
        for (const peerId in room.peers) {
            const peer = room.peers[peerId];
            const li = document.createElement('li');
            li.innerHTML = `<img src="${peer.avatarUrl}" alt="${peer.username}"> <span>${peer.username} ${peerId === room.roomState.hostId ? '(Host)' : ''}</span>`;
            playerList.appendChild(li);
        }

        if (room.roomState.hostId === room.clientId) {
            startGameBtn.style.display = 'block';
        } else {
            startGameBtn.style.display = 'none';
        }
    }

    // --- GAME LOGIC ---

    function initializeGameModules() {
        gameState = new GameState();
        hourglassManager = new HourglassManager(gameState);
        dragHandler = new DragHandler(gameState, gameBoard);
        combinationsDisplay = new CombinationsDisplay(gameState);
        boardRenderer = new BoardRenderer(
            gameState, 
            gameBoard, 
            dragHandler,
            handleBlockClick,
            handleEmptyCellClick
        );

        dragHandler.onIndicatorDrop = (index) => spawnEarly(index);
        dragHandler.onDragComplete = (boardChanged) => {
            if (boardChanged) {
                updateMyPresence();
            } else {
                boardRenderer.renderBlocks();
            }
        };
    }

    function startGame() {
        initializeGameModules();
        const { difficulty, theme } = room.roomState;

        const config = gameState.initializeGame(difficulty, theme, room.roomState.blockImages);
        localPlayerState = { ...getMyPresence() };

        if (room.roomState.hostId === room.clientId) {
            // Host initializes board states for everyone
            const initialPresenceUpdates = {};
            for (const peerId in room.peers) {
                const initialBoardState = new Array(gameState.gridSize * gameState.gridSize).fill(0);
                for (let i = 0; i < config.initialBlocks; i++) {
                     const emptyCells = initialBoardState.map((v, i) => v === 0 ? i : -1).filter(i => i !== -1);
                     if (emptyCells.length > 0) {
                        const randomIndex = Math.floor(Math.random() * emptyCells.length);
                        const boardIndex = emptyCells.splice(randomIndex, 1)[0];
                        initialBoardState[boardIndex] = gameState.getNewBlockValue(0);
                     }
                }
                room.updatePresenceFor(peerId, { boardState: initialBoardState });
            }
        }
        
        lobbyScreen.classList.remove('active');
        gameScreen.classList.add('active');
        header.classList.add('in-game');
        
        setTimeout(() => {
            hourglassManager.create(
                config.sandGrains, 
                spawnRandomBlock,
                updateSpawnIndicators
            );
        }, 100);
    }

    function updateMyPresence() {
        const myPresence = getMyPresence();
        myPresence.score = gameState.score;
        myPresence.boardState = gameState.boardState;
        myPresence.nextSpawnIndices = gameState.nextSpawnIndices;
        room.updatePresence(myPresence);
    }

    function prepareNextSpawn() {
        const emptyCells = gameState.getEmptyCells();
        if(emptyCells.length === 0) return;

        gameState.nextSpawnIndices = [];
        let numToSpawn = 1;
        const difficulty = gameState.currentDifficulty;

        if (difficulty === 'medium') { if (Math.random() < 0.5) numToSpawn = 2; } 
        else if (difficulty === 'hard') { numToSpawn = Math.random() < 0.5 ? 3 : 2; }
        
        const actualNumToSpawn = Math.min(numToSpawn, emptyCells.length);

        for (let i = 0; i < actualNumToSpawn; i++) {
            const randomEmptyCellIndex = Math.floor(Math.random() * emptyCells.length);
            const boardIndex = emptyCells.splice(randomEmptyCellIndex, 1)[0];
            gameState.nextSpawnIndices.push(boardIndex);
        }
        updateMyPresence();
    }

    function spawnRandomBlock() {
        const spawnIndices = [...gameState.nextSpawnIndices];

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
        prepareNextSpawn();
        updateMyPresence();
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
            boardRenderer.renderBlocks();
        }
        
        if (boardChanged) {
            updateMyPresence();
        }
    }

    function handleEmptyCellClick(clickedIndex) {
        if (dragHandler.isDragging) return;

        const isIndicatorCell = gameState.nextSpawnIndices.includes(clickedIndex);
        if (isIndicatorCell) {
            if (gameState.currentDifficulty === 'easy' || gameState.currentDifficulty === 'zen') {
                spawnEarly(clickedIndex);
            }
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
                boardRenderer.renderBlocks();
            }
        }
        
        if (boardChanged) {
            updateMyPresence();
        }
    }

    function spawnEarly(index) {
        if ((gameState.currentDifficulty !== 'easy' && gameState.currentDifficulty !== 'zen') || !gameState.nextSpawnIndices.includes(index)) {
            return;
        }
        gameState.placeBlock(index, gameState.getNewBlockValue());
        const queueIndex = gameState.nextSpawnIndices.indexOf(index);
        if (queueIndex > -1) {
            gameState.nextSpawnIndices.splice(queueIndex, 1);
        }
        updateMyPresence();
    }
    
    async function generateImageForValue(value) {
        const currentImages = room.roomState.blockImages || {};
        if (!room.roomState.theme || currentImages[value]) {
            return;
        }

        try {
            // Claim generation
            await room.updateRoomState({ blockImages: { ...currentImages, [value]: 'generating' } });
            
            // Re-check in case another player claimed it first
            if (room.roomState.blockImages[value] !== 'generating') return;

            const descriptor = levelDescriptors[value - 1] || `an evolved`;
            const result = await websim.imageGen({
                prompt: `A cute, simple icon of ${descriptor} ${room.roomState.theme}. Sticker style, on a white background. Do not include any text or numbers.`,
                transparent: false,
                aspect: "square"
            });
            await room.updateRoomState({ blockImages: { ...room.roomState.blockImages, [value]: result.url } });
        } catch (error) {
            console.error(`Failed to generate image for value ${value}:`, error);
            const revertedImages = { ...room.roomState.blockImages };
            delete revertedImages[value];
            await room.updateRoomState({ blockImages: revertedImages });
        }
    }

    function checkAllBlockImages() {
        if (!room.roomState.theme) return;
        const uniqueValues = [...new Set(gameState.boardState.filter(v => v > 0))];
        uniqueValues.forEach(value => {
            if (!room.roomState.blockImages[value]) {
                generateImageForValue(value);
            }
        });
    }

    function updateSpawnIndicators(progress) {
        const indicators = document.querySelectorAll('#game-board .spawn-indicator');
        indicators.forEach(indicator => {
            indicator.style.opacity = 0.2 + (progress * 0.7);
        });
    }
    
    function showTitleScreen() {
        room.leave();
        titleScreen.classList.add('active');
        gameScreen.classList.remove('active');
        lobbyScreen.classList.remove('active');
        header.classList.remove('in-game');
        otherPlayersContainer.innerHTML = '';
        if (hourglassManager) hourglassManager.destroy();
        gameState?.reset();
        otherPlayerRenderers = {};
    }

    // --- RENDER OTHER PLAYERS ---
    function renderOtherPlayers() {
        otherPlayersContainer.innerHTML = '';
        otherPlayerRenderers = {};

        for (const peerId in room.peers) {
            if (peerId === room.clientId) continue;

            const peer = room.peers[peerId];
            const presence = room.presence[peerId];
            if (!presence || !presence.boardState) continue;

            const container = document.createElement('div');
            container.classList.add('other-player-board');
            container.id = `player-board-container-${peerId}`;

            container.innerHTML = `
                <div class="other-player-header">
                    <img src="${peer.avatarUrl}" alt="${peer.username}">
                    <div class="other-player-info">
                        <div class="username">${peer.username}</div>
                        <div class="score">Score: <span id="score-${peerId}">${presence.score || 0}</span></div>
                    </div>
                </div>
                <div class="game-board-wrapper">
                    <div class="game-board" id="board-${peerId}"></div>
                </div>
            `;
            otherPlayersContainer.appendChild(container);
            
            const otherGameState = new GameState();
            otherGameState.initializeGame(room.roomState.difficulty, room.roomState.theme, room.roomState.blockImages);
            otherGameState.boardState = presence.boardState;

            otherPlayerRenderers[peerId] = new BoardRenderer(otherGameState, container.querySelector(`#board-${peerId}`), null, ()=>{}, ()=>{});
            otherPlayerRenderers[peerId].render();
        }
    }

    function updateOtherPlayerBoard(peerId) {
        const renderer = otherPlayerRenderers[peerId];
        const presence = room.presence[peerId];
        if (!renderer || !presence || !presence.boardState) return;

        // Update score
        const scoreSpan = document.getElementById(`score-${peerId}`);
        if (scoreSpan) scoreSpan.textContent = presence.score || 0;
        
        // Update game state for the renderer
        renderer.gameState.boardState = presence.boardState;
        renderer.gameState.nextSpawnIndices = presence.nextSpawnIndices || [];
        renderer.gameState.blockImages = room.roomState.blockImages;
        
        renderer.render();
    }

    // --- EVENT LISTENERS & SUBSCRIPTIONS ---
    room.subscribePresence((presence) => {
        updateLobbyUI();

        if (room.roomState.gameStarted) {
             const myPresence = presence[room.clientId];
             if (myPresence && myPresence.boardState && gameState) {
                // Update local game state from presence
                gameState.boardState = myPresence.boardState;
                gameState.score = myPresence.score;
                gameState.nextSpawnIndices = myPresence.nextSpawnIndices;
                
                document.getElementById('score').textContent = gameState.score;
                boardRenderer.render();
                combinationsDisplay.update();
                checkAllBlockImages();
             }

             // Update other players
             let needsFullRender = false;
             for (const peerId in room.peers) {
                 if (peerId !== room.clientId && !otherPlayerRenderers[peerId]) {
                    needsFullRender = true;
                    break;
                 }
             }

             if (needsFullRender || Object.keys(room.peers).length - 1 !== Object.keys(otherPlayerRenderers).length) {
                 renderOtherPlayers();
             } else {
                 for (const peerId in otherPlayerRenderers) {
                     updateOtherPlayerBoard(peerId);
                 }
             }
        }
    });

    room.subscribeRoomState((roomState) => {
        updateLobbyUI();
        if (roomState.gameStarted && !gameScreen.classList.contains('active')) {
            startGame();
        }
        if (gameState && roomState.blockImages) {
            gameState.blockImages = roomState.blockImages;
            boardRenderer.renderBlocks();
            combinationsDisplay.update();
             for (const peerId in otherPlayerRenderers) {
                updateOtherPlayerBoard(peerId);
             }
        }
    });
    
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            difficultyButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
        });
    });

    homeBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to quit and return to the main menu? Your score will be lost.')) {
            showTitleScreen();
        }
    });

    gameOverlay.addEventListener('click', () => {
        if(gameState) {
            gameState.deselectBlock();
            boardRenderer.renderBlocks();
        }
    });
    
    document.addEventListener('click', (event) => {
        if (gameScreen.classList.contains('active') && !gameBoard.contains(event.target) && !combinationsContainer.contains(event.target)) {
            if(gameState) {
                gameState.deselectBlock();
                boardRenderer.renderBlocks();
            }
        }
    });

    window.addEventListener('resize', () => {
        if (gameScreen.classList.contains('active')) {
            boardRenderer.render();
            for(const peerId in otherPlayerRenderers) {
                otherPlayerRenderers[peerId].render();
            }
        }
    });
});