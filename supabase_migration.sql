-- 1. Xóa toàn bộ dữ liệu rác cũ trên Supabase
TRUNCATE TABLE customers, products, orders, care_logs, message_templates, appointments CASCADE;

-- 2. Tạm thời xóa các ràng buộc khóa ngoại (Foreign Keys) để tránh lỗi xung đột kiểu dữ liệu
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE care_logs DROP CONSTRAINT IF EXISTS care_logs_customer_id_fkey;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_customer_id_fkey;

-- 3. Đổi kiểu dữ liệu cột id từ số (int) sang chuỗi UUID cho tất cả các bảng chính
ALTER TABLE customers ALTER COLUMN id DROP DEFAULT, ALTER COLUMN id TYPE uuid USING (gen_random_uuid());
ALTER TABLE products ALTER COLUMN id DROP DEFAULT, ALTER COLUMN id TYPE uuid USING (gen_random_uuid());
ALTER TABLE orders ALTER COLUMN id DROP DEFAULT, ALTER COLUMN id TYPE uuid USING (gen_random_uuid());
ALTER TABLE care_logs ALTER COLUMN id DROP DEFAULT, ALTER COLUMN id TYPE uuid USING (gen_random_uuid());
ALTER TABLE message_templates ALTER COLUMN id DROP DEFAULT, ALTER COLUMN id TYPE uuid USING (gen_random_uuid());
ALTER TABLE appointments ALTER COLUMN id DROP DEFAULT, ALTER COLUMN id TYPE uuid USING (gen_random_uuid());

-- 4. Đổi kiểu dữ liệu các cột khóa ngoại (foreign keys) sang UUID
ALTER TABLE orders ALTER COLUMN customer_id TYPE uuid USING NULL;
ALTER TABLE orders ALTER COLUMN product_id TYPE uuid USING NULL;
ALTER TABLE care_logs ALTER COLUMN customer_id TYPE uuid USING NULL;
ALTER TABLE appointments ALTER COLUMN customer_id TYPE uuid USING NULL;

-- 5. Khôi phục lại các ràng buộc khóa ngoại để bảo vệ dữ liệu
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE care_logs ADD CONSTRAINT care_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
