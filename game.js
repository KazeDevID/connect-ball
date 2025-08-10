const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

const scoreEl = document.getElementById("score")
const maxBallScoreEl = document.getElementById("maxBallScore")
const lifeFillEl = document.getElementById("lifeFill")
const stamFillEl = document.getElementById("stamFill")

const btnPlay = document.getElementById("btnPlay")
const btnReset = document.getElementById("btnReset")
const btnSound = document.getElementById("btnSound")
const commandInput = document.getElementById("commandInput")
const diffButtons = Array.from(document.querySelectorAll(".controls .btn[data-diff]"))

const CB8 = {
  BLACK: "#000000",
  DKBLU: "#1d2b53",
  DKPUR: "#7e2553",
  DKGRN: "#008751",
  BRN: "#ab5236",
  DKGRY: "#5f5757",
  LTGRY: "#c2c3c7",
  WHITE: "#fff1e8",
  RED: "#ff004d",
  ORANGE: "#ffa300",
  YELLOW: "#fff024",
  GREEN: "#00e756",
  BLUE: "#29adff",
  LAV: "#83769c",
  PINK: "#ff77a8",
  PEACH: "#ffccaa"
}

const bpal = [CB8.BLACK, "#f72585", "#ff9e00", "#ffd166", "#80ed99", "#22d3ee", "#c084fc"]
const bpal2 = ["#111111","#c026d3","#ff6d00","#ffbd2e","#3ada7a","#0ea5e9","#a855f7"]
const ballValue = [0, 1, 2, 3, 5, 10, 20, 100]
const ballCost =  [0, 4, 3.5, 3, 2, 1.5, 1, 0]

const uses = { sound: true }
const commands = {
  help: "Tampilkan daftar perintah",
  mode: "Ubah mode kesulitan (endless/easy/normal/hard)",
  play: "Mulai permainan",
  reset: "Reset permainan",
  sound: "Toggle suara on/off",
  score: "Tampilkan skor tertinggi",
  info: "Informasi tentang game",
  clear: "Bersihkan console"
}

let commandHistory = []
let commandIndex = -1
let showingHelp = false
let consoleMessages = []

const sfx = {
  9: new Audio("audio/sfx09.ogg"),
  10: new Audio("audio/sfx10.ogg"),
  11: new Audio("audio/sfx11.ogg"),
  12: new Audio("audio/sfx12.ogg"),
  13: new Audio("audio/sfx13.ogg"),
  14: new Audio("audio/sfx14.ogg"),
  15: new Audio("audio/sfx15.ogg"),
  16: new Audio("audio/sfx16.ogg"),
  17: new Audio("audio/sfx17.ogg"),
}

const musicTracks = {
  0: new Audio("audio/music00.ogg"),
  5: new Audio("audio/music05.ogg"),
  10: new Audio("audio/music10.ogg"),
}
Object.values(musicTracks).forEach(a => { a.loop = true; a.volume = 0.6 })
Object.values(sfx).forEach(a => { a.volume = 0.8 })

function playSfx(id) {
  if (!uses.sound) return
  const snd = sfx[id]
  if (snd) {
    try {
      snd.currentTime = 0
      snd.play()
    } catch {}
  }
}

function playMusic(id) {
  if (!uses.sound) return
  for (const [mid, track] of Object.entries(musicTracks)) {
    if (Number(mid) === id) {
      try { track.play() } catch {}
    } else {
      try { track.pause(); track.currentTime = 0 } catch {}
    }
  }
}

function stopAllMusic() {
  for (const track of Object.values(musicTracks)) {
    try { track.pause() } catch {}
  }
}

const WIDTH = 128
const HEIGHT = 128
const DT = 1 / 30
const DRAG = 0.98

let state = "menu"
let difficulty = "normal"
let maxAllowed = 40
let time = 0

const launcher = {
  x: 64,
  y: 120,
  dx: Math.cos(Math.PI * 0.5),
  dy: -1,
  rot: 0.25,
  power: 6,
  isPress: false,
  stamina: 100,
  staminaAccel: 0.5,
  canLaunch: true,
  nextColor: 1
}

let balls = []
let parts = []
let ballIdx = 0

let score = 0
let ballScore = 0
let maxBallScore = 0
let ballMult = 1
let maxMult = 1

let victory = false
let death = false
let finish = false
let finishTimer = 0
let suddenDeath = false
let suddenDeathDuration = 120

