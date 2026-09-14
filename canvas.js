/**
 * Interactive HTML5 UV Hand Canvas Engine
 * Handles vector hand rendering, UV germ particle layer, zone mapping & rubbing logic.
 */
class HandCanvasEngine {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');

        this.viewMode = 'palm'; // 'palm' or 'back'
        this.uvLightOn = true;
        this.isRubbing = false;
        this.activeZone = 'palm';

        // Base Canvas Logical Dimensions
        this.width = 600;
        this.height = 700;

        // Germ Particles Data Array
        this.particles = [];
        this.zonesData = {
            palm: { count: 0, cleared: 0, label: '손바닥' },
            back: { count: 0, cleared: 0, label: '손등' },
            webbing: { count: 0, cleared: 0, label: '손가락 사이' },
            knuckles: { count: 0, cleared: 0, label: '손가락 마디' },
            thumb: { count: 0, cleared: 0, label: '엄지손가락' },
            nails: { count: 0, cleared: 0, label: '손톱 밑' },
            wrist: { count: 0, cleared: 0, label: '손목' }
        };

        // Callbacks
        this.onScrubCallback = null;
        this.onProgressUpdateCallback = null;

        this.initCanvasSize();
        window.addEventListener('resize', () => this.initCanvasSize());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.initCanvasSize(), 150);
        });
        requestAnimationFrame(() => this.initCanvasSize());
    }

    initCanvasSize() {
        if (!this.container || !this.canvas) return;
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        let containerW = rect.width;
        let containerH = rect.height;

        // Fallbacks if container bounds are 0 or uncalculated during initial DOM load
        if (!containerW || containerW <= 0) {
            containerW = Math.min(window.innerWidth - 32, 600);
        }
        if (!containerH || containerH <= 0) {
            containerH = 380;
        }

        // Maintain 600x700 aspect ratio safely
        let w = containerW - 16;
        let h = w * (700 / 600);

        if (h > containerH - 16 && containerH > 32) {
            h = containerH - 16;
            w = h * (600 / 700);
        }

        // Prevent collapse on small/mobile screens
        w = Math.max(260, w);
        h = Math.max(300, h);

        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;

        this.scaleX = (w * dpr) / this.width;
        this.scaleY = (h * dpr) / this.height;

        this.render();
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.render();
    }

    setUVMode(on) {
        this.uvLightOn = on;
        this.render();
    }

    setActiveZone(zoneKey) {
        this.activeZone = zoneKey;
        this.render();
    }

    /**
     * Helper to get hand zone in canonical (single hand) coordinate space
     */
    getCanonicalZone(x, y) {
        // Wrist
        if (y >= 540 && y <= 670 && x >= 160 && x <= 440) {
            return 'wrist';
        }

        // Thumb area
        if ((x >= 110 && x <= 230) && (y >= 330 && y <= 480)) {
            return 'thumb';
        }
        if ((x >= 370 && x <= 490) && (y >= 330 && y <= 480)) {
            return 'thumb';
        }

        // Fingernails area (Top tips of fingers: y 80~165)
        if (y >= 80 && y <= 165) {
            if ((x >= 200 && x <= 260) || (x >= 270 && x <= 330) || (x >= 340 && x <= 400) || (x >= 410 && x <= 460)) {
                return 'nails';
            }
        }

        // Fingers & webbing
        if (y >= 165 && y <= 350) {
            const isGap = (x > 250 && x < 275) || (x > 325 && x < 345) || (x > 395 && x < 415);
            if (isGap) return 'webbing';

            if (this.viewMode === 'back' && (y >= 210 && y <= 270)) {
                return 'knuckles';
            }
        }

        // Main Palm / Back body
        if (y >= 350 && y <= 540 && x >= 160 && x <= 440) {
            return this.viewMode === 'palm' ? 'palm' : 'back';
        }

        // Fallback for upper fingers
        if (y >= 165 && y <= 350 && x >= 160 && x <= 440) {
            return this.viewMode === 'palm' ? 'palm' : 'back';
        }

        return null;
    }

    /**
     * Determine hand zone for given canvas point (x,y)
     */
    getZoneAtPoint(x, y) {
        const isClaspedPose = (this.activeZone === 'knuckles');

        if (isClaspedPose) {
            return this.getCanonicalZone(x, y);
        }

        if (x < 300) {
            // Left Hand
            const cx = (x - 165) / 0.72 + 300;
            const cy = (y - 360) / 0.72 + 370;
            return this.getCanonicalZone(cx, cy);
        } else {
            // Right Hand (Mirrored)
            const cx = 300 - (x - 435) / 0.72;
            const cy = (y - 360) / 0.72 + 370;
            return this.getCanonicalZone(cx, cy);
        }
    }

    /**
     * Generate UV Germ Particles distributed across BOTH hands
     */
    generateGermParticles() {
        this.particles = [];
        Object.keys(this.zonesData).forEach(k => {
            this.zonesData[k].count = 0;
            this.zonesData[k].cleared = 0;
        });

        const isClaspedPose = (this.activeZone === 'knuckles');

        if (isClaspedPose) {
            const count = 600;
            for (let i = 0; i < count; i++) {
                const x = 120 + Math.random() * 360;
                const y = 80 + Math.random() * 540;
                const zone = this.getCanonicalZone(x, y);
                if (zone) {
                    this.particles.push({
                        id: i,
                        x: x,
                        y: y,
                        size: 3 + Math.random() * 5.5,
                        zone: zone,
                        active: true,
                        glowOffset: Math.random() * Math.PI * 2,
                        colorType: Math.random() > 0.3 ? 'neon-green' : 'neon-cyan'
                    });
                    this.zonesData[zone].count++;
                }
            }
        } else {
            // Dual Symmetrical Hands (Left Hand + Right Hand) - Lower density for easy mode
            const countPerHand = 320;
            let particleId = 0;

            // Generate Left Hand Particles
            for (let i = 0; i < countPerHand; i++) {
                const cx = 110 + Math.random() * 380;
                const cy = 80 + Math.random() * 580;
                const zone = this.getCanonicalZone(cx, cy);
                if (zone) {
                    const px = (cx - 300) * 0.72 + 165;
                    const py = (cy - 370) * 0.72 + 360;
                    this.particles.push({
                        id: particleId++,
                        x: px,
                        y: py,
                        size: 3 + Math.random() * 5.5,
                        zone: zone,
                        active: true,
                        glowOffset: Math.random() * Math.PI * 2,
                        colorType: Math.random() > 0.3 ? 'neon-green' : 'neon-cyan'
                    });
                    this.zonesData[zone].count++;
                }
            }

            // Generate Right Hand Particles
            for (let i = 0; i < countPerHand; i++) {
                const cx = 110 + Math.random() * 380;
                const cy = 80 + Math.random() * 580;
                const zone = this.getCanonicalZone(cx, cy);
                if (zone) {
                    const px = 435 - (cx - 300) * 0.72;
                    const py = (cy - 370) * 0.72 + 360;
                    this.particles.push({
                        id: particleId++,
                        x: px,
                        y: py,
                        size: 3 + Math.random() * 5.5,
                        zone: zone,
                        active: true,
                        glowOffset: Math.random() * Math.PI * 2,
                        colorType: Math.random() > 0.3 ? 'neon-green' : 'neon-cyan'
                    });
                    this.zonesData[zone].count++;
                }
            }
        }
    }

    /**
     * Render Canvas Frame
     */
    render() {
        this.ctx.save();
        this.ctx.scale(this.scaleX, this.scaleY);
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Draw Background Grid & UV Ambient Glow
        this.drawBackground();

        // 2. Draw Vector Hands Shape
        this.drawHandVector();

        // 3. Draw UV Germ Particles Layer
        if (this.uvLightOn) {
            this.drawUVGermParticles();
        }

        this.ctx.restore();
    }

    drawBackground() {
        const bgGradient = this.ctx.createRadialGradient(300, 350, 50, 300, 350, 450);
        if (this.uvLightOn) {
            bgGradient.addColorStop(0, '#0f172a');
            bgGradient.addColorStop(0.6, '#090d16');
            bgGradient.addColorStop(1, '#030712');
        } else {
            bgGradient.addColorStop(0, '#1e293b');
            bgGradient.addColorStop(1, '#0f172a');
        }
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.uvLightOn) {
            this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
            this.ctx.lineWidth = 1;
            for (let i = 0; i < this.width; i += 40) {
                this.ctx.beginPath();
                this.ctx.moveTo(i, 0);
                this.ctx.lineTo(i, this.height);
                this.ctx.stroke();
            }
            for (let j = 0; j < this.height; j += 40) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, j);
                this.ctx.lineTo(this.width, j);
                this.ctx.stroke();
            }
        }
    }

    drawHandVector() {
        this.ctx.save();

        // High-contrast UV Skin Gradient
        const skinGrad = this.ctx.createLinearGradient(150, 100, 450, 600);
        if (this.uvLightOn) {
            skinGrad.addColorStop(0, '#312e81');
            skinGrad.addColorStop(0.5, '#1e1b4b');
            skinGrad.addColorStop(1, '#0f172a');
        } else {
            skinGrad.addColorStop(0, '#fef08a');
            skinGrad.addColorStop(0.5, '#fde047');
            skinGrad.addColorStop(1, '#eab308');
        }

        this.ctx.fillStyle = skinGrad;
        this.ctx.strokeStyle = this.uvLightOn ? '#38bdf8' : '#ca8a04';
        this.ctx.lineWidth = this.uvLightOn ? 5 : 4;
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';

        const isClaspedPose = (this.activeZone === 'knuckles');

        if (isClaspedPose) {
            // Draw Both Hands Clasped / Joined Together in Center
            this.drawClaspedHandsPath();
            this.drawHandDetails(true);
            this.drawActiveZoneGuide(true);
        } else {
            // 1. Draw Left Hand (100% Opacity)
            this.ctx.save();
            this.ctx.translate(165, 360);
            this.ctx.scale(0.72, 0.72);
            this.ctx.translate(-300, -370);
            this.drawSingleHandPath(true);
            this.drawHandDetails(false);
            this.drawActiveZoneGuide(false);
            this.ctx.restore();

            // 2. Draw Right Hand (100% Opacity - Mirrored Symmetrical Pair)
            this.ctx.save();
            this.ctx.translate(435, 360);
            this.ctx.scale(-0.72, 0.72);
            this.ctx.translate(-300, -370);
            this.drawSingleHandPath(true);
            this.drawHandDetails(false);
            this.drawActiveZoneGuide(false);
            this.ctx.restore();
        }

        this.ctx.restore();
    }

    drawSingleHandPath(doFillAndStroke = true) {
        this.ctx.beginPath();
        // Wrist Left
        this.ctx.moveTo(210, 670);
        this.ctx.lineTo(200, 540);

        // Thumb Outward Curve
        this.ctx.quadraticCurveTo(130, 470, 140, 390);
        this.ctx.quadraticCurveTo(150, 340, 195, 360);
        this.ctx.quadraticCurveTo(220, 380, 230, 430);

        // Index Finger
        this.ctx.lineTo(225, 200);
        this.ctx.quadraticCurveTo(230, 130, 255, 130);
        this.ctx.quadraticCurveTo(275, 130, 275, 200);

        // Middle Finger
        this.ctx.lineTo(290, 160);
        this.ctx.quadraticCurveTo(295, 90, 325, 90);
        this.ctx.quadraticCurveTo(350, 90, 350, 160);

        // Ring Finger
        this.ctx.lineTo(360, 190);
        this.ctx.quadraticCurveTo(365, 115, 390, 115);
        this.ctx.quadraticCurveTo(415, 115, 415, 190);

        // Pinky Finger
        this.ctx.lineTo(425, 250);
        this.ctx.quadraticCurveTo(430, 180, 450, 180);
        this.ctx.quadraticCurveTo(470, 180, 465, 260);

        // Outer Palm to Wrist Right
        this.ctx.quadraticCurveTo(460, 450, 400, 540);
        this.ctx.lineTo(390, 670);
        this.ctx.closePath();

        if (doFillAndStroke) {
            this.ctx.shadowColor = this.uvLightOn ? '#38bdf8' : 'rgba(0,0,0,0.2)';
            this.ctx.shadowBlur = this.uvLightOn ? 18 : 8;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            this.ctx.stroke();
        } else {
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    drawClaspedHandsPath() {
        this.ctx.beginPath();
        this.ctx.moveTo(180, 670);
        this.ctx.lineTo(170, 500);

        // Left Hand Thumb
        this.ctx.quadraticCurveTo(110, 430, 130, 370);
        this.ctx.quadraticCurveTo(150, 320, 190, 350);

        // Interlocked clasped fingers block in center
        this.ctx.lineTo(210, 220);
        this.ctx.quadraticCurveTo(220, 150, 250, 150);

        // Center interlocking knuckles
        this.ctx.quadraticCurveTo(300, 140, 350, 150);
        this.ctx.quadraticCurveTo(380, 150, 390, 220);

        // Right Hand Thumb
        this.ctx.lineTo(410, 350);
        this.ctx.quadraticCurveTo(450, 320, 470, 370);
        this.ctx.quadraticCurveTo(490, 430, 430, 500);

        // Wrist Right
        this.ctx.lineTo(420, 670);
        this.ctx.closePath();

        this.ctx.shadowColor = this.uvLightOn ? '#38bdf8' : 'rgba(0,0,0,0.2)';
        this.ctx.shadowBlur = this.uvLightOn ? 18 : 8;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        this.ctx.stroke();
    }

    drawHandDetails(isClaspedPose = false) {
        this.ctx.strokeStyle = this.uvLightOn ? 'rgba(56, 189, 248, 0.5)' : 'rgba(161, 98, 7, 0.4)';
        this.ctx.lineWidth = 2;

        const nailPositions = [
            { x: 165, y: 355, w: 22, h: 25 },
            { x: 238, y: 140, w: 24, h: 30 },
            { x: 308, y: 100, w: 26, h: 32 },
            { x: 375, y: 125, w: 24, h: 30 },
            { x: 440, y: 190, w: 20, h: 24 }
        ];

        if (!isClaspedPose) {
            nailPositions.forEach(n => {
                this.ctx.fillStyle = this.uvLightOn ? 'rgba(30, 41, 59, 0.8)' : 'rgba(254, 240, 138, 0.6)';
                this.ctx.beginPath();
                this.ctx.ellipse(n.x + n.w / 2, n.y + n.h / 2, n.w / 2, n.h / 2, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
            });
        }

        // Palm Creases or Knuckle Wrinkles
        if (this.viewMode === 'palm' && !isClaspedPose) {
            this.ctx.beginPath();
            this.ctx.arc(260, 480, 80, -0.6, 0.8);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(360, 380, 90, 0.8, 2.2);
            this.ctx.stroke();
        } else {
            // Knuckle Arcs
            const knuckleY = [240, 210, 230, 280];
            const knuckleX = [252, 320, 390, 450];
            knuckleX.forEach((kx, idx) => {
                this.ctx.beginPath();
                this.ctx.arc(kx, knuckleY[idx], 14, 0.2, 2.9);
                this.ctx.stroke();
            });
        }
    }

    drawActiveZoneGuide(isClaspedPose = false) {
        if (!this.activeZone) return;

        const nailPositions = [
            { x: 165, y: 355, w: 22, h: 25 },
            { x: 238, y: 140, w: 24, h: 30 },
            { x: 308, y: 100, w: 26, h: 32 },
            { x: 375, y: 125, w: 24, h: 30 },
            { x: 440, y: 190, w: 20, h: 24 }
        ];

        const time = Date.now() * 0.005;
        const pulse = Math.sin(time) * 4;

        this.ctx.save();
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([6, 6]);

        if (this.activeZone === 'nails') {
            nailPositions.forEach(n => {
                this.ctx.beginPath();
                this.ctx.ellipse(n.x + n.w / 2, n.y + n.h / 2, n.w / 2 + 8 + pulse, n.h / 2 + 8 + pulse, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
            });
        } else if (this.activeZone === 'thumb') {
            this.ctx.beginPath();
            this.ctx.arc(170, 410, 45 + pulse, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        } else if (this.activeZone === 'webbing') {
            [262, 335, 405].forEach(gx => {
                this.ctx.beginPath();
                this.ctx.arc(gx, 250, 22 + pulse, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
            });
        } else if (this.activeZone === 'wrist') {
            this.ctx.beginPath();
            this.ctx.roundRect ? this.ctx.roundRect(190, 560, 220, 90, 15) : this.ctx.rect(190, 560, 220, 90);
            this.ctx.fill();
            this.ctx.stroke();
        } else if (this.activeZone === 'palm' && this.viewMode === 'palm') {
            this.ctx.beginPath();
            this.ctx.arc(300, 430, 80 + pulse, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        } else if (this.activeZone === 'back' && this.viewMode === 'back') {
            this.ctx.beginPath();
            this.ctx.arc(300, 430, 80 + pulse, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        } else if (this.activeZone === 'knuckles' && isClaspedPose) {
            this.ctx.beginPath();
            this.ctx.arc(300, 230, 90 + pulse, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    /**
     * Draw glowing UV Germ Particles Layer
     */
    drawUVGermParticles() {
        const time = Date.now() * 0.003;

        this.particles.forEach(p => {
            if (!p.active) return;

            // Filter view mode visibility
            if (this.viewMode === 'palm' && p.zone === 'back') return;
            if (this.viewMode === 'back' && p.zone === 'palm') return;

            const pulse = Math.sin(time + p.glowOffset) * 1.5;
            const r = p.size + pulse;

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);

            // Glowing Neon Colors
            if (p.colorType === 'neon-green') {
                this.ctx.fillStyle = 'rgba(52, 211, 153, 0.85)';
                this.ctx.shadowColor = '#10b981';
            } else {
                this.ctx.fillStyle = 'rgba(34, 211, 238, 0.85)';
                this.ctx.shadowColor = '#06b6d4';
            }

            this.ctx.shadowBlur = 10 + pulse * 2;
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    /**
     * Bind Mouse & Touch events for scrubbing / erasing germ particles
     */
    bindInputEvents() {
        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const touch = (e.touches && e.touches.length > 0)
                ? e.touches[0]
                : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0] : null);

            const clientX = touch ? touch.clientX : e.clientX;
            const clientY = touch ? touch.clientY : e.clientY;

            if (clientX === undefined || clientY === undefined) {
                return { x: 0, y: 0, clientX: 0, clientY: 0 };
            }

            const scaleX = rect.width > 0 ? (this.width / rect.width) : 1;
            const scaleY = rect.height > 0 ? (this.height / rect.height) : 1;

            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;
            return { x, y, clientX, clientY };
        };

        const handleStart = (e) => {
            this.isRubbing = true;
            const pos = getCanvasCoords(e);
            this.processScrubAtPoint(pos.x, pos.y, pos.clientX, pos.clientY);
        };

        const handleMove = (e) => {
            if (!this.isRubbing) return;
            const pos = getCanvasCoords(e);
            this.processScrubAtPoint(pos.x, pos.y, pos.clientX, pos.clientY);
        };

        const handleEnd = () => {
            this.isRubbing = false;
        };

        this.canvas.addEventListener('mousedown', handleStart);
        this.canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.cancelable) e.preventDefault();
            handleStart(e);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.cancelable) e.preventDefault();
            handleMove(e);
        }, { passive: false });

        window.addEventListener('touchend', handleEnd, { passive: true });
        window.addEventListener('touchcancel', handleEnd, { passive: true });
    }

    /**
     * Scrub at (x,y) point and erase particles if zone matches current step
     */
    processScrubAtPoint(x, y, clientX, clientY) {
        let zone = this.getZoneAtPoint(x, y);
        if (!zone) {
            // Check slight offset to make touch scrubbing more forgiving on mobile screens
            const offsets = [[-15, 0], [15, 0], [0, -15], [0, 15], [-20, -20], [20, 20]];
            for (const [dx, dy] of offsets) {
                zone = this.getZoneAtPoint(x + dx, y + dy);
                if (zone) break;
            }
        }
        if (!zone) return;

        if (this.onScrubCallback) {
            const result = this.onScrubCallback(zone, x, y);
            if (result && result.allowed) {
                // Scrub radius 85px (generous radius for mobile touch & desktop)
                const scrubRadius = 85;
                let erasedAny = false;

                this.particles.forEach(p => {
                    if (!p.active) return;
                    const dist = Math.hypot(p.x - x, p.y - y);
                    if (dist <= scrubRadius && p.zone === zone) {
                        p.active = false;
                        this.zonesData[zone].cleared++;
                        erasedAny = true;
                    }
                });

                if (erasedAny) {
                    this.createSoapBubbleEffect(clientX, clientY);
                    this.updateProgress();
                    this.render();
                }
            }
        }
    }

    createSoapBubbleEffect(clientX, clientY) {
        const bubbleLayer = document.getElementById('bubble-layer');
        if (!bubbleLayer) return;

        const bubble = document.createElement('div');
        bubble.className = 'soap-bubble';

        const size = 15 + Math.random() * 25;
        const rect = bubbleLayer.getBoundingClientRect();
        const posX = clientX - rect.left - size / 2;
        const posY = clientY - rect.top - size / 2;

        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${posX}px`;
        bubble.style.top = `${posY}px`;

        bubbleLayer.appendChild(bubble);

        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.parentNode.removeChild(bubble);
            }
        }, 1200);
    }

    updateProgress() {
        let total = 0;
        let cleared = 0;

        Object.keys(this.zonesData).forEach(k => {
            total += this.zonesData[k].count;
            cleared += this.zonesData[k].cleared;
        });

        const percent = total > 0 ? Math.min(100, Math.round((cleared / total) * 100)) : 100;

        if (this.onProgressUpdateCallback) {
            this.onProgressUpdateCallback(percent, this.zonesData);
        }
    }
}

