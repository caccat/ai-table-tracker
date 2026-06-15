/**
 * AI 表格分析工具 - 主逻辑
 * 7 个标签页：豆包/DeepSeek/百度AI/元宝/千问/共同网站/二测统计
 */

// ==================== 常量 ====================
const PLATFORMS = ["doubao", "deepseek", "baidu", "yuanbao", "qianwen"];
const PLATFORM_LABELS = { doubao: "豆包", deepseek: "DeepSeek", baidu: "百度AI", yuanbao: "元宝", qianwen: "千问" };
const PLATFORM_ICONS = { doubao: "🫘", deepseek: "🔍", baidu: "🌐", yuanbao: "💰", qianwen: "❓" };
const PLATFORM_KEYS = ["豆包", "deepseek", "百度ai", "百度", "baidu", "元宝", "yuanbao", "千问", "qianwen"];

// ==================== Supabase 客户端 ====================
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== 平台状态 ====================
const ps = {};
PLATFORMS.forEach((p) => {
  ps[p] = { file: null, data: null, eCol: [], cCol: [], freq: {}, urlMap: {} };
});

// ==================== 全局变量 ====================
let confirmCallback = null;
let currentUploadData = null; // { platform, file, eCol, cCol, freq, urlMap, fileDate, round }

// ==================== 初始化：生成 Tab 面板 ====================
(function initTabs() {
  const container = document.getElementById("tabsContent");

  // Tab 1-5: 平台标签页
  PLATFORMS.forEach((p) => {
    const panel = document.createElement("div");
    panel.className = p === "doubao" ? "tab-panel active" : "tab-panel";
    panel.id = `tab-${p}`;
    panel.innerHTML = `
      <div class="drop-zone" id="dropZone-${p}">
        <div class="drop-zone-icon">📁</div>
        <div class="drop-zone-title">拖拽 ${PLATFORM_LABELS[p]} 表格到此处</div>
        <div class="drop-zone-hint">或 <span>点击选择文件</span>，支持 .xlsx / .csv</div>
        <input type="file" accept=".xlsx,.xls,.csv" id="fileInput-${p}">
      </div>
      <div class="file-info-bar" id="fileInfo-${p}" style="display:none;">
        <div class="file-info-name">
          <span>📄</span>
          <span id="fileName-${p}">--</span>
          <span class="round-badge" id="roundBadge-${p}" style="display:none;"></span>
        </div>
        <div class="file-info-actions">
          <button class="btn btn-outline btn-sm" id="reuploadBtn-${p}">📎 重新上传</button>
          <button class="btn btn-danger btn-sm" id="clearBtn-${p}">✕ 清除</button>
        </div>
      </div>
      <div class="result-area" id="result-${p}">
        <div class="no-data">上传表格后，自动解析并展示结果</div>
      </div>
    `;
    container.appendChild(panel);
  });

  // Tab 6: 共同网站
  const tabSummary = document.createElement("div");
  tabSummary.className = "tab-panel";
  tabSummary.id = "tab-summary";
  tabSummary.innerHTML = `
    <div class="top-actions" style="margin-bottom:16px;">
      <button class="btn btn-primary" id="refreshSummaryBtn">🔄 刷新共同网站分析</button>
      <span style="font-size:12px;color:#888;" id="summaryStatus"></span>
    </div>
    <div id="summaryContent">
      <div class="no-data">已上传表格的平台 ≥2 时，自动分析共同网站</div>
    </div>
  `;
  container.appendChild(tabSummary);

  // Tab 7: 二测统计 + 手动监测
  const tabRetest = document.createElement("div");
  tabRetest.className = "tab-panel";
  tabRetest.id = "tab-retest";
  tabRetest.innerHTML = `
    <div class="top-actions" style="margin-bottom:16px;">
      <button class="btn btn-primary" id="refreshRetestBtn">🔄 刷新二测统计</button>
      <span style="font-size:12px;color:#888;" id="retestStatus"></span>
    </div>
    <div id="retestContent">
      <div class="no-data">点击"刷新二测统计"查看各平台二测信息</div>
    </div>
    <div style="margin-top:32px;border-top:2px solid #f59e0b;padding-top:20px;">
      <div class="section-title"><span class="badge" style="background:#f59e0b;">📌</span> 手动监测列表</div>
      <div class="monitor-input-row">
        <input type="text" id="monitorInput" placeholder="输入要监测的网站名，按回车添加">
        <button class="btn btn-primary" id="addMonitorBtn">添加</button>
      </div>
      <div id="monitorList" style="margin-bottom:12px;"></div>
      <button class="btn btn-outline btn-sm" id="checkMonitorBtn">🔍 在当前已上传平台中检测</button>
      <div id="monitorResult" style="margin-top:12px;"></div>
    </div>
  `;
  container.appendChild(tabRetest);
})();

