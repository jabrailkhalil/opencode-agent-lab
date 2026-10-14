// One presentation stopwatch shared by the two consoles and the presenter tab.
// Checkpoint duration and planned slide timings never enter this clock.
const key = 'vtb-presentation-clock-v1';
export function recordedAgentTime(run, checkpoint) {
  const index = run?.stages?.findIndex(stage => stage.id === checkpoint) ?? -1;
  if (index < 0) return { totalMs: null, stageMs: null };
  const durations = run.stages.slice(0, index + 1).map(stage => stage.elapsedMs);
  return {
    totalMs: durations.every(ms => Number.isFinite(ms) && ms >= 0) ? durations.reduce((a, b) => a + b, 0) : null,
    stageMs: run.stages[index].elapsedMs ?? null,
  };
}
export function formatAgentTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'Нет замера';
  const seconds = Math.round(ms / 1000);
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}
// Both console URLs carry the same launch ID. Reset only once, so opening
// the second console or reloading either one never rewinds a running clock.
const launchId = new URLSearchParams(location.search).get('launch');
if (launchId && /^[a-f0-9]{32}$/.test(launchId) && localStorage.getItem(key + '-launch-' + launchId) !== '1') {
  localStorage.setItem(key, JSON.stringify({ elapsedMs: 0, runningSince: null, startedAt: null }));
  for (const storageKey of Object.keys(localStorage)) {
    if (/^preview-(sdd|flash|direct|release|error)-/.test(storageKey)) localStorage.removeItem(storageKey);
  }
  localStorage.setItem(key + '-launch-' + launchId, '1');
}
export const readClock = () => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    if (v && Number.isFinite(v.elapsedMs) && v.elapsedMs >= 0 &&
        (v.runningSince === null || Number.isFinite(v.runningSince))) return v;
  } catch {}
  return { elapsedMs: 0, runningSince: null, startedAt: null };
};
export const elapsed = (v = readClock(), now = Date.now()) =>
  v.elapsedMs + (v.runningSince === null ? 0 : Math.max(0, now - v.runningSince));
export const formatClock = ms => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
};
function saveClock(v) {
  localStorage.setItem(key, JSON.stringify(v));
  window.dispatchEvent(new Event('demo-clock-change'));
}
export function startClock() {
  const v = readClock();
  if (v.runningSince !== null) return;
  const now = Date.now();
  saveClock({ ...v, startedAt: v.startedAt ?? now, runningSince: now });
}
export function pauseClock() {
  const v = readClock();
  saveClock({ ...v, elapsedMs: elapsed(v), runningSince: null });
}
export function resetClock() {
  saveClock({ elapsedMs: 0, runningSince: null, startedAt: null });
}
export function exportClock(step) {
  const v = readClock();
  const value = { type: 'presentation-wall-time', startedAt: v.startedAt ? new Date(v.startedAt).toISOString() : null,
    measuredAt: new Date().toISOString(), elapsedMs: elapsed(v), paused: v.runningSince === null,
    step, humanActiveDevelopmentTime: null };
  const href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = href; a.download = 'demo70-timing.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export function mountClock(display, button) {
  const render = () => {
    const v = readClock();
    display.textContent = formatClock(elapsed(v));
    display.dataset.running = String(v.runningSince !== null);
    if (button) {
      button.textContent = v.runningSince !== null ? 'Пауза' : v.elapsedMs ? 'Продолжить' : 'Старт';
      button.setAttribute('aria-label', v.runningSince !== null ? 'Приостановить таймер показа' : 'Запустить таймер показа');
    }
  };
  if (button) button.addEventListener('click', () => readClock().runningSince === null ? startClock() : pauseClock());
  window.addEventListener('storage', ev => { if (ev.key === key) render(); });
  window.addEventListener('demo-clock-change', render);
  setInterval(render, 250); render();
}