let life = 100
let lifeSmoothed = 100
let highScore = parseInt(localStorage.getItem('connectball_highscore') || '0')
let bestMaxBall = parseInt(localStorage.getItem('connectball_maxball') || '0')

function reset() {
  stopAllMusic()
  state = "menu"
  difficulty = "normal"
  maxAllowed = 40

  balls = []
  parts = []
  ballIdx = 0

  time = 0
  launcher.rot = 0.25
  setLaunchDirFromRot()
  launcher.stamina = 100
  launcher.staminaAccel = 0.5
  launcher.canLaunch = true
  launcher.nextColor = 1
  launcher.isPress = false

  score = 0
  ballScore = 0
  maxBallScore = 0
  ballMult = 1
  maxMult = 1

  victory = false
  death = false
  finish = false
  finishTimer = 0
  suddenDeath = false

  life = 100
  lifeSmoothed = 100

  let ballcount = 0
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const typ = Math.floor(Math.random() * 3)
      ballcount += (2 ** typ)
      const xx = 16 + j * 64 + Math.random() * 32
      const yy = 8 + i * 32 + Math.random() * 16
      newBall(xx, yy, typ + 1)
    }
  }
  ballIdx = ballcount

  playMusic(0)

  updateHUD()
}

function addConsoleMessage(msg, type = 'info') {
  consoleMessages.push({ msg, type, time: Date.now() })
  if (consoleMessages.length > 10) {
    consoleMessages.shift()
  }
}

function executeCommand(cmd) {
  const parts = cmd.toLowerCase().trim().split(' ')
  const command = parts[0].replace('/', '')
  const args = parts.slice(1)

  addConsoleMessage(`> ${cmd}`, 'command')

  switch (command) {
    case 'help':
    case 'h':
      showingHelp = true
      addConsoleMessage('=== DAFTAR PERINTAH ===', 'success')
      Object.entries(commands).forEach(([cmd, desc]) => {
        addConsoleMessage(`/${cmd} - ${desc}`, 'info')
      })
      addConsoleMessage('Contoh: /mode easy, /play, /sound', 'info')
      break

    case 'mode':
    case 'm':
      if (args.length === 0) {
        addConsoleMessage(`Mode saat ini: ${difficulty}`, 'info')
        addConsoleMessage('Mode tersedia: endless, easy, normal, hard', 'info')
      } else {
        const newMode = args[0]
        if (['endless', 'easy', 'normal', 'hard'].includes(newMode)) {
          setDifficulty(newMode)
          addConsoleMessage(`Mode diubah ke: ${newMode}`, 'success')
          playSfx(12)
        } else {
          addConsoleMessage('Mode tidak valid! Gunakan: endless/easy/normal/hard', 'error')
        }
      }
      break

    case 'play':
    case 'p':
      if (state === 'menu') {
        state = 'intro'
        addConsoleMessage('Permainan dimulai!', 'success')
        playSfx(12)
        stopAllMusic()
      } else {
        addConsoleMessage('Permainan sudah berjalan!', 'warn')
      }
      break

    case 'reset':
    case 'r':
      reset()
      addConsoleMessage('Permainan direset!', 'success')
      break

    case 'sound':
    case 's':
      uses.sound = !uses.sound
      if (!uses.sound) {
        stopAllMusic()
      } else {
        playSfx(13)
      }
      addConsoleMessage(`Suara: ${uses.sound ? 'ON' : 'OFF'}`, 'success')
      btnSound.textContent = `Suara: ${uses.sound ? "ON" : "OFF"}`
      break

    case 'score':
      addConsoleMessage(`Skor Tertinggi: ${highScore}`, 'info')
      addConsoleMessage(`Max Bola Tertinggi: ${bestMaxBall}`, 'info')
      addConsoleMessage(`Skor Saat Ini: ${score}`, 'info')
      break

    case 'info':
    case 'i':
      addConsoleMessage('=== CONNECTBALL INFO ===', 'success')
      addConsoleMessage('Game puzzle menggabungkan bola warna', 'info')
      addConsoleMessage('Gabungkan 2 bola sama untuk naik level', 'info')
      addConsoleMessage('Capai warna tertinggi untuk menang!', 'info')
      addConsoleMessage('Dibuat oleh KazeDevID', 'info')
      break

    case 'clear':
    case 'c':
      consoleMessages = []
      showingHelp = false
      addConsoleMessage('Console dibersihkan', 'success')
      break

    default:
      addConsoleMessage(`Perintah '${command}' tidak dikenal. Ketik /help untuk bantuan`, 'error')
      break
  }

  commandHistory.unshift(cmd)
  if (commandHistory.length > 20) {
    commandHistory.pop()
  }
  commandIndex = -1
}

