-- ============================================================
-- AI 表格分析工具 - 测试环境数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件（与正式表隔离）
-- ============================================================

-- 1. 上传记录表（跟踪每轮上传）
CREATE TABLE platform_uploads_test (
  id          BIGSERIAL PRIMARY KEY,
  platform    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_date   DATE NOT NULL,
  round       INT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uploads_platform_test ON platform_uploads_test(platform);
CREATE UNIQUE INDEX idx_uploads_unique_test ON platform_uploads_test(platform, file_name);

-- 2. 老网站库（不可发 / 可发布）
CREATE TABLE old_sites_test (
  id          BIGSERIAL PRIMARY KEY,
  platform    TEXT NOT NULL,
  site_name   TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('不可发', '可发布')),
  source      TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('direct', 'retest')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_old_sites_unique_test ON old_sites_test(platform, site_name);

-- 3. 二测跟踪表（可二轮测试 / 二测未通过）
CREATE TABLE retest_sites_test (
  id                BIGSERIAL PRIMARY KEY,
  platform          TEXT NOT NULL,
  site_name         TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('可二轮测试', '二测未通过')),
  first_seen_round  INT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_retest_unique_test ON retest_sites_test(platform, site_name);

-- 4. 手动监测列表（跨平台）
CREATE TABLE monitor_list_test (
  id          BIGSERIAL PRIMARY KEY,
  site_name   TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS 策略（允许匿名访问，内部工具使用）
-- ============================================================
ALTER TABLE platform_uploads_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE old_sites_test       ENABLE ROW LEVEL SECURITY;
ALTER TABLE retest_sites_test    ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_list_test    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on platform_uploads_test" ON platform_uploads_test FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on old_sites_test"       ON old_sites_test       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on retest_sites_test"    ON retest_sites_test    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on monitor_list_test"    ON monitor_list_test    FOR ALL USING (true) WITH CHECK (true);
