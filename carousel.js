// carousel.js
export class Carousel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Carousel container not found');
            return;
        }
        this.totalSlots = 12;
        this.activePlayers = 5; // Simulate a number of "active games"
        this.blockColors = [
            '#eee4da', '#ede0c8', '#f2b179', '#f59563',
            '#f67c5f', '#f65e3b', '#edcf72', '#edcc61'
        ];
        this.init();
    }

    init() {
        const slots = this.generateSlots();
        slots.forEach(slot => this.container.appendChild(slot));
        // Clone for seamless scrolling
        slots.forEach(slot => this.container.appendChild(slot.cloneNode(true)));
    }

    generateSlots() {
        const slots = [];
        const playerIndices = this.distributePlayers();

        for (let i = 0; i < this.totalSlots; i++) {
            const isPlayerSlot = playerIndices.includes(i);
            slots.push(this.createCarouselItem(isPlayerSlot));
        }
        return slots;
    }

    distributePlayers() {
        const indices = new Set();
        if (this.activePlayers >= this.totalSlots) {
            return Array.from({ length: this.totalSlots }, (_, i) => i);
        }
        while (indices.size < this.activePlayers) {
            indices.add(Math.floor(Math.random() * this.totalSlots));
        }
        return Array.from(indices);
    }

    createCarouselItem(isPlayer) {
        const item = document.createElement('div');
        item.classList.add('carousel-item');
        
        if (!isPlayer) {
            item.classList.add('empty');
            return item;
        }

        const gridSize = 4;
        item.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
        item.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

        let hasPulsingCell = false;

        for (let i = 0; i < gridSize * gridSize; i++) {
            const cell = document.createElement('div');
            cell.classList.add('carousel-cell');
            
            // Populate some cells with blocks
            if (Math.random() > 0.5) {
                const value = Math.floor(Math.random() * 4) + 1;
                cell.textContent = value;
                cell.style.backgroundColor = this.blockColors[value-1] || '#3c3a32';
                if (value < 3) {
                    cell.style.color = '#776e65';
                }
                 // Add a pulsing animation to one block per item
                if (!hasPulsingCell && Math.random() > 0.7) {
                    cell.classList.add('pulsing');
                    hasPulsingCell = true;
                }
            }
            item.appendChild(cell);
        }
        return item;
    }
}