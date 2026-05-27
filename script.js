// ==========================================
// 1. 免外部資源的高擬真音訊引擎 (相容性 100% 函數結構)
// ==========================================
const AudioEngine = {
    ctx: null,
    musicInterval: null,
    beat: 0,
    init: function() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playTone: function(freq, type, duration, volume, slideTo) {
        if (!this.ctx) return;
        try {
            let osc = this.ctx.createOscillator();
            let gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (slideTo && slideTo > 0) {
                osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
            }
            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch(e){}
    },
    playSFX: function(kind) {
        this.init();
        if (kind === 'slash') this.playTone(500, 'triangle', 0.08, 0.1, 60);
        if (kind === 'dash') this.playTone(1000, 'sine', 0.12, 0.08, 300);
        if (kind === 'hit') this.playTone(130, 'sawtooth', 0.1, 0.2, 20);
        if (kind === 'loot') this.playTone(700, 'sine', 0.15, 0.15, 1100);
        if (kind === 'levelup') this.playTone(550, 'sine', 0.2, 0.15);
        if (kind === 'death') this.playTone(200, 'sawtooth', 0.6, 0.3, 10);
    },
    startAdventureMusic: function() {
        this.init();
        if (this.musicInterval) clearInterval(this.musicInterval);
        
        // 冒險感背景音樂生成器
        const notes = [261.63, 293.66, 329.63, 392.00, 349.23, 329.63, 293.66, 392.00]; 
        const baseNotes = [130.81, 146.83, 164.81, 196.00];
        const self = this;

        this.musicInterval = setInterval(function() {
            if (!gameRunning) return;
            // 播放低音貝斯節奏
            if (self.beat % 2 === 0) {
                let bNote = baseNotes[Math.floor(self.beat / 2) % baseNotes.length];
                self.playTone(bNote, 'triangle', 0.25, 0.05);
            }
            // 播放高音冒險主旋律
            if (self.beat % 4 === 0 || self.beat % 7 === 0) {
                let mNote = notes[self.beat % notes.length];
                self.playTone(mNote, 'sine', 0.2, 0.03);
            }
            self.beat = (self.beat + 1) % 32;
        }, 180);
    },
    stopMusic: function() {
        if (this.musicInterval) clearInterval(this.musicInterval);
    }
};

// ==========================================
// 2. 核心按鍵矩陣控制
// ==========================================
let keybinds = {
    UP: "KeyW", DOWN: "KeyS", LEFT: "KeyA", RIGHT: "KeyD",
    ATTACK: "Space", LOOT: "KeyY"
};
let isRebinding = null;

function startRebind(action) {
    isRebinding = action;
    const btn = document.getElementById(`btn-bind-${action}`);
    if (btn) btn.innerText = "⏳ 偵測中...";
}

const activeKeys = {};
window.addEventListener("keydown", function(e) {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
    }
    if (isRebinding) {
        keybinds[isRebinding] = e.code;
        let showName = e.code.replace("Key", "").replace("Digit", "");
        document.getElementById(`btn-bind-${isRebinding}`).innerText = showName;
        isRebinding = null;
        return;
    }
    if (e.code === "KeyB") {
        toggleInventoryUI();
    }
    activeKeys[e.code] = true;
});
window.addEventListener("keyup", function(e) { activeKeys[e.code] = false; });

// ==========================================
// 3. 遊戲世界配置 (四大地圖維度)
// ==========================================
const canvas = document.getElementById("world-canvas");
const ctx = canvas.getContext("2d");
canvas.width = 900; canvas.height = 600; // 放大畫面

let gameRunning = false;
let particles = [];
let floatingTexts = [];
let loadedChunks = {};
let dayNightTimer = 400;
const dayDuration = 2400;

const camera = { x: 0, y: 0, lerp: 0.1 };
const CHUNK_SIZE = 800;

// 玩家屬性
const player = {
    x: 400, y: 300, size: 24, speed: 4.5,
    hp: 100, maxHp: 100, level: 1, xp: 0,
    facing: "right", isAttacking: false, attackTimer: 0, attackDuration: 10,
    currentDimension: "surface", // 四大維度: surface(地上), sky(天空), underground(地底), yama(閻王城堡)
    weaponTier: "wood", armorTier: "cloth", bossKills: 0,
    nearChest: null, activeLootChest: null,
    inventory: { wood: 4, stone: 0, iron: 0, gold: 0, diamond: 0, coal: 0 }
};

