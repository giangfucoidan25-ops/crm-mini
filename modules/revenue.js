/* ===================================================================
   CRM MINI — REVENUE MODULE
   Doanh số, hoa hồng, tỉ lệ chuyển đổi
   =================================================================== */

const RevenueModule = {
    async render() {
        const timeFilter = document.getElementById('revenue-time-filter')?.value || 'month';
        const dateRange = Utils.getDateRange(timeFilter,
            document.getElementById('revenue-date-from')?.value,
            document.getElementById('revenue-date-to')?.value
        );
        const stats = await DB.getStats(dateRange);

        this.renderKPIs(stats);
        this.renderConversion(stats);
        ChartsModule.renderRevenueCharts(stats);
    },

    renderKPIs(s) {
        const kpis = [
            { icon: '💰', value: Utils.formatCurrency(s.totalRevenue), label: 'Tổng doanh số hợp lệ', color: 'green' },
            { icon: '🎯', value: Utils.formatCurrency(s.commission), label: `Hoa hồng (${s.commissionRate}%)`, color: 'purple' },
            { icon: '📦', value: s.totalOrders, label: 'Tổng đơn hàng', color: 'blue' },
            { icon: '📊', value: s.conversionRate + '%', label: 'Tỉ lệ chuyển đổi', color: 'cyan' },
        ];

        document.getElementById('revenue-kpi-grid').innerHTML = kpis.map(k => `
            <div class="kpi-card" data-color="${k.color}">
                <div class="kpi-icon">${k.icon}</div>
                <div class="kpi-value">${k.value}</div>
                <div class="kpi-label">${k.label}</div>
            </div>
        `).join('');
    },

    renderConversion(s) {
        const customers = s.customers;
        const statusCounts = {};
        customers.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

        const funnelStages = [
            { key: 'new', label: 'Khách mới' },
            { key: 'contacted', label: 'Đã liên hệ' },
            { key: 'consulting', label: 'Đang tư vấn' },
            { key: 'waiting_close', label: 'Chờ chốt' },
            { key: 'purchased', label: 'Đã mua' },
            { key: 'repurchased', label: 'Mua lại' },
            { key: 'vip', label: 'VIP' },
        ];

        const total = customers.length || 1;
        const repurchaseCount = customers.filter(c => ['repurchased', 'vip'].includes(c.status)).length;
        const purchaseCount = customers.filter(c => ['purchased', 'repurchased', 'vip'].includes(c.status)).length;

        document.getElementById('conversion-stats').innerHTML = `
            <div class="conversion-grid">
                ${funnelStages.map(stage => `
                    <div class="conversion-item">
                        <div class="conversion-value">${statusCounts[stage.key] || 0}</div>
                        <div class="conversion-label">${stage.label}</div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:20px;padding:16px;background:var(--bg-tertiary);border-radius:8px;">
                <div style="display:flex;justify-content:space-around;text-align:center;">
                    <div>
                        <div style="font-size:24px;font-weight:800;color:var(--color-success);">${s.conversionRate}%</div>
                        <div style="font-size:12px;color:var(--text-muted);">Tỉ lệ chuyển đổi</div>
                    </div>
                    <div>
                        <div style="font-size:24px;font-weight:800;color:var(--color-info);">${purchaseCount > 0 ? ((repurchaseCount / purchaseCount) * 100).toFixed(1) : 0}%</div>
                        <div style="font-size:12px;color:var(--text-muted);">Tỉ lệ mua lại</div>
                    </div>
                    <div>
                        <div style="font-size:24px;font-weight:800;color:var(--color-purple);">${s.totalOrders > 0 ? Utils.formatCurrency(s.totalRevenue / s.completedOrders || 0) : '0 ₫'}</div>
                        <div style="font-size:12px;color:var(--text-muted);">AOV (Giá trị ĐH TB)</div>
                    </div>
                </div>
            </div>
        `;
    },

    initEvents() {
        document.getElementById('revenue-time-filter')?.addEventListener('change', (e) => {
            const custom = document.getElementById('revenue-custom-date');
            if (custom) custom.style.display = e.target.value === 'custom' ? 'flex' : 'none';
            this.render();
        });
        document.getElementById('revenue-date-from')?.addEventListener('change', () => this.render());
        document.getElementById('revenue-date-to')?.addEventListener('change', () => this.render());
    }
};
