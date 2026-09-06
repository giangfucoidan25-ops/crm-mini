/* ===================================================================
   CRM MINI — PRODUCTS MODULE
   Quản lý sản phẩm thực phẩm chức năng
   =================================================================== */

const ProductsModule = {
    currentPage: 1,
    pageSize: 12,

    async render() {
        let products = await DB.getAllProducts();
        const search = (document.getElementById('product-search')?.value || '').toLowerCase();
        const sortBy = document.getElementById('product-sort')?.value || '';

        if (search) products = products.filter(p => (p.product_name || '').toLowerCase().includes(search));

        // Sorting
        switch (sortBy) {
            case 'price_asc': products.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
            case 'price_desc': products.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
            case 'cycle_asc': products.sort((a, b) => (a.usage_cycle_days || 0) - (b.usage_cycle_days || 0)); break;
        }

        const total = products.length;
        const totalPages = Math.ceil(total / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize;
        const pageData = products.slice(start, start + this.pageSize);

        const grid = document.getElementById('products-grid');
        if (pageData.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Chưa có sản phẩm nào</div>';
        } else {
            grid.innerHTML = pageData.map(p => `
                <div class="product-card glass-card">
                    <div class="product-card-header">
                        <div>
                            <div class="product-name">${Utils.escapeHtml(p.product_name)}</div>
                        </div>
                        <div class="product-price">${Utils.formatCurrency(p.price)}</div>
                    </div>
                    <div class="product-details">
                        <div class="product-detail-item"><span>Đơn vị</span><strong>${p.unit_name || '—'}</strong></div>
                        <div class="product-detail-item"><span>SL/đơn vị</span><strong>${p.quantity_per_unit || '—'} ${p.inner_unit && p.inner_unit !== 'Khác' ? p.inner_unit : ''}</strong></div>
                        <div class="product-detail-item"><span>Liều/ngày</span><strong>${p.dosage_per_day || '—'}</strong></div>
                        <div class="product-detail-item"><span>Chu kỳ</span><strong>${p.usage_cycle_days || '—'} ngày</strong></div>
                        <div class="product-detail-item"><span>Cảnh báo trước</span><strong>${p.reorder_reminder_days || '—'} ngày</strong></div>
                    </div>
                    ${p.usage_instruction ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">📋 ${Utils.escapeHtml(p.usage_instruction)}</div>` : ''}
                    <div class="product-card-actions">
                        <button class="btn-secondary btn-sm" onclick="ProductsModule.editProduct(\'${p.id}\')">✏️ Sửa</button>
                        <button class="btn-secondary btn-sm" onclick="ProductsModule.confirmDelete(\'${p.id}\')" style="color:var(--color-danger);">🗑️ Xóa</button>
                    </div>
                </div>
            `).join('');
        }

        Utils.renderPagination('products-pagination', this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.render();
        });
    },

    showForm(product = null) {
        const isEdit = !!product;
        const p = product || {};
        
        // Tính toán chu kỳ mặc định nếu là chỉnh sửa
        let calculatedCycle = 30;
        let maxDosage = 1;
        const numbers = (p.dosage_per_day || '').match(/\d+(\.\d+)?/g);
        if (numbers && numbers.length > 0) {
            maxDosage = Math.max(...numbers.map(n => parseFloat(n)));
        }
        if ((p.quantity_per_unit || 0) > 0 && maxDosage > 0) {
            calculatedCycle = Math.floor(p.quantity_per_unit / maxDosage);
        }
        
        // Nếu tạo mới, hoặc chu kỳ đã lưu TRÙNG với chu kỳ tự động tính => Bật Auto
        const isAuto = !isEdit || p.usage_cycle_days === calculatedCycle || !p.usage_cycle_days;

        const html = `
            <div class="form-row">
                <div class="form-group"><label>Tên sản phẩm *</label><input type="text" id="fp-name" class="input-field" value="${Utils.escapeHtml(p.product_name || '')}"></div>
                <div class="form-group"><label>Giá bán (VNĐ) *</label><input type="number" id="fp-price" class="input-field" value="${p.price || ''}"></div>
            </div>
            <div class="form-row-3">
                <div class="form-group"><label>Đơn vị tính</label><input type="text" id="fp-unit" class="input-field" value="${p.unit_name || 'Hộp'}"></div>
                <div class="form-group"><label>SL/đơn vị</label>
                    <div style="display:flex; gap:4px;">
                        <input type="number" id="fp-qty" class="input-field" value="${p.quantity_per_unit || ''}" style="flex:1;" placeholder="VD: 30" onkeyup="ProductsModule.calcCycle()" onchange="ProductsModule.calcCycle()">
                        <select id="fp-inner-unit" class="input-field" style="flex:1; padding: 0 4px;" onchange="document.getElementById('lbl-dosage-unit').textContent = this.value + '/ngày'">
                            <option value="Viên" ${p.inner_unit === 'Viên' ? 'selected' : ''}>Viên</option>
                            <option value="Gói" ${p.inner_unit === 'Gói' ? 'selected' : ''}>Gói</option>
                            <option value="Cốc" ${p.inner_unit === 'Cốc' ? 'selected' : ''}>Cốc</option>
                            <option value="Gram" ${p.inner_unit === 'Gram' ? 'selected' : ''}>Gram</option>
                            <option value="Khác" ${!['Viên','Gói','Cốc','Gram'].includes(p.inner_unit) ? 'selected' : ''}>Khác</option>
                        </select>
                    </div>
                </div>
                <div class="form-group"><label>Liều dùng/ngày</label>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <input type="text" id="fp-dosage" class="input-field" value="${p.dosage_per_day || ''}" placeholder="VD: 4-6" style="flex:2;" onkeyup="ProductsModule.calcCycle()">
                        <span style="font-size:12px; color:var(--text-muted); flex:1; white-space:nowrap;" id="lbl-dosage-unit">${p.inner_unit || 'Viên'}/ngày</span>
                    </div>
                </div>
            </div>
            <div class="form-row-3">
                <div class="form-group">
                    <label style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        Chu kỳ (ngày)
                        <label style="font-weight:normal; font-size:11px; cursor:pointer; display:flex; align-items:center; gap:4px; color:var(--color-primary);">
                            <input type="checkbox" id="fp-auto-cycle" ${isAuto ? 'checked' : ''} onchange="ProductsModule.toggleAutoCycle()"> Tự động tính
                        </label>
                    </label>
                    <input type="number" id="fp-cycle" class="input-field" value="${p.usage_cycle_days || calculatedCycle}" ${isAuto ? 'readonly' : ''} style="${isAuto ? 'background:var(--bg-secondary);' : ''}">
                </div>
                <div class="form-group"><label>Cảnh báo trước (ngày)</label><input type="number" id="fp-remind" class="input-field" value="${p.reorder_reminder_days || 5}"></div>
                <div class="form-group"><label>Cách dùng</label><input type="text" id="fp-usage" class="input-field" value="${Utils.escapeHtml(p.usage_instruction || '')}"></div>
            </div>
            <div class="form-group"><label>Mô tả</label><textarea id="fp-desc" class="input-field" rows="2">${Utils.escapeHtml(p.description || '')}</textarea></div>
            <div class="form-group"><label>Ghi chú tư vấn</label><textarea id="fp-note" class="input-field" rows="2">${Utils.escapeHtml(p.note || '')}</textarea></div>
        `;
        const footer = `
            <button class="btn-secondary" onclick="Utils.closeModal()">Hủy</button>
            <button class="btn-primary" onclick="ProductsModule.saveProduct(${isEdit ? p.id : 'null'})">${isEdit ? 'Cập nhật' : 'Thêm mới'}</button>
        `;
        Utils.openModal(isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới', html, footer, 'lg');
    },

    toggleAutoCycle() {
        const isAuto = document.getElementById('fp-auto-cycle').checked;
        const cycleInput = document.getElementById('fp-cycle');
        cycleInput.readOnly = isAuto;
        cycleInput.style.background = isAuto ? 'var(--bg-secondary)' : '';
        if (isAuto) {
            this.calcCycle();
        }
    },

    calcCycle() {
        const isAuto = document.getElementById('fp-auto-cycle').checked;
        if (!isAuto) return;

        const qtyPerUnit = parseInt(document.getElementById('fp-qty').value) || 0;
        const dosageStr = document.getElementById('fp-dosage').value.trim();
        
        let calculatedCycle = 30;
        let maxDosage = 1;
        const numbers = dosageStr.match(/\d+(\.\d+)?/g);
        if (numbers && numbers.length > 0) {
            maxDosage = Math.max(...numbers.map(n => parseFloat(n)));
        }
        if (qtyPerUnit > 0 && maxDosage > 0) {
            calculatedCycle = Math.floor(qtyPerUnit / maxDosage);
        }
        document.getElementById('fp-cycle').value = calculatedCycle;
    },

    async saveProduct(id) {
        const name = document.getElementById('fp-name').value.trim();
        if (!name) { Utils.showToast('Vui lòng nhập tên sản phẩm', 'error'); return; }
        const qtyPerUnit = parseInt(document.getElementById('fp-qty').value) || 0;
        const dosageStr = document.getElementById('fp-dosage').value.trim();
        const cycle = parseInt(document.getElementById('fp-cycle').value) || 30;

        const data = {
            product_name: name,
            price: parseFloat(document.getElementById('fp-price').value) || 0,
            unit_name: document.getElementById('fp-unit').value.trim(),
            inner_unit: document.getElementById('fp-inner-unit').value,
            quantity_per_unit: qtyPerUnit,
            dosage_per_day: dosageStr,
            usage_cycle_days: cycle,
            reorder_reminder_days: parseInt(document.getElementById('fp-remind').value) || 5,
            usage_instruction: document.getElementById('fp-usage').value.trim(),
            description: document.getElementById('fp-desc').value.trim(),
            note: document.getElementById('fp-note').value.trim()
        };
        try {
            if (id) { await DB.updateProduct(id, data); Utils.showToast('Đã cập nhật sản phẩm', 'success'); }
            else { await DB.addProduct(data); Utils.showToast('Đã thêm sản phẩm mới', 'success'); }
            Utils.closeModal();
            this.render();
        } catch (err) { Utils.showToast('Lỗi: ' + err.message, 'error'); }
    },

    async editProduct(id) {
        const p = await DB.getProduct(id);
        if (p) this.showForm(p);
    },

    async confirmDelete(id) {
        const ok = await Utils.confirm('Xóa sản phẩm', 'Bạn có chắc chắn muốn xóa sản phẩm này?', '🗑️');
        if (ok) { await DB.deleteProduct(id); Utils.showToast('Đã xóa sản phẩm', 'success'); this.render(); }
    },

    initEvents() {
        document.getElementById('btn-add-product')?.addEventListener('click', () => this.showForm());
        const debouncedSearch = Utils.debounce(() => this.render(), 300);
        document.getElementById('product-search')?.addEventListener('input', debouncedSearch);
        document.getElementById('product-sort')?.addEventListener('change', () => { this.currentPage = 1; this.render(); });
    }
};
