// 擴充你的全局狀態或 Engine 內部變數
if (!window.Engine) window.Engine = {};

// 核心對局與匹配資料
Engine.matchState = {
  currentMode: 1, // 預設 1 代表 1V1, 5 代表 5V5
  scoreBlue: 0,
  scoreRed: 0,
  queueTimer: null,
  seconds: 0,
  entities: []
};

// 1. 攔截原有的 Engine.launch，強制進入匹配佇列流程
Engine.launch = function(modeString) {
  // 剖析點擊的模式 (例如從 'RANKED_1V1' 到 'RANKED_5V5')
  let numPlayers = 1;
  if (modeString.includes('1V1')) numPlayers = 1;
  if (modeString.includes('2V2')) numPlayers = 2;
  if (modeString.includes('3V3')) numPlayers = 3;
  if (modeString.includes('4V4')) numPlayers = 4;
  if (modeString.includes('5V5')) numPlayers = 5;
  
  Engine.matchState.currentMode = numPlayers;
  
  // 顯示匹配面板，開始計時
  document.getElementById('matchmaking-modal').classList.remove('hidden');
  Engine.matchState.seconds = 0;
  document.getElementById('match-timer').innerText = "00:00";
  
  clearInterval(Engine.matchState.queueTimer);
  Engine.matchState.queueTimer = setInterval(() => {
    Engine.matchState.seconds++;
    let m = String(Math.floor(Engine.matchState.seconds / 60)).padStart(2, '0');
    let s = String(Engine.matchState.seconds % 60).padStart(2, '0');
    document.getElementById('match-timer').innerText = `${m}:${s}`;
    
    // 模擬在 3 ~ 5 秒間尋找到相應水準的硬核玩家與高端 AI
    if (Engine.matchState.seconds >= Math.floor(Math.random() * 3) + 3) {
      clearInterval(Engine.matchState.queueTimer);
      document.getElementById('match-timer').innerText = "READY! 載入戰場...";
      
      setTimeout(() => {
        document.getElementById('matchmaking-modal').classList.add('hidden');
        Engine.startActualMatch(); // 正式初始化戰場
      }, 1200);
    }
  }, 1000);
};

// 取消匹配
Engine.cancelMatchmaking = function() {
  clearInterval(Engine.matchState.queueTimer);
  document.getElementById('matchmaking-modal').classList.add('hidden');
};

// 2. 初始化對局與生成動態頭像 HUD
Engine.startActualMatch = function() {
  Engine.matchState.scoreBlue = 0;
  Engine.matchState.scoreRed = 0;
  
  document.getElementById('custom-game-hud').classList.remove('hidden');
  Engine.initRoundEntities();
};

Engine.initRoundEntities = function() {
  document.getElementById('hud-score-blue').innerText = Engine.matchState.scoreBlue;
  document.getElementById('hud-score-red').innerText = Engine.matchState.scoreRed;
  
  // 生成頂部特戰頭像
  let blueContainer = document.getElementById('hud-avatars-blue');
  let redContainer = document.getElementById('hud-avatars-red');
  blueContainer.innerHTML = '';
  redContainer.innerHTML = '';
  
  Engine.matchState.entities = [];
  let mode = Engine.matchState.currentMode;
  
  // 藍方 (玩家 + 電腦夥伴)
  for(let i=0; i<mode; i++) {
    let isRealPlayer = (i === 0);
    let id = "blue_" + i;
    Engine.matchState.entities.push({
      id: id, team: 'blue', isPlayer: isRealPlayer, isDead: false,
      hp: 100, x: 150, y: 100 + (i * 60), speed: 4
    });
    
    let slot = document.createElement('div');
    slot.className = "hud-avatar-slot";
    slot.id = "hud-slot-" + id;
    blueContainer.appendChild(slot);
  }
  
  // 紅方 (身法走位拉滿的超強 AI 電腦)
  for(let i=0; i<mode; i++) {
    let id = "red_" + i;
    Engine.matchState.entities.push({
      id: id, team: 'red', isPlayer: false, isDead: false,
      hp: 100, x: 750, y: 100 + (i * 60), speed: 4, // HP 與速度皆跟玩家一樣，不搞數值碾壓
      // 身法參數
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      lastDecisionTime: 0,
      jiggleFrequency: Math.random() * 0.04 + 0.06
    });
    
    let slot = document.createElement('div');
    slot.className = "hud-avatar-slot";
    slot.id = "hud-slot-" + id;
    redContainer.appendChild(slot);
  }
};

