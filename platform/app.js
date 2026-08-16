"use strict";

const E = window.EvidenceEngine;

const state = {
  claims: [],
  notices: [],
  results: [],
  claimSource: "",
  noticeSource: "",
  lastRunMs: 0,
  hasRun: false,
  datasetMode: "empty",
  catalogSummary: null,
  claimImportStats: null,
  noticeImportStats: null,
  viewMode: "roadshow",
  roadshowStep: 0,
  demoCase: "manual",
  activeQueue: "all",
  lastDrawerTrigger: null
};

const elements = {
  claimsFile: document.querySelector("#claims-file"),
  noticesFile: document.querySelector("#notices-file"),
  claimsStatus: document.querySelector("#claims-file-status"),
  noticesStatus: document.querySelector("#notices-file-status"),
  loadDemo: document.querySelector("#load-demo-btn"),
  loadOfficialCatalog: document.querySelector("#load-official-catalog-btn"),
  run: document.querySelector("#run-btn"),
  export: document.querySelector("#export-btn"),
  exportJSON: document.querySelector("#export-json-btn"),
  resultsBody: document.querySelector("#results-body"),
  statusFilter: document.querySelector("#status-filter"),
  search: document.querySelector("#search-input"),
  qualityAlert: document.querySelector("#quality-alert"),
  qualityContent: document.querySelector("#data-quality-content"),
  drawer: document.querySelector("#detail-drawer"),
  drawerContent: document.querySelector("#drawer-content"),
  drawerBackdrop: document.querySelector("#drawer-backdrop"),
  drawerClose: document.querySelector("#drawer-close"),
  toast: document.querySelector("#toast"),
  metricCompleted: document.querySelector("#metric-completed"),
  metricConducted: document.querySelector("#metric-conducted"),
  metricAwardOnly: document.querySelector("#metric-award-only"),
  metricManual: document.querySelector("#metric-manual"),
  metricNeedsEvidence: document.querySelector("#metric-needs-evidence"),
  catalogBanner: document.querySelector("#official-catalog-banner"),
  catalogLoadState: document.querySelector("#official-catalog-load-state"),
  catalogSummaryTitle: document.querySelector("#official-catalog-summary-title"),
  catalogSummaryDetail: document.querySelector("#official-catalog-summary-detail"),
  datasetContext: document.querySelector("#dataset-context"),
  roadshowMode: document.querySelector("#roadshow-mode-btn"),
  workbenchMode: document.querySelector("#workbench-mode-btn"),
  roadshowConsole: document.querySelector("#roadshow-console"),
  staffWorkbench: document.querySelector("#staff-workbench"),
  roadshowStage: document.querySelector("#roadshow-stage"),
  roadshowPrev: document.querySelector("#roadshow-prev"),
  roadshowNext: document.querySelector("#roadshow-next"),
  roadshowProgressLabel: document.querySelector("#roadshow-progress-label"),
  roadshowProgressTitle: document.querySelector("#roadshow-progress-title"),
  roadshowProgressNote: document.querySelector("#roadshow-progress-note"),
  openActiveDetail: document.querySelector("#open-active-detail"),
  openQAFromDemo: document.querySelector("#open-qa-from-demo"),
  qaToolboxOpen: document.querySelector("#qa-toolbox-btn"),
  qaToolbox: document.querySelector("#qa-toolbox"),
  qaToolboxClose: document.querySelector("#qa-toolbox-close"),
  strategyTree: document.querySelector("#strategy-tree"),
  strategyTreeCase: document.querySelector("#strategy-tree-case"),
  demoFocusLabel: document.querySelector(".demo-focus-badge strong"),
  queueCountLabel: document.querySelector("#queue-count-label")
};

const ROADSHOW_STEPS = [
  {
    title: "工作人员拿到的只是一句声明",
    note: "公司和自报项目是待核查输入，不是已知事实。",
    next: "开始核验：查看候选依据"
  },
  {
    title: "先找到候选材料，再把原文读成可核字段",
    note: "AI 保留原文引句和来源，只提供候选，不直接宣布真假。",
    next: "下一步：检查项目、企业和材料"
  },
  {
    title: "找到材料只是开始，还要把三道关对上",
    note: "先看同一项目，再看同一企业，最后判断材料只支持到中标、合同还是验收。",
    next: "生成复核任务"
  },
  {
    title: "输出不是一个“真／假”，而是一张复核任务单",
    note: "当前结论、原文依据、来源、存疑原因和下一步同时交给工作人员。",
    next: "一分钟演示完成"
  }
];

const WORK_QUEUE_LABELS = Object.freeze({
  completed: "已完成候选",
  conducted: "曾开展候选",
  award_only: "仅中标线索",
  manual: "疑点待人工",
  needs_evidence: "待补证"
});

