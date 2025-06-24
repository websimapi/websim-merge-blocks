// combinations-display.js
export class CombinationsDisplay {
    constructor(gameState) {
        this.gameState = gameState;
        this.combinationsList = document.getElementById('combinations-list');
    }

    update() {
        if (!this.combinationsList) return;

        this.combinationsList.innerHTML = '';
        const combinations = this.findCombinations();
        
        if (combinations.length === 0) {
            this.combinationsList.innerHTML = '<li>No merges available!</li>';
            return;
        }

        combinations.forEach(combo => {
            const li = document.createElement('li');
            
            const part1 = this.createComboPart(combo.v1);
            const plus = document.createElement('span');
            plus.textContent = '+';
            const part2 = this.createComboPart(combo.v2);
            const arrow = document.createElement('span');
            arrow.textContent = '→';

            li.appendChild(part1);
            li.appendChild(plus);
            li.appendChild(part2);
            li.appendChild(arrow);
            
            if (combo.type === 'merge') {
                const resultPart = this.createComboPart(combo.result);
                li.appendChild(resultPart);
            } else { // split
                const resultPart1 = this.createComboPart(combo.result);
                const resultPart2 = this.createComboPart(combo.result);
                const resultContainer = document.createElement('div');
                resultContainer.style.display = 'flex';
                resultContainer.style.gap = '4px';
                resultContainer.appendChild(resultPart1);
                resultContainer.appendChild(resultPart2);
                li.appendChild(resultContainer);
            }
            
            this.combinationsList.appendChild(li);
        });
    }

    createComboPart(value) {
        const part = document.createElement('div');
        part.classList.add('combo-part', `block-${value}`);
        
        const imageUrl = this.gameState.getImageForValue(value);
        if (this.gameState.theme && imageUrl && imageUrl !== 'loading') {
            part.innerHTML = `<img src="${imageUrl}" alt="Image for ${value}">`;
        } else {
            part.textContent = value;
        }
        
        return part;
    }

    findCombinations() {
        const combinations = [];
        const { boardState, gridSize } = this.gameState;
        const checkedPairs = new Set();

        for (let i = 0; i < boardState.length; i++) {
            if (boardState[i] === 0) continue;

            const neighbors = this.getNeighborIndices(i, gridSize);

            for (const j of neighbors) {
                if (boardState[j] === 0) continue;
                
                const pairKey = i < j ? `${i}-${j}` : `${j}-${i}`;
                if (checkedPairs.has(pairKey)) continue;
                checkedPairs.add(pairKey);

                const v1 = boardState[i];
                const v2 = boardState[j];

                if (v1 === v2) {
                    combinations.push({ type: 'merge', v1, v2, result: v1 + 1 });
                } else if ((v1 + v2) % 2 === 0) {
                    combinations.push({ type: 'split', v1, v2, result: (v1 + v2) / 2 });
                }
            }
        }
        return combinations;
    }

    getNeighborIndices(index, gridSize) {
        const neighbors = [];
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;

        for (let r = -1; r <= 1; r++) {
            for (let c = -1; c <= 1; c++) {
                if (r === 0 && c === 0) continue;

                const newRow = row + r;
                const newCol = col + c;

                if (newRow >= 0 && newRow < gridSize && newCol >= 0 && newCol < gridSize) {
                    neighbors.push(newRow * gridSize + newCol);
                }
            }
        }
        return neighbors;
    }
}