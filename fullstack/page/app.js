// ── API CONFIG ──
// Saat development: Node.js jalan di port 3000
// Saat production: ganti dengan URL server yang sebenarnya
const API_URL = 'http://localhost:3000/api'

// ── STATE ──
let totalBudget = 2000000
let usedBudget = 0
let txData = []
let questData = []
let rankData = []
let currentUser = { id: 1, name: 'Budi', level: 1, exp: 0, budget: 2000000 }

// ── API HELPERS ──
async function apiGet(endpoint) {
  try {
    const res = await fetch(API_URL + endpoint)
    return await res.json()
  } catch (err) {
    console.warn('API GET error:', err)
    return null
  }
}

async function apiPost(endpoint, data) {
  try {
    const res = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return await res.json()
  } catch (err) {
    console.warn('API POST error:', err)
    return null
  }
}

async function apiPatch(endpoint, data) {
  try {
    const res = await fetch(API_URL + endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return await res.json()
  } catch (err) {
    console.warn('API PATCH error:', err)
    return null
  }
}

// ── ICON & WARNA PER KATEGORI ──
const CATEGORY_ICON = {
  'Makan & Minum':       { icon: 'ti-bowl-chopsticks', bg: '#FEF3C7' },
  'Transportasi':        { icon: 'ti-car',              bg: '#EFF6FF' },
  'Hiburan & Nongkrong': { icon: 'ti-device-tv',        bg: '#FEE2E2' },
  'Kebutuhan Kuliah':    { icon: 'ti-book',             bg: '#CCFBF1' },
  'Tagihan & Kos':       { icon: 'ti-home',             bg: '#F3E8FF' },
}

function getCatStyle(category) {
  return CATEGORY_ICON[category] || { icon: 'ti-receipt', bg: '#EEF2FF' }
}

// ── NAVIGATION ──
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(screenId).classList.add('active')
  if (screenId === 'screen-app') initApp()
}

function showPage(page, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.getElementById('page-' + page).classList.add('active')
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  if (navEl) navEl.classList.add('active')
  closeSidebar()
  // Saat user buka halaman Arena → panggil sync-league ke FastAPI
  if (page === 'arena') {
    syncLeagueAndRefreshArena()
  }
}

function setMobileNav(page) {
  document.querySelectorAll('.mobile-nav-item').forEach(i => i.classList.remove('active'))
  const el = document.getElementById('mnav-' + page)
  if (el) el.classList.add('active')
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open')
  document.getElementById('sidebar-overlay').classList.toggle('open')
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('sidebar-overlay').classList.remove('open')
}

// ── MODALS ──
function openModal(id) {
  document.getElementById(id).classList.add('open')
  if (id === 'modal-transaksi') {
    const today = new Date().toISOString().split('T')[0]
    document.getElementById('tx-tanggal').value = today
  }
}
function closeModal(id) { document.getElementById(id).classList.remove('open') }

document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open')
  })
})

// ── FORMAT HELPERS ──
function formatRupiah(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'jt'
  if (n >= 1000) return (n / 1000).toFixed(0) + 'rb'
  return n.toString()
}

function formatBudget(el) {
  let v = el.value.replace(/\D/g, '')
  el.value = v ? parseInt(v).toLocaleString('id-ID') : ''
}

function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

// ── SETUP (halaman welcome) ──
function startAdventure() {
  const raw = document.getElementById('budget-val').value.replace(/\./g, '').replace(/,/g, '')
  totalBudget = parseInt(raw) || 2000000
  currentUser.budget = totalBudget
  goTo('screen-app')
  setTimeout(() => {
    showToast('success', 'Petualangan dimulai!', `Selamat datang kembali Pejuang Financial!`)
  }, 300)
}

// ── INIT APP (load semua data dari backend) ──
async function initApp() {
  await Promise.all([
    loadUser(),
    loadTransaksi(),
    loadQuests(),
    loadLeaderboard()
  ])
  renderAll()
  cekTokenStatus()
}

async function loadUser() {
  const res = await apiGet('/users/1')
  if (res && res.success) {
    currentUser = res.data
    totalBudget = currentUser.budget || 2000000

    const nama = currentUser.name || 'Budi'
    const el = document.getElementById('profil-nama')
    if (el) el.textContent = nama
    const av = document.getElementById('profil-avatar')
    if (av) av.textContent = nama.charAt(0).toUpperCase()
    const bgt = document.getElementById('profil-budget')
    if (bgt) bgt.textContent = 'Rp ' + totalBudget.toLocaleString('id-ID')
    const sn = document.getElementById('sidebar-name')
    if (sn) sn.textContent = nama
    const avatarLevelBadge = document.getElementById('avatar-level-badge')
    if (avatarLevelBadge) avatarLevelBadge.textContent = currentUser.level || 1

    const expEl = document.getElementById('profil-exp')
    if (expEl) expEl.textContent = `${(currentUser.exp || 0).toLocaleString('id-ID')} EXP · Level ${currentUser.level || 1}`

    // Update badge liga di profil, sidebar, dan header arena
    syncLigaBadges()
  }
}

async function loadTransaksi() {
  const res = await apiGet('/transactions?user_id=1')
  if (res && res.success) {
    txData = res.data || []
    // Hitung usedBudget dari transaksi bulan ini
    const thisMonth = new Date().toISOString().slice(0, 7)
    usedBudget = txData
      .filter(t => t.date && t.date.startsWith(thisMonth))
      .reduce((sum, t) => sum + (t.amount || 0), 0)
  }
}

async function loadQuests() {
  const res = await apiGet('/quests?user_id=1')
  if (res && res.success) {
    questData = res.data || []
  }
}

