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
        this.room = new WebsimSocket();
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

    async saveReplay() {
        try {
            // Calculate final score from replay events
            let finalScore = 0;
            this.currentReplay.events.forEach(event => {
                if (event.type === 'move' && event.data.scoreGained) {
                    finalScore += event.data.scoreGained;
                }
            });

            const replayRecord = await this.room.collection('replay').create({
                gameId: this.currentReplay.gameId,
                theme: this.currentReplay.theme || 'Blocks',
                difficulty: this.currentReplay.difficulty,
                finalScore: finalScore,
                events: JSON.stringify(this.currentReplay.events),
                imageUrls: JSON.stringify(this.currentReplay.imageUrls),
                startTime: this.currentReplay.startTime,
                gridSize: this.currentReplay.gridSize || this.gameState?.gridSize
            });
            
            console.log('Replay saved to database:', replayRecord);
        } catch (e) {
            console.error('Failed to save replay to database:', e);
        }
    }

    async getAllReplays() {
        try {
            return this.room.collection('replay').getList();
        } catch (e) {
            console.error('Failed to load replays from database:', e);
            return [];
        }
    }

    subscribeToReplays(callback) {
        return this.room.collection('replay').subscribe(callback);
    }

    async playReplay(replayRecord, gameState, boardRenderer, onReplayComplete) {
        if (!replayRecord) {
            console.error('No replay record provided');
            return;
        }

        this.isReplaying = true;
        
        // Parse replay data
        const events = JSON.parse(replayRecord.events);
        const imageUrls = JSON.parse(replayRecord.imageUrls);
        
        // Reset game state to initial conditions
        gameState.initializeGame(replayRecord.difficulty, replayRecord.theme);
        gameState.blockImages = { ...imageUrls };
        gameState.score = 0; // Reset score
        
        // Start with completely empty board
        gameState.boardState = new Array(gameState.gridSize * gameState.gridSize).fill(0);

        boardRenderer.render();

        // Play through events with timing
        let eventIndex = 0;
        const startTime = Date.now();
        const playbackSpeed = 3; // 3x speed

        const playNextEvent = () => {
            if (eventIndex >= events.length) {
                this.isReplaying = false;
                if (onReplayComplete) onReplayComplete();
                return;
            }

            const event = events[eventIndex];
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
        }
        boardRenderer.renderBlocks();
    }

    getStoredImageUrls(replayRecord) {
        if (!replayRecord) return {};
        try {
            return JSON.parse(replayRecord.imageUrls);
        } catch (e) {
            console.error('Failed to parse imageUrls from replay:', e);
            return {};
        }
    }

    clearReplay() {
        try {
            localStorage.removeItem('mergeBlocksReplay');
        } catch (e) {
            console.error('Failed to clear replay from localStorage:', e);
        }
    }
}