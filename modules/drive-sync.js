/* ===================================================================
   CRM MINI — DRIVE SYNC MODULE
   Tự động đồng bộ với Google Drive sử dụng Google Identity Services
   =================================================================== */

const DriveSyncModule = {
    CLIENT_ID: '614853663170-pn2v6ttidbdgnp7uthlakn47qpikf8gj.apps.googleusercontent.com',
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    SCOPES: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file',
    FILE_NAME: 'crm-mini-sync.json',
    
    tokenClient: null,
    gapiInited: false,
    gisInited: false,
    isAuthenticated: false,
    syncFileId: null,
    syncing: false,
    autoSyncInterval: null,
    lastSyncTime: null,

    async init() {
        console.log('Khởi tạo DriveSyncModule...');
        // Load API scripts
        await this.loadScripts();
    },

    async loadScripts() {
        // Load GAPI
        const gapiScript = document.createElement('script');
        gapiScript.src = 'https://apis.google.com/js/api.js';
        gapiScript.onload = () => this.gapiLoaded();
        document.body.appendChild(gapiScript);

        // Load GIS
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.onload = () => this.gisLoaded();
        document.body.appendChild(gisScript);
    },

    gapiLoaded() {
        gapi.load('client', this.initializeGapiClient.bind(this));
    },

    async initializeGapiClient() {
        try {
            await gapi.client.init({
                discoveryDocs: [this.DISCOVERY_DOC],
            });
            this.gapiInited = true;
            this.checkSetupReady();
        } catch (err) {
            console.error('Lỗi khởi tạo GAPI client:', err);
        }
    },

    gisLoaded() {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: '', // defined at request time
        });
        this.gisInited = true;
        this.checkSetupReady();
    },

    async checkSetupReady() {
        if (this.gapiInited && this.gisInited) {
            console.log('Google API đã sẵn sàng.');
            // Check if there's a stored token
            const storedToken = localStorage.getItem('google_access_token');
            if (storedToken) {
                const tokenData = JSON.parse(storedToken);
                // Simple expiry check
                if (tokenData.expires_at > Date.now()) {
                    gapi.client.setToken({ access_token: tokenData.access_token });
                    this.isAuthenticated = true;
                    this.updateUI();
                    await this.syncWithDrive();
                    this.startAutoSync();
                } else {
                    localStorage.removeItem('google_access_token');
                }
            }
            this.updateUI();
        }
    },

    handleAuthClick() {
        this.tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                throw (resp);
            }
            
            // Lịch sử token
            const tokenData = {
                access_token: resp.access_token,
                expires_at: Date.now() + (resp.expires_in * 1000)
            };
            localStorage.setItem('google_access_token', JSON.stringify(tokenData));
            
            this.isAuthenticated = true;
            this.updateUI();
            await this.syncWithDrive();
            this.startAutoSync();
        };

        if (gapi.client.getToken() === null) {
            this.tokenClient.requestAccessToken({prompt: 'select_account'});
        } else {
            this.tokenClient.requestAccessToken({prompt: ''});
        }
    },

    handleSignoutClick() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken('');
                localStorage.removeItem('google_access_token');
                this.isAuthenticated = false;
                this.syncFileId = null;
                this.stopAutoSync();
                this.updateUI();
            });
        }
    },

    updateUI() {
        const btnLogin = document.getElementById('btn-drive-login');
        const btnLogout = document.getElementById('btn-drive-logout');
        const statusText = document.getElementById('drive-sync-status');
        const syncNowBtn = document.getElementById('btn-drive-sync-now');

        if (this.isAuthenticated) {
            if(btnLogin) btnLogin.style.display = 'none';
            if(btnLogout) btnLogout.style.display = 'inline-flex';
            if(syncNowBtn) syncNowBtn.style.display = 'inline-flex';
            
            if(statusText) {
                statusText.innerHTML = '🟢 <span style="color:var(--color-success)">Đã kết nối Drive</span>';
                if(this.lastSyncTime) {
                    statusText.innerHTML += ` <span style="font-size:12px;color:var(--text-muted)">(${this.lastSyncTime})</span>`;
                }
            }
            
            const topStatus = document.getElementById('topbar-sync-status');
            if(topStatus) topStatus.innerHTML = '<span title="Đã kết nối Google Drive (Đồng bộ lần cuối: '+this.lastSyncTime+')" style="color:var(--color-success); font-size:1.2rem; cursor:pointer;" onclick="App.navigateTo(\'settings\')">☁️</span>';
        } else {
            if(btnLogin) btnLogin.style.display = 'inline-flex';
            if(btnLogout) btnLogout.style.display = 'none';
            if(syncNowBtn) syncNowBtn.style.display = 'none';
            
            if(statusText) statusText.innerHTML = '🔴 Chưa kết nối';
            const topStatus = document.getElementById('topbar-sync-status');
            if(topStatus) topStatus.innerHTML = '<span title="Chưa kết nối Google Drive" style="color:var(--text-muted); font-size:1.2rem; cursor:pointer;" onclick="App.navigateTo(\'settings\')">☁️</span>';
        }
    },

    startAutoSync() {
        if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);
        // Sync every 5 minutes (300000 ms)
        this.autoSyncInterval = setInterval(() => {
            this.syncWithDrive();
        }, 300000);
    },

    stopAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }
    },

    async syncWithDrive() {
        if (!this.isAuthenticated || this.syncing) return;
        this.syncing = true;
        
        try {
            const statusText = document.getElementById('drive-sync-status');
            if(statusText) statusText.innerHTML = '🟡 <span style="color:var(--color-warning)">Đang đồng bộ...</span>';
            const topStatus = document.getElementById('topbar-sync-status');
            if(topStatus) topStatus.innerHTML = '<span title="Đang đồng bộ..." style="color:var(--color-warning); font-size:1.2rem; cursor:pointer; animation: pulse 1s infinite alternate;" onclick="App.navigateTo(\'settings\')">☁️</span>';
            
            // 1. Tìm hoặc tạo file
            if (!this.syncFileId) {
                const response = await gapi.client.drive.files.list({
                    q: `name='${this.FILE_NAME}' and trashed=false`,
                    fields: 'files(id, name, modifiedTime)',
                    spaces: 'drive'
                });
                
                const files = response.result.files;
                if (files && files.length > 0) {
                    this.syncFileId = files[0].id;
                } else {
                    // Tạo file mới
                    const metadata = {
                        name: this.FILE_NAME,
                        mimeType: 'application/json'
                    };
                    
                    const fileBody = JSON.stringify(await DB.exportAllData());
                    
                    const file = new Blob([fileBody], {type: 'application/json'});
                    
                    const form = new FormData();
                    form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
                    form.append('file', file);

                    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                        method: 'POST',
                        headers: new Headers({'Authorization': 'Bearer ' + gapi.client.getToken().access_token}),
                        body: form
                    });
                    const resJson = await res.json();
                    this.syncFileId = resJson.id;
                    
                    this.syncing = false;
                    this.lastSyncTime = new Date().toLocaleTimeString('vi-VN');
                    this.updateUI();
                    return;
                }
            }

            // 2. Download nội dung file từ Drive
            const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${this.syncFileId}?alt=media`, {
                method: 'GET',
                headers: new Headers({'Authorization': 'Bearer ' + gapi.client.getToken().access_token}),
            });
            
            if (!fileRes.ok) throw new Error('Không thể tải file từ Drive');
            
            let driveData;
            try {
                driveData = await fileRes.json();
            } catch (e) {
                console.error("Lỗi parse JSON từ Drive, sẽ upload file mới.", e);
                driveData = { version: '1.0' };
            }

            // 3. Lấy dữ liệu Local
            const localData = await DB.exportAllData();

            // 4. Merge dữ liệu (Timestamp-based)
            const mergedData = this.mergeData(localData, driveData);

            // 5. Cập nhật lại vào Local Database
            await this.updateLocalDatabase(mergedData);
            
            // 6. Upload file đã merge lên Drive
            const updatedFileContent = JSON.stringify(mergedData);
            const metadata = { name: this.FILE_NAME, mimeType: 'application/json' };
            
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
            form.append('file', new Blob([updatedFileContent], {type: 'application/json'}));

            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${this.syncFileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: new Headers({'Authorization': 'Bearer ' + gapi.client.getToken().access_token}),
                body: form
            });

            this.lastSyncTime = new Date().toLocaleTimeString('vi-VN');
            
            // Refresh UI nếu đang ở trang có hiển thị dữ liệu
            if (typeof App !== 'undefined' && App.currentPage) {
                App.navigateTo(App.currentPage, false);
            }

        } catch (err) {
            console.error('Lỗi đồng bộ:', err);
            Utils.showToast('Lỗi đồng bộ Google Drive: ' + err.message, 'error');
            const statusText = document.getElementById('drive-sync-status');
            if(statusText) statusText.innerHTML = '🔴 <span style="color:var(--color-danger)">Lỗi đồng bộ</span>';
        } finally {
            this.syncing = false;
            this.updateUI();
        }
    },

    mergeData(localData, driveData) {
        const merged = {
            version: '1.0',
            exported_at: new Date().toISOString()
        };

        const mergeTable = (tableName) => {
            const localList = localData[tableName] || [];
            const driveList = driveData[tableName] || [];
            
            const localMap = new Map(localList.map(i => [i.id, i]));
            const driveMap = new Map(driveList.map(i => [i.id, i]));
            
            const allIds = new Set([...localMap.keys(), ...driveMap.keys()]);
            const resultList = [];
            
            for (const id of allIds) {
                const localItem = localMap.get(id);
                const driveItem = driveMap.get(id);
                
                if (localItem && driveItem) {
                    // Compare updated_at
                    const localTime = new Date(localItem.updated_at || localItem.created_at || 0).getTime();
                    const driveTime = new Date(driveItem.updated_at || driveItem.created_at || 0).getTime();
                    
                    if (localTime > driveTime) {
                        resultList.push(localItem);
                    } else {
                        resultList.push(driveItem);
                    }
                } else if (localItem) {
                    resultList.push(localItem);
                } else if (driveItem) {
                    resultList.push(driveItem);
                }
            }
            return resultList;
        };

        merged.customers = mergeTable('customers');
        merged.products = mergeTable('products');
        merged.orders = mergeTable('orders');
        merged.care_logs = mergeTable('care_logs');
        merged.message_templates = mergeTable('message_templates');
        merged.appointments = mergeTable('appointments');
        merged.settings = mergeTable('settings');
        merged.backup_logs = mergeTable('backup_logs');

        return merged;
    },

    async updateLocalDatabase(mergedData) {
        // Bulk put
        if (mergedData.customers) await DB.db.customers.bulkPut(mergedData.customers);
        if (mergedData.products) await DB.db.products.bulkPut(mergedData.products);
        if (mergedData.orders) await DB.db.orders.bulkPut(mergedData.orders);
        if (mergedData.care_logs) await DB.db.care_logs.bulkPut(mergedData.care_logs);
        if (mergedData.message_templates) await DB.db.message_templates.bulkPut(mergedData.message_templates);
        if (mergedData.appointments) await DB.db.appointments.bulkPut(mergedData.appointments);
        if (mergedData.settings) await DB.db.settings.bulkPut(mergedData.settings);
        if (mergedData.backup_logs) await DB.db.backup_logs.bulkPut(mergedData.backup_logs);
    }
};