const gearStats = {
    weapon: { wood: { name: "基礎木刃", dmg: 14 }, iron_sword: { name: "鋼鐵合金刃", dmg: 30 }, gold_sword: { name: "聚合星耀刃", dmg: 60 } },
    armor: { cloth: { name: "布質外衣", bonusHp: 0 }, iron_armor: { name: "納米防護輕甲", bonusHp: 50 } }
};

function getXpNeeded(lvl) { return Math.round(100 * Math.pow(lvl, 1.6)); }

// 四大地圖與地上生態域劃分演算法
function getDimensionLabel() {
    if (player.currentDimension === "sky") return "☁️ 天空島嶼 (高空環境)";
    if (player.currentDimension === "underground") return "🌋 地底礦坑 (核心深淵)";
    if (player.currentDimension === "yama") return "🏰 閻王城堡區域 (烈焰核心)";
    
    // 地上世界細分四季
    let cx = Math.floor(player.x / CHUNK_SIZE);
    let cy = Math.floor(player.y / CHUNK_SIZE);
    if (cx >= 0 && cy >= 0) return "🌍 地上世界 (常春平原)";
    if (cx < 0 && cy >= 0) return "🌍 地上世界 (盛夏荒漠)";
    if (cx >= 0 && cy < 0) return "🌍 地上世界 (楓紅秋陵)";
    return "🌍 地上世界 (凜冬雪國)";
}

// 智慧型多維度實體生成器
function ensureChunkGenerated(cx, cy) {
    const key = `${player.currentDimension}_${cx},${cy}`;
    if (loadedChunks[key]) return;

    const chunkEntities = [];
    const dim = player.currentDimension;

    if (dim === "surface") {
        // 地上世界的分布
        let rx = cx * CHUNK_SIZE + Math.random() * CHUNK_SIZE;
        let ry = cy * CHUNK_SIZE + Math.random() * CHUNK_SIZE;
        chunkEntities.push(createEntity(rx, ry, "tree"));
        chunkEntities.push(createEntity(rx + 80, ry + 20, "slime"));
        
        // 隨機生成房屋與寶箱
        if (Math.random() < 0.4) {
            let hx = cx * CHUNK_SIZE + 200 + Math.random() * 300;
            let hy = cy * CHUNK_SIZE + 200 + Math.random() * 300;
            chunkEntities.push(createEntity(hx, hy, "house"));
            chunkEntities.push(createEntity(hx + 35, hy + 45, "chest"));
        }
    } 
    else if (dim === "sky") {
        // 天空島嶼地圖
        for (let i = 0; i < 3; i++) {
            let rx = cx * CHUNK_SIZE + Math.random() * CHUNK_SIZE;
            let ry = cy * CHUNK_SIZE + Math.random() * CHUNK_SIZE;
            chunkEntities.push(createEntity(rx, ry, "sky_spirit"));
            if (Math.random() < 0.3) chunkEntities.push(createEntity(rx + 40, ry, "chest"));
        }
    } 
    else if (dim === "underground") {
        // 地底礦坑地圖
        for (let i = 0; i < 4; i++) {
            let rx = cx * CHUNK_SIZE + Math.random() * CHUNK_SIZE;
            let ry = cy * CHUNK_SIZE + Math.random() * CHUNK_SIZE;
            chunkEntities.push(createEntity(rx, ry, Math.random() < 0.5 ? "iron_ore" : "frost_golem"));
        }
        let hx = cx * CHUNK_SIZE + 400; let hy = cy * CHUNK_SIZE + 300;
        chunkEntities.push(createEntity(hx, hy, "chest"));
    } 
    else if (dim === "yama") {
        // 烈焰森林與閻王城堡核心地圖
        for (let i = 0; i < 4; i++) {
            let rx = cx * CHUNK_SIZE + Math.random() * CHUNK_SIZE;
            let ry = cy * CHUNK_SIZE + Math.random() * CHUNK_SIZE;
            chunkEntities.push(createEntity(rx, ry, "castle_guard"));
        }
        // 核心座標生成大 Boss 閻王
        if (cx === 0 && cy === 0) {
            chunkEntities.push(createEntity(cx * CHUNK_SIZE + 450, cy * CHUNK_SIZE + 300, "yama_boss"));
        }
    }

    loadedChunks[key] = chunkEntities;
}

