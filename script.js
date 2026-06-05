const STORAGE_KEY = 'mtMatePlanner_excel_v1';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`;
const num = (v) => Number(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;
const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const regions = [
  '대부도', '가평', '경주', '강화도', '영종도', '양평', '홍천', '춘천', '강릉', '속초', '양양', '부산', '전주', '인천', '수원', '용인', '파주', '포천', '태안', '안면도', '제주', '기타'
];

const defaultGames = [
  { id: uid(), selected: '후보', name: '몸으로 말해요', people: '6명 이상', time: '15~20분', supplies: '제시어, 타이머', rules: '말 없이 몸짓만으로 제시어를 설명하고 팀원이 맞히는 게임', tips: '학과 밈, 교수님 말투, MT 상황 제시어를 섞으면 반응이 좋음', caution: '너무 어려운 단어만 넣지 않기' },
  { id: uid(), selected: '후보', name: '음악 맞히기', people: '전체 가능', time: '15분', supplies: '스피커, 플레이리스트', rules: '노래 앞부분을 듣고 제목이나 가수를 맞히는 게임', tips: '세대별 노래와 요즘 유행곡을 섞으면 모두 참여하기 쉬움', caution: '음량과 저작권 영상 재생 환경 확인' },
  { id: uid(), selected: '후보', name: '초성 퀴즈', people: '소규모/대규모', time: '10~15분', supplies: '문제 화면 또는 카드', rules: '초성만 보고 단어를 맞히는 게임', tips: '학교, 전공, 동아리 관련 문제를 넣으면 몰입도가 올라감', caution: '특정 사람을 놀리는 문제는 피하기' },
  { id: uid(), selected: '후보', name: '릴레이 그림 맞히기', people: '팀전', time: '20분', supplies: '종이, 펜', rules: '앞 사람이 본 단어를 그림으로 전달하고 마지막 사람이 정답을 맞힘', tips: '그림 실력 차이가 웃음 포인트가 되도록 쉬운 제시어부터 시작', caution: '공간과 책상 확보 필요' }
];

const initialState = () => ({
  eventName: 'AI·SW 계열 MT',
  eventType: 'department',
  showStudentId: true,
  theme: 'light',
  activeRegion: '전체',
  recentRegions: [],
  selectedLodgingId: null,
  participants: [],
  lodgings: [],
  transport: [],
  food: [],
  budget: [
    { id: uid(), name: '게임 준비비', amount: 0, memo: '' },
    { id: uid(), name: '예비비', amount: 0, memo: '' },
    { id: uid(), name: '기타 비용', amount: 0, memo: '' }
  ],
  schedule: [],
  games: defaultGames,
  trash: []
});

let state = load();
let toastTimer;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return initialState();
    return { ...initialState(), ...saved };
  } catch {
    return initialState();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1700);
}

function setTab(tabName) {
  $$('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  $$('.tab-page').forEach(page => page.classList.toggle('active', page.id === tabName));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function input(table, id, field, value, type = 'text', extra = '') {
  return `<input ${extra} type="${type}" value="${escapeHtml(value)}" data-table="${table}" data-id="${id}" data-field="${field}">`;
}

function textarea(table, id, field, value) {
  return `<textarea data-table="${table}" data-id="${id}" data-field="${field}">${escapeHtml(value)}</textarea>`;
}

function select(table, id, field, value, options) {
  return `<select data-table="${table}" data-id="${id}" data-field="${field}">${options.map(op => `<option value="${escapeHtml(op)}" ${op === value ? 'selected' : ''}>${escapeHtml(op)}</option>`).join('')}</select>`;
}

function deleteBtn(table, id) {
  return `<button class="btn danger" data-delete="${table}" data-id="${id}">삭제</button>`;
}

function updateField(table, id, field, value) {
  const item = state[table].find(row => row.id === id);
  if (!item) return;
  item[field] = value;
  if (table === 'lodgings' && field === 'region') pushRecentRegion(value);
  save();
  renderAll();
}

function pushRecentRegion(region) {
  if (!region || region === '전체') return;
  state.recentRegions = [region, ...state.recentRegions.filter(r => r !== region)].slice(0, 3);
}

function moveToTrash(table, id) {
  const rows = state[table];
  const index = rows.findIndex(row => row.id === id);
  if (index === -1) return;
  const [removed] = rows.splice(index, 1);
  state.trash.unshift({ id: uid(), table, item: removed, deletedAt: new Date().toLocaleString('ko-KR') });
  if (state.selectedLodgingId === id) state.selectedLodgingId = null;
  save();
  renderAll();
  toast('삭제했어요. 휴지통에서 복구할 수 있어요.');
}

function restoreTrash(trashId) {
  const index = state.trash.findIndex(t => t.id === trashId);
  if (index === -1) return;
  const [entry] = state.trash.splice(index, 1);
  state[entry.table].push(entry.item);
  save();
  renderAll();
  toast('복구했어요.');
}

function lodgingTotal(row) {
  const base = num(row.basePrice);
  const basePeople = num(row.basePeople);
  const expected = num(row.expectedPeople);
  const extraFee = num(row.extraFee);
  const nights = Math.max(1, num(row.nights) || 1);
  const extraPeople = Math.max(0, expected - basePeople);
  return (base + extraPeople * extraFee) * nights;
}

function transportNet(row) {
  return Math.max(0, num(row.totalCost) - num(row.supportAmount));
}

function foodTotal(row) {
  return num(row.quantity) * num(row.unitPrice);
}

function attendingCount() {
  return state.participants.filter(p => p.attendance === '참석').length;
}

function selectedLodging() {
  return state.lodgings.find(l => l.id === state.selectedLodgingId) || null;
}

function summary() {
  const attend = attendingCount();
  const paidPeople = state.participants.filter(p => p.paid === '입금완료').length;
  const paidAmount = state.participants.reduce((sum, p) => sum + (p.paid === '입금완료' ? num(p.amount) : 0), 0);
  const lodging = selectedLodging();
  const lodgingCost = lodging ? lodgingTotal(lodging) : 0;
  const transportCost = state.transport.reduce((sum, t) => sum + transportNet(t), 0);
  const foodCost = state.food.reduce((sum, f) => sum + foodTotal(f), 0);
  const extraCost = state.budget.reduce((sum, b) => sum + num(b.amount), 0);
  const total = lodgingCost + transportCost + foodCost + extraCost;
  return { attend, paidPeople, paidAmount, unpaidPeople: Math.max(0, attend - paidPeople), lodging, lodgingCost, transportCost, foodCost, extraCost, total, perPerson: attend ? Math.ceil(total / attend) : 0 };
}

function renderSummaryCards() {
  const s = summary();
  $('#summaryCards').innerHTML = [
    ['참석 예정', `${s.attend}명`],
    ['입금 완료', `${s.paidPeople}명`],
    ['미입금', `${s.unpaidPeople}명`],
    ['예상 1인당 비용', won(s.perPerson)]
  ].map(([label, value]) => `<article class="stat-card"><span>${label}</span><b>${value}</b></article>`).join('');

  $('#quickCheckList').innerHTML = [
    s.lodging ? `선택 숙소: ${escapeHtml(s.lodging.name)} / ${won(s.lodgingCost)}` : '아직 대표 숙소가 선택되지 않았어요.',
    s.unpaidPeople ? `미입금 인원 ${s.unpaidPeople}명 확인 필요` : '현재 참석자 기준 입금 확인 완료',
    state.schedule.length ? `일정 ${state.schedule.length}개 등록됨` : '아직 일정표가 비어 있어요.',
    state.games.filter(g => g.selected === '선택').length ? `선택된 게임 ${state.games.filter(g => g.selected === '선택').length}개` : '게임 후보 중 실제 진행 게임을 선택해두면 좋아요.'
  ].map(text => `<li>${text}</li>`).join('');
}

function renderProjectBox() {
  $('#eventName').value = state.eventName;
  $('#eventType').value = state.eventType;
  $('#showStudentId').checked = state.showStudentId;
}

function renderParticipants() {
  const showId = state.showStudentId;
  const header = `<tr><th>이름</th><th class="${showId ? '' : 'hidden-col'}">학번</th><th>연락처</th><th>참석</th><th>입금 여부</th><th>입금액</th><th>메모</th><th>관리</th></tr>`;
  const rows = state.participants.map(p => `
    <tr>
      <td>${input('participants', p.id, 'name', p.name)}</td>
      <td class="${showId ? '' : 'hidden-col'}">${input('participants', p.id, 'studentId', p.studentId)}</td>
      <td>${input('participants', p.id, 'phone', p.phone)}</td>
      <td>${select('participants', p.id, 'attendance', p.attendance, ['참석', '불참', '미정'])}</td>
      <td>${select('participants', p.id, 'paid', p.paid, ['미입금', '입금완료', '환불필요'])}</td>
      <td>${input('participants', p.id, 'amount', p.amount, 'number')}</td>
      <td>${input('participants', p.id, 'memo', p.memo)}</td>
      <td>${deleteBtn('participants', p.id)}</td>
    </tr>`).join('');
  $('#participantsTable').innerHTML = header + rows;
}

function renderRegionSelect() {
  $('#regionSelect').innerHTML = regions.map(r => `<option value="${r}" ${state.activeRegion === r ? 'selected' : ''}>${r}</option>`).join('');
  $('#recentRegions').innerHTML = state.recentRegions.length
    ? state.recentRegions.map(r => `<button class="chip" data-region-chip="${r}">${r}</button>`).join('')
    : '<span class="mini-help">아직 없음</span>';
}

function renderLodgings() {
  const list = state.activeRegion && state.activeRegion !== '전체'
    ? state.lodgings.filter(l => l.region === state.activeRegion)
    : state.lodgings;
  const header = `<tr><th>대표</th><th>지역</th><th>숙소명</th><th>링크</th><th>최대</th><th>기준인원</th><th>기준가(1박)</th><th>추가금/인</th><th>예상인원</th><th>박수</th><th>총 숙소비</th><th>1인당</th><th>추가정보</th><th>관리</th></tr>`;
  const rows = list.map(l => {
    const total = lodgingTotal(l);
    const per = num(l.expectedPeople) ? Math.ceil(total / num(l.expectedPeople)) : 0;
    const detail = l.open ? `<tr class="detail-row"><td colspan="14"><div class="detail-grid">
      <label>방 개수 ${input('lodgings', l.id, 'rooms', l.rooms)}</label>
      <label>화장실 ${input('lodgings', l.id, 'bathrooms', l.bathrooms)}</label>
      <label>시설 ${input('lodgings', l.id, 'facilities', l.facilities)}</label>
      <label>메모 ${input('lodgings', l.id, 'memo', l.memo)}</label>
    </div></td></tr>` : '';
    return `<tr>
      <td><input type="radio" name="selectedLodging" ${state.selectedLodgingId === l.id ? 'checked' : ''} data-select-lodging="${l.id}"></td>
      <td>${select('lodgings', l.id, 'region', l.region, regions)}</td>
      <td>${input('lodgings', l.id, 'name', l.name)}</td>
      <td>${input('lodgings', l.id, 'link', l.link, 'url', 'placeholder="https://"')}</td>
      <td>${input('lodgings', l.id, 'maxPeople', l.maxPeople, 'number')}</td>
      <td>${input('lodgings', l.id, 'basePeople', l.basePeople, 'number')}</td>
      <td>${input('lodgings', l.id, 'basePrice', l.basePrice, 'number')}</td>
      <td>${input('lodgings', l.id, 'extraFee', l.extraFee, 'number')}</td>
      <td>${input('lodgings', l.id, 'expectedPeople', l.expectedPeople, 'number')}</td>
      <td>${input('lodgings', l.id, 'nights', l.nights, 'number')}</td>
      <td class="calc-cell">${won(total)}</td>
      <td class="calc-cell">${won(per)}</td>
      <td><button class="btn ghost" data-toggle-detail="${l.id}">${l.open ? '닫기' : '열기'}</button></td>
      <td>${deleteBtn('lodgings', l.id)}</td>
    </tr>${detail}`;
  }).join('');
  $('#lodgingsTable').innerHTML = header + rows;
}

function renderTransport() {
  const header = `<tr><th>방식</th><th>출발/도착</th><th>인원</th><th>총 교통비</th><th>지원금</th><th>실부담</th><th>1인당</th><th>메모</th><th>관리</th></tr>`;
  const rows = state.transport.map(t => {
    const net = transportNet(t);
    const per = num(t.people) ? Math.ceil(net / num(t.people)) : 0;
    return `<tr>
      <td>${select('transport', t.id, 'method', t.method, ['개별 이동', '택시비 지원', '버스 대절', '기차/고속버스', '기타'])}</td>
      <td>${input('transport', t.id, 'route', t.route)}</td>
      <td>${input('transport', t.id, 'people', t.people, 'number')}</td>
      <td>${input('transport', t.id, 'totalCost', t.totalCost, 'number')}</td>
      <td>${input('transport', t.id, 'supportAmount', t.supportAmount, 'number')}</td>
      <td class="calc-cell">${won(net)}</td>
      <td class="calc-cell">${won(per)}</td>
      <td>${input('transport', t.id, 'memo', t.memo)}</td>
      <td>${deleteBtn('transport', t.id)}</td>
    </tr>`;
  }).join('');
  $('#transportTable').innerHTML = header + rows;
}

function renderBudget() {
  const s = summary();
  $('#budgetCards').innerHTML = [
    ['선택 숙소비', won(s.lodgingCost)],
    ['교통 실부담', won(s.transportCost)],
    ['음식/식비', won(s.foodCost)],
    ['총 예상 금액', won(s.total)]
  ].map(([label, value]) => `<article class="stat-card"><span>${label}</span><b>${value}</b></article>`).join('');

  $('#foodTable').innerHTML = `<tr><th>음식/메뉴</th><th>수량</th><th>단가</th><th>합계</th><th>메모</th><th>관리</th></tr>` + state.food.map(f => `
    <tr>
      <td>${input('food', f.id, 'name', f.name)}</td>
      <td>${input('food', f.id, 'quantity', f.quantity, 'number')}</td>
      <td>${input('food', f.id, 'unitPrice', f.unitPrice, 'number')}</td>
      <td class="calc-cell">${won(foodTotal(f))}</td>
      <td>${input('food', f.id, 'memo', f.memo)}</td>
      <td>${deleteBtn('food', f.id)}</td>
    </tr>`).join('');

  $('#budgetTable').innerHTML = `<tr><th>항목</th><th>금액</th><th>메모</th><th>관리</th></tr>` + state.budget.map(b => `
    <tr>
      <td>${input('budget', b.id, 'name', b.name)}</td>
      <td>${input('budget', b.id, 'amount', b.amount, 'number')}</td>
      <td>${input('budget', b.id, 'memo', b.memo)}</td>
      <td>${deleteBtn('budget', b.id)}</td>
    </tr>`).join('');
}

function renderSchedule() {
  const rows = [...state.schedule].sort((a, b) => `${a.day}${a.start}`.localeCompare(`${b.day}${b.start}`));
  $('#scheduleTable').innerHTML = `<tr><th>날짜/일차</th><th>시작</th><th>종료</th><th>일정</th><th>장소</th><th>담당</th><th>준비물</th><th>메모</th><th>관리</th></tr>` + rows.map(s => `
    <tr>
      <td>${input('schedule', s.id, 'day', s.day)}</td>
      <td>${input('schedule', s.id, 'start', s.start, 'time')}</td>
      <td>${input('schedule', s.id, 'end', s.end, 'time')}</td>
      <td>${input('schedule', s.id, 'title', s.title)}</td>
      <td>${input('schedule', s.id, 'place', s.place)}</td>
      <td>${input('schedule', s.id, 'manager', s.manager)}</td>
      <td>${input('schedule', s.id, 'supplies', s.supplies)}</td>
      <td>${input('schedule', s.id, 'memo', s.memo)}</td>
      <td>${deleteBtn('schedule', s.id)}</td>
    </tr>`).join('');
}

function renderGames() {
  $('#gamesTable').innerHTML = `<tr><th>상태</th><th>게임명</th><th>인원</th><th>시간</th><th>준비물</th><th>룰 요약</th><th>더 재밌게 하는 방법</th><th>주의점</th><th>관리</th></tr>` + state.games.map(g => `
    <tr>
      <td>${select('games', g.id, 'selected', g.selected, ['후보', '선택', '보류'])}</td>
      <td>${input('games', g.id, 'name', g.name)}</td>
      <td>${input('games', g.id, 'people', g.people)}</td>
      <td>${input('games', g.id, 'time', g.time)}</td>
      <td>${input('games', g.id, 'supplies', g.supplies)}</td>
      <td>${textarea('games', g.id, 'rules', g.rules)}</td>
      <td>${textarea('games', g.id, 'tips', g.tips)}</td>
      <td>${textarea('games', g.id, 'caution', g.caution)}</td>
      <td>${deleteBtn('games', g.id)}</td>
    </tr>`).join('');
}

function renderBackup() {
  $('#trashList').innerHTML = state.trash.length ? state.trash.map(t => `
    <div class="trash-item">
      <div><b>${t.table}</b><br><span class="mini-help">${escapeHtml(t.item.name || t.item.title || t.item.route || '삭제 항목')} · ${t.deletedAt}</span></div>
      <button class="btn ghost" data-restore="${t.id}">복구</button>
    </div>`).join('') : '<p class="mini-help">휴지통이 비어 있어요.</p>';
  $('#summaryText').value = buildSummaryText();
}

function buildSummaryText() {
  const s = summary();
  const unpaid = state.participants.filter(p => p.attendance === '참석' && p.paid !== '입금완료').map(p => p.name).filter(Boolean).join(', ') || '없음';
  const games = state.games.filter(g => g.selected === '선택').map(g => g.name).join(', ') || '미정';
  return `[${state.eventName || 'MT'} 준비 요약]\n\n참석 예정: ${s.attend}명\n입금 완료: ${s.paidPeople}명\n미입금: ${s.unpaidPeople}명 (${unpaid})\n입금 확인액: ${won(s.paidAmount)}\n\n선택 숙소: ${s.lodging ? `${s.lodging.region} / ${s.lodging.name}` : '미정'}\n숙소비: ${won(s.lodgingCost)}\n교통비: ${won(s.transportCost)}\n음식/식비: ${won(s.foodCost)}\n기타 예산: ${won(s.extraCost)}\n총 예상 금액: ${won(s.total)}\n1인당 예상 금액: ${won(s.perPerson)}\n\n선택 게임: ${games}\n일정 개수: ${state.schedule.length}개`;
}

function renderAll() {
  document.body.classList.toggle('dark', state.theme === 'dark');
  $('#themeBtn').textContent = state.theme === 'dark' ? '☀️' : '🌙';
  renderProjectBox();
  renderSummaryCards();
  renderParticipants();
  renderRegionSelect();
  renderLodgings();
  renderTransport();
  renderBudget();
  renderSchedule();
  renderGames();
  renderBackup();
}

function addRow(table, row) {
  state[table].push({ id: uid(), ...row });
  save();
  renderAll();
}

function tableData(table) {
  if (table === 'participants') return state.participants.map(p => ({ 이름: p.name, 학번: state.showStudentId ? p.studentId : '', 연락처: p.phone, 참석: p.attendance, 입금여부: p.paid, 입금액: p.amount, 메모: p.memo }));
  if (table === 'lodgings') return state.lodgings.map(l => ({ 대표숙소: state.selectedLodgingId === l.id ? 'Y' : '', 지역: l.region, 숙소명: l.name, 링크: l.link, 최대인원: l.maxPeople, 기준인원: l.basePeople, 기준가_1박: l.basePrice, 추가금_1인: l.extraFee, 예상인원: l.expectedPeople, 박수: l.nights, 총숙소비: lodgingTotal(l), 일인당: num(l.expectedPeople) ? Math.ceil(lodgingTotal(l) / num(l.expectedPeople)) : 0, 방개수: l.rooms, 화장실: l.bathrooms, 시설: l.facilities, 메모: l.memo }));
  if (table === 'transport') return state.transport.map(t => ({ 방식: t.method, 출발도착: t.route, 인원: t.people, 총교통비: t.totalCost, 지원금: t.supportAmount, 실부담: transportNet(t), 일인당: num(t.people) ? Math.ceil(transportNet(t) / num(t.people)) : 0, 메모: t.memo }));
  if (table === 'budget') {
    const s = summary();
    return [
      { 항목: '선택 숙소비', 금액: s.lodgingCost, 메모: s.lodging ? s.lodging.name : '미정' },
      { 항목: '교통 실부담', 금액: s.transportCost, 메모: '' },
      { 항목: '음식/식비', 금액: s.foodCost, 메모: '' },
      ...state.budget.map(b => ({ 항목: b.name, 금액: b.amount, 메모: b.memo })),
      { 항목: '총 예상 금액', 금액: s.total, 메모: `1인당 ${won(s.perPerson)}` }
    ];
  }
  if (table === 'schedule') return [...state.schedule].sort((a,b)=>`${a.day}${a.start}`.localeCompare(`${b.day}${b.start}`)).map(s => ({ 날짜: s.day, 시작: s.start, 종료: s.end, 일정: s.title, 장소: s.place, 담당: s.manager, 준비물: s.supplies, 메모: s.memo }));
  if (table === 'games') return state.games.map(g => ({ 상태: g.selected, 게임명: g.name, 인원: g.people, 시간: g.time, 준비물: g.supplies, 룰요약: g.rules, 더재밌게하는방법: g.tips, 주의점: g.caution }));
  return [];
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(row => headers.map(h => esc(row[h])).join(','))].join('\n');
}

function download(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(table) {
  const csv = '\ufeff' + toCsv(tableData(table));
  download(`${state.eventName || 'mt'}_${table}.csv`, csv, 'text/csv;charset=utf-8');
}

async function copyTable(table) {
  const rows = tableData(table);
  if (!rows.length) return toast('복사할 내용이 없어요.');
  const headers = Object.keys(rows[0]);
  const text = [headers.join('\t'), ...rows.map(row => headers.map(h => row[h] ?? '').join('\t'))].join('\n');
  await navigator.clipboard.writeText(text);
  toast('엑셀에 붙여넣기 좋은 표 형태로 복사했어요.');
}

function addSampleData() {
  state.participants = [
    { id: uid(), name: '김하나', studentId: '20250001', phone: '010-0000-0000', attendance: '참석', paid: '입금완료', amount: 50000, memo: '' },
    { id: uid(), name: '이두리', studentId: '20250002', phone: '010-1111-1111', attendance: '참석', paid: '미입금', amount: 0, memo: '확인 필요' },
    { id: uid(), name: '박세나', studentId: '20250003', phone: '010-2222-2222', attendance: '미정', paid: '미입금', amount: 0, memo: '' }
  ];
  state.lodgings = [
    { id: uid(), region: '대부도', name: '대부도 단체 펜션 A', link: 'https://example.com', maxPeople: 40, basePeople: 20, basePrice: 650000, extraFee: 20000, expectedPeople: 32, nights: 1, rooms: '', bathrooms: '', facilities: '', memo: '', open: false },
    { id: uid(), region: '가평', name: '가평 워크샵 펜션 B', link: 'https://example.com', maxPeople: 35, basePeople: 25, basePrice: 720000, extraFee: 15000, expectedPeople: 32, nights: 1, rooms: '', bathrooms: '', facilities: '', memo: '', open: false }
  ];
  state.selectedLodgingId = state.lodgings[0].id;
  state.recentRegions = ['대부도', '가평'];
  state.transport = [{ id: uid(), method: '버스 대절', route: '학교 ↔ 숙소', people: 32, totalCost: 600000, supportAmount: 0, memo: '견적 확인 필요' }];
  state.food = [{ id: uid(), name: '바베큐 고기', quantity: 32, unitPrice: 12000, memo: '1인 기준' }];
  state.schedule = [
    { id: uid(), day: '1일차', start: '15:00', end: '16:00', title: '숙소 입실 및 인원 체크', place: '숙소', manager: '문화국', supplies: '명단', memo: '' },
    { id: uid(), day: '1일차', start: '19:00', end: '20:30', title: '저녁 식사', place: '바베큐장', manager: '식사팀', supplies: '고기/집게/숯', memo: '' }
  ];
  save();
  renderAll();
  toast('샘플 데이터를 넣었어요.');
}

function bindEvents() {
  $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  $$('[data-jump]').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.jump)));

  $('#eventName').addEventListener('input', e => { state.eventName = e.target.value; save(); renderSummaryCards(); renderBackup(); });
  $('#eventType').addEventListener('change', e => {
    state.eventType = e.target.value;
    if (e.target.value === 'department') state.showStudentId = true;
    if (['lab', 'club'].includes(e.target.value)) state.showStudentId = false;
    save(); renderAll();
  });
  $('#showStudentId').addEventListener('change', e => { state.showStudentId = e.target.checked; save(); renderAll(); });
  $('#themeBtn').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; save(); renderAll(); });
  $('#printBtn').addEventListener('click', () => window.print());
  $('[data-add-sample]').addEventListener('click', addSampleData);

  document.body.addEventListener('input', e => {
    const el = e.target.closest('[data-table][data-id][data-field]');
    if (!el) return;
    updateField(el.dataset.table, el.dataset.id, el.dataset.field, el.value);
  });
  document.body.addEventListener('change', e => {
    const el = e.target.closest('[data-table][data-id][data-field]');
    if (el) updateField(el.dataset.table, el.dataset.id, el.dataset.field, el.value);
    const selected = e.target.closest('[data-select-lodging]');
    if (selected) { state.selectedLodgingId = selected.dataset.selectLodging; save(); renderAll(); }
  });
  document.body.addEventListener('click', e => {
    const del = e.target.closest('[data-delete]');
    if (del) moveToTrash(del.dataset.delete, del.dataset.id);
    const restore = e.target.closest('[data-restore]');
    if (restore) restoreTrash(restore.dataset.restore);
    const detail = e.target.closest('[data-toggle-detail]');
    if (detail) {
      const row = state.lodgings.find(l => l.id === detail.dataset.toggleDetail);
      row.open = !row.open;
      save(); renderAll();
    }
    const chip = e.target.closest('[data-region-chip]');
    if (chip) { state.activeRegion = chip.dataset.regionChip; save(); renderAll(); }
    const csv = e.target.closest('[data-csv]');
    if (csv) downloadCsv(csv.dataset.csv);
    const copy = e.target.closest('[data-copy]');
    if (copy) copyTable(copy.dataset.copy);
  });

  $('#addParticipantBtn').addEventListener('click', () => addRow('participants', { name: '', studentId: '', phone: '', attendance: '참석', paid: '미입금', amount: 0, memo: '' }));
  $('#bulkAddParticipantsBtn').addEventListener('click', () => {
    const text = $('#bulkParticipants').value.trim();
    if (!text) return toast('붙여넣은 명단이 없어요.');
    text.split('\n').forEach(line => {
      const parts = line.split(/[\t, ]+/).filter(Boolean);
      if (!parts.length) return;
      if (state.showStudentId && parts.length >= 3) addRow('participants', { name: parts[0], studentId: parts[1], phone: parts.slice(2).join(' '), attendance: '참석', paid: '미입금', amount: 0, memo: '' });
      else addRow('participants', { name: parts[0], studentId: '', phone: parts.slice(1).join(' '), attendance: '참석', paid: '미입금', amount: 0, memo: '' });
    });
    $('#bulkParticipants').value = '';
    toast('명단을 추가했어요.');
  });

  $('#regionSelect').addEventListener('change', e => { state.activeRegion = e.target.value; save(); renderAll(); });
  $('#filterRegionBtn').addEventListener('click', () => { state.activeRegion = $('#regionSelect').value; save(); renderAll(); });
  $('#showAllRegionsBtn').addEventListener('click', () => { state.activeRegion = '전체'; save(); renderAll(); });
  $('#addLodgingBtn').addEventListener('click', () => {
    const region = $('#regionSelect').value || '대부도';
    pushRecentRegion(region);
    addRow('lodgings', { region, name: '', link: '', maxPeople: '', basePeople: '', basePrice: '', extraFee: '', expectedPeople: attendingCount() || '', nights: 1, rooms: '', bathrooms: '', facilities: '', memo: '', open: false });
  });

  $('#addTransportBtn').addEventListener('click', () => addRow('transport', { method: '개별 이동', route: '', people: attendingCount() || '', totalCost: 0, supportAmount: 0, memo: '' }));
  $('#addFoodBtn').addEventListener('click', () => addRow('food', { name: '', quantity: '', unitPrice: '', memo: '' }));
  $('#addBudgetBtn').addEventListener('click', () => addRow('budget', { name: '', amount: 0, memo: '' }));
  $('#syncBudgetBtn').addEventListener('click', () => { renderBudget(); toast('현재 숙소/교통/음식 금액을 반영했어요.'); });
  $('#addScheduleBtn').addEventListener('click', () => addRow('schedule', { day: '1일차', start: '', end: '', title: '', place: '', manager: '', supplies: '', memo: '' }));
  $('#addGameBtn').addEventListener('click', () => addRow('games', { selected: '후보', name: '', people: '', time: '', supplies: '', rules: '', tips: '', caution: '' }));

  $('#copySummaryBtn').addEventListener('click', async () => { await navigator.clipboard.writeText(buildSummaryText()); toast('요약을 복사했어요.'); });
  $('#copyLongSummaryBtn').addEventListener('click', async () => { await navigator.clipboard.writeText($('#summaryText').value); toast('공유용 요약을 복사했어요.'); });
  $('#downloadBackupBtn').addEventListener('click', () => download(`${state.eventName || 'mt'}_backup.json`, JSON.stringify(state, null, 2), 'application/json;charset=utf-8'));
  $('#backupFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = { ...initialState(), ...JSON.parse(reader.result) };
        save(); renderAll(); toast('백업을 불러왔어요.');
      } catch { toast('백업 파일을 읽을 수 없어요.'); }
    };
    reader.readAsText(file);
  });
  $('#resetAllBtn').addEventListener('click', () => {
    if (!confirm('정말 전체 데이터를 초기화할까요?')) return;
    state = initialState();
    save(); renderAll(); toast('초기화했어요.');
  });
}

bindEvents();
renderAll();
