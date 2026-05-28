// ==========================================
// QUANTUM ENGINE 7.0 - ULTIMA GRAPHICS CORE
// ==========================================
const Engine = {
  device: 'PC',
  mode: 'PUBLIC',
  isRunning: false,
  canvas: null, ctx: null, loopId: null,
  frame: 0, screenShake: 0,
  
  player: {
    x: 0, y: 0, vx: 0, vy: 0, speed: 5, facing: 1,
    hp: 200, maxHp: 200, kills: 0, deaths: 0,
    isAttacking: false, attackTimer: 0,
    cd: { q: 0, e: 0, shift: 0 },
    trails: []
  },
  
  projectiles: [], enemies: [], particles: [],

  setText: function(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  },
  setWidth: function(id, percent) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, Math.min(100, percent)) + "%";
  },
  setHeight: function(id, percent) {
    const el = document.getElementById(id);
    if (el) el.style.height = Math.max(0, Math.min(100, percent)) + "%";
  },

  toggleDevice: function() {
    this.device = this.device === 'PC' ? 'MOBILE' : 'PC';
    const btn = document.getElementById("btn-toggle-device");
    if(!btn) return;
    if(this.device === 'MOBILE') {
      btn.innerHTML = "📱 目前模式：手機觸控 (點擊切換 PC)";
      btn.style.background = "linear-gradient(90deg, #d97706, #b45309)";
    } else {
      btn.innerHTML = "💻 目前模式：PC 鍵盤 (點擊切換手機)";
      btn.style.background = "linear-gradient(90deg, #7c3aed, #6d28d9)";
    }
  },

  keys: {},
  setupInput: function() {
    window.onkeydown = (e) => {
      this.keys[e.code] = true;
      if(e.code === 'Space') this.attack();
      if(e.code === 'KeyQ') this.cast('Q');
      if(e.code === 'KeyE') this.cast('E');
      if(e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.cast('Shift');
    };
    window.onkeyup = (e) => { this.keys[e.code] = false; };

    const joyZone = document.getElementById('joy-zone');
    const joyKnob = document.getElementById('joy-knob');
    if(!joyZone || !joyKnob) return;

    let joyActive = false, joyCenter = {x:0, y:0};

    joyZone.addEventListener('touchstart', (e) => {
      e.preventDefault(); joyActive = true;
      const rect = joyZone.getBoundingClientRect();
      joyCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
      this.updateJoystick(e.touches[0], joyCenter, joyKnob);
    }, {passive: false});

    joyZone.addEventListener('touchmove', (e) => {
      e.preventDefault(); if(joyActive) this.updateJoystick(e.touches[0], joyCenter, joyKnob);
    }, {passive: false});

    joyZone.addEventListener('touchend', (e) => {
      e.preventDefault(); joyActive = false;
      joyKnob.style.transform = `translate(0px, 0px)`;
      this.player.vx = 0; this.player.vy = 0;
    });
  },

  updateJoystick: function(touch, center, knob) {
    let dx = touch.clientX - center.x;
    let dy = touch.clientY - center.y;
    let dist = Math.hypot(dx, dy);
    let maxDist = 50;
    
    if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    
    this.player.vx = (dx / maxDist) * this.player.speed;
    this.player.vy = (dy / maxDist) * this.player.speed;
    if(this.player.vx > 0.5) this.player.facing = 1;
    if(this.player.vx < -0.5) this.player.facing = -1;
  },

  launch: function(selectedMode) {
    this.mode = selectedMode;
    const name = document.getElementById('input-name').value || "量子遊俠";
    const room = document.getElementById('input-room').value || "ROOM_777";
    
    document.getElementById('ui-main-menu').classList.add('hidden');
    document.getElementById('ui-game-viewport').classList.remove('hidden');
    
    if(this.device === 'MOBILE') {
      document.getElementById('mobile-ui').classList.remove('hidden');
      document.getElementById('pc-footer').classList.add('hidden');
    } else {
      document.getElementById('mobile-ui').classList.add('hidden');
      document.getElementById('pc-footer').classList.remove('hidden');
    }

    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    this.player.x = 0; this.player.y = 0; this.player.vx = 0; this.player.vy = 0;
    this.player.hp = this.player.maxHp;
    this.projectiles = []; this.enemies = []; this.particles = [];
    
    this.setText('hud-name', name);
    this.setText('hud-room', room);
    this.setupInput();

    this.isRunning = true;
    
    if(this.mode === 'PVP') {
      const mask = document.getElementById('ui-overlay-mask');
      const msg = document.getElementById('txt-overlay-msg');
      mask.classList.remove('hidden');
      msg.style.fontSize = "24px";
      msg.innerText = "📡 正在全球伺服器尋找真實對手...";
      
      setTimeout(() => {
        msg.style.fontSize = "80px"; msg.innerText = "3";
        this.spawnRival();
        setTimeout(() => { msg.innerText = "2"; }, 1000);
        setTimeout(() => { msg.innerText = "1"; }, 2000);
        setTimeout(() => { msg.innerText = "FIGHT!"; }, 3000);
        setTimeout(() => { mask.classList.add('hidden'); }, 3800);
      }, 1500);
    } else {
      for(let i=0; i<5; i++) this.spawnEnemy();
    }

    if(this.loopId) cancelAnimationFrame(this.loopId);
    const loop = () => { if(this.isRunning) { this.update(); this.render(); this.loopId = requestAnimationFrame(loop); } };
    this.loopId = requestAnimationFrame(loop);
  },

  resizeCanvas: function() {
    if(!this.canvas) return;
    this.canvas.width = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
  },

  exitGame: function() {
    this.isRunning = false;
    document.getElementById('ui-game-viewport').classList.add('hidden');
    document.getElementById('ui-main-menu').classList.remove('hidden');
    const dv = document.getElementById('danger-vignette');
    if(dv) dv.className = "vignette-fx";
  },

  attack: function() {
    if(this.player.isAttacking || this.player.hp <= 0) return;
    this.player.isAttacking = true; this.player.attackTimer = 12;
    
    this.enemies.forEach(e => {
      if(e.hp > 0 && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 80) {
        e.hp -= 25; this.screenShake = 6;
        this.createParticles(e.x, e.y, "#ffffff", 12);
        if(e.hp <= 0) this.handleKill(e);
      }
    });
  },

  cast: function(skill) {
    if(this.player.hp <= 0) return;
    
    if(skill === 'Q' && this.player.cd.q <= 0) {
      this.player.cd.q = 45;
      this.projectiles.push({ x: this.player.x, y: this.player.y, vx: this.player.facing * 14, vy: 0, life: 45 });
    }
    else if(skill === 'E' && this.player.cd.e <= 0) {
      this.player.cd.e = 120;
      this.screenShake = 12;
      this.enemies.forEach(e => {
        if(e.hp > 0 && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 150) {
          e.hp -= 45; this.createParticles(e.x, e.y, "#00f0ff", 16);
          if(e.hp <= 0) this.handleKill(e);
        }
      });
    }
    else if(skill === 'Shift' && this.player.cd.shift <= 0) {
      this.player.cd.shift = 80;
      this.createParticles(this.player.x, this.player.y, "#7c3aed", 10);
      this.player.x += this.player.facing * 160;
      this.limitBounds();
    }
  },

  handleKill: function(entity) {
    this.player.kills++;
    this.setText('hud-kda', `${this.player.kills} 殺 / ${this.player.deaths} 死`);
    if(entity.isRival) {
      setTimeout(() => { this.exitGame(); alert("🎉 終極死鬥勝利！你擊潰了高階代碼實體！"); }, 1000);
    } else {
      setTimeout(() => { if(this.isRunning && this.mode==='PUBLIC') this.spawnEnemy(); }, 1500);
    }
  },

  createParticles: function(x, y, color, count = 8) {
    for(let i=0; i<count; i++) {
      let ang = Math.random() * Math.PI * 2;
      let spd = Math.random() * 6 + 2;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 25, maxLife: 25, color: color
      });
    }
  },

  spawnEnemy: function() {
    let ang = Math.random() * Math.PI * 2;
    let dist = Math.random() * 300 + 200;
    this.enemies.push({ 
      id: Math.random(), 
      x: this.player.x + Math.cos(ang)*dist, 
      y: this.player.y + Math.sin(ang)*dist, 
      hp: 60, maxHp: 60, speed: 2.2, isRival: false 
    });
  },

  spawnRival: function() {
    this.enemies.push({ id: 'rival', x: 250, y: 50, hp: 200, maxHp: 200, speed: 3.8, isRival: true, name: "ALPHA_RIVAL_99" });
  },

  limitBounds: function() {
    if(isNaN(this.player.x)) this.player.x = 0;
    if(isNaN(this.player.y)) this.player.y = 0;
    const limit = 750;
    if(this.player.x > limit) this.player.x = limit;
    if(this.player.x < -limit) this.player.x = -limit;
    if(this.player.y > limit) this.player.y = limit;
    if(this.player.y < -limit) this.player.y = -limit;
  },

  update: function() {
    this.frame++;
    const p = this.player;

    if(p.hp <= 0) {
      const dv = document.getElementById('danger-vignette');
      if(dv) dv.className = "vignette-fx dead-glow";
      return;
    }

    ['q', 'e', 'shift'].forEach(sk => {
      if(p.cd[sk] > 0) {
        p.cd[sk]--;
        let maxCd = sk==='q' ? 45 : sk==='e' ? 120 : 80;
        let pct = (p.cd[sk] / maxCd) * 100;
        this.setHeight(`pcd-${sk}`, pct); this.setHeight(`mcd-${sk}`, pct);
      }
    });

    if(p.isAttacking) { p.attackTimer--; if(p.attackTimer<=0) p.isAttacking = false; }
    if(this.screenShake > 0) this.screenShake--;

    if(this.device === 'PC') {
      let moveX = 0, moveY = 0;
      if(this.keys['KeyW'] || this.keys['ArrowUp']) moveY = -p.speed;
      if(this.keys['KeyS'] || this.keys['ArrowDown']) moveY = p.speed;
      if(this.keys['KeyA'] || this.keys['ArrowLeft']) { moveX = -p.speed; p.facing = -1; }
      if(this.keys['KeyD'] || this.keys['ArrowRight']) { moveX = p.speed; p.facing = 1; }
      p.x += moveX; p.y += moveY;
      p.vx = moveX; p.vy = moveY;
    } else {
      p.x += p.vx; p.y += p.vy;
    }

    this.limitBounds();

    if(this.frame % 2 === 0 && (Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1)) {
      p.trails.push({ x: p.x, y: p.y, alpha: 0.5 });
    }
    if(p.trails.length > 6) p.trails.shift();
    p.trails.forEach(t => t.alpha -= 0.08);
    p.trails = p.trails.filter(t => t.alpha > 0);

    this.projectiles.forEach(pj => {
      pj.x += pj.vx; pj.y += pj.vy; pj.life--;
      this.enemies.forEach(e => {
        if(e.hp > 0 && Math.hypot(pj.x - e.x, pj.y - e.y) < 32) {
          e.hp -= 35; pj.life = 0; this.createParticles(e.x, e.y, "#ff3300", 10);
          if(e.hp <= 0) this.handleKill(e);
        }
      });
    });
    this.projectiles = this.projectiles.filter(pj => pj.life > 0);

    this.enemies.forEach(e => {
      if(e.hp > 0) {
        let dx = p.x - e.x; let dy = p.y - e.y;
        let dist = Math.hypot(dx, dy);
        if(dist > 25) {
           e.x += (dx/dist) * e.speed + (e.isRival ? Math.sin(this.frame*0.08)*2.5 : 0);
           e.y += (dy/dist) * e.speed;
        } else if (Math.random() < 0.07) {
           p.hp = Math.max(0, p.hp - (e.isRival ? 14 : 6));
           this.screenShake = 7;
           const vig = document.getElementById('danger-vignette');
           if(vig) {
             vig.classList.add('blood-flash');
             setTimeout(() => vig.classList.remove('blood-flash'), 120);
           }
           if(p.hp <= 0) {
             p.deaths++; this.setText('hud-kda', `${p.kills} 殺 / ${p.deaths} 死`);
           }
        }
      }
    });

    this.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.life--; });
    this.particles = this.particles.filter(pt => pt.life > 0);

    this.setText('hud-pos', `X:${Math.round(p.x)} Y:${Math.round(p.y)}`);
    this.setWidth('bar-hp', (p.hp/p.maxHp)*100);
  },

  render: function() {
    if(!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.save();
    let sx = this.screenShake > 0 ? (Math.random()-0.5)*12 : 0;
    let sy = this.screenShake > 0 ? (Math.random()-0.5)*12 : 0;
    ctx.translate(this.canvas.width/2 + sx, this.canvas.height/2 + sy);
    ctx.translate(-this.player.x, -this.player.y);

    // 科技感背景網格
    ctx.strokeStyle = "rgba(0, 240, 255, 0.04)"; ctx.lineWidth = 1;
    let gridS = 60;
    let startX = Math.floor((this.player.x - this.canvas.width)/gridS)*gridS;
    let endX = Math.floor((this.player.x + this.canvas.width)/gridS)*gridS;
    let startY = Math.floor((this.player.y - this.canvas.height)/gridS)*gridS;
    let endY = Math.floor((this.player.y + this.canvas.height)/gridS)*gridS;
    
    for(let x = startX; x <= endX; x+=gridS) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for(let y = startY; y <= endY; y+=gridS) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // 戰場死鬥紅色邊界
    ctx.strokeStyle = "rgba(255, 0, 85, 0.6)"; ctx.lineWidth = 4;
    ctx.shadowBlur = 15; ctx.shadowColor = "#ff0055";
    ctx.strokeRect(-750, -750, 1500, 1500);
    ctx.shadowBlur = 0;

    // 繪製非方塊的「高科技流線型」敵人
    this.enemies.forEach(e => {
      if(e.hp > 0) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = e.isRival ? "#c084fc" : "#ef4444";
        ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle;
        
        // 3A 尖刺異形核心形狀
        ctx.beginPath();
        ctx.moveTo(0, -15); ctx.lineTo(12, 10); ctx.lineTo(-12, 10);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        
        // 血條
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(e.x-20, e.y-25, 40, 4);
        ctx.fillStyle = "#ef4444"; ctx.fillRect(e.x-20, e.y-25, (e.hp/e.maxHp)*40, 4);
        
        if(e.isRival) {
          ctx.fillStyle = "#fff"; ctx.font = "bold 11px Orbitron"; ctx.textAlign = "center";
          ctx.fillText(e.name, e.x, e.y-32);
        }
      }
    });

    // 繪製高亮技能彈道
    this.projectiles.forEach(pj => {
      let gradient = ctx.createRadialGradient(pj.x, pj.y, 2, pj.x, pj.y, 10);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, '#ff5500');
      gradient.addColorStop(1, 'rgba(255,85,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(pj.x, pj.y, 12, 0, Math.PI*2); ctx.fill();
    });

    // 繪製碎裂爆破粒子
    this.particles.forEach(pt => {
      ctx.fillStyle = pt.color; ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillRect(pt.x-2, pt.y-2, 4, 4);
    });
    ctx.globalAlpha = 1;

    // 繪製真正的「量子戰神」主角（拒絕黃色方塊門！）
    if(this.player.hp > 0) {
      // 藍色霓虹動態殘影
      this.player.trails.forEach(t => {
        ctx.fillStyle = "#00f0ff"; ctx.globalAlpha = t.alpha;
        ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // 呼吸浮動上下位移
      let bob = Math.sin(this.frame * 0.12) * 3;
      
      ctx.save();
      ctx.translate(this.player.x, this.player.y + bob);
      
      // 量子核心水晶造型 (六角形)
      ctx.fillStyle = "#00f0ff";
      ctx.shadowBlur = 25; ctx.shadowColor = "#00f0ff";
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        let angle = (Math.PI / 3) * i;
        ctx.lineTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
      }
      ctx.closePath(); ctx.fill();
      
      // 核心發光點
      ctx.fillStyle = "#ffffff"; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      
      // 3A 級弧形動態殘影斬擊特效
      if(this.player.isAttacking) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 5;
        ctx.shadowBlur = 20; ctx.shadowColor = "#00f0ff";
        ctx.beginPath();
        let baseAng = this.player.facing === 1 ? 0 : Math.PI;
        ctx.arc(this.player.x, this.player.y, 45, baseAng - 1.2, baseAng + 1.2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    
    ctx.restore();
  }
};

// 確保畫面在縮放時不會錯位
window.addEventListener('resize', () => { if(Engine.canvas) Engine.resizeCanvas(); });