// ==================== 标签页切换 ====================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    document.getElementById(target).classList.add("active");

    if (target === "tab-summary") refreshSummary();
    if (target === "tab-retest") { refreshRetestStats(); loadMonitorList(); }
  });
});

// ==================== 平台绑定事件 ====================
function getEl(p, suffix) {
  return document.getElementById(`${suffix}-${p}`);
}

PLATFORMS.forEach((p) => {
  const dz = getEl(p, "dropZone");
  const fi = getEl(p, "fileInput");
  const ru = getEl(p, "reuploadBtn");
  const cl = getEl(p, "clearBtn");

  dz.addEventListener("click", (e) => {
    if (e.target === fi) return;
    fi.click();
  });

  fi.addEventListener("change", () => {
    const file = fi.files[0];
    if (file) handleUpload(file, p);
  });

  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => { dz.classList.remove("drag-over"); });
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file, p);
  });

  ru.addEventListener("click", () => { fi.click(); });
  cl.addEventListener("click", () => { clearPlatform(p); });
});

// ==================== 上传处理 ====================
function handleUpload(file, platform) {
  const ext = "." + file.name.split(".").pop().toLowerCase();
  if (![".xlsx", ".xls", ".csv"].includes(ext)) {
    alert("仅支持 .xlsx / .xls / .csv 格式");
    return;
  }

  // 解析文件
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) { alert("表格为空"); return; }

      // 查找列索引
      const header = rows[0].map((h) => (h ? String(h).trim() : ""));
      let eIdx = 4, cIdx = 2;
      header.forEach((h, i) => {
        if (h === "网站名称") eIdx = i;
        if (h === "网址") cIdx = i;
      });

      // 提取 E 列（网站名称）和 C 列（网址）
      const eCol = [], cCol = [];
      const freq = {};
      const urlMap = {}; // { siteName: { url: count } }
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const sName = row[eIdx] ? String(row[eIdx]).trim() : "";
        const sUrl = row[cIdx] ? String(row[cIdx]).trim() : "";
        if (!sName) continue;
        eCol.push(sName);
        cCol.push(sUrl);
        freq[sName] = (freq[sName] || 0) + 1;
        if (sUrl) {
          if (!urlMap[sName]) urlMap[sName] = {};
          urlMap[sName][sUrl] = (urlMap[sName][sUrl] || 0) + 1;
        }
      }

      // 检测平台 & 日期
      const fname = file.name.toLowerCase();
      let detectedPlat = null;
      for (const kw of PLATFORM_KEYS) {
        if (fname.includes(kw.toLowerCase())) {
          if (kw === "百度ai" || kw === "百度") detectedPlat = "baidu";
          else if (kw === "baidu") detectedPlat = "baidu";
          else if (kw === "deepseek") detectedPlat = "deepseek";
          else if (kw === "元宝" || kw === "yuanbao") detectedPlat = "yuanbao";
          else if (kw === "千问" || kw === "qianwen") detectedPlat = "qianwen";
          else if (kw === "豆包") detectedPlat = "doubao";
          break;
        }
      }
      const dateMatch = file.name.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
      const fileDate = dateMatch ? dateMatch[1].replace(/_/g, "-") : new Date().toISOString().slice(0, 10);
      const platLabel = PLATFORM_LABELS[platform];
      const detectedLabel = detectedPlat ? PLATFORM_LABELS[detectedPlat] : "未检测到";

      // 弹确认窗
      currentUploadData = { platform, file, eCol, cCol, freq, urlMap, fileDate, rows };
      showConfirmModal(platform, file, fileDate, detectedPlat, platLabel, detectedLabel);

    } catch (err) {
      console.error(err);
      alert("文件解析失败：" + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ==================== 确认弹窗 ====================
function showConfirmModal(platform, file, fileDate, detectedPlat, platLabel, detectedLabel) {
  const body = document.getElementById("confirmModalBody");
  const warnIcon = detectedPlat && detectedPlat !== platform ? " ⚠️" : "";
  const warnText = detectedPlat && detectedPlat !== platform
    ? `<div class="info-row"><span class="lbl">⚠️ 警告</span><span class="val warn">文件名检测为「${PLATFORM_LABELS[detectedPlat]}」，但你上传到了「${platLabel}」标签页</span></div>`
    : "";

  body.innerHTML = `
    <div class="info-row"><span class="lbl">文件名</span><span class="val">${escapeHtml(file.name)}</span></div>
    <div class="info-row"><span class="lbl">文件大小</span><span class="val">${formatSize(file.size)}</span></div>
    <div class="info-row"><span class="lbl">目标平台</span><span class="val">${platLabel}</span></div>
    <div class="info-row"><span class="lbl">平台检测</span><span class="val">${detectedLabel}${warnIcon}</span></div>
    <div class="info-row"><span class="lbl">日期</span><span class="val">${fileDate}</span></div>
    <div class="info-row"><span class="lbl" id="roundLabel-${platform}">轮次</span><span class="val" id="roundVal-${platform}">查询中...</span></div>
    ${warnText}
    <div style="margin-top:12px;">
      <label style="font-size:12px;color:#888;">如平台检测有误，可手动选择：</label>
      <select id="platformOverride">
        <option value="${platform}" selected>${platLabel}（当前标签页）</option>
        ${PLATFORMS.filter((p) => p !== platform).map((p) => `<option value="${p}">${PLATFORM_LABELS[p]}</option>`).join("")}
      </select>
    </div>
  `;

  // 查询该文件是否已上传过 & 轮次
  (async () => {
    const targetPlat = platform;
    const { data: existing } = await sb.from("platform_uploads").select("*").eq("platform", targetPlat).eq("file_name", file.name);
    const { data: allUploads } = await sb.from("platform_uploads").select("*").eq("platform", targetPlat).order("file_date", { ascending: true });
    const allFiles = allUploads || [];
    const existingFile = existing && existing.length > 0 ? existing[0] : null;

    let newRound;
    if (existingFile) {
      newRound = existingFile.round;
      document.getElementById(`roundVal-${platform}`).textContent = `第 ${newRound} 轮（文件已存在，覆盖刷新）`;
    } else {
      // 按 file_date 插入排序，确定 round
      const sorted = [...allFiles.map((f) => f.file_date), fileDate].sort();
      newRound = sorted.indexOf(fileDate) + 1;
      document.getElementById(`roundVal-${platform}`).textContent = `第 ${newRound} 轮（新文件）`;
    }

    confirmCallback = async (overridePlat) => {
      document.getElementById("confirmModal").classList.remove("show");
      await processUpload(overridePlat || platform, file, fileDate, newRound);
    };
  })();

  document.getElementById("confirmUploadBtn").onclick = () => {
    const override = document.getElementById("platformOverride").value;
    confirmCallback(override);
  };
  document.getElementById("confirmModal").classList.add("show");
}

function closeConfirmModal() {
  document.getElementById("confirmModal").classList.remove("show");
  confirmCallback = null;
}

// ==================== 处理上传（确认后） ====================
async function processUpload(platform, file, fileDate, round) {
  const resultArea = getEl(platform, "result");
  const dropZone = getEl(platform, "dropZone");
  const fileInfo = getEl(platform, "fileInfo");
  const fileNameEl = getEl(platform, "fileName");
  const roundBadge = getEl(platform, "roundBadge");
  const { eCol, cCol, freq, urlMap } = currentUploadData;

  // 存储状态
  ps[platform] = { file, eCol, cCol, freq, urlMap, round };

  // 更新 UI
  fileNameEl.textContent = `${file.name} (${formatSize(file.size)})`;
  roundBadge.style.display = "inline-flex";
  roundBadge.textContent = `📌 第 ${round} 轮`;
  dropZone.style.display = "none";
  fileInfo.style.display = "flex";
  resultArea.innerHTML = `<div class="no-data">⏳ 正在分析...</div>`;

  // 写入上传记录
  await sb.from("platform_uploads").upsert({
    platform, file_name: file.name, file_date: fileDate, round,
  }, { onConflict: "platform,file_name" });

  // 查询老网站库 & 二测列表
  const [{ data: oldSites }, { data: retestSites }] = await Promise.all([
    sb.from("old_sites").select("*").eq("platform", platform),
    sb.from("retest_sites").select("*").eq("platform", platform),
  ]);

  const oldSet = new Set((oldSites || []).map((s) => s.site_name));
  const retestMap = {};
  (retestSites || []).forEach((s) => {
    retestMap[s.site_name] = s;
  });

  // 分类：freq 中的所有网站
  const allSites = Object.entries(freq).sort((a, b) => b[1] - a[1]);

  // 频次 ≥10 的
  const freqGte10 = allSites.filter(([_, c]) => c >= 10);

  // 二测监督：在 retest_sites 中且本次出现
  const retestAppear = [];
  const retestAppearNames = new Set();
  allSites.forEach(([name]) => {
    if (retestMap[name]) {
      retestAppear.push({
        name,
        count: freq[name],
        urls: urlMap[name] || {},
        retestData: retestMap[name],
      });
      retestAppearNames.add(name);
    }
  });

  // 新网站：不在 old_sites 也不在 retest_sites
  const newSites = allSites.filter(([name]) => !oldSet.has(name) && !retestAppearNames.has(name));

  // 渲染
  renderPlatformResult(platform, round, freqGte10, retestAppear, newSites);
}

// ==================== 渲染平台结果 ====================
function renderPlatformResult(platform, round, freqGte10, retestAppear, newSites) {
  const resultArea = getEl(platform, "result");
  let html = "";

  // 存储新网站数据用于后续操作
  ps[platform].newSitesData = newSites;
  ps[platform].retestAppearData = retestAppear;

  // ===== Section 1: 频次统计 =====
  html += `<div class="section-title">
    <span class="badge freq">📊</span> 频次统计（≥10次）
    <span class="section-badge">共 ${freqGte10.length} 个网站</span>
    <button class="copy-btn" id="copyFreqBtn-${platform}" style="margin-left:auto;">📋 一键复制</button>
    <span id="copyMsg-${platform}" style="font-size:11px;color:#10b981;display:none;margin-left:6px;">已复制!</span>
  </div>`;

  if (freqGte10.length === 0) {
    html += `<div class="no-data" style="padding:20px;">暂无 ≥10 次的网站</div>`;
  } else {
    ps[platform].freqGte10 = freqGte10;
    html += `<div class="table-wrap"><table class="data-table">
      <thead><tr><th style="width:40px;">#</th><th>网站名称</th><th style="width:70px;" class="num">次数</th></tr></thead>
      <tbody>`;
    freqGte10.forEach(([name, count], i) => {
      html += `<tr><td>${i + 1}</td><td><strong>${escapeHtml(name)}</strong></td><td class="num">${count}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // ===== Section 2: 二测监督 =====
  if (retestAppear.length > 0) {
    html += `<div class="section-title" style="margin-top:24px;border-bottom-color:#f59e0b;">
      <span class="badge retest">🔍</span> 二测监督（本轮出现）
      <span class="section-badge">共 ${retestAppear.length} 个</span>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th style="width:40px;">#</th><th>网站名称</th><th class="num" style="width:70px;">出现次数</th><th class="num" style="width:70px;">唯一URL</th><th style="width:100px;">状态</th><th style="width:110px;">操作</th></tr></thead>
      <tbody>`;

    retestAppear.forEach((item, i) => {
      const urlCount = Object.keys(item.urls).length;
      const rd = item.retestData;
      const roundsInTest = round - rd.first_seen_round;
      const statusLabel = rd.status === "可二轮测试" ? "🟡 可二轮测试" : "🔴 二测未通过";
      const statusClass = rd.status === "可二轮测试" ? "tag-retesting" : "tag-failed";

      html += `<tr>
        <td>${i + 1}</td>
        <td>
          <strong>${escapeHtml(item.name)}</strong>
          <div style="font-size:10px;color:#999;">加入第${rd.first_seen_round}轮，已历经 ${roundsInTest} 轮</div>
          <div class="url-list">${renderUrlList(item.urls, 5)}</div>
        </td>
        <td class="num">${item.count}</td>
        <td class="num">${urlCount}</td>
        <td><span class="tag-status ${statusClass}">${statusLabel}</span></td>
        <td>
          <button class="btn btn-danger btn-xs retest-fail-btn" data-platform="${platform}" data-name="${item.name.replace(/"/g, "'")}" data-round="${round}">暂不入库<br>二测未通过</button>
          <button class="btn btn-success btn-xs retest-pass-btn" style="margin-top:3px;" data-platform="${platform}" data-name="${item.name.replace(/"/g, "'")}" data-round="${round}">通过二测<br>标记可发布</button>
        </td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // ===== Section 3: 新网站 =====
  html += `<div class="section-title" style="margin-top:24px;border-bottom-color:#10b981;">
    <span class="badge new">🆕</span> 新网站
    <span class="section-badge">共 ${newSites.length} 个</span>
  </div>`;

  if (newSites.length === 0) {
    html += `<div class="no-data" style="padding:20px;">🎉 没有新网站！</div>`;
  } else {
    html += `<div class="checkbox-wrap">
      <input type="checkbox" id="selectAll-${platform}" onchange="toggleSelectAll('${platform}', this.checked)"> <label for="selectAll-${platform}" style="font-size:12px;cursor:pointer;">全选</label>
    </div>
    <div class="batch-actions" id="batchActions-${platform}">
      <span style="font-size:12px;color:#888;">批量操作：</span>
      <button class="btn btn-danger btn-sm" id="batchNoSend-${platform}">标记老网站（不可发）</button>
      <button class="btn btn-success btn-sm" id="batchOk-${platform}">标记老网站（可发布）</button>
      <button class="btn btn-warning btn-sm" id="batchRetest-${platform}">标记可二轮测试</button>
      <span style="font-size:11px;color:#999;" id="selectedCount-${platform}">已选 0 个</span>
    </div>
    <div class="table-wrap"><table class="data-table" id="newSitesTable-${platform}">
      <thead><tr><th style="width:30px;"><input type="checkbox" id="selectAllH-${platform}" onchange="toggleSelectAll('${platform}', this.checked)"></th><th style="width:40px;">#</th><th>网站名称</th><th class="num" style="width:70px;">次数</th><th class="num" style="width:70px;">唯一URL</th><th>网址（去重）</th></tr></thead>
      <tbody>`;

    newSites.forEach(([name, count], i) => {
      const urls = ps[platform].urlMap[name] || {};
      const urlCount = Object.keys(urls).length;
      html += `<tr>
        <td><input type="checkbox" class="site-check-${platform}" data-idx="${i}" onchange="updateSelectedCount('${platform}')"></td>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(name)}</strong></td>
        <td class="num">${count}</td>
        <td class="num">${urlCount}</td>
        <td>
          <div class="url-list">${renderUrlList(urls, 3)}</div>
          ${urlCount > 3 ? `<button class="btn btn-outline btn-xs url-detail-btn" style="margin-top:4px;" data-platform="${platform}" data-idx="${i}">查看全部 ${urlCount} 个网址</button>` : ""}
        </td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  resultArea.innerHTML = html;

  // 绑定事件监听（避免 inline onclick 中的特殊字符问题）
  bindPlatformEvents(platform);
}

function renderUrlList(urlMap, limit) {
  const entries = Object.entries(urlMap).sort((a, b) => b[1] - a[1]);
  const show = entries.slice(0, limit);
  return show.map(([url, cnt]) =>
    `<div class="url-row"><a href="${escapeHtml(url)}" target="_blank" style="color:#4f6ef7;font-size:11px;">${escapeHtml(truncateUrl(url, 50))}</a><span class="cnt">${cnt}次</span></div>`
  ).join("");
}

// ==================== 事件绑定 ====================
function bindPlatformEvents(platform) {
  // 复制按钮
  const copyBtn = document.getElementById(`copyFreqBtn-${platform}`);
  if (copyBtn) copyBtn.addEventListener("click", () => copyFreq(platform));

  // 二测操作按钮
  document.querySelectorAll(`.retest-fail-btn[data-platform="${platform}"]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.name;
      const round = parseInt(btn.dataset.round);
      retestAction(platform, name, "fail", round);
    });
  });
  document.querySelectorAll(`.retest-pass-btn[data-platform="${platform}"]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.name;
      const round = parseInt(btn.dataset.round);
      retestAction(platform, name, "pass", round);
    });
  });

  // URL 详情按钮
  document.querySelectorAll(`.url-detail-btn[data-platform="${platform}"]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      const siteData = ps[platform].newSitesData[idx];
      if (siteData) showUrlDetail(platform, siteData[0]);
    });
  });

  // 批量操作按钮
  const batchNoSend = document.getElementById(`batchNoSend-${platform}`);
  const batchOk = document.getElementById(`batchOk-${platform}`);
  const batchRetest = document.getElementById(`batchRetest-${platform}`);
  if (batchNoSend) batchNoSend.addEventListener("click", () => batchMark(platform, "不可发"));
  if (batchOk) batchOk.addEventListener("click", () => batchMark(platform, "可发布"));
  if (batchRetest) batchRetest.addEventListener("click", () => batchMark(platform, "可二轮测试"));
}

