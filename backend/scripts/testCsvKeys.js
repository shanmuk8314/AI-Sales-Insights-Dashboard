const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const filePath = path.join(__dirname, '../../scratch/sample_sales.csv');

const makeKey = (date, product, region, unitsSold, revenue) => {
  const d = new Date(date);
  const time = isNaN(d.getTime()) ? 0 : d.getTime();
  return `${time}_${product.trim().toLowerCase()}_${region.trim().toLowerCase()}_${unitsSold}_${parseFloat(revenue).toFixed(2)}`;
};

const salesToInsert = [];

fs.createReadStream(filePath)
  .pipe(csv())
  .on('data', (row) => {
    const dateVal = row.date || row.Date || row.DATE || row.DateOfSale;
    const productVal = row.product || row.Product || row.PRODUCT;
    const categoryVal = row.category || row.Category || row.CATEGORY;
    const regionVal = row.region || row.Region || row.REGION;
    
    const unitsSoldStr = row.unitsSold || row.UnitsSold || row.units_sold || row.Units_Sold || row.UNITS_SOLD;
    const unitPriceStr = row.unitPrice || row.UnitPrice || row.unit_price || row.Unit_Price || row.UNIT_PRICE;

    const unitsSoldVal = parseInt(unitsSoldStr, 10);
    const unitPriceVal = parseFloat(unitPriceStr);

    if (dateVal && productVal && categoryVal && regionVal && !isNaN(unitsSoldVal) && !isNaN(unitPriceVal)) {
      const calculatedRevenue = unitsSoldVal * unitPriceVal;
      salesToInsert.push({
        date: new Date(dateVal),
        product: productVal.trim(),
        category: categoryVal.trim(),
        region: regionVal.trim(),
        unitsSold: unitsSoldVal,
        unitPrice: unitPriceVal,
        revenue: calculatedRevenue
      });
    }
  })
  .on('end', () => {
    console.log('CSV Keys:');
    salesToInsert.slice(0, 5).forEach(sale => {
      console.log('Raw CSV Date:', sale.date, typeof sale.date);
      const key = makeKey(sale.date, sale.product, sale.region, sale.unitsSold, sale.revenue);
      console.log('Key:', key);
    });
  });
