const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`;
const getStore = (key, fallback = []) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
const setStore = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const page = document.body.dataset.page;

function initBase() {
  const themeBtn = $('#themeToggle');
  const savedTheme = localStorage.getItem('mtMateTheme');
  if (savedTheme === 'dark') document.body.classList.add('dark');
  if (themeBtn) {
    themeBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      localStorage.setItem('mtMateTheme', isDark ? 'dark' : 'light');
      themeBtn.textContent = isDark ? '☀️' : '🌙';
    });
  }
  $$('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    const current = location.pathname.split('/').pop() || 'index.html';
    if (href === current) link.classList.add('active');
  });
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// Participants
function initParticipants() {
  const key = 'mtParticipants';
  let participants = getStore(key);
  const form = $('#participantForm');
  const list = $('#participantTableBody');
  const search = $('#participantSearch');
  const filter = $('#depositFilter');

  function render() {
    const q = (search?.value || '').trim().toLowerCase();
    const f = filter?.value || 'all';
    const filtered = participants.filter(p => {
      const text = `${p.name} ${p.studentId} ${p.phone} ${p.note}`.toLowerCase();
      const matchesText = text.includes(q);
      const matchesFilter = f === 'all' || p.deposit === f;
      return matchesText && matchesFilter;
    });
    list.innerHTML = filtered.length ? filtered.map(p => `
      <tr>
        <td><strong>${p.name}</strong><br><span class="pill">${p.attend}</span></td>
        <td>${p.studentId || '-'}</td>
        <td>${p.phone || '-'}</td>
        <td><span class="pill ${p.deposit === 'paid' ? 'success' : 'danger'}">${p.deposit === 'paid' ? '입금 완료' : '미입금'}</span></td>
        <td>${p.note || '-'}</td>
        <td><button class="btn small danger" data-delete="${p.id}">삭제</button></td>
      </tr>
    `).join('') : `<tr><td colspan="6">등록된 참가자가 없습니다.</td></tr>`;

    $('#participantTotal').textContent = participants.length;
    $('#participantPaid').textContent = participants.filter(p => p.deposit === 'paid').length;
    $('#participantUnpaid').textContent = participants.filter(p => p.deposit === 'unpaid').length;
    $('#participantAttend').textContent = participants.filter(p => p.attend === '참석').length;
    setStore(key, participants);
  }

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name.trim()) return alert('이름을 입력해주세요.');
    participants.push({ id: uid(), ...data });
    form.reset();
    render();
  });
  list?.addEventListener('click', e => {
    const id = e.target.dataset.delete;
    if (id) { participants = participants.filter(p => p.id !== id); render(); }
  });
  search?.addEventListener('input', render);
  filter?.addEventListener('change', render);
  $('#exportParticipants')?.addEventListener('click', () => exportCSV('mt_participants.csv', participants));
  render();
}

function exportCSV(filename, rows) {
  if (!rows.length) return alert('내보낼 데이터가 없습니다.');
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Lodging
function initLodging() {
  const key = 'mtLodgings';
  let lodgings = getStore(key);
  const form = $('#lodgingForm');
  const list = $('#lodgingList');
  const regionFilter = $('#regionFilter');
  const sort = $('#lodgingSort');

  function total(l) {
    const extraPeople = Math.max(0, Number(l.expectedPeople) - Number(l.basePeople));
    return (Number(l.basePrice) + extraPeople * Number(l.extraFee)) * Math.max(1, Number(l.nights));
  }
  function render() {
    const regions = [...new Set(lodgings.map(l => l.region).filter(Boolean))];
    regionFilter.innerHTML = `<option value="all">전체 지역</option>` + regions.map(r => `<option value="${r}">${r}</option>`).join('');
    const selectedRegion = regionFilter.dataset.value || 'all';
    regionFilter.value = selectedRegion;

    let filtered = lodgings.filter(l => selectedRegion === 'all' || l.region === selectedRegion);
    if (sort.value === 'price') filtered.sort((a,b) => total(a) - total(b));
    if (sort.value === 'score') filtered.sort((a,b) => Number(b.score) - Number(a.score));
    if (sort.value === 'people') filtered.sort((a,b) => Number(b.expectedPeople) - Number(a.expectedPeople));

    list.innerHTML = filtered.length ? filtered.map(l => {
      const t = total(l);
      const per = Number(l.expectedPeople) ? Math.ceil(t / Number(l.expectedPeople)) : 0;
      return `
      <article class="item-card">
        <div class="item-top">
          <div>
            <h3>${l.name}</h3>
            <div class="meta">
              <span class="pill primary">${l.region}</span>
              <span class="pill">방 ${l.rooms || 0}개</span>
              <span class="pill">화장실 ${l.baths || 0}개</span>
              <span class="pill warning">점수 ${l.score || 0}/10</span>
            </div>
          </div>
          <button class="btn small danger" data-delete="${l.id}">삭제</button>
        </div>
        <p><strong>총 숙소비:</strong> ${money(t)} / <strong>1인당:</strong> ${money(per)}</p>
        <p><strong>계산:</strong> 기준 ${l.basePeople}명 ${money(l.basePrice)} + 추가 ${money(l.extraFee)} × 초과 인원 × ${l.nights}박</p>
        <p><strong>특징:</strong> ${l.features || '-'}</p>
        <p><strong>장점:</strong> ${l.pros || '-'} / <strong>단점:</strong> ${l.cons || '-'}</p>
        <p><strong>링크:</strong> ${l.link ? `<a href="${l.link}" target="_blank" rel="noreferrer">숙소 페이지 열기</a>` : '-'}</p>
      </article>`;
    }).join('') : '<p class="empty">숙소 후보를 추가해보세요.</p>';
    setStore(key, lodgings);
  }
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name || !data.region) return alert('숙소명과 지역을 입력해주세요.');
    lodgings.push({ id: uid(), ...data });
    form.reset();
    render();
  });
  list?.addEventListener('click', e => {
    const id = e.target.dataset.delete;
    if (id) { lodgings = lodgings.filter(l => l.id !== id); render(); }
  });
  regionFilter?.addEventListener('change', e => { regionFilter.dataset.value = e.target.value; render(); });
  sort?.addEventListener('change', render);
  render();
}

// Transport
function initTransport() {
  const key = 'mtTransport';
  let items = getStore(key);
  const form = $('#transportForm');
  const list = $('#transportList');
  function render() {
    list.innerHTML = items.length ? items.map(t => {
      const net = Math.max(0, Number(t.totalCost) - Number(t.supportCost || 0));
      const per = Number(t.people) ? Math.ceil(net / Number(t.people)) : 0;
      return `<article class="item-card">
        <div class="item-top"><h3>${t.method}</h3><button class="btn small danger" data-delete="${t.id}">삭제</button></div>
        <div class="meta"><span class="pill">${t.from} → ${t.to}</span><span class="pill">${t.people}명</span><span class="pill success">1인당 ${money(per)}</span></div>
        <p><strong>총 교통비:</strong> ${money(t.totalCost)} / <strong>지원금:</strong> ${money(t.supportCost)} / <strong>실부담:</strong> ${money(net)}</p>
        <p>${t.memo || ''}</p>
      </article>`;
    }).join('') : '<p class="empty">교통비 항목을 추가해보세요.</p>';
    $('#transportTotal').textContent = money(items.reduce((sum, t) => sum + Number(t.totalCost || 0), 0));
    $('#transportSupport').textContent = money(items.reduce((sum, t) => sum + Number(t.supportCost || 0), 0));
    setStore(key, items);
  }
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    items.push({ id: uid(), ...data });
    form.reset();
    render();
  });
  list?.addEventListener('click', e => {
    const id = e.target.dataset.delete;
    if (id) { items = items.filter(i => i.id !== id); render(); }
  });
  render();
}

// Schedule
function initSchedule() {
  const key = 'mtSchedule';
  let items = getStore(key);
  const form = $('#scheduleForm');
  const tbody = $('#scheduleTableBody');
  function render() {
    const sorted = [...items].sort((a,b) => `${a.day} ${a.start}`.localeCompare(`${b.day} ${b.start}`));
    tbody.innerHTML = sorted.length ? sorted.map(s => `<tr>
      <td><strong>${s.day}</strong><br>${s.start} - ${s.end}</td>
      <td>${s.title}</td><td>${s.place || '-'}</td><td>${s.owner || '-'}</td><td>${s.supplies || '-'}</td><td>${s.memo || '-'}</td>
      <td><button class="btn small danger" data-delete="${s.id}">삭제</button></td>
    </tr>`).join('') : '<tr><td colspan="7">등록된 일정이 없습니다.</td></tr>';
    setStore(key, items);
  }
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.day || !data.start || !data.title) return alert('날짜, 시작 시간, 일정 제목은 꼭 입력해주세요.');
    items.push({ id: uid(), ...data });
    form.reset();
    render();
  });
  tbody?.addEventListener('click', e => {
    const id = e.target.dataset.delete;
    if (id) { items = items.filter(i => i.id !== id); render(); }
  });
  $('#printSchedule')?.addEventListener('click', () => window.print());
  render();
}

// Budget
function initBudget() {
  const key = 'mtFoodItems';
  let foods = getStore(key);
  const foodForm = $('#foodForm');
  const foodList = $('#foodList');
  const inputs = $$('.budget-input');

  function calc() {
    const people = Number($('#budgetPeople').value || 0);
    const base = Number($('#lodgingBase').value || 0);
    const basePeople = Number($('#lodgingBasePeople').value || 0);
    const extraFee = Number($('#lodgingExtraFee').value || 0);
    const actualPeople = Number($('#lodgingActualPeople').value || people || 0);
    const nights = Number($('#lodgingNights').value || 1);
    const extraPeople = Math.max(0, actualPeople - basePeople);
    const lodgingTotal = (base + extraPeople * extraFee) * nights;
    const transport = Number($('#budgetTransport').value || 0);
    const foodTotal = foods.reduce((sum, f) => sum + Number(f.cost || 0), 0);
    const game = Number($('#budgetGame').value || 0);
    const emergency = Number($('#budgetEmergency').value || 0);
    const etc = Number($('#budgetEtc').value || 0);
    const total = lodgingTotal + transport + foodTotal + game + emergency + etc;
    $('#calcLodging').textContent = money(lodgingTotal);
    $('#calcFood').textContent = money(foodTotal);
    $('#calcTotal').textContent = money(total);
    $('#calcPerPerson').textContent = people ? money(Math.ceil(total / people)) : '0원';
  }
  function renderFoods() {
    foodList.innerHTML = foods.length ? foods.map(f => `<article class="item-card">
      <div class="item-top"><h3>${f.name}</h3><button class="btn small danger" data-delete="${f.id}">삭제</button></div>
      <div class="meta"><span class="pill">${f.category}</span><span class="pill success">${money(f.cost)}</span></div>
      <p>${f.memo || ''}</p>
    </article>`).join('') : '<p class="empty">식비/장보기 항목을 추가해보세요.</p>';
    setStore(key, foods);
    calc();
  }
  foodForm?.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(foodForm).entries());
    foods.push({ id: uid(), ...data });
    foodForm.reset();
    renderFoods();
  });
  foodList?.addEventListener('click', e => {
    const id = e.target.dataset.delete;
    if (id) { foods = foods.filter(f => f.id !== id); renderFoods(); }
  });
  inputs.forEach(input => input.addEventListener('input', calc));
  renderFoods();
}

// Checklist
function initChecklist() {
  const key = 'mtChecklist';
  let items = getStore(key);
  const form = $('#checklistForm');
  const list = $('#checklistList');
  function render() {
    const done = items.filter(i => i.done).length;
    const percent = items.length ? Math.round(done / items.length * 100) : 0;
    $('#checkProgressText').textContent = `${done}/${items.length} 완료 (${percent}%)`;
    $('#checkProgressFill').style.width = `${percent}%`;
    list.innerHTML = items.length ? items.map(i => `<article class="item-card">
      <div class="item-top">
        <div><h3 style="text-decoration:${i.done ? 'line-through' : 'none'}">${i.item}</h3><div class="meta"><span class="pill">${i.category}</span><span class="pill">담당: ${i.owner || '-'}</span></div></div>
        <div><button class="btn small ${i.done ? 'secondary' : 'success'}" data-toggle="${i.id}">${i.done ? '취소' : '완료'}</button> <button class="btn small danger" data-delete="${i.id}">삭제</button></div>
      </div>
    </article>`).join('') : '<p class="empty">준비물을 추가해보세요.</p>';
    setStore(key, items);
  }
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    items.push({ id: uid(), done: false, ...data });
    form.reset();
    render();
  });
  list?.addEventListener('click', e => {
    const del = e.target.dataset.delete;
    const tog = e.target.dataset.toggle;
    if (del) items = items.filter(i => i.id !== del);
    if (tog) items = items.map(i => i.id === tog ? { ...i, done: !i.done } : i);
    render();
  });
  render();
}

// Roles
function initRoles() {
  const key = 'mtRoles';
  let items = getStore(key);
  const form = $('#roleForm');
  const list = $('#roleList');
  function render() {
    list.innerHTML = items.length ? items.map(r => `<article class="item-card">
      <div class="item-top"><h3>${r.name} - ${r.role}</h3><button class="btn small danger" data-delete="${r.id}">삭제</button></div>
      <div class="meta"><span class="pill">마감: ${r.due || '-'}</span><span class="pill ${r.status === '완료' ? 'success' : 'warning'}">${r.status}</span></div>
      <p>${r.task || ''}</p>
    </article>`).join('') : '<p class="empty">역할을 추가해보세요.</p>';
    setStore(key, items);
  }
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    items.push({ id: uid(), ...data });
    form.reset();
    render();
  });
  list?.addEventListener('click', e => {
    const id = e.target.dataset.delete;
    if (id) { items = items.filter(i => i.id !== id); render(); }
  });
  render();
}

// Games
const gameData = [
  { id:'charades', name:'몸으로 말해요', tags:['실내','팀전','대규모','준비물 적음'], people:'6명 이상', time:'15~20분', level:'쉬움', supplies:'제시어 카드, 타이머', rule:'팀원이 제시어를 몸짓만으로 설명하고 같은 팀이 제한 시간 안에 맞히는 게임입니다.', how:'팀을 나누고 60초 동안 최대한 많은 제시어를 맞힙니다. 말소리와 입모양 힌트는 금지합니다.', tip:'학교 생활, 전공, 교수님 말투, MT 내부 밈을 제시어로 넣으면 반응이 훨씬 좋아집니다.', caution:'너무 어려운 단어만 넣으면 분위기가 처질 수 있어 쉬운 단어와 어려운 단어를 섞는 것이 좋습니다.' },
  { id:'music', name:'노래 1초 듣고 맞히기', tags:['실내','팀전','대규모','준비물 적음'], people:'8명 이상', time:'20분', level:'보통', supplies:'스피커, 노래 리스트', rule:'노래 앞부분을 짧게 듣고 제목이나 가수를 맞히는 게임입니다.', how:'진행자가 1~3초만 재생하고 팀별로 손을 들어 정답을 맞힙니다.', tip:'최신곡, 추억곡, 밈 노래를 섞으면 세대 차이 없이 웃기게 진행됩니다.', caution:'음량이 너무 크면 민원이 생길 수 있으니 숙소 규칙을 확인해야 합니다.' },
  { id:'initial', name:'초성 퀴즈', tags:['실내','팀전','준비물 적음','소규모'], people:'4명 이상', time:'15분', level:'쉬움', supplies:'초성 문제 리스트', rule:'초성만 보고 단어를 맞히는 게임입니다.', how:'카테고리를 정하고 초성을 공개한 뒤 가장 빨리 맞힌 팀에게 점수를 줍니다.', tip:'학과명, 수업명, 학생회 용어를 넣으면 MT 맞춤형 게임이 됩니다.', caution:'너무 개인적인 별명이나 민감한 주제는 피하는 것이 좋습니다.' },
  { id:'relayDraw', name:'릴레이 그림 맞히기', tags:['실내','팀전','대규모'], people:'6명 이상', time:'20~30분', level:'보통', supplies:'종이, 펜, 제시어', rule:'앞 사람이 그린 그림을 보고 다음 사람이 이어서 그린 뒤 마지막 사람이 정답을 맞힙니다.', how:'팀별로 줄을 세우고 제시어를 본 첫 사람이 그림을 그린 뒤 릴레이로 전달합니다.', tip:'그림을 못 그릴수록 더 웃긴 장면이 많이 나옵니다.', caution:'시간 제한을 명확히 해야 진행이 늘어지지 않습니다.' },
  { id:'bingo', name:'친해지기 빙고', tags:['실내','아이스브레이킹','소규모','대규모'], people:'10명 이상', time:'20분', level:'쉬움', supplies:'빙고 종이, 펜', rule:'빙고 칸에 적힌 조건에 맞는 사람을 찾아 이름을 받는 게임입니다.', how:'예: 같은 지역 출신, 같은 취미, 같은 수업을 듣는 사람 등을 찾아 칸을 채웁니다.', tip:'처음 만난 사람끼리 대화하기 좋아 MT 초반에 배치하면 좋습니다.', caution:'민감한 개인정보를 묻는 조건은 넣지 않는 것이 좋습니다.' },
  { id:'mission', name:'팀별 미션 레이스', tags:['야외','팀전','활동적','대규모'], people:'10명 이상', time:'30~60분', level:'보통', supplies:'미션 카드, 점수표', rule:'팀별로 여러 미션을 수행하고 점수를 얻는 게임입니다.', how:'사진 찍기, 물건 찾기, 퀴즈 풀기 등 미션을 정해 제한 시간 안에 완료합니다.', tip:'숙소 주변 공간을 활용하면 이동감이 생겨 더 재밌습니다.', caution:'야외 진행 시 안전, 이동 동선, 날씨를 꼭 고려해야 합니다.' }
];
function initGames() {
  const list = $('#gameList');
  const selectedList = $('#selectedGameList');
  const filter = $('#gameFilter');
  const modal = $('#gameModal');
  const selectedKey = 'mtSelectedGames';
  let selected = getStore(selectedKey);
  function renderGames() {
    const f = filter.value;
    const games = f === '전체' ? gameData : gameData.filter(g => g.tags.includes(f));
    list.innerHTML = games.map(g => `<article class="card game-card" data-game="${g.id}">
      <h3>${g.name}</h3>
      <p>${g.rule}</p>
      <div class="meta"><span class="pill">${g.people}</span><span class="pill">${g.time}</span><span class="pill">${g.level}</span></div>
      <div class="meta">${g.tags.map(t => `<span class="pill primary">${t}</span>`).join('')}</div>
    </article>`).join('');
  }
  function renderSelected() {
    selectedList.innerHTML = selected.length ? selected.map(id => {
      const g = gameData.find(x => x.id === id);
      return `<article class="item-card"><div class="item-top"><h3>${g?.name || id}</h3><button class="btn small danger" data-remove-game="${id}">삭제</button></div></article>`;
    }).join('') : '<p class="empty">선택한 게임이 없습니다.</p>';
    setStore(selectedKey, selected);
  }
  list?.addEventListener('click', e => {
    const card = e.target.closest('[data-game]');
    if (!card) return;
    const g = gameData.find(x => x.id === card.dataset.game);
    $('#modalBody').innerHTML = `<div class="modal-head"><div><h2>${g.name}</h2><div class="meta"><span class="pill">${g.people}</span><span class="pill">${g.time}</span><span class="pill">${g.level}</span></div></div><button class="close-modal">닫기</button></div>
      <p><strong>준비물:</strong> ${g.supplies}</p><p><strong>규칙:</strong> ${g.rule}</p><p><strong>진행 방법:</strong> ${g.how}</p><p><strong>더 재밌게 하는 방법:</strong> ${g.tip}</p><p><strong>주의할 점:</strong> ${g.caution}</p>
      <button class="btn" data-add-game="${g.id}">선택한 게임에 추가</button>`;
    modal.classList.add('open');
  });
  modal?.addEventListener('click', e => {
    if (e.target === modal || e.target.classList.contains('close-modal')) modal.classList.remove('open');
    const id = e.target.dataset.addGame;
    if (id && !selected.includes(id)) { selected.push(id); renderSelected(); modal.classList.remove('open'); }
  });
  selectedList?.addEventListener('click', e => {
    const id = e.target.dataset.removeGame;
    if (id) { selected = selected.filter(x => x !== id); renderSelected(); }
  });
  filter?.addEventListener('change', renderGames);
  renderGames();
  renderSelected();
}

initBase();
if (page === 'participants') initParticipants();
if (page === 'lodging') initLodging();
if (page === 'transport') initTransport();
if (page === 'schedule') initSchedule();
if (page === 'budget') initBudget();
if (page === 'checklist') initChecklist();
if (page === 'roles') initRoles();
if (page === 'games') initGames();
