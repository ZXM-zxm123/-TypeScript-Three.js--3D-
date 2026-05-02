import * as THREE from 'three';

declare const PhysicsModule: any;

interface BrickData {
    row: number;
    col: number;
    color: string;
}

interface Level {
    id: number;
    name: string;
    theme: string;
    bricks: BrickData[];
}

interface PowerUp {
    type: 'extend' | 'multiball' | 'slow';
    position: THREE.Vector3;
    active: boolean;
    mesh?: THREE.Mesh;
}

interface Ball {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    active: boolean;
}

class BreakoutGame {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private paddle: THREE.Mesh;
    private balls: Ball[] = [];
    private bricks: THREE.Mesh[] = [];
    private powerUps: PowerUp[] = [];
    private score: number = 0;
    private lives: number = 3;
    private currentLevel: number = 1;
    private gameState: 'menu' | 'playing' | 'paused' | 'levelComplete' | 'gameOver' = 'menu';
    private paddleWidth: number = 2.0;
    private originalPaddleWidth: number = 2.0;
    private physics: any = null;
    private physicsReady: boolean = false;
    private clock: THREE.Clock;
    private keyboard: { [key: string]: boolean } = {};
    private mouseX: number = 0;
    private theme: string = 'default';
    private highScores: { [level: number]: number } = {};
    private levels: Level[] = [];

    private ambientLight!: THREE.Light;
    private directionalLight!: THREE.Light;
    private pointLight!: THREE.Light;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.clock = new THREE.Clock();

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        const paddleGeometry = new THREE.BoxGeometry(2, 0.3, 0.5);
        const paddleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        this.paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
        this.paddle.position.set(0, -2, 0);
        this.paddle.castShadow = true;
        this.scene.add(this.paddle);

        this.setupLights();
        this.setupEventListeners();
        this.loadHighScores();
        this.applyTheme(this.theme);

        window.addEventListener('resize', () => this.onWindowResize());

