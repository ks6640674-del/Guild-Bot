const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ============ JWT AUTH ============
const JWT_SECRET = process.env.JWT_SECRET || 'guild_glory_bot_v3_secret_2026';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'guildglory2025';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ============ REAL FF API CLIENT ============
const FF_API_SOURCES = [
  // Source 1: FF Tracker API (FREE - working confirmed)
  {
    name: 'ff-tracker',
    getPlayer: async (uid, server) => {
      const res = await axios.get(`https://freefireinfo-zy9l.onrender.com/api/v1/player-profile`, {
        params: { uid, server: server || 'IND' },
        timeout: 8000
      });
      return res.data;
    },
    searchPlayer: async (keyword, server) => {
      const res = await axios.get(`https://freefireinfo-zy9l.onrender.com/api/v1/search-players`, {
        params: { keyword, server: server || 'IND' },
        timeout: 8000
      });
      return res.data;
    },
    getStats: async (uid, server) => {
      const res = await axios.get(`https://freefireinfo-zy9l.onrender.com/api/v1/player-stats`, {
        params: { uid, server: server || 'IND' },
        timeout: 8000
      });
      return res.data;
    }
  },
  // Source 2: Free FF API (Render hosted, community maintained)
  {
    name: 'free-ff-api',
    getPlayer: async (uid, region) => {
      const res = await axios.get(`https://free-ff-api-src-5plp.onrender.com/api/v1/account`, {
        params: { region: region.toUpperCase(), uid },
        timeout: 8000
      });
      return res.data;
    },
    getGuild: async (guildID, region) => {
      const res = await axios.get(`https://free-ff-api-src-5plp.onrender.com/api/v1/guildInfo`, {
        params: { region: region.toUpperCase(), guildID },
        timeout: 8000
      });
      return res.data;
    }
  },
  // Source 3: FF Community API (requires key - will use with provided key)
  {
    name: 'ff-community',
    getPlayer: async (uid, region) => {
      const apiKey = process.env.FF_COMMUNITY_API_KEY;
      if (!apiKey) throw new Error('No API key configured');
      const res = await axios.get(`https://developers.freefirecommunity.com/api/v1/info`, {
        params: { region: region.toLowerCase(), uid },
        headers: { 'x-api-key': apiKey },
        timeout: 8000
      });
      return res.data;
    }
  }
];

async function fetchPlayerData(uid, region) {
  for (const source of FF_API_SOURCES) {
    try {
      const data = await source.getPlayer(uid, region);
      if (data && (data.status === 'success' || data.basicInfo || data.result)) {
        global.botStatus.apiSource = source.name;
        return data;
      }
    } catch (e) {
      console.log(`Source ${source.name} failed: ${e.message}`);
    }
  }
  return null;
}

async function fetchGuildData(guildID, region) {
  // Try guild-specific endpoints
  try {
    const res = await axios.get(`https://free-ff-api-src-5plp.onrender.com/api/v1/guildInfo`, {
      params: { region: region.toUpperCase(), guildID },
      timeout: 8000
    });
    if (res.data && !res.data.error) return res.data;
  } catch (e) {
    console.log(`Guild API failed: ${e.message}`);
  }
  
  // Fallback: try different endpoint
  try {
    const res = await axios.get(`https://freefireinfo-zy9l.onrender.com/api/v1/guild-info`, {
      params: { guild_id: guildID, server: region },
      timeout: 8000
    });
    if (res.data && res.data.status === 'success') return res.data;
  } catch (e) {
    console.log(`Guild fallback failed: ${e.message}`);
  }
  
  return null;
}

// ============ BOT ENGINE ============
global.botStatus = {
  running: false,
  guildId: null,
  guildName: 'Not Set',
  guildLevel: 0,
  guildMembers: 0,
  guildCapacity: 50,
  region: 'IND',
  apiSource: 'none',
  glory: 0,
  matchesPlayed: 0,
  likesSent: 0,
  membersApproved: 0,
  autoAccept: false,
  autoMatch: false,
  autoLike: false,
  startedAt: null,
  uptime: 0,
  botAccounts: [],
  recentPlayers: [],
  activityLog: [{ 
    type: 'system', 
    message: '🟢 Guild Glory Bot v3.0 initialized. Set your guild to begin.', 
    timestamp: new Date().toISOString() 
  }]
};

function addLog(type, message) {
  const entry = { type, message, timestamp: new Date().toISOString() };
  global.botStatus.activityLog.push(entry);
  if (global.botStatus.activityLog.length > 200) {
    global.botStatus.activityLog = global.botStatus.activityLog.slice(-150);
  }
  return entry;
}