function setDifficulty(name) {
  const lifes = {
    endless: 0,
    easy: 50,
    normal: 40,
    hard: 34,
  }
  difficulty = name
  maxAllowed = lifes[name] ?? 40
  updateHUD()
}

function newBall(x, y, c) {
  const b = {
    x, y,
    vx: 0, vy: 0,
    c,
    idx: ballIdx++,
    dead: false,
    mult: 1,
    lastmult: 0
  }
  balls.push(b)
  return b
}

function newPart(x, y, t, c) {
  const p = { x, y, vx: 0, vy: 0, t, c }
  parts.push(p)
  return p
}

function newText(x, y, c, text) {
  const p = { x, y, vx: 0, vy: 0, t: 1, c, text }
  parts.push(p)
  return p
}

function setLaunchDirFromRot() {
  launcher.dx = Math.cos(launcher.rot * Math.PI * 2)
  launcher.dy = Math.sin(launcher.rot * Math.PI * 2)
  if (launcher.dy === -1) {
    launcher.dx += 0.01
    launcher.dy += 0.01
  }
}

function lensqr(x, y) {
  return x * x + y * y
}

function reflect(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny
  return [dot * nx * 2 - vx, dot * ny * 2 - vy]
}

function dotPart(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny
  return [vx - dot * nx, vy - dot * ny]
}

function bomb(x, y, rad, str) {
  for (const b of balls) {
    if (b.dead) continue
    let dx = (b.x - x)
    let dy = (b.y - y)
    const dist = Math.sqrt(lensqr(dx, dy) + 0.01)
    if (dist < rad) {
      dx = dx * str / dist
      dy = dy * str / dist
      b.vx += dx
      b.vy += dy
    }
  }
}

function handleCollision(b1, b2) {
  const dx = b1.x - b2.x
  const dy = b1.y - b2.y
  const sqrdist = lensqr(dx, dy)
  if (sqrdist >= 64 || b1.dead || b2.dead) return

  if (b1.c === b2.c) {
    b1.x = (b1.x + b2.x) * 0.5
    b1.y = (b1.y + b2.y) * 0.5
    b1.vx = b1.vx + b2.vx
    b1.vy = b1.vy + b2.vy

    const dist = Math.sqrt(sqrdist + 0.01)
    const nx = dy / dist
    const ny = -dx / dist

    if (b1.c < 7) {
      b1.c += 1
      let sound = (b1.c > 5) ? 14 : (b1.c > 3 ? 12 : 13)
      playSfx(sound)
    } else {
      bomb(b1.x, b1.y, 80, 5)
      b1.dead = true

      for (let p = 0; p < 20; p++) {
        const pr = newPart(b1.x, b1.y, 0.5, 3)
        pr.vx = b1.vx * 0.5 + (Math.random() - 0.5) * 3
        pr.vy = b1.vy * 0.5 + (Math.random() - 0.5) * 3
      }

      if (!death && maxAllowed > 0) {
        if (!victory) {
          finishTimer = 0
          stopAllMusic()
        }
        victory = true
        finish = true
      }

      playSfx(15)
    }

    b2.dead = true

    ballMult = Math.min(ballMult + b1.mult * b2.mult, 999999)
    const addscore = ballMult * ballValue[b1.c]
    ballScore += addscore
    score += addscore

    const p = newText(b1.x, b1.y, b1.c, `+${addscore}`)
    p.vx = (ny > 0 ? -nx : nx) * 1
    p.vy = (ny > 0 ? -ny : ny) * 1

    b1.mult = Math.min(b1.mult * 2, 8)

  } else {
    if (sqrdist > 0) {
      const dist = Math.sqrt(sqrdist)
      const nx = dy / dist
      const ny = -dx / dist

      const [dd1x, dd1y] = dotPart(b1.vx, b1.vy, nx, ny)
      const [dd2x, dd2y] = dotPart(b2.vx, b2.vy, nx, ny)

      const push = Math.max(0, 9 - dist) * 0.5 / dist
      b1.x += dx * push
      b1.y += dy * push
      b2.x -= dx * push
      b2.y -= dy * push

      b1.vx = b1.vx - dd1x + dd2x
      b1.vy = b1.vy - dd1y + dd2y
      b2.vx = b2.vx - dd2x + dd1x
      b2.vy = b2.vy - dd2y + dd1y

      let iscombo = false
      if (b1.lastmult <= 55) {
        b1.mult = Math.min(b1.mult * 2, 8)
        b1.lastmult = 60
        iscombo = true
      }
      if (b2.lastmult <= 55) {
        b2.mult = Math.min(b2.mult * 2, 8)
        b2.lastmult = 60
        iscombo = true
      }
      if (iscombo) {
        const bestmult = Math.max(b1.mult, b2.mult)
        b1.mult = bestmult
        b2.mult = bestmult
        const p = newPart((b1.x + b2.x) * 0.5, (b1.y + b2.y) * 0.5, 0.25, 2)
        p.vx = (b1.vx + b2.vx) * 0.5
        p.vy = (b1.vy + b2.vy) * 0.5

        const testspeed = Math.abs(b1.vx) + Math.abs(b1.vy) + Math.abs(b2.vx) + Math.abs(b2.vy)
        if (testspeed > 1) {
          playSfx(11)
        }
      }
    }
  }
}

