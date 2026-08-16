"use strict";

(() => {
  const board = document.querySelector("#leader-demo-board");
  const runButton = document.querySelector("#leader-run-demo");
  const status = document.querySelector("#leader-demo-status");
  const query = new URLSearchParams(window.location.search);

  if (query.get("view") === "workbench") {
    document.body.classList.remove("leader-home");
    window.setTimeout(() => document.querySelector("#workbench-mode-btn")?.click(), 900);
    return;
  }

  // 默认直接进入可逐页讲解的四画面路演台；精简旧首页仅保留为历史结构。
  document.body.classList.remove("leader-home");
  window.setTimeout(() => document.querySelector("#roadshow-mode-btn")?.click(), 250);
  return;

  if (!board || !runButton || !status) return;

  const steps = [
    { status: "找到一条可核对的候选材料", next: "下一步：读出关键原文" },
    { status: "已保留原文引句和信息来源", next: "下一步：核对项目" },
    { status: "项目编号一致，同一项目有支持", next: "下一步：核对企业" },
    { status: "企业信用代码不同，主体关系存疑", next: "下一步：生成复核任务" },
    { status: "仅有中标线索，主体又存疑，系统写明原因后转人工", next: "重新讲一遍" }
  ];

  let currentStep = 0;

  function resetDemo() {
    currentStep = 0;
    board.dataset.demoState = "ready";
    board.dataset.activeStep = "0";
    status.textContent = "开始前：现在只有企业自报，还没有事实结论";
    runButton.textContent = "第一步：找候选材料";
    runButton.setAttribute("aria-label", "推进到第一步：找候选材料");
  }

  function advanceDemo() {
    if (currentStep >= steps.length) {
      resetDemo();
      return;
    }

    currentStep += 1;
    board.dataset.demoState = currentStep === steps.length ? "complete" : "running";
    board.dataset.activeStep = String(currentStep);
    status.textContent = steps[currentStep - 1].status;
    runButton.textContent = steps[currentStep - 1].next;
    runButton.setAttribute("aria-label", steps[currentStep - 1].next);
  }

  resetDemo();
  runButton.addEventListener("click", advanceDemo);
})();
