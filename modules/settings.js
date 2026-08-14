/* ===================================================================
   CRM MINI — SETTINGS MODULE
   Giao diện cài đặt, tùy chỉnh tham số AI và hệ thống
   =================================================================== */

const SettingsModule = {
    async render() {
        const commission = await DB.getSetting('commission_rate');
        const cycle = await DB.getSetting('care_cycle_days');
        const m1 = await DB.getSetting('care_milestone_1');
        const m2 = await DB.getSetting('care_milestone_2');
        const m3 = await DB.getSetting('care_milestone_3');
        const keywords = await DB.getSetting('priority_keywords');
        const scores = await DB.getSetting('priority_scores');
        const theme = await DB.getSetting('theme');
        const geminiKey = await DB.getSetting('gemini_api_key');

        const commEl = document.getElementById('setting-commission-rate') || document.getElementById('set-commission');
        if (commEl) commEl.value = commission || 10;
        
        const cycleEl = document.getElementById('setting-care-cycle') || document.getElementById('set-cycle');
        if (cycleEl) cycleEl.value = cycle || 30;
        
        const m1El = document.getElementById('setting-care-m1');
        if (m1El) m1El.value = m1 !== undefined ? m1 : 1;
        
        const m2El = document.getElementById('setting-care-m2');
        if (m2El) m2El.value = m2 !== undefined ? m2 : 7;
        
        const m3El = document.getElementById('setting-care-m3');
        if (m3El) m3El.value = m3 !== undefined ? m3 : 22;
        
        const keywordsEl = document.getElementById('setting-keywords') || document.getElementById('set-keywords');
        if (keywordsEl) keywordsEl.value = (keywords || []).join('\n'); // fix comma to newline if needed

        const stopKeywords = await DB.getSetting('stop_care_keywords');
        const stopKeywordsEl = document.getElementById('setting-stop-keywords');
        if (stopKeywordsEl) stopKeywordsEl.value = (stopKeywords || ['không dùng nữa', 'đã chết', 'không uống nữa', 'đã mất']).join('\n');

        const cancelKeywords = await DB.getSetting('cancel_keywords');
        const cancelKeywordsEl = document.getElementById('setting-cancel-keywords');
        if (cancelKeywordsEl) cancelKeywordsEl.value = (cancelKeywords || ['hủy đơn', 'hoàn hàng', 'không nhận hàng']).join('\n');

        const nonPriorityKeywords = await DB.getSetting('non_priority_keywords');
        const nonPriorityEl = document.getElementById('setting-non-priority-keywords');
        if (nonPriorityEl) nonPriorityEl.value = (nonPriorityKeywords || ['không có tiền', 'chưa muốn mua', 'để hỏi vợ', 'không mua']).join('\n');

        const useAi = await DB.getSetting('use_ai_keyword_filter');
        const useAiEl = document.getElementById('setting-use-ai');
        if (useAiEl) useAiEl.checked = !!useAi;

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) themeToggle.checked = theme === 'light';

        const geminiEl = document.getElementById('setting-gemini-key');
        if (geminiEl) geminiEl.value = geminiKey || '';

        const scoresConfig = document.getElementById('priority-scores-config');
        if (scoresConfig && !scoresConfig.innerHTML.trim()) {
            scoresConfig.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="form-group"><label>Quá hạn chăm sóc</label><input type="number" id="score-overdue" class="input-field" value="30"></div>
                    <div class="form-group"><label>Đã hết sản phẩm</label><input type="number" id="score-expired" class="input-field" value="30"></div>
                    <div class="form-group"><label>Sắp hết sản phẩm</label><input type="number" id="score-running-out" class="input-field" value="25"></div>
                    <div class="form-group"><label>Cần CS hôm nay</label><input type="number" id="score-due" class="input-field" value="25"></div>
                    <div class="form-group"><label>Chờ chốt đơn</label><input type="number" id="score-waiting" class="input-field" value="20"></div>
                    <div class="form-group"><label>Quan tâm combo</label><input type="number" id="score-combo" class="input-field" value="20"></div>
                    <div class="form-group"><label>Khách VIP</label><input type="number" id="score-vip" class="input-field" value="15"></div>
                    <div class="form-group"><label>Khách đã mua</label><input type="number" id="score-repurchased" class="input-field" value="15"></div>
                    <div class="form-group"><label>Doanh thu cao</label><input type="number" id="score-revenue" class="input-field" value="10"></div>
                    <div class="form-group"><label>Chứa từ khóa</label><input type="number" id="score-keyword" class="input-field" value="10"></div>
                </div>
            `;
        }

        if (scores) {
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setVal('score-overdue', scores.overdue_care || 30);
            setVal('score-expired', scores.product_expired || 30);
            setVal('score-running-out', scores.product_running_out || 25);
            setVal('score-due', scores.care_due_today || 25);
            setVal('score-waiting', scores.waiting_close || 20);
            setVal('score-combo', scores.interested_combo || 20);
            setVal('score-vip', scores.vip || 15);
            setVal('score-repurchased', scores.repurchased || 15);
            setVal('score-revenue', scores.high_revenue || 10);
            setVal('score-keyword', scores.keyword_match || 10);
        }

        const kpiThresholds = await DB.getSetting('kpi_thresholds');
        if (kpiThresholds) {
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setVal('setting-kpi-conv-low', kpiThresholds.conv_low !== undefined ? kpiThresholds.conv_low : 15);
            setVal('setting-kpi-conv-high', kpiThresholds.conv_high !== undefined ? kpiThresholds.conv_high : 30);
            setVal('setting-kpi-ret-low', kpiThresholds.ret_low !== undefined ? kpiThresholds.ret_low : 5);
            setVal('setting-kpi-ret-high', kpiThresholds.ret_high !== undefined ? kpiThresholds.ret_high : 20);
            setVal('setting-kpi-newold-low', kpiThresholds.newold_low !== undefined ? kpiThresholds.newold_low : 15);
            setVal('setting-kpi-newold-high', kpiThresholds.newold_high !== undefined ? kpiThresholds.newold_high : 50);
            setVal('setting-kpi-drop-low', kpiThresholds.drop_low !== undefined ? kpiThresholds.drop_low : 20);
            setVal('setting-kpi-drop-high', kpiThresholds.drop_high !== undefined ? kpiThresholds.drop_high : 50);
        }

        const leadingThresholds = await DB.getSetting('kpi_leading_thresholds');
        if (leadingThresholds) {
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setVal('setting-lead-low', leadingThresholds.lead_low !== undefined ? leadingThresholds.lead_low : 2);
            setVal('setting-lead-high', leadingThresholds.lead_high !== undefined ? leadingThresholds.lead_high : 5);
            setVal('setting-res-low', leadingThresholds.res_low !== undefined ? leadingThresholds.res_low : 15);
            setVal('setting-res-high', leadingThresholds.res_high !== undefined ? leadingThresholds.res_high : 60);
            setVal('setting-act-low', leadingThresholds.act_low !== undefined ? leadingThresholds.act_low : 50);
            setVal('setting-act-high', leadingThresholds.act_high !== undefined ? leadingThresholds.act_high : 200);
            setVal('setting-drop-lead-low', leadingThresholds.drop_lead_low !== undefined ? leadingThresholds.drop_lead_low : 20);
            setVal('setting-drop-lead-high', leadingThresholds.drop_lead_high !== undefined ? leadingThresholds.drop_lead_high : 50);
        }

        await this.updateSalaryCalculator('init');
    },

    async updateSalaryCalculator(source = 'other') {
        const revEl = document.getElementById('calc-revenue');
        const baseEl = document.getElementById('calc-base');
        const kpiEl = document.getElementById('calc-kpi');
        const commEl = document.getElementById('calc-commission');
        const bonusEl = document.getElementById('calc-bonus');
        const daysEl = document.getElementById('calc-days');
        const dailyWageEl = document.getElementById('calc-daily-wage');

        // Nếu mới load trang, tự động lấy doanh số từ DB
        if (source === 'init') {
            const dateRange = Utils.getDateRange('month');
            const stats = await DB.getStats(dateRange);
            if (revEl) revEl.value = stats.totalRevenue || 0;
        }

        const currentRevenue = parseFloat(revEl?.value) || 0;

        // Nếu load trang hoặc user tự gõ Doanh số, thì tính lại Lương KPI & Hoa hồng
        if (source === 'init' || source === 'revenue') {
            let kpiSalary = 0;
            if (currentRevenue >= 165000000) {
                kpiSalary = 2500000;
            }

            let commission = 0;
            if (currentRevenue >= 250000000) {
                commission = currentRevenue * 0.05;
            } else if (currentRevenue >= 205000000) {
                commission = currentRevenue * 0.045;
            } else if (currentRevenue >= 165000000) {
                commission = currentRevenue * 0.04;
            } else if (currentRevenue >= 100000000) {
                commission = currentRevenue * 0.03;
            } else if (currentRevenue >= 70000000) {
                commission = currentRevenue * 0.02;
            }

            if (kpiEl) kpiEl.value = Math.round(kpiSalary);
            if (commEl) commEl.value = Math.round(commission);
        }

        // Đọc giá trị trên ô nhập để cộng tổng
        const base = parseFloat(baseEl?.value) || 0;
        const kpi = parseFloat(kpiEl?.value) || 0;
        const comm = parseFloat(commEl?.value) || 0;
        const bonus = parseFloat(bonusEl?.value) || 0;
        const daysOff = parseFloat(daysEl?.value) || 0;
        const dailyWage = parseFloat(dailyWageEl?.value) || 230000;

        let realBase = base;
        if (daysOff < 0) {
            realBase += (daysOff * dailyWage);
        } else if (daysOff > 0) {
            realBase -= (daysOff * dailyWage);
        }

        const total = realBase + kpi + comm + bonus;
        
        const totalEl = document.getElementById('res-calc-total');
        if (totalEl) totalEl.textContent = Utils.formatCurrency(Math.round(total));
    },

    async saveSettings() {
        try {
            const commEl = document.getElementById('setting-commission-rate') || document.getElementById('set-commission');
            const cycleEl = document.getElementById('setting-care-cycle') || document.getElementById('set-cycle');
            const m1El = document.getElementById('setting-care-m1');
            const m2El = document.getElementById('setting-care-m2');
            const m3El = document.getElementById('setting-care-m3');
            const keywordsEl = document.getElementById('setting-keywords') || document.getElementById('set-keywords');
            const stopKeywordsEl = document.getElementById('setting-stop-keywords');
            const cancelKeywordsEl = document.getElementById('setting-cancel-keywords');
            const nonPriorityEl = document.getElementById('setting-non-priority-keywords');
            const useAiEl = document.getElementById('setting-use-ai');
            
            const commission = parseFloat(commEl?.value) || 0;
            const cycle = parseInt(cycleEl?.value) || 30;
            const m1 = parseInt(m1El?.value) || 1;
            const m2 = parseInt(m2El?.value) || 7;
            const m3 = parseInt(m3El?.value) || 22;
            const keywordsStr = keywordsEl?.value || '';
            const keywords = keywordsStr.split('\n').map(k => k.trim().toLowerCase()).filter(k => k);
            
            const stopKeywordsStr = stopKeywordsEl?.value || '';
            const stopKeywords = stopKeywordsStr.split('\n').map(k => k.trim().toLowerCase()).filter(k => k);

            const cancelKeywordsStr = cancelKeywordsEl?.value || '';
            const cancelKeywords = cancelKeywordsStr.split('\n').map(k => k.trim().toLowerCase()).filter(k => k);

            const nonPriorityStr = nonPriorityEl?.value || '';
            const nonPriorityKeywords = nonPriorityStr.split('\n').map(k => k.trim().toLowerCase()).filter(k => k);
            
            const useAi = useAiEl ? useAiEl.checked : false;

            const scores = {
                overdue_care: parseInt(document.getElementById('score-overdue')?.value) || 0,
                product_expired: parseInt(document.getElementById('score-expired')?.value) || 0,
                product_running_out: parseInt(document.getElementById('score-running-out')?.value) || 0,
                care_due_today: parseInt(document.getElementById('score-due')?.value) || 0,
                waiting_close: parseInt(document.getElementById('score-waiting')?.value) || 0,
                interested_combo: parseInt(document.getElementById('score-combo')?.value) || 0,
                vip: parseInt(document.getElementById('score-vip')?.value) || 0,
                repurchased: parseInt(document.getElementById('score-repurchased')?.value) || 0,
                high_revenue: parseInt(document.getElementById('score-revenue')?.value) || 0,
                keyword_match: parseInt(document.getElementById('score-keyword')?.value) || 0
            };

            await DB.setSetting('commission_rate', commission);
            await DB.setSetting('care_cycle_days', cycle);
            await DB.setSetting('care_milestone_1', m1);
            await DB.setSetting('care_milestone_2', m2);
            await DB.setSetting('care_milestone_3', m3);
            await DB.setSetting('priority_keywords', keywords);
            await DB.setSetting('stop_care_keywords', stopKeywords);
            await DB.setSetting('cancel_keywords', cancelKeywords);
            await DB.setSetting('non_priority_keywords', nonPriorityKeywords);
            await DB.setSetting('use_ai_keyword_filter', useAi);
            await DB.setSetting('priority_scores', scores);

            const kpiThresholds = {
                conv_low: parseFloat(document.getElementById('setting-kpi-conv-low')?.value) || 15,
                conv_high: parseFloat(document.getElementById('setting-kpi-conv-high')?.value) || 30,
                ret_low: parseFloat(document.getElementById('setting-kpi-ret-low')?.value) || 5,
                ret_high: parseFloat(document.getElementById('setting-kpi-ret-high')?.value) || 20,
                newold_low: parseFloat(document.getElementById('setting-kpi-newold-low')?.value) || 15,
                newold_high: parseFloat(document.getElementById('setting-kpi-newold-high')?.value) || 50,
                drop_low: parseFloat(document.getElementById('setting-kpi-drop-low')?.value) || 20,
                drop_high: parseFloat(document.getElementById('setting-kpi-drop-high')?.value) || 50
            };
            await DB.setSetting('kpi_thresholds', kpiThresholds);

            const leadingThresholds = {
                lead_low: parseFloat(document.getElementById('setting-lead-low')?.value) || 2,
                lead_high: parseFloat(document.getElementById('setting-lead-high')?.value) || 5,
                res_low: parseFloat(document.getElementById('setting-res-low')?.value) || 15,
                res_high: parseFloat(document.getElementById('setting-res-high')?.value) || 60,
                act_low: parseFloat(document.getElementById('setting-act-low')?.value) || 50,
                act_high: parseFloat(document.getElementById('setting-act-high')?.value) || 200,
                drop_lead_low: parseFloat(document.getElementById('setting-drop-lead-low')?.value) || 20,
                drop_lead_high: parseFloat(document.getElementById('setting-drop-lead-high')?.value) || 50
            };
            await DB.setSetting('kpi_leading_thresholds', leadingThresholds);

            Utils.showToast('Đã lưu cài đặt thành công!', 'success');
        } catch (err) {
            Utils.showToast('Lỗi khi lưu cài đặt: ' + err.message, 'error');
        }
    },

    async confirmClearData() {
        const ok = await Utils.confirm(
            'XÓA TOÀN BỘ DỮ LIỆU',
            'CẢNH BÁO NGUY HIỂM: Bạn đang chuẩn bị xóa toàn bộ khách hàng, đơn hàng và sản phẩm. Hành động này không thể phục hồi. Hãy đảm bảo bạn đã Backup dữ liệu. Bạn có chắc chắn muốn xóa?',
            '🧨'
        );
        if (ok) {
            const ok2 = await Utils.confirm('XÁC NHẬN LẦN CUỐI', 'Hệ thống sẽ bị làm sạch. Bấm OK để tiến hành.', '🧨');
            if (ok2) {
                document.getElementById('loading-screen').classList.remove('hidden');
                document.getElementById('loading-text').textContent = 'Đang xóa dữ liệu...';
                await DB.clearAllData();
                Utils.showToast('Đã xóa toàn bộ dữ liệu', 'success');
                setTimeout(() => location.reload(), 1000);
            }
        }
    },

    async confirmSeedData() {
        const ok = await Utils.confirm(
            'Tạo dữ liệu mẫu',
            'Thao tác này sẽ tạo ra khoảng 30 khách hàng mẫu và dữ liệu đơn hàng giả định để thử nghiệm. Bạn có muốn tiếp tục?',
            '🌱'
        );
        if (ok) {
            document.getElementById('loading-screen').classList.remove('hidden');
            document.getElementById('loading-text').textContent = 'Đang tạo dữ liệu mẫu...';
            try {
                await DB.seedDemoData();
                Utils.showToast('Tạo dữ liệu mẫu thành công', 'success');
                setTimeout(() => location.reload(), 1000);
            } catch (err) {
                Utils.showToast('Lỗi: ' + err.message, 'error');
                document.getElementById('loading-screen').classList.add('hidden');
            }
        }
    },

    async scanOldDataKeywords() {
        const useAi = await DB.getSetting('use_ai_keyword_filter');
        const warningAi = useAi ? '\n\nCẢNH BÁO: Bạn đang Bật AI. Quá trình quét có thể mất rất nhiều thời gian (khoảng 2s/khách hàng) và có thể gặp lỗi nếu quá tải API.' : '';
        const ok = await Utils.confirm(
            'Quét dữ liệu cũ',
            'Thao tác này sẽ quét toàn bộ ghi chú và lịch sử chăm sóc của tất cả khách hàng để phân loại Ưu tiên, Không ưu tiên, hoặc Tạm dừng.' + warningAi + ' Tiếp tục?',
            '🔄'
        );
        if (!ok) return;

        document.getElementById('loading-screen').classList.remove('hidden');
        document.getElementById('loading-text').textContent = 'Đang quét dữ liệu...';

        try {
            const allCustomers = await DB.db.customers.toArray();
            const allLogs = await DB.db.care_logs.toArray();
            
            const priorityKw = await DB.getSetting('priority_keywords') || [];
            const nonPriorityKw = await DB.getSetting('non_priority_keywords') || [];
            const stopKw = await DB.getSetting('stop_care_keywords') || [];
            const cancelKw = await DB.getSetting('cancel_keywords') || [];
            
            let countCancelled = 0;
            let countStopped = 0;
            let countPriority = 0;
            let countNonPriority = 0;

            for (const c of allCustomers) {
                if (c.deleted_at) continue;
                if (c.manual_stopped && c.stopped_status) continue;

                // Bổ sung: Tính toán lại thống kê (kèm cơ chế gán trạng thái tự động)
                await DB.recalculateCustomerStats(c.id);

                let finalIntent = 'NONE';
                
                // Thu thập toàn bộ note của khách hàng này để phân tích
                const logs = allLogs.filter(l => l.customer_id === c.id && l.note);
                // Sắp xếp theo ngày giờ tăng dần (từ cũ đến mới nhất) để AI đọc theo đúng trình tự thời gian
                logs.sort((a,b) => {
                    const tA = new Date(a.created_at || a.care_date).getTime();
                    const tB = new Date(b.created_at || b.care_date).getTime();
                    if (tA === tB) {
                        return new Date(a.care_date).getTime() - new Date(b.care_date).getTime();
                    }
                    return tA - tB;
                });

                if (useAi) {
                    let fullText = c.note ? `[Ghi chú ban đầu] ${c.note}` : '';
                    logs.forEach(l => {
                        fullText += `\n[${Utils.formatDate(l.care_date) || l.care_date}] ${l.note}`;
                    });
                    
                    if (fullText.trim()) {
                        finalIntent = await Utils.analyzeKeywordIntent(fullText);
                        
                        await new Promise(r => setTimeout(r, 2000));
                        document.getElementById('loading-text').textContent = `Đang quét AI: Khách hàng ${c.full_name}...`;
                    }
                } else {
                    // Logic Regex thủ công: Đánh giá note gốc trước
                    if (c.note) {
                        const intent = Utils.analyzeKeywordIntentRegex(c.note, priorityKw, nonPriorityKw, stopKw, cancelKw);
                        if (intent !== 'NONE') finalIntent = intent;
                    }
                    // Đánh giá các log mới hơn, cái nào có kết quả sẽ ghi đè cái cũ
                    for (const l of logs) {
                        const intent = Utils.analyzeKeywordIntentRegex(l.note, priorityKw, nonPriorityKw, stopKw, cancelKw);
                        if (intent !== 'NONE') finalIntent = intent;
                    }
                }

                if (finalIntent !== 'NONE' || c.keyword_category !== finalIntent || c.stopped_status) {
                    const updates = {
                        keyword_category: finalIntent,
                        updated_at: new Date().toISOString()
                    };
                    
                    if (finalIntent === 'STOPPED') {
                        updates.stopped_status = true;
                    }
                    
                    if (finalIntent === 'CANCELLED') {
                        updates.cancelled_status = true;
                    }
                    
                    await DB.db.customers.update(c.id, updates);
                    
                    if (finalIntent === 'CANCELLED') countCancelled++;
                    if (finalIntent === 'STOPPED') countStopped++;
                    if (finalIntent === 'PRIORITY') countPriority++;
                    if (finalIntent === 'NON_PRIORITY') countNonPriority++;
                }
            }

            document.getElementById('loading-screen').classList.add('hidden');
            Utils.showToast(`Hoàn tất! Hủy/Hoàn: ${countCancelled}, Tạm dừng: ${countStopped}, Ưu tiên: ${countPriority}, Không ưu tiên: ${countNonPriority}.`, 'success', 5000);
            
            if (typeof CancelledModule !== 'undefined') CancelledModule.render();
            if (typeof StoppedModule !== 'undefined') StoppedModule.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();

        } catch (err) {
            document.getElementById('loading-screen').classList.add('hidden');
            Utils.showToast('Lỗi: ' + err.message, 'error');
        }
    },

    initEvents() {
        document.getElementById('btn-save-commission')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-save-care-cycle')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-save-keywords')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-scan-priority-keywords')?.addEventListener('click', () => this.scanOldDataKeywords());
        
        document.getElementById('btn-save-stop-keywords')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-scan-stop-keywords')?.addEventListener('click', () => this.scanOldDataKeywords());

        document.getElementById('btn-save-cancel-keywords')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-scan-cancel-keywords')?.addEventListener('click', () => this.scanOldDataKeywords());
        
        document.getElementById('btn-save-non-priority-keywords')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-scan-non-priority-keywords')?.addEventListener('click', () => this.scanOldDataKeywords());
        
        document.getElementById('btn-save-kpi')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-save-leading-kpi')?.addEventListener('click', () => this.saveSettings());
        
        document.getElementById('setting-use-ai')?.addEventListener('change', () => this.saveSettings());
        document.getElementById('btn-save-priority')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('btn-clear-data')?.addEventListener('click', () => this.confirmClearData());
        document.getElementById('btn-seed-data')?.addEventListener('click', () => this.confirmSeedData());
        
        document.getElementById('btn-save-gemini-key')?.addEventListener('click', async () => {
            const key = document.getElementById('setting-gemini-key').value.trim();
            await DB.setSetting('gemini_api_key', key);
            Utils.showToast('Đã lưu Gemini API Key!', 'success');
        });
        
        document.getElementById('theme-toggle')?.addEventListener('change', (e) => App.setTheme(e.target.checked ? 'light' : 'dark'));

        // Bind events cho Salary Calculator
        document.getElementById('calc-revenue')?.addEventListener('input', () => this.updateSalaryCalculator('revenue'));

        const calcInputs = ['calc-base', 'calc-kpi', 'calc-commission', 'calc-bonus', 'calc-days', 'calc-daily-wage'];
        calcInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateSalaryCalculator('other'));
            }
        });
    }
};