function handleCollisionsAll() {
  for (let i = 0; i < balls.length; i++) {
    const b1 = balls[i]
    if (b1.dead) continue
    for (let j = i + 1; j < balls.length; j++) {
      const b2 = balls[j]
      if (b2.dead) continue
      handleCollision(b1, b2)
    }
  }
  balls = balls.filter(b => !b.dead)
}

function updateGame() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    p.x += p.vx
    p.y += p.vy
    p.vx *= 0.95
    p.vy *= 0.95
    p.t -= DT
    if (p.t <= 0) parts.splice(i, 1)
  }

  const substeps = 5
  const inv = 1 / substeps
  for (let s = 0; s < substeps; s++) {
    for (const b of balls) {
      b.x += b.vx * inv
      b.y += b.vy * inv

      let hurt = false

      if (b.x > 124 || b.x < 4) {
        hurt = true
        b.vx = -b.vx
        b.x += b.vx
        b.x = Math.min(124, Math.max(4, b.x))
      }
      const colboty = b.y > 112 && b.vy > 0.1
      if (colboty || b.y < 4) {
        hurt = true
        b.vy = -b.vy
        b.y += b.vy
        b.y = Math.min(112, Math.max(4, b.y))
      }

      if (hurt && b.lastmult <= 55) {
        b.mult = Math.min(b.mult * 2, 8)
        b.lastmult = 60
        newPart(b.x, b.y, 0.25, 2)
        playSfx(11)
      }
      if (b.lastmult > 0) b.lastmult -= 1
    }
    handleCollisionsAll()
  }

  let lifecost = 0
  for (const b of balls) {
    b.vx *= DRAG
    b.vy *= DRAG
    lifecost += ballCost[b.c]
  }

  if (ballScore > maxBallScore) {
    maxBallScore = ballScore
  }
  
  // Update high scores
  if (score > highScore) {
    highScore = score
    localStorage.setItem('connectball_highscore', String(highScore))
  }
  if (maxBallScore > bestMaxBall) {
    bestMaxBall = maxBallScore
    localStorage.setItem('connectball_maxball', String(bestMaxBall))
  }
  
  maxMult = Math.max(ballMult, maxMult)

  if (launcher.stamina < 100) {
    launcher.stamina = Math.min(100, launcher.stamina + launcher.staminaAccel)
    launcher.staminaAccel *= 1.1
  }

  if (maxAllowed > 0 && !death && !victory) {
    life = 100 - 100 * Math.pow(lifecost / maxAllowed, 3)
    if (life < 0) {
      if (!suddenDeath) {
        playMusic(10)
      }
      suddenDeath = true
      finish = true
      if (finishTimer >= suddenDeathDuration) {
        if (suddenDeath) {
          playMusic(5)
        }
        suddenDeath = false
        finishTimer = 0
        death = true
      }
    } else {
      if (finishTimer < suddenDeathDuration) {
        if (suddenDeath) stopAllMusic()
        suddenDeath = false
        finish = false
        finishTimer = 0
      } else {
        death = true
        finish = true
      }
    }
  }
  lifeSmoothed += Math.max(-1, Math.min(1, (life - lifeSmoothed)))

  if (finish) {
    finishTimer += 1
    if (victory && finishTimer === 30) {
      playSfx(17)
    }
  }

  updateHUD()

  time += 1
}

