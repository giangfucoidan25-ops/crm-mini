/* ===================================================================
   CRM MINI — BACKUP MODULE
   Export, Import dữ liệu JSON, lịch sử backup
   =================================================================== */

const BackupModule = {
    async render() {
        await this.renderHistory();
        this.updateDataCounts();
    },

    async renderHistory() {
        const logs = await DB.getBackupLogs();
        const container = document.getElementById('backup-history-list');

        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = '<p class="empty-state" style="padding:var(--space-4) 0;">Chưa có lịch sử sao lưu</p>';
            return;
        }

        container.innerHTML = logs.slice(0, 10).map(l => `
            <div class="backup-history-item">
                <div>
                    <div class="backup-history-date">${Utils.formatDateTime(l.backup_date)}</div>
                    <div class="backup-history-size">${l.action === 'export' ? 'Xuất' : 'Nhập'} dữ liệu • ${l.file_size || '—'}</div>
                </div>
                <div style="color:${l.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}">
                    ${l.status === 'success' ? 'Thành công' : 'Thất bại'}
                </div>
            </div>
        `).join('');
    },

    async updateDataCounts() {
        const customers = await DB.db.customers.count();
        const orders = await DB.db.orders.count();
        const products = await DB.db.products.count();

        const infoDiv = document.getElementById('backup-data-info');
        if (infoDiv) {
            infoDiv.innerHTML = `
            <strong>Dữ liệu hiện tại:</strong><br>
            • ${customers} khách hàng<br>
            • ${orders} đơn hàng<br>
            • ${products} sản phẩm
        `;
        }
    },

    async exportData() {
        try {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('loading-text').textContent = 'Đang chuẩn bị dữ liệu...';

            const data = await DB.exportAllData();
            const jsonString = JSON.stringify(data, null, 2);

            const sizeInBytes = new Blob([jsonString]).size;
            const sizeInKb = (sizeInBytes / 1024).toFixed(2) + ' KB';

            const filename = `crm-mini-backup-${Utils.today()}.json`;
            Utils.downloadFile(jsonString, filename);

            await DB.addBackupLog({
                action: 'export',
                status: 'success',
                file_size: sizeInKb,
                details: `Đã xuất ${data.customers.length} KH, ${data.orders.length} ĐH`
            });

            Utils.showToast('Xuất dữ liệu thành công!', 'success');
            this.renderHistory();
        } catch (err) {
            console.error(err);
            await DB.addBackupLog({ action: 'export', status: 'error', details: err.message });
            Utils.showToast('Lỗi khi xuất dữ liệu: ' + err.message, 'error');
        } finally {
            document.getElementById('loading-screen').classList.add('hidden');
        }
    },

    async triggerImport() {
        document.getElementById('restore-file-input').click();
    },

    async handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        event.target.value = ''; // Reset input

        const ok = await Utils.confirm(
            'CẢNH BÁO NHẬP DỮ LIỆU',
            `Bạn đang khôi phục từ file "${file.name}". Toàn bộ dữ liệu hiện tại sẽ bị XÓA và THAY THẾ bằng dữ liệu trong file này. Bạn có chắc chắn không?`,
            '⚠️'
        );

        if (!ok) return;

        try {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('loading-text').textContent = 'Đang đọc và khôi phục dữ liệu...';

            const jsonString = await Utils.readFile(file);
            const data = JSON.parse(jsonString);

            if (!data.version || !data.exported_at) {
                throw new Error('File không đúng định dạng backup của CRM Mini');
            }

            await DB.importAllData(data);

            const sizeInKb = (file.size / 1024).toFixed(2) + ' KB';
            await DB.addBackupLog({
                action: 'import',
                status: 'success',
                file_size: sizeInKb,
                details: `Đã nhập từ file ${file.name}`
            });

            Utils.showToast('Khôi phục dữ liệu thành công!', 'success');
            setTimeout(() => location.reload(), 1500); // Reload app
        } catch (err) {
            console.error(err);
            await DB.addBackupLog({ action: 'import', status: 'error', details: err.message });
            Utils.showToast('Lỗi nhập dữ liệu: ' + err.message, 'error');
            document.getElementById('loading-screen').classList.add('hidden');
        }
    },

    initEvents() {
        document.getElementById('btn-backup-data')?.addEventListener('click', () => this.exportData());
        document.getElementById('btn-restore-data')?.addEventListener('click', () => this.triggerImport());
        document.getElementById('restore-file-input')?.addEventListener('change', (e) => this.handleImportFile(e));
        document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
            try {
                const type = document.getElementById('export-type').value;
                const data = await DB.exportAllData();
                
                if (type === 'customers') {
                    Utils.exportCSV(data.customers, `crm-customers-${Utils.today()}.csv`);
                    Utils.showToast('Đã xuất dữ liệu khách hàng', 'success');
                } else if (type === 'orders' || type === 'revenue') {
                    Utils.exportCSV(data.orders, `crm-orders-${Utils.today()}.csv`);
                    Utils.showToast('Đã xuất dữ liệu đơn hàng', 'success');
                }
            } catch (err) {
                console.error(err);
                Utils.showToast('Lỗi khi xuất CSV', 'error');
            }
        });
    }
};
