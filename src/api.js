const express = require('express');
const db = require('./db');
const router = express.Router();

// Joins an inventory unit with its product, using the API's field names
const SELECT_EQUIPMENT = `
  SELECT
    i.id,
    p.brand,
    p.model,
    p.category,
    p.series,
    i.year,
    p.horsepower,
    i.hours      AS engineHours,
    i.price,
    i.condition,
    i.status,
    i.location,
    i.serial     AS serialNumber
  FROM inventory i
  JOIN product p ON p.product_id = i.product_id
`;

const getEquipment = db.prepare(`${SELECT_EQUIPMENT} WHERE i.id = ?`);

router.get('/equipments', (req, res) => {
  const rows = db.prepare(`${SELECT_EQUIPMENT} ORDER BY i.id`).all();
  res.status(200).json(rows);
});

router.get('/equipments/:id', (req, res) => {
  const row = getEquipment.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Equipment not found' });
  res.status(200).json(row);
});

router.post('/equipments', (req, res) => {
  const {
    brand, model, category, series, horsepower,
    year, engineHours, price, condition, status, location, serialNumber,
  } = req.body ?? {};

  if (!brand || !model || !category || !serialNumber || price == null) {
    return res.status(400).json({
      error: 'brand, model, category, serialNumber and price are required',
    });
  }

  try {
    db.exec('BEGIN');

    // Reuse the product if this brand/model already exists
    let product = db.prepare('SELECT product_id FROM product WHERE brand = ? AND model = ?')
      .get(brand, model);
    if (!product) {
      const result = db.prepare(`
        INSERT INTO product (brand, model, category, series, horsepower)
        VALUES (?, ?, ?, ?, ?)
      `).run(brand, model, category, series ?? null, horsepower ?? null);
      product = { product_id: result.lastInsertRowid };
    }

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO inventory (product_id, serial, year, condition, hours, price, status, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(product.product_id, serialNumber, year ?? null, condition ?? null,
      engineHours ?? null, price, status ?? 'available', location ?? null);

    db.exec('COMMIT');
    res.status(201).json(getEquipment.get(lastInsertRowid));
  } catch (err) {
    db.exec('ROLLBACK');
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'serialNumber already exists' });
    }
    if (err.message.includes('CHECK')) {
      return res.status(400).json({
        error: "condition must be 'new' or 'used'; status must be available, sold, reserved or maintenance",
      });
    }
    throw err;
  }
});

router.delete('/equipments/:id', (req, res) => {
  const result = db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Equipment not found' });
  res.status(204).end();
});

module.exports = router;
