"use strict";

const TASKS = [
  {
    id: "TASK-006", queue: "completed", queueLabel: "已完成候选",
    company: "广东云帆政务科技有限公司", companyCode: "DEMO-COMPANY-006",
    project: "政务协同应用运维服务项目", projectCode: "DEMO-SD-2024-086",
    sourceType: "履约验收公告", sourceTitle: "政务协同应用运维服务项目履约验收公告（虚构）",
    quote: "项目编号、供应商名称与主体编号一致；本项目服务内容已按约完成验收。",
    platform: "虚构政务采购平台", date: "2025-01-20",
    gates: [
      ["项目关系", "明确一致", "项目编号与采购人均可对应", "pass"],
      ["企业主体", "明确一致", "统一社会信用代码一致", "pass"],
      ["材料阶段", "验收材料", "达到已完成候选最低阶段", "pass"]
    ],
    title: "证据支持进入已完成候选", reason: "同一项目、同一主体得到支持，且候选材料达到验收阶段。",
    gap: "仍需人工确认验收范围、签章和材料效力", next: "查看验收原文并记录人工确认意见", boundary: "不能自动替代有权人员作正式认定"
  },
  {
    id: "TASK-005", queue: "conducted", queueLabel: "曾开展候选",
    company: "广东星桥数智科技有限公司", companyCode: "DEMO-COMPANY-005",
    project: "公共服务数据平台建设项目", projectCode: "DEMO-SD-2025-031",
    sourceType: "合同公告", sourceTitle: "公共服务数据平台建设项目合同公告（虚构）",
    quote: "项目编号、采购人与合同乙方主体信息一致，合同于2025年5月签订。",
    platform: "虚构政务采购平台", date: "2025-05-06",
    gates: [
      ["项目关系", "明确一致", "项目编号与采购人均可对应", "pass"],
      ["企业主体", "明确一致", "统一社会信用代码一致", "pass"],
      ["材料阶段", "合同材料", "支持曾开展，尚未证明完成", "wait"]
    ],
    title: "证据支持曾开展候选", reason: "项目和主体均可对应，但材料只到合同阶段。",
    gap: "缺少验收或其他完成证明", next: "向投标人补充验收材料并人工确认", boundary: "不能把签合同写成已经履约完成"
  },
  {
    id: "TASK-001", queue: "award", queueLabel: "仅中标线索",
    company: "广东清禾数字科技有限公司", companyCode: "DEMO-COMPANY-001",
    project: "顺德区智慧服务平台升级项目", projectCode: "DEMO-SD-2024-001",
    sourceType: "中标结果公告", sourceTitle: "顺德区智慧服务平台升级项目中标结果（虚构）",
    quote: "项目编号与供应商主体编号一致，中标供应商为广东清禾数字科技有限公司。",
    platform: "虚构政务采购平台", date: "2024-06-18",
    gates: [
      ["项目关系", "明确一致", "项目编号一致", "pass"],
      ["企业主体", "明确一致", "统一社会信用代码一致", "pass"],
      ["材料阶段", "中标线索", "只证明被选中", "wait"]
    ],
    title: "当前只有中标线索", reason: "项目和主体可对应，但未发现合同或验收材料。",
    gap: "缺合同和验收材料", next: "补合同以核“曾开展”；补验收以核“已完成”", boundary: "不能把中标等同于开展或完成"
  },
  {
    id: "TASK-002", queue: "manual", queueLabel: "疑点待人工",
    company: "广东远景数据有限公司", companyCode: "DEMO-COMPANY-002",
    project: "政务数据治理服务项目", projectCode: "DEMO-SD-2023-017",
    sourceType: "中标结果公告", sourceTitle: "政务数据治理服务项目中标结果（虚构）",
    quote: "项目编号：DEMO-SD-2023-017；供应商：广东远景科技集团有限公司；主体编号：DEMO-GROUP-900。",
    platform: "虚构政务采购平台", date: "2023-08-09",
    gates: [
      ["项目关系", "明确一致", "项目编号一致", "pass"],
      ["企业主体", "硬字段冲突", "公告与投标公司主体编号不同", "stop"],
      ["材料阶段", "候选文种：中标", "主体未确认，不升级业绩阶段", "wait"]
    ],
    title: "主体关系存疑，转人工复核", reason: "同一项目有支持，但公告供应商与投标公司的主体编号不同。",
    gap: "缺企业更名、承继或集团关系桥接材料", next: "核对主体桥接材料及填报是否有误", boundary: "不能自动写成虚假，也不能默认集团公司业绩可继承"
  },
  {
    id: "TASK-003", queue: "manual", queueLabel: "疑点待人工",
    company: "佛山启明技术有限公司", companyCode: "DEMO-COMPANY-003",
    project: "公共服务系统运维项目", projectCode: "未提供项目编号",
    sourceType: "合同公告", sourceTitle: "公共服务系统运行维护项目合同公告（虚构）",
    quote: "项目名称相似；合同乙方为佛山启明科技集团有限公司，材料未披露统一社会信用代码。",
    platform: "虚构政务采购平台", date: "2022-04-12",
    gates: [
      ["项目关系", "名称相似", "缺编号，只能作为候选", "wait"],
      ["企业主体", "复杂关系", "名称不同且缺统一代码", "wait"],
      ["材料阶段", "候选文种：合同", "项目与主体未确认", "wait"]
    ],
    title: "项目与主体均需人工复核", reason: "名称相似，但缺少能锁定项目和法律主体的硬字段。",
    gap: "缺项目编号、信用代码和主体桥接材料", next: "补合同首页、项目编号和企业关系证明", boundary: "不能用语义相似度直接认定同一项目或同一企业"
  },
  {
    id: "TASK-004", queue: "evidence", queueLabel: "待补证",
    company: "岭南云创科技有限公司", companyCode: "DEMO-COMPANY-004",
    project: "历史档案数字化建设项目", projectCode: "未提供项目编号",
    sourceType: "本轮未形成可靠候选", sourceTitle: "公开来源覆盖不足",
    quote: "在当前来源、关键词和时间范围内，没有形成能够支持核验的可靠候选材料。",
    platform: "本地检索记录", date: "2026-08-16",
    gates: [
      ["项目关系", "无法核对", "缺项目编号与采购人", "wait"],
      ["企业主体", "无法核对", "没有绑定该项目的供应商材料", "wait"],
      ["材料阶段", "无法判断", "没有可归属的候选材料", "wait"]
    ],
    title: "当前证据不足", reason: "公开检索未形成可靠候选，无法核对项目和企业关系。",
    gap: "缺项目编号、采购人、合同或验收附件", next: "向投标人补证，并扩大获准的官方来源检索", boundary: "没搜到不等于项目不存在或企业虚假"
  }
];

