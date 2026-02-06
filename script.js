const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const playerLengthDisplay = document.getElementById('player-length');
const aiEatFoodCheckbox = document.getElementById('ai-eat-food');
const aiEatPlayersCheckbox = document.getElementById('ai-eat-players');
// Cheat Menu Elements
const setSizeInput = document.getElementById('set-size-input');
const setSizeBtn = document.getElementById('set-size-btn');
const freezeAiCheckbox = document.getElementById('freeze-ai');
const spawnAiFixedSizeCheckbox = document.getElementById('spawn-ai-fixed-size');
const spawnAiSizeInput = document.getElementById('spawn-ai-size-input');
const spawnAiCountInput = document.getElementById('spawn-ai-count-input');
const spawnAiBtn = document.getElementById('spawn-ai-btn');
const spawnFoodValueInput = document.getElementById('spawn-food-value-input');
const spawnFoodCountInput = document.getElementById('spawn-food-count-input');
const spawnFoodBtn = document.getElementById('spawn-food-btn');


// --- Game Constants ---
const gridSize = 20;
const world = { width: 8000, height: 6000 }; // Much bigger map
const shieldThreshold = 50;
const maxAiSnakes = 30;
const maxFood = 150;
const foodTypes = [
    { value: 1, color: 'lightgreen' },
    { value: 3, color: 'orange' },
    { value: 5, color: 'red' }
];

// --- Game State ---
let player, aiSnakes, foods, keys;
const camera = { x: 0, y: 0 };
let isAiFrozen = false; // Cheat flag

// --- Helper Functions ---
function isOccupied(x, y, allSnakes) {
    for (const snake of allSnakes) {
        if (!snake) continue;
        for (const segment of snake.body) {
            if (segment.x === x && segment.y === y) return true;
        }
    }
    return false;
}

// --- Game Setup ---
function init() {
    player = {
        id: 'player',
        body: [{ x: Math.floor(world.width / gridSize / 2), y: Math.floor(world.height / gridSize / 2) }],
        dx: 0, dy: 0, length: 5, color: 'green'
    };
    aiSnakes = [];
    foods = [];
    keys = { w: false, a: false, s: false, d: false };

    for (let i = 0; i < maxAiSnakes; i++) respawnAi(true);
    spawnFoods(maxFood);

    playerLengthDisplay.textContent = player.length;
    setSizeInput.value = player.length; // Set initial cheat value
    window.requestAnimationFrame(gameLoop);
}

function spawnFoods(count = 1) {
    for (let i = 0; i < count; i++) {
        if (foods.length >= maxFood) break;
        const allSnakes = [player, ...aiSnakes].filter(s => s);
        let newFood;
        do {
            newFood = {
                x: Math.floor(Math.random() * (world.width / gridSize)),
                y: Math.floor(Math.random() * (world.height / gridSize))
            };
        } while (isOccupied(newFood.x, newFood.y, allSnakes));
        const type = foodTypes[Math.floor(Math.random() * foodTypes.length)];
        newFood.value = type.value;
        newFood.color = type.color;
        foods.push(newFood);
    }
}

// --- Game Loop ---
let lastRenderTime = 0;
const gameSpeed = 10;

function gameLoop(currentTime) {
    const frame = window.requestAnimationFrame(gameLoop);
    const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
    if (secondsSinceLastRender < 1 / gameSpeed) return;
    lastRenderTime = currentTime;

    if (update()) {
        window.cancelAnimationFrame(frame);
        return;
    }
    draw();
}

function update() {
    if (!player) return true;
    handleInput();
    moveSnake(player);
    
    if (!isAiFrozen) { // Check if AI is frozen
        aiSnakes.forEach(ai => {
            updateAi(ai);
            moveSnake(ai);
        });
    }

    if (checkCollisions()) {
        return true;
    }
    if (!isAiFrozen) {
        respawnAi();
    }
    updateCamera();
    return false;
}

function updateCamera() {
    camera.x = player.body[0].x * gridSize - canvas.width / 2;
    camera.y = player.body[0].y * gridSize - canvas.height / 2;
    camera.x = Math.max(0, Math.min(camera.x, world.width - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, world.height - canvas.height));
}

