"use strict";

const MAX_CHARS = 20000;
const CLIENT_TIMEOUT_MS = 50000;

const elements = {
  text: document.querySelector("#source-text"),
  charCount: document.querySelector("#char-count"),
  includeAliases: document.querySelector("#include-aliases"),
  consent: document.querySelector("#online-consent"),
  loadDemo: document.querySelector("#load-demo"),
  call: document.querySelector("#call-deepseek"),
  offline: document.querySelector("#show-offline"),
  serviceStatus: document.querySelector("#service-status"),
  resultSection: document.querySelector("#result-section"),
  resultBanner: document.querySelector("#result-banner"),
  resultContent: document.querySelector("#result-content")
};

let hasRenderedResult = false;

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "未抽取";
  return String(value);
}

function clearResult(message = "") {
  elements.resultContent.replaceChildren();
  elements.resultBanner.className = "result-banner";
  elements.resultBanner.textContent = message;
  elements.resultSection.hidden = !message;
  hasRenderedResult = Boolean(message);
}

function renderError(code, message) {
  elements.resultSection.hidden = false;
  elements.resultBanner.className = "result-banner error";
  elements.resultBanner.textContent = `${code || "REQUEST_FAILED"} · ${message || "本次请求失败。"}`;
  elements.resultContent.replaceChildren();
  elements.resultContent.append(makeElement("div", "loading-card", "旧结果已清空；本次没有可展示的AI抽取结果。"));
  hasRenderedResult = true;
}

function addSummary(container, label, value) {
  const cell = makeElement("div", "summary-cell");
  cell.append(makeElement("span", "", label));
  cell.append(makeElement("strong", "", displayValue(value)));
  container.append(cell);
}

function createTable(headers, rows) {
  const table = makeElement("table", "simple-table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((header) => headerRow.append(makeElement("th", "", header)));
  thead.append(headerRow);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value) => {
      const td = document.createElement("td");
      if (value instanceof Node) td.append(value);
      else td.textContent = displayValue(value);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody);
  return table;
}

function amountRows(amounts) {
  return (amounts || []).map((item) => [item.amount_type, item.raw_text, item.value, item.currency]);
}

function supplierRows(suppliers) {
  return (suppliers || []).map((item) => [item.name, item.role, item.award_status]);
}

function renderPackages(extraction) {
  const card = makeElement("article", "result-card");
  card.append(makeElement("h3", "", "包组、供应商与金额"));
  const packages = extraction.packages || [];
  if (!packages.length) {
    card.append(makeElement("p", "request-note", "原文未抽取到明确包组。"));
  }
  packages.forEach((item, index) => {
    const packageCard = makeElement("section", "package-card");
    packageCard.append(makeElement("h4", "", `${item.package_name || `包组 ${index + 1}`} · ${item.package_code || "无包组编号"}`));
    if (item.suppliers?.length) {
      packageCard.append(createTable(["供应商", "角色", "中标状态"], supplierRows(item.suppliers)));
    }
    if (item.amounts?.length) {
      packageCard.append(createTable(["金额类型", "原文金额", "数值", "币种"], amountRows(item.amounts)));
    }
    card.append(packageCard);
  });
  if (extraction.unassigned_suppliers?.length || extraction.unassigned_amounts?.length) {
    const unassigned = makeElement("section", "package-card");
    unassigned.append(makeElement("h4", "", "无法归属具体包组的记录"));
    if (extraction.unassigned_suppliers?.length) {
      unassigned.append(createTable(["供应商", "角色", "中标状态"], supplierRows(extraction.unassigned_suppliers)));
    }
    if (extraction.unassigned_amounts?.length) {
      unassigned.append(createTable(["金额类型", "原文金额", "数值", "币种"], amountRows(extraction.unassigned_amounts)));
    }
    card.append(unassigned);
  }
  return card;
}

