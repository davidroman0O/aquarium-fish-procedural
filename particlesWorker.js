// Particles Web Worker
// Handles flow particles and food particle calculations

self.onmessage = function(e) {
  const { type, particles, foods, canvasWidth, canvasHeight, waterFlow, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY } = e.data;
  
  if (type === 'updateFlowParticles') {
    const result = updateFlowParticles(particles, canvasWidth, canvasHeight, waterFlow, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY);
    
    // Send updated particles back to main thread
    self.postMessage({
      type: 'flowParticlesUpdated',
      particles: result.particles,
      newParticles: result.newParticles,
      removedIndices: result.removedIndices
    });
  }
  else if (type === 'updateFood') {
    const result = updateFood(foods, canvasWidth, canvasHeight, waterFlow, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY);
    
    // Send updated food data back to main thread
    self.postMessage({
      type: 'foodUpdated',
      foods: result.foods,
      removedIndices: result.removedIndices
    });
  }
  else if (type === 'updateWaterFlow') {
    const updatedWaterFlow = updateWaterFlow(waterFlow);
    
    // Send updated water flow data back to main thread
    self.postMessage({
      type: 'waterFlowUpdated',
      waterFlow: updatedWaterFlow
    });
  }
};

// Update water flow
function updateWaterFlow(waterFlow) {
  // Clone the water flow object
  const updatedWaterFlow = { ...waterFlow };
  
  // Smoothly move toward target flow
  updatedWaterFlow.vx += (updatedWaterFlow.targetVx - updatedWaterFlow.vx) * 0.005;
  updatedWaterFlow.vy += (updatedWaterFlow.targetVy - updatedWaterFlow.vy) * 0.005;
  
  // Decide if we need a new target
  updatedWaterFlow.changeTimer--;
  if (updatedWaterFlow.changeTimer <= 0) {
    // Reduced target variation for gentler flow
    updatedWaterFlow.targetVx = (Math.random() - 0.5) * 0.05;
    updatedWaterFlow.targetVy = (Math.random() - 0.5) * 0.05;
    updatedWaterFlow.changeTimer = 200 + Math.random() * 300;
  }
  
  return updatedWaterFlow;
}

// Update flow particles
function updateFlowParticles(particles, canvasWidth, canvasHeight, waterFlow, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY) {
  const updatedParticles = [];
  const newParticles = [];
  const removedIndices = [];
  const maxFlowParticles = 80;
  
  // Add new particles if needed
  if (particles.length < maxFlowParticles && Math.random() < 0.1) {
    newParticles.push(createNewFlowParticle(canvasWidth, canvasHeight));
  }
  
  // Update existing particles
  for (let i = 0; i < particles.length; i++) {
    const particle = { ...particles[i] };
    
    // Age the particle
    particle.age++;
    
    // Simplified fading logic
    if (particle.alpha < particle.targetAlpha && particle.age < particle.lifetime * 0.7) {
      particle.alpha += particle.fadeSpeed;
      if (particle.alpha > particle.targetAlpha) particle.alpha = particle.targetAlpha;
    }
    
    // Fade out as it gets older
    if (particle.age > particle.lifetime * 0.7) {
      particle.alpha -= particle.fadeSpeed;
    }
    
    // Apply water flow with variation - simplified calculation
    particle.vx += (waterFlow.baseVx + waterFlow.vx) * particle.flowMultiplier * particle.depthFactor;
    particle.vy += (waterFlow.baseVy + waterFlow.vy) * particle.flowMultiplier * particle.depthFactor;
    
    // Apply mouse influence only for tracers to reduce calculations
    if (mouseInfluence && particle.isTracer) {
      const dx = mouseX - pmouseX;
      const dy = mouseY - pmouseY;
      const mouseVelocity = Math.sqrt(dx*dx + dy*dy);
      
      if (mouseVelocity > 0) {
        const cappedDx = dx * Math.min(1, 2/mouseVelocity);
        const cappedDy = dy * Math.min(1, 2/mouseVelocity);
        
        const mouseDist = Math.sqrt(
          (particle.x - mouseX) * (particle.x - mouseX) + 
          (particle.y - mouseY) * (particle.y - mouseY)
        );
        
        if (mouseDist < 150) {
          const influence = (1 - mouseDist / 150) * 0.001 * particle.depthFactor;
          particle.vx += cappedDx * influence;
          particle.vy += cappedDy * influence;
        }
      }
    }
    
    // Reduced random movement - less calculations
    if (Math.random() < 0.3) { // Only apply random movement 30% of the time
      particle.vx += (Math.random() - 0.5) * 0.003 * particle.depthFactor;
      particle.vy += (Math.random() - 0.5) * 0.003 * particle.depthFactor;
    }
    
    // Apply drag
    particle.vx *= 0.97;
    particle.vy *= 0.97;
    
    // Cap velocity - simplified
    const maxVel = 0.7 * particle.depthFactor;
    const currentVel = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
    if (currentVel > maxVel) {
      const scale = maxVel / currentVel;
      particle.vx *= scale;
      particle.vy *= scale;
    }
    
    // Store trail points less frequently for better performance
    if (particle.isTracer && particle.trailLength > 0 && particle.age % 2 === 0) {
      if (!particle.trail) particle.trail = [];
      particle.trail.push({x: particle.x, y: particle.y});
      // Keep trail length capped
      while (particle.trail.length > particle.trailLength) {
        particle.trail.shift();
      }
    }
    
    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;
    
    // Check if particle should be removed
    if (particle.alpha <= 0 || 
        particle.age >= particle.lifetime ||
        particle.x < -10 || 
        particle.x > canvasWidth + 10 || 
        particle.y < -10 || 
        particle.y > canvasHeight + 10) {
      
      removedIndices.push(i);
      
      // Less aggressive replacement
      if (Math.random() < 0.6) {
        newParticles.push(createNewFlowParticle(canvasWidth, canvasHeight));
      }
    } else {
      updatedParticles.push(particle);
    }
  }
  
  return {
    particles: updatedParticles,
    newParticles: newParticles,
    removedIndices: removedIndices
  };
}