async function loadLeaderboard() {
  const month = new Date().toISOString().slice(0, 7)
  const res = await apiGet(`/users/leaderboard/liga?month=${month}&user_id=${currentUser.id || 1}`)
  if (res && res.success) {
    rankData = res.data
    syncLigaBadges()
  }
}

// ── Panggil FastAPI /get-league, update DB, lalu refresh leaderboard ──
async function syncLeagueAndRefreshArena() {
  // Tampilkan loading di rank-list-full
  const el = document.getElementById('rank-list-full')
  if (el) el.innerHTML = '<div style="text-align:center;color:var(--gray-400);padding:24px;font-size:13px;"><i class="ti ti-loader" style="animation:spin 1s linear infinite;margin-right:6px;"></i> Memperbarui liga dari AI...</div>'

  try {
    // Panggil endpoint sync-league — Node.js akan hit /get-league ke FastAPI
    const syncRes = await apiPost('/users/1/sync-league', {})

    if (syncRes && syncRes.success) {
      if (syncRes.data?.updated) {
        const liga = syncRes.data.liga
        showToast('success', `${liga.icon} Liga diperbarui!`, `Model AI menempatkan kamu di ${liga.label}`)
      }
      // Update currentUser.liga agar badge di profil ikut update
      if (currentUser && syncRes.data?.liga) {
        currentUser.liga = syncRes.data.liga.id
      }
    }
  } catch (err) {
    console.warn('[syncLeague] gagal:', err.message)
  }

  // Muat ulang data leaderboard (pakai liga yang sudah diupdate)
  await loadLeaderboard()
  renderRankFull()
  renderMiniRank()
}

// ── RENDER ──
function renderAll() {
  renderAvatarStats()
  renderTxList()
  renderMiniQuest()
  renderMiniRank()
  renderQuestFull()
  renderRankFull()
  updateBudgetDisplay()
}

function getLastExpFromTx() {
  if (!Array.isArray(txData) || txData.length === 0) return 0
  const lastExpTx = txData.find(tx => tx.exp_earned && tx.exp_earned > 0)
  return lastExpTx ? lastExpTx.exp_earned : 0
}

function getLeaguePercentRank() {
  if (!rankData || !rankData.liga_user || !Array.isArray(rankData.leaderboard)) return null
  const userLiga = rankData.leaderboard.find(l => l.liga_id === rankData.liga_user.id)
  if (!userLiga || !userLiga.user_rank_di_liga || !userLiga.total_members) return null
  const rank = userLiga.user_rank_di_liga
  const total = userLiga.total_members
  return Math.min(100, Math.max(1, Math.ceil((rank / total) * 100)))
}

function getAvatarPersona() {
  const txCount = Array.isArray(txData) ? txData.length : 0
  const totalSpent = txData.reduce((sum, tx) => sum + (tx.amount || 0), 0)
  const avgTx = txCount ? totalSpent / txCount : 0
  const categoryCounts = txData.reduce((acc, tx) => {
    const cat = tx.category || 'Lainnya'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})
  const transportRatio = txCount ? (categoryCounts['Transportasi'] || 0) / txCount : 0
  const hiburanRatio = txCount ? (categoryCounts['Hiburan & Nongkrong'] || 0) / txCount : 0
  const isHemat = totalBudget > 0 && totalSpent <= totalBudget * 0.35 && txCount >= 3
  const isBoros = totalBudget > 0 && totalSpent >= totalBudget * 0.8 && txCount >= 3
  const isPemalas = txCount <= 2
  const isSukaFoya = hiburanRatio >= 0.25 || avgTx >= 150000
  const isSukaJalan = transportRatio >= 0.2 || (categoryCounts['Transportasi'] || 0) >= 2

  if (isPemalas) {
    return {
      title: 'Pemalas Cuan',
      subtitle: 'Sedikit gerak, tapi masih bisa mulai dari satu transaksi kecil setiap hari.'
    }
  }
  if (isSukaFoya) {
    return {
      title: 'Si Foya-Foya',
      subtitle: 'Gaya hidup seru, tapi jangan lupa tetap pantau budgetmu.'
    }
  }
  if (isSukaJalan) {
    return {
      title: 'Si Jalan-Jalan',
      subtitle: 'Transaksimu sering untuk perjalanan dan pengalaman baru.'
    }
  }
  if (isBoros) {
    return {
      title: 'Si Boros',
      subtitle: 'Waspada: pengeluaran hampir mendekati batas budgetmu.'
    }
  }
  if (isHemat) {
    return {
      title: 'Si Hemat',
      subtitle: 'Pengeluaranmu terkendali dan budget tetap aman.'
    }
  }
  return {
    title: 'Biasa Aja',
    subtitle: 'Kelola pengeluaranmu sedikit lagi untuk jadi lebih rapih.'
  }
}

function renderAvatarStats() {
  const txCount = Array.isArray(txData) ? txData.length : 0
  const lastExp = getLastExpFromTx()
  const leaguePct = getLeaguePercentRank()
  const persona = getAvatarPersona()

  const titleEl = document.getElementById('avatar-title')
  if (titleEl) titleEl.textContent = persona.title

  const subtitleEl = document.getElementById('avatar-subtitle')
  if (subtitleEl) subtitleEl.textContent = persona.subtitle

  const lastExpEl = document.getElementById('avatar-last-exp')
  if (lastExpEl) {
    lastExpEl.textContent = lastExp > 0 ? `+${lastExp.toLocaleString('id-ID')} EXP terakhir` : 'Belum ada EXP terbaru'
  }

  const leaguePercentEl = document.getElementById('avatar-league-percent')
  if (leaguePercentEl) {
    leaguePercentEl.textContent = leaguePct ? `Top ${leaguePct}% Liga` : 'Persentase liga belum tersedia'
  }

  const txCountEl = document.getElementById('avatar-tx-count')
  if (txCountEl) {
    txCountEl.textContent = `${txCount.toLocaleString('id-ID')} Transaksi`
  }
}