// --- Drawing ---
function draw() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawGrid();
    foods.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x * gridSize, f.y * gridSize, gridSize, gridSize);
        if (f.isManual) {
            ctx.fillStyle = 'red';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('M', f.x * gridSize + gridSize / 2, f.y * gridSize + gridSize / 1.5);
        }
    });
    if (player) drawSnake(player);
    aiSnakes.forEach(ai => drawSnake(ai));
    ctx.restore();
}

function drawGrid() {
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let x = 0; x <= world.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, world.height);
        ctx.stroke();
    }
    for (let y = 0; y <= world.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(world.width, y);
        ctx.stroke();
    }
}

function drawSnake(snake) {
    if (!snake) return;
    ctx.fillStyle = snake.color;
    snake.body.forEach(segment => {
        ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 2, gridSize - 2);
    });

    if (snake.length < shieldThreshold) {
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(snake.body[0].x * gridSize + gridSize / 2, snake.body[0].y * gridSize + gridSize / 2, gridSize * 0.7, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Draw length text
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    const head = snake.body[0];
    ctx.fillText(snake.length, head.x * gridSize + gridSize / 2, head.y * gridSize - 5);
}

// --- Logic ---
function moveSnake(snake) {
    if (!snake || (snake.dx === 0 && snake.dy === 0)) return;
    const head = { x: snake.body[0].x + snake.dx, y: snake.body[0].y + snake.dy };
    snake.body.unshift(head);
    while (snake.body.length > snake.length) {
        snake.body.pop();
    }
}

function handleInput() {
    let dx = 0;
    let dy = 0;
    if (keys.w) dy--;
    if (keys.s) dy++;
    if (keys.a) dx--;
    if (keys.d) dx++;
    if ((dx !== 0 || dy !== 0) && (player.body.length <= 1 || (dx !== -player.dx || dy !== -player.dy))) {
        player.dx = dx;
        player.dy = dy;
    }
}

function updateAi(ai) {
    const allSnakes = [player, ...aiSnakes].filter(s => s);
    const head = ai.body[0];
    const dangerRadius = 10; // in grid units

    // Flee Logic
    let biggestThreat = null;
    let threatDist = Infinity;

    for (const snake of allSnakes) {
        if (snake.id === ai.id || snake.length <= ai.length) continue; // Not a threat

        const dist = Math.hypot(head.x - snake.body[0].x, head.y - snake.body[0].y);
        if (dist < dangerRadius && dist < threatDist) {
            biggestThreat = snake;
            threatDist = dist;
        }
    }

    if (biggestThreat) {
        const fleeDx = Math.sign(head.x - biggestThreat.body[0].x);
        const fleeDy = Math.sign(head.y - biggestThreat.body[0].y);
        
        if (ai.body.length <= 1 || (fleeDx !== -ai.dx || fleeDy !== -ai.dy)) {
            ai.dx = fleeDx;
            ai.dy = fleeDy;
        } else {
            ai.dx = ai.dy !== 0 ? 1 : 0;
            ai.dy = ai.dx !== 0 ? 1 : 0;
        }
        return; // Fleeing is top priority
    }
    
    // Hunt Logic
    let target = null;
    let huntDist = Infinity;

    if (aiEatFoodCheckbox.checked) {
        foods.forEach(f => {
            const dist = Math.hypot(head.x - f.x, head.y - f.y);
            if (dist < huntDist) {
                target = f;
                huntDist = dist;
            }
        });
    }

    if (aiEatPlayersCheckbox.checked) {
        allSnakes.forEach(snake => {
            if (snake && snake.id !== ai.id && ai.length > snake.length && snake.length >= shieldThreshold) {
                const dist = Math.hypot(head.x - snake.body[0].x, head.y - snake.body[0].y);
                if (dist < huntDist) {
                    target = snake.body[0];
                    huntDist = dist;
                }
            }
        });
    }

    if (target) {
        const nextDx = Math.sign(target.x - head.x);
        const nextDy = Math.sign(target.y - head.y);
        if (ai.body.length <= 1 || (nextDx !== -ai.dx || nextDy !== -ai.dy)) {
            ai.dx = nextDx;
            ai.dy = nextDy;
        }
    } else { // Wander
        if (Math.random() < 0.1) {
            const dirs = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
            const newDir = dirs[Math.floor(Math.random() * dirs.length)];
            if (ai.body.length <= 1 || (ai.dx !== -newDir.x || ai.dy !== -newDir.y)) {
                ai.dx = newDir.x;
                ai.dy = newDir.y;
            }
        }
    }
}

function checkCollisions() {
    const snakesToRemove = new Set();
    const allSnakes = [player, ...aiSnakes].filter(s => s);

    for (const snake of allSnakes) {
        const head = snake.body[0];
        // Wall collision
        if (head.x < 0 || head.x >= world.width / gridSize || head.y < 0 || head.y >= world.height / gridSize) {
            snakesToRemove.add(snake.id);
            continue;
        }
        // Self collision
        if (snake.id !== 'player') { // Only AI snakes die on self-collision
            for (let i = 1; i < snake.body.length; i++) {
                if (head.x === snake.body[i].x && head.y === snake.body[i].y) {
                    snakesToRemove.add(snake.id);
                    break;
                }
            }
        }
    }

    for (let i = 0; i < allSnakes.length; i++) {
        for (let j = i + 1; j < allSnakes.length; j++) {
            const snakeA = allSnakes[i];
            const snakeB = allSnakes[j];
            if (!snakeA || !snakeB || snakesToRemove.has(snakeA.id) || snakesToRemove.has(snakeB.id)) continue;

            let aRanIntoB = snakeB.body.some(seg => seg.x === snakeA.body[0].x && seg.y === snakeA.body[0].y);
            let bRanIntoA = snakeA.body.some(seg => seg.x === snakeB.body[0].x && seg.y === snakeB.body[0].y);

            if (aRanIntoB && bRanIntoA) { // Head-on collision
                // If one is shielded and the other isn't, it's a bounce (no-op)
                if ((snakeA.length < shieldThreshold) !== (snakeB.length < shieldThreshold)) continue;

                if (snakeA.length > snakeB.length) { snakesToRemove.add(snakeB.id); snakeA.length += snakeB.length; }
                else if (snakeB.length > snakeA.length) { snakesToRemove.add(snakeA.id); snakeB.length += snakeA.length; }
                else { snakesToRemove.add(snakeA.id); snakesToRemove.add(snakeB.id); }

            } else if (aRanIntoB) { // A's head ran into B
                if (snakeB.length < shieldThreshold) continue; // B is shielded
                if (snakeA.length > snakeB.length) {
                    snakesToRemove.add(snakeB.id);
                    snakeA.length += snakeB.length;
                } else {
                    snakesToRemove.add(snakeA.id);
                }
            } else if (bRanIntoA) { // B's head ran into A
                if (snakeA.length < shieldThreshold) continue; // A is shielded
                if (snakeB.length > snakeA.length) {
                    snakesToRemove.add(snakeA.id);
                    snakeB.length += snakeA.length;
                } else {
                    snakesToRemove.add(snakeB.id);
                }
            }
        }
    }

    let eatenFoodIndices = new Set();
    for (const snake of allSnakes) {
        if (snakesToRemove.has(snake.id)) continue;
        foods.forEach((food, index) => {
            if (snake.body[0].x === food.x && snake.body[0].y === food.y) {
                snake.length += food.value;
                eatenFoodIndices.add(index);
            }
        });
    }

    if (eatenFoodIndices.size > 0) {
        foods = foods.filter((_, index) => !eatenFoodIndices.has(index));
        spawnFoods(eatenFoodIndices.size);
    }

    if (snakesToRemove.has(player.id)) {
        alert("Game Over!");
        player = null;
        init();
        return true;
    }

    aiSnakes = aiSnakes.filter(ai => ai && !snakesToRemove.has(ai.id));
    if (player) playerLengthDisplay.textContent = player.length;
    return false;
}

function respawnAi(isInit = false) {
    const condition = isInit ? true : (aiSnakes.length < maxAiSnakes);
    if (condition) {
        const allCurrentSnakes = [player, ...aiSnakes].filter(s => s);
        let spawnPos;
        do {
            spawnPos = {
                x: Math.floor(Math.random() * (world.width / gridSize)),
                y: Math.floor(Math.random() * (world.height / gridSize))
            };
        } while (isOccupied(spawnPos.x, spawnPos.y, allCurrentSnakes));
        
        let newLength;
        if (spawnAiFixedSizeCheckbox.checked) {
            newLength = 5;
        } else if (player) {
            const minSize = Math.max(1, Math.floor(player.length / 2));
            const maxSize = Math.floor(player.length + (player.length / 5));
            newLength = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
        } else {
            newLength = 5;
        }
        newLength = Math.max(1, newLength);

        aiSnakes.push({ id: `ai${Date.now()}`, body: [spawnPos], dx: 0, dy: 0, length: newLength, color: `hsl(${Math.random() * 360}, 100%, 50%)` });
    }
}

function spawnManualAi(size) {
    const allCurrentSnakes = [player, ...aiSnakes].filter(s => s);
    let spawnPos;
    do {
        spawnPos = {
            x: Math.floor(Math.random() * (world.width / gridSize)),
            y: Math.floor(Math.random() * (world.height / gridSize))
        };
    } while (isOccupied(spawnPos.x, spawnPos.y, allCurrentSnakes));

    const newLength = size > 0 ? size : 10;

    aiSnakes.push({ id: `ai${Date.now()}`, body: [spawnPos], dx: 0, dy: 0, length: newLength, color: `hsl(${Math.random() * 360}, 100%, 50%)` });
}

function spawnManualFood(value) {
    const allCurrentSnakes = [player, ...aiSnakes].filter(s => s);
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * (world.width / gridSize)),
            y: Math.floor(Math.random() * (world.height / gridSize))
        };
    } while (isOccupied(newFood.x, newFood.y, allCurrentSnakes));

    const foodValue = value > 0 ? value : 1;
    let color = 'lightgreen';
    if (foodValue >= 5) color = 'red';
    else if (foodValue >= 3) color = 'orange';

    foods.push({
        ...newFood,
        value: foodValue,
        isManual: true, // Mark as manually spawned
        color: color
    });
}

