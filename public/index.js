const PAGE_SIZE = 24;

const state = {
  units: [],
  dealerships: [],
  products: [],
  page: 1,
  filters: { search: '', category: '', condition: '', location: '', sort: 'price-asc', showSold: false },
};

const $ = (sel) => document.querySelector(sel);
const els = {
  heroCount: $('#hero-count'),
  heroLede: $('#hero-lede'),
  directory: $('#directory-list'),
  searchForm: $('#search-form'),
  searchInput: $('#search-input'),
  filterSearch: $('#f-search'),
  filters: $('#filters'),
  category: $('#f-category'),
  location: $('#f-location'),
  sort: $('#f-sort'),
  showSold: $('#f-show-sold'),
  grid: $('#tag-grid'),
  gridStatus: $('#grid-status'),
  resultCount: $('#result-count'),
  showMore: $('#show-more'),
  locationList: $('#location-list'),
  map: $('#survey-map'),
  dialog: $('#unit-dialog'),
  dialogBody: $('#unit-body'),
  addOpen: $('#add-open'),
  addDialog: $('#add-dialog'),
  addForm: $('#add-form'),
  addError: $('#add-error'),
  addProduct: $('#a-product'),
  addLocation: $('#a-location'),
  categoryOptions: $('#category-options'),
  toast: $('#toast'),
};

// ---------- Formatting ----------

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US');

const plural = (category) => `${category}s`;
const cityOf = (dealershipName) => (dealershipName ?? '').split(' - ').pop();
const isAvailable = (unit) => unit.status === 'available';

// "Row Crop" + "Tractor" -> "Row Crop Tractor"; "Row Planter" + "Planter" stays "Row Planter"
const unitTitle = (unit) => {
  const sub = unit.subCategory ?? '';
  return sub.toLowerCase().includes(unit.category.toLowerCase()) ? sub : `${sub} ${unit.category}`.trim();
};

const featureText = (unit) => unit.features
  .map((f) => {
    const n = Number(f.value);
    return `${Number.isFinite(n) ? number.format(n) : f.value} ${f.unit ?? ''}`.trim();
  })
  .join(', ');

const statusLabel = { sold: 'Sold', leased: 'On lease' };

// ---------- Data ----------

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} responded with ${res.status}`);
  return res.json();
}

// Sends a write request and turns the API's { error } body into a thrown Error
async function send(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('The server did not respond. Check that it is running, then try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `The server responded with ${res.status}.`);
  return data;
}

async function load() {
  try {
    const [units, dealerships, products] = await Promise.all([
      getJson('/api/equipments'), getJson('/api/dealerships'), getJson('/api/products'),
    ]);
    state.units = units;
    state.dealerships = dealerships;
    state.products = products;
  } catch (err) {
    console.error(err);
    els.directory.innerHTML = '<li class="directory__placeholder">Machine types are unavailable.</li>';
    showStatus(
      'Inventory could not be loaded',
      'The server did not respond. Start it with <code>npm run dev</code>, then reload this page.',
    );
    return;
  }

  renderHero();
  renderFilterOptions();
  renderAddOptions();
  renderLocations();
  syncControls();
  renderGrid();
}

// ---------- Hero ----------

function renderHero() {
  const available = state.units.filter(isAvailable);
  els.heroCount.textContent = `${number.format(available.length)} machines`;
  els.heroLede.textContent = `New and used equipment across ${state.dealerships.length} Midwest lots, with the hours and specs on every unit.`;

  const counts = countBy(available, (u) => u.category);
  els.directory.innerHTML = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => `
      <li>
        <button class="directory__link" type="button" data-category="${escapeHtml(category)}">
          <span class="directory__name">${escapeHtml(plural(category))}</span>
          <span class="directory__count" aria-label="${count} available">${count}</span>
        </button>
      </li>`)
    .join('');
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) map.set(keyFn(item), (map.get(keyFn(item)) ?? 0) + 1);
  return map;
}

// ---------- Filters ----------

function renderFilterOptions() {
  const categories = [...new Set(state.units.map((u) => u.category))].sort();
  els.category.innerHTML = '<option value="">All types</option>' + categories
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(plural(c))}</option>`).join('');

  els.location.innerHTML = '<option value="">All locations</option>' + state.dealerships
    .map((d) => `<option value="${d.id}">${escapeHtml(cityOf(d.name))}</option>`).join('');
}