function escapeHTML(value) {
  return (typeof E.redactLocalPaths === "function" ? E.redactLocalPaths(value) : E.asString(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeURL(value) {
  try {
    const url = new URL(E.asString(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Number(value) || 0);
}

function percent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function scoreLabel(value) {
  return `${Math.round((Number(value) || 0) * 100)}/100`;
}

function statusScore(status, maximum) {
  return ({ supported: maximum, review: Math.round(maximum * 0.52), conflict: 0, insufficient: 0, pending: 0 })[status] || 0;
}

function deriveWorkQueue(result) {
  if (!state.hasRun || !result || result.overall === "pending") return null;
  if (["conflict", "review"].includes(result.overall)) return "manual";
  if (result.overall !== "supported") return "needs_evidence";
  if (result.eligibility?.status === "meets" && result.evidenceStage === "acceptance") return "completed";
  if (result.evidenceStage === "contract") return "conducted";
  if (result.evidenceStage === "award") return "award_only";
  return "needs_evidence";
}

function queueExplanation(queue) {
  return ({
    completed: "同一项目、同一主体均有证据支持，且证据到达验收；进入已完成候选，仍待有权人员回看原文确认。",
    conducted: "同一项目、同一主体均有证据支持，证据只到合同；可支持曾开展过，尚未证明已经完成。",
    award_only: "目前只看到中标或成交线索；它不能单独证明已签合同或已完成履约。",
    manual: "项目、主体或候选范围存在冲突、歧义或复杂关系；系统写明疑点后交人工二次排查。",
    needs_evidence: "当前材料不足以稳定确认项目与主体关系；建议补项目编号、主体代码或合同／验收材料。"
  })[queue] || "尚未形成工作人员队列。";
}

function traceabilityScore(candidate) {
  if (!candidate) return 0;
  let score = 0;
  if (safeURL(candidate.sourceUrl) || E.publicSourceReference(candidate)) score += 3;
  if (candidate.publishDate) score += 2;
  if (candidate.sourceExcerpt) score += 3;
  if (candidate.sourceTitle || candidate.noticeType) score += 1;
  if (candidate.sourcePlatform) score += 1;
  return Math.min(10, score);
}

function evidenceSufficiency(result) {
  const candidate = result?.bestCandidate?.notice;
  const sourceScore = ({ official: 10, user_provided: 10, demo_official: 10, aggregator: 3, unknown: 0 })[result?.sourceOfficiality] || 0;
  const parts = [
    { key: "project", label: "项目一致性", score: statusScore(result?.project?.status, 30), max: 30, detail: result?.project?.label || "尚未核对" },
    { key: "entity", label: "主体一致性", score: statusScore(result?.entity?.status, 30), max: 30, detail: result?.entity?.label || "尚未核对" },
    { key: "stage", label: "候选／已确认材料文种", score: ({ award: 6, contract: 13, acceptance: 20, solicitation: 2, unknown: 0, none: 0 })[result?.evidenceStage] || 0, max: 20, detail: E.STAGE_LABELS[result?.evidenceStage] || "无可靠阶段" },
    { key: "source", label: "来源权威性", score: sourceScore, max: 10, detail: E.OFFICIALITY_LABELS[result?.sourceOfficiality] || "来源待确认" },
    { key: "trace", label: "可追溯完整性", score: traceabilityScore(candidate), max: 10, detail: candidate ? "检查网址／材料名、日期、文种与原文引句" : "尚无可追溯候选" }
  ];
  const raw = parts.reduce((sum, part) => sum + part.score, 0);
  const gates = [];
  let cap = 100;
  if (result?.project?.status === "conflict" || result?.entity?.status === "conflict") {
    gates.push("存在项目编号、包组或主体硬冲突，高分不能覆盖冲突");
    cap = Math.min(cap, 49);
  }
  if (["review", "insufficient"].includes(result?.project?.status) || ["review", "insufficient"].includes(result?.entity?.status)) {
    gates.push("同一项目或同一主体尚未稳定确认，只能转人工或补证");
    cap = Math.min(cap, 69);
  }
  if (!result?.authoritativeEvidence && result?.sourceOfficiality !== "demo_official") {
    gates.push("尚无官方原文或获授权材料，充分度不能进入高档");
    cap = Math.min(cap, 69);
  }
  if (result?.evidenceStage !== "acceptance") {
    gates.push("缺少验收材料，不能输出“已经完成”");
  }
  const score = Math.min(raw, cap);
  let label = score >= 85 ? "材料较充分" : score >= 60 ? "仍有关键缺口" : "材料不足";
  if (result?.overall !== "supported" && score >= 60) label = "关系尚未过硬门槛";
  else if (result?.evidenceStage === "award" && score >= 60) label = "关系材料较充分，仅有中标线索";
  else if (result?.evidenceStage === "contract" && score >= 60) label = "开展材料较充分，完成证据不足";
  else if (result?.evidenceStage === "acceptance" && score >= 85) label = "完成材料较充分，仍待人工确认";
  return { score, raw, cap, label, parts, gates };
}

function completionBoundary(result) {
  if (!result || result.overall === "pending") return "尚未运行核验。";
  if (result.overall !== "supported") return "项目或主体关系尚未稳定确认，暂不判断是否完成。";
  if (result.evidenceStage === "acceptance" && result.eligibility?.status === "meets") return "验收证据已达到主办方最低完成门槛，进入已完成候选；最终仍由工作人员确认。";
  if (result.evidenceStage === "contract") return "合同可支持曾开展过，但尚未证明已经完成；下一步补验收材料。";
  if (result.evidenceStage === "award") return "目前只有中标线索，不能证明已经开展，更不能证明已经完成。";
  return "当前证据尚未达到合同或验收阶段，需继续补证。";
}

function currentRule() {
  return E.COMPLETION_POLICY || null;
}

function currentRuleLabel() {
  const rule = currentRule();
  return rule?.name || rule?.short_name || "主办方口径：验收为完成门槛";
}

function isDemoBatch() {
  return isDemoDatasetSource(state.claimSource)
    || isDemoDatasetSource(state.noticeSource)
    || state.notices.some((notice) => E.deriveSourceMarker(notice) === E.DEMO_SOURCE_MARKER);
}

function currentBatchSourceMarker() {
  return isDemoBatch() ? E.DEMO_SOURCE_MARKER : "";
}

function applyCurrentRule(results) {
  if (typeof E.applyEligibility !== "function" || !currentRule()) return results;
  return E.applyEligibility(results, currentRule());
}

function isDemoDatasetSource(source) {
  return ["虚构演示任务", "虚构演示公告"].includes(E.asString(source));
}

function claimsPayloadIsDemo(text, fileName = "") {
  const prefix = E.asString(text).slice(0, 2000);
  return /demo[_-]?claims/i.test(E.asString(fileName))
    || /"source_marker"\s*:\s*"DEMO_ONLY"/i.test(prefix)
    || /"notice"\s*:\s*"[^"]*虚构演示/i.test(prefix);
}

function noticeDataMode(notices = state.notices) {
  if (!notices.length) return "empty";
  const demoCount = notices.filter((notice) => E.deriveSourceMarker(notice) === E.DEMO_SOURCE_MARKER).length;
  if (demoCount === notices.length) return "demo";
  if (demoCount > 0) return "mixed";
  return "real";
}

function claimDataMode() {
  if (!state.claims.length) return "empty";
  return isDemoDatasetSource(state.claimSource) ? "demo" : "real";
}

function hasMixedDataModes() {
  if (!state.claims.length || !state.notices.length) return false;
  const noticeMode = noticeDataMode();
  return noticeMode === "mixed" || claimDataMode() !== noticeMode;
}

function renderDatasetContext() {
  if (!elements.datasetContext) return;
  const demo = isDemoBatch();
  const mode = demo ? "demo" : state.datasetMode;
  elements.datasetContext.dataset.mode = mode;
  elements.datasetContext.classList.toggle("demo-only", demo);
  if (demo) {
    elements.datasetContext.innerHTML = `
      <strong><span class="dataset-source-marker">${E.DEMO_SOURCE_MARKER}</span> 当前批次 · 虚构演示</strong>
      <span>${formatNumber(state.claims.length)} 条虚构声明 · ${formatNumber(state.notices.length)} 条虚构候选；页面与导出均不可作为真实项目证据。</span>`;
    return;
  }
  if (mode === "official_catalog") {
    elements.datasetContext.innerHTML = `<strong>当前批次 · 官网候选目录（研究版）</strong><span>${formatNumber(state.claims.length)} 条声明 · ${formatNumber(state.notices.length)} 条候选记录；目录覆盖不等于事实支持。</span>`;
    return;
  }
  if (mode === "manual") {
    elements.datasetContext.innerHTML = `<strong>当前批次 · 手动导入</strong><span>${formatNumber(state.claims.length)} 条声明 · ${formatNumber(state.notices.length)} 条候选记录；完成状态统一以验收为最低门槛。</span>`;
    return;
  }
  elements.datasetContext.innerHTML = "<strong>当前批次 · 尚未导入</strong><span>导入真实数据或载入虚构演示后，这里会持续显示批次来源。</span>";
}

function clearClaimsStatus(message = "尚未导入") {
  state.claims = [];
  state.claimSource = "";
  state.claimImportStats = null;
  elements.claimsStatus.textContent = message;
  elements.claimsStatus.classList.remove("ready");
}

function clearNoticesStatus(message = "尚未导入") {
  state.notices = [];
  state.noticeSource = "";
  state.noticeImportStats = null;
  elements.noticesStatus.textContent = message;
  elements.noticesStatus.classList.remove("ready");
}

function setDatasetMode(mode, summary = null) {
  state.datasetMode = mode;
  state.catalogSummary = mode === "official_catalog" ? summary : null;
  if (elements.catalogBanner) elements.catalogBanner.hidden = mode !== "official_catalog";
  elements.catalogBanner?.classList.toggle("loaded", mode === "official_catalog");
  if (mode === "official_catalog") {
    const completed = Number(summary?.completed_claims) || state.claims.length;
    const covered = Number(summary?.official_coverage_claims) || 0;
    const links = Number(summary?.unique_official_links) || 0;
    const manual = Number(summary?.still_manual_claims) || state.claims.length;
    if (elements.catalogSummaryTitle) {
      elements.catalogSummaryTitle.textContent = `${formatNumber(completed)} 条均有查询记录；${formatNumber(covered)} 条为“可靠官方候选目录覆盖”，不是事实支持`;
    }
    if (elements.catalogSummaryDetail) {
      elements.catalogSummaryDetail.textContent = `${formatNumber(links)} 个去重官网链接已编目；${formatNumber(manual)} 条最终仍全部需有权人员确认。中标材料不单独证明已开展或已完成。`;
    }
    if (elements.catalogLoadState) {
      elements.catalogLoadState.textContent = `已载入：${formatNumber(state.claims.length)} 条声明 · ${formatNumber(state.notices.length)} 条可比对记录`;
    }
  } else if (elements.catalogLoadState) {
    elements.catalogLoadState.textContent = mode === "demo"
      ? "当前为虚构演示数据"
      : mode === "manual" ? "当前为手动导入数据" : "尚未载入工作台";
  }
  renderDatasetContext();
}

let toastTimer;
function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => elements.toast.classList.add("hidden"), 3200);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("文件读取失败。"));
    reader.readAsText(file, "UTF-8");
  });
}

function resetDatasetView() {
  closeDrawer(true);
  elements.search.value = "";
  elements.statusFilter.value = "all";
  state.activeQueue = "all";
  state.roadshowStep = 0;
}

function pendingResults() {
  const results = state.claims.map((claim) => ({
    claim,
    bestCandidate: null,
    candidates: [],
    project: { status: "pending", label: "尚未运行" },
    entity: { status: "pending", label: "尚未运行" },
    evidenceStage: "none",
    eligibility: { status: "not_assessed", label: "尚未运行核验" },
    overall: "pending",
    reasons: ["导入公告数据后运行批量核验。"]
  }));
  return applyCurrentRule(results);
}

async function importFile(kind, file) {
  if (!file) return;
  try {
    let resetMessage = "";
    const text = await readFile(file);
    const rows = E.parseDatasetText(text, file.name);
    if (!rows.length) throw new Error("没有读取到数据行。请检查文件顶层是否包含数组或 data 字段。");

    if (kind === "claims") {
      const incomingClaimMode = claimsPayloadIsDemo(text, file.name) ? "demo" : "real";
      const normalized = E.normalizeClaims(rows);
      const claims = normalized.filter((row) => !E.isMissingPlaceholder(row.company) || !E.isMissingPlaceholder(row.projectName));
      const rejected = rows.length - claims.length;
      if (!claims.length) throw new Error("没有识别到公司名称或业绩项目名称。请检查表头。 ");
      resetDatasetView();
      const existingNoticeMode = noticeDataMode();
      if (existingNoticeMode !== "empty" && (existingNoticeMode === "mixed" || existingNoticeMode !== incomingClaimMode)) {
        const clearedNoticeCount = state.notices.length;
        clearNoticesStatus("已清除另一模式公告 · 请导入同模式候选公告");
        resetMessage = `为避免混用，已自动清除 ${formatNumber(clearedNoticeCount)} 条另一模式公告。`;
      }
      state.claims = claims;
      state.claimSource = incomingClaimMode === "demo" ? "虚构演示任务" : file.name;
      state.results = pendingResults();
      state.hasRun = false;
      state.lastRunMs = 0;
      state.claimImportStats = { total: rows.length, accepted: claims.length, rejected };
      elements.claimsStatus.textContent = `${file.name} · 成功 ${formatNumber(claims.length)}/${formatNumber(rows.length)}${rejected ? ` · 隔离 ${formatNumber(rejected)}` : ""}`;
      elements.claimsStatus.classList.add("ready");
    } else {
      const normalized = E.normalizeNotices(rows);
      const notices = normalized.filter((row) => !E.isMissingPlaceholder(row.projectName) || !E.isMissingPlaceholder(row.sourceTitle));
      const incomingMode = noticeDataMode(notices);
      // 一条规范公告可能展开为多家供应商记录；隔离数必须以展开后的记录为分母，不能出现负数。
      const rejected = normalized.length - notices.length;
      if (!notices.length) throw new Error("没有识别到项目名称或公告标题。请检查表头。 ");
      if (incomingMode === "mixed") throw new Error("同一公告文件同时包含虚构演示与非演示记录，已拒绝导入，避免形成混合结论。");
      resetDatasetView();
      if (state.claims.length && claimDataMode() !== incomingMode) {
        clearClaimsStatus("已清除另一模式任务 · 请导入同模式待核查声明");
        resetMessage = "为避免混用，已自动清除另一模式的待核查任务。";
      }
      state.notices = notices;
      state.noticeSource = incomingMode === "demo" ? "虚构演示公告" : file.name;
      state.results = pendingResults();
      state.hasRun = false;
      state.lastRunMs = 0;
      state.noticeImportStats = {
        total: rows.length,
        accepted: notices.length,
        rejected,
        expanded: normalized.length
      };
      elements.noticesStatus.textContent = `${file.name} · 公告 ${formatNumber(rows.length)} 条 · 可比对记录 ${formatNumber(notices.length)} 条${rejected ? ` · 隔离 ${formatNumber(rejected)}` : ""}`;
      elements.noticesStatus.classList.add("ready");
    }

    setDatasetMode("manual");
    refreshAll();
    const stats = kind === "claims" ? state.claimImportStats : state.noticeImportStats;
    if (kind === "notices") {
      showToast(`${resetMessage}${resetMessage ? " " : ""}本地读取 ${formatNumber(stats.total)} 条公告，展开 ${formatNumber(stats.expanded)} 条供应商记录：可用 ${formatNumber(stats.accepted)} 条，隔离 ${formatNumber(stats.rejected)} 条。`);
    } else {
      const nextStep = state.notices.length ? "" : " 当前 MVP 不会自动联网搜索，请继续导入候选公告。";
      showToast(`${resetMessage}${resetMessage ? " " : ""}本地读取 ${formatNumber(stats.total)} 条：成功 ${formatNumber(stats.accepted)} 条，隔离 ${formatNumber(stats.rejected)} 条。${nextStep}`);
    }
  } catch (error) {
    showToast(error.message || "导入失败，请检查文件格式。");
  } finally {
    elements.claimsFile.value = "";
    elements.noticesFile.value = "";
  }
}

