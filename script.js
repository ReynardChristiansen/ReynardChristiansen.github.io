/* ============================================================
   Snake · Neon Edition
   Clean rewrite — grid-based logic, DPR-aware rendering,
   input queue (no reverse-death bug), food never on snake,
   pause / high-score / touch, all fixed.
   ============================================================ */

(() => {
    "use strict";

    // ---- config ----
    const GRID = 15;                 // 15 x 15 cells
    const SPEED = 150;               // constant ms per step (no speed-up)
    const WIN_LENGTH = GRID * GRID;  // fill the board = win
    const BEST_KEY = "snake.best";

    // ============================================================
    //  Sound engine — Web Audio, synthesized (no external files)
    // ============================================================
    const MUTE_KEY = "snake.muted";
    const Sound = (() => {
        let ac = null;
        let muted = localStorage.getItem(MUTE_KEY) === "1";

        function ctx() {
            if (!ac) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) ac = new AC();
            }
            if (ac && ac.state === "suspended") ac.resume();
            return ac;
        }

        // one short tone
        function tone(freq, dur, type = "square", gain = 0.15, when = 0) {
            const a = ctx();
            if (!a || muted) return;
            const t = a.currentTime + when;
            const osc = a.createOscillator();
            const g = a.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(gain, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(g).connect(a.destination);
            osc.start(t);
            osc.stop(t + dur + 0.02);
        }

        // pitch slide (for game over)
        function slide(f1, f2, dur, type = "sawtooth", gain = 0.18) {
            const a = ctx();
            if (!a || muted) return;
            const t = a.currentTime;
            const osc = a.createOscillator();
            const g = a.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(f1, t);
            osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
            g.gain.setValueAtTime(gain, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(g).connect(a.destination);
            osc.start(t);
            osc.stop(t + dur + 0.02);
        }

        return {
            eat:   () => tone(620, 0.09, "square", 0.14),
            turn:  () => tone(300, 0.04, "triangle", 0.05),
            over:  () => slide(440, 60, 0.6, "sawtooth", 0.2),
            start: () => { tone(523, 0.08, "square", 0.12, 0);
                           tone(784, 0.10, "square", 0.12, 0.09); },
            win:   () => { [523, 659, 784, 1046].forEach((f, i) =>
                            tone(f, 0.14, "triangle", 0.15, i * 0.11)); },
            get muted() { return muted; },
            toggle() {
                muted = !muted;
                localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
                if (!muted) { ctx(); tone(660, 0.08, "square", 0.12); }
                return muted;
            },
            unlock() { ctx(); }, // resume audio on first user gesture
        };
    })();

    // ---- elements ----
    const canvas   = document.getElementById("board");
    const ctx      = canvas.getContext("2d");
    const scoreEl  = document.getElementById("score");
    const bestEl   = document.getElementById("best");
    const overlay  = document.getElementById("overlay");
    const oBadge   = document.getElementById("overlayBadge");
    const oTitle   = document.getElementById("overlayTitle");
    const oText    = document.getElementById("overlayText");
    const primary  = document.getElementById("primaryBtn");
    const primaryLabel = document.getElementById("primaryLabel");

    // ---- state ----
    let snake, prevSnake, dir, facing, queue, food, score, best;
    let state = "start";            // start | running | paused | over | win
    let cell = 0;                   // pixel size of one cell (DPR-scaled)
    let lastStep = 0;               // timestamp of the last logic step
    let rafId = null;               // requestAnimationFrame handle

    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const cloneSnake = () => snake.map(s => ({ x: s.x, y: s.y }));

    best = Number(localStorage.getItem(BEST_KEY)) || 0;
    bestEl.textContent = best;

    /* ---------- rendering setup (crisp on retina) ---------- */
    function resize() {
        const dpr = window.devicePixelRatio || 1;
        const cssSize = canvas.clientWidth;          // square via CSS aspect-ratio
        canvas.width = canvas.height = Math.round(cssSize * dpr);
        cell = canvas.width / GRID;
        ctx.imageSmoothingEnabled = false;
        draw();
    }

    /* ---------- game lifecycle ---------- */
    function reset() {
        const mid = Math.floor(GRID / 2);
        // start with a head + one body segment, facing right
        snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }];
        dir = { x: 0, y: 0 };        // stationary until first input
        facing = { x: 1, y: 0 };     // where the head "looks" while idle
        queue = [];
        score = 0;
        placeFood();
        prevSnake = cloneSnake();
        scoreEl.textContent = "0";
    }

    function start() {
        Sound.unlock();
        Sound.start();
        reset();
        state = "running";
        hideOverlay();
        lastStep = performance.now();
        startRAF();
    }

    function startRAF() {
        if (rafId == null) rafId = requestAnimationFrame(frame);
    }
    function stopRAF() {
        if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    }

    // Render loop: draws every animation frame and interpolates between
    // logic steps so motion is smooth; logic still advances in fixed ticks.
    function frame(ts) {
        rafId = null;
        if (state === "running") {
            let guard = 0;                       // avoid spiral-of-death after a stall
            while (ts - lastStep >= SPEED && guard++ < 5) {
                lastStep += SPEED;
                prevSnake = cloneSnake();         // remember pre-step positions
                step();
                if (state !== "running") break;  // game over / win
            }
        }
        const t = state === "running" ? clamp01((ts - lastStep) / SPEED) : 1;
        draw(t);
        if (state === "running") rafId = requestAnimationFrame(frame);
    }

    function step() {
        // consume one queued direction per tick (prevents 180° reversal)
        if (queue.length) dir = queue.shift();
        if (dir.x === 0 && dir.y === 0) return; // not moving yet
        facing = dir;

        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        // wall collision
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
            return gameOver();
        }
        // self collision (ignore tail cell we're about to free, unless growing)
        const willGrow = head.x === food.x && head.y === food.y;
        const body = willGrow ? snake : snake.slice(0, -1);
        if (body.some(s => s.x === head.x && s.y === head.y)) {
            return gameOver();
        }

        snake.unshift(head);

        if (willGrow) {
            score++;
            scoreEl.textContent = score;
            Sound.eat();
            if (snake.length >= WIN_LENGTH) return youWin();
            placeFood();
        } else {
            snake.pop();
        }
    }

    function gameOver() {
        state = "over";
        Sound.over();
        const isBest = score > best && score > 0;
        saveBest();
        showOverlay("over", "Game Over", "Nice run!",
            isBest ? `New personal best <span class="hl">${score}</span>` : "So close — give it another go.",
            "Play Again");
    }

    function youWin() {
        state = "win";
        Sound.win();
        saveBest();
        showOverlay("win", "You Win!", "Perfect Board",
            "Flawless victory! Longest snake alive.", "Play Again");
    }

    function saveBest() {
        if (score > best) {
            best = score;
            localStorage.setItem(BEST_KEY, String(best));
            bestEl.textContent = best;
        }
    }

    /* ---------- food placement (never on the snake) ---------- */
    function placeFood() {
        const free = [];
        for (let y = 0; y < GRID; y++) {
            for (let x = 0; x < GRID; x++) {
                if (!snake.some(s => s.x === x && s.y === y)) free.push({ x, y });
            }
        }
        food = free.length ? free[Math.floor(Math.random() * free.length)] : { x: -1, y: -1 };
    }

    /* ---------- drawing ---------- */
    // interpolated pixel position of segment i (t = 0..1 between logic steps)
    function segXY(i, t) {
        const cur = snake[i];
        const from = (prevSnake && prevSnake[i]) ? prevSnake[i] : cur;
        return {
            x: (from.x + (cur.x - from.x) * t) * cell,
            y: (from.y + (cur.y - from.y) * t) * cell,
        };
    }

    function draw(t) {
        if (t === undefined) t = 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        // food (pulsing neon dot)
        if (food && food.x >= 0) {
            const fx = food.x * cell + cell / 2;
            const fy = food.y * cell + cell / 2;
            ctx.save();
            ctx.shadowColor = "rgba(255, 84, 112, 0.55)";
            ctx.shadowBlur = cell * 0.3;
            ctx.fillStyle = "#f2617f";
            ctx.beginPath();
            ctx.arc(fx, fy, cell * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // snake (draw tail→head so the head sits on top)
        for (let i = snake.length - 1; i >= 0; i--) {
            const p = segXY(i, t);
            const shade = snake.length > 1 ? i / (snake.length - 1) : 0; // head→tail
            const isHead = i === 0;
            ctx.save();
            ctx.shadowColor = "rgba(52, 245, 197, 0.4)";
            ctx.shadowBlur = isHead ? cell * 0.28 : 0;
            ctx.fillStyle = isHead
                ? "#cdf5e9"
                : `rgba(46, 214, 173, ${0.92 - shade * 0.5})`;
            roundRect(p.x + 1.5, p.y + 1.5, cell - 3, cell - 3, cell * 0.28);
            ctx.fill();
            ctx.restore();
        }

        // eyes on the head for character
        if (state !== "start") drawEyes(t);
    }

    function drawGrid() {
        ctx.strokeStyle = "rgba(140,160,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < GRID; i++) {
            ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height);
            ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell);
        }
        ctx.stroke();
    }

    function drawEyes(t) {
        if (t === undefined) t = 1;
        const h = segXY(0, t);
        const cx = h.x, cy = h.y;
        const r = cell * 0.09;
        const off = cell * 0.28;
        const look = (dir.x || dir.y) ? dir : facing;   // face travel dir, or idle facing
        ctx.fillStyle = "#05130f";
        const pts = look.x !== 0
            ? [[off + (look.x > 0 ? off : 0), off], [off + (look.x > 0 ? off : 0), cell - off]]
            : [[off, off + (look.y > 0 ? off : 0)], [cell - off, off + (look.y > 0 ? off : 0)]];
        for (const [ex, ey] of pts) {
            ctx.beginPath();
            ctx.arc(cx + ex, cy + ey, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function roundRect(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y,     x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x,     y + h, r);
        ctx.arcTo(x,     y + h, x,     y,     r);
        ctx.arcTo(x,     y,     x + w, y,     r);
        ctx.closePath();
    }

    /* ---------- overlay helpers ---------- */
    function showOverlay(st, title, badge, text, btn) {
        overlay.dataset.state = st;
        oTitle.textContent = title;
        oBadge.textContent = badge;
        oText.innerHTML = text;
        primaryLabel.textContent = btn;
        overlay.classList.add("is-visible");
    }
    function hideOverlay() { overlay.classList.remove("is-visible"); }

    /* ---------- input ---------- */
    const DIRS = {
        up:    { x: 0, y: -1 }, down:  { x: 0, y: 1 },
        left:  { x: -1, y: 0 }, right: { x: 1, y: 0 },
    };

    function enqueue(name) {
        if (state !== "running") return;
        const nd = DIRS[name];
        if (!nd) return;
        const moving = dir.x !== 0 || dir.y !== 0;
        // reference = last queued dir, else current dir (or idle facing)
        const last = queue.length ? queue[queue.length - 1]
                   : moving ? dir : facing;
        // block 180° reversal (would instantly bite the body)
        if (nd.x === -last.x && nd.y === -last.y) return;
        // ignore redundant same-direction — but only while already moving/queued,
        // so pressing the facing direction from idle still starts the snake
        if ((moving || queue.length) && nd.x === last.x && nd.y === last.y) return;
        if (queue.length < 2) { queue.push(nd); Sound.turn(); }
    }

    const KEYMAP = {
        ArrowUp: "up",    KeyW: "up",
        ArrowDown: "down", KeyS: "down",
        ArrowLeft: "left", KeyA: "left",
        ArrowRight: "right", KeyD: "right",
    };

    document.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
            e.preventDefault();
            togglePause();
            return;
        }
        const name = KEYMAP[e.code];
        if (name) { e.preventDefault(); enqueue(name); }
    });

    function togglePause() {
        if (state === "running") {
            state = "paused";
            stopRAF();
            draw(1);                 // snap to grid so it doesn't freeze mid-slide
            showOverlay("paused", "Paused", "Take a breath", "Space or Resume to continue.", "Resume");
        } else if (state === "paused") {
            state = "running";
            hideOverlay();
            lastStep = performance.now();
            startRAF();
        }
    }

    // primary button: start / resume / restart
    primary.addEventListener("click", () => {
        if (state === "paused") togglePause();
        else start();
    });

    // d-pad
    document.querySelectorAll(".dpad__btn[data-dir]").forEach(btn => {
        const fire = (e) => { e.preventDefault(); enqueue(btn.dataset.dir); };
        btn.addEventListener("click", fire);
        btn.addEventListener("touchstart", fire, { passive: false });
    });

    // swipe on the board
    let touchStart = null;
    canvas.addEventListener("touchstart", (e) => {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    canvas.addEventListener("touchmove", (e) => {
        if (!touchStart) return;
        const dx = e.touches[0].clientX - touchStart.x;
        const dy = e.touches[0].clientY - touchStart.y;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) enqueue(dx > 0 ? "right" : "left");
        else enqueue(dy > 0 ? "down" : "up");
        touchStart = null;
    }, { passive: true });

    // sound toggle
    const soundBtn = document.getElementById("soundBtn");
    soundBtn.setAttribute("aria-pressed", Sound.muted ? "false" : "true");
    soundBtn.addEventListener("click", () => {
        const muted = Sound.toggle();
        soundBtn.setAttribute("aria-pressed", muted ? "false" : "true");
    });

    /* ---------- boot ---------- */
    reset();                        // ensure a snake exists for the first paint
    window.addEventListener("resize", resize);
    window.addEventListener("load", resize);
    // initial paint (before load fires, if styles ready)
    requestAnimationFrame(resize);
})();
