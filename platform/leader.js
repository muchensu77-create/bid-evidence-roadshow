"use strict";

(() => {
  const board = document.querySelector("#leader-demo-board");
  const runButton = document.querySelector("#leader-run-demo");
  const status = document.querySelector("#leader-demo-status");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const query = new URLSearchParams(window.location.search);

  if (query.get("view") === "workbench") {
    document.body.classList.remove("leader-home");
    window.setTimeout(() => document.querySelector("#workbench-mode-btn")?.click(), 900);
    return;
  }

  if (!board || !runButton || !status) return;

  const messages = [
    "找到一条可核对的候选材料",
    "已保留原文引句和信息来源",
    "项目编号一致，同一项目有支持",
    "企业信用代码不同，主体关系存疑",
    "候选材料仅到中标，已转人工复核"
  ];

  let timers = [];

  function clearTimers() {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
  }

  function finishDemo() {
    board.dataset.demoState = "complete";
    status.textContent = messages[messages.length - 1];
    runButton.disabled = false;
    runButton.textContent = "重新演示";
  }

  function runDemo() {
    clearTimers();
    board.dataset.demoState = "running";
    board.dataset.activeStep = "0";
    runButton.disabled = true;
    runButton.textContent = "正在整理证据…";
    status.textContent = "开始：企业声明还不是事实结论";

    if (prefersReducedMotion) {
      board.dataset.activeStep = "5";
      finishDemo();
      return;
    }

    messages.forEach((message, index) => {
      timers.push(window.setTimeout(() => {
        board.dataset.activeStep = String(index + 1);
        status.textContent = message;
        if (index === messages.length - 1) finishDemo();
      }, 360 * (index + 1)));
    });
  }

  runButton.addEventListener("click", runDemo);
  window.addEventListener("beforeunload", clearTimers);
})();