// 3. 【關鍵點】：高端身法 AI 的走位更新邏輯 (請嵌入在你的核心遊戲 tick/update 迴圈內)
Engine.updateSmartAI = function(bot, currentTime) {
  if (bot.isDead) return;
  
  // 尋找最近的藍方敵人
  let targets = Engine.matchState.entities.filter(e => e.team === 'blue' && !e.isDead);
  if (targets.length === 0) return;
  let primaryTarget = targets[0];
  
  let dx = primaryTarget.x - bot.x;
  let dy = primaryTarget.y - bot.y;
  let angle = Math.atan2(dy, dx);
  
  // 高頻率快速不規則變向 (AD Jiggle / 晃頭防爆頭模擬)
  if (currentTime - bot.lastDecisionTime > Math.random() * 150 + 120) {
    bot.strafeDir *= -1; // 瞬間反轉左右平移方向
    bot.lastDecisionTime = currentTime;
  }
  
  // 計算切線方向 (垂直於目標的角度) 以進行完美的左右橫移
  let strafeAngle = angle + (Math.PI / 2);
  
  // 結合正弦波與急停慣性，形成極難被預判的交叉碎步身法
  let microStep = Math.sin(currentTime * bot.jiggleFrequency) * 1.8;
  
  let moveX = Math.cos(strafeAngle) * bot.strafeDir * (1.5 + microStep);
  let moveY = Math.sin(strafeAngle) * bot.strafeDir * (1.5 + microStep);
  
  // 保持中距離交戰拉扯 (如果離目標太遠則往前靠，太近則邊身法邊後撤)
  let dist = Math.hypot(dx, dy);
  if (dist > 320) {
    moveX += Math.cos(angle) * 0.8;
    moveY += Math.sin(angle) * 0.8;
  } else if (dist < 180) {
    moveX -= Math.cos(angle) * 1.0;
    moveY -= Math.sin(angle) * 1.0;
  }
  
  // 向量正規化，確保最終移動速度不超過基础速度 (不作弊、純靠身法)
  let totalMove = Math.hypot(moveX, moveY);
  if (totalMove > 0) {
    bot.x += (moveX / totalMove) * bot.speed;
    bot.y += (moveY / totalMove) * bot.speed;
  }
};

// 4. 回合得分判定 (5分制規則)
Engine.registerKill = function(targetEntityId) {
  let ent = Engine.matchState.entities.find(e => e.id === targetEntityId);
  if (!ent || ent.isDead) return;
  
  ent.isDead = true;
  // 更新頂部 HUD，對應頭像打叉變灰
  let slot = document.getElementById("hud-slot-" + targetEntityId);
  if (slot) slot.classList.add('is-dead');
  
  // 檢查是否有某一隊伍全滅
  let blueAlive = Engine.matchState.entities.some(e => e.team === 'blue' && !e.isDead);
  let redAlive = Engine.matchState.entities.some(e => e.team === 'red' && !e.isDead);
  
  if (!blueAlive || !redAlive) {
    if (!blueAlive) Engine.matchState.scoreRed++;
    if (!redAlive) Engine.matchState.scoreBlue++;
    
    // 檢查 5 分制勝負
    if (Engine.matchState.scoreBlue >= 5) {
      Engine.triggerRankUpgrade(); // 藍方(玩家隊伍)贏滿 5 分，啟動帥氣牌位升級動畫！
    } else if (Engine.matchState.scoreRed >= 5) {
      alert("對局結束！紅方 AI 靠精湛身法取得了勝利。");
      Engine.exitMatchToMenu();
    } else {
      // 繼續下一回合
      setTimeout(() => { Engine.initRoundEntities(); }, 1500);
    }
  }
};

// 5. 觸發精緻帥氣牌位升級動畫與震撼合成音效
Engine.triggerRankUpgrade = function() {
  let overlay = document.getElementById('rank-upgrade-overlay');
  overlay.classList.remove('hidden');
  
  // Web Audio API 自製重低音與金屬流光衝擊音效
  if (window.AudioContext || window.webkitAudioContext) {
    let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 震撼低音轟炸
    let bassOsc = audioCtx.createOscillator();
    let bassGain = audioCtx.createGain();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(140, audioCtx.currentTime);
    bassOsc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 1.5);
    bassGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    
    bassOsc.connect(bassGain);
    bassGain.connect(audioCtx.destination);
    bassOsc.start(); bassOsc.stop(audioCtx.currentTime + 1.5);
  }
  
  // 點擊任意處關閉動畫並重置回選單
  overlay.onclick = function() {
    overlay.classList.add('hidden');
    Engine.exitMatchToMenu();
  };
};

Engine.exitMatchToMenu = function() {
  document.getElementById('custom-game-hud').classList.add('hidden');
  // 這裡呼叫你原本返回主選單面板的程式碼邏輯
};