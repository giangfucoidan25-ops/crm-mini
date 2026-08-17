-- ==============================================================================
-- BẢN VÁ BẢO MẬT: BẬT ROW LEVEL SECURITY (RLS)
-- Chạy đoạn mã này trong Supabase SQL Editor để khóa chặt cơ sở dữ liệu, 
-- ngăn chặn tin tặc truy cập trái phép qua API public.
-- ==============================================================================

-- 1. Bật RLS cho tất cả các bảng
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 2. Xóa các policy cũ (nếu có) để tránh xung đột
DROP POLICY IF EXISTS "Allow authenticated users to read and write customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated users to read and write products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users to read and write orders" ON orders;
DROP POLICY IF EXISTS "Allow authenticated users to read and write care_logs" ON care_logs;
DROP POLICY IF EXISTS "Allow authenticated users to read and write message_templates" ON message_templates;
DROP POLICY IF EXISTS "Allow authenticated users to read and write appointments" ON appointments;

-- 3. Tạo Policy mới: CHỈ CHO PHÉP người dùng đã đăng nhập (authenticated) truy cập và chỉnh sửa
CREATE POLICY "Allow authenticated users to read and write customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read and write products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read and write orders" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read and write care_logs" ON care_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read and write message_templates" ON message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read and write appointments" ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LƯU Ý: Những người truy cập bằng quyền 'anon' (Khách chưa đăng nhập) sẽ hoàn toàn bị chặn!