function getLocalEntities() {
    const pcx = Math.floor(player.x / CHUNK_SIZE);
    const pcy = Math.floor(player.y / CHUNK_SIZE);
    let list = [];
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            ensureChunkGenerated(pcx + x, pcy + y);
            list = list.concat(loadedChunks[`${player.currentDimension}_${pcx + x},${pcy + y}`]);
        }
    }
    return list;
}

// ==========================================
// 4. 物件實體建構核心 (相容性 100% 結構)
// ==========================================
function createEntity(x, y, type) {
    let obj = {
        id: Math.random().toString(), x: x, y: y, type: type, dead: false, flash: 0, bob: Math.random() * 50,
        name: "", maxHp: 10, col: "#fff", isMob: false, isBoss: false,
        lootTable: null // 三角洲式搜刮品項庫
    };

    if (type === "tree") { obj.name = "松源木"; obj.maxHp = 30; obj.col = "#2e7d32"; }
    else if (type === "iron_ore") { obj.name = "地底聚合鐵"; obj.maxHp = 60; obj.col = "#90a4ae"; }
    else if (type === "house") { obj.name = "生存避難所"; obj.maxHp = 99999; obj.col = "#5d4037"; }
    else if (type === "chest") { 
        obj.name = "物資寶箱"; obj.maxHp = 99999; obj.col = "#ffa000"; 
        // 隨機產生三角洲物資庫內容
        obj.lootTable = [
            { item: "iron", name: "🔩 聚合鐵分子", count: Math.floor(Math.random()*3)+2 },
            { item: "gold", name: "🪙 精煉金原質", count: Math.floor(Math.random()*2)+1 },
            { item: "diamond", name: "💎 秩序晶鑽", count: Math.random() < 0.3 ? 1 : 0 }
        ].filter(function(i) { return i.count > 0; });
    }
    // 生物
    else if (type === "slime") { obj.name = "黏液怪"; obj.maxHp = 25; obj.col = "#aee093"; obj.isMob = true; }
    else if (type === "sky_spirit") { obj.name = "天界浮游靈"; obj.maxHp = 40; obj.col = "#e0f7fa"; obj.isMob = true; }
    else if (type === "frost_golem") { obj.name = "岩窟守衛"; obj.maxHp = 70; obj.col = "#80deea"; obj.isMob = true; }
    else if (type === "castle_guard") { obj.name = "冥府重裝衛兵"; obj.maxHp = 140; obj.col = "#455a64"; obj.isMob = true; }
    else if (type === "yama_boss") { obj.name = "👹 閻王"; obj.maxHp = 1200; obj.col = "#4a148c"; obj.isMob = true; obj.isBoss = true; }

    obj.hp = obj.maxHp;

    obj.takeDamage = function(dmg) {
        if (this.type === "house" || this.type === "chest") return;
        this.hp -= dmg; this.flash = 4;
        AudioEngine.playSFX('hit');
        
        for(let i=0; i<5; i++) particles.push(createParticle(this.x+12, this.y+12, this.col));
        floatingTexts.push(createFloatingText(this.x+6, this.y-5, `-${dmg}`, this.isBoss?'#ff1744':'#fff'));

        if (this.isBoss) {
            document.getElementById("boss-hp-container").classList.remove("hidden");
            document.getElementById("lbl-boss-hp-text").innerText = `${Math.max(0, this.hp)}/${this.maxHp}`;
            document.getElementById("boss-hp-fill").style.width = `${(Math.max(0, this.hp)/this.maxHp)*100}%`;
        }

        if (this.hp <= 0) {
            this.dead = true;
            player.xp += this.isBoss ? 500 : 30;
            if (this.isBoss) {
                player.bossKills++;
                document.getElementById("boss-hp-container").classList.add("hidden");
                floatingTexts.push(createFloatingText(player.x, player.y-40, "👑 冥界已被淨化！", "#e040fb", true));
            } else {
                // 普通怪掉基礎木料岩石
                player.inventory.wood += 2;
                player.inventory.stone += 1;
            }
            checkLevelUp();
        }
        updateUI();
    };

    obj.update = function() {
        if (this.dead) return;
        this.bob += 0.05;
        if (this.flash > 0) this.flash--;

        if (this.isMob) {
            let d = Math.hypot(player.x - this.x, player.y - this.y);
            let alertDist = this.isBoss ? 600 : 250;
            if (d < alertDist && d > 12) {
                let s = this.isBoss ? 1.9 : 1.4;
                this.x += ((player.x - this.x)/d) * s;
                this.y += ((player.y - this.y)/d) * s;
            }

            // Boss 特殊範圍法術
            if (this.isBoss && Math.random() < 0.01) {
                floatingTexts.push(createFloatingText(this.x, this.y-25, "🔥 地獄火爆風！", "#ff1744", true));
                if (Math.hypot(player.x-this.x, player.y-this.y) < 220) {
                    player.hp -= 15;
                    updateUI();
                }
            }
        }
    };

    obj.draw = function() {
        if (this.dead) return;
        ctx.save();
        if (this.flash > 0) ctx.fillStyle = "#fff";
        else ctx.fillStyle = this.col;

        if (this.type === "house") {
            ctx.fillStyle = "#5d4037"; ctx.fillRect(this.x, this.y, 90, 70);
            ctx.fillStyle = "#c62828"; ctx.beginPath(); ctx.moveTo(this.x-10, this.y); ctx.lineTo(this.x+45, this.y-30); ctx.lineTo(this.x+100, this.y); ctx.fill();
            ctx.fillStyle = "#ffeb3b"; ctx.fillRect(this.x+35, this.y+30, 20, 20);
        } else if (this.type === "chest") {
            ctx.fillStyle = "#ffa000"; ctx.fillRect(this.x, this.y, 26, 20);
            ctx.fillStyle = "#fff"; ctx.fillRect(this.x+10, this.y+4, 6, 5); // 鎖頭
        } else if (this.isBoss) {
            ctx.fillRect(this.x - 10, this.y - 10, 60, 60);
            ctx.fillStyle = "#ff1744"; ctx.fillRect(this.x+8, this.y+4, 8, 8); ctx.fillRect(this.x+32, this.y+4, 8, 8);
        } else {
            ctx.fillRect(this.x, this.y + Math.sin(this.bob)*1.5, 26, 26);
        }
        ctx.restore();
    };

    return obj;
}

