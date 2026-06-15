# 📊 AI 表格分析工具

多平台 AI 采集表格对比分析工具，支持 Supabase + Vercel 部署。

## 🚀 部署步骤

### 第一步：注册 Supabase

1. 打开 [supabase.com](https://supabase.com) 注册账号
2. 创建新项目（Free 额度完全够用）
3. 进入项目 → **SQL Editor** → 新建查询
4. 将 `schema.sql` 的内容粘贴进去，点击 **Run** 执行
5. 进入项目 → **Settings** → **API**
6. 复制 `Project URL` 和 `anon public key`

### 第二步：配置项目

编辑 `config.js`，填入你的 Supabase 凭证：

```js
const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJI...";  // 复制 anon key
```

### 第三步：部署到 Vercel

**方式 A：Vercel CLI**
```bash
npm i -g vercel
vercel login
cd 项目目录
vercel --prod
```

**方式 B：通过 GitHub**
1. 把项目推送到 GitHub 仓库
2. 打开 [vercel.com](https://vercel.com) 注册
3. 点击 **Add New → Project** → 选择你的仓库
4. 直接点击 **Deploy**（无需配置 build settings）

部署成功后你会获得一个公开链接，如 `https://ai-table-analyzer.vercel.app`。

## 📋 使用说明

### 7 个标签页

| 标签页 | 功能 |
|--------|------|
| 🫘 豆包 | 上传豆包采集表格 |
| 🔍 DeepSeek | 上传 DeepSeek 采集表格 |
| 🌐 百度AI | 上传百度AI 采集表格 |
| 💰 元宝 | 上传元宝采集表格 |
| ❓ 千问 | 上传千问采集表格 |
| 📋 共同网站 | 分析跨平台共同出现的网站 |
| 📊 二测统计 | 查看各平台二测进度 + 手动监测 |

### 工作流程

1. **上传表格**：拖拽或点击上传 `.xlsx` 文件
2. **确认弹窗**：自动检测平台和日期，确认后开始处理
3. **频次统计**：E 列网站次数 ≥10 的降序排列，可一键复制
4. **二测监督**：之前标记为"可二轮测试"或"二测未通过"的网站，如本轮出现则展示
5. **新网站**：不在老网站库也不在二测列表中的网站，可批量操作：
   - 标记老网站（不可发）
   - 标记老网站（可发布）
   - 标记可二轮测试

### 网站状态说明

| 状态 | 存储位置 | 含义 |
|------|----------|------|
| 不可发 | old_sites | 直接标记的老网站，下次不再显示 |
| 可发布 | old_sites | 通过二测的老网站，下次不再显示 |
| 可二轮测试 | retest_sites | 等待下次上传时监督 |
| 二测未通过 | retest_sites | 监督后未通过，继续跟踪 |

### 轮次规则

- 轮次按**文件名的日期从小到大**排列
- 同名文件再次上传 = 同一轮（覆盖刷新）
- 不同文件 = 新轮次（按日期排序后自动插入）

### 手动监测（Tab 7）

- 输入网站名添加到监测列表
- 点击检测按钮，查看监测列表中的网站在哪些平台出现
