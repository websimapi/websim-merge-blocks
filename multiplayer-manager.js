import { GameState } from './game-state.js';
import { BoardRenderer } from './board-renderer.js';

export class MultiplayerManager {
    constructor(gameState, carouselTrack, playerList) {
        this.gameState = gameState;
        this.carouselTrack = carouselTrack;
        this.playerList = playerList;
        this.room = null;
        this.peerRenderers = {};
    }

    static async create(gameState, carouselTrack, playerList) {
        const manager = new MultiplayerManager(gameState, carouselTrack, playerList);
        await manager.initialize();
        return manager;
    }
    
    async initialize() {
        this.room = new WebsimSocket();
        await this.room.initialize();
        this.room.subscribePresence(currentPresence => {
            this.updatePlayerList(currentPresence);
            this.renderPeerGames(currentPresence);
        });
    }

    updateMyPresence(extra = {}) {
        this.room.updatePresence({
            isPlaying: this.gameState.currentDifficulty !== null,
            score: this.gameState.score,
            difficulty: this.gameState.currentDifficulty,
            theme: this.gameState.theme,
            gridSize: this.gameState.gridSize,
            boardState: this.gameState.boardState,
            blockImages: this.gameState.blockImages,
            ...extra
        });
    }
    
    onGameOver() {
        this.updateMyPresence({ isPlaying: false, score: 0 });
        Object.values(this.peerRenderers).forEach(r => r.renderer.gameBoard.parentElement.remove());
        this.peerRenderers = {};
    }

    updatePlayerList(presence) {
        this.playerList.innerHTML = '';
        const sortedPlayers = Object.values(presence)
            .map(p => ({ ...p, ...this.room.peers[p.clientId] }))
            .filter(p => p.username)
            .sort((a, b) => b.score - a.score);

        sortedPlayers.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `
                <img src="${player.avatarUrl}" alt="${player.username}">
                <div class="player-info">
                    <div class="player-name">${player.username} ${player.clientId === this.room.clientId ? '(You)' : ''}</div>
                    <div class="player-score">Score: ${player.score || 0}</div>
                </div>
            `;
            this.playerList.appendChild(li);
        });
    }
    
    renderPeerGames(presence) {
        const activePeerIds = [];

        for (const clientId in presence) {
            if (clientId === this.room.clientId) continue;

            const peerData = presence[clientId];
            if (peerData.isPlaying && peerData.gridSize > 0) {
                activePeerIds.push(clientId);
                let container = document.getElementById(`peer-${clientId}`);

                if (!container) {
                    container = this.createPeerContainer(clientId, this.room.peers[clientId]);
                    this.carouselTrack.appendChild(container);
                    
                    const peerGameState = new GameState();
                    const peerBoard = container.querySelector('.peer-game-board');
                    const peerRenderer = new BoardRenderer(peerGameState, peerBoard, null, null, null, true);
                    this.peerRenderers[clientId] = { state: peerGameState, renderer: peerRenderer };
                }

                const { state, renderer } = this.peerRenderers[clientId];
                state.gridSize = peerData.gridSize;
                state.boardState = peerData.boardState;
                state.theme = peerData.theme;
                state.blockImages = peerData.blockImages || {};
                
                container.querySelector('.peer-score').textContent = `Score: ${peerData.score}`;
                renderer.render();
            } else {
                 this.removePeerGame(clientId);
            }
        }
        
        Object.keys(this.peerRenderers).forEach(clientId => {
            if (!activePeerIds.includes(clientId)) {
                this.removePeerGame(clientId);
            }
        });
    }
    
    createPeerContainer(clientId, peerInfo) {
        const container = document.createElement('div');
        container.id = `peer-${clientId}`;
        container.className = 'peer-game-container';
        container.innerHTML = `
            <div class="peer-header">
                <img src="${peerInfo?.avatarUrl || ''}" alt="${peerInfo?.username || ''}">
                <span class="peer-name">${peerInfo?.username || 'Player'}</span>
                <span class="peer-score"></span>
            </div>
            <div class="peer-game-board"></div>
        `;
        return container;
    }

    removePeerGame(clientId) {
        let container = document.getElementById(`peer-${clientId}`);
        if (container) {
            container.remove();
            delete this.peerRenderers[clientId];
        }
    }
}