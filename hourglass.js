// Hourglass physics simulation module
export class HourglassManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.engine = null;
        this.world = null;
        this.sandGrains = [];
        this.canvas = null;
        this.render = null;
        this.checkInterval = null;
        this.onSandFallComplete = null;
        this.onProgressUpdate = null;
    }
    
    create(numGrains, onSandFallComplete, onProgressUpdate) {
        this.onSandFallComplete = onSandFallComplete;
        this.onProgressUpdate = onProgressUpdate;
        this.canvas = document.getElementById('hourglass-canvas');
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        
        // Set gravity based on difficulty
        const difficulty = this.gameState.currentDifficulty;
        if (difficulty === 'easy' || difficulty === 'zen') {
            this.engine.world.gravity.y = 0.025;
        } else if (difficulty === 'medium') {
            this.engine.world.gravity.y = 0.167;
        } else {
            this.engine.world.gravity.y = 0.233;
        }
        
        this.canvas.width = 120;
        this.canvas.height = 200;
        
        this.render = Matter.Render.create({
            canvas: this.canvas,
            engine: this.engine,
            options: {
                width: 120,
                height: 200,
                wireframes: false,
                background: 'transparent',
                showAngleIndicator: false,
                showVelocity: false
            }
        });

        this.createHourglassStructure();
        this.createSandGrains(numGrains);
        
        Matter.Engine.run(this.engine);
        Matter.Render.run(this.render);
        
        this.startSandFallCheck();
    }
    
    createHourglassStructure() {
        const wallThickness = 4;
        const centerX = 60;
        const centerY = 100;
        
        const walls = [
            // Outer walls
            Matter.Bodies.rectangle(centerX, 10, 100, wallThickness, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(centerX, 190, 100, wallThickness, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(10, centerY, wallThickness, 200, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(110, centerY, wallThickness, 200, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            // Top funnel
            Matter.Bodies.rectangle(30, 75, 60, wallThickness, { 
                isStatic: true, 
                angle: Math.PI / 6,
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(90, 75, 60, wallThickness, { 
                isStatic: true, 
                angle: -Math.PI / 6,
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            // Bottom funnel
            Matter.Bodies.rectangle(30, 125, 60, wallThickness, { 
                isStatic: true, 
                angle: -Math.PI / 6,
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(90, 125, 60, wallThickness, { 
                isStatic: true, 
                angle: Math.PI / 6,
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            // Center opening
            Matter.Bodies.rectangle(55, centerY, wallThickness, 24, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1,
                chamfer: { radius: 2 }
            }),
            Matter.Bodies.rectangle(65, centerY, wallThickness, 24, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1,
                chamfer: { radius: 2 }
            })
        ];

        Matter.World.add(this.world, walls);
    }
    
    createSandGrains(numGrains) {
        this.sandGrains = [];
        for (let i = 0; i < numGrains; i++) {
            const grain = Matter.Bodies.circle(
                25 + Math.random() * 70, 
                25 + Math.random() * 40, 
                2.5,
                {
                    render: { fillStyle: '#F4A460' },
                    restitution: 0.3,
                    friction: 0.3,
                    frictionAir: 0.01,
                    collisionFilter: { group: -1 },
                    chamfer: { radius: 1 }
                }
            );
            this.sandGrains.push(grain);
            Matter.World.add(this.world, grain);
        }
    }
    
    startSandFallCheck() {
        this.checkInterval = setInterval(() => {
            if (!this.engine) {
                clearInterval(this.checkInterval);
                return;
            }

            const bottomGrains = this.sandGrains.filter(grain => grain.position.y > 140);
            
            if (this.onProgressUpdate && this.sandGrains.length > 0) {
                const progress = bottomGrains.length / this.sandGrains.length;
                this.onProgressUpdate(progress);
            }
            
            if (bottomGrains.length === this.sandGrains.length) {
                if (this.onSandFallComplete) {
                    this.onSandFallComplete();
                }
                this.reset();
            }
        }, 100);
    }
    
    reset() {
        if (!this.world) return;

        this.sandGrains.forEach(grain => {
            Matter.World.remove(this.world, grain);
        });

        const config = this.gameState.GAME_CONFIG[this.gameState.currentDifficulty];
        this.createSandGrains(config.sandGrains);
        
        this.checkInterval = null;
    }
    
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        if (this.render) {
            Matter.Render.stop(this.render);
            this.render = null;
        }
        
        if (this.engine) {
            Matter.Engine.clear(this.engine);
            this.engine = null;
        }
        
        this.world = null;
        this.sandGrains = [];
        this.onProgressUpdate = null;
    }
}