async function loadOfficialCatalog() {
  const catalogRoot = "../research/official_source_catalog_175";
  elements.loadOfficialCatalog.disabled = true;
  elements.loadOfficialCatalog.textContent = "载入中…";
  try {
    const [claimResponse, noticeResponse, summaryResponse] = await Promise.all([
      fetch(`${catalogRoot}/workbench/claims_175.schema.json`),
      fetch(`${catalogRoot}/workbench/official_notices.schema.json`),
      fetch(`${catalogRoot}/reports/summary.json`)
    ]);
    if (!claimResponse.ok || !noticeResponse.ok || !summaryResponse.ok) {
      throw new Error("官网候选目录读取失败，请通过 run_demo.command 启动。");
    }
    const [claimPayload, noticePayload, summary] = await Promise.all([
      claimResponse.json(),
      noticeResponse.json(),
      summaryResponse.json()
    ]);
    const rawClaims = Array.isArray(claimPayload.records) ? claimPayload.records : [];
    const rawNotices = Array.isArray(noticePayload.records) ? noticePayload.records : [];
    const claims = E.normalizeClaims(rawClaims)
      .filter((row) => !E.isMissingPlaceholder(row.company) || !E.isMissingPlaceholder(row.projectName));
    const normalizedNotices = E.normalizeNotices(rawNotices);
    const notices = normalizedNotices
      .filter((row) => !E.isMissingPlaceholder(row.projectName) || !E.isMissingPlaceholder(row.sourceTitle));
    if (!claims.length || !notices.length) throw new Error("官网候选目录中没有可用记录。");

    resetDatasetView();
    elements.claimsFile.value = "";
    elements.noticesFile.value = "";
    state.claims = claims;
    state.notices = notices;
    state.results = [];
    state.hasRun = false;
    state.lastRunMs = 0;
    state.claimSource = "175 条官网来源目录 · 待核查声明";
    state.noticeSource = "官方候选目录（研究版）";
    state.claimImportStats = {
      total: rawClaims.length,
      accepted: claims.length,
      rejected: rawClaims.length - claims.length
    };
    state.noticeImportStats = {
      total: rawNotices.length,
      accepted: notices.length,
      rejected: normalizedNotices.length - notices.length,
      expanded: normalizedNotices.length
    };
    elements.claimsStatus.textContent = `官网来源目录待核查声明 · ${formatNumber(claims.length)} 条`;
    elements.noticesStatus.textContent = `官方候选目录（研究版） · ${formatNumber(rawNotices.length)} 份材料 → ${formatNumber(notices.length)} 条可比对记录`;
    elements.claimsStatus.classList.add("ready");
    elements.noticesStatus.classList.add("ready");
    setDatasetMode("official_catalog", summary);
    await runMatching();
    setDatasetMode("official_catalog", summary);
    showToast(`已按引擎自然计算 ${formatNumber(state.results.length)} 条。目录覆盖不等于事实支持，全部仍需有权人员确认。`);
  } catch (error) {
    showToast(error.message || "官网候选目录载入失败。");
  } finally {
    elements.loadOfficialCatalog.disabled = false;
    elements.loadOfficialCatalog.textContent = "载入官网候选目录（研究版）";
  }
}

async function loadDemo() {
  try {
    const [claimResponse, noticeResponse] = await Promise.all([
      fetch("../sample_data/demo_claims.json"),
      fetch("../sample_data/demo_notices.json")
    ]);
    if (!claimResponse.ok || !noticeResponse.ok) throw new Error("演示数据读取失败，请通过 run_demo.command 启动。");
    const claimsData = await claimResponse.json();
    const noticesData = await noticeResponse.json();
    resetDatasetView();
    state.demoCase = "manual";
    state.claims = E.normalizeClaims(claimsData.data || []);
    state.notices = E.normalizeNotices(noticesData.data || []);
    state.claimSource = "虚构演示任务";
    state.noticeSource = "虚构演示公告";
    state.claimImportStats = { total: state.claims.length, accepted: state.claims.length, rejected: 0 };
    state.noticeImportStats = { total: state.notices.length, accepted: state.notices.length, rejected: 0 };
    elements.claimsStatus.textContent = `虚构演示任务 · ${state.claims.length} 条`;
    elements.noticesStatus.textContent = `虚构演示公告 · ${state.notices.length} 条`;
    elements.claimsStatus.classList.add("ready");
    elements.noticesStatus.classList.add("ready");
    setDatasetMode("demo");
    await runMatching();
    showToast("已载入虚构边界案例，不含真实企业信息。");
  } catch (error) {
    showToast(error.message);
  }
}

async function runMatching() {
  if (!state.claims.length || !state.notices.length) {
    const message = state.claims.length && !state.notices.length
      ? "已导入待核查声明，但尚未导入候选公告。当前 MVP 不会自动联网搜索，尚不能形成核验结果。"
      : "请先同时导入待核查任务和公告数据。";
    showToast(message);
    return;
  }
  if (hasMixedDataModes()) {
    showToast("真实数据不能与虚构演示数据混用。请重新导入同一类型的任务与公告。");
    return;
  }
  elements.run.disabled = true;
  elements.run.textContent = "核验中…";
  showToast(`正在本地初筛 ${formatNumber(state.claims.length)} 条任务，请稍候。`);
  await new Promise((resolve) => window.setTimeout(resolve, 40));
  try {
    const started = performance.now();
    const factResults = E.runMatching(state.claims, state.notices);
    state.results = applyCurrentRule(factResults);
    state.lastRunMs = performance.now() - started;
    state.hasRun = true;
    refreshAll();
    showToast(`完成 ${formatNumber(state.results.length)} 条初筛，用时 ${Math.max(1, Math.round(state.lastRunMs))} 毫秒。`);
  } finally {
    elements.run.textContent = "开始批量核验";
    refreshButtons();
  }
}

function statusPill(status, label) {
  const safeStatus = ["supported", "conflict", "review", "insufficient", "pending"].includes(status)
    ? status
    : "pending";
  return `<span class="status-pill ${safeStatus}">${escapeHTML(label || E.STATUS_LABELS[safeStatus])}</span>`;
}

function stagePill(stage) {
  return `<span class="stage-pill">${escapeHTML(E.STAGE_LABELS[stage] || E.STAGE_LABELS.unknown)}</span>`;
}

function evidenceMaterialContext(result) {
  const stageLabel = E.STAGE_LABELS[result?.evidenceStage] || E.STAGE_LABELS.unknown;
  if (!result?.bestCandidate) return { confirmed: false, label: "无可靠候选材料", detail: "尚未形成材料阶段" };
  if (result.overall === "supported") {
    return { confirmed: true, label: `最高已确认：${stageLabel}`, detail: "项目与主体关系已有证据支持" };
  }
  return { confirmed: false, label: `候选文种：${stageLabel}`, detail: "尚未确认属于该业绩" };
}

function stagePillForResult(result) {
  const context = evidenceMaterialContext(result);
  return `<span class="stage-pill ${context.confirmed ? "confirmed" : "candidate-only"}">${escapeHTML(context.label)}</span>`;
}

function eligibilityPill(eligibility) {
  const statusClass = ({
    meets: "supported",
    insufficient_evidence: "insufficient",
    not_assessed: "review",
    not_configured: "pending"
  })[eligibility?.status] || "pending";
  return statusPill(statusClass, eligibility?.label || "尚未预检");
}

function queuePill(result) {
  const queue = deriveWorkQueue(result);
  return `<span class="queue-pill ${escapeHTML(queue || "pending")}">${escapeHTML(WORK_QUEUE_LABELS[queue] || "尚未分流")}</span>`;
}

