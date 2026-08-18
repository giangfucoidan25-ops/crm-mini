/* ===================================================================
   CRM MINI — TRANSFERRED MODULE
   Quản lý danh sách Khách hàng bị chuyển
   =================================================================== */

window.TransferredModule = {
    currentPage: 1,
    itemsPerPage: 20,
    customers: [],

    async render() {
        this.customers = await DB.getTransferredCustomers();
        // Sort by transferred_date descending
        this.customers.sort((a, b) => new Date(b.transferred_date || b.updated_at) - new Date(a.transferred_date || a.updated_at));
        
        this.currentPage = 1;
        await this.renderTable();
    },

    async renderTable() {
        const tbody = document.getElementById('transferred-tbody');
        if (!tbody) return;

        let filteredCustomers = this.customers;
        const searchQuery = (document.getElementById('transferred-search')?.value || '').toLowerCase().trim();
        const productFilter = document.getElementById('transferred-filter-product')?.value || 'all';

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
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="text-align:center;">Chưa có khách hàng bị chuyển</td></tr>';
            document.getElementById('transferred-pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = pageData.map((c, idx) => `
            <tr>
                <td>${start + idx + 1}</td>
                <td>
                    <strong style="cursor:pointer;color:var(--color-primary);" onclick="CustomersModule.viewCustomer(${c.id})">[ID: ${c.id}] ${Utils.escapeHtml(c.full_name)}</strong>
                    ${Utils.getGetFlyLink(c)}
                    <div style="font-size:12px;color:var(--text-muted);">${Utils.sourceLabel(c.customer_source)}</div>
                </td>
                <td>
                    <div>${c.phone || '—'}</div>
                    <div style="font-size:12px;color:var(--text-muted);">${c.zalo_phone ? 'Zalo: ' + c.zalo_phone : ''}</div>
                </td>
                <td>${Utils.formatDate(c.transferred_date) || '—'}</td>
                <td style="max-width: 200px; white-space: normal;">
                    <div style="font-size:13px; color:var(--text-color);">${Utils.escapeHtml(c.transferred_reason || '—')}</div>
                </td>
                <td><strong style="color:var(--color-success);">${Utils.formatCurrency(c.total_revenue)}</strong></td>
                <td><span class="badge badge-purple">${c.total_orders || 0} đơn</span></td>
                <td>
                    <div class="action-btns" style="min-width:max-content;">
                        <button class="action-btn btn-care" onclick="TransferredModule.resumeCustomer(${c.id})" title="Khôi phục lại">🔄 Khôi phục</button>
                    </div>
                </td>
            </tr>
        `).join('');

        const totalPages = Math.ceil(filteredCustomers.length / this.itemsPerPage) || 1;
        Utils.renderPagination('transferred-pagination', this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.renderTable();
        });
    },

    async resumeCustomer(id) {
        const ok = await Utils.confirm('Xác nhận khôi phục', 'Bạn có muốn nhận lại khách hàng này để tiếp tục chăm sóc?', '🔄');
        if (!ok) return;

        await DB.db.customers.update(id, {
            transferred_status: false,
            transferred_date: null,
            transferred_reason: null,
            updated_at: new Date().toISOString()
        });

        Utils.showToast('Đã khôi phục khách hàng thành công!', 'success');
        this.render();
    },

    initEvents() {
        const searchInput = document.getElementById('transferred-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.currentPage = 1;
                this.renderTable();
            }, 300));
        }
        
        const productFilter = document.getElementById('transferred-filter-product');
        if (productFilter) {
            productFilter.addEventListener('change', () => {
                this.currentPage = 1;
                this.renderTable();
            });
        }
    }
};
