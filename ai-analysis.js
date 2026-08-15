/* ===================================================================
   CRM MINI — AI ANALYSIS MODULE
   Phân tích AI / Antigravity, tạo prompt, xuất dữ liệu
   =================================================================== */

const AiAnalysisModule = {
    calculatePriorityScores(customers, stats) {
        const today = Utils.today();
        let scores;

        try {
            const defaultScores = { overdue_care: 30, product_expired: 30, product_running_out: 25, care_due_today: 25, waiting_close: 20, interested_combo: 20, vip: 15, repurchased: 15, high_revenue: 10, keyword_match: 10 };
            scores = defaultScores;
        } catch (e) { scores = { overdue_care: 30, product_expired: 30, product_running_out: 25, care_due_today: 25, waiting_close: 20, interested_combo: 20, vip: 15, repurchased: 15, high_revenue: 10, keyword_match: 10 }; }

        const keywords = ['hẹn gọi lại', 'hỏi giá', 'cần tư vấn', 'quan tâm', 'combo'];
        const avgRevenue = customers.length > 0 ? customers.reduce((s, c) => s + (c.total_revenue || 0), 0) / customers.length : 0;

        return customers.map(c => {
            let score = 0;
            const reasons = [];

            // Quá hạn chăm sóc
            if (!c.last_contact_date || Utils.daysAgo(c.last_contact_date) > (c.care_cycle_days || 30)) {
                score += scores.overdue_care; reasons.push('Quá hạn CS');
            }
            // Đã hết SP
            if (c.estimated_product_end_date && Utils.daysFromNow(c.estimated_product_end_date) < 0) {
                score += scores.product_expired; reasons.push('Đã hết SP');
            }
            // Sắp hết SP
            else if (c.estimated_product_end_date && Utils.daysFromNow(c.estimated_product_end_date) <= 7 && Utils.daysFromNow(c.estimated_product_end_date) >= 0) {
                score += scores.product_running_out; reasons.push('Sắp hết SP');
            }
            // Đến hạn CS hôm nay
            if (c.next_care_date && c.next_care_date <= today) {
                score += scores.care_due_today; reasons.push('Đến hạn CS');
            }
            // Chờ chốt
            if (c.status === 'waiting_close') { score += scores.waiting_close; reasons.push('Chờ chốt'); }
            // VIP
            if (c.status === 'vip' || (c.tags && c.tags.includes('VIP'))) { score += scores.vip; reasons.push('VIP'); }
            // Mua lại
            if (c.status === 'repurchased') { score += scores.repurchased; reasons.push('Mua lại'); }
            // Doanh số cao
            if ((c.total_revenue || 0) > avgRevenue * 1.5) { score += scores.high_revenue; reasons.push('Doanh số cao'); }
            // Điểm theo Keyword Category (Từ AI hoặc regex khi lưu)
            if (c.keyword_category === 'PRIORITY') {
                score += scores.keyword_match; reasons.push('Từ khóa Ưu tiên');
            } else if (c.keyword_category === 'NON_PRIORITY') {
                score -= scores.keyword_match; reasons.push('Từ khóa Không ưu tiên');
            } else if (!c.keyword_category && c.note) {
                // Fallback nếu dữ liệu cũ chưa có trường keyword_category
                const noteLower = c.note.toLowerCase();
                keywords.forEach(kw => {
                    if (noteLower.includes(kw)) { score += scores.keyword_match; reasons.push(`"${kw}"`); }
                });
            }

            return { ...c, _priorityScore: score, _reasons: reasons };
        }).filter(c => c._priorityScore > 0).sort((a, b) => b._priorityScore - a._priorityScore);
    },

    async generatePrompt() {
        const analysisType = document.getElementById('ai-analysis-type').value;
        const timeRange = document.getElementById('ai-time-range').value;
        const hideSensitive = document.getElementById('ai-hide-sensitive').checked;
        const dateRange = Utils.getDateRange(timeRange,
            document.getElementById('ai-date-from')?.value,
            document.getElementById('ai-date-to')?.value
        );
        const stats = await DB.getStats(dateRange);

        let dataToExport = [];
        let analysisLabel = '';

        switch (analysisType) {
            case 'care_today':
                analysisLabel = 'Khách cần chăm sóc hôm nay';
                dataToExport = stats.dueTodayCustomers;
                break;
            case 'repurchase':
                analysisLabel = 'Khách có khả năng mua lại';
                dataToExport = stats.customers.filter(c => ['purchased', 'repurchased', 'vip'].includes(c.status));
                break;
            case 'overdue':
                analysisLabel = 'Khách quá hạn chăm sóc';
                dataToExport = stats.overdueCustomers;
                break;
            case 'revenue_source':
                analysisLabel = 'Doanh số theo nguồn khách';
                dataToExport = this.aggregateBySource(stats);
                break;
            case 'revenue_product':
                analysisLabel = 'Doanh số theo sản phẩm';
                dataToExport = this.aggregateByProduct(stats);
                break;
            case 'performance':
                analysisLabel = 'Hiệu suất cá nhân';
                dataToExport = [{ total_customers: stats.totalCustomers, total_revenue: stats.totalRevenue, commission: stats.commission, conversion_rate: stats.conversionRate, completed_orders: stats.completedOrders, cancelled_orders: stats.cancelledOrders }];
                break;
            case 'transferred':
                analysisLabel = 'Khách bị chuyển';
                dataToExport = stats.transferred;
                break;
            case 'order_status':
                analysisLabel = 'Trạng thái đơn hàng';
                dataToExport = stats.orders;
                break;
            case 'opportunity':
                analysisLabel = 'Cơ hội doanh thu từ khách sắp hết SP';
                dataToExport = stats.productRunningOut;
                break;
        }

        // Ẩn thông tin nhạy cảm
        if (hideSensitive && Array.isArray(dataToExport)) {
            dataToExport = dataToExport.map((item, i) => {
                const cleaned = { ...item };
                if (cleaned.full_name) cleaned.full_name = `KH${String(i + 1).padStart(3, '0')}`;
                if (cleaned.phone) cleaned.phone = cleaned.phone.substring(0, 3) + '****' + cleaned.phone.slice(-3);
                if (cleaned.zalo_phone) cleaned.zalo_phone = cleaned.zalo_phone.substring(0, 3) + '****' + cleaned.zalo_phone.slice(-3);
                delete cleaned.email;
                delete cleaned.address;
                return cleaned;
            });
        }

        // Gắn kèm lịch sử chăm sóc gần nhất cho từng khách hàng
        if (Array.isArray(dataToExport) && dataToExport.length > 0 && dataToExport[0]?.id) {
            const allCareLogs = await DB.getAllCareLogs();
            const logsByCustomer = {};
            allCareLogs.forEach(log => {
                if (!logsByCustomer[log.customer_id]) logsByCustomer[log.customer_id] = [];
                logsByCustomer[log.customer_id].push(log);
            });
            // Sắp xếp và lấy 5 ghi chú gần nhất cho mỗi khách
            for (const custId in logsByCustomer) {
                logsByCustomer[custId].sort((a, b) => new Date(b.created_at || b.care_date) - new Date(a.created_at || a.care_date));
                logsByCustomer[custId] = logsByCustomer[custId].slice(0, 5).map(l => ({
                    ngay: l.care_date,
                    loai: l.care_type || '',
                    ghi_chu: l.note || ''
                }));
            }
            dataToExport = dataToExport.map(c => ({
                ...c,
                lich_su_cham_soc_gan_nhat: logsByCustomer[c.id] || []
            }));
        }

        const prompt = `Bạn là chuyên gia phân tích CRM cho nhân viên sales thực phẩm chức năng (TPCN).
Loại phân tích: ${analysisLabel}
Khoảng thời gian: ${timeRange === 'all' ? 'Tất cả' : timeRange}
Tổng khách hàng trong dữ liệu: ${dataToExport.length}
Ngày hôm nay: ${new Date().toLocaleDateString('vi-VN')}

## QUY TẮC BẮT BUỘC:
1. KHÔNG BAO GIỜ viết tên trường JSON gốc (estimated_product_end_date, next_care_date, lich_su_cham_soc_gan_nhat, v.v.). Chỉ viết tiếng Việt tự nhiên.
2. KHÔNG viết đoạn mở đầu, lời khuyên chung chung, hay lý thuyết. Đi thẳng vào danh sách.
3. BẮT BUỘC liệt kê đủ 10 khách hàng. Nếu dữ liệu ít hơn 10, liệt kê toàn bộ.

## QUY TẮC PHÂN TÍCH SÂU (RẤT QUAN TRỌNG):
Bạn PHẢI đọc kỹ nội dung ghi chú trong lịch sử chăm sóc để PHÂN TÍCH CẢM XÚC & THÁI ĐỘ của khách hàng:
- Nếu ghi chú có các dấu hiệu TIÊU CỰC như: "không thấy thay đổi", "không hiệu quả", "không muốn dùng nữa", "không tin", "từ chối", "chê đắt", "nghỉ dùng" → BẮT BUỘC LOẠI BỎ khách hàng này khỏi danh sách. TUYỆT ĐỐI KHÔNG đưa khách tiêu cực vào danh sách kết quả.
- Về SẮP XẾP ƯU TIÊN: Sự kết hợp giữa Thái độ và Ngày tháng là tiêu chí cao nhất.
  + ƯU TIÊN CAO NHẤT (Top 1): Khách có thái độ TÍCH CỰC (hẹn gọi lại, quan tâm...) HOẶC Trung lập + ĐÃ HẾT/SẮP HẾT SẢN PHẨM (dựa vào estimated_product_end_date) hoặc ĐÃ ĐẾN HẠN CHĂM SÓC (next_care_date).
  + ƯU TIÊN SỐ 2: Khách đã hết sản phẩm hoặc quá hạn chăm sóc lâu ngày nhưng chưa nghe máy (cnm/knm).
  + ƯU TIÊN SỐ 3: Các khách hàng bình thường khác.

Hãy LOẠI BỎ khách tiêu cực, sau đó áp dụng logic trên để chọn ra 10 khách hàng nét nhất và sắp xếp từ cao xuống thấp.

## ĐỊNH DẠNG MỖI KHÁCH HÀNG (BẮT BUỘC TRÌNH BÀY ĐÚNG MẪU NÀY):

**[STT]. [Emoji] [Tên] — [SĐT]** [ID:{id}]
- **Tình hình:** (2-3 câu tóm tắt từ lịch sử chăm sóc: khách nói gì, phản hồi ra sao)
- **Lý do chăm sóc:** (sản phẩm hết ngày nào, quá hạn bao lâu, v.v.)
- **Hành động:** 
  - (Kịch bản/gợi ý 1)
  - (Kịch bản/gợi ý 2)

*Lưu ý:* 
- *[Emoji] là đánh giá thái độ: 🟢 (Tích cực) hoặc 🟡 (Trung lập).*
- *KHÔNG viết riêng một dòng "Thái độ" như trước.*

---

Dữ liệu:
${JSON.stringify(dataToExport, null, 2)}`;

        document.getElementById('ai-prompt-output').value = prompt;
        this._lastExportData = dataToExport;
        Utils.showToast('Đã tạo prompt phân tích!', 'success');
    },

    aggregateBySource(stats) {
        const map = {};
        const customerMap = {};
        stats.customers.forEach(c => customerMap[c.id] = c);
        stats.orders.filter(o => o.order_status === 'completed').forEach(o => {
            const cust = customerMap[o.customer_id];
            const src = cust ? cust.customer_source : 'other';
            if (!map[src]) map[src] = { source: Utils.sourceLabel(src), customer_count: 0, revenue: 0, orders: 0 };
            map[src].revenue += o.total_amount || 0;
            map[src].orders++;
        });
        stats.customers.forEach(c => {
            const src = c.customer_source || 'other';
            if (!map[src]) map[src] = { source: Utils.sourceLabel(src), customer_count: 0, revenue: 0, orders: 0 };
            map[src].customer_count++;
        });
        return Object.values(map);
    },

    aggregateByProduct(stats) {
        const map = {};
        stats.orders.filter(o => o.order_status === 'completed').forEach(o => {
            if (!map[o.product_name]) map[o.product_name] = { product: o.product_name, revenue: 0, quantity: 0, orders: 0 };
            map[o.product_name].revenue += o.total_amount || 0;
            map[o.product_name].quantity += o.quantity || 0;
            map[o.product_name].orders++;
        });
        return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    },

    async exportJSON() {
        if (!this._lastExportData) { await this.generatePrompt(); }
        const data = JSON.stringify(this._lastExportData, null, 2);
        Utils.downloadFile(data, `crm-analysis-${Utils.today()}.json`);
        Utils.showToast('Đã xuất file JSON', 'success');
    },

    async exportCSV() {
        if (!this._lastExportData) { await this.generatePrompt(); }
        Utils.exportCSV(this._lastExportData, `crm-analysis-${Utils.today()}.csv`);
    },

    async analyzeNow() {
        let prompt = document.getElementById('ai-prompt-output').value;
        if (!prompt) {
            await this.generatePrompt();
            prompt = document.getElementById('ai-prompt-output').value;
        }
        
        if (!prompt) return;

        const apiKey = await DB.getSetting('gemini_api_key');
        if (!apiKey) {
            Utils.showToast('Vui lòng cấu hình Gemini API Key trong phần Cài đặt trước', 'warning');
            return;
        }

        const btn = document.getElementById('btn-ai-analyze-now');
        const resultArea = document.getElementById('ai-result-area');
        const resultContent = document.getElementById('ai-result-content');
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Đang phân tích...';
        btn.disabled = true;
        resultArea.style.display = 'block';
        resultContent.innerHTML = '<div style="text-align: center; color: var(--text-muted);">Đang kết nối với AI, vui lòng đợi...</div>';

        try {
            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 65536 }
            };

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error?.message || `Lỗi API (${response.status})`);
            }

            const data = await response.json();
            const textRes = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textRes) {
                throw new Error('AI không trả về kết quả. Vui lòng thử lại.');
            }

            // Dùng hàm renderMarkdown của CoVanAiModule
            resultContent.innerHTML = CoVanAiModule.renderMarkdown(textRes);

            // Lưu lịch sử
            const analysisTypeSelect = document.getElementById('ai-analysis-type');
            const analysisTypeName = analysisTypeSelect.options[analysisTypeSelect.selectedIndex].text;
            
            await DB.saveAiAnalysisHistory({
                analysis_type: analysisTypeName,
                prompt: prompt,
                result_markdown: textRes
            });
            
            this.renderHistory();

        } catch (error) {
            console.error('Lỗi phân tích AI:', error);
            resultContent.innerHTML = `<div style="color: var(--danger-color);"><span class="icon">⚠️</span> ${error.message}</div>`;
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async renderHistory() {
        const historyList = document.getElementById('ai-history-list');
        if (!historyList) return;

        const histories = await DB.getAiAnalysisHistory();
        
        if (!histories || histories.length === 0) {
            historyList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Chưa có lịch sử phân tích nào.</div>';
            return;
        }

        // Show result area if hidden so we can see history
        document.getElementById('ai-result-area').style.display = 'block';

        let html = '';
        histories.forEach((item, index) => {
            const date = new Date(item.created_at);
            const dateStr = `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`;
            const markdownHtml = CoVanAiModule.renderMarkdown(item.result_markdown);
            
            html += `
                <div class="ai-accordion-item" id="ai-history-item-${item.id}">
                    <div class="ai-accordion-header" onclick="
                        const el = document.getElementById('ai-history-item-${item.id}');
                        el.classList.toggle('open');
                        if (el.classList.contains('open')) {
                            setTimeout(() => el.scrollIntoView({behavior: 'smooth', block: 'start'}), 100);
                        }
                    ">
                        <div class="ai-accordion-title">
                            ${item.analysis_type} - <span class="ai-accordion-date">${dateStr}</span>
                        </div>
                        <div class="ai-accordion-chevron"></div>
                    </div>
                    <div class="ai-accordion-body markdown-body">
                        ${markdownHtml}
                    </div>
                </div>
            `;
        });

        historyList.innerHTML = html;
    },

    initEvents() {
        // Load lịch sử ban đầu
        this.renderHistory();
        document.getElementById('ai-time-range')?.addEventListener('change', (e) => {
            const custom = document.getElementById('ai-custom-date');
            if (custom) custom.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });
        document.getElementById('btn-ai-generate-prompt')?.addEventListener('click', () => this.generatePrompt());
        document.getElementById('btn-ai-copy-prompt')?.addEventListener('click', () => {
            const prompt = document.getElementById('ai-prompt-output').value;
            if (prompt) Utils.copyToClipboard(prompt);
            else Utils.showToast('Chưa có prompt. Nhấn "Tạo Prompt AI" trước', 'warning');
        });
        document.getElementById('btn-ai-export-json')?.addEventListener('click', () => this.exportJSON());
        document.getElementById('btn-ai-export-csv')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('btn-ai-save-note')?.addEventListener('click', () => {
            Utils.showToast('Đã lưu prompt vào ghi chú!', 'success');
        });
        document.getElementById('btn-ai-analyze-now')?.addEventListener('click', () => this.analyzeNow());
        document.getElementById('btn-ai-copy-result')?.addEventListener('click', () => {
            const resultHtml = document.getElementById('ai-result-content').innerText;
            if (resultHtml) {
                Utils.copyToClipboard(resultHtml);
                Utils.showToast('Đã copy kết quả', 'success');
            }
        });
    }
};