        this.animate();
    }

    private setupLights(): void {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(5, 10, 7);
        this.directionalLight.castShadow = true;
        this.scene.add(this.directionalLight);

        this.pointLight = new THREE.PointLight(0xffffff, 0.5);
        this.pointLight.position.set(0, 5, 0);
        this.scene.add(this.pointLight);
    }

    private applyTheme(theme: string): void {
        this.theme = theme;
        const themes: { [key: string]: { bg: number; ambient: number; directional: number; point: number } } = {
            default: { bg: 0x1a1a2e, ambient: 0xffffff, directional: 0xffffff, point: 0xffffff },
            neon: { bg: 0x0a0a0f, ambient: 0x00ffff, directional: 0xff00ff, point: 0x00ff00 },
            cyberpunk: { bg: 0x0d0d1a, ambient: 0xff00ff, directional: 0x00ffff, point: 0xffff00 },
            retro: { bg: 0x2d1b4e, ambient: 0xffaa00, directional: 0xff6600, point: 0xff0066 },
            space: { bg: 0x000011, ambient: 0x4444ff, directional: 0xffffff, point: 0xff4444 }
        };

        const t = themes[theme] || themes.default;
        this.scene.background = new THREE.Color(t.bg);
        (this.ambientLight as THREE.AmbientLight).color.setHex(t.ambient);
        (this.directionalLight as THREE.DirectionalLight).color.setHex(t.directional);
        (this.pointLight as THREE.PointLight).color.setHex(t.point);
    }

    private setupEventListeners(): void {
        document.addEventListener('keydown', (e) => {
            this.keyboard[e.key] = true;
            if (e.key === 'Escape') this.togglePause();
        });

        document.addEventListener('keyup', (e) => {
            this.keyboard[e.key] = false;
        });

        document.addEventListener('mousemove', (e) => {
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        });

        document.addEventListener('click', () => {
            if (this.gameState === 'menu') {
                this.startGame();
            } else if (this.gameState === 'gameOver' || this.gameState === 'levelComplete') {
                this.nextLevel();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.gameState === 'playing' && e.key === ' ') {
                this.resetBall();
            }
        });
    }

    private async initPhysics(): Promise<void> {
        try {
            this.physics = await PhysicsModule();
            this.physicsReady = true;
        } catch (e) {
            console.error('Physics module not available, using JS fallback');
            this.physicsReady = false;
        }
    }

    private async loadLevels(): Promise<void> {
        try {
            const response = await fetch('/api/levels');
            const data = await response.json();
            this.levels = [...data.preset, ...data.userCreated];
        } catch (e) {
            console.error('Failed to load levels:', e);
        }
    }

    private loadHighScores(): void {
        const saved = localStorage.getItem('breakoutHighScores');
        if (saved) {
            this.highScores = JSON.parse(saved);
        }
    }

    private saveHighScores(): void {
        localStorage.setItem('breakoutHighScores', JSON.stringify(this.highScores));
    }

    private async startGame(): Promise<void> {
        await this.loadLevels();
        await this.initPhysics();
        this.score = 0;
        this.lives = 3;
        this.currentLevel = 1;
        this.gameState = 'playing';
        this.loadLevel(this.currentLevel);
        this.createBall();
    }

    private loadLevel(levelNum: number): void {
        this.clearBricks();
        this.clearBalls();
        this.clearPowerUps();
        this.paddleWidth = this.originalPaddleWidth;
        this.updatePaddleSize();

        const level = this.levels.find(l => l.id === levelNum);
        if (!level) return;

        if (level.theme) {
            this.applyTheme(level.theme);
        }

        if (this.physics && this.physicsReady) {
            this.physics._initPhysics(level.bricks.length);
        }

        const brickWidth = 0.9;
        const brickHeight = 0.3;
        const brickDepth = 0.3;
        const spacing = 0.1;
        const startX = -3.6;
        const startY = 3;

        level.bricks.forEach((brick, index) => {
            const geometry = new THREE.BoxGeometry(brickWidth, brickHeight, brickDepth);
            const material = new THREE.MeshStandardMaterial({ color: brick.color });
            const mesh = new THREE.Mesh(geometry, material);

            const x = startX + brick.col * (brickWidth + spacing);
            const y = startY - brick.row * (brickHeight + spacing);
            mesh.position.set(x, y, 0);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.bricks.push(mesh);
            this.scene.add(mesh);

            if (this.physics && this.physicsReady) {
                this.physics._addBrick(index, x, y, 0, brickWidth, brickHeight, brickDepth, 0);
            }
        });
    }

    private createBall(): void {
        const geometry = new THREE.SphereGeometry(0.25, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 1, 0);
        mesh.castShadow = true;
        this.scene.add(mesh);

        const ball: Ball = {
            mesh,
            velocity: new THREE.Vector3(2, 5, 0),
            active: true
        };
        this.balls.push(ball);

        if (this.physics && this.physicsReady) {
            this.physics._setBallPosition(0, 1, 0);
            this.physics._setBallVelocity(2, 5, 0);
        }
    }

    private resetBall(): void {
        const ball = this.balls.find(b => b.active);
        if (ball) {
            ball.mesh.position.set(this.paddle.position.x, this.paddle.position.y + 1, 0);
            ball.velocity.set(2, 5, 0);
        }

        if (this.physics && this.physicsReady) {
            this.physics._resetBall();
        }
    }

    private clearBricks(): void {
        this.bricks.forEach(brick => {
            this.scene.remove(brick);
            brick.geometry.dispose();
            (brick.material as THREE.Material).dispose();
        });
        this.bricks = [];
    }

    private clearBalls(): void {
        this.balls.forEach(ball => {
            this.scene.remove(ball.mesh);
            ball.mesh.geometry.dispose();
            (ball.mesh.material as THREE.Material).dispose();
        });
        this.balls = [];
    }

    private clearPowerUps(): void {
        this.powerUps.forEach(pu => {
            if (pu.mesh) {
                this.scene.remove(pu.mesh);
                pu.mesh.geometry.dispose();
                (pu.mesh.material as THREE.Material).dispose();
            }
        });
        this.powerUps = [];
    }

    private updatePaddleSize(): void {
        this.paddle.scale.x = this.paddleWidth / this.originalPaddleWidth;
        if (this.physics && this.physicsReady) {
            this.physics._setPaddleWidth(this.paddleWidth);
        }
    }

    private spawnPowerUp(position: THREE.Vector3): void {
        const types: Array<'extend' | 'multiball' | 'slow'> = ['extend', 'multiball', 'slow'];
        const type = types[Math.floor(Math.random() * types.length)];

        const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const colors = { extend: 0x00ff00, multiball: 0xff8800, slow: 0x00ffff };
        const material = new THREE.MeshStandardMaterial({ color: colors[type], emissive: colors[type], emissiveIntensity: 0.5 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);

        this.powerUps.push({ type, position: position.clone(), active: true, mesh });
    }

    private collectPowerUp(powerUp: PowerUp): void {
        powerUp.active = false;
        if (powerUp.mesh) {
            this.scene.remove(powerUp.mesh);
        }

        switch (powerUp.type) {
            case 'extend':
                this.paddleWidth = Math.min(this.paddleWidth + 0.5, 4);
                this.updatePaddleSize();
                setTimeout(() => {
                    this.paddleWidth = Math.max(this.paddleWidth - 0.5, this.originalPaddleWidth);
                    this.updatePaddleSize();
                }, 10000);
                break;
            case 'multiball':
                for (let i = 0; i < 2; i++) {
                    const geometry = new THREE.SphereGeometry(0.25, 32, 32);
                    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 });
                    const mesh = new THREE.Mesh(geometry, material);
                    const activeBall = this.balls.find(b => b.active);
                    if (activeBall) {
                        mesh.position.copy(activeBall.mesh.position);
                        this.scene.add(mesh);
                        this.balls.push({
                            mesh,
                            velocity: new THREE.Vector3(activeBall.velocity.x + (Math.random() - 0.5) * 2, activeBall.velocity.y, 0),
                            active: true
                        });
                    }
                }
                break;
            case 'slow':
                this.balls.forEach(ball => {
                    ball.velocity.multiplyScalar(0.6);
                });
                setTimeout(() => {
                    this.balls.forEach(ball => {
                        ball.velocity.multiplyScalar(1.5);
                    });
                }, 8000);
                break;
        }
    }

    private togglePause(): void {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
        }
    }

    private nextLevel(): void {
        if (this.gameState === 'gameOver') {
            this.currentLevel = 1;
            this.score = 0;
            this.lives = 3;
        } else {
            this.currentLevel++;
        }

        if (this.currentLevel > this.levels.length) {
            this.gameState = 'menu';
            return;
        }

        this.gameState = 'playing';
        this.loadLevel(this.currentLevel);
        this.createBall();
    }

    private checkCollisions(): void {
        const activeBalls = this.balls.filter(b => b.active);
        if (activeBalls.length === 0) {
            this.lives--;
            if (this.lives <= 0) {
                this.gameState = 'gameOver';
                if (this.score > (this.highScores[this.currentLevel] || 0)) {
                    this.highScores[this.currentLevel] = this.score;
                    this.saveHighScores();
                }
            } else {
                this.createBall();
            }
            return;
        }

        activeBalls.forEach(ball => {
            const paddleLeft = this.paddle.position.x - this.paddleWidth / 2;
            const paddleRight = this.paddle.position.x + this.paddleWidth / 2;
            const paddleTop = this.paddle.position.y + 0.15;

            if (ball.mesh.position.y - 0.25 <= paddleTop &&
                ball.mesh.position.y + 0.25 >= this.paddle.position.y - 0.15 &&
                ball.mesh.position.x + 0.25 >= paddleLeft &&
                ball.mesh.position.x - 0.25 <= paddleRight) {

                const hitPos = (ball.mesh.position.x - this.paddle.position.x) / (this.paddleWidth / 2);
                ball.velocity.y = -Math.abs(ball.velocity.y);
                ball.velocity.x += hitPos * 3;

                const speed = ball.velocity.length();
                if (speed > 15) {
                    ball.velocity.multiplyScalar(15 / speed);
                }
            }

            for (let i = this.bricks.length - 1; i >= 0; i--) {
                const brick = this.bricks[i];
                const brickBox = new THREE.Box3().setFromObject(brick);
                const ballSphere = new THREE.Sphere(ball.mesh.position, 0.25);

                if (brickBox.intersectsSphere(ballSphere)) {
                    const brickCenter = new THREE.Vector3();
                    brickBox.getCenter(brickCenter);

                    const dx = ball.mesh.position.x - brickCenter.x;
                    const dy = ball.mesh.position.y - brickCenter.y;

                    if (Math.abs(dx) > Math.abs(dy)) {
                        ball.velocity.x = -ball.velocity.x;
                    } else {
                        ball.velocity.y = -ball.velocity.y;
                    }

                    this.scene.remove(brick);
                    brick.geometry.dispose();
                    (brick.material as THREE.Material).dispose();
                    this.bricks.splice(i, 1);

                    this.score += 10;
                    this.spawnPowerUp(brickCenter);

                    break;
                }
            }

            this.powerUps.forEach(powerUp => {
                if (!powerUp.active || !powerUp.mesh) return;
                const dist = ball.mesh.position.distanceTo(powerUp.mesh.position);
                if (dist < 0.5) {
                    this.collectPowerUp(powerUp);
                }
            });
        });

        if (this.bricks.length === 0) {
            this.gameState = 'levelComplete';
            if (this.score > (this.highScores[this.currentLevel] || 0)) {
                this.highScores[this.currentLevel] = this.score;
                this.saveHighScores();
            }
        }
    }

    private updatePhysics(): void {
        if (this.physics && this.physicsReady) {
            this.physics._updateBallPaddleCollision();
            this.physics._updateBallBrickCollision();
        }
    }

    private update(delta: number): void {
        if (this.gameState !== 'playing') return;

        const moveSpeed = 10;
        if (this.keyboard['ArrowLeft'] || this.keyboard['a']) {
            this.paddle.position.x -= moveSpeed * delta;
        }
        if (this.keyboard['ArrowRight'] || this.keyboard['d']) {
            this.paddle.position.x += moveSpeed * delta;
        }

        this.paddle.position.x = THREE.MathUtils.clamp(this.paddle.position.x, -4 + this.paddleWidth / 2, 4 - this.paddleWidth / 2);

        if (this.physics && this.physicsReady) {
            this.physics._setPaddlePosition(this.paddle.position.x, this.paddle.position.y, this.paddle.position.z);
        }

        this.balls.forEach(ball => {
            if (!ball.active) return;

            ball.mesh.position.x += ball.velocity.x * delta;
            ball.mesh.position.y += ball.velocity.y * delta;
            ball.mesh.position.z += ball.velocity.z * delta;

            if (ball.mesh.position.x < -5 || ball.mesh.position.x > 5) {
                ball.velocity.x = -ball.velocity.x;
            }
            if (ball.mesh.position.z < -3 || ball.mesh.position.z > 3) {
                ball.velocity.z = -ball.velocity.z;
            }

            if (ball.mesh.position.y > 5) {
                ball.velocity.y = -ball.velocity.y;
            }

            if (ball.mesh.position.y < -4) {
                ball.active = false;
                this.scene.remove(ball.mesh);
            }
        });

        this.powerUps.forEach(powerUp => {
            if (!powerUp.active || !powerUp.mesh) return;
            powerUp.mesh.position.y -= 2 * delta;
            if (powerUp.mesh.position.y < -4) {
                powerUp.active = false;
                this.scene.remove(powerUp.mesh);
            }
        });

        this.checkCollisions();
        this.updatePhysics();
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private render(): void {
        const text = `
        Score: ${this.score} | Lives: ${this.lives} | Level: ${this.currentLevel}
        High Score: ${this.highScores[this.currentLevel] || 0}
        ${this.gameState === 'paused' ? 'PAUSED' : ''}
        ${this.gameState === 'gameOver' ? 'GAME OVER - Click to restart' : ''}
        ${this.gameState === 'levelComplete' ? 'LEVEL COMPLETE - Click for next level' : ''}
        ${this.gameState === 'menu' ? 'Click to Start' : ''}
        `;
        document.title = text.replace(/\s+/g, ' | ').trim();
    }

    private animate = (): void => {
        requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();
        this.update(delta);

        this.camera.position.z = 10;
        this.camera.position.y = 0;
        this.camera.lookAt(0, 0, 0);

        this.renderer.render(this.scene, this.camera);
        this.render();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new BreakoutGame();
});

export {};