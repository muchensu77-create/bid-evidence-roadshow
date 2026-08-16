"use strict";

const DEMO = {
  company: "佛山市海岳数智科技有限公司",
  project: "顺峰区政务服务一体化平台升级项目",
};

const DEFAULT_NODE = "entity_conflict";

const NODE_DETAILS = {
  claim: {
    state: "manual",
    stateLabel: "待核查声明",
    title: "输入：企业自报一项历史业绩",
    summary: "系统拿到的只是企业在投标文件中的声明，不能把这句话直接当成已经核实的事实。",
    quote: "“投标人声明：我司曾承担顺峰区政务服务一体化平台升级项目。”",
    conditions: [
      ["wait", "投标公司名称", "已提供"],
      ["wait", "自报项目名称", "已提供"],
      ["wait", "公开材料", "尚待寻找"],
    ],
    result: "建立一条待核查任务",
    reason: "目前只有企业自报，没有独立公开材料支持。",
    next: "由系统寻找公开候选材料，并保留企业原始声明。",
    safety: "企业自报是核查起点，不是事实结论。",
    answer: "“主办方给出的175条数据，本质上都是待核查声明；我们的工作从保留原话、寻找独立依据开始。”",
    path: ["claim"],
  },
  candidate: {
    state: "manual",
    stateLabel: "寻找候选",
    title: "AI：寻找并读取候选材料",
    summary: "AI负责生成检索组合、阅读公告和提取字段，但找到网页并不等于核验已经通过。",
    quote: "“项目编号：SFZC-2024-017；项目名称：顺峰区政务服务一体化平台升级项目。”",
    conditions: [
      ["pass", "项目名称", "已提取"],
      ["pass", "项目编号", "已提取"],
      ["pass", "公告供应商", "已提取"],
    ],
    result: "形成可比较的候选材料",
    reason: "AI把非结构化公告变成项目、企业和材料阶段等可核对字段。",
    next: "交给确定性逻辑逐层核对，不让AI直接下真假结论。",
    safety: "AI负责找、读、对齐和解释，不负责最终认定。",
    answer: "“AI不是裁判，它先把散落在网页里的项目编号、供应商和原文引句整理出来，后面的边界由确定性逻辑守住。”",
    path: ["claim", "candidate"],
  },
  no_candidate: {
    state: "insufficient",
    stateLabel: "证据不足",
    title: "分支：当前没有找到可核候选",
    summary: "公开检索没有形成可靠候选，只能说明当前证据不足，不能反推企业虚假。",
    quote: "当前检索未形成能够支持核验的可靠候选材料。",
    conditions: [
      ["wait", "可靠候选材料", "未形成"],
      ["wait", "项目关系", "无法核对"],
      ["wait", "企业主体", "无法核对"],
    ],
    result: "证据不足，进入补证队列",
    reason: "网上没搜到可能来自公开覆盖不足、名称不完整、旧网页失效等多种原因。",
    next: "补项目编号、采购人、合同或验收材料，再由工作人员复核。",
    safety: "没搜到 ≠ 虚假；系统不得自动作负面认定。",
    answer: "“这一条不是判假，而是系统诚实地说：当前材料不够。它会写清需要补什么，再交给人工。”",
    path: ["claim", "candidate", "no_candidate"],
  },
  candidate_yes: {
    state: "manual",
    stateLabel: "继续核对",
    title: "分支：已经找到可核候选",
    summary: "有候选只是第一步，接下来还要确认是不是同一个项目、同一家企业。",
    quote: "“项目编号：SFZC-2024-017；项目名称：顺峰区政务服务一体化平台升级项目。”",
    conditions: [
      ["pass", "候选材料", "已找到"],
      ["wait", "同一项目", "待核对"],
      ["wait", "同一主体", "待核对"],
    ],
    result: "进入项目关系核对",
    reason: "候选公告可能是同名项目，也可能关联另一家公司，不能到此为止。",
    next: "比较项目编号、包组、采购人、年份和项目名称。",
    safety: "找到材料只是核验的开始。",
    answer: "“别的工具往往停在‘搜到了’，我们的平台会继续追问：这是同一项目吗？公告里的企业是本次投标公司吗？”",
    path: ["claim", "candidate", "candidate_yes"],
  },
  source: {
    state: "manual",
    stateLabel: "核对来源",
    title: "判断：这份材料能作为核验依据吗？",
    summary: "系统先区分官方原文、官方归集页、第三方条目和AI回答，不让线索冒充证据。",
    quote: "“来源页：政府采购结果公告；发布单位：顺峰区政务服务数据管理中心。”",
    conditions: [
      ["pass", "来源类型", "已识别"],
      ["wait", "原始发布页", "待确认"],
      ["wait", "版本与发布时间", "待保留"],
    ],
    result: "进入来源效力检查",
    reason: "不同来源的可信程度和可追溯性不同。",
    next: "能回到官方原文或获授权材料才继续；其余只作寻址线索。",
    safety: "第三方目录和AI生成内容不能独立支撑业绩结论。",
    answer: "“我们不是搜到一句话就算证据；系统先判断能否回到可定位的官方原文或获授权材料。”",
    path: ["claim", "candidate", "candidate_yes", "source"],
  },
  source_unavailable: {
    state: "insufficient",
    stateLabel: "证据不足",
    title: "分支：来源页报错或无法回看",
    summary: "链接失效、网站限制或旧公告不可达，只能记录本轮未获得可核原文。",
    quote: "当前来源页返回访问错误，未保留可定位原文。",
    conditions: [["stop", "可回看原文", "暂不可用"], ["wait", "项目与主体", "尚未核对"], ["wait", "替代来源", "待寻找"]],
    result: "来源不可用，转补证队列",
    reason: "来源报错只说明本轮无法核实，不说明项目或业绩不存在。",
    next: "寻找其他官方发布页、获授权快照或请投标人补材料。",
    safety: "来源报错 ≠ 虚假。",
    answer: "“网页打不开时，系统不会猜结论，只会记录来源不可用并转补证。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_unavailable"],
  },
  source_yes: {
    state: "supported",
    stateLabel: "来源可核",
    title: "分支：已回到官方原文或获授权材料",
    summary: "材料可回看、可定位，并保留了URL、发布单位、时间、版本与原文引句。",
    quote: "“项目编号：SFZC-2024-017；采购人：顺峰区政务服务数据管理中心。”",
    conditions: [["pass", "来源效力", "可作核验依据"], ["pass", "原文定位", "可回看"], ["wait", "项目关系", "待核对"]],
    result: "来源门通过，继续核对项目",
    reason: "材料来源可追溯，具备继续核对的基础。",
    next: "比较项目编号、包组、项目名称、采购人和年份。",
    safety: "来源可靠不等于业绩已经被证实。",
    answer: "“有官方原文只说明材料可核，接下来还要回答是不是同一项目、同一企业。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes"],
  },
  source_weak: {
    state: "manual",
    stateLabel: "只作线索",
    title: "分支：当前只有第三方条目、搜索摘要或AI回答",
    summary: "这些内容可以帮忙寻址和扩展关键词，但不能独立形成业绩支持。",
    quote: "搜索摘要显示项目名称和企业名称，但未回到原始发布页。",
    conditions: [["pass", "寻址线索", "已获得"], ["stop", "独立证据效力", "不具备"], ["wait", "官方原文", "待回源"]],
    result: "保留线索，继续回源",
    reason: "二次摘要可能截断、过期或丢失上下文。",
    next: "根据项目编号、标题和发布单位回到原始官方页。",
    safety: "AI生成内容和第三方摘要不能作为独立证据。",
    answer: "“第三方和AI可以帮忙找路，但不能当成终点；系统会继续回到原始发布页。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_weak"],
  },
  project: {
    state: "manual",
    stateLabel: "项目核对",
    title: "判断：材料说的是同一个项目吗？",
    summary: "系统优先看项目编号和包组等硬字段，再参考名称、采购人和年份，不能只靠文字相似。",
    quote: "“项目编号：SFZC-2024-017；采购人：顺峰区政务服务数据管理中心。”",
    conditions: [
      ["pass", "项目编号", "一致"],
      ["pass", "项目名称", "高度一致"],
      ["pass", "采购人及年份", "能够对应"],
    ],
    result: "同一项目关系得到支持",
    reason: "硬字段和辅助字段形成一致指向。",
    next: "继续核对公告供应商是不是本次投标公司。",
    safety: "编号或包组明确冲突时，名称再像也不能自动支持。",
    answer: "“项目名称只是线索，真正稳的是项目编号、包组和采购人。硬字段冲突时，系统会直接踩刹车。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project"],
  },
  project_conflict: {
    state: "conflict",
    stateLabel: "字段冲突",
    title: "分支：项目编号或包组冲突",
    summary: "名称相似，但关键编号指向另一个项目，系统不会用相似度覆盖硬冲突。",
    quote: "“项目编号：SFZC-2024-071；包组：02。”（自报材料为 SFZC-2024-017、包组01）",
    conditions: [
      ["pass", "项目名称", "相似"],
      ["stop", "项目编号", "明确冲突"],
      ["stop", "包组", "明确冲突"],
    ],
    result: "项目字段冲突，停止自动支持",
    reason: "项目编号和包组属于硬字段，明确冲突不能被名称相似抵消。",
    next: "由工作人员检查自报项目是否填写有误，或寻找正确项目材料。",
    safety: "硬字段冲突优先于语义相似。",
    answer: "“即使两个项目名称很像，只要编号或包组明确冲突，系统就不会让AI的相似判断强行通过。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_conflict"],
  },
  project_yes: {
    state: "supported",
    stateLabel: "项目已对上",
    title: "分支：同一项目得到证据支持",
    summary: "项目编号、项目名称、采购人和年份能够对应，但还不能直接认定这家公司做过。",
    quote: "“项目编号：SFZC-2024-017；项目名称：顺峰区政务服务一体化平台升级项目。”",
    conditions: [
      ["pass", "项目编号", "一致"],
      ["pass", "采购人", "一致"],
      ["wait", "企业主体", "待核对"],
    ],
    result: "继续核对企业主体",
    reason: "已经确认是哪一个项目，但项目与企业的关系仍需单独验证。",
    next: "比较公告供应商名称、统一社会信用代码和承担角色。",
    safety: "同一项目不等于同一企业。",
    answer: "“项目对上了，只回答‘这是哪一个项目’，还没回答‘是不是这家公司做的’，所以系统继续核企业。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes"],
  },
  project_similar: {
    state: "manual",
    stateLabel: "人工复核",
    title: "分支：只有项目名称相似",
    summary: "缺少项目编号、包组或采购人等稳定字段，仅凭语义相似不能自动认为是同一项目。",
    quote: "“顺峰政务一体化平台升级服务项目”（与自报名称相似，但未披露项目编号）",
    conditions: [
      ["pass", "项目名称", "语义相似"],
      ["wait", "项目编号", "缺失"],
      ["wait", "采购人", "信息不足"],
    ],
    result: "项目关系不确定，转人工复核",
    reason: "同类项目或同名项目可能同时存在，只有名称相似不足以安全支持。",
    next: "补项目编号、采购人、年份或合同首页等能够锁定项目的材料。",
    safety: "语义相似用于找候选，不代替事实核对。",
    answer: "“大模型的相似度只帮我们找候选，不会直接当成事实。缺少稳定字段时，系统会转人工。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_similar"],
  },
  entity: {
    state: "manual",
    stateLabel: "主体核对",
    title: "判断：公告企业是本次投标公司吗？",
    summary: "系统优先核对统一社会信用代码，再处理简称、更名、联合体和分公司等复杂关系。",
    quote: "“供应商名称：广东海岳信息技术有限公司；统一社会信用代码：91440606MA8X7B2B7K。”",
    conditions: [
      ["pass", "同一项目", "已支持"],
      ["wait", "企业名称", "需要对齐"],
      ["wait", "统一社会信用代码", "需要核对"],
    ],
    result: "进入企业主体核对",
    reason: "企业简称或相似名称容易误配，必须确认法律主体和承担角色。",
    next: "比对信用代码，并检查更名、联合体或分公司关系。",
    safety: "企业名称相似不能代替法律主体一致。",
    answer: "“这道题的核心不只是找到项目，而是确认公告里的供应商和本次投标公司是不是同一法律主体。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity"],
  },
  entity_conflict: {
    state: "conflict",
    stateLabel: "人工复核",
    title: "企业主体：信用代码冲突",
    summary: "项目能够对应，但企业信用代码不一致。系统必须在这里停止自动支持。",
    quote: "“项目编号：SFZC-2024-017；供应商名称：广东海岳信息技术有限公司；统一社会信用代码：91440606MA8X7B2B7K。”",
    conditions: [
      ["pass", "同一项目", "已支持"],
      ["stop", "统一社会信用代码", "与投标公司不一致"],
      ["wait", "更名或承继关系", "没有桥接材料"],
    ],
    result: "主体关系存疑，转人工复核",
    reason: "项目字段能够对应，但公告企业与投标公司的信用代码不一致。",
    next: "补充企业更名、承继或其他主体桥接材料，由工作人员确认。",
    safety: "复杂主体关系统一转人工；不让名称相似替代法律主体核对。",
    answer: "“这一条不是没搜到，而是搜到了相似项目、却发现企业信用代码冲突，所以系统主动踩刹车，交给工作人员核实主体关系。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_conflict"],
  },
  entity_yes: {
    state: "supported",
    stateLabel: "主体已对上",
    title: "分支：同一法律主体得到支持",
    summary: "项目和企业关系已经能够对上，下一步仍要判断材料只到中标、合同还是验收。",
    quote: "“供应商名称：佛山市海岳数智科技有限公司；统一社会信用代码：91440606MA8X7A1A1K。”",
    conditions: [
      ["pass", "同一项目", "已支持"],
      ["pass", "企业名称", "一致"],
      ["pass", "统一社会信用代码", "一致"],
    ],
    result: "继续判断证据阶段",
    reason: "同一项目、同一法律主体均得到材料支持。",
    next: "识别当前最高材料是中标、合同还是验收。",
    safety: "确认中标企业仍不代表已经履约完成。",
    answer: "“项目和企业都对上后，我们还不结束，因为中标、签合同和验收完成是三件不同的事。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_yes"],
  },
  complex_entity: {
    state: "manual",
    stateLabel: "人工复核",
    title: "分支：更名、联合体或分公司等复杂关系",
    summary: "公告主体与投标公司存在可能关联，但缺少足以证明权利义务关系的桥接材料。",
    quote: "“联合体牵头人：广东海岳信息技术有限公司；成员：顺峰数字建设有限公司。”",
    conditions: [
      ["pass", "同一项目", "已支持"],
      ["wait", "承担角色", "联合体成员"],
      ["wait", "主体桥接材料", "缺失"],
    ],
    result: "复杂主体关系，转人工复核",
    reason: "母子公司、分公司、联合体成员或更名前后主体不能默认互相继承业绩。",
    next: "补更名证明、联合体协议、分包合同或其他角色证明。",
    safety: "有关联不等于同一主体，也不自动等于围标或虚假。",
    answer: "“遇到更名、联合体或分公司，系统不会武断合并，也不会武断判假，而是要求能够连接两个主体的材料。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "complex_entity"],
  },
  stage: {
    state: "supported",
    stateLabel: "判断阶段",
    title: "判断：材料最高支持到哪一步？",
    summary: "项目和企业已经对上，但不同材料只能支持不同程度的事实，不能混写。",
    quote: "“本公告用于说明该企业与项目的公开关系；具体完成情况以合同、验收等材料为准。”",
    conditions: [
      ["pass", "同一项目", "已支持"],
      ["pass", "同一主体", "已支持"],
      ["wait", "最高材料阶段", "待识别"],
    ],
    result: "区分中标、合同和验收",
    reason: "每种材料能证明的事实边界不同。",
    next: "按当前最高证据阶段形成复核候选。",
    safety: "中标不等于履约，合同不等于验收完成。",
    answer: "“我们不把所有公告混成一个‘真’字，而是明确告诉工作人员：材料究竟支持到中标、合同还是验收。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_yes", "stage"],
  },
  award: {
    state: "insufficient",
    stateLabel: "仅中标线索",
    title: "阶段分支：目前只有中标公告",
    summary: "中标公告只能证明企业曾被选中，不能证明合同已签，更不能证明已经履约完成。",
    quote: "“成交供应商：佛山市海岳数智科技有限公司；成交金额：268万元。”",
    conditions: [
      ["pass", "项目与主体", "已支持"],
      ["pass", "中标材料", "已找到"],
      ["wait", "合同或验收材料", "未找到"],
    ],
    result: "仅中标线索，待补后续材料",
    reason: "当前证据只支持‘被选中’，不能支持‘曾开展’或‘已完成’。",
    next: "补充合同材料；若要证明已经完成，还需验收材料。",
    safety: "中标 = 线索，不等于履约。",
    answer: "“中标只是起点。系统不会把‘拿到项目’偷换成‘做完项目’，这是我们最重要的安全边界之一。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_yes", "stage", "award"],
  },
  contract: {
    state: "manual",
    stateLabel: "曾开展候选",
    title: "阶段分支：材料已经到合同",
    summary: "合同材料能够支持企业与项目存在开展关系，但当前还不能证明已经完成。",
    quote: "“合同乙方：佛山市海岳数智科技有限公司；合同项目：顺峰区政务服务一体化平台升级项目。”",
    conditions: [
      ["pass", "项目与主体", "已支持"],
      ["pass", "合同关系", "已支持"],
      ["wait", "验收材料", "未找到"],
    ],
    result: "曾开展候选，待补验收",
    reason: "合同能够说明双方建立项目关系，但不当然说明全部工作已经完成并验收。",
    next: "补验收报告或具有同等证明力的完成材料。",
    safety: "合同 = 曾开展候选，不等于已经完成。",
    answer: "“合同能把事实推进到‘曾开展候选’，但我们仍不越过验收这道门槛去写‘已经完成’。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_yes", "stage", "contract"],
  },
  acceptance: {
    state: "supported",
    stateLabel: "已完成候选",
    title: "阶段分支：材料已经达到验收",
    summary: "验收材料达到本次演示采用的‘已完成候选’最低证据门槛，但最终仍需工作人员确认。",
    quote: "“验收结论：项目建设内容符合合同约定，同意通过验收。”",
    conditions: [
      ["pass", "项目与主体", "已支持"],
      ["pass", "验收对象", "能够对应"],
      ["pass", "验收结论", "通过"],
    ],
    result: "已完成候选，交工作人员确认",
    reason: "同一项目、同一主体及验收阶段均得到材料支持。",
    next: "工作人员回看原文，并按本次采购文件要求作最终认定。",
    safety: "验收是最低材料门槛，不替代本项目评分规则和人工确认。",
    answer: "“验收材料让系统形成‘已完成候选’，但这仍不是机器盖章；工作人员还要核对本次采购文件和原文。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_yes", "stage", "acceptance"],
  },
  version_check: {
    state: "manual",
    stateLabel: "反证检查",
    title: "判断：有后续更正、终止或跨来源冲突吗？",
    summary: "即使已经找到合同或验收类材料，也要检查是否有更新版本、部分验收、撤销或终止信息。",
    quote: "“本项目原结果公告的部分内容现予更正……”",
    conditions: [["wait", "更正公告", "待检查"], ["wait", "终止／撤销", "待检查"], ["wait", "部分验收／跨来源冲突", "待检查"]],
    result: "进入反证与版本检查",
    reason: "早期材料可能被后续公告更正或限定范围。",
    next: "反向查找后续更正、终止、投诉、部分验收等材料。",
    safety: "不只找支持材料，也主动找可能改变结论的后续信息。",
    answer: "“系统不只正向搜支持材料，还会反向检查更正、终止和部分验收，避免只看到有利的旧版本。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_yes", "stage", "version_check"],
  },
  version_conflict: {
    state: "manual",
    stateLabel: "人工复核",
    title: "分支：发现更正、终止或材料冲突",
    summary: "后续信息可能改变原判断，系统锁住自动结论并把冲突交给人工。",
    quote: "“验收范围仅为包组01；包组02终止。”",
    conditions: [["stop", "版本冲突", "已发现"], ["wait", "实际适用范围", "待人工确认"], ["wait", "最终材料", "待定"]],
    result: "冲突待复核，不自动升级阶段",
    reason: "更正、终止或范围差异可能使旧材料失效或仅部分有效。",
    next: "由工作人员确认最新版本、包组范围和材料效力。",
    safety: "有未处理反证时，不形成自动支持。",
    answer: "“发现后续更正或终止后，系统会锁住原结论，让工作人员确认哪个版本、哪个包组才有效。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_yes", "stage", "version_check", "version_conflict"],
  },
  version_clear: {
    state: "supported",
    stateLabel: "待最终确认",
    title: "分支：未发现会改变判断的后续冲突",
    summary: "支持材料、项目、主体和阶段均已整理，可以形成一条交给工作人员的复核候选。",
    quote: "当前未发现更正、终止、部分验收或跨来源硬冲突。",
    conditions: [["pass", "支持材料", "可回看"], ["pass", "反证检查", "未发现阻断项"], ["wait", "最终业务结论", "待人工"]],
    result: "形成复核候选，交工作人员确认",
    reason: "系统已完成重复性的搜索、读取、对齐、分阶段和冲突检查。",
    next: "工作人员回看原文，确认、补证、退回或记录意见。",
    safety: "没有发现冲突不等于机器作出最终认定。",
    answer: "“所有机器门通过后，系统交付的仍然是一条可复核候选，而不是机器盖章。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_yes", "stage", "version_check", "version_clear"],
  },
  human: {
    state: "manual",
    stateLabel: "最终确认",
    title: "最终一步：工作人员作正式确认",
    summary: "系统把原文、来源、理由、疑点和下一步整理成复核任务，工作人员保留最终认定权。",
    quote: "“系统输出仅用于初步核查和任务分流，正式结论以有权工作人员复核为准。”",
    conditions: [
      ["pass", "原文与来源", "可回看"],
      ["pass", "判断理由", "可解释"],
      ["pass", "疑点与下一步", "已列明"],
    ],
    result: "形成可复核记录，等待最终确认",
    reason: "系统已经承担重复性的搜索、阅读、对齐和留痕，但不替代业务人员行使判断权。",
    next: "工作人员确认、补证、退回或记录处理意见。",
    safety: "系统输出是复核候选，不是自动处罚或最终评分。",
    answer: "“我们的目标不是让AI替政府拍板，而是把一条自报变成有原文、有理由、有疑点、能交给人确认的复核任务。”",
    path: ["claim", "candidate", "candidate_yes", "source", "source_yes", "project", "project_yes", "entity", "entity_yes", "stage", "version_check", "version_clear", "human"],
  },
};

