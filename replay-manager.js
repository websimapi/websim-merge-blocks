// Replay system for tracking and replaying game events
export class ReplayManager {
    constructor() {
        this.currentReplay = {
            gameId: null,
            theme: null,
            difficulty: null,
            initialState: null,
            events: [],
            imageUrls: {},
            startTime: null,
            gridSize: null
        };
        this.isReplaying = false;
        this.gameState = null; // Reference to game state for accurate tracking
    }

    startNewGame(difficulty, theme, initialBlocks) {
        this.currentReplay = {
            gameId: Date.now().toString(),
            theme: theme,
            difficulty: difficulty,
            initialState: new Array(initialBlocks.length).fill(0), // Start with empty board
            events: [],
            imageUrls: {},
            startTime: Date.now(),
            gridSize: null
        };
        
        // Record initial block placements as events
        initialBlocks.forEach((value, index) => {
            if (value > 0) {
                this.recordEvent('initial_spawn', {
                    index: index,
                    value: value
                });
            }
        });
    }

    recordEvent(type, data) {
        if (this.isReplaying) return;
        
        const event = {
            type: type,
            data: data,
            timestamp: Date.now() - this.currentReplay.startTime
        };
        this.currentReplay.events.push(event);
        this.saveToStorage();
    }

    recordMove(moveType, fromIndex, toIndex, fromValue, toValue, resultValue, scoreGained) {
        this.recordEvent('move', {
            moveType: moveType, // 'merge', 'split', 'relocate'
            fromIndex: fromIndex,
            toIndex: toIndex,
            fromValue: fromValue,
            toValue: toValue,
            resultValue: resultValue,
            scoreGained: scoreGained,
            boardStateAfter: [...this.gameState?.boardState] // Capture full board state after move
        });
    }

    recordSpawn(index, value, isEarly = false) {
        this.recordEvent('spawn', {
            index: index,
            value: value,
            isEarly: isEarly,
            boardStateAfter: [...this.gameState?.boardState] // Capture full board state after spawn
        });
    }

    recordImageGeneration(value, url) {
        this.currentReplay.imageUrls[value] = url;
        this.recordEvent('image', {
            value: value,
            url: url
        });
    }

    finalizeGame(finalScore) {
        this.recordEvent('game_end', {
            finalScore: finalScore,
            finalBoardState: [...this.gameState?.boardState]
        });
        this.currentReplay.finalScore = finalScore;
        this.saveToStorage();
    }

    saveToStorage() {
        try {
            localStorage.setItem('mergeBlocksReplay', JSON.stringify(this.currentReplay));
        } catch (e) {
            console.error('Failed to save replay to localStorage:', e);
        }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('mergeBlocksReplay');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('Failed to load replay from localStorage:', e);
            return null;
        }
    }

    getStoredImageUrls() {
        const replay = this.loadFromStorage();
        return replay ? replay.imageUrls : {};
    }

    async playReplay(gameState, boardRenderer, onReplayComplete) {
        const replay = this.loadFromStorage();
        if (!replay) {
            console.error('No replay data found');
            return;
        }

        this.isReplaying = true;
        
        // Reset game state to initial conditions
        gameState.initializeGame(replay.difficulty, replay.theme);
        gameState.blockImages = { ...replay.imageUrls };
        gameState.score = 0; // Reset score
        
        // Start with completely empty board
        gameState.boardState = new Array(gameState.gridSize * gameState.gridSize).fill(0);

        boardRenderer.render();

        // Play through events with timing
        let eventIndex = 0;
        const startTime = Date.now();
        const playbackSpeed = 3; // 3x speed

        const playNextEvent = () => {
            if (eventIndex >= replay.events.length) {
                this.isReplaying = false;
                if (onReplayComplete) onReplayComplete();
                return;
            }

            const event = replay.events[eventIndex];
            const targetTime = startTime + (event.timestamp / playbackSpeed);
            const currentTime = Date.now();

            if (currentTime >= targetTime) {
                this.executeReplayEvent(event, gameState, boardRenderer);
                eventIndex++;
            }

            requestAnimationFrame(playNextEvent);
        };

        playNextEvent();
    }

    executeReplayEvent(event, gameState, boardRenderer) {
        switch (event.type) {
            case 'initial_spawn':
                gameState.placeBlock(event.data.index, event.data.value);
                break;
            case 'spawn':
                gameState.placeBlock(event.data.index, event.data.value);
                break;
            case 'move':
                const { moveType, fromIndex, toIndex, fromValue, toValue, resultValue, scoreGained } = event.data;
                if (moveType === 'merge') {
                    gameState.placeBlock(toIndex, resultValue);
                    gameState.removeBlock(fromIndex);
                } else if (moveType === 'split') {
                    gameState.placeBlock(fromIndex, resultValue);
                    gameState.placeBlock(toIndex, resultValue);
                } else if (moveType === 'relocate') {
                    gameState.placeBlock(toIndex, fromValue);
                    gameState.removeBlock(fromIndex);
                }
                gameState.updateScore(scoreGained);
                
                // Verify board state matches recorded state (for debugging)
                if (event.data.boardStateAfter) {
                    const currentState = JSON.stringify(gameState.boardState);
                    const expectedState = JSON.stringify(event.data.boardStateAfter);
                    if (currentState !== expectedState) {
                        console.warn('Board state mismatch during replay', {
                            expected: event.data.boardStateAfter,
                            actual: gameState.boardState
                        });
                    }
                }
                break;
            case 'image':
                gameState.setImageForValue(event.data.value, event.data.url);
                break;
            case 'game_end':
                console.log('Game ended with score:', event.data.finalScore);
                break;
        }
        boardRenderer.renderBlocks();
    }

    clearReplay() {
        try {
            localStorage.removeItem('mergeBlocksReplay');
        } catch (e) {
            console.error('Failed to clear replay from localStorage:', e);
        }
    }
}