function filteredUnits() {
  const { search, category, condition, location, sort, showSold } = state.filters;
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);

  const list = state.units.filter((u) => {
    if (!showSold && !isAvailable(u)) return false;
    if (category && u.category !== category) return false;
    if (condition && u.condition !== condition) return false;
    if (location && String(u.dealershipId) !== location) return false;
    if (terms.length) {
      const haystack = `${unitTitle(u)} ${u.category} ${u.serialNumber} ${cityOf(u.dealershipName)}`.toLowerCase();
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });

  const sorters = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    'hours-asc': (a, b) => (a.engineHours ?? 0) - (b.engineHours ?? 0),
    newest: (a, b) => b.id - a.id,
  };
  return list.sort(sorters[sort]);
}

function setFilter(changes) {
  Object.assign(state.filters, changes);
  state.page = 1;
  syncControls();
  renderGrid();
}

function syncControls() {
  const f = state.filters;
  if (document.activeElement !== els.searchInput) els.searchInput.value = f.search;
  if (document.activeElement !== els.filterSearch) els.filterSearch.value = f.search;
  els.category.value = f.category;
  els.location.value = f.location;
  els.sort.value = f.sort;
  els.showSold.checked = f.showSold;
  els.filters.querySelector(`input[name="condition"][value="${f.condition}"]`).checked = true;
  highlightLocation(f.location);
}

function clearFilters() {
  setFilter({ search: '', category: '', condition: '', location: '', showSold: false });
}

// ---------- Inventory grid ----------

function tagHtml(unit) {
  const off = !isAvailable(unit);
  const feature = featureText(unit);
  return `
    <li>
      <button class="tag${off ? ' tag--off' : ''}" type="button" data-id="${unit.id}">
        <span class="tag__condition tag__condition--${escapeHtml(unit.condition)}">${unit.condition === 'new' ? 'New' : 'Used'}</span>
        <span class="tag__title">${escapeHtml(unitTitle(unit))}</span>
        ${feature ? `<span class="tag__feature">${escapeHtml(feature)}</span>` : ''}
        <dl class="tag__specs">
          <dt>Hours</dt><dd>${number.format(unit.engineHours ?? 0)}</dd>
          <dt>Lot</dt><dd>${escapeHtml(cityOf(unit.dealershipName))}</dd>
          <dt>Serial</dt><dd>${escapeHtml(unit.serialNumber)}</dd>
        </dl>
        <span class="tag__price">${off ? statusLabel[unit.status] : money.format(unit.price)}</span>
      </button>
    </li>`;
}

function renderGrid() {
  const list = filteredUnits();
  const visible = list.slice(0, state.page * PAGE_SIZE);

  els.grid.innerHTML = visible.map(tagHtml).join('');
  els.resultCount.textContent = list.length === 1 ? '1 machine' : `${number.format(list.length)} machines`;
  els.showMore.hidden = visible.length >= list.length;

  if (list.length === 0) {
    showStatus(
      'No machines match these filters',
      'Try another location or condition, or include sold and leased units.',
      true,
    );
  } else {
    els.gridStatus.hidden = true;
  }
}

function showStatus(title, message, withClear = false) {
  els.gridStatus.hidden = false;
  els.gridStatus.innerHTML = `
    <strong>${title}</strong>
    <p>${message}</p>
    ${withClear ? '<button class="button button--ghost" type="button" data-action="clear">Clear filters</button>' : ''}`;
}

// ---------- Unit detail ----------

