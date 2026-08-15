/* ===================================================================
   CRM MINI — UTILITY FUNCTIONS
   Các hàm tiện ích dùng chung cho toàn bộ ứng dụng
   =================================================================== */

const Utils = {
    // ===== ID Generator =====
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    // ===== Format tiền VNĐ =====
    formatCurrency(amount) {
        if (!amount && amount !== 0) return '0 ₫';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    },

    formatCurrencyShort(amount) {
        if (!amount) return '0';
        if (amount >= 1e9) return (amount / 1e9).toFixed(1) + ' tỷ';
        if (amount >= 1e6) return (amount / 1e6).toFixed(1) + ' tr';
        if (amount >= 1e3) return (amount / 1e3).toFixed(0) + 'k';
        return amount.toLocaleString('vi-VN');
    },

    // ===== Format số điện thoại =====
    formatPhone(phone) {
        if (!phone) return '';
        let p = phone.toString().trim();
        // Xóa dấu cách
        p = p.replace(/\s+/g, '');
        // Nếu chuỗi chứa nhiều hơn 15 chữ số và chỉ toàn số, chia mỗi 10 số ra bằng dấu /
        if (/^\d{15,}$/.test(p)) {
            const matches = p.match(/\d{10}/g);
            if (matches && matches.length * 10 === p.length) {
                return matches.join(' / ');
            }
            if (p.length === 20) return p.slice(0, 10) + ' / ' + p.slice(10);
        }
        return phone.toString();
    },

    getPrimaryPhone(phone) {
        if (!phone) return '';
        let p = phone.toString().trim();
        p = p.replace(/\s+/g, '');
        if (/^\d{15,}$/.test(p)) {
            return p.slice(0, 10);
        }
        if (p.includes('/')) return p.split('/')[0].trim();
        if (p.includes(',')) return p.split(',')[0].trim();
        if (p.includes('-')) return p.split('-')[0].trim();
        return phone.toString();
    },

    // ===== Format ngày tháng =====
    formatDate(date) {
        if (!date) return '—';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    formatDateTime(date) {
        if (!date) return '—';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    formatDateVerbose(date) {
        if (!date) return '—';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    formatDateShort(date) {
        if (!date) return '—';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    },

    // Lấy ngày hiện tại dạng YYYY-MM-DD
    today() {
        return new Date().toISOString().split('T')[0];
    },

    // ===== Tính khoảng cách ngày =====
    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2 || new Date());
        const diff = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
        return diff;
    },

    daysFromNow(date) {
        return this.daysBetween(new Date(), date);
    },

    daysAgo(date) {
        return this.daysBetween(date, new Date());
    },

    addDays(date, days) {
        if (!date) return null;
        let daysInt = parseInt(days, 10);
        if (isNaN(daysInt)) daysInt = 0;
        const d = new Date(date);
        d.setDate(d.getDate() + daysInt);
        return d.toISOString().split('T')[0];
    },

    getGetFlyLink(customer, fontSize = '14px') {
        if (!customer || !customer.getfly_url) return '';
        return `<a href="${customer.getfly_url}" target="_blank" title="Mở trên GetFly" style="text-decoration:none; margin-left:4px; font-size:${fontSize};">🔗</a>`;
    },

    // ===== Date range helpers =====
    getDateRange(filter, customFrom, customTo) {
        const now = new Date();
        let from, to;
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        if (filter === 'custom' && customFrom && customTo) {
            return { from: customFrom, to: customTo };
        }

        switch (filter) {
            case 'today':
                from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case '7days':
                from = new Date(now);
                from.setDate(from.getDate() - 7);
                from.setHours(0, 0, 0, 0);
                break;
            case 'month':
            case 'this_month':
                from = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last_month':
                from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                break;
            case '3_months':
                from = new Date(now);
                from.setMonth(from.getMonth() - 3);
                from.setHours(0, 0, 0, 0);
                break;
            case '6_months':
                from = new Date(now);
                from.setMonth(from.getMonth() - 6);
                from.setHours(0, 0, 0, 0);
                break;
            case 'quarter':
                const qMonth = Math.floor(now.getMonth() / 3) * 3;
                from = new Date(now.getFullYear(), qMonth, 1);
                break;
            case 'last_quarter':
                const lastQMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
                from = new Date(now.getFullYear(), lastQMonth, 1);
                to = new Date(now.getFullYear(), lastQMonth + 3, 0, 23, 59, 59);
                break;
            case 'year':
                from = new Date(now.getFullYear(), 0, 1);
                break;
            case 'last_year':
                from = new Date(now.getFullYear() - 1, 0, 1);
                to = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
                break;
            case '1_year':
                from = new Date(now);
                from.setFullYear(from.getFullYear() - 1);
                from.setHours(0, 0, 0, 0);
                break;
            case 'all':
                from = new Date(2020, 0, 1);
                break;
            default:
                from = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
    },

    // ===== Toast notification =====
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="toast-message">${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // ===== Loading screen =====
    showLoading(text = 'Đang tải...') {
        const screen = document.getElementById('loading-screen');
        const textEl = document.getElementById('loading-text');
        if (textEl) textEl.textContent = text;
        if (screen) screen.classList.remove('hidden');
    },

    hideLoading() {
        const screen = document.getElementById('loading-screen');
        if (screen) screen.classList.add('hidden');
    },

    // ===== Confirm dialog =====
    confirm(title, message, icon = '⚠️') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('confirm-overlay');
            document.getElementById('confirm-icon').textContent = icon;
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;
            overlay.classList.add('active');

            const okBtn = document.getElementById('confirm-ok');
            const cancelBtn = document.getElementById('confirm-cancel');

            const cleanup = () => {
                overlay.classList.remove('active');
                okBtn.replaceWith(okBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            };

            document.getElementById('confirm-ok').addEventListener('click', () => { cleanup(); resolve(true); });
            document.getElementById('confirm-cancel').addEventListener('click', () => { cleanup(); resolve(false); });
        });
    },

    // ===== Modal =====
    openModal(title, bodyHtml, footerHtml = '', size = '') {
        const overlay = document.getElementById('modal-overlay');
        const container = document.getElementById('modal-container');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        document.getElementById('modal-footer').innerHTML = footerHtml;

        container.className = 'modal-container glass-card' + (size ? ` modal-${size}` : '');
        overlay.classList.add('active');
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    },

    // ===== Debounce =====
    debounce(func, wait = 300) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // ===== Throttle =====
    throttle(func, limit = 100) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    },

    // ===== Pagination =====
    renderPagination(containerId, currentPage, totalPages, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        let html = '';
        html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹</button>`;

        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

        if (startPage > 1) {
            html += `<button class="pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) html += `<span class="pagination-info">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="pagination-info">...</span>`;
            html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">›</button>`;

        container.innerHTML = html;
        container.querySelectorAll('.pagination-btn:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', () => onPageChange(parseInt(btn.dataset.page)));
        });
    },

    // ===== Trạng thái labels =====
    customerStatusLabel(status) {
        const labels = {
            new: 'Khách mới', contacted: 'Đã liên hệ', consulting: 'Đang tư vấn',
            waiting_close: 'Chờ chốt', purchased: 'Đã mua', repurchased: 'Mua lại', vip: 'VIP', agency: 'Đại lý',
            cancelled: 'Hoàn/Hủy', stopped: 'Tạm dừng sử dụng'
        };
        return labels[status] || status || '—';
    },

    orderStatusLabel(status) {
        const labels = {
            pending: 'Chờ xử lý', awaiting_payment: 'Chờ thanh toán', shipping: 'Đang giao',
            completed: 'Đã nhận', cancelled: 'Hủy', returned: 'Hoàn hàng/Hoàn tiền'
        };
        return labels[status] || status || '—';
    },

    sourceLabel(source) {
        const labels = {
            facebook: 'Facebook', fanpage: 'Fanpage', zalo: 'Zalo', tiktok: 'TikTok',
            website: 'Website', livestream: 'Livestream', referral: 'Giới thiệu',
            event: 'Hội thảo/Sự kiện', company_data: 'Data công ty', acquaintance: 'Người quen', other: 'Khác'
        };
        return labels[source] || source || '—';
    },

    // ===== Avatar initials =====
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    },

    // ===== Copy to clipboard =====
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Đã copy vào clipboard!', 'success');
            return true;
        } catch (err) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.cssText = 'position:fixed;left:-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('Đã copy vào clipboard!', 'success');
            return true;
        }
    },

    // ===== Download file =====
    downloadFile(data, filename, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // ===== Read file =====
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    // ===== CSV Export =====
    exportCSV(data, filename) {
        if (!data || data.length === 0) {
            this.showToast('Không có dữ liệu để xuất', 'warning');
            return;
        }
        const headers = Object.keys(data[0]);
        const csvContent = [
            '\uFEFF' + headers.join(','), // BOM for UTF-8
            ...data.map(row => headers.map(h => {
                let val = row[h];
                if (val === null || val === undefined) val = '';
                val = String(val).replace(/"/g, '""');
                return `"${val}"`;
            }).join(','))
        ].join('\n');

        this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
        this.showToast(`Đã xuất ${filename}`, 'success');
    },

    // ===== Escape HTML =====
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // ===== Parse template variables =====
    parseTemplate(template, variables) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return variables[key] !== undefined ? variables[key] : match;
        });
    },

    // ===== Product Expiry Status =====
    getProductExpiryStatus(estimatedEndDate, formula = null) {
        const productIcon = `<svg viewBox="0 1 26 21" width="22" height="22" style="vertical-align:-6px;margin-right:4px;"><polygon points="12.5,22 4,17 4,11 12.5,16" fill="currentColor"/><polygon points="13.5,22 22,17 22,11 13.5,16" fill="currentColor"/><polygon points="3,10 11.5,15 8.5,10 0,5" fill="currentColor"/><polygon points="14.5,15 23,10 26,5 17.5,10" fill="currentColor"/><path d="M 13 1.5 A 5 5 0 1 1 13 11.5 A 5 5 0 1 1 13 1.5 Z M 10 6.5 L 12 8.5 L 15.5 4.5 L 16.5 5.5 L 12 10.5 L 9 7.5 Z" fill="currentColor" fill-rule="evenodd"/></svg>`;

        if (!estimatedEndDate) return { status: 'unknown', label: '—', class: '', daysLeft: null, tooltip: '' };
        const daysLeft = this.daysFromNow(estimatedEndDate);
        const endFormatted = this.formatDate(estimatedEndDate);
        const tooltip = formula ? formula : `Hạn dùng SP dự kiến: ${endFormatted}. Số ngày tính từ hôm nay.`;
        
        if (daysLeft < 0) return { status: 'expired', label: `Đã hết ${Math.abs(daysLeft)} ngày`, class: 'expiry-out', daysLeft, icon: productIcon, tooltip };
        if (daysLeft <= 7) return { status: 'running_out', label: `Còn ${daysLeft} ngày`, class: 'expiry-running-out', daysLeft, icon: productIcon, tooltip };
        return { status: 'ok', label: `Còn ${daysLeft} ngày`, class: 'expiry-ok', daysLeft, icon: productIcon, tooltip };
    },

    getAllProductExpiryStatuses(productExpiries) {
        if (!productExpiries || Object.keys(productExpiries).length === 0) {
            return [];
        }
        const statuses = [];
        for (const productName in productExpiries) {
            const statusObj = this.getProductExpiryStatus(productExpiries[productName]);
            statuses.push({
                productName: productName,
                ...statusObj
            });
        }
        return statuses;
    },

    // ===== Care Status & Milestones =====
    getNextCareMilestone(lastOrderDate, lastContactDate, config = { cycle: 30 }, note = "") {
        if (!lastOrderDate) return null;

        const parseMilestone = (val, def) => {
            if (val === undefined || val === null || val === '') return def;
            const p = parseInt(val, 10);
            return isNaN(p) ? def : p;
        };
        const m1 = parseMilestone(config.m1, 1);
        const m2 = parseMilestone(config.m2, 7);
        const m3 = parseMilestone(config.m3, 22);
        const cycle = parseMilestone(config.cycle, 30);

        const t1 = this.addDays(lastOrderDate, m1);
        const t2 = this.addDays(lastOrderDate, m2);
        const t3 = this.addDays(lastOrderDate, m3);

        const lastC = lastContactDate ? lastContactDate.split('T')[0] : "";
        const orderD = lastOrderDate ? lastOrderDate.split('T')[0] : "";
        const orderFmt = this.formatDate(orderD);

        // Cột mốc T được coi là "Đã hoàn thành" nếu ta liên hệ khách hàng trong vòng 3 ngày trước mốc đó (warning window)
        // và ngày liên hệ đó phải SANG ngày khác so với ngày đặt đơn (để tránh lấy luôn lúc chốt đơn làm mốc chăm sóc)
        const isAchieved = (targetDate) => {
            if (!lastC) return false;
            if (lastC <= orderD && targetDate > orderD) return false;
            const windowStart = this.addDays(targetDate, -3);
            return lastC >= windowStart;
        };

        if (!isAchieved(t1)) return { date: t1, label: 'D', name: 'Hướng dẫn SD', color: '#ff8c00', tooltip: `Ngày mua (${orderFmt}) + ${m1} ngày = ${this.formatDate(t1)}` };
        if (!isAchieved(t2)) return { date: t2, label: 'W', name: 'Xử lý khủng hoảng', color: '#007bff', tooltip: `Ngày mua (${orderFmt}) + ${m2} ngày = ${this.formatDate(t2)}` };
        if (!isAchieved(t3)) return { date: t3, label: 'M', name: 'Giữ niềm tin/chốt mới', color: '#28a745', tooltip: `Ngày mua (${orderFmt}) + ${m3} ngày = ${this.formatDate(t3)}` };

        // Past M3 (Chăm sóc định kỳ)
        const isSuccessfulContact = !note || !note.toUpperCase().includes('CNM');
        if (isSuccessfulContact && lastC) {
            return { date: this.addDays(lastC, cycle), label: 'M', name: 'Chăm sóc định kỳ', color: '#28a745', tooltip: `Ngày LH cuối (${this.formatDate(lastC)}) + ${cycle} ngày chu kỳ = ${this.formatDate(this.addDays(lastC, cycle))}` };
        }

        // Khách hàng có ghi chú cuối là CNM -> Tạm tính dựa trên chu kỳ cộng dồn từ Ngày Mua Hàng
        let target = this.addDays(t3, cycle);
        let tooltipStr = `Bỏ qua (CNM): Mốc T3 (${this.formatDate(t3)}) + ${cycle} ngày = ${this.formatDate(target)}`;
        let k = 1;
        while (isAchieved(target) && k < 100) {
            k++;
            target = this.addDays(t3, k * cycle);
            tooltipStr = `Bỏ qua (CNM): Mốc T3 (${this.formatDate(t3)}) + ${k} lần chu kỳ ${cycle} ngày = ${this.formatDate(target)}`;
        }

        return { date: target, label: 'M', name: 'Chăm sóc định kỳ', color: '#28a745', tooltip: tooltipStr };
    },

    getCareStatus(customer, config = { cycle: 30 }) {
        if (customer.transferred_status) {
            return { status: 'transferred', label: 'Khách đã chuyển', class: 'badge-purple', overdue: false, tooltip: 'Khách hàng này đã được chuyển đi, không nằm trong danh sách CS' };
        }

        const lastOrder = customer.last_completed_order_date;
        const lastContact = customer.last_contact_date;
        const note = customer.note || "";
        const cycle = config.cycle || 30;

        const headsetIcon = `<svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px;margin-right:4px;"><path d="M5 12V8c0-3.87 3.13-7 7-7s7 3.13 7 7v4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><rect x="2" y="11" width="5" height="8" rx="2" fill="currentColor"/><rect x="17" y="11" width="5" height="8" rx="2" fill="currentColor"/><path d="M4.5 18v1.5c0 1.5 1.2 2.5 2.5 2.5h3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="9.5" y="20" width="5" height="4" rx="2" fill="currentColor"/></svg>`;

        if (!lastOrder) {
            // Khách chưa có đơn hàng "Đã nhận", sử dụng chu kỳ 7 ngày đếm từ ngày contact cuối
            const unpurchasedCycle = 7;
            const fallbackMilestone = { label: 'W', name: 'Chăm sóc tuần (Chưa mua)', color: '#007bff' };
            const tooltipStr = lastContact ? `Chưa có đơn hàng: Ngày LH cuối (${this.formatDate(lastContact)}) + ${unpurchasedCycle} ngày = ${this.formatDate(this.addDays(lastContact, unpurchasedCycle))}` : `Chưa từng LH và Chưa có đơn hàng`;
            if (!lastContact) return { status: 'never', label: 'Chưa chăm sóc', class: 'badge-alert', overdue: true, milestone: fallbackMilestone, sortValue: -9999, tooltip: tooltipStr };
            const daysAgo = this.daysAgo(lastContact);
            if (daysAgo > unpurchasedCycle) return { status: 'overdue', label: `Quá hạn ${daysAgo - unpurchasedCycle} ngày`, class: 'badge-alert', overdue: true, milestone: fallbackMilestone, sortValue: -(daysAgo - unpurchasedCycle), icon: headsetIcon, tooltip: tooltipStr };
            if (daysAgo >= unpurchasedCycle - 2) return { status: 'due', label: `Sắp đến hạn`, class: 'badge-warning', overdue: false, milestone: fallbackMilestone, sortValue: (unpurchasedCycle - daysAgo), icon: headsetIcon, tooltip: tooltipStr };
            return { status: 'ok', label: `${unpurchasedCycle - daysAgo} ngày nữa`, class: 'badge-success', overdue: false, milestone: fallbackMilestone, sortValue: (unpurchasedCycle - daysAgo), tooltip: tooltipStr };
        }

        const milestone = this.getNextCareMilestone(lastOrder, lastContact, config, note);
        const daysToNext = this.daysFromNow(milestone.date);

        let statusObj = { milestone: milestone, tooltip: milestone.tooltip };

        // Ưu tiên lịch hết sản phẩm
        const expiries = this.getAllProductExpiryStatuses(customer.product_expiries);
        let mostUrgentExpiry = null;
        for (const exp of expiries) {
            if (exp.status === 'expired' || exp.status === 'running_out') {
                if (!mostUrgentExpiry || (exp.status === 'expired' && mostUrgentExpiry.status !== 'expired')) {
                    mostUrgentExpiry = exp;
                }
            }
        }

        if (mostUrgentExpiry) {
            statusObj.milestone = { label: 'U', name: 'SP sắp/đã hết', color: '#dc3545' };
            statusObj.tooltip = `Ưu tiên chăm sóc vì ${mostUrgentExpiry.productName || 'Sản phẩm'} ${mostUrgentExpiry.status === 'expired' ? 'đã hết hạn' : 'sắp hết hạn'}`;
        }

        statusObj.sortValue = daysToNext;
        if (daysToNext < 0) {
            statusObj.status = 'overdue';
            statusObj.label = `Quá hạn ${Math.abs(daysToNext)} ngày`;
            statusObj.class = 'badge-alert';
            statusObj.overdue = true;
            statusObj.icon = headsetIcon;
        } else if (daysToNext <= 3) {
            statusObj.status = 'due';
            statusObj.label = `${daysToNext === 0 ? 'Hôm nay' : `Sắp đến (${daysToNext} ngày)`}`;
            statusObj.class = 'badge-warning';
            statusObj.overdue = false;
            statusObj.icon = headsetIcon;
        } else {
            statusObj.status = 'ok';
            statusObj.label = `${daysToNext} ngày nữa`;
            statusObj.class = 'badge-success';
            statusObj.overdue = false;
        }
        return statusObj;
    },

    // ===== Keyword Intent Check (Hybrid: AI or Regex) =====
    async analyzeKeywordIntent(text) {
        if (!text) return 'NONE';

        const useAi = await DB.getSetting('use_ai_keyword_filter');
        const apiKey = await DB.getSetting('gemini_api_key');

        const priorityKeywords = await DB.getSetting('priority_keywords') || [];
        const nonPriorityKeywords = await DB.getSetting('non_priority_keywords') || [];
        const stopKeywords = await DB.getSetting('stop_care_keywords') || [];
        const cancelKeywords = await DB.getSetting('cancel_keywords') || [];

        if (useAi && apiKey) {
            return await this.analyzeKeywordIntentAI(text, apiKey, priorityKeywords, nonPriorityKeywords, stopKeywords, cancelKeywords);
        } else {
            return this.analyzeKeywordIntentRegex(text, priorityKeywords, nonPriorityKeywords, stopKeywords, cancelKeywords);
        }
    },

    analyzeKeywordIntentRegex(text, priorityKw, nonPriorityKw, stopKw, cancelKw) {
        let lowerText = text.toLowerCase();

        // Chuẩn hóa một số từ viết tắt phổ biến trước khi quét
        lowerText = lowerText.replace(/\bko\b/g, 'không')
            .replace(/\bk\b/g, 'không')
            .replace(/\bđc\b/g, 'được');

        // Cần kiểm tra CANCELLED và STOPPED trước vì nó quan trọng nhất
        if (cancelKw && cancelKw.length > 0 && cancelKw.some(kw => lowerText.includes(kw.toLowerCase()))) return 'CANCELLED';
        if (stopKw && stopKw.length > 0 && stopKw.some(kw => lowerText.includes(kw.toLowerCase()))) return 'STOPPED';
        if (priorityKw && priorityKw.length > 0 && priorityKw.some(kw => lowerText.includes(kw.toLowerCase()))) return 'PRIORITY';
        if (nonPriorityKw && nonPriorityKw.length > 0 && nonPriorityKw.some(kw => lowerText.includes(kw.toLowerCase()))) return 'NON_PRIORITY';

        return 'NONE';
    },

    async analyzeKeywordIntentAI(text, apiKey, priorityKw, nonPriorityKw, stopKw, cancelKw) {
        let targetModel = 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

        const prompt = `Bạn là hệ thống phân loại khách hàng CRM.
Nhiệm vụ: Dựa vào lịch sử trao đổi của khách hàng, hãy xếp loại trạng thái HIỆN TẠI (mới nhất) của họ vào ĐÚNG 1 TRONG 5 NHÓM. Chú ý: Ghi chú mới nhất có quyền quyết định, nếu quá khứ chê nhưng hiện tại chốt thì kết quả là PRIORITY.

[Định nghĩa các nhóm]
1. CANCELLED: Khách hàng muốn hủy đơn hàng, hoàn đơn. (Tham khảo: ${cancelKw ? cancelKw.join(', ') : ''})
2. STOPPED: Khách hàng muốn ngừng sử dụng sản phẩm vĩnh viễn, đã mất, chặn liên lạc. (Tham khảo: ${stopKw.join(', ')})
3. PRIORITY: Khách hàng tiềm năng cao, hẹn gọi lại, hỏi giá, quan tâm, chốt đơn. (Tham khảo: ${priorityKw.join(', ')})
4. NON_PRIORITY: Khách hàng chưa muốn mua, chê đắt, không có tiền, cần hỏi ý kiến người thân. (Tham khảo: ${nonPriorityKw.join(', ')})
5. NONE: Không thuộc 4 nhóm trên, chỉ là ghi chú bình thường.

Đoạn chat/lịch sử (theo thứ tự thời gian):
"${text}"

Dựa vào ý định cuối cùng/mới nhất, hãy trả về ĐÚNG MỘT TỪ duy nhất là: CANCELLED, STOPPED, PRIORITY, NON_PRIORITY, hoặc NONE. Không giải thích.`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 5, temperature: 0.1 }
                })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || 'NONE';

            if (['CANCELLED', 'STOPPED', 'PRIORITY', 'NON_PRIORITY'].includes(result)) {
                return result;
            }
            return 'NONE';
        } catch (e) {
            console.error('AI Intent Analysis Failed:', e);
            // Fallback
            return this.analyzeKeywordIntentRegex(text, priorityKw, nonPriorityKw, stopKw, cancelKw);
        }
    },

    // ===== ĐỊNH HƯỚNG SẢN PHẨM (HYBRID) =====
    async determineOrderProductName(order) {
        // Nếu đơn hàng có nhiều sản phẩm con (Tạo từ AI)
        if (order.items && order.items.length > 1) {
            // Lọc bỏ sản phẩm tặng (giá = 0)
            const paidItems = order.items.filter(item => (item.unit_price || 0) > 0);

            // Nếu không có sản phẩm nào có giá (toàn hàng tặng?), fallback về tất cả
            const itemsToProcess = paidItems.length > 0 ? paidItems : order.items;

            const resolvedNames = [];
            for (const item of itemsToProcess) {
                const itemTotal = (item.unit_price || 0) * (item.quantity || 1);
                const name = await this.determineProductName(itemTotal, item.product_name);
                resolvedNames.push(name);
            }

            // Deduplicate (Ví dụ: Nutri Nano, Nutri Nano -> Nutri Nano)
            const uniqueNames = [...new Set(resolvedNames)];
            return uniqueNames.join(', ');
        }

        // Đơn 1 sản phẩm hoặc đơn tạo từ Excel (không có items)
        return await this.determineProductName(order.total_amount, order.product_name);
    },

    async determineProductName(amount, originalText) {
        if (!amount || amount <= 0) return this._finalizeName(originalText);

        try {
            // 1. Quét Cấu hình Ưu đãi
            const promos = await DB.getSetting('promotions_config') || {};
            for (const [key, items] of Object.entries(promos)) {
                for (const item of items) {
                    if (item.price === amount) {
                        let prodName = key;
                        if (key === 'ancan') prodName = 'Ancan';
                        if (key === 'fu8') prodName = 'Fu 8';
                        if (key === 'fucoidan_nano') prodName = 'Fucoidan Nano';

                        let promoText = '';
                        if (item.buy > 0 && item.get > 0) promoText = `Mua ${item.buy} tặng ${item.get}`;
                        else if (item.buy > 0 && item.get === 0) promoText = `Mua ${item.buy} hộp`;

                        return promoText ? `${prodName} - ${promoText}` : prodName;
                    }
                }
            }

            // 2. Quét Bảng giá gốc (Products)
            const products = await DB.getAllProducts();
            for (const p of products) {
                if (p.price > 0 && amount === p.price) {
                    return p.product_name;
                }
                // Nếu mua 2 hộp, 4 hộp... (không nằm trong ưu đãi)
                if (p.price > 0 && amount % p.price === 0) {
                    return p.product_name; // Trả về tên cơ bản
                }
            }
        } catch (e) {
            console.warn('Error determining product name:', e);
        }

        // 3. Không khớp giá -> Dùng text gốc (hoặc fallback)
        return this._finalizeName(originalText);
    },

    _finalizeName(text) {
        if (!text) return "Chưa xác định";
        const cleanText = String(text).trim();
        if (cleanText === "" || cleanText.toLowerCase() === "nan") return "Chưa xác định";
        return cleanText;
    }
};
