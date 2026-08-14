const fs = require('fs');

const appJsPath = 'app.js';
let appJs = fs.readFileSync(appJsPath, 'utf8');

const v8JsonPath = 'v8.json';
const newLogs = JSON.parse(fs.readFileSync(v8JsonPath, 'utf8'));

// Replace the V7 block
const startMarker = `const hhExcelFixedV7 = localStorage.getItem('hh_excel_fixed_v7');`;
const endMarker = `console.log('Fixed Hương Hoàng logs directly (V7)');\n                    }`;

const startIndex = appJs.indexOf(startMarker);
const endIndex = appJs.indexOf(endMarker) + endMarker.length;

if (startIndex !== -1 && endIndex !== -1) {
    const jsBlock = `const hhExcelFixedV8 = localStorage.getItem('hh_excel_fixed_v8');
                    if (!hhExcelFixedV8) {
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
                                    created_at: item.created_at
                                });
                            }
                        }
                        localStorage.setItem('hh_excel_fixed_v8', 'done');
                        console.log('Fixed Hương Hoàng logs directly (V8)');
                    }`;
    appJs = appJs.substring(0, startIndex) + jsBlock + appJs.substring(endIndex);
    fs.writeFileSync(appJsPath, appJs, 'utf8');
    console.log('Successfully injected V8 code into app.js');
    console.log(`Total logs: ${newLogs.length}`);
    newLogs.forEach((l, i) => console.log(`  ${i+1}. ${l.created_at} | ${l.note.substring(0, 50)}...`));
} else {
    console.log('Could not find V7 injection markers in app.js');
    console.log(`startIndex: ${startIndex}, endIndex: ${endIndex}`);
}