function openUnit(id) {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) return;
  const lot = state.dealerships.find((d) => d.id === unit.dealershipId);
  const off = !isAvailable(unit);
  const city = cityOf(unit.dealershipName);

  const specs = [
    ['Condition', unit.condition === 'new' ? 'New' : 'Used'],
    ['Engine hours', number.format(unit.engineHours ?? 0)],
    ...unit.features.map((f) => [f.feature, `${f.value} ${f.unit ?? ''}`.trim()]),
    ['Type', `${unit.category}, ${unit.subCategory}`],
    ['Serial number', unit.serialNumber],
    ['Stock number', `#${unit.id}`],
  ];

  els.dialogBody.innerHTML = `
    <article class="unit">
      <p class="unit__condition${off ? ' unit__condition--off' : ''}">
        ${off ? statusLabel[unit.status] : `${unit.condition === 'new' ? 'New' : 'Used'}, available now`}
      </p>
      <h2 id="unit-title">${escapeHtml(unitTitle(unit))}</h2>
      <p class="unit__price${off ? ' unit__price--off' : ''}">
        ${off ? `List price was ${money.format(unit.price)}` : money.format(unit.price)}
      </p>
      <dl class="unit__specs">
        ${specs.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}
      </dl>
      ${lot ? `
        <div class="unit__lot">
          <strong>Parked at our ${escapeHtml(city)} lot</strong>
          <p>${escapeHtml(lot.address)}</p>
        </div>
        <div class="unit__actions">
          ${lot.phone ? `<a class="button" href="tel:${escapeHtml(lot.phone)}">Call ${escapeHtml(city)} at ${escapeHtml(lot.phone)}</a>` : ''}
          <button class="button button--ghost" type="button" data-action="lot" data-lot="${lot.id}">See everything in ${escapeHtml(city)}</button>
        </div>` : ''}
      <div class="unit__manage" id="unit-manage">
        <button class="button button--quiet" type="button" data-action="ask-delete" data-id="${unit.id}">Delete this equipment</button>
      </div>
    </article>`;

  if (!els.dialog.open) els.dialog.showModal();
}

// ---------- Locations ----------

function renderLocations() {
  els.locationList.innerHTML = state.dealerships.map((d) => `
    <li>
      <button class="location" type="button" data-lot="${d.id}" aria-pressed="false">
        <span class="location__city">${escapeHtml(cityOf(d.name))}</span>
        <span class="location__units">${d.availableUnits} available</span>
        <span class="location__meta">${escapeHtml(d.address)}</span>
      </button>
      ${d.phone ? `<a class="location__phone" href="tel:${escapeHtml(d.phone)}">${escapeHtml(d.phone)}</a>` : ''}
    </li>`).join('');

  renderMap();
}

// Plots lots on a square-mile survey grid, scaled so longitude and latitude keep their real proportions
function renderMap() {
  const W = 600, H = 460, PAD = 60;
  const lats = state.dealerships.map((d) => d.latitude);
  const lngs = state.dealerships.map((d) => d.longitude);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);

  const spanX = (Math.max(...lngs) - Math.min(...lngs)) * kx || 1;
  const spanY = Math.max(...lats) - Math.min(...lats) || 1;
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const cx = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const cy = midLat;
  const project = (lat, lng) => [W / 2 + (lng - cx) * kx * scale, H / 2 - (lat - cy) * scale];

  let grid = '';
  for (let x = 0; x <= W; x += 20) grid += `<line class="${x % 120 === 0 ? 'township-line' : 'section-line'}" x1="${x}" y1="0" x2="${x}" y2="${H}" />`;
  for (let y = 0; y <= H; y += 20) grid += `<line class="${y % 120 === 0 ? 'township-line' : 'section-line'}" x1="0" y1="${y}" x2="${W}" y2="${y}" />`;

  const pins = state.dealerships.map((d) => {
    const [x, y] = project(d.latitude, d.longitude);
    const labelLeft = x > W - 160;
    return `
      <g class="pin" data-lot="${d.id}" tabindex="0" role="button" aria-label="Show inventory in ${escapeHtml(cityOf(d.name))}">
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" />
        <text x="${(x + (labelLeft ? -15 : 15)).toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="${labelLeft ? 'end' : 'start'}">${escapeHtml(cityOf(d.name))}</text>
      </g>`;
  }).join('');

  els.map.innerHTML = `<desc id="survey-desc">Dealership locations plotted by latitude and longitude across the Midwest.</desc>
    <g aria-hidden="true">${grid}</g>${pins}`;
}