const ui = {
  tree: document.querySelector("#logic-tree"),
  reset: document.querySelector("#reset-path"),
  state: document.querySelector("#case-state"),
  title: document.querySelector("#selected-title"),
  summary: document.querySelector("#selected-summary"),
  company: document.querySelector("#claim-company"),
  project: document.querySelector("#claim-project"),
  quote: document.querySelector("#evidence-quote"),
  conditions: document.querySelector("#condition-list"),
  result: document.querySelector("#output-result"),
  reason: document.querySelector("#output-reason"),
  next: document.querySelector("#output-next"),
  safety: document.querySelector("#safety-copy"),
  answer: document.querySelector("#answer-copy"),
};

function renderConditions(rows) {
  ui.conditions.replaceChildren(
    ...rows.map(([status, label, value]) => {
      const row = document.createElement("div");
      row.className = `condition-row ${status}`;

      const icon = document.createElement("span");
      icon.className = "condition-icon";
      icon.textContent = status === "pass" ? "✓" : status === "stop" ? "!" : "?";

      const name = document.createElement("span");
      name.textContent = label;

      const result = document.createElement("b");
      result.textContent = value;

      row.append(icon, name, result);
      return row;
    }),
  );
}

function highlightPath(nodeId, path) {
  ui.tree.querySelectorAll("[data-node]").forEach((button) => {
    const id = button.dataset.node;
    button.classList.toggle("is-active", id === nodeId);
    button.classList.toggle("is-path", path.includes(id) && id !== nodeId);
    button.setAttribute("aria-pressed", id === nodeId ? "true" : "false");
  });
}

function showNode(nodeId, options = {}) {
  const detail = NODE_DETAILS[nodeId];
  if (!detail) return;

  ui.state.className = `case-state ${detail.state}`;
  ui.state.textContent = detail.stateLabel;
  ui.title.textContent = detail.title;
  ui.summary.textContent = detail.summary;
  ui.company.textContent = DEMO.company;
  ui.project.textContent = DEMO.project;
  ui.quote.textContent = detail.quote;
  ui.result.textContent = detail.result;
  ui.reason.textContent = detail.reason;
  ui.next.textContent = detail.next;
  ui.safety.textContent = detail.safety;
  ui.answer.textContent = detail.answer;
  renderConditions(detail.conditions);
  highlightPath(nodeId, detail.path);

  if (options.scroll && window.matchMedia("(max-width: 1120px)").matches) {
    document.querySelector(".case-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

ui.tree.addEventListener("click", (event) => {
  const node = event.target.closest("[data-node]");
  if (!node) return;
  showNode(node.dataset.node, { scroll: true });
});

ui.reset.addEventListener("click", () => {
  showNode(DEFAULT_NODE);
  document.querySelector(`[data-node="${DEFAULT_NODE}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
});

showNode(DEFAULT_NODE);
