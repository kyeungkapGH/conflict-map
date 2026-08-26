require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const ukraineLocations = require('./src/ukraine/routes/locations');
const ukraineLines = require('./src/ukraine/routes/lines');
const ukraineMarkers = require('./src/ukraine/routes/markers');

const lebanonLocations = require('./src/lebanon/routes/locations');
const lebanonLines = require('./src/lebanon/routes/lines');
const lebanonMarkers = require('./src/lebanon/routes/markers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

app.use('/', express.static(path.join(__dirname, 'public')));

app.use('/ukraine/api/locations', ukraineLocations);
app.use('/ukraine/api/lines', ukraineLines);
app.use('/ukraine/api/markers', ukraineMarkers);

app.use('/lebanon/api/locations', lebanonLocations);
app.use('/lebanon/api/lines', lebanonLines);
app.use('/lebanon/api/markers', lebanonMarkers);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Conflict map server running on port ${PORT}`);
});
