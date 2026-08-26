require('dotenv').config();

const express = require('express');
const cors = require('cors');

const ukraineLocations = require('../src/ukraine/routes/locations');
const ukraineLines = require('../src/ukraine/routes/lines');
const ukraineMarkers = require('../src/ukraine/routes/markers');

const lebanonLocations = require('../src/lebanon/routes/locations');
const lebanonLines = require('../src/lebanon/routes/lines');
const lebanonMarkers = require('../src/lebanon/routes/markers');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

app.use('/ukraine/api/locations', ukraineLocations);
app.use('/ukraine/api/lines', ukraineLines);
app.use('/ukraine/api/markers', ukraineMarkers);

app.use('/lebanon/api/locations', lebanonLocations);
app.use('/lebanon/api/lines', lebanonLines);
app.use('/lebanon/api/markers', lebanonMarkers);

module.exports = app;
