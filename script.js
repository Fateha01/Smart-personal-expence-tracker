/* ═══════════════════════════════════════════════════════════
   EXPENSIO — script.js
   Complete expense tracker with admin/user login system
   ═══════════════════════════════════════════════════════════ */
'use strict';

/* ──────────────────────────────────────
   1. CONSTANTS
────────────────────────────────────── */
const KEYS = {
  TX:      'expensio_tx',
  BUDGETS: 'expensio_budgets',
  THEME:   'expensio_theme',
  USERS:   'expensio_users',
  SESSION: 'expensio_session',
};
const CUR = '৳';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CATEGORIES = [
  { id:'food',          label:'Food',          color:'#f97316', emoji:'🍜' },
  { id:'transport',     label:'Transport',     color:'#38bdf8', emoji:'🚌' },
  { id:'rent',          label:'Rent',          color:'#a78bfa', emoji:'🏠' },
  { id:'bills',         label:'Bills',         color:'#fb7185', emoji:'⚡' },
  { id:'shopping',      label:'Shopping',      color:'#2dd4bf', emoji:'🛍️' },
  { id:'health',        label:'Health',        color:'#4ade80', emoji:'💊' },
  { id:'education',     label:'Education',     color:'#fbbf24', emoji:'📚' },
  { id:'entertainment', label:'Entertainment', color:'#f43f5e', emoji:'🎬' },
  { id:'salary',        label:'Salary',        color:'#00d4aa', emoji:'💰' },
  { id:'gifts',         label:'Gifts',         color:'#c084fc', emoji:'🎁' },
];
const CAT = Object.fromEntries(CATEGORIES.map(c=>[c.id,c]));

/* ──────────────────────────────────────
   2. STATE
────────────────────────────────────── */
const state = {
  session:      null,   // { username, role, name }
  transactions: [],
  budgets:      {},
  filtered:     [],
  charts:       {},
  editId:       null,
  deleteId:     null,
  activeRole:   'user', // role tab on login screen
};

/* ──────────────────────────────────────
   3. AUTH SYSTEM
────────────────────────────────────── */
const Auth = {
  async login(username, password, role) {
    try {
      const user = await window.ExpensioAPI.AuthAPI.login(username, password);
      if (role && user.role !== role) {
        window.ExpensioAPI.AuthAPI.logout();
        return null; // Deny if wrong role tab selected
      }
      user.avatar = user.name ? user.name[0].toUpperCase() : 'U';
      user.color = user.role === 'admin' ? '#fbbf24' : '#00d4aa';
      localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
      return user;
    } catch (err) {
      console.error('Login error:', err);
      return null;
    }
  },

  async register(name, username, password) {
    if (!name.trim() || !username.trim() || !password) return { ok:false, msg:'All fields are required.' };
    if (username.length < 3)  return { ok:false, msg:'Username must be at least 3 characters.' };
    if (password.length < 6)  return { ok:false, msg:'Password must be at least 6 characters.' };
    
    try {
      await window.ExpensioAPI.AuthAPI.register(name.trim(), username, password);
      return { ok:true };
    } catch (err) {
      console.error('Register error:', err);
      return { ok:false, msg: err.message || 'Registration failed.' };
    }
  },

  logout() {
    window.ExpensioAPI.AuthAPI.logout();
    localStorage.removeItem(KEYS.SESSION);
    state.session = null;
    state.transactions = [];
    state.budgets = {};
    state.filtered = [];
  },

  loadSession() {
    try {
      const raw = localStorage.getItem(KEYS.SESSION);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  isAdmin() { return state.session?.role === 'admin'; },

  async loadUsers() {
    try {
      const res = await window.ExpensioAPI.AdminAPI.getUsers();
      return res || [];
    } catch (err) {
      console.error('Load users error:', err);
      return [];
    }
  }
};

/* ──────────────────────────────────────
   4. STORAGE (API Integration)
────────────────────────────────────── */
const Store = {
  async load() {
    try {
      const txRes = await ExpensioAPI.TransactionAPI.getAll();
      state.transactions = txRes.data || [];
      
      const now = new Date();
      const bRes = await ExpensioAPI.BudgetAPI.get(now.getMonth(), now.getFullYear());
      state.budgets = bRes.categories || {};
      state.spentObj = bRes.spent || {};
    } catch (err) {
      console.error(err);
      toast('Failed to load data from server.', 'error');
      state.transactions = [];
      state.budgets = {};
      state.spentObj = {};
    }
  },
  save() {
    // Handled individually by CRUD API calls
  },
  updateBar() {
    // Not applicable with DB
    $('storageBar').style.width = '0%';
    $('storageText').textContent = 'Cloud';
  },
  async reset() {
    try {
      await ExpensioAPI.AdminAPI.resetAll();
      state.transactions = [];
      state.budgets = {};
      refresh();
      toast('All data has been reset on server.', 'success');
    } catch (err) {
      toast('Failed to reset data.', 'error');
    }
  },
};

/* ──────────────────────────────────────
   5. TRANSACTION CRUD
────────────────────────────────────── */
const Tx = {
  async add(tx) {
    try {
      const savedTx = await window.ExpensioAPI.TransactionAPI.create(tx);
      // Map _id to id if backend doesn't do it
      if (savedTx._id && !savedTx.id) savedTx.id = savedTx._id;
      state.transactions.unshift(savedTx);
      refresh();
      toast('Transaction added!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to add transaction', 'error');
    }
  },
  async update(id, data) {
    try {
      const updatedTx = await window.ExpensioAPI.TransactionAPI.update(id, data);
      if (updatedTx._id && !updatedTx.id) updatedTx.id = updatedTx._id;
      const i = state.transactions.findIndex(t => t.id === id || t._id === id);
      if (i >= 0) {
        state.transactions[i] = updatedTx;
        state.transactions.sort((a,b)=>new Date(b.date)-new Date(a.date));
      }
      refresh();
      toast('Transaction updated!', 'success');
    } catch (err) {
      toast(err.message || 'Failed to update transaction', 'error');
    }
  },
  async delete(id) {
    try {
      const tx = Tx.get(id);
      const category = tx?.category || (tx && tx._id ? tx.category : null);
      await window.ExpensioAPI.TransactionAPI.remove(id, category);
      state.transactions = state.transactions.filter(t => t.id !== id && t._id !== id);
      refresh();
      toast('Transaction deleted.', 'info');
    } catch (err) {
      toast(err.message || 'Failed to delete transaction', 'error');
    }
  },
  get(id) { return state.transactions.find(t => t.id === id || t._id === id) || null; },
};

/* ──────────────────────────────────────
   6. CALCULATIONS
────────────────────────────────────── */
const Calc = {
  totals(list=state.transactions) {
    return list.reduce((a,t)=>{
      t.type==='income' ? a.income+=t.amount : a.expense+=t.amount;
      return a;
    }, {income:0,expense:0});
  },
  byCategory(list=state.transactions) {
    const m={};
    list.filter(t=>t.type==='expense').forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; });
    return m;
  },
  monthly(year) {
    const inc=new Array(12).fill(0), exp=new Array(12).fill(0);
    state.transactions.forEach(t=>{
      const d=new Date(t.date); if(d.getFullYear()!==year) return;
      const m=d.getMonth();
      t.type==='income' ? inc[m]+=t.amount : exp[m]+=t.amount;
    });
    return {inc,exp};
  },
  balance() {
    const sorted=[...state.transactions].sort((a,b)=>new Date(a.date)-new Date(b.date));
    let run=0; const labels=[],data=[];
    sorted.forEach(t=>{
      run += t.type==='income' ? t.amount : -t.amount;
      labels.push(fmtDate(t.date));
      data.push(+run.toFixed(2));
    });
    return {labels,data};
  },
  thisMonthExp(catId) {
    const n=new Date();
    return state.transactions
      .filter(t=>t.type==='expense'&&t.category===catId)
      .filter(t=>{ const d=new Date(t.date); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); })
      .reduce((s,t)=>s+t.amount,0);
  },
};

