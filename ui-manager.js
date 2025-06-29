export class UIManager {
    constructor(elements, hourglassManager, gameState) {
        this.elements = elements;
        this.hourglassManager = hourglassManager;
        this.gameState = gameState;
    }

    showTitleScreen() {
        this.elements.titleScreen.classList.add('active');
        this.elements.gameScreen.classList.remove('active');
        this.elements.header.classList.remove('in-game');
        this.elements.gameBoard.innerHTML = '';
        this.hourglassManager.destroy();
        this.gameState.reset();
        this.elements.combinationsContainer.style.display = 'block';
    }

    showGameScreen() {
        this.elements.titleScreen.classList.remove('active');
        this.elements.gameScreen.classList.add('active');
        this.elements.header.classList.add('in-game');
    }

    updateSpawnIndicators(progress) {
        if (this.gameState.currentDifficulty === 'zen') return;
        const indicators = document.querySelectorAll('.spawn-indicator');
        indicators.forEach(indicator => {
            indicator.style.opacity = 0.2 + (progress * 0.7);
        });
    }

    async showLoading(button, loadingAction) {
        const originalText = button.textContent;
        button.textContent = 'Loading...';
        this.elements.difficultyButtons.forEach(btn => btn.disabled = true);

        try {
            await loadingAction();
        } catch (e) {
            console.error("Error during loading action:", e);
        } finally {
            button.textContent = originalText;
            this.elements.difficultyButtons.forEach(btn => btn.disabled = false);
        }
    }
}

