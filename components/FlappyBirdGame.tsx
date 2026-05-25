'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  CircleHelp, 
  Sparkles, 
  Trophy, 
  Activity, 
  Gamepad2, 
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ============================================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================================

type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'zen';

type GameTheme = 'classic' | 'neon' | 'space';

interface BirdSkin {
  id: string;
  name: string;
  color: string;
  accentColor: string;
  description: string;
  particleColor: string;
}

const BIRD_SKINS: BirdSkin[] = [
  { id: 'classic', name: 'Classic Pip', color: '#f7d02c', accentColor: '#e57373', description: 'Retro golden-yellow feathers with a cute red bill.', particleColor: 'rgba(247, 208, 44, 0.6)' },
  { id: 'cyber', name: 'Neon Visor', color: '#06b6d4', accentColor: '#ec4899', description: 'Chromes, cyan visor, and pink laser wings.', particleColor: 'rgba(6, 182, 212, 0.7)' },
  { id: 'phoenix', name: 'Sol Phoenix', color: '#ef4444', accentColor: '#eab308', description: 'Glows with solar fire. Emits ember sparks.', particleColor: 'rgba(239, 68, 68, 0.8)' },
  { id: 'phantom', name: 'Void Spec', color: '#8b5cf6', accentColor: '#c084fc', description: 'An ethereal shadow bird leaving a cosmic bubble trail.', particleColor: 'rgba(139, 92, 246, 0.6)' },
];

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface DeathParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
  pulseTimer: number;
}

interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

// Web Audio API custom synthesizer wrapper for instant 8-bit retro sound effects
class SoundSynth {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
        }
      } catch (err) {
        console.warn('Web Audio API not supported on this browser:', err);
      }
    }
    // Resume context if suspended
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playFlap() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, this.ctx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {
      // Ignored
    }
  }

  public playScore() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const offset = this.ctx.currentTime;
      const notes = [587.33, 880.00]; // D5, A5
      const durations = [0.1, 0.2];
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, offset + (idx * 0.08));
        
        gain.gain.setValueAtTime(0.08, offset + (idx * 0.08));
        gain.gain.linearRampToValueAtTime(0.001, offset + (idx * 0.08) + durations[idx]);
        
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        
        osc.start(offset + (idx * 0.08));
        osc.stop(offset + (idx * 0.08) + durations[idx]);
      });
    } catch {
      // Ignored
    }
  }

  public playCrash() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.45);
      
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.45);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(now + 0.45);
      
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'square';
      subOsc.frequency.setValueAtTime(90, now);
      subOsc.frequency.linearRampToValueAtTime(20, now + 0.3);
      subGain.gain.setValueAtTime(0.2, now);
      subGain.gain.linearRampToValueAtTime(0.001, now + 0.3);
      
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start();
      subOsc.stop(now + 0.3);
    } catch {
      // Ignored
    }
  }
}

