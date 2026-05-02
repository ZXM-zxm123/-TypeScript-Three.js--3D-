class BreakoutGame {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        this.paddle = this.createPaddle();
        this.balls = [];
        this.bricks = [];
        this.powerUps = [];
        this.score = 0;
        this.lives = 3;
        this.currentLevel = 1;
        this.gameState = 'menu';
        this.paddleWidth = 2.0;
        this.originalPaddleWidth = 2.0;
        this.physics = window.PhysicsModule;
        this.physicsReady = false;
        this.clock = new THREE.Clock();
        this.keyboard = {};
        this.theme = 'default';
        this.highScores = {};
        this.levels = [];
        this.gridHelper = null;

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(5, 10, 7);
        this.directionalLight.castShadow = true;
        this.scene.add(this.directionalLight);
        this.pointLight = new THREE.PointLight(0xffffff, 0.5);
        this.pointLight.position.set(0, 5, 0);
        this.scene.add(this.pointLight);

        this.addFloor();
        this.setupEventListeners();
        this.loadHighScores();
        this.applyTheme(this.theme);

        window.addEventListener('resize', () => this.onWindowResize());
        window.gameInstance = this;

        this.initPhysics();
        this.animate();
    }

    createPaddle() {
        const geometry = new THREE.BoxGeometry(2, 0.3, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.2 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, -2, 0);
        mesh.castShadow = true;
        this.scene.add(mesh);
        return mesh;
    }

    addFloor() {
        const geometry = new THREE.PlaneGeometry(20, 20);
        const material = new THREE.MeshStandardMaterial({ color: 0x111122, side: THREE.DoubleSide });
        const floor = new THREE.Mesh(geometry, material);
        floor.rotation.x = Math.PI / 2;
        floor.position.y = -4;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        grid.position.y = -3.99;
        this.scene.add(grid);
        this.gridHelper = grid;
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keyboard[e.key] = true;
            if (e.key === 'Escape') this.togglePause();
        });
        document.addEventListener('keyup', (e) => {
            this.keyboard[e.key] = false;
        });
        document.addEventListener('mousemove', (e) => {
            const targetX = ((e.clientX / window.innerWidth) * 2 - 1) * 4;
            this.paddle.position.x = THREE.MathUtils.clamp(targetX, -4 + this.paddleWidth / 2, 4 - this.paddleWidth / 2);
        });
    }

    applyTheme(theme) {
        this.theme = theme;
        const themes = {
            default: { bg: 0x1a1a2e, ambient: 0xffffff, directional: 0xffffff, point: 0xffffff, grid: 0x444444 },
            neon: { bg: 0x0a0a0f, ambient: 0x00ffff, directional: 0xff00ff, point: 0x00ff00, grid: 0x004444 },
            cyberpunk: { bg: 0x0d0d1a, ambient: 0xff00ff, directional: 0x00ffff, point: 0xffff00, grid: 0x440044 },
            retro: { bg: 0x2d1b4e, ambient: 0xffaa00, directional: 0xff6600, point: 0xff0066, grid: 0x442200 },
            space: { bg: 0x000011, ambient: 0x4444ff, directional: 0xffffff, point: 0xff4444, grid: 0x000033 }
        };
        const t = themes[theme] || themes.default;
        this.scene.background = new THREE.Color(t.bg);
        if (this.gridHelper) {
            this.gridHelper.material.color.setHex(t.grid);
            this.gridHelper.material.needsUpdate = true;
        }
        this.ambientLight.color.setHex(t.ambient);
        this.directionalLight.color.setHex(t.directional);
        this.pointLight.color.setHex(t.point);
    }

    async initPhysics() {
        try {
            if (typeof PhysicsModule === 'function') {
                this.physics = await PhysicsModule();
                this.physicsReady = true;
            }
        } catch (e) {
            console.log('Using JavaScript physics');
            this.physicsReady = false;
        }
    }

    async loadLevels() {
        try {
            const response = await fetch('/api/levels');
            const data = await response.json();
            this.levels = [...data.preset, ...data.userCreated];
        } catch (e) {
            console.error('Failed to load levels:', e);
        }
    }

    loadHighScores() {
        const saved = localStorage.getItem('breakoutHighScores');
        if (saved) this.highScores = JSON.parse(saved);
    }

    saveHighScores() {
        localStorage.setItem('breakoutHighScores', JSON.stringify(this.highScores));
    }

    async startGame() {
        await this.loadLevels();
        this.score = 0;
        this.lives = 3;
        this.currentLevel = 1;
        this.gameState = 'playing';
        document.getElementById('start-screen').classList.add('hidden');
        this.loadLevel(this.currentLevel);
        this.createBall();
    }

    async startGameWithLevel(levelId) {
        await this.loadLevels();
        this.score = 0;
        this.lives = 3;
        this.currentLevel = levelId;
        this.gameState = 'playing';
        document.getElementById('start-screen').classList.add('hidden');
        this.loadLevel(this.currentLevel);
        this.createBall();
    }

    loadLevel(levelNum) {
        this.clearBricks();
        this.clearBalls();
        this.clearPowerUps();
        this.paddleWidth = this.originalPaddleWidth;
        this.updatePaddleSize();

        const level = this.levels.find(l => l.id === levelNum);
        if (!level) return;

        if (level.theme) this.applyTheme(level.theme);

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
        });
    }

    createBall() {
        const geometry = new THREE.SphereGeometry(0.25, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(this.paddle.position.x, this.paddle.position.y + 1, 0);
        mesh.castShadow = true;
        this.scene.add(mesh);

        const ball = {
            mesh,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 4, 5, 0),
            active: true
        };
        this.balls.push(ball);
    }

    resetBall() {
        const ball = this.balls.find(b => b.active);
        if (ball) {
            ball.mesh.position.set(this.paddle.position.x, this.paddle.position.y + 1, 0);
            ball.velocity.set((Math.random() - 0.5) * 4, 5, 0);
        }
    }

    clearBricks() {
        this.bricks.forEach(brick => {
            this.scene.remove(brick);
            brick.geometry.dispose();
            brick.material.dispose();
        });
        this.bricks = [];
    }

    clearBalls() {
        this.balls.forEach(ball => {
            this.scene.remove(ball.mesh);
            ball.mesh.geometry.dispose();
            ball.mesh.material.dispose();
        });
        this.balls = [];
    }

    clearPowerUps() {
        this.powerUps.forEach(pu => {
            if (pu.mesh) {
                this.scene.remove(pu.mesh);
                pu.mesh.geometry.dispose();
                pu.mesh.material.dispose();
            }
        });
        this.powerUps = [];
    }

    updatePaddleSize() {
        this.paddle.scale.x = this.paddleWidth / this.originalPaddleWidth;
    }

    spawnPowerUp(position) {
        const types = ['extend', 'multiball', 'slow'];
        const type = types[Math.floor(Math.random() * types.length)];

        const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const colors = { extend: 0x00ff00, multiball: 0xff8800, slow: 0x00ffff };
        const material = new THREE.MeshStandardMaterial({ color: colors[type], emissive: colors[type], emissiveIntensity: 0.5 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);

        this.powerUps.push({ type, position: position.clone(), active: true, mesh });
    }

    collectPowerUp(powerUp) {
        powerUp.active = false;
        if (powerUp.mesh) this.scene.remove(powerUp.mesh);

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

    togglePause() {
        if (this.gameState === 'playing') this.gameState = 'paused';
        else if (this.gameState === 'paused') this.gameState = 'playing';
    }

    nextLevel() {
        if (this.gameState === 'gameOver') {
            this.currentLevel = 1;
            this.score = 0;
            this.lives = 3;
        } else {
            this.currentLevel++;
        }

        if (this.currentLevel > this.levels.length) {
            this.gameState = 'menu';
            document.getElementById('start-screen').classList.remove('hidden');
            return;
        }

        this.gameState = 'playing';
        this.loadLevel(this.currentLevel);
        this.createBall();
    }

    checkCollisions() {
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
                if (speed > 15) ball.velocity.multiplyScalar(15 / speed);
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
                    brick.material.dispose();
                    this.bricks.splice(i, 1);

                    this.score += 10;
                    this.spawnPowerUp(brickCenter);
                    break;
                }
            }

            this.powerUps.forEach(powerUp => {
                if (!powerUp.active || !powerUp.mesh) return;
                const dist = ball.mesh.position.distanceTo(powerUp.mesh.position);
                if (dist < 0.5) this.collectPowerUp(powerUp);
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

    update(delta) {
        if (this.gameState !== 'playing') return;

        const moveSpeed = 10;
        if (this.keyboard['ArrowLeft'] || this.keyboard['a']) {
            this.paddle.position.x -= moveSpeed * delta;
        }
        if (this.keyboard['ArrowRight'] || this.keyboard['d']) {
            this.paddle.position.x += moveSpeed * delta;
        }

        this.paddle.position.x = THREE.MathUtils.clamp(this.paddle.position.x, -4 + this.paddleWidth / 2, 4 - this.paddleWidth / 2);

        this.balls.forEach(ball => {
            if (!ball.active) return;

            ball.mesh.position.x += ball.velocity.x * delta;
            ball.mesh.position.y += ball.velocity.y * delta;
            ball.mesh.position.z += ball.velocity.z * delta;

            if (ball.mesh.position.x < -5 || ball.mesh.position.x > 5) ball.velocity.x = -ball.velocity.x;
            if (ball.mesh.position.z < -3 || ball.mesh.position.z > 3) ball.velocity.z = -ball.velocity.z;
            if (ball.mesh.position.y > 5) ball.velocity.y = -ball.velocity.y;

            if (ball.mesh.position.y < -4) {
                ball.active = false;
                this.scene.remove(ball.mesh);
            }
        });

        this.powerUps.forEach(powerUp => {
            if (!powerUp.active || !powerUp.mesh) return;
            powerUp.mesh.position.y -= 2 * delta;
            powerUp.mesh.rotation.x += delta;
            powerUp.mesh.rotation.y += delta;
            if (powerUp.mesh.position.y < -4) {
                powerUp.active = false;
                this.scene.remove(powerUp.mesh);
            }
        });

        this.checkCollisions();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        let stateText = `Score: ${this.score} | Lives: ${this.lives} | Level: ${this.currentLevel} | High: ${this.highScores[this.currentLevel] || 0}`;
        if (this.gameState === 'paused') stateText += ' | PAUSED';
        if (this.gameState === 'gameOver') stateText = 'GAME OVER - Refresh to restart';
        if (this.gameState === 'levelComplete') stateText = 'LEVEL COMPLETE - Refresh for next level';
        document.title = stateText;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = Math.min(this.clock.getDelta(), 0.1);
        this.update(delta);

        this.camera.position.z = 12;
        this.camera.position.y = 2;
        this.camera.lookAt(0, 0, 0);

        this.renderer.render(this.scene, this.camera);
        this.render();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof THREE !== 'undefined') {
        new BreakoutGame();
    }
});