// ==================== 操作函数 ====================
function toggleSelectAll(platform, checked) {
  document.querySelectorAll(`.site-check-${platform}`).forEach((cb) => { cb.checked = checked; });
  const sa = document.getElementById(`selectAll-${platform}`);
  const sah = document.getElementById(`selectAllH-${platform}`);
  if (sa) sa.checked = checked;
  if (sah) sah.checked = checked;
  updateSelectedCount(platform);
}

function updateSelectedCount(platform) {
  const count = document.querySelectorAll(`.site-check-${platform}:checked`).length;
  const el = document.getElementById(`selectedCount-${platform}`);
  if (el) el.textContent = `已选 ${count} 个`;
}

async function batchMark(platform, status) {
  const checked = document.querySelectorAll(`.site-check-${platform}:checked`);
  if (checked.length === 0) { alert("请先勾选网站"); return; }

  const newData = ps[platform].newSitesData;
  const sites = Array.from(checked).map((cb) => {
    const idx = parseInt(cb.dataset.idx);
    return newData[idx] ? newData[idx][0] : null;
  }).filter(Boolean);

  if (status === "可二轮测试") {
    const round = ps[platform].round || 1;
    const rows = sites.map((name) => ({
      platform, site_name: name, status: "可二轮测试", first_seen_round: round,
    }));
    const { error } = await sb.from("retest_sites").upsert(rows, { onConflict: "platform,site_name" });
    if (error) { alert("操作失败：" + error.message); return; }
  } else {
    const source = "direct";
    const rows = sites.map((name) => ({
      platform, site_name: name, status, source,
    }));
    const { error } = await sb.from("old_sites").upsert(rows, { onConflict: "platform,site_name" });
    if (error) { alert("操作失败：" + error.message); return; }
  }

  alert(`已将 ${checked.length} 个网站标记为「${status}」`);
  await reloadPlatformView(platform, ps[platform].round);
}

