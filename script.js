(() => {
  'use strict';

  const COLORS = [
    { id: 'red', name: 'Red', hex: '#df655b', start: 39, base: { x: 121, y: 599 }, angle: 135 },
    { id: 'green', name: 'Green', hex: '#398a68', start: 0, base: { x: 121, y: 121 }, angle: -135 },
    { id: 'yellow', name: 'Yellow', hex: '#e6b448', start: 13, base: { x: 599, y: 121 }, angle: -45 },
    { id: 'blue', name: 'Blue', hex: '#5789c5', start: 26, base: { x: 599, y: 599 }, angle: 45 },
  ];
  const NS = 'http://www.w3.org/2000/svg';
  const board = document.querySelector('#game-board');
  const setupPanel = document.querySelector('#setup-panel');
  const playPanel = document.querySelector('#play-panel');
  const modeButtons = [...document.querySelectorAll('[data-mode]')];
  const countButtons = [...document.querySelectorAll('[data-count]')];
  const startButton = document.querySelector('#start-game');
  const statusEl = document.querySelector('#status-message');
  const diceFace = document.querySelector('#die-face');
  const diceArea = document.querySelector('#dice-area');
  const diceTitle = document.querySelector('#dice-title');
  const diceSubtitle = document.querySelector('#dice-subtitle');
  const dragHint = document.querySelector('#drag-hint');
  const turnName = document.querySelector('#turn-name');
  const turnChip = document.querySelector('#turn-chip');
  const turnChipName = document.querySelector('#turn-chip-name');
  const playerList = document.querySelector('#player-list');
  const roundTag = document.querySelector('#round-tag');
  const countNote = document.querySelector('#count-note');
  const playerHint = document.querySelector('#player-hint');
  const tableCount = document.querySelector('#table-count');

  let mode = 'friends';
  let playerCount = 2;
  let game = null;
  let botTimer = null;
  let turnTimer = null;
  let dieDrag = null;

  const squarePoint = (index) => {
    const angle = (-135 + (index / 52) * 360) * Math.PI / 180;
    const exponent = 0.48;
    const x = 360 + 151 * Math.sign(Math.cos(angle)) * Math.pow(Math.abs(Math.cos(angle)), exponent);
    const y = 360 + 151 * Math.sign(Math.sin(angle)) * Math.pow(Math.abs(Math.sin(angle)), exponent);
    return { x, y };
  };

  const lanePoints = (color) => {
    const angle = color.angle * Math.PI / 180;
    return [124, 96, 68, 40, 17].map((radius) => ({
      x: 360 + Math.cos(angle) * radius,
      y: 360 + Math.sin(angle) * radius,
    }));
  };

  function svg(tag, attrs = {}, parent) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (parent) parent.append(node);
    return node;
  }

  function textNode(parent, x, y, text, className, fill) {
    const node = svg('text', { x, y, class: className }, parent);
    if (fill) node.setAttribute('fill', fill);
    node.textContent = text;
    return node;
  }

  function roundedPath(x, y, w, h, r) {
    return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  }

  function drawBase(root, color) {
    const x = color.base.x - 94;
    const y = color.base.y - 94;
    const group = svg('g', {}, root);
    svg('path', { d: roundedPath(x, y, 188, 188, 30), class: 'home-base', fill: color.hex }, group);
    textNode(group, color.base.x, y + 23, color.name.toUpperCase(), 'base-title', '#fff');
    const positions = baseTokenPoints(color);
    for (let i = 0; i < 4; i += 1) {
      svg('circle', { cx: positions[i].x, cy: positions[i].y, r: 23, class: 'yard-spot' }, group);
    }
  }

  function baseTokenPoints(color) {
    return [
      { x: color.base.x - 34, y: color.base.y - 28 },
      { x: color.base.x + 34, y: color.base.y - 28 },
      { x: color.base.x - 34, y: color.base.y + 37 },
      { x: color.base.x + 34, y: color.base.y + 37 },
    ];
  }

  function drawBoardScenery() {
    board.innerHTML = '';
    svg('rect', { x: 0, y: 0, width: 720, height: 720, rx: 22, class: 'board-bg' }, board);
    COLORS.forEach((color) => drawBase(board, color));

    // Home lanes sit above the track ribbon so their destination is easy to read.
    COLORS.forEach((color) => {
      const start = squarePoint(color.start);
      const lane = lanePoints(color);
      const points = [start, ...lane, { x: 360, y: 360 }].map((p) => `${p.x},${p.y}`).join(' ');
      svg('polyline', { points, class: 'lane-line', stroke: color.hex }, board);
      lane.forEach((point, index) => {
        svg('circle', { cx: point.x, cy: point.y, r: 13, class: 'lane-cell', fill: color.hex, opacity: 0.84 + index * 0.03 }, board);
      });
    });

    const pathPoints = Array.from({ length: 53 }, (_, i) => squarePoint(i % 52));
    svg('polyline', { points: pathPoints.map((p) => `${p.x},${p.y}`).join(' '), class: 'track-ribbon' }, board);
    for (let i = 0; i < 52; i += 1) {
      const point = squarePoint(i);
      const owner = COLORS.find((color) => color.start === i);
      svg('circle', {
        cx: point.x, cy: point.y, r: owner ? 15 : 13.5,
        class: owner ? 'track-cell safe' : 'track-cell',
        fill: owner ? owner.hex : '#fffefa',
        'data-track': i,
      }, board);
      if (owner) svg('circle', { cx: point.x, cy: point.y, r: 5, fill: '#fff', opacity: .9 }, board);
    }

    svg('circle', { cx: 360, cy: 360, r: 31, class: 'center-ring' }, board);
    svg('path', { d: 'M 360 339 L 381 360 L 360 381 L 339 360 Z', fill: '#f3eee3', stroke: '#e5dfd2', 'stroke-width': 1.5 }, board);
    textNode(board, 360, 407, 'HOME', 'center-label');
    textNode(board, 360, 432, 'FINISH', 'board-label');
  }

  function createPlayers() {
    const colorSeats = playerCount === 2
      ? [COLORS[0], COLORS[2]]
      : playerCount === 3
        ? [COLORS[0], COLORS[1], COLORS[2]]
        : COLORS;
    const colors = colorSeats;
    return colors.map((color, index) => ({
      ...color,
      isBot: mode === 'bots' && index > 0,
      displayName: mode === 'bots' && index > 0 ? `${color.name} Bot` : color.name,
      tokens: [-1, -1, -1, -1],
    }));
  }

  function startGame() {
    clearTimeout(botTimer);
    clearTimeout(turnTimer);
    game = { players: createPlayers(), active: 0, die: null, legal: [], rolling: false, resolving: false, winner: null, status: 'Roll a 1 or 6 to bring a piece out of your yard.' };
    setupPanel.classList.add('hidden');
    playPanel.classList.remove('hidden');
    roundTag.textContent = 'GAME ON';
    updateInterface();
    scheduleBot();
  }

  function currentPlayer() { return game?.players[game.active]; }

  function getLegalMoves(player, die) {
    const moves = [];
    player.tokens.forEach((position, tokenIndex) => {
      if (position === -1) {
        if (die === 1 || die === 6) moves.push(tokenIndex);
      } else if (position < 57 && position + die <= 57) {
        moves.push(tokenIndex);
      }
    });
    return moves;
  }

  function doRoll() {
    if (!game || game.winner || game.rolling || game.resolving || game.die !== null) return;
    game.rolling = true;
    game.status = `${currentPlayer().displayName} is rolling…`;
    updateInterface();
    diceFace.classList.add('rolling');
    window.setTimeout(() => {
      if (!game || game.winner) return;
      game.rolling = false;
      diceFace.classList.remove('rolling');
      diceFace.classList.remove('tossed');
      game.die = Math.floor(Math.random() * 6) + 1;
      game.legal = getLegalMoves(currentPlayer(), game.die);
      if (game.legal.length === 0) {
        const six = game.die === 6;
        game.status = six ? 'No piece can move. A 6 earns another roll.' : `No legal move on ${game.die}. Turn passes.`;
        updateInterface();
        returnDieToDock();
        turnTimer = window.setTimeout(() => {
          if (!game || game.winner) return;
          if (six) {
            game.die = null;
            game.legal = [];
            game.status = 'You rolled a 6. Roll again.';
            updateInterface();
            scheduleBot();
          } else {
            advanceTurn(false);
          }
        }, 1050);
        return;
      }
      game.status = game.die === 1 || game.die === 6
        ? `Rolled ${game.die}. Choose a glowing piece, or move one already on the track.`
        : `Rolled ${game.die}. Choose one of your glowing pieces.`;
      updateInterface();
      returnDieToDock();
      if (currentPlayer().isBot) scheduleBot();
    }, 520);
  }

  function chooseToken(tokenIndex) {
    if (!game || game.winner || game.die === null || game.rolling || game.resolving || currentPlayer().isBot) return;
    if (!game.legal.includes(tokenIndex)) {
      game.status = 'That piece cannot move with this roll. Choose one of the glowing pieces.';
      updateInterface();
      return;
    }
    moveToken(currentPlayer(), tokenIndex);
  }

  function moveToken(player, tokenIndex) {
    const die = game.die;
    const previous = player.tokens[tokenIndex];
    const next = previous === -1 ? 0 : previous + die;
    player.tokens[tokenIndex] = next;
    let captured = 0;
    if (next >= 0 && next <= 51) {
      const landing = (player.start + next) % 52;
      const safe = COLORS.some((color) => color.start === landing);
      if (!safe) {
        game.players.filter((other) => other !== player).forEach((other) => {
          other.tokens = other.tokens.map((position) => {
            if (position >= 0 && position <= 51 && (other.start + position) % 52 === landing) {
              captured += 1;
              return -1;
            }
            return position;
          });
        });
      }
    }

    const finished = next === 57;
    const allFinished = player.tokens.every((position) => position === 57);
    if (allFinished) {
      game.winner = player;
      game.legal = [];
      game.status = `${player.displayName} wins! All four pieces made it home.`;
      game.die = null;
      updateInterface();
      return;
    }

    if (captured > 0) game.status = `${player.displayName} captured ${captured} rival piece${captured > 1 ? 's' : ''}!`;
    else if (finished) game.status = `${player.displayName} got a piece home!`;
    else if (previous === -1) game.status = `${player.displayName} brought a piece out of the yard.`;
    else game.status = `${player.displayName} moved a piece ${die} space${die === 1 ? '' : 's'}.`;

    const extraTurn = die === 6;
    game.die = null;
    game.legal = [];
    game.resolving = true;
    updateInterface();
    window.setTimeout(() => {
      if (!game || game.winner) return;
      game.resolving = false;
      advanceTurn(extraTurn);
    }, captured > 0 || finished ? 850 : 650);
  }

  function advanceTurn(extraTurn) {
    if (!game || game.winner) return;
    if (!extraTurn) game.active = (game.active + 1) % game.players.length;
    game.resolving = false;
    game.die = null;
    game.legal = [];
    game.status = extraTurn ? `${currentPlayer().displayName} rolled a 6 and gets another turn.` : `${currentPlayer().displayName}'s turn. Roll the dice.`;
    updateInterface();
    scheduleBot();
  }

  function scoreMove(player, tokenIndex) {
    const progress = player.tokens[tokenIndex];
    if (progress === -1) return 42;
    const next = progress + game.die;
    let score = next * 0.12;
    if (next === 57) score += 150;
    if (next >= 52) score += 16;
    if (next >= 0 && next <= 51) {
      const landing = (player.start + next) % 52;
      const safe = COLORS.some((color) => color.start === landing);
      if (!safe && game.players.filter((other) => other !== player).some((other) => other.tokens.some((position) => position >= 0 && position <= 51 && (other.start + position) % 52 === landing))) score += 75;
      if (next < 52 && next % 13 === 0) score += 2;
    }
    return score + Math.random();
  }

  function scheduleBot() {
    if (!game || game.winner || !currentPlayer().isBot || botTimer) return;
    botTimer = window.setTimeout(() => {
      botTimer = null;
      if (!game || game.winner || !currentPlayer().isBot) return;
      if (game.die === null) {
        doRoll();
      } else if (game.legal.length > 0) {
        const player = currentPlayer();
        const tokenIndex = [...game.legal].sort((a, b) => scoreMove(player, b) - scoreMove(player, a))[0];
        moveToken(player, tokenIndex);
      }
    }, game.die === null ? 720 : 700);
  }

  function tokenLocation(player, tokenIndex, progress) {
    if (progress === -1) return baseTokenPoints(player)[tokenIndex];
    if (progress <= 51) return squarePoint((player.start + progress) % 52);
    if (progress <= 56) return lanePoints(player)[progress - 52];
    return { x: 360, y: 360 };
  }

  function drawTokens() {
    if (!game) return;
    game.players.forEach((player) => {
      player.tokens.forEach((progress, tokenIndex) => {
        const point = tokenLocation(player, tokenIndex, progress);
        const clickable = game.active === game.players.indexOf(player) && game.legal.includes(tokenIndex) && game.die !== null && !player.isBot && !game.winner;
        // Fan out same-color pieces that occupy one board cell so each remains tappable.
        const siblings = player.tokens.map((p, i) => ({ p, i })).filter((entry) => entry.p === progress);
        const offsetIndex = siblings.findIndex((entry) => entry.i === tokenIndex);
        const offset = siblings.length > 1 && progress !== -1 && progress !== 57
          ? { x: Math.cos((offsetIndex / siblings.length) * Math.PI * 2) * 11, y: Math.sin((offsetIndex / siblings.length) * Math.PI * 2) * 11 }
          : { x: 0, y: 0 };
        const g = svg('g', {
          class: `token${clickable ? ' clickable' : ''}`,
          transform: `translate(${point.x + offset.x} ${point.y + offset.y})`,
          'data-token': tokenIndex,
          'data-player': game.players.indexOf(player),
          role: clickable ? 'button' : 'img',
          'aria-label': `${player.displayName}, piece ${tokenIndex + 1}${clickable ? ', can move' : ''}`,
          tabindex: clickable ? '0' : '-1',
        }, board);
        svg('circle', { cx: 0, cy: 3, r: 18, class: 'token-shadow' }, g);
        svg('circle', { cx: 0, cy: 0, r: 17, class: 'token-body', fill: player.hex }, g);
        svg('circle', { cx: 0, cy: 0, r: 8, class: 'token-core' }, g);
        const label = svg('text', { x: 0, y: 1, class: 'token-number' }, g);
        label.textContent = String(tokenIndex + 1);
      });
    });
  }

  function updateDice(die, rolling) {
    const active = {
      1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
    }[die] || [];
    [...diceFace.children].forEach((pip, index) => pip.classList.toggle('on', active.includes(index)));
    diceFace.classList.toggle('rolling', Boolean(rolling));
    diceFace.setAttribute('aria-label', die ? `Dice showing ${die}` : 'Dice not rolled');
    const canRoll = Boolean(game && !game.winner && !currentPlayer().isBot && !game.rolling && !game.resolving && game.die === null);
    diceFace.classList.toggle('ready', canRoll);
    diceFace.classList.toggle('locked', !canRoll);
    diceFace.setAttribute('aria-disabled', String(!canRoll));
  }

  function updatePlayerList() {
    if (!game) return;
    playerList.innerHTML = '';
    game.players.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = `player-row${index === game.active ? ' active' : ''}`;
      row.style.setProperty('--player-color', player.hex);
      const home = player.tokens.filter((position) => position === 57).length;
      row.innerHTML = `<span class="player-dot"></span><span class="player-name"></span><span class="player-kind">${player.isBot ? 'COMPUTER' : 'LOCAL'}</span><span class="home-count">${home}/4 home</span>`;
      row.querySelector('.player-name').textContent = player.displayName;
      playerList.append(row);
    });
  }

  function updateInterface() {
    if (!game) return;
    drawBoardScenery();
    drawTokens();
    const player = currentPlayer();
    const color = player?.hex || '#df655b';
    turnName.textContent = game.winner ? `${game.winner.displayName} wins!` : `${player.displayName}'s turn`;
    turnChip.style.setProperty('--player-color', color);
    turnChipName.textContent = player.name.toUpperCase();
    statusEl.textContent = game.status;
    updateDice(game.die, game.rolling);
    tableCount.textContent = `${game.players.length} PLAYER${game.players.length > 1 ? 'S' : ''}`;
    updatePlayerList();
    if (game.winner) {
      diceTitle.textContent = 'Game complete';
      diceSubtitle.textContent = 'All four pieces made it home.';
      dragHint.innerHTML = '<span class="drag-arrow">✦</span> WE HAVE A WINNER';
      dragHint.classList.add('inactive');
      roundTag.textContent = 'WINNER!';
    } else {
      if (player.isBot) {
        diceTitle.textContent = game.rolling ? 'Computer rolling…' : game.die === null ? 'Computer’s turn' : `Computer rolled ${game.die}`;
        diceSubtitle.textContent = game.die === null ? 'The computer is taking its turn.' : 'It’s choosing a piece.';
        dragHint.innerHTML = '<span class="drag-arrow">✦</span> COMPUTER TURN';
        dragHint.classList.add('inactive');
      } else if (game.die === null) {
        diceTitle.textContent = game.rolling ? 'Rolling…' : 'Your turn';
        diceSubtitle.textContent = game.rolling ? 'The die is tumbling.' : 'Drag it anywhere and let go.';
        dragHint.innerHTML = '<span class="drag-arrow">↗</span> DRAG OR TAP TO ROLL';
        dragHint.classList.remove('inactive');
      } else if (game.resolving) {
        diceTitle.textContent = 'Moving piece…';
        diceSubtitle.textContent = 'Passing the turn around.';
        dragHint.innerHTML = '<span class="drag-arrow">✦</span> NEXT PLAYER UP';
        dragHint.classList.add('inactive');
      } else {
        diceTitle.textContent = `You rolled a ${game.die}`;
        diceSubtitle.textContent = game.legal.length ? 'Choose one of your glowing pieces.' : 'No piece can move.';
        dragHint.innerHTML = '<span class="drag-arrow">↖</span> PICK A GLOWING PIECE';
        dragHint.classList.add('inactive');
      }
    }
  }

  function canHumanRoll() {
    return Boolean(game && !game.winner && !currentPlayer().isBot && !game.rolling && !game.resolving && game.die === null);
  }

  function resetDiePlacement() {
    for (const property of ['position', 'left', 'top', 'width', 'height', 'z-index', 'transform', 'transition']) {
      diceFace.style.removeProperty(property);
    }
    diceFace.classList.remove('dragging');
    diceArea.classList.remove('floating');
  }

  function returnDieToDock() {
    if (!diceFace.classList.contains('away')) return;
    const home = dieDrag?.home;
    if (home) {
      diceFace.style.transition = 'left 360ms cubic-bezier(.17,.82,.28,1), top 360ms cubic-bezier(.17,.82,.28,1), transform 360ms ease';
      requestAnimationFrame(() => {
        diceFace.style.left = `${home.left}px`;
        diceFace.style.top = `${home.top}px`;
        diceFace.style.transform = 'rotate(0deg) scale(1)';
      });
      window.setTimeout(() => {
        resetDiePlacement();
        diceFace.classList.remove('away');
        dieDrag = null;
      }, 390);
    } else {
      resetDiePlacement();
      diceFace.classList.remove('away');
      dieDrag = null;
    }
  }

  function beginDieDrag(event) {
    if (!canHumanRoll() || event.button !== 0) return;
    event.preventDefault();
    const rect = diceFace.getBoundingClientRect();
    dieDrag = {
      pointerId: event.pointerId,
      home: { left: rect.left, top: rect.top },
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      rotation: 0,
      moved: false,
    };
    diceFace.setPointerCapture(event.pointerId);
    diceFace.classList.add('dragging', 'away');
    diceArea.classList.add('floating');
    diceFace.style.position = 'fixed';
    diceFace.style.left = `${rect.left}px`;
    diceFace.style.top = `${rect.top}px`;
    diceFace.style.width = `${rect.width}px`;
    diceFace.style.height = `${rect.height}px`;
    diceFace.style.zIndex = '10000';
    diceFace.style.transform = 'scale(1.08)';
  }

  function moveDieDrag(event) {
    if (!dieDrag || event.pointerId !== dieDrag.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - dieDrag.x;
    const dy = event.clientY - dieDrag.y;
    if (Math.hypot(event.clientX - dieDrag.startX, event.clientY - dieDrag.startY) > 12) dieDrag.moved = true;
    dieDrag.rotation += dx * 1.15 + dy * 0.7;
    dieDrag.x = event.clientX;
    dieDrag.y = event.clientY;
    diceFace.style.left = `${event.clientX - diceFace.offsetWidth / 2}px`;
    diceFace.style.top = `${event.clientY - diceFace.offsetHeight / 2}px`;
    diceFace.style.transform = `rotate(${dieDrag.rotation}deg) scale(1.08)`;
  }

  function finishDieDrag(event, shouldRoll = true) {
    if (!dieDrag || (event && event.pointerId !== dieDrag.pointerId)) return;
    if (event && diceFace.hasPointerCapture(event.pointerId)) diceFace.releasePointerCapture(event.pointerId);
    diceFace.classList.remove('dragging');
    if (!shouldRoll) {
      resetDiePlacement();
      diceFace.classList.remove('away');
      dieDrag = null;
      return;
    }
    if (!dieDrag.moved) diceFace.classList.add('tossed');
    doRoll();
  }

  function showSetup() {
    clearTimeout(botTimer);
    clearTimeout(turnTimer);
    resetDiePlacement();
    diceFace.classList.remove('away', 'rolling', 'tossed');
    dieDrag = null;
    game = null;
    setupPanel.classList.remove('hidden');
    playPanel.classList.add('hidden');
    roundTag.textContent = 'READY WHEN YOU ARE';
    drawBoardScenery();
  }

  function updateSetupLabels() {
    countNote.textContent = mode === 'friends' ? `${playerCount} local players` : `1 player + ${playerCount - 1} computer${playerCount > 2 ? 's' : ''}`;
    playerHint.textContent = mode === 'friends' ? '2–4 friends' : '2–4 total';
  }

  modeButtons.forEach((button) => button.addEventListener('click', () => {
    mode = button.dataset.mode;
    modeButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    updateSetupLabels();
  }));

  countButtons.forEach((button) => button.addEventListener('click', () => {
    playerCount = Number(button.dataset.count);
    countButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    updateSetupLabels();
  }));

  startButton.addEventListener('click', startGame);
  document.querySelector('#new-game').addEventListener('click', showSetup);
  diceFace.addEventListener('pointerdown', beginDieDrag);
  diceFace.addEventListener('pointermove', moveDieDrag);
  diceFace.addEventListener('pointerup', (event) => finishDieDrag(event));
  diceFace.addEventListener('pointercancel', (event) => finishDieDrag(event, false));
  diceFace.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && canHumanRoll()) {
      event.preventDefault();
      doRoll();
    }
  });
  board.addEventListener('click', (event) => {
    const token = event.target.closest('[data-token]');
    if (token) chooseToken(Number(token.dataset.token));
  });
  board.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-token]')) {
      event.preventDefault();
      chooseToken(Number(event.target.dataset.token));
    }
  });

  drawBoardScenery();
  updateSetupLabels();
})();
