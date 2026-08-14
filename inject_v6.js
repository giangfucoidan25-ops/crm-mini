const fs = require('fs');

const appJsPath = 'app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

const v3JsonPath = 'v3.json';
const newLogs = JSON.parse(fs.readFileSync(v3JsonPath, 'utf8'));

// The exact string to replace
const startMarker = `console.log(\`Đã đồng bộ doanh số. Chuẩn hóa \${updatedPhones} SĐT.\`);`;
const startIndex = appJs.indexOf(startMarker);

if (startIndex !== -1) {
    const jsBlock = `
                    const hhExcelFixedV6 = localStorage.getItem('hh_excel_fixed_v6');
                    if (!hhExcelFixedV6) {
                        let hhCustomer = await DB.db.customers.where('phone').equals('0984757580').first();
                        if (hhCustomer) {
                            const logs = await DB.db.care_logs.where('customer_id').equals(hhCustomer.id).toArray();
                            for (let log of logs) { await DB.db.care_logs.delete(log.id); }
                            const newLogs = ${JSON.stringify(newLogs, null, 4)};
                            for (let item of newLogs) {
                                await DB.db.care_logs.add({
                                    customer_id: hhCustomer.id,
                                    care_date: item.date,
                                    care_type: "Khác",
                                    note: item.note,
                                    created_at: new Date().toISOString()
                                });
                            }
                        }
                        localStorage.setItem('hh_excel_fixed_v6', 'done');
                        console.log('Fixed Hương Hoàng logs directly (V6)');
                    }`;
    appJs = appJs.substring(0, startIndex + startMarker.length) + jsBlock + appJs.substring(startIndex + startMarker.length);
    fs.writeFileSync(appJsPath, appJs, 'utf8');
    console.log('Successfully injected V6 code into app.js');
} else {
    console.log('Could not find injection markers in app.js');
}
