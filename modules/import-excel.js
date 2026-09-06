/* ===================================================================
   CRM MINI - IMPORT EXCEL MODULE
   Handle manual file upload and auto Google Drive sync
   =================================================================== */

const ImportExcelModule = {
    init() {
        this.bindEvents();
        this.startAutoSyncTimer();
    },

    bindEvents() {
        const btnManual = document.getElementById('btn-import-excel-manual');
        if (btnManual) {
            btnManual.addEventListener('click', () => this.handleManualImport());
        }

        const btnDrive = document.getElementById('btn-import-drive-scan');
        if (btnDrive) {
            btnDrive.addEventListener('click', () => this.handleDriveImport());
        }

        const autoSwitch = document.getElementById('import-drive-auto');
        if (autoSwitch) {
            const isAuto = localStorage.getItem('drive_sync_auto') === 'true';
            autoSwitch.checked = isAuto;
            
            const savedUrl = localStorage.getItem('drive_sync_url');
            if (savedUrl) {
                document.getElementById('import-drive-url').value = savedUrl;
            }

            autoSwitch.addEventListener('change', (e) => {
                localStorage.setItem('drive_sync_auto', e.target.checked);
                this.startAutoSyncTimer();
            });
        }
    },

    log(message, type = 'info') {
        const container = document.getElementById('import-log-container');
        if (!container) return;
        
        // Xóa placeholder
        if (container.innerText.includes('Chưa có hoạt động nào')) {
            container.innerHTML = '';
        }

        const color = type === 'error' ? 'var(--color-danger)' : 
                      type === 'success' ? 'var(--color-success)' : 'var(--text-main)';
                      
        const time = new Date().toLocaleTimeString();
        const p = document.createElement('div');
        p.style.color = color;
        p.style.marginBottom = '4px';
        p.innerHTML = `[${time}] ${message}`;
        
        container.appendChild(p);
        container.scrollTop = container.scrollHeight;
    },

    startAutoSyncTimer() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        
        const isAuto = localStorage.getItem('drive_sync_auto') === 'true';
        if (isAuto) {
            // 30 minutes = 30 * 60 * 1000 = 1800000 ms
            this.syncInterval = setInterval(() => {
                this.log('⏰ Chạy quét tự động từ Google Drive...', 'info');
                this.handleDriveImport(true);
            }, 1800000);
            this.log('✅ Đã bật tự động quét mỗi 30 phút.', 'success');
        } else {
            this.log('⏸️ Đã tắt tự động quét.', 'info');
        }
    },

    async handleManualImport() {
        const fileInput = document.getElementById('excel-file-input');
        if (!fileInput.files || fileInput.files.length === 0) {
            Utils.showToast('Vui lòng chọn file Excel', 'error');
            return;
        }

        const file = fileInput.files[0];
        this.log(`Bắt đầu đọc file: ${file.name}`);
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, {type: 'array'});
                await this.processWorkbook(workbook);
            } catch (err) {
                this.log('Lỗi khi đọc file: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    async handleDriveImport(isAuto = false) {
        const urlInput = document.getElementById('import-drive-url');
        const url = urlInput.value.trim();
        
        if (!url) {
            if (!isAuto) Utils.showToast('Vui lòng dán link Google Drive', 'error');
            return;
        }

        localStorage.setItem('drive_sync_url', url);
        this.log('Đang kết nối tới Google Drive...');
        
        const btn = document.getElementById('btn-import-drive-scan');
        if (btn) {
            btn.disabled = true;
            btn.innerText = 'Đang quét...';
        }

        try {
            // Gửi link cho server.py để server tải và parse giùm (vượt CORS)
            const response = await fetch(`/api/fetch-drive-excel?url=${encodeURIComponent(url)}`);
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Lỗi mạng hoặc API');
            }
            
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            
            this.log(`Tải file thành công. Có ${result.data.length} dòng dữ liệu.`);
            await this.processJsonData(result.data);
            
        } catch (e) {
            this.log('Lỗi quét Drive: ' + e.message, 'error');
            console.error(e);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = '🔍 Quét Ngay';
            }
        }
    },

    async processWorkbook(workbook) {
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = window.XLSX.utils.sheet_to_json(sheet, {defval: ''});
        
        if (json.length === 0) {
            this.log('File Excel trống.', 'error');
            return;
        }
        
        await this.processJsonData(json);
    },

    async processJsonData(rows) {
        let addedCustomers = 0;
        let addedOrders = 0;
        let affectedCustomerIds = new Set();
        
        const productsMap = {};
        const allProducts = await DB.db.products.toArray();
        allProducts.forEach(p => productsMap[p.product_name.toLowerCase()] = p);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Xử lý key (strip whitespace, lowercase) để dễ map với cột
            const cleanRow = {};
            for (let key in row) {
                cleanRow[key.trim().toLowerCase()] = row[key];
            }

            const rawPhone = cleanRow['số điện thoại'];
            if (!rawPhone) continue; // Bỏ qua dòng trống SĐT
            
            const phone = Utils.formatPhone(String(rawPhone));
            if (!phone) continue;

            const name = cleanRow['tên khách hàng'] || 'Khách hàng';
            const address = cleanRow['địa chỉ'] || '';
            const orderDate = this.parseDate(cleanRow['ngày đặt hàng'] || new Date().toISOString().split('T')[0]);
            const productName = cleanRow['sản phẩm'] || '';
            const buyQty = parseInt(cleanRow['số lượng mua']) || 0;
            const giftQty = parseInt(cleanRow['số lượng tặng']) || 0;
            const totalMoney = parseInt(String(cleanRow['tổng tiền']).replace(/\D/g, '')) || 0;
            const status = cleanRow['trạng thái đơn'] || 'Đang giao';
            const note = cleanRow['ghi chú chăm sóc'] || '';

            // 1. Kiểm tra khách hàng
            let customer = await DB.db.customers.where('phone').equals(phone).first();
            
            let isNewCustomer = false;
            if (!customer) {
                customer = {
                    full_name: name,
                    phone: phone,
                    zalo_phone: phone,
                    customer_source: 'import',
                    status: 'Đang chăm sóc',
                    tags: address ? [address] : [],
                    created_at: new Date().toISOString(),
                    total_revenue: 0,
                    priority_score: 0
                };
                const cid = await DB.db.customers.add(customer);
                customer.id = cid;
                addedCustomers++;
                isNewCustomer = true;
                this.log(`+ Đã tạo KH mới: ${name} (${phone})`);
            } else {
                // Chỉ cập nhật nếu là KH cũ (như tags)
                if (address && (!customer.tags || !customer.tags.includes(address))) {
                    customer.tags = customer.tags || [];
                    customer.tags.push(address);
                    await DB.db.customers.put(customer);
                }
            }
            affectedCustomerIds.add(customer.id);

            // 2. Kiểm tra xem đơn hàng này đã tồn tại chưa để tránh lặp
            if (buyQty > 0 || totalMoney > 0) {
                const existingOrders = await DB.db.orders.where('customer_id').equals(customer.id).toArray();
                let isDuplicate = false;
                for (let o of existingOrders) {
                    // Cùng ngày và cùng tổng tiền -> coi là trùng lặp
                    if (o.order_date === orderDate && o.total_amount === totalMoney) {
                        isDuplicate = true;
                        break;
                    }
                }

                if (!isDuplicate) {
                    // Lấy Product ID
                    let prodId = null;
                    if (productName) {
                        const pname = productName.toLowerCase().trim();
                        if (productsMap[pname]) {
                            prodId = productsMap[pname].id;
                        } else {
                            // Tạo product tạm
                            prodId = await DB.db.products.add({
                                product_name: productName,
                                product_category: 'Khác',
                                price: 0,
                                active_status: 1,
                                created_at: new Date().toISOString()
                            });
                            productsMap[pname] = {id: prodId, product_name: productName};
                        }
                    }

                    await DB.db.orders.add({
                        customer_id: customer.id,
                        product_id: prodId,
                        order_date: orderDate,
                        order_status: status,
                        total_amount: totalMoney,
                        quantity: buyQty, // Save quantity if schema has it, or just in memory
                        created_at: new Date().toISOString()
                    });
                    addedOrders++;
                    this.log(`  -> Đã thêm 1 đơn hàng cho KH ${name} (${totalMoney}đ)`);
                }
            }

            // 3. Thêm ghi chú
            if (note) {
                // Kiểm tra ghi chú trùng (cùng ngày)
                const existingLogs = await DB.db.care_logs.where('customer_id').equals(customer.id).toArray();
                const noteDate = new Date().toISOString().split('T')[0];
                const isDupNote = existingLogs.some(l => l.care_type === note && l.care_date.startsWith(noteDate));
                
                if (!isDupNote) {
                    await DB.db.care_logs.add({
                        customer_id: customer.id,
                        care_date: new Date().toISOString(),
                        care_type: note,
                        created_at: new Date().toISOString()
                    });
                }
            }
        }

        this.log(`Đang tính toán lại điểm số cho ${affectedCustomerIds.size} khách hàng...`);
        // Recalculate stats
        for (let cid of affectedCustomerIds) {
            await DB.recalculateCustomerStats(cid, true);
        }

        // LƯU NGAY VÀO database.json TRÊN MÁY
        this.log('💾 Đang lưu dữ liệu vào database.json trên máy...', 'info');
        await DB.saveToServer();
        this.log('✅ Đã lưu thành công vào database.json trên máy!', 'success');

        this.log(`🎉 HOÀN TẤT! Đã tạo mới ${addedCustomers} KH, thêm ${addedOrders} đơn hàng.`, 'success');
        
        // KÍCH HOẠT SUPABASE PUSH TOÀN BỘ KH ĐÃ BỊ ẢNH HƯỞNG
        if (SupabaseSync.isConnected) {
            this.log('Đang đẩy dữ liệu lên Cloud...', 'info');
            // Cập nhật timestamp để Auto-Sync catch được
            const now = new Date().toISOString();
            localStorage.setItem('last_pushed_timestamp', now);

            // Fetch affected customers
            const idsArr = Array.from(affectedCustomerIds);
            const customersToPush = await DB.db.customers.where('id').anyOf(idsArr).toArray();
            const ordersToPush = await DB.db.orders.where('customer_id').anyOf(idsArr).toArray();
            const logsToPush = await DB.db.care_logs.where('customer_id').anyOf(idsArr).toArray();
            
            try {
                if (customersToPush.length) await SupabaseSync.client.from('customers').upsert(customersToPush);
                if (ordersToPush.length) await SupabaseSync.client.from('orders').upsert(ordersToPush);
                if (logsToPush.length) await SupabaseSync.client.from('care_logs').upsert(logsToPush);
                this.log('☁️ Đã đồng bộ lên Cloud thành công!', 'success');
            } catch(e) {
                this.log('Lỗi đồng bộ Cloud: ' + e.message, 'error');
            }
        }
    },

    // Helper: chuyển đổi format ngày từ excel/chuỗi sang YYYY-MM-DD
    parseDate(value) {
        if (!value) return new Date().toISOString().split('T')[0];
        // Nếu là số seri của Excel
        if (!isNaN(value) && typeof value === 'number') {
            const date = new Date(Math.round((value - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }
        // Nếu là DD/MM/YYYY
        if (typeof value === 'string' && value.includes('/')) {
            const parts = value.split('/');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        return value;
    }
};

// Auto init when script loads
document.addEventListener('DOMContentLoaded', () => {
    ImportExcelModule.init();
});
