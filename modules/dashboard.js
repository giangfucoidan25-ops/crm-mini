/* ===================================================================
   CRM MINI — DASHBOARD MODULE
   Hiển thị KPI cards, biểu đồ tổng quan và danh sách cần xử lý
   =================================================================== */

const DashboardModule = {
    stats: null,

    async render() {
        document.getElementById('dashboard-date').textContent =
            new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const timeFilter = document.getElementById('dashboard-time-filter').value;
        const dateRange = Utils.getDateRange(timeFilter, 
            document.getElementById('dashboard-date-from')?.value,
            document.getElementById('dashboard-date-to')?.value
        );
        this.stats = await DB.getStats(dateRange);

        this.renderRevenueKPIs();
        this.renderKPIs();
        this.renderTodayCalls();
        this.renderSpecialCare();
        this.renderTopProducts();
        ChartsModule.renderDashboardCharts(this.stats);
        this.updateBadges();
    },

    renderKPIs() {
        const s = this.stats;
        // Mock trend data for UI purposes
        const getTrend = (type) => {
            if (['blue', 'green', 'cyan'].includes(type)) return { icon: '↗', value: (Math.random() * 15 + 5).toFixed(1) + '%', class: 'trend-up' };
            if (['red', 'orange', 'yellow'].includes(type)) return { icon: '↘', value: (Math.random() * 10 + 2).toFixed(1) + '%', class: 'trend-down' };
            return { icon: '↗', value: '0.0%', class: 'trend-neutral' };
        };

        const customerKPIs = [
            { icon: '👥', value: s.totalCustomers, label: 'Tổng khách hàng', color: 'blue', filter: 'all_customers' },
            { icon: '🆕', value: s.newCustomers, label: 'Khách mới tháng', color: 'cyan', filter: 'new_customers' },
            { icon: '↗️', value: s.transferred.length, label: 'Khách bị chuyển', color: 'pink', filter: 'transferred' },
            { icon: '🔄', value: s.repurchasedCustomers.length, label: 'Khách tái mua', color: 'green', filter: 'repurchased' },
            { icon: '🏢', value: s.agencyCustomers.length, label: 'Khách đại lý', color: 'purple', filter: 'agency' },
            { icon: '💎', value: s.vipCustomers.length, label: 'Khách VIP', color: 'yellow', filter: 'vip' }
        ];

        const careKPIs = [
            { icon: '⏰', value: s.productRunningOut.length, label: 'Sắp hết sản phẩm', color: 'orange', filter: 'product_running_out' },
            { icon: '📦', value: s.productExpired.length, label: 'Đã hết sản phẩm', color: 'red', filter: 'product_expired' },
            { icon: '⚠️', value: s.overdue30Customers.length, label: 'Quá hạn >30 ngày', color: 'red', filter: 'overdue_30' },
            { icon: '❌', value: s.cancelledOrders + s.returnedOrders, label: 'Đơn hủy/hoàn', color: 'red', filter: 'orders_cancelled' },
            { icon: '↗️', value: s.transferred.length, label: 'Khách bị chuyển', color: 'pink', filter: 'transferred' },
            { icon: '📞', value: s.dueTodayCustomers.length, label: 'Cần chăm sóc', color: 'yellow', filter: 'due_today' }
        ];

        const renderGroup = (kpis, elementId) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            el.innerHTML = kpis.map(kpi => {
                const trend = getTrend(kpi.color);
                return `
                <div class="kpi-card pro-card" data-color="${kpi.color}" data-filter="${kpi.filter}" onclick="DashboardModule.onKPIClick('${kpi.filter}')" style="display: flex; flex-direction: column; padding: 16px; justify-content: center;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="kpi-icon-wrap bg-${kpi.color}-light text-${kpi.color}" style="width: 36px; height: 36px; font-size: 18px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">${kpi.icon}</div>
                            <div class="kpi-label" style="margin-bottom: 0; font-weight: 500;">${kpi.label}</div>
                        </div>
                        <div class="kpi-value text-${kpi.color}" style="font-size: 22px; line-height: 1;">${kpi.value}</div>
                    </div>
                    <div class="kpi-trend" style="display: flex; align-items: center; gap: 8px;">
                        <span class="${trend.class}">${trend.icon} ${trend.value}</span>
                        <span class="trend-label">so với tháng trước</span>
                    </div>
                </div>`;
            }).join('');
        };

        renderGroup(customerKPIs, 'kpi-grid-customers');
        renderGroup(careKPIs, 'kpi-grid-care');
    },

    renderRevenueKPIs() {
        const s = this.stats;
        const kpis = [
            { icon: '💰', value: Utils.formatCurrency(s.totalRevenue), label: 'Tổng doanh số hợp lệ', color: 'green' },
            { icon: '🎯', value: Utils.formatCurrency(s.commission), label: `Hoa hồng (${s.commissionRate}%)`, color: 'purple' },
            { icon: '📦', value: s.totalOrders, label: 'Tổng đơn hàng', color: 'blue' },
            { icon: '📊', value: s.conversionRate + '%', label: 'Tỉ lệ chuyển đổi', color: 'cyan' },
        ];

        const container = document.getElementById('dashboard-revenue-kpis');
        if (container) {
            container.innerHTML = kpis.map(k => `
                <div class="kpi-card" data-color="${k.color}" style="cursor: default;">
                    <div class="kpi-icon">${k.icon}</div>
                    <div class="kpi-value">${k.value}</div>
                    <div class="kpi-label">${k.label}</div>
                </div>
            `).join('');
        }
    },

    renderTodayCalls() {
        const list = this.stats.dueTodayCustomers.slice(0, 5);
        const container = document.getElementById('today-calls-list');
        document.getElementById('count-today-calls').textContent = this.stats.dueTodayCustomers.length;

        if (list.length === 0) {
            container.innerHTML = '<p class="empty-state">🎉 Không có khách cần gọi hôm nay</p>';
            return;
        }

        container.innerHTML = list.map(c => {
            const careStatus = Utils.getCareStatus(c, this.stats.careConfig);
            return `
            <div class="customer-mini">
                <div class="customer-mini-info">
                    <div class="customer-mini-name">
                        <span style="cursor:pointer;" onclick="CustomersModule.viewCustomer(${c.id})">${Utils.escapeHtml(c.full_name)}</span>
                        ${Utils.getGetFlyLink(c)}
                    </div>
                    <div class="customer-mini-detail">${c.phone || ''} • ${Utils.sourceLabel(c.customer_source)}</div>
                </div>
                <div class="customer-mini-actions">
                    <button class="action-btn btn-zalo" onclick="ZaloModule.openZalo('${c.zalo_phone || c.phone}')" title="Mở Zalo">💬</button>
                    <button class="action-btn btn-care" onclick="CareModule.markCared(${c.id})" title="Đánh dấu đã chăm sóc" style="color:${careStatus.status === 'ok' ? 'var(--color-success)' : 'var(--text-muted)'};">${careStatus.status === 'ok' ? '✓' : '☐'}</button>
                </div>
            </div>
        `;}).join('');
    },

    renderSpecialCare() {
        const customers = this.stats.customers;
        const scored = AiAnalysisModule.calculatePriorityScores(customers, this.stats);
        const topCare = scored.filter(c => c._priorityScore > 0).slice(0, 5);

        document.getElementById('count-special-care').textContent = topCare.length;
        const container = document.getElementById('special-care-list');

        if (topCare.length === 0) {
            container.innerHTML = '<p class="empty-state">Chưa có khách cần chăm sóc đặc biệt</p>';
            return;
        }

        container.innerHTML = topCare.map(c => `
            <div class="customer-mini">
                <div class="customer-mini-info">
                    <div class="customer-mini-name">
                        <span style="cursor:pointer;" onclick="CustomersModule.viewCustomer(${c.id})">${Utils.escapeHtml(c.full_name)}</span>
                        ${Utils.getGetFlyLink(c)}
                    </div>
                    <div class="customer-mini-detail">${c._reasons.join(', ')}</div>
                </div>
                <span class="care-item-score">${c._priorityScore}đ</span>
            </div>
        `).join('');
    },

    renderTopProducts() {
        const orders = this.stats.orders.filter(o => o.order_status === 'completed');
        const productMap = {};
        orders.forEach(o => {
            if (!productMap[o.product_name]) productMap[o.product_name] = { revenue: 0, qty: 0 };
            productMap[o.product_name].revenue += o.total_amount || 0;
            productMap[o.product_name].qty += o.quantity || 0;
        });

        const sorted = Object.entries(productMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
        const container = document.getElementById('top-products-list');

        if (sorted.length === 0) {
            container.innerHTML = '<p class="empty-state">Chưa có dữ liệu bán hàng</p>';
            return;
        }

        container.innerHTML = sorted.map(([name, data], i) => {
            const rankClass = i < 3 ? `rank-${i + 1}` : 'rank-other';
            return `
                <div class="top-product-item">
                    <span class="top-product-rank ${rankClass}">${i + 1}</span>
                    <div class="top-product-info">
                        <div class="top-product-name">${Utils.escapeHtml(name)}</div>
                        <div class="top-product-stat">${data.qty} sản phẩm đã bán</div>
                    </div>
                    <div class="top-product-revenue">${Utils.formatCurrencyShort(data.revenue)}</div>
                </div>
            `;
        }).join('');
    },

    updateBadges() {
        const s = this.stats;
        const setBadge = (id, count) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = count;
                el.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        };
        setBadge('badge-dashboard', s.dueTodayCustomers.length + s.overdue30Customers.length);
        setBadge('badge-customers', s.totalCustomers);
        setBadge('badge-care', s.overdueCustomers.length);
        setBadge('badge-transferred', s.transferred.length);
    },

    onKPIClick(filter) {
        let title = '', customerList = [], orderList = [];

        switch (filter) {
            case 'all_customers':
                title = 'Tổng khách hàng';
                customerList = this.stats.customers;
                break;
            case 'new_customers':
                title = 'Khách hàng mới trong tháng';
                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
                customerList = this.stats.customers.filter(c => c.created_at >= monthStart);
                break;
            case 'due_today':
                title = 'Khách cần chăm sóc hôm nay';
                customerList = this.stats.dueTodayCustomers;
                break;
            case 'product_running_out':
                title = 'Khách sắp hết sản phẩm';
                customerList = this.stats.productRunningOut;
                break;
            case 'product_expired':
                title = 'Khách đã hết sản phẩm';
                customerList = this.stats.productExpired;
                break;
            case 'overdue_30':
                title = 'Khách quá hạn chăm sóc >30 ngày';
                customerList = this.stats.overdue30Customers;
                break;
            case 'transferred':
                title = 'Khách bị chuyển';
                customerList = this.stats.transferred;
                break;
            case 'repurchased':
                title = 'Khách tái mua';
                customerList = this.stats.repurchasedCustomers;
                break;
            case 'agency':
                title = 'Khách đại lý';
                customerList = this.stats.agencyCustomers;
                break;
            case 'vip':
                title = 'Khách VIP';
                customerList = this.stats.vipCustomers;
                break;
            case 'orders_completed':
                title = 'Đơn hàng đã nhận';
                orderList = this.stats.orders.filter(o => o.order_status === 'completed');
                break;
            case 'orders_cancelled':
                title = 'Đơn hàng đã hủy hoặc hoàn';
                orderList = this.stats.orders.filter(o => o.order_status === 'cancelled' || o.order_status === 'returned');
                break;
            default:
                return;
        }

        if (customerList.length > 0) {
            DrilldownModule.showCustomerList(title, customerList);
        } else if (orderList.length > 0) {
            DrilldownModule.showOrderList(title, orderList);
        }
    },

    initEvents() {
        document.getElementById('dashboard-time-filter').addEventListener('change', (e) => {
            const custom = document.getElementById('dashboard-custom-date');
            custom.style.display = e.target.value === 'custom' ? 'flex' : 'none';
            this.render();
        });
        document.getElementById('dashboard-date-from')?.addEventListener('change', () => this.render());
        document.getElementById('dashboard-date-to')?.addEventListener('change', () => this.render());
    }
};