function updateBudgetDisplay() {
  const sisa = totalBudget - usedBudget
  const pct = Math.round((sisa / totalBudget) * 100)
  const sisaEl = document.getElementById('sisa-budget')
  if (sisaEl) sisaEl.textContent = 'Rp ' + formatRupiah(Math.max(0, sisa))
  const bar = document.getElementById('budget-progress')
  if (bar) {
    bar.style.width = Math.max(0, pct) + '%'
    bar.style.background = pct < 20 ? 'var(--red)' : pct < 40 ? 'var(--amber)' : 'var(--teal)'
  }
  const sub = document.getElementById('budget-sub')
  if (sub) sub.textContent = 'Rp ' + formatRupiah(usedBudget) + ' terpakai dari Rp ' + formatRupiah(totalBudget)
}

function renderTxList() {
  const el = document.getElementById('tx-list')
  if (!el) return
  if (txData.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--gray-400);padding:24px;font-size:13px;">Belum ada transaksi. Yuk catat pengeluaran pertamamu!</div>'
    return
  }
  el.innerHTML = txData.slice(0, 10).map(t => {
    const cat = getCatStyle(t.category)
    return `
    <div class="tx-item">
      <div class="tx-icon" style="background:${cat.bg};"><i class="ti ${cat.icon}"></i></div>
      <div class="tx-info">
        <div class="tx-name">${t.note || t.category}</div>
        <div class="tx-cat">${t.category}</div>
      </div>
      <div style="text-align:right;">
        <div class="tx-amount">-Rp ${(t.amount || 0).toLocaleString('id-ID')}</div>
        <div class="tx-date">${formatTanggal(t.date)}</div>
      </div>
    </div>`
  }).join('')
}

function renderMiniQuest() {
  const el = document.getElementById('mini-quest-list')
  if (!el) return
  const active = questData.filter(q => q.status === 'active').slice(0, 2)
  if (active.length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:var(--gray-400);padding:8px;">Tidak ada misi aktif.</div>'
    return
  }
  el.innerHTML = active.map(q => `
    <div style="padding:12px;background:var(--gray-50);border-radius:var(--radius-sm);border-left:3px solid var(--teal);">
      <div style="font-size:13px;font-weight:500;margin-bottom:4px;">${q.title}</div>
      <div class="progress-bar" style="margin:4px 0;"><div class="progress-fill" style="width:${Math.round((q.progress/q.total)*100)}%;"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-400);">
        <span>${q.progress}/${q.total}</span><span style="color:var(--brand);font-weight:500;">+${q.exp_reward} EXP</span>
      </div>
    </div>
  `).join('')
}

function renderMiniRank() {
  const el = document.getElementById('mini-rank-list')
  if (!el) return
  if (!rankData || !rankData.liga_user) {
    el.innerHTML = '<div style="font-size:12px;color:var(--gray-400);padding:8px;">Data leaderboard belum tersedia.</div>'
    return
  }
  const liga = rankData.liga_user
  const myLigaData = rankData.leaderboard?.find(l => l.liga_id === liga.id)
  const top3 = myLigaData?.top10?.slice(0, 3) || []

  el.innerHTML = `
    <div style="font-size:11px;font-weight:600;color:${liga.color};margin-bottom:8px;">
      ${liga.icon} ${liga.label} — Posisimu: #${myLigaData?.user_rank_di_liga || '?'}
    </div>
    ${top3.map((r, i) => `
      <div class="rank-item ${r.is_me ? 'me' : ''}">
        <div class="rank-num ${i < 3 ? 'top' : ''}">${['🥇','🥈','🥉'][i]}</div>
        <div class="avatar avatar-sm" style="${r.is_me ? 'background:var(--brand);' : 'background:var(--gray-200);color:var(--gray-600);'}">${(r.name||'?').charAt(0)}</div>
        <div class="rank-name" style="${r.is_me ? 'color:var(--brand);font-weight:600;' : ''}">${r.is_me ? 'Kamu' : r.name}</div>
        <div class="rank-exp">${(r.exp||0).toLocaleString('id-ID')}</div>
      </div>`).join('')}
  `
}

function renderQuestFull() {
  const el = document.getElementById('quest-list-full')
  if (!el) return
  if (questData.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:40px;margin-bottom:12px;">🎯</div>
        <div style="font-weight:600;margin-bottom:6px;color:var(--gray-700);">Belum ada misi</div>
        <div style="font-size:13px;color:var(--gray-400);">Tekan "Minta Misi Baru" di atas untuk generate misi dari AI!</div>
      </div>`
    return
  }

  el.innerHTML = questData.map(q => {
    const diff = getDiffConfig(q.difficulty)
    const isClaimed = q.status === 'claimed'
    const isHangus = q.status === 'hangus'
    const isActive = q.status === 'active'

    let statusBadge = ''
    if (isClaimed) statusBadge = `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#D1FAE5;color:#065F46;">✅ Selesai</span>`
    else if (isHangus) statusBadge = `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:#FEE2E2;color:#991B1B;">💀 Hangus</span>`
    else statusBadge = `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:${diff.bg};color:${diff.color};">${diff.icon} ${diff.label}</span>`

    const borderColor = isClaimed ? 'var(--teal)' : isHangus ? '#EF4444' : 'var(--brand)'
    const opacity = isHangus ? '0.6' : '1'

    return `
    <div class="quest-item" style="opacity:${opacity};border-left:3px solid ${borderColor};" onclick="openQuestDetail(${q.id})">
      <div class="quest-header">
        <div class="quest-title">${q.title}</div>
        <div class="quest-reward" style="${isClaimed?'color:var(--teal)':isHangus?'color:#EF4444':''}">+${q.exp_reward} EXP</div>
      </div>
      <div style="margin:6px 0;">
        ${statusBadge}
        <span style="margin-left:6px;padding:2px 8px;border-radius:10px;font-size:10px;background:var(--gray-100);color:var(--gray-500);">${getQuestTypeLabel(q.quest_type)}</span>
      </div>
      <div class="quest-desc" style="margin-top:8px;">${q.reason || q.description || ''}</div>
      ${isActive ? `
        <button class="btn btn-primary" style="width:100%;margin-top:12px;font-size:13px;" onclick="event.stopPropagation();openQuestDetail(${q.id})">
          <i class="ti ti-circle-check"></i> Sudah Selesai
        </button>` : ''}
    </div>`
  }).join('')
}