function highlightLocation(lotId) {
  document.querySelectorAll('.location').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.lot === lotId)));
  document.querySelectorAll('.pin').forEach((el) => el.classList.toggle('is-active', el.dataset.lot === lotId));
}

function showLot(lotId) {
  setFilter({ location: String(lotId) });
  document.getElementById('inventory').scrollIntoView();
}

// ---------- Add and delete equipment ----------

const productLabel = (p) => {
  const feature = featureText(p);
  return `${unitTitle(p)}${feature ? `, ${feature}` : ''} (${money.format(p.price)})`;
};

function renderAddOptions() {
  const byCategory = new Map();
  for (const p of state.products) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category).push(p);
  }
  els.addProduct.innerHTML = [...byCategory].map(([category, products]) => `
    <optgroup label="${escapeHtml(plural(category))}">
      ${products.map((p) => `<option value="${p.id}">${escapeHtml(productLabel(p))}</option>`).join('')}
    </optgroup>`).join('');

  els.categoryOptions.innerHTML = [...byCategory.keys()]
    .map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');

  els.addLocation.innerHTML = state.dealerships
    .map((d) => `<option value="${d.id}">${escapeHtml(cityOf(d.name))}</option>`).join('');
}

function setProductMode(mode) {
  els.addForm.querySelectorAll('[data-mode]').forEach((el) => { el.hidden = el.dataset.mode !== mode; });
}

function openAdd() {
  els.addForm.reset();
  setProductMode('existing');
  els.addError.hidden = true;
  els.addForm.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  els.addDialog.showModal();
}

function showAddError(message, field) {
  els.addError.textContent = message;
  els.addError.hidden = false;
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }
}

async function submitAdd(e) {
  e.preventDefault();
  const form = new FormData(els.addForm);
  const get = (name) => String(form.get(name) ?? '').trim();
  const field = (name) => els.addForm.elements[name];
  const isNewProduct = get('productMode') === 'new';

  // Check the form before sending so people get specific messages next to the field
  if (isNewProduct && !get('category')) return showAddError('Enter a machine type, like Tractor.', field('category'));
  if (isNewProduct && !(Number(get('price')) > 0)) return showAddError('Enter a list price greater than 0.', field('price'));
  if (!isNewProduct && !get('productId')) return showAddError('Choose a model.', field('productId'));
  if (!get('serialNumber')) return showAddError('Enter the serial number from the machine plate.', field('serialNumber'));
  const hours = get('engineHours') === '' ? 0 : Number(get('engineHours'));
  if (!Number.isInteger(hours) || hours < 0) return showAddError('Engine hours must be a whole number of 0 or more.', field('engineHours'));

  const body = {
    serialNumber: get('serialNumber'),
    condition: get('condition'),
    engineHours: hours,
    dealershipId: Number(get('dealershipId')),
    ...(isNewProduct
      ? { category: get('category'), subCategory: get('subCategory') || null, price: Number(get('price')) }
      : { productId: Number(get('productId')) }),
  };

  const submit = els.addForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Adding…';
  try {
    const unit = await send('POST', '/api/equipments', body);
    els.addDialog.close();
    await load();
    toast(`Added ${unitTitle(unit)} (${unit.serialNumber}) to ${cityOf(unit.dealershipName)}`);
  } catch (err) {
    const serialTaken = /serial/i.test(err.message);
    showAddError(serialTaken ? 'That serial number is already in inventory.' : err.message, serialTaken ? field('serialNumber') : null);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Add equipment';
  }
}