/* ──────────────────────────────────────
   7. FILTERS
────────────────────────────────────── */
const Filters = {
  apply() {
    const q   = $('searchInput').value.toLowerCase().trim();
    const typ = $('filterType').value;
    const cat = $('filterCategory').value;
    const fr  = $('filterDateFrom').value;
    const to  = $('filterDateTo').value;
    state.filtered = state.transactions.filter(t=>{
      if (q && !t.description.toLowerCase().includes(q) && !CAT[t.category]?.label.toLowerCase().includes(q)) return false;
      if (typ && t.type!==typ)    return false;
      if (cat && t.category!==cat) return false;
      const txDate = toDateStr(t.date);
      if (fr && txDate < fr)        return false;
      if (to && txDate > to)        return false;
      return true;
    });
  },
  clear() {
    ['searchInput','filterType','filterCategory','filterDateFrom','filterDateTo'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
    Filters.apply();
  },
};

/* ──────────────────────────────────────
   8. RENDER — DASHBOARD
────────────────────────────────────── */
function renderDashboard() {
  const {income,expense} = Calc.totals();
  const balance = income - expense;
  const safeToSpend = Math.max(0, balance);
  const savRate = income>0 ? Math.round((balance/income)*100) : 0;

  setText('totalIncome',  fmt(income));
  setText('totalExpense', fmt(expense));
  setText('netBalance',   fmt(balance));
  setText('savingsRate',  fmt(safeToSpend));
  setText('incomeCount',  state.transactions.filter(t=>t.type==='income').length+' entries');
  setText('expenseCount', state.transactions.filter(t=>t.type==='expense').length+' entries');
  setText('balanceStatus', balance>=0 ? '▲ Positive cash flow' : '▼ Negative cash flow');

  // Category breakdown
  const catMap  = Calc.byCategory();
  const total   = Object.values(catMap).reduce((s,v)=>s+v,0);
  const entries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const barsEl  = $('categoryBars');
  const catEmpty= $('catEmpty');

  $('catPill').textContent = fmt(total);
  barsEl.querySelectorAll('.cat-row').forEach(r=>r.remove());
  catEmpty.style.display = entries.length ? 'none' : 'flex';

  entries.forEach(([id,amt]) => {
    const meta = CAT[id]||{label:id,color:'#888'};
    const pct  = total>0 ? (amt/total*100).toFixed(1) : 0;
    const row  = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <div class="cat-name-cell">
        <span class="cat-dot" style="background:${meta.color}"></span>
        <span class="cat-name">${meta.label}</span>
      </div>
      <div class="cat-track">
        <div class="cat-bar" style="width:0%;background:${meta.color}" data-pct="${pct}"></div>
      </div>
      <span class="cat-pct">${pct}%</span>`;
    barsEl.appendChild(row);
    requestAnimationFrame(()=>{ const b=row.querySelector('.cat-bar'); b.style.width=pct+'%'; });
  });

  renderRecent();
}

function renderRecent() {
  const el = $('recentList');
  const list = state.transactions.slice(0,6);
  el.innerHTML = '';
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg><p>No transactions yet</p></div>';
    return;
  }
  list.forEach(t=>{
    const m=CAT[t.category]||{label:t.category,color:'#888',emoji:'•'};
    const sign=t.type==='income'?'+':'-';
    const div=document.createElement('div');
    div.className='recent-item';
    div.innerHTML=`
      <div class="rec-badge" style="background:${m.color}20;color:${m.color}">${m.emoji}</div>
      <div class="rec-info">
        <div class="rec-desc">${esc(t.description||m.label)}</div>
        <div class="rec-meta">${m.label} · ${fmtDate(t.date)}</div>
      </div>
      <div class="rec-amt ${t.type}">${sign}${fmt(t.amount)}</div>`;
    el.appendChild(div);
  });
}

/* ──────────────────────────────────────
   9. RENDER — TABLE
────────────────────────────────────── */
function renderTable() {
  Filters.apply();
  const tbody = $('txBody');
  const empty = $('txEmpty');
  const count = $('resultsCount');

  tbody.innerHTML = '';
  count.textContent = state.filtered.length + ' transaction' + (state.filtered.length!==1?'s':'');

  if (!state.filtered.length) { empty.style.display='flex'; return; }
  empty.style.display = 'none';

  const frag = document.createDocumentFragment();
  state.filtered.forEach(t=>{
    const m=CAT[t.category]||{label:t.category,color:'#888',emoji:'•'};
    const sign=t.type==='income'?'+':'-';
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td class="tx-date-cell">${fmtDate(t.date)}</td>
      <td class="tx-desc-cell" title="${esc(t.description)}">${esc(t.description||'—')}</td>
      <td><span class="cat-tag" style="background:${m.color}18;color:${m.color}">${m.emoji} ${m.label}</span></td>
      <td><span class="type-tag type-${t.type}">${t.type}</span></td>
      <td class="tx-amt-cell ${t.type}">${sign}${fmt(t.amount)}</td>
      <td class="tx-action-cell">
        <button class="tbl-btn tbl-edit"   data-id="${t._id || t.id}">Edit</button>
        <button class="tbl-btn tbl-delete" data-id="${t._id || t.id}">Delete</button>
      </td>`;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  tbody.onclick = e=>{
    const btn=e.target.closest('.tbl-btn');
    if (!btn) return;
    if (btn.classList.contains('tbl-edit'))   openEditModal(btn.dataset.id);
    if (btn.classList.contains('tbl-delete')) openDeleteModal(btn.dataset.id);
  };
}

/* ──────────────────────────────────────
   10. RENDER — CHARTS
────────────────────────────────────── */
function renderCharts() {
  renderPie(); renderBar(); renderLine();
}

function chartStyle() {
  const light = document.documentElement.getAttribute('data-theme')==='light';
  return {
    text:  light ? '#4b5563' : '#7e8ba0',
    grid:  light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)',
    font:  'Outfit',
  };
}

function destroyChart(k) { if(state.charts[k]){ state.charts[k].destroy(); delete state.charts[k]; } }

function renderPie() {
  destroyChart('pie');
  const map     = Calc.byCategory();
  const entries = Object.entries(map);
  const ctx     = $('pieChart').getContext('2d');
  const s       = chartStyle();
  if (!entries.length) {
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    ctx.fillStyle = s.text; ctx.font=`14px ${s.font}`;
    ctx.textAlign='center'; ctx.fillText('No expense data yet', ctx.canvas.width/2, 140);
    return;
  }
  state.charts.pie = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels: entries.map(([id])=>CAT[id]?.label||id),
      datasets:[{
        data:            entries.map(([,v])=>v),
        backgroundColor: entries.map(([id])=>(CAT[id]?.color||'#888')+'cc'),
        borderColor:     entries.map(([id])=>CAT[id]?.color||'#888'),
        borderWidth:2, hoverOffset:10,
      }],
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'64%',
      plugins:{
        legend:{ position:'right', labels:{ color:s.text, font:{family:s.font,size:12}, padding:14, boxWidth:10 } },
        tooltip:{ callbacks:{ label:c=>` ${fmt(c.parsed)} (${(c.parsed/c.dataset.data.reduce((a,b)=>a+b,0)*100).toFixed(1)}%)` } },
      },
    },
  });
}

