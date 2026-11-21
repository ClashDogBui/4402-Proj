const express = require('express');
const path = require('path');
const apiRoutes = require('./api');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', apiRoutes);

app.listen(3000, ()=> console.log("Running at http://localhost:3000"));