function askDelete(id) {
  const unit = state.units.find((u) => u.id === id);
  document.getElementById('unit-manage').innerHTML = `
    <div class="confirm-delete">
      <p>Delete ${escapeHtml(unitTitle(unit))} ${escapeHtml(unit.serialNumber)}? It will be removed from inventory for good.</p>
      <p id="delete-error" class="form-error" role="alert" hidden></p>
      <div class="unit__actions">
        <button class="button button--danger" type="button" data-action="confirm-delete" data-id="${id}">Delete equipment</button>
        <button class="button button--ghost" type="button" data-action="keep" data-id="${id}">Keep it</button>
      </div>
    </div>`;
  document.querySelector('[data-action="keep"]').focus();
}

async function deleteUnit(id, button) {
  const unit = state.units.find((u) => u.id === id);
  button.disabled = true;
  button.textContent = 'Deleting…';
  try {
    await send('DELETE', `/api/equipments/${id}`);
    els.dialog.close();
    await load();
    toast(`Deleted ${unitTitle(unit)} (${unit.serialNumber})`);
  } catch (err) {
    const error = document.getElementById('delete-error');
    error.textContent = /sales or leases/.test(err.message)
      ? 'This unit has a sale or lease on record, so it can\'t be deleted.'
      : err.message;
    error.hidden = false;
    button.remove();
  }
}

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 4000);
}

// ---------- Events ----------

els.searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  setFilter({ search: els.searchInput.value.trim() });
  document.getElementById('inventory').scrollIntoView();
});

els.searchInput.addEventListener('input', () => {
  state.filters.search = els.searchInput.value.trim();
  state.page = 1;
  syncControls();
  renderGrid();
});

els.directory.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-category]');
  if (!btn) return;
  setFilter({ category: btn.dataset.category });
  document.getElementById('inventory').scrollIntoView();
});

els.filters.addEventListener('change', () => {
  setFilter({
    category: els.category.value,
    condition: els.filters.querySelector('input[name="condition"]:checked').value,
    location: els.location.value,
    sort: els.sort.value,
    showSold: els.showSold.checked,
  });
});

els.grid.addEventListener('click', (e) => {
  const tag = e.target.closest('.tag');
  if (tag) openUnit(Number(tag.dataset.id));
});

els.showMore.addEventListener('click', () => {
  state.page += 1;
  renderGrid();
});

els.gridStatus.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="clear"]')) clearFilters();
});

els.locationList.addEventListener('click', (e) => {
  const btn = e.target.closest('.location');
  if (btn) showLot(btn.dataset.lot);
});

els.map.addEventListener('click', (e) => {
  const pin = e.target.closest('.pin');
  if (pin) showLot(pin.dataset.lot);
});

els.map.addEventListener('keydown', (e) => {
  const pin = e.target.closest('.pin');
  if (pin && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    showLot(pin.dataset.lot);
  }
});

els.dialog.addEventListener('click', (e) => {
  if (e.target === els.dialog) els.dialog.close(); // click on the backdrop
  const lotBtn = e.target.closest('[data-action="lot"]');
  if (lotBtn) {
    els.dialog.close();
    showLot(lotBtn.dataset.lot);
  }

  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'ask-delete') askDelete(Number(e.target.closest('[data-id]').dataset.id));
  if (action === 'keep') openUnit(Number(e.target.closest('[data-id]').dataset.id));
  if (action === 'confirm-delete') deleteUnit(Number(e.target.closest('[data-id]').dataset.id), e.target.closest('button'));
});

els.filterSearch.addEventListener('input', () => {
  state.filters.search = els.filterSearch.value.trim();
  state.page = 1;
  syncControls();
  renderGrid();
});

els.addOpen.addEventListener('click', openAdd);

els.addForm.addEventListener('change', (e) => {
  if (e.target.name === 'productMode') setProductMode(e.target.value);
});

els.addForm.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));

els.addForm.addEventListener('submit', submitAdd);

els.addForm.querySelector('[data-action="cancel"]').addEventListener('click', () => els.addDialog.close());

els.addDialog.addEventListener('click', (e) => {
  if (e.target === els.addDialog) els.addDialog.close();
});

load();
