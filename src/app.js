import { Hono } from 'hono';
import { cors } from 'hono/cors';

import ukraineLocations from './ukraine/routes/locations.js';
import ukraineLines from './ukraine/routes/lines.js';
import ukraineMarkers from './ukraine/routes/markers.js';

import lebanonLocations from './lebanon/routes/locations.js';
import lebanonLines from './lebanon/routes/lines.js';
import lebanonMarkers from './lebanon/routes/markers.js';

import yemenLocations from './yemen/routes/locations.js';
import yemenLines from './yemen/routes/lines.js';
import yemenMarkers from './yemen/routes/markers.js';

const app = new Hono();

app.use('*', cors({
  origin: (_origin, c) => c.env.CORS_ORIGIN || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

app.route('/ukraine/api/locations', ukraineLocations);
app.route('/ukraine/api/lines', ukraineLines);
app.route('/ukraine/api/markers', ukraineMarkers);

app.route('/lebanon/api/locations', lebanonLocations);
app.route('/lebanon/api/lines', lebanonLines);
app.route('/lebanon/api/markers', lebanonMarkers);

app.route('/yemen/api/locations', yemenLocations);
app.route('/yemen/api/lines', yemenLines);
app.route('/yemen/api/markers', yemenMarkers);

// API에 걸리지 않은 요청은 정적 파일이다. Pages의 _worker.js는 모든 요청을 먼저 받으므로
// ASSETS 바인딩으로 직접 넘겨줘야 한다.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