function filteredResults() {
  const status = elements.statusFilter.value;
  const query = E.normalizeText(elements.search.value);
  return state.results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => status === "all" || result.overall === status)
    .filter(({ result }) => state.activeQueue === "all" || deriveWorkQueue(result) === state.activeQueue)
    .filter(({ result }) => {
      if (!query) return true;
      const haystack = E.normalizeText([
        result.claim.company,
        result.claim.projectName,
        result.bestCandidate?.notice?.projectName,
        result.bestCandidate?.notice?.supplierName
      ].join(" "));
      return haystack.includes(query);
    });
}

function renderResults() {
  if (elements.queueCountLabel) elements.queueCountLabel.textContent = `${formatNumber(state.results.length)} 条`;
  if (state.claims.length && !state.notices.length) {
    elements.resultsBody.innerHTML = `
      <tr class="empty-row"><td colspan="9"><div class="empty-state">
        <div class="empty-icon">⌕</div>
        <strong>已导入 ${formatNumber(state.claims.length)} 条待核查声明，但还没有候选公告</strong>
        <span>当前 MVP 不会自动联网搜索；导入官方公告或候选目录后，才能形成核验结果。</span>
      </div></td></tr>`;
    return;
  }

  if (!state.claims.length && state.notices.length) {
    elements.resultsBody.innerHTML = `
      <tr class="empty-row"><td colspan="9"><div class="empty-state compact">
        <strong>已导入候选公告，还需导入待核查声明</strong>
        <span>系统不会把公告自动当成某家企业的业绩。</span>
      </div></td></tr>`;
    return;
  }

  if (hasMixedDataModes()) {
    elements.resultsBody.innerHTML = `
      <tr class="empty-row"><td colspan="9"><div class="empty-state compact">
        <strong>检测到真实数据与虚构演示数据混用</strong>
        <span>请重新导入同一类型的任务与候选公告，当前状态不运行核验。</span>
      </div></td></tr>`;
    return;
  }

  if (!state.results.length) {
    elements.resultsBody.innerHTML = `
      <tr class="empty-row"><td colspan="9"><div class="empty-state">
        <div class="empty-icon">⌁</div>
        <strong>先导入数据，或载入虚构演示</strong>
        <span>真实数据不会被自动发送到任何外部服务。</span>
      </div></td></tr>`;
    return;
  }

  const rows = filteredResults();
  if (elements.queueCountLabel) elements.queueCountLabel.textContent = `${formatNumber(rows.length)} 条`;
  if (!rows.length) {
    elements.resultsBody.innerHTML = `
      <tr class="empty-row"><td colspan="9"><div class="empty-state compact">
        <strong>当前筛选条件下没有记录</strong>
        <span>尝试切换状态或清空搜索词。</span>
      </div></td></tr>`;
    return;
  }

  elements.resultsBody.innerHTML = rows.map(({ result, index }) => {
    const claim = result.claim;
    const candidate = result.bestCandidate?.notice;
    const score = result.bestCandidate ? scoreLabel(result.bestCandidate.score) : "—";
    const demoMarker = E.deriveSourceMarker(candidate) === E.DEMO_SOURCE_MARKER
      ? `<span class="demo-evidence-marker row-demo-marker">${E.DEMO_SOURCE_MARKER}</span>`
      : "";
    return `
      <tr>
        <td data-label="序号">${escapeHTML(claim.id)}</td>
        <td data-label="自报业绩"><span class="cell-primary">${escapeHTML(claim.company || "字段缺失")}</span><span class="cell-secondary">${escapeHTML(claim.projectName || "字段缺失")}</span></td>
        <td data-label="最佳候选">${demoMarker}<span class="cell-primary">${escapeHTML(candidate?.projectName || "未找到可靠候选")}</span><span class="cell-secondary">排序分 ${score} · 只决定阅读顺序</span></td>
        <td data-label="同一项目">${statusPill(result.project.status, result.project.label)}</td>
        <td data-label="同一主体">${statusPill(result.entity.status, result.entity.label)}</td>
        <td data-label="材料阶段">${stagePillForResult(result)}</td>
        <td data-label="事实状态">${statusPill(result.overall, E.STATUS_LABELS[result.overall])}</td>
        <td data-label="工作人员队列">${queuePill(result)}</td>
        <td data-label="证据详情"><button class="detail-button" data-result-index="${index}" aria-label="查看 ${escapeHTML(claim.company || claim.projectName || claim.id)} 的证据详情">›</button></td>
      </tr>`;
  }).join("");
}

function renderMetrics() {
  const counts = { completed: 0, conducted: 0, award_only: 0, manual: 0, needs_evidence: 0 };
  state.results.forEach((result) => {
    const queue = deriveWorkQueue(result);
    if (counts[queue] !== undefined) counts[queue] += 1;
  });
  elements.metricCompleted.textContent = formatNumber(counts.completed);
  elements.metricConducted.textContent = formatNumber(counts.conducted);
  elements.metricAwardOnly.textContent = formatNumber(counts.award_only);
  elements.metricManual.textContent = formatNumber(counts.manual);
  elements.metricNeedsEvidence.textContent = formatNumber(counts.needs_evidence);
  document.querySelectorAll("[data-work-queue]").forEach((button) => {
    button.classList.toggle("active", button.dataset.workQueue === state.activeQueue);
  });
}

function activeRoadshowResult() {
  if (!isDemoBatch()) return null;
  const targetId = ({ contract: "5", acceptance: "6", manual: "2", insufficient: "4" })[state.demoCase] || "2";
  return state.results.find((result) => E.asString(result.claim?.id) === targetId)
    || state.results.find((result) => state.demoCase === "manual"
      ? ["conflict", "review"].includes(result.overall)
      : state.demoCase === "insufficient" ? result.overall === "insufficient"
        : result.overall === "supported" && result.evidenceStage === (state.demoCase === "acceptance" ? "acceptance" : "contract"))
    || state.results[0]
    || null;
}

function roadshowDemoMarker(result) {
  const marker = E.deriveSourceMarker(result?.bestCandidate?.notice);
  return marker === E.DEMO_SOURCE_MARKER
    ? `<span class="demo-evidence-marker">${E.DEMO_SOURCE_MARKER} · 虚构案例</span>`
    : "";
}

function compareFieldValues(claimValue, candidateValue, kind = "text", similarityThreshold = 0.9) {
  if (E.isMissingPlaceholder(claimValue) || E.isMissingPlaceholder(candidateValue)) {
    return { status: "insufficient", label: "字段缺失", similarity: null };
  }
  const normalize = kind === "identifier" ? E.normalizeIdentifier : kind === "entity" ? E.normalizeEntity : E.normalizeText;
  const claimNormalized = normalize(claimValue);
  const candidateNormalized = normalize(candidateValue);
  if (claimNormalized && claimNormalized === candidateNormalized) {
    return { status: "supported", label: "精确相同", similarity: 1 };
  }
  if (kind === "identifier") {
    return { status: "conflict", label: "明确不同", similarity: null };
  }
  const similarity = E.diceSimilarity(claimNormalized, candidateNormalized);
  if (similarity >= similarityThreshold) {
    return { status: "review", label: "名称相似", similarity };
  }
  return { status: "review", label: "名称不同待核", similarity };
}

function fieldCompareRow(label, claimValue, candidateValue, status, note = "", stateLabel = "") {
  const statusLabel = stateLabel || ({ supported: "精确相同", conflict: "明确冲突", review: "待复核", insufficient: "字段缺失" })[status] || "未比较";
  return `<div class="field-compare-row">
    <strong>${escapeHTML(label)}</strong>
    <span><small>申报值</small>${escapeHTML(claimValue || "未提供")}</span>
    <span><small>候选值</small>${escapeHTML(candidateValue || "未提供")}</span>
    <em class="compare-state ${escapeHTML(status || "pending")}">${escapeHTML(statusLabel)}</em>
    ${note ? `<p>${escapeHTML(note)}</p>` : ""}
  </div>`;
}

function evidenceStageTrack(result) {
  const current = result?.evidenceStage || "none";
  const context = evidenceMaterialContext(result);
  const stages = [
    { key: "award", title: "中标／成交", outcome: "只证明被选中" },
    { key: "contract", title: "合同", outcome: "可支持曾开展" },
    { key: "acceptance", title: "验收", outcome: "进入已完成候选" }
  ];
  return `<div class="stage-track-context ${context.confirmed ? "confirmed" : "candidate-only"}"><strong>${escapeHTML(context.label)}</strong><span>${escapeHTML(context.detail)}。下方展示的是三种门槛含义，不代表三类文件已经全部收齐。</span></div><div class="evidence-stage-track">${stages.map((stage, index) => {
    const active = current === stage.key;
    return `<div class="evidence-stage-node ${active ? "active" : ""}">
      <span>${index + 1}</span><strong>${stage.title}</strong><small>${active ? `当前最高文种 · ${stage.outcome}` : stage.outcome}</small>
    </div>`;
  }).join("")}</div>`;
}

