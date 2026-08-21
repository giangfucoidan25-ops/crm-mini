/* ===================================================================
   CRM MINI — SUPABASE SYNC MODULE
   Quản lý đăng nhập và đồng bộ 2 chiều với Supabase
   =================================================================== */

const SupabaseConfig = {
    URL: 'https://ltpjtweotwmrgbvyqrgz.supabase.co',
    KEY: 'sb_publishable_S0SDh2mxC4Q27bX5bsH8MA_Pd3XJhzR'
};

const SupabaseSync = {
    client: null,
    session: null,
    isConnected: false,

    async init() {
        if (!window.supabase) {
            console.error('Supabase library not loaded!');
            return;
        }

        this.client = window.supabase.createClient(SupabaseConfig.URL, SupabaseConfig.KEY);
        
        // Kiểm tra session hiện tại
        const { data: { session }, error } = await this.client.auth.getSession();
        
        if (error || !session) {
            this.showLoginUI();
        } else {
            this.session = session;
            this.isConnected = true;
            this.hideLoginUI();
            this.startAppSync();
        }

        // Lắng nghe thay đổi trạng thái đăng nhập
        this.client.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                this.session = session;
                this.isConnected = true;
                this.hideLoginUI();
                this.startAppSync();
            } else if (event === 'SIGNED_OUT') {
                this.session = null;
                this.isConnected = false;
                this.showLoginUI();
            }
        });
    },

    showLoginUI() {
        // Tạo giao diện đăng nhập nếu chưa có
        if (!document.getElementById('supabase-login-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'supabase-login-overlay';
            overlay.innerHTML = `
                <div class="login-box">
                    <h2>Đăng Nhập Hệ Thống</h2>
                    <p>Vui lòng đăng nhập để đồng bộ dữ liệu an toàn từ Supabase</p>
                    <form id="supabase-login-form">
                        <input type="email" id="login-email" placeholder="Email" required autocomplete="username">
                        <input type="password" id="login-password" placeholder="Mật khẩu" required autocomplete="current-password">
                        <div id="login-error" style="color:var(--color-danger); display:none; margin-bottom:10px; font-size:14px;"></div>
                        <button type="submit" id="login-btn" class="btn btn-primary" style="width:100%; justify-content:center;">Đăng Nhập</button>
                    </form>
                </div>
            `;
            document.body.appendChild(overlay);

            // CSS cho form login
            const style = document.createElement('style');
            style.textContent = `
                #supabase-login-overlay {
                    position: fixed; top:0; left:0; width:100%; height:100%;
                    background: var(--bg-body, #f4f7fe);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 999999;
                }
                .login-box {
                    background: var(--bg-card, white);
                    padding: 40px; border-radius: 16px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    width: 100%; max-width: 400px;
                    text-align: center;
                }
                .login-box h2 { margin-bottom: 10px; color: var(--text-main, #333); }
                .login-box p { margin-bottom: 25px; color: var(--text-muted, #777); font-size: 14px; }
                .login-box input {
                    width: 100%; padding: 12px 15px; margin-bottom: 15px;
                    border: 1px solid var(--border-color, #ddd);
                    border-radius: 8px; font-size: 15px;
                    background: var(--bg-input, white);
                    color: var(--text-main, #333);
                }
            `;
            document.head.appendChild(style);

            document.getElementById('supabase-login-form').addEventListener('submit', (e) => this.handleLogin(e));
        }

        document.getElementById('supabase-login-overlay').style.display = 'flex';
        const loading = document.getElementById('loading-screen');
        if (loading) loading.style.display = 'none';
        const app = document.getElementById('app');
        if (app) app.style.display = 'none';
    },

    hideLoginUI() {
        const overlay = document.getElementById('supabase-login-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        const errObj = document.getElementById('login-error');
        
        btn.disabled = true;
        btn.innerText = 'Đang đăng nhập...';
        errObj.style.display = 'none';

        const { data, error } = await this.client.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            errObj.innerText = 'Sai email hoặc mật khẩu!';
            errObj.style.display = 'block';
            btn.disabled = false;
            btn.innerText = 'Đăng nhập';
        }
    },

    async handleLogout() {
        await this.client.auth.signOut();
        // Clear local DB to ensure security when logged out
        await DB.db.delete();
        window.location.reload();
    },

    // ==========================================
    // CƠ CHẾ PULL (Kéo dữ liệu từ Cloud -> Local)
    // ==========================================
    async startAppSync() {
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.style.display = 'flex';
            document.getElementById('loading-text').innerText = 'Đang tải dữ liệu từ đám mây...';
        }

        try {
            this.isSyncing = true;
            // Kéo dữ liệu các bảng chính
            await this.pullTable('customers');
            await this.pullTable('products');
            await this.pullTable('orders');
            await this.pullTable('care_logs');
            await this.pullTable('appointments');
            await this.pullTable('message_templates');

            console.log('✅ Pull from Supabase completed!');
        } catch (e) {
            console.error('Lỗi khi pull từ Supabase:', e);
            Utils.showToast('Không thể tải dữ liệu mới từ đám mây', 'error');
        } finally {
            this.isSyncing = false;
        }

        if (loading) loading.style.display = 'none';
        const app = document.getElementById('app');
        if (app) app.style.display = 'flex';

        // Gọi App.init nếu chưa khởi tạo, hoặc refresh view nếu đã khởi tạo
        if (typeof App !== 'undefined') {
            if (App.isInitialized) {
                App.navigateTo(App.currentPage || 'dashboard', false);
                this.updateTopbarUI();
            } else {
                App.init();
            }
        }
    },

    async pullTable(tableName) {
        let allData = [];
        let from = 0;
        const step = 1000;
        let fetchMore = true;

        while (fetchMore) {
            const { data, error } = await this.client
                .from(tableName)
                .select('*')
                .range(from, from + step - 1);
            
            if (error) {
                console.error(`Lỗi tải bảng ${tableName}:`, error);
                break;
            }
            if (data && data.length > 0) {
                allData = allData.concat(data);
                from += step;
                if (data.length < step) fetchMore = false;
            } else {
                fetchMore = false;
            }
        }

        if (allData.length > 0) {
            await DB.db[tableName].clear();
            await DB.db[tableName].bulkPut(allData);
        }
    },

    // ==========================================
    // CƠ CHẾ PUSH (Đẩy dữ liệu từ Local -> Cloud)
    // ==========================================
    async push(tableName, dataObj) {
        if (!this.isConnected || this.isSyncing) return;
        
        try {
            const topStatus = document.getElementById('topbar-sync-status');
            if(topStatus) topStatus.innerHTML = '<span title="Đang đồng bộ lên đám mây..." style="color:var(--color-warning); animation: pulse 1s infinite alternate;">☁️ Đang lưu...</span>';

            // SANITIZE: Xóa tất cả các key có chứa dấu chấm (do Dexie hoặc lỗi cũ để lại)
            // PostgREST sẽ báo lỗi nếu có key chứa dấu chấm ở root level.
            const cleanData = { ...dataObj };
            for (const key in cleanData) {
                if (key.includes('.')) {
                    delete cleanData[key];
                }
            }

            const { error } = await this.client.from(tableName).upsert(cleanData);
            
            if (error) throw error;

            if(topStatus) topStatus.innerHTML = '<span title="Đã đồng bộ an toàn" style="color:var(--color-success);">☁️ Đã lưu mây</span>';
        } catch (e) {
            console.error(`Lỗi đồng bộ lên ${tableName}:`, e);
            const errMsg = e.message || e.details || 'Lỗi không xác định';
            
            // DEBUG CHUYÊN GIA: Hiển thị popup chi tiết chính xác dữ liệu nào gây lỗi
            if (errMsg.includes('Could not find the') || errMsg.includes('column')) {
                alert(`[DEBUG CHUYÊN GIA]\nLỗi Supabase khi lưu bảng ${tableName}:\n${errMsg}\n\nDữ liệu đang cố gửi:\n${JSON.stringify(cleanData, null, 2)}\n\nHãy chụp ảnh màn hình bảng này gửi cho AI!`);
            } else {
                Utils.showToast(`Lỗi đồng bộ đám mây: ${errMsg}`, 'error');
            }
            
            const topStatus = document.getElementById('topbar-sync-status');
            if(topStatus) topStatus.innerHTML = '<span title="Lỗi đồng bộ" style="color:var(--color-danger);">☁️ Lỗi</span>';
        }
    },

    async remove(tableName, id) {
        if (!this.isConnected || this.isSyncing) return;
        try {
            await this.client.from(tableName).delete().eq('id', id);
        } catch (e) {
            console.error(`Lỗi xóa dữ liệu trên đám mây (${tableName}):`, e);
        }
    },

    async forcePushDatabaseJson() {
        if (!confirm('Bạn có chắc chắn muốn đẩy dữ liệu từ database.json lên Supabase? Quá trình này sẽ mất một lúc.')) return;
        
        try {
            Utils.showToast('Đang đọc database.json...', 'info');
            const response = await fetch('./database.json?t=' + new Date().getTime());
            const db = await response.json();
            
            // Whitelist: chỉ giữ lại các cột có trong schema Supabase
            const allowedColumns = {
                customers: ['id','full_name','phone','zalo_phone','email','address','customer_source','status','tags','note','last_contact_date','next_care_date','care_cycle_days','created_at','updated_at','total_revenue','total_orders','priority_score','overdue_status','transferred_status','last_order_date','last_product_used','keyword_category','last_completed_order_date','getfly_url','stopped_status','estimated_product_end_date','special_note','product_expiries','recall_status','manual_stopped'],
                products: ['id','product_name','product_category','price','unit_name','quantity_per_unit','unit_type','default_usage_per_day','inner_unit','dosage_per_day','usage_cycle_days','reorder_reminder_days','usage_instruction','description','note','updated_at'],
                orders: ['id','customer_id','product_id','product_name','order_date','quantity','unit_price','discount','total_amount','order_status','estimated_product_end_date','cancel_reason','note','created_at','updated_at'],
                care_logs: ['id','customer_id','care_date','care_type','note','created_at'],
                appointments: ['id','customer_id','appointment_date','note','status','created_at']
            };

            // Danh sách các trường kiểu ngày cần kiểm tra
            const dateFields = ['care_date','created_at','updated_at','last_contact_date','next_care_date','last_order_date','last_completed_order_date','estimated_product_end_date','order_date','appointment_date'];
            // Danh sách các trường kiểu số
            const numericFields = ['total_revenue','total_orders','priority_score','price','quantity','unit_price','discount','total_amount','quantity_per_unit','default_usage_per_day','usage_cycle_days','reorder_reminder_days','care_cycle_days'];
            // Danh sách các trường kiểu boolean
            const boolFields = ['overdue_status','transferred_status','stopped_status','recall_status','manual_stopped'];
            
            // Hàm sửa ngày bị đảo tháng/ngày (vd: 2025-23-08 → 2025-08-23)
            // + chuyển chuỗi rỗng thành null
            const fixDate = (val) => {
                if (val === null || val === undefined || val === '') return null;
                if (typeof val !== 'string') return val;
                const trimmed = val.trim();
                if (trimmed === '' || trimmed === 'NaN' || trimmed === 'null' || trimmed === 'undefined') return null;
                const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (!m) return null; // Không đúng format ngày → null
                let [, year, month, day] = m;
                let mo = parseInt(month), dy = parseInt(day);
                if (mo > 12 && dy <= 12) {
                    [mo, dy] = [dy, mo]; // Hoán đổi tháng/ngày
                }
                if (mo < 1 || mo > 12 || dy < 1 || dy > 31) return null;
                const fixed = `${year}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
                return trimmed.replace(/^\d{4}-\d{2}-\d{2}/, fixed);
            };
            
            // Hàm làm sạch giá trị theo kiểu dữ liệu
            const sanitizeValue = (key, val) => {
                if (dateFields.includes(key)) return fixDate(val);
                if (numericFields.includes(key)) {
                    if (val === '' || val === null || val === undefined || val === 'NaN') return null;
                    const n = Number(val);
                    return isNaN(n) ? null : n;
                }
                if (boolFields.includes(key)) {
                    if (val === '' || val === null || val === undefined) return null;
                    return !!val;
                }
                return val;
            };

            const tables = ['customers', 'products', 'orders', 'care_logs', 'appointments'];
            
            for (const table of tables) {
                if (db[table] && db[table].length > 0) {
                    const cols = allowedColumns[table];
                    Utils.showToast(`Đang đẩy ${db[table].length} bản ghi lên bảng ${table}...`, 'info');
                    
                    for (let i = 0; i < db[table].length; i += 100) {
                        const batch = db[table].slice(i, i + 100);
                        const cleanBatch = batch.map(dataObj => {
                            const cleanData = {};
                            for (const key of cols) {
                                if (dataObj[key] !== undefined) {
                                    cleanData[key] = sanitizeValue(key, dataObj[key]);
                                }
                            }
                            return cleanData;
                        });
                        
                        const { error } = await this.client.from(table).upsert(cleanBatch);
                        if (error) {
                            console.error(`Error pushing to ${table}:`, error);
                            Utils.showToast(`Lỗi khi đẩy bảng ${table}: ${error.message}`, 'error');
                            return;
                        }
                    }
                    Utils.showToast(`✅ Đã đẩy xong bảng ${table} (${db[table].length} bản ghi)`, 'success');
                }
            }
            
            Utils.showToast('🎉 Đã đẩy toàn bộ dữ liệu thành công! Đang tải lại...', 'success', 3000);
            setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
            console.error('Lỗi khi đẩy dữ liệu:', err);
            Utils.showToast('Lỗi: ' + err.message, 'error');
        }
    },

    updateSyncStatus(status) {
        const topStatus = document.getElementById('topbar-sync-status');
        if (topStatus) {
            topStatus.innerHTML = '<span title="Đã kết nối Supabase" style="color:var(--color-success);">☁️ Đã lưu mây</span>';
        }
        
        // Gắn nút đăng xuất
        const userProfile = document.querySelector('.user-profile');
        if (userProfile && !document.getElementById('btn-logout')) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'btn-logout';
            logoutBtn.className = 'btn btn-outline';
            logoutBtn.style.marginLeft = '10px';
            logoutBtn.innerText = 'Đăng xuất';
            logoutBtn.onclick = () => this.handleLogout();
            userProfile.appendChild(logoutBtn);
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    // Override window.DriveSyncModule để không sinh lỗi do code cũ gọi
    window.DriveSyncModule = {
        isConnected: true,
        triggerAutoSync: () => {} 
    };
});
