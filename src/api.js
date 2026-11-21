const express = require('express');
const router = express.Router();

// AI generated data
const equipments = [
  { id: 1,  brand: 'John Deere', model: '6R 145',        category: 'Tractor',              series: '6R',     year: 2023, horsepower: 145, engineHours: 420,  price: 189500, condition: 'used', status: 'available', location: 'Des Moines, IA',  serialNumber: '1RW6145RCPD000101' },
  { id: 2,  brand: 'John Deere', model: '8R 410',        category: 'Tractor',              series: '8R',     year: 2024, horsepower: 410, engineHours: 35,   price: 512000, condition: 'new',  status: 'available', location: 'Moline, IL',      serialNumber: '1RW8410RJRD000102' },
  { id: 3,  brand: 'John Deere', model: '9RX 640',       category: 'Tractor',              series: '9R',     year: 2022, horsepower: 640, engineHours: 1850, price: 615000, condition: 'used', status: 'sold',      location: 'Fargo, ND',       serialNumber: '1RW9640RXND000103' },
  { id: 4,  brand: 'John Deere', model: '5075E',         category: 'Tractor',              series: '5E',     year: 2024, horsepower: 75,  engineHours: 12,   price: 54900,  condition: 'new',  status: 'available', location: 'Lubbock, TX',     serialNumber: '1PY5075EARD000104' },
  { id: 5,  brand: 'John Deere', model: '1025R',         category: 'Compact Tractor',      series: '1',      year: 2023, horsepower: 24,  engineHours: 210,  price: 21500,  condition: 'used', status: 'available', location: 'Raleigh, NC',     serialNumber: '1LV1025RCPJ000105' },
  { id: 6,  brand: 'John Deere', model: 'S780',          category: 'Combine',              series: 'S',      year: 2023, horsepower: 473, engineHours: 980,  price: 498000, condition: 'used', status: 'reserved',  location: 'Lincoln, NE',     serialNumber: '1H0S780SCP0000106' },
  { id: 7,  brand: 'John Deere', model: 'X9 1100',       category: 'Combine',              series: 'X9',     year: 2024, horsepower: 690, engineHours: 60,   price: 989000, condition: 'new',  status: 'available', location: 'Moline, IL',      serialNumber: '1H0X911CER0000107' },
  { id: 8,  brand: 'John Deere', model: '9900',          category: 'Self-Propelled Forage Harvester', series: '9000', year: 2022, horsepower: 970, engineHours: 1320, price: 720000, condition: 'used', status: 'maintenance', location: 'Madison, WI', serialNumber: '1Z09900SCNM000108' },
  { id: 9,  brand: 'John Deere', model: 'R4038',         category: 'Sprayer',              series: 'R4',     year: 2023, horsepower: 400, engineHours: 640,  price: 545000, condition: 'used', status: 'available', location: 'Champaign, IL',   serialNumber: '1N04038RTPR000109' },
  { id: 10, brand: 'John Deere', model: '1775NT ExactEmerge', category: 'Planter',         series: '1700',   year: 2024, horsepower: null, engineHours: null, price: 312000, condition: 'new', status: 'available', location: 'Des Moines, IA', serialNumber: '1A01775NTRE000110' },
  { id: 11, brand: 'John Deere', model: '333G',          category: 'Compact Track Loader', series: 'G',      year: 2023, horsepower: 100, engineHours: 760,  price: 98500,  condition: 'used', status: 'available', location: 'Denver, CO',      serialNumber: '1T0333GMCPF000111' },
  { id: 12, brand: 'John Deere', model: '310 SL',        category: 'Backhoe Loader',       series: 'L',      year: 2022, horsepower: 100, engineHours: 2100, price: 109000, condition: 'used', status: 'sold',      location: 'Phoenix, AZ',     serialNumber: '1T0310SLCNC000112' },
  { id: 13, brand: 'John Deere', model: '850K',          category: 'Crawler Dozer',        series: 'K',      year: 2021, horsepower: 205, engineHours: 3400, price: 265000, condition: 'used', status: 'available', location: 'Houston, TX',     serialNumber: '1T0850KXCMF000113' },
  { id: 14, brand: 'John Deere', model: '210 P-Tier',    category: 'Excavator',            series: 'P-Tier', year: 2024, horsepower: 159, engineHours: 90,   price: 238000, condition: 'new',  status: 'reserved',  location: 'Atlanta, GA',     serialNumber: '1FF210PXERD000114' },
  { id: 15, brand: 'John Deere', model: 'Gator XUV835M', category: 'Utility Vehicle',      series: 'Gator',  year: 2024, horsepower: 54,  engineHours: 25,   price: 22800,  condition: 'new',  status: 'available', location: 'Boise, ID',       serialNumber: '1M0835MCERM000115' },
  { id: 16, brand: 'John Deere', model: 'X350',          category: 'Lawn Tractor',         series: 'X300',   year: 2023, horsepower: 18,  engineHours: 55,   price: 3299,   condition: 'used', status: 'available', location: 'Columbus, OH',    serialNumber: '1GXX350ECPK000116' },
  { id: 17, brand: 'John Deere', model: 'Z530M ZTrak',   category: 'Zero-Turn Mower',      series: 'Z500',   year: 2024, horsepower: 22,  engineHours: 8,    price: 5899,   condition: 'new',  status: 'available', location: 'Nashville, TN',   serialNumber: '1TC530MERM0000117' },
  { id: 18, brand: 'John Deere', model: '560M',          category: 'Round Baler',          series: 'M',      year: 2022, horsepower: null, engineHours: null, price: 58500, condition: 'used', status: 'maintenance', location: 'Billings, MT', serialNumber: '1E0560MXCNK000118' },
];

router.get('/equipments', (req, res) => {
  const formattedEquipments = equipments.map(item => ({
    brand: item.brand,
    model: item.model,
    category: item.category,
    series: item.series,
    year: item.year,
    horsepower: item.horsepower,
    engineHours: item.engineHours,
    price: item.price,
    condition: item.condition,
    status: item.status,
    location: item.location,
    serialNumber: item.serialNumber
  }));

  res.status(200).send(formattedEquipments);
});
router.get('/equipments/:id', (req,res) => {
  const {id} = req.params;
  const index = equipments.find((item) => String (item.id) === id);
  const data = {
    brand: index.brand,
    model: index.model,
    category: index.category,
    series: index.series,
    year: index.year,
    horsepower: index.horsepower,
    engineHours: index.engineHours,
    price: index.price,
    condition: index.condition,
    status: index.status,
    location: index.location,
    serialNumber: index.serialNumber
  }
  res.status(200).send(data);
});  


module.exports = router;