async function retestAction(platform, siteName, action, round) {
  if (action === "pass") {
    await Promise.all([
      sb.from("old_sites").upsert({ platform, site_name: siteName, status: "可发布", source: "retest" }, { onConflict: "platform,site_name" }),
      sb.from("retest_sites").delete().eq("platform", platform).eq("site_name", siteName),
    ]);
  } else {
    await sb.from("retest_sites").update({ status: "二测未通过" }).eq("platform", platform).eq("site_name", siteName);
  }
  await reloadPlatformView(platform, round);
}

async function reloadPlatformView(platform, round) {
  const { eCol, cCol, freq, urlMap } = ps[platform];
  if (!freq) return;
  const [{ data: oldSites }, { data: retestSites }] = await Promise.all([
    sb.from("old_sites").select("*").eq("platform", platform),
    sb.from("retest_sites").select("*").eq("platform", platform),
  ]);
  const oldSet = new Set((oldSites || []).map((s) => s.site_name));
  const retestMap = {};
  (retestSites || []).forEach((s) => { retestMap[s.site_name] = s; });

  const allSites = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const freqGte10 = allSites.filter(([_, c]) => c >= 10);

  const retestAppear = [];
  const retestAppearNames = new Set();
  allSites.forEach(([name]) => {
    if (retestMap[name]) {
      retestAppear.push({ name, count: freq[name], urls: urlMap[name] || {}, retestData: retestMap[name] });
      retestAppearNames.add(name);
    }
  });
  const newSites = allSites.filter(([name]) => !oldSet.has(name) && !retestAppearNames.has(name));
  renderPlatformResult(platform, round, freqGte10, retestAppear, newSites);
}