function renderQuotes(quotes) {
  const card = makeElement("article", "result-card");
  card.append(makeElement("h3", "", "原文引句与字符位置验证"));
  const rows = (quotes || []).map((item) => {
    const badge = makeElement("span", item.quote_verified ? "verified-badge" : "unverified-badge", item.quote_verified ? "原文已定位" : "未通过定位");
    const position = item.quote_verified ? `${item.start_char}–${item.end_char}` : "—";
    return [item.field, item.quote, badge, position];
  });
  card.append(rows.length
    ? createTable(["字段", "原文引句", "验证", "字符位置"], rows)
    : makeElement("p", "request-note", "AI未返回可定位的原文引句。"));
  return card;
}

function renderLists(extraction, ungroundedCandidates = {}) {
  const card = makeElement("article", "result-card");
  card.append(makeElement("h3", "", "日期、模糊点与别名候选"));

  const dates = createTable(["日期类型", "原文日期"], (extraction.dates || []).map((item) => [item.date_type, item.date]));
  card.append(dates);

  const ambiguityTitle = makeElement("h4", "result-subheading", "模糊点");
  card.append(ambiguityTitle);
  const ambiguityList = makeElement("ul", "plain-list");
  (extraction.ambiguities?.length ? extraction.ambiguities : ["无额外模糊点；仍需人工复核。"]).forEach((item) => ambiguityList.append(makeElement("li", "", item)));
  card.append(ambiguityList);

  if (extraction.aliases?.length) {
    const aliasTitle = makeElement("h4", "result-subheading alias-subheading", "原文中同时出现的别名/简称候选（关系仍非结论）");
    card.append(aliasTitle);
    card.append(createTable(["原名", "候选表达", "解释"], extraction.aliases.map((item) => [item.canonical, item.candidate, item.explanation])));
  }
  if (ungroundedCandidates.ambiguities?.length) {
    const candidateTitle = makeElement("h4", "result-subheading alias-subheading", "未进入事实区的AI模糊点候选");
    card.append(candidateTitle);
    const candidateList = makeElement("ul", "plain-list");
    ungroundedCandidates.ambiguities.forEach((item) => candidateList.append(makeElement("li", "", item)));
    card.append(candidateList);
  }
  return card;
}

function renderResult(payload, offline = false) {
  const extraction = payload.extraction;
  elements.resultSection.hidden = false;
  elements.resultBanner.className = `result-banner${offline ? " offline" : ""}`;
  elements.resultBanner.textContent = offline
    ? "OFFLINE_SAMPLE · 非实时调用 · 不是当前输入的处理结果"
    : `LIVE_DEEPSEEK · 已通过本地中转发送至 DeepSeek · ${payload.model}`;
  elements.resultContent.replaceChildren();

  const summary = makeElement("div", "result-summary");
  addSummary(summary, "项目名称", extraction.project_name);
  addSummary(summary, "项目编号", extraction.project_code);
  addSummary(summary, "采购人", extraction.purchaser);
  addSummary(summary, "公告类型", extraction.notice_type);
  addSummary(summary, "证据阶段", extraction.evidence_stage);
  elements.resultContent.append(summary);
  elements.resultContent.append(renderPackages(extraction));
  elements.resultContent.append(renderQuotes(extraction.source_quotes));
  elements.resultContent.append(renderLists(extraction, payload.ungrounded_candidates || {}));

  const provenance = makeElement("article", "result-card");
  provenance.append(makeElement("h3", "", "证明范围"));
  provenance.append(makeElement("p", "request-note", `这些都是AI抽取候选，不是证据结论。当前来源：${payload.meta?.source_provenance || "用户粘贴，未经来源认证"}。“原文已定位”只证明引句存在于本次输入。`));
  elements.resultContent.append(provenance);

  const rawCard = makeElement("article", "result-card");
  rawCard.append(makeElement("h3", "", "经后端校验的结构化 JSON"));
  const pre = makeElement("pre", "raw-json");
  pre.textContent = JSON.stringify(payload, null, 2);
  rawCard.append(pre);
  elements.resultContent.append(rawCard);
  hasRenderedResult = true;
}

