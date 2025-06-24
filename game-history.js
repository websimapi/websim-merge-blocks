// game-history.js
export class GameHistory {
    constructor() {
        this.history = null;
    }

    start(difficulty, theme, initialBoard, initialImages) {
        this.history = {
            version: 1,
            difficulty,
            theme,
            initialBoard: [...initialBoard],
            images: { ...initialImages },
            actions: []
        };
    }

    recordAction(action) {
        if (!this.history) return;
        this.history.actions.push(action);
    }

    recordImage(value, url) {
        if (!this.history) return;
        if (!this.history.images) {
            this.history.images = {};
        }
        this.history.images[value] = url;
    }

    getHistory() {
        return this.history;
    }

    save(key) {
        if (!this.history) return;
        try {
            localStorage.setItem(key, JSON.stringify(this.history));
        } catch (e) {
            console.error("Failed to save history to localStorage:", e);
        }
    }

    load(key) {
        try {
            const storedHistory = localStorage.getItem(key);
            if (storedHistory) {
                return JSON.parse(storedHistory);
            }
            return null;
        } catch (e) {
            console.error("Failed to load history from localStorage:", e);
            return null;
        }
    }
}