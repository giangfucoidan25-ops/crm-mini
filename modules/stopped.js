/* ===================================================================
   CRM MINI — STOPPED MODULE
   Quản lý danh sách Khách hàng Tạm dừng
   =================================================================== */

const StoppedModule = {
    currentPage: 1,
    itemsPerPage: 20,
    customers: [],

    async render() {
        this.customers = await DB.getStoppedCustomers();
        // Sort by created_at or updated_at descending
        this.customers.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        
        this.currentPage = 1;
        await this.renderTable();
    },

    async renderTable() {
        const tbody = document.getElementById('stopped-tbody');
        if (!tbody) return;

        let filteredCustomers = this.customers;
        const searchQuery = (document.getElementById('stopped-search')?.value || '').toLowerCase().trim();
        const productFilter = document.getElementById('stopped-filter-product')?.value || 'all';

        if (searchQuery) {
            filteredCustomers = filteredCustomers.filter(c => 
                (c.full_name && c.full_name.toLowerCase().includes(searchQuery)) ||
                (c.phone && c.phone.includes(searchQuery))
            );
        }

        if (productFilter !== 'all') {
            const allOrders = await DB.db.orders.toArray();
            const customerIdsWithProduct = new Set();
            allOrders.forEach(o => {
                if (o.product_name && o.product_name.includes(productFilter)) {
                    customerIdsWithProduct.add(o.customer_id);
                }
            });
            filteredCustomers = filteredCustomers.filter(c => customerIdsWithProduct.has(c.id));
        }

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const pageData = filteredCustomers.slice(start, start + this.itemsPerPage);

        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="text-align:center;">Chưa có khách hàng tạm dừng</td></tr>';
            document.getElementById('stopped-pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = pageData.map((c, idx) => `
            <tr>
                <td>${start + idx + 1}</td>
                <td>
                    <strong style="cursor:pointer;color:var(--color-primary);" onclick="CustomersModule.viewCustomer('${c.id}')">${Utils.escapeHtml(Utils.formatName(c.full_name))}</strong>
                    ${Utils.getGetFlyLink(c)}
                    <div style="font-size:12px;color:var(--text-muted);">${Utils.sourceLabel(c.customer_source)}</div>
                </td>
                <td>
                    <div>${c.phone || '—'}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${c.zalo_phone ? 'Zalo: ' + c.zalo_phone : ''}</div>
                </td>
                <td style="max-width: 250px; white-space: normal;">
                    <div style="font-size:13px; color:var(--text-color);">${Utils.escapeHtml(c.note || '—')}</div>
                </td>
                <td><strong style="color:var(--color-success);">${Utils.formatCurrency(c.total_revenue)}</strong></td>
                <td style="text-align: center;">
                    <input type="checkbox" style="transform: scale(1.5); cursor: pointer;" 
                        ${c.manual_stopped ? 'checked' : ''} 
                        onclick="StoppedModule.toggleManualConfirm(\'${c.id}\', this.checked)"
                        title="Đánh dấu đã xác nhận thủ công (bỏ qua khi quét AI)">
                </td>
                <td>
                    <div class="action-btns" style="min-width:max-content;">
                        <button class="action-btn btn-care" onclick="StoppedModule.resumeCustomer(\'${c.id}\')" title="Khôi phục chăm sóc">🔄 Khôi phục</button>
                    </div>
                </td>
            </tr>
        `).join('');

        const totalPages = Math.ceil(filteredCustomers.length / this.itemsPerPage) || 1;
        Utils.renderPagination('stopped-pagination', this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.renderTable();
        });
    },

    async resumeCustomer(id) {
        const ok = await Utils.confirm('Xác nhận khôi phục', 'Đưa khách hàng này trở lại danh sách chăm sóc bình thường?', '🔄');
        if (!ok) return;

        await DB.db.customers.update(id, {
            stopped_status: false,
            updated_at: new Date().toISOString()
        });

        Utils.showToast('Đã khôi phục khách hàng thành công!', 'success');
        this.render();
    },

    async toggleManualConfirm(id, isChecked) {
        await DB.db.customers.update(id, {
            manual_stopped: isChecked,
            updated_at: new Date().toISOString()
        });
        
        if (isChecked) {
            Utils.showToast('Đã xác nhận thủ công (Bỏ qua khi quét)', 'success');
        } else {
            Utils.showToast('Đã bỏ xác nhận thủ công', 'info');
        }
    },

    initEvents() {
        const searchInput = document.getElementById('stopped-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.currentPage = 1;
                this.renderTable();
            }, 300));
        }

        const productFilter = document.getElementById('stopped-filter-product');
        if (productFilter) {
            productFilter.addEventListener('change', () => {
                this.currentPage = 1;
                this.renderTable();
            });
        }
    }
};
