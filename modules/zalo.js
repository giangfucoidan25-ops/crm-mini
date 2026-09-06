/* ===================================================================
   CRM MINI — ZALO MODULE
   Quản lý mẫu tin nhắn, copy tin, mở link Zalo
   =================================================================== */

const ZaloModule = {
    async render() {
        await this.renderTemplates();
        await this.populateCustomerSelect();
        await this.populateTemplateSelect();
    },

    async renderTemplates() {
        const templates = await DB.getAllTemplates();
        const container = document.getElementById('templates-list');

        if (templates.length === 0) {
            container.innerHTML = '<p class="empty-state">Chưa có mẫu tin nhắn</p>';
            return;
        }

        container.innerHTML = templates.map(t => `
            <div class="template-item" data-id="${t.id}" onclick="ZaloModule.selectTemplate(\'${t.id}\')">
                <div class="template-name">${Utils.escapeHtml(t.template_name)}</div>
                <div class="template-preview">${Utils.escapeHtml((t.content || '').substring(0, 80))}...</div>
                <div class="template-actions">
                    <button class="action-btn btn-edit" onclick="event.stopPropagation(); ZaloModule.editTemplate(\'${t.id}\')" title="Sửa">✏️</button>
                    <button class="action-btn btn-delete" onclick="event.stopPropagation(); ZaloModule.deleteTemplate(\'${t.id}\')" title="Xóa">🗑</button>
                </div>
            </div>
        `).join('');
    },

    async populateCustomerSelect() {
        const customers = await DB.getActiveCustomers();
        const select = document.getElementById('zalo-customer-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- Chọn khách hàng --</option>' +
            customers.map(c => `<option value="${c.id}">${Utils.escapeHtml(Utils.formatName(c.full_name))} (${c.phone || ''})</option>`).join('');
    },

    async populateTemplateSelect() {
        const templates = await DB.getAllTemplates();
        const select = document.getElementById('zalo-template-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- Chọn mẫu --</option>' +
            templates.map(t => `<option value="${t.id}">${Utils.escapeHtml(t.template_name)}</option>`).join('');
    },

    async selectTemplate(id) {
        const template = await DB.db.message_templates.get(id);
        if (!template) return;

        document.querySelectorAll('.template-item').forEach(el => el.classList.remove('active'));
        document.querySelector(`.template-item[data-id="${id}"]`)?.classList.add('active');

        const select = document.getElementById('zalo-template-select');
        if (select) select.value = id;

        await this.updateMessageContent();
    },

    async updateMessageContent() {
        const templateId = parseInt(document.getElementById('zalo-template-select')?.value);
        const customerId = parseInt(document.getElementById('zalo-customer-select')?.value);

        if (!templateId) return;

        const template = await DB.db.message_templates.get(templateId);
        if (!template) return;

        let content = template.content || '';

        if (customerId) {
            const customer = await DB.getCustomer(customerId);
            if (customer) {
                content = Utils.parseTemplate(content, {
                    ten_khach: customer.full_name,
                    san_pham: customer.last_product_used || '[Sản phẩm]',
                    so_dien_thoai: customer.phone || '',
                    ngay_het: customer.estimated_product_end_date ? Utils.formatDate(customer.estimated_product_end_date) : '[Ngày hết SP]',
                    nguon: Utils.sourceLabel(customer.customer_source)
                });
            }
        }

        document.getElementById('zalo-message-content').value = content;
    },

    openZalo(phone) {
        if (!phone) { Utils.showToast('Không có số điện thoại', 'warning'); return; }
        const primary = Utils.getPrimaryPhone(phone);
        const cleanPhone = primary.replace(/\D/g, '');
        window.open(`https://zalo.me/${cleanPhone}`, '_blank');
    },

    async quickCopyMessage(customerId) {
        const customer = await DB.getCustomer(customerId);
        if (!customer) return;

        const templates = await DB.getAllTemplates();
        const template = templates[0]; // Dùng mẫu đầu tiên
        if (!template) { Utils.showToast('Chưa có mẫu tin nhắn', 'warning'); return; }

        let content = Utils.parseTemplate(template.content, {
            ten_khach: customer.full_name,
            san_pham: customer.last_product_used || '[Sản phẩm]',
            so_dien_thoai: customer.phone || '',
            ngay_het: customer.estimated_product_end_date ? Utils.formatDate(customer.estimated_product_end_date) : '',
        });

        await Utils.copyToClipboard(content);
    },

    showTemplateForm(template = null) {
        const isEdit = !!template;
        const t = template || {};
        const html = `
            <div class="form-group"><label>Tên mẫu *</label><input type="text" id="ft-name" class="input-field" value="${Utils.escapeHtml(t.template_name || '')}"></div>
            <div class="form-group">
                <label>Nội dung tin nhắn</label>
                <textarea id="ft-content" class="input-field" rows="8">${Utils.escapeHtml(t.content || '')}</textarea>
                <small style="color:var(--text-muted);display:block;margin-top:4px;">Biến: {{ten_khach}}, {{san_pham}}, {{so_dien_thoai}}, {{ngay_het}}, {{nguon}}</small>
            </div>
        `;
        const footer = `
            <button class="btn-secondary" onclick="Utils.closeModal()">Hủy</button>
            <button class="btn-primary" onclick="ZaloModule.saveTemplate(${isEdit ? t.id : 'null'})">${isEdit ? 'Cập nhật' : 'Thêm mới'}</button>
        `;
        Utils.openModal(isEdit ? 'Chỉnh sửa mẫu tin' : 'Thêm mẫu tin nhắn', html, footer);
    },

    async saveTemplate(id) {
        const name = document.getElementById('ft-name').value.trim();
        if (!name) { Utils.showToast('Vui lòng nhập tên mẫu', 'error'); return; }
        const data = { template_name: name, content: document.getElementById('ft-content').value };
        try {
            if (id) { await DB.updateTemplate(id, data); Utils.showToast('Đã cập nhật mẫu tin', 'success'); }
            else { await DB.addTemplate(data); Utils.showToast('Đã thêm mẫu tin mới', 'success'); }
            Utils.closeModal();
            this.render();
        } catch (err) { Utils.showToast('Lỗi: ' + err.message, 'error'); }
    },

    async editTemplate(id) {
        const t = await DB.db.message_templates.get(id);
        if (t) this.showTemplateForm(t);
    },

    async deleteTemplate(id) {
        const ok = await Utils.confirm('Xóa mẫu tin', 'Bạn có chắc muốn xóa mẫu tin nhắn này?', '🗑️');
        if (ok) { await DB.deleteTemplate(id); Utils.showToast('Đã xóa mẫu tin', 'success'); this.render(); }
    },

    initEvents() {
        document.getElementById('btn-add-template')?.addEventListener('click', () => this.showTemplateForm());
        document.getElementById('btn-copy-message')?.addEventListener('click', () => {
            const content = document.getElementById('zalo-message-content').value;
            if (content) Utils.copyToClipboard(content);
            else Utils.showToast('Chưa có nội dung tin nhắn', 'warning');
        });
        document.getElementById('btn-open-zalo')?.addEventListener('click', () => {
            const customerId = document.getElementById('zalo-customer-select').value;
            if (!customerId) { Utils.showToast('Vui lòng chọn khách hàng', 'warning'); return; }
            DB.getCustomer(parseInt(customerId)).then(c => {
                if (c) this.openZalo(c.zalo_phone || c.phone);
            });
        });
        document.getElementById('zalo-customer-select')?.addEventListener('change', () => this.updateMessageContent());
        document.getElementById('zalo-template-select')?.addEventListener('change', () => this.updateMessageContent());
    }
};
