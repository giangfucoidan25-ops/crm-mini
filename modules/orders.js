/* ===================================================================
   CRM MINI — ORDERS MODULE
   Quản lý đơn hàng, tạo đơn, tính ngày hết SP
   =================================================================== */

const OrdersModule = {
    currentPage: 1,
    pageSize: 20,
    itemIndex: 0,
    productsList: [],

    async render() {
        const products = await DB.getAllProducts();
        const filterSelect = document.getElementById('order-filter-product');
        if (filterSelect) {
            const currentVal = filterSelect.value;
            filterSelect.innerHTML = '<option value="all">Tất cả sản phẩm</option>' + 
                products.map(p => `<option value="${p.product_name}">${p.product_name}</option>`).join('');
            filterSelect.value = currentVal;
            if (!filterSelect.value) filterSelect.value = 'all';
        }

        let orders = await DB.getAllOrders();
        const search = (document.getElementById('order-search')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('order-filter-status')?.value || 'all';
        const productFilter = document.getElementById('order-filter-product')?.value || 'all';
        const timeFilter = document.getElementById('order-filter-time')?.value || '';

        if (search) {
            const customers = await DB.getAllCustomers();
            const customerMap = {};
            customers.forEach(c => customerMap[c.id] = c);
            orders = orders.filter(o => {
                const cust = customerMap[o.customer_id];
                return (cust && cust.full_name.toLowerCase().includes(search)) ||
                    (o.product_name || '').toLowerCase().includes(search);
            });
        }
        if (statusFilter && statusFilter !== 'all') orders = orders.filter(o => o.order_status === statusFilter);
        if (productFilter !== 'all') orders = orders.filter(o => o.product_name && o.product_name.includes(productFilter));
        if (timeFilter) {
            const range = Utils.getDateRange(timeFilter,
                document.getElementById('order-date-from')?.value,
                document.getElementById('order-date-to')?.value
            );
            if (range.from && range.to) {
                orders = orders.filter(o => o.order_date >= range.from && o.order_date <= range.to);
            }
        }

        orders.sort((a, b) => {
            const dateA = a.order_date || '';
            const dateB = b.order_date || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return (b.id || 0) - (a.id || 0);
        });

        // Get customer names
        const customers = await DB.getAllCustomers();
        const customerMap = {};
        customers.forEach(c => customerMap[c.id] = c);

        const total = orders.length;
        const totalPages = Math.ceil(total / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize;
        const pageData = orders.slice(start, start + this.pageSize);

        const tbody = document.getElementById('orders-tbody');
        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Không có đơn hàng nào</td></tr>';
        } else {
            tbody.innerHTML = pageData.map(o => {
                const cust = customerMap[o.customer_id];
                const expiryStatus = Utils.getProductExpiryStatus(o.estimated_product_end_date, o.expiry_formula);
                return `
                <tr>
                    <td>${Utils.formatDate(o.order_date)}</td>
                    <td>
                        ${cust ? `<strong style="cursor:pointer;" onclick="CustomersModule.viewCustomer(${cust.id})">${Utils.escapeHtml(cust.full_name)}</strong>` : 'N/A'}
                        ${Utils.getGetFlyLink(cust)}
                    </td>
                    <td>${Utils.escapeHtml(o.product_name || '')}</td>
                    <td>${o.quantity || 0}</td>
                    <td style="font-weight:600;">${Utils.formatCurrency(o.total_amount)}</td>
                    <td><span class="status-badge order-${o.order_status}">${Utils.orderStatusLabel(o.order_status)}</span></td>
                    <td><span class="${expiryStatus.class}">${expiryStatus.label}</span></td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn btn-edit" onclick="OrdersModule.editOrder(${o.id})" title="Sửa">✏️</button>
                            <button class="action-btn btn-delete" onclick="OrdersModule.confirmDelete(${o.id})" title="Xóa">🗑</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        Utils.renderPagination('orders-pagination', this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.render();
        });
    },

    async showForm(order = null, defaultCustomerId = null) {
        const isEdit = !!order;
        const o = order || {};
        if (!isEdit && defaultCustomerId) {
            o.customer_id = defaultCustomerId;
        }
        const customers = await DB.getActiveCustomers();
        this.productsList = await DB.getAllProducts();

        let allPromos = await DB.getSetting('promotions_config');
        if (!allPromos || Object.keys(allPromos).length === 0) {
            allPromos = (typeof PromotionsModule !== 'undefined') ? PromotionsModule.defaultConfig : {};
        }

        let itemsHtml = '';
        if (isEdit && o.items && o.items.length > 0) {
            o.items.forEach(item => {
                if (!item.is_gift) {
                    const matchedProduct = this.productsList.find(p => p.id === item.product_id || p.product_name === item.product_name);
                    if (matchedProduct) item.unit_price = matchedProduct.price;

                    let split = false;
                    if (matchedProduct) {
                        let pKey = null;
                        const pName = matchedProduct.product_name.toLowerCase();
                        if (pName.includes('nutri nano')) pKey = 'nutri_nano';
                        else if (pName.includes('fucoidan nano')) pKey = 'fucoidan_nano';
                        else if (pName.includes('ancan')) pKey = 'ancan';
                        else if (pName.includes('fu 8') || pName.includes('fu8')) pKey = 'fu8';
                        
                        const productPromos = pKey ? allPromos[pKey] : null;
                        if (productPromos) {
                            const match = productPromos.find(i => (i.buy + i.get) === item.quantity);
                            if (match) {
                                itemsHtml += this.generateItemRowHtml({ ...item, quantity: match.buy });
                                itemsHtml += this.generateItemRowHtml({ ...item, quantity: match.get, unit_price: 0, is_gift: true });
                                split = true;
                            }
                        }
                    }
                    if (!split) itemsHtml += this.generateItemRowHtml(item);
                } else {
                    itemsHtml += this.generateItemRowHtml(item);
                }
            });
        } else {
            let trueUnitPrice = o.unit_price;
            let buyQty = o.quantity;
            let getQty = 0;

            if (isEdit) {
                const matchedProduct = this.productsList.find(p => p.id === o.product_id || p.product_name === o.product_name);
                if (matchedProduct) {
                    trueUnitPrice = matchedProduct.price;
                    let pKey = null;
                    const pName = matchedProduct.product_name.toLowerCase();
                    if (pName.includes('nutri nano')) pKey = 'nutri_nano';
                    else if (pName.includes('fucoidan nano')) pKey = 'fucoidan_nano';
                    else if (pName.includes('ancan')) pKey = 'ancan';
                    else if (pName.includes('fu 8') || pName.includes('fu8')) pKey = 'fu8';
                    
                    const productPromos = pKey ? allPromos[pKey] : null;
                    if (productPromos) {
                        const match = productPromos.find(i => (i.buy + i.get) === o.quantity);
                        if (match) {
                            buyQty = match.buy;
                            getQty = match.get;
                        }
                    }
                }
            }

            itemsHtml = this.generateItemRowHtml(isEdit ? {
                product_id: o.product_id,
                quantity: buyQty,
                unit_price: trueUnitPrice,
                is_gift: false
            } : {});
            
            if (getQty > 0) {
                itemsHtml += this.generateItemRowHtml({
                    product_id: o.product_id,
                    quantity: getQty,
                    unit_price: 0,
                    is_gift: true
                });
            }
        }

        const html = `
            <div class="form-row" style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div class="form-group" style="flex: 2; margin-bottom: 0;">
                    <label>Khách hàng *</label>
                    <select id="fo-customer" class="select-filter" style="width:100%;" ${(isEdit || defaultCustomerId) ? 'disabled' : ''}>
                        <option value="">-- Chọn khách hàng --</option>
                        ${customers.map(c => `<option value="${c.id}" ${o.customer_id === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.full_name)} (${c.phone || ''})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="flex: 1; margin-bottom: 0;">
                    <label>Ngày đặt hàng</label>
                    <input type="date" id="fo-date" class="input-field" value="${o.order_date || Utils.today()}" onchange="OrdersModule.calcTotal()">
                </div>
            </div>
            
            <div style="margin-bottom: 15px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight: 600;">Danh sách sản phẩm</span>
                <button type="button" class="btn-secondary btn-sm" onclick="OrdersModule.addItemRow()">+ Thêm sản phẩm</button>
            </div>
            
            <div style="display: flex; gap: 12px; padding: 10px 12px; border-bottom: 2px solid var(--border-color); font-weight: 600; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">
                <div style="flex: 4; min-width: 150px;">Sản phẩm *</div>
                <div style="flex: 1; min-width: 90px; text-align: center;">Số lượng</div>
                <div style="flex: 2; min-width: 90px; text-align: right;">Đơn giá</div>
                <div style="flex: 2; min-width: 90px; text-align: right;">Thành tiền</div>
                <div style="flex: 1; min-width: 60px; text-align: center;">Quà tặng</div>
                <div style="width: 38px;"></div>
            </div>

            <div id="order-items-container">
                ${itemsHtml}
            </div>

            <div style="display: flex; align-items: center; gap: 12px; padding: 0 12px; margin-top: 15px; margin-bottom: 15px;">
                <input type="hidden" id="fo-discount" value="${o.discount || 0}">
                <div style="flex: 4; min-width: 150px;"></div>
                <div style="flex: 1; min-width: 90px;"></div>
                <div style="flex: 2; min-width: 90px; display: flex; justify-content: flex-end;">
                    <span style="font-size: 14px; color: var(--text-secondary); font-weight: 600; white-space: nowrap;">Tổng tiền đơn hàng:</span>
                </div>
                <div style="flex: 2; min-width: 90px;">
                    <input type="text" id="fo-total" class="input-field" value="${Number(o.total_amount || 0).toLocaleString('vi-VN')}" readonly style="font-weight:700; color:var(--text-primary); font-size: 18px; text-align: right; border: none; background: transparent; padding: 0; width: 100%;">
                </div>
                <div style="flex: 1; min-width: 60px;"></div>
                <div style="width: 38px;"></div>
            </div>
            <div class="form-row" style="display: flex; gap: 16px;">
                <div class="form-group" style="flex: 1;">
                    <label>Trạng thái đơn hàng</label>
                    <select id="fo-status" class="select-filter" style="width:100%;">
                        ${['pending', 'awaiting_payment', 'shipping', 'completed', 'cancelled', 'returned']
                .map(s => `<option value="${s}" ${(o.order_status || 'pending') === s ? 'selected' : ''}>${Utils.orderStatusLabel(s)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="flex: 1;"><label>Ngày hết SP dự kiến</label><input type="date" id="fo-end-date" class="input-field" value="${o.estimated_product_end_date || ''}" readonly></div>
            </div>
            <div class="form-group"><label>Lý do hủy (nếu có)</label><input type="text" id="fo-cancel" class="input-field" value="${Utils.escapeHtml(o.cancel_reason || '')}"></div>
            <div class="form-group"><label>Ghi chú</label><textarea id="fo-note" class="input-field" rows="2">${Utils.escapeHtml(o.note || '')}</textarea></div>
        `;
        const footer = `
            <button class="btn-secondary" onclick="Utils.closeModal()">Hủy</button>
            <button class="btn-primary" onclick="OrdersModule.saveOrder(${isEdit ? o.id : 'null'})">${isEdit ? 'Cập nhật' : 'Tạo đơn hàng'}</button>
        `;
        Utils.openModal(isEdit ? 'Chỉnh sửa đơn hàng' : 'Tạo đơn hàng mới', html, footer, 'lg');
        
        setTimeout(() => this.calcTotal(), 50);
    },

    generateItemRowHtml(item = {}) {
        this.itemIndex++;
        const idx = this.itemIndex;
        return `
        <div class="form-row order-item-row" id="item-row-${idx}" data-index="${idx}" style="display: flex; align-items: center; margin-bottom: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border-color); flex-wrap: nowrap; overflow-x: auto; gap: 12px; background: transparent;">
            <div class="form-group" style="flex: 4; min-width: 150px; margin-bottom: 0;">
                <select class="select-filter item-product" style="width:100%; border: none; background: transparent; font-weight: 500; padding: 8px 0; font-size: 14px;" onchange="OrdersModule.onItemChange(${idx})">
                    <option value="">-- Chọn SP --</option>
                    ${this.productsList.map(p => `<option value="${p.id}" data-price="${p.price}" data-cycle="${p.usage_cycle_days}" ${item.product_id == p.id ? 'selected' : ''}>${Utils.escapeHtml(p.product_name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="flex: 1; min-width: 90px; margin-bottom: 0; display: flex; justify-content: center;">
                <div style="display: flex; align-items: center; background: var(--bg-secondary); border-radius: 20px; padding: 2px;">
                    <button type="button" onclick="OrdersModule.changeQty(${idx}, -1)" style="border:none; background:transparent; cursor:pointer; width: 28px; height: 28px; border-radius: 50%; font-weight: bold; color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-size: 16px;">-</button>
                    <input type="number" class="input-field item-qty" value="${item.quantity || 1}" min="1" onchange="OrdersModule.calcTotal()" style="width: 36px; text-align: center; border: none; background: transparent; padding: 0; font-weight: 500; -moz-appearance: textfield;">
                    <button type="button" onclick="OrdersModule.changeQty(${idx}, 1)" style="border:none; background:transparent; cursor:pointer; width: 28px; height: 28px; border-radius: 50%; font-weight: bold; color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-size: 16px;">+</button>
                </div>
            </div>
            <div class="form-group" style="flex: 2; min-width: 90px; margin-bottom: 0;">
                <input type="text" class="input-field item-price" value="${item.unit_price !== undefined ? Number(item.unit_price).toLocaleString('vi-VN') : ''}" onchange="OrdersModule.calcTotal()" ${item.is_gift ? 'readonly' : ''} style="text-align: right; border: none; background: var(--bg-secondary); border-radius: 8px; padding: 8px 12px; font-size: 14px;">
            </div>
            <div class="form-group" style="flex: 2; min-width: 90px; margin-bottom: 0;">
                <input type="text" class="input-field item-total" value="${Number(((item.quantity || 1) * (item.unit_price || 0)) || 0).toLocaleString('vi-VN')}" readonly style="text-align: right; border: none; background: transparent; font-weight: 700; padding: 8px 12px; font-size: 14px; color: var(--text-primary);">
            </div>
            <div class="form-group" style="flex: 1; min-width: 60px; margin-bottom: 0; display: flex; justify-content: center;">
                <input type="checkbox" class="item-gift" style="transform: scale(1.3); cursor: pointer;" onchange="OrdersModule.onItemChange(${idx})" ${item.is_gift ? 'checked' : ''}>
            </div>
            <div class="form-group" style="margin-bottom: 0; width: 38px; display: flex; justify-content: flex-end;">
                <button type="button" onclick="OrdersModule.removeItemRow(${idx})" style="color:var(--text-muted); background: transparent; border: none; font-size: 16px; cursor: pointer; padding: 8px;" title="Xóa">🗑️</button>
            </div>
        </div>
        `;
    },

    addItemRow() {
        const container = document.getElementById('order-items-container');
        container.insertAdjacentHTML('beforeend', this.generateItemRowHtml());
    },

    removeItemRow(idx) {
        const row = document.getElementById(`item-row-${idx}`);
        if (row) {
            row.remove();
            this.calcTotal();
        }
    },

    onItemChange(idx) {
        const row = document.getElementById(`item-row-${idx}`);
        if (!row) return;
        const select = row.querySelector('.item-product');
        const priceInput = row.querySelector('.item-price');
        const isGift = row.querySelector('.item-gift').checked;
        
        if (isGift) {
            priceInput.value = 0;
            priceInput.readOnly = true;
        } else {
            priceInput.readOnly = false;
            const option = select.options[select.selectedIndex];
            if (option && option.value) {
                priceInput.value = Number(option.dataset.price || 0).toLocaleString('vi-VN');
            } else {
                priceInput.value = '';
            }
        }
        this.calcTotal();
    },

    changeQty(idx, delta) {
        const row = document.getElementById(`item-row-${idx}`);
        if (!row) return;
        const qtyInput = row.querySelector('.item-qty');
        let val = parseInt(qtyInput.value) || 1;
        val += delta;
        if (val < 1) val = 1;
        qtyInput.value = val;
        this.calcTotal();
    },

    calcTotal() {
        let total = 0;
        let maxCycleDays = 0;
        
        const productQtys = {};

        document.querySelectorAll('.order-item-row').forEach(row => {
            const qty = parseInt(row.querySelector('.item-qty').value) || 0;
            const priceStr = row.querySelector('.item-price').value || '';
            const price = parseFloat(priceStr.replace(/[^\d]/g, '')) || 0;
            const itemTotal = qty * price;
            
            const totalInput = row.querySelector('.item-total');
            if (totalInput) {
                totalInput.value = Number(itemTotal || 0).toLocaleString('vi-VN');
            }
            
            total += itemTotal;
            
            const select = row.querySelector('.item-product');
            
            if (select.selectedIndex > 0) {
                const option = select.options[select.selectedIndex];
                const productId = option.value;
                const cycle = parseInt(option.dataset.cycle) || 0;
                
                if (cycle > 0) {
                    if (!productQtys[productId]) {
                        productQtys[productId] = { cycle: cycle, qty: 0 };
                    }
                    productQtys[productId].qty += qty;
                }
            }
        });

        for (const pid in productQtys) {
            const p = productQtys[pid];
            maxCycleDays = Math.max(maxCycleDays, p.cycle * p.qty);
        }

        const discount = parseFloat(document.getElementById('fo-discount')?.value) || 0;
        total = Math.max(0, total - discount);

        const totalInput = document.getElementById('fo-total');
        if (totalInput) totalInput.value = Number(total || 0).toLocaleString('vi-VN');
        
        const dateInput = document.getElementById('fo-date');
        const endDateInput = document.getElementById('fo-end-date');
        if (dateInput && endDateInput) {
            if (maxCycleDays > 0) {
                endDateInput.value = Utils.addDays(dateInput.value, maxCycleDays);
            } else {
                endDateInput.value = '';
            }
        }
    },

    async saveOrder(id) {
        const customerId = parseInt(document.getElementById('fo-customer').value);
        if (!customerId) { Utils.showToast('Vui lòng chọn khách hàng', 'error'); return; }

        const items = [];
        let hasError = false;
        document.querySelectorAll('.order-item-row').forEach(row => {
            const select = row.querySelector('.item-product');
            if (select.selectedIndex === 0) {
                hasError = true;
                return;
            }
            const option = select.options[select.selectedIndex];
            const priceStr = row.querySelector('.item-price').value || '';
            items.push({
                product_id: parseInt(option.value),
                product_name: option.text,
                quantity: parseInt(row.querySelector('.item-qty').value) || 1,
                unit_price: parseFloat(priceStr.replace(/[^\d]/g, '')) || 0,
                is_gift: row.querySelector('.item-gift').checked
            });
        });

        if (hasError || items.length === 0) {
            Utils.showToast('Vui lòng chọn sản phẩm cho tất cả các dòng', 'error');
            return;
        }

        const mainItem = items.find(i => !i.is_gift) || items[0];

        const data = {
            customer_id: customerId,
            items: items,
            product_id: mainItem.product_id,
            product_name: mainItem.product_name,
            order_date: document.getElementById('fo-date').value,
            quantity: items.reduce((sum, i) => sum + i.quantity, 0),
            unit_price: mainItem.unit_price,
            discount: parseFloat(document.getElementById('fo-discount').value) || 0,
            total_amount: parseFloat(document.getElementById('fo-total').value.replace(/[^\d]/g, '')) || 0,
            order_status: document.getElementById('fo-status').value,
            estimated_product_end_date: document.getElementById('fo-end-date').value,
            cancel_reason: document.getElementById('fo-cancel').value.trim(),
            note: document.getElementById('fo-note').value.trim()
        };

        try {
            if (id) { await DB.updateOrder(id, data); Utils.showToast('Đã cập nhật đơn hàng', 'success'); }
            else { await DB.addOrder(data); Utils.showToast('Đã tạo đơn hàng mới', 'success'); }
            Utils.closeModal();
            this.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();
            if (typeof App !== 'undefined' && App.currentPage === 'customer-detail' && typeof CustomersModule !== 'undefined') {
                CustomersModule.renderCustomerDetailPage();
            }
        } catch (err) { Utils.showToast('Lỗi: ' + err.message, 'error'); }
    },

    async editOrder(id) {
        const o = await DB.getOrder(id);
        if (o) this.showForm(o);
    },

    async confirmDelete(id) {
        const ok = await Utils.confirm('Xóa đơn hàng', 'Bạn có chắc chắn muốn xóa đơn hàng này?', '🗑️');
        if (ok) { 
            await DB.deleteOrder(id); 
            Utils.showToast('Đã xóa đơn hàng', 'success'); 
            this.render(); 
            if (typeof DashboardModule !== 'undefined') DashboardModule.render(); 
            if (typeof App !== 'undefined' && App.currentPage === 'customer-detail' && typeof CustomersModule !== 'undefined') {
                CustomersModule.renderCustomerDetailPage();
            }
        }
    },

    initEvents() {
        document.getElementById('btn-add-order')?.addEventListener('click', () => this.showForm());
        const debouncedSearch = Utils.debounce(() => this.render(), 300);
        document.getElementById('order-search')?.addEventListener('input', debouncedSearch);
        document.getElementById('order-filter-status')?.addEventListener('change', () => { this.currentPage = 1; this.render(); });
        document.getElementById('order-filter-product')?.addEventListener('change', () => { this.currentPage = 1; this.render(); });
        document.getElementById('order-filter-time')?.addEventListener('change', (e) => { 
            const custom = document.getElementById('order-custom-date');
            if (custom) custom.style.display = e.target.value === 'custom' ? 'flex' : 'none';
            this.currentPage = 1; this.render(); 
        });
        document.getElementById('order-date-from')?.addEventListener('change', () => { this.currentPage = 1; this.render(); });
        document.getElementById('order-date-to')?.addEventListener('change', () => { this.currentPage = 1; this.render(); });
    }
};