function renderBar() {
  destroyChart('bar');
  const yearSel = $('barChartYear');
  const year    = parseInt(yearSel.value)||new Date().getFullYear();
  const {inc,exp} = Calc.monthly(year);
  const s = chartStyle();
  state.charts.bar = new Chart($('barChart').getContext('2d'), {
    type:'bar',
    data:{
      labels:MONTHS,
      datasets:[
        { label:'Income',  data:inc, backgroundColor:'rgba(0,212,170,0.7)',  borderColor:'#00d4aa', borderWidth:1, borderRadius:5, borderSkipped:false },
        { label:'Expense', data:exp, backgroundColor:'rgba(251,113,133,0.7)',borderColor:'#fb7185', borderWidth:1, borderRadius:5, borderSkipped:false },
      ],
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{color:s.text,font:{family:s.font,size:12}} }, tooltip:{ callbacks:{ label:c=>` ${fmt(c.parsed.y)}` } } },
      scales:{
        x:{ ticks:{color:s.text,font:{family:s.font}}, grid:{color:s.grid} },
        y:{ ticks:{color:s.text,font:{family:s.font},callback:v=>fmt(v)}, grid:{color:s.grid} },
      },
    },
  });
}

function renderLine() {
  destroyChart('line');
  const {labels,data} = Calc.balance();
  const s = chartStyle();
  const canvas = $('lineChart');
  const ctx    = canvas.getContext('2d');
  const grad   = ctx.createLinearGradient(0,0,0,240);
  grad.addColorStop(0,'rgba(0,212,170,0.3)');
  grad.addColorStop(1,'rgba(0,212,170,0.0)');
  state.charts.line = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[{
        label:'Balance', data,
        borderColor:'#00d4aa', backgroundColor:grad, borderWidth:2,
        pointRadius: data.length<=40?4:0, pointHoverRadius:6,
        pointBackgroundColor:'#00d4aa',
        fill:true, tension:0.42,
      }],
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:c=>` Balance: ${fmt(c.parsed.y)}` } } },
      scales:{
        x:{ ticks:{color:s.text,font:{family:s.font,size:11},maxTicksLimit:10}, grid:{color:s.grid} },
        y:{ ticks:{color:s.text,font:{family:s.font},callback:v=>fmt(v)}, grid:{color:s.grid} },
      },
    },
  });
}

