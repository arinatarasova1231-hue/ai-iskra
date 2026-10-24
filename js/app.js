import { CONFIG } from './data.js';
import { formatRub as R, planExpenses, validateDecision, priceTable } from './calculations.js';
import { getFeedback } from './iskra.js';
import { summary, roundPoints, BANK, EVENTS, REWARDS, CHECKLIST } from './spark.js';
import { createState, startGame, setDecision, confirmDecision, goReview, nextStep, roundConfig } from './game.js';

let state = createState();
let error = '';
const app = document.getElementById('app');

function go(fn) { error = ''; fn(); render(); }

function render() {
  const views = { start: vStart, decision: vDecision, result: vResult, review: vReview, final: vFinal };
  app.innerHTML = `<section class="screen">${views[state.screen]()}</section>`;
  bind();
  app.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

const mascot = (text) => `<div class="iskra"><span class="spark big" aria-hidden="true"></span><div><strong>Искра</strong><p>${text}</p></div></div>`;
const sparkBar = () => { const m = summary(state.history, state.events); return `<p class="sp" aria-live="polite">✦ <b>${m.total}</b> Spark · уровень ${m.levelNo}/7 «${m.level}»${m.next ? ` · до «${m.next[1]}»: ${m.next[0] - m.total}` : ''}</p>`; };
const steps = () => sparkBar() + `<ol class="steps" aria-label="Прогресс">${CONFIG.rounds.map((r) => `<li class="${r.id < state.round || state.screen === 'final' ? 'done' : r.id === state.round ? 'cur' : ''}">${r.id}</li>`).join('')}</ol>`;

function vStart() {
  return `<div class="hero">
    <h1>AI-Искра</h1>
    <p class="lead">Безопасная практика предпринимательства: принимайте решения, считайте результат и учитесь на разборе.</p>
    <div class="card">
      <h2>Первый сценарий: ${CONFIG.product.name.toLowerCase()}</h2>
      <p>Вы управляете виртуальным мини-магазином. В трёх коротких раундах решаете, сколько закупить, по какой цене продавать и стоит ли вкладываться в рекламу.</p>
      <div class="kpi"><span>Стартовый виртуальный капитал</span><b>${R(CONFIG.startCapital)}</b></div>
      <button class="btn" data-act="start">Начать игру</button>
      <p class="note">Учебная симуляция. Используются виртуальные деньги.</p>
    </div></div>`;
}

// Полное состояние формы решения: расходы, ошибка, готовность к подтверждению.
function status() {
  const d = state.decision;
  const plan = d.qty !== null && d.promo !== null ? planExpenses(d) : null;
  const left = plan ? CONFIG.startCapital - plan.expenses : null;
  const ok = !!plan && validateDecision(d, CONFIG.startCapital).ok;
  const msg = plan && left < 0
    ? `Не хватает денег: нужно ${R(plan.expenses)}, доступно ${R(CONFIG.startCapital)}. Уменьшите закупку или продвижение.` : '';
  return { plan, left, ok, msg };
}

function vDecision() {
  const rc = roundConfig(state), d = state.decision, st = status();
  const ctl = [];
  if (rc.controls.includes('qty')) ctl.push(`<div class="field"><label for="qty">Сколько сумок закупить: <b id="qtyOut">${d.qty} шт.</b></label>
    <input id="qty" type="range" min="${CONFIG.minQty}" max="${CONFIG.maxQty}" step="1" value="${d.qty}">
    <div class="hint"><span>${CONFIG.minQty}</span><span>${CONFIG.maxQty}</span></div></div>`);
  if (rc.controls.includes('price')) ctl.push(`<fieldset class="field"><legend>Цена продажи</legend><div class="chips">${CONFIG.prices.map((p) =>
    `<label class="chip"><input type="radio" name="price" value="${p}" ${d.price === p ? 'checked' : ''}><span>${R(p)}</span></label>`).join('')}</div></fieldset>`);
  if (rc.controls.includes('promo')) ctl.push(`<fieldset class="field"><legend>Бюджет продвижения</legend><div class="chips">${CONFIG.promoOptions.map((o) =>
    `<label class="chip"><input type="radio" name="promo" value="${o.budget}" ${d.promo === o.budget ? 'checked' : ''}><span>${o.budget ? R(o.budget) : 'Без рекламы'}</span></label>`).join('')}</div></fieldset>`);
  const fixedInfo = [
    rc.fixed.price ? `Цена продажи: <b>${R(rc.fixed.price)}</b>` : '',
    rc.fixed.qty ? `Товара в наличии: <b>${rc.fixed.qty} шт.</b>` : '',
  ].filter(Boolean).join(' · ');
  return `${steps()}
  <p class="eyebrow">Раунд ${rc.id} из ${CONFIG.rounds.length}</p>
  <h1>${rc.title}</h1><p class="lead">${rc.situation}</p>
  ${mascot(rc.task)}
  <div class="grid">
    <div class="card"><h2>${CONFIG.product.name}</h2>
      <p class="note">${CONFIG.product.note}</p>
      <div class="kpi"><span>Закупка за единицу</span><b>${R(CONFIG.unitCost)}</b></div>
      <div class="kpi"><span>Капитал</span><b>${R(CONFIG.startCapital)}</b></div>
      ${fixedInfo ? `<p class="fixed">${fixedInfo}</p>` : ''}</div>
    <div class="card"><h2>Ваше решение</h2>${ctl.join('')}
      <div class="sum" id="sum">${sumHtml(st.plan, st.left)}</div>
      <p class="error" id="err" role="alert">${error || st.msg}</p>
      <button class="btn" id="confirm" data-act="confirm" ${st.ok ? '' : 'disabled'}>Подтвердить решение</button></div>
  </div>`;
}

function sumHtml(plan, left) {
  if (!plan) return '<p class="note">Расходы появятся после выбора.</p>';
  return `<div class="kpi"><span>Закупка товара</span><b>${R(plan.stockCost)}</b></div>
  <div class="kpi"><span>Фиксированные расходы</span><b>${R(plan.fixedCosts)}</b></div>
  <div class="kpi"><span>Продвижение</span><b>${R(plan.promoCost)}</b></div>
  <div class="kpi total"><span>Предварительные расходы</span><b>${R(plan.expenses)}</b></div>
  <div class="kpi"><span>Капитал после расходов</span><b class="${left < 0 ? 'neg' : ''}">${R(left)}</b></div>`;
}

function vResult() {
  const r = state.result, rc = roundConfig(state);
  const pc = r.profit < 0 ? 'neg' : 'pos';
  const table = rc.id === 2 ? `<div class="card"><h2>Как менялся результат при разных ценах</h2><p class="note">Закупка — ${r.qty} шт., без рекламы.</p>
    <div class="scroll"><table><thead><tr><th>Цена</th><th>Спрос</th><th>Продано</th><th>Прибыль</th></tr></thead><tbody>${priceTable(r.qty, r.capital).map((x) =>
      `<tr class="${x.price === r.price ? 'me' : ''}"><td>${R(x.price)}</td><td>${x.totalDemand}</td><td>${x.sold}</td><td class="${x.profit < 0 ? 'neg' : ''}">${R(x.profit)}</td></tr>`).join('')}</tbody></table></div></div>` : '';
  return `${steps()}<p class="eyebrow">Раунд ${rc.id}: результат</p><h1>${rc.title}</h1>
  <div class="card profit ${pc}"><span>${r.profit < 0 ? 'Убыток' : 'Прибыль'}</span><b>${R(r.profit)}</b><small>Остаток виртуальных денег: ${R(r.cashAfter)}</small></div>
  <div class="grid">
    <div class="card"><h2>Продажи</h2>
      <div class="kpi"><span>Закуплено</span><b>${r.qty} шт.</b></div>
      <div class="kpi"><span>Цена</span><b>${R(r.price)}</b></div>
      <div class="kpi"><span>Модельный спрос${r.extraDemand ? ` (${r.baseDemand} + ${r.extraDemand} от рекламы)` : ''}</span><b>${r.totalDemand} шт.</b></div>
      <div class="kpi"><span>Продано</span><b>${r.sold} шт.</b></div>
      <div class="kpi"><span>Не продано</span><b>${r.unsold} шт.</b></div></div>
    <div class="card"><h2>Деньги</h2>
      <div class="kpi"><span>Выручка</span><b>${R(r.revenue)}</b></div>
      <div class="kpi"><span>Закупка товара</span><b>${R(r.stockCost)}</b></div>
      <div class="kpi"><span>Фиксированные расходы</span><b>${R(r.fixedCosts)}</b></div>
      <div class="kpi"><span>Продвижение</span><b>${R(r.promoCost)}</b></div>
      <div class="kpi total"><span>Всего расходов</span><b>${R(r.expenses)}</b></div></div>
  </div>${table}${eventCard(r, rc)}${bankCard(r, rc)}
  <button class="btn" data-act="review">Разбор от Искры</button>`;
}

function eventCard(r, rc) {
  const e = EVENTS[rc.id], a = state.events[rc.id];
  const opts = e.o.map((o, i) => `<button class="btn ghost" data-act="event" data-i="${i}" ${a !== undefined ? 'disabled' : ''}>${o[0]}</button>`).join('');
  const fb = a === undefined ? '' : `<p class="${a ? 'pos' : 'neg'}"><b>${a ? '+30 Spark. ' : 'Без бонуса. '}</b>${e.o.find((o) => o[1] === a)[2]}</p>`;
  return `<div class="card"><h2>${e.q}</h2><div class="row">${opts}</div>${fb}</div>`;
}

function bankCard(r, rc) {
  const b = BANK[rc.id], pts = roundPoints(r, state.events[rc.id] === true);
  return `<div class="card bank"><h2>Продукт банка открыт: ${b.name}</h2><p>${typeof b.note === 'function' ? b.note(r) : b.note}</p>
  <p class="note">Spark за раунд: <b>${pts}</b>. В реальной жизни Spark меняются на бонусы по продуктам банка. Условия учебные.</p></div>`;
}

function vReview() {
  const f = getFeedback(state.result), last = state.round >= CONFIG.rounds.length;
  return `${steps()}<p class="eyebrow">Раунд ${state.round}: разбор</p><h1>${f.title}</h1>
  <div class="card review">${mascot(f.text)}
    <p class="tip"><b>Попробуйте в следующий раз.</b> ${f.tip}</p></div>
  <div class="row"><button class="btn ghost" data-act="back">К результату</button>
  <button class="btn" data-act="next">${last ? 'Посмотреть итоги' : 'Следующий раунд'}</button></div>`;
}

function vFinal() {
  const max = Math.max(...state.history.map((h) => Math.abs(h.result.profit)), 1);
  const cards = state.history.map((h) => { const r = h.result, rc = CONFIG.rounds[h.round - 1];
    return `<div class="card cmp"><h2>Раунд ${rc.id}. ${rc.title}</h2>
    <div class="bar"><i class="${r.profit < 0 ? 'neg' : ''}" style="width:${Math.max(4, Math.round(Math.abs(r.profit) / max * 100))}%"></i></div>
    <div class="kpi"><span>${r.profit < 0 ? 'Убыток' : 'Прибыль'}</span><b class="${r.profit < 0 ? 'neg' : 'pos'}">${R(r.profit)}</b></div>
    <div class="kpi"><span>Выручка</span><b>${R(r.revenue)}</b></div>
    <div class="kpi"><span>Расходы</span><b>${R(r.expenses)}</b></div>
    <div class="kpi"><span>Продано / закуплено</span><b>${r.sold} / ${r.qty}</b></div>
    <div class="kpi"><span>Остаток денег</span><b>${R(r.cashAfter)}</b></div></div>`; }).join('');
  return `${steps()}<h1>Итоги трёх раундов</h1>
  <p class="lead">У каждого раунда был свой бюджет и свои условия, поэтому результаты сравниваются, а не складываются.</p>
  <div class="grid3">${cards}</div>
  <div class="card"><h2>Главный вывод</h2><p>Прибыль зависит не от одного решения, а от баланса: сколько закупить, по какой цене продавать и сколько вложить в продвижение. Каждое решение меняет и спрос, и расходы.</p></div>
  <div class="card"><h2>Что вы потренировали</h2><ul class="skills"><li>Планирование закупки с учётом спроса</li><li>Сравнение выручки, расходов и прибыли</li><li>Оценка влияния цены на продажи</li><li>Оценка окупаемости рекламы</li></ul>
  <p class="note">Это учебная модель на одном товаре. Она не оценивает вас как предпринимателя.</p></div>
  ${finalSpark()}
  <button class="btn" data-act="restart">Пройти заново</button>`;
}

function finalSpark() {
  const m = summary(state.history, state.events);
  const rw = REWARDS.map(([n, t]) => `<li class="${m.total >= n ? 'got' : ''}">${m.total >= n ? '✓' : '○'} ${t} — от ${n} Spark</li>`).join('');
  const bd = m.badges.map((b) => `<span class="badge">${b}</span>`).join(' ') || 'Пока нет — попробуйте снова';
  return `<div class="card"><h2>Ваши Spark-очки: ${m.total}</h2><p>Уровень ${m.levelNo} из 7: <b>«${m.level}»</b>. Бейджи: ${bd}</p>
  <h3>Spark → реальные бонусы</h3><ul class="skills rw">${rw}</ul><p class="note">Пороги условные, их согласуют с банком. Это учебная симуляция, реальных начислений нет.</p></div>
  <div class="card"><h2>От игры к бизнесу: Искра ведёт за руку</h2><p>В реальном бизнесе AI-ассистент проводит по чек-листу из 30 шагов. Первые пять:</p>
  <ul class="chk">${CHECKLIST.map((t) => `<li><label><input type="checkbox"> ${t}</label></li>`).join('')}</ul></div>`;
}

function bind() {
  const q = (s) => app.querySelector(s);
  app.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'start') go(() => { state = startGame(); });
    else if (a === 'confirm') { const v = confirmDecision(state); error = v.ok ? '' : v.error; render(); }
    else if (a === 'review') go(() => goReview(state));
    else if (a === 'back') go(() => { state.screen = 'result'; });
    else if (a === 'next') go(() => nextStep(state));
    else if (a === 'event') go(() => { state.events[state.round] = EVENTS[state.round].o[Number(b.dataset.i)][1]; });
    else if (a === 'restart') go(() => { state = createState(); });
  }));
  if (state.screen !== 'decision') return;
  const refresh = () => {
    error = '';
    const st = status();
    q('#sum').innerHTML = sumHtml(st.plan, st.left);
    q('#err').textContent = st.msg;
    q('#confirm').disabled = !st.ok;
  };
  const qty = q('#qty');
  if (qty) qty.addEventListener('input', () => { setDecision(state, { qty: Number(qty.value) }); q('#qtyOut').textContent = `${qty.value} шт.`; refresh(); });
  app.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', () => { setDecision(state, { [r.name]: Number(r.value) }); refresh(); }));
}

render();