// Helper function to create a new flow particle
function createNewFlowParticle(canvasWidth, canvasHeight) {
  // Simplified particle system - just two types for better performance
  const isTracer = Math.random() < 0.15; // Fewer special particles (15%)
  
  // Create particle at random position, but not too close to edges
  const margin = 50;
  return {
    x: margin + Math.random() * (canvasWidth - margin * 2),
    y: margin + Math.random() * (canvasHeight - margin * 2),
    // More uniform sizes
    size: isTracer ? 1.5 + Math.random() * 1.5 : 0.8 + Math.random() * 1,
    // Simplified colors - fewer unique color calculations
    color: isTracer 
      ? `hsla(190, 90%, 80%, ${0.3 + Math.random() * 0.2})` 
      : `hsla(185, 85%, 75%, ${0.15 + Math.random() * 0.15})`,
    vx: 0,
    vy: 0,
    // Simplified flow parameters
    flowMultiplier: 0.3 + Math.random() * 0.7,
    depthFactor: 0.6 + Math.random() * 1.2,
    // Simplified fade properties
    alpha: 0,
    targetAlpha: isTracer ? 0.4 : 0.2 + Math.random() * 0.15,
    fadeSpeed: 0.01, // Faster fade for fewer update calculations
    // Simplified glow - only tracers glow
    glow: isTracer,
    // Simplified trail system
    isTracer: isTracer,
    // Shorter trails for performance
    trailLength: isTracer ? 3 : 0,
    trail: [], // Will store previous positions
    // Fewer shape variations
    shape: isTracer ? (Math.random() > 0.5 ? 1 : 0) : 0,
    // Simpler lifetime
    lifetime: isTracer ? 400 + Math.random() * 300 : 200 + Math.random() * 300,
    age: 0
  };
}

// Update food particles
function updateFood(foods, canvasWidth, canvasHeight, waterFlow, mouseInfluence, mouseX, mouseY, pmouseX, pmouseY) {
  const updatedFoods = [];
  const removedIndices = [];
  
  for (let i = 0; i < foods.length; i++) {
    const food = { ...foods[i] };
    
    // Update scale animation with easing
    if (food.scale < food.targetScale) {
      // Use an ease-out curve for a natural popping effect
      food.scale += (food.targetScale - food.scale) * food.scaleSpeed;
      
      // Ensure we eventually reach target scale
      if (food.scale > food.targetScale * 0.98) {
        food.scale = food.targetScale;
      }
    }
    
    // Apply water resistance/drag
    food.vx *= 0.98;
    food.vy *= 0.98;
    
    // Apply base water flow with variation
    food.vx += (waterFlow.baseVx + waterFlow.vx) * food.flowMultiplier;
    food.vy += (waterFlow.baseVy + waterFlow.vy) * food.flowMultiplier;
    
    // Add some random movement to simulate particles in water
    food.vx += (Math.random() - 0.5) * 0.01; // Reduce random movement
    food.vy += (Math.random() - 0.5) * 0.01; // Reduce random movement
    
    // Add very slight mouse influence if it's moving
    if (mouseInfluence) {
      const dx = mouseX - pmouseX;
      const dy = mouseY - pmouseY;
      const mouseVelocity = Math.sqrt(dx*dx + dy*dy);
      
      if (mouseVelocity > 0) {
        // Cap the mouse velocity to prevent extremely violent movements
        const cappedDx = dx * Math.min(1, 2/mouseVelocity);
        const cappedDy = dy * Math.min(1, 2/mouseVelocity);
        
        const mouseDist = Math.sqrt(
          (food.x - mouseX) * (food.x - mouseX) + 
          (food.y - mouseY) * (food.y - mouseY)
        );
        
        if (mouseDist < 80) {
          const influence = (1 - mouseDist / 80) * 0.001;
          food.vx += cappedDx * influence;
          food.vy += cappedDy * influence;
        }
      }
    }
    
    // Cap maximum velocity to make it easier for fish to catch
    const maxVelocity = 0.7; // Maximum speed limit
    const currentVelocity = Math.sqrt(food.vx * food.vx + food.vy * food.vy);
    if (currentVelocity > maxVelocity) {
      food.vx = (food.vx / currentVelocity) * maxVelocity;
      food.vy = (food.vy / currentVelocity) * maxVelocity;
    }
    
    // Update position
    food.x += food.vx;
    food.y += food.vy;
    
    // Fade out if near edges
    const edgeDistance = Math.min(
      food.x, 
      food.y, 
      canvasWidth - food.x, 
      canvasHeight - food.y
    );
    
    if (edgeDistance < 20) {
      food.alpha -= 0.02;
    }
    
    // Remove if fully faded or off screen
    if (food.alpha <= 0 || 
        food.x < -10 || 
        food.x > canvasWidth + 10 || 
        food.y < -10 || 
        food.y > canvasHeight + 10) {
      removedIndices.push(i);
    } else {
      updatedFoods.push(food);
    }
  }
  
  return {
    foods: updatedFoods,
    removedIndices: removedIndices
  };
} 