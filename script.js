/**
 * Quantum Engine 11.9 - Gacha & Animation Patch
 * * 2026 核心動態優化紀錄：
 * 1. 3D 翻牌動畫實裝：卡牌重構為 3D 透視元件，點擊觸發 rotateY(180deg) 華麗旋轉。
 * 2. 解除單翻限制：移除全域鎖定，玩家可自由將 3 張隱藏卡牌全部翻開，獎勵拿滿。
 * 3. 動態隨機寶物池：翻牌有機率直接解碼「未解鎖技能」或「未解鎖外觀」，全解鎖則自動落入星幣保底。
 */

const Engine = {
    device: 'PC',
    mode: 'RANKED_1V1',
    isRunning: false,
    isGameFrozen: false,
    countdownValue: 3,
    countdownId: null,
    canvas: null, ctx: null, loopId: null,
    frame: 0,
    mapRadius: 900,
    keys: {},
    camera: { x: 0, y: 0, lerp: 0.08 },

    playerElo: 1200,
    oldElo: 1200,
    rankTiers: ["青銅戰將 III", "青銅戰將 II", "青銅戰將 I", "白銀先鋒 III", "白銀先鋒 II", "白銀先鋒 I", "黃金精銳 III", "黃金精銳 II", "黃金精銳 I", "璀璨鑽石 II", "璀璨鑽石 I", "星海星皇", "量子主宰"],

    settings: { sfxVolume: 0.5, bgmVolume: 0.3 },

    skillsRepo: {},
    // 22款幾何外觀矩陣
    skinsRepo: {
        'default': { name: "🤖 量子晶立方", shape: "CUBE", price: 0, desc: "標準幾何核心形態", color: "#00f0ff" },
        'skin_knight': { name: "🛡️ 聖殿重武裝", shape: "CROSS_RECT", price: 100, desc: "護體十字重盾外廓", color: "#94a3b8" },
        'skin_assassin': { name: "💎 虛空幽影菱", shape: "RHOMBUS", price: 200, desc: "高流線尖刺突刺體", color: "#c084fc" },
        'skin_mech': { name: "🦅 翼展天啟機", shape: "MECH_WING", price: 300, desc: "背部高能浮游翼外顯", color: "#38bdf8" },
        'skin_god': { name: "👑 萬神殿主宰", shape: "GOLDEN_HALO", price: 500, desc: "至高天神聖雙重環繞光輝", color: "#eab308" },
        'skin_ninja': { name: "🥷 疾風手利刃", shape: "SHURIKEN", price: 150, desc: "四角旋轉手利刃型態", color: "#10b981" },
        'skin_wizard': { name: "🔮 元素五芒星", shape: "PENTAGRAM", price: 250, desc: "核心外圍法術交織軌跡", color: "#ec4899" },
        'skin_cyborg': { name: "🧬 賽博六角格", shape: "HEXAGON", price: 180, desc: "高科技複合式蜂巢外殼", color: "#22c55e" },
        'skin_demon': { name: "😈 煉獄撒旦角", shape: "HORNED_TRI", price: 350, desc: "三角架構頂部延伸雙重尖角", color: "#ef4444" },
        'skin_angel': { name: "👼 熾天使羽翼", shape: "FEATHER_BARS", price: 400, desc: "六翼展開神聖防護羽欄", color: "#f8fafc" },
        'skin_vampire': { name: "🦇 嗜血黑蝙蝠", shape: "BAT_WING", price: 220, desc: "折疊式收縮吸血倒鉤幾何", color: "#b91c1c" },
        'skin_samurai': { name: "🏮 雙生御神刀", shape: "DUAL_SLITS", price: 280, desc: "兩柄交叉實體光刃背負型態", color: "#f97316" },
        'skin_ghost': { name: "👻 浮游幽魂體", shape: "TEARDROP", price: 120, desc: "底部離散水滴流線形狀", color: "#a5f3fc" },
        'skin_alien': { name: "👽 未知觀察者", shape: "TENTACLE_DOTS", price: 450, desc: "多節點軌道環繞幾何體", color: "#a855f7" },
        'skin_phoenix': { name: "🐦 不死鳳凰核心", shape: "FLAME_TAIL", price: 600, desc: "向後方噴發的雙重火羽流線", color: "#f43f5e" },
        'skin_glitch': { name: "👾 錯位斷層格", shape: "FRAGMENT", price: 320, desc: "不規則解體像素微型矩陣", color: "#65a30d" },
        'skin_void': { name: "🌌 虛無日蝕圈", shape: "ECLIPSE", price: 700, desc: "黑洞引力反向內縮核心環", color: "#4f46e5" },
        'skin_reaper': { name: "☠️ 死神終結鐮", shape: "SCYTHE_ARC", price: 550, desc: "周身環繞大型弧形死神鐮刀", color: "#475569" },
        'skin_paladin': { name: "☀ ` 耀日聖光柱", shape: "SUNBURST", price: 480, desc: "八向放射狀高亮防禦晶條", color: "#fbbf24" },
        'skin_toxic': { name: "☣️ 生化異變輪", shape: "BIO_WHEEL", price: 260, desc: "三叉生化輻射輪轉體", color: "#84cc16" },
        'skin_valkyrie': { name: "🔱 瓦爾基麗矛", shape: "SPEAR_CROSS", price: 520, desc: "尖銳貫穿長矛十字交叉點", color: "#2dd4bf" },
        'skin_nebula': { name: "🪐 星雲軌道儀", shape: "ORBIT_RING", price: 800, desc: "雙軸橫縱立體交互旋轉環", color: "#e0e7ff" }
    },

    player: {
        name: "無情揮刀手", x: 0, y: 0, vx: 0, vy: 0, speed: 6.5, ghostSpeed: 8.5, facing: 1,
        hp: 250, maxHp: 250, mp: 100, maxMp: 100, atkPower: 35, kills: 0, deaths: 0, starCoins: 1500,
        currentSkin: 'default', unlockedSkins: ['default'],
        equippedSkills: ['Sk_smoke', 'Sk_1'], 
        unlockedSkills: ['Sk_smoke', 'Sk_1', 'Sk_2', 'Sk_3'],
        cd: { s0: 0, s1: 0, shift: 0 },
        isAttacking: false, attackTimer: 0, isGhost: false 
    },

    enemies: [], allies: [], projectiles: [], particles: [], obstacles: [], smokes: [], 
    activeShopTab: 'skills', 

    AudioFX: {
        ctx: null, bgmInterval: null,
        init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
        play(type, freqMod = 400) {
            this.init(); const c = this.ctx; let o = c.createOscillator(), g = c.createGain();
            o.connect(g); g.connect(c.destination); let sfx = Engine.settings.sfxVolume;
            if (type === 'slash') {
                o.type = 'sawtooth'; o.frequency.setValueAtTime(550, c.currentTime);
                g.gain.setValueAtTime(0.15 * sfx, c.currentTime); o.start(); o.stop(c.currentTime + 0.08);
            } else if (type === 'hit') {
                o.type = 'triangle'; o.frequency.setValueAtTime(180, c.currentTime);
                g.gain.setValueAtTime(0.2 * sfx, c.currentTime); o.start(); o.stop(c.currentTime + 0.05);
            } else if (type === 'smoke') {
                o.type = 'sine'; o.frequency.setValueAtTime(120, c.currentTime);
                o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.4);
                g.gain.setValueAtTime(0.4 * sfx, c.currentTime); o.start(); o.stop(c.currentTime + 0.45);
            } else {
                o.type = 'sine'; o.frequency.setValueAtTime(freqMod, c.currentTime);
                g.gain.setValueAtTime(0.1 * sfx, c.currentTime); o.start(); o.stop(c.currentTime + 0.15);
            }
        },
        startBgm() {
            this.init(); this.stopBgm(); const audioCtx = this.ctx;
            let notes = [110, 130, 150, 110, 165]; let i = 0;
            this.bgmInterval = setInterval(() => {
                if (!Engine.isRunning || Engine.isGameFrozen) return;
                let o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'triangle';
                o.frequency.value = notes[i % notes.length]; o.connect(g); g.connect(audioCtx.destination);
                g.gain.setValueAtTime(0.03 * Engine.settings.bgmVolume, audioCtx.currentTime);
                o.start(); o.stop(audioCtx.currentTime + 0.2); i++;
            }, 260);
        },
        stopBgm() { if (this.bgmInterval) { clearInterval(this.bgmInterval); this.bgmInterval = null; } }
    },

    init() {
        this.generateFiftySkills();
        this.loadStorage();
        this.renderShop();
        this.renderSkillSelector();
        this.updateLobbyLabels();
        if(document.getElementById('input-name')) document.getElementById('input-name').value = this.player.name;
        window.Engine = this;
    },

    generateFiftySkills() {
        this.skillsRepo['Sk_smoke'] = { name: "☁ ️特戰虛空暗影煙", type: "SMOKE", cdMax: 200, mpCost: 25, price: 0, desc: "在原地部署一顆大型暗影防護煙區，進入裡面的敵軍緩速60%", color: "#6366f1", freq: 150 };
        this.skillsRepo['Sk_1'] = { name: "🔥 星核火球", type: "PROJECTILE", cdMax: 50, mpCost: 15, price: 0, desc: "向前方射出高熱能星核彈道", color: "#ff5500", freq: 450 };
        this.skillsRepo['Sk_2'] = { name: "🌪️ 裂空旋風", type: "PROJECTILE", cdMax: 100, mpCost: 30, price: 0, desc: "大範圍風壓周身連環切割", color: "#a855f7", freq: 300 };
        this.skillsRepo['Sk_3'] = { name: "👥 幻影突襲", type: "PROJECTILE", cdMax: 80, mpCost: 20, price: 0, desc: "向前方急速位移並留下殘影", color: "#6366f1", freq: 600 };

        let skillIdCounter = 4;
        const prefixes = ["量子", "裂空", "星核", "特斯拉", "脈衝", "熾焰", "寒霜", "虛空", "天啟", "雷霆"];
        const suffixes = ["火球", "漩渦", "電擊", "光盾", "領域", "新星", "爆彈", "波動"];
        for (let p of prefixes) {
            for (let s of suffixes) {
                if (skillIdCounter > 53) break;
                let id = `Sk_${skillIdCounter}`;
                this.skillsRepo[id] = {
                    name: `🔮 ${p}${s}`,
                    type: "PROJECTILE",
                    cdMax: 70 + Math.floor(Math.random() * 50),
                    mpCost: 12 + Math.floor(Math.random() * 20),
                    price: 150 + (skillIdCounter * 5),
                    desc: `解碼招式：釋放${p}屬性進行${s}射擊。`,
                    color: ["#ff0055", "#00f0ff", "#22c55e", "#eab308", "#ec4899", "#3b82f6"][skillIdCounter % 6],
                    freq: 250 + (skillIdCounter * 15)
                };
                skillIdCounter++;
            }
        }
    },

    loadStorage() {
        if(localStorage.getItem('QE_ELO')) this.playerElo = parseInt(localStorage.getItem('QE_ELO'));
        if(localStorage.getItem('QE_COINS')) this.player.starCoins = parseInt(localStorage.getItem('QE_COINS'));
        if(localStorage.getItem('QE_SKILLS')) this.player.equippedSkills = JSON.parse(localStorage.getItem('QE_SKILLS'));
        if(localStorage.getItem('QE_UNL_SKILLS')) this.player.unlockedSkills = JSON.parse(localStorage.getItem('QE_UNL_SKILLS'));
        if(localStorage.getItem('QE_UNL_SKINS')) this.player.unlockedSkins = JSON.parse(localStorage.getItem('QE_UNL_SKINS'));
        if(localStorage.getItem('QE_SKIN')) this.player.currentSkin = localStorage.getItem('QE_SKIN');
    },

    saveStorage() {
        localStorage.setItem('QE_ELO', this.playerElo);
        localStorage.setItem('QE_COINS', this.player.starCoins);
        localStorage.setItem('QE_SKILLS', JSON.stringify(this.player.equippedSkills));
        localStorage.setItem('QE_UNL_SKILLS', JSON.stringify(this.player.unlockedSkills));
        localStorage.setItem('QE_UNL_SKINS', JSON.stringify(this.player.unlockedSkins));
        localStorage.setItem('QE_SKIN', this.player.currentSkin);
    },

    updateLobbyLabels() {
        if(document.getElementById('lobby-elo')) document.getElementById('lobby-elo').innerText = this.playerElo;
        let t = Math.min(this.rankTiers.length-1, Math.max(0, Math.floor((this.playerElo - 1000)/100)));
        if(document.getElementById('lobby-rank')) document.getElementById('lobby-rank').innerText = this.rankTiers[t];
    },

    switchDevice(type) {
        this.device = type.toUpperCase();
        const mobileUI = document.getElementById('mobile-ui');
        const pcFooter = document.getElementById('pc-footer');
        if (mobileUI) mobileUI.classList.toggle('hidden', this.device !== 'MOBILE');
        if (pcFooter) pcFooter.classList.toggle('hidden', this.device !== 'PC');

        const btn = document.querySelector('[onclick*="toggleDevice"]') || document.querySelector('[onclick*="switchDevice"]');
        if (btn) {
            btn.innerHTML = `⚙️ 模式: ${this.device === 'PC' ? 'PC 鍵盤' : '手機搖桿'}`;
        }
    },

    toggleDevice() {
        let nextDevice = this.device === 'PC' ? 'MOBILE' : 'PC';
        this.switchDevice(nextDevice);
    },

    toggleSettings(show) {
        let modal = document.getElementById('ui-runtime-absolute-settings');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ui-runtime-absolute-settings';
            document.body.appendChild(modal);
        }

        if (show) {
            modal.innerHTML = `
                <div style="background:#0b0f19; border:2px solid #00f0ff; box-shadow: 0 0 30px rgba(0,240,255,0.6); padding:25px; border-radius:12px; width:320px; text-align:center; position:relative; color:#fff; font-family:sans-serif; box-sizing: border-box;">
                    <button onclick="Engine.toggleSettings(false)" style="position:absolute; top:10px; right:15px; background:none; border:none; color:#ff0055; font-size:26px; cursor:pointer; font-weight:bold; line-height:1;">&times;</button>
                    <h3 style="color:#00f0ff; margin-top:0; letter-spacing:2px; text-shadow:0 0 10px #00f0ff; font-size:18px; margin-bottom:20px;">⚙️ 系統核心控制庫</h3>
                    
                    <div style="margin:20px 0; text-align:left; font-size:13px;">
                        <label style="display:block; margin-bottom:6px; color:#94a3b8; font-weight:bold;">音效強度 (SFX)</label>
                        <input type="range" min="0" max="1" step="0.1" value="${this.settings.sfxVolume}" onchange="Engine.settings.sfxVolume = parseFloat(this.value);" style="width:100%; accent-color:#00f0ff; margin-bottom:15px;">
                        
                        <label style="display:block; margin-bottom:6px; color:#94a3b8; font-weight:bold;">戰場主頻 (BGM)</label>
                        <input type="range" min="0" max="1" step="0.1" value="${this.settings.bgmVolume}" onchange="Engine.settings.bgmVolume = parseFloat(this.value);" style="width:100%; accent-color:#00f0ff;">
                    </div>

                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:25px;">
                        <button onclick="Engine.toggleSettings(false)" style="background:#00f0ff; color:#000; font-weight:bold; padding:10px; border:none; border-radius:6px; cursor:pointer; box-shadow:0 0 10px rgba(0,240,255,0.3); width:100%;">返回作戰</button>
                        ${this.isRunning ? `<button onclick="Engine.toggleSettings(false); Engine.exitGame();" style="background:#ef4444; color:#fff; font-weight:bold; padding:10px; border:none; border-radius:6px; cursor:pointer; box-shadow:0 0 15px rgba(239,68,68,0.4); width:100%;">🏳️ 放棄投降 (脫離戰場)</button>` : ''}
                    </div>
                </div>
            `;
            modal.style.cssText = "display:flex !important; justify-content:center !important; align-items:center !important; position:fixed !important; z-index:999999 !important; inset:0 !important; background:rgba(0,0,0,0.75) !important;";
        } else {
            modal.style.cssText = "display:none !important;";
        }
    },

    renderSkillSelector() {
        const grid = document.getElementById('skill-selector-grid'); if(!grid) return;
        grid.innerHTML = "";
        this.player.unlockedSkills.forEach(key => {
            let sk = this.skillsRepo[key]; if(!sk) return;
            let active = this.player.equippedSkills.includes(key);
            grid.innerHTML += `<div class="skill-select-card ${active?'selected':''}" onclick="Engine.selectSkill('${key}')" style="border-left:4px solid ${sk.color};">
                <div style="color:${sk.color}; font-weight:bold; font-size:13px;">${sk.name}</div>
                <div style="font-size:10px; color:#94a3b8; margin-top:4px;">${sk.desc}</div>
            </div>`;
        });
    },

    selectSkill(key) {
        let idx = this.player.equippedSkills.indexOf(key);
        if(idx >= 0) {
            if(this.player.equippedSkills.length <= 1) return;
            this.player.equippedSkills.splice(idx, 1);
        } else {
            if(this.player.equippedSkills.length >= 2) this.player.equippedSkills.shift();
            this.player.equippedSkills.push(key);
        }
        this.saveStorage(); this.renderSkillSelector();
    },

    toggleShop(show) {
        const modal = document.getElementById('skin-shop-modal'); if(modal) modal.classList.toggle('hidden', !show);
        if(show) this.renderShop();
    },

    switchShopTab(tab) { this.activeShopTab = tab; this.renderShop(); },

    renderShop() {
        const modal = document.getElementById('skin-shop-modal'); if(!modal) return;
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:10px;">
                <div>
                    <button onclick="Engine.switchShopTab('skills')" style="background:${this.activeShopTab==='skills'?'#00f0ff':'#1e293b'}; color:${this.activeShopTab==='skills'?'#000':'#fff'}; border:none; padding:8px 14px; font-weight:bold; cursor:pointer; border-radius:4px; margin-right:8px;">🔮 50+戰術技能庫</button>
                    <button onclick="Engine.switchShopTab('skins')" style="background:${this.activeShopTab==='skins'?'#00f0ff':'#1e293b'}; color:${this.activeShopTab==='skins'?'#000':'#fff'}; border:none; padding:8px 14px; font-weight:bold; cursor:pointer; border-radius:4px;">👕 20+極限幾何核心</button>
                </div>
                <div style="color:#eab308; font-weight:bold; font-size:16px; margin-right:15px;">💰 ${this.player.starCoins}</div>
                <button onclick="Engine.toggleShop(false)" style="background:none; border:none; color:#ff0055; font-size:26px; cursor:pointer; font-weight:bold;">&times;</button>
            </div>
            <div class="modal-list-content" style="max-height:380px; overflow-y:auto; margin-top:12px; padding-right:5px;">
        `;

        if (this.activeShopTab === 'skills') {
            for (let id in this.skillsRepo) {
                let sk = this.skillsRepo[id]; let isUnlocked = this.player.unlockedSkills.includes(id);
                let btn = isUnlocked ? `<span style="color:#10b981; font-weight:bold;">已解碼</span>` 
                : `<button onclick="Engine.buySkill('${id}')" style="background:#22c55e; border:none; color:#000; font-weight:bold; padding:6px 12px; border-radius:4px; cursor:pointer;">💰 ${sk.price}</button>`;
                html += `<div class="modal-row-item" style="border-left:4px solid ${sk.color}; padding:8px; margin-bottom:6px; background:#111827; display:flex; justify-content:space-between; align-items:center;">
                    <div><strong style="color:${sk.color}">${sk.name}</strong><br><span style="font-size:11px; color:#94a3b8;">${sk.desc}</span></div>
                    <div>${btn}</div>
                </div>`;
            }
        } else {
            for (let id in this.skinsRepo) {
                let sk = this.skinsRepo[id]; let isUnlocked = this.player.unlockedSkins.includes(id); let isEquipped = this.player.currentSkin === id;
                let btn = "";
                if (isEquipped) btn = `<span style="color:#3b82f6; font-weight:bold;">武裝中</span>`;
                else if (isUnlocked) btn = `<button onclick="Engine.equipSkin('${id}')" style="background:#a855f7; border:none; color:#fff; padding:6px 12px; border-radius:4px; cursor:pointer;">裝配</button>`;
                else btn = `<button onclick="Engine.buySkin('${id}')" style="background:#22c55e; border:none; color:#000; font-weight:bold; padding:6px 12px; border-radius:4px; cursor:pointer;">💰 ${sk.price}</button>`;
                
                html += `<div class="modal-row-item" style="border-left:4px solid ${sk.color}; padding:8px; margin-bottom:6px; background:#111827; display:flex; justify-content:space-between; align-items:center;">
                    <div><strong style="color:${sk.color}">${sk.name}</strong> <span style="font-size:10px; background:#1f2937; padding:2px 4px; color:#94a3b8;">${sk.shape}</span><br><span style="font-size:11px; color:#94a3b8;">${sk.desc}</span></div>
                    <div>${btn}</div>
                </div>`;
            }
        }
        html += `</div>`; modal.innerHTML = html;
    },

    buySkill(id) {
        let sk = this.skillsRepo[id]; if(!sk || this.player.starCoins < sk.price) return;
        this.player.starCoins -= sk.price; this.player.unlockedSkills.push(id);
        this.saveStorage(); this.renderShop(); this.renderSkillSelector();
    },
    buySkin(id) {
        let sk = this.skinsRepo[id]; if(!sk || this.player.starCoins < sk.price) return;
        this.player.starCoins -= sk.price; this.player.unlockedSkins.push(id);
        this.saveStorage(); this.renderShop();
    },
    equipSkin(id) { this.player.currentSkin = id; this.saveStorage(); this.renderShop(); },

    launch(mode) {
        this.mode = mode; this.isRunning = true; this.frame = 0;
        if(document.getElementById('input-name')) this.player.name = document.getElementById('input-name').value || "無情揮刀手";
        
        this.player.hp = this.player.maxHp; this.player.mp = this.player.maxMp;
        this.player.kills = 0; this.player.deaths = 0; this.player.isGhost = false;
        this.player.cd = { s0: 0, s1: 0, shift: 0 };
        this.enemies = []; this.allies = []; this.projectiles = []; this.particles = []; this.smokes = [];
        this.camera.x = this.player.x; this.camera.y = this.player.y;

        document.getElementById('ui-main-menu').classList.add('hidden');
        document.getElementById('ui-game-viewport').classList.remove('hidden');
        
        document.getElementById('hud-mode-name').innerText = mode;
        document.getElementById('hud-star-coins').innerText = `💰 ${this.player.starCoins}`;
        document.getElementById('hud-kda').innerText = "0 / 0";

        if(this.player.equippedSkills[0] && this.skillsRepo[this.player.equippedSkills[0]] && document.getElementById('label-pc-s0')) {
            document.getElementById('label-pc-s0').innerText = this.skillsRepo[this.player.equippedSkills[0]].name;
        }
        if(this.player.equippedSkills[1] && this.skillsRepo[this.player.equippedSkills[1]] && document.getElementById('label-pc-s1')) {
            document.getElementById('label-pc-s1').innerText = this.skillsRepo[this.player.equippedSkills[1]].name;
        }

        this.canvas = document.getElementById('gameCanvas'); this.ctx = this.canvas.getContext('2d');
        this.resize(); this.generateWorldObstacles(); this.AudioFX.startBgm();

        if(mode === 'TRAINING') {
            this.isGameFrozen = false;
            if(document.getElementById('ui-countdown-mask')) document.getElementById('ui-countdown-mask').classList.add('hidden');
            this.player.x = 0; this.player.y = 0;
            this.enemies.push({ x: 0, y: -200, hp: 99999, maxHp: 99999, speed: 0, size: 35, name: "🦾 虛擬樁", isDummy: true, flashFrame: 0 });
        } else {
            this.setupTournamentTeams(mode); this.startCountdown();
        }

        if (this.loopId) cancelAnimationFrame(this.loopId);
        const loop = () => { if(this.isRunning) { this.update(); this.render(); this.loopId = requestAnimationFrame(loop); } };
        this.loopId = requestAnimationFrame(loop);
    },

    generateWorldObstacles() {
        this.obstacles = [];
        for(let i=0; i<8; i++) {
            let rx = (Math.random()-0.5)*1200, ry = (Math.random()-0.5)*1200;
            if(Math.hypot(rx, ry) > 250) this.obstacles.push({ x: rx-40, y: ry-40, w: 80, h: 80 });
        }
    },

    setupTournamentTeams(mode) {
        let size = 1;
        if(mode.includes('2V2')) size = 2; if(mode.includes('3V3')) size = 3;
        if(mode.includes('4V4')) size = 4; if(mode.includes('5V5')) size = 5;

        this.player.x = 0; this.player.y = this.mapRadius - 150;
        for(let i=1; i<size; i++) {
            this.allies.push({ x: -150 + i*80, y: this.mapRadius - 150, hp: 250, maxHp: 250, speed: 4.0, size: 30, name: `戰友_${i}`, isAlly: true, flashFrame:0 });
        }
        let aiNames = ["邊譯器", "神算特工", "破壞矩陣", "暗碼魂", "追跡者"];
        for(let i=0; i<size; i++) {
            this.enemies.push({ x: -150 + i*80, y: -this.mapRadius + 150, hp: 220, maxHp: 220, speed: 3.2 + Math.random()*1.8, size: 30, name: aiNames[i % aiNames.length], isAlly: false, flashFrame: 0 });
        }
    },

    startCountdown() {
        clearInterval(this.countdownId); this.isGameFrozen = true; this.countdownValue = 3;
        const mask = document.getElementById('ui-countdown-mask'); const txt = document.getElementById('txt-countdown');
        if(mask) mask.classList.remove('hidden'); if(txt) txt.innerText = this.countdownValue;
        this.countdownId = setInterval(() => {
            this.countdownValue--;
            if(this.countdownValue > 0) { if(txt) txt.innerText = this.countdownValue; }
            else if(this.countdownValue === 0) { if(txt) txt.innerText = "FIGHT"; }
            else { clearInterval(this.countdownId); if(mask) mask.classList.add('hidden'); this.isGameFrozen = false; }
        }, 1000);
    },

    attack() {
        if(this.isGameFrozen || this.player.isGhost) return; 
        this.player.isAttacking = true; this.player.attackTimer = 10; this.AudioFX.play('slash');
        this.enemies.forEach(e => {
            if(e.hp <= 0) return;
            if(Math.hypot(e.x - this.player.x, e.y - this.player.y) < 120) {
                e.hp -= this.player.atkPower; e.flashFrame = 6;
                this.AudioFX.play('hit'); this.popParticles(e.x, e.y, "#ff0055", 6);
            }
        });
    },

    cast(slot) {
        if(this.isGameFrozen || this.player.isGhost) return; 
        const p = this.player;
        if(slot === 'Shift') {
            if(p.cd.shift > 0) return; p.cd.shift = 80; p.x += p.facing * 220;
            this.AudioFX.play('slash'); this.popParticles(p.x, p.y, "#00f0ff", 8); return;
        }

        let skillKey = p.equippedSkills[slot]; let sk = this.skillsRepo[skillKey]; if(!sk) return;
        let cdKey = slot === 0 ? 's0' : 's1'; if(p.cd[cdKey] > 0 || p.mp < sk.mpCost) return;

        p.mp -= sk.mpCost; p.cd[cdKey] = sk.cdMax;

        if(sk.type === "SMOKE") {
            this.AudioFX.play('smoke');
            this.smokes.push({ x: p.x, y: p.y, radius: 160, life: 360 }); 
            this.popParticles(p.x, p.y, sk.color, 25);
        } else {
            this.AudioFX.play('cast_skill', sk.freq);
            this.projectiles.push({ x: p.x, y: p.y, vx: p.facing * 14, vy: (Math.random() - 0.5) * 3, size: 12, color: sk.color, life: 60, dmg: 60 });
            this.popParticles(p.x, p.y, sk.color, 10);
        }
    },

    popParticles(x, y, col, count) {
        for(let i=0; i<count; i++) this.particles.push({ x: x, y: y, vx: (Math.random()-0.5)*9, vy: (Math.random()-0.5)*9, col: col, life: 25 });
    },

    update() {
        this.frame++; const p = this.player;

        if (p.hp <= 0 && !p.isGhost) {
            p.isGhost = true; p.deaths = 1;
            const sw = document.getElementById('spectator-warning');
            if(sw) { sw.classList.remove('hidden'); sw.innerText = "👁️ 進入【虛空幽靈觀戰狀態】WASD穿牆自由觀賽"; }
        }

        if(p.cd.s0 > 0) p.cd.s0--; if(p.cd.s1 > 0) p.cd.s1--; if(p.cd.shift > 0) p.cd.shift--;
        if(p.attackTimer > 0) p.attackTimer--; else p.isAttacking = false;
        if(p.mp < p.maxMp && this.frame % 4 === 0) p.mp = Math.min(p.maxMp, p.mp + 1);

        this.camera.x += (p.x - this.camera.x) * this.camera.lerp;
        this.camera.y += (p.y - this.camera.y) * this.camera.lerp;

        let mx = 0, my = 0;
        if (!this.isGameFrozen) {
            let currentSpeed = p.isGhost ? p.ghostSpeed : p.speed;
            if(this.device === 'PC') {
                if(this.keys['KeyW']) my = -currentSpeed; if(this.keys['KeyS']) my = currentSpeed;
                if(this.keys['KeyA']) { mx = -currentSpeed; p.facing = -1; } if(this.keys['KeyD']) { mx = currentSpeed; p.facing = 1; }
            } else { mx = p.vx; my = p.vy; }
        }
        
        p.x += mx; p.y += my;
        p.x = Math.max(-this.mapRadius, Math.min(this.mapRadius, p.x));
        p.y = Math.max(-this.mapRadius, Math.min(this.mapRadius, p.y));

        if (!p.isGhost) {
            this.obstacles.forEach(o => { if(p.x > o.x && p.x < o.x+o.w && p.y > o.y && p.y < o.y+o.h) { p.x -= mx; p.y -= my; } });
        }

        this.smokes.forEach(s => s.life--); this.smokes = this.smokes.filter(s => s.life > 0);

        if(this.isGameFrozen) return;

        for (let i = 0; i < this.enemies.length; i++) {
            for (let j = i + 1; j < this.enemies.length; j++) {
                let e1 = this.enemies[i]; let e2 = this.enemies[j];
                if (e1.hp > 0 && e2.hp > 0) {
                    let dx = e2.x - e1.x, dy = e2.y - e1.y, dist = Math.hypot(dx, dy);
                    if (dist < 35) {
                        if (dist === 0) { dx = Math.random()-0.5; dy = Math.random()-0.5; dist=0.1; }
                        let push = (35 - dist) / 2;
                        e1.x -= (dx/dist)*push; e1.y -= (dy/dist)*push;
                        e2.x += (dx/dist)*push; e2.y += (dy/dist)*push;
                    }
                }
            }
        }

        this.allies.forEach(a => {
            if(a.hp <= 0) return;
            let target = this.enemies.find(e => e.hp > 0);
            if(target) {
                let dx = target.x - a.x, dy = target.y - a.y, dist = Math.hypot(dx, dy);
                if(dist > 40) { a.x += (dx/dist)*a.speed; a.y += (dy/dist)*a.speed; }
                if(dist < 50 && this.frame % 30 === 0) { target.hp -= 15; target.flashFrame = 4; }
            }
        });

        this.enemies.forEach(e => {
            if(e.hp <= 0) return;
            let t = (p.hp > 0 && !p.isGhost) ? p : this.allies.find(a => a.hp > 0); if(!t) return;
            
            let inSmoke = this.smokes.some(sm => Math.hypot(e.x - sm.x, e.y - sm.y) < sm.radius);
            let activeSpeed = inSmoke ? e.speed * 0.4 : e.speed; 

            if(!e.isDummy) {
                let dx = t.x - e.x, dy = t.y - e.y, dist = Math.hypot(dx, dy);
                if(dist > 30) { e.x += (dx/dist)*activeSpeed; e.y += (dy/dist)*activeSpeed; }
                if(dist < 38 && this.frame % 28 === 0) {
                    if(t === p) { p.hp -= 18; } else { t.hp -= 18; }
                    this.popParticles(t.x, t.y, "#ff0055", 4);
                }
            }
        });

        this.projectiles.forEach(pj => {
            pj.x += pj.vx; pj.y += pj.vy; pj.life--;
            this.enemies.forEach(e => {
                if(e.hp > 0 && Math.hypot(pj.x - e.x, pj.y - e.y) < e.size + pj.size) {
                    e.hp -= pj.dmg; e.flashFrame = 5; pj.life = 0; this.AudioFX.play('hit');
                }
            });
        });
        this.projectiles = this.projectiles.filter(pj => pj.life > 0);
        this.particles.forEach(pt => pt.life--); this.particles = this.particles.filter(pt => pt.life > 0);

        if(document.getElementById('bar-hp')) document.getElementById('bar-hp').style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
        if(document.getElementById('bar-mp')) document.getElementById('bar-mp').style.width = `${(p.mp / p.maxMp) * 100}%`;
        p.kills = this.enemies.filter(e => e.hp <= 0 && !e.isDummy).length;
        if(document.getElementById('hud-kda')) document.getElementById('hud-kda').innerText = `${p.kills} / ${p.deaths}`;

        this.checkMatchEndCondition();
    },

    checkMatchEndCondition() {
        if(this.mode === 'TRAINING' || this.isGameFrozen || !this.isRunning) return;
        let aliveEnemies = this.enemies.filter(e => e.hp > 0).length;
        let aliveAllies = this.allies.filter(a => a.hp > 0).length;
        let pAlive = this.player.hp > 0 && !this.player.isGhost;

        if(aliveEnemies === 0) this.triggerMatchEnd(true);
        else if(!pAlive && aliveAllies === 0) this.triggerMatchEnd(false);
    },

    // 🏆【結算系統全面重構】3D 透視翻牌動畫與星級掉落矩陣
    triggerMatchEnd(isWin) {
        this.isGameFrozen = true; this.isRunning = false;
        if (this.loopId) cancelAnimationFrame(this.loopId); this.AudioFX.stopBgm();

        let isLargeTeam = this.mode.includes('4V4') || this.mode.includes('5V5');
        this.oldElo = this.playerElo; let delta = 0;
        if(this.mode.includes('RANKED') && !isLargeTeam) {
            delta = isWin ? 22 + Math.floor(Math.random()*5) : -12 - Math.floor(Math.random()*4);
            this.playerElo = Math.max(1000, this.playerElo + delta); this.saveStorage();
        }

        let view = document.getElementById('ui-settlement-screen');
        if (!view) {
            view = document.createElement('div'); view.id = 'ui-settlement-screen';
            document.body.appendChild(view);
        }

        // 構建一個包含 3D 旋轉場景的結構
        view.innerHTML = `
            <div style="background:rgba(8,12,24,0.96); border:3px solid ${isWin?'#eab308':'#ef4444'}; box-shadow:0 0 50px ${isWin?'rgba(234,179,8,0.6)':'rgba(239,68,68,0.6)'}; border-radius:16px; padding:30px; text-align:center; width:460px; max-width:92%; color:#fff; font-family:sans-serif; box-sizing:border-box;">
                <h1 id="settle-title" style="font-size:32px; font-weight:900; margin:0 0 15px 0; letter-spacing:3px;"></h1>
                
                <div id="settle-elo-box" style="background:#111827; border:1px solid #1e293b; padding:15px; border-radius:8px; margin-bottom:20px; transition:all 0.5s; opacity:0;">
                    <div style="font-size:14px; color:#94a3b8; margin-bottom:5px;">當前排位階級</div>
                    <div id="settle-rank-name" style="font-size:20px; color:#00f0ff; font-weight:bold; margin-bottom:10px;">計算中...</div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748b; margin-bottom:4px;">
                        <span>舊分: <span id="settle-elo-old">--</span></span>
                        <strong id="settle-elo-delta" style="font-size:14px;">--</strong>
                        <span>新分: <span id="settle-elo-new">--</span></span>
                    </div>
                    <div style="background:#1f2937; height:8px; border-radius:4px; overflow:hidden;">
                        <div id="settle-elo-bar" style="background:linear-gradient(90deg, #00f0ff, #3b82f6); width:0%; height:100%; transition:width 1s ease-out;"></div>
                    </div>
                </div>

                <!-- 🃏 3D 翻牌特區：解除限制，可三張全開 -->
                <div id="settle-card-container" style="display:flex; justify-content:center; gap:20px; margin-bottom:25px; opacity:0; transition:all 0.5s; perspective: 1000px;">
                    
                    <!-- 卡牌 1 -->
                    <div style="perspective: 600px; width: 105px; height: 145px;">
                        <div class="quantum-card-inner" onclick="Engine.revealCard(this)" style="position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); transform-style: preserve-3d; cursor: pointer;">
                            <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: #111827; border: 2px solid #00f0ff; box-shadow: 0 0 12px rgba(0,240,255,0.3); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #00f0ff;">
                                <div style="font-size: 32px; filter: drop-shadow(0 0 6px #00f0ff);">🃏</div>
                                <div style="font-size: 11px; margin-top: 8px; letter-spacing: 1px; font-weight: bold;">QUANTUM</div>
                            </div>
                            <div class="card-front" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; transform: rotateY(180deg); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; box-sizing: border-box; padding: 6px;"></div>
                        </div>
                    </div>

                    <!-- 卡牌 2 -->
                    <div style="perspective: 600px; width: 105px; height: 145px;">
                        <div class="quantum-card-inner" onclick="Engine.revealCard(this)" style="position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); transform-style: preserve-3d; cursor: pointer;">
                            <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: #111827; border: 2px solid #00f0ff; box-shadow: 0 0 12px rgba(0,240,255,0.3); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #00f0ff;">
                                <div style="font-size: 32px; filter: drop-shadow(0 0 6px #00f0ff);">🃏</div>
                                <div style="font-size: 11px; margin-top: 8px; letter-spacing: 1px; font-weight: bold;">QUANTUM</div>
                            </div>
                            <div class="card-front" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; transform: rotateY(180deg); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; box-sizing: border-box; padding: 6px;"></div>
                        </div>
                    </div>

                    <!-- 卡牌 3 -->
                    <div style="perspective: 600px; width: 105px; height: 145px;">
                        <div class="quantum-card-inner" onclick="Engine.revealCard(this)" style="position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); transform-style: preserve-3d; cursor: pointer;">
                            <div style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; background: #111827; border: 2px solid #00f0ff; box-shadow: 0 0 12px rgba(0,240,255,0.3); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #00f0ff;">
                                <div style="font-size: 32px; filter: drop-shadow(0 0 6px #00f0ff);">🃏</div>
                                <div style="font-size: 11px; margin-top: 8px; letter-spacing: 1px; font-weight: bold;">QUANTUM</div>
                            </div>
                            <div class="card-front" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; transform: rotateY(180deg); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; box-sizing: border-box; padding: 6px;"></div>
                        </div>
                    </div>

                </div>

                <button onclick="Engine.closeSettlement()" style="background:linear-gradient(135deg,#00f0ff,#3b82f6); color:#000; font-weight:bold; font-size:15px; border:none; padding:12px 30px; border-radius:8px; cursor:pointer; box-shadow:0 0 15px rgba(0,240,255,0.4); width:100%;">回到星海大廳</button>
            </div>
        `;

        view.style.cssText = "display:flex !important; justify-content:center !important; align-items:center !important; position:fixed !important; inset:0 !important; z-index:999999 !important; background:rgba(0,0,0,0.85) !important;";
        view.classList.remove('hidden');

        const title = document.getElementById('settle-title');
        if(isWin) { title.innerText = "🏆 LEAGUE VICTORY"; title.style.color = "#eab308"; } 
        else { title.innerText = "💀 SYSTEM DEFEAT"; title.style.color = "#ef4444"; }

        setTimeout(() => {
            const eloBox = document.getElementById('settle-elo-box');
            const cardContainer = document.getElementById('settle-card-container');
            if(eloBox) eloBox.style.opacity = "1"; if(cardContainer) cardContainer.style.opacity = "1";

            const dText = document.getElementById('settle-elo-delta');
            if (isLargeTeam) {
                if(dText) dText.innerText = "團隊模式無分段跳動";
                const bar = document.getElementById('settle-elo-bar'); if(bar) bar.style.width = "100%";
            } else {
                if(dText) {
                    dText.innerText = isWin ? `+${delta} ELO` : `${delta} ELO`;
                    dText.style.color = isWin ? "#22c55e" : "#ef4444";
                }
                if(document.getElementById('settle-elo-old')) document.getElementById('settle-elo-old').innerText = this.oldElo;
                if(document.getElementById('settle-elo-new')) document.getElementById('settle-elo-new').innerText = this.playerElo;
                let t = Math.min(this.rankTiers.length-1, Math.max(0, Math.floor((this.playerElo - 1000)/100)));
                if(document.getElementById('settle-rank-name')) document.getElementById('settle-rank-name').innerText = this.rankTiers[t];
                
                const bar = document.getElementById('settle-elo-bar');
                if(bar) {
                    bar.style.width = `${this.oldElo % 100}%`;
                    setTimeout(() => { bar.style.width = `${this.playerElo % 100}%`; }, 200);
                }
            }
        }, 800);
    },

    // 🃏【3D 隨機翻牌掉落演算系統】支援多開卡牌，概率解鎖稀有虛擬神裝
    revealCard(el) {
        if(el.getAttribute('data-flipped') === 'true') return;
        el.setAttribute('data-flipped', 'true');

        let rewardType = 'coins'; // 預設星幣保底
        let rand = Math.random();

        // 搜尋目前尚未解鎖的資產陣列
        let lockedSkills = Object.keys(this.skillsRepo).filter(k => !this.player.unlockedSkills.includes(k));
        let lockedSkins = Object.keys(this.skinsRepo).filter(k => !this.player.unlockedSkins.includes(k));

        // 計算獎勵類別
        if (rand < 0.15 && lockedSkins.length > 0) {
            rewardType = 'skin';
        } else if (rand < 0.35 && lockedSkills.length > 0) { // 0.15 ~ 0.35 (20% 機率)
            rewardType = 'skill';
        }

        let frontEl = el.querySelector('.card-front');

        // 根據獎勵形態動態渲染正面樣式，並寫入玩家記憶體
        if (rewardType === 'skin') {
            let randomSkinKey = lockedSkins[Math.floor(Math.random() * lockedSkins.length)];
            let skin = this.skinsRepo[randomSkinKey];
            this.player.unlockedSkins.push(randomSkinKey);
            
            frontEl.style.background = 'linear-gradient(135deg, #a855f7, #3b82f6)';
            frontEl.style.border = `2px solid ${skin.color}`;
            frontEl.style.boxShadow = `0 0 15px ${skin.color}`;
            frontEl.innerHTML = `
                <div style="font-size:26px; filter: drop-shadow(0 0 5px #fff);">👕</div>
                <div style="color:${skin.color}; font-size:11px; margin-top:4px; font-weight:900; background:#000; padding:2px 4px; border-radius:4px;">外觀覺醒</div>
                <div style="font-size:11px; color:#fff; text-align:center; margin-top:6px; line-height:1.2; font-weight:bold;">${skin.name}</div>
            `;
            this.AudioFX.play('cast_skill', 750); // 專屬高頻解鎖音效
        } else if (rewardType === 'skill') {
            let randomSkillKey = lockedSkills[Math.floor(Math.random() * lockedSkills.length)];
            let skill = this.skillsRepo[randomSkillKey];
            this.player.unlockedSkills.push(randomSkillKey);
            
            frontEl.style.background = 'linear-gradient(135deg, #0284c7, #0f172a)';
            frontEl.style.border = `2px solid ${skill.color}`;
            frontEl.style.boxShadow = `0 0 15px ${skill.color}`;
            frontEl.innerHTML = `
                <div style="font-size:26px; filter: drop-shadow(0 0 5px #fff);">🔮</div>
                <div style="color:#00f0ff; font-size:11px; margin-top:4px; font-weight:900; background:#000; padding:2px 4px; border-radius:4px;">技能解碼</div>
                <div style="font-size:11px; color:#fff; text-align:center; margin-top:6px; line-height:1.2; font-weight:bold;">${skill.name}</div>
            `;
            this.AudioFX.play('cast_skill', 550);
        } else {
            let bonus = 40 + Math.floor(Math.random() * 50);
            this.player.starCoins += bonus;
            
            frontEl.style.background = 'linear-gradient(135deg, #1e293b, #0f172a)';
            frontEl.style.border = '2px solid #eab308';
            frontEl.style.boxShadow = '0 0 15px rgba(234,179,8,0.4)';
            frontEl.innerHTML = `
                <div style="font-size:28px;">💰</div>
                <div style="color:#eab308; font-size:16px; margin-top:6px; font-weight:900; text-shadow:0 0 8px rgba(234,179,8,0.6);">+${bonus}</div>
                <div style="font-size:10px; color:#94a3b8; margin-top:2px;">量子星幣</div>
            `;
            this.AudioFX.play('hit');
        }

        this.saveStorage();
        
        // 執行 3D 翻轉效果
        el.style.transform = 'rotateY(180deg)';
    },

    closeSettlement() {
        const view = document.getElementById('ui-settlement-screen');
        if(view) view.style.display = "none"; this.exitGame();
    },

    exitGame() {
        this.isRunning = false; this.isGameFrozen = false; clearInterval(this.countdownId);
        document.getElementById('ui-game-viewport').classList.add('hidden');
        document.getElementById('ui-main-menu').classList.remove('hidden');
        this.updateLobbyLabels(); this.renderShop(); this.renderSkillSelector(); this.AudioFX.stopBgm();
    },

    render() {
        const ctx = this.ctx; const p = this.player;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.canvas.width/2 - this.camera.x, this.canvas.height/2 - this.camera.y);

        ctx.strokeStyle = "rgba(0, 240, 255, 0.02)"; ctx.lineWidth = 2;
        for(let x=-this.mapRadius; x<=this.mapRadius; x+=100) { ctx.beginPath(); ctx.moveTo(x, -this.mapRadius); ctx.lineTo(x, this.mapRadius); ctx.stroke(); }
        for(let y=-this.mapRadius; y<=this.mapRadius; y+=100) { ctx.beginPath(); ctx.moveTo(-this.mapRadius, y); ctx.lineTo(this.mapRadius, y); ctx.stroke(); }
        ctx.strokeStyle = "#ff0055"; ctx.lineWidth = 5; ctx.strokeRect(-this.mapRadius, -this.mapRadius, this.mapRadius*2, this.mapRadius*2);
        
        this.obstacles.forEach(o => { ctx.fillStyle="#1f2937"; ctx.fillRect(o.x, o.y, o.w, o.h); });

        this.smokes.forEach(sm => {
            ctx.save();
            ctx.fillStyle = "rgba(99, 102, 241, 0.18)";
            ctx.strokeStyle = "rgba(168, 85, 247, 0.6)"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(sm.x, sm.y, sm.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.setLineDash([10, 15]);
            ctx.beginPath(); ctx.arc(sm.x, sm.y, sm.radius - 10, 0, Math.PI*2); ctx.stroke();
            ctx.restore();
        });

        this.particles.forEach(pt => { ctx.fillStyle=pt.col; ctx.fillRect(pt.x, pt.y, 4, 4); });
        this.projectiles.forEach(pj => { ctx.fillStyle=pj.color; ctx.beginPath(); ctx.arc(pj.x, pj.y, pj.size, 0, Math.PI*2); ctx.fill(); });

        this.allies.forEach(a => {
            if(a.hp <= 0) return; ctx.fillStyle = "#3b82f6"; ctx.fillRect(a.x-15, a.y-15, 30, 30);
        });

        this.enemies.forEach(e => {
            if(e.hp <= 0) return;
            ctx.fillStyle = e.flashFrame > 0 ? "#fff" : "#ef4444"; if(e.flashFrame > 0) e.flashFrame--;
            ctx.fillRect(e.x-15, e.y-15, 30, 30);
            ctx.fillStyle="#ff0055"; ctx.fillRect(e.x-25, e.y-25, 50*(e.hp/e.maxHp), 5);
        });

        ctx.save(); ctx.translate(p.x, p.y);
        if (p.isGhost) ctx.globalAlpha = 0.40;

        let skCfg = this.skinsRepo[p.currentSkin] || this.skinsRepo['default'];
        ctx.shadowBlur = 18; ctx.shadowColor = skCfg.color; ctx.fillStyle = skCfg.color; ctx.strokeStyle = skCfg.color; ctx.lineWidth = 3;

        const s = skCfg.shape;
        if (s === "CUBE") {
            ctx.fillRect(-16, -16, 32, 32);
        } else if (s === "CROSS_RECT") { 
            ctx.fillRect(-18, -18, 36, 36); ctx.fillStyle = "#fff"; ctx.fillRect(-4, -22, 8, 44); ctx.fillRect(-22, -4, 44, 8);
        } else if (s === "RHOMBUS") { 
            ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(20, 0); ctx.lineTo(0, 24); ctx.lineTo(-20, 0); ctx.closePath(); ctx.fill();
        } else if (s === "MECH_WING") { 
            ctx.fillRect(-12, -12, 24, 24); ctx.fillStyle = "#1e293b"; ctx.fillRect(-34, -6, 20, 12); ctx.fillRect(14, -6, 20, 12);
        } else if (s === "GOLDEN_HALO") { 
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI*2); ctx.stroke();
        } else if (s === "SHURIKEN") { 
            ctx.beginPath(); for(let i=0; i<4; i++) { ctx.rotate(Math.PI/2); ctx.lineTo(0, -25); ctx.lineTo(5, -8); } ctx.closePath(); ctx.fill();
        } else if (s === "PENTAGRAM") { 
            ctx.beginPath(); for(let i=0; i<5; i++) { ctx.lineTo(Math.cos((18+i*72)*Math.PI/180)*24, Math.sin((18+i*72)*Math.PI/180)*24); ctx.lineTo(Math.cos((54+i*72)*Math.PI/180)*10, Math.sin((54+i*72)*Math.PI/180)*10); } ctx.closePath(); ctx.fill();
        } else if (s === "HEXAGON") { 
            ctx.beginPath(); for(let i=0; i<6; i++) ctx.lineTo(20*Math.cos(i*Math.PI/3), 20*Math.sin(i*Math.PI/3)); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (s === "HORNED_TRI") { 
            ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(18, 16); ctx.lineTo(-18, 16); ctx.closePath(); ctx.fill();
            ctx.fillRect(-16, -26, 6, 12); ctx.fillRect(10, -26, 6, 12); 
        } else if (s === "FEATHER_BARS") { 
            ctx.fillRect(-10, -16, 20, 32); ctx.fillRect(-30, -12, 16, 4); ctx.fillRect(-26, -2, 14, 4); ctx.fillRect(14, -12, 16, 4); ctx.fillRect(12, -2, 14, 4);
        } else if (s === "BAT_WING") { 
            ctx.beginPath(); ctx.arc(0, -4, 12, 0, Math.PI, true); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(-28, -18); ctx.lineTo(-20, 4); ctx.moveTo(14, -4); ctx.lineTo(28, -18); ctx.lineTo(20, 4); ctx.fill();
        } else if (s === "DUAL_SLITS") { 
            ctx.fillRect(-14, -14, 28, 28); ctx.strokeStyle = "#fff"; ctx.strokeRect(-14, -14, 28, 28);
            ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-22, 22); ctx.lineTo(22, -22); ctx.stroke(); 
        } else if (s === "TEARDROP") { 
            ctx.beginPath(); ctx.arc(0, -6, 14, Math.PI, 0); ctx.lineTo(0, 24); ctx.closePath(); ctx.fill();
        } else if (s === "TENTACLE_DOTS") { 
            ctx.fillRect(-12, -12, 24, 24); ctx.beginPath(); ctx.arc(-22, 0, 5, 0, Math.PI*2); ctx.arc(22, 0, 5, 0, Math.PI*2); ctx.arc(0, -22, 5, 0, Math.PI*2); ctx.fill();
        } else if (s === "FLAME_TAIL") { 
            ctx.beginPath(); ctx.moveTo(-16, -16); ctx.lineTo(22, 0); ctx.lineTo(-16, 16); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
        } else if (s === "FRAGMENT") { 
            ctx.fillRect(-16, -16, 12, 12); ctx.fillRect(4, 4, 12, 12); ctx.fillRect(-14, 6, 8, 8); ctx.fillRect(6, -14, 8, 8);
        } else if (s === "ECLIPSE") { 
            ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle="#000"; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); fill();
        } else if (s === "SCYTHE_ARC") { 
            ctx.fillRect(-14, -14, 28, 28); ctx.beginPath(); ctx.arc(0, 0, 32, -Math.PI/2, Math.PI/4); ctx.stroke();
        } else if (s === "SUNBURST") { 
            ctx.fillRect(-12, -12, 24, 24); for(let i=0; i<4; i++) { ctx.rotate(Math.PI/4); ctx.fillRect(-4, -28, 8, 8); }
        } else if (s === "BIO_WHEEL") { 
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
            for(let i=0; i<3; i++) { ctx.rotate((2*Math.PI)/3); ctx.fillRect(-3, -25, 6, 16); }
        } else if (s === "SPEAR_CROSS") { 
            ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(8, -10); ctx.lineTo(-8, -10); ctx.closePath(); ctx.fill();
            ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 20); ctx.stroke();
        } else if (s === "ORBIT_RING") { 
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
            ctx.save(); ctx.scale(2, 0.6); ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.stroke(); ctx.restore();
        }
        ctx.restore();

        if(p.isAttacking && !p.isGhost) {
            ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 4; ctx.beginPath();
            let ang = p.facing === 1 ? -Math.PI/3 : Math.PI - Math.PI/3;
            ctx.arc(p.x, p.y, 65, ang, ang + Math.PI/2); ctx.stroke();
        }

        ctx.fillStyle = p.isGhost ? "#94a3b8" : "#fff"; ctx.font = "bold 12px Arial";
        ctx.fillText(p.isGhost ? `👻 ${p.name} (虛空幽靈)` : p.name, p.x-30, p.y-30);
        ctx.restore();
    },

    resize() { if(this.canvas) { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; } },
    
    setupInput() {
        window.onkeydown = (e) => {
            this.keys[e.code] = true;
            if(e.code === 'KeyQ') this.cast(0); if(e.code === 'KeyE') this.cast(1);
            if(e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.cast('Shift');
            if(e.code === 'Space') this.attack();
        };
        window.onkeyup = (e) => { this.keys[e.code] = false; };

        const joy = document.getElementById('joy-zone'); const knob = document.getElementById('joy-knob');
        if(joy) {
            let moving = false;
            const handle = (ex, ey) => {
                let r = joy.getBoundingClientRect(); let cx = r.left + r.width/2; let cy = r.top + r.height/2;
                let dx = ex - cx, dy = ey - cy, d = Math.hypot(dx, dy); let maxL = r.width/2;
                if(d > maxL) { dx = (dx/d)*maxL; dy = (dy/d)*maxL; }
                knob.style.left = `calc(50% + ${dx}px)`; knob.style.top = `calc(50% + ${dy}px)`;
                this.player.vx = (dx/maxL)*this.player.speed; this.player.vy = (dy/maxL)*this.player.speed;
                if(dx !== 0) this.player.facing = dx > 0 ? 1 : -1;
            };
            joy.ontouchstart = (e) => { moving = true; handle(e.touches[0].clientX, e.touches[0].clientY); };
            joy.ontouchmove = (e) => { if(moving) handle(e.touches[0].clientX, e.touches[0].clientY); };
            joy.ontouchend = () => { moving = false; knob.style.left='50%'; knob.style.top='50%'; this.player.vx=0; this.player.vy=0; };
        }
    }
};

window.onload = () => { Engine.init(); Engine.setupInput(); };
window.onresize = () => Engine.resize();