/* ──────────────────────────────────────
   11. RENDER — BUDGET
────────────────────────────────────── */
function renderBudget() {
  const now = new Date();
  $('budgetMonth').textContent = MONTHS[now.getMonth()]+' '+now.getFullYear();

  const grid = $('budgetFormGrid');
  grid.innerHTML = '';
  CATEGORIES.filter(c=>!['salary','gifts'].includes(c.id)).forEach(cat=>{
    const val = state.budgets[cat.id]||'';
    const div = document.createElement('div');
    div.className = 'b-field';
    div.innerHTML = `
      <label class="b-label">
        <span class="b-dot" style="background:${cat.color}"></span>
        ${cat.emoji} ${cat.label}
      </label>
      <input type="number" class="b-input" min="0" step="1" placeholder="0"
             id="budget_${cat.id}" value="${val}"/>`;
    grid.appendChild(div);
  });
  renderBudgetProgress();
}

function renderBudgetProgress() {
  const list = $('budgetProgressList');
  list.innerHTML = '';
  const entries = Object.entries(state.budgets).filter(([,v])=>v>0);
  if (!entries.length) {
    list.innerHTML = '<div class="empty-state"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg><p>Set a budget above to start tracking</p></div>';
    return;
  }
  entries.forEach(([id,budget])=>{
    const meta  = CAT[id]||{label:id,color:'#888',emoji:'•'};
    const spent = Calc.thisMonthExp(id);
    const pct   = Math.min(spent/budget*100,100).toFixed(1);
    const over  = spent>budget;
    const warn  = !over && spent/budget>=0.8;
    const fillColor = over ? '#fb7185' : warn ? '#fbbf24' : meta.color;
    const div = document.createElement('div');
    div.className='bp-item';
    div.innerHTML=`
      <div class="bp-header">
        <div class="bp-name">
          <span class="b-dot" style="background:${meta.color}"></span>
          ${meta.emoji} ${meta.label}
        </div>
        <div class="bp-amounts">${fmt(spent)} / ${fmt(budget)}</div>
      </div>
      <div class="bp-track">
        <div class="bp-fill" style="width:${pct}%;background:${fillColor}"></div>
      </div>
      <div class="bp-warn ${warn?'show':''}">⚠ You've used over 80% of your ${meta.label} budget</div>
      <div class="bp-over ${over?'show':''}">🚨 Budget exceeded by ${fmt(spent-budget)}</div>`;
    list.appendChild(div);
  });
}

