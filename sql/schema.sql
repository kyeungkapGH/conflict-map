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
