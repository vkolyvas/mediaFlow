import { DatabaseSync } from 'node:sqlite';
import { PATHS, ensureDirs } from './config.mjs';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS campaigns (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  pillar         TEXT NOT NULL,
  audience       TEXT NOT NULL,
  objective      TEXT NOT NULL,
  location_slug  TEXT,
  category_slug  TEXT,
  landing_path   TEXT NOT NULL,
  utm_campaign   TEXT NOT NULL,
  planned_date   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id             TEXT PRIMARY KEY,
  campaign_id    TEXT REFERENCES campaigns(id),
  pillar         TEXT NOT NULL,
  audience       TEXT NOT NULL,
  platform       TEXT NOT NULL,
  format         TEXT NOT NULL,
  state          TEXT NOT NULL,
  title          TEXT NOT NULL,
  caption        TEXT NOT NULL DEFAULT '',
  hashtags       TEXT NOT NULL DEFAULT '[]',
  cta            TEXT NOT NULL DEFAULT '',
  link_url       TEXT,
  utm_url        TEXT,
  landing_path   TEXT,
  utm_campaign   TEXT,
  script         TEXT NOT NULL DEFAULT '{}',
  media          TEXT NOT NULL DEFAULT '[]',
  visual_brief   TEXT NOT NULL DEFAULT '',
  vendor_refs    TEXT NOT NULL DEFAULT '[]',
  postiz_post_id TEXT,
  scheduled_at   TEXT,
  published_at   TEXT,
  error          TEXT,
  fingerprint    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_state ON posts(state);
CREATE INDEX IF NOT EXISTS idx_posts_fingerprint ON posts(fingerprint);
CREATE INDEX IF NOT EXISTS idx_posts_campaign ON posts(campaign_id);

CREATE TABLE IF NOT EXISTS post_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     TEXT NOT NULL,
  from_state  TEXT,
  to_state    TEXT NOT NULL,
  actor       TEXT NOT NULL DEFAULT 'system',
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_post_events_post ON post_events(post_id);

-- Provenance for every vendor fact that appears in generated content.
-- The validator re-fetches each slug and compares against this snapshot.
CREATE TABLE IF NOT EXISTS vendor_snapshots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT NOT NULL,
  business_name  TEXT NOT NULL,
  category_slug  TEXT,
  municipality   TEXT,
  rating_average REAL,
  rating_count   INTEGER,
  claimed        INTEGER NOT NULL DEFAULT 0,
  verified       INTEGER NOT NULL DEFAULT 0,
  snapshot       TEXT NOT NULL,
  captured_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vendor_snapshots_slug ON vendor_snapshots(slug);

CREATE TABLE IF NOT EXISTS metrics (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id        TEXT NOT NULL,
  platform       TEXT NOT NULL,
  date           TEXT NOT NULL,
  reach          INTEGER NOT NULL DEFAULT 0,
  impressions    INTEGER NOT NULL DEFAULT 0,
  clicks         INTEGER NOT NULL DEFAULT 0,
  likes          INTEGER NOT NULL DEFAULT 0,
  comments       INTEGER NOT NULL DEFAULT 0,
  shares         INTEGER NOT NULL DEFAULT 0,
  saves          INTEGER NOT NULL DEFAULT 0,
  profile_visits INTEGER NOT NULL DEFAULT 0,
  raw            TEXT NOT NULL DEFAULT '{}',
  captured_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_metrics_post ON metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics(date);

-- Registrations and enquiries attributed back to a campaign.
CREATE TABLE IF NOT EXISTS conversions (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT,
  post_id      TEXT,
  type         TEXT NOT NULL,
  session_id   TEXT,
  landing_url  TEXT,
  utm          TEXT NOT NULL DEFAULT '{}',
  vendor_slug  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversions_campaign ON conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversions_type ON conversions(type);
`;

let db;

export function getDb() {
  if (!db) {
    ensureDirs();
    db = new DatabaseSync(PATHS.db);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

/* ---------------------------------------------------------------- helpers */

export function all(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

export function tx(fn) {
  const d = getDb();
  d.exec('BEGIN');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

/* ------------------------------------------------------------- campaigns */

export function upsertCampaign(campaign) {
  run(
    `INSERT INTO campaigns (id, name, pillar, audience, objective, location_slug, category_slug, landing_path, utm_campaign, planned_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       pillar = excluded.pillar,
       audience = excluded.audience,
       objective = excluded.objective,
       location_slug = excluded.location_slug,
       category_slug = excluded.category_slug,
       landing_path = excluded.landing_path,
       utm_campaign = excluded.utm_campaign,
       planned_date = excluded.planned_date`,
    [
      campaign.id,
      campaign.name,
      campaign.pillar,
      campaign.audience,
      campaign.objective,
      campaign.locationSlug || null,
      campaign.categorySlug || null,
      campaign.landingPath,
      campaign.utmCampaign,
      campaign.plannedDate || null,
    ],
  );
  return campaign.id;
}

export function getCampaign(id) {
  return get('SELECT * FROM campaigns WHERE id = ?', [id]);
}

/* ----------------------------------------------------------------- posts */

const POST_JSON_FIELDS = ['hashtags', 'script', 'media', 'vendor_refs'];

export function rowToPost(row) {
  if (!row) return null;
  const post = { ...row };
  for (const f of POST_JSON_FIELDS) {
    try {
      post[f] = JSON.parse(post[f] || 'null');
    } catch {
      post[f] = null;
    }
  }
  return post;
}

export function insertPost(post) {
  run(
    `INSERT INTO posts (
       id, campaign_id, pillar, audience, platform, format, state, title, caption, hashtags,
       cta, link_url, utm_url, landing_path, utm_campaign, script, media, visual_brief, vendor_refs, fingerprint
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      post.id,
      post.campaignId || null,
      post.pillar,
      post.audience,
      post.platform,
      post.format,
      post.state,
      post.title,
      post.caption || '',
      JSON.stringify(post.hashtags || []),
      post.cta || '',
      post.linkUrl || null,
      post.utmUrl || null,
      post.landingPath || null,
      post.utmCampaign || null,
      JSON.stringify(post.script || {}),
      JSON.stringify(post.media || []),
      post.visualBrief || '',
      JSON.stringify(post.vendorRefs || []),
      post.fingerprint || null,
    ],
  );
  recordEvent(post.id, null, post.state, 'system', 'created');
  return post.id;
}

export function updatePost(id, fields) {
  const allowed = {
    campaignId: 'campaign_id',
    state: 'state',
    title: 'title',
    caption: 'caption',
    cta: 'cta',
    linkUrl: 'link_url',
    utmUrl: 'utm_url',
    landingPath: 'landing_path',
    utmCampaign: 'utm_campaign',
    visualBrief: 'visual_brief',
    postizPostId: 'postiz_post_id',
    scheduledAt: 'scheduled_at',
    publishedAt: 'published_at',
    error: 'error',
    fingerprint: 'fingerprint',
  };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (key in fields) {
      sets.push(`${column} = ?`);
      params.push(fields[key]);
    }
  }
  for (const field of POST_JSON_FIELDS) {
    if (field in fields) {
      sets.push(`${field} = ?`);
      params.push(JSON.stringify(fields[field]));
    }
  }
  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  params.push(id);
  run(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function getPost(id) {
  return rowToPost(get('SELECT * FROM posts WHERE id = ?', [id]));
}

export function listPosts(filter = {}) {
  const where = [];
  const params = [];
  for (const [column, value] of Object.entries(filter)) {
    if (value === undefined || value === null) continue;
    where.push(`${column} = ?`);
    params.push(value);
  }
  const sql = `SELECT * FROM posts ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
  return all(sql, params).map(rowToPost);
}

/* --------------------------------------------------------------- events */

export function recordEvent(postId, fromState, toState, actor = 'system', note = null) {
  run(
    'INSERT INTO post_events (post_id, from_state, to_state, actor, note) VALUES (?, ?, ?, ?, ?)',
    [postId, fromState, toState, actor, note],
  );
}

export function listEvents(postId) {
  return all('SELECT * FROM post_events WHERE post_id = ? ORDER BY id ASC', [postId]);
}

/* ------------------------------------------------------ vendor snapshots */

export function saveVendorSnapshot(snap) {
  run(
    `INSERT INTO vendor_snapshots
       (slug, business_name, category_slug, municipality, rating_average, rating_count, claimed, verified, snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snap.slug,
      snap.businessName,
      snap.categorySlug || null,
      snap.municipality || null,
      snap.ratingAverage ?? null,
      snap.ratingCount ?? null,
      snap.claimed ? 1 : 0,
      snap.verified ? 1 : 0,
      JSON.stringify(snap.raw || {}),
    ],
  );
}

export function latestVendorSnapshot(slug) {
  const row = get(
    'SELECT * FROM vendor_snapshots WHERE slug = ? ORDER BY id DESC LIMIT 1',
    [slug],
  );
  if (!row) return null;
  return { ...row, snapshot: JSON.parse(row.snapshot || '{}') };
}

/* --------------------------------------------------------------- metrics */

export function insertMetrics(row) {
  run(
    `INSERT INTO metrics (post_id, platform, date, reach, impressions, clicks, likes, comments, shares, saves, profile_visits, raw)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.postId,
      row.platform,
      row.date,
      row.reach || 0,
      row.impressions || 0,
      row.clicks || 0,
      row.likes || 0,
      row.comments || 0,
      row.shares || 0,
      row.saves || 0,
      row.profileVisits || 0,
      JSON.stringify(row.raw || {}),
    ],
  );
}

/* ------------------------------------------------------------ conversions */

export function insertConversion(c) {
  run(
    `INSERT INTO conversions (id, campaign_id, post_id, type, session_id, landing_url, utm, vendor_slug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [
      c.id,
      c.campaignId || null,
      c.postId || null,
      c.type,
      c.sessionId || null,
      c.landingUrl || null,
      JSON.stringify(c.utm || {}),
      c.vendorSlug || null,
    ],
  );
}