// ==================== 复制频次 ====================
function copyFreq(platform) {
  const gte10 = ps[platform].freqGte10;
  if (!gte10 || gte10.length === 0) return;
  const text = gte10.map(([name, cnt]) => `${name}(${cnt})`).join("\n");
  navigator.clipboard.writeText(text).then(() => {
    const el = document.getElementById(`copyMsg-${platform}`);
    el.style.display = "inline";
    setTimeout(() => { el.style.display = "none"; }, 2000);
  });
}

// ==================== 清除平台 ====================
function clearPlatform(platform) {
  ps[platform] = { file: null, data: null, eCol: [], cCol: [], freq: {}, urlMap: {} };
  getEl(platform, "dropZone").style.display = "";
  getEl(platform, "fileInfo").style.display = "none";
  getEl(platform, "result").innerHTML = `<div class="no-data">上传表格后，自动解析并展示结果</div>`;
  document.getElementById(`fileInput-${platform}`).value = "";
}

// ==================== 网址详情弹窗 ====================
function showUrlDetail(platform, siteName) {
  const urls = ps[platform].urlMap[siteName] || {};
  const entries = Object.entries(urls).sort((a, b) => b[1] - a[1]);
  document.getElementById("siteDetailTitle").textContent = `🔗 ${siteName} - 全部网址（${entries.length} 个唯一URL）`;
  document.getElementById("siteDetailBody").innerHTML = `
    <table class="data-table">
      <thead><tr><th style="width:40px;">#</th><th>网址</th><th class="num" style="width:60px;">次数</th></tr></thead>
      <tbody>
        ${entries.map(([url, cnt], i) => `<tr><td>${i + 1}</td><td><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a></td><td class="num">${cnt}</td></tr>`).join("")}
      </tbody>
    </table>`;
  document.getElementById("siteDetailModal").classList.add("show");
}

