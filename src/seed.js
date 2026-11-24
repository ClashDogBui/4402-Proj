// Rebuilds the database tables (empty).
// WARNING: drops all existing tables and their data. Run with: npm run seed
const db = require('./db');

db.exec(`
  -- Drop child tables before product, since they reference it
  DROP TABLE IF EXISTS "product-features";
  DROP TABLE IF EXISTS product_features;
  DROP TABLE IF EXISTS inventory;
  DROP TABLE IF EXISTS product;

  -- A product is a model of machine (e.g. John Deere 6R 145)
  CREATE TABLE product (
    product_id  INTEGER PRIMARY KEY,
    brand       TEXT NOT NULL,
    model       TEXT NOT NULL,
    category    TEXT NOT NULL,
    series      TEXT,
    horsepower  INTEGER,
    UNIQUE (brand, model)
  );

  -- An inventory item is one physical unit of a product
  CREATE TABLE inventory (
    id          INTEGER PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
    serial      TEXT NOT NULL UNIQUE,
    year        INTEGER,
    condition   TEXT CHECK (condition IN ('new', 'used')),
    hours       INTEGER,
    price       NUMERIC NOT NULL,
    status      TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'sold', 'reserved', 'maintenance')),
    location    TEXT
  );

  -- Extra specs per product (many features per product)
  CREATE TABLE product_features (
    id          INTEGER PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
    feature     TEXT NOT NULL,
    value       TEXT,
    unit        TEXT,
    UNIQUE (product_id, feature)
  );
`);

console.log('Database tables created.');
