// Состояние и переходы между экранами.
import { CONFIG } from './data.js';
import { validateDecision, calculateRound } from './calculations.js';

export function createState() {
  return { screen: 'start', round: 0, decision: null, result: null, history: [] };
}

export function roundConfig(state) { return CONFIG.rounds[state.round - 1]; }

export function freshDecision(round) {
  const rc = CONFIG.rounds[round - 1];
  return {
    qty: rc.fixed.qty ?? rc.defaults.qty ?? null,
    price: rc.fixed.price ?? rc.defaults.price ?? null,
    promo: rc.fixed.promo ?? rc.defaults.promo ?? null,
  };
}

export function startGame() {
  const s = createState();
  s.round = 1; s.screen = 'decision'; s.decision = freshDecision(1);
  return s;
}

export function setDecision(state, patch) {
  state.decision = { ...state.decision, ...patch };
  return state;
}

export function confirmDecision(state) {
  const v = validateDecision(state.decision, CONFIG.startCapital);
  if (!v.ok) return v;
  state.result = calculateRound(state.decision, CONFIG.startCapital);
  state.history[state.round - 1] = { round: state.round, decision: { ...state.decision }, result: state.result };
  state.screen = 'result';
  return v;
}

export function goReview(state) { state.screen = 'review'; return state; }

export function nextStep(state) {
  if (state.round >= CONFIG.rounds.length) { state.screen = 'final'; return state; }
  state.round += 1; state.screen = 'decision';
  state.decision = freshDecision(state.round); state.result = null;
  return state;
}