/* ──────────────────────────────────────
   12. RENDER — ADMIN PANEL
────────────────────────────────────── */
async function renderAdmin() {
  const users = await Auth.loadUsers();
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransactions = state.transactions.length;

  try {
    const statsData = await window.ExpensioAPI.AdminAPI.getStats();
    if (statsData) {
      totalIncome = statsData.totalIncome;
      totalExpense = statsData.totalExpense;
      totalTransactions = statsData.totalTransactions;
    }
  } catch (e) {
    const totals = Calc.totals();
    totalIncome = totals.income;
    totalExpense = totals.expense;
  }

  const statsEl = $('adminStats');
  statsEl.innerHTML = `
    <div class="admin-stat"><div class="admin-stat-val">${totalTransactions}</div><div class="admin-stat-lbl">Total Transactions</div></div>
    <div class="admin-stat"><div class="admin-stat-val">${users.length}</div><div class="admin-stat-lbl">Registered Users</div></div>
    <div class="admin-stat"><div class="admin-stat-val">${fmt(totalIncome)}</div><div class="admin-stat-lbl">Total Income</div></div>
    <div class="admin-stat"><div class="admin-stat-val">${fmt(totalExpense)}</div><div class="admin-stat-lbl">Total Expense</div></div>`;

  // Users table
  const usersEl = $('adminUsersList');
  if (!users.length) { usersEl.innerHTML='<div class="empty-state"><p>No users found.</p></div>'; return; }
  const colors = ['#00d4aa','#38bdf8','#a78bfa','#fbbf24','#fb7185','#4ade80'];
  usersEl.innerHTML=`
    <table class="users-tbl">
      <thead><tr><th>User</th><th>Username</th><th>Role</th><th>Status</th></tr></thead>
      <tbody>
        ${users.map((u,i)=>{
          const c = u.color||colors[i%colors.length];
          const isCurrent = u.username===state.session?.username;
          return `<tr>
            <td>
              <div style="display:flex;align-items:center;gap:9px">
                <span class="user-av" style="background:${c}20;color:${c};border:1px solid ${c}40">${u.name ? u.name[0].toUpperCase() : 'U'}</span>
                ${esc(u.name)}
              </div>
            </td>
            <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--txt-2)">@${esc(u.username)}</td>
            <td><span class="role-pill ${u.role==='admin'?'role-admin':'role-user'}">${u.role}</span></td>
            <td style="font-size:12px;color:var(--txt-2)">${isCurrent?'<span style="color:var(--teal);font-weight:600">● Current</span>':'—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

/* ──────────────────────────────────────
   13. MODAL MANAGEMENT
────────────────────────────────────── */
function openAddModal() {
  state.editId = null;
  setText('modalTitle','New Transaction');
  $('btnSubmit').textContent='Add Transaction';
  $('editId').value='';
  $('txForm').reset();
  $('txDate').value = today();
  $('txType').value = 'expense';
  setTypeSwitch('expense');
  $('quickRow').style.display='';
  clearCatChips(); clearFormErrs();
  openOverlay('txOverlay');
}

function openEditModal(id) {
  const t = Tx.get(id);
  if (!t) return;
  state.editId = id;
  setText('modalTitle','Edit Transaction');
  $('btnSubmit').textContent='Save Changes';
  $('editId').value=id;
  $('txAmount').value=t.amount;
  $('txType').value=t.type;
  $('txDate').value = toDateStr(t.date);
  $('txDesc').value=t.description;
  $('quickRow').style.display='none';
  setTypeSwitch(t.type);
  selectCat(t.category);
  clearFormErrs();
  openOverlay('txOverlay');
}

function openDeleteModal(id) { state.deleteId=id; openOverlay('delOverlay'); }
function openOverlay(id)  { $(id).classList.add('open'); document.body.style.overflow='hidden'; }
function closeOverlay(id) { $(id).classList.remove('open'); document.body.style.overflow=''; }

/* ──────────────────────────────────────
   14. FORM: CATEGORY CHIPS
────────────────────────────────────── */
function buildCatChips() {
  const grid = $('catChipGrid');
  grid.innerHTML = '';
  CATEGORIES.forEach(cat=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='cat-chip';
    btn.dataset.catId=cat.id;
    btn.textContent=`${cat.emoji} ${cat.label}`;
    btn.style.color=cat.color;
    btn.style.setProperty('--c', cat.color+'30');
    btn.addEventListener('click',()=>selectCat(cat.id));
    grid.appendChild(btn);
  });
}

function selectCat(id) {
  $('txCategory').value=id;
  document.querySelectorAll('.cat-chip').forEach(b=>{
    b.classList.toggle('selected', b.dataset.catId===id);
  });
}
function clearCatChips() { $('txCategory').value=''; document.querySelectorAll('.cat-chip').forEach(b=>b.classList.remove('selected')); }

/* ──────────────────────────────────────
   15. FORM: TYPE SWITCHER
────────────────────────────────────── */
function setTypeSwitch(type) {
  $('txType').value=type;
  document.querySelectorAll('.tsw-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.type===type);
  });
  const track = document.querySelector('.tsw-track');
  if (track) { track.classList.toggle('income', type==='income'); }
}

/* ──────────────────────────────────────
   16. VALIDATION
────────────────────────────────────── */
function validate() {
  clearFormErrs();
  let ok=true;
  const amt=parseFloat($('txAmount').value);
  if (isNaN(amt)||amt<=0) { showErr('errAmount','Enter a valid positive amount.'); $('txAmount').classList.add('err'); ok=false; }
  if (!$('txCategory').value) { showErr('errCat','Please select a category.'); ok=false; }
  return ok;
}
function clearFormErrs() {
  ['errAmount','errCat'].forEach(id=>{setText(id,'');});
  $('txAmount').classList.remove('err');
}
function clearForm() {
  $('txForm').reset();
  $('txType').value = 'expense';
  setTypeSwitch('expense');
  clearCatChips();
  clearFormErrs();
  $('txDate').value = today();
}
function showErr(id,msg) { setText(id,msg); }

/* ──────────────────────────────────────
   17. CSV EXPORT
────────────────────────────────────── */
function exportCSV(list=state.transactions) {
  if (!list.length) { toast('No data to export.','error'); return; }
  const rows=list.map(t=>[toDateStr(t.date),`"${(t.description||'').replace(/"/g,'""')}"`,CAT[t.category]?.label||t.category,t.type,t.amount.toFixed(2)]);
  const csv=[['Date','Description','Category','Type','Amount'],...rows].map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`expensio_${today()}.csv`;
  a.click();
  toast('CSV exported!','success');
}