function createFloatingText(x, y, txt, col, isCrit) {
    return {
        x: x, y: y, txt: txt, col: col, alpha: 1, vy: -1.8, size: isCrit ? 20 : 12,
        update: function() { this.y += this.vy; this.alpha -= 0.025; },
        draw: function() {
            if (this.alpha <= 0) return;
            ctx.save(); ctx.globalAlpha = this.alpha;
            ctx.font = `bold ${this.size}px 'Orbitron'`; ctx.fillStyle = this.col;
            ctx.fillText(this.txt, this.x, this.y); ctx.restore();
        }
    };
}

function createParticle(x, y, col) {
    return {
        x: x, y: y, vx: (Math.random()-0.5)*5, vy: (Math.random()-2)*4, col: col, alpha: 1,
        update: function() { this.x += this.vx; this.y += this.vy; this.vy += 0.15; this.alpha -= 0.05; },
        draw: function() {
            ctx.save(); ctx.globalAlpha = Math.max(0, this.alpha);
            ctx.fillStyle = this.col; ctx.fillRect(this.x, this.y, 4, 4); ctx.restore();
        }
    };
}

// ==========================================
// 5. 《三角洲行動》風格搜刮系統 & 《MC》背包
// ==========================================
function openLootUI(chestObj) {
    player.activeLootChest = chestObj;
    const container = document.getElementById("loot-items-container");
    container.innerHTML = "";

    if (!chestObj.lootTable || chestObj.lootTable.length === 0) {
        container.innerHTML = "<div style='color:#cbd5e1; font-size:12px;'>（箱子是空的）</div>";
    } else {
        chestObj.lootTable.forEach(function(item, index) {
            const row = document.createElement("div");
            row.className = "loot-row";
            row.innerHTML = `
                <span>${item.name} x ${item.count}</span>
                <button class="btn-loot-action" onclick="lootSingleItem(${index})">拾取</button>
            `;
            container.appendChild(row);
        });
    }
    document.getElementById("delta-loot-popup").classList.remove("hidden");
}

function lootSingleItem(index) {
    if (!player.activeLootChest) return;
    let chest = player.activeLootChest;
    let itemData = chest.lootTable[index];
    
    player.inventory[itemData.item] += itemData.count;
    AudioEngine.playSFX('loot');
    floatingTexts.push(createFloatingText(player.x, player.y-20, `獲得 ${itemData.name}`, "#00e676"));
    
    chest.lootTable.splice(index, 1);
    openLootUI(chest); // 刷新
    updateUI();
}

