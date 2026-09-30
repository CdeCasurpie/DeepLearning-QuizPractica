/* DeepLearning Quiz — lógica portada de practica.py / examen.py a web estática.
 * - practica.py: 20 aleatorias + métricas (accuracy, precision/recall/F1 macro,
 *   matriz de confusión por letra de respuesta, tiempos, falladas).
 * - examen.py: banco completo barajado.
 * Sin backend: todo vive en memoria, métricas solo al final.
 */
"use strict";

const state = {
  bank: [],
  questions: [], // {id, question, options:[{text, originalIdx}], answerPos}
  idx: 0,
  score: 0,
  phase: "answering", // answering | reviewing
  records: [],        // {question_number, question_id, question, predicted_idx, correct_idx, correct, response_time_seconds}
  questionStart: 0,
  sessionStarted: null,
};

const $ = (id) => document.getElementById(id);

function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo({ top: 0 });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Renderiza texto mixto: partes fuera de $...$ como texto plano,
 * partes dentro como KaTeX (igual que MathRenderer de matplotlib en practica.py). */
function renderMixed(text) {
  const parts = String(text).split("$");
  return parts
    .map((part, i) => {
      if (!part) return "";
      if (i % 2 === 0) return escapeHtml(part);
      try {
        return window.katex
          ? katex.renderToString(part, { throwOnError: false, strict: false })
          : `<code>${escapeHtml(part)}</code>`;
      } catch {
        return `<code>${escapeHtml(part)}</code>`;
      }
    })
    .join("");
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ============ métricas (port de calculate_metrics en practica.py) ============ */
function calculateMetrics(records) {
  if (!records.length) {
    return { answered: 0, correct: 0, incorrect: 0, accuracy: 0, precision_macro: 0, recall_macro: 0, f1_macro: 0, confusion: [], perClass: {} };
  }
  let maxLabel = 0;
  for (const r of records) maxLabel = Math.max(maxLabel, r.correct_idx, r.predicted_idx);
  const C = maxLabel + 1;
  const confusion = Array.from({ length: C }, () => Array(C).fill(0));
  for (const r of records) confusion[r.correct_idx][r.predicted_idx] += 1;

  const perClass = {};
  const ps = [], rs = [], fs = [];
  const total = records.length;
  for (let c = 0; c < C; c++) {
    const TP = confusion[c][c];
    let FP = 0, FN = 0;
    for (let r = 0; r < C; r++) if (r !== c) FP += confusion[r][c];
    for (let j = 0; j < C; j++) if (j !== c) FN += confusion[c][j];
    const TN = total - TP - FP - FN;
    const p = TP + FP ? TP / (TP + FP) : 0;
    const r = TP + FN ? TP / (TP + FN) : 0;
    const f = p + r ? (2 * p * r) / (p + r) : 0;
    ps.push(p); rs.push(r); fs.push(f);
    perClass[String.fromCharCode(65 + c)] = { tp: TP, fp: FP, fn: FN, tn: TN, precision: p, recall: r, f1: f };
  }
  const correct = records.filter((r) => r.correct).length;
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    answered: total, correct, incorrect: total - correct,
    accuracy: correct / total,
    precision_macro: mean(ps), recall_macro: mean(rs), f1_macro: mean(fs),
    confusion, perClass,
  };
}

/* ============ flujo ============ */
async function loadBank() {
  const res = await fetch("quiz_data.json");
  if (!res.ok) throw new Error("No se pudo cargar quiz_data.json");
  state.bank = await res.json();
  $("total-count").textContent = state.bank.length;
}

function buildQuiz({ count, shuffleOptions }) {
  const pool = shuffle([...state.bank]);
  const picked = pool.slice(0, Math.min(count, pool.length));
  state.questions = picked.map((q) => {
    const order = q.options.map((_, i) => i);
    if (shuffleOptions) shuffle(order);
    const options = order.map((orig) => ({ text: q.options[orig], originalIdx: orig }));
    const answerPos = order.indexOf(q.answer_idx);
    return { id: q.id ?? null, question: q.question, options, answerPos, answerIdx: q.answer_idx };
  });
  state.idx = 0;
  state.score = 0;
  state.records = [];
  state.phase = "answering";
  state.sessionStarted = new Date().toISOString();
}

function startQuiz(count) {
  const shuffleOptions = $("opt-shuffle-options").checked;
  buildQuiz({ count, shuffleOptions });
  show("screen-quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.idx];
  state.phase = "answering";
  state.questionStart = performance.now();

  $("progress-label").textContent = `Pregunta ${state.idx + 1}/${state.questions.length}`;
  $("score-label").textContent = `Puntaje: ${state.score}`;
  $("progress-fill").style.width = `${(state.idx / state.questions.length) * 100}%`;

  $("question-text").innerHTML = renderMixed(q.question);

  const list = $("options-list");
  list.innerHTML = "";
  q.options.forEach((opt, pos) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.innerHTML = `<span class="letter">${String.fromCharCode(97 + pos)}</span><span>${renderMixed(opt.text)}</span>`;
    btn.addEventListener("click", () => answer(pos));
    list.appendChild(btn);
  });

  $("feedback").textContent = "";
  $("feedback").className = "feedback";
  $("btn-next").classList.add("hidden");
}