/* ──────────────────────────────────────
   18. NAVIGATION
────────────────────────────────────── */
function navigateTo(id) {
  const map = {
    dashboard:    {section:'sectionDashboard',    title:'Dashboard',    sub:'Financial overview'},
    transactions: {section:'sectionTransactions', title:'Transactions', sub:'Manage your records'},
    charts:       {section:'sectionCharts',       title:'Analytics',    sub:'Visual insights'},
    budget:       {section:'sectionBudget',       title:'Budgets',      sub:'Spending limits'},
    admin:        {section:'sectionAdmin',         title:'User Panel',   sub:'Admin management'},
  };
  const target=map[id]; if(!target) return;

  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.sb-nav-item').forEach(n=>n.classList.remove('active'));
  $(target.section).classList.add('active');
  document.querySelectorAll(`[data-section="${id}"]`).forEach(n=>n.classList.add('active'));
  setText('pageTitle',target.title);
  setText('pageSub',target.sub);

  if (id==='transactions') { state.filtered=[...state.transactions]; renderTable(); }
  if (id==='charts') { populateYearSel(); renderCharts(); }
  if (id==='budget') renderBudget();
  if (id==='dashboard') renderDashboard();
  if (id==='admin' && Auth.isAdmin()) renderAdmin();

  closeMobileSidebar();
}

/* ──────────────────────────────────────
   19. THEME
────────────────────────────────────── */
function setTheme(t) {
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem(KEYS.THEME,t);
  const svg=$('themeIconSvg');
  if (t==='dark') svg.innerHTML=`<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
  else svg.innerHTML=`<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>`;
  if (document.getElementById('sectionCharts')?.classList.contains('active')) renderCharts();
}
function toggleTheme() {
  setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
}

/* ──────────────────────────────────────
   20. SIDEBAR (mobile)
────────────────────────────────────── */
function toggleMobileSidebar() {
  $('sidebar').classList.toggle('open');
  $('sbOverlay').classList.toggle('show');
}
function closeMobileSidebar() {
  $('sidebar').classList.remove('open');
  $('sbOverlay').classList.remove('show');
}

/* ──────────────────────────────────────
   21. UTILITIES
────────────────────────────────────── */
function $(id) { return document.getElementById(id); }
function setText(id,v) { const e=$(id); if(e) e.textContent=v; }
function fmt(n) { return CUR+' '+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function today() { return new Date().toISOString().slice(0,10); }
function fmtDate(s) {
  if (!s) return '—';
  // Handle both full ISO strings and YYYY-MM-DD strings safely
  const d = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00');
  if (isNaN(d)) return 'Invalid Date';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
function toDateStr(s) {
  // Extract YYYY-MM-DD regardless of whether s is full ISO or plain date
  if (!s) return '';
  return s.includes('T') ? s.slice(0, 10) : s;
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg,type='info') {
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  const icons={success:'✓ ',error:'✕ ',info:'i '};
  t.textContent=(icons[type]||'')+msg;
  $('toastDock').appendChild(t);
  setTimeout(()=>t.remove(),3200);
}
function populateYearSel() {
  const years=new Set(state.transactions.map(t=>new Date(t.date).getFullYear()));
  years.add(new Date().getFullYear());
  const sel=$('barChartYear');
  const cur=sel.value||new Date().getFullYear().toString();
  sel.innerHTML=[...years].sort((a,b)=>b-a).map(y=>`<option value="${y}" ${y==cur?'selected':''}>${y}</option>`).join('');
}

/* ──────────────────────────────────────
   22. REFRESH
────────────────────────────────────── */
function refresh() {
  const active=document.querySelector('.section.active');
  if (!active) return;
  const id=active.id;
  if (id==='sectionDashboard')    renderDashboard();
  if (id==='sectionTransactions') { state.filtered=[...state.transactions]; renderTable(); }
  if (id==='sectionCharts')       renderCharts();
  if (id==='sectionBudget')       renderBudget();
  if (id==='sectionAdmin')        renderAdmin();
}

/* ──────────────────────────────────────
   23. SAMPLE DATA
────────────────────────────────────── */
function seedData() {
  if (state.transactions.length && Object.keys(state.budgets || {}).length) return;
  const now=new Date(); const m=now.getMonth(); const y=now.getFullYear();
  function d(offset) {
    const dt=new Date(y,m,now.getDate()+offset);
    return dt.toISOString().slice(0,10);
  }
  function pm(dayOffset) { return new Date(y,m-1,dayOffset).toISOString().slice(0,10); }

  const samples=[
    {amount:55000,type:'income', category:'salary',       date:d(-27), description:'Monthly salary — April'},
    {amount:8000, type:'income', category:'gifts',        date:d(-20), description:'Freelance design work'},
    {amount:12000,type:'expense',category:'rent',         date:d(-25), description:'Monthly rent payment'},
    {amount:2800, type:'expense',category:'food',         date:d(-18), description:'Grocery shopping — Shwapno'},
    {amount:950,  type:'expense',category:'transport',    date:d(-15), description:'Monthly bus pass + CNG fares'},
    {amount:1400, type:'expense',category:'bills',        date:d(-14), description:'Electricity & gas bill'},
    {amount:4200, type:'expense',category:'shopping',     date:d(-11), description:'New outfit — Aarong'},
    {amount:700,  type:'expense',category:'health',       date:d(-9),  description:'Doctor visit + medicine'},
    {amount:2000, type:'expense',category:'education',    date:d(-7),  description:'Online course subscription'},
    {amount:1100, type:'expense',category:'entertainment',date:d(-5),  description:'Netflix + cinema tickets'},
    {amount:600,  type:'expense',category:'food',         date:d(-4),  description:'Office lunch week'},
    {amount:350,  type:'expense',category:'transport',    date:d(-3),  description:'Rickshaw & CNG fares'},
    {amount:280,  type:'expense',category:'food',         date:d(-1),  description:'Biryani with friends'},
    {amount:420,  type:'expense',category:'shopping',     date:d(0),   description:'Stationery & supplies'},
    {amount:52000,type:'income', category:'salary',       date:pm(25), description:'Monthly salary — March'},
    {amount:11000,type:'expense',category:'rent',         date:pm(2),  description:'Rent — March'},
    {amount:2400, type:'expense',category:'food',         date:pm(10), description:'Grocery + dining'},
    {amount:5500, type:'expense',category:'shopping',     date:pm(15), description:'Eid shopping'},
    {amount:800,  type:'expense',category:'bills',        date:pm(8),  description:'Internet + phone'},
    {amount:3000, type:'income', category:'gifts',        date:pm(20), description:'Eid gift money'},
  ];
  samples.forEach(s=>{ s.id='tx_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); });
  state.transactions=samples.sort((a,b)=>new Date(b.date)-new Date(a.date));
  state.budgets={ food:5000,transport:2000,rent:13000,bills:2500,shopping:6000,health:1500,education:2500,entertainment:1500 };
  Store.save();
}

/* ──────────────────────────────────────
   24. AUTH UI
────────────────────────────────────── */
function setupAuthUI() {
  const roleTabs = document.querySelectorAll('.role-tab');
  roleTabs.forEach(tab=>{
    tab.addEventListener('click',()=>{
      roleTabs.forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      state.activeRole = tab.dataset.role;
      const cred = state.activeRole==='admin' ? 'admin / admin123' : 'user / user123';
      $('demoCred').textContent = cred;
      const isAdmin = state.activeRole==='admin';
      if ($('authToggle')) $('authToggle').style.display = isAdmin ? 'none' : '';
    });
  });

  // Login form submit
  $('authForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const username = $('authUsername').value.trim();
    const password = $('authPassword').value;
    const errEl    = $('authError');
    errEl.textContent='';

    if (!username||!password) { errEl.textContent='Please fill in all fields.'; return; }

    const btnText=$('btnText'); const loader=$('btnLoader');
    btnText.classList.add('hidden'); loader.classList.remove('hidden');

    await delay(600);
    const session = await Auth.login(username, password, state.activeRole);
    btnText.classList.remove('hidden'); loader.classList.add('hidden');

    if (!session) { errEl.textContent='Invalid credentials. Please try again.'; shakeCard(); return; }
    state.session=session;
    startApp();
  });

  // Password toggle
  $('togglePw').addEventListener('click',()=>{
    const inp=$('authPassword');
    inp.type=inp.type==='password'?'text':'password';
    $('eyeIcon').innerHTML = inp.type==='password'
      ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
      : `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  });

  // Register toggle
  $('showRegister')?.addEventListener('click',()=>{
    $('loginView').classList.add('hidden');
    $('registerView').classList.remove('hidden');
  });
  $('showLogin')?.addEventListener('click',()=>{
    $('registerView').classList.add('hidden');
    $('loginView').classList.remove('hidden');
  });

  // Register
  $('btnRegister').addEventListener('click', async ()=>{
    const name=$('regName').value, username=$('regUsername').value, pw=$('regPassword').value;
    const res = await Auth.register(name,username,pw);
    if (!res.ok) { $('regError').textContent=res.msg; return; }
    $('regError').textContent='';
    $('registerView').classList.add('hidden');
    $('loginView').classList.remove('hidden');
    $('authUsername').value=username;
    toast('Account created! Please log in.','success');
  });
}

