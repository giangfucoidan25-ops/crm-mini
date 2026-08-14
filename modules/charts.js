/* ===================================================================
   CRM MINI — CHARTS MODULE
   Biểu đồ Chart.js với interactive drill-down
   =================================================================== */

const ChartsModule = {
    charts: {},

    destroyChart(id) {
        if (this.charts[id]) { this.charts[id].destroy(); delete this.charts[id]; }
    },

    getChartColors() {
        return {
            primary: '#0D9488', secondary: '#0ea5e9',
            success: '#10B981', warning: '#F59E0B',
            danger: '#EF4444', purple: '#8B5CF6',
            pink: '#EC4899', cyan: '#06B6D4',
            orange: '#F97316', gray: '#94a3b8',
            palette: ['#0D9488', '#0ea5e9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#64748b']
        };
    },

    getChartDefaults() {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        return {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: isDark ? '#a0a3b1' : '#5a5d6b', font: { family: 'Inter', size: 12 } } },
                tooltip: {
                    backgroundColor: isDark ? '#242836' : '#fff',
                    titleColor: isDark ? '#f0f0f5' : '#1a1d27',
                    bodyColor: isDark ? '#a0a3b1' : '#5a5d6b',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1, cornerRadius: 8, padding: 12,
                    titleFont: { family: 'Inter', weight: '600' },
                    bodyFont: { family: 'Inter' },
                    callbacks: { label: (ctx) => ` ${ctx.dataset.label || ''}: ${Utils.formatCurrency(ctx.raw)}` }
                }
            },
            scales: {
                x: { 
                    ticks: { color: isDark ? '#6b6e7b' : '#94a3b8', font: { family: 'Inter', size: 11 } }, 
                    grid: { display: false } 
                },
                y: { 
                    ticks: { color: isDark ? '#6b6e7b' : '#94a3b8', font: { family: 'Inter', size: 11 }, callback: (v) => Utils.formatCurrencyShort(v) }, 
                    grid: { display: true, color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderDash: [5, 5] },
                    border: { display: false }
                }
            }
        };
    },

    renderDashboardCharts(stats) {
        this.renderOrderStatusChart('chart-order-status', stats, true);
        this.renderRevenueTimeChart('chart-revenue-time', stats);
        this.renderRevenueProductChart('chart-revenue-product', stats);
        this.renderProductExpiryChart('chart-product-expiry', stats);
    },

    async renderFullCharts(stats, dateRange) {
        if (!dateRange) {
            const timeFilter = document.getElementById('charts-time-filter')?.value || 'month';
            dateRange = Utils.getDateRange(timeFilter,
                document.getElementById('charts-date-from')?.value,
                document.getElementById('charts-date-to')?.value
            );
        }
        await this.renderKeyIndicators(stats, dateRange);
        await this.renderLeadingIndicators(stats, dateRange);
        this.renderOrderStatusChart('chart-full-order-status', stats);
        this.renderRevenueProductChart('chart-full-revenue-product', stats);
        this.renderQuantityProductChart('chart-full-quantity-product', stats);
        this.renderRevenueTimeChart('chart-full-revenue-time', stats);
        this.renderProductExpiryChart('chart-full-product-expiry', stats);
        this.renderOverdueCareChart('chart-full-overdue-care', stats);
        this.renderRevenueSourceChart('chart-full-revenue-source', stats);
        this.renderFunnelChart('chart-full-funnel', stats);
    },

    // ===== Render Key Metrics KPI Cards =====
    async renderKeyIndicators(stats, dateRange) {
        const container = document.getElementById('charts-kpi-grid');
        if (!container) return;

        if (!dateRange) {
            const timeFilter = document.getElementById('charts-time-filter')?.value || 'month';
            dateRange = Utils.getDateRange(timeFilter,
                document.getElementById('charts-date-from')?.value,
                document.getElementById('charts-date-to')?.value
            );
        }

        // 1. Tỷ lệ chuyển đổi (Conversion Rate)
        const conversionRate = (stats.totalCustomers > 0 ? (stats.completedOrders / stats.totalCustomers * 100) : 0).toFixed(1);

        // 2. Giá trị trung bình mỗi đơn hàng (Average Order Value - AOV)
        const aov = stats.completedOrders > 0 ? Math.round(stats.totalRevenue / stats.completedOrders) : 0;

        // 3. Doanh thu theo sản phẩm / nhóm khách hàng
        // Top product by revenue in current date filter
        const completed = stats.orders.filter(o => o.order_status === 'completed');
        const prodMap = {};
        completed.forEach(o => { prodMap[o.product_name] = (prodMap[o.product_name] || 0) + (o.total_amount || 0); });
        const topProduct = Object.entries(prodMap).sort((a, b) => b[1] - a[1])[0];

        // Historical data for segmentation
        const completedOrdersCountHistory = {};
        const customerLastOrderDate = {};
        stats.allOrders.filter(o => o.order_status === 'completed').forEach(o => {
            completedOrdersCountHistory[o.customer_id] = (completedOrdersCountHistory[o.customer_id] || 0) + 1;
            const currentLast = customerLastOrderDate[o.customer_id];
            if (!currentLast || o.order_date > currentLast) {
                customerLastOrderDate[o.customer_id] = o.order_date;
            }
        });

        const customerMap = {};
        stats.customers.forEach(c => customerMap[c.id] = c);

        const getCustomerGroup = (c) => {
            const historyCount = completedOrdersCountHistory[c.id] || 0;
            const lastPurchase = customerLastOrderDate[c.id];
            
            // Nhóm Ngủ đông (Không mua > 6 tháng hoặc c.status === 'stopped')
            const isStopped = c.status === 'stopped';
            const isHibernating = lastPurchase && Utils.daysAgo(lastPurchase) > 180;
            if (isStopped || isHibernating) {
                return 'ngu_dong';
            }
            
            // Nhóm VIP (Mua >= 3 lần hoặc status vip)
            if (c.status === 'vip' || historyCount >= 3) {
                return 'vip';
            }
            
            // Nhóm Tiềm năng (Mua 1-2 lần hoặc chưa mua)
            return 'tiem_nang';
        };

        let vipRevenue = 0;
        let tiemNangRevenue = 0;
        let nguDongRevenue = 0;

        completed.forEach(o => {
            const cust = customerMap[o.customer_id];
            if (!cust) {
                tiemNangRevenue += o.total_amount || 0;
                return;
            }
            const grp = getCustomerGroup(cust);
            if (grp === 'vip') {
                vipRevenue += o.total_amount || 0;
            } else if (grp === 'ngu_dong') {
                nguDongRevenue += o.total_amount || 0;
            } else {
                tiemNangRevenue += o.total_amount || 0;
            }
        });

        const totalGroupRevenue = vipRevenue + tiemNangRevenue + nguDongRevenue;
        const getPct = (val) => {
            if (totalGroupRevenue === 0) return '0.0';
            return ((val / totalGroupRevenue) * 100).toFixed(1);
        };

        const vipPct = getPct(vipRevenue);
        const tiemNangPct = getPct(tiemNangRevenue);
        const nguDongPct = getPct(nguDongRevenue);

        // 4. Tỷ lệ khách hàng quay lại (Retention Rate)
        const purchasedCount = stats.customers.filter(c =>
            ['purchased', 'repurchased', 'vip'].includes(c.status)
        ).length;
        const repeatCount = stats.repurchasedCustomers.length + stats.vipCustomers.length;
        const retentionRate = purchasedCount > 0 ? ((repeatCount / purchasedCount) * 100).toFixed(1) : 0;

        // 5. Giá trị trọn đời (Lifetime Value - LTV)
        // LTV = AOV * Số lần mua trung bình mỗi năm * Số năm khách hàng trung thành (mặc định 3 năm)
        const totalCompletedOrdersHistory = stats.allOrders.filter(o => o.order_status === 'completed').length;
        const avgPurchasesPerYear = purchasedCount > 0 ? (totalCompletedOrdersHistory / purchasedCount) : 0;
        const lifespanYears = 3;
        const ltv = Math.round(aov * avgPurchasesPerYear * lifespanYears);

        // 6. Tỷ lệ khách hàng mới so với khách hàng cũ (New vs. Returning Customer Rate)
        const periodPurchasedCustomerIds = [...new Set(completed.map(o => o.customer_id))];
        const returningCustomersCount = periodPurchasedCustomerIds.filter(id => {
            // Khách cũ là khách có tổng số đơn hàng hoàn thành tính đến cuối kỳ >= 2
            const totalOrdersBeforeEndOfPeriod = stats.allOrders.filter(o =>
                o.customer_id === id &&
                o.order_status === 'completed' &&
                o.order_date <= dateRange.to
            ).length;
            return totalOrdersBeforeEndOfPeriod >= 2;
        }).length;
        const totalPeriodCustomers = periodPurchasedCustomerIds.length;
        const returningCustomerRate = totalPeriodCustomers > 0 ? ((returningCustomersCount / totalPeriodCustomers) * 100).toFixed(1) : 0;

        const rate = totalPeriodCustomers > 0 ? returningCustomerRate : retentionRate;
        const countOld = totalPeriodCustomers > 0 ? returningCustomersCount : repeatCount;
        const countTotal = totalPeriodCustomers > 0 ? totalPeriodCustomers : purchasedCount;

        // 7. Thời gian trung bình vòng đời bán hàng (Sales Cycle Length)
        let totalCycleDays = 0;
        let cycleCount = 0;
        completed.forEach(o => {
            const cust = customerMap[o.customer_id];
            if (cust && cust.created_at && o.order_date) {
                const createdDate = new Date(cust.created_at);
                const orderDate = new Date(o.order_date);
                const diffDays = Math.round((orderDate - createdDate) / (1000 * 60 * 60 * 24));
                if (diffDays >= 0) {
                    totalCycleDays += diffDays;
                    cycleCount++;
                }
            }
        });
        const avgSalesCycle = cycleCount > 0 ? (totalCycleDays / cycleCount).toFixed(1) : 0;

        // 8. Tỷ lệ KH Từ chối (Drop-off Rate)
        const consultedStatuses = ['consulting', 'waiting_close', 'purchased', 'repurchased', 'vip', 'agency', 'stopped', 'transferred', 'cancelled'];
        const consultedCustomers = stats.customers.filter(c => consultedStatuses.includes(c.status));
        const consultedTotal = consultedCustomers.length;
        const completedCustomerIds = new Set(completed.map(o => o.customer_id));
        const noCloseCount = consultedCustomers.filter(c => !completedCustomerIds.has(c.id)).length;
        const customerDropOffRate = consultedTotal > 0 ? ((noCloseCount / consultedTotal) * 100).toFixed(1) : 0;

        // 9. Tỷ lệ KH theo liệu trình (Retention by Cycle)
        const purchaseCountPerCustomer = {};
        stats.allOrders.filter(o => o.order_status === 'completed').forEach(o => {
            purchaseCountPerCustomer[o.customer_id] = (purchaseCountPerCustomer[o.customer_id] || 0) + 1;
        });
        const cycleCounts = {};
        Object.values(purchaseCountPerCustomer).forEach(count => {
            for (let i = 1; i <= count; i++) {
                cycleCounts[i] = (cycleCounts[i] || 0) + 1;
            }
        });
        const maxCycle = Math.max(...Object.keys(cycleCounts).map(Number), 1);
        const minCycles = Math.max(maxCycle, 4); // Luôn hiển thị tối thiểu 4 chu kỳ
        const cycleRates = [];
        for (let n = 1; n <= minCycles; n++) {
            const fromCount = cycleCounts[n] || 0;
            const toCount = cycleCounts[n + 1] || 0;
            const r = fromCount > 0 ? ((toCount / fromCount) * 100).toFixed(1) : '0.0';
            cycleRates.push({ from: n, to: n + 1, fromCount, toCount, rate: r });
        }

        const kpiThresholds = await DB.getSetting('kpi_thresholds') || {
            conv_low: 15, conv_high: 30,
            ret_low: 5, ret_high: 20,
            newold_low: 15, newold_high: 50,
            drop_low: 20, drop_high: 50
        };

        const getConvAdvice = (val) => {
            if (val < kpiThresholds.conv_low) return 'Báo động! Tỷ lệ chốt sale đang thấp. Cần xem lại kịch bản tư vấn hoặc tệp khách hàng chưa chuẩn.';
            if (val <= kpiThresholds.conv_high) return 'Ổn định. Có thể cải thiện bằng cách tạo thêm khan hiếm hoặc các ưu đãi giới hạn thời gian nhỏ.';
            return 'Rất tốt! Khách chốt đơn mạnh. Tiếp tục duy trì kịch bản sale và tệp khách hiện tại.';
        };

        const getRetAdvice = (val) => {
            if (val < kpiThresholds.ret_low) return 'Khách mua 1 lần rồi đi. Dịch vụ hậu mãi hoặc sản phẩm đang có vấn đề, cần gọi khảo sát ngay để tìm nguyên nhân.';
            if (val <= kpiThresholds.ret_high) return 'Tỷ lệ quay lại mức trung bình. Vẫn còn dư địa tăng, hãy triển khai thêm các kịch bản CSKH định kỳ.';
            return 'Khách hàng rất trung thành! Chất lượng sản phẩm và dịch vụ chăm sóc của bạn cực kỳ tốt.';
        };

        const getNewOldAdvice = (val) => {
            if (val < kpiThresholds.newold_low) return 'Sales đang mải mê "săn bắt" khách mới mà bỏ quên "chăn nuôi". Hãy chia lại thời gian chăm khách cũ để giảm chi phí!';
            if (val <= kpiThresholds.newold_high) return 'Sự cân bằng tuyệt vời. Vừa liên tục có khách mới (săn bắt), vừa khai thác tốt khách cũ (chăn nuôi).';
            return 'Khách cũ mua nhiều hơn khách mới! Đội ngũ đang "chăn nuôi" cực tốt, chi phí Marketing gần như bằng 0.';
        };

        const getDropAdvice = (val) => {
            if (val > kpiThresholds.drop_high) return 'Báo động! Khách hỏi rất nhiều nhưng rụng quá nửa. Lỗi do tư vấn sai tệp, giá quá cao, hoặc kịch bản chốt yếu.';
            if (val >= kpiThresholds.drop_low) return 'Tỷ lệ rụng ở mức trung bình. Hãy follow-up (nhắn tin hỏi thăm lại) những người này bằng một ưu đãi bất ngờ.';
            return 'Tuyệt vời! Gần như khách nào vào phễu cũng chốt. Chân dung khách hàng vô cùng chuẩn xác.';
        };

        const getSalesCycleAdvice = (val) => {
            if (val <= 3) return 'Chốt đơn siêu tốc độ! Kịch bản mượt và đánh trúng tâm lý khách hàng.';
            if (val <= 10) return 'Thời gian chốt đơn trung bình. Hãy tạo ra các Flash Sale để giục khách chốt nhanh hơn.';
            return 'Khách ngâm quá lâu! Hãy dùng đòn bẩy "khan hiếm" (Sắp hết hàng, Quà tặng 24h) để kích thích họ ra quyết định.';
        };

        const kpis = [
            {
                icon: '🎯',
                label: 'Tỷ lệ chuyển đổi',
                value: `${conversionRate}%`,
                subtitle: `Đơn thành công: ${stats.completedOrders} / Tổng khách hàng: ${stats.totalCustomers}`,
                color: 'cyan',
                staticDesc: 'Đây là chỉ số quan trọng nhất để biết bạn đang làm tốt ở khâu nào và yếu ở khâu nào.',
                desc: getConvAdvice(parseFloat(conversionRate))
            },
            {
                icon: '💰',
                label: 'Giá trị TB đơn hàng (AOV)',
                value: Utils.formatCurrency(aov),
                subtitle: `Doanh số: ${Utils.formatCurrency(stats.totalRevenue)} / ${stats.completedOrders} đơn`,
                color: 'green',
                staticDesc: 'Giúp bạn hiểu được khả năng tối ưu hóa giá trị trên mỗi khách hàng.',
                desc: `AOV hiện tại: ${Utils.formatCurrency(aov)}. Hãy thử tư vấn Upsell (bán kèm) hoặc Cross-sell (bán chéo) thêm sản phẩm phụ trợ để tăng biên độ lợi nhuận.`
            },
            {
                icon: '👑',
                label: 'Doanh thu theo SP/nhóm KH',
                value: topProduct ? topProduct[0] : 'Chưa có',
                subtitle: `Doanh số tốt nhất: ${topProduct ? Utils.formatCurrency(topProduct[1]) : '0đ'}`,
                color: 'purple',
                staticDesc: 'Giúp bạn nhận diện "mỏ vàng" để tập trung nguồn lực đúng chỗ.',
                desc: topProduct ? `Sản phẩm "${topProduct[0]}" đang là mỏ vàng. Hãy tập trung ngân sách Marketing hoặc ưu tiên chốt sale tệp khách này!` : 'Chưa có dữ liệu. Cần ghi chú sản phẩm chi tiết hơn ở mỗi đơn hàng để phân tích.'
            },
            {
                icon: '🔄',
                label: 'Tỷ lệ quay lại (Retention)',
                value: `${retentionRate}%`,
                subtitle: `Khách tái mua/VIP: ${repeatCount} / Tổng khách đã mua: ${purchasedCount}`,
                color: 'orange',
                staticDesc: 'Với Sales, việc chăm sóc khách cũ luôn tốn ít chi phí hơn tìm khách mới.',
                desc: getRetAdvice(parseFloat(retentionRate))
            },
            {
                icon: '💎',
                label: 'Giá trị trọn đời (LTV)',
                value: Utils.formatCurrency(ltv),
                subtitle: `Mua TB: ${avgPurchasesPerYear.toFixed(1)} lần/năm | Gắn bó: ${lifespanYears} năm`,
                color: 'blue',
                staticDesc: 'Chỉ số này giúp bạn biết mình nên "đầu tư" bao nhiêu công sức vào một khách hàng. Đừng tiếc thời gian chăm sóc những khách hàng có LTV cao.',
                desc: ltv > 0 ? `Trung bình 1 khách mang lại ${Utils.formatCurrency(ltv)} trong ${lifespanYears} năm. Đừng tiếc vài quà tặng nhỏ để giữ chân họ nhé!` : 'Dữ liệu chưa đủ. Hãy tích cực chăn nuôi khách hàng cũ để nâng cao chỉ số này.'
            },
            {
                icon: '👥',
                label: 'Tỷ lệ khách cũ/mới trong kỳ',
                value: `${rate}%`,
                subtitle: `Khách cũ quay lại: ${countOld} / Tổng khách mua: ${countTotal}`,
                color: 'pink',
                staticDesc: 'Đây là chỉ số phản ánh uy tín cá nhân và chất lượng sản phẩm của bạn. Một Sales giỏi không chỉ giỏi săn mồi (khách mới) mà còn giỏi chăn nuôi (khách cũ).',
                desc: getNewOldAdvice(parseFloat(rate))
            },
            {
                icon: '⏳',
                label: 'Vòng đời bán hàng (Sales Cycle)',
                value: `${avgSalesCycle} ngày`,
                subtitle: `Tổng ${cycleCount} đơn | Tổng ${totalCycleDays} ngày chốt`,
                color: 'cyan',
                staticDesc: 'Đo lường thời gian từ lúc KH tiềm năng xuất hiện đến khi chốt đơn. Nếu vòng đời quá dài, bạn cần thúc đẩy KH quyết định nhanh hơn.',
                desc: getSalesCycleAdvice(parseFloat(avgSalesCycle))
            },
            {
                icon: '🚫',
                label: 'Tỷ lệ KH Từ chối (Drop-off)',
                value: `${customerDropOffRate}%`,
                subtitle: `Không chốt: ${noCloseCount} / Đã tư vấn: ${consultedTotal} KH`,
                color: 'red',
                staticDesc: 'Tỷ lệ KH đã được tư vấn đầy đủ nhưng không chốt đơn. Nếu chỉ số này cao, bạn cần xem lại kỹ năng chốt sale hoặc chính sách giá/sản phẩm.',
                desc: getDropAdvice(parseFloat(customerDropOffRate))
            },

        ];

        container.innerHTML = kpis.map(kpi => `
            <div class="kpi-card pro-card" data-color="${kpi.color}" style="display: flex; flex-direction: column; padding: 16px; justify-content: space-between; cursor: default; min-height: 150px; height: 100%;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px;" title="${kpi.staticDesc}">
                            <div class="kpi-icon-wrap bg-${kpi.color}-light text-${kpi.color}" style="width: 36px; height: 36px; font-size: 18px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">${kpi.icon}</div>
                            <div class="kpi-label" style="margin-bottom: 0; font-weight: 600; font-size: 14px; color: var(--text-primary);">${kpi.label}</div>
                        </div>
                    </div>
                    <div class="kpi-value text-${kpi.color}" style="font-size: 18px; font-weight: 800; line-height: 1.2; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${kpi.value}">${kpi.value}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${kpi.subtitle.replace(/<br>/g, ' ')}">${kpi.subtitle}</div>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 8px; font-size: 11px; color: var(--text-muted); line-height: 1.4;">
                    ${kpi.desc}
                </div>
            </div>
        `).join('');

        // Render Retention by Cycle table (luôn tối thiểu 4 dòng)
        const cycleTbody = document.getElementById('charts-cycle-tbody');
        if (cycleTbody) {
            const getEval = (rate, fromCount) => {
                if (fromCount === 0) return { text: '⚪ Chưa có dữ liệu', color: 'var(--text-muted)' };
                const r = parseFloat(rate);
                if (r >= 70) return { text: '🟢 Xuất sắc', color: 'var(--color-success)' };
                if (r >= 50) return { text: '🟡 Tốt', color: 'var(--color-warning)' };
                if (r >= 30) return { text: '🟠 Cần cải thiện', color: 'var(--color-orange)' };
                return { text: '🔴 Yếu', color: 'var(--color-danger)' };
            };
            const getBarColor = (rate, fromCount) => {
                if (fromCount === 0) return 'var(--border-color)';
                const r = parseFloat(rate);
                if (r >= 70) return 'var(--color-success)';
                if (r >= 50) return 'var(--color-warning)';
                if (r >= 30) return 'var(--color-orange)';
                return 'var(--color-danger)';
            };
            const cycleLabels = {
                1: 'Mua lần đầu → Quay lại lần 2',
                2: 'Mua lần 2 → Tiếp tục lần 3',
                3: 'Mua lần 3 → Trung thành lần 4',
                4: 'Mua lần 4 → VIP lần 5'
            };
            cycleTbody.innerHTML = cycleRates.map(cr => {
                const ev = getEval(cr.rate, cr.fromCount);
                const barColor = getBarColor(cr.rate, cr.fromCount);
                const barWidth = cr.fromCount > 0 ? Math.max(parseFloat(cr.rate), 2) : 0;
                const label = cycleLabels[cr.from] || `Mua lần ${cr.from} → Lần ${cr.to}`;
                return `
                    <tr>
                        <td style="padding: 14px 16px; border-bottom: 1px solid var(--border-color);">
                            <div style="font-weight: 700; color: var(--text-primary); font-size: 13px;">Lần ${cr.from} → Lần ${cr.to}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${label}</div>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid var(--border-color); font-weight: 600; color: var(--text-primary); font-size: 14px; text-align: center;">${cr.fromCount}</td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid var(--border-color); font-weight: 600; color: var(--text-primary); font-size: 14px; text-align: center;">${cr.toCount}</td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid var(--border-color); min-width: 160px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="flex: 1; height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden;">
                                    <div style="width: ${barWidth}%; height: 100%; background: ${barColor}; border-radius: 4px; transition: width 0.5s ease;"></div>
                                </div>
                                <span style="font-weight: 800; font-size: 14px; color: ${barColor}; min-width: 48px; text-align: right;">${cr.rate}%</span>
                            </div>
                        </td>
                        <td style="padding: 14px 16px; border-bottom: 1px solid var(--border-color); font-weight: 600; color: ${ev.color}; font-size: 12px; white-space: nowrap;">${ev.text}</td>
                    </tr>
                `;
            }).join('');
        }
    },

    // ===== Render Leading Indicators KPI Cards =====
    async renderLeadingIndicators(stats, dateRange) {
        const container = document.getElementById('charts-leading-kpi-grid');
        if (!container) return;

        // Calculate days in range
        const start = new Date(dateRange.from);
        const end = new Date(dateRange.to);
        const numDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

        // 1. Số lượng Lead mới mỗi ngày
        const newLeads = stats.customers.filter(c => {
            const created = c.created_at ? c.created_at.split('T')[0] : '';
            return created >= dateRange.from && created <= dateRange.to;
        });
        const leadsPerDay = (newLeads.length / numDays).toFixed(1);

        // Fetch care logs
        const allLogs = await DB.getAllCareLogs();

        // 2. Thời gian phản hồi khách hàng (Response Time)
        const customerFirstCare = {};
        allLogs.forEach(log => {
            const d = new Date(log.care_date || log.created_at);
            if (!customerFirstCare[log.customer_id] || d < customerFirstCare[log.customer_id]) {
                customerFirstCare[log.customer_id] = d;
            }
        });

        let totalDiffMinutes = 0;
        let diffCount = 0;
        newLeads.forEach(c => {
            const firstCare = customerFirstCare[c.id];
            if (firstCare && c.created_at) {
                const created = new Date(c.created_at);
                const diffMs = firstCare - created;
                if (diffMs > 0) {
                    totalDiffMinutes += Math.round(diffMs / (1000 * 60));
                    diffCount++;
                }
            }
        });

        let avgResponseTimeText = "15 phút";
        if (diffCount > 0) {
            const avgMin = totalDiffMinutes / diffCount;
            if (avgMin < 60) {
                avgResponseTimeText = `${Math.round(avgMin)} phút`;
            } else {
                const hours = (avgMin / 60).toFixed(1);
                avgResponseTimeText = `${hours} giờ`;
            }
        }

        // 3. Số lượng hoạt động (Activity Metrics)
        const rangeLogs = allLogs.filter(log => {
            const careDate = (log.care_date || log.created_at || '').split('T')[0];
            return careDate >= dateRange.from && careDate <= dateRange.to;
        });
        const totalActivities = rangeLogs.length;
        const callsCount = rangeLogs.filter(l => l.care_type === 'call' || (l.care_type || '').toLowerCase().includes('gọi') || (l.care_type || '').toLowerCase().includes('phone')).length;
        const messagesCount = rangeLogs.length - callsCount;

        // 4. Tỷ lệ mất khách tại mỗi bước của phễu (Drop-off Rate)
        const conversionRate = stats.totalCustomers > 0 ? (stats.completedOrders / stats.totalCustomers * 100) : 0;
        const dropOffRate = (100 - conversionRate).toFixed(1);

        const leadingThresholds = await DB.getSetting('kpi_leading_thresholds') || {
            lead_low: 2, lead_high: 5,
            res_low: 15, res_high: 60,
            act_low: 50, act_high: 200,
            drop_lead_low: 20, drop_lead_high: 50
        };

        const getLeadAdvice = (val) => {
            if (val < leadingThresholds.lead_low) return 'Báo động đỏ! Nguồn Lead đang quá cạn kiệt. Cần tăng ngân sách chạy quảng cáo hoặc tìm thêm kênh khai thác mới ngay lập tức.';
            if (val <= leadingThresholds.lead_high) return 'Dòng Lead mới duy trì ổn định. Hãy chú ý tỷ lệ chốt đơn của tệp khách này để tối ưu thêm.';
            return 'Tuyệt vời! Lượng Lead đổ về rất dồi dào. Tập trung phân bổ thời gian gọi điện để không bỏ lỡ cơ hội chốt sale.';
        };

        const getResAdvice = (val) => { // Phút
            if (val <= leadingThresholds.res_low) return 'Tốc độ phản hồi cực kỳ ấn tượng! Đây là lợi thế cạnh tranh rất lớn giúp tỷ lệ chốt đơn cao.';
            if (val <= leadingThresholds.res_high) return 'Thời gian chờ ở mức chấp nhận được. Thử cấu hình tự động phản hồi (Auto-reply) để giữ chân khách trong lúc bận.';
            return 'Khách hàng đang phải đợi quá lâu! Nguy cơ mất khách vào tay đối thủ rất cao. Hãy sắp xếp lại thời gian trực page/điện thoại.';
        };

        const getActAdvice = (val) => {
            if (val < leadingThresholds.act_low) return 'Cường độ làm việc đang khá thấp. Bạn cần gia tăng số lượng cuộc gọi và tin nhắn chủ động để tạo thêm cơ hội chốt đơn.';
            if (val <= leadingThresholds.act_high) return 'Mức độ hoạt động duy trì tốt. Hãy đảm bảo chất lượng kịch bản ở mỗi lần tương tác.';
            return 'Hiệu suất làm việc đáng kinh ngạc! Đội ngũ đang rất nỗ lực đẩy mạnh tương tác. Hãy chú ý giữ sức khỏe nhé.';
        };

        const getDropLeadAdvice = (val) => {
            if (val > leadingThresholds.drop_lead_high) return 'Báo động! Tỷ lệ rớt phễu quá cao. Cần xem lại ngay kỹ năng đàm phán, kịch bản chốt sale hoặc cấu trúc chính sách giá.';
            if (val >= leadingThresholds.drop_lead_low) return 'Tỷ lệ rớt phễu mức trung bình. Hãy tập trung phân tích các cuộc gọi hỏng để tinh chỉnh lại kỹ năng đàm phán.';
            return 'Tỷ lệ rớt phễu rất thấp! Kỹ năng đàm phán và khóa mục tiêu của bạn đang vô cùng xuất sắc.';
        };

        const leadingKpis = [
            {
                icon: '⚡',
                label: 'Số lượng Lead mới mỗi ngày',
                value: `${leadsPerDay} lead/ngày`,
                subtitle: `Tổng lead mới: ${newLeads.length} trong ${numDays} ngày`,
                color: 'blue',
                staticDesc: 'Đầu vào của phễu. Nếu chỉ số này thấp, mọi nỗ lực chuyển đổi đều vô nghĩa.',
                desc: getLeadAdvice(parseFloat(leadsPerDay))
            },
            {
                icon: '⏱️',
                label: 'Thời gian phản hồi (Response Time)',
                value: avgResponseTimeText,
                subtitle: `Tốc độ phản hồi trung bình`,
                color: 'orange',
                staticDesc: 'Trong bán hàng, tốc độ là lợi thế cạnh tranh. Khách thường mua của người phản hồi nhanh nhất.',
                desc: diffCount > 0 ? getResAdvice(totalDiffMinutes / diffCount) : 'Chưa có dữ liệu phản hồi để đánh giá.'
            },
            {
                icon: '📞',
                label: 'Số lượng hoạt động (Activity)',
                value: `${totalActivities} hoạt động`,
                subtitle: `Gọi điện: ${callsCount} cuộc / Tin nhắn: ${messagesCount} lần`,
                color: 'green',
                staticDesc: 'Số cuộc gọi, tin nhắn đã thực hiện nhằm tự điều chỉnh cường độ làm việc trước khi tới cuối tháng.',
                desc: getActAdvice(totalActivities)
            },
            {
                icon: '📉',
                label: 'Tỷ lệ mất khách (Drop-off Rate)',
                value: `${dropOffRate}%`,
                subtitle: `Tỷ lệ rớt phễu: ${(100 - conversionRate).toFixed(1)}%`,
                color: 'red',
                staticDesc: 'Giúp bạn chỉ ra bước cần cải thiện kỹ năng đàm phán hoặc chính sách giá.',
                desc: getDropLeadAdvice(parseFloat(dropOffRate))
            }
        ];

        container.innerHTML = leadingKpis.map(kpi => `
            <div class="kpi-card pro-card" data-color="${kpi.color}" style="display: flex; flex-direction: column; padding: 16px; justify-content: space-between; cursor: default; min-height: 150px; height: 100%;">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px;" title="${kpi.staticDesc}">
                            <div class="kpi-icon-wrap bg-${kpi.color}-light text-${kpi.color}" style="width: 36px; height: 36px; font-size: 18px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">${kpi.icon}</div>
                            <div class="kpi-label" style="margin-bottom: 0; font-weight: 600; font-size: 14px; color: var(--text-primary);">${kpi.label}</div>
                        </div>
                    </div>
                    <div class="kpi-value text-${kpi.color}" style="font-size: 18px; font-weight: 800; line-height: 1.2; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${kpi.value}">${kpi.value}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${kpi.subtitle.replace(/<br>/g, ' ')}">${kpi.subtitle}</div>
                </div>
                <div style="border-top: 1px solid var(--border-color); padding-top: 8px; font-size: 11px; color: var(--text-muted); line-height: 1.4;">
                    ${kpi.desc}
                </div>
            </div>
        `).join('');
    },

    renderRevenueCharts(stats) {
        this.renderRevenueTimeChart('chart-revenue-detail', stats);
        this.renderRevenueSourceChart('chart-revenue-source', stats);
    },

    // ===== Donut: Trạng thái đơn hàng =====
    renderOrderStatusChart(canvasId, stats, small = false) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.destroyChart(canvasId);
        const colors = this.getChartColors();
        const statusMap = { pending: 'Chờ xử lý', awaiting_payment: 'Chờ thanh toán', shipping: 'Đang giao', completed: 'Đã nhận/HT', cancelled: 'Hủy', returned: 'Hoàn hàng' };
        const statusColors = { pending: colors.warning, awaiting_payment: colors.secondary, shipping: colors.purple, completed: colors.success, cancelled: colors.danger, returned: colors.pink };
        const labels = [], data = [], bgColors = [];
        for (const [key, label] of Object.entries(statusMap)) {
            const count = stats.ordersByStatus[key] || 0;
            if (count > 0) { labels.push(label); data.push(count); bgColors.push(statusColors[key]); }
        }

        this.charts[canvasId] = new Chart(canvas, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 8 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: small ? '65%' : '60%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: this.getChartDefaults().plugins.legend.labels.color, font: { family: 'Inter', size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 } },
                    tooltip: { ...this.getChartDefaults().plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw} đơn` } }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        const statusKey = Object.keys(statusMap)[Object.values(statusMap).indexOf(labels[idx])];
                        const filtered = stats.orders.filter(o => o.order_status === statusKey);
                        DrilldownModule.showOrderList(`Đơn hàng: ${labels[idx]}`, filtered);
                    }
                }
            }
        });
    },

    // ===== Line: Doanh số theo thời gian =====
    renderRevenueTimeChart(canvasId, stats) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.destroyChart(canvasId);
        const colors = this.getChartColors();
        const completed = stats.orders.filter(o => o.order_status === 'completed');
        const dayMap = {};
        completed.forEach(o => { dayMap[o.order_date] = (dayMap[o.order_date] || 0) + (o.total_amount || 0); });
        const sorted = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0]));
        const labels = sorted.map(([d]) => Utils.formatDateShort(d));
        const data = sorted.map(([, v]) => v);

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(13, 148, 136, 0.4)'); // Teal primary light
        gradient.addColorStop(1, 'rgba(13, 148, 136, 0.0)');

        const defaults = this.getChartDefaults();
        this.charts[canvasId] = new Chart(canvas, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Doanh số', data, borderColor: colors.primary, backgroundColor: gradient, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6, borderWidth: 3 }] },
            options: { ...defaults, plugins: { ...defaults.plugins, legend: { display: false } } }
        });
    },

    // ===== Bar: Doanh số theo sản phẩm =====
    renderRevenueProductChart(canvasId, stats) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.destroyChart(canvasId);
        const colors = this.getChartColors();
        const completed = stats.orders.filter(o => o.order_status === 'completed');
        const prodMap = {};
        completed.forEach(o => { prodMap[o.product_name] = (prodMap[o.product_name] || 0) + (o.total_amount || 0); });
        const sorted = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

        const defaults = this.getChartDefaults();
        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: { labels: sorted.map(([n]) => n.length > 15 ? n.substring(0, 15) + '...' : n), datasets: [{ label: 'Doanh số', data: sorted.map(([, v]) => v), backgroundColor: colors.palette.map(c => c + '99'), borderColor: colors.palette, borderWidth: 1, borderRadius: 6 }] },
            options: {
                ...defaults,
                plugins: { ...defaults.plugins, legend: { display: false } },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const name = sorted[elements[0].index][0];
                        const filtered = stats.orders.filter(o => o.product_name === name);
                        DrilldownModule.showOrderList(`Đơn hàng: ${name}`, filtered);
                    }
                }
            }
        });
    },

    // ===== Bar: Số lượng bán theo sản phẩm =====
    renderQuantityProductChart(canvasId, stats) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.destroyChart(canvasId);
        const colors = this.getChartColors();
        const prodMap = {};
        stats.orders.filter(o => o.order_status === 'completed').forEach(o => { prodMap[o.product_name] = (prodMap[o.product_name] || 0) + (o.quantity || 0); });
        const sorted = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

        const defaults = this.getChartDefaults();
        defaults.scales.y.ticks.callback = (v) => v;
        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: { labels: sorted.map(([n]) => n.length > 15 ? n.substring(0, 15) + '...' : n), datasets: [{ label: 'Số lượng', data: sorted.map(([, v]) => v), backgroundColor: colors.palette.map(c => c + '80'), borderColor: colors.palette, borderWidth: 1, borderRadius: 6 }] },
            options: { ...defaults, plugins: { ...defaults.plugins, legend: { display: false }, tooltip: { ...defaults.plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} sản phẩm` } } } }
        });
    },

    // ===== Bar: Khách sắp hết / đã hết SP =====
    renderProductExpiryChart(canvasId, stats) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.destroyChart(canvasId);
        const colors = this.getChartColors();
        const defaults = this.getChartDefaults();
        defaults.scales.y.ticks.callback = (v) => v;

        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Sắp hết SP', 'Đã hết SP'],
                datasets: [{ data: [stats.productRunningOut.length, stats.productExpired.length], backgroundColor: [colors.warning + '99', colors.danger + '99'], borderColor: [colors.warning, colors.danger], borderWidth: 1, borderRadius: 6 }]
            },
            options: {
                ...defaults, plugins: { ...defaults.plugins, legend: { display: false }, tooltip: { ...defaults.plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} khách` } } },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const idx = elements[0].index;
                        if (idx === 0) DrilldownModule.showCustomerList('Khách sắp hết sản phẩm', stats.productRunningOut);
                        else DrilldownModule.showCustomerList('Khách đã hết sản phẩm', stats.productExpired);
                    }
                }
            }
        });
    },

    // ===== Bar: Khách quá hạn chăm sóc =====
    renderOverdueCareChart(canvasId, stats) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.destroyChart(canvasId);
        const colors = this.getChartColors();
        const defaults = this.getChartDefaults();
        defaults.scales.y.ticks.callback = (v) => v;

        const overdue = stats.overdueCustomers.length;
        const overdue30 = stats.overdue30Customers.length;
        const onTime = stats.totalCustomers - overdue;

        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Đúng hạn', 'Quá hạn', 'Quá hạn >30 ngày'],
                datasets: [{ data: [onTime, overdue - overdue30, overdue30], backgroundColor: [colors.success + '99', colors.warning + '99', colors.danger + '99'], borderColor: [colors.success, colors.warning, colors.danger], borderWidth: 1, borderRadius: 6 }]
            },
            options: {
                ...defaults, plugins: { ...defaults.plugins, legend: { display: false }, tooltip: { ...defaults.plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} khách` } } },
                onClick: (evt, elements) => {
                    if (elements.length > 0 && elements[0].index >= 1) {
                        DrilldownModule.showCustomerList('Khách quá hạn chăm sóc', stats.overdueCustomers);
                    }
                }
            }
        });
    },

    // ===== Bar: Doanh số theo nguồn =====
    renderRevenueSourceChart(canvasId, stats) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.destroyChart(canvasId);
        const colors = this.getChartColors();
        const sourceMap = {};
        const completed = stats.orders.filter(o => o.order_status === 'completed');
        const customerMap = {};
        stats.customers.forEach(c => customerMap[c.id] = c);

        completed.forEach(o => {
            const cust = customerMap[o.customer_id];
            const src = cust ? (cust.customer_source || 'other') : 'other';
            sourceMap[src] = (sourceMap[src] || 0) + (o.total_amount || 0);
        });

        const sorted = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
        const defaults = this.getChartDefaults();

        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: { labels: sorted.map(([s]) => Utils.sourceLabel(s)), datasets: [{ label: 'Doanh số', data: sorted.map(([, v]) => v), backgroundColor: colors.palette.map(c => c + '80'), borderColor: colors.palette, borderWidth: 1, borderRadius: 6 }] },
            options: {
                ...defaults, indexAxis: 'y', plugins: { ...defaults.plugins, legend: { display: false } },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const src = sorted[elements[0].index][0];
                        const filtered = stats.customers.filter(c => c.customer_source === src);
                        DrilldownModule.showCustomerList(`Khách từ: ${Utils.sourceLabel(src)}`, filtered);
                    }
                }
            }
        });
    },

    // ===== Funnel: Chuyển đổi cá nhân =====
    renderFunnelChart(canvasId, stats) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.destroyChart(canvasId);
        const colors = this.getChartColors();
        const stages = ['new', 'contacted', 'consulting', 'waiting_close', 'purchased', 'repurchased'];
        const stageLabels = ['Khách mới', 'Đã liên hệ', 'Đang tư vấn', 'Chờ chốt', 'Đã mua', 'Mua lại'];
        const counts = stages.map(s => stats.customers.filter(c => c.status === s).length);
        const stageColors = [colors.secondary, colors.purple, colors.warning, colors.pink, colors.success, colors.cyan];

        const defaults = this.getChartDefaults();
        defaults.scales.y.ticks.callback = (v) => v;

        this.charts[canvasId] = new Chart(canvas, {
            type: 'bar',
            data: { labels: stageLabels, datasets: [{ data: counts, backgroundColor: stageColors.map(c => c + '80'), borderColor: stageColors, borderWidth: 1, borderRadius: 6 }] },
            options: {
                ...defaults, plugins: { ...defaults.plugins, legend: { display: false }, tooltip: { ...defaults.plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} khách` } } },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const status = stages[elements[0].index];
                        const filtered = stats.customers.filter(c => c.status === status);
                        DrilldownModule.showCustomerList(`Khách: ${stageLabels[elements[0].index]}`, filtered);
                    }
                }
            }
        });
    },

    async renderChartsPage() {
        const timeFilter = document.getElementById('charts-time-filter')?.value || 'month';
        const dateRange = Utils.getDateRange(timeFilter,
            document.getElementById('charts-date-from')?.value,
            document.getElementById('charts-date-to')?.value
        );
        const stats = await DB.getStats(dateRange);
        await this.renderFullCharts(stats, dateRange);
    },

    initEvents() {
        document.getElementById('charts-time-filter')?.addEventListener('change', (e) => {
            const custom = document.getElementById('charts-custom-date');
            if (custom) custom.style.display = e.target.value === 'custom' ? 'flex' : 'none';
            this.renderChartsPage();
        });
        document.getElementById('charts-date-from')?.addEventListener('change', () => this.renderChartsPage());
        document.getElementById('charts-date-to')?.addEventListener('change', () => this.renderChartsPage());
    }
};
