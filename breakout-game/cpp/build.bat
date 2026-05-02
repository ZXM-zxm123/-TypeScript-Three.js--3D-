@echo off
echo Building Physics WebAssembly Module...

set EMSDK_PATH=C:\emsdk
set EMSDK_ENV=%EMSDK_PATH%\emsdk_env.bat

if exist "%EMSCRIPTEN%" (
    call "%EMSCRIPTEN%\emsdk_env.bat"
) else if exist "%EMSDK_PATH%" (
    call "%EMSDK_PATH%\emsdk_env.bat"
)

cd /d "%~dp0"

echo Compiling physics.cpp to WebAssembly...
emcc physics.cpp -o ../wasm/physics.js ^
    -s WASM=1 ^
    -s EXPORTED_FUNCTIONS="['_malloc','_free','_initPhysics','_updateBallPaddleCollision','_updateBallBrickCollision','_getBallVelocityX','_getBallVelocityY','_getBallVelocityZ','_setBallPosition','_getBallPositionX','_getBallPositionY','_getBallPositionZ','_setBallVelocity','_setPaddlePosition','_setPaddleWidth','_addBrick','_getDestroyedBrickCount','_isBallLost','_areAllBricksDestroyed','_resetBall','_applyPaddleForce','_getBrickPositions']" ^
    -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap','getValue','setValue']" ^
    -s MODULARIZE=1 ^
    -s EXPORT_NAME=PhysicsModule ^
    -s ALLOW_MEMORY_GROWTH=1 ^
    -s LINKABLE=0 ^
    -s SIDE_MODULE=0 ^
    -O2

if %ERRORLEVEL% EQU 0 (
    echo Build successful! Output in ../wasm/
    dir /b ..\wasm\*
) else (
    echo Build failed!
    echo Make sure Emscripten SDK is installed.
    echo Download from: https://emscripten.org/docs/getting_started/downloads.html
    exit /b 1
)