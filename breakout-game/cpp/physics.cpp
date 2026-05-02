#include <emscripten.h>
#include <cmath>
#include <cstdlib>

struct Vec3 {
    float x, y, z;
};

struct Ball {
    Vec3 position;
    Vec3 velocity;
    float radius;
    bool active;
};

struct Paddle {
    Vec3 position;
    float width;
    float height;
    float depth;
};

struct Brick {
    Vec3 position;
    float width;
    float height;
    float depth;
    bool active;
    int colorIndex;
};

struct PhysicsState {
    Ball ball;
    Paddle paddle;
    Brick* bricks;
    int brickCount;
    Vec3 gravity;
    float restitution;
    int destroyedBricks;
};

static PhysicsState* state = nullptr;

extern "C" {

EMSCRIPTEN_KEEPALIVE
void initPhysics(int brickCount) {
    if (state) {
        free(state->bricks);
        free(state);
    }
    
    state = (PhysicsState*)malloc(sizeof(PhysicsState));
    state->brickCount = brickCount;
    state->bricks = (Brick*)malloc(sizeof(Brick) * brickCount);
    state->gravity = {0.0f, -9.8f, 0.0f};
    state->restitution = 0.8f;
    state->destroyedBricks = 0;
    
    state->ball.radius = 0.25f;
    state->ball.active = true;
    state->ball.position = {0.0f, 1.0f, 0.0f};
    state->ball.velocity = {2.0f, 5.0f, 0.0f};
    
    state->paddle.width = 2.0f;
    state->paddle.height = 0.3f;
    state->paddle.depth = 0.5f;
    state->paddle.position = {0.0f, -2.0f, 0.0f};
}

EMSCRIPTEN_KEEPALIVE
void setBallPosition(float x, float y, float z) {
    if (!state) return;
    state->ball.position.x = x;
    state->ball.position.y = y;
    state->ball.position.z = z;
}

EMSCRIPTEN_KEEPALIVE
float getBallPositionX() { return state ? state->ball.position.x : 0.0f; }
EMSCRIPTEN_KEEPALIVE
float getBallPositionY() { return state ? state->ball.position.y : 0.0f; }
EMSCRIPTEN_KEEPALIVE
float getBallPositionZ() { return state ? state->ball.position.z : 0.0f; }

EMSCRIPTEN_KEEPALIVE
float getBallVelocityX() { return state ? state->ball.velocity.x : 0.0f; }
EMSCRIPTEN_KEEPALIVE
float getBallVelocityY() { return state ? state->ball.velocity.y : 0.0f; }
EMSCRIPTEN_KEEPALIVE
float getBallVelocityZ() { return state ? state->ball.velocity.z : 0.0f; }

EMSCRIPTEN_KEEPALIVE
void setBallVelocity(float x, float y, float z) {
    if (!state) return;
    state->ball.velocity.x = x;
    state->ball.velocity.y = y;
    state->ball.velocity.z = z;
}

EMSCRIPTEN_KEEPALIVE
void setPaddlePosition(float x, float y, float z) {
    if (!state) return;
    state->paddle.position.x = x;
    state->paddle.position.y = y;
    state->paddle.position.z = z;
}

EMSCRIPTEN_KEEPALIVE
void setPaddleWidth(float width) {
    if (!state) return;
    state->paddle.width = width;
}

EMSCRIPTEN_KEEPALIVE
void addBrick(int index, float x, float y, float z, float w, float h, float d, int colorIdx) {
    if (!state || index < 0 || index >= state->brickCount) return;
    state->bricks[index].position = {x, y, z};
    state->bricks[index].width = w;
    state->bricks[index].height = h;
    state->bricks[index].depth = d;
    state->bricks[index].active = true;
    state->bricks[index].colorIndex = colorIdx;
}

EMSCRIPTEN_KEEPALIVE
int updateBallPaddleCollision() {
    if (!state || !state->ball.active) return 0;
    
    Ball& ball = state->ball;
    Paddle& paddle = state->paddle;
    
    float paddleLeft = paddle.position.x - paddle.width / 2.0f;
    float paddleRight = paddle.position.x + paddle.width / 2.0f;
    float paddleTop = paddle.position.y + paddle.height / 2.0f;
    float paddleBottom = paddle.position.y - paddle.height / 2.0f;
    
    if (ball.position.y - ball.radius <= paddleTop &&
        ball.position.y + ball.radius >= paddleBottom &&
        ball.position.x + ball.radius >= paddleLeft &&
        ball.position.x - ball.radius <= paddleRight &&
        ball.position.z - ball.radius <= paddle.depth / 2.0f &&
        ball.position.z + ball.radius >= -paddle.depth / 2.0f) {
        
        float hitPos = (ball.position.x - paddle.position.x) / (paddle.width / 2.0f);
        
        ball.velocity.y = -ball.velocity.y * state->restitution;
        ball.velocity.x += hitPos * 3.0f;
        
        float speed = sqrt(ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y);
        if (speed > 15.0f) {
            ball.velocity.x *= 15.0f / speed;
            ball.velocity.y *= 15.0f / speed;
        }
        
        return 1;
    }
    
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int updateBallBrickCollision() {
    if (!state || !state->ball.active) return -1;
    
    Ball& ball = state->ball;
    int hitIndex = -1;
    
    for (int i = 0; i < state->brickCount; i++) {
        Brick& brick = state->bricks[i];
        if (!brick.active) continue;
        
        float brickLeft = brick.position.x - brick.width / 2.0f;
        float brickRight = brick.position.x + brick.width / 2.0f;
        float brickTop = brick.position.y + brick.height / 2.0f;
        float brickBottom = brick.position.y - brick.height / 2.0f;
        float brickFront = brick.position.z + brick.depth / 2.0f;
        float brickBack = brick.position.z - brick.depth / 2.0f;
        
        float closestX = fmax(brickLeft, fmin(ball.position.x, brickRight));
        float closestY = fmax(brickBottom, fmin(ball.position.y, brickTop));
        float closestZ = fmax(brickBack, fmin(ball.position.z, brickFront));
        
        float distX = ball.position.x - closestX;
        float distY = ball.position.y - closestY;
        float distZ = ball.position.z - closestZ;
        float distSquared = distX * distX + distY * distY + distZ * distZ;
        
        if (distSquared < ball.radius * ball.radius) {
            brick.active = false;
            hitIndex = i;
            state->destroyedBricks++;
            
            float overlapLeft = ball.position.x + ball.radius - brickLeft;
            float overlapRight = brickRight - (ball.position.x - ball.radius);
            float overlapBottom = ball.position.y + ball.radius - brickBottom;
            float overlapTop = brickTop - (ball.position.y - ball.radius);
            
            float minOverlapX = fmin(overlapLeft, overlapRight);
            float minOverlapY = fmin(overlapBottom, overlapTop);
            
            if (minOverlapX < minOverlapY) {
                ball.velocity.x = -ball.velocity.x * state->restitution;
            } else {
                ball.velocity.y = -ball.velocity.y * state->restitution;
            }
            
            break;
        }
    }
    
    return hitIndex;
}

EMSCRIPTEN_KEEPALIVE
int getDestroyedBrickCount() {
    return state ? state->destroyedBricks : 0;
}

EMSCRIPTEN_KEEPALIVE
int isBallLost() {
    if (!state) return 0;
    return state->ball.position.y < -5.0f ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int areAllBricksDestroyed() {
    if (!state) return 0;
    for (int i = 0; i < state->brickCount; i++) {
        if (state->bricks[i].active) return 0;
    }
    return 1;
}

EMSCRIPTEN_KEEPALIVE
void resetBall() {
    if (!state) return;
    state->ball.position = {0.0f, 1.0f, 0.0f};
    state->ball.velocity = {2.0f, 5.0f, 0.0f};
    state->ball.active = true;
}

EMSCRIPTEN_KEEPALIVE
void applyPaddleForce(float forceX) {
    if (!state) return;
    state->ball.velocity.x += forceX * 0.5f;
}

EMSCRIPTEN_KEEPALIVE
float* getBrickPositions() {
    static float positions[100 * 6];
    if (!state) return positions;
    
    for (int i = 0; i < state->brickCount && i < 100; i++) {
        positions[i * 6 + 0] = state->bricks[i].position.x;
        positions[i * 6 + 1] = state->bricks[i].position.y;
        positions[i * 6 + 2] = state->bricks[i].position.z;
        positions[i * 6 + 3] = state->bricks[i].width;
        positions[i * 6 + 4] = state->bricks[i].height;
        positions[i * 6 + 5] = state->bricks[i].active ? 1.0f : 0.0f;
    }
    return positions;
}

}