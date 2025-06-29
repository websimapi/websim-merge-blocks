const levelDescriptors = [
    "a basic", "an improved", "an advanced", "a superior", "a masterful", 
    "an ultimate", "a legendary", "a mythical", "a divine", "a supreme",
    "an arch", "a celestial", "an ethereal", "an astral", "a cosmic"
];

export class ImageManager {
    constructor(gameState, boardRenderer, combinationsDisplay) {
        this.gameState = gameState;
        this.boardRenderer = boardRenderer;
        this.combinationsDisplay = combinationsDisplay;
    }

    async preloadInitialImages(theme) {
        this.gameState.theme = theme;
        this.gameState.blockImages = {};

        await Promise.allSettled([
            this.generateImageForValue(1),
            this.generateImageForValue(2)
        ]);
    }

    async generateImageForValue(value) {
        if (!this.gameState.theme || this.gameState.getImageForValue(value)) {
            return;
        }

        this.gameState.setImageForValue(value, 'loading');
        this.boardRenderer.renderBlocks();

        try {
            const descriptor = levelDescriptors[value - 1] || `an evolved`;
            const result = await websim.imageGen({
                prompt: `A cute, simple icon of ${descriptor} ${this.gameState.theme}. Sticker style, on a white background. Do not include any text or numbers.`,
                transparent: false,
                aspect: "square"
            });
            this.gameState.setImageForValue(value, result.url);
        } catch (error) {
            console.error(`Failed to generate image for value ${value}:`, error);
            this.gameState.setImageForValue(value, null);
        }

        this.boardRenderer.renderBlocks();
        this.combinationsDisplay.update();
    }

    manageBlockImages() {
        if (!this.gameState.theme) return;

        const uniqueValues = [...new Set(Object.values(this.gameState.boardState).filter(v => v > 0))];
        
        uniqueValues.forEach(value => {
            if (!this.gameState.getImageForValue(value)) {
                this.generateImageForValue(value);
            }
        });

        if (uniqueValues.length > 0) {
            const maxVal = Math.max(...uniqueValues);
            const nextVals = [maxVal + 1, maxVal + 2];
            nextVals.forEach(val => {
                if (levelDescriptors[val - 1] && !this.gameState.getImageForValue(val)) {
                    this.generateImageForValue(val);
                }
            });
        }
    }
}