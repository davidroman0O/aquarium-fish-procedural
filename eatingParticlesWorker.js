// Eating Particles Web Worker
// Handles calculations for the eating effect particles

self.onmessage = function(e) {
  const { type, particles, canvasWidth, canvasHeight } = e.data;
  
  if (type === 'updateEatingParticles') {
    const result = updateEatingParticles(particles, canvasWidth, canvasHeight);
    
    // Send updated particles back to main thread
    self.postMessage({
      type: 'eatingParticlesUpdated',
      particles: result.particles,
      removedIndices: result.removedIndices
    });
  }
  else if (type === 'createEatingEffect') {
    const { x, y, color } = e.data;
    const newParticles = createEatingEffect(x, y, color);
    
    // Send new particles back to main thread
    self.postMessage({
      type: 'eatingEffectCreated',
      newParticles: newParticles
    });
  }
};

// Create eating effect particles
function createEatingEffect(x, y, color) {
  const particles = [];
  
  // Create a burst of particles
  const particleCount = 6 + Math.floor(Math.random() * 4); // 6-9 particles
  
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.2 + Math.random() * 0.6;
    
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1 + Math.random() * 1.5,
      color: color,
      alpha: 1.0,
      // Add a slight upward drift (bubbles rise)
      drift: 0.01 + Math.random() * 0.03,
      // Each particle lives for a slightly different time
      life: 30 + Math.random() * 20
    });
  }
  
  return particles;
}

// Update eating effect particles
function updateEatingParticles(particles, canvasWidth, canvasHeight) {
  const updatedParticles = [];
  const removedIndices = [];
  
  for (let i = 0; i < particles.length; i++) {
    const particle = { ...particles[i] };
    
    // Move the particle
    particle.x += particle.vx;
    particle.y += particle.vy - particle.drift; // Apply upward drift
    
    // Slow down
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    
    // Reduce life and fade out
    particle.life--;
    if (particle.life < 15) {
      particle.alpha = particle.life / 15;
    }
    
    // Check if particle should be removed
    if (particle.life <= 0 ||
        particle.x < -10 || 
        particle.x > canvasWidth + 10 || 
        particle.y < -10 || 
        particle.y > canvasHeight + 10) {
      removedIndices.push(i);
    } else {
      updatedParticles.push(particle);
    }
  }
  
  return {
    particles: updatedParticles,
    removedIndices: removedIndices
  };
} 