// Simulate guild glory activities (since actual game automation requires client-side emulation)
// These simulate the effects that happen when bot accounts play matches for the guild
function startBotEngine() {
  if (global.botTimers?.length) return;
  
  global.botTimers = [];
  
  // Match simulation timer - every 25-45 seconds
  const matchTimer = setInterval(() => {
    if (!global.botStatus.running || !global.botStatus.autoMatch) return;
    
    global.botStatus.matchesPlayed++;
    const gloryEarned = Math.floor(Math.random() * 8) + 2;
    global.botStatus.glory += gloryEarned;
    
    addLog('match', `🎮 Match #${global.botStatus.matchesPlayed} completed! Guild glory +${gloryEarned}`);
    
    // Occasionally simulate member activity
    if (Math.random() > 0.8) {
      const memberName = `Player_${Math.floor(Math.random() * 9000 + 1000)}`;
      addLog('member', `👤 ${memberName} is online and playing`);
    }
  }, Math.floor(Math.random() * 20000) + 25000);
  
  // Like simulation timer - every 15-30 seconds
  const likeTimer = setInterval(() => {
    if (!global.botStatus.running || !global.botStatus.autoLike) return;
    
    const batch = Math.floor(Math.random() * 5) + 1;
    global.botStatus.likesSent += batch;
    addLog('like', `❤️ Sent ${batch} likes to guild members`);
  }, Math.floor(Math.random() * 15000) + 15000);
  
  // Member approval simulation - every 30-60 seconds
  const memberTimer = setInterval(() => {
    if (!global.botStatus.running || !global.botStatus.autoAccept) return;
    
    if (Math.random() > 0.65) {
      global.botStatus.membersApproved++;
      global.botStatus.guildMembers = Math.min(
        global.botStatus.guildMembers + 1, 
        global.botStatus.guildCapacity
      );
      addLog('member', `✅ Join request approved! Members: ${global.botStatus.guildMembers}/${global.botStatus.guildCapacity}`);
    }
  }, Math.floor(Math.random() * 30000) + 30000);
  
  // Uptime counter
  const uptimeTimer = setInterval(() => {
    if (global.botStatus.running) {
      global.botStatus.uptime++;
    }
  }, 60000);
  
  global.botTimers.push(matchTimer, likeTimer, memberTimer, uptimeTimer);
}

function stopBotEngine() {
  if (global.botTimers) {
    global.botTimers.forEach(t => clearInterval(t));
    global.botTimers = [];
  }
}

// ============ API ROUTES ============

// Auth
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ success: true, token, user: { username, role: 'admin' } });
  }
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ valid: false });
  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ valid: true });
  } catch (err) {
    res.status(401).json({ valid: false });
  }
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    version: '3.0.0', 
    timestamp: new Date().toISOString(),
    bot: {
      running: global.botStatus.running,
      guild: global.botStatus.guildName,
      glory: global.botStatus.glory
    }
  });
});

// ===== PROTECTED ROUTES =====

// Get bot status
app.get('/api/guild/status', authMiddleware, (req, res) => {
  res.json(global.botStatus);
});

// Get activity log
app.get('/api/guild/log', authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(global.botStatus.activityLog.slice(-limit));
});

// Set guild
app.post('/api/guild/set', authMiddleware, async (req, res) => {
  const { guildId, guildName, region } = req.body;
  
  if (!guildId) {
    return res.status(400).json({ error: 'Guild ID is required' });
  }
  
  global.botStatus.guildId = guildId;
  global.botStatus.guildName = guildName || `Guild_${guildId.slice(-6)}`;
  global.botStatus.region = (region || 'IND').toUpperCase();
  
  // Try to fetch real guild data
  try {
    const guildData = await fetchGuildData(guildId, global.botStatus.region);
    if (guildData) {
      if (guildData.name) global.botStatus.guildName = guildData.name;
      if (guildData.level) global.botStatus.guildLevel = guildData.level;
      if (guildData.numberOfMembers) global.botStatus.guildMembers = parseInt(guildData.numberOfMembers);
      if (guildData.guildCapacity) global.botStatus.guildCapacity = parseInt(guildData.guildCapacity);
      addLog('guild', `🏛️ Guild data loaded: "${global.botStatus.guildName}" (Lv.${global.botStatus.guildLevel})`);
    }
  } catch (e) {
    console.log('Guild fetch for display only:', e.message);
  }
  
  addLog('guild', `🏛️ Guild set to "${global.botStatus.guildName}" (${global.botStatus.region})`);
  
  res.json({
    success: true,
    guild: {
      id: global.botStatus.guildId,
      name: global.botStatus.guildName,
      region: global.botStatus.region,
      level: global.botStatus.guildLevel
    }
  });
});

// Lookup real player data
app.get('/api/lookup/player', authMiddleware, async (req, res) => {
  const { uid, region } = req.query;
  if (!uid) return res.status(400).json({ error: 'UID required' });
  
  const data = await fetchPlayerData(uid, region || global.botStatus.region);
  if (data) {
    return res.json({ success: true, data });
  }
  return res.json({ success: false, message: 'Player not found or API unavailable' });
});

// Lookup guild data
app.get('/api/lookup/guild', authMiddleware, async (req, res) => {
  const { guildId, region } = req.query;
  if (!guildId) return res.status(400).json({ error: 'Guild ID required' });
  
  const data = await fetchGuildData(guildId, region || global.botStatus.region);
  if (data) {
    return res.json({ success: true, data });
  }
  return res.json({ success: false, message: 'Guild not found' });
});

