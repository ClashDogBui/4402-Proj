const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'deere.sqlite'));
db.exec('PRAGMA foreign_keys = ON');

module.exports = db;
