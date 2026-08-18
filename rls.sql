-- Cấp quyền cho user đã đăng nhập được phép XEM, THÊM, SỬA, XÓA trên tất cả các bảng
CREATE POLICY "Allow ALL for authenticated users on customers" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL for authenticated users on products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL for authenticated users on orders" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL for authenticated users on care_logs" ON care_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL for authenticated users on appointments" ON appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow ALL for authenticated users on message_templates" ON message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
