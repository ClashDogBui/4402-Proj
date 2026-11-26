const express = require('express');
const db = require('./db');
const router = express.Router();

router.get('/hello', (_req, res) => {
  res.json({ message: 'Hello from api.js' });
});

// Joins an inventory unit with its product and dealership, using the API's field names
const SELECT_EQUIPMENT = `
  SELECT
    i.id,
    i.product_id      AS productId,
    p.category,
    p.sub_category    AS subCategory,
    p.price,
    i.serial          AS serialNumber,
    i.condition,
    i.hours           AS engineHours,
    i.dealership_id   AS dealershipId,
    d.name            AS dealershipName,
    CASE
      WHEN EXISTS (SELECT 1 FROM Sale s WHERE s."inventory id" = i.id) THEN 'sold'
      WHEN EXISTS (SELECT 1 FROM Lease l WHERE l."inventory id" = i.id) THEN 'leased'
      ELSE 'available'
    END               AS status
  FROM inventory i
  JOIN product p ON p.product_id = i.product_id
  LEFT JOIN Dealership d ON d.dealership_id = i.dealership_id
`;

const getEquipment = db.prepare(`${SELECT_EQUIPMENT} WHERE i.id = ?`);
const getFeatures = db.prepare(`
  SELECT feature, "feature-value" AS value, unit
  FROM "product-features"
  WHERE id = ?
  ORDER BY feature
`);

const withFeatures = (row) => ({ ...row, features: getFeatures.all(row.productId) });

router.get('/equipments', (_req, res) => {
  const rows = db.prepare(`${SELECT_EQUIPMENT} ORDER BY i.id`).all();
  res.status(200).json(rows.map(withFeatures));
});

router.get('/equipments/:id', (req, res) => {
  const row = getEquipment.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Equipment not found' });
  res.status(200).json(withFeatures(row));
});

// Body: either productId (existing product) or category + price (creates a new product),
// plus serialNumber, condition, engineHours, dealershipId
router.post('/equipments', (req, res) => {
  const {
    productId, category, subCategory, price,
    serialNumber, condition, engineHours, dealershipId,
  } = req.body ?? {};

  if (!serialNumber || (productId == null && (!category || price == null))) {
    return res.status(400).json({
      error: 'serialNumber is required, plus either productId or category and price',
    });
  }

  if (condition != null && !['new', 'used'].includes(condition)) {
    return res.status(400).json({ error: "condition must be 'new' or 'used'" });
  }
  if (engineHours != null && !(Number.isInteger(Number(engineHours)) && Number(engineHours) >= 0)) {
    return res.status(400).json({ error: 'engineHours must be a whole number of 0 or more' });
  }
  if (productId == null && !(Number(price) > 0)) {
    return res.status(400).json({ error: 'price must be a number greater than 0' });
  }

  // serial has no UNIQUE constraint in the schema, so enforce it here
  if (db.prepare('SELECT 1 FROM inventory WHERE serial = ?').get(serialNumber)) {
    return res.status(409).json({ error: 'serialNumber already exists' });
  }

  try {
    db.exec('BEGIN');

    let pid = productId;
    if (pid == null) {
      const result = db.prepare(`
        INSERT INTO product (price, category, sub_category)
        VALUES (?, ?, ?)
      `).run(price, category, subCategory ?? null);
      pid = result.lastInsertRowid;
    }

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO inventory (product_id, serial, condition, hours, dealership_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(pid, serialNumber, condition ?? null, engineHours ?? null, dealershipId ?? null);

    db.exec('COMMIT');
    res.status(201).json(withFeatures(getEquipment.get(lastInsertRowid)));
  } catch (err) {
    db.exec('ROLLBACK');
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'productId or dealershipId does not exist' });
    }
    throw err;
  }
});

router.delete('/equipments/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM inventory WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Equipment not found' });
    res.status(204).end();
  } catch (err) {
    // Sale and Lease rows reference inventory
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(409).json({ error: 'Equipment has sales or leases and cannot be deleted' });
    }
    throw err;
  }
});

// Products that equipment can be added under, with their features
router.get('/products', (_req, res) => {
  const rows = db.prepare(`
    SELECT product_id AS id, category, sub_category AS subCategory, price
    FROM product
    ORDER BY category, sub_category, price
  `).all();
  res.status(200).json(rows.map((p) => ({ ...p, features: getFeatures.all(p.id) })));
});

// Dealership locations, with how many units each has available
router.get('/dealerships', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      d.dealership_id AS id,
      d.name,
      d.address,
      d.latitude,
      d.longitude,
      d.phone,
      COUNT(i.id)     AS availableUnits
    FROM Dealership d
    LEFT JOIN inventory i
      ON i.dealership_id = d.dealership_id
      AND NOT EXISTS (SELECT 1 FROM Sale s WHERE s."inventory id" = i.id)
      AND NOT EXISTS (SELECT 1 FROM Lease l WHERE l."inventory id" = i.id)
    GROUP BY d.dealership_id
    ORDER BY d.name
  `).all();
  res.status(200).json(rows);
});

module.exports = router;
