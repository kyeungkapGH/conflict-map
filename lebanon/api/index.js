require('dotenv').config();

const express = require('express');
const cors = require('cors');

const locationsRouter = require('../src/routes/locations');
const linesRouter = require('../src/routes/lines');
const markersRouter = require('../src/routes/markers');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

app.use('/api/locations', locationsRouter);
app.use('/api/lines', linesRouter);
app.use('/api/markers', markersRouter);

module.exports = app;
