// Чистые финансовые функции. Деньги — числа; форматирование только для показа.
import { CONFIG } from './data.js';

const isInt = (n) => typeof n === 'number' && Number.isInteger(n);

export function additionalDemand(budget, cfg = CONFIG) {
  const o = cfg.promoOptions.find((x) => x.budget === budget);
  return o ? o.extra : null;
}

export function validateDecision(d, capital, cfg = CONFIG) {
  if (!d || !isInt(d.qty) || d.qty < cfg.minQty || d.qty > cfg.maxQty)
    return { ok: false, error: `Выберите количество от ${cfg.minQty} до ${cfg.maxQty} шт.` };
  if (!isInt(d.price) || cfg.demand[d.price] === undefined)
    return { ok: false, error: 'Выберите цену продажи.' };
  if (!isInt(d.promo) || additionalDemand(d.promo, cfg) === null)
    return { ok: false, error: 'Выберите бюджет продвижения.' };
  const need = d.qty * cfg.unitCost + cfg.fixedCosts + d.promo;
  if (need > capital)
    return { ok: false, error: `Не хватает денег: нужно ${formatRub(need)}, доступно ${formatRub(capital)}. Уменьшите закупку или продвижение.` };
  return { ok: true, error: '' };
}

export function planExpenses(d, cfg = CONFIG) {
  const stockCost = d.qty * cfg.unitCost;
  return { stockCost, fixedCosts: cfg.fixedCosts, promoCost: d.promo, expenses: stockCost + cfg.fixedCosts + d.promo };
}

export function calculateRound(d, capital, cfg = CONFIG) {
  const v = validateDecision(d, capital, cfg);
  if (!v.ok) throw new Error(v.error);
  const baseDemand = cfg.demand[d.price];
  const extraDemand = additionalDemand(d.promo, cfg);
  const totalDemand = baseDemand + extraDemand;
  const sold = Math.min(d.qty, totalDemand);
  const revenue = sold * d.price;
  const { stockCost, fixedCosts, promoCost, expenses } = planExpenses(d, cfg);
  const profit = revenue - expenses;
  const extraSold = sold - Math.min(d.qty, baseDemand);
  return {
    capital, qty: d.qty, price: d.price, unitCost: cfg.unitCost,
    baseDemand, extraDemand, totalDemand, sold, unsold: d.qty - sold,
    revenue, stockCost, fixedCosts, promoCost, expenses, profit,
    cashAfter: capital - expenses + revenue,
    reserve: capital - expenses,
    extraSold, promoMargin: extraSold * (d.price - cfg.unitCost),
  };
}

// Для таблицы сравнения цен после раунда 2.
export function priceTable(qty, capital, cfg = CONFIG) {
  return cfg.prices.map((p) => calculateRound({ qty, price: p, promo: 0 }, capital, cfg));
}

export function formatRub(n) {
  if (!Number.isFinite(n)) return '—';
  const s = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.abs(Math.round(n)));
  return `${n < 0 ? '−' : ''}${s}\u00A0₽`;
}