function sufficiencyBreakdown(result) {
  const sufficiency = evidenceSufficiency(result);
  const relationScore = sufficiency.parts
    .filter((part) => ["project", "entity"].includes(part.key))
    .reduce((sum, part) => sum + part.score, 0);
  const completionGate = result?.overall !== "supported"
    ? "关系尚未稳定确认"
    : result.evidenceStage === "acceptance" ? "已到验收，进入完成候选"
      : result.evidenceStage === "contract" ? "只到合同，尚未证明完成" : "只到中标，尚未证明开展";
  return `<div class="sufficiency-panel">
    <div class="sufficiency-boundary-grid"><div><span>项目＋主体关系材料</span><strong>${relationScore}/60</strong></div><div><span>履约完成硬门槛</span><strong>${escapeHTML(completionGate)}</strong></div></div>
    <div class="sufficiency-score">
      <div class="score-ring" style="--score:${sufficiency.score}"><strong>${sufficiency.score}</strong><span>/100</span></div>
      <div><span>材料齐备度 · 团队内部排队指标</span><strong>${escapeHTML(sufficiency.label)}</strong><small>只表示材料字段是否齐备；不是主办方评分，不是真实性概率，也不能越过验收门槛。</small></div>
    </div>
    <div class="sufficiency-bars">${sufficiency.parts.map((part) => `
      <div class="sufficiency-row"><span>${escapeHTML(part.label)}</span><div><i style="width:${Math.round((part.score / part.max) * 100)}%"></i></div><strong>${part.score}/${part.max}</strong><small>${escapeHTML(part.detail)}</small></div>`).join("")}</div>
    ${sufficiency.gates.length ? `<div class="hard-gate-box"><strong>硬门槛</strong><ul>${sufficiency.gates.map((gate) => `<li>${escapeHTML(gate)}</li>`).join("")}</ul></div>` : ""}
  </div>`;
}

function renderRoadshowStep(result) {
  if (!result) {
    return `<div class="roadshow-empty"><strong>正在准备虚构演示案例</strong><span>路演模式只使用 DEMO_ONLY 数据，不会把真实数据发送到外部服务。</span><button class="button primary" type="button" data-roadshow-load-demo>载入虚构案例</button></div>`;
  }
  const claim = result.claim;
  const candidateItem = result.bestCandidate;
  const candidate = candidateItem?.notice;
  const queue = deriveWorkQueue(result);
  const marker = roadshowDemoMarker(result);
  const sourceTitle = candidate?.sourceTitle || candidate?.projectName || candidate?.noticeType || "未找到可核候选";
  const sourcePlatform = candidate?.sourcePlatform || "来源待确认";
  const sourceExcerpt = candidate?.sourceExcerpt || "当前候选没有可核原文引句。";
  const concern = result.entity?.status === "conflict"
    ? "候选材料指向同一项目，但供应商统一社会信用代码不同；当前不能认定为同一法律主体。"
    : result.project?.status === "conflict"
      ? "项目编号或包组等硬字段存在冲突；当前不能认定为同一项目。"
      : result.overall === "review"
        ? "名称相似或企业关系复杂，仍缺少能够排除歧义的桥接材料。"
        : result.overall === "insufficient" ? "当前范围内没有形成能支持结论的可靠候选。"
          : result.evidenceStage === "contract" ? "只有合同材料，还缺验收材料。"
            : result.evidenceStage === "award" ? "只有中标线索，尚未证明签约或履约。" : "已到验收材料，仍等待有权人员最终确认。";
  const nextAction = result.overall === "conflict"
    ? "核验企业更名、集团关系或投标材料填写情况"
    : result.overall === "review" ? "补主体桥接、联合体或分支机构材料后人工复核"
      : result.overall === "insufficient" ? "补项目编号、信用代码和合同／验收材料，再扩大检索"
        : result.evidenceStage === "contract" ? "向投标文件或采购人补取验收材料"
          : result.evidenceStage === "acceptance" ? "交工作人员复核原文并作最终确认" : "补合同或验收材料后重新核验";

  if (state.roadshowStep === 0) {
    return `<article class="journey-card statement-step">
      ${marker}
      <div class="journey-kicker">画面 1 · 企业自报</div>
      <h3>工作人员拿到的，只是一句待核声明</h3>
      <p class="journey-lead">它说明“谁声称做过什么”，但还没有现成结论。</p>
      <div class="statement-grid demo-input-grid">
        <div><span>本次投标公司</span><strong>${escapeHTML(claim.company)}</strong></div>
        <div><span>企业自报历史项目</span><strong>${escapeHTML(claim.projectName)}</strong></div>
      </div>
      <div class="input-boundary"><strong>输入边界</strong><span>企业声明 ≠ 已核实事实</span></div>
    </article>`;
  }

  if (state.roadshowStep === 1) {
    return `<article class="journey-card ai-step">
      ${marker}
      <div class="journey-kicker">画面 2 · 候选材料与原文</div>
      <h3>找到材料后，先保留原文，再抽出可核字段</h3>
      <div class="micro-process"><span><b>AI</b>找材料</span><i>→</i><span><b>AI</b>读原文</span><i>→</i><span><b>输出</b>候选字段＋引句</span></div>
      <div class="candidate-evidence-card">
        <div class="candidate-document">
          <span>候选材料 · ${escapeHTML(candidate?.noticeType || "文种未知")}</span>
          <strong>${escapeHTML(sourceTitle)}</strong>
          <small>${escapeHTML(sourcePlatform)} · ${escapeHTML(candidate?.publishDate || "日期未提供")}</small>
          <blockquote>“${escapeHTML(sourceExcerpt)}”</blockquote>
        </div>
        <div class="candidate-fields">
          ${detailPair("项目名称", candidate?.projectName)}
          ${detailPair("项目编号", candidate?.projectCode)}
          ${detailPair("供应商", candidate?.supplierName)}
          ${detailPair("供应商信用代码", candidate?.supplierCode)}
        </div>
      </div>
      <div class="ai-disclosure"><strong>能力边界</strong><span>当前主工作台接入已准备候选目录；“文本→字段＋原文引句”已在独立 AI 实验页验证，受控官网自动检索是正式升级项。</span></div>
    </article>`;
  }

  if (state.roadshowStep === 2) {
    const stageContext = evidenceMaterialContext(result);
    return `<article class="journey-card relation-step">
      ${marker}
      <div class="journey-kicker">画面 3 · 项目、企业和材料检查</div>
      <h3>系统不在“搜到网页”结束，而是继续问三个问题</h3>
      <div class="three-gates">
        <section class="gate-card ${escapeHTML(result.project.status)}"><span>1 · 对项目</span><strong>是不是同一项目？</strong>${statusPill(result.project.status, result.project.label)}<p>项目编号、包组和名称共同核对。</p></section>
        <section class="gate-card ${escapeHTML(result.entity.status)}"><span>2 · 核企业</span><strong>是不是同一法律主体？</strong>${statusPill(result.entity.status, result.entity.label)}<p>信用代码优先；更名、联合体等缺桥接材料就转人工。</p></section>
        <section class="gate-card stage"><span>3 · 看材料</span><strong>候选材料支持到哪一步？</strong>${stagePillForResult(result)}<p>${escapeHTML(stageContext.detail)}；中标、合同、验收不能跨级推断。</p></section>
      </div>
      <div class="visible-concern"><strong>本条存疑</strong><span>${escapeHTML(concern)}</span></div>
    </article>`;
  }

  return `<article class="journey-card result-step compact-task-output">
    ${marker}
    <div class="journey-kicker">画面 4 · 复核任务</div>
    <div class="task-output-heading"><div><span>当前结论</span><h3>${escapeHTML(WORK_QUEUE_LABELS[queue] || "待分流")}</h3><p>${escapeHTML(queueExplanation(queue))}</p></div>${statusPill(result.overall, E.STATUS_LABELS[result.overall])}</div>
    <div class="review-task-grid">
      <section class="task-evidence"><span>原文依据</span><blockquote>“${escapeHTML(sourceExcerpt)}”</blockquote></section>
      <section><span>信息来源</span><strong>${escapeHTML(sourcePlatform)}</strong><p>${escapeHTML(sourceTitle)} · ${escapeHTML(candidate?.publishDate || "日期未提供")}</p></section>
      <section class="task-concern"><span>存疑原因</span><strong>${escapeHTML(concern)}</strong></section>
      <section class="task-next"><span>下一步处理</span><strong>${escapeHTML(nextAction)}</strong></section>
    </div>
    <div class="task-principle"><strong>为什么这样判断，系统必须说清楚。</strong><span>该记录保留声明、候选材料、原文、判断理由和人工处置入口。</span></div>
  </article>`;
}

function treePathClass(...cases) {
  return cases.includes(state.demoCase) ? "is-path" : "";
}

