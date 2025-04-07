// Worker Controller
// This utility class manages all the web workers and their communication

class WorkerController {
    constructor() {
        // Initialize the workers
        this.fishWorker = new Worker('fishWorker.js');
        this.particlesWorker = new Worker('particlesWorker.js');
        this.eatingParticlesWorker = new Worker('eatingParticlesWorker.js');
        
        // State containers
        this.fishes = [];
        this.flowParticles = [];
        this.foods = [];
        this.eatingParticles = [];
        this.waterFlow = null;
        
        // Setup callbacks
        this.onFishesUpdated = null;
        this.onFlowParticlesUpdated = null;
        this.onFoodUpdated = null;
        this.onEatingParticlesUpdated = null;
        this.onWaterFlowUpdated = null;
        
        // Configure worker message handlers
        this._setupWorkerHandlers();
    }
    
    // Initialize worker message handlers
    _setupWorkerHandlers() {
        // Fish worker handler
        this.fishWorker.onmessage = (e) => {
            const data = e.data;
            
            if (data.type === 'fishesMoved') {
                // Store the updated fish data
                const updatedFishData = data.fishes;
                
                // We need to reconstitute the Fish objects to get methods back
                // This assumes a global Fish class is available
                for (let i = 0; i < updatedFishData.length; i++) {
                    const fishData = updatedFishData[i];
                    
                    // If we already have a fish at this index, update its properties
                    if (i < this.fishes.length) {
                        // Copy all properties from the worker data to the existing Fish object
                        Object.assign(this.fishes[i], fishData);
                    } else {
                        // Create a new Fish object if needed
                        this.fishes[i] = fishData;
                    }
                }
                
                // Call callback if registered
                if (this.onFishesUpdated) {
                    this.onFishesUpdated(this.fishes);
                }
            }
        };
        
        // Particles worker handler
        this.particlesWorker.onmessage = (e) => {
            const data = e.data;
            
            if (data.type === 'flowParticlesUpdated') {
                // Replace the flow particles array with updated particles
                this.flowParticles = data.particles;
                
                // Add any new particles
                if (data.newParticles && data.newParticles.length > 0) {
                    this.flowParticles = this.flowParticles.concat(data.newParticles);
                }
                
                // Call callback if registered
                if (this.onFlowParticlesUpdated) {
                    this.onFlowParticlesUpdated(this.flowParticles);
                }
            }
            else if (data.type === 'foodUpdated') {
                // Update foods array with calculated positions
                this.foods = data.foods;
                
                // Call callback if registered
                if (this.onFoodUpdated) {
                    this.onFoodUpdated(this.foods);
                }
            }
            else if (data.type === 'waterFlowUpdated') {
                // Update water flow properties
                this.waterFlow = data.waterFlow;
                
                // Call callback if registered
                if (this.onWaterFlowUpdated) {
                    this.onWaterFlowUpdated(this.waterFlow);
                }
            }
        };
        
        // Eating particles worker handler
        this.eatingParticlesWorker.onmessage = (e) => {
            const data = e.data;
            
            if (data.type === 'eatingParticlesUpdated') {
                // Update eating particles with calculated positions
                this.eatingParticles = data.particles;
                
                // Call callback if registered
                if (this.onEatingParticlesUpdated) {
                    this.onEatingParticlesUpdated(this.eatingParticles);
                }
            }
            else if (data.type === 'eatingEffectCreated') {
                // Add new eating effect particles
                this.eatingParticles = this.eatingParticles.concat(data.newParticles);
                
                // Call callback if registered
                if (this.onEatingParticlesUpdated) {
                    this.onEatingParticlesUpdated(this.eatingParticles);
                }
            }
        };
    }
    
    // Update fish positions and behavior
    updateFishes(canvasWidth, canvasHeight, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY) {
        this.fishWorker.postMessage({
            type: 'updateFishes',
            fishes: this.fishes,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            waterFlow: this.waterFlow,
            foods: this.foods,
            mouseInfluence: mouseInfluence,
            mouseX: mouseX,
            mouseY: mouseY,
            pmouseX: pmouseX,
            pmouseY: pmouseY
        });
    }
    
    // Update water flow and flow particles
    updateFlowParticles(canvasWidth, canvasHeight, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY) {
        // First update water flow
        this.particlesWorker.postMessage({
            type: 'updateWaterFlow',
            waterFlow: this.waterFlow
        });
        
        // Then update flow particles
        this.particlesWorker.postMessage({
            type: 'updateFlowParticles',
            particles: this.flowParticles,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            waterFlow: this.waterFlow,
            mouseInfluence: mouseInfluence,
            mouseX: mouseX,
            mouseY: mouseY,
            pmouseX: pmouseX,
            pmouseY: pmouseY
        });
    }
    
    // Update food particles
    updateFood(canvasWidth, canvasHeight, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY) {
        this.particlesWorker.postMessage({
            type: 'updateFood',
            foods: this.foods,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            waterFlow: this.waterFlow,
            mouseInfluence: mouseInfluence,
            mouseX: mouseX,
            mouseY: mouseY,
            pmouseX: pmouseX,
            pmouseY: pmouseY
        });
    }
    
    // Update eating effect particles
    updateEatingParticles(canvasWidth, canvasHeight) {
        this.eatingParticlesWorker.postMessage({
            type: 'updateEatingParticles',
            particles: this.eatingParticles,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight
        });
    }
    
    // Create an eating effect
    createEatingEffect(x, y, color) {
        this.eatingParticlesWorker.postMessage({
            type: 'createEatingEffect',
            x: x,
            y: y,
            color: color
        });
    }
    
    // Helper to set initial fish
    setFishes(fishes) {
        this.fishes = fishes;
    }
    
    // Helper to set initial flow particles
    setFlowParticles(particles) {
        this.flowParticles = particles;
    }
    
    // Helper to set initial foods
    setFoods(foods) {
        this.foods = foods;
    }
    
    // Helper to set initial water flow
    setWaterFlow(waterFlow) {
        this.waterFlow = waterFlow;
    }
    
    // Add a single food pellet
    addFood(food) {
        this.foods.push(food);
    }
    
    // Add multiple foods
    addFoods(foodsToAdd) {
        this.foods = this.foods.concat(foodsToAdd);
    }
    
    // Remove a food item by index
    removeFood(index) {
        if (index >= 0 && index < this.foods.length) {
            this.foods.splice(index, 1);
        }
    }
    
    // Add a single fish
    addFish(fish) {
        this.fishes.push(fish);
    }
    
    // Get current states
    getFishes() { return this.fishes; }
    getFlowParticles() { return this.flowParticles; }
    getFoods() { return this.foods; }
    getEatingParticles() { return this.eatingParticles; }
    getWaterFlow() { return this.waterFlow; }
} 