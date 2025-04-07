// Fish Web Worker
// Handles fish movement calculations and physics

self.onmessage = function(e) {
  const { type, fishes, canvasWidth, canvasHeight, waterFlow, foods, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY } = e.data;
  
  if (type === 'updateFishes') {
    // Update all fish positions, states, and spine points
    const updatedFishes = updateAllFish(fishes, canvasWidth, canvasHeight, waterFlow, foods, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY);
    
    // Send the updated fish data back to the main thread
    self.postMessage({
      type: 'fishesMoved',
      fishes: updatedFishes
    });
  }
};

// Update all fish (main calculation function)
function updateAllFish(fishes, canvasWidth, canvasHeight, waterFlow, foods, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY) {
  const updatedFishes = [];
  
  // Process each fish
  for (const fish of fishes) {
    // Make a copy of the fish object to work with
    const updatedFish = { ...fish };
    
    // Update swimming animation
    updatedFish.swimPhase += updatedFish.swimSpeed * updatedFish.energy;
    updatedFish.pulsePhase += updatedFish.pulseSpeed;
    
    // Gradually decrease energy if not feeding
    updatedFish.energy = Math.max(0.5, updatedFish.energy - 0.0001);
    
    // Hunger system
    updatedFish.timeToNextHunger--;
    if (updatedFish.timeToNextHunger <= 0) {
      updatedFish.hungry = true;
      updatedFish.timeToNextHunger = 500 + Math.random() * 1000;
    }
    
    // Decrease target change timer
    updatedFish.targetChangeTimer--;
    
    // If timer expired, update target
    if (updatedFish.targetChangeTimer <= 0) {
      updatedFish.targetChangeTimer = 0;
      // Update target is handled in a separate function
      const newTarget = updateFishTarget(updatedFish, foods, canvasWidth, canvasHeight);
      updatedFish.targetX = newTarget.targetX;
      updatedFish.targetY = newTarget.targetY;
      updatedFish.targetChangeTimer = newTarget.targetChangeTimer;
    }
    
    // Check if we can eat something
    const foodResult = checkForFood(updatedFish, foods);
    if (foodResult.ateFood) {
      updatedFish.energy = foodResult.energy;
      updatedFish.hungry = foodResult.hungry;
      updatedFish.targetChangeTimer = foodResult.targetChangeTimer;
      updatedFish.eatEffectTime = foodResult.eatEffectTime;
    }
    
    // Adjust direction toward target
    const dx = updatedFish.targetX - updatedFish.x;
    const dy = updatedFish.targetY - updatedFish.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate target angle
    let targetAngle = Math.atan2(dy, dx);
    
    // Process turning
    let angleDiff = normalizeAngle(targetAngle - updatedFish.angle);
    
    if (angleDiff > 0.1) {
      updatedFish.angle += updatedFish.turnSpeed * updatedFish.energy;
      updatedFish.turnDirection = 1;
      
      // Handle direction counter and commit move logic
      if (updatedFish.directionCounter > 0) {
        updatedFish.directionCounter++;
        if (updatedFish.directionCounter > 2 * updatedFish.commitMax) {
          updatedFish.commitMove = 1 + Math.floor(updatedFish.commitMax / 3);
          updatedFish.directionCounter = 0;
        }
      } else {
        updatedFish.directionCounter = 1;
      }
    } else if (angleDiff < -0.1) {
      updatedFish.angle -= updatedFish.turnSpeed * updatedFish.energy;
      updatedFish.turnDirection = -1;
      
      // Handle direction counter and commit move logic
      if (updatedFish.directionCounter < 0) {
        updatedFish.directionCounter--;
        if (updatedFish.directionCounter < -2 * updatedFish.commitMax) {
          updatedFish.commitMove = -1 - Math.floor(updatedFish.commitMax / 3);
          updatedFish.directionCounter = 0;
        }
      } else {
        updatedFish.directionCounter = -1;
      }
    } else {
      // Close enough to target angle, apply small correction
      updatedFish.angle += angleDiff * updatedFish.turnSpeed * 0.5;
      updatedFish.turnDirection = 0;
    }
    
    // Calculate target velocity with proper acceleration
    updatedFish.targetVx = Math.cos(updatedFish.angle) * updatedFish.velocity * updatedFish.energy;
    updatedFish.targetVy = Math.sin(updatedFish.angle) * updatedFish.velocity * updatedFish.energy;
    
    // Smoothly apply acceleration
    updatedFish.vx += (updatedFish.targetVx - updatedFish.vx) * updatedFish.turnAcceleration;
    updatedFish.vy += (updatedFish.targetVy - updatedFish.vy) * updatedFish.turnAcceleration;
    
    // Move the fish
    updatedFish.x += updatedFish.vx;
    updatedFish.y += updatedFish.vy;
    
    // Screen wrapping
    if (updatedFish.x < -updatedFish.length) updatedFish.x = canvasWidth + updatedFish.length;
    if (updatedFish.x > canvasWidth + updatedFish.length) updatedFish.x = -updatedFish.length;
    if (updatedFish.y < -updatedFish.length) updatedFish.y = canvasHeight + updatedFish.length;
    if (updatedFish.y > canvasHeight + updatedFish.length) updatedFish.y = -updatedFish.length;
    
    // Update spine points 
    updatedFish.spinePoints = updateFishSpine(updatedFish);
    
    // Decrease eat effect timer if active
    if (updatedFish.eatEffectTime > 0) {
      updatedFish.eatEffectTime--;
    }
    
    // Add the updated fish to our list
    updatedFishes.push(updatedFish);
  }
  
  return updatedFishes;
}

