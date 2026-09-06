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
            console.log('Chưa đăng nhập Supabase, hệ thống đang dùng CSDL Local máy (database.json).');
            const topStatus = document.getElementById('topbar-sync-status');
            if (topStatus) {
                topStatus.innerHTML = '<span title="Đang dùng CSDL Local máy (database.json). Click để đăng nhập Cloud" style="color:var(--color-success); font-size:1.1rem; cursor:pointer;" onclick="SupabaseSync.showLoginUI()">💻 CSDL Máy</span>';
            }
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

        console.log('Bắt đầu đồng bộ ngầm từ Supabase...');

        try {

            this.isSyncing = true;

            // Kéo dữ liệu các bảng chính (Chạy nền)

            await Promise.all([

                this.pullTable('customers'),

                this.pullTable('products'),

                this.pullTable('orders'),

                this.pullTable('care_logs'),

                this.pullTable('appointments'),

                this.pullTable('message_templates')

            ]);

            

            console.log('✅ Pull from Supabase completed!');

            

            // Kích hoạt Realtime sau khi Pull xong
            this.subscribeToRealtime();
            
            // Refresh UI sau khi có dữ liệu mới từ Cloud
            if (window.App && typeof App.handleRoute === 'function') {
                console.log('🔄 Đang làm mới giao diện sau khi đồng bộ Cloud...');
                App.handleRoute();
            }

        } catch (e) {

            console.error('Lỗi khi pull từ Supabase:', e);

            Utils.showToast('Không thể tải dữ liệu mới từ đám mây', 'error');

        } finally {

            this.isSyncing = false;

        }



        // Refresh lại view nếu app đã chạy

        if (typeof App !== 'undefined' && App.isInitialized) {

            App.navigateTo(App.currentPage || 'dashboard', false);

            if (typeof App.updateTopbarUI === 'function') App.updateTopbarUI();

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
            await DB.db[tableName].bulkPut(allData);
        }
    },

    async pushAllToSupabase() {
        if (!confirm('Hành động này sẽ đẩy toàn bộ dữ liệu máy tính hiện tại lên Supabase Cloud. Bạn có chắc chắn?')) return;
        
        try {
            const topStatus = document.getElementById('topbar-sync-status');
            if (topStatus) topStatus.innerHTML = '<span style="color:var(--color-warning);">Đang đẩy dữ liệu lên mây...</span>';
            
            const tables = ['customers', 'products', 'orders', 'care_logs', 'appointments', 'message_templates'];
            for (const table of tables) {
                const data = await DB.db[table].toArray();
                if (data.length > 0) {
                    // Thu thập tất cả các keys có thể có trong bảng này để tránh lỗi PGRST102 (All object keys must match)
                    const allKeys = new Set();
                    data.forEach(obj => Object.keys(obj).forEach(k => {
                        if (!k.includes('.')) allKeys.add(k);
                    }));

                    // Sanitize
                    const cleanDataList = data.map(obj => {
                        const cleanData = {};
                        allKeys.forEach(key => {
                            let val = obj[key];
                            const dateFields = ['care_date','created_at','updated_at','last_contact_date','next_care_date','last_order_date','last_completed_order_date','estimated_product_end_date','order_date','appointment_date'];
                            
                            if (val === undefined || val === '' || val === 'NaN') {
                                cleanData[key] = null;
                            } else if (dateFields.includes(key) && (val === null || val === '')) {
                                cleanData[key] = null;
                            } else {
                                cleanData[key] = val;
                            }
                        });
                        return cleanData;
                    });
                    
                    // Batch push (Supabase upsert accepts arrays)
                    const { error } = await this.client.from(table).upsert(cleanDataList);
                    if (error) throw error;
                    console.log(`Đã đẩy ${data.length} bản ghi lên bảng ${table}`);
                }
            }
            
            Utils.showToast('✅ Đã khôi phục toàn bộ dữ liệu lên Cloud thành công!', 'success');
            if (topStatus) topStatus.innerHTML = '<span style="color:var(--color-success);">☁️ Đã lưu mây</span>';
        } catch(e) {
            console.error('Lỗi đẩy dữ liệu:', e);
            Utils.showToast('Lỗi khi khôi phục dữ liệu lên Cloud!', 'error');
        }
    },



    // ==========================================

    // CƠ CHẾ REALTIME (Nhận thay đổi lập tức)

    // ==========================================

    subscribeToRealtime() {

        if (this.realtimeChannel) {

            this.client.removeChannel(this.realtimeChannel);

        }

        

        this.realtimeChannel = this.client.channel('public-db-changes')

            .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {

                const table = payload.table;

                const record = payload.new;

                

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {

                    if (record) {

                        this.isSyncing = true; // Chặn hook bắn ngược lại

                        await DB.db[table].put(record);

                        this.isSyncing = false;

                        

                        // Cập nhật lại UI nếu cần

                        if (typeof App !== 'undefined' && App.isInitialized) {

                            App.navigateTo(App.currentPage || 'dashboard', false);

                        }

                    }

                } else if (payload.eventType === 'DELETE') {

                    const oldRecord = payload.old;

                    if (oldRecord && oldRecord.id) {

                        this.isSyncing = true;

                        await DB.db[table].delete(oldRecord.id);

                        this.isSyncing = false;

                        if (typeof App !== 'undefined' && App.isInitialized) {

                            App.navigateTo(App.currentPage || 'dashboard', false);

                        }

                    }

                }

            })

            .subscribe();

            

        console.log('📡 Đã kích hoạt kết nối Realtime với Supabase!');

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
            if (topStatus) topStatus.innerHTML = '<span title="Lỗi đồng bộ" style="color:var(--color-danger);">⚠️ Lỗi</span>';
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