function updateHUD() {
  scoreEl.textContent = String(score)
  maxBallScoreEl.textContent = String(maxBallScore)
  const lifePerc = Math.max(0, Math.min(100, lifeSmoothed))
  lifeFillEl.style.width = `${lifePerc}%`
  const stamPerc = Math.max(0, Math.min(100, launcher.stamina))
  stamFillEl.style.width = `${stamPerc}%`
}

function draw() {
  ctx.fillStyle = suddenDeath ? CB8.DKPUR : "#0b1220"
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  if (!finish && state === "play") {
    ctx.strokeStyle = "#93c5fd"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(launcher.x, launcher.y)
    ctx.lineTo(launcher.x + launcher.dx * 128, launcher.y + launcher.dy * 128)
    ctx.stroke()
  }

  ctx.strokeStyle = "#1e293b"
  ctx.strokeRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1)

  for (const b of balls) {
    drawBall(b.x, b.y, b.c, (b.c === 7 || (b.mult >= 8 && b.lastmult > 30)) && (Math.floor(time / 8) % 2 === 0))
  }

  if (!finish && state === "play") {
    drawLauncher()
  }

  for (const p of parts) {
    if (p.text) {
      ctx.fillStyle = "#ffffff"
      ctx.font = "6px monospace"
      ctx.textAlign = "center"
      ctx.fillText(p.text, p.x, p.y)
    } else {
      ctx.fillStyle = "#a5b4fc"
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2)
    }
  }

  drawOverlay()
}

function drawOverlay() {
  ctx.save()
  ctx.textAlign = "center"

  if (state === "menu") {
    ctx.fillStyle = "rgba(0,0,0,0.4)"
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = "#e879f9"
    ctx.font = "12px sans-serif"
    ctx.fillText("ConnectBall", WIDTH / 2, 36)
    ctx.fillStyle = "#cbd5e1"
    ctx.font = "7px sans-serif"
    ctx.fillText("Ketik /help untuk bantuan", WIDTH / 2, 52)
    ctx.fillStyle = "#94a3b8"
    ctx.fillText("Contoh: /play, /mode easy, /sound", WIDTH / 2, 64)
    
    // Draw console messages
    ctx.textAlign = "left"
    ctx.font = "6px monospace"
    let yOffset = 80
    const maxMessages = 6
    const recentMessages = consoleMessages.slice(-maxMessages)
    
    for (const msg of recentMessages) {
      let color = "#cbd5e1"
      switch (msg.type) {
        case 'command': color = "#fbbf24"; break
        case 'success': color = "#34d399"; break
        case 'error': color = "#f87171"; break
        case 'warn': color = "#fb923c"; break
        case 'info': color = "#93c5fd"; break
      }
      ctx.fillStyle = color
      ctx.fillText(msg.msg.substring(0, 25), 4, yOffset)
      yOffset += 8
      if (yOffset > HEIGHT - 8) break
    }
  }

  if (state === "intro") {
    ctx.fillStyle = "rgba(0,0,0,0.4)"
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = "#fef3c7"
    ctx.font = "9px sans-serif"
    ctx.fillText("Gabungkan warna yang sama", WIDTH / 2, 36)
    ctx.fillStyle = "#cbd5e1"
    ctx.font = "7px sans-serif"
    ctx.fillText("Lepas untuk menembakkan bola", WIDTH / 2, 52)
    ctx.fillText("Capai warna tertinggi untuk menang", WIDTH / 2, 64)
    ctx.fillStyle = "#a7f3d0"
    ctx.fillText("Klik untuk mulai", WIDTH / 2, 84)
  }

  if (state === "finish") {
    ctx.fillStyle = "rgba(0,0,0,0.6)"
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = victory ? "#86efac" : "#fca5a5"
    ctx.font = "12px sans-serif"
    ctx.fillText(victory ? "Victory!" : "Game Over", WIDTH / 2, 40)
    ctx.fillStyle = "#cbd5e1"
    ctx.font = "7px sans-serif"
    ctx.fillText(`Skor: ${score}`, WIDTH / 2, 58)
    ctx.fillText(`Max Bola: ${maxBallScore}`, WIDTH / 2, 68)
    ctx.fillText(`Max Multiplier: ${maxMult}x`, WIDTH / 2, 78)
    if (finishTimer > 60) {
      ctx.fillStyle = "#fde68a"
      ctx.fillText("Klik untuk restart", WIDTH / 2, 95)
    }
  }

  ctx.restore()
}