const state = { tab: "tasks", queue: "all", selected: "TASK-002", reviews: {} };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function taskById(id) { return TASKS.find((task) => task.id === id) || TASKS[0]; }
function visibleTasks() { return state.queue === "all" ? TASKS : TASKS.filter((task) => task.queue === state.queue); }

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function renderCrosscheckResult(payload) {
  const result = $("#crosscheck-result");
  const summary = payload.summary || {};
  const ledger = payload.ledger || {};
  const links = Array.isArray(ledger.candidate_urls) ? ledger.candidate_urls.slice(0, 6) : [];
  result.innerHTML = `
    <div class="crosscheck-result-grid">
      <article><strong>MCP 检索</strong><span>${escapeText(ledger.system_status || "已完成")}</span></article>
      <article><strong>候选来源</strong><span>${escapeText(ledger.candidate_count ?? links.length)} 条</span></article>
      <article><strong>反向风险</strong><span>${escapeText((ledger.risk_signals || []).length)} 项待看</span></article>
      <article><strong>AI 边界</strong><span>只整理，不自动定案</span></article>
    </div>
    <h4>DeepSeek 大白话摘要</h4>
    <p>${escapeText(summary.summary || "已找到候选材料；仍需回到来源原文核对项目、主体和材料阶段。")}</p>
    <div class="candidate-links">${links.map((url) => `<a href="${escapeText(url)}" target="_blank" rel="noopener noreferrer">${escapeText(url)}</a>`).join("") || "<span>本次没有形成可展示的候选链接。</span>"}</div>
    <p><strong>下一步：</strong>${escapeText((summary.next_steps || ["由工作人员查看原文并决定是否补证。"])[0])}</p>`;
}

