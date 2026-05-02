const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const levelRoutes = require('./routes/levels');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('../public'));

app.use('/api/levels', levelRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Breakout Game API is running' });
});

app.listen(PORT, () => {
  console.log(`Breakout Game server running on http://localhost:${PORT}`);
});