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
        
        // Drag state
        this.isDragging = false;
        this.dragStartItem = null;
        this.dragLine = null;
        this.dragStartPos = { x: 0, y: 0 };
        this.onMergeRequest = null; // Callback for merge requests
        
        this.init();
        
        if (this.room) {
            this.room.subscribePresence(() => this.updateCarousel());
        }

        window.addEventListener('resize', () => this.init());
        this.setupGlobalDragEvents();
    }

    setupGlobalDragEvents() {
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.handleDragMove(e.clientX, e.clientY);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                this.handleDragEnd(e.clientX, e.clientY);
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handleDragMove(touch.clientX, touch.clientY);
            }
        });

        document.addEventListener('touchend', (e) => {
            if (this.isDragging) {
                const touch = e.changedTouches[0];
                this.handleDragEnd(touch.clientX, touch.clientY);
            }
        });
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

        // Store player data on the item for drag operations
        item.playerData = playerData;

        // Add drag functionality
        this.addDragInteraction(item);

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

    addDragInteraction(item) {
        if (item.classList.contains('empty')) return;

        let dragStarted = false;
        let startTime = 0;

        // Mouse events
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            dragStarted = false;
            startTime = Date.now();
            
            const mouseMove = (moveEvent) => {
                const timeDiff = Date.now() - startTime;
                const distance = Math.sqrt(
                    Math.pow(moveEvent.clientX - e.clientX, 2) + 
                    Math.pow(moveEvent.clientY - e.clientY, 2)
                );
                
                if ((distance > 10 || timeDiff > 200) && !dragStarted) {
                    dragStarted = true;
                    this.handleDragStart(item, e.clientX, e.clientY);
                    document.removeEventListener('mousemove', mouseMove);
                    document.removeEventListener('mouseup', mouseUp);
                }
            };
            
            const mouseUp = () => {
                document.removeEventListener('mousemove', mouseMove);
                document.removeEventListener('mouseup', mouseUp);
            };
            
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('mouseup', mouseUp);
        });

        // Touch events
        item.addEventListener('touchstart', (e) => {
            e.preventDefault();
            dragStarted = false;
            startTime = Date.now();
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;
            
            const touchMove = (moveEvent) => {
                const currentTouch = moveEvent.touches[0];
                const timeDiff = Date.now() - startTime;
                const distance = Math.sqrt(
                    Math.pow(currentTouch.clientX - startX, 2) + 
                    Math.pow(currentTouch.clientY - startY, 2)
                );
                
                if ((distance > 15 || timeDiff > 250) && !dragStarted) {
                    dragStarted = true;
                    this.handleDragStart(item, startX, startY);
                    document.removeEventListener('touchmove', touchMove);
                    document.removeEventListener('touchend', touchEnd);
                }
            };
            
            const touchEnd = () => {
                document.removeEventListener('touchmove', touchMove);
                document.removeEventListener('touchend', touchEnd);
            };
            
            document.addEventListener('touchmove', touchMove);
            document.addEventListener('touchend', touchEnd);
        });
    }

    handleDragStart(item, clientX, clientY) {
        this.isDragging = true;
        this.dragStartItem = item;
        this.dragStartPos = { x: clientX, y: clientY };
        
        // Visual feedback
        item.style.opacity = '0.5';
        item.style.transform = 'scale(1.05)';
        
        this.createDragLine(this.dragStartPos, this.dragStartPos);
    }

    handleDragMove(clientX, clientY) {
        if (!this.isDragging) return;
        
        this.createDragLine(this.dragStartPos, { x: clientX, y: clientY });
    }

    handleDragEnd(clientX, clientY) {
        if (!this.isDragging) return;
        
        this.removeDragLine();
        
        // Reset visual feedback
        if (this.dragStartItem) {
            this.dragStartItem.style.opacity = '';
            this.dragStartItem.style.transform = '';
        }
        
        // Find the target carousel item
        const targetItem = this.getCarouselItemFromPosition(clientX, clientY);
        
        if (targetItem && targetItem !== this.dragStartItem && !targetItem.classList.contains('empty')) {
            // Request merge
            if (this.onMergeRequest && this.dragStartItem.playerData && targetItem.playerData) {
                this.onMergeRequest(this.dragStartItem.playerData, targetItem.playerData);
            }
        }
        
        this.isDragging = false;
        this.dragStartItem = null;
        this.dragStartPos = { x: 0, y: 0 };
    }

    getCarouselItemFromPosition(x, y) {
        const elements = document.elementsFromPoint(x, y);
        for (const element of elements) {
            if (element.classList.contains('carousel-item') && !element.classList.contains('empty')) {
                return element;
            }
        }
        return null;
    }

    createDragLine(startPos, endPos) {
        if (this.dragLine) {
            this.dragLine.remove();
        }
        
        this.dragLine = document.createElement('div');
        this.dragLine.style.position = 'fixed';
        this.dragLine.style.background = '#e74c3c';
        this.dragLine.style.height = '4px';
        this.dragLine.style.borderRadius = '2px';
        this.dragLine.style.pointerEvents = 'none';
        this.dragLine.style.zIndex = '2000';
        this.dragLine.style.transformOrigin = 'left center';
        
        const deltaX = endPos.x - startPos.x;
        const deltaY = endPos.y - startPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        this.dragLine.style.width = distance + 'px';
        this.dragLine.style.left = startPos.x + 'px';
        this.dragLine.style.top = startPos.y + 'px';
        this.dragLine.style.transform = `rotate(${angle}rad)`;
        
        document.body.appendChild(this.dragLine);
    }

    removeDragLine() {
        if (this.dragLine) {
            this.dragLine.remove();
            this.dragLine = null;
        }
    }

    getBlockColor(value) {
        const colors = [
            '#eee4da', '#ede0c8', '#f2b179', '#f59563',
            '#f67c5f', '#f65e3b', '#edcf72', '#edcc61'
        ];
        return colors[value - 1] || '#3c3a32';
    }
}