function drawBall(x, y, c, blink) {
  const base = bpal[c - 1] || "#ffffff"
  const highlight = bpal2[c - 1] || "#ffffff"
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = "#0f172a"
  ctx.beginPath()
  ctx.arc(0 + 0.66, 0 + 0.66, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = blink ? "#ffffff" : base
  ctx.beginPath()
  ctx.arc(0, 0, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = highlight
  ctx.beginPath()
  ctx.arc(1.4, -1.4, 1.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawLauncher() {
  const llen = 20
  ctx.strokeStyle = "#e879f9"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(launcher.x, launcher.y)
  ctx.lineTo(launcher.x + launcher.dx * llen, launcher.y + launcher.dy * llen)
  ctx.stroke()

  drawBall(launcher.x, launcher.y, launcher.nextColor, false)
}

let mouseDown = false
let aimX = launcher.x
let aimY = launcher.y - 30

canvas.addEventListener("pointerdown", (e) => {
  mouseDown = true
  if (state === "menu") {
    state = "intro"
    playSfx(12)
    stopAllMusic()
  } else if (state === "intro") {
    state = "play"
    playSfx(14)
    stopAllMusic()
    playMusic(0)
  } else if (state === "finish") {
    if (finishTimer > 60) {
      reset()
    }
  }
})

canvas.addEventListener("pointerup", (e) => {
  mouseDown = false
  if (state !== "play" || finish) return

  if (launcher.stamina > 0 && launcher.canLaunch) {
    const nb = newBall(launcher.x, launcher.y, launcher.nextColor)
    nb.vx = launcher.dx * launcher.power
    nb.vy = launcher.dy * launcher.power

    launcher.nextColor = 1
    ballScore = 0
    ballMult = 1
    launcher.stamina -= 40
    launcher.staminaAccel = 0.5
    playSfx(10)
  } else {
    playSfx(9)
  }
})

canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect()
  const mx = ((e.clientX - rect.left) / rect.width) * WIDTH
  const my = ((e.clientY - rect.top) / rect.height) * HEIGHT

  aimX = Math.max(0, Math.min(WIDTH, mx))
  aimY = Math.max(0, Math.min(HEIGHT, my))

  if (state === "play") {
    const dx = aimX - launcher.x
    const dy = aimY - launcher.y
    const len = Math.max(0.01, Math.sqrt(dx * dx + dy * dy))
    launcher.dx = dx / len
    launcher.dy = dy / len
    if (aimY > launcher.y + 15) {
      const lang = 0.5 - Math.max(0.005, Math.min(0.495, (aimX - 15) / 196))
      launcher.dx = Math.cos(lang * Math.PI * 2)
      launcher.dy = Math.sin(lang * Math.PI * 2)
    }
  }
})

btnPlay.addEventListener("click", () => {
  if (state === "menu") {
    state = "intro"
    playSfx(12)
    stopAllMusic()
  }
})

btnReset.addEventListener("click", () => {
  reset()
})

btnSound.addEventListener("click", () => {
  uses.sound = !uses.sound
  if (!uses.sound) {
    stopAllMusic()
  } else {
    playSfx(13)
  }
  btnSound.textContent = `Suara: ${uses.sound ? "ON" : "OFF"}`
})

commandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const cmd = commandInput.value.trim()
    if (cmd) {
      executeCommand(cmd)
      commandInput.value = ""
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault()
    if (commandIndex < commandHistory.length - 1) {
      commandIndex++
      commandInput.value = commandHistory[commandIndex]
    }
  } else if (e.key === "ArrowDown") {
    e.preventDefault()
    if (commandIndex > 0) {
      commandIndex--
      commandInput.value = commandHistory[commandIndex]
    } else if (commandIndex === 0) {
      commandIndex = -1
      commandInput.value = ""
    }
  }
})

// Auto-focus command input when typing
document.addEventListener("keydown", (e) => {
  if (state === "menu" && e.key === "/" && document.activeElement !== commandInput) {
    e.preventDefault()
    commandInput.focus()
    commandInput.value = "/"
  }
})

diffButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const diff = btn.getAttribute("data-diff")
    setDifficulty(diff)
    addConsoleMessage(`Mode diubah ke: ${diff}`, 'success')
  })
})

let acc = 0
let last = performance.now()

function loop(now) {
  const dt = (now - last) / 1000
  last = now
  acc += dt

  while (acc >= DT) {
    if (state === "play" && !finish) {
      updateGame()
    }
    acc -= DT
  }

  draw()
  requestAnimationFrame(loop)
}

reset()
addConsoleMessage('ConnectBall dimuat! Ketik /help untuk bantuan', 'success')
requestAnimationFrame(loop)