export default function FlappyBirdGame() {
  // Game scores & difficulty config
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('normal');
  const [selectedSkin, setSelectedSkin] = useState<string>('classic');
  const [selectedTheme, setSelectedTheme] = useState<GameTheme>('classic');
  const [muted, setMuted] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  // Local stats state loaded safely after mount to avoid hydration mismatch
  const [stats, setStats] = useState({
    gamesPlayed: 0,
    totalFlaps: 0,
    averageScore: 0,
    scoresList: [] as number[],
    highScoreEasy: 0,
    highScoreNormal: 0,
    highScoreHard: 0,
  });

  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  // Sync client-side stats & device capability on mount safely
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTouch = 'ontouchstart' in window;
      let parsedStats = null;
      try {
        const records = localStorage.getItem('flappy_records_v1');
        if (records) {
          const parsed = JSON.parse(records);
          parsedStats = {
            gamesPlayed: parsed.gamesPlayed ?? 0,
            totalFlaps: parsed.totalFlaps ?? 0,
            averageScore: parsed.averageScore ?? 0,
            scoresList: parsed.scoresList ?? [],
            highScoreEasy: parsed.highScoreEasy ?? 0,
            highScoreNormal: parsed.highScoreNormal ?? 0,
            highScoreHard: parsed.highScoreHard ?? 0,
          };
        }
      } catch (e) {
        console.warn('Failed parsing local stats, safe fallback applied', e);
      }

      // Run updating on next event cycle to avoid synchronous setState inside effect warning
      setTimeout(() => {
        setIsTouchDevice(isTouch);
        if (parsedStats) {
          setStats(parsedStats);
        }
      }, 0);
    }
  }, []);

  // Canvas and internal mechanics refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const synthRef = useRef<SoundSynth | null>(null);

  // Physics constants scaling under difficulty values
  const physicsRef = useRef({
    birdY: 250,
    birdVelocity: 0,
    birdRadius: 16,
    gravity: 0.35,
    flapStrength: -7.2,
    pipeSpeed: 2.8,
    pipeGap: 145,
    pipeSpawnInterval: 95,
    lastSpawnFrame: 0,
    frameCount: 0,
    groundY: 530,
    groundOffsetX: 0,
    screenShake: 0,
    pointScoredTransition: 0, 
    // Queued interactions flags to remain pure during React render loops
    shouldFlap: false,
    shouldReset: false,
    shouldPauseToggle: false,
    emitFlapParticles: false,
  });

  // Dynamic content lists
  const pipesRef = useRef<Pipe[]>([]);
  const trailParticlesRef = useRef<Particle[]>([]);
  const deathParticlesRef = useRef<DeathParticle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const starsRef = useRef<{ x: number, y: number, speed: number, size: number, brightness: number }[]>([]);

  // Initialize sound synthesizer
  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = new SoundSynth();
    }
    synthRef.current.muted = muted;
  }, [muted]);

  // Sync state mutation helper to save to local storage using useCallback
  const updateSavedStats = useCallback((finalRunScore: number, addFlaps: number = 0) => {
    setStats((prev) => {
      const newGamesPlayed = prev.gamesPlayed + (finalRunScore >= 0 ? 1 : 0);
      const newTotalFlaps = prev.totalFlaps + addFlaps;
      
      let updatedScoresList = [...prev.scoresList];
      if (finalRunScore >= 0) {
        updatedScoresList.push(finalRunScore);
      }
      
      const totalScoreSum = updatedScoresList.reduce((acc, curr) => acc + curr, 0);
      const newAverage = updatedScoresList.length > 0 ? parseFloat((totalScoreSum / updatedScoresList.length).toFixed(1)) : 0;
      
      let easyH = prev.highScoreEasy;
      let normalH = prev.highScoreNormal;
      let hardH = prev.highScoreHard;

      if (difficulty === 'easy' && finalRunScore > easyH) easyH = finalRunScore;
      if (difficulty === 'normal' && finalRunScore > normalH) normalH = finalRunScore;
      if (difficulty === 'hard' && finalRunScore > hardH) hardH = finalRunScore;

      const updated = {
        gamesPlayed: newGamesPlayed,
        totalFlaps: newTotalFlaps,
        averageScore: newAverage,
        scoresList: updatedScoresList,
        highScoreEasy: easyH,
        highScoreNormal: normalH,
        highScoreHard: hardH,
      };

      try {
        localStorage.setItem('flappy_records_v1', JSON.stringify(updated));
      } catch (err) {
        // Ignored
      }
      return updated;
    });
  }, [difficulty]);

  // Generate background parallax decor on mount
  useEffect(() => {
    const starsPool = [];
    for (let i = 0; i < 60; i++) {
      starsPool.push({
        x: Math.random() * 480,
        y: Math.random() * 500,
        speed: 0.1 + Math.random() * 0.4,
        size: 0.8 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
    starsRef.current = starsPool;

    const cloudsPool = [];
    for (let i = 0; i < 4; i++) {
      cloudsPool.push({
        x: Math.random() * 480,
        y: 40 + Math.random() * 120,
        size: 30 + Math.random() * 45,
        speed: 0.15 + Math.random() * 0.25,
        opacity: 0.3 + Math.random() * 0.4,
      });
    }
    cloudsRef.current = cloudsPool;
  }, []);

  // Update physical parameters by difficulty level
  const applyDifficultySettings = (dif: DifficultyLevel) => {
    const physics = physicsRef.current;
    if (dif === 'easy') {
      physics.gravity = 0.32;
      physics.flapStrength = -6.8;
      physics.pipeSpeed = 2.4;
      physics.pipeGap = 175;
      physics.pipeSpawnInterval = 105;
    } else if (dif === 'normal') {
      physics.gravity = 0.36;
      physics.flapStrength = -7.3;
      physics.pipeSpeed = 3.0;
      physics.pipeGap = 145;
      physics.pipeSpawnInterval = 90;
    } else if (dif === 'hard') {
      physics.gravity = 0.42;
      physics.flapStrength = -7.8;
      physics.pipeSpeed = 3.7;
      physics.pipeGap = 118;
      physics.pipeSpawnInterval = 72;
    } else { // Zen Mode
      physics.gravity = 0.33;
      physics.flapStrength = -7.0;
      physics.pipeSpeed = 2.6;
      physics.pipeGap = 155;
      physics.pipeSpawnInterval = 95;
    }
  };

  // Safe callback interface for toggling pause from UI/Keys
  const triggerPauseToggle = () => {
    physicsRef.current.shouldPauseToggle = true;
  };

  // Safe click handler for flaps
  const handleFlap = () => {
    physicsRef.current.shouldFlap = true;
  };

  // Monitor keyboard triggers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); 
        handleFlap();
      } else if (e.code === 'KeyP') {
        triggerPauseToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectDifficulty = (dl: DifficultyLevel) => {
    if (hasStarted && !isGameOver) return; 
    setDifficulty(dl);
    applyDifficultySettings(dl);
  };

  const getHighScoreForDifficulty = () => {
    if (difficulty === 'easy') return stats.highScoreEasy;
    if (difficulty === 'normal') return stats.highScoreNormal;
    if (difficulty === 'hard') return stats.highScoreHard;
    return 0;
  };

  // Complete game-loop running independently inside requestAnimationFrame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localFrameId: number;

    // Helper functions sealed inside effect to stay pure
    const crashAction = () => {
      setIsPlaying(false);
      setIsGameOver(true);
      
      if (synthRef.current) {
        synthRef.current.playCrash();
      }

      physicsRef.current.screenShake = 14;

      // Commit scores
      updateSavedStats(score, 0);

      // Spark death fireworks
      const skinData = BIRD_SKINS.find(s => s.id === selectedSkin) || BIRD_SKINS[0];
      const colors = [skinData.color, skinData.accentColor, '#ffffff', '#ef4444'];
      
      for (let i = 0; i < 28; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        deathParticlesRef.current.push({
          x: 100,
          y: physicsRef.current.birdY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 2 + Math.random() * 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1.0,
        });
      }
    };

    const performReset = () => {
      const physics = physicsRef.current;
      physics.birdY = 240;
      physics.birdVelocity = 0;
      physics.frameCount = 0;
      physics.lastSpawnFrame = 0;
      physics.screenShake = 0;
      physics.pointScoredTransition = 0;

      pipesRef.current = [];
      trailParticlesRef.current = [];
      deathParticlesRef.current = [];
      
      setScore(0);
      setIsGameOver(false);
      setHasStarted(false);
      setIsPaused(false);
      setIsPlaying(false);
      applyDifficultySettings(difficulty);
    };

    const gameTick = () => {
      const physics = physicsRef.current;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      
      // Auto HighDPI sizing matrix
      if (canvas.width !== 480 * dpr || canvas.height !== 600 * dpr) {
        canvas.width = 480 * dpr;
        canvas.height = 600 * dpr;
        ctx.scale(dpr, dpr);
      }

      // 1. INPUT QUEUES PROCESSING
      if (physics.shouldReset) {
        physics.shouldReset = false;
        performReset();
      }

      if (physics.shouldPauseToggle) {
        physics.shouldPauseToggle = false;
        if (hasStarted && !isGameOver) {
          setIsPaused((p) => {
            const next = !p;
            setIsPlaying(!next);
            return next;
          });
        }
      }

      if (physics.shouldFlap) {
        physics.shouldFlap = false;
        if (isGameOver) {
          physics.shouldReset = true;
        } else if (isPaused) {
          // Pause blocking flaping
        } else {
          if (!hasStarted) {
            setHasStarted(true);
            setIsPlaying(true);
            applyDifficultySettings(difficulty);
          }
          physics.birdVelocity = physics.flapStrength;
          physics.emitFlapParticles = true;
          if (synthRef.current) {
            synthRef.current.playFlap();
          }
          updateSavedStats(-1, 1); // increment flap stats
        }
      }

      // 2. SIMULATION MATH
      if (isPlaying && hasStarted && !isGameOver && !isPaused) {
        physics.frameCount++;

        // Ground scrolling
        physics.groundOffsetX = (physics.groundOffsetX - physics.pipeSpeed) % 24;

        // Gravity physics
        physics.birdVelocity += physics.gravity;
        physics.birdY += physics.birdVelocity;

        // Move stars parallax list
        starsRef.current.forEach(star => {
          star.x -= star.speed * (physics.pipeSpeed * 0.4);
          if (star.x < 0) {
            star.x = 480;
            star.y = Math.random() * 500;
          }
        });

        // Move clouds midground list
        cloudsRef.current.forEach(cloud => {
          cloud.x -= cloud.speed * (physics.pipeSpeed * 0.3);
          if (cloud.x + cloud.size < 0) {
            cloud.x = 480 + Math.random() * 50;
            cloud.y = 40 + Math.random() * 110;
          }
        });

        // Pipe spawning
        if (physics.frameCount - physics.lastSpawnFrame >= physics.pipeSpawnInterval) {
          const spawnHeightLimit = physics.groundY - physics.pipeGap - 100;
          const minPipeH = 50;
          const topH = Math.floor(Math.random() * (spawnHeightLimit - minPipeH)) + minPipeH;
          const bottomH = physics.groundY - topH - physics.pipeGap;

          pipesRef.current.push({
            x: 480,
            topHeight: topH,
            bottomHeight: bottomH,
            passed: false,
            pulseTimer: 0,
          });
          physics.lastSpawnFrame = physics.frameCount;
        }

        // Loop obstacle pipes list
        const activePipes: Pipe[] = [];
        let didCrashThisFrame = false;

        for (let i = 0; i < pipesRef.current.length; i++) {
          const pipe = pipesRef.current[i];
          pipe.x -= physics.pipeSpeed;
          pipe.pulseTimer += 0.05;

          const birdLeft = 100 - physics.birdRadius + 1;
          const birdRight = 100 + physics.birdRadius - 1;
          const birdTop = physics.birdY - physics.birdRadius + 1;
          const birdBottom = physics.birdY + physics.birdRadius - 1;

          if (difficulty !== 'zen' && !didCrashThisFrame) {
            // Check bounding collision range
            if (birdRight > pipe.x && birdLeft < pipe.x + 64) {
              if (birdTop < pipe.topHeight || birdBottom > physics.groundY - pipe.bottomHeight) {
                didCrashThisFrame = true;
                crashAction();
                break;
              }
            }
          }

          // Check scoring trigger
          if (!pipe.passed && pipe.x + 32 < 100) {
            pipe.passed = true;
            physics.pointScoredTransition = 12; // brief border-flash trigger
            setScore((s) => {
              if (synthRef.current) {
                synthRef.current.playScore();
              }
              return s + 1;
            });
          }

          if (pipe.x > -80) {
            activePipes.push(pipe);
          }
        }

        if (!didCrashThisFrame && !isGameOver) {
          pipesRef.current = activePipes;
        }

        // Roof and ground collision sequences
        if (difficulty !== 'zen' && !didCrashThisFrame) {
          if (physics.birdY + physics.birdRadius >= physics.groundY) {
            physics.birdY = physics.groundY - physics.birdRadius;
            crashAction();
          }
          if (physics.birdY - physics.birdRadius <= 0) {
            physics.birdY = physics.birdRadius;
            physics.birdVelocity = 0.5; // softly push back down
          }
        } else {
          // Zen bouncing boundary bounds
          if (physics.birdY + physics.birdRadius >= physics.groundY) {
            physics.birdY = physics.groundY - physics.birdRadius;
            physics.birdVelocity = physics.flapStrength * 0.7; // Autojump mock back in Zen
          }
          if (physics.birdY - physics.birdRadius <= 0) {
            physics.birdY = physics.birdRadius;
            physics.birdVelocity = 1;
          }
        }

        // Standard trail particles injection
        if (physics.frameCount % 2 === 0) {
          const skinData = BIRD_SKINS.find(s => s.id === selectedSkin) || BIRD_SKINS[0];
          trailParticlesRef.current.push({
            id: Math.random(),
            x: 100 - physics.birdRadius,
            y: physics.birdY + (Math.random() * 10 - 5),
            size: 2 + Math.random() * 4,
            vx: -physics.pipeSpeed * 0.4 - (Math.random() * 1),
            vy: (Math.random() * 1) - 0.5,
            color: skinData.particleColor,
            alpha: 0.8,
            life: 0,
            maxLife: 25 + Math.random() * 15,
          });
        }
      }

      // Jump wing sparkles trigger
      if (physics.emitFlapParticles) {
        physics.emitFlapParticles = false;
        const skinData = BIRD_SKINS.find(s => s.id === selectedSkin) || BIRD_SKINS[0];
        
        for (let i = 0; i < 6; i++) {
          trailParticlesRef.current.push({
            id: Math.random() + Date.now(),
            x: 100 - physics.birdRadius / 2,
            y: physics.birdY + (Math.random() * 10 - 5),
            size: 3 + Math.random() * 5,
            vx: -1.5 - Math.random() * 2,
            vy: (Math.random() * 3) - 1.5,
            color: skinData.particleColor,
            alpha: 1.0,
            life: 0,
            maxLife: 20 + Math.random() * 15,
          });
        }
      }

      // Decaying flight dust arrays
      trailParticlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        p.alpha = 1.0 - (p.life / p.maxLife);
      });
      trailParticlesRef.current = trailParticlesRef.current.filter((p) => p.life < p.maxLife);

      // Decaying crash fireworks explosive arrays
      deathParticlesRef.current.forEach((dp) => {
        dp.x += dp.vx;
        dp.y += dp.vy;
        dp.vy += 0.15; // physical gravity resistance
        dp.alpha -= 0.015;
      });
      deathParticlesRef.current = deathParticlesRef.current.filter((dp) => dp.alpha > 0);

      // Screen shake decay multiplier
      if (physics.screenShake > 0) {
        physics.screenShake *= 0.88;
        if (physics.screenShake < 0.2) physics.screenShake = 0;
      }

      if (physics.pointScoredTransition > 0) {
        physics.pointScoredTransition--;
      }

      // 3. CANVAS LAYOUT RENDERING
      ctx.save();

      // Screen shaking transform
      if (physics.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * physics.screenShake;
        const shakeY = (Math.random() - 0.5) * physics.screenShake;
        ctx.translate(shakeX, shakeY);
      }

      // Theme background paint
      if (selectedTheme === 'neon') {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 600);
        bgGrad.addColorStop(0, '#090514');
        bgGrad.addColorStop(0.5, '#1e0735');
        bgGrad.addColorStop(1, '#0e011a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 480, 600);

        // Retro sun rendering
        const sunRadius = 70;
        const sunX = 240;
        const sunY = 320;
        const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
        sunGrad.addColorStop(0, '#f43f5e');
        sunGrad.addColorStop(0.5, '#ec4899');
        sunGrad.addColorStop(1, '#eab308');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI, true);
        ctx.fill();

        ctx.strokeStyle = '#090514';
        ctx.lineWidth = 3;
        for (let gy = sunY - sunRadius + 20; gy < sunY; gy += 12) {
          ctx.beginPath();
          ctx.moveTo(sunX - sunRadius - 20, gy);
          ctx.lineTo(sunX + sunRadius + 20, gy);
          ctx.stroke();
        }

        // Geometric mountain vector silhouettes
        ctx.fillStyle = 'rgba(15, 3, 28, 0.75)';
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 360);
        ctx.lineTo(80, 240);
        ctx.lineTo(170, 340);
        ctx.lineTo(260, 200);
        ctx.lineTo(390, 360);
        ctx.lineTo(440, 290);
        ctx.lineTo(480, 360);
        ctx.lineTo(480, 530);
        ctx.lineTo(0, 530);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Star glowing backgrounds
        starsRef.current.forEach(star => {
          ctx.fillStyle = `rgba(236, 72, 153, ${star.brightness * 0.4})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        });

      } else if (selectedTheme === 'space') {
        const spaceGrad = ctx.createLinearGradient(0, 0, 0, 600);
        spaceGrad.addColorStop(0, '#02010a');
        spaceGrad.addColorStop(0.4, '#0b0826');
        spaceGrad.addColorStop(0.8, '#030617');
        spaceGrad.addColorStop(1, '#02010a');
        ctx.fillStyle = spaceGrad;
        ctx.fillRect(0, 0, 480, 600);

        const nebulaGrad = ctx.createRadialGradient(320, 220, 10, 260, 260, 230);
        nebulaGrad.addColorStop(0, 'rgba(124, 58, 237, 0.12)');
        nebulaGrad.addColorStop(0.6, 'rgba(30, 64, 175, 0.05)');
        nebulaGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = nebulaGrad;
        ctx.fillRect(0, 0, 480, 600);

        // Render space stars with twinkle offsets
        starsRef.current.forEach(star => {
          const twinkling = star.brightness * (0.6 + Math.sin(physics.frameCount * 0.05 + star.x) * 0.4);
          ctx.fillStyle = `rgba(255, 255, 255, ${twinkling})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fill();
        });

        // Blue moon sphere
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(360, 110, 32, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(224, 242, 254, 0.9)';
        ctx.beginPath();
        ctx.arc(360, 110, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(186, 230, 253, 0.8)';
        ctx.beginPath();
        ctx.arc(350, 100, 6, 0, Math.PI * 2);
        ctx.arc(370, 122, 4, 0, Math.PI * 2);
        ctx.arc(352, 120, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else {
        const dayGrad = ctx.createLinearGradient(0, 0, 0, 600);
        dayGrad.addColorStop(0, '#70c5ce'); 
        dayGrad.addColorStop(0.6, '#93d7de'); 
        dayGrad.addColorStop(1, '#b7eaf0'); 
        ctx.fillStyle = dayGrad;
        ctx.fillRect(0, 0, 480, 600);

        ctx.fillStyle = '#8ed06c';
        ctx.beginPath();
        ctx.moveTo(0, 420);
        ctx.quadraticCurveTo(120, 350, 240, 410);
        ctx.quadraticCurveTo(360, 370, 480, 420);
        ctx.lineTo(480, 530);
        ctx.lineTo(0, 530);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#73bf2e';
        ctx.beginPath();
        ctx.moveTo(0, 460);
        ctx.quadraticCurveTo(150, 400, 300, 460);
        ctx.quadraticCurveTo(390, 430, 480, 470);
        ctx.lineTo(480, 530);
        ctx.lineTo(0, 530);
        ctx.closePath();
        ctx.fill();

        cloudsRef.current.forEach(cloud => {
          ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
          ctx.beginPath();
          ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
          ctx.arc(cloud.x + cloud.size * 0.5, cloud.y - cloud.size * 0.25, cloud.size * 0.8, 0, Math.PI * 2);
          ctx.arc(cloud.x + cloud.size * 1.1, cloud.y, cloud.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw active flight dust trail list
      trailParticlesRef.current.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw traveling barrier pipes list
      pipesRef.current.forEach((pipe) => {
        if (selectedTheme === 'neon') {
          ctx.shadowColor = '#ec4899';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2.5;

          const tGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + 64, 0);
          tGrad.addColorStop(0, '#4c0519');
          tGrad.addColorStop(0.5, '#881337');
          tGrad.addColorStop(1, '#4c0519');
          ctx.fillStyle = tGrad;
          ctx.strokeStyle = '#f43f5e';
          
          ctx.fillRect(pipe.x, 0, 64, pipe.topHeight);
          ctx.strokeRect(pipe.x, 0, 64, pipe.topHeight);

          const ringH = 24;
          ctx.fillRect(pipe.x - 4, pipe.topHeight - ringH, 72, ringH);
          ctx.strokeRect(pipe.x - 4, pipe.topHeight - ringH, 72, ringH);

          const bGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + 64, 0);
          bGrad.addColorStop(0, '#4c0519');
          bGrad.addColorStop(0.5, '#881337');
          bGrad.addColorStop(1, '#4c0519');
          ctx.fillStyle = bGrad;
          
          ctx.fillRect(pipe.x, physics.groundY - pipe.bottomHeight, 64, pipe.bottomHeight);
          ctx.strokeRect(pipe.x, physics.groundY - pipe.bottomHeight, 64, pipe.bottomHeight);

          ctx.fillRect(pipe.x - 4, physics.groundY - pipe.bottomHeight, 72, ringH);
          ctx.strokeRect(pipe.x - 4, physics.groundY - pipe.bottomHeight, 72, ringH);

          ctx.shadowBlur = 0;

        } else if (selectedTheme === 'space') {
          ctx.lineWidth = 1;
          
          const metalTopGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + 64, 0);
          metalTopGrad.addColorStop(0, '#1e293b');
          metalTopGrad.addColorStop(0.3, '#475569');
          metalTopGrad.addColorStop(0.7, '#334155');
          metalTopGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = metalTopGrad;
          ctx.strokeStyle = '#0284c7';
          
          ctx.fillRect(pipe.x, 0, 64, pipe.topHeight);
          ctx.strokeRect(pipe.x, 0, 64, pipe.topHeight);

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(pipe.x - 3, pipe.topHeight - 20, 70, 20);
          ctx.strokeRect(pipe.x - 3, pipe.topHeight - 20, 70, 20);
          
          ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
          for (let sx = pipe.x - 2; sx < pipe.x + 66; sx += 14) {
            ctx.beginPath();
            ctx.moveTo(sx, pipe.topHeight);
            ctx.lineTo(sx + 8, pipe.topHeight);
            ctx.lineTo(sx - 4, pipe.topHeight - 20);
            ctx.lineTo(sx - 12, pipe.topHeight - 20);
            ctx.closePath();
            ctx.fill();
          }

          const metalBotGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + 64, 0);
          metalBotGrad.addColorStop(0, '#1e293b');
          metalBotGrad.addColorStop(0.3, '#475569');
          metalBotGrad.addColorStop(0.7, '#334155');
          metalBotGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = metalBotGrad;
          
          ctx.fillRect(pipe.x, physics.groundY - pipe.bottomHeight, 64, pipe.bottomHeight);
          ctx.strokeRect(pipe.x, physics.groundY - pipe.bottomHeight, 64, pipe.bottomHeight);

          ctx.fillStyle = '#0f172a';
          ctx.fillRect(pipe.x - 3, physics.groundY - pipe.bottomHeight, 70, 20);
          ctx.strokeRect(pipe.x - 3, physics.groundY - pipe.bottomHeight, 70, 20);

          ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
          for (let sx = pipe.x - 2; sx < pipe.x + 66; sx += 14) {
            ctx.beginPath();
            ctx.moveTo(sx, physics.groundY - pipe.bottomHeight + 20);
            ctx.lineTo(sx + 8, physics.groundY - pipe.bottomHeight + 20);
            ctx.lineTo(sx - 4, physics.groundY - pipe.bottomHeight);
            ctx.lineTo(sx - 12, physics.groundY - pipe.bottomHeight);
            ctx.closePath();
            ctx.fill();
          }

          ctx.fillStyle = '#38bdf8';
          const nodePulse = 2 + Math.sin(pipe.pulseTimer * 3) * 1.5;
          ctx.beginPath();
          ctx.arc(pipe.x + 32, pipe.topHeight - 10, nodePulse, 0, Math.PI * 2);
          ctx.arc(pipe.x + 32, physics.groundY - pipe.bottomHeight + 10, nodePulse, 0, Math.PI * 2);
          ctx.fill();

        } else {
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#5a4d41';

          const classicTopGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + 64, 0);
          classicTopGrad.addColorStop(0, '#73bf2e');
          classicTopGrad.addColorStop(0.3, '#9ce356');
          classicTopGrad.addColorStop(0.7, '#73bf2e');
          classicTopGrad.addColorStop(1, '#5fa81a');
          ctx.fillStyle = classicTopGrad;

          ctx.fillRect(pipe.x, 0, 64, pipe.topHeight);
          ctx.strokeRect(pipe.x, -5, 64, pipe.topHeight + 5);

          const capHeight = 24;
          ctx.fillRect(pipe.x - 4, pipe.topHeight - capHeight, 72, capHeight);
          ctx.strokeRect(pipe.x - 4, pipe.topHeight - capHeight, 72, capHeight);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(pipe.x + 6, 0, 4, pipe.topHeight - capHeight);
          ctx.fillRect(pipe.x + 4, pipe.topHeight - capHeight + 3, 5, capHeight - 6);

          const classicBotGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + 64, 0);
          classicBotGrad.addColorStop(0, '#73bf2e');
          classicBotGrad.addColorStop(0.3, '#9ce356');
          classicBotGrad.addColorStop(0.7, '#73bf2e');
          classicBotGrad.addColorStop(1, '#5fa81a');
          ctx.fillStyle = classicBotGrad;

          ctx.fillRect(pipe.x, physics.groundY - pipe.bottomHeight, 64, pipe.bottomHeight);
          ctx.strokeRect(pipe.x, physics.groundY - pipe.bottomHeight, 64, pipe.bottomHeight + 5);

          ctx.fillRect(pipe.x - 4, physics.groundY - pipe.bottomHeight, 72, capHeight);
          ctx.strokeRect(pipe.x - 4, physics.groundY - pipe.bottomHeight, 72, capHeight);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(pipe.x + 6, physics.groundY - pipe.bottomHeight + capHeight, 4, pipe.bottomHeight - capHeight);
          ctx.fillRect(pipe.x + 4, physics.groundY - pipe.bottomHeight + 3, 5, capHeight - 6);
        }
      });

      // Draw the flyer Bird
      if (!isGameOver || deathParticlesRef.current.length > 0) {
        const birdSkin = BIRD_SKINS.find(s => s.id === selectedSkin) || BIRD_SKINS[0];
        const angle = Math.max(-0.4, Math.min(1.0, physics.birdVelocity * 0.08));

        ctx.save();
        ctx.translate(100, physics.birdY);
        ctx.rotate(angle);

        if (birdSkin.id === 'cyber') {
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 8;
          
          ctx.fillStyle = birdSkin.color;
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(-12, -12);
          ctx.lineTo(-6, 12);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = birdSkin.accentColor;
          ctx.beginPath();
          ctx.moveTo(3, -6);
          ctx.lineTo(13, -3);
          ctx.lineTo(10, 4);
          ctx.lineTo(1, 1);
          ctx.closePath();
          ctx.fill();

          const wingOffset = Math.sin(physics.frameCount * 0.4) * 8;
          ctx.fillStyle = 'rgba(236, 72, 153, 0.85)';
          ctx.beginPath();
          ctx.moveTo(-4, 0);
          ctx.lineTo(-14, wingOffset);
          ctx.lineTo(-10, wingOffset + 5);
          ctx.closePath();
          ctx.fill();

        } else if (birdSkin.id === 'phoenix') {
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 12;

          const flameGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, 16);
          flameGrad.addColorStop(0, '#ffffff');
          flameGrad.addColorStop(0.3, birdSkin.accentColor);
          flameGrad.addColorStop(0.7, birdSkin.color);
          flameGrad.addColorStop(1, '#7f1d1d');
          ctx.fillStyle = flameGrad;

          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.moveTo(-12, -8);
          ctx.quadraticCurveTo(-24, -18, -20, -4);
          ctx.quadraticCurveTo(-28, 2, -12, 6);
          ctx.closePath();
          ctx.fill();

          const flapWing = Math.sin(physics.frameCount * 0.4) * 12;
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(-3, -2);
          ctx.lineTo(-14, -flapWing - 3);
          ctx.lineTo(-6, -flapWing + 12);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(12, -4);
          ctx.lineTo(19, 0);
          ctx.lineTo(12, 4);
          ctx.closePath();
          ctx.fill();

        } else if (birdSkin.id === 'phantom') {
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 10;

          const shadowD = ctx.createRadialGradient(-3, -3, 2, 0, 0, 16);
          shadowD.addColorStop(0, '#e9d5ff');
          shadowD.addColorStop(0.5, birdSkin.color);
          shadowD.addColorStop(1, '#1e1b4b');
          ctx.fillStyle = shadowD;

          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#5eead4';
          ctx.beginPath();
          ctx.arc(6, -4, 2.5, 0, Math.PI * 2);
          ctx.fill();

          const phase = Math.sin(physics.frameCount * 0.35) * 10;
          ctx.fillStyle = birdSkin.accentColor;
          ctx.beginPath();
          ctx.moveTo(-1, 0);
          ctx.lineTo(-11, -phase);
          ctx.lineTo(-16, -phase + 6);
          ctx.lineTo(-6, 4);
          ctx.closePath();
          ctx.fill();

        } else {
          ctx.fillStyle = birdSkin.color;
          ctx.strokeStyle = '#3e2723';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(6, -4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#3e2723';
          ctx.beginPath();
          ctx.arc(7.5, -4, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = birdSkin.accentColor;
          ctx.beginPath();
          ctx.moveTo(11, -3);
          ctx.quadraticCurveTo(24, -4, 21, 2);
          ctx.quadraticCurveTo(14, 8, 10, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(11, 1);
          ctx.lineTo(19, 1);
          ctx.stroke();

          const flapY = Math.sin(physics.frameCount * 0.3) * 8;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.ellipse(-4, flapY + 2, 7, 5, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
        ctx.shadowBlur = 0;
      }

      // Draw active death explosion list
      deathParticlesRef.current.forEach((dp) => {
        ctx.fillStyle = dp.color;
        ctx.globalAlpha = dp.alpha;
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, dp.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw bottom scrolling ground platform
      ctx.save();
      if (selectedTheme === 'neon') {
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;

        ctx.strokeStyle = '#ec4899';
        ctx.beginPath();
        ctx.moveTo(0, physics.groundY);
        ctx.lineTo(480, physics.groundY);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#090514';
        ctx.fillRect(0, physics.groundY + 1.5, 480, 600 - physics.groundY);

        ctx.strokeStyle = '#3b0764';
        ctx.lineWidth = 1.5;
        for (let gx = -100; gx < 580; gx += 35) {
          ctx.beginPath();
          ctx.moveTo(gx + physics.groundOffsetX * 0.3, physics.groundY);
          ctx.lineTo(gx * 1.6 + physics.groundOffsetX * 0.8, 600);
          ctx.stroke();
        }
        let hexY = physics.groundY;
        for (let ih = 0; ih < 6; ih++) {
          hexY += 12 + ih * 5;
          ctx.beginPath();
          ctx.moveTo(0, hexY);
          ctx.lineTo(480, hexY);
          ctx.stroke();
        }

      } else if (selectedTheme === 'space') {
        const platformGrad = ctx.createLinearGradient(0, physics.groundY, 0, 600);
        platformGrad.addColorStop(0, '#03071e');
        platformGrad.addColorStop(0.5, '#05182e');
        platformGrad.addColorStop(1, '#0c2240');
        ctx.fillStyle = platformGrad;
        ctx.fillRect(0, physics.groundY, 480, 600 - physics.groundY);

        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, physics.groundY);
        ctx.lineTo(480, physics.groundY);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < 480; gx += 20) {
          ctx.beginPath();
          ctx.moveTo(gx, physics.groundY);
          ctx.lineTo(gx, 600);
          ctx.stroke();
        }

      } else {
        ctx.strokeStyle = '#5a4d41';
        ctx.lineWidth = 4;

        ctx.fillStyle = '#ded895';
        ctx.fillRect(0, physics.groundY, 480, 600 - physics.groundY);

        ctx.fillStyle = '#73bf2e';
        ctx.fillRect(0, physics.groundY, 480, 16);

        ctx.beginPath();
        ctx.moveTo(0, physics.groundY);
        ctx.lineTo(480, physics.groundY);
        ctx.moveTo(0, physics.groundY + 16);
        ctx.lineTo(480, physics.groundY + 16);
        ctx.stroke();

        ctx.fillStyle = '#bfa55f';
        for (let tx = -24; tx < 480 + 24; tx += 30) {
          ctx.beginPath();
          ctx.moveTo(tx + physics.groundOffsetX, physics.groundY + 28);
          ctx.lineTo(tx + 12 + physics.groundOffsetX, physics.groundY + 45);
          ctx.lineTo(tx + 8 + physics.groundOffsetX, physics.groundY + 45);
          ctx.lineTo(tx - 4 + physics.groundOffsetX, physics.groundY + 28);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();

      // Screen marginal flash overlay
      if (physics.pointScoredTransition > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(0, 0, 480, 600);
        ctx.restore();
      }

      // Help Overlay Screen
      if (!hasStarted && !isGameOver) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 4;

        if (selectedTheme === 'neon') {
          ctx.fillStyle = '#ec4899';
          ctx.font = 'bold 24px var(--font-mono)';
          ctx.fillText('PRESS SPACEBAR / TAP', 240, 180);
          
          ctx.fillStyle = '#38bdf8';
          ctx.font = '14px var(--font-mono)';
          ctx.fillText('TO FLAP AND START FLYING', 240, 210);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.font = '11px var(--font-mono)';
          ctx.fillText('AVOID NEON WALLS', 240, 260);
        } else if (selectedTheme === 'space') {
          ctx.fillStyle = '#38bdf8';
          ctx.font = '900 24px var(--font-sans)';
          ctx.fillText('TAP SCREEN OR SPACE', 240, 180);
          
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '14px var(--font-mono)';
          ctx.fillText('LAUNCH THE COSMIC VEHICLE', 240, 215);

          ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.font = '11px var(--font-mono)';
          ctx.fillText('PLASMA DEFLECTOR ENGAGED', 240, 260);
        } else {
          ctx.fillStyle = '#1e293b';
          ctx.font = 'bold 24px var(--font-sans)';
          ctx.fillText('TAP TO PLAY!', 240, 180);
          
          ctx.fillStyle = '#475569';
          ctx.font = '14px var(--font-sans)';
          ctx.fillText('Or Press SPACEBAR to Flap', 240, 210);

          ctx.fillStyle = '#16a34a';
          ctx.font = 'italic 12px var(--font-sans)';
          ctx.fillText('Navigate safely between green pipes', 240, 245);
        }

        const fingerBounce = Math.sin(physics.frameCount * 0.15) * 8;
        ctx.font = '32px sans-serif';
        ctx.fillText('👇', 240, 290 + fingerBounce);

        ctx.restore();
      }

      // Centered overlay 8-bit score card
      if (hasStarted && !isGameOver) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;

        if (selectedTheme === 'neon') {
          ctx.fillStyle = '#00ffff';
          ctx.font = 'bold 44px var(--font-mono)';
          ctx.fillText(score.toString(), 240, 80);
          
          if (difficulty === 'zen') {
            ctx.fillStyle = '#eab308';
            ctx.font = '9px var(--font-mono)';
            ctx.fillText('[ ZEN UNCOLLIDABLE ]', 240, 105);
          }
        } else if (selectedTheme === 'space') {
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 48px var(--font-mono)';
          ctx.fillText(score.toString(), 240, 80);

          if (difficulty === 'zen') {
            ctx.fillStyle = '#10b981';
            ctx.font = '9px var(--font-mono)';
            ctx.fillText('[ TRAINING DECK ]', 240, 105);
          }
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 6;
          ctx.font = 'bold 54px var(--font-sans)';
          ctx.strokeText(score.toString(), 240, 80);
          ctx.fillText(score.toString(), 240, 80);

          if (difficulty === 'zen') {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 11px var(--font-sans)';
            ctx.strokeText('ZEN TRAINING', 240, 105);
            ctx.fillText('ZEN TRAINING', 240, 105);
          }
        }
        ctx.restore();
      }

      ctx.restore();
      localFrameId = requestAnimationFrame(gameTick);
    };

    localFrameId = requestAnimationFrame(gameTick);

    return () => {
      cancelAnimationFrame(localFrameId);
    };
  }, [isPlaying, hasStarted, isGameOver, isPaused, selectedSkin, selectedTheme, difficulty, score, updateSavedStats]);

  return (
    <div className="w-full flex-grow flex flex-col items-center justify-center p-4 md:p-6 lg:p-8 relative" id="flappy-bird-view">
      
      {/* Decorative Clouds Layer in the Play Area */}
      <div className="absolute top-8 left-16 w-16 h-8 bg-white/40 rounded-full pointer-events-none blur-xs" />
      <div className="absolute bottom-12 right-20 w-24 h-12 bg-white/30 rounded-full pointer-events-none blur-xs" />

      {/* Main Responsive Grid Framework */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
        
        {/* Left Side: Game Controller Dashboard */}
        <div className="lg:col-span-4 order-2 lg:order-1 flex flex-col gap-6 font-sans text-[#5a4d41]" id="controls-bento">
          
          {/* Header & Logo Section */}
          <div className="bg-white border-4 border-[#5a4d41] rounded-[1.5rem] shadow-[0_8px_0_#5a4d41] p-5" id="logo-branding-card">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#f7d02c] border-4 border-[#5a4d41] flex items-center justify-center shadow-md transform rotate-6">
                <span className="text-xl">🐦</span>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#5a4d41] flex items-center gap-2">
                  FLAPPY BIRD <span className="text-[10px] bg-[#e57373] text-white font-mono font-black px-2 py-0.5 rounded border-2 border-[#5a4d41]">V2.1</span>
                </h1>
                <p className="text-xs text-[#5a4d41]/80 font-bold">Crisp HTML5 Canvas Retro Physics Simulator</p>
              </div>
            </div>
          </div>

          {/* Skin Selector */}
          <div className="bg-white border-4 border-[#5a4d41] rounded-[1.5rem] shadow-[0_8px_0_#5a4d41] p-5" id="custom-skins-selection">
            <h2 className="text-sm font-black text-[#5a4d41] uppercase tracking-wider mb-3.5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#f7d02c] fill-[#f7d02c]" /> Choose Your Flyer Skin
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              {BIRD_SKINS.map((skin) => (
                <button
                  key={skin.id}
                  onClick={() => setSelectedSkin(skin.id)}
                  id={`skin-selector-${skin.id}`}
                  className={`relative p-3 rounded-xl border-2 flex flex-col text-left transition-all duration-200 cursor-pointer ${
                    selectedSkin === skin.id
                      ? 'bg-[#ffe46b]/30 border-[#5a4d41] shadow-[0_4px_0_#5a4d41] font-bold font-sans'
                      : 'bg-white border-[#5a4d41]/30 hover:border-[#5a4d41] hover:bg-[#ded895]/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span 
                      className="w-3.5 h-3.5 rounded-full border-2 border-[#5a4d41] shadow-inner flex-shrink-0"
                      style={{ backgroundColor: skin.color }}
                    />
                    <span className="text-xs font-black text-[#5a4d41] tracking-wide truncate">{skin.name}</span>
                  </div>
                  <p className="text-[10px] text-[#5a4d41]/70 font-bold line-clamp-2 leading-snug">{skin.description}</p>
                  {selectedSkin === skin.id && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#73bf2e] border border-[#5a4d41] rounded-full animate-ping" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Scenery Environment Theme Panel */}
          <div className="bg-white border-4 border-[#5a4d41] rounded-[1.5rem] shadow-[0_8px_0_#5a4d41] p-5" id="environment-selection">
            <h2 className="text-sm font-black text-[#5a4d41] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-[#73bf2e]" /> Scenery Theme
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {(['classic', 'neon', 'space'] as GameTheme[]).map((theme) => (
                <button
                  key={theme}
                  onClick={() => setSelectedTheme(theme)}
                  id={`theme-btn-${theme}`}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-black capitalize tracking-wider transition-all cursor-pointer text-center ${
                    selectedTheme === theme
                      ? 'bg-[#73bf2e] border-[#5a4d41] text-white shadow-[0_3px_0_#5a4d41]'
                      : 'bg-[#ded895]/10 border-[#5a4d41]/30 hover:bg-[#ded895]/20 text-[#5a4d41]'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          {/* Level Difficulties & Records Display */}
          <div className="bg-white border-4 border-[#5a4d41] rounded-[1.5rem] shadow-[0_8px_0_#5a4d41] p-5" id="difficulty-and-highscores">
            <h2 className="text-sm font-black text-[#5a4d41] uppercase tracking-wider mb-3 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#70c5ce]" /> Difficulty Matrix
            </h2>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-4 gap-1.5 bg-[#ded895]/25 p-1 rounded-xl border-2 border-[#5a4d41]">
                {(['easy', 'normal', 'hard', 'zen'] as DifficultyLevel[]).map((level) => (
                  <button
                    key={level}
                    disabled={hasStarted && !isGameOver}
                    onClick={() => selectDifficulty(level)}
                    id={`diff-btn-${level}`}
                    className={`py-1.5 rounded-lg text-xs font-black capitalize transition-all cursor-pointer ${
                      hasStarted && !isGameOver ? 'opacity-50 cursor-not-allowed' : ''
                    } ${
                      difficulty === level
                        ? 'bg-[#ded895] text-[#5a4d41] border-2 border-[#5a4d41] shadow-[0_2px_0_#5a4d41]'
                        : 'text-[#5a4d41]/70 hover:text-[#5a4d41] font-bold'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              {/* High Score Stats Panel for active choices */}
              <div className="bg-[#ded895]/15 rounded-xl border-2 border-[#5a4d41] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#5a4d41]" id="high-score-header">
                  <span>Current Difficulty:</span>
                  <span className="font-bold text-[#5a4d41] uppercase text-[10px] bg-[#ded895] px-2 py-0.5 rounded border-2 border-[#5a4d41] font-mono">
                    {difficulty}
                  </span>
                </div>
                
                <div className="flex items-center justify-between" id="difficulty-personal-best">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#f7d02c] fill-[#f7d02c]" />
                    <span className="text-xs text-[#5a4d41] font-black">Personal Best:</span>
                  </div>
                  <span className="font-mono text-lg font-black text-[#5a4d41] bg-white px-2.5 py-0.5 rounded border-2 border-[#5a4d41] shadow-sm">
                    {difficulty === 'zen' ? '-' : getHighScoreForDifficulty()} pts
                  </span>
                </div>

                <div className="text-[10px] text-[#5a4d41]/80 font-bold italic flex items-start gap-1 p-1 mt-1 border-t border-[#5a4d41]/20 leading-snug">
                  <Info className="w-3 h-3 text-[#5a4d41] flex-shrink-0 mt-0.5" />
                  {difficulty === 'easy' && "Slower obstacles, softer gravity, and wide pipe spacing. Perfect for learning."}
                  {difficulty === 'normal' && "Standard original physics spacing. Balanced challenge."}
                  {difficulty === 'hard' && "Lightning fast obstacle movement with narrow windows. For arcade pros!"}
                  {difficulty === 'zen' && "No collision damage! Flying forever to train and master jumping cadence."}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Center Section: Arcade Machine Cabinet Box */}
        <div className="lg:col-span-4 order-1 lg:order-2 flex flex-col items-center" id="arcade-cabinet-middle">
          
          {/* Main Visual CRT Bezel Machine Panel */}
          <div className="relative bg-[#ded895] border-[10px] border-[#5a4d41] rounded-[2.2rem] overflow-hidden shadow-[0_12px_0_rgba(0,0,0,0.2)] w-full max-w-[480px]" id="canvas-bezel">
            
            {/* CRT Screen Glare Shadow Mask (Pure styling) */}
            <div className="absolute inset-0 bg-linear-to-b from-white/3 via-transparent to-black/10 pointer-events-none z-20" />
            
            {/* Scanlines Overlay effect */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_60%,rgba(0,0,0,0.4)_100%)] z-20" />
            <div 
              className="absolute inset-0 pointer-events-none opacity-8 z-20" 
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, #000, #000 1px, transparent 1px, transparent 2px)`
              }}
            />

            {/* Tap/Click Game Play Canvas Wrapper */}
            <div 
              onClick={handleFlap}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                  e.preventDefault();
                  handleFlap();
                }
              }}
              className="relative w-full aspect-[4/5] cursor-pointer touch-none select-none bg-black overflow-hidden"
              id="clickable-screen-area"
            >
              
              {/* Actual HTML5 Game Canvas container */}
              <canvas 
                ref={canvasRef} 
                className="w-full h-full block"
                id="flappy-bird-canvas"
              />

              {/* Overlay Screen: Starting Prompt state */}
              {!hasStarted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10 p-5 text-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 bg-white rounded-3xl border-4 border-[#5a4d41] shadow-[0_8px_0_#5a4d41] text-center transform -rotate-1 max-w-[290px]"
                  >
                    <div className="w-14 h-14 rounded-full bg-[#f7d02c]/20 text-[#f7d02c] border-2 border-[#5a4d41] flex items-center justify-center mx-auto mb-3 animate-bounce">
                      <Play className="w-6 h-6 fill-[#5a4d41] text-[#5a4d41] translate-x-0.5" />
                    </div>
                    <span className="text-[10px] bg-[#ded895] px-3 py-1 rounded-full border-2 border-[#5a4d41] text-[#5a4d41] font-black uppercase tracking-wider">
                      Ready Player One
                    </span>
                    <h3 className="text-xl font-black text-[#5a4d41] mt-3 leading-none tracking-tight">TAP TO FLY!</h3>
                    <p className="text-[11px] text-[#5a4d41]/80 font-bold mt-2">
                      {isTouchDevice 
                        ? 'Tap anywhere on the play screen to flap wing and launch.' 
                        : 'Press Spacebar or Click Screen to flap wings.'
                      }
                    </p>
                  </motion.div>
                </div>
              )}

              {/* Overlay Screen: Paused state */}
              {isPaused && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 z-15 backdrop-blur-xs">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center p-6 bg-white border-4 border-[#5a4d41] rounded-[1.5rem] max-w-xs shadow-[0_8px_0_#5a4d41]"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#f7d02c]/25 text-[#f7d02c] border-2 border-[#5a4d41] flex items-center justify-center mx-auto mb-3">
                      <Pause className="w-5 h-5 fill-[#5a4d41] text-[#5a4d41]" />
                    </div>
                    <h4 className="text-lg font-black text-[#5a4d41] tracking-wide uppercase">Paused</h4>
                    <p className="text-xs text-[#5a4d41]/80 mt-1.5 font-bold leading-relaxed">
                      Session suspended. Tap the resume play button below or push Key P.
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerPauseToggle();
                      }}
                      id="resume-btn-overlay"
                      className="mt-4 w-full bg-[#73bf2e] hover:bg-[#86d63d] border-4 border-[#5a4d41] text-white font-black text-xs py-2 px-4 rounded-xl shadow-[0_3px_0_#5a4d41] transition-all cursor-pointer active:translate-y-0.5 active:shadow-none"
                    >
                      Resume Play
                    </button>
                  </motion.div>
                </div>
              )}

              {/* Overlay Screen: Game Over Loss state */}
              <AnimatePresence>
                {isGameOver && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 z-15 backdrop-blur-xs">
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-center px-6 py-6 bg-white border-4 border-[#5a4d41] rounded-[1.5rem] max-w-[280px] shadow-[0_8px_0_#5a4d41]"
                    >
                      <span className="text-4xl block animate-bounce mb-1">💥</span>
                      <h4 className="text-2xl font-black text-[#e57373] mt-2 tracking-tighter uppercase drop-shadow-[0_1px_0_#3e2723]">GAME OVER</h4>
                      <p className="text-xs text-[#5a4d41] font-bold mt-1">Collision wreckage detected.</p>
                      
                      {/* Score metrics recap */}
                      <div className="bg-[#ded895]/20 rounded-xl border-2 border-[#5a4d41] p-3 my-4 grid grid-cols-2 gap-2 text-[#5a4d41]">
                        <div className="text-center">
                          <span className="text-[10px] text-[#5a4d41]/70 block uppercase tracking-wider font-extrabold">Score</span>
                          <span className="text-2xl font-black text-[#5a4d41] font-mono">{score}</span>
                        </div>
                        <div className="text-center border-l-2 border-[#5a4d41]">
                          <span className="text-[10px] text-[#5a4d41]/70 block uppercase tracking-wider font-extrabold">Best Run</span>
                          <span className="text-2xl font-black text-[#73bf2e] font-mono">
                            {difficulty === 'zen' ? '-' : Math.max(score, getHighScoreForDifficulty())}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          physicsRef.current.shouldReset = true;
                        }}
                        id="restart-arcade-action"
                        className="w-full bg-[#f7d02c] hover:bg-[#ffe169] border-4 border-[#5a4d41] text-[#3e2723] font-black text-xs py-2.5 px-5 rounded-xl shadow-[0_4px_0_#5a4d41] transition-all cursor-pointer active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5 stroke-[3]" /> PLAY AGAIN
                      </button>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

                       {/* Bottom physical controls row under bezel */}
            </div>

            <div className="bg-[#ded895] px-4 py-3 flex items-center justify-between border-t-4 border-[#5a4d41]" id="arcade-physical-tray">
              
              {/* Play Pause button */}
              <button
                disabled={!hasStarted || isGameOver}
                onClick={triggerPauseToggle}
                id="arcade-physical-pause"
                className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 border-[#5a4d41] transition-all cursor-pointer shadow-[0_2.5px_0_#5a4d41] active:translate-y-0.5 active:shadow-none ${
                  !hasStarted || isGameOver
                    ? 'opacity-40 bg-white text-slate-400'
                    : isPaused
                    ? 'bg-[#f7d02c] text-[#3e2723]'
                    : 'bg-white text-[#5a4d41] hover:bg-[#ded895]/20'
                }`}
                title="Pause (Key P)"
              >
                {isPaused ? <Play className="w-4 h-4 fill-current text-[#5a4d41]" /> : <Pause className="w-4 h-4 fill-current text-[#5a4d41]" />}
              </button>

              {/* Interactive Audio Mute */}
              <button
                onClick={() => setMuted(!muted)}
                id="arcade-physical-mute"
                className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 border-[#5a4d41] transition-all cursor-pointer shadow-[0_2.5px_0_#5a4d41] active:translate-y-0.5 active:shadow-none ${
                  muted 
                    ? 'bg-[#e57373] text-white' 
                    : 'bg-white text-[#5a4d41] hover:bg-[#ded895]/20'
                }`}
                title={muted ? "Unmute" : "Mute Sound"}
              >
                {muted ? <VolumeX className="w-4 h-4 stroke-[2.5]" /> : <Volume2 className="w-4 h-4 stroke-[2.5]" />}
              </button>

              {/* Reset Restart Button */}
              <button
                onClick={() => { physicsRef.current.shouldReset = true; }}
                id="arcade-physical-reset"
                className="w-9 h-9 rounded-xl bg-white border-2 border-[#5a4d41] text-[#5a4d41] hover:bg-[#ded895]/20 flex items-center justify-center transition-all cursor-pointer shadow-[0_2.5px_0_#5a4d41] active:translate-y-0.5 active:shadow-none"
                title="Reset Workspace"
              >
                <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              </button>

              {/* Help button popup overlay */}
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                id="arcade-physical-help"
                className={`w-9 h-9 rounded-xl flex items-center justify-center border-2 border-[#5a4d41] transition-all cursor-pointer shadow-[0_2.5px_0_#5a4d41] active:translate-y-0.5 active:shadow-none ${
                  showInstructions 
                    ? 'bg-[#70c5ce] text-[#3e2723]' 
                    : 'bg-white text-[#5a4d41] hover:bg-[#ded895]/20'
                }`}
                title="How to Play"
              >
                <CircleHelp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

          </div>

          {/* Quick instructions inline list */}
          <div className="mt-3.5 flex items-center gap-2 text-[#5a4d41] text-[11px] font-black tracking-wide" id="gameplay-hotkeys-bar">
            <span>[SPACEBAR] flap</span>
            <span>•</span>
            <span>[P] pause</span>
          </div>

        </div>

        {/* Right Side: Lifetime Statistics Widget */}
        <div className="lg:col-span-4 order-3 flex flex-col gap-6" id="stats-dashboard">
          
          {/* Detailed Statistics Deck Card */}
          <div className="bg-white border-4 border-[#5a4d41] rounded-[1.5rem] p-5 shadow-[0_8px_0_#5a4d41] text-[#5a4d41]" id="leaderboard-deck">
            <h2 className="text-sm font-black uppercase tracking-wider mb-3.5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#e57373]" /> Arcade Stats Deck
            </h2>

            <div className="flex flex-col gap-3 font-sans">
              <div className="grid grid-cols-2 gap-3">
                
                {/* Games Played */}
                <div className="bg-[#ded895]/15 p-3 rounded-xl border-2 border-[#5a4d41] flex flex-col">
                  <span className="text-[10px] text-[#5a4d41]/70 uppercase tracking-wider font-extrabold">Played</span>
                  <span className="text-lg font-black text-[#5a4d41] mt-1">{stats.gamesPlayed}</span>
                  <p className="text-[9px] text-[#5a4d41]/60 font-medium mt-1 leading-none">Total sessions launched</p>
                </div>

                {/* Total Flaps */}
                <div className="bg-[#ded895]/15 p-3 rounded-xl border-2 border-[#5a4d41] flex flex-col">
                  <span className="text-[10px] text-[#5a4d41]/70 uppercase tracking-wider font-extrabold">Total Flaps</span>
                  <span className="text-lg font-black text-[#5a4d41] mt-1">{stats.totalFlaps}</span>
                  <p className="text-[9px] text-[#5a4d41]/60 font-medium mt-1 leading-none">Flaps record count</p>
                </div>

              </div>

              {/* Run Averages with high score recap */}
              <div className="bg-[#ded895]/15 p-3 rounded-xl border-2 border-[#5a4d41] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#5a4d41]/70 uppercase tracking-wider font-extrabold block">Average Score</span>
                  <p className="text-[9px] text-[#5a4d41]/60 font-medium leading-snug">Performance mean score</p>
                </div>
                <span className="font-mono text-xl font-black text-[#5a4d41] bg-[#ded895]/20 px-3 py-1 rounded border-2 border-[#5a4d41]/80">
                  {stats.averageScore} pts
                </span>
              </div>

              {/* Difficulty scoreboard records recap */}
              <div className="bg-[#ded895]/10 border-2 border-[#5a4d41] rounded-[1.2rem] p-3" id="scores-split-recap">
                <span className="text-[10px] text-[#5a4d41] uppercase tracking-wider font-black block mb-2 text-center border-b-2 border-[#5a4d41]/20 pb-1">
                  LEADERBOARD HIGHSCORES
                </span>
                
                <div className="flex flex-col gap-1.5 text-xs text-[#5a4d41]">
                  <div className="flex items-center justify-between p-1 hover:bg-[#ded895]/20 rounded">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#73bf2e] border border-[#5a4d41]" /> Easy Mode
                    </span>
                    <span className="font-black font-mono">{stats.highScoreEasy} pts</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-1 hover:bg-[#ded895]/20 rounded">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f7d02c] border border-[#5a4d41]" /> Normal Mode
                    </span>
                    <span className="font-black font-mono">{stats.highScoreNormal} pts</span>
                  </div>

                  <div className="flex items-center justify-between p-1 hover:bg-[#ded895]/20 rounded">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#e57373] border border-[#5a4d41]" /> Hard Mode
                    </span>
                    <span className="font-black font-mono">{stats.highScoreHard} pts</span>
                  </div>
                </div>
              </div>

              {/* Erase stats button */}
              <button
                onClick={() => {
                  if (confirm("Reset current statistics? Highly destructive!")) {
                    try {
                      localStorage.removeItem('flappy_records_v1');
                    } catch (e) {
                      // Ignored
                    }
                    setStats({
                      gamesPlayed: 0,
                      totalFlaps: 0,
                      averageScore: 0,
                      scoresList: [],
                      highScoreEasy: 0,
                      highScoreNormal: 0,
                      highScoreHard: 0,
                    });
                  }
                }}
                id="reset-stats-history-btn"
                className="w-full text-[10px] text-[#5a4d41]/50 hover:text-[#e57373] text-center uppercase tracking-wider font-black bg-[#ded895]/10 p-1.5 rounded-lg border-2 border-[#5a4d41]/20 hover:bg-rose-50 hover:border-[#e57373]/30 transition-colors cursor-pointer"
              >
                Clear Stats Board
              </button>

            </div>
          </div>

          {/* Interactive Tutorial Modal / Hint Panel */}
          <AnimatePresence>
            {(showInstructions) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border-4 border-[#5a4d41] rounded-[1.5rem] p-5 shadow-[0_8px_0_#5a4d41] relative text-[#5a4d41]"
                id="how-to-play-drawer"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[#70c5ce]">
                    <CircleHelp className="w-4 h-4" /> Arcade Mechanics Manual
                  </h3>
                  <button 
                    onClick={() => setShowInstructions(false)}
                    id="close-instructions-btn"
                    className="text-xs font-black text-[#5a4d41]/70 hover:text-rose-500 px-2 py-0.5 rounded bg-[#ded895]/20 border-2 border-[#5a4d41]/40 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                
                <ol className="text-xs space-y-2 mt-3 list-decimal list-inside leading-relaxed font-bold">
                  <li>Choose your preferred <strong className="text-black">Difficulty Matrix</strong> and customized Flyer Skin in the dashboard.</li>
                  <li>Click inside the <strong className="text-black">Arcade Screen</strong> or press the keyboard <kbd className="bg-[#ded895]/30 text-black px-1.5 py-0.5 rounded border-2 border-[#5a4d41] font-mono">SPACEBAR</kbd> key to flap and stay aloft.</li>
                  <li>Time each flap precisely to float cleanly through the open spacing between traveling barrier walls.</li>
                  <li>Passing each barrier grants <strong className="text-[#73bf2e]">+1 Point</strong>.</li>
                  <li>In Zen Mode, collisions are disabled, making it ideal for learning movement vectors.</li>
                </ol>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>
    </div>
  );
}