// Helper function to check if fish can eat nearby food
function checkForFood(fish, foods) {
  const result = {
    ateFood: false,
    energy: fish.energy,
    hungry: fish.hungry,
    targetChangeTimer: fish.targetChangeTimer,
    eatEffectTime: fish.eatEffectTime,
    eatenFoodIndex: -1,
    eatenFoodPos: null
  };
  
  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    const dx = food.x - fish.x;
    const dy = food.y - fish.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // If close enough to eat
    if (dist < fish.width) {
      // Consume food and gain energy
      result.energy = Math.min(1.0, fish.energy + food.energy/100);
      result.hungry = false;
      result.targetChangeTimer = 0;
      
      // Trigger eating animation effect
      result.eatEffectTime = fish.maxEatEffectTime;
      result.ateFood = true;
      result.eatenFoodIndex = i;
      result.eatenFoodPos = { x: food.x, y: food.y, color: food.color };
      
      break;
    }
  }
  
  return result;
}

// Helper function to update fish target
function updateFishTarget(fish, foods, canvasWidth, canvasHeight) {
  const result = {
    targetX: fish.targetX,
    targetY: fish.targetY,
    targetChangeTimer: 100 + Math.random() * 200
  };
  
  // Check for food if hungry
  if (fish.hungry && foods.length > 0) {
    let closest = Infinity;
    let closestFood = null;
    
    for (const food of foods) {
      const dx = food.x - fish.x;
      const dy = food.y - fish.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < closest && dist < 300) {
        closest = dist;
        closestFood = food;
      }
    }
    
    if (closestFood) {
      result.targetX = closestFood.x;
      result.targetY = closestFood.y;
      return result;
    }
  }
  
  // If not targeting food, choose a new wandering target
  // Choose a new target with smooth wandering
  const newWanderAngle = fish.wanderAngle + (Math.random() - 0.5) * 0.3;
  
  // Center of canvas plus wander offset
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const wanderRadius = Math.min(canvasWidth, canvasHeight) * 0.3;
  
  result.targetX = centerX + Math.cos(newWanderAngle) * wanderRadius;
  result.targetY = centerY + Math.sin(newWanderAngle) * wanderRadius;
  
  // Add some randomness
  result.targetX += (Math.random() - 0.5) * 200;
  result.targetY += (Math.random() - 0.5) * 200;
  
  // Keep within screen bounds
  const margin = 100;
  result.targetX = Math.max(margin, Math.min(canvasWidth - margin, result.targetX));
  result.targetY = Math.max(margin, Math.min(canvasHeight - margin, result.targetY));
  
  return result;
}

// Helper function to update fish spine points
function updateFishSpine(fish) {
  const newSpinePoints = [];
  
  // Update first spine point to fish position
  newSpinePoints[0] = {
    x: fish.x,
    y: fish.y,
    angle: fish.angle
  };
  
  // Copy existing spine points to work with
  const spinePoints = [...fish.spinePoints];
  
  // Update remaining spine points with delay
  for (let i = 1; i < spinePoints.length; i++) {
    const prev = i === 1 ? newSpinePoints[0] : newSpinePoints[i-1];
    const curr = { ...spinePoints[i] };
    
    // Distance between spine points
    const segmentLength = fish.length / (spinePoints.length - 1);
    
    // Calculate target angle with swim wiggle (stronger when turning)
    const turnFactor = Math.abs(fish.turnDirection) * 1.5;
    const swimWiggle = Math.sin(fish.swimPhase - i * 0.3) * 
                      fish.swimAmplitude * 
                      (i / spinePoints.length) * 
                      (1 + turnFactor);
    
    const targetAngle = prev.angle + swimWiggle;
    
    // Smooth angle transition
    curr.angle = curr.angle + (targetAngle - curr.angle) * 0.2;
    
    // Calculate new position based on angle and distance
    curr.x = prev.x - Math.cos(curr.angle) * segmentLength;
    curr.y = prev.y - Math.sin(curr.angle) * segmentLength;
    
    newSpinePoints.push(curr);
  }
  
  return newSpinePoints;
}

// Helper function to normalize angle to [-π, π]
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
} 