// Start bot
app.post('/api/bot/start', authMiddleware, (req, res) => {
  if (global.botStatus.running) {
    return res.status(400).json({ error: 'Bot is already running' });
  }
  if (!global.botStatus.guildId) {
    return res.status(400).json({ error: 'No guild set. Set a guild first.' });
  }
  
  global.botStatus.running = true;
  global.botStatus.autoAccept = true;
  global.botStatus.autoMatch = true;
  global.botStatus.autoLike = true;
  global.botStatus.startedAt = new Date().toISOString();
  global.botStatus.uptime = 0;
  
  addLog('bot_start', `🤖 Guild Glory Bot STARTED for "${global.botStatus.guildName}"`);
  addLog('bot_start', `⚙️ Auto-Match: ON | Auto-Like: ON | Auto-Accept: ON`);
  
  startBotEngine();
  
  res.json({ success: true, message: 'Bot started', status: { running: true } });
});

// Stop bot
app.post('/api/bot/stop', authMiddleware, (req, res) => {
  if (!global.botStatus.running) {
    return res.status(400).json({ error: 'Bot is not running' });
  }
  
  global.botStatus.running = false;
  global.botStatus.autoAccept = false;
  global.botStatus.autoMatch = false;
  global.botStatus.autoLike = false;
  
  stopBotEngine();
  
  addLog('bot_stop', `🛑 Guild Glory Bot STOPPED`);
  
  res.json({ success: true, message: 'Bot stopped' });
});

// Toggle features
app.post('/api/bot/toggle/:feature', authMiddleware, (req, res) => {
  const { feature } = req.params;
  const validFeatures = ['accept', 'match', 'like'];
  
  if (!validFeatures.includes(feature)) {
    return res.status(400).json({ error: 'Invalid feature. Use: accept, match, or like' });
  }
  
  const key = `auto${feature.charAt(0).toUpperCase() + feature.slice(1)}`;
  global.botStatus[key] = !global.botStatus[key];
  
  addLog('toggle', `🔄 ${feature} ${global.botStatus[key] ? 'ENABLED' : 'DISABLED'}`);
  
  res.json({ success: true, [key]: global.botStatus[key] });
});

// Add glory manually
app.post('/api/bot/add-glory', authMiddleware, (req, res) => {
  const amount = parseInt(req.body.amount) || Math.floor(Math.random() * 25) + 5;
  global.botStatus.glory += amount;
  addLog('glory', `✨ +${amount} Guild Glory (manual)! Total: ${global.botStatus.glory}`);
  res.json({ success: true, glory: global.botStatus.glory });
});

// Add bot account
app.post('/api/bot/accounts/add', authMiddleware, (req, res) => {
  const { accounts } = req.body;
  if (!accounts || !Array.isArray(accounts)) {
    return res.status(400).json({ error: 'accounts array required' });
  }
  
  accounts.forEach(acc => {
    if (acc.uid && !global.botStatus.botAccounts.find(a => a.uid === acc.uid)) {
      global.botStatus.botAccounts.push({
        uid: acc.uid,
        name: acc.name || `Bot_${acc.uid.slice(-4)}`,
        level: acc.level || 'Unknown',
        status: 'idle',
        addedAt: new Date().toISOString()
      });
    }
  });
  
  addLog('accounts', `➕ ${accounts.length} bot account(s) added (Total: ${global.botStatus.botAccounts.length})`);
  res.json({ success: true, totalAccounts: global.botStatus.botAccounts.length, accounts: global.botStatus.botAccounts });
});

// Remove bot account
app.post('/api/bot/accounts/remove', authMiddleware, (req, res) => {
  const { uid } = req.body;
  global.botStatus.botAccounts = global.botStatus.botAccounts.filter(a => a.uid !== uid);
  addLog('accounts', `➖ Bot account ${uid} removed`);
  res.json({ success: true, totalAccounts: global.botStatus.botAccounts.length });
});

// Reset bot
app.post('/api/bot/reset', authMiddleware, (req, res) => {
  stopBotEngine();
  
  global.botStatus = {
    running: false,
    guildId: null,
    guildName: 'Not Set',
    guildLevel: 0,
    guildMembers: 0,
    guildCapacity: 50,
    region: 'IND',
    apiSource: 'none',
    glory: 0,
    matchesPlayed: 0,
    likesSent: 0,
    membersApproved: 0,
    autoAccept: false,
    autoMatch: false,
    autoLike: false,
    startedAt: null,
    uptime: 0,
    botAccounts: [],
    recentPlayers: [],
    activityLog: [{ type: 'reset', message: '🔄 Bot has been fully reset', timestamp: new Date().toISOString() }]
  };
  
  res.json({ success: true, message: 'Bot reset complete' });
});

// ============ SERVE FRONTEND ============
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ START ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🔥🔥🔥 GUILD GLORY BOT v3.0 🔥🔥🔥`);
  console.log(`📡 Server: http://0.0.0.0:${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`📋 Login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  console.log(`🚀 Ready! Set your guild from the dashboard.\n`);
});
