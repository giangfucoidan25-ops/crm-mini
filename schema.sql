-- Tắt RLS để quá trình đẩy dữ liệu ban đầu không bị chặn
-- Bảng khách hàng
CREATE TABLE IF NOT EXISTS customers (
    id bigint PRIMARY KEY,
    full_name text,
    phone text,
    zalo_phone text,
    email text,
    address text,
    customer_source text,
    status text,
    tags text,
    note text,
    last_contact_date date,
    next_care_date date,
    care_cycle_days integer,
    created_at timestamptz,
    updated_at timestamptz,
    total_revenue numeric,
    total_orders integer,
    priority_score numeric,
    overdue_status boolean,
    transferred_status boolean,
    last_order_date date,
    last_product_used text,
    keyword_category text,
    last_completed_order_date date,
    getfly_url text,
    stopped_status boolean,
    estimated_product_end_date date,
    special_note text,
    product_expiries jsonb,
    recall_status boolean,
    manual_stopped boolean
);

-- Bảng sản phẩm
CREATE TABLE IF NOT EXISTS products (
    id bigint PRIMARY KEY,
    product_name text,
    product_category text,
    price numeric,
    unit_name text,
    quantity_per_unit integer,
    unit_type text,
    default_usage_per_day numeric,
    inner_unit text,
    dosage_per_day text,
    usage_cycle_days integer,
    reorder_reminder_days integer,
    usage_instruction text,
    description text,
    note text,
    updated_at timestamptz
);

-- Bảng đơn hàng
CREATE TABLE IF NOT EXISTS orders (
    id bigint PRIMARY KEY,
    customer_id bigint REFERENCES customers(id) ON DELETE CASCADE,
    product_id bigint REFERENCES products(id),
    product_name text,
    order_date date,
    quantity integer,
    unit_price numeric,
    discount numeric,
    total_amount numeric,
    order_status text,
    estimated_product_end_date date,
    cancel_reason text,
    note text,
    created_at timestamptz,
    updated_at timestamptz
);

-- Bảng lịch sử chăm sóc
CREATE TABLE IF NOT EXISTS care_logs (
    id bigint PRIMARY KEY,
    customer_id bigint REFERENCES customers(id) ON DELETE CASCADE,
    care_date date,
    care_type text,
    note text,
    created_at timestamptz
);

-- Bảng mẫu tin nhắn
CREATE TABLE IF NOT EXISTS message_templates (
    id bigint PRIMARY KEY,
    template_name text,
    content text,
    created_at timestamptz
);

-- Bảng lịch hẹn
CREATE TABLE IF NOT EXISTS appointments (
    id bigint PRIMARY KEY,
    customer_id bigint REFERENCES customers(id) ON DELETE CASCADE,
    appointment_date date,
    note text,
    status text,
    created_at timestamptz
);

-- Cấp quyền ẩn danh (anon) có thể Read/Insert trong lúc di chuyển dữ liệu
-- (Chỉ dùng tạm thời, sau khi chuyển xong bạn nên cấu hình lại RLS)
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE care_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
