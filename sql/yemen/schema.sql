-- 예멘-사우디 지도 스키마. ukraine_map과 동일한 구조다.
-- (레바논의 distance_km는 UNIFIL 기준 거리라 예멘에는 대응물이 없어 두지 않는다.)

CREATE TABLE IF NOT EXISTS locations (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR NOT NULL,
    dms_string    VARCHAR,
    lat           DOUBLE PRECISION NOT NULL,
    lon           DOUBLE PRECISION NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_at   TIMESTAMP,
    category      VARCHAR,
    detail_info   TEXT,
    damage_info   TEXT,
    attacker      VARCHAR,
    occurred_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    article_title TEXT
);

CREATE TABLE IF NOT EXISTS map_lines (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT 'rgba(0, 100, 255, 0.6)',
    coordinates JSONB NOT NULL,
    created_at  TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS map_markers (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    marker_type TEXT NOT NULL,
    lat         DOUBLE PRECISION NOT NULL,
    lon         DOUBLE PRECISION NOT NULL,
    created_at  TIMESTAMP DEFAULT now()
);