function lootAllItemsFromChest() {
    if (!player.activeLootChest) return;
    let chest = player.activeLootChest;
    
    chest.lootTable.forEach(function(item) {
        player.inventory[item.item] += item.count;
    });
    AudioEngine.playSFX('loot');
    floatingTexts.push(createFloatingText(player.x, player.y-20, "全部物資已搜刮！", "#00e676"));
    
    chest.lootTable = [];
    closeLootUI();
    updateUI();
}

function closeLootUI() {
    document.getElementById("delta-loot-popup").classList.add("hidden");
    player.activeLootChest = null;
}

function toggleInventoryUI() {
    const pop = document.getElementById("mc-inventory-popup");
    pop.classList.toggle("hidden");
    updateUI();
}

// 維度直接跳轉傳送（方便自由測試天空、地底、城堡）
function teleportToDimension(dim) {
    player.currentDimension = dim;
    player.x = 400; player.y = 300;
    floatingTexts.push(createFloatingText(player.x, player.y-30, `傳送至 ${getDimensionLabel()}`, "#d500f9", true));
    updateUI();
}

// ==========================================
// 6. UI 與資料渲染對接
// ==========================================
function updateUI() {
    let totalMaxHp = player.maxHp + gearStats.armor[player.armorTier].bonusHp;
    let currentDmg = gearStats.weapon[player.weaponTier].dmg;
    let bio = getDimensionLabel();

    // 閻王城堡玩家強化增幅
    if (player.currentDimension === "yama") {
        currentDmg = Math.round(currentDmg * 1.15);
    }

    if (document.getElementById("lbl-coords")) document.getElementById("lbl-coords").innerText = `X: ${Math.round(player.x)}, Y: ${Math.round(player.y)}`;
    if (document.getElementById("lbl-boss-kill-count")) document.getElementById("lbl-boss-kill-count").innerText = player.bossKills;
    if (document.getElementById("lbl-dimension-text")) document.getElementById("lbl-dimension-text").innerText = bio;

    // MC 面板數值
    if (document.getElementById("mc-stat-hp")) document.getElementById("mc-stat-hp").innerText = `${player.hp}/${totalMaxHp}`;
    if (document.getElementById("mc-stat-atk")) document.getElementById("mc-stat-atk").innerText = currentDmg;
    
    // MC 背包庫存數量更新
    for (let k in player.inventory) {
        let el = document.getElementById(`mc-cnt-${k}`);
        if (el) el.innerText = player.inventory[k];
    }

    // MC 裝備欄 Slots 圖示更新
    document.getElementById("slot-weapon-name").innerText = gearStats.weapon[player.weaponTier].name;
    document.getElementById("slot-armor-name").innerText = gearStats.armor[player.armorTier].name;
    document.getElementById("slot-weapon-icon").innerText = player.weaponTier === "wood" ? "🪵" : "🗡️";
    document.getElementById("slot-armor-icon").innerText = player.armorTier === "cloth" ? "🦺" : "🛡️";

    // 殘血紅光
    const vignette = document.getElementById("low-hp-vignette");
    if ((player.hp / totalMaxHp) <= 0.3 && player.hp > 0) vignette.classList.remove("hidden");
    else vignette.classList.add("hidden");
}

function checkLevelUp() {
    let req = getXpNeeded(player.level);
    while (player.xp >= req) {
        player.xp -= req;
        player.level++;
        player.maxHp += 15;
        player.hp = player.maxHp + gearStats.armor[player.armorTier].bonusHp;
        AudioEngine.playSFX('levelup');
        floatingTexts.push(createFloatingText(player.x, player.y-30, "✨ LEVEL UP!", "#ffdf00", true));
        req = getXpNeeded(player.level);
    }
}

