const express = require('express');
const router = express.Router();

router.get('/hello', (_req, res) => {
  res.json({ message: 'Hello from api.js' });
});


module.exports = router;
