require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const locationsRouter = require('./src/routes/locations');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/', express.static(path.join(__dirname, 'public')));

app.use('/api/locations', locationsRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lebanon map server running on port ${PORT}`);
});