// --- Input Listeners ---
window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (key in keys) keys[key] = true;
});
window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (key in keys) keys[key] = false;
});

// Cheat Menu Listeners
freezeAiCheckbox.addEventListener('change', (e) => {
    isAiFrozen = e.target.checked;
});

setSizeBtn.addEventListener('click', () => {
    const newSize = parseInt(setSizeInput.value, 10);
    if (player && newSize > 0) {
        player.length = newSize;
        playerLengthDisplay.textContent = newSize;
    }
});

spawnAiBtn.addEventListener('click', () => {
    const newSize = parseInt(spawnAiSizeInput.value, 10);
    const count = parseInt(spawnAiCountInput.value, 10) || 1;
    for(let i=0; i<count; i++){
        spawnManualAi(newSize);
    }
});

spawnFoodBtn.addEventListener('click', () => {
    const newValue = parseInt(spawnFoodValueInput.value, 10);
    const count = parseInt(spawnFoodCountInput.value, 10) || 1;
    for(let i=0; i<count; i++){
        spawnManualFood(newValue);
    }
});

// Help Modal Listeners
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeModalBtn = document.querySelector('.close-btn');

helpBtn.addEventListener('click', () => {
    helpModal.style.display = 'block';
});

closeModalBtn.addEventListener('click', () => {
    helpModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target == helpModal) {
        helpModal.style.display = 'none';
    }
});

// --- Mobile/Touch Controls ---
function setupJoystick() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isTouchDevice) return;

    const joystickContainer = document.getElementById('joystick-container');
    joystickContainer.style.display = 'block';

    const stick = document.getElementById('joystick-stick');
    const base = document.getElementById('joystick-base');
    const maxMove = base.offsetWidth / 2;
    let isDragging = false;
    
    stick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isDragging = true;
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging || !e.targetTouches[0]) return;
        
        const rect = base.getBoundingClientRect();
        const touch = e.targetTouches[0];
        
        let dx = touch.clientX - rect.left - rect.width / 2;
        let dy = touch.clientY - rect.top - rect.height / 2;
        
        const distance = Math.hypot(dx, dy);
        
        if (distance > maxMove) {
            dx = (dx / distance) * maxMove;
            dy = (dy / distance) * maxMove;
        }
        
        stick.style.transform = `translate(${dx}px, ${dy}px)`;

        const angle = Math.atan2(dy, dx);
        player.dx = Math.round(Math.cos(angle));
        player.dy = Math.round(Math.sin(angle));

    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        stick.style.transform = `translate(0px, 0px)`;
        player.dx = 0;
        player.dy = 0;
    });
}


init();
setupJoystick();
