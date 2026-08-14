const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json'));
const customers = db.customers;
const utilsStr = fs.readFileSync('modules/utils.js', 'utf8');
let window = {}; let document = {createElement: () => ({innerHTML: ''})};
eval(utilsStr);
for (let c of customers) {
    try {
        Utils.getCareStatus(c, {m1:1, m2:7, m3:22, cycle:30});
    } catch(e) { console.log('Error on getCareStatus customer', c.id, e.message); }
    try {
        Utils.getProductExpiryStatus(c.estimated_product_end_date);
    } catch(e) { console.log('Error on getProductExpiryStatus customer', c.id, e.message); }
}
console.log('Test completed');
