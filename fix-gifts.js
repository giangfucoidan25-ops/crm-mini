// CHẠY SCRIPT NÀY TRONG CONSOLE F12 (KHÔNG ĐƯỢC TẢI LẠI TRANG NẾU CHƯA LƯU DỮ LIỆU)

(async function fixAndPushData() {
    console.log("🚀 Bắt đầu sửa dữ liệu và đẩy lên Supabase...");
    try {
        // 1. Lấy toàn bộ dữ liệu từ IndexedDB (tránh mất dữ liệu nếu tải lại trang)
        const orders = await DB.db.orders.toArray();
        const customers = await DB.db.customers.toArray();
        
        let fixedOrders = 0;
        
        // 2. Sửa lỗi Promotions cho đơn hàng Tháng 7
        for (let order of orders) {
            if (order.order_date && (order.order_date.includes('2026-07') || order.order_date.includes('2024-07'))) {
                let totalAmount = Number(order.total_amount) || 0;
                let mainProductId = order.product_id;
                
                if (mainProductId === 1 && totalAmount > 0) {
                    // Cấu hình Nutri Nano
                    const promoConfigs = [
                        { price: 630000, buy: 1, get: 0 },
                        { price: 1260000, buy: 2, get: 0 },
                        { price: 1890000, buy: 3, get: 1 },
                        { price: 2520000, buy: 4, get: 2 },
                        { price: 3150000, buy: 5, get: 2 },
                        { price: 3780000, buy: 6, get: 3 },
                        { price: 4410000, buy: 7, get: 4 },
                        { price: 5040000, buy: 8, get: 5 },
                        { price: 7560000, buy: 12, get: 8 }
                    ];
                    
                    let buy = 0, get = 0;
                    for (let p of promoConfigs) {
                        if (p.price === totalAmount) {
                            buy = p.buy; get = p.get; break;
                        }
                    }
                    if (buy === 0) buy = Math.floor(totalAmount / 630000);
                    
                    // Giữ lại các sản phẩm phụ (Đông trùng hạ thảo, v.v.)
                    let newItems = (order.items || []).filter(i => i.product_id !== 1);
                    
                    if (buy > 0) newItems.push({ product_id: 1, product_name: "Nutri Nano Fucoidan", quantity: buy, unit_price: 630000, is_gift: false });
                    if (get > 0) newItems.push({ product_id: 1, product_name: "Nutri Nano Fucoidan", quantity: get, unit_price: 0, is_gift: true });
                    
                    order.items = newItems;
                    order.quantity = buy + get;
                    
                    await DB.db.orders.put(order);
                    fixedOrders++;
                }
            }
        }
        console.log(`✅ Đã sửa khuyến mãi cho ${fixedOrders} đơn hàng.`);

        // 3. Đẩy dữ liệu Khách hàng lên Supabase (Fix lỗi Date "")
        console.log("☁️ Đang đẩy Khách hàng lên Supabase...");
        for (let c of customers) {
            // Fix lỗi ngày tháng rỗng
            const dateFields = ['last_contact_date','next_care_date','last_order_date','last_completed_order_date','estimated_product_end_date','created_at','updated_at'];
            for (let k of dateFields) {
                if (c[k] === "" || c[k] === "NaN") c[k] = null;
            }
            if (c.id > 161) { // Chỉ đẩy các khách hàng mới (ID > 161)
                await SupabaseSync.push('customers', c);
            }
        }
        
        // 4. Đẩy dữ liệu Đơn hàng lên Supabase (Fix lỗi Date "")
        console.log("☁️ Đang đẩy Đơn hàng lên Supabase...");
        for (let o of orders) {
            const dateFields = ['order_date','estimated_product_end_date','created_at','updated_at'];
            for (let k of dateFields) {
                if (o[k] === "" || o[k] === "NaN") o[k] = null;
            }
            if (o.id > 170) { // Chỉ đẩy các đơn mới
                await SupabaseSync.push('orders', o);
            }
        }

        console.log("🎉 HOÀN TẤT! Dữ liệu đã được sửa và đẩy lên Supabase an toàn. Bây giờ bạn có thể tải lại trang.");
        alert("Đã sửa và đồng bộ xong! Bạn có thể tải lại trang (F5).");
        
    } catch (err) {
        console.error("Lỗi:", err);
        alert("Có lỗi xảy ra: " + err.message);
    }
})();
