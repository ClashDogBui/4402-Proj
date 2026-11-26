// npm run seed
//recreate tables and take data.json and parse data into the database
const fs = require('fs');
const path = require('path');
const db = require('./db');

db.exec(`
  -- Drop child tables before the tables they reference
  DROP TABLE IF EXISTS "Sale";
  DROP TABLE IF EXISTS "Lease";
  DROP TABLE IF EXISTS "Loans";
  DROP TABLE IF EXISTS "Part relation";
  DROP TABLE IF EXISTS "product-features";
  DROP TABLE IF EXISTS "inventory";
  DROP TABLE IF EXISTS "Parts";
  DROP TABLE IF EXISTS "customer";
  DROP TABLE IF EXISTS "product";
  DROP TABLE IF EXISTS "Dealership";

  CREATE TABLE "product" (
    product_id    INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL,
    price         NUMERIC NOT NULL,
    category      TEXT,
    sub_category  TEXT,
    feature       REAL
  );

  -- Extra specs per product (id is the product_id)
  CREATE TABLE "product-features" (
    id               INTEGER PRIMARY KEY REFERENCES product(product_id),
    feature          TEXT,
    "feature-value"  TEXT,
    unit             TEXT,
    UNIQUE (id, feature)
  );

  CREATE TABLE Dealership (
    dealership_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    address        TEXT NOT NULL,
    latitude       REAL NOT NULL,
    longitude      REAL NOT NULL,
    phone          TEXT
  );

  -- One physical unit of a product, held at a dealership
  CREATE TABLE "inventory" (
    id             INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    product_id     INTEGER REFERENCES product(product_id),
    serial         TEXT,
    condition      TEXT,
    hours          INTEGER,
    dealership_id  INTEGER REFERENCES Dealership(dealership_id)
  );

  CREATE TABLE "customer" (
    "account id"  INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    password      TEXT NOT NULL,
    address       TEXT NOT NULL,
    phone         NUMERIC NOT NULL,
    ssn           NUMERIC
  );

  CREATE TABLE "Parts" (
    "part id"      INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL,
    "part number"  TEXT NOT NULL,
    name           TEXT NOT NULL,
    stock          INTEGER,
    price          NUMERIC
  );

  CREATE TABLE "Part relation" (
    "part id"     INTEGER NOT NULL REFERENCES "Parts"("part id"),
    "product id"  INTEGER NOT NULL REFERENCES product(product_id)
  );

  CREATE TABLE "Loans" (
    "loan id"      INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "loan number"  TEXT NOT NULL,
    "account id"   INTEGER REFERENCES customer("account id"),
    ammount        NUMERIC,
    interest       NUMERIC,
    "term period"  INTEGER
  );

  CREATE TABLE "Lease" (
    "lease id"      INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE NOT NULL,
    "account id"    INTEGER NOT NULL REFERENCES customer("account id"),
    "inventory id"  INTEGER NOT NULL REFERENCES inventory(id),
    period          INTEGER NOT NULL,
    amount          NUMERIC NOT NULL
  );

  CREATE TABLE "Sale" (
    "sale id"        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    "account id"     INTEGER REFERENCES customer("account id"),
    "inventory id"   INTEGER NOT NULL REFERENCES inventory(id),
    date             TEXT,
    "sale amount"    NUMERIC,
    -- NOTE: in deere.sqlite this column was created unquoted, so it is named "dealership"
    -- (probably meant "dealership id"). Kept as-is to match the current database.
    dealership       INTEGER REFERENCES Dealership(dealership_id)
  );
`);

console.log('Database tables created.');

function insertData(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const quote = (name) => `"${name.replace(/"/g, '""')}"`;

  db.exec('BEGIN');
  try {
    for (const [table, rows] of Object.entries(data)) {
      for (const row of rows) {
        const columns = Object.keys(row);
        const sql = `INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')})
                     VALUES (${columns.map(() => '?').join(', ')})`;
        db.prepare(sql).run(...columns.map((c) => row[c]));
      }
      console.log(`  ${table}: ${rows.length} row(s)`);
    }
    db.exec('COMMIT');
    console.log('Seed data inserted.');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(`Seeding failed, no data was inserted: ${err.message}`);
    process.exitCode = 1;
  }
}

insertData(path.join(__dirname, 'data.json'));
