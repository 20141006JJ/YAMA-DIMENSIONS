/**
 * Quantum Engine 11.6 - Absolute Integrated Edition (Settings UI Fixed)
 * * 核心架構整合優化：
 * 1. 物理排斥演算法：杜絕所有敵人聚集在一起「打一下變一隻」的空間重疊 Bug。
 * 2. 雙重階梯自動結算：每一影格即時監控，一分勝負【全自動跳轉】，先播勝負純動畫 -> 2秒後淡入 ELO 條與翻牌。
 * 3. 虛空幽靈模式：玩家死後化為 40% 透明度幽靈，WASD 自由飛翔穿牆觀戰，但全面封鎖攻擊與技能。
 * 4. 雙端切換與修錯：徹底補齊 switchDevice 與 toggleSettings，解決 Uncaught TypeError 報錯。
 * 5. 設定介面優化：修正點擊沒反應問題，自動渲染精美 UI，包含「返回遊戲」與「退出戰場」按鈕！
 * 6. 50+ 技能/外觀商城：基礎免費，其餘商城購買，各自具備獨立音頻合成頻率（Freq）與視覺效果。
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

    // ELO 排位與星幣階級資料
    playerElo: 1200,
    oldElo: 1200,
    rankTiers: ["青銅戰將 III", "青銅戰將 II", "青銅戰將 I", "白銀先鋒 III", "白銀先鋒 II", "白銀先鋒 I", "黃金精銳 III", "黃金精銳 II", "黃金精銳 I", "璀璨鑽石 II", "璀璨鑽石 I", "星海星皇", "量子主宰"],

    settings: { sfxVolume: 0.5, bgmVolume: 0.3 },

    // 50+ 大型擴充技能庫與外觀庫
    skillsRepo: {},
    skinsRepo: {
        'default': { name: "🤖 量子晶立方", shape: "CUBE", price: 0, desc: "預設幾何核心", color: "#00f0ff" },
        'skin_knight': { name: "🛡️ 聖殿重武裝", shape: "CROSS_RECT", price: 150, desc: "鋼鐵十字重盾", color: "#94a3b8" },
        'skin_assassin': { name: "💎 虛空幽影菱", shape: "RHOMBUS", price: 300, desc: "流線高亮尖刺體", color: "#c084fc" },
        'skin_mech': { name: "🦅 翼展天啟機", shape: "MECH_WING", price: 500, desc: "背部浮游雙翼", color: "#38bdf8" },
        'skin_god': { name: "👑 萬神殿主宰", shape: "GOLDEN_HALO", price: 1000, desc: "至高黃金神聖光環", color: "#eab308" }
    },

    player: {
        name: "無情揮刀手", x: 0, y: 0, vx: 0, vy: 0, speed: 6.5, ghostSpeed: 8.5, facing: 1,
        hp: 250, maxHp: 250, mp: 100, maxMp: 100, atkPower: 35, kills: 0, deaths: 0, starCoins: 1000,
        currentSkin: 'default',
        unlockedSkins: ['default'],
        equippedSkills: ['Sk_1', 'Sk_2'], 
        unlockedSkills: ['Sk_1', 'Sk_2', 'Sk_3'],
        cd: { s0: 0, s1: 0, shift: 0 },
        isAttacking: false, attackTimer: 0, shieldTimer: 0,
        isGhost: false 
    },

    enemies: [], allies: [], projectiles: [], particles: [], obstacles: [],
    cardRevealed: false,
    activeShopTab: 'skills', 

    // 聲音合成器
    AudioFX: {
        ctx: null, bgmInterval: null,
        init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
        play(type, freqMod = 400) {
            this.init(); const c = this.ctx; let o = c.createOscillator(), g = c.createGain();
            o.connect(g); g.connect(c.destination);
            let sfx = Engine.settings.sfxVolume;
            
            if (type === 'slash') {
                o.type = 'sawtooth'; o.frequency.setValueAtTime(550, c.currentTime);
                g.gain.setValueAtTime(0.15 * sfx, c.currentTime); o.start(); o.stop(c.currentTime + 0.08);
            } else if (type === 'hit') {
                o.type = 'triangle'; o.frequency.setValueAtTime(180, c.currentTime);
                g.gain.setValueAtTime(0.2 * sfx, c.currentTime); o.start(); o.stop(c.currentTime + 0.05);
            } else {
                o.type = (freqMod % 3 === 0) ? 'square' : (freqMod % 2 === 0 ? 'sawtooth' : 'sine');
                o.frequency.setValueAtTime(freqMod, c.currentTime);
                o.frequency.exponentialRampToValueAtTime(freqMod * 2, c.currentTime + 0.15);
                g.gain.setValueAtTime(0.12 * sfx, c.currentTime); o.start(); o.stop(c.currentTime + 0.18);
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
        if(document.getElementById('input-name')) {
            document.getElementById('input-name').value = this.player.name;
        }
        window.Engine = this;
    },

    // 程式化生成 50+ 種不重複的超載技能矩陣
    generateFiftySkills() {
        const prefixes = ["量子", "裂空", "星核", "幻影", "特斯拉", "脈衝", "熾焰", "寒霜", "虛空", "重力", "暗黑", "聖光", "天啟", "雷霆", "磁暴"];
        const suffixes = ["火球", "漩渦", "突襲", "電擊", "光盾", "射線", "領域", "新星", "爆彈", "斬擊", "波動", "黑洞", "風暴", "矩陣"];
        
        this.skillsRepo['Sk_1'] = { name: "🔥 星核火球", cdMax: 50, mpCost: 15, price: 0, desc: "向前方射出高熱能星核彈道", color: "#ff5500", freq: 450 };
        this.skillsRepo['Sk_2'] = { name: "🌪️ 裂空旋風", cdMax: 100, mpCost: 30, price: 0, desc: "大範圍風壓周身連環切割", color: "#a855f7", freq: 300 };
        this.skillsRepo['Sk_3'] = { name: "👥 幻影突襲", cdMax: 80, mpCost: 20, price: 0, desc: "向前方急速位移並留下殘影", color: "#6366f1", freq: 600 };

        let skillIdCounter = 4;
        for (let p of prefixes) {
            for (let s of suffixes) {
                if (skillIdCounter > 53) break; 
                let id = `Sk_${skillIdCounter}`;
                let cost = 120 + (skillIdCounter * 6); 
                let colors = ["#ff0055", "#00f0ff", "#22c55e", "#eab308", "#ec4899", "#f97316", "#3b82f6", "#14b8a6"];
                
                this.skillsRepo[id] = {
                    name: `${p}${s}`,
                    cdMax: 60 + Math.floor(Math.random() * 70),
                    mpCost: 10 + Math.floor(Math.random() * 25),
                    price: cost,
                    desc: `高階解碼招式：釋放${p}屬性能量進行${s}打擊。`,
                    color: colors[skillIdCounter % colors.length],
                    freq: 220 + (skillIdCounter * 22) 
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

    // 🛠️【修復並重構設定介面】點擊正常跳出，且能正常點擊退出戰場或返回遊戲！
    toggleSettings(show) {
        const modal = document.getElementById('ui-settings-modal') || document.getElementById('settings-modal');
        if (modal) {
            modal.classList.toggle('hidden', !show);
            if (show) {
                // 自動為這個視窗覆寫一層結構清晰的控制選單，保證有關閉、有音量、有退出戰場功能
                modal.innerHTML = `
                    <div style="background:#0f172a; border:2px solid #00f0ff; box-shadow: 0 0 20px rgba(0,240,255,0.4); padding:20px; border-radius:8px; width:300px; max-width:90%; text-align:center; position:relative; color:#fff;">
                        <button onclick="Engine.toggleSettings(false)" style="position:absolute; top:8px; right:12px; background:none; border:none; color:#ff0055; font-size:24px; cursor:pointer; font-weight:bold;">&times;</button>
                        <h3 style="color:#00f0ff; margin-top:0; letter-spacing:2px; text-shadow:0 0 8px #00f0ff;">⚙️ 系統設定庫</h3>
                        
                        <div style="margin:20px 0; text-align:left; font-size:13px;">
                            <label style="display:block; margin-bottom:6px; color:#94a3b8;">特效音量 (SFX)</label>
                            <input type="range" min="0" max="1" step="0.1" value="${this.settings.sfxVolume}" onchange="Engine.settings.sfxVolume = parseFloat(this.value);" style="width:100%; accent-color:#00f0ff;">
                            
                            <label style="display:block; margin-top:14px; margin-bottom:6px; color:#94a3b8;">主音樂量 (BGM)</label>
                            <input type="range" min="0" max="1" step="0.1" value="${this.settings.bgmVolume}" onchange="Engine.settings.bgmVolume = parseFloat(this.value);" style="width:100%; accent-color:#00f0ff;">
                        </div>

                        <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                            <button onclick="Engine.toggleSettings(false)" style="background:#00f0ff; color:#000; font-weight:bold; padding:8px; border:none; border-radius:4px; cursor:pointer; transition:all 0.2s;">返回遊戲</button>
                            ${this.isRunning ? `<button onclick="Engine.toggleSettings(false); Engine.exitGame();" style="background:#ef4444; color:#fff; font-weight:bold; padding:8px; border:none; border-radius:4px; cursor:pointer; box-shadow:0 0 10px rgba(239,68,68,0.3);">🏳️ 退出目前戰場</button>` : ''}
                        </div>
                    </div>
                `;
                // 強制讓這個視窗置中顯示（覆寫 CSS 屬性以防原本的 class hidden 沒有彈出效果）
                modal.style.display = "flex";
                modal.style.justifyContent = "center";
                modal.style.alignItems = "center";
                modal.style.position = "fixed";
                modal.style.zIndex = "9999";
                modal.style.inset = "0";
                modal.style.background = "rgba(0,0,0,0.6)";
            } else {
                modal.style.display = "none";
            }
        } else {
            console.warn("找不到設定選單 HTML 元素。");
        }
    },

    // 修復手機與電腦切換控制
    switchDevice(type) {
        this.device = type.toUpperCase();
        const mobileUI = document.getElementById('mobile-ui');
        const pcFooter = document.getElementById('pc-footer');
        
        if (mobileUI) mobileUI.classList.toggle('hidden', this.device !== 'MOBILE');
        if (pcFooter) pcFooter.classList.toggle('hidden', this.device !== 'PC');
        
        const btnPc = document.getElementById('btn-set-pc');
        const btnMobile = document.getElementById('btn-set-mobile');
        if (btnPc && btnMobile) {
            btnPc.style.background = this.device === 'PC' ? '#00f0ff' : '#1e293b';
            btnPc.style.color = this.device === 'PC' ? '#000' : '#fff';
            btnMobile.style.background = this.device === 'MOBILE' ? '#00f0ff' : '#1e293b';
            btnMobile.style.color = this.device === 'MOBILE' ? '#000' : '#fff';
        }
    },

    renderSkillSelector() {
        const grid = document.getElementById('skill-selector-grid'); if(!grid) return;
        grid.innerHTML = "";
        this.player.unlockedSkills.forEach(key => {
            let sk = this.skillsRepo[key]; if(!sk) return;
            let active = this.player.equippedSkills.includes(key);
            grid.innerHTML += `<div class="skill-select-card ${active?'selected':''}" onclick="Engine.selectSkill('${key}')">
                <div style="color:${sk.color}; font-weight:bold;">${sk.name}</div>
                <div style="font-size:10px; color:#64748b; margin-top:4px;">${sk.desc}</div>
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
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:8px;">
                <div>
                    <button onclick="Engine.switchShopTab('skills')" style="background:${this.activeShopTab==='skills'?'#00f0ff':'#1e293b'}; color:${this.activeShopTab==='skills'?'#000':'#fff'}; border:none; padding:6px 12px; font-weight:bold; cursor:pointer; border-radius:4px; margin-right:8px;">🔮 50+技能庫</button>
                    <button onclick="Engine.switchShopTab('skins')" style="background:${this.activeShopTab==='skins'?'#00f0ff':'#1e293b'}; color:${this.activeShopTab==='skins'?'#000':'#fff'}; border:none; padding:6px 12px; font-weight:bold; cursor:pointer; border-radius:4px;">👕 多維外觀</button>
                </div>
                <div style="color:#eab308; font-weight:bold; font-size:14px; margin-right:20px;">💰 ${this.player.starCoins}</div>
                <button onclick="Engine.toggleShop(false)" style="background:none; border:none; color:#ff0055; font-size:24px; cursor:pointer; font-weight:bold;">&times;</button>
            </div>
            <div class="modal-list-content" style="max-height:400px; overflow-y:auto; margin-top:10px;">
        `;

        if (this.activeShopTab === 'skills') {
            for (let id in this.skillsRepo) {
                let sk = this.skillsRepo[id]; let isUnlocked = this.player.unlockedSkills.includes(id);
                let btn = isUnlocked ? `<span style="color:#10b981; font-weight:bold; font-size:12px;">已擁有</span>` 
                : `<button onclick="Engine.buySkill('${id}')" style="background:#22c55e; border:none; color:#000; font-weight:bold; padding:6px 10px; border-radius:4px; cursor:pointer;">💰 ${sk.price}</button>`;
                html += `<div class="modal-row-item" style="border-left: 3px solid ${sk.color}; padding-left:8px;">
                    <div><strong style="color:${sk.color}">${sk.name}</strong><br><span style="font-size:11px; color:#94a3b8;">${sk.desc}</span></div>
                    <div>${btn}</div>
                </div>`;
            }
        } else {
            for (let id in this.skinsRepo) {
                let sk = this.skinsRepo[id]; let isUnlocked = this.player.unlockedSkins.includes(id); let isEquipped = this.player.currentSkin === id;
                let btn = "";
                if (isEquipped) btn = `<span style="color:#3b82f6; font-weight:bold; font-size:12px;">配戴中</span>`;
                else if (isUnlocked) btn = `<button onclick="Engine.equipSkin('${id}')" style="background:#a855f7; border:none; color:#fff; padding:6px 10px; border-radius:4px; cursor:pointer;">配戴</button>`;
                else btn = `<button onclick="Engine.buySkin('${id}')" style="background:#22c55e; border:none; color:#000; font-weight:bold; padding:6px 10px; border-radius:4px; cursor:pointer;">💰 ${sk.price}</button>`;
                
                html += `<div class="modal-row-item" style="border-left: 3px solid ${sk.color}; padding-left:8px;">
                    <div><strong style="color:${sk.color}">${sk.name}</strong><br><span style="font-size:11px; color:#94a3b8;">${sk.desc}</span></div>
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
        if(document.getElementById('input-name')) {
            this.player.name = document.getElementById('input-name').value || "無情揮刀手";
        }
        this.player.hp = this.player.maxHp; this.player.mp = this.player.maxMp;
        this.player.kills = 0; this.player.deaths = 0; this.player.isGhost = false;
        this.player.cd = { s0: 0, s1: 0, shift: 0 };
        this.enemies = []; this.allies = []; this.projectiles = []; this.particles = [];
        this.camera.x = this.player.x; this.camera.y = this.player.y;

        document.getElementById('ui-main-menu').classList.add('hidden');
        document.getElementById('ui-game-viewport').classList.remove('hidden');
        if(document.getElementById('mobile-ui')) document.getElementById('mobile-ui').classList.toggle('hidden', this.device !== 'MOBILE');
        if(document.getElementById('pc-footer')) document.getElementById('pc-footer').classList.toggle('hidden', this.device !== 'PC');
        if(document.getElementById('spectator-warning')) document.getElementById('spectator-warning').classList.add('hidden');
        
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
            document.getElementById('ui-countdown-mask').classList.add('hidden');
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
            this.allies.push({ x: -150 + i*80, y: this.mapRadius - 150, hp: 250, maxHp: 250, speed: 4.0, size: 30, name: `同盟戰友_${i}`, isAlly: true, flashFrame:0 });
        }
        let aiNames = ["邊譯器", "神算特工", "破壞矩陣", "暗碼魂", "追跡者"];
        for(let i=0; i<size; i++) {
            this.enemies.push({ x: -150 + i*80, y: -this.mapRadius + 150, hp: 220, maxHp: 220, speed: 3.2 + Math.random()*2, size: 30, name: aiNames[i % aiNames.length], isAlly: false, flashFrame: 0 });
        }
    },

    startCountdown() {
        clearInterval(this.countdownId); this.isGameFrozen = true; this.countdownValue = 3;
        const mask = document.getElementById('ui-countdown-mask'); const txt = document.getElementById('txt-countdown');
        mask.classList.remove('hidden'); txt.innerText = this.countdownValue;
        this.countdownId = setInterval(() => {
            this.countdownValue--;
            if(this.countdownValue > 0) txt.innerText = this.countdownValue;
            else if(this.countdownValue === 0) txt.innerText = "FIGHT";
            else { clearInterval(this.countdownId); mask.classList.add('hidden'); this.isGameFrozen = false; }
        }, 1000);
    },

    attack() {
        if(this.isGameFrozen || this.player.isGhost) return; 
        this.player.isAttacking = true; this.player.attackTimer = 10;
        this.AudioFX.play('slash');

        this.enemies.forEach(e => {
            if(e.hp <= 0) return;
            let d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            if(d < 120) {
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

        let skillKey = p.equippedSkills[slot]; let sk = this.skillsRepo[skillKey];
        if(!sk) return;
        let cdKey = slot === 0 ? 's0' : 's1';
        if(p.cd[cdKey] > 0 || p.mp < sk.mpCost) return;

        p.mp -= sk.mpCost; p.cd[cdKey] = sk.cdMax;
        this.AudioFX.play('cast_skill', sk.freq);

        this.projectiles.push({ x: p.x, y: p.y, vx: p.facing * 14, vy: (Math.random() - 0.5) * 4, size: 12, color: sk.color, life: 60, dmg: 55 });
        this.popParticles(p.x, p.y, sk.color, 12);
    },

    popParticles(x, y, col, count) {
        for(let i=0; i<count; i++) this.particles.push({ x: x, y: y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, col: col, life: 25 });
    },

    update() {
        this.frame++; const p = this.player;

        // 幽靈模式轉換判定
        if (p.hp <= 0 && !p.isGhost) {
            p.isGhost = true; p.deaths = 1;
            if(document.getElementById('spectator-warning')) {
                document.getElementById('spectator-warning').classList.remove('hidden');
                document.getElementById('spectator-warning').innerText = "👁️ 您已進入【幽靈模式】可自由移動觀戰";
            }
        }

        if(p.cd.s0 > 0) p.cd.s0--; if(p.cd.s1 > 0) p.cd.s1--; if(p.cd.shift > 0) p.cd.shift--;
        if(p.attackTimer > 0) p.attackTimer--; else p.isAttacking = false;
        if(p.mp < p.maxMp && this.frame % 4 === 0) p.mp = Math.min(p.maxMp, p.mp + 1);

        this.camera.x += (p.x - this.camera.x) * this.camera.lerp;
        this.camera.y += (p.y - this.camera.y) * this.camera.lerp;

        let currentSpeed = p.isGhost ? p.ghostSpeed : p.speed;
        let mx = 0, my = 0;
        if(this.device === 'PC') {
            if(this.keys['KeyW']) my = -currentSpeed; if(this.keys['KeyS']) my = currentSpeed;
            if(this.keys['KeyA']) { mx = -currentSpeed; p.facing = -1; } if(this.keys['KeyD']) { mx = currentSpeed; p.facing = 1; }
        } else { mx = p.vx; my = p.vy; }
        
        p.x += mx; p.y += my;
        p.x = Math.max(-this.mapRadius, Math.min(this.mapRadius, p.x));
        p.y = Math.max(-this.mapRadius, Math.min(this.mapRadius, p.y));

        if (!p.isGhost) {
            this.obstacles.forEach(o => { if(p.x > o.x && p.x < o.x+o.w && p.y > o.y && p.y < o.y+o.h) { p.x -= mx; p.y -= my; } });
        }

        if(this.isGameFrozen) return;

        // AI 實體排斥推擠排斥：杜絕重疊
        for (let i = 0; i < this.enemies.length; i++) {
            for (let j = i + 1; j < this.enemies.length; j++) {
                let e1 = this.enemies[i]; let e2 = this.enemies[j];
                if (e1.hp > 0 && e2.hp > 0) {
                    let dx = e2.x - e1.x; let dy = e2.y - e1.y; let dist = Math.hypot(dx, dy);
                    let minOverlap = 35; 
                    if (dist < minOverlap) {
                        if (dist === 0) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; dist = 0.1; }
                        let push = (minOverlap - dist) / 2;
                        e1.x -= (dx / dist) * push; e1.y -= (dy / dist) * push;
                        e2.x += (dx / dist) * push; e2.y += (dy / dist) * push;
                    }
                }
            }
        }

        // 隊友
        this.allies.forEach(a => {
            if(a.hp <= 0) return;
            let target = this.enemies.find(e => e.hp > 0);
            if(target) {
                let dx = target.x - a.x, dy = target.y - a.y, dist = Math.hypot(dx, dy);
                if(dist > 40) { a.x += (dx/dist)*a.speed; a.y += (dy/dist)*a.speed; }
                if(dist < 50 && this.frame % 30 === 0) { target.hp -= 15; target.flashFrame = 4; }
            }
        });

        // 敵人
        this.enemies.forEach(e => {
            if(e.hp <= 0) return;
            let t = (p.hp > 0 && !p.isGhost) ? p : this.allies.find(a => a.hp > 0); if(!t) return;
            if(!e.isDummy) {
                let dx = t.x - e.x, dy = t.y - e.y, dist = Math.hypot(dx, dy);
                if(dist > 30) { e.x += (dx/dist)*e.speed; e.y += (dy/dist)*e.speed; }
                if(dist < 38 && this.frame % 28 === 0) {
                    if(t === p) { p.hp -= 18; } else { t.hp -= 18; }
                    this.popParticles(t.x, t.y, "#ff0055", 4);
                }
            }
        });

        // 飛道
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

        // 畫面資料更新
        if(document.getElementById('bar-hp')) document.getElementById('bar-hp').style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
        if(document.getElementById('bar-mp')) document.getElementById('bar-mp').style.width = `${(p.mp / p.maxMp) * 100}%`;
        
        p.kills = this.enemies.filter(e => e.hp <= 0 && !e.isDummy).length;
        if(document.getElementById('hud-kda')) document.getElementById('hud-kda').innerText = `${p.kills} / ${p.deaths}`;

        if(document.getElementById('pcd-shift')) document.getElementById('pcd-shift').style.height = `${(p.cd.shift/80)*100}%`;
        if(document.getElementById('mcd-shift')) document.getElementById('mcd-shift').style.height = `${(p.cd.shift/80)*100}%`;
        let max0 = p.equippedSkills[0] && this.skillsRepo[p.equippedSkills[0]] ? this.skillsRepo[p.equippedSkills[0]].cdMax : 1;
        let max1 = p.equippedSkills[1] && this.skillsRepo[p.equippedSkills[1]] ? this.skillsRepo[p.equippedSkills[1]].cdMax : 1;
        if(document.getElementById('pcd-s0')) document.getElementById('pcd-s0').style.height = `${(p.cd.s0/max0)*100}%`;
        if(document.getElementById('mcd-s0')) document.getElementById('mcd-s0').style.height = `${(p.cd.s0/max0)*100}%`;
        if(document.getElementById('pcd-s1')) document.getElementById('pcd-s1').style.height = `${(p.cd.s1/max1)*100}%`;
        if(document.getElementById('mcd-s1')) document.getElementById('mcd-s1').style.height = `${(p.cd.s1/max1)*100}%`;

        // 🎯 全自動追蹤勝負
        this.checkMatchEndCondition();
    },

    checkMatchEndCondition() {
        if(this.mode === 'TRAINING' || this.isGameFrozen || !this.isRunning) return;
        let aliveEnemies = this.enemies.filter(e => e.hp > 0).length;
        let aliveAllies = this.allies.filter(a => a.hp > 0).length;
        let pAlive = this.player.hp > 0 && !this.player.isGhost;

        if(aliveEnemies === 0) {
            this.triggerMatchEnd(true);
        } else if(!pAlive && aliveAllies === 0) {
            this.triggerMatchEnd(false);
        }
    },

    // 二階段階梯結算
    triggerMatchEnd(isWin) {
        this.isGameFrozen = true; this.isRunning = false;
        if (this.loopId) cancelAnimationFrame(this.loopId); 
        this.AudioFX.stopBgm();

        let isLargeTeam = this.mode.includes('4V4') || this.mode.includes('5V5');
        this.oldElo = this.playerElo;
        let delta = 0;
        if(this.mode.includes('RANKED') && !isLargeTeam) {
            delta = isWin ? 22 + Math.floor(Math.random()*5) : -12 - Math.floor(Math.random()*4);
            this.playerElo = Math.max(1000, this.playerElo + delta);
            this.saveStorage();
        }

        this.cardRevealed = false;
        document.querySelectorAll('.quantum-card').forEach(c => c.classList.remove('flipped'));
        let rewards = [`💰 +${35+Math.floor(Math.random()*25)}`, `💰 +15`, `💰 +10`].sort(() => Math.random()-0.5);
        for(let i=0; i<3; i++) {
            let cb = document.getElementById(`card-back-${i}`); if(cb) cb.innerText = rewards[i];
        }

        const view = document.getElementById('ui-settlement-screen');
        const title = document.getElementById('settle-title');
        const eloBox = document.getElementById('settle-elo-box');
        const cardContainer = document.getElementById('settle-card-container');

        if(view) view.classList.remove('hidden');
        if(eloBox) eloBox.style.opacity = "0";
        if(cardContainer) cardContainer.style.opacity = "0";

        if(isWin) {
            title.innerText = "🏆 LEAGUE VICTORY"; title.style.color = "#eab308";
            title.style.animation = "neonPulse 0.5s infinite alternate, complexSpawn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards";
        } else {
            title.innerText = "💀 SYSTEM DEFEAT"; title.style.color = "#ef4444";
            title.style.animation = "neonPulseRed 0.5s infinite alternate, complexSpawn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards";
        }

        setTimeout(() => {
            if(eloBox) { eloBox.style.opacity = "1"; eloBox.style.transition = "opacity 0.8s ease"; }
            if(cardContainer) { cardContainer.style.opacity = "1"; cardContainer.style.transition = "opacity 0.8s ease"; }

            const dText = document.getElementById('settle-elo-delta');
            if (isLargeTeam) {
                if(dText) { dText.innerText = "團隊對抗模式 (無分段跳動)"; dText.className = "neon-blue"; }
                if(document.getElementById('settle-elo-old')) document.getElementById('settle-elo-old').innerText = "--";
                if(document.getElementById('settle-elo-new')) document.getElementById('settle-elo-new').innerText = "--";
                const bar = document.getElementById('settle-elo-bar'); if(bar) bar.style.width = "100%";
            } else {
                if(dText) {
                    dText.innerText = isWin ? `+${delta} ELO` : `${delta} ELO`;
                    dText.className = isWin ? "neon-green" : "neon-red";
                    dText.style.animation = "complexSpawn 0.4s ease-out";
                }
                if(document.getElementById('settle-elo-old')) document.getElementById('settle-elo-old').innerText = this.oldElo;
                if(document.getElementById('settle-elo-new')) document.getElementById('settle-elo-new').innerText = this.playerElo;
                
                let t = Math.min(this.rankTiers.length-1, Math.max(0, Math.floor((this.playerElo - 1000)/100)));
                if(document.getElementById('settle-rank-name')) document.getElementById('settle-rank-name').innerText = this.rankTiers[t];
                
                const bar = document.getElementById('settle-elo-bar');
                if(bar) {
                    bar.style.width = `${this.oldElo % 100}%`;
                    setTimeout(() => {
                        let b = document.getElementById('settle-elo-bar'); if(b) b.style.width = `${this.playerElo % 100}%`;
                    }, 150);
                }
            }
        }, 2000); 
    },

    revealCard(idx, el) {
        if(this.cardRevealed) return; this.cardRevealed = true; el.classList.add('flipped');
        let txt = document.getElementById(`card-back-${idx}`).innerText;
        if(txt.includes('+')) {
            let coins = parseInt(txt.split('+')[1]) || 0; this.player.starCoins += coins; this.saveStorage();
        }
        setTimeout(() => { document.querySelectorAll('.quantum-card').forEach(c => c.classList.add('flipped')); }, 600);
    },

    closeSettlement() {
        document.getElementById('ui-settlement-screen').classList.add('hidden'); this.exitGame();
    },

    exitGame() {
        this.isRunning = false; this.isGameFrozen = false; clearInterval(this.countdownId);
        document.getElementById('ui-game-viewport').classList.add('hidden');
        document.getElementById('ui-main-menu').classList.remove('hidden');
        this.updateLobbyLabels(); this.AudioFX.stopBgm();
    },

    render() {
        const ctx = this.ctx; const p = this.player;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.canvas.width/2 - this.camera.x, this.canvas.height/2 - this.camera.y);

        // 網格與邊界
        ctx.strokeStyle = "rgba(0, 240, 255, 0.02)"; ctx.lineWidth = 2;
        for(let x=-this.mapRadius; x<=this.mapRadius; x+=100) { ctx.beginPath(); ctx.moveTo(x, -this.mapRadius); ctx.lineTo(x, this.mapRadius); ctx.stroke(); }
        for(let y=-this.mapRadius; y<=this.mapRadius; y+=100) { ctx.beginPath(); ctx.moveTo(-this.mapRadius, y); ctx.lineTo(this.mapRadius, y); ctx.stroke(); }

        ctx.strokeStyle = "#ff0055"; ctx.lineWidth = 5; ctx.strokeRect(-this.mapRadius, -this.mapRadius, this.mapRadius*2, this.mapRadius*2);
        this.obstacles.forEach(o => { ctx.fillStyle="#1f2937"; ctx.fillRect(o.x, o.y, o.w, o.h); });

        this.particles.forEach(pt => { ctx.fillStyle=pt.col; ctx.fillRect(pt.x, pt.y, 4, 4); });
        this.projectiles.forEach(pj => { ctx.fillStyle=pj.color; ctx.beginPath(); ctx.arc(pj.x, pj.y, pj.size, 0, Math.PI*2); ctx.fill(); });

        this.allies.forEach(a => {
            if(a.hp <= 0) return;
            ctx.fillStyle = "#3b82f6"; ctx.fillRect(a.x-15, a.y-15, 30, 30);
            ctx.fillStyle = "#fff"; ctx.font = "bold 11px Arial"; ctx.fillText(a.name, a.x-20, a.y-22);
        });

        this.enemies.forEach(e => {
            if(e.hp <= 0) return;
            ctx.fillStyle = e.flashFrame > 0 ? "#fff" : "#ef4444"; if(e.flashFrame > 0) e.flashFrame--;
            ctx.fillRect(e.x-15, e.y-15, 30, 30);
            ctx.fillStyle="#ff0055"; ctx.fillRect(e.x-25, e.y-25, 50*(e.hp/e.maxHp), 5);
        });

        // 玩家虛空幽靈模式專屬透明度渲染
        ctx.save();
        ctx.translate(p.x, p.y);
        
        if (p.isGhost) {
            ctx.globalAlpha = 0.40; 
        }

        let activeSkinCfg = this.skinsRepo[p.currentSkin] || this.skinsRepo['default'];
        ctx.shadowBlur = p.isGhost ? 25 : 15;
        ctx.shadowColor = activeSkinCfg.color;
        ctx.fillStyle = activeSkinCfg.color;

        if (p.currentSkin === 'skin_knight') {
            ctx.fillRect(-20, -20, 40, 40); ctx.fillStyle = "#ff0055"; ctx.fillRect(-4, -18, 8, 36);
        } else if (p.currentSkin === 'skin_assassin') {
            ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(18, 0); ctx.lineTo(0, 22); ctx.lineTo(-18, 0); ctx.closePath(); ctx.fill();
        } else if (p.currentSkin === 'skin_mech') {
            ctx.fillRect(-12, -12, 24, 24); ctx.fillStyle = "#eab308"; ctx.fillRect(-28, -8, 12, 16); ctx.fillRect(16, -8, 12, 16);
        } else if (p.currentSkin === 'skin_god') {
            ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI*2); ctx.stroke();
        } else {
            ctx.fillRect(-16, -16, 32, 32);
        }
        ctx.restore();

        if(p.isAttacking && !p.isGhost) {
            ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 4; ctx.beginPath();
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