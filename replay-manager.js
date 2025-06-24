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
            startTime: null
        };
        this.isReplaying = false;
    }

    startNewGame(difficulty, theme, initialBlocks) {
        this.currentReplay = {
            gameId: Date.now().toString(),
            theme: theme,
            difficulty: difficulty,
            initialState: [...initialBlocks],
            events: [],
            imageUrls: {},
            startTime: Date.now()
        };
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
            scoreGained: scoreGained
        });
    }

    recordSpawn(index, value, isEarly = false) {
        this.recordEvent('spawn', {
            index: index,
            value: value,
            isEarly: isEarly
        });
    }

    recordImageGeneration(value, url) {
        this.currentReplay.imageUrls[value] = url;
        this.recordEvent('image', {
            value: value,
            url: url
        });
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

        // Place initial blocks
        replay.initialState.forEach((value, index) => {
            if (value > 0) {
                gameState.placeBlock(index, value);
            }
        });

        boardRenderer.render();

        // Play through events with timing
        let eventIndex = 0;
        const startTime = Date.now();

        const playNextEvent = () => {
            if (eventIndex >= replay.events.length) {
                this.isReplaying = false;
                if (onReplayComplete) onReplayComplete();
                return;
            }

            const event = replay.events[eventIndex];
            const targetTime = startTime + (event.timestamp / 2); // Play at 2x speed
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
                break;
            case 'image':
                gameState.setImageForValue(event.data.value, event.data.url);
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