function renderStrategyTree() {
  if (!elements.strategyTree) return;
  const caseLabels = {
    manual: "主体冲突 → 写明疑点 → 转人工",
    insufficient: "没有可靠候选 → 证据不足 → 转人工补证",
    contract: "项目与主体支持 → 材料只到合同 → 曾开展候选",
    acceptance: "项目与主体支持 → 材料到验收 → 已完成候选"
  };
  if (elements.strategyTreeCase) {
    elements.strategyTreeCase.textContent = `当前高亮：${caseLabels[state.demoCase] || caseLabels.manual}`;
  }
  const mainPath = treePathClass("manual", "contract", "acceptance", "insufficient");
  const relationPath = treePathClass("manual", "contract", "acceptance");
  const supportedPath = treePathClass("contract", "acceptance");
  elements.strategyTree.innerHTML = `<div class="tree-columns">
    <section class="tree-column">
      <div class="tree-node input ${mainPath}"><span>输入</span><strong>投标人自报</strong><small>公司＋历史项目</small></div>
    </section>
    <section class="tree-column">
      <div class="tree-node ai ${mainPath}"><span>AI</span><strong>有可核候选？</strong><small>保留来源和原文</small></div>
      <div class="tree-branch ${treePathClass("insufficient")}"><b>否</b><strong>证据不足</strong><small>不等于业绩虚假</small></div>
    </section>
    <section class="tree-column">
      <div class="tree-node rule ${relationPath}"><span>逻辑 1</span><strong>是同一项目？</strong><small>编号、包组、名称、采购人</small></div>
      <div class="tree-branch"><b>硬冲突</b><strong>字段冲突</strong><small>编号或包组对不上</small></div>
      <div class="tree-branch"><b>只有名称像</b><strong>人工复核</strong><small>名称相似不能单独证明</small></div>
    </section>
    <section class="tree-column">
      <div class="tree-node rule ${relationPath}"><span>逻辑 2</span><strong>是同一企业？</strong><small>信用代码、更名、联合体、分公司</small></div>
      <div class="tree-branch ${treePathClass("manual")}"><b>主体冲突</b><strong>写明疑点</strong><small>不直接宣布造假</small></div>
      <div class="tree-branch"><b>关系复杂</b><strong>补桥接材料</strong><small>更名、联合体、分支机构转人工</small></div>
    </section>
    <section class="tree-column stage-column">
      <div class="tree-node rule ${supportedPath}"><span>逻辑 3</span><strong>最高材料到哪步？</strong><small>材料先确认属于该项目</small></div>
      <div class="tree-stage-leaves">
        <div><b>中标</b><strong>只是线索</strong><small>未证明签约或履约</small></div>
        <div class="${treePathClass("contract")}"><b>合同</b><strong>曾开展候选</strong><small>尚未证明完成</small></div>
        <div class="${treePathClass("acceptance")}"><b>验收</b><strong>已完成候选</strong><small>达到最低完成门槛</small></div>
      </div>
    </section>
    <section class="tree-column">
      <div class="tree-node human ${mainPath}"><span>人工</span><strong>最终确认</strong><small>补证、记理由、留痕</small></div>
    </section>
  </div>`;
}

function openQAToolbox() {
  renderStrategyTree();
  if (typeof elements.qaToolbox?.showModal === "function") elements.qaToolbox.showModal();
  else elements.qaToolbox?.setAttribute("open", "");
}

function closeQAToolbox() {
  if (typeof elements.qaToolbox?.close === "function" && elements.qaToolbox.open) elements.qaToolbox.close();
  else elements.qaToolbox?.removeAttribute("open");
}

async function showRoadshowCase(caseName, step) {
  if (!isDemoBatch()) await loadDemo();
  state.demoCase = ["contract", "acceptance", "manual", "insufficient"].includes(caseName) ? caseName : "manual";
  setViewMode("roadshow");
  setRoadshowStep(step, true);
}

async function handleQAAction(action) {
  if (action === "tree") {
    renderStrategyTree();
    elements.strategyTree?.scrollIntoView({ block: "center" });
    return;
  }
  closeQAToolbox();
  if (action === "source") return showRoadshowCase("manual", 1);
  if (action === "insufficient") return showRoadshowCase("insufficient", 3);
  if (action === "complex") return showRoadshowCase("manual", 2);
  if (action === "batch") {
    setViewMode("workbench");
    if (state.datasetMode !== "official_catalog") await loadOfficialCatalog();
    setViewMode("workbench");
    document.querySelector("#work-queue")?.scrollIntoView({ block: "start" });
  }
}