function answer(pos) {
  if (state.phase !== "answering") return;
  const q = state.questions[state.idx];
  const dt = (performance.now() - state.questionStart) / 1000;
  const ok = pos === q.answerPos;
  if (ok) state.score += 1;

  state.records.push({
    question_number: state.idx + 1,
    question_id: q.id,
    question: q.question,
    question_options: q.options.map((o) => o.text),
    predicted_idx: pos,
    correct_idx: q.answerPos,
    predicted_option: String.fromCharCode(65 + pos),
    correct_option: String.fromCharCode(65 + q.answerPos),
    correct: ok,
    response_time_seconds: Math.round(dt * 1000) / 1000,
  });

  const btns = [...document.querySelectorAll("#options-list .option-btn")];
  btns.forEach((b, i) => {
    b.disabled = true;
    if (i === q.answerPos) b.classList.add("correct");
    else if (i === pos) b.classList.add("wrong");
    else b.classList.add("dim");
  });

  $("score-label").textContent = `Puntaje: ${state.score}`;
  const fb = $("feedback");
  fb.textContent = ok
    ? "✓ Correcto"
    : `✗ Incorrecto — la correcta era ${String.fromCharCode(65 + q.answerPos)})`;
  fb.className = "feedback " + (ok ? "ok" : "bad");

  state.phase = "reviewing";
  const next = $("btn-next");
  next.classList.remove("hidden");
  next.textContent = state.idx + 1 === state.questions.length ? "Ver resultados →" : "Siguiente →";
}

function next() {
  if (state.phase !== "reviewing") return;
  if (state.idx + 1 < state.questions.length) {
    state.idx += 1;
    renderQuestion();
  } else {
    finish();
  }
}

/* ============ resultados ============ */
function finish() {
  const m = calculateMetrics(state.records);
  $("progress-fill").style.width = "100%";
  $("final-score").textContent = `Simulacro completado: ${m.correct}/${m.answered}`;
  const acc = (m.accuracy * 100).toFixed(1);
  $("final-verdict").textContent =
    m.accuracy >= 0.8 ? `Excelente — Accuracy ${acc}%.`
    : m.accuracy >= 0.6 ? `Bien — Accuracy ${acc}%. Repasa las falladas abajo.`
    : `Accuracy ${acc}%. Revisa las falladas y vuelve a intentarlo.`;

  const avgT = state.records.length
    ? state.records.reduce((a, r) => a + r.response_time_seconds, 0) / state.records.length : 0;
  const cards = [
    ["Accuracy", (m.accuracy * 100).toFixed(1) + "%"],
    ["F1 macro", m.f1_macro.toFixed(3)],
    ["Precision macro", m.precision_macro.toFixed(3)],
    ["Recall macro", m.recall_macro.toFixed(3)],
    ["Correctas", `${m.correct}`],
    ["T prom. (s)", avgT.toFixed(2)],
  ];
  $("metrics-grid").innerHTML = cards
    .map(([k, v]) => `<div class="metric"><div class="v">${v}</div><div class="k">${k}</div></div>`)
    .join("");

  // Confusión
  const n = m.confusion.length;
  let html = "<thead><tr><th>real ↓ / pred →</th>" +
    Array.from({ length: n }, (_, j) => `<th>${String.fromCharCode(65 + j)}</th>`).join("") + "</tr></thead><tbody>";
  for (let i = 0; i < n; i++) {
    html += `<tr><th>${String.fromCharCode(65 + i)}</th>` +
      m.confusion[i].map((v, j) => `<td class="${i === j ? "diag" : ""}">${v}</td>`).join("") + "</tr>";
  }
  $("confusion-table").innerHTML = html + "</tbody>";

  // Por clase
  const tbody = document.querySelector("#perclass-table tbody");
  tbody.innerHTML = Object.entries(m.perClass)
    .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v.tp}</td><td>${v.fp}</td><td>${v.fn}</td><td>${v.tn}</td><td>${v.precision.toFixed(3)}</td><td>${v.recall.toFixed(3)}</td><td>${v.f1.toFixed(3)}</td></tr>`)
    .join("");

  // Falladas
  const wrong = state.records.filter((r) => !r.correct);
  $("wrong-count").textContent = wrong.length;
  $("wrong-list").innerHTML = wrong.length ? "" : `<p class="subtitle">Sin fallos. 🎉</p>`;
  wrong.forEach((r) => {
    const div = document.createElement("div");
    div.className = "wrong-item";
    const opts = (r.question_options || []).map((t, i) =>
      `<div>${String.fromCharCode(97 + i)}) ${renderMixed(t)}</div>`).join("");
    div.innerHTML =
      `<div class="w-meta">Pregunta ${r.question_number} · id ${r.question_id ?? "—"} · ${r.response_time_seconds}s</div>` +
      `<div>${renderMixed(r.question)}</div>` +
      `<div style="margin-top:8px">${opts}</div>` +
      `<div class="w-ans">Tu respuesta: <b class="bad">${r.predicted_option}</b> · Correcta: <b class="good">${r.correct_option}</b></div>`;
    $("wrong-list").appendChild(div);
  });

  show("screen-results");
}

/* ============ eventos ============ */
$("btn-practica").addEventListener("click", () => startQuiz(parseInt($("opt-num").value, 10) || 20));
$("btn-examen").addEventListener("click", () => startQuiz(state.bank.length));
$("btn-next").addEventListener("click", next);
$("btn-quit").addEventListener("click", () => show("screen-start"));
$("btn-home").addEventListener("click", () => show("screen-start"));
$("btn-retry").addEventListener("click", () => show("screen-start"));

document.addEventListener("keydown", (e) => {
  if (!$("screen-quiz").classList.contains("active")) return;
  if (state.phase === "answering" && ["a", "b", "c", "d", "e"].includes(e.key.toLowerCase())) {
    const pos = e.key.toLowerCase().charCodeAt(0) - 97;
    if (pos < state.questions[state.idx].options.length) answer(pos);
  } else if (state.phase === "reviewing" && e.key === "Enter") {
    next();
  }
});

loadBank().catch((err) => {
  $("total-count").textContent = "error";
  console.error(err);
});