function closeSiteDetailModal() {
  document.getElementById("siteDetailModal").classList.remove("show");
}

// ==================== Tab 6: 共同网站分析 ====================
async function refreshSummary() {
  const statusEl = document.getElementById("summaryStatus");
  const content = document.getElementById("summaryContent");

  const platformData = {};
  let count = 0;
  for (const p of PLATFORMS) {
    if (ps[p].freq && Object.keys(ps[p].freq).length > 0) {
      platformData[p] = Object.keys(ps[p].freq);
      count++;
    }
  }

  if (count < 2) {
    statusEl.textContent = `已上传 ${count}/5 个平台（需≥2）`;
    statusEl.style.color = "#e8890c";
    content.innerHTML = `<div class="no-data">至少需要上传 2 个平台的表格才能分析共同网站</div>`;
    return;
  }

  // 统计每个网站出现在哪些平台
  const allNames = new Set();
  for (const p of PLATFORMS) {
    if (platformData[p]) platformData[p].forEach((n) => allNames.add(n));
  }

  const commonSites = [];
  allNames.forEach((name) => {
    const apps = PLATFORMS.filter((p) => platformData[p] && platformData[p].includes(name));
    if (apps.length >= 2) {
      const details = apps.map((p) => ({ platform: p, count: ps[p].freq[name] || 0 }));
      commonSites.push({ name, platformCount: apps.length, details });
    }
  });

  commonSites.sort((a, b) => {
    if (b.platformCount !== a.platformCount) return b.platformCount - a.platformCount;
    const ta = a.details.reduce((s, d) => s + d.count, 0);
    const tb = b.details.reduce((s, d) => s + d.count, 0);
    return tb - ta;
  });

  statusEl.textContent = `✅ 共同网站：${commonSites.length} 个`;
  statusEl.style.color = "#10b981";

  if (commonSites.length === 0) {
    content.innerHTML = `<div class="no-data">未发现共同网站（≥2 平台同时出现）</div>`;
    return;
  }

  const uploadedPlats = PLATFORMS.filter((p) => platformData[p]);
  let tableHtml = `
    <div class="stats-bar">
      <div class="stat-card stat-blue"><div class="num">${commonSites.length}</div><div class="lbl">共同网站</div></div>
      <div class="stat-card stat-green"><div class="num">${allNames.size}</div><div class="lbl">全部网站种类</div></div>
      <div class="stat-card stat-orange"><div class="num">${count}</div><div class="lbl">已上传平台</div></div>
      <div class="stat-card stat-purple"><div class="num">${commonSites[0]?.platformCount || 0}</div><div class="lbl">最高覆盖</div></div>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th style="width:40px;">#</th><th>共同网站</th><th class="num" style="width:70px;">覆盖平台</th>
      ${uploadedPlats.map((p) => `<th class="num" style="width:70px;">${PLATFORM_LABELS[p]}</th>`).join("")}
      <th class="num" style="width:70px;">总次数</th></tr></thead>
      <tbody>`;

  commonSites.forEach((site, i) => {
    const total = site.details.reduce((s, d) => s + d.count, 0);
    const platformTags = site.details.map((d) => `<span class="tag tag-${d.platform}">${PLATFORM_LABELS[d.platform]} ×${d.count}</span>`).join(" ");
    const cells = uploadedPlats.map((p) => {
      const d = site.details.find((x) => x.platform === p);
      return d ? `<td class="num"><span class="tag tag-${p}">${d.count}</span></td>` : `<td class="num" style="color:#ccc;">-</td>`;
    }).join("");
    tableHtml += `<tr><td>${i + 1}</td><td><strong>${escapeHtml(site.name)}</strong><div style="margin-top:3px;">${platformTags}</div></td><td class="num" style="font-size:14px;font-weight:700;color:#4f6ef7;">${site.platformCount}</td>${cells}<td class="num" style="font-weight:700;">${total}</td></tr>`;
  });

  tableHtml += `</tbody></table></div>`;
  content.innerHTML = tableHtml;
}

