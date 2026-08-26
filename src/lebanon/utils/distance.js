const UNIFIL_LAT = 33.2785;
const UNIFIL_LON = 35.2498;
const EARTH_RADIUS_KM = 6371;

/** UNIFIL 본부 기준 좌표까지의 거리(km)를 Haversine 공식으로 계산한다. */
function getDistanceFromUnifil(lat, lon) {
  const dLat = ((lat - UNIFIL_LAT) * Math.PI) / 180;
  const dLon = ((lon - UNIFIL_LON) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((UNIFIL_LAT * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { getDistanceFromUnifil };