async function loadHealth() {
  try {
    const response = await fetch("/api/ai/health", { cache: "no-store" });
    const payload = await response.json();
    if (payload.configured) {
      elements.serviceStatus.className = "service-status ready";
      elements.serviceStatus.textContent = `在线调用已配置 · ${payload.model}`;
    } else {
      elements.serviceStatus.className = "service-status warning";
      elements.serviceStatus.textContent = `${payload.config_code} · 离线样例仍可使用`;
    }
  } catch {
    elements.serviceStatus.className = "service-status warning";
    elements.serviceStatus.textContent = "本地AI中转服务不可用";
  }
}

async function loadDemoText() {
  try {
    const response = await fetch("/sample_data/ai_lab_demo_text.txt", { cache: "no-store" });
    if (!response.ok) throw new Error("demo unavailable");
    elements.text.value = await response.text();
    elements.consent.checked = false;
    updateCharacterCount();
    clearResult();
  } catch {
    renderError("DEMO_LOAD_FAILED", "未能读取虚构公告文本。");
  }
}

async function showOfflineSample() {
  clearResult("正在读取离线样例…");
  elements.resultContent.append(makeElement("div", "loading-card", "此操作不调用 DeepSeek。"));
  try {
    const response = await fetch("/sample_data/ai_lab_offline_result.json", { cache: "no-store" });
    if (!response.ok) throw new Error("offline sample unavailable");
    renderResult(await response.json(), true);
  } catch {
    renderError("OFFLINE_SAMPLE_FAILED", "未能读取离线样例。");
  }
}

async function callDeepSeek() {
  const text = elements.text.value;
  if (text.trim().length < 20) {
    renderError("INVALID_REQUEST", "请先粘贴至少20个字符的公开公告或虚构文本。");
    return;
  }
  if (!elements.consent.checked) {
    renderError("CONSENT_REQUIRED", "在线调用前，必须确认文本可以发送至 DeepSeek。");
    return;
  }

  // Clear stale results before every live request. There is deliberately no retry loop.
  clearResult("正在调用 DeepSeek（在线）… 旧结果已清空，本次不会自动重试。");
  elements.resultContent.append(makeElement("div", "loading-card", "AI只抽取字段与引句；结论仍由规则引擎与人工负责。"));
  elements.call.disabled = true;
  elements.text.disabled = true;
  elements.loadDemo.disabled = true;
  elements.offline.disabled = true;
  elements.includeAliases.disabled = true;
  elements.consent.disabled = true;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch("/api/ai/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        text,
        include_aliases: elements.includeAliases.checked,
        data_classification: "public_or_fictional",
        external_transfer_confirmed: true
      })
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("INVALID_SERVER_RESPONSE");
    }
    if (!response.ok || !payload.ok) {
      renderError(payload?.error?.code || `HTTP_${response.status}`, payload?.error?.message || "在线调用失败。");
      return;
    }
    renderResult(payload, false);
  } catch (error) {
    if (error.name === "AbortError") {
      renderError("CLIENT_TIMEOUT", "超过50秒未完成，已在浏览器终止等待；不会自动重试。");
    } else {
      renderError("NETWORK_ERROR", "本地中转或网络请求失败；请确认 run_ai_demo.command 正在运行。");
    }
  } finally {
    window.clearTimeout(timer);
    elements.call.disabled = false;
    elements.text.disabled = false;
    elements.loadDemo.disabled = false;
    elements.offline.disabled = false;
    elements.includeAliases.disabled = false;
    elements.consent.disabled = false;
  }
}

function updateCharacterCount() {
  elements.charCount.textContent = `${elements.text.value.length.toLocaleString("zh-CN")} / ${MAX_CHARS.toLocaleString("zh-CN")}`;
}

elements.text.addEventListener("input", () => {
  updateCharacterCount();
  if (hasRenderedResult) clearResult();
});
elements.loadDemo.addEventListener("click", loadDemoText);
elements.offline.addEventListener("click", showOfflineSample);
elements.call.addEventListener("click", callDeepSeek);

updateCharacterCount();
loadHealth();
