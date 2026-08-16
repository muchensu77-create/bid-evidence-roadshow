(function attachEvidenceEngine(globalScope) {
  "use strict";

  const CLAIM_ALIASES = {
    id: ["id", "seq", "case_id", "claim_id", "序号", "案例编号", "记录编号"],
    company: ["company", "bidder", "bidder_name", "company_name", "投标人", "投标公司", "本次投标公司", "公司名称", "企业名称"],
    companyCode: ["company_code", "bidder_code", "credit_code", "uscc", "统一社会信用代码", "投标人信用代码", "企业信用代码", "公司信用代码"],
    projectName: ["achievement", "project_name", "claimed_project", "历史项目名称", "申报项目名称", "业绩名称", "项目名称", "业绩"],
    projectCode: ["project_code", "purchase_project_code", "procurement_code", "tender_code", "transaction_code", "项目编号", "采购编号", "招标编号", "交易编号"],
    packageCode: ["package_code", "section_code", "lot_code", "包组编号", "标段编号", "标包编号", "包号"],
    purchaser: ["purchaser", "owner", "buyer", "client", "采购人", "采购单位", "招标人", "业主单位", "项目业主", "服务单位"],
    date: ["project_date", "date", "start_date", "publish_date", "项目日期", "项目时间", "实施时间", "中标时间", "日期"],
    amount: ["amount", "project_amount", "contract_amount", "项目金额", "总金额", "合同金额", "中标金额"],
    region: ["region", "province", "city", "area", "地区", "省份", "城市", "行政区划"],
    role: ["role", "supplier_role", "项目角色", "承担角色", "供应商角色"],
    sourcePage: ["source_page", "page", "页码", "投标文件页码", "证明材料页码"]
  };

  const NOTICE_ALIASES = {
    id: ["notice_id", "id", "record_id", "公告编号", "记录编号", "序号"],
    noticeType: ["notice_type", "type", "info_type", "公告类型", "信息类型", "公告类别"],
    projectName: ["project_name", "title", "notice_title", "项目名称", "公告标题", "标题", "项目标题"],
    projectCode: ["project_code", "purchase_project_code", "procurement_code", "tender_code", "transaction_code", "项目编号", "采购编号", "招标编号", "交易编号"],
    packageCode: ["package_code", "section_code", "lot_code", "包组编号", "标段编号", "标包编号", "包号"],
    purchaser: ["purchaser", "owner", "buyer", "采购人", "采购单位", "招标单位", "招采单位", "业主单位"],
    supplierName: ["supplier_name", "winner", "winner_name", "bidder_name", "中标供应商名称", "中标/成交供应商", "中标单位", "中标人", "成交供应商", "供应商名称", "投标人", "投标单位"],
    supplierCode: ["supplier_code", "winner_code", "credit_code", "uscc", "中标供应商统一社会信用代码", "中标供应商代码", "供应商信用代码", "统一社会信用代码"],
    supplierRole: ["supplier_role", "role", "中标角色", "供应商角色", "参与角色"],
    awardStatus: ["award_status", "winning_status", "is_winner", "中标状态", "成交状态", "是否中标"],
    amount: ["amount", "winning_amount", "contract_amount", "budget", "中标/成交金额", "中标金额", "成交金额", "合同金额", "预算"],
    publishDate: ["publish_date", "date", "announcement_date", "发布日期", "公告日期", "发布时间", "中标时间"],
    region: ["region", "province", "city", "area", "地区", "省份", "城市", "行政区划"],
    sourceUrl: ["source_url", "url", "link", "official_url", "原文网址", "公告链接", "官方链接", "网址", "链接"],
    sourceLocalPath: ["local_path", "source_local_path", "file_path", "本地文件", "本地路径", "文件路径"],
    sourceMarker: ["source_marker", "provenance_marker", "来源标识", "来源标记"],
    sourceOfficiality: ["officiality", "source_officiality", "source_kind", "source_type", "来源性质", "来源类型", "是否官方"],
    sourcePlatform: ["source_platform", "platform", "source", "来源平台", "来源网站", "平台名称"],
    sourceTitle: ["source_title", "page_title", "来源标题", "网页标题"],
    sourceExcerpt: ["source_excerpt", "excerpt", "summary", "content", "raw_text", "原文摘录", "公告正文", "正文", "摘要"]
  };

  const STATUS_LABELS = {
    supported: "证据支持",
    conflict: "明确字段冲突",
    review: "复杂待复核",
    insufficient: "公开证据不足",
    pending: "尚未核验"
  };

  const STAGE_LABELS = {
    acceptance: "验收/履约证据",
    contract: "合同证据",
    award: "中标/成交证据",
    solicitation: "仅招标阶段",
    unknown: "证据阶段未知",
    none: "尚无公开证据"
  };

  const OFFICIALITY_LABELS = {
    official: "官方来源",
    user_provided: "获授权材料",
    demo_official: "虚构演示（模拟官方材料）",
    aggregator: "第三方候选目录",
    unknown: "来源性质待确认"
  };

  const DEMO_SOURCE_MARKER = "DEMO_ONLY";

  const COMPLETION_POLICY = Object.freeze({
    schema_version: "1.0.0",
    policy_id: "organizer-completion-acceptance-2026-08-15",
    name: "主办方口径：已经完成（至少验收）",
    short_name: "验收为完成门槛",
    description: "依据主办方2026-08-15回复：中标仅是线索，合同可证明曾开展过，验收才达到‘已经完成’的最低证据门槛；所有结果仍须人工确认。",
    required_evidence_stage: "acceptance",
    automated_checks: Object.freeze(["evidence_stage"]),
    time_window: Object.freeze({ status: "not_configured" }),
    similar_project: Object.freeze({ status: "not_configured", required_keywords: Object.freeze([]) }),
    role: Object.freeze({ status: "not_configured", allowed_roles: Object.freeze([]) })
  });

  function unconfiguredEligibility() {
    const label = "尚未应用完成口径";
    const reason = "主办方已明确验收是‘已经完成’的最低门槛；当前结果尚未执行该阶段判断，事实核验结果不受影响。";
    return { status: "not_configured", label, reason, reasons: [reason] };
  }

  const MISSING_PLACEHOLDERS = new Set([
    "", "-", "--", "—", "/", "\\", "0", "无", "暂无", "没有", "未知", "不详",
    "未提供", "未公开", "未披露", "缺失", "空", "待定", "不适用", "null", "none",
    "nil", "na", "n/a", "notavailable"
  ]);

  const CONCLUSIVE_STAGES = new Set(["award", "contract", "acceptance"]);
  const AUTHORITATIVE_OFFICIALITIES = new Set(["official", "user_provided", "demo_official"]);
  const STRONG_PROJECT_CODE_TYPES = new Set(["procurement_project", "tender", "transaction", "contract"]);
  const PROJECT_CODE_TYPE_PRIORITY = {
    procurement_project: 1,
    tender: 2,
    transaction: 3,
    contract: 4,
    internal: 5,
    unknown: 6,
    package: 7
  };
  const PROJECT_NOTICE_TITLE_SUFFIXES = [
    "履约验收结果公告", "履约验收公告", "验收结果公告", "验收公告", "履约公告",
    "中标结果公告", "成交结果公告", "中标公告", "成交公告", "定标公告",
    "中标候选人公示", "成交候选人公示", "候选人公示", "评标结果公示",
    "合同公告", "合同公示", "合同备案", "签约公告",
    "竞争性磋商公告", "公开招标公告", "资格预审公告", "采购公告", "招标公告", "询价公告", "竞价公告"
  ].sort((left, right) => right.length - left.length);
  const FLAT_PROJECT_CODE_TYPES = new Map([
    ["purchaseprojectcode", "procurement_project"],
    ["procurementcode", "procurement_project"],
    ["采购项目编号", "procurement_project"],
    ["采购编号", "procurement_project"],
    ["tendercode", "tender"],
    ["招标编号", "tender"],
    ["transactioncode", "transaction"],
    ["交易编号", "transaction"],
    ["projectcode", "unknown"],
    ["项目编号", "unknown"]
  ]);
  const NORMALIZED_TEXT_CACHE = new Map();
  const BIGRAM_CACHE = new Map();
  const IDENTIFIER_CACHE = new Map();
  const MISSING_VALUE_CACHE = new Map();
  const BASE_PROJECT_TITLE_CACHE = new Map();
  let ACTIVE_MATCH_RUN_CACHE = null;

  function asString(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value).trim();
  }

  function redactLocalPaths(value) {
    const protectedUrls = [];
    const protectedText = asString(value).replace(/https?:\/\/[^\s"'<>，。；)）】]*/giu, (url) => {
      const token = `__PUBLIC_URL_${protectedUrls.length}__`;
      protectedUrls.push(url);
      return token;
    });
    const redacted = protectedText
      .replace(/file:\/\/\/[^\s"'<>，。；]*/giu, "[本地路径已隐藏]")
      .replace(/\/(?:Users|home|var|tmp|Volumes|private|opt|mnt|data|usr|etc|Applications|Library)(?:\/[^\s"'<>，。；)）】]*)?/giu, "[本地路径已隐藏]")
      .replace(/[A-Za-z]:\\[^\s"'<>，。；]*/giu, "[本地路径已隐藏]")
      .replace(/\\\\[A-Za-z0-9._-]+\\[^\s"'<>，。；]*/gu, "[网络路径已隐藏]")
      .replace(/private_data(?:[\\/][^\s"'<>，。；]*)?/giu, "[受控目录已隐藏]");
    return redacted.replace(/__PUBLIC_URL_(\d+)__/g, (_, index) => protectedUrls[Number(index)] || "[网址已隐藏]");
  }

  function sanitizeExportValue(value) {
    if (Array.isArray(value)) return value.map(sanitizeExportValue);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeExportValue(item)]));
    }
    return typeof value === "string" ? redactLocalPaths(value) : value;
  }

  function normalizeHeader(value) {
    return asString(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s_\-—–/\\()（）\[\]【】.:：]+/g, "");
  }

  function normalizeText(value) {
    const raw = asString(value);
    if (isMissingPlaceholder(raw)) return "";
    if (NORMALIZED_TEXT_CACHE.has(raw)) return NORMALIZED_TEXT_CACHE.get(raw);
    const normalized = raw
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, "");
    if (NORMALIZED_TEXT_CACHE.size > 20000) NORMALIZED_TEXT_CACHE.clear();
    NORMALIZED_TEXT_CACHE.set(raw, normalized);
    return normalized;
  }

  function placeholderToken(value) {
    return asString(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[，。；：、]/g, "");
  }

  function isMissingPlaceholder(value) {
    const raw = asString(value);
    if (MISSING_VALUE_CACHE.has(raw)) return MISSING_VALUE_CACHE.get(raw);
    const missing = MISSING_PLACEHOLDERS.has(placeholderToken(raw));
    if (MISSING_VALUE_CACHE.size > 20000) MISSING_VALUE_CACHE.clear();
    MISSING_VALUE_CACHE.set(raw, missing);
    return missing;
  }

  function normalizeIdentifier(value, minLength = 3) {
    const raw = asString(value);
    const cacheKey = `${minLength}\u0000${raw}`;
    if (IDENTIFIER_CACHE.has(cacheKey)) return IDENTIFIER_CACHE.get(cacheKey);
    if (isMissingPlaceholder(raw)) return "";
    let normalized = raw
      .normalize("NFKC")
      .toUpperCase()
      .replace(/[^0-9A-Z\p{Script=Han}]/gu, "");
    if (normalized.length < minLength || new Set(normalized).size < 2) normalized = "";
    if (IDENTIFIER_CACHE.size > 30000) IDENTIFIER_CACHE.clear();
    IDENTIFIER_CACHE.set(cacheKey, normalized);
    return normalized;
  }

  function normalizeEntity(value) {
    return normalizeText(value)
      .replace(/(股份)?有限责任公司$/u, "有限公司")
      .replace(/有限责任公司$/u, "有限公司");
  }

  function findKey(record, aliases) {
    const entries = Object.keys(record || {}).map((key) => [key, normalizeHeader(key)]);
    const normalizedAliases = aliases.map(normalizeHeader);
    for (const alias of normalizedAliases) {
      const exact = entries.find(([, normalized]) => normalized === alias);
      if (exact) return exact[0];
    }
    return null;
  }

  function mapRecord(record, aliasMap, index) {
    const mapped = { _raw: record, _mapping: {} };
    for (const [field, aliases] of Object.entries(aliasMap)) {
      const key = findKey(record, aliases);
      mapped[field] = key ? asString(record[key]) : "";
      mapped._mapping[field] = key || "";
    }
    if (!mapped.id) mapped.id = String(index + 1);
    return mapped;
  }

  function textValueRaw(value) {
    if (value && typeof value === "object" && !Array.isArray(value) && "raw" in value) return asString(value.raw);
    return asString(value);
  }

  function compareStableText(left, right) {
    const a = asString(left);
    const b = asString(right);
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }

  function normalizeProjectCodeType(value) {
    const normalized = normalizeHeader(value);
    return ({
      procurementproject: "procurement_project",
      purchaseproject: "procurement_project",
      procurement: "procurement_project",
      采购项目: "procurement_project",
      采购: "procurement_project",
      tender: "tender",
      招标: "tender",
      transaction: "transaction",
      交易: "transaction",
      package: "package",
      lot: "package",
      section: "package",
      包组: "package",
      标包: "package",
      标段: "package",
      contract: "contract",
      合同: "contract",
      internal: "internal",
      内部: "internal",
      unknown: "unknown",
      未知: "unknown"
    })[normalized] || "unknown";
  }

  function canonicalProjectCodes(codes, defaults = {}) {
    if (!Array.isArray(codes)) return [];
    const deduplicated = new Map();
    codes.forEach((item) => {
      const objectItem = item && typeof item === "object" && !Array.isArray(item) ? item : null;
      const value = textValueRaw(objectItem ? objectItem.value : item);
      if (isMissingPlaceholder(value)) return;
      const codeType = normalizeProjectCodeType(objectItem?.codeType || objectItem?.code_type || defaults.codeType);
      const sourceField = asString(objectItem?.sourceField || objectItem?.source_field || defaults.sourceField);
      const legacy = Boolean(objectItem?._legacy ?? objectItem?.legacy ?? defaults.legacy);
      const normalizedValue = normalizeIdentifier(value) || normalizeText(value);
      const key = `${codeType}\u0000${normalizedValue}\u0000${legacy ? "1" : "0"}`;
      const candidate = { value, codeType, sourceField, _legacy: legacy };
      const existing = deduplicated.get(key);
      const candidateHasSource = Boolean(sourceField);
      const existingHasSource = Boolean(existing?.sourceField);
      if (!existing
        || (candidateHasSource && !existingHasSource)
        || (candidateHasSource === existingHasSource && compareStableText(sourceField, existing.sourceField) < 0)
        || (candidateHasSource === existingHasSource
          && sourceField === existing.sourceField
          && compareStableText(value, existing.value) < 0)) {
        deduplicated.set(key, candidate);
      }
    });
    return [...deduplicated.values()].sort((left, right) =>
      ((PROJECT_CODE_TYPE_PRIORITY[left.codeType] || 99) - (PROJECT_CODE_TYPE_PRIORITY[right.codeType] || 99))
      || compareStableText(normalizeIdentifier(left.value) || normalizeText(left.value), normalizeIdentifier(right.value) || normalizeText(right.value))
      || compareStableText(left.sourceField, right.sourceField)
      || compareStableText(left.value, right.value)
    );
  }

  function collectFlatProjectCodes(record, fallbackValue = "", fallbackSourceField = "") {
    const collected = [];
    Object.entries(record || {}).forEach(([key, value]) => {
      const codeType = FLAT_PROJECT_CODE_TYPES.get(normalizeHeader(key));
      if (!codeType) return;
      collected.push({ value, codeType, sourceField: key, _legacy: codeType === "unknown" });
    });
    if (Array.isArray(record?.projectCodes)) collected.push(...record.projectCodes);
    if (Array.isArray(record?.project_codes)) collected.push(...record.project_codes);
    if (!collected.length && !isMissingPlaceholder(fallbackValue)) {
      collected.push({ value: fallbackValue, codeType: "unknown", sourceField: fallbackSourceField, _legacy: true });
    }
    return canonicalProjectCodes(collected);
  }

  function primaryProjectCode(projectCodes) {
    return asString(projectCodes?.[0]?.value);
  }

  function projectCodeIndex(record) {
    const cache = ACTIVE_MATCH_RUN_CACHE?.projectCodeIndexes;
    if (cache && record && typeof record === "object" && cache.has(record)) {
      return cache.get(record);
    }
    let codes = [];
    if (Array.isArray(record?.projectCodes)) codes = canonicalProjectCodes(record.projectCodes);
    else if (Array.isArray(record?.project_codes)) codes = canonicalProjectCodes(record.project_codes);
    else if (!isMissingPlaceholder(record?.projectCode)) {
      codes = canonicalProjectCodes([{ value: record.projectCode, codeType: "unknown", _legacy: true }]);
    }
    const byType = new Map();
    const allValues = new Map();
    const legacyValuesByType = new Map();
    codes.forEach((code) => {
      const normalizedValue = normalizeIdentifier(code.value);
      if (!normalizedValue) return;
      if (!byType.has(code.codeType)) byType.set(code.codeType, new Set());
      byType.get(code.codeType).add(normalizedValue);
      if (!allValues.has(normalizedValue)) allValues.set(normalizedValue, new Set());
      allValues.get(normalizedValue).add(code.codeType);
      if (code._legacy === true) {
        if (!legacyValuesByType.has(code.codeType)) legacyValuesByType.set(code.codeType, new Set());
        legacyValuesByType.get(code.codeType).add(normalizedValue);
      }
    });
    const identityCodes = codes.filter((code) => code.codeType !== "package" && normalizeIdentifier(code.value));
    const index = { codes, identityCodes, byType, allValues, legacyValuesByType };
    if (cache && record && typeof record === "object") cache.set(record, index);
    return index;
  }

  function setIntersection(left, right) {
    const values = [];
    left.forEach((value) => {
      if (right.has(value)) values.push(value);
    });
    return values.sort(compareStableText);
  }

  function compareProjectCodeSets(leftRecord, rightRecord) {
    const left = projectCodeIndex(leftRecord);
    const right = projectCodeIndex(rightRecord);
    const sharedTypes = [...left.byType.keys()]
      .filter((type) => type !== "package" && right.byType.has(type))
      .sort(compareStableText);
    const matchedTypes = [];
    const legacyMatchedTypes = [];
    const weakMatchedTypes = [];
    const conflictingTypes = [];

    sharedTypes.forEach((type) => {
      const intersection = setIntersection(left.byType.get(type), right.byType.get(type));
      if (STRONG_PROJECT_CODE_TYPES.has(type)) {
        if (intersection.length) matchedTypes.push(type);
        else conflictingTypes.push(type);
        return;
      }
      if (type === "unknown") {
        const leftLegacy = left.legacyValuesByType.get(type) || new Set();
        const rightLegacy = right.legacyValuesByType.get(type) || new Set();
        const legacyIntersection = setIntersection(leftLegacy, rightLegacy);
        if (legacyIntersection.length) legacyMatchedTypes.push(type);
        else if (leftLegacy.size && rightLegacy.size) conflictingTypes.push(type);
        if (intersection.some((value) => !legacyIntersection.includes(value))) weakMatchedTypes.push(type);
        return;
      }
      if (intersection.length) weakMatchedTypes.push(type);
    });

    const crossTypeSameValues = [];
    left.allValues.forEach((leftTypes, value) => {
      const rightTypes = right.allValues.get(value);
      if (!rightTypes) return;
      const hasComparableSameType = [...leftTypes].some((type) => {
        if (type === "package" || !rightTypes.has(type)) return false;
        if (STRONG_PROJECT_CODE_TYPES.has(type)) return true;
        return type === "unknown"
          && left.legacyValuesByType.get(type)?.has(value)
          && right.legacyValuesByType.get(type)?.has(value);
      });
      const hasDifferentIdentityTypes = [...leftTypes].some((leftType) =>
        leftType !== "package" && [...rightTypes].some((rightType) => rightType !== "package" && rightType !== leftType)
      );
      if (!hasComparableSameType && hasDifferentIdentityTypes) crossTypeSameValues.push(value);
    });

    return {
      hasLeft: left.identityCodes.length > 0,
      hasRight: right.identityCodes.length > 0,
      exact: matchedTypes.length > 0 || legacyMatchedTypes.length > 0,
      strongExact: matchedTypes.length > 0,
      legacyExact: legacyMatchedTypes.length > 0,
      weakMatch: weakMatchedTypes.length > 0,
      conflict: conflictingTypes.length > 0,
      typeMismatch: crossTypeSameValues.length > 0,
      matchedTypes,
      legacyMatchedTypes,
      weakMatchedTypes,
      conflictingTypes,
      crossTypeSameValues: crossTypeSameValues.sort(compareStableText),
      leftCodes: left.codes,
      rightCodes: right.codes
    };
  }

  function projectCodesDisplay(record) {
    const codes = projectCodeIndex(record).codes;
    if (!codes.length) return "";
    return codes.map((code) => `${code.codeType}:${code.value}`).join("；");
  }

  function regionRaw(region) {
    if (!region || typeof region !== "object") return asString(region);
    return [region.province, region.city, region.district].map(asString).filter(Boolean).join(" / ");
  }

  function dateValueRaw(value) {
    if (!value || typeof value !== "object") return asString(value);
    return asString(value.raw || value.parsed_date || value.parsed_datetime || value.parsed_year);
  }

  function canonicalPackageCodes(values) {
    const deduplicated = new Map();
    (Array.isArray(values) ? values : []).forEach((value) => {
      const raw = textValueRaw(value);
      if (isMissingPlaceholder(raw)) return;
      const normalized = normalizeIdentifier(raw, 1) || normalizeText(raw);
      if (!deduplicated.has(normalized)) deduplicated.set(normalized, raw);
    });
    return [...deduplicated.values()].sort((left, right) =>
      compareStableText(normalizeIdentifier(left, 1) || normalizeText(left), normalizeIdentifier(right, 1) || normalizeText(right))
    );
  }

  function adaptSchemaClaim(record, index) {
    const project = record.project_claim || {};
    const dates = project.project_dates || {};
    const packages = Array.isArray(project.packages) ? project.packages : [];
    const projectCodes = canonicalProjectCodes(project.project_codes);
    const packageCodes = canonicalPackageCodes([
      ...packages,
      ...projectCodes.filter((code) => code.codeType === "package").map((code) => code.value)
    ]);
    return {
      id: asString(record.claim_id || record.source_seq || index + 1),
      company: textValueRaw(record.bidder?.name),
      companyCode: asString(record.bidder?.credit_code || record.bidder?.entity_id),
      projectName: textValueRaw(project.name),
      projectCode: primaryProjectCode(projectCodes),
      projectCodes,
      packageCode: packageCodes[0] || "",
      packageCodes,
      packageScopeAmbiguous: packageCodes.length > 1,
      purchaser: textValueRaw(project.purchaser?.name),
      date: dateValueRaw(dates.start || dates.end || dates.award),
      amount: textValueRaw(project.claimed_amount),
      region: regionRaw(project.region),
      role: asString(project.role),
      sourcePage: asString(record.source_locator?.page),
      _raw: record,
      _mapping: { schema: "claims.schema.json@1.0.0" }
    };
  }

  function resolvePackage(project, packageRef) {
    const packages = Array.isArray(project?.packages) ? project.packages : [];
    const matched = packages.find((item) => asString(item?.package_id) === asString(packageRef));
    const selected = matched || (isMissingPlaceholder(packageRef) ? packages[0] : null);
    const packageCode = canonicalProjectCodes(selected?.code ? [selected.code] : [])[0];
    return asString(packageCode?.value) || textValueRaw(selected?.name) || asString(packageRef || selected?.package_id);
  }

  function resolvePackages(project, packageRefs) {
    const packages = Array.isArray(project?.packages) ? project.packages : [];
    const refs = Array.isArray(packageRefs) ? packageRefs.filter((value) => !isMissingPlaceholder(value)) : [];
    if (refs.length) return canonicalPackageCodes(refs.map((packageRef) => resolvePackage(project, packageRef)));
    return canonicalPackageCodes(packages.map((item) => resolvePackage({ packages: [item] }, item?.package_id)));
  }

  function adaptSchemaNotice(record, index) {
    const project = record.project || {};
    const suppliers = Array.isArray(record.suppliers) && record.suppliers.length ? record.suppliers : [null];
    const source = record.source || {};
    const projectCodes = canonicalProjectCodes(project.project_codes);
    const projectLevelPackageCodes = projectCodes.filter((code) => code.codeType === "package").map((code) => code.value);
    const projectPackageCount = Array.isArray(project.packages) ? project.packages.length : 0;
    return suppliers.map((supplier, supplierIndex) => {
      const packageRefs = Array.isArray(supplier?.package_refs) ? supplier.package_refs : [];
      const packageCodes = canonicalPackageCodes([...resolvePackages(project, packageRefs), ...projectLevelPackageCodes]);
      return {
        id: asString(`${record.notice_id || index + 1}${supplier ? `::${supplier.supplier_id || supplierIndex + 1}` : ""}`),
        noticeType: asString(record.notice_type),
        projectName: textValueRaw(project.name) || textValueRaw(record.title),
        projectCode: primaryProjectCode(projectCodes),
        projectCodes,
        packageCode: packageCodes[0] || "",
        packageCodes,
        packageScopeAmbiguous: packageCodes.length > 1 || packageRefs.length > 1,
        projectHasMultiplePackages: projectPackageCount > 1,
        purchaser: textValueRaw(record.purchaser?.name),
        supplierName: textValueRaw(supplier?.entity?.name),
        supplierCode: asString(supplier?.entity?.credit_code || supplier?.entity?.entity_id),
        supplierRole: asString(supplier?.role),
        awardStatus: asString(supplier?.award_status),
        amount: textValueRaw(supplier?.amounts?.[0] || record.amounts?.[0]),
        publishDate: dateValueRaw(record.publication_date),
        region: regionRaw(record.region),
        sourceUrl: asString(source.source_url),
        sourceLocalPath: asString(source.local_path),
        sourceMarker: asString(source.source_marker),
        sourceOfficiality: asString(source.officiality),
        sourcePlatform: asString(source.source_platform),
        sourceTitle: textValueRaw(record.title),
        sourceExcerpt: asString(record.content?.raw_text),
        _raw: record,
        _mapping: { schema: "notices.schema.json@1.0.0" }
      };
    });
  }

  function parseCSV(text) {
    const source = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field.replace(/\r$/, ""));
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) rows.push(row);
    if (!rows.length) return [];

    const headers = rows[0].map((header, index) => header || `column_${index + 1}`);
    return rows.slice(1).map((values) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? "";
      });
      return record;
    });
  }

  function extractRows(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (!parsed || typeof parsed !== "object") return [];
    const preferredKeys = ["data", "records", "items", "rows", "list", "result"];
    for (const key of preferredKeys) {
      if (Array.isArray(parsed[key])) return parsed[key];
      if (parsed[key] && Array.isArray(parsed[key].data)) return parsed[key].data;
    }
    const firstArray = Object.values(parsed).find(Array.isArray);
    return firstArray || [];
  }

  function parseDatasetText(text, filename = "") {
    const source = text.replace(/^\uFEFF/, "");
    const lower = filename.toLowerCase();
    if (lower.endsWith(".csv")) return parseCSV(source);
    if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) {
      return source.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
        try {
          return JSON.parse(line);
        } catch {
          throw new Error(`JSONL 第 ${index + 1} 行不是有效 JSON。`);
        }
      });
    }
    try {
      return extractRows(JSON.parse(source));
    } catch (error) {
      if (source.includes(",") && source.includes("\n")) return parseCSV(source);
      throw new Error("文件既不是有效 JSON，也无法按 CSV 读取。");
    }
  }

  function normalizeClaims(rows) {
    return rows.map((record, index) => {
      if (record && typeof record === "object" && record.bidder && record.project_claim) return adaptSchemaClaim(record, index);
      const mapped = mapRecord(record, CLAIM_ALIASES, index);
      mapped.projectCodes = collectFlatProjectCodes(record, mapped.projectCode, mapped._mapping.projectCode);
      mapped.projectCode = primaryProjectCode(mapped.projectCodes) || mapped.projectCode;
      mapped.packageCodes = canonicalPackageCodes([mapped.packageCode]);
      mapped.packageScopeAmbiguous = false;
      return mapped;
    });
  }

  function normalizeNotices(rows) {
    return rows.flatMap((record, index) => {
      if (record && typeof record === "object" && record.project && record.source) return adaptSchemaNotice(record, index);
      const mapped = mapRecord(record, NOTICE_ALIASES, index);
      mapped.projectCodes = collectFlatProjectCodes(record, mapped.projectCode, mapped._mapping.projectCode);
      mapped.projectCode = primaryProjectCode(mapped.projectCodes) || mapped.projectCode;
      mapped.packageCodes = canonicalPackageCodes([mapped.packageCode]);
      mapped.packageScopeAmbiguous = false;
      const supplierHeader = normalizeHeader(mapped._mapping.supplierName);
      if (!mapped.supplierRole && ["biddername", "投标人", "投标单位"].includes(supplierHeader)) mapped.supplierRole = "bidder";
      return [mapped];
    });
  }

  function bigrams(value) {
    const text = normalizeText(value);
    if (!text) return [];
    if (BIGRAM_CACHE.has(text)) return BIGRAM_CACHE.get(text);
    if (text.length === 1) return [text];
    const grams = [];
    for (let index = 0; index < text.length - 1; index += 1) {
      grams.push(text.slice(index, index + 2));
    }
    if (BIGRAM_CACHE.size > 20000) BIGRAM_CACHE.clear();
    BIGRAM_CACHE.set(text, grams);
    return grams;
  }

  function diceSimilarity(left, right) {
    const a = bigrams(left);
    const b = bigrams(right);
    if (!a.length || !b.length) return 0;
    const counts = new Map();
    for (const gram of a) counts.set(gram, (counts.get(gram) || 0) + 1);
    let overlap = 0;
    for (const gram of b) {
      const count = counts.get(gram) || 0;
      if (count > 0) {
        overlap += 1;
        counts.set(gram, count - 1);
      }
    }
    return (2 * overlap) / (a.length + b.length);
  }

  function exactNormalized(left, right) {
    const a = normalizeText(left);
    const b = normalizeText(right);
    return Boolean(a && b && a === b);
  }

  function getYear(value) {
    const match = asString(value).match(/(?:19|20)\d{2}/);
    return match ? match[0] : "";
  }

  function normalizeBaseProjectTitle(value) {
    const raw = asString(value);
    if (BASE_PROJECT_TITLE_CACHE.has(raw)) return BASE_PROJECT_TITLE_CACHE.get(raw);
    let title = normalizeText(raw);
    let changed = true;
    while (changed && title) {
      changed = false;
      for (const suffix of PROJECT_NOTICE_TITLE_SUFFIXES) {
        if (title.length > suffix.length && title.endsWith(suffix)) {
          title = title.slice(0, -suffix.length);
          changed = true;
          break;
        }
      }
    }
    if (BASE_PROJECT_TITLE_CACHE.size > 20000) BASE_PROJECT_TITLE_CACHE.clear();
    BASE_PROJECT_TITLE_CACHE.set(raw, title);
    return title;
  }

  function deriveOfficiality(notice) {
    const cache = ACTIVE_MATCH_RUN_CACHE?.officialities;
    if (cache && notice && typeof notice === "object" && cache.has(notice)) return cache.get(notice);
    const raw = normalizeText(notice?.sourceOfficiality);
    const platform = normalizeText(notice?.sourcePlatform);
    const platformDeclaresAggregator = /aggregator|第三方|聚合|商用库|汇总库|商业数据库/u.test(platform);
    let officiality = "unknown";
    if (platformDeclaresAggregator) officiality = "aggregator";
    else if (/^(official|官方|政府网站|政府平台|公共资源交易平台)$/u.test(raw)) officiality = "official";
    else if (/^(userprovided|获授权材料|用户提供|政府提供|主办方提供)$/u.test(raw)) officiality = "user_provided";
    else if (/^(demoofficial|虚构演示|演示官方)$/u.test(raw)) officiality = "demo_official";
    else if (/^(aggregator|第三方|第三方平台|商用库|汇总库|聚合平台)$/u.test(raw)) officiality = "aggregator";
    if (cache && notice && typeof notice === "object") cache.set(notice, officiality);
    return officiality;
  }

  function deriveSourceMarker(notice) {
    const marker = asString(notice?.sourceMarker).toUpperCase();
    return marker === DEMO_SOURCE_MARKER || deriveOfficiality(notice) === "demo_official"
      ? DEMO_SOURCE_MARKER
      : "";
  }

  function isAuthoritativeEvidence(notice) {
    const cache = ACTIVE_MATCH_RUN_CACHE?.authoritativeEvidence;
    if (cache && notice && typeof notice === "object" && cache.has(notice)) {
      return cache.get(notice);
    }
    const hasLocator = Boolean(validHttpUrl(notice?.sourceUrl)) || !isMissingPlaceholder(notice?.sourceLocalPath);
    const authoritative = AUTHORITATIVE_OFFICIALITIES.has(deriveOfficiality(notice)) && hasLocator;
    if (cache && notice && typeof notice === "object") cache.set(notice, authoritative);
    return authoritative;
  }

  function classifyNoticeLabel(value) {
    const label = asString(value);
    const canonical = normalizeText(label);
    if (!canonical) return null;
    if (["termination", "correction", "other", "unknown"].includes(canonical)) return "unknown";
    if (["tender", "qualification"].includes(canonical)) return "solicitation";
    if (canonical === "award") return "award";
    if (canonical === "contract") return "contract";
    if (canonical === "acceptance") return "acceptance";
    if (/废标|流标|终止|中止|更正|变更/u.test(label)) return "unknown";
    if (/中标候选人|成交候选人|候选人公示|评标结果公示/u.test(label)) return "solicitation";
    if (/公开招标公告|招标公告|采购公告|采购意向|资格预审|竞争性磋商公告|询价公告|竞价公告/u.test(label)) return "solicitation";
    if (/履约验收|验收结果|履约评价公告|履约公告|完成证明/u.test(label)) return "acceptance";
    if (/合同公告|合同公示|合同备案|签约公告/u.test(label)) return "contract";
    if (/中标|成交|定标|结果公告/u.test(label)) return "award";
    if (/招标|磋商|询价|竞价/u.test(label)) return "solicitation";
    return null;
  }

  function explicitNonConclusiveTitleStage(value) {
    const title = normalizeText(value);
    if (!title) return null;
    if (/(?:未中标|未成交|落标).*(?:名单|公示|公告)$/u.test(title)
      || /(?:废标|流标|终止|中止|更正|变更)(?:公示|公告)$/u.test(title)) {
      return "unknown";
    }
    if (/(?:中标|成交)?候选人.*(?:公示|公告)$/u.test(title)
      || /评标结果公示$/u.test(title)
      || /(?:公开招标|招标|采购|采购意向|资格预审|竞争性磋商|询价|竞价)(?:公示|公告)$/u.test(title)) {
      return "solicitation";
    }
    return null;
  }

  function deriveEvidenceStage(notice) {
    if (!notice) return "none";
    const cache = ACTIVE_MATCH_RUN_CACHE?.evidenceStages;
    if (cache && typeof notice === "object" && cache.has(notice)) return cache.get(notice);
    const fromType = classifyNoticeLabel(notice.noticeType);
    const fromTitle = classifyNoticeLabel(notice.sourceTitle);
    const titleVetoes = [
      explicitNonConclusiveTitleStage(notice.sourceTitle),
      // 旧扁平 title 会适配为 projectName；只对结尾的强文种信号做保守 veto。
      explicitNonConclusiveTitleStage(notice.projectName)
    ].filter(Boolean);
    let stage = fromType !== null ? fromType : fromTitle || "unknown";
    if (titleVetoes.includes("unknown")) stage = "unknown";
    else if (titleVetoes.includes("solicitation")) stage = "solicitation";
    if (cache && typeof notice === "object") cache.set(notice, stage);
    return stage;
  }

  function assessSupplierStanding(notice) {
    const cache = ACTIVE_MATCH_RUN_CACHE?.supplierStandings;
    if (cache && notice && typeof notice === "object" && cache.has(notice)) {
      return cache.get(notice);
    }
    const finish = (result) => {
      if (cache && notice && typeof notice === "object") cache.set(notice, result);
      return result;
    };
    // 中标状态有自己的布尔语义：0/false 表示未中标，不能复用把“0”视为空的通用清洗。
    const rawStatus = asString(notice?.awardStatus);
    const status = rawStatus
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, "");
    const rawRole = asString(notice?.supplierRole);
    const role = rawRole
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, "");
    const statusAbsent = !status;
    const explicitlyUnknown = /^(unknown|null|none|na|未知|未提供|未公开|待定)$/u.test(status);
    const explicitlyNotAwarded = /^(0|false|no|n|notawarded|unsuccessful|rejected|未中标|未成交|未入围|未获推荐|未推荐|未当选|落标|淘汰|否)$/u.test(status);
    const explicitlyCandidate = /^(candidate|shortlisted|候选|候选人|入围)$/u.test(status)
      || /^(?:第[0-9一二三四五六七八九十]+)?(?:中标|成交)?候选人$/u.test(status)
      || /^(?:first|second|third)?(?:award|winning)?candidate$/u.test(status);
    const bidderOnly = /bidder|投标/u.test(role);
    const candidateRole = /candidate|shortlist|候选/u.test(role);
    const complexRole = /consortium|联合体|subcontract|分包/u.test(role);
    const finalSupplierRole = /^(awardee|contractor|winner|successfulbidder|winningbidder|中标人|中标单位|中标供应商|成交人|成交供应商|成交单位|承包人|合同乙方)$/u.test(role);
    const nonEmptyUnclearRole = Boolean(role && !bidderOnly && !candidateRole && !complexRole && !finalSupplierRole);
    const explicitlyAwarded = /^(1|true|yes|y|awarded|winner|中标|成交|已中标|已成交|是)$/u.test(status);
    if (explicitlyNotAwarded || explicitlyCandidate || ((bidderOnly || candidateRole) && !explicitlyAwarded)) {
      return finish({
        status: "excluded",
        label: "该行不是最终中标供应商记录",
        reason: "投标人、候选人或未中标记录不能作为历史供应商业绩证据。"
      });
    }
    if ((!statusAbsent && !explicitlyNotAwarded && !explicitlyCandidate && !explicitlyAwarded)
      || explicitlyUnknown
      || nonEmptyUnclearRole
      || (explicitlyAwarded && (bidderOnly || candidateRole))) {
      return finish({
        status: "review",
        label: "供应商中标角色待确认",
        reason: "供应商角色或中标状态存在未知/矛盾信息，需要回看公告原文。"
      });
    }
    if (notice?.packageScopeAmbiguous) {
      return finish({
        status: "review",
        label: "供应商对应多个包组，需复核",
        reason: "当前材料未把该供应商唯一定位到一个包组/标段，不能自动作主体结论。"
      });
    }
    if (complexRole) {
      return finish({
        status: "review",
        label: "联合体或分包角色待复核",
        reason: "该主体可能参与项目，但能否计作本次评分业绩取决于联合体/分包规则。"
      });
    }
    return finish({ status: "eligible", label: "可用于主体比对", reason: "" });
  }

  function projectCandidateScore(claim, notice) {
    const factors = [];
    const reasons = [];
    const titleScore = diceSimilarity(claim.projectName, notice.projectName);
    const claimBaseTitle = normalizeBaseProjectTitle(claim.projectName);
    const noticeBaseTitle = normalizeBaseProjectTitle(notice.projectName);
    const baseTitleExact = Boolean(claimBaseTitle && noticeBaseTitle && claimBaseTitle === noticeBaseTitle);
    factors.push({ value: titleScore, weight: 0.62 });
    if (titleScore >= 0.9) reasons.push("项目名称高度一致");
    else if (baseTitleExact) reasons.push("去除公告文种后缀后项目名称一致");
    else if (titleScore >= 0.65) reasons.push("项目名称较为相似");

    const projectCodeComparison = compareProjectCodeSets(claim, notice);
    const exactProjectCode = projectCodeComparison.exact;
    const projectCodeConflict = projectCodeComparison.conflict;
    if (projectCodeComparison.hasLeft && projectCodeComparison.hasRight) {
      if (exactProjectCode && !projectCodeConflict) {
        factors.push({ value: 1, weight: 0.25 });
        const types = [...projectCodeComparison.matchedTypes, ...projectCodeComparison.legacyMatchedTypes];
        reasons.push(`同类型项目编号一致${types.length ? `（${types.join("、")}）` : ""}`);
      } else if (projectCodeConflict) {
        factors.push({ value: exactProjectCode ? 0.55 : 0.08, weight: 0.25 });
        reasons.push(`同类型项目编号存在冲突（${projectCodeComparison.conflictingTypes.join("、")}）`);
      } else if (projectCodeComparison.weakMatch || projectCodeComparison.typeMismatch) {
        factors.push({ value: 0.35, weight: 0.12 });
      }
      if (projectCodeComparison.typeMismatch) reasons.push("编号文本相同但类型不同，未作为精确匹配");
      else if (projectCodeComparison.weakMatch && !exactProjectCode) reasons.push("编号类型未知或属内部编号，仅作候选线索");
    }

    const claimPackage = normalizeIdentifier(claim.packageCode, 1);
    const noticePackage = normalizeIdentifier(notice.packageCode, 1);
    let exactPackageCode = false;
    let packageConflict = false;
    const packageUnresolved = Boolean(claimPackage && !noticePackage);
    if (claimPackage && noticePackage) {
      exactPackageCode = claimPackage === noticePackage;
      packageConflict = !exactPackageCode;
      factors.push({ value: exactPackageCode ? 1 : 0, weight: 0.12 });
      reasons.push(exactPackageCode ? "包组/标段一致" : "包组/标段不一致");
    }

    let purchaserScore = 0;
    if (claim.purchaser && notice.purchaser) {
      purchaserScore = diceSimilarity(claim.purchaser, notice.purchaser);
      factors.push({ value: purchaserScore, weight: 0.09 });
      if (purchaserScore >= 0.82) reasons.push("采购人名称接近一致");
    }

    const claimYear = getYear(claim.date);
    const noticeYear = getYear(notice.publishDate);
    const yearMatch = claimYear && noticeYear ? claimYear === noticeYear : null;
    if (yearMatch !== null) {
      factors.push({ value: yearMatch ? 1 : 0, weight: 0.04 });
      reasons.push(yearMatch ? "年份一致" : "年份不同");
    }

    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    let score = factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / totalWeight;
    if (projectCodeConflict) score *= 0.55;
    if (packageConflict) score *= 0.35;
    return {
      score: Math.max(0, Math.min(1, score)),
      exactProjectCode,
      projectCodeConflict,
      projectCodeTypeMismatch: projectCodeComparison.typeMismatch,
      weakProjectCodeMatch: projectCodeComparison.weakMatch,
      projectCodeComparison,
      exactPackageCode,
      packageConflict,
      packageUnresolved,
      claimPackageScopeAmbiguous: Boolean(claim.packageScopeAmbiguous),
      titleScore,
      baseTitleExact,
      purchaserScore,
      yearMatch,
      reasons
    };
  }

  function assessProject(candidate) {
    if (!candidate) {
      return { status: "insufficient", label: "未找到可靠同项目证据", strength: "none" };
    }
    if (candidate.packageConflict) {
      return { status: "review", label: "项目相似但包组/标段不一致", strength: "weak" };
    }
    if (candidate.projectCodeConflict) {
      return { status: "review", label: "同类型项目编号存在冲突", strength: "weak" };
    }
    if (candidate.projectCodeTypeMismatch && !candidate.exactProjectCode) {
      return { status: "review", label: "编号值相同但类型不可直接等同", strength: "weak" };
    }
    if (candidate.score < 0.34) {
      return { status: "insufficient", label: "未找到可靠同项目证据", strength: "none" };
    }
    if (candidate.packageUnresolved || candidate.claimPackageScopeAmbiguous) {
      return { status: "review", label: "包组/标段范围未唯一确认", strength: "weak" };
    }
    const hardCodeSupport = candidate.exactProjectCode && (candidate.titleScore >= 0.45 || candidate.baseTitleExact);
    const multiFieldSupport = (candidate.titleScore >= 0.9 || candidate.baseTitleExact)
      && candidate.purchaserScore >= 0.82
      && candidate.yearMatch === true;
    if (hardCodeSupport || multiFieldSupport) {
      return { status: "supported", label: "有证据支持为同一项目", strength: hardCodeSupport ? "strong" : "medium" };
    }
    return { status: "review", label: "可能为同一项目，需复核", strength: "weak" };
  }

  function assessEntity(claim, notice, evidenceStage) {
    if (!notice || !notice.supplierName) {
      return {
        status: "insufficient",
        label: "未取得历史供应商信息",
        strength: "none",
        reason: "当前候选记录没有可用于核对的供应商名称。"
      };
    }

    if (!CONCLUSIVE_STAGES.has(evidenceStage)) {
      return {
        status: "insufficient",
        label: "当前材料尚未形成中标供应商证据",
        strength: "none",
        reason: "招标公告、候选人公示或类型不明的材料不能证明最终供应商。"
      };
    }

    if (!isAuthoritativeEvidence(notice)) {
      return {
        status: "review",
        label: "第三方候选待回看官方原文",
        strength: "weak",
        reason: "当前记录只用于寻找候选；在官方原文或获授权材料回看前，不作同一企业或冲突结论。"
      };
    }

    const claimRole = normalizeText(claim?.role);
    if (/consortium|联合体|subcontract|分包|branch|分公司/u.test(claimRole)) {
      return {
        status: "review",
        label: "声明主体角色需复核",
        strength: "weak",
        reason: "声明显示联合体、分包或分支机构角色，不能仅凭项目与主体代码自动计作本次业绩。"
      };
    }

    const supplierStanding = assessSupplierStanding(notice);
    if (supplierStanding.status === "excluded") {
      return {
        status: "insufficient",
        label: supplierStanding.label,
        strength: "none",
        reason: supplierStanding.reason
      };
    }
    if (supplierStanding.status === "review") {
      return {
        status: "review",
        label: supplierStanding.label,
        strength: "weak",
        reason: supplierStanding.reason
      };
    }

    const claimCode = normalizeIdentifier(claim.companyCode, 6);
    const supplierCode = normalizeIdentifier(notice.supplierCode, 6);
    if (claimCode && supplierCode) {
      if (claimCode === supplierCode) {
        return {
          status: "supported",
          label: "信用代码一致",
          strength: "strong",
          reason: "本次投标人与历史供应商的统一主体编号一致。"
        };
      }
      return {
        status: "conflict",
        label: "信用代码不一致",
        strength: "strong",
        reason: "同一候选项目下，两家企业的统一主体编号不同；仍需排查联合体、合并或材料填写问题。"
      };
    }

    const claimName = normalizeEntity(claim.company);
    const supplierName = normalizeEntity(notice.supplierName);
    if (claimName && supplierName && claimName === supplierName) {
      return {
        status: "review",
        label: "法定名称一致，主体编号待补",
        strength: "weak",
        reason: "双方企业名称完全一致，可作为候选线索，但仍需统一社会信用代码或权威更名链确认法律主体。"
      };
    }

    const nameScore = diceSimilarity(claim.company, notice.supplierName);
    if (nameScore >= 0.78) {
      return {
        status: "review",
        label: "名称相似，需核对主体关系",
        strength: "weak",
        reason: "名称相似只能说明值得进一步检查，不能证明是同一家企业。"
      };
    }
    return {
      status: "review",
      label: "名称不同且缺少代码",
      strength: "weak",
      reason: "可能涉及更名、母子公司、联合体或确为不同企业，现有信息不足以自动定案。"
    };
  }

  function overallStatus(project, entity, evidenceStage, authoritative, ambiguous) {
    if (project.status === "insufficient") return "insufficient";
    if (ambiguous) return "review";
    if (!CONCLUSIVE_STAGES.has(evidenceStage)) return "insufficient";
    if (!authoritative) return "review";
    if (project.status === "supported" && entity.status === "conflict") return "conflict";
    if (project.status === "supported" && entity.status === "supported") return "supported";
    if (entity.status === "insufficient") return "insufficient";
    return "review";
  }

  function stageRank(stage) {
    return { acceptance: 5, contract: 4, award: 3, solicitation: 1, unknown: 0, none: 0 }[stage] || 0;
  }

  function authorityRank(notice) {
    const officiality = deriveOfficiality(notice);
    return isAuthoritativeEvidence(notice) ? 2 : officiality === "aggregator" ? 1 : 0;
  }

  function candidateCompleteness(notice) {
    return [projectCodeIndex(notice).identityCodes.length ? "project-code-present" : "", notice.packageCode, notice.supplierName, notice.supplierCode, notice.sourceUrl || notice.sourceLocalPath]
      .reduce((count, value) => count + (isMissingPlaceholder(value) ? 0 : 1), 0);
  }

  function entityHintPriority(claim, notice) {
    const claimCode = normalizeIdentifier(claim.companyCode, 6);
    const supplierCode = normalizeIdentifier(notice.supplierCode, 6);
    if (claimCode && supplierCode && claimCode === supplierCode) return 2;
    const claimName = normalizeEntity(claim.company);
    const supplierName = normalizeEntity(notice.supplierName);
    return claimName && supplierName && claimName === supplierName ? 1 : 0;
  }

  function supplierStandingPriority(notice) {
    return ({ eligible: 2, review: 1, excluded: 0 })[assessSupplierStanding(notice).status] || 0;
  }

  function stableCandidateKey(notice) {
    const cache = ACTIVE_MATCH_RUN_CACHE?.stableCandidateKeys;
    if (cache && notice && typeof notice === "object" && cache.has(notice)) {
      return cache.get(notice);
    }
    const key = [
      projectCodesDisplay(notice),
      normalizeIdentifier(notice?.packageCode, 1),
      normalizeText(notice?.projectName),
      deriveEvidenceStage(notice),
      normalizeIdentifier(notice?.supplierCode, 6),
      normalizeEntity(notice?.supplierName),
      normalizeText(notice?.supplierRole),
      normalizeText(notice?.awardStatus),
      validHttpUrl(notice?.sourceUrl) || asString(notice?.sourceLocalPath),
      normalizeText(notice?.sourceOfficiality),
      normalizeText(notice?.sourcePlatform),
      normalizeText(notice?.sourceTitle),
      normalizeText(notice?.sourceExcerpt),
      normalizeText(notice?.purchaser),
      asString(notice?.publishDate),
      asString(notice?.amount),
      asString(notice?.packageCode),
      asString(notice?.projectName),
      asString(notice?.supplierCode),
      asString(notice?.supplierName),
      asString(notice?.supplierRole),
      asString(notice?.awardStatus),
      asString(notice?.sourceOfficiality),
      asString(notice?.sourcePlatform),
      asString(notice?.sourceTitle),
      asString(notice?.sourceExcerpt),
      asString(notice?.purchaser),
      asString(notice?.id)
    ].join("\u0000");
    if (cache && notice && typeof notice === "object") cache.set(notice, key);
    return key;
  }

  function sameBaseProject(left, right) {
    const codeComparison = compareProjectCodeSets(left?.notice, right?.notice);
    if (codeComparison.conflict) return false;
    if (codeComparison.exact) return true;
    const leftTitle = normalizeBaseProjectTitle(left?.notice?.projectName);
    const rightTitle = normalizeBaseProjectTitle(right?.notice?.projectName);
    const titleCompatible = Boolean(leftTitle && rightTitle && (leftTitle === rightTitle
      || diceSimilarity(left?.notice?.projectName, right?.notice?.projectName) >= 0.94));
    if (!titleCompatible) return false;
    const leftPurchaser = left?.notice?.purchaser;
    const rightPurchaser = right?.notice?.purchaser;
    if (leftPurchaser && rightPurchaser && diceSimilarity(leftPurchaser, rightPurchaser) < 0.82) return false;
    const leftYear = getYear(left?.notice?.publishDate);
    const rightYear = getYear(right?.notice?.publishDate);
    return !(leftYear && rightYear && leftYear !== rightYear);
  }

  function projectCandidateComparator(left, right) {
    return (right.score - left.score)
      || (Number(right.exactProjectCode) - Number(left.exactProjectCode))
      || (Number(right.exactPackageCode) - Number(left.exactPackageCode))
      || (right.titleScore - left.titleScore)
      || (right.purchaserScore - left.purchaserScore)
      || compareStableText(left.stableKey, right.stableKey);
  }

  function subjectEvidencePriority(candidate) {
    if (!CONCLUSIVE_STAGES.has(candidate.evidenceStage)) return 0;
    const standing = assessSupplierStanding(candidate.notice).status;
    const hasSupplier = !isMissingPlaceholder(candidate.notice.supplierName);
    const authoritative = isAuthoritativeEvidence(candidate.notice);
    if (standing === "eligible" && hasSupplier) return authoritative ? 6 : 4;
    if (standing === "review" && hasSupplier) return authoritative ? 5 : 3;
    return authoritative ? 2 : 1;
  }

  function evidenceCandidateComparator(left, right) {
    return (subjectEvidencePriority(right) - subjectEvidencePriority(left))
      || (right.authorityPriority - left.authorityPriority)
      || (right.stagePriority - left.stagePriority)
      || (right.supplierStandingPriority - left.supplierStandingPriority)
      || (right.entityHintPriority - left.entityHintPriority)
      || (right.score - left.score)
      || (right.completenessPriority - left.completenessPriority)
      || compareStableText(left.stableKey, right.stableKey);
  }

  function sameClaimedProjectScope(claim, anchor, candidate) {
    if (anchor === candidate) return true;
    if (anchor.exactProjectCode && candidate.exactProjectCode
      && !anchor.projectCodeConflict && !candidate.projectCodeConflict) return true;
    return sameBaseProject(anchor, candidate);
  }

  function confirmedProjectScope(claim, scored) {
    const confirmed = scored.filter((candidate) => assessProject(candidate).status === "supported");
    if (!confirmed.length) return [];
    const anchor = confirmed[0];
    return confirmed.filter((candidate) => sameClaimedProjectScope(claim, anchor, candidate));
  }

  function ambiguityAuditScope(projectScope, scored) {
    if (!projectScope.length) return [];
    return scored.filter((candidate) => {
      if (candidate.projectCodeConflict || candidate.packageConflict) return false;
      if (!candidate.exactProjectCode && candidate.score < 0.34) return false;
      if (projectScope.includes(candidate)) return true;
      return projectScope.some((anchor) => sameBaseProject(anchor, candidate));
    });
  }

  function hasAmbiguousProjectScope(claim, scope) {
    if (!scope.length) return false;
    if (claim.packageScopeAmbiguous) return true;
    const conclusive = scope.filter((candidate) =>
      CONCLUSIVE_STAGES.has(candidate.evidenceStage || deriveEvidenceStage(candidate.notice))
      && assessSupplierStanding(candidate.notice).status !== "excluded"
    );
    if (conclusive.some((candidate) => candidate.notice.packageScopeAmbiguous)) return true;
    if (!normalizeIdentifier(claim.packageCode, 1)
      && conclusive.some((candidate) => candidate.notice.projectHasMultiplePackages)) return true;
    if (conclusive.some((candidate) => /consortium|联合体|subcontract|分包/u.test(normalizeText(candidate.notice.supplierRole)))) return true;
    if (conclusive.length < 2) return false;
    const packageKeys = new Set(conclusive.map((candidate) => normalizeIdentifier(candidate.notice.packageCode, 1)).filter(Boolean));
    const supplierKeys = new Set(conclusive.map((candidate) => normalizeIdentifier(candidate.notice.supplierCode, 6) || normalizeEntity(candidate.notice.supplierName)).filter(Boolean));
    return packageKeys.size > 1 || supplierKeys.size > 1;
  }

  function buildResult(claim, notices) {
    const scored = notices
      .map((notice) => {
        const evidenceStage = deriveEvidenceStage(notice);
        const sourceOfficiality = deriveOfficiality(notice);
        return {
          notice,
          ...projectCandidateScore(claim, notice),
          evidenceStage,
          sourceOfficiality,
          authorityPriority: authorityRank(notice),
          stagePriority: stageRank(evidenceStage),
          completenessPriority: candidateCompleteness(notice),
          entityHintPriority: entityHintPriority(claim, notice),
          supplierStandingPriority: supplierStandingPriority(notice),
          stableKey: stableCandidateKey(notice)
        };
      })
      .sort(projectCandidateComparator);
    const projectScope = confirmedProjectScope(claim, scored);
    const auditScope = ambiguityAuditScope(projectScope, scored);
    const selectedEvidence = projectScope.length ? [...projectScope].sort(evidenceCandidateComparator)[0] : null;
    const best = selectedEvidence || (scored[0] && scored[0].score >= 0.25 ? scored[0] : null);
    const stage = best?.evidenceStage || "none";
    const authoritative = Boolean(best && isAuthoritativeEvidence(best.notice));
    const ambiguous = hasAmbiguousProjectScope(claim, auditScope);
    let project = assessProject(best);
    let entity = project.status === "insufficient"
      ? { status: "insufficient", label: "项目尚未可靠对应，暂不核对主体", strength: "none", reason: "先确认是同一个项目，再比较供应商身份。" }
      : assessEntity(claim, best?.notice, stage);
    if (ambiguous) {
      project = { status: "review", label: "同一项目存在多包或多供应商候选", strength: "weak" };
      entity = { status: "review", label: "候选范围未唯一，暂不判断主体", strength: "weak", reason: "包组/标段或供应商范围不唯一，不能任取一条作结论。" };
    }
    const overall = overallStatus(project, entity, stage, authoritative, ambiguous);
    const reasons = [];
    if (best) reasons.push(...best.reasons);
    reasons.push(project.label, entity.reason);
    if (stage === "award") reasons.push("当前材料只到中标/成交阶段，尚未证明履约完成。");
    if (stage === "solicitation") reasons.push("招标公告发布时通常尚未确定最终供应商，不能支撑主体结论。");
    if (!authoritative && best) reasons.push("当前候选不是已确认的官方原文或获授权材料，只能用于继续检索。");
    if (ambiguous) reasons.push("同一项目存在多个包组或供应商候选，不得按输入顺序任选一条。");
    if (!best) reasons.push("指定数据中未找到达到候选阈值的记录；这不等于该业绩虚假。");

    const visibleCandidates = scored.filter((candidate) => candidate.score >= 0.25).slice(0, 10);
    if (best && !visibleCandidates.includes(best)) visibleCandidates.push(best);

    return {
      claim,
      bestCandidate: best,
      candidates: visibleCandidates,
      project,
      entity,
      evidenceStage: stage,
      sourceOfficiality: best?.sourceOfficiality || "unknown",
      authoritativeEvidence: authoritative,
      ambiguousCandidates: ambiguous,
      eligibility: unconfiguredEligibility(),
      overall,
      reasons: [...new Set(reasons.filter(Boolean))]
    };
  }

  function runMatching(claims, notices) {
    const previousCache = ACTIVE_MATCH_RUN_CACHE;
    ACTIVE_MATCH_RUN_CACHE = {
      projectCodeIndexes: new WeakMap(),
      authoritativeEvidence: new WeakMap(),
      stableCandidateKeys: new WeakMap(),
      evidenceStages: new WeakMap(),
      officialities: new WeakMap(),
      supplierStandings: new WeakMap()
    };
    try {
      return claims.map((claim) => buildResult(claim, notices));
    } finally {
      ACTIVE_MATCH_RUN_CACHE = previousCache;
    }
  }

  function resolveEligibilityRule(ruleOrId) {
    if (typeof ruleOrId === "string") {
      const normalizedId = asString(ruleOrId);
      if (["completed", "completion", COMPLETION_POLICY.policy_id].includes(normalizedId.toLowerCase())) {
        return COMPLETION_POLICY;
      }
      throw new RangeError(`未知完成状态口径：${normalizedId || "(空)"}`);
    }
    if (!ruleOrId || typeof ruleOrId !== "object" || Array.isArray(ruleOrId)) {
      throw new TypeError("完成状态口径必须为规则 ID 或规则对象。");
    }
    const policyId = asString(ruleOrId.policy_id || ruleOrId.policyId);
    const requiredStage = asString(ruleOrId.required_evidence_stage || ruleOrId.requiredEvidenceStage).toLowerCase();
    if (!policyId) throw new TypeError("完成状态口径缺少 policy_id。");
    if (!["award", "contract", "acceptance"].includes(requiredStage)) {
      throw new RangeError("完成状态口径的 required_evidence_stage 必须为 award、contract 或 acceptance。");
    }
    const automatedChecks = Array.isArray(ruleOrId.automated_checks)
      ? ruleOrId.automated_checks.map(asString)
      : ["evidence_stage"];
    if (automatedChecks.length !== 1 || automatedChecks[0] !== "evidence_stage") {
      throw new RangeError("当前 MVP 仅允许自动执行 evidence_stage 检查。");
    }
    if (policyId !== COMPLETION_POLICY.policy_id || requiredStage !== "acceptance") {
      throw new RangeError("本题只允许使用主办方确认的验收完成口径。");
    }
    return COMPLETION_POLICY;
  }

  function eligibilityAssessment(result, rule) {
    const policyFields = {
      policy_id: rule.policy_id,
      policy_name: rule.name,
      required_evidence_stage: rule.required_evidence_stage,
      automated_checks: ["evidence_stage"]
    };
    const scopeReason = "当前 MVP 只按主办方回复检查证据是否达到验收阶段；时间范围、同类项目和参与角色仍需按采购文件人工复核。";
    if (result?.overall !== "supported"
      || result?.project?.status !== "supported"
      || result?.entity?.status !== "supported") {
      const factLabel = STATUS_LABELS[result?.overall] || "尚未核验";
      const reason = `事实核验结果为“${factLabel}”，尚未确认同一项目和同一主体，因此不能直接判断是否已经完成。`;
      return {
        status: "not_assessed",
        label: "需先确认项目与主体",
        ...policyFields,
        reason,
        reasons: [reason, scopeReason]
      };
    }

    const currentStage = asString(result.evidenceStage).toLowerCase() || "none";
    if (stageRank(currentStage) >= stageRank(rule.required_evidence_stage)) {
      const reason = `事实核验为证据支持，当前证据阶段“${STAGE_LABELS[currentStage] || STAGE_LABELS.unknown}”已达到主办方要求的验收门槛。`;
      return {
        status: "meets",
        label: "达到“已经完成”证据门槛",
        ...policyFields,
        reason,
        reasons: [reason, scopeReason]
      };
    }

    let label = "待补验收材料";
    if (currentStage === "contract") label = "已证明曾开展过，待补验收材料";
    if (currentStage === "award") label = "仅有中标线索，待补合同及验收材料";
    if (["none", "unknown", "solicitation"].includes(currentStage)) label = "证据不足，待补合同及验收材料";
    const reason = `事实核验为证据支持，但当前证据阶段“${STAGE_LABELS[currentStage] || STAGE_LABELS.unknown}”尚未达到主办方要求的验收门槛。`;
    return {
      status: "insufficient_evidence",
      label,
      ...policyFields,
      reason,
      reasons: [reason, scopeReason]
    };
  }

  function applyEligibility(results, ruleOrId) {
    const rule = resolveEligibilityRule(ruleOrId);
    const isArrayInput = Array.isArray(results);
    const rows = isArrayInput ? results : [results];
    if (rows.some((result) => !result || typeof result !== "object" || Array.isArray(result))) {
      throw new TypeError("完成状态判断输入必须为核验结果对象或对象数组。");
    }
    const assessed = rows.map((result) => ({
      ...result,
      eligibility: eligibilityAssessment(result, rule)
    }));
    return isArrayInput ? assessed : assessed[0];
  }

  function missingCount(rows, field) {
    return rows.reduce((count, row) => count + (isMissingPlaceholder(row[field]) ? 1 : 0), 0);
  }

  function missingProjectCodeCount(rows) {
    return rows.reduce((count, row) => count + (projectCodeIndex(row).identityCodes.length ? 0 : 1), 0);
  }

  function auditQuality(claims, notices) {
    const stageCounts = { acceptance: 0, contract: 0, award: 0, solicitation: 0, unknown: 0 };
    notices.forEach((notice) => {
      const stage = deriveEvidenceStage(notice);
      if (stageCounts[stage] !== undefined) stageCounts[stage] += 1;
    });
    return {
      claims: {
        total: claims.length,
        missingCompany: missingCount(claims, "company"),
        missingCompanyCode: missingCount(claims, "companyCode"),
        missingProjectName: missingCount(claims, "projectName"),
        missingProjectCode: missingProjectCodeCount(claims),
        missingPurchaser: missingCount(claims, "purchaser"),
        missingDate: missingCount(claims, "date")
      },
      notices: {
        total: notices.length,
        missingProjectName: missingCount(notices, "projectName"),
        missingProjectCode: missingProjectCodeCount(notices),
        missingSupplierName: missingCount(notices, "supplierName"),
        missingSupplierCode: missingCount(notices, "supplierCode"),
        missingSourceUrl: missingCount(notices, "sourceUrl"),
        officialityCounts: notices.reduce((counts, notice) => {
          const key = deriveOfficiality(notice);
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, { official: 0, user_provided: 0, demo_official: 0, aggregator: 0, unknown: 0 }),
        stageCounts
      }
    };
  }

  function prefixedId(prefix, value, fallback) {
    const raw = asString(value).replace(new RegExp(`^${prefix}-`, "i"), "");
    const encoded = [...raw].map((character) => /[A-Za-z0-9._-]/.test(character)
      ? character
      : `u${character.codePointAt(0).toString(16)}`).join("");
    const safe = encoded.replace(/^-+|-+$/g, "") || asString(fallback);
    return `${prefix}-${safe}`;
  }

  function validHttpUrl(value) {
    try {
      const parsed = new URL(asString(value));
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function localFileName(value) {
    const raw = asString(value);
    if (isMissingPlaceholder(raw)) return "";
    const withoutQuery = raw.replace(/[?#].*$/, "");
    const parts = withoutQuery.replace(/\\/g, "/").split("/").filter(Boolean);
    const fileName = parts.at(-1) || "";
    return [".", ".."].includes(fileName) ? "" : fileName;
  }

  function localPathValue(notice) {
    const explicitPath = isMissingPlaceholder(notice?.sourceLocalPath) ? "" : asString(notice.sourceLocalPath);
    if (explicitPath) return explicitPath;
    const rawUrl = asString(notice?.sourceUrl);
    if (/^file:/i.test(rawUrl)) {
      try {
        return decodeURIComponent(new URL(rawUrl).pathname);
      } catch {
        return rawUrl;
      }
    }
    return /^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(rawUrl) ? rawUrl : "";
  }

  function publicSourceReference(notice, options = {}) {
    const url = validHttpUrl(notice?.sourceUrl);
    if (url) return url;
    const localPath = localPathValue(notice);
    if (!localPath) return "";
    if (options.includeLocalPaths === true) return localPath;
    const fileName = localFileName(localPath);
    return fileName ? `获授权本地材料：${fileName}` : "获授权本地材料";
  }

  function contractOfficiality(value) {
    return ["official", "aggregator", "user_provided", "demo_official", "unknown"].includes(value) ? value : "unknown";
  }

  function contractStage(stage) {
    return ({ solicitation: "project_notice", award: "award", contract: "contract", acceptance: "acceptance" })[stage] || "none";
  }

  function contractDocumentType(stage) {
    return ({ solicitation: "tender", award: "award", contract: "contract", acceptance: "acceptance" })[stage] || "unknown";
  }

  function contractOverall(overall) {
    return ({
      supported: "SUPPORTED",
      conflict: "CONFLICT",
      insufficient: "INSUFFICIENT_EVIDENCE",
      review: "MANUAL_REVIEW",
      pending: "NOT_ASSESSED"
    })[overall] || "NOT_ASSESSED";
  }

  function candidateMethods(candidate) {
    const methods = [];
    if (candidate.exactProjectCode) methods.push("project_code_exact");
    if (candidate.exactPackageCode) methods.push("package_code_exact");
    if (candidate.titleScore === 1) methods.push("project_name_exact");
    else if (candidate.titleScore > 0) methods.push("project_name_fuzzy");
    if (candidate.purchaserScore >= 0.82) methods.push("purchaser_match");
    if (candidate.yearMatch === true) methods.push("date_match");
    return methods;
  }

  function candidateSignals(candidate, claim) {
    const signals = [{
      signal: "project_name",
      comparison: candidate.titleScore === 1 ? "normalized_equal" : candidate.titleScore > 0 ? "fuzzy_similar" : "conflict",
      score: candidate.titleScore,
      claim_value: claim?.projectName,
      evidence_value: candidate.notice.projectName,
      note: "仅用于候选排序，不是真实性概率。"
    }];
    const codeComparison = candidate.projectCodeComparison;
    if (codeComparison?.hasLeft || codeComparison?.hasRight) {
      let comparison = "not_compared";
      if (!codeComparison.hasLeft) comparison = "missing_claim";
      else if (!codeComparison.hasRight) comparison = "missing_evidence";
      else if (candidate.projectCodeConflict) comparison = "conflict";
      else if (candidate.exactProjectCode) comparison = "exact";
      const notes = [];
      if (codeComparison.matchedTypes.length) notes.push(`匹配类型：${codeComparison.matchedTypes.join("、")}`);
      if (codeComparison.legacyMatchedTypes.length) notes.push("旧扁平通用项目编号一致");
      if (codeComparison.conflictingTypes.length) notes.push(`冲突类型：${codeComparison.conflictingTypes.join("、")}`);
      if (codeComparison.typeMismatch) notes.push("存在异类型同值，未按精确相等处理");
      signals.push({
        signal: "project_code",
        comparison,
        claim_value: projectCodesDisplay(claim),
        evidence_value: projectCodesDisplay(candidate.notice),
        note: notes.join("；") || "两端编号类型不可直接比较。"
      });
    }
    if (candidate.exactPackageCode || candidate.packageConflict) {
      signals.push({
        signal: "package_code",
        comparison: candidate.exactPackageCode ? "exact" : "conflict",
        claim_value: candidate._claim?.packageCode,
        evidence_value: candidate.notice.packageCode
      });
    }
    return signals;
  }

  function comparedField(field, claimValue, evidenceValue, fuzzyScore = null) {
    const claimMissing = isMissingPlaceholder(claimValue);
    const evidenceMissing = isMissingPlaceholder(evidenceValue);
    let comparison = "not_compared";
    if (claimMissing) comparison = "missing_claim";
    else if (evidenceMissing) comparison = "missing_evidence";
    else if (exactNormalized(claimValue, evidenceValue)) comparison = "normalized_equal";
    else if (fuzzyScore !== null && fuzzyScore >= 0.65) comparison = "fuzzy_similar";
    else comparison = "conflict";
    const output = { field, comparison };
    if (!claimMissing) output.claim_value = asString(claimValue);
    if (!evidenceMissing) output.evidence_value = asString(evidenceValue);
    if (fuzzyScore !== null) output.score = Math.max(0, Math.min(1, Number(fuzzyScore) || 0));
    return output;
  }

  function comparedProjectCodeField(claim, notice, candidate) {
    const claimValue = projectCodesDisplay(claim);
    const evidenceValue = projectCodesDisplay(notice);
    const comparison = candidate?.projectCodeComparison;
    let status = "not_compared";
    if (!comparison?.hasLeft) status = "missing_claim";
    else if (!comparison.hasRight) status = "missing_evidence";
    else if (comparison.conflict) status = "conflict";
    else if (comparison.exact) status = "exact";
    const output = { field: "project_code", comparison: status };
    if (claimValue) output.claim_value = claimValue;
    if (evidenceValue) output.evidence_value = evidenceValue;
    const notes = [];
    if (comparison?.matchedTypes?.length) notes.push(`同类型交集：${comparison.matchedTypes.join("、")}`);
    if (comparison?.legacyMatchedTypes?.length) notes.push("旧扁平格式通用编号一致");
    if (comparison?.conflictingTypes?.length) notes.push(`同类型冲突：${comparison.conflictingTypes.join("、")}`);
    if (comparison?.typeMismatch) notes.push("异类型同值不作相等");
    if (notes.length) output.note = notes.join("；");
    return output;
  }

  function contractSourceLocator(notice, officiality, options = {}) {
    const url = validHttpUrl(notice?.sourceUrl);
    const localPath = localPathValue(notice);
    const sourceMarker = deriveSourceMarker(notice);
    if (!url && !localPath && !sourceMarker) return null;
    const locator = {
      officiality: contractOfficiality(officiality),
      source_name: asString(notice?.sourcePlatform || (url ? new URL(url).hostname : sourceMarker || "获授权本地材料"))
    };
    if (sourceMarker) locator.source_marker = sourceMarker;
    if (url) locator.url = url;
    else if (localPath) {
      const fileName = localFileName(localPath);
      locator.file_name = fileName || "获授权本地材料";
      if (options.includeLocalPaths === true) locator.local_path = localPath;
    }
    return locator;
  }

  function hasConfiguredEligibility(result) {
    return Boolean(result?.eligibility
      && result.eligibility.status !== "not_configured"
      && asString(result.eligibility.policy_id));
  }

  function manualReasonCodes(result) {
    const codes = [];
    const best = result.bestCandidate;
    const combinedRole = normalizeText([
      result.claim.role,
      ...result.candidates.map((candidate) => candidate.notice.supplierRole)
    ].filter(Boolean).join(" "));
    const hasEntityCodePair = Boolean(normalizeIdentifier(result.claim.companyCode, 6)
      && normalizeIdentifier(best?.notice?.supplierCode, 6));
    if (!result.bestCandidate) codes.push("no_candidate");
    if (result.ambiguousCandidates) codes.push("multiple_candidates");
    if (!projectCodeIndex(result.claim).identityCodes.length) codes.push("missing_project_code");
    if (isMissingPlaceholder(result.claim.companyCode)) codes.push("missing_credit_code");
    if (/consortium|联合体/u.test(combinedRole)) codes.push("consortium");
    if (/subcontract|分包/u.test(combinedRole)) codes.push("subcontract");
    if (/branch|分公司/u.test(combinedRole)) codes.push("head_branch");
    if (best?.projectCodeConflict || best?.packageConflict || best?.projectCodeTypeMismatch || result.entity.status === "conflict") {
      codes.push("conflicting_evidence");
    }
    if (result.entity.status === "review"
      && isAuthoritativeEvidence(best?.notice)
      && !hasEntityCodePair
      && !/consortium|联合体|subcontract|分包|branch|分公司/u.test(combinedRole)) {
      codes.push("name_only_match");
    }
    if (result.bestCandidate && !result.authoritativeEvidence) codes.push("source_unavailable");
    if (!hasConfiguredEligibility(result)) codes.push("policy_missing");
    return [...new Set(codes)];
  }

  function contractEligibilityAssessment(result, evidenceRefs) {
    const eligibility = result?.eligibility;
    const configured = hasConfiguredEligibility(result);
    if (!configured) {
      return {
        status: "not_assessed",
        reasons: ["完成状态口径尚未应用；事实核验结果不受影响。"],
        evidence_refs: []
      };
    }
    const allowedStatuses = new Set(["meets", "does_not_meet", "insufficient_evidence", "not_in_scope", "not_assessed"]);
    const status = allowedStatuses.has(eligibility.status) ? eligibility.status : "not_assessed";
    const reasons = Array.isArray(eligibility.reasons)
      ? eligibility.reasons.map(asString).filter(Boolean)
      : [asString(eligibility.reason)].filter(Boolean);
    const assessment = {
      status,
      policy_id: asString(eligibility.policy_id),
      reasons: reasons.length ? reasons : ["已应用完成状态口径，但当前记录未生成可用理由，需人工复核。"],
      evidence_refs: result.overall === "supported" ? evidenceRefs : []
    };
    if (asString(eligibility.label)) assessment.label = asString(eligibility.label);
    return assessment;
  }

  function toContractRecord(result, index, generatedAt, options = {}) {
    const claimId = prefixedId("CLM", result.claim.id, index + 1);
    const best = result.bestCandidate;
    const notice = best?.notice;
    const selectedNoticeId = notice ? prefixedId("NTC", notice.id, `${index + 1}-selected`) : "";
    const evidenceId = prefixedId("EVD", `${claimId}-${selectedNoticeId || "none"}`, index + 1);
    const locator = contractSourceLocator(notice, result.sourceOfficiality, options);
    const evidenceSourceMarker = deriveSourceMarker(notice);
    const evidenceEffect = result.overall === "supported" ? "supports" : result.overall === "conflict" ? "contradicts" : "context_only";
    const evidenceItems = locator ? [{
      evidence_id: evidenceId,
      notice_id: selectedNoticeId,
      document_type: contractDocumentType(result.evidenceStage),
      source_locator: locator,
      excerpt: asString(notice.sourceExcerpt).slice(0, 2000),
      effect: evidenceEffect,
      dimensions: result.overall === "supported" || result.overall === "conflict"
        ? ["project_identity", "entity_identity", "award_status"]
        : ["project_identity"],
      cited_fields: ["project_name", "project_code", "package_code", "supplier_name", "supplier_code"],
      ...(evidenceSourceMarker ? { note: `${DEMO_SOURCE_MARKER} · 虚构演示证据，不可作为真实项目材料。` } : {})
    }] : [];
    const evidenceRefs = evidenceItems.length ? [evidenceId] : [];
    const projectStatus = result.project.status === "supported" ? "supported"
      : result.project.status === "conflict" ? "conflict"
      : result.project.status === "pending" ? "not_assessed"
      : "insufficient_evidence";
    const entityStatus = result.entity.status === "supported" ? "supported"
      : result.entity.status === "conflict" ? "conflict"
      : result.entity.status === "pending" ? "not_assessed"
      : "insufficient_evidence";
    const candidates = result.candidates.map((candidate, candidateIndex) => {
      const output = {
        notice_id: candidate === best ? selectedNoticeId : prefixedId("NTC", candidate.notice.id, `${index + 1}-${candidateIndex + 1}`),
        rank: candidateIndex + 1,
        candidate_score: Math.max(0, Math.min(1, candidate.score)),
        retrieval_methods: candidateMethods(candidate),
        signals: candidateSignals(candidate, result.claim)
      };
      const sourceMarker = deriveSourceMarker(candidate.notice);
      if (sourceMarker) output.source_marker = sourceMarker;
      return output;
    });
    const reasons = result.reasons.length ? result.reasons : ["尚未完成核查。"];
    const eligibilityAssessment = contractEligibilityAssessment(result, evidenceRefs);
    const eligibilitySummary = hasConfiguredEligibility(result)
      ? `；完成判定：${result.eligibility.label}`
      : "";
    return {
      result_id: prefixedId("RES", claimId, index + 1),
      claim_id: claimId,
      generated_at: generatedAt,
      retrieval: {
        status: best ? "candidates_found" : "not_found",
        candidate_count: result.candidates.length,
        searched_sources: [...new Set(result.candidates
          .map((item) => asString(item.notice.sourcePlatform || publicSourceReference(item.notice)))
          .filter(Boolean))],
        queries: [],
        limitations: ["候选排序分不是真实性概率。", "公开渠道未找到不等于业绩虚假。"]
      },
      candidates,
      selected_notice_ids: best ? [selectedNoticeId] : [],
      project_assessment: {
        status: projectStatus,
        identity: projectStatus === "supported" ? "same_project" : projectStatus === "conflict" ? "different_project" : result.project.status === "review" ? "ambiguous" : "unknown",
        reasons,
        compared_fields: [
          comparedField("project_name", result.claim.projectName, notice?.projectName, best?.titleScore ?? null),
          comparedProjectCodeField(result.claim, notice, best),
          comparedField("package_code", result.claim.packageCode, notice?.packageCode),
          comparedField("purchaser", result.claim.purchaser, notice?.purchaser, best?.purchaserScore ?? null)
        ],
        evidence_refs: evidenceRefs
      },
      entity_assessment: {
        status: entityStatus,
        relationship: entityStatus === "supported" ? "same_legal_entity" : entityStatus === "conflict" ? "different_legal_entity" : "unknown",
        reasons,
        compared_fields: [
          comparedField("company_name", result.claim.company, notice?.supplierName, diceSimilarity(result.claim.company, notice?.supplierName)),
          comparedField("credit_code", result.claim.companyCode, notice?.supplierCode)
        ],
        evidence_refs: evidenceRefs
      },
      evidence_stage: contractStage(result.evidenceStage),
      eligibility_assessment: eligibilityAssessment,
      overall_status: contractOverall(result.overall),
      summary: `${STATUS_LABELS[result.overall] || "尚未核验"}；当前证据阶段：${STAGE_LABELS[result.evidenceStage] || STAGE_LABELS.unknown}${eligibilitySummary}。`,
      evidence_items: evidenceItems,
      recommended_documents: result.overall === "supported" ? ["contract", "acceptance_record"] : ["project_code", "award_notice", "company_registry_record"],
      manual_review: {
        status: "pending",
        reason_codes: manualReasonCodes(result),
        suggested_action: result.overall === "supported" ? "由有权人员回看原始证据并确认完成状态。" : "补齐关键字段并由有权人员复核。"
      }
    };
  }

  function resultSourceMarker(result) {
    const bestMarker = deriveSourceMarker(result?.bestCandidate?.notice);
    if (bestMarker) return bestMarker;
    return (result?.candidates || []).some((candidate) => deriveSourceMarker(candidate?.notice) === DEMO_SOURCE_MARKER)
      ? DEMO_SOURCE_MARKER
      : "";
  }

  function batchSourceMarker(results, options = {}) {
    if (asString(options.sourceMarker).toUpperCase() === DEMO_SOURCE_MARKER || options.demoOnly === true) {
      return DEMO_SOURCE_MARKER;
    }
    return results.some((result) => resultSourceMarker(result) === DEMO_SOURCE_MARKER)
      ? DEMO_SOURCE_MARKER
      : "";
  }

  function csvCell(value) {
    let safe = redactLocalPaths(value);
    if (/^[\t\r\n ]*[=+\-@]/.test(safe)) safe = `'${safe}`;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function suggestedActionText(status) {
    if (status === "supported") return "快速人工复核原始材料与完成状态，不自动直接通过。";
    if (status === "conflict") return "核查更名、联合体、合并或材料填写问题；由有权人员决定是否补证。";
    if (status === "review") return "补充企业信用代码、主体关系和项目编号后再判断。";
    return "补充项目编号、合同或验收材料；未检索到不等于虚假。";
  }

  function toCsvBatch(results, options = {}) {
    const sourceMarker = batchSourceMarker(results, options);
    const headers = [
      "批次来源标识", "证据来源标识", "记录编号", "本次投标公司", "投标人信用代码", "声称项目", "声称项目编号",
      "候选项目", "候选项目编号", "候选包组/标段", "候选排序分（不代表真假概率）", "候选数量", "历史供应商", "历史供应商信用代码", "供应商角色", "中标状态",
      "同一项目判断", "同一企业判断", "证据阶段", "来源性质", "事实核验", "完成认定口径ID", "完成认定口径", "完成判定", "完成判定理由", "检索状态", "人工复核状态", "公开来源/受控材料", "判断理由", "人工建议"
    ];
    const rows = results.map((result) => {
      const candidate = result.bestCandidate?.notice;
      return [
        sourceMarker,
        resultSourceMarker(result),
        result.claim.id,
        result.claim.company,
        result.claim.companyCode,
        result.claim.projectName,
        result.claim.projectCode,
        candidate?.projectName,
        candidate?.projectCode,
        candidate?.packageCode,
        result.bestCandidate ? `${Math.round((Number(result.bestCandidate.score) || 0) * 100)}/100` : "",
        result.candidates.length,
        candidate?.supplierName,
        candidate?.supplierCode,
        candidate?.supplierRole,
        candidate?.awardStatus,
        result.project.label,
        result.entity.label,
        STAGE_LABELS[result.evidenceStage],
        OFFICIALITY_LABELS[result.sourceOfficiality],
        STATUS_LABELS[result.overall],
        result.eligibility?.policy_id || "",
        result.eligibility?.policy_name
          || (result.eligibility?.status === "not_configured" ? "尚未应用完成口径" : asString(options.currentRuleLabel)),
        result.eligibility?.label || "尚未判断",
        result.eligibility?.reasons?.join("；") || result.eligibility?.reason,
        result.bestCandidate ? "已找到候选" : "未找到可靠候选",
        result.overall === "supported" ? "待有权人员确认" : "待人工复核",
        publicSourceReference(candidate),
        result.reasons.join("；"),
        suggestedActionText(result.overall)
      ];
    });
    return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  }

  function toContractBatch(results, options = {}) {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const sourceMarker = batchSourceMarker(results, options);
    const payload = {
      schema_version: "1.0.0",
      dataset_type: "verification_results",
      result_batch_id: asString(options.resultBatchId || `batch-${generatedAt.replace(/[^0-9]/g, "").slice(0, 14)}`),
      generated_at: generatedAt,
      input_datasets: {
        claims_dataset_id: asString(options.claimsDatasetId || "claims-local"),
        notice_dataset_ids: [asString(options.noticesDatasetId || "notices-local")]
      },
      engine: {
        name: "投标业绩证据核验工作台",
        version: "0.3.0",
        policy_version: "evidence-first-p1-2026-08-15",
        model_versions: [],
        notes: "本地规则初筛；候选排序分不是真实性概率，最终由有权人员复核。"
      },
      records: results.map((result, index) => sanitizeExportValue(toContractRecord(result, index, generatedAt, options)))
    };
    if (sourceMarker) payload.source_marker = sourceMarker;
    return payload;
  }

  const api = {
    CLAIM_ALIASES,
    NOTICE_ALIASES,
    STATUS_LABELS,
    STAGE_LABELS,
    OFFICIALITY_LABELS,
    DEMO_SOURCE_MARKER,
    COMPLETION_POLICY,
    unconfiguredEligibility,
    asString,
    redactLocalPaths,
    isMissingPlaceholder,
    normalizeIdentifier,
    normalizeHeader,
    normalizeText,
    normalizeEntity,
    parseCSV,
    parseDatasetText,
    normalizeClaims,
    normalizeNotices,
    diceSimilarity,
    deriveEvidenceStage,
    deriveOfficiality,
    deriveSourceMarker,
    publicSourceReference,
    resultSourceMarker,
    isAuthoritativeEvidence,
    assessSupplierStanding,
    projectCandidateScore,
    assessEntity,
    runMatching,
    applyEligibility,
    auditQuality,
    toCsvBatch,
    toContractBatch
  };

  globalScope.EvidenceEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