function shakeCard() {
  const card=$('authCard');
  card.style.animation='none';
  card.offsetHeight;
  card.style.animation='shake 0.4s ease';
}

function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }

/* ──────────────────────────────────────
   25. START APP (post-login)
────────────────────────────────────── */
async function startApp() {
  await Store.load();

  // Animate auth screen out
  $('authScreen').classList.add('leaving');
  setTimeout(()=>{ $('authScreen').classList.add('hidden'); },500);
  $('appScreen').classList.remove('hidden');

  // Set profile info
  const s=state.session;
  const avatarColor = s.color||'#00d4aa';
  const avatarChar  = s.avatar||s.name[0].toUpperCase();

  $('sbAvatar').textContent    = avatarChar;
  $('sbAvatar').style.background = `linear-gradient(135deg, ${avatarColor}, ${avatarColor}99)`;
  setText('sbUsername', s.name);
  setText('sbRole', s.role==='admin'?'Administrator':'Member');
  $('topbarAv').textContent    = avatarChar;
  $('topbarAv').style.background = `linear-gradient(135deg, ${avatarColor}, ${avatarColor}99)`;

  // Show/hide admin nav
  const isAdmin = Auth.isAdmin();
  document.querySelectorAll('.admin-only').forEach(el=>{
    el.classList.toggle('hidden',!isAdmin);
  });

  // Greet
  const hour=new Date().getHours();
  const greet=hour<12?'Good morning':'hour<17'?'Good afternoon':'Good evening';
  setText('pageSub', `${hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'}, ${s.name.split(' ')[0]}!`);

  // Build form elements
  buildCatChips();
  populateCatFilter();
  populateYearSel();

  // Render dashboard
  renderDashboard();
  Store.updateBar();

  bindAppEvents();
}

