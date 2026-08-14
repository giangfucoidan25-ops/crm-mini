/* ===================================================================
   CRM MINI — CUSTOMERS MODULE
   CRUD khách hàng, bộ lọc, tìm kiếm, phân trang
   =================================================================== */

const CustomersModule = {
    currentPage: 1,
    pageSize: 20,
    sortField: 'created_at',
    sortDir: 'desc',
    filters: {},

    async render() {
        this.careConfig = {
            m1: await DB.getSetting('care_milestone_1') !== undefined ? await DB.getSetting('care_milestone_1') : 1,
            m2: await DB.getSetting('care_milestone_2') !== undefined ? await DB.getSetting('care_milestone_2') : 7,
            m3: await DB.getSetting('care_milestone_3') !== undefined ? await DB.getSetting('care_milestone_3') : 22,
            cycle: await DB.getSetting('care_cycle_days') || 30
        };

        const products = await DB.getAllProducts();
        const filterSelect = document.getElementById('customer-filter-product');
        if (filterSelect) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="all">Tất cả sản phẩm</option>' +
                products.map(p => `<option value="${p.product_name}">${p.product_name}</option>`).join('');
            filterSelect.value = currentVal;
            if (!filterSelect.value) filterSelect.value = 'all';
        }

        const customers = await this.getFilteredCustomers();
        this.renderTable(customers);
    },

    async getFilteredCustomers() {
        const search = (document.getElementById('customer-search')?.value || '').toLowerCase().trim();

        // Nếu có gõ tìm kiếm thì tìm trên toàn bộ KH (cả KH đã dừng chăm sóc/chuyển giao)
        // Nếu không có tìm kiếm thì chỉ hiện KH đang hoạt động
        let customers;
        if (search) {
            customers = await DB.db.customers.filter(c => !c.deleted_at).toArray();
        } else {
            customers = await DB.getActiveCustomers();
        }

        const statusFilter = document.getElementById('customer-filter-status')?.value || '';
        const sourceFilter = document.getElementById('customer-filter-source')?.value || '';
        const careFilter = document.getElementById('customer-filter-care')?.value || '';
        const productFilter = document.getElementById('customer-filter-product')?.value || 'all';

        if (search) {
            const terms = search.split(/\s+/);
            customers = customers.filter(c => {
                const combinedString = `${c.full_name || ''} ${c.phone || ''} ${c.zalo_phone || ''} ${c.email || ''}`.toLowerCase();
                return terms.every(term => combinedString.includes(term));
            });
        }
        if (statusFilter && statusFilter !== 'all') customers = customers.filter(c => c.status === statusFilter);
        if (sourceFilter) customers = customers.filter(c => c.customer_source === sourceFilter);

        if (productFilter !== 'all') {
            const allOrders = await DB.db.orders.toArray();
            const customerIdsWithProduct = new Set();
            allOrders.forEach(o => {
                if (o.product_name && o.product_name.includes(productFilter)) {
                    customerIdsWithProduct.add(o.customer_id);
                }
            });
            customers = customers.filter(c => customerIdsWithProduct.has(c.id));
        }

        if (careFilter) {
            const today = Utils.today();
            switch (careFilter) {
                case 'due_today':
                    customers = customers.filter(c => {
                        const st = Utils.getCareStatus(c, this.careConfig);
                        return st.status === 'due' || st.status === 'overdue' || st.status === 'never';
                    });
                    break;
                case 'overdue':
                    customers = customers.filter(c => {
                        const st = Utils.getCareStatus(c, this.careConfig);
                        return st.status === 'overdue' || st.status === 'never';
                    });
                    break;
                case 'overdue_30':
                    customers = customers.filter(c => {
                        if (!c.last_contact_date) return true;
                        return Utils.daysAgo(c.last_contact_date) > 30;
                    });
                    break;
                case 'product_running_out':
                    customers = customers.filter(c => {
                        if (!c.estimated_product_end_date) return false;
                        const d = Utils.daysFromNow(c.estimated_product_end_date);
                        return d >= 0 && d <= 7;
                    });
                    break;
                case 'product_out':
                    customers = customers.filter(c => {
                        if (!c.estimated_product_end_date) return false;
                        return Utils.daysFromNow(c.estimated_product_end_date) < 0;
                    });
                    break;
            }
        }

        const timeFilterVal = document.getElementById('customer-filter-time')?.value || 'all';
        if (timeFilterVal !== 'all') {
            const customFrom = document.getElementById('customer-date-from')?.value;
            const customTo = document.getElementById('customer-date-to')?.value;
            
            if (timeFilterVal !== 'custom' || (customFrom && customTo)) {
                const range = Utils.getDateRange(timeFilterVal, customFrom, customTo);
                
                const ordersInRange = await DB.db.orders.filter(o => {
                    if (o.deleted_at) return false;
                    if (o.order_status === 'cancelled') return false;
                    if (!o.order_date) return false;
                    const d = o.order_date.substring(0, 10);
                    return d >= range.from && d <= range.to;
                }).toArray();
                const orderedCustIds = new Set(ordersInRange.map(o => o.customer_id));
                
                customers = customers.filter(c => orderedCustIds.has(c.id));
            }
        }

        // Sort
        customers.sort((a, b) => {
            let va = a[this.sortField], vb = b[this.sortField];
            if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
            if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
            if (va > vb) return this.sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return customers;
    },

    renderTable(customers) {
        const total = customers.length;
        const totalPages = Math.ceil(total / this.pageSize);
        if (this.currentPage > totalPages) this.currentPage = Math.max(1, totalPages);
        const start = (this.currentPage - 1) * this.pageSize;
        const pageData = customers.slice(start, start + this.pageSize);

        const tbody = document.getElementById('customers-tbody');
        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Không có khách hàng nào</td></tr>';
        } else {
            tbody.innerHTML = pageData.map((c, index) => {
                const careStatus = Utils.getCareStatus(c, this.careConfig);
                const expiries = Utils.getAllProductExpiryStatuses(c.product_expiries);
                let expiryHtml = '';
                if (expiries.length > 0) {
                    expiryHtml = expiries.map(exp => `<div class="${exp.class}" style="margin-bottom:2px; font-size: 11px; display: inline-block; padding: 2px 6px; border-radius: 4px;" title="${exp.tooltip ? Utils.escapeHtml(exp.tooltip) : Utils.escapeHtml(exp.productName)}">${Utils.escapeHtml(exp.productName)}: ${exp.label}</div>`).join('<br>');
                } else if (c.estimated_product_end_date) {
                    const expiryStatus = Utils.getProductExpiryStatus(c.estimated_product_end_date, c.expiry_formula);
                    expiryHtml = `<div class="${expiryStatus.class}" style="font-size: 11px; display: inline-block; padding: 2px 6px; border-radius: 4px;" title="${expiryStatus.tooltip ? Utils.escapeHtml(expiryStatus.tooltip) : ''}">${expiryStatus.label}</div>`;
                }

                const stt = start + index + 1;
                const careTypeSuffix = careStatus.milestone ? ` <span style="color:${careStatus.milestone.color || '#28a745'}; font-weight:bold; margin-left:4px;" title="${careStatus.milestone.name}">${careStatus.milestone.label}</span>` : '';
                const orderDateHtml = c.last_order_date ? `<span style="color:var(--text-muted); font-size: 11px; display:block; margin-bottom: 2px;">${Utils.formatDate(c.last_order_date)}</span>` : '';
                return `
                <tr>
                    <td>${stt}</td>
                    <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <div>
                                ${orderDateHtml}
                                <strong style="cursor:pointer;" onclick="CustomersModule.viewCustomer(${c.id})">[ID: ${c.id}] ${Utils.escapeHtml(c.full_name)}</strong>
                                ${Utils.getGetFlyLink(c)}
                                ${careTypeSuffix}
                                ${c.tags ? `<span class="badge badge-purple" style="margin-left:4px;">${c.tags}</span>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>${c.phone || '—'}</td>
                    <td><span class="status-badge status-${c.status}">${Utils.customerStatusLabel(c.status)}</span></td>
                    <td>${Utils.formatCurrency(c.total_revenue)}</td>
                    <td><span class="badge ${careStatus.class}" title="${careStatus.tooltip ? Utils.escapeHtml(careStatus.tooltip) : ''}">${careStatus.label}</span></td>
                    <td>${expiryHtml}</td>
                    <td>
                        <div class="action-btns">

                            <button class="action-btn btn-care" onclick="CustomersModule.viewCustomer(${c.id}, 'traodoi')" title="Note Chăm sóc" style="color:var(--color-primary);">📝</button>
                            <button class="action-btn btn-zalo" onclick="ZaloModule.openZalo('${c.zalo_phone || c.phone}')" title="Zalo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.28 15.71C22.25 14.23 23 12.56 23 10.5C23 5.8 18.07 2 12 2C5.93 2 1 5.8 1 10.5C1 15.2 5.93 19 12 19C13.43 19 14.79 18.66 16 18.06C16.54 17.79 17.18 17.81 17.7 18.15L21.37 20.57C22.09 21.04 23 20.53 22.84 19.67L22.05 15.35C21.94 14.76 22.18 14.16 22.68 13.78L21.28 15.71Z" fill="currentColor"/><path d="M16 13H8V11L13.5 6H8V4H16V6L10.5 11H16V13Z" fill="white"/></svg></button>
                            <button class="action-btn btn-order" onclick="OrdersModule.showForm(null, ${c.id})" title="Thêm đơn hàng">🛒</button>
                            <button class="action-btn btn-care" onclick="CareModule.markCared(${c.id})" title="Đánh dấu đã chăm sóc" style="${c.last_contact_date && c.last_contact_date.substring(0, 10) === Utils.today() ? 'color:var(--color-success);font-weight:bold;' : 'display:inline-flex;align-items:center;justify-content:center;'}">${c.last_contact_date && c.last_contact_date.substring(0, 10) === Utils.today() ? '✓' : '<div style="width:14px;height:14px;border:2px solid #fff;border-radius:3px;display:inline-block;"></div>'}</button>
                            <button class="action-btn btn-edit" onclick="CustomersModule.editCustomer(${c.id})" title="Sửa">✏️</button>
                            <button class="action-btn btn-delete" onclick="CustomersModule.confirmDelete(${c.id})" title="Xóa">🗑</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        Utils.renderPagination('customers-pagination', this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.render();
        });
    },

    showForm(customer = null) {
        const isEdit = !!customer;
        const c = customer || {};
        const html = `
            <div class="form-row">
                <div class="form-group"><label>Họ tên *</label><input type="text" id="f-name" class="input-field" value="${Utils.escapeHtml(c.full_name || '')}" required></div>
                <div class="form-group"><label>Số điện thoại *</label><input type="text" id="f-phone" class="input-field" value="${c.phone || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Số Zalo</label><input type="text" id="f-zalo" class="input-field" value="${c.zalo_phone || ''}"></div>
                <div class="form-group"><label>Email</label><input type="email" id="f-email" class="input-field" value="${c.email || ''}"></div>
            </div>
            <div class="form-group"><label>Địa chỉ</label><input type="text" id="f-address" class="input-field" value="${Utils.escapeHtml(c.address || '')}"></div>
            <div class="form-group"><label>Link hồ sơ (Facebook, GetFly...)</label><input type="text" id="f-link" class="input-field" value="${Utils.escapeHtml(c.getfly_url || '')}"></div>
            <div class="form-row">
                <div class="form-group">
                    <label>Nguồn khách hàng</label>
                    <select id="f-source" class="select-filter" style="width:100%;">
                        ${['', 'facebook', 'fanpage', 'zalo', 'tiktok', 'website', 'livestream', 'referral', 'event', 'company_data', 'acquaintance', 'other']
                .map(s => `<option value="${s}" ${c.customer_source === s ? 'selected' : ''}>${s ? Utils.sourceLabel(s) : '-- Chọn --'}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Trạng thái</label>
                    <select id="f-status" class="select-filter" style="width:100%;">
                        ${['new', 'contacted', 'consulting', 'waiting_close', 'purchased', 'repurchased', 'vip', 'agency', 'cancelled', 'stopped']
                .map(s => `<option value="${s}" ${(c.status || 'new') === s ? 'selected' : ''}>${Utils.customerStatusLabel(s)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Tags</label><input type="text" id="f-tags" class="input-field" value="${Utils.escapeHtml(c.tags || '')}" placeholder="VIP, Đại lý..."></div>
                <div class="form-group"><label>Chu kỳ chăm sóc (ngày)</label><input type="number" id="f-care-cycle" class="input-field" value="${c.care_cycle_days || 30}" min="1"></div>
            </div>
            <div class="form-group"><label>Ghi chú</label><textarea id="f-note" class="input-field" rows="3">${Utils.escapeHtml(c.note || '')}</textarea></div>
        `;

        const footer = `
            <button class="btn-secondary" onclick="Utils.closeModal()">Hủy</button>
            <button class="btn-primary" onclick="CustomersModule.saveCustomer(${isEdit ? c.id : 'null'})">${isEdit ? 'Cập nhật' : 'Thêm mới'}</button>
        `;

        Utils.openModal(isEdit ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới', html, footer, 'lg');
    },

    async saveCustomer(id) {
        const name = document.getElementById('f-name').value.trim();
        if (!name) { Utils.showToast('Vui lòng nhập họ tên', 'error'); return; }

        const data = {
            full_name: name,
            phone: document.getElementById('f-phone').value.trim(),
            zalo_phone: document.getElementById('f-zalo').value.trim() || document.getElementById('f-phone').value.trim(),
            email: document.getElementById('f-email').value.trim(),
            address: document.getElementById('f-address').value.trim(),
            getfly_url: document.getElementById('f-link').value.trim(),
            customer_source: document.getElementById('f-source').value,
            status: document.getElementById('f-status').value,
            tags: document.getElementById('f-tags').value.trim(),
            care_cycle_days: parseInt(document.getElementById('f-care-cycle').value) || 30,
            note: document.getElementById('f-note').value.trim()
        };

        try {
            if (id) {
                await DB.updateCustomer(id, data);
                Utils.showToast('Đã cập nhật khách hàng', 'success');
            } else {
                data.last_contact_date = Utils.today();
                data.next_care_date = Utils.addDays(Utils.today(), data.care_cycle_days);
                await DB.addCustomer(data);
                Utils.showToast('Đã thêm khách hàng mới', 'success');
            }
            Utils.closeModal();
            this.render();
            DashboardModule.render();
        } catch (err) {
            Utils.showToast('Lỗi: ' + err.message, 'error');
        }
    },

    async editCustomer(id) {
        const customer = await DB.getCustomer(id);
        if (customer) this.showForm(customer);
    },

    currentViewingId: null,
    currentViewingTab: 'traodoi',

    async viewCustomer(id, activeTab = 'traodoi') {
        this.currentViewingId = Number(id);
        this.currentViewingTab = activeTab;
        if (window.location.hash === '#customer-detail') {
            this.renderCustomerDetailPage(id);
        } else {
            App.navigateTo('customer-detail');
        }
    },

    async renderCustomerDetailPage(id) {
        if (!id) id = this.currentViewingId;
        if (!id) return;

        const activeTab = this.currentViewingTab || 'traodoi';
        const pageEl = document.getElementById('page-customer-detail');
        if (!pageEl) return;

        const c = await DB.getCustomer(id);
        if (!c) {
            pageEl.innerHTML = '<div style="padding:20px;text-align:center;">Không tìm thấy khách hàng. <button onclick="App.navigateTo(\'customers\')">Quay lại</button></div>';
            return;
        }

        const orders = await DB.getOrdersByCustomer(id);
        let careLogs = await DB.getCareLogsByCustomer(id);
        careLogs = careLogs.filter(log => !log.is_remedy);
        const appointments = await DB.getAppointmentsByCustomer(id);

        const careConfig = {
            m1: await DB.getSetting('care_milestone_1') !== undefined ? await DB.getSetting('care_milestone_1') : 1,
            m2: await DB.getSetting('care_milestone_2') !== undefined ? await DB.getSetting('care_milestone_2') : 7,
            m3: await DB.getSetting('care_milestone_3') !== undefined ? await DB.getSetting('care_milestone_3') : 22,
            cycle: await DB.getSetting('care_cycle_days') || 30
        };
        const careStatus = Utils.getCareStatus(c, careConfig);
        const completedOrders = orders.filter(o => o.order_status === 'completed');
        const latestOrder = completedOrders.length > 0 ? completedOrders[0] : null;
        const calculatedRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

        pageEl.innerHTML = `
            <div class="cd-page-layout">
                <!-- LEFT COLUMN -->
                <div class="cd-left-panel">
                    <button onclick="window.history.length > 1 ? window.history.back() : App.navigateTo('customers')" class="btn-secondary" style="margin-bottom:16px; align-self:flex-start; font-size:13px;">← Quay lại</button>
                    
                    <div class="cd-header-card">
                        <div class="cd-avatar">${c.full_name ? c.full_name.charAt(0).toUpperCase() : '👤'}</div>
                        <div>
                            <div style="font-weight:bold;font-size:16px;color:var(--text-primary);display:flex;align-items:center;gap:4px;">
                                ${Utils.escapeHtml(c.full_name)}
                                ${Utils.getGetFlyLink(c)}
                                <span style="cursor:pointer;" onclick="CustomersModule.editCustomer(${c.id})" title="Sửa KH">✏️</span>
                            </div>
                            <div style="font-size:13px;color:var(--text-muted);">${c.phone || ''}</div>
                        </div>
                    </div>
                    
                    <div class="cd-info-group">
                        <div class="cd-info-row"><span class="label">Nguồn</span><span class="value">${c.customer_source ? Utils.sourceLabel(c.customer_source) : 'Chưa rõ'}</span></div>
                        <div class="cd-info-row"><span class="label">Người tạo</span><span class="value">Hệ thống</span></div>
                        <div class="cd-info-row"><span class="label">Ngày tạo</span><span class="value">${Utils.formatDate(c.created_at || '')}</span></div>
                        <div class="cd-info-row"><span class="label">Đã mua</span><span class="value">${completedOrders.length} lần</span></div>
                        <div class="cd-info-row"><span class="label">Lần mua gần nhất</span><span class="value">${latestOrder ? Utils.formatDate(latestOrder.order_date) : '-'}</span></div>
                        
                        <div style="margin-top:12px;">
                            <div style="font-size:12px;font-weight:600;display:flex;justify-content:space-between;margin-bottom:4px;color:var(--text-primary);">
                                <span>Hoàn thiện hồ sơ</span>
                                <span style="color:var(--color-primary);">100%</span>
                            </div>
                            <div class="cd-progress-bar"><div class="cd-progress-fill"></div></div>
                        </div>
                    </div>
                    
                    <div class="cd-accordion">
                        <div class="cd-accordion-header" onclick="this.nextElementSibling.classList.toggle('active')">
                            <span>Thông tin chính</span>
                            <span>▼</span>
                        </div>
                        <div class="cd-accordion-content active">
                            <div class="cd-info-row" style="flex-direction:column;align-items:flex-start;margin-bottom:8px;">
                                <span class="label" style="font-weight:600;">Địa chỉ cụ thể:</span>
                                <span>${Utils.escapeHtml(c.address || '-')}</span>
                            </div>
                            <div class="cd-info-row" style="flex-direction:column;align-items:flex-start;margin-bottom:8px;">
                                <span class="label" style="font-weight:600;">Nhóm khách hàng:</span>
                                <span>${Utils.customerStatusLabel(c.status)}</span>
                            </div>
                            ${c.special_note ? `
                            <div class="cd-info-row" style="flex-direction:column;align-items:flex-start;margin-bottom:8px;background:rgba(255,193,7,0.1);padding:8px;border-radius:4px;border-left:3px solid var(--color-warning);">
                                <span class="label" style="font-weight:600;color:var(--color-warning);">Ghi chú đặc biệt:</span>
                                <span style="white-space:pre-wrap;margin-top:4px;">${Utils.escapeHtml(c.special_note)}</span>
                            </div>` : ''}
                            <div class="cd-info-row" style="flex-direction:column;align-items:flex-start;margin-bottom:8px;">
                                <span class="label" style="font-weight:600;">Tags:</span>
                                <span>${Utils.escapeHtml(c.tags || '-')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- RIGHT COLUMN -->
                <div class="cd-right-panel">
                    <div class="cd-top-stats">
                        <div class="cd-stat-item">
                            <div class="cd-stat-label">Liên hệ lần cuối</div>
                            <div class="cd-stat-value" style="color:var(--color-danger);">${c.last_contact_date ? Utils.daysAgo(c.last_contact_date) : 0}</div>
                        </div>
                        <div class="cd-stat-item">
                            <div class="cd-stat-label">Tương tác</div>
                            <div class="cd-stat-value" style="color:var(--color-warning);">${careLogs.length}</div>
                        </div>
                        <div class="cd-stat-item">
                            <div class="cd-stat-label">Giá trị đơn hàng</div>
                            <div class="cd-stat-value" style="color:var(--color-success);">${Utils.formatCurrency(calculatedRevenue)}</div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; margin-left: auto;">
                            <button class="btn-primary" onclick="OrdersModule.showForm(null, ${c.id})">🛒 Thêm Đơn</button>
                            <button class="btn-secondary" onclick="ZaloModule.openZalo('${c.zalo_phone || c.phone}')">💬 Zalo</button>
                        </div>
                    </div>

                    <div class="cd-tabs-wrapper">
                        <div class="cd-tab ${activeTab === 'traodoi' ? 'active' : ''}" onclick="CustomersModule.switchCustomerTab('traodoi')">Trao đổi</div>
                        <div class="cd-tab ${activeTab === 'giaodich' ? 'active' : ''}" onclick="CustomersModule.switchCustomerTab('giaodich')">Giao dịch ▾</div>
                        <div class="cd-tab ${activeTab === 'lichhen' ? 'active' : ''}" onclick="CustomersModule.switchCustomerTab('lichhen')">Lịch hẹn ▾</div>
                        <div style="margin-left: auto; display: flex; align-items: center; gap: 16px;">
                            ${careStatus.label ? `<span class="badge ${careStatus.class}" title="${careStatus.tooltip ? Utils.escapeHtml(careStatus.tooltip) : ''}">${careStatus.icon || ''}${careStatus.label}</span>` : ''}
                            ${c.product_expiries && c.product_expiries.length > 0 ?
                `<div style="display:flex; flex-direction:column; gap:2px; font-size:12px;">${Utils.getAllProductExpiryStatuses(c.product_expiries).map(exp => `<div class="${exp.class}" style="font-weight:500;" title="${exp.tooltip ? Utils.escapeHtml(exp.tooltip) : ''}">${exp.icon || ''}${Utils.escapeHtml(exp.productName)}: ${exp.label}</div>`).join('')}</div>`
                : (c.estimated_product_end_date ?
                    `<div class="${Utils.getProductExpiryStatus(c.estimated_product_end_date, c.expiry_formula).class}" style="font-size:12px; font-weight:500;" title="${Utils.getProductExpiryStatus(c.estimated_product_end_date, c.expiry_formula).tooltip ? Utils.escapeHtml(Utils.getProductExpiryStatus(c.estimated_product_end_date, c.expiry_formula).tooltip) : ''}">${Utils.getProductExpiryStatus(c.estimated_product_end_date, c.expiry_formula).icon || ''}${Utils.getProductExpiryStatus(c.estimated_product_end_date, c.expiry_formula).label}</div>`
                    : '')}
                        </div>
                    </div>

                    <!-- TAB: TRAO ĐỔI -->
                    <div class="cd-tab-content ${activeTab === 'traodoi' ? 'active' : ''}" id="cd-tab-traodoi">
                        <div class="cd-note-input-area">
                            <div class="cd-note-toolbar">
                                <button title="Gọi điện" onclick="document.getElementById('care-note-type').value='Gọi điện'">📞</button>
                                <button title="Zalo" onclick="document.getElementById('care-note-type').value='Nhắn tin Zalo'">💬</button>
                                <button title="Gặp trực tiếp" onclick="document.getElementById('care-note-type').value='Gặp trực tiếp'">🤝</button>
                                <select id="care-note-type" style="border:none;background:transparent;outline:none;font-size:13px;color:var(--text-primary);font-weight:bold;">
                                    <option value="Gọi điện">Gọi điện</option>
                                    <option value="Nhắn tin Zalo">Nhắn tin Zalo</option>
                                    <option value="Gặp trực tiếp">Gặp trực tiếp</option>
                                    <option value="Khác">Khác</option>
                                </select>
                            </div>
                            <textarea id="care-note-input" class="cd-note-textarea" placeholder="Nhập nội dung trao đổi... (Hỗ trợ tự động nhận diện ngày tháng nếu có AI)"></textarea>
                            <div id="care-note-inventory-panel" style="display:flex; gap: 12px; margin-top: 8px; padding: 8px; background: rgba(76, 175, 80, 0.05); border-radius: 4px; border-left: 3px solid var(--color-success); flex-wrap: wrap;">
                                <label style="font-size:12px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
                                    Ngày chốt
                                    <input type="date" id="care-note-base-date" class="input-field" style="width: 130px; padding: 4px 8px; font-size: 13px; height: 28px;">
                                </label>
                                <label style="font-size:12px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
                                    Số hộp còn lại
                                    <input type="number" id="care-note-remaining" class="input-field" style="width: 100px; padding: 4px 8px; font-size: 13px; height: 28px;" min="0" step="0.5">
                                </label>
                                <label style="font-size:12px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
                                    Đơn vị
                                    <select id="care-note-unit" class="input-field" style="width: 80px; padding: 0 4px; font-size: 13px; height: 28px;" onchange="document.getElementById('care-note-dosage-label').textContent = 'Liều dùng/ngày (' + this.value.toLowerCase() + ')'">
                                        <option value="Viên">Viên</option>
                                        <option value="Gói">Gói</option>
                                        <option value="Cốc">Cốc</option>
                                        <option value="Gram">Gram</option>
                                        <option value="Khác">Khác</option>
                                    </select>
                                </label>
                                <label style="font-size:12px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
                                    <span id="care-note-dosage-label">Liều dùng/ngày (viên)</span>
                                    <input type="number" id="care-note-dosage" class="input-field" style="width: 120px; padding: 4px 8px; font-size: 13px; height: 28px;" min="0" step="0.5">
                                </label>
                                <div style="font-size: 11px; color: var(--text-muted); align-self: flex-end; padding-bottom: 4px; font-style: italic;">
                                    (Gõ "còn X hộp", "đã dùng Y hộp", "ngày dùng Z lần" để máy tự điền)
                                </div>
                            </div>
                            <div class="cd-note-actions" style="margin-top:8px;">
                                <div style="display:flex; gap: 12px;">
                                    <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--text-muted);">
                                        <input type="checkbox" id="care-note-ai-toggle"> AI cập nhật
                                    </label>
                                    <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--color-warning);font-weight:600;">
                                        <input type="checkbox" id="care-note-special-toggle"> Ghi chú đặc biệt
                                    </label>
                                    <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--color-success);font-weight:600;">
                                        <input type="checkbox" id="care-note-remedy-toggle"> Bài thuốc hay
                                    </label>
                                </div>
                                <button id="btn-submit-care-note" class="btn-primary" onclick="CustomersModule.submitCareNote(${c.id}, this)">Gửi</button>
                            </div>
                        </div>

                        <div id="care-note-delete-bar" style="display:none; justify-content:space-between; align-items:center; background:var(--bg-tertiary); padding:12px; border-radius:8px; margin-bottom:16px; border:1px solid var(--border-color);">
                            <span style="font-size:14px; font-weight:600; color:var(--text-primary);"><span id="care-note-selected-count">0</span> mục đã chọn</span>
                            <div style="display:flex; gap:8px;">
                                <button class="btn-secondary" onclick="CustomersModule.toggleDeleteMode()" style="font-size:13px; padding:6px 12px;">Hủy</button>
                                <button class="btn-primary" onclick="CustomersModule.deleteSelectedCareNotes(${c.id})" style="font-size:13px; padding:6px 12px; background:var(--color-danger); border:none;">Xác nhận Xóa</button>
                            </div>
                        </div>

                        <div class="cd-logs-list">
                            ${careLogs.length > 0 ? careLogs.sort((a, b) => {
                        const dateA = new Date(a.care_date).getTime();
                        const dateB = new Date(b.care_date).getTime();
                        if (dateA === dateB) {
                            return new Date(b.created_at || b.care_date).getTime() - new Date(a.created_at || a.care_date).getTime();
                        }
                        return dateB - dateA;
                    }).map(log => {
                        let author = 'Ghi chú';
                        const safeNote = log.note || '';
                        let contentText = safeNote;
                        let displayTime = `${Utils.formatDate(log.care_date)}${log.created_at ? ' ' + new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}`;

                        const match1 = safeNote.match(/^\[\d{1,2}:\d{2}\]\s*(.+?):\s*([\s\S]*)$/);
                        const match2 = safeNote.match(/^([A-ZÀ-Ỹa-zà-ỹ\s]{2,20}):\s*([\s\S]*)$/);
                        const match3 = safeNote.match(/^([^-\n]{2,30})\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}/);
                        const match4 = safeNote.match(/^(.+?)\s*\|\s*(\d{1,2}\/\d{1,2}\/\d{4}.*)\n([\s\S]*)$/);

                        if (match4) {
                            author = match4[1].trim();
                            displayTime = match4[2].trim();
                            contentText = match4[3].trim();
                        } else if (match1) {
                            author = match1[1].trim();
                            contentText = match1[2].trim();
                        } else if (match2) {
                            author = match2[1].trim();
                            contentText = match2[2].trim();
                        } else if (match3) {
                            author = match3[1].trim();
                            const firstNewline = log.note.indexOf('\n');
                            contentText = firstNewline !== -1 ? log.note.substring(firstNewline + 1) : '';
                        }

                        if (!safeNote) {
                            author = 'Hệ thống';
                            contentText = '<i style="color:var(--text-muted);font-size:12.5px;">Đánh dấu đã chăm sóc (Không kèm nội dung)</i>';
                        }

                        return `
                                <div class="cd-log-card">
                                    <input type="checkbox" class="care-log-delete-cb" value="${log.id}" style="display:none; margin-top:12px; transform:scale(1.3); cursor:pointer;" onchange="CustomersModule.updateSelectedCount()">
                                    <div class="cd-log-content">
                                        <div class="cd-log-header">
                                            <span class="cd-log-name" style="font-weight:700; font-size:14.5px; color:var(--text-primary);">${Utils.escapeHtml(author)} | ${displayTime}</span>
                                            <span class="badge badge-purple" style="margin-left:8px;font-size:10px;">${log.care_type}</span>
                                            <div style="margin-left:auto;">
                                                <button onclick="CustomersModule.editCareNote(${log.id}, ${c.id})" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted);" title="Sửa">✏️</button>
                                                <button onclick="CustomersModule.toggleDeleteMode()" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text-muted);" title="Xóa nhiều">🗑</button>
                                            </div>
                                        </div>
                                        <div class="cd-log-text" style="margin-top:6px;">${Utils.escapeHtml(contentText).replace(/\n/g, '<br>')}</div>
                                    </div>
                                </div>
                            `}).join('') : '<p class="empty-state">Chưa có lịch sử trao đổi</p>'}
                        </div>
                    </div>

                    <!-- TAB: GIAO DỊCH -->
                    <div class="cd-tab-content ${activeTab === 'giaodich' ? 'active' : ''}" id="cd-tab-giaodich" style="overflow-y:auto;">
                        ${orders.length > 0 ? orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date)).map(o => `
                            <div class="cd-log-card" style="align-items:center;cursor:pointer;" onclick="OrdersModule.editOrder(${o.id})" title="Sửa thông tin đơn hàng">
                                <div class="cd-log-avatar" style="background:var(--color-success);color:#fff;">🛒</div>
                                <div class="cd-log-content">
                                    <div class="cd-log-header">
                                        <span class="cd-log-name">Đơn hàng #${o.id}</span>
                                        <span class="cd-log-time">${Utils.formatDate(o.order_date)}</span>
                                        <span class="badge ${o.order_status === 'completed' ? 'badge-success' : 'badge-warning'}" style="margin-left:auto;">${Utils.orderStatusLabel(o.order_status)}</span>
                                    </div>
                                    <div class="cd-log-text" style="display:flex;justify-content:space-between;">
                                        <span>${o.product_name} (x${o.quantity || 1})</span>
                                        <strong style="color:var(--color-success);">${Utils.formatCurrency(o.total_amount)}</strong>
                                    </div>
                                </div>
                            </div>
                        `).join('') : '<p class="empty-state">Chưa có đơn hàng</p>'}
                    </div>

                    <!-- TAB: LỊCH HẸN -->
                    <div class="cd-tab-content ${activeTab === 'lichhen' ? 'active' : ''}" id="cd-tab-lichhen" style="overflow-y:auto;">
                        <div style="margin-bottom:12px;text-align:right;">
                            <button class="btn-primary" onclick="CustomersModule.showAppointmentForm(${c.id})">+ Thêm lịch hẹn</button>
                        </div>
                        ${appointments.length > 0 ? appointments.map(a => `
                            <div class="cd-log-card" style="align-items:center; ${a.status === 'completed' ? 'opacity:0.6;' : ''}">
                                <div class="cd-log-avatar" style="background:var(--color-warning);color:#fff;">🗓</div>
                                <div class="cd-log-content">
                                    <div class="cd-log-header">
                                        <span class="cd-log-name">Lịch hẹn</span>
                                        <span class="cd-log-time" style="color:var(--color-danger);font-weight:bold;">${new Date(a.appointment_date).toLocaleString('vi-VN')}</span>
                                        <span class="badge ${a.status === 'completed' ? 'badge-success' : 'badge-warning'}" style="margin-left:auto;">${a.status === 'completed' ? 'Đã xong' : 'Sắp tới'}</span>
                                    </div>
                                    <div class="cd-log-text" style="${a.status === 'completed' ? 'text-decoration:line-through;' : ''}">${Utils.escapeHtml(a.note || '').replace(/\n/g, '<br>')}</div>
                                    <div style="margin-top:8px; display:flex; gap:8px;">
                                        ${a.status !== 'completed' ? `<button class="btn-success btn-sm" onclick="CustomersModule.completeAppointment(${a.id}, ${c.id})">✔️ Đánh dấu xong</button>` : ''}
                                        <button class="btn-primary btn-sm" onclick="CustomersModule.showAppointmentForm(${c.id}, ${a.id})">✏️ Sửa</button>
                                        <button class="btn-danger btn-sm" onclick="CustomersModule.deleteAppointment(${a.id}, ${c.id})">🗑 Xóa</button>
                                    </div>
                                </div>
                            </div>
                        `).join('') : '<p class="empty-state">Chưa có lịch hẹn</p>'}
                    </div>

                </div>
            </div>
        `;

        const noteInput = document.getElementById('care-note-input');
        if (noteInput) {
            noteInput.focus();
            noteInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    CustomersModule.submitCareNote(id, document.getElementById('btn-submit-care-note'));
                }
            });

            // Auto detect inventory
            let debounceTimer;
            noteInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                    const text = e.target.value.toLowerCase();
                    let remaining = document.getElementById('care-note-remaining').value;
                    let dosage = document.getElementById('care-note-dosage').value;
                    
                    let updated = false;
                    
                    // Còn X hộp
                    const matchCon = text.match(/còn (?:khoảng |nguyên |tầm |)(\d+(?:[\.,]\d+|)) (?:hộp|lọ|vỉ|tháng)/);
                    if (matchCon) {
                        remaining = parseFloat(matchCon[1].replace(',', '.'));
                        updated = true;
                    }
                    
                    // Đã dùng Y hộp
                    const matchDaDung = text.match(/đã (?:uống|dùng|sử dụng) (\d+(?:[\.,]\d+|)) (?:hộp|lọ|vỉ)/);
                    if (matchDaDung && !matchCon) {
                        const used = parseFloat(matchDaDung[1].replace(',', '.'));
                        const orders = await DB.db.orders.filter(o => o.customer_id === id && o.order_status === 'completed').toArray();
                        if (orders.length > 0) {
                            orders.sort((a,b) => new Date(b.order_date) - new Date(a.order_date));
                            const qty = orders[0].quantity || 1;
                            remaining = Math.max(0, qty - used);
                            updated = true;
                        }
                    }
                    
                    // Liều dùng: ngày dùng 1 cốc, ngày dùng 2 lần...
                    const matchLieu = text.match(/ngày (?:chỉ |)(?:uống|dùng) (?:được |)(\d+|\d+-\d+) (?:cốc|lần|viên|gói)/);
                    if (matchLieu) {
                        let doseStr = matchLieu[1];
                        if (doseStr.includes('-')) doseStr = doseStr.split('-')[1]; // Lấy mức cao nhất
                        dosage = parseFloat(doseStr);
                        updated = true;
                    }
                    
                    if (updated) {
                        const remEl = document.getElementById('care-note-remaining');
                        const dosEl = document.getElementById('care-note-dosage');
                        const oldRem = remEl.value;
                        const oldDos = dosEl.value;
                        if (remaining !== '' && !isNaN(remaining)) remEl.value = remaining;
                        if (dosage !== '' && !isNaN(dosage)) dosEl.value = dosage;
                        
                        if (oldRem != remEl.value || oldDos != dosEl.value) {
                            const panel = document.getElementById('care-note-inventory-panel');
                            if (panel) {
                                panel.style.transition = 'background-color 0.3s';
                                panel.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
                                setTimeout(() => panel.style.backgroundColor = 'rgba(76, 175, 80, 0.05)', 500);
                            }
                        }
                    }
                }, 500);
            });
        }
    },

    switchCustomerTab(tab) {
        this.currentViewingTab = tab;
        document.querySelectorAll('.cd-tab').forEach(e => e.classList.remove('active'));
        document.querySelectorAll('.cd-tab-content').forEach(e => e.classList.remove('active'));

        const tabEl = document.querySelector(`.cd-tab[onclick*="${tab}"]`);
        if (tabEl) tabEl.classList.add('active');

        const contentEl = document.getElementById(`cd-tab-${tab}`);
        if (contentEl) contentEl.classList.add('active');
    },

    async submitCareNote(customerId, btnElement) {
        const noteInput = document.getElementById('care-note-input');
        const typeSelect = document.getElementById('care-note-type');
        const aiToggle = document.getElementById('care-note-ai-toggle');
        const remInput = document.getElementById('care-note-remaining');
        const dosInput = document.getElementById('care-note-dosage');
        const dateInput = document.getElementById('care-note-base-date');
        let remainingBoxes = remInput && remInput.value ? parseFloat(remInput.value) : null;
        let dailyDosage = dosInput && dosInput.value ? parseFloat(dosInput.value) : null;
        let baseDate = dateInput && dateInput.value ? dateInput.value : null;

        let rawNote = noteInput ? noteInput.value.trim() : '';

        if (!rawNote && remainingBoxes === null && dailyDosage === null) {
            Utils.showToast('Vui lòng nhập nội dung ghi chú hoặc điền số hộp/liều dùng', 'warning');
            return;
        }

        if (!rawNote && (remainingBoxes !== null || dailyDosage !== null)) {
            rawNote = 'Cập nhật thông tin tồn thuốc/liều dùng';
        }
        const isAiEnabled = aiToggle && aiToggle.checked;
        const specialToggle = document.getElementById('care-note-special-toggle');
        const isSpecialNote = specialToggle && specialToggle.checked;
        const remedyToggle = document.getElementById('care-note-remedy-toggle');
        const isRemedy = remedyToggle && remedyToggle.checked;

        if (btnElement) {
            btnElement.disabled = true;
            btnElement.innerHTML = '<span class="spinner"></span> Đang xử lý...';
        }

        let aiRemainingBoxes = null;
        let aiDailyDosage = null;
        let aiBaseDate = null;

        try {
            if (isAiEnabled) {
                if (btnElement) btnElement.innerHTML = '<span class="spinner"></span> Đang nhờ AI phân tích...';
                const apiKey = await DB.getSetting('gemini_api_key');
                if (!apiKey) {
                    throw new Error('Vui lòng nhập Gemini API Key trong phần Cài đặt để sử dụng tính năng này.');
                }

                const systemInstruction = `Bạn là trợ lý AI giúp bóc tách và phân loại lịch sử chăm sóc khách hàng.
Người dùng sẽ dán một đoạn văn bản chứa nhiều mẩu ghi chú bị dính liền nhau (thường phân tách bằng dấu | hoặc bắt đầu bằng Tên người tạo và Thời gian).

NHIỆM VỤ:
1. Phân tích và TÁCH đoạn văn bản thành NHIỀU MỤC GHI CHÚ (Care Logs) riêng biệt.
2. Trả về một mảng JSON chứa các object, mỗi object đại diện cho 1 lần trao đổi.
3. Trong thuộc tính "note" của mỗi object, bạn phải định dạng lại chuẩn xác theo cấu trúc:
[Tên người tạo] | [Thời gian DD/MM/YYYY HH:MM]
[Nội dung trao đổi]

Ví dụ định dạng "note":
Hà Giang Fucoidan | 20/03/2025 10:18
Tư vấn c lấy chương trình 7t4

4. Các field cần có trong mỗi object JSON:
   - "date": "YYYY-MM-DD" (chuyển đổi từ ngày trong ghi chú để hệ thống lưu trữ)
   - "created_at": "YYYY-MM-DDThh:mm:00.000Z" (chuyển đổi từ ngày và giờ trong ghi chú)
   - "note": "Chuỗi văn bản đã được định dạng (Người tạo | Thời gian \\n Nội dung)"
   - "type": "Nhắn tin Zalo" (hoặc Ghi chú, Gọi điện tùy bối cảnh)
   - "remaining_boxes": số lượng hộp thuốc còn lại (nếu có nhắc đến, ví dụ: 2)
   - "daily_dosage": liều dùng mỗi ngày tính bằng số lần (nếu có nhắc đến, ví dụ: 1)
   - "base_date": "YYYY-MM-DD" (ngày chốt số lượng hộp/liều dùng nếu có nhắc đến trong cùng câu, ví dụ "17/6 còn 2 hộp" -> YYYY-06-17)

CẢNH BÁO CHÚ Ý:
- Tự động nhận diện ranh giới giữa các ghi chú dựa vào (Tên người tạo | Thời gian).
- Đảm bảo KHÔNG bỏ sót nội dung nào của khách hàng.
- Trả về ĐÚNG định dạng JSON mảng (Array). Không giải thích gì thêm.`;

                const payload = {
                    contents: [{ parts: [{ text: "Đoạn ghi chú:\n" + rawNote }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: { responseMimeType: "application/json" }
                };

                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error?.message || 'Lỗi từ Gemini API');
                }

                const data = await response.json();
                let textRes = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!textRes) throw new Error('AI không trả về kết quả hợp lệ.');

                let extractedLogs;
                try {
                    textRes = textRes.replace(/```json/g, '').replace(/```/g, '').trim();
                    extractedLogs = JSON.parse(textRes);
                    if (!Array.isArray(extractedLogs) && typeof extractedLogs === 'object') {
                        extractedLogs = [extractedLogs];
                    }
                } catch (e) {
                    throw new Error('Không thể đọc kết quả JSON từ AI');
                }

                if (!Array.isArray(extractedLogs) || extractedLogs.length === 0) {
                    throw new Error('AI không tìm thấy ghi chú nào.');
                }

                const existingLogs = await DB.getCareLogsByCustomer(customerId) || [];
                let addedCount = 0;
                let skippedCount = 0;

                for (const item of extractedLogs) {
                    if (item.remaining_boxes !== undefined && item.remaining_boxes !== null) aiRemainingBoxes = item.remaining_boxes;
                    if (item.daily_dosage !== undefined && item.daily_dosage !== null) aiDailyDosage = item.daily_dosage;
                    if (item.base_date) aiBaseDate = item.base_date;

                    if (!item.note) continue;
                    let newNoteText = item.note.trim();
                    if (!newNoteText) continue;

                    let targetDate = item.date || "";
                    let createdAt = item.created_at || new Date().toISOString();

                    // Kiểm tra trùng lặp (nội dung mới đã nằm trong một ghi chú cũ nào đó)
                    let isDuplicate = existingLogs.some(l => (l.note || "").includes(newNoteText));
                    if (isDuplicate) {
                        skippedCount++;
                        continue;
                    }

                    // Mỗi ghi chú là 1 bản ghi riêng biệt, KHÔNG gộp cùng ngày
                    const log = {
                        customer_id: customerId,
                        care_date: targetDate,
                        care_type: item.type || typeSelect.value || 'Khác',
                        note: newNoteText,
                        created_at: createdAt,
                        is_remedy: isRemedy
                    };
                    const newId = await DB.addCareLog(log);
                    log.id = newId;
                    existingLogs.push(log);
                    addedCount++;
                }
                Utils.showToast(`Đã phân tích xong! Thêm ${addedCount} ghi chú mới${skippedCount > 0 ? `, bỏ qua ${skippedCount} trùng lặp` : ''}.`, 'success');
            } else {
                const log = {
                    customer_id: customerId,
                    care_date: Utils.today(),
                    care_type: typeSelect ? typeSelect.value : 'Ghi chú',
                    note: rawNote,
                    is_remedy: isRemedy
                };
                await DB.addCareLog(log);
                Utils.showToast('Đã lưu ghi chú', 'success');
            }
            if (isAiEnabled) {
                // Ưu tiên: Manual -> AI
                if (remainingBoxes === null && aiRemainingBoxes !== null) remainingBoxes = aiRemainingBoxes;
                if (dailyDosage === null && aiDailyDosage !== null) dailyDosage = aiDailyDosage;
                if (!baseDate && aiBaseDate) baseDate = aiBaseDate;
            }

            if (isSpecialNote) {
                let customer = await DB.getCustomer(customerId);
                if (customer) {
                    let newSpecialNote = rawNote;
                    // Nếu đã có ghi chú đặc biệt thì ghép thêm vào
                    if (customer.special_note) {
                        newSpecialNote = customer.special_note + '\n---\n' + rawNote;
                    }
                    await DB.updateCustomer(customerId, { special_note: newSpecialNote });
                }
            }

            if (remainingBoxes !== null || dailyDosage !== null) {
                let customer = await DB.getCustomer(customerId);
                if (customer) {
                    let updateData = {};
                    let cycleDays = await DB.getSetting('care_cycle_days') || 30; 
                    
                    // Bước 1: Xem đơn hàng gần nhất để xác định sản phẩm khách đang dùng
                    let targetProductName = customer.last_product_used;
                    try {
                        const orders = await DB.db.orders.where('customer_id').equals(customerId).toArray();
                        if (orders && orders.length > 0) {
                            orders.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0));
                            if (orders[0].product_name) targetProductName = orders[0].product_name;
                        }
                    } catch (e) {
                        console.error('Lỗi khi lấy đơn hàng gần nhất:', e);
                    }

                    let prod = null;
                    if (targetProductName) {
                        const allProducts = await DB.db.products.toArray();
                        let baseName = targetProductName.split('-')[0].trim();
                        prod = allProducts.find(p => p.product_name === targetProductName || p.product_name === baseName);
                        if (prod && prod.usage_cycle_days) cycleDays = prod.usage_cycle_days;
                    }

                    let standardDose = 2; 
                    let isStandardUnit = true;
                    
                    if (prod) {
                        if (prod.inner_unit === 'Gram' || prod.inner_unit === 'Khác' || prod.inner_unit === 'Ml') {
                            isStandardUnit = false;
                        }
                        if (prod.dosage_per_day) {
                            let d = prod.dosage_per_day.toString();
                            if (d.includes('-')) {
                                let parts = d.split('-');
                                standardDose = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                            } else {
                                standardDose = parseFloat(d) || 2;
                            }
                        }
                    }

                    let remainingUnits = null;
                    let parsedUnitName = '';
                    if (remainingBoxes === null) {
                        const unitRegex = /c(?:ò|o)n\s*(?:khoảng\s*)?(\d+(?:\.\d+)?)\s*(viên|gói|gram|ml|cốc|lọ|tuýp)/i;
                        const uMatch = rawNote.match(unitRegex);
                        if (uMatch) {
                            remainingUnits = parseFloat(uMatch[1]);
                            parsedUnitName = uMatch[2].toLowerCase();
                        }
                    }
                    
                    // Bước 2: So sánh và tra cứu sl/đơn vị nhập thủ công với thông tin sản phẩm
                    let actualCycle = cycleDays;
                    let systemAppend = '';
                    let unitText = 'lần';

                    let resetCycle = false;
                    const noteTextLower = (rawNote || '').toLowerCase();
                    if (noteTextLower.includes('liều chuẩn') || noteTextLower.includes('liều mặc định')) {
                        resetCycle = true;
                        updateData.custom_cycle_days = null; // force clear in DB
                        actualCycle = cycleDays;
                    }

                    if (dailyDosage !== null && dailyDosage > 0) {
                        const unitInput = document.getElementById('care-note-unit');
                        if (unitInput && unitInput.value) unitText = unitInput.value;

                        let usedProductSettings = false;
                        
                        if (prod) {
                            if (prod.quantity_per_unit && isStandardUnit) {
                                actualCycle = parseFloat(prod.quantity_per_unit) / dailyDosage;
                                usedProductSettings = true;
                            } else if (!isStandardUnit) {
                                usedProductSettings = true;
                                actualCycle = cycleDays;
                            }
                        }
                        
                        if (!usedProductSettings) {
                            actualCycle = (standardDose / dailyDosage) * cycleDays;
                        }
                        
                        if (actualCycle <= 0 || isNaN(actualCycle)) {
                            actualCycle = cycleDays;
                        }
                        
                        updateData.custom_cycle_days = actualCycle;
                        systemAppend += `liều dùng ${dailyDosage} ${unitText.toLowerCase()}/ngày`;
                    } else if (customer.custom_cycle_days && !resetCycle) {
                        actualCycle = customer.custom_cycle_days;
                        if (actualCycle > cycleDays * 5 && cycleDays > 0) {
                            actualCycle = cycleDays;
                        }
                    }
                    
                    if (resetCycle) {
                         if (systemAppend) systemAppend += ', ';
                         systemAppend += 'Áp dụng liều chuẩn';
                    }

                    if (remainingBoxes !== null) {
                        const newEndDate = baseDate ? new Date(baseDate) : new Date();
                        newEndDate.setDate(newEndDate.getDate() + (remainingBoxes * actualCycle));
                        const isoDate = newEndDate.toISOString().split('T')[0];
                        updateData.estimated_product_end_date = isoDate;
                        const bdFormatted = baseDate ? Utils.formatDate(baseDate) : Utils.formatDate(Utils.today());
                        systemAppend = `Khách còn ${remainingBoxes} hộp (tính từ ${bdFormatted})${systemAppend ? ', ' + systemAppend : ''} -> Lùi hạn đến ${Utils.formatDate(isoDate)}`;
                        updateData.expiry_formula = `${bdFormatted} còn ${remainingBoxes} hộp x ${actualCycle} = ${remainingBoxes * actualCycle} ngày (ngày dự kiến hết sp ${Utils.formatDate(isoDate)})`;
                    } else if (remainingUnits !== null) {
                        let doseToUse = (dailyDosage !== null && dailyDosage > 0) ? dailyDosage : standardDose;
                        if (doseToUse <= 0) doseToUse = 2; 
                        let calculatedDays = Math.ceil(remainingUnits / doseToUse);
                        const newEndDate = baseDate ? new Date(baseDate) : new Date();
                        newEndDate.setDate(newEndDate.getDate() + calculatedDays);
                        const isoDate = newEndDate.toISOString().split('T')[0];
                        updateData.estimated_product_end_date = isoDate;
                        const bdFormatted = baseDate ? Utils.formatDate(baseDate) : Utils.formatDate(Utils.today());
                        systemAppend = `Khách còn ${remainingUnits} ${parsedUnitName} (tính từ ${bdFormatted})${systemAppend ? ', ' + systemAppend : ''} -> Lùi thêm ${calculatedDays} ngày (đến ${Utils.formatDate(isoDate)})`;
                        updateData.expiry_formula = `${bdFormatted} còn ${remainingUnits} ${parsedUnitName} / ${doseToUse} = ${calculatedDays} ngày (ngày dự kiến hết sp ${Utils.formatDate(isoDate)})`;
                    } else if (updateData.custom_cycle_days) {
                         systemAppend = `Cập nhật liều dùng: ${dailyDosage} ${unitText.toLowerCase()}/ngày`;
                    }

                    if (Object.keys(updateData).length > 0) {
                        await DB.updateCustomer(customerId, updateData);
                        if (systemAppend && !isAiEnabled) {
                             const logs = await DB.db.care_logs.where('customer_id').equals(customerId).toArray();
                             if (logs.length > 0) {
                                 const latestLog = logs[logs.length - 1];
                                 latestLog.note += `\n[Hệ thống: ${systemAppend}]`;
                                 await DB.db.care_logs.put(latestLog);
                             }
                        }
                    }
                }
            }

            this.viewCustomer(customerId, 'traodoi');

            if (window.CareModule && typeof CareModule.render === 'function') {
                if (document.getElementById('page-care')?.classList.contains('active')) {
                    CareModule.render();
                }
            }
            this.render();
        } catch (err) {
            Utils.showToast('Lỗi lưu ghi chú: ' + err.message, 'error');
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.textContent = isAiEnabled ? 'Phân tích & Lưu' : 'Lưu trao đổi';
            }
        }
    },

    async confirmDelete(id) {
        const ok = await Utils.confirm('Xóa khách hàng', 'Bạn có chắc chắn muốn xóa khách hàng này? Hành động này không thể hoàn tác.', '🗑️');
        if (ok) {
            await DB.deleteCustomer(id);
            Utils.showToast('Đã xóa khách hàng', 'success');
            this.render();
            DashboardModule.render();
        }
    },

    initEvents() {
        document.getElementById('btn-add-customer')?.addEventListener('click', () => this.showForm());

        const debouncedSearch = Utils.debounce(() => { this.currentPage = 1; this.render(); }, 300);
        const searchInput = document.getElementById('customer-search');
        if (searchInput) searchInput.addEventListener('input', debouncedSearch);

        const filterStatus = document.getElementById('customer-filter-status');
        const filterSource = document.getElementById('customer-filter-source');
        const filterCare = document.getElementById('customer-filter-care');
        const filterProduct = document.getElementById('customer-filter-product');

        if (filterStatus) filterStatus.addEventListener('change', () => { this.currentPage = 1; this.render(); });
        if (filterSource) filterSource.addEventListener('change', () => { this.currentPage = 1; this.render(); });
        if (filterCare) filterCare.addEventListener('change', () => { this.currentPage = 1; this.render(); });
        if (filterProduct) filterProduct.addEventListener('change', () => { this.currentPage = 1; this.render(); });

        const filterTime = document.getElementById('customer-filter-time');
        const customDate = document.getElementById('customer-custom-date');
        if (filterTime && customDate) {
            filterTime.addEventListener('change', (e) => {
                customDate.style.display = e.target.value === 'custom' ? 'flex' : 'none';
                if (e.target.value !== 'custom') {
                    this.currentPage = 1; this.render();
                }
            });
            document.getElementById('customer-date-from')?.addEventListener('change', () => {
                if (document.getElementById('customer-date-to')?.value) { this.currentPage = 1; this.render(); }
            });
            document.getElementById('customer-date-to')?.addEventListener('change', () => {
                if (document.getElementById('customer-date-from')?.value) { this.currentPage = 1; this.render(); }
            });
        }

        // Sort
        document.querySelectorAll('#customers-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (this.sortField === field) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
                else { this.sortField = field; this.sortDir = 'asc'; }
                document.querySelectorAll('#customers-table th.sortable').forEach(t => t.classList.remove('sorted-asc', 'sorted-desc'));
                th.classList.add(this.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
                this.render();
            });
        });
    },

    async editCareNote(logId, customerId) {
        const logs = await DB.getCareLogsByCustomer(customerId);
        const log = logs.find(l => l.id === logId);
        if (!log) return;

        let dateValue = '';
        if (log.created_at) {
            const d = new Date(log.created_at);
            if (!isNaN(d.getTime())) {
                const tzoffset = d.getTimezoneOffset() * 60000;
                dateValue = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
            }
        } else if (log.care_date) {
            dateValue = log.care_date + 'T00:00';
        }

        const html = `
            <div class="form-group" style="margin-bottom:12px;">
                <label>Thời gian trao đổi</label>
                <input type="datetime-local" id="edit-care-note-time" class="input-field" style="width:100%;" value="${dateValue}">
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label>Kênh trao đổi</label>
                <select id="edit-care-note-type" class="input-field" style="width:100%;">
                    <option value="Gọi điện" ${log.care_type === 'Gọi điện' ? 'selected' : ''}>📞 Gọi điện</option>
                    <option value="Nhắn tin Zalo" ${log.care_type === 'Nhắn tin Zalo' ? 'selected' : ''}>💬 Nhắn tin Zalo</option>
                    <option value="Gặp trực tiếp" ${log.care_type === 'Gặp trực tiếp' ? 'selected' : ''}>🤝 Gặp trực tiếp</option>
                    <option value="Khác" ${log.care_type === 'Khác' ? 'selected' : ''}>📝 Khác</option>
                </select>
            </div>
            <div class="form-group">
                <label>Nội dung ghi chú</label>
                <textarea id="edit-care-note-input" class="input-field" rows="5" style="width:100%;resize:vertical;">${Utils.escapeHtml(log.note)}</textarea>
            </div>
        `;

        const footer = `
            <button class="btn-secondary" onclick="Utils.closeModal()">Hủy</button>
            <button class="btn-primary" onclick="CustomersModule.saveEditedCareNote(${logId}, ${customerId})">Lưu thay đổi</button>
        `;

        Utils.openModal('Sửa ghi chú trao đổi', html, footer, 'md');
    },

    async saveEditedCareNote(logId, customerId) {
        const input = document.getElementById('edit-care-note-input');
        const typeSelect = document.getElementById('edit-care-note-type');
        const timeInput = document.getElementById('edit-care-note-time');
        if (!input || !typeSelect) return;

        const newNote = input.value.trim();
        const newType = typeSelect.value;
        if (!newNote) {
            Utils.showToast('Nội dung không được để trống', 'error');
            return;
        }

        const updates = { note: newNote, care_type: newType };

        if (timeInput && timeInput.value) {
            const dateObj = new Date(timeInput.value);
            if (!isNaN(dateObj.getTime())) {
                updates.created_at = dateObj.toISOString();
                updates.care_date = updates.created_at.split('T')[0];
            }
        }

        try {
            await DB.updateCareLog(logId, updates);
            Utils.showToast('Đã cập nhật ghi chú', 'success');
            Utils.closeModal();
            this.viewCustomer(customerId, 'traodoi');
        } catch (e) {
            Utils.showToast('Lỗi: ' + e.message, 'error');
        }
    },

    toggleDeleteMode() {
        const checkboxes = document.querySelectorAll('.care-log-delete-cb');
        const deleteBar = document.getElementById('care-note-delete-bar');
        if (!checkboxes.length || !deleteBar) return;

        const isDeleteMode = deleteBar.style.display !== 'none';
        if (isDeleteMode) {
            // Tắt chế độ xóa
            deleteBar.style.display = 'none';
            checkboxes.forEach(cb => {
                cb.style.display = 'none';
                cb.checked = false;
            });
        } else {
            // Bật chế độ xóa
            deleteBar.style.display = 'flex';
            checkboxes.forEach(cb => cb.style.display = 'block');
            this.updateSelectedCount();
        }
    },

    updateSelectedCount() {
        const count = document.querySelectorAll('.care-log-delete-cb:checked').length;
        const countEl = document.getElementById('care-note-selected-count');
        if (countEl) countEl.innerText = count;
    },

    async deleteSelectedCareNotes(customerId) {
        const checked = document.querySelectorAll('.care-log-delete-cb:checked');
        if (checked.length === 0) {
            Utils.showToast('Vui lòng chọn ít nhất một ghi chú để xóa', 'warning');
            return;
        }

        if (!confirm(`Bạn có chắc chắn muốn xóa ${checked.length} ghi chú đã chọn?`)) return;

        try {
            for (let cb of checked) {
                await DB.deleteCareLog(parseInt(cb.value));
            }
            Utils.showToast(`Đã xóa ${checked.length} ghi chú`, 'success');
            this.renderCustomerDetailPage(customerId);
        } catch (e) {
            Utils.showToast('Lỗi: ' + e.message, 'error');
        }
    },

    // ===== APPOINTMENTS =====
    async showAppointmentForm(customerId, appointmentId = null) {
        let appointment = null;
        if (appointmentId) {
            appointment = await DB.db.appointments.get(appointmentId);
        }

        const html = `
            <style>
                #appointment-date::-webkit-calendar-picker-indicator {
                    display: none;
                    -webkit-appearance: none;
                }
            </style>
            <div class="form-group" style="margin-bottom:12px;">
                <label style="display:flex; align-items:center;">
                    Ngày giờ hẹn 
                    <span style="cursor:pointer; font-size:16px; margin-left:8px;" onclick="document.getElementById('appointment-date').showPicker()" title="Chọn ngày giờ">📅</span>
                </label>
                <input type="datetime-local" id="appointment-date" class="input-field" style="width:100%;" required value="${appointment ? appointment.appointment_date : ''}">
            </div>
            <div class="form-group">
                <label>Nội dung ghi chú</label>
                <textarea id="appointment-note" class="input-field" rows="4" style="width:100%;resize:vertical;" placeholder="Ví dụ: Gọi lại tư vấn thêm về liệu trình...">${appointment ? Utils.escapeHtml(appointment.note || '') : ''}</textarea>
            </div>
        `;
        const footer = `
            <button class="btn-primary" onclick="CustomersModule.saveAppointment(${customerId}, ${appointmentId || 'null'})">Lưu lịch hẹn</button>
            <button class="btn-secondary" onclick="Utils.closeModal()">Hủy</button>
        `;
        Utils.openModal(appointment ? 'Sửa lịch hẹn' : 'Thêm lịch hẹn mới', html, footer);
    },

    async saveAppointment(customerId, appointmentId = null) {
        const dateInput = document.getElementById('appointment-date');
        const noteInput = document.getElementById('appointment-note');
        if (!dateInput || !noteInput) return;

        const dateVal = dateInput.value;
        const noteVal = noteInput.value.trim();

        if (!dateVal) {
            Utils.showToast('Vui lòng chọn ngày giờ hẹn', 'error');
            return;
        }

        try {
            if (appointmentId) {
                await DB.updateAppointment(appointmentId, {
                    appointment_date: dateVal,
                    note: noteVal,
                    updated_at: new Date().toISOString()
                });
                Utils.showToast('Đã cập nhật lịch hẹn', 'success');
            } else {
                await DB.addAppointment({
                    customer_id: customerId,
                    appointment_date: dateVal,
                    note: noteVal,
                    status: 'pending'
                });
                Utils.showToast('Đã lưu lịch hẹn', 'success');
            }
            Utils.closeModal();
            this.viewCustomer(customerId, 'lichhen');
        } catch (e) {
            Utils.showToast('Lỗi: ' + e.message, 'error');
        }
    },

    async completeAppointment(id, customerId) {
        if (!confirm('Bạn có chắc chắn muốn đánh dấu hoàn thành lịch hẹn này?')) return;
        try {
            await DB.updateAppointment(id, { status: 'completed' });
            Utils.showToast('Đã đánh dấu hoàn thành', 'success');
            this.viewCustomer(customerId, 'lichhen');
        } catch (e) {
            Utils.showToast('Lỗi: ' + e.message, 'error');
        }
    },

    async deleteAppointment(id, customerId) {
        if (!confirm('Bạn có chắc chắn muốn xóa lịch hẹn này không?')) return;
        try {
            await DB.deleteAppointment(id);
            Utils.showToast('Đã xóa lịch hẹn', 'success');
            this.viewCustomer(customerId, 'lichhen');
        } catch (e) {
            Utils.showToast('Lỗi: ' + e.message, 'error');
        }
    }
};