function craftGear(tier) {
    if (tier === 'iron_sword' && player.inventory.iron >= 10 && player.inventory.stone >= 5) {
        player.inventory.iron -= 10; player.inventory.stone -= 5; player.weaponTier = "iron_sword";
    } else if (tier === 'gold_sword' && player.inventory.gold >= 15 && player.inventory.diamond >= 5) {
        player.inventory.gold -= 15; player.inventory.diamond -= 5; player.weaponTier = "gold_sword";
    } else if (tier === 'iron_armor' && player.inventory.iron >= 10 && player.inventory.wood >= 20) {
        player.inventory.iron -= 10; player.inventory.wood -= 20; player.armorTier = "iron_armor";
    } else {
        alert("⚠️ 素材不足，無法分子組合！"); return;
    }
    AudioEngine.playSFX('levelup');
    updateUI();
}

function unequipGear(cat) {
    if (cat === 'weapon') player.weaponTier = "wood";
    if (cat === 'armor') player.armorTier = "cloth";
    updateUI();
}

function triggerSaveGame() {
    const data = {
        level: player.level, xp: player.xp, hp: player.hp, maxHp: player.maxHp,
        weaponTier: player.weaponTier, armorTier: player.armorTier, dim: player.currentDimension,
        bossKills: player.bossKills, inventory: player.inventory, x: player.x, y: player.y
    };
    localStorage.setItem("yama_dim_save", JSON.stringify(data));
    alert("💾 進度已寫入時空檔案區！");
}

function triggerLoadGame() {
    const raw = localStorage.getItem("yama_dim_save");
    if (!raw) { alert("⚠️ 找不到任何存檔記錄！"); return; }
    const data = JSON.parse(raw);
    Object.assign(player, data);
    player.currentDimension = data.dim || "surface";
    startGame();
}

function toggleMenuPanel(id) { document.getElementById(id).classList.toggle("hidden"); }
function returnToMainMenu() { gameRunning = false; AudioEngine.stopMusic(); document.getElementById("game-screen").classList.add("hidden"); document.getElementById("menu-screen").classList.remove("hidden"); }

function startGame() {
    document.getElementById("menu-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    if (!gameRunning) {
        gameRunning = true;
        AudioEngine.startAdventureMusic(); // 啟動冒險音樂
        mainEngineHeartbeat();
    }
    updateUI();
}

function triggerPlayerRespawn() {
    player.hp = player.maxHp + gearStats.armor[player.armorTier].bonusHp;
    player.x = 400; player.y = 300;
    document.getElementById("death-screen").classList.add("hidden");
    updateUI();
}

// ==========================================
// 7. 遊戲核心物理推算與相機 (無抖動)
// ==========================================
function updateEngineLogic() {
    let mx = 0; let my = 0;
    if (activeKeys[keybinds.UP]) my -= 1;
    if (activeKeys[keybinds.DOWN]) my += 1;
    if (activeKeys[keybinds.LEFT]) { mx -= 1; player.facing = "left"; }
    if (activeKeys[keybinds.RIGHT]) { mx += 1; player.facing = "right"; }

    if (mx !== 0 && my !== 0) { mx *= 0.707; my *= 0.707; }
    player.x += mx * player.speed; player.y += my * player.speed;

    // 普通揮刀 [空白鍵]
    if (activeKeys[keybinds.ATTACK] && !player.isAttacking) {
        player.isAttacking = true; player.attackTimer = player.attackDuration;
        AudioEngine.playSFX('slash');

        let range = {
            x: player.facing === "right" ? player.x + player.size : player.x - 60,
            y: player.y - 15, width: 60, height: player.size + 30
        };

        let finalDmg = gearStats.weapon[player.weaponTier].dmg;
        if (player.currentDimension === "yama") finalDmg = Math.round(finalDmg * 1.15);

        getLocalEntities().forEach(function(e) {
            if (!e.dead && range.x < e.x + 26 && range.x + range.width > e.x &&
                range.y < e.y + 26 && range.y + range.height > e.y) {
                e.takeDamage(finalDmg);
            }
        });
    }

    if (player.isAttacking) {
        player.attackTimer--; if (player.attackTimer <= 0) player.isAttacking = false;
    }

    // 靠近箱子搜刮檢測機制 [Y鍵]
    let closestChest = null;
    let minDist = 60;
    getLocalEntities().forEach(function(e) {
        if (!e.dead && e.type === "chest") {
            let dist = Math.hypot(player.x - e.x, player.y - e.y);
            if (dist < minDist) { closestChest = e; }
        }
    });

    player.nearChest = closestChest;
    const promptEl = document.getElementById("interaction-prompt");
    if (player.nearChest) {
        promptEl.classList.remove("hidden");
        if (activeKeys[keybinds.LOOT] && !player.activeLootChest) {
            openLootUI(player.nearChest);
        }
    } else {
        promptEl.classList.add("hidden");
    }

    // 環境時間與怪物碰撞
    dayNightTimer = (dayNightTimer + 1) % dayDuration;
    if (document.getElementById("lbl-time-clock")) {
        let h = Math.floor((dayNightTimer/dayDuration)*24);
        let m = Math.floor(((dayNightTimer/dayDuration)*24%1)*60);
        document.getElementById("lbl-time-clock").innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    }

    getLocalEntities().forEach(function(e) {
        e.update();
        if (e.isMob && !e.dead &&
            player.x < e.x + 26 && player.x + player.size > e.x &&
            player.y < e.y + 26 && player.y + player.size > e.y) {
            
            if (Math.random() < 0.03) {
                player.hp -= e.isBoss ? 10 : 4;
                floatingTexts.push(createFloatingText(player.x, player.y-15, `-${e.isBoss?10:4}`, '#ff1744', true));
                if (player.hp <= 0) {
                    player.hp = 0; AudioEngine.playSFX('death');
                    document.getElementById("death-screen").classList.remove("hidden");
                }
                updateUI();
            }
        }
    });

    particles.forEach(function(p, i) { p.update(); if (p.alpha<=0) particles.splice(i,1); });
    floatingTexts.forEach(function(ft, i) { ft.update(); if (ft.alpha<=0) floatingTexts.splice(i,1); });

    // 平滑追蹤相機，移除所有震動程式碼，確保100%平穩
    camera.x += (player.x - canvas.width / 2 - camera.x) * camera.lerp;
    camera.y += (player.y - canvas.height / 2 - camera.y) * camera.lerp;
}

