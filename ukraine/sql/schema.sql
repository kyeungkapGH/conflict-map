-- 상황 데이터 (공습/사건 등 위치 정보)
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    dms_string VARCHAR(255),
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_at TIMESTAMP,
    category VARCHAR(50),
    detail_info TEXT,
    damage_info TEXT,
    attacker VARCHAR(100),
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    article_title TEXT
);

-- 지형지물 라인 (강, 휴전선, 도로 등)
CREATE TABLE IF NOT EXISTS map_lines (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'rgba(0, 100, 255, 0.6)',
    coordinates JSONB NOT NULL, -- [[lat, lon], [lat, lon], ...]
    created_at TIMESTAMP DEFAULT now()
);

-- 점령지 마커 (원형/X형)
CREATE TABLE IF NOT EXISTS map_markers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    marker_type TEXT NOT NULL CHECK (marker_type IN ('circle', 'x')),
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);