document.getElementById("refreshSummaryBtn").addEventListener("click", refreshSummary);

// ==================== Tab 7: 二测统计 ====================
async function refreshRetestStats() {
  const content = document.getElementById("retestContent");
  const statusEl = document.getElementById("retestStatus");

  const [{ data: retestAll }, { data: oldPassed }] = await Promise.all([
    sb.from("retest_sites").select("*"),
    sb.from("old_sites").select("*").eq("source", "retest"),
  ]);

  const retestByPlat = {};
  const passedByPlat = {};
  PLATFORMS.forEach((p) => { retestByPlat[p] = []; passedByPlat[p] = []; });
  (retestAll || []).forEach((r) => { if (retestByPlat[r.platform]) retestByPlat[r.platform].push(r); });
  (oldPassed || []).forEach((s) => { if (passedByPlat[s.platform]) passedByPlat[s.platform].push(s); });

  statusEl.textContent = "✅ 已刷新";
  statusEl.style.color = "#10b981";

  let html = "";
  PLATFORMS.forEach((p) => {
    const retesting = retestByPlat[p].filter((r) => r.status === "可二轮测试");
    const failed = retestByPlat[p].filter((r) => r.status === "二测未通过");
    const passed = passedByPlat[p];
    const total = retesting.length + failed.length + passed.length;

    html += `<div style="margin-bottom:20px;padding:16px;background:#fafbfc;border-radius:10px;border:1px solid #e8ebf0;">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px;">${PLATFORM_ICONS[p]} ${PLATFORM_LABELS[p]} <span style="font-weight:400;color:#888;font-size:12px;">共 ${total} 条二测记录</span></div>
      <div class="stats-bar">
        <div class="stat-card stat-orange"><div class="num">${retesting.length}</div><div class="lbl">可二轮测试</div></div>
        <div class="stat-card stat-purple"><div class="num">${failed.length}</div><div class="lbl">二测未通过</div></div>
        <div class="stat-card stat-green"><div class="num">${passed.length}</div><div class="lbl">通过二测</div></div>
      </div>`;

    if (retesting.length > 0) {
      html += `<div style="font-size:12px;font-weight:600;color:#f59e0b;margin:8px 0;">🟡 可二轮测试</div>`;
      html += retesting.map((r) => `<span class="tag tag-retesting" style="margin:2px;">${escapeHtml(r.site_name)} · 第${r.first_seen_round}轮加入</span>`).join(" ");
    }
    if (failed.length > 0) {
      html += `<div style="font-size:12px;font-weight:600;color:#db2777;margin:8px 0;">🔴 二测未通过</div>`;
      html += failed.map((r) => `<span class="tag tag-failed" style="margin:2px;">${escapeHtml(r.site_name)} · 第${r.first_seen_round}轮加入</span>`).join(" ");
    }
    if (passed.length > 0) {
      html += `<div style="font-size:12px;font-weight:600;color:#059669;margin:8px 0;">✅ 通过二测（可发布）</div>`;
      html += passed.map((s) => `<span class="tag tag-ok" style="margin:2px;">${escapeHtml(s.site_name)}</span>`).join(" ");
    }
    html += `</div>`;
  });

  if (!retestAll || retestAll.length === 0) {
    html += `<div class="no-data">暂无二测数据</div>`;
  }

  content.innerHTML = html;
}