function renderGraphics() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 繪製地圖網格
    let sGridX = Math.floor(camera.x / 45) * 45; let eGridX = sGridX + canvas.width + 45;
    let sGridY = Math.floor(camera.y / 45) * 45; let eGridY = sGridY + canvas.height + 45;

    for (let gx = sGridX; gx < eGridX; gx += 45) {
        for (let gy = sGridY; gy < eGridY; gy += 45) {
            if (player.currentDimension === "sky") ctx.fillStyle = "#101e2b"; // 雲海深藍
            else if (player.currentDimension === "underground") ctx.fillStyle = "#1a1510"; // 地底黑褐
            else if (player.currentDimension === "yama") ctx.fillStyle = "#260d1a"; // 城堡暗紫
            else {
                // 地上四季
                let cx = Math.floor(gx / CHUNK_SIZE); let cy = Math.floor(gy / CHUNK_SIZE);
                if (cx >= 0 && cy >= 0) ctx.fillStyle = "#1e3f20";
                else if (cx < 0 && cy >= 0) ctx.fillStyle = "#cca043";
                else if (cx >= 0 && cy < 0) ctx.fillStyle = "#6e3b23";
                else ctx.fillStyle = "#3a4f5c";
            }
            ctx.fillRect(gx, gy, 43, 43);
        }
    }

    getLocalEntities().forEach(function(e) { e.draw(); });
    particles.forEach(function(p) { p.draw(); });
    floatingTexts.forEach(function(ft) { ft.draw(); });

    // 繪製玩家主角
    ctx.save();
    ctx.fillStyle = "#00e5ff"; ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 10;
    ctx.fillRect(player.x, player.y, player.size, player.size);
    ctx.fillStyle = "#fff";
    if (player.facing === "right") ctx.fillRect(player.x+12, player.y+5, 10, 4);
    else ctx.fillRect(player.x, player.y+5, 10, 4);
    ctx.restore();

    // 揮刀特效
    if (player.isAttacking) {
        ctx.save(); ctx.strokeStyle = "rgba(0,229,255,0.7)"; ctx.lineWidth = 4; ctx.beginPath();
        let sa = player.facing === "right" ? -Math.PI/2 : Math.PI/2;
        let ea = player.facing === "right" ? Math.PI/2 : 3*Math.PI/2;
        ctx.arc(player.x + player.size/2, player.y + player.size/2, 45, sa, ea); ctx.stroke(); ctx.restore();
    }

    ctx.restore();
}

function mainEngineHeartbeat() {
    if (!gameRunning) return;
    updateEngineLogic();
    renderGraphics();
    requestAnimationFrame(mainEngineHeartbeat);
}

updateUI();