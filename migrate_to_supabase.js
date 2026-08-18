const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// 1. Cấu hình kết nối Supabase
const supabaseUrl = 'https://ltpjtweotwmrgbvyqrgz.supabase.co';
const supabaseKey = 'sb_publishable_S0SDh2mxC4Q27bX5bsH8MA_Pd3XJhzR';
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Đọc file database.json cục bộ
console.log('Đang đọc file database.json...');
const rawData = fs.readFileSync('database.json', 'utf8');
const db = JSON.parse(rawData);

// 3. Hàm đẩy dữ liệu theo từng gói nhỏ (Batch) để tránh lỗi quá tải
async function insertInBatches(tableName, dataArray, batchSize = 100) {
  if (!dataArray || dataArray.length === 0) {
    console.log(`Bảng ${tableName} không có dữ liệu, bỏ qua.`);
    return;
  }

  console.log(`\nBắt đầu đẩy ${dataArray.length} dòng lên bảng ${tableName}...`);
  
  for (let i = 0; i < dataArray.length; i += batchSize) {
    const batch = dataArray.slice(i, i + batchSize);
    
    // Đẩy dữ liệu
    const { error } = await supabase.from(tableName).insert(batch);
    
    if (error) {
      console.error(`Lỗi khi đẩy dữ liệu vào ${tableName} (từ dòng ${i}):`, error);
      // Dừng lại nếu lỗi để tránh rác database
      process.exit(1);
    }
    
    console.log(`- Đã đẩy thành công dòng ${i} đến ${i + batch.length - 1}`);
  }
  
  console.log(`✅ Hoàn thành bảng ${tableName}!`);
}

// 4. Chạy toàn bộ quá trình
async function migrate() {
  try {
    console.log('--- BẮT ĐẦU CHUYỂN DỮ LIỆU LÊN SUPABASE ---');

    // Phải tuân thủ thứ tự: Bảng độc lập trước, Bảng phụ thuộc (Foreign Key) sau
    await insertInBatches('customers', db.customers);
    await insertInBatches('products', db.products);
    
    // Các bảng phụ thuộc vào customer_id và product_id
    await insertInBatches('orders', db.orders);
    await insertInBatches('care_logs', db.care_logs);
    await insertInBatches('appointments', db.appointments);
    
    await insertInBatches('message_templates', db.message_templates);
    
    console.log('\n🎉 CHÚC MỪNG! TOÀN BỘ DỮ LIỆU ĐÃ LÊN ĐÁM MÂY THÀNH CÔNG!');
  } catch (err) {
    console.error('Lỗi hệ thống trong quá trình đẩy:', err);
  }
}

migrate();