document.getElementById("refreshRetestBtn").addEventListener("click", refreshRetestStats);

// ==================== 手动监测列表 ====================
async function loadMonitorList() {
  const { data } = await sb.from("monitor_list").select("*").order("created_at");
  renderMonitorList(data || []);
}

function renderMonitorList(items) {
  const container = document.getElementById("monitorList");
  if (items.length === 0) {
    container.innerHTML = `<div style="font-size:12px;color:#bbb;padding:8px 0;">暂无监测项</div>`;
    return;
  }
  container.innerHTML = items.map((item) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f0f3ff;border-radius:14px;font-size:12px;margin:3px;">
      ${escapeHtml(item.site_name)}
      <span style="cursor:pointer;color:#e74c3c;font-weight:700;" onclick="removeMonitor('${escapeHtml(item.site_name)}')">×</span>
    </span>`
  ).join(" ");
}

async function addMonitor() {
  const input = document.getElementById("monitorInput");
  const name = input.value.trim();
  if (!name) return;
  const { error } = await sb.from("monitor_list").upsert({ site_name: name }, { onConflict: "site_name" });
  if (error) { alert("添加失败：" + error.message); return; }
  input.value = "";
  await loadMonitorList();
}

async function removeMonitor(name) {
  await sb.from("monitor_list").delete().eq("site_name", name);
  await loadMonitorList();
}

async function checkMonitor() {
  const { data } = await sb.from("monitor_list").select("*");
  if (!data || data.length === 0) { alert("监测列表为空"); return; }

  const result = document.getElementById("monitorResult");
  let html = `<div style="font-weight:600;margin-bottom:8px;">🔍 检测结果：</div><div class="table-wrap"><table class="data-table">
    <thead><tr><th>网站名</th>${PLATFORMS.map((p) => `<th class="num">${PLATFORM_LABELS[p]}</th>`).join("")}</tr></thead><tbody>`;

  for (const item of data) {
    html += `<tr><td><strong>${escapeHtml(item.site_name)}</strong></td>`;
    for (const p of PLATFORMS) {
      const cnt = ps[p].freq && ps[p].freq[item.site_name] ? ps[p].freq[item.site_name] : 0;
      const cell = cnt > 0 ? `<span style="color:#10b981;font-weight:600;">✅ ${cnt}次</span>` : `<span style="color:#ccc;">-</span>`;
      html += `<td class="num">${cell}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table></div>`;
  result.innerHTML = html;
}

document.getElementById("addMonitorBtn").addEventListener("click", addMonitor);
document.getElementById("monitorInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addMonitor(); });
document.getElementById("checkMonitorBtn").addEventListener("click", checkMonitor);

// ==================== 工具函数 ====================
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function truncateUrl(url, len) {
  return url.length > len ? url.slice(0, len) + "..." : url;
}

// ==================== 存储当前 round 到 ps ====================
// 在 processUpload 中已存储，这里补全初始化
PLATFORMS.forEach((p) => {
  ps[p].round = 1;
});

console.log("✅ AI 表格分析工具已就绪");
console.log("📌 7个标签页：豆包 | DeepSeek | 百度AI | 元宝 | 千问 | 共同网站 | 二测统计");