function renderRoadshow() {
  if (!elements.roadshowStage) return;
  const step = ROADSHOW_STEPS[state.roadshowStep] || ROADSHOW_STEPS[0];
  const result = activeRoadshowResult();
  elements.roadshowStage.innerHTML = renderRoadshowStep(result);
  elements.roadshowProgressLabel.textContent = `画面 ${state.roadshowStep + 1} / ${ROADSHOW_STEPS.length}`;
  elements.roadshowProgressTitle.textContent = step.title;
  elements.roadshowProgressNote.textContent = step.note;
  elements.roadshowPrev.disabled = state.roadshowStep === 0;
  elements.roadshowNext.disabled = state.roadshowStep === ROADSHOW_STEPS.length - 1;
  elements.roadshowNext.textContent = step.next;
  elements.openActiveDetail.disabled = !result;
  if (elements.demoFocusLabel) {
    elements.demoFocusLabel.textContent = ({
      manual: "默认演示：项目对得上，企业主体有冲突",
      insufficient: "问答案例：当前证据不足",
      contract: "问答案例：材料只到合同",
      acceptance: "问答案例：材料到达验收"
    })[state.demoCase] || "虚构边界案例";
  }
  document.querySelectorAll("[data-roadshow-step]").forEach((button) => {
    const active = Number(button.dataset.roadshowStep) === state.roadshowStep;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-demo-case]").forEach((button) => {
    const active = button.dataset.demoCase === state.demoCase;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (elements.qaToolbox?.open) renderStrategyTree();
}

function setViewMode(mode) {
  state.viewMode = mode === "workbench" ? "workbench" : "roadshow";
  const roadshow = state.viewMode === "roadshow";
  document.body.classList.toggle("roadshow-mode", roadshow);
  elements.roadshowConsole.hidden = !roadshow;
  elements.staffWorkbench.hidden = roadshow;
  elements.roadshowMode.classList.toggle("active", roadshow);
  elements.workbenchMode.classList.toggle("active", !roadshow);
  elements.roadshowMode.setAttribute("aria-pressed", String(roadshow));
  elements.workbenchMode.setAttribute("aria-pressed", String(!roadshow));
  if (roadshow) renderRoadshow();
  else renderResults();
}

function setRoadshowStep(step, focusStage = false) {
  state.roadshowStep = Math.max(0, Math.min(ROADSHOW_STEPS.length - 1, Number(step) || 0));
  renderRoadshow();
  elements.roadshowStage?.focus({ preventScroll: true });
  if (focusStage) {
    requestAnimationFrame(() => elements.roadshowStage?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
}

function completeness(total, missing) {
  if (!total) return "—";
  return `${Math.round(((total - missing) / total) * 100)}%`;
}

function qualityRows(data, fields) {
  return fields.map(([label, key]) => `
    <div class="quality-row"><span>${escapeHTML(label)}</span><strong>${completeness(data.total, data[key])}</strong></div>
  `).join("");
}

function renderDataQuality() {
  if (!state.claims.length && !state.notices.length) {
    elements.qualityContent.innerHTML = `<div class="empty-state compact"><strong>尚未导入数据</strong><span>完成导入后，这里会显示缺失字段、公告类型和可核查比例。</span></div>`;
    elements.qualityAlert.classList.add("hidden");
    return;
  }

  const audit = E.auditQuality(state.claims, state.notices);
  const claimFields = [
    ["公司名称", "missingCompany"],
    ["公司信用代码", "missingCompanyCode"],
    ["项目名称", "missingProjectName"],
    ["项目编号", "missingProjectCode"],
    ["采购人", "missingPurchaser"],
    ["项目时间", "missingDate"]
  ];
  const noticeFields = [
    ["项目名称", "missingProjectName"],
    ["项目编号", "missingProjectCode"],
    ["历史供应商", "missingSupplierName"],
    ["供应商信用代码", "missingSupplierCode"],
    ["官方来源网址", "missingSourceUrl"]
  ];
  const stages = audit.notices.stageCounts;
  elements.qualityContent.innerHTML = `
    <div class="quality-definition">
      <strong>百分比 = 字段完整度</strong>
      <span>100% 只表示这一列每条都有值，不代表内容准确，也不代表业绩真实。</span>
    </div>
    <div class="quality-grid">
      <section class="quality-block"><h3>待核查任务字段完整度 · ${formatNumber(audit.claims.total)} 条</h3>${qualityRows(audit.claims, claimFields)}</section>
      <section class="quality-block"><h3>候选公告字段完整度 · ${formatNumber(audit.notices.total)} 条</h3>${qualityRows(audit.notices, noticeFields)}</section>
      <section class="quality-block">
        <h3>候选材料文种分布（非声明结论）</h3>
        <div class="quality-row"><span>验收/履约</span><strong>${formatNumber(stages.acceptance)}</strong></div>
        <div class="quality-row"><span>合同</span><strong>${formatNumber(stages.contract)}</strong></div>
        <div class="quality-row"><span>中标/成交</span><strong>${formatNumber(stages.award)}</strong></div>
        <div class="quality-row"><span>仅招标阶段</span><strong>${formatNumber(stages.solicitation)}</strong></div>
        <div class="quality-row"><span>类型未知</span><strong>${formatNumber(stages.unknown)}</strong></div>
      </section>
      <section class="quality-block">
        <h3>来源性质分布</h3>
        <div class="quality-row"><span>官方来源</span><strong>${formatNumber(audit.notices.officialityCounts.official)}</strong></div>
        <div class="quality-row"><span>获授权材料</span><strong>${formatNumber(audit.notices.officialityCounts.user_provided)}</strong></div>
        <div class="quality-row"><span>虚构演示模拟</span><strong>${formatNumber(audit.notices.officialityCounts.demo_official)}</strong></div>
        <div class="quality-row"><span>第三方候选目录</span><strong>${formatNumber(audit.notices.officialityCounts.aggregator)}</strong></div>
        <div class="quality-row"><span>来源待确认</span><strong>${formatNumber(audit.notices.officialityCounts.unknown)}</strong></div>
      </section>
      <section class="quality-block">
        <h3>当前运行信息</h3>
        <div class="quality-row"><span>任务来源</span><strong>${escapeHTML(state.claimSource || "未导入")}</strong></div>
        <div class="quality-row"><span>公告来源</span><strong>${escapeHTML(state.noticeSource || "未导入")}</strong></div>
        <div class="quality-row"><span>最近初筛耗时</span><strong>${state.lastRunMs ? `${Math.max(1, Math.round(state.lastRunMs))} ms` : "尚未运行"}</strong></div>
        <div class="quality-row"><span>外部自动上传</span><strong>无</strong></div>
      </section>
    </div>`;

  const warnings = [];
  if (audit.claims.total && !audit.notices.total) warnings.push("已导入待核查声明，但尚未导入候选公告；当前 MVP 不会自动联网搜索，尚不能形成核验结果");
  if (hasMixedDataModes()) warnings.push("检测到真实数据与虚构演示数据混用，已禁止运行匹配");
  if (audit.claims.total && audit.claims.missingCompanyCode / audit.claims.total > 0.5) warnings.push("多数待核查任务缺少投标人信用代码，企业主体只能先按名称辅助判断");
  if (audit.claims.total && audit.claims.missingProjectCode / audit.claims.total > 0.5) warnings.push("多数任务缺少项目编号，候选检索将较依赖项目名称");
  if (audit.notices.total && audit.notices.missingSupplierName / audit.notices.total > 0.5) warnings.push("多数公告没有中标供应商字段，可能以招标公告为主，不足以完成主体核对");
  if (audit.notices.total && audit.notices.missingSourceUrl / audit.notices.total > 0.5) warnings.push("多数公告没有官方原文网址，结果难以形成可追溯证据链");
  const nonAuthoritative = audit.notices.officialityCounts.aggregator + audit.notices.officialityCounts.unknown;
  if (audit.notices.total && nonAuthoritative / audit.notices.total > 0.2) warnings.push("部分公告是第三方目录或来源性质未知，只能找候选，不能直接支撑结论");
  if (warnings.length) {
    elements.qualityAlert.innerHTML = `<strong>数据提醒：</strong>${warnings.map(escapeHTML).join("；")}。`;
    elements.qualityAlert.classList.remove("hidden");
  } else {
    elements.qualityAlert.classList.add("hidden");
  }
}

function suggestedAction(status) {
  if (status === "supported") return "快速人工复核原始材料与完成状态，不自动直接通过。";
  if (status === "conflict") return "核查更名、联合体、合并或材料填写问题；由有权人员决定是否补证。";
  if (status === "review") return "补充企业信用代码、主体关系和项目编号后再判断。";
  return "补充项目编号、合同或验收材料；未检索到不等于虚假。";
}

function detailPair(label, value) {
  return `<div class="detail-pair"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value || "—")}</strong></div>`;
}

function openDrawer(index) {
  const result = state.results[index];
  if (!result) return;
  state.lastDrawerTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const claim = result.claim;
  const candidate = result.bestCandidate?.notice;
  const candidateScore = result.bestCandidate ? `${scoreLabel(result.bestCandidate.score)}（仅用于候选排序）` : "—";
  const url = safeURL(candidate?.sourceUrl);
  const sourceMarker = E.deriveSourceMarker(candidate);
  const isDemoSource = sourceMarker === E.DEMO_SOURCE_MARKER;
  const localReference = !url ? E.publicSourceReference(candidate) : "";
  const queue = deriveWorkQueue(result);
  const query = `${claim.projectName || ""} ${claim.company || ""}`.trim();
  const candidatesHTML = result.candidates.length
    ? result.candidates.map((item) => {
      const marker = E.deriveSourceMarker(item.notice);
      return `<div class="candidate-card">${marker ? `<span class="demo-evidence-marker">${E.DEMO_SOURCE_MARKER}</span>` : ""}<strong>${escapeHTML(item.notice.projectName || "无标题")}</strong><span>排序分 ${scoreLabel(item.score)} · 只决定阅读顺序</span><span>${escapeHTML(item.notice.noticeType || "类型未知")} · ${escapeHTML(item.notice.packageCode || "未提供包组")} · ${escapeHTML(item.notice.supplierName || "未提供供应商")} · ${escapeHTML(item.notice.awardStatus || item.notice.supplierRole || "角色未提供")}</span></div>`;
    }).join("")
    : `<div class="candidate-card"><strong>没有达到最低候选阈值的记录</strong><span>这表示现有数据不足，不表示业绩虚假。</span></div>`;

  const projectNameField = compareFieldValues(claim.projectName, candidate?.projectName, "text", 0.9);
  const projectCodeField = result.bestCandidate?.projectCodeTypeMismatch
    ? { status: "review", label: "编号类型不同" }
    : result.bestCandidate?.projectCodeConflict ? { status: "conflict", label: "编号冲突" }
      : compareFieldValues(claim.projectCode, candidate?.projectCode, "identifier");
  const packageField = result.bestCandidate?.packageConflict
    ? { status: "conflict", label: "包组冲突" }
    : compareFieldValues(claim.packageCode, candidate?.packageCode, "identifier");
  const purchaserField = compareFieldValues(claim.purchaser, candidate?.purchaser, "text", 0.82);
  const companyNameField = compareFieldValues(claim.company, candidate?.supplierName, "entity", 0.9);
  const companyCodeField = compareFieldValues(claim.companyCode, candidate?.supplierCode, "identifier");

  elements.drawerContent.innerHTML = `
    <div class="detail-summary">
      ${isDemoSource ? `<span class="demo-evidence-marker">${E.DEMO_SOURCE_MARKER} · 虚构演示证据</span>` : ""}
      <span class="detail-record-id">声明 ${escapeHTML(claim.id)}</span>
      <h3>${escapeHTML(claim.projectName || "未命名项目")}</h3>
      <p>${escapeHTML(claim.company || "未提供投标公司")}</p>
      <div class="detail-summary-pills">${queuePill(result)}${statusPill(result.overall, E.STATUS_LABELS[result.overall])}${stagePillForResult(result)}</div>
      <strong class="detail-quick-title">关键字段速览（完整逐字段对照见下方）</strong>
      <div class="detail-quick-compare">
        <div><span>项目名称字段</span><strong>${escapeHTML(projectNameField.label)}</strong><small>${escapeHTML(claim.projectName || "未提供")} ↔ ${escapeHTML(candidate?.projectName || "未提供")}</small></div>
        <div><span>企业信用代码字段</span><strong>${escapeHTML(companyCodeField.label)}</strong><small>${escapeHTML(claim.companyCode || "未提供")} ↔ ${escapeHTML(candidate?.supplierCode || "未提供")}</small></div>
      </div>
      <div class="detail-boundary"><strong>当前边界</strong><span>${escapeHTML(completionBoundary(result))}</span></div>
      <div class="detail-source-glance ${isDemoSource ? "demo-source" : ""}">
        <div><span>当前候选来源</span><strong>${escapeHTML(candidate?.sourceTitle || candidate?.projectName || "尚无可靠候选材料")}</strong><small>${escapeHTML(candidate?.sourcePlatform || "来源待确认")} · ${escapeHTML(candidate?.publishDate || "日期未提供")}</small></div>
        ${isDemoSource
          ? `<em>${E.DEMO_SOURCE_MARKER} · 无真实外链</em>`
          : (url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">打开来源 ↗</a>` : `<em>暂无可打开原文</em>`)}
      </div>
    </div>

    <section class="detail-section evidence-block" data-evidence-block="fact">
      <h3>1. 事实状态与工作人员队列</h3>
      <div class="drawer-gate-grid">
        <article><span>同一项目</span>${statusPill(result.project.status, result.project.label)}</article>
        <article><span>同一法律主体</span>${statusPill(result.entity.status, result.entity.label)}</article>
        <article><span>事实状态</span>${statusPill(result.overall, E.STATUS_LABELS[result.overall])}</article>
        <article><span>人工队列</span>${queuePill(result)}</article>
      </div>
      <p class="detail-explanation">${escapeHTML(queueExplanation(queue))}</p>
    </section>

    <section class="detail-section evidence-block" data-evidence-block="compare">
      <h3>2. 申报值与候选值逐字段对照</h3>
      <div class="field-compare-table compact">
        ${fieldCompareRow("项目名称", claim.projectName, candidate?.projectName, projectNameField.status, `名称相似度 ${result.bestCandidate ? scoreLabel(result.bestCandidate.titleScore) : "—"}；候选总排序分 ${candidateScore}`, projectNameField.label)}
        ${fieldCompareRow("项目编号", claim.projectCode, candidate?.projectCode, projectCodeField.status, result.bestCandidate?.projectCodeTypeMismatch ? "编号文本相同但类型不同，不按精确相等处理" : "同类型编号才可做硬匹配", projectCodeField.label)}
        ${fieldCompareRow("包组／标段", claim.packageCode, candidate?.packageCode, packageField.status, "未提供不等于冲突；明确不一致会触发硬门槛", packageField.label)}
        ${fieldCompareRow("采购人", claim.purchaser, candidate?.purchaser, purchaserField.status, `辅助相似度 ${result.bestCandidate ? scoreLabel(result.bestCandidate.purchaserScore) : "—"}`, purchaserField.label)}
        ${fieldCompareRow("企业名称", claim.company, candidate?.supplierName, companyNameField.status, "名称只作辅助；法律主体优先看统一社会信用代码与更名依据", companyNameField.label)}
        ${fieldCompareRow("信用代码", claim.companyCode, candidate?.supplierCode, companyCodeField.status, "明确不同会触发主体硬冲突", companyCodeField.label)}
      </div>
    </section>

    <section class="detail-section evidence-block" data-evidence-block="stage">
      <h3>3. 材料门槛与当前最高文种</h3>
      ${evidenceStageTrack(result)}
      <div class="detail-boundary"><strong>主办方固定口径</strong><span>中标只作线索；合同可支持曾开展；验收才达到已完成的最低证据门槛。</span></div>
    </section>

    <section class="detail-section evidence-block" data-evidence-block="sufficiency">
      <h3>4. 核验充分度（只用于人工排队）</h3>
      ${sufficiencyBreakdown(result)}
    </section>

    <section class="detail-section evidence-block" data-evidence-block="source">
      <h3>5. 最佳候选与可追溯来源</h3>
      <div class="source-card ${isDemoSource ? "demo-source" : ""}">
        ${isDemoSource ? `<span class="demo-evidence-marker">${E.DEMO_SOURCE_MARKER}</span>` : ""}
        <strong>${escapeHTML(candidate?.sourceTitle || candidate?.projectName || "未找到可靠候选")}</strong>
        <p>${escapeHTML(candidate?.sourceExcerpt || "尚无可核原文引句。")}</p>
        <dl>
          <div><dt>候选排序分</dt><dd>${escapeHTML(candidateScore)}</dd></div>
          <div><dt>公告类型</dt><dd>${escapeHTML(candidate?.noticeType || "—")}</dd></div>
          <div><dt>来源性质</dt><dd>${escapeHTML(E.OFFICIALITY_LABELS[result.sourceOfficiality] || "—")}</dd></div>
          <div><dt>来源平台</dt><dd>${escapeHTML(candidate?.sourcePlatform || "—")}</dd></div>
          <div><dt>发布日期</dt><dd>${escapeHTML(candidate?.publishDate || "—")}</dd></div>
          ${localReference ? `<div><dt>受控材料</dt><dd>${escapeHTML(localReference)}</dd></div>` : ""}
        </dl>
      </div>
      ${isDemoSource
        ? `<div class="candidate-card"><strong>DEMO_ONLY · 虚构演示</strong><span>本案例没有真实原文外链，不可作为任何项目的证据。</span></div>`
        : (url ? `<a class="evidence-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">打开原始来源 ↗</a>` : "")}
      <button class="copy-query" data-copy-query="${escapeHTML(query)}">复制人工搜索词</button>
    </section>

    <section class="detail-section evidence-block" data-evidence-block="action">
      <h3>6. 理由、缺口与人工下一步</h3>
      <ul class="reason-list">${result.reasons.map((reason) => `<li>${escapeHTML(reason)}</li>`).join("")}</ul>
      <ul class="reason-list"><li>${escapeHTML(suggestedAction(result.overall))}</li></ul>
    </section>

    <section class="detail-section">
      <h3>7. 其他候选材料</h3>
      ${candidatesHTML}
    </section>`;

  elements.drawer.classList.add("open");
  elements.drawer.setAttribute("aria-hidden", "false");
  elements.drawerBackdrop.classList.remove("hidden");
  document.body.classList.add("drawer-open");
  elements.drawerClose.focus({ preventScroll: true });
}

function closeDrawer(clearContent = false) {
  const wasOpen = elements.drawer.classList.contains("open");
  elements.drawer.classList.remove("open");
  elements.drawer.setAttribute("aria-hidden", "true");
  elements.drawerBackdrop.classList.add("hidden");
  document.body.classList.remove("drawer-open");
  if (clearContent === true) elements.drawerContent.replaceChildren();
  if (wasOpen && state.lastDrawerTrigger?.isConnected) state.lastDrawerTrigger.focus({ preventScroll: true });
}

function exportResults() {
  const exportRows = filteredResults().map(({ result }) => result);
  if (!exportRows.length) {
    showToast("当前筛选没有可导出的记录。");
    return;
  }
  const sourceMarker = currentBatchSourceMarker();
  const csv = E.toCsvBatch(exportRows, {
    sourceMarker,
    currentRuleLabel: currentRuleLabel()
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${sourceMarker ? `${sourceMarker}_` : ""}投标业绩核验结果_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(anchor.href);
  showToast(`${sourceMarker ? `${sourceMarker} · ` : ""}已导出当前筛选的 ${formatNumber(exportRows.length)} 条 CSV。`);
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(anchor.href);
}

function exportContractJSON() {
  const exportRows = filteredResults().map(({ result }) => result);
  if (!state.hasRun || !exportRows.length) {
    showToast("当前筛选没有可导出的记录。");
    return;
  }
  const sourceMarker = currentBatchSourceMarker();
  const payload = E.toContractBatch(exportRows, {
    claimsDatasetId: state.claimSource || "claims-local",
    noticesDatasetId: state.noticeSource || "notices-local",
    sourceMarker
  });
  downloadText(
    `${sourceMarker ? `${sourceMarker}_` : ""}投标业绩核验结果_规范版_${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8"
  );
  showToast(`${sourceMarker ? `${sourceMarker} · ` : ""}已导出当前筛选的 ${formatNumber(exportRows.length)} 条规范 JSON。`);
}

function refreshButtons() {
  elements.run.disabled = !(state.claims.length && state.notices.length) || hasMixedDataModes();
  const exportCount = state.hasRun ? filteredResults().length : 0;
  elements.export.disabled = !exportCount;
  elements.exportJSON.disabled = !exportCount;
  elements.export.textContent = exportCount ? `导出当前 ${formatNumber(exportCount)} 条核验表` : "导出当前筛选核验表";
  elements.exportJSON.textContent = exportCount ? `导出当前 ${formatNumber(exportCount)} 条 JSON` : "导出当前筛选 JSON";
}

function refreshAll() {
  renderDatasetContext();
  renderResults();
  renderMetrics();
  renderDataQuality();
  renderRoadshow();
  refreshButtons();
}

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".section").forEach((section) => section.classList.remove("active-section"));
      document.querySelector(`#${button.dataset.section}-section`)?.classList.add("active-section");
    });
  });
}

