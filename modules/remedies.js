/* ===================================================================
   CRM MINI — REMEDIES MODULE
   Hiển thị danh sách các "Bài thuốc hay"
   =================================================================== */

const RemediesModule = {
    currentPage: 1,
    itemsPerPage: 20,
    selectedIds: [],

    init() {
        console.log('Remedies module initialized');
    },

    async render() {
        const container = document.getElementById('remedies-list');
        if (!container) return;

        container.innerHTML = '<div class="loading-state"><span class="spinner"></span> Đang tải dữ liệu...</div>';

        try {
            const allLogs = await DB.db.care_logs.toArray();
            const remedies = allLogs.filter(log => log.is_remedy === true || log.is_remedy === 'true')
                                   .sort((a, b) => new Date(b.created_at || b.care_date) - new Date(a.created_at || a.care_date));

            const selectAllContainer = document.getElementById('remedies-select-all-container');
            if (selectAllContainer) {
                selectAllContainer.style.display = remedies.length > 0 ? 'flex' : 'none';
            }

            if (remedies.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 40px; text-align: center; background: var(--bg-secondary); border-radius: 8px;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom: 16px;">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                        <p style="color: var(--text-muted);">Chưa có bài thuốc hay nào được lưu.<br>Tích chọn <strong>"Bài thuốc hay"</strong> khi lưu ghi chú để thêm vào đây.</p>
                    </div>
                `;
                document.getElementById('remedies-pagination').innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(remedies.length / this.itemsPerPage);
            if (this.currentPage > totalPages) this.currentPage = totalPages;
            if (this.currentPage < 1) this.currentPage = 1;

            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const currentRemedies = remedies.slice(startIndex, startIndex + this.itemsPerPage);

            // Fetch customer info for each remedy
            const customersCache = {};
            let html = '';

            for (const log of currentRemedies) {
                if (!customersCache[log.customer_id]) {
                    const cust = await DB.getCustomer(log.customer_id);
                    customersCache[log.customer_id] = cust || { full_name: 'Khách hàng đã xóa' };
                }
                const customer = customersCache[log.customer_id];
                const isChecked = this.selectedIds.includes(log.id) ? 'checked' : '';

                html += `
                    <div class="cd-log-card">
                        <input type="checkbox" class="remedy-checkbox" value="${log.id}" ${isChecked} style="margin-top:12px; margin-right: 12px; transform:scale(1.3); cursor:pointer;" onchange="RemediesModule.toggleSelection(${log.id})">
                        <div class="cd-log-content">
                            <div class="cd-log-header">
                                <a href="#customers" onclick="CustomersModule.viewCustomer(${log.customer_id})" class="cd-log-name" style="font-weight:700; font-size:14.5px; color:var(--color-primary); text-decoration:none;">
                                    ${Utils.escapeHtml(customer.full_name)}
                                </a>
                                <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">| ${Utils.formatDateTime(log.created_at || log.care_date)}</span>
                                <span class="badge badge-success" style="margin-left:8px;font-size:10px;">Bài thuốc hay</span>
                                <div style="margin-left:auto; display:flex; align-items:center; gap:8px;">
                                    <button onclick="RemediesModule.editRemedy(${log.id})" style="background:none; border:none; cursor:pointer; padding:4px; color:var(--text-muted);" title="Sửa"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                    <button onclick="RemediesModule.deleteRemedy(${log.id})" style="background:none; border:none; cursor:pointer; padding:4px; color:var(--color-danger);" title="Xóa"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                </div>
                            </div>
                            <div class="cd-log-text" style="margin-top:6px; text-align:left;">${Utils.escapeHtml(log.note).replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = html;
            Utils.renderPagination('remedies-pagination', this.currentPage, totalPages, (page) => this.changePage(page));
            this.updateSelectionUI();

        } catch (err) {
            console.error('Error rendering remedies:', err);
            container.innerHTML = `<div class="error-state" style="color:var(--color-danger); padding:20px;">Lỗi tải dữ liệu: ${err.message}</div>`;
        }
    },


    changePage(page) {
        page = parseInt(page);
        if (page < 1) return;
        this.currentPage = page;
        this.render();
    },

    toggleSelection(id) {
        const idx = this.selectedIds.indexOf(id);
        if (idx > -1) {
            this.selectedIds.splice(idx, 1);
        } else {
            this.selectedIds.push(id);
        }
        this.updateSelectionUI();
    },

    toggleSelectAll() {
        const selectAllCb = document.getElementById('remedies-select-all');
        const checkboxes = document.querySelectorAll('.remedy-checkbox');
        
        if (selectAllCb.checked) {
            checkboxes.forEach(cb => {
                cb.checked = true;
                const id = parseInt(cb.value);
                if (!this.selectedIds.includes(id)) this.selectedIds.push(id);
            });
        } else {
            checkboxes.forEach(cb => cb.checked = false);
            this.selectedIds = [];
        }
        this.updateSelectionUI();
    },

    clearSelection() {
        this.selectedIds = [];
        const selectAllCb = document.getElementById('remedies-select-all');
        if (selectAllCb) selectAllCb.checked = false;
        document.querySelectorAll('.remedy-checkbox').forEach(cb => cb.checked = false);
        this.updateSelectionUI();
    },

    updateSelectionUI() {
        const deleteBar = document.getElementById('remedies-delete-bar');
        const countSpan = document.getElementById('remedies-selected-count');
        const selectAllCb = document.getElementById('remedies-select-all');
        
        if (deleteBar && countSpan) {
            if (this.selectedIds.length > 0) {
                deleteBar.style.display = 'flex';
                countSpan.textContent = this.selectedIds.length;
            } else {
                deleteBar.style.display = 'none';
                if (selectAllCb) selectAllCb.checked = false;
            }
        }
    },

    async deleteSelected() {
        if (this.selectedIds.length === 0) return;
        if (!confirm(`Bạn có chắc chắn muốn xóa ${this.selectedIds.length} bài thuốc đã chọn?`)) return;

        try {
            for (const id of this.selectedIds) {
                await DB.db.care_logs.delete(id);
            }
            Utils.showToast(`Đã xóa ${this.selectedIds.length} bài thuốc`, 'success');
            this.clearSelection();
            this.render();
        } catch (err) {
            console.error('Error deleting remedies:', err);
            Utils.showToast('Lỗi khi xóa: ' + err.message, 'error');
        }
    },

    async editRemedy(id) {
        const log = await DB.db.care_logs.get(id);
        if (!log) return;
        
        const newNote = prompt('Sửa nội dung bài thuốc:', log.note);
        if (newNote !== null && newNote.trim() !== '') {
            log.note = newNote.trim();
            await DB.db.care_logs.put(log);
            Utils.showToast('Đã cập nhật bài thuốc', 'success');
            this.render();
        }
    },

    async deleteRemedy(id) {
        if (confirm('Bạn có chắc chắn muốn xóa bài thuốc này?')) {
            await DB.db.care_logs.delete(id);
            Utils.showToast('Đã xóa bài thuốc', 'success');
            this.render();
        }
    },

    async scanAiRemedies() {
        const apiKey = await DB.getSetting('gemini_api_key');
        if (!apiKey) {
            Utils.showToast('Vui lòng cấu hình Gemini API Key trong phần Cài đặt trước', 'error');
            return;
        }

        const allLogs = await DB.db.care_logs.toArray();
        let logsToScan = allLogs.filter(log => !log.is_remedy && log.note && log.note.trim().length > 0);
        let newLogsToScan = logsToScan.filter(log => !log.ai_scanned_remedy);

        if (newLogsToScan.length === 0) {
            if (confirm('Không có ghi chú mới nào. Bạn có muốn quét LẠI toàn bộ các ghi chú cũ chưa là bài thuốc không? (Dùng để sửa lỗi AI bỏ sót)')) {
                // keep logsToScan
            } else {
                return;
            }
        } else {
            logsToScan = newLogsToScan;
            if (!confirm(`Tìm thấy ${logsToScan.length} ghi chú chưa quét. Tiến hành quét AI?`)) return;
        }

        const btn = document.getElementById('btn-scan-remedies');
        const originalBtnText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Đang quét...';
        }

        try {
            // Batch process, e.g. 50 at a time
            const BATCH_SIZE = 50;
            let totalFound = 0;

            for (let i = 0; i < logsToScan.length; i += BATCH_SIZE) {
                if (btn) btn.innerHTML = `<span class="spinner"></span> Đang quét ${Math.min(i + BATCH_SIZE, logsToScan.length)}/${logsToScan.length}...`;
                
                const batch = logsToScan.slice(i, i + BATCH_SIZE);
                // Create a simplified array to send to AI
                const batchData = batch.map(log => ({ id: log.id, note: log.note }));
                
                const systemInstruction = `Bạn là trợ lý AI tìm kiếm các bài thuốc hay từ lịch sử ghi chú khách hàng.
Người dùng sẽ cung cấp một danh sách các ghi chú dưới dạng JSON mảng các object có cấu trúc [{"id": 1, "note": "..."}].
NHIỆM VỤ:
1. Đọc nội dung "note" của từng mục.
2. Xác định xem ghi chú đó có chia sẻ về một loại thuốc hiệu quả, mẹo chữa bệnh tốt, hoặc phản hồi rằng dùng thuốc/phương pháp nào đó đã khỏi bệnh hay không.
3. Chỉ trả về một mảng JSON các "id" của những ghi chú thỏa mãn tiêu chí trên (VD: [1, 5, 8]).
4. Nếu không có ghi chú nào thỏa mãn, trả về mảng rỗng [].
Tuyệt đối không giải thích gì thêm, chỉ trả về mảng JSON id.`;

                const payload = {
                    contents: [{ parts: [{ text: JSON.stringify(batchData) }] }],
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
                    throw new Error('Lỗi kết nối API Gemini');
                }

                const data = await response.json();
                let textRes = data.candidates?.[0]?.content?.parts?.[0]?.text;
                let foundIds = [];
                if (textRes) {
                    try {
                        textRes = textRes.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(textRes);
                        if (Array.isArray(parsed)) {
                            foundIds = parsed.map(id => String(id));
                        }
                    } catch (e) {
                        console.error("Lỗi parse JSON từ AI:", textRes);
                    }
                }

                // Update database
                for (const log of batch) {
                    if (foundIds.includes(String(log.id))) {
                        log.is_remedy = true;
                        totalFound++;
                    }
                    log.ai_scanned_remedy = true; // Mark as scanned
                    await DB.db.care_logs.put(log);
                }
            }

            Utils.showToast(`Hoàn tất! Tìm thấy ${totalFound} bài thuốc mới.`, 'success');
            this.render();

        } catch (err) {
            console.error('Lỗi khi quét AI:', err);
            Utils.showToast('Lỗi: ' + err.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnText;
            }
        }
    }
};