function populateCatFilter() {
  const sel=$('filterCategory');
  sel.innerHTML='<option value="">All Categories</option>'+
    CATEGORIES.map(c=>`<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
}

/* ──────────────────────────────────────
   26. APP EVENT LISTENERS
────────────────────────────────────── */
function bindAppEvents() {
  // Nav
  document.querySelectorAll('.sb-nav-item').forEach(item=>{
    item.addEventListener('click',e=>{e.preventDefault();navigateTo(item.dataset.section);});
  });

  // "See all" links
  document.addEventListener('click',e=>{
    const link=e.target.closest('[data-goto]');
    if (link) { e.preventDefault(); navigateTo(link.dataset.goto); }
  });

  // Add transaction
  $('btnOpenModal').addEventListener('click',openAddModal);
  $('btnAddFirst')?.addEventListener('click',openAddModal);

  // Modal close
  $('modalClose').addEventListener('click',()=>closeOverlay('txOverlay'));
  $('btnCancel').addEventListener('click',()=>closeOverlay('txOverlay'));
  $('txOverlay').addEventListener('click',e=>{ if(e.target===$('txOverlay')) closeOverlay('txOverlay'); });

  // Delete modal
  $('delCancelBtn').addEventListener('click',()=>closeOverlay('delOverlay'));
  $('delOverlay').addEventListener('click',e=>{ if(e.target===$('delOverlay')) closeOverlay('delOverlay'); });
  $('delConfirmBtn').addEventListener('click', async ()=>{
    if(state.deleteId){ await Tx.delete(state.deleteId); state.deleteId=null; }
    closeOverlay('delOverlay');
  });

  // Form submit
  $('txForm').addEventListener('submit', async e=>{
    e.preventDefault();
    if (!validate()) return;
    const tx={
      amount:   parseFloat($('txAmount').value),
      type:     $('txType').value,
      category: $('txCategory').value,
      date:     $('txDate').value,
      description: $('txDesc').value.trim(),
    };
    if (state.editId) { await Tx.update(state.editId,tx); state.editId=null; }
    else await Tx.add(tx);
    closeOverlay('txOverlay');
  });

  // Clear form
  $('btnClearForm').addEventListener('click', clearForm);

  // Type switcher
  document.querySelectorAll('.tsw-btn').forEach(btn=>{
    btn.addEventListener('click',()=>setTypeSwitch(btn.dataset.type));
  });

  // Quick add chips
  document.querySelectorAll('.q-chip').forEach(btn=>{
    btn.addEventListener('click',()=>{
      $('txAmount').value=btn.dataset.amount;
      $('txType').value='expense';
      setTypeSwitch('expense');
      selectCat(btn.dataset.cat);
    });
  });

  // Filters
  ['searchInput','filterType','filterCategory','filterDateFrom','filterDateTo'].forEach(id=>{
    $(id)?.addEventListener('input',()=>{ state.filtered=[...state.transactions]; renderTable(); });
  });
  $('btnClearFilters').addEventListener('click',()=>{ Filters.clear(); renderTable(); });

  // Export
  $('btnExportCSV').addEventListener('click',()=>exportCSV(state.filtered.length?state.filtered:state.transactions));

  // Theme
  $('btnTheme').addEventListener('click',toggleTheme);

  // Hamburger
  $('hamburger').addEventListener('click',toggleMobileSidebar);
  $('sbOverlay').addEventListener('click',closeMobileSidebar);

  // Bar chart year change
  $('barChartYear').addEventListener('change',renderBar);

  // Budget save
  $('btnSaveBudgets').addEventListener('click', async ()=>{
    const newBudgets = {};
    CATEGORIES.filter(c=>!['salary','gifts'].includes(c.id)).forEach(cat=>{
      const inp=$(`budget_${cat.id}`);
      if (!inp) return;
      const v=parseFloat(inp.value);
      if (v>0) newBudgets[cat.id]=v;
    });
    try {
      const now = new Date();
      await window.ExpensioAPI.BudgetAPI.upsert(now.getMonth(), now.getFullYear(), newBudgets);
      state.budgets = newBudgets;
      renderBudgetProgress();
      toast('Budgets saved!','success');
    } catch (err) {
      toast(err.message || 'Failed to save budgets', 'error');
    }
  });

  // Logout
  $('btnLogout').addEventListener('click',()=>{
    Auth.logout();
    state.session = null;
    state.transactions = [];
    state.budgets = {};
    state.filtered = [];
    $('appScreen').classList.add('hidden');
    $('authScreen').classList.remove('hidden','leaving');
    $('authForm').reset();
    $('authError').textContent='';
    toast('Signed out successfully.','info');
  });

  // Admin panel
  $('adminExportAll')?.addEventListener('click',()=>exportCSV(state.transactions));
  $('adminResetAll')?.addEventListener('click',()=>{
    if (confirm('⚠️ This will permanently delete ALL data. Are you sure?')) { Store.reset(); }
  });
}

/* ──────────────────────────────────────
   27. INIT
────────────────────────────────────── */
function init() {
  // Load theme
  const savedTheme = localStorage.getItem(KEYS.THEME)||'dark';
  setTheme(savedTheme);

  // Always bind auth UI event listeners first
  setupAuthUI();

  // Check for existing session AND a JWT token
  const session = Auth.loadSession();
  const hasToken = window.ExpensioAPI && window.ExpensioAPI.Token.exists();

  if (session && hasToken) {
    state.session = session;
    startApp();
    return;
  }

  // Clear stale session if token is missing
  if (session && !hasToken) {
    localStorage.removeItem(KEYS.SESSION);
  }

  // Show login screen
  $('authScreen').classList.remove('hidden');
  $('appScreen').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', init);