elements.claimsFile.addEventListener("change", (event) => importFile("claims", event.target.files[0]));
elements.noticesFile.addEventListener("change", (event) => importFile("notices", event.target.files[0]));
elements.loadOfficialCatalog.addEventListener("click", loadOfficialCatalog);
elements.loadDemo.addEventListener("click", loadDemo);
elements.run.addEventListener("click", runMatching);
elements.export.addEventListener("click", exportResults);
elements.exportJSON.addEventListener("click", exportContractJSON);
elements.statusFilter.addEventListener("change", () => { renderResults(); refreshButtons(); });
elements.search.addEventListener("input", () => { renderResults(); refreshButtons(); });
elements.drawerClose.addEventListener("click", closeDrawer);
elements.drawerBackdrop.addEventListener("click", closeDrawer);
elements.roadshowMode.addEventListener("click", async () => {
  if (!isDemoBatch()) await loadDemo();
  setViewMode("roadshow");
  elements.roadshowConsole?.scrollIntoView({ block: "start", behavior: "smooth" });
});
elements.workbenchMode.addEventListener("click", async () => {
  setViewMode("workbench");
  if (state.datasetMode !== "official_catalog") await loadOfficialCatalog();
  setViewMode("workbench");
  document.querySelector("#work-queue")?.scrollIntoView({ block: "start", behavior: "smooth" });
});
elements.roadshowPrev.addEventListener("click", () => setRoadshowStep(state.roadshowStep - 1, true));
elements.roadshowNext.addEventListener("click", () => setRoadshowStep(state.roadshowStep + 1, true));
elements.qaToolboxOpen.addEventListener("click", openQAToolbox);
elements.openQAFromDemo.addEventListener("click", openQAToolbox);
elements.qaToolboxClose.addEventListener("click", closeQAToolbox);
elements.qaToolbox.addEventListener("click", (event) => {
  if (event.target === elements.qaToolbox) closeQAToolbox();
  const actionButton = event.target.closest("[data-qa-action]");
  if (actionButton) void handleQAAction(actionButton.dataset.qaAction);
});
elements.openActiveDetail.addEventListener("click", () => {
  const result = activeRoadshowResult();
  const index = result ? state.results.indexOf(result) : -1;
  if (index >= 0) openDrawer(index);
});
elements.roadshowConsole.addEventListener("click", (event) => {
  const stepButton = event.target.closest("[data-roadshow-step]");
  if (stepButton) {
    setRoadshowStep(Number(stepButton.dataset.roadshowStep), true);
    return;
  }
  const caseButton = event.target.closest("[data-demo-case]");
  if (caseButton) {
    state.demoCase = ["contract", "acceptance", "manual", "insufficient"].includes(caseButton.dataset.demoCase)
      ? caseButton.dataset.demoCase
      : "manual";
    renderRoadshow();
    return;
  }
  if (event.target.closest("[data-roadshow-load-demo]")) loadDemo();
});
document.querySelector("#work-queue")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-work-queue]");
  if (!button) return;
  state.activeQueue = state.activeQueue === button.dataset.workQueue ? "all" : button.dataset.workQueue;
  renderMetrics();
  renderResults();
  refreshButtons();
  document.querySelector(".results-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDrawer();
    closeQAToolbox();
  }
  const interactive = event.target instanceof HTMLElement && event.target.closest("input, select, textarea, dialog[open], .detail-drawer.open");
  if (!interactive && state.viewMode === "roadshow" && event.key === "ArrowRight") {
    event.preventDefault();
    setRoadshowStep(state.roadshowStep + 1, true);
  }
  if (!interactive && state.viewMode === "roadshow" && event.key === "ArrowLeft") {
    event.preventDefault();
    setRoadshowStep(state.roadshowStep - 1, true);
  }
});
elements.resultsBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-result-index]");
  if (button) openDrawer(Number(button.dataset.resultIndex));
});
elements.drawerContent.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-query]");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.copyQuery);
    showToast("搜索词已复制。 ");
  } catch {
    showToast("浏览器未允许复制，请手动复制项目名与公司名。 ");
  }
});

setupNavigation();
refreshAll();
setViewMode("roadshow");
loadDemo();
