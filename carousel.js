// carousel.js
export class Carousel {
    constructor(containerId, room) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Carousel container not found');
            return;
        }
        this.wrapper = this.container.parentElement;
        this.room = room;
        this.totalSlots = 0; // Will be calculated dynamically
        
        this.init();
        
        if (this.room) {
            this.room.subscribePresence(() => this.updateCarousel());
        }

        window.addEventListener('resize', () => this.init());
    }

    init() {
        this.calculateTotalSlots();
        this.updateCarousel();
    }

    calculateTotalSlots() {
        if (!this.wrapper) return;

        const itemWidth = 220; // from .carousel-item --carousel-item-size
        const itemGap = 30; // from .carousel-item --carousel-gap
        const effectiveItemWidth = itemWidth + itemGap;

        const wrapperWidth = this.wrapper.clientWidth;

        // Calculate how many items are needed to fill the screen, plus one extra
        // to ensure the scroll effect is seamless.
        const slotsNeeded = Math.ceil(wrapperWidth / effectiveItemWidth) + 1;

        // Set a minimum number of slots to ensure the carousel doesn't look too empty
        // on very small screens, based on the user's suggestion.
        this.totalSlots = Math.max(5, slotsNeeded);
    }

    updateCarousel() {
        const players = Object.values(this.room.presence || {})
            .filter(p => p.inGame && p.boardState && p.boardState.length > 0 && p.gridSize);
        
        const slots = this.generateSlots(players);

        this.container.innerHTML = '';
        slots.forEach(slot => this.container.appendChild(slot));

        // Clone for seamless scrolling, only if there's content
        if (slots.length > 0) {
            slots.forEach(slot => this.container.appendChild(slot.cloneNode(true)));
        }
    }
    
    generateSlots(players) {
        const slots = [];
        const numPlayers = players.length;

        if (numPlayers === 0) {
            // If no players, create empty placeholder slots
            for (let i = 0; i < this.totalSlots; i++) {
                slots.push(this.createCarouselItem(null));
            }
            return slots;
        }
        
        // Distribute players across the total slots
        const slotsPerPlayer = Math.max(1, Math.floor(this.totalSlots / numPlayers));
        
        for (let i = 0; i < numPlayers; i++) {
            slots.push(this.createCarouselItem(players[i]));
            // Add empty slots for spacing, but don't exceed total slots
            for (let j = 0; j < slotsPerPlayer - 1 && slots.length < this.totalSlots; j++) {
                slots.push(this.createCarouselItem(null));
            }
        }
        
        // Fill remaining slots if any
        while (slots.length < this.totalSlots) {
             slots.push(this.createCarouselItem(null));
        }

        return slots;
    }

    createCarouselItem(playerData) {
        const item = document.createElement('div');
        item.classList.add('carousel-item');
        
        if (!playerData) {
            item.classList.add('empty');
            return item;
        }

        const { gridSize, boardState, theme, blockImages } = playerData;
        
        if (!gridSize || !boardState || boardState.length !== gridSize * gridSize) {
            item.classList.add('empty');
            return item;
        }
        
        item.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
        item.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

        for (let i = 0; i < boardState.length; i++) {
            const cell = document.createElement('div');
            cell.classList.add('carousel-cell');
            
            const value = boardState[i];
            if (value > 0) {
                const imageUrl = (blockImages || {})[value];
                if (theme && imageUrl && imageUrl !== 'loading') {
                     cell.innerHTML = `<img src="${imageUrl}" alt="Image for ${value}">`;
                } else {
                    cell.textContent = value;
                    cell.style.backgroundColor = this.getBlockColor(value);
                    if (value < 3) {
                        cell.style.color = '#776e65';
                    }
                }
            }
            item.appendChild(cell);
        }
        return item;
    }

    getBlockColor(value) {
        const colors = [
            '#eee4da', '#ede0c8', '#f2b179', '#f59563',
            '#f67c5f', '#f65e3b', '#edcf72', '#edcc61'
        ];
        return colors[value - 1] || '#3c3a32';
    }
}