async function runLiveCrosscheck(event) {
  event.preventDefault();
  const result = $("#crosscheck-result");
  if (!$("#crosscheck-confirm").checked) {
    result.innerHTML = '<div class="crosscheck-placeholder"><strong>尚未外发</strong><p>请先确认输入仅为公开或虚构信息。</p></div>';
    return;
  }
  const button = $("#crosscheck-submit");
  button.disabled = true;
  button.textContent = "MCP 正在检索，随后交给 DeepSeek…";
  result.innerHTML = '<div class="crosscheck-placeholder"><strong>正在运行</strong><p>先做正向候选检索，再反向查看更正、终止和版本风险；不会自动通过。</p></div>';
  try {
    const response = await fetch("/api/ai/crosscheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: $("#crosscheck-project").value.trim(),
        supplier_legal_name: $("#crosscheck-supplier").value.trim(),
        project_code: $("#crosscheck-code").value.trim(),
        credit_code: $("#crosscheck-credit").value.trim(),
        region: $("#crosscheck-region").value.trim(),
        data_classification: "public_or_fictional",
        external_transfer_confirmed: true
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || "本机联调服务未就绪");
    renderCrosscheckResult(payload);
  } catch (error) {
    result.innerHTML = `<div class="crosscheck-placeholder"><strong>公网静态版／本机服务未开启</strong><p>${escapeText(error.message)}。页面不会在浏览器中保存 API 密钥；可继续查看离线示例和系统边界。</p></div>`;
  } finally {
    button.disabled = false;
    button.textContent = "联网寻找候选并生成摘要";
  }
}

function renderCounts() {
  $("#count-all").textContent = TASKS.length;
  ["completed", "conducted", "award", "manual", "evidence"].forEach((queue) => {
    $("#count-" + queue).textContent = TASKS.filter((task) => task.queue === queue).length;
  });
}

function renderTaskList() {
  const tasks = visibleTasks();
  const container = $("#task-list");
  container.replaceChildren();
  const suffix = state.queue === "all" ? "当前显示全部" : `当前筛选：${tasks[0]?.queueLabel || "空队列"}`;
  $("#queue-summary").textContent = `${tasks.length} 条虚构任务 · ${suffix}`;
  if (!tasks.length) {
    const empty = document.createElement("p");
    empty.className = "task-empty";
    empty.textContent = "当前队列暂无任务";
    container.append(empty);
    return;
  }
  if (!tasks.some((task) => task.id === state.selected)) state.selected = tasks[0].id;
  tasks.forEach((task) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-item" + (task.id === state.selected ? " active" : "");
    button.dataset.taskId = task.id;
    button.innerHTML = `<div class="task-item-top"><span>${task.id} · DEMO_ONLY</span><span class="mini-state ${task.queue}">${task.queueLabel}</span></div><strong>${task.company}</strong><p>${task.project}</p>`;
    button.addEventListener("click", () => {
      state.selected = task.id;
      renderTaskList();
      renderReview(task);
    });
    container.append(button);
  });
  renderReview(taskById(state.selected));
}

function renderReview(task) {
  $("#record-id").textContent = `${task.id} · DEMO_ONLY`;
  $("#record-state").textContent = task.queueLabel;
  $("#record-state").className = `state-pill ${task.queue}`;
  $("#claim-company").textContent = task.company;
  $("#claim-code").textContent = `主体编号：${task.companyCode}`;
  $("#claim-project").textContent = task.project;
  $("#claim-project-code").textContent = `项目编号：${task.projectCode}`;
  $("#source-type").textContent = task.sourceType;
  $("#source-title").textContent = task.sourceTitle;
  $("#source-quote").textContent = `“${task.quote}”`;
  $("#source-platform").textContent = task.platform;
  $("#source-date").textContent = task.date;
  $("#gate-grid").innerHTML = task.gates.map(([label, title, note, status]) => `<article class="gate-card ${status}"><span>${label}</span><strong>${title}</strong><small>${note}</small></article>`).join("");
  $("#decision-title").textContent = task.title;
  $("#decision-reason").textContent = task.reason;
  $("#decision-gap").textContent = task.gap;
  $("#decision-next").textContent = task.next;
  $("#decision-boundary").textContent = task.boundary;
  const saved = state.reviews[task.id] || { action: "pending", note: "" };
  $("#review-action").value = saved.action;
  $("#review-note").value = saved.note;
  $("#review-save-state").textContent = saved.saved ? "本次会话已保存" : "";
}

$$('[data-tab]').forEach((button) => button.addEventListener("click", () => {
  state.tab = button.dataset.tab;
  $$(".workspace-tab").forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  });
  $$(".tab-panel").forEach((panel) => {
    const active = panel.dataset.panel === state.tab;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}));

$$('[data-queue]').forEach((button) => button.addEventListener("click", () => {
  state.queue = button.dataset.queue;
  $$(".queue-filter").forEach((item) => item.classList.toggle("active", item === button));
  renderTaskList();
}));

$("#review-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.reviews[state.selected] = {
    action: $("#review-action").value,
    note: $("#review-note").value.trim(),
    saved: true
  };
  $("#review-save-state").textContent = "本次会话已保存 · 不会写入正式系统";
});

$("#live-crosscheck-form")?.addEventListener("submit", runLiveCrosscheck);

renderCounts();
renderTaskList();
