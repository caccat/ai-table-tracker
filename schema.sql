-- ============================================================
-- AI 表格分析工具 - Supabase 数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- 1. 上传记录表（跟踪每轮上传）
CREATE TABLE platform_uploads (
  id          BIGSERIAL PRIMARY KEY,
  platform    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_date   DATE NOT NULL,
  round       INT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uploads_platform ON platform_uploads(platform);
CREATE UNIQUE INDEX idx_uploads_unique ON platform_uploads(platform, file_name);

-- 2. 老网站库（不可发 / 可发布）
CREATE TABLE old_sites (
  id          BIGSERIAL PRIMARY KEY,
  platform    TEXT NOT NULL,
  site_name   TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('不可发', '可发布')),
  source      TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('direct', 'retest')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_old_sites_unique ON old_sites(platform, site_name);

-- 3. 二测跟踪表（可二轮测试 / 二测未通过）
CREATE TABLE retest_sites (
  id                BIGSERIAL PRIMARY KEY,
  platform          TEXT NOT NULL,
  site_name         TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('可二轮测试', '二测未通过')),
  first_seen_round  INT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_retest_unique ON retest_sites(platform, site_name);

-- 4. 手动监测列表（跨平台，Tab7）
CREATE TABLE monitor_list (
  id          BIGSERIAL PRIMARY KEY,
  site_name   TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS 策略（允许匿名访问，内部工具使用）
-- ============================================================
ALTER TABLE platform_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE old_sites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE retest_sites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_list    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on platform_uploads" ON platform_uploads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on old_sites"       ON old_sites       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on retest_sites"    ON retest_sites    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on monitor_list"    ON monitor_list    FOR ALL USING (true) WITH CHECK (true);