// ── SYNC LIGA BADGES ──
// Keeps sidebar level text, arena header, profile badge, and dashboard liga card
// always in sync with the current user's actual liga.
function syncLigaBadges() {
  if (!rankData || !rankData.liga_user) return
  const liga = rankData.liga_user
  const user = rankData.user

  // Map liga.id → CSS tier class (existing classes in style.css)
  const TIER_CLASS = { gold: 'tier-gold', silver: 'tier-silver', bronze: 'tier-bronze', iron: 'tier-iron' }
  const tierCls = TIER_CLASS[liga.id] || 'tier-iron'

  // 1. Sidebar: "Level X · Liga Y"
  const sidebarLevel = document.getElementById('sidebar-user-level')
  if (sidebarLevel) sidebarLevel.textContent = `Level ${user?.level || 1} · ${liga.label}`

  // 2. Arena page header subtitle
  const arenaSub = document.getElementById('arena-page-sub')
  if (arenaSub) arenaSub.textContent = `Persaingan sesama ${liga.label} — EXP terbanyak bulan ini`

  // 3. Arena page top-right tier badge
  const arenaBadge = document.getElementById('arena-liga-badge')
  if (arenaBadge) {
    arenaBadge.className = `tier-badge ${tierCls}`
    arenaBadge.innerHTML = `<i class="ti ti-medal"></i> ${liga.label}`
  }

  // 4. Profil page tier badge
  const profilBadge = document.getElementById('profil-liga-badge')
  if (profilBadge) {
    profilBadge.className = `tier-badge ${tierCls}`
    profilBadge.innerHTML = `<i class="ti ti-medal"></i> ${liga.label.replace('Liga ', '')}`
  }

  // 5. Dashboard metric "Liga Saat Ini"
  const dashName = document.getElementById('dashboard-liga-name')
  if (dashName) dashName.textContent = liga.label.replace('Liga ', '')

  const dashBadge = document.getElementById('dashboard-liga-badge')
  if (dashBadge) {
    dashBadge.className = `tier-badge ${tierCls}`
    dashBadge.innerHTML = `<i class="ti ti-medal"></i> ${liga.label.replace('Liga ', '')}`
  }

  const dashboardRankText = document.getElementById('dashboard-rank-text')
  const myLigaData = rankData.leaderboard?.find(l => l.liga_id === liga.id)
  const myRank = myLigaData?.user_rank_di_liga || '?'
  const totalInLiga = myLigaData?.total_members || myLigaData?.top10?.length || 0
  if (dashboardRankText && user) {
    dashboardRankText.textContent = totalInLiga ? `Peringkat #${myRank} dari ${totalInLiga}` : `Peringkat #${myRank}`
  }

  const dashboardExpLevel = document.getElementById('dashboard-exp-level')
  if (dashboardExpLevel && user) {
    dashboardExpLevel.textContent = `Level ${user.level || 1}`
  }
  const dashboardExpText = document.getElementById('dashboard-exp-text')
  if (dashboardExpText && user) {
    dashboardExpText.textContent = `${(user.exp || 0).toLocaleString('id-ID')} EXP`
  }

  const arenaUserCard = document.getElementById('arena-user-card')
  if (arenaUserCard && user) {
    const myLigaData = rankData.leaderboard?.find(l => l.liga_id === liga.id)
    const myRank = myLigaData?.user_rank_di_liga || '?'
    const totalInLiga = myLigaData?.top10?.length || 0
    arenaUserCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:12px;background:${liga.liga_color}18;border-radius:var(--radius-sm);border:1px solid ${liga.liga_color}30;">
        <div class="avatar" style="background:${liga.liga_color};">${(user.name||'?').charAt(0)}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:${liga.liga_color};">Posisimu saat ini: #${myRank}</div>
          <div style="font-size:11px;color:var(--gray-500);margin-top:2px;">${(user.exp||0).toLocaleString('id-ID')} EXP · ${liga.label}</div>
        </div>
        <span style="font-size:20px;">${liga.icon}</span>
      </div>`
  }
}

function renderRankFull() {
  const el = document.getElementById('rank-list-full')
  if (!el) return
  if (!rankData || !rankData.leaderboard) {
    el.innerHTML = '<div style="text-align:center;color:var(--gray-400);padding:24px;font-size:13px;">Data leaderboard belum tersedia.</div>'
    return
  }

  const { leaderboard, liga_user, user } = rankData

  // Sync all badges across the app
  syncLigaBadges()

  const otherLeagues = leaderboard.filter(l => !l.is_user_liga)
  const userLeague   = leaderboard.find(l => l.is_user_liga)

  // ── Helper: compact top-3 card for other leagues ──
  function renderOtherLigaCard(liga) {
    const top3 = liga.top10?.slice(0, 3) || []
    const medals = ['🥇','🥈','🥉']
    const rows = top3.length > 0
      ? top3.map((r, i) => `
          <div class="other-liga-row${i === top3.length - 1 ? ' last' : ''}">
            <div class="other-medal">${medals[i]}</div>
            <div class="avatar avatar-sm other-avatar" style="background:${liga.liga_color}22;color:${liga.liga_color};font-weight:700;font-size:11px;">
              ${(r.name||'?').charAt(0)}
            </div>
            <div class="other-name">${r.name}</div>
            <div class="other-exp">${(r.exp||0).toLocaleString('id-ID')}</div>
          </div>`).join('')
      : `<div class="other-empty">Belum ada pemain</div>`

    return `
    <div class="other-liga-card" style="border-color:${liga.liga_color}40;">
      <div class="other-liga-header" style="background:${liga.liga_color}12;border-bottom-color:${liga.liga_color}25;">
        <span class="other-liga-icon">${liga.liga_icon}</span>
        <div class="other-liga-title" style="color:${liga.liga_color};">${liga.liga_label}</div>
      </div>
      <div class="other-liga-body">${rows}</div>
    </div>`
  }

  // ── Helper: full leaderboard for user's league ──
  function renderUserLiga(liga) {
    if (!liga) return ''
    const rows = liga.top10 && liga.top10.length > 0
      ? liga.top10.map((r, i) => `
          <div class="rank-item ${r.is_me ? 'me' : ''}" style="${r.is_me ? `background:${liga.liga_color}15;` : ''}">
            <div class="rank-num ${i < 3 ? 'top' : ''}" style="color:${i < 3 ? liga.liga_color : 'var(--gray-400)'};font-weight:700;">
              ${i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
            </div>
            <div class="avatar avatar-sm" style="${r.is_me ? `background:${liga.liga_color};` : 'background:var(--gray-200);color:var(--gray-600);'}">
              ${(r.name||'?').charAt(0)}
            </div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:${r.is_me?'700':'500'};color:${r.is_me?liga.liga_color:'var(--gray-800)'};">
                ${r.is_me ? `⭐ Kamu (${r.name})` : r.name}
              </div>
              <div style="font-size:11px;color:var(--gray-400);">Level ${r.level}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;font-weight:600;color:var(--gray-700);">${(r.exp||0).toLocaleString('id-ID')}</div>
              <div style="font-size:10px;color:var(--gray-400);">EXP</div>
            </div>
          </div>`).join('')
      : `<div style="text-align:center;font-size:12px;color:var(--gray-300);padding:16px;">Belum ada pemain di liga ini</div>`

    const userNotInTop10 = liga.user_rank_di_liga && liga.user_rank_di_liga > 10
    const userExtraRow = userNotInTop10 ? `
      <div style="border-top:1px dashed var(--gray-200);margin-top:6px;padding-top:6px;">
        <div class="rank-item me" style="background:${liga.liga_color}15;">
          <div class="rank-num" style="color:${liga.liga_color};font-weight:700;">#${liga.user_rank_di_liga}</div>
          <div class="avatar avatar-sm" style="background:${liga.liga_color};">${(user?.name||'?').charAt(0)}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;color:${liga.liga_color};">⭐ Kamu (${user?.name})</div>
            <div style="font-size:11px;color:var(--gray-400);">Level ${user?.level}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px;font-weight:600;color:var(--gray-700);">${(user?.exp||0).toLocaleString('id-ID')}</div>
            <div style="font-size:10px;color:var(--gray-400);">EXP</div>
          </div>
        </div>
      </div>` : ''

    return `
    <!-- ── Liga Kamu (full leaderboard) ── -->
    <div style="margin-bottom:8px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--gray-400);margin-bottom:10px;">Leaderboard Ligamu</div>
      <div style="border-radius:var(--radius);border:2px solid ${liga.liga_color};overflow:hidden;">
        <div style="padding:12px 16px;background:${liga.liga_color}18;display:flex;align-items:center;gap:10px;border-bottom:1px solid ${liga.liga_color}30;">
          <span style="font-size:22px;">${liga.liga_icon}</span>
          <div style="flex:1;">
            <div style="font-size:15px;font-weight:700;color:${liga.liga_color};">${liga.liga_label}</div>
            <div style="font-size:11px;color:var(--gray-400);">Top 10 pemain bulan ini</div>
          </div>
          <span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${liga.liga_color};color:white;">Liga Kamu</span>
        </div>
        <div style="padding:8px;">${rows}${userExtraRow}</div>
      </div>
    </div>`
  }

  // ── RENDER: other leagues grid (top) → user liga centered → full leaderboard ──
  const otherGrid = otherLeagues.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--gray-400);margin-bottom:10px;">Liga Lainnya — Top 3</div>
      <div class="other-liga-grid">
        ${otherLeagues.map(renderOtherLigaCard).join('')}
      </div>
    </div>` : ''

  el.innerHTML = otherGrid + renderUserLiga(userLeague)
}

// ── TRANSAKSI ──
async function simpanTransaksi() {
  const nom = parseInt(document.getElementById('tx-nominal').value)
  const kat = document.getElementById('tx-kategori').value
  const cat = document.getElementById('tx-catatan').value || kat
  const tanggal = document.getElementById('tx-tanggal').value
  const payment = document.querySelector('input[name="payment_method"]:checked')?.value || 'Cash'

  if (!nom || nom <= 0) {
    showToast('warn', '⚠️ Nominal tidak valid', 'Masukkan nominal yang benar.')
    return
  }

  closeModal('modal-transaksi')
  document.getElementById('tx-nominal').value = ''
  document.getElementById('tx-catatan').value = ''
  // Reset payment ke Cash
  document.getElementById('pm-cash').checked = true
  updatePaymentUI('cash')

  // Kirim ke backend
  const result = await apiPost('/transactions', {
    user_id: currentUser.id || 1,
    amount: nom,
    category: kat,
    payment_method: payment,
    note: cat,
    date: tanggal
  })

  if (result && result.success) {
    const d = result.data
    usedBudget += nom

    await loadTransaksi()
    await loadUser()
    await loadLeaderboard()
    renderAll()

    const sisa = totalBudget - usedBudget
    if (sisa < 0) {
      showToast('warn', '⚠️ Over budget!', `Kamu melebihi budget sebesar Rp ${Math.abs(sisa).toLocaleString('id-ID')}`)
    }

    // Tampilkan notif naik liga kalau ada
    if (d.liga_baru) {
      showToast('success', `${d.liga_baru.icon} Naik Liga!`, `Selamat! Kamu masuk ke ${d.liga_baru.label}!`)
    }

    showExpPopup(d.exp_awarded, d.level_up, d.level_title, d.level_badge)
  } else {
    showToast('warn', '⚠️ Gagal menyimpan', result?.message || 'Periksa koneksi ke server.')
  }
}

// ── QUEST SYSTEM ──

const DIFFICULTY_CONFIG = {
  // Key internal (dari backend setelah normalisasi)
  easy:   { label: 'Mudah',  color: '#10B981', bg: '#D1FAE5', icon: '🟢' },
  medium: { label: 'Sedang', color: '#F59E0B', bg: '#FEF3C7', icon: '🟡' },
  hard:   { label: 'Susah',  color: '#EF4444', bg: '#FEE2E2', icon: '🔴' },
  // Alias bahasa Indonesia (kalau tersimpan dalam format lama di DB)
  mudah:  { label: 'Mudah',  color: '#10B981', bg: '#D1FAE5', icon: '🟢' },
  sedang: { label: 'Sedang', color: '#F59E0B', bg: '#FEF3C7', icon: '🟡' },
  susah:  { label: 'Susah',  color: '#EF4444', bg: '#FEE2E2', icon: '🔴' },
  sulit:  { label: 'Susah',  color: '#EF4444', bg: '#FEE2E2', icon: '🔴' },
}

// Normalisasi difficulty di frontend (untuk data lama yang belum ternormalisasi di DB)
function getDiffConfig(raw) {
  if (!raw) return DIFFICULTY_CONFIG.medium
  const key = raw.toString().toLowerCase()
  if (DIFFICULTY_CONFIG[key]) return DIFFICULTY_CONFIG[key]
  if (/mudah|easy|gampang|ringan/i.test(key)) return DIFFICULTY_CONFIG.easy
  if (/susah|hard|sulit|berat/i.test(key)) return DIFFICULTY_CONFIG.hard
  return DIFFICULTY_CONFIG.medium
}

const QUEST_TYPE_LABEL = {
  hemat_total:     '💰 Hemat Total',
  batas_harian:    '📅 Batas Harian',
  batas_frekuensi: '🔢 Batas Frekuensi',
  batas_kategori:  '🏷️ Batas Kategori',
}

// Normalisasi quest_type di frontend (untuk data lama di DB)
function getQuestTypeLabel(raw) {
  if (!raw) return '📋 Misi'
  if (QUEST_TYPE_LABEL[raw]) return QUEST_TYPE_LABEL[raw]
  const s = raw.toLowerCase()
  if (/hemat|total|disiplin/i.test(s)) return '💰 Hemat Total'
  if (/harian|hari/i.test(s)) return '📅 Batas Harian'
  if (/frekuensi|kali/i.test(s)) return '🔢 Batas Frekuensi'
  if (/kategori/i.test(s)) return '🏷️ Batas Kategori'
  return '📋 Misi'
}

async function cekTokenStatus() {
  const res = await apiGet('/quests/token-status?user_id=1')
  const btn = document.getElementById('btn-generate-misi')
  const badge = document.getElementById('token-badge')
  const statusText = document.getElementById('token-status-text')

  if (res && res.success) {
    const { token_tersedia, pesan } = res.data
    if (statusText) statusText.textContent = pesan
    if (badge) {
      badge.style.display = 'block'
      badge.textContent = token_tersedia ? '1 Token ✅' : 'Habis ❌'
      badge.style.background = token_tersedia ? '#D1FAE5' : '#FEE2E2'
      badge.style.color = token_tersedia ? '#065F46' : '#991B1B'
    }
    if (btn) {
      btn.disabled = !token_tersedia
      btn.style.opacity = token_tersedia ? '1' : '0.5'
      btn.style.cursor = token_tersedia ? 'pointer' : 'not-allowed'
      btn.innerHTML = token_tersedia
        ? '<i class="ti ti-wand"></i> Minta Misi Baru (1 Token)'
        : '<i class="ti ti-clock"></i> Token habis · Reset jam 00:00'
    }
  }
}

async function generateMisi() {
  const btn = document.getElementById('btn-generate-misi')
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Generating...' }

  const result = await apiPost('/quests/generate', { user_id: 1 })

  if (result && result.success) {
    await loadQuests()
    renderQuestFull()
    renderMiniQuest()
    await cekTokenStatus()
    showToast('success', '🎯 Misi baru siap!', result.message)
  } else {
    showToast('warn', '⚠️ ' + (result?.message || 'Gagal generate misi'), '')
    await cekTokenStatus()
  }
}

// ID misi yang sedang aktif di modal (untuk submitSelesaikanMisi)
let _activeMisiId = null

function openQuestDetail(id) {
  const q = questData.find(x => x.id === id)
  if (!q) return
  _activeMisiId = id

  const diff = getDiffConfig(q.difficulty)
  const isClaimed = q.status === 'claimed'
  const isHangus = q.status === 'hangus'
  const isActive = q.status === 'active'

  document.getElementById('md-title').textContent = q.title
  document.getElementById('md-alasan').textContent = '🤖 ' + (q.reason || 'Misi ini dibuat berdasarkan pola transaksimu.')
  document.getElementById('md-desc').textContent = q.description || ''
  document.getElementById('md-reward').textContent = `+${q.exp_reward} EXP`

  // Badge difficulty + tipe misi
  const diffBadge = document.getElementById('md-difficulty-badge')
  diffBadge.innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:${diff.bg};color:${diff.color};">
      ${diff.icon} ${diff.label}
    </span>
    <span style="margin-left:8px;display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:20px;font-size:12px;background:var(--gray-100);color:var(--gray-600);">
      ${getQuestTypeLabel(q.quest_type)}
    </span>`


  // Progress & status
  const progBar = document.getElementById('md-progress')
  const progLabel = document.getElementById('md-prog-label')
  if (isClaimed) {
    progBar.style.width = '100%'; progBar.style.background = 'var(--teal)'
    progLabel.textContent = '✅ Selesai & diklaim'
  } else if (isHangus) {
    progBar.style.width = '100%'; progBar.style.background = '#EF4444'
    progLabel.textContent = '💀 Misi hangus'
  } else {
    progBar.style.width = '0%'; progBar.style.background = ''
    progLabel.textContent = 'Belum diverifikasi'
  }

  // Tombol aksi — tampilkan "Sudah Selesai" untuk misi aktif
  const actionEl = document.getElementById('md-action')
  if (isActive) {
    actionEl.innerHTML = `
      <button class="btn btn-primary" style="width:100%;" onclick="konfirmasiMisi()">
        <i class="ti ti-circle-check"></i> Sudah Selesai
      </button>`
  } else if (isClaimed) {
    actionEl.innerHTML = `<div style="text-align:center;font-size:13px;color:var(--gray-400);padding:8px;">🎉 Misi sudah diklaim!</div>`
  } else if (isHangus) {
    actionEl.innerHTML = `<div style="text-align:center;font-size:13px;color:#EF4444;padding:8px;">💀 Misi ini sudah hangus dan tidak bisa diklaim.</div>`
  } else {
    actionEl.innerHTML = ''
  }

  // Reset konfirmasi panel
  _resetKonfirmasiPanel()

  openModal('modal-misi-detail')
}

function _resetKonfirmasiPanel() {
  const panel = document.getElementById('md-konfirmasi')
  const chk1 = document.getElementById('chk-konfirmasi-1')
  const chk2 = document.getElementById('chk-konfirmasi-2')
  const btnSubmit = document.getElementById('btn-konfirmasi-submit')
  if (panel) panel.style.display = 'none'
  if (chk1) { chk1.checked = false; chk1.onchange = null }
  if (chk2) { chk2.checked = false; chk2.onchange = null }
  if (btnSubmit) btnSubmit.disabled = true
  // Pastikan actionEl selalu terlihat kembali setelah reset
  const actionEl = document.getElementById('md-action')
  if (actionEl) actionEl.style.display = ''
}

// Dipanggil saat klik "Sudah Selesai" — tampilkan panel konfirmasi
function konfirmasiMisi() {
  const panel = document.getElementById('md-konfirmasi')
  if (!panel) return
  panel.style.display = 'block'
  // Scroll modal ke bawah supaya checklist terlihat
  const modal = panel.closest('.modal')
  if (modal) setTimeout(() => { modal.scrollTop = modal.scrollHeight }, 50)

  // Gunakan onchange (bukan addEventListener) supaya tidak menumpuk listener
  const chk1 = document.getElementById('chk-konfirmasi-1')
  const chk2 = document.getElementById('chk-konfirmasi-2')
  const btnSubmit = document.getElementById('btn-konfirmasi-submit')
  function updateBtn() {
    if (btnSubmit) btnSubmit.disabled = !(chk1?.checked && chk2?.checked)
  }
  if (chk1) chk1.onchange = updateBtn
  if (chk2) chk2.onchange = updateBtn
  // Sembunyikan tombol "Sudah Selesai" saat panel konfirmasi terbuka
  const actionEl = document.getElementById('md-action')
  if (actionEl) actionEl.style.display = 'none'
}

// Dipanggil saat klik "Batal" di panel konfirmasi
function batalKonfirmasi() {
  _resetKonfirmasiPanel()
  const actionEl = document.getElementById('md-action')
  if (actionEl) actionEl.style.display = ''
}

// Dipanggil saat klik "Verifikasi Sekarang" (setelah kedua checkbox dicentang)
async function submitSelesaikanMisi() {
  const id = _activeMisiId
  if (!id) return

  const btnSubmit = document.getElementById('btn-konfirmasi-submit')
  if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="ti ti-loader"></i> Memverifikasi...' }

  const result = await apiPost(`/quests/${id}/selesaikan`, { user_id: 1 })

  if (result && result.success) {
    // Update lokal dulu supaya render cepat
    const q = questData.find(x => x.id === id)
    if (q) q.status = 'claimed'

    // Reload semua data dari server (termasuk questData supaya state selalu sinkron)
    await Promise.all([loadUser(), loadLeaderboard(), loadQuests()])
    renderAll()

    document.getElementById('hasil-icon').textContent = result.data?.level_up ? '🏆' : '⭐'
    document.getElementById('hasil-title').textContent = result.data?.level_up
      ? `${result.data.level_badge} Level Up ke ${result.data.level_title}!`
      : '🎉 Misi Berhasil!'
    document.getElementById('hasil-detail').textContent = result.detail || ''
    document.getElementById('hasil-exp').textContent = `+${result.data?.exp_earned || 0} EXP`
    closeModal('modal-misi-detail')
    openModal('modal-hasil-verifikasi')

  } else if (result?.hangus) {
    const q = questData.find(x => x.id === id)
    if (q) q.status = 'hangus'
    renderQuestFull()
    document.getElementById('hasil-icon').textContent = '💀'
    document.getElementById('hasil-title').textContent = 'Misi Hangus!'
    document.getElementById('hasil-detail').textContent = result.detail || 'Kamu melewati batas yang ditentukan.'
    document.getElementById('hasil-exp').textContent = '+0 EXP'
    closeModal('modal-misi-detail')
    openModal('modal-hasil-verifikasi')

  } else {
    document.getElementById('hasil-icon').textContent = '⚠️'
    document.getElementById('hasil-title').textContent = 'Misi Belum Selesai'
    document.getElementById('hasil-detail').textContent = result?.detail || result?.message || 'Kondisi misi belum terpenuhi.'
    document.getElementById('hasil-exp').textContent = 'Coba lagi nanti!'
    closeModal('modal-misi-detail')
    openModal('modal-hasil-verifikasi')
  }
}

async function selesaikanMisi(id) {
  // Legacy — redirect ke flow baru
  _activeMisiId = id
  konfirmasiMisi()
}

// ── LEADERBOARD PROFILE ──
function openPlayerProfile(ligaId, rank) {
  // Cari data pemain dari liga dan rank tertentu
  const ligaData = rankData?.leaderboard?.find(l => l.liga_id === ligaId)
  const r = ligaData?.top3?.[rank - 1]
  if (!r) return
  document.getElementById('pp-avatar').textContent = (r.name||'?').charAt(0)
  document.getElementById('pp-name').textContent = r.name
  document.getElementById('pp-level').textContent = `Level ${r.level || 1} · ${(r.exp||0).toLocaleString('id-ID')} EXP`
  const bg = document.getElementById('pp-badges')
  bg.innerHTML = '<span style="font-size:12px;color:var(--gray-400);">Data lencana tersedia segera</span>'
  openModal('modal-profil-pemain')
}

// ── TOAST ──
function showToast(type, title, desc) {
  const t = document.getElementById('toast')
  document.getElementById('toast-title').textContent = title
  document.getElementById('toast-desc').textContent = desc
  document.getElementById('toast-icon').textContent = type === 'warn' ? '⚠️' : '✅'
  t.className = 'toast' + (type === 'warn' ? ' warn' : '')
  setTimeout(() => t.classList.add('show'), 10)
  setTimeout(() => t.classList.remove('show'), 3500)
}

// ── EXP POPUP ──
function showExpPopup(exp, levelUp = false, levelTitle = '', levelBadge = '') {
  const valEl = document.getElementById('exp-popup-val')
  if (valEl) valEl.textContent = `+${exp} EXP`
  if (levelUp && levelTitle) {
    showToast('success', `${levelBadge} Level Up!`, `Selamat! Kamu naik ke ${levelTitle}!`)
  }
  document.getElementById('exp-popup').classList.add('show')
}
function closeExpPopup() {
  document.getElementById('exp-popup').classList.remove('show')
}

// ── EDIT PROFIL ──
function openEditProfil() {
  document.getElementById('edit-nama').value = document.getElementById('profil-nama').textContent
  const budgetText = document.getElementById('profil-budget').textContent
  document.getElementById('edit-budget').value = budgetText.replace(/\D/g, '')
  openModal('modal-edit-profil')
}

async function simpanProfil() {
  const nama = document.getElementById('edit-nama').value.trim()
  const budget = parseInt(document.getElementById('edit-budget').value.replace(/\D/g, ''))

  if (!nama) { showToast('warn', '⚠️ Nama tidak boleh kosong', ''); return }
  if (!budget || budget < 100000) { showToast('warn', '⚠️ Budget minimal Rp 100.000', ''); return }

  const confirmed = window.confirm('Apakah kamu yakin ingin mengubah profil?')
  if (!confirmed) return

  // Update tampilan dulu
  document.getElementById('profil-nama').textContent = nama
  document.getElementById('profil-avatar').textContent = nama.charAt(0).toUpperCase()
  document.getElementById('profil-budget').textContent = 'Rp ' + budget.toLocaleString('id-ID')
  document.getElementById('sidebar-name').textContent = nama
  totalBudget = budget
  currentUser.budget = budget
  currentUser.name = nama
  updateBudgetDisplay()

  // Simpan ke backend
  const result = await apiPatch('/users/1', { name: nama, budget })
  closeModal('modal-edit-profil')
  showToast('success', '✅ Profil diperbarui!', result?.success ? 'Data tersimpan ke database.' : 'Data tersimpan lokal.')
}

// ── PAYMENT METHOD UI ──
function updatePaymentUI(selected) {
  const options = { cash: 'po-cash', ewallet: 'po-ewallet', card: 'po-card' }
  Object.entries(options).forEach(([key, elId]) => {
    const el = document.getElementById(elId)
    if (!el) return
    if (key === selected) {
      el.style.border = '2px solid var(--brand)'
      el.style.background = 'var(--brand-light)'
      el.style.color = 'var(--brand)'
    } else {
      el.style.border = '2px solid var(--gray-200)'
      el.style.background = 'white'
      el.style.color = 'var(--gray-500)'
    }
  })
}

// ── INIT ──
window.addEventListener('load', () => {
  const today = new Date().toISOString().split('T')[0]
  const txDate = document.getElementById('tx-tanggal')
  if (txDate) txDate.value = today

  // Event listener payment method radio buttons
  document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const map = { 'Cash': 'cash', 'E-Wallet': 'ewallet', 'Credit Card': 'card' }
      updatePaymentUI(map[radio.value] || 'cash')
    })
  })
})
