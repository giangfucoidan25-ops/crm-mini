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
                if (typeof App.updateTopbarUI === 'function') App.updateTopbarUI();
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
            const dateFields = ['care_date','created_at','updated_at','last_contact_date','next_care_date','last_order_date','last_completed_order_date','estimated_product_end_date','order_date','appointment_date'];
            for (const key in cleanData) {
                if (key.includes('.')) {
                    delete cleanData[key];
                } else if (dateFields.includes(key)) {
                    if (cleanData[key] === '' || cleanData[key] === null || cleanData[key] === undefined || cleanData[key] === 'NaN') {
                        cleanData[key] = null;
                    }
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
            if(topStatus) topStatus.innerHTML = '<span title="Lỗi đồng bộ" style="color:var(--color-danger);">�
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


