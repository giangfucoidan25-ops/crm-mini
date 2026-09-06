const fs = require('fs');
const data = JSON.parse(fs.readFileSync('database.json', 'utf8'));

data.customers.forEach(c => {
    if (c.full_name && c.full_name.includes('Vân')) {
        console.log('Customer:', c.full_name, c.id);
        data.orders.filter(o => o.customer_id === c.id).forEach(o => {
            console.log('  Order ID:', o.id, 'product_name:', o.product_name, 'product_id:', o.product_id, 'items:', JSON.stringify(o.items));
        });
    }
});
