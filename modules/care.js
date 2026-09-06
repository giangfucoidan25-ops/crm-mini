/* ===================================================================
   CRM MINI — CARE MODULE
   Chăm sóc khách hàng, chu kỳ 30 ngày, đánh dấu khách bị chuyển
   =================================================================== */

const CareModule = {
    currentTab: 'care-due',
    currentPage: 1,
    sortColumn: 'care',
    sortOrder: 'default',
    cnmFilter: 'all',

    toggleSort(col) {
        if (this.sortColumn !== col) {
            this.sortColumn = col;
            this.sortOrder = 'asc';
        } else {
            if (this.sortOrder === 'default') this.sortOrder = 'asc';
            else if (this.sortOrder === 'asc') this.sortOrder = 'desc';
            else this.sortOrder = 'default';
        }
        this.renderTabContent(this.currentTab, this.customers);
    },

    async render() {
        let customers = await DB.getActiveCustomers();

        const cnmFilter = this.cnmFilter || 'all';

        // Xây dựng bản đồ trạng thái CNM
        const allLogs = await DB.db.care_logs.toArray();
        const logsByCustomer = {};
        for (const log of allLogs) {
            if (!logsByCustomer[log.customer_id] || log.care_date > logsByCustomer[log.customer_id].care_date) {
                logsByCustomer[log.customer_id] = log;
            }
        }
        
        const todayStr = Utils.today();
        const twoDaysAgo = Utils.addDays(todayStr, -2);
        
        // Thêm _isRecentCNM trực tiếp vào từng customer object để dùng vẽ badge
        for (const c of customers) {
            c._isRecentCNM = false;
            const log = logsByCustomer[c.id];
            c._latestLog = log;
            if (log) {
                const isMissedCall = /\b(cnm|knm|chưa nghe máy|không nghe máy)\b/i.test(log.note?.trim() || '');
                if (isMissedCall && log.care_date >= twoDaysAgo) {
                    c._isRecentCNM = true;
                }
            }
        }

        const search = (document.getElementById('care-search')?.value || '').toLowerCase();
        const productFilter = document.getElementById('care-filter-product')?.value || 'all';

        if (search) {
            customers = customers.filter(c => 
                (c.full_name || '').toLowerCase().includes(search) ||
                (c.phone || '').includes(search)
            );
        }

        if (productFilter !== 'all') {
            const allOrders = await DB.db.orders.toArray();
            const customerIdsWithProduct = new Set();
            allOrders.forEach(o => {
                if (o.product_name && o.product_name.includes(productFilter)) {
                    customerIdsWithProduct.add(o.customer_id);
                }
            });
            customers = customers.filter(c => customerIdsWithProduct.has(c.id));
        }

        const timeFilterVal = document.getElementById('care-scan-time')?.value || 'all';
        if (timeFilterVal !== 'all') {
            const customFrom = document.getElementById('care-scan-date-from')?.value;
            const customTo = document.getElementById('care-scan-date-to')?.value;
            
            if (timeFilterVal !== 'custom' || (customFrom && customTo)) {
                const range = Utils.getDateRange(timeFilterVal, customFrom, customTo);
                
                const logsInRange = await DB.db.care_logs.filter(log => {
                    const d = log.care_date.substring(0, 10);
                    return d >= range.from && d <= range.to;
                }).toArray();
                const logCustIds = new Set(logsInRange.map(l => l.customer_id));
                
                customers = customers.filter(c => {
                    if (logCustIds.has(c.id)) return true;
                    if (c.created_at) {
                        const d = c.created_at.substring(0, 10);
                        if (d >= range.from && d <= range.to) return true;
                    }
                    if (c.updated_at) {
                        const d = c.updated_at.substring(0, 10);
                        if (d >= range.from && d <= range.to) return true;
                    }
                    return false;
                });
            }
        }

        this.careConfig = {
            m1: await DB.getSetting('care_milestone_1') !== undefined ? await DB.getSetting('care_milestone_1') : 1,
            m2: await DB.getSetting('care_milestone_2') !== undefined ? await DB.getSetting('care_milestone_2') : 7,
            m3: await DB.getSetting('care_milestone_3') !== undefined ? await DB.getSetting('care_milestone_3') : 22,
            cycle: await DB.getSetting('care_cycle_days') || 30
        };
        const today = Utils.today();

        const due = customers.filter(c => {
            if (c.transferred_status) return false;
            const st = Utils.getCareStatus(c, this.careConfig);
            return st.status === 'due' || st.status === 'overdue' || st.status === 'never';
        });
        const overdue = customers.filter(c => {
            if (c.transferred_status) return false;
            const st = Utils.getCareStatus(c, this.careConfig);
            return st.status === 'overdue' || st.status === 'never';
        });
        const productIssues = customers.filter(c => {
            if (c.transferred_status) return false;
            if (!c.estimated_product_end_date) return false;
            if (c.hibernated_until && c.hibernated_until >= today) return false;
            return Utils.daysFromNow(c.estimated_product_end_date) <= 7;
        });

        const stats = await DB.getStats();
        const scored = AiAnalysisModule.calculatePriorityScores(customers, stats);
        const special = scored.filter(c => !c.transferred_status && c._priorityScore > 0);

        const allAppointments = await DB.db.appointments.filter(a => a.status === 'pending').toArray();
        const appointmentCustomerIds = new Set(allAppointments.map(a => a.customer_id));
        const appointmentsDict = {};
        allAppointments.forEach(a => {
            if (!appointmentsDict[a.customer_id]) {
                appointmentsDict[a.customer_id] = [];
            }
            appointmentsDict[a.customer_id].push(a);
        });
        
        const appointmentCustomers = customers.filter(c => !c.transferred_status && appointmentCustomerIds.has(c.id)).map(c => {
            c._appointments = appointmentsDict[c.id].sort((a,b) => new Date(a.appointment_date) - new Date(b.appointment_date));
            return c;
        });
        appointmentCustomers.sort((a,b) => new Date(a._appointments[0].appointment_date) - new Date(b._appointments[0].appointment_date));

        this.customers = { due, overdue, productIssues, special, appointment: appointmentCustomers };

        document.getElementById('tab-badge-due').textContent = due.length;
        document.getElementById('tab-badge-overdue').textContent = overdue.length;
        document.getElementById('tab-badge-product').textContent = productIssues.length;
        document.getElementById('tab-badge-special').textContent = special.length;
        const badgeAppt = document.getElementById('tab-badge-appointment');
        if (badgeAppt) badgeAppt.textContent = appointmentCustomers.length;

        this.renderTabContent(this.currentTab, { due, overdue, productIssues, special, appointment: appointmentCustomers });
    },

    renderTabContent(tab, data) {
        const container = document.getElementById('care-tab-content');
        let list = [];
        let title = '';

        switch (tab) {
            case 'care-due': list = data.due; title = 'Đến hạn chăm sóc'; break;
            case 'care-overdue': list = data.overdue; title = 'Quá hạn chăm sóc'; break;
            case 'care-product-out': list = data.productIssues; title = 'Sắp/Đã hết sản phẩm'; break;
            case 'care-special': list = data.special; title = 'Ưu tiên đặc biệt'; break;
            case 'care-appointment': list = data.appointment; title = 'Lịch hẹn KH'; break;
            case 'care-history':
                this.renderHistory(container);
                return;
        }

        const cnmFilter = this.cnmFilter || 'all';
        if (cnmFilter === 'is_cnm') {
            list = list.filter(c => c._isRecentCNM);
        } else if (cnmFilter === 'not_cnm') {
            list = list.filter(c => !c._isRecentCNM);
        }

        const cnmSelectHtml = `
            <select id="care-filter-cnm" class="select-filter" style="min-width: 140px; margin-left: 10px; font-weight: normal;" onchange="CareModule.cnmFilter = this.value; CareModule.currentPage = 1; CareModule.renderTabContent(CareModule.currentTab, CareModule.customers);">
                <option value="all" ${cnmFilter === 'all' ? 'selected' : ''}>Tất cả</option>
                <option value="not_cnm" ${cnmFilter === 'not_cnm' ? 'selected' : ''}>Chưa gọi</option>
                <option value="is_cnm" ${cnmFilter === 'is_cnm' ? 'selected' : ''}>Đã gọi (CNM)</option>
            </select>
        `;

        const headerHtmlOnly = `
            <div style="font-weight:600; color:var(--text-main); font-size:15px; margin-bottom:10px; padding: 0 5px; display: flex; align-items: center;">
                ${title} (${list.length})
                ${tab !== 'care-history' ? cnmSelectHtml : ''}
            </div>
        `;

        if (list.length === 0) {
            container.innerHTML = headerHtmlOnly + `<div class="glass-card"><p class="empty-state">🎉 Không có khách nào trong danh sách "${title}"</p></div>`;
            document.getElementById('care-pagination').innerHTML = '';
            return;
        }

        const searchQuery = (document.getElementById('care-search')?.value || '').toLowerCase().trim();
        if (searchQuery) {
            list = list.filter(c => 
                (c.full_name && c.full_name.toLowerCase().includes(searchQuery)) ||
                (c.phone && c.phone.includes(searchQuery))
            );
            if (list.length === 0) {
                container.innerHTML = headerHtmlOnly + `<div class="glass-card"><p class="empty-state">Không tìm thấy khách hàng nào khớp với "${Utils.escapeHtml(searchQuery)}"</p></div>`;
                document.getElementById('care-pagination').innerHTML = '';
                return;
            }
        }
        
        const getSortIcon = (col) => {
            if (this.sortColumn !== col || this.sortOrder === 'default') return '⇅';
            return this.sortOrder === 'asc' ? '▲' : '▼';
        };

        const getSortColor = (col) => {
            return this.sortColumn === col && this.sortOrder !== 'default' ? 'var(--color-primary)' : 'var(--text-muted)';
        };

        const headerHtml = headerHtmlOnly + `
            <div class="table-container glass-card" style="margin-bottom: 0;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">STT</th>
                            <th>Tên khách hàng</th>
                            <th>Điện thoại</th>
                            <th class="sortable" onclick="CareModule.toggleSort('care')" title="Sắp xếp theo Lịch chăm sóc" style="color:${getSortColor('care')};">
                                Lịch chăm sóc ${getSortIcon('care')}
                            </th>
                            <th class="sortable" onclick="CareModule.toggleSort('expiry')" title="Sắp xếp theo Hạn sản phẩm" style="color:${getSortColor('expiry')};">
                                Hạn sản phẩm ${getSortIcon('expiry')}
                            </th>
                            <th>Ghi chú</th>
                            <th style="min-width: 200px;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        list.sort((a, b) => {
            const aR = a.recall_status ? 1 : 0;
            const bR = b.recall_status ? 1 : 0;
            if (aR !== bR) return aR - bR;

            if (this.sortOrder === 'default') {
                const valA = Utils.getCareStatus(a, this.careConfig).sortValue || 0;
                const valB = Utils.getCareStatus(b, this.careConfig).sortValue || 0;
                return valA - valB;
            } else {
                let valA = 0;
                let valB = 0;

                if (this.sortColumn === 'care') {
                    valA = Utils.getCareStatus(a, this.careConfig).sortValue || 0;
                    valB = Utils.getCareStatus(b, this.careConfig).sortValue || 0;
                } else if (this.sortColumn === 'expiry') {
                    const getExpVal = (c) => {
                        const exp = Utils.getAllProductExpiryStatuses(c.product_expiries);
                        if (exp.length > 0) return Math.min(...exp.map(e => e.daysLeft));
                        if (c.estimated_product_end_date) {
                            const dl = Utils.getProductExpiryStatus(c.estimated_product_end_date, c.expiry_formula).daysLeft;
                            return dl !== null ? dl : 9999;
                        }
                        return 9999;
                    };
                    valA = getExpVal(a);
                    valB = getExpVal(b);
                }

                return this.sortOrder === 'asc' ? valA - valB : valB - valA;
            }
        });

        const itemsPerPage = 20;
        const totalItems = list.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        
        const startIndex = (this.currentPage - 1) * itemsPerPage;
        const paginatedList = list.slice(startIndex, startIndex + itemsPerPage);

        container.innerHTML = `<div>${headerHtml}${paginatedList.map((c, index) => {
            const careStatus = Utils.getCareStatus(c, this.careConfig);
            const expiries = Utils.getAllProductExpiryStatuses(c.product_expiries);
            let expiryHtml = '';
            if (expiries.length > 0) {
                expiryHtml = expiries.map(exp => `<div class="${exp.class}" style="margin-bottom:2px; font-size: 11px; display: inline-block; padding: 2px 6px; border-radius: 4px;" title="${Utils.escapeHtml(exp.productName)}">${Utils.escapeHtml(exp.productName)}: ${exp.label}</div>`).join('<br>');
            } else if (c.estimated_product_end_date) {
                const expiryStatus = Utils.getProductExpiryStatus(c.estimated_product_end_date, c.expiry_formula);
                expiryHtml = `<div class="${expiryStatus.class}" style="font-size: 11px; display: inline-block; padding: 2px 6px; border-radius: 4px;">${expiryStatus.label}</div>`;
            }

            const careTypeSuffix = careStatus.milestone ? ` <span style="color:${careStatus.milestone.color || '#28a745'}; font-weight:bold; margin-left:4px;" title="${careStatus.milestone.name}">${careStatus.milestone.label}</span>` : '';
            const recallSuffix = c.recall_status ? ` <span style="color:var(--color-warning); font-weight:bold; margin-left:4px;" title="Cần gọi lại (Chưa nghe máy/CNM)">R</span>` : '';
            return `
                <tr>
                    <td>${startIndex + index + 1}</td>
                    <td>
                        <strong style="cursor:pointer;" onclick="CustomersModule.viewCustomer('${c.id}')">${Utils.escapeHtml(Utils.formatName(c.full_name))}</strong>
                        ${c._isRecentCNM ? '<span style="background:#fff3cd; color:#856404; font-size:10px; margin-left:6px; padding:2px 4px; border-radius:4px; border:1px solid #ffeeba;">📞 Hôm nay CNM</span>' : ''}
                        ${Utils.getGetFlyLink(c)}${careTypeSuffix}${recallSuffix}
                        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${Utils.sourceLabel(c.customer_source)} • ${c.last_product_used || '—'}</div>
                    </td>
                    <td>${c.phone || '—'}</td>
                    <td><span class="badge ${careStatus.class}">${careStatus.label}</span></td>
                    <td>${expiryHtml}</td>
                    <td>
                        ${c.note ? `<div style="font-size:12px; margin-bottom:4px; max-height:40px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;" title="${Utils.escapeHtml(c.note)}">📌 ${Utils.escapeHtml(c.note)}</div>` : ''}
                        ${c._latestLog && c._latestLog.note ? `<div style="font-size:12px; color:var(--text-main); margin-bottom:4px; max-height:40px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;" title="${Utils.escapeHtml(c._latestLog.note)}">💬 ${Utils.escapeHtml(c._latestLog.note)}</div>` : ''}
                        ${c._priorityScore ? `<div class="care-item-score" style="margin-bottom:2px; display:inline-block;">${c._priorityScore}đ</div>` : ''}
                        ${c._reasons ? `<div class="care-item-reason" style="margin-bottom:2px; display:inline-block;">${c._reasons[0] || ''}</div>` : ''}
                        ${c._appointments ? `<div class="care-item-reason" style="background: var(--color-warning); color: #fff; padding: 2px 6px; border-radius: 4px; display:inline-block; font-size:11px;">📅 ${Utils.formatDateTime(c._appointments[0].appointment_date)}</div>` : ''}
                    </td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn btn-care" onclick="CustomersModule.viewCustomer(\'${c.id}\', 'traodoi')" title="Note Chăm sóc" style="color:var(--color-primary);">📝</button>
                            <button class="action-btn btn-zalo" onclick="ZaloModule.openZalo('${c.zalo_phone || c.phone}')" title="Mở Zalo">💬</button>
                            <button class="action-btn btn-recall" onclick="CareModule.markRecall(\'${c.id}\')" title="Chưa nghe máy / Cần gọi lại" style="color:${c.recall_status ? 'var(--color-warning)' : 'var(--text-muted)'}; font-weight:bold;">↻</button>
                            <button class="action-btn btn-order" onclick="OrdersModule.showForm(null, \'${c.id}\')" title="Thêm đơn hàng">🛒</button>
                            <button class="action-btn btn-care" onclick="CareModule.markCared(\'${c.id}\')" title="Đã CS (Không ghi chú)" style="${c.last_contact_date && c.last_contact_date.substring(0, 10) === Utils.today() ? 'color:var(--color-success);font-weight:bold;' : 'display:inline-flex;align-items:center;justify-content:center;'}">${c.last_contact_date && c.last_contact_date.substring(0, 10) === Utils.today() ? '✓' : '<div style="width:14px;height:14px;border:2px solid #fff;border-radius:3px;display:inline-block;"></div>'}</button>
                            <button class="action-btn btn-transfer" onclick="CareModule.markTransferred(\'${c.id}\')" title="Đánh dấu chuyển">↗️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('')}</tbody></table></div></div>`;

        Utils.renderPagination('care-pagination', this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.renderTabContent(tab, data);
        });
    },

    async renderHistory(container) {
        const logs = await DB.getAllCareLogs();
        const customers = await DB.getAllCustomers();
        const cMap = {};
        customers.forEach(c => cMap[c.id] = c);

        logs.sort((a, b) => {
            const tA = new Date(a.created_at || a.care_date).getTime();
            const tB = new Date(b.created_at || b.care_date).getTime();
            if (tA === tB) {
                return new Date(b.care_date).getTime() - new Date(a.care_date).getTime();
            }
            return tB - tA;
        });
        const recent = logs.slice(0, 50);

        if (recent.length === 0) {
            container.innerHTML = '<div class="glass-card"><p class="empty-state">Chưa có lịch sử chăm sóc</p></div>';
            return;
        }

        container.innerHTML = `<div class="glass-card">${recent.map(l => {
            const c = cMap[l.customer_id];
            return `<div style="padding:12px 0;border-bottom:1px solid var(--border-light);font-size:13px;text-align:left;">
                <div style="margin-bottom:4px;">
                    <strong>${c ? Utils.escapeHtml(Utils.formatName(c.full_name)) : 'N/A'}</strong>
                    ${Utils.getGetFlyLink(c)} • ${l.care_type || 'Chăm sóc'}</span>
                </div>
                ${l.note ? `<div style="color:var(--text-main);line-height:1.5;">${Utils.escapeHtml(l.note).replace(/\\n/g, '<br>')}</div>` : ''}
            </div>`;
        }).join('')}</div>`;
    },

    async markCared(customerId) {
        const customer = await DB.getCustomer(customerId);
        if (!customer) return;

        if (!this.careConfig) {
            this.careConfig = {
                m1: await DB.getSetting('care_milestone_1') !== undefined ? await DB.getSetting('care_milestone_1') : 1,
                m2: await DB.getSetting('care_milestone_2') !== undefined ? await DB.getSetting('care_milestone_2') : 7,
                m3: await DB.getSetting('care_milestone_3') !== undefined ? await DB.getSetting('care_milestone_3') : 22,
                cycle: await DB.getSetting('care_cycle_days') || 30
            };
        }

        const isCaredToday = customer.last_contact_date && customer.last_contact_date.substring(0, 10) === Utils.today();
        
        if (isCaredToday) {
            const logs = await DB.getCareLogsByCustomer(customerId);
            if (logs.length > 0) {
                await DB.db.care_logs.delete(logs[0].id);
                const previousLogDate = logs.length > 1 ? logs[1].care_date : null;
                await DB.db.customers.update(customerId, {
                    last_contact_date: previousLogDate,
                    next_care_date: previousLogDate ? Utils.addDays(previousLogDate, this.careConfig.cycle) : null,
                    updated_at: new Date().toISOString()
                });
            } else {
                await DB.db.customers.update(customerId, {
                    last_contact_date: null,
                    next_care_date: null,
                    updated_at: new Date().toISOString()
                });
            }
            Utils.showToast('Đã bỏ đánh dấu chăm sóc!', 'info');
        } else {
            // Check logic
            await DB.addCareLog({
                customer_id: customerId,
                care_date: Utils.today(),
                care_type: 'Chăm sóc thủ công',
                note: ''
            });

            const updates = {};
            let shouldUpdate = false;

            // A. Lịch hẹn KH
            const allAppointments = await DB.db.appointments.where('customer_id').equals(customerId).toArray();
            const pendingAppts = allAppointments.filter(a => a.status === 'pending' && a.appointment_date.substring(0, 10) <= Utils.today());
            for (const appt of pendingAppts) {
                await DB.db.appointments.update(appt.id, { status: 'completed', updated_at: new Date().toISOString() });
            }

            // B. Ưu tiên đặc biệt
            if (customer.keyword_category === 'PRIORITY') {
                updates.keyword_category = 'NONE';
                shouldUpdate = true;
            }

            // C. Sắp/Đã hết sản phẩm
            if (customer.estimated_product_end_date) {
                const daysFromEnd = Utils.daysFromNow(customer.estimated_product_end_date);
                if (daysFromEnd <= 7) {
                    updates.hibernated_until = Utils.addDays(Utils.today(), 3);
                    shouldUpdate = true;
                }
            }

            if (shouldUpdate) {
                updates.updated_at = new Date().toISOString();
                await DB.db.customers.update(customerId, updates);
            }

            Utils.showToast('Đã đánh dấu chăm sóc thành công!', 'success');
        }

        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        if (typeof CustomersModule !== 'undefined' && document.getElementById('page-customers')?.classList.contains('active')) {
            CustomersModule.render();
        }
    },

    async markTransferred(customerId) {
        const customer = await DB.getCustomer(customerId);
        if (!customer) return;

        const ok = await Utils.confirm(
            'Đánh dấu khách bị chuyển',
            `Bạn có chắc muốn đánh dấu "${customer.full_name}" là khách bị chuyển? Khách sẽ không còn xuất hiện trong danh sách chăm sóc hằng ngày.`,
            '↗️'
        );
        if (!ok) return;

        await DB.updateCustomer(customerId, {
            transferred_status: true,
            transferred_date: Utils.today(),
            transferred_reason: 'Quá hạn chăm sóc 30 ngày'
        });

        Utils.showToast(`Đã đánh dấu "${customer.full_name}" là khách bị chuyển`, 'warning');
        this.render();
        DashboardModule.render();
    },
    async markRecall(customerId) {
        const customer = await DB.getCustomer(customerId);
        if (!customer) return;
        
        const isRecalled = customer.recall_status;
        await DB.db.customers.update(customerId, {
            recall_status: !isRecalled,
            updated_at: new Date().toISOString()
        });
        
        Utils.showToast(isRecalled ? 'Đã bỏ đánh dấu chăm sóc lại' : 'Đã đánh dấu cần chăm sóc lại (Chuyển xuống cuối danh sách)', isRecalled ? 'info' : 'warning');
        this.render();
    },

    initEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTab = btn.dataset.tab;
                this.currentPage = 1;
                this.render();
            });
        });

        const aiCheckbox = document.getElementById('care-use-ai');
        if (aiCheckbox) {
            DB.getSetting('use_ai_keyword_filter').then(v => { aiCheckbox.checked = !!v; });
            aiCheckbox.addEventListener('change', (e) => {
                DB.setSetting('use_ai_keyword_filter', e.target.checked);
            });
        }
        const timeSelect = document.getElementById('care-scan-time');
        const customDate = document.getElementById('care-scan-custom-date');
        if (timeSelect && customDate) {
            timeSelect.addEventListener('change', (e) => {
                customDate.style.display = e.target.value === 'custom' ? 'flex' : 'none';
                if (e.target.value !== 'custom') {
                    this.currentPage = 1;
                    this.render();
                }
            });
            
            document.getElementById('care-scan-date-from')?.addEventListener('change', () => {
                const toDate = document.getElementById('care-scan-date-to')?.value;
                if (toDate) {
                    this.currentPage = 1;
                    this.render();
                }
            });
            
            document.getElementById('care-scan-date-to')?.addEventListener('change', () => {
                const fromDate = document.getElementById('care-scan-date-from')?.value;
                if (fromDate) {
                    this.currentPage = 1;
                    this.render();
                }
            });
        }
        
        document.getElementById('btn-scan-care')?.addEventListener('click', () => {
            this.scanDataByTime();
        });

        const searchInput = document.getElementById('care-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.currentPage = 1;
                this.render();
            }, 300));
        }

        const productFilter = document.getElementById('care-filter-product');
        if (productFilter) {
            productFilter.addEventListener('change', () => {
                this.currentPage = 1;
                this.render();
            });
        }

        const cnmFilterBtn = document.getElementById('care-filter-cnm');
        if (cnmFilterBtn) {
            cnmFilterBtn.addEventListener('change', () => {
                this.currentPage = 1;
                this.render();
            });
        }
    },

    async scanDataByTime() {
        const timeSelect = document.getElementById('care-scan-time');
        const filterVal = timeSelect ? timeSelect.value : 'all';
        let fromDate, toDate;

        if (filterVal !== 'all') {
            const customFrom = document.getElementById('care-scan-date-from')?.value;
            const customTo = document.getElementById('care-scan-date-to')?.value;
            
            if (filterVal === 'custom' && (!customFrom || !customTo)) {
                await Utils.confirm('Thiếu thông tin', 'Vui lòng chọn ngày bắt đầu và ngày kết thúc từ Lịch để quét.', '⚠️');
                return;
            }
            
            const range = Utils.getDateRange(filterVal, customFrom, customTo);
            fromDate = range.from;
            toDate = range.to;
        }

        Utils.showLoading('Đang tập hợp danh sách khách hàng...');
        
        try {
            let customersToScan = [];
            const allCusts = await DB.db.customers.filter(c => !c.transferred_status && !c.deleted_at && !c.manual_stopped).toArray();

            if (filterVal === 'all') {
                customersToScan = allCusts;
            } else {
                const logsInRange = await DB.db.care_logs.filter(log => {
                    const d = log.care_date.substring(0, 10);
                    return d >= fromDate && d <= toDate;
                }).toArray();
                const logCustIds = new Set(logsInRange.map(l => l.customer_id));

                customersToScan = allCusts.filter(c => {
                    if (logCustIds.has(c.id)) return true;
                    if (c.created_at) {
                        const d = c.created_at.substring(0, 10);
                        if (d >= fromDate && d <= toDate) return true;
                    }
                    if (c.updated_at) {
                        const d = c.updated_at.substring(0, 10);
                        if (d >= fromDate && d <= toDate) return true;
                    }
                    return false;
                });
            }

            if (customersToScan.length === 0) {
                Utils.hideLoading();
                await Utils.confirm('Không có dữ liệu', 'Hệ thống không tìm thấy khách hàng nào có tương tác trong khoảng thời gian bạn vừa chọn. Vui lòng chọn mốc thời gian rộng hơn.', 'ℹ️');
                return;
            }

            const useAi = document.getElementById('care-use-ai')?.checked || false;
            const warningAi = useAi ? '\n\nLưu ý: Quét bằng AI sẽ tốn thời gian hơn.' : '';
            Utils.hideLoading();
            
            const timeLabel = timeSelect && timeSelect.options[timeSelect.selectedIndex] ? timeSelect.options[timeSelect.selectedIndex].text : 'Tất cả thời gian';
            const ok = await Utils.confirm(
                'Xác nhận quét dữ liệu',
                `Hệ thống tìm thấy ${customersToScan.length} khách hàng có tương tác trong mốc thời gian [${timeLabel}]. Bạn có muốn tiến hành quét?${warningAi}`,
                '🔄'
            );
            
            if (!ok) return;

            Utils.showLoading(`Đang quét ${customersToScan.length} khách hàng...`);
            let countPriority = 0;
            let countStopped = 0;
            let countNonPriority = 0;

            for (const c of customersToScan) {
                let finalIntent = 'NONE';
                
                const careLogs = await DB.getCareLogsByCustomer(c.id);
                careLogs.sort((a, b) => {
                    const tA = new Date(a.created_at || a.care_date).getTime();
                    const tB = new Date(b.created_at || b.care_date).getTime();
                    if (tA === tB) {
                        return new Date(a.care_date).getTime() - new Date(b.care_date).getTime();
                    }
                    return tA - tB;
                });

                let fullText = "";
                if (c.note) fullText += `[Ghi chú ban đầu] ${c.note}\n`;
                for (const log of careLogs) {
                    if (log.note) {
                        const dateStr = Utils.formatDate(log.care_date);
                        fullText += `[${dateStr}] ${log.note}\n`;
                    }
                }

                if (fullText) {
                    finalIntent = await Utils.analyzeKeywordIntent(fullText);
                }

                if (finalIntent !== 'NONE' || c.keyword_category !== 'NONE' || c.stopped_status) {
                    const updateData = { updated_at: new Date().toISOString() };
                    
                    if (finalIntent === 'STOPPED') {
                        updateData.stopped_status = true;
                        updateData.keyword_category = 'STOPPED';
                        countStopped++;
                    } else {
                        updateData.stopped_status = false;
                        if (finalIntent === 'PRIORITY') {
                            updateData.keyword_category = 'PRIORITY';
                            countPriority++;
                        } else if (finalIntent === 'NON_PRIORITY') {
                            updateData.keyword_category = 'NON_PRIORITY';
                            countNonPriority++;
                        } else {
                            updateData.keyword_category = 'NONE';
                        }
                    }

                    await DB.db.customers.update(c.id, updateData);
                }

                if (useAi) await new Promise(r => setTimeout(r, 200)); 
            }

            Utils.hideLoading();
            await Utils.confirm('Hoàn tất quét dữ liệu', `Đã quét và cập nhật thành công!\n\n- Đã chuyển ${countStopped} người sang Tạm dừng.\n- Đã đánh dấu ${countPriority} người là Ưu tiên đặc biệt.\n- ${countNonPriority} người ở trạng thái bình thường.`, '✅');
            
            this.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();

        } catch (e) {
            console.error(e);
            Utils.hideLoading();
            await Utils.confirm('Lỗi hệ thống', 'Đã xảy ra lỗi khi quét: ' + e.message, '❌');
        }
    }
};

/* ===================================================================
   CRM MINI — DRILLDOWN MODULE
   Hiển thị danh sách chi tiết khi click KPI/biểu đồ
   =================================================================== */
const DrilldownModule = {
    previousPage: 'dashboard',
    currentPage: 1,
    pageSize: 20,
    currentData: [],

    showCustomerList(title, customers) {
        this.previousPage = App.currentPage;
        this.currentData = customers;
        document.getElementById('drilldown-title').textContent = title;

        const thead = document.getElementById('drilldown-thead');
        thead.innerHTML = `<tr>
            <th style="width: 50px;">STT</th><th>Tên khách hàng</th><th>Điện thoại</th><th>Nguồn</th><th>Trạng thái</th>
            <th>Doanh số</th><th>Chăm sóc gần nhất</th><th>Tình trạng SP</th><th>Thao tác</th>
        </tr>`;

        this.currentPage = 1;
        this.renderCustomerPage();
        App.navigateTo('drilldown');
    },

    renderCustomerPage() {
        const total = this.currentData.length;
        const totalPages = Math.ceil(total / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize;
        const pageData = this.currentData.slice(start, start + this.pageSize);

        const tbody = document.getElementById('drilldown-tbody');
        tbody.innerHTML = pageData.map((c, index) => {
        const careStatus = Utils.getCareStatus(c, this.careConfig);
            const expiryStatus = Utils.getProductExpiryStatus(c.estimated_product_end_date, c.expiry_formula);
            const stt = start + index + 1;
            return `<tr>
                <td>${stt}</td>
                <td>
                    <strong style="cursor:pointer;" onclick="CustomersModule.viewCustomer(\'${c.id}\')">${Utils.escapeHtml(Utils.formatName(c.full_name))}</strong>
                    ${c._isRecentCNM ? '<br><span style="background:#fff3cd; color:#856404; font-size:10px; padding:2px 4px; border-radius:4px; border:1px solid #ffeeba; display:inline-block; margin-top:2px;">📞 Hôm nay CNM</span>' : ''}
                    ${Utils.getGetFlyLink(c)}
                </td>
                <td>${c.phone || '—'}</td>
                <td>${Utils.sourceLabel(c.customer_source)}</td>
                <td><span class="status-badge status-${c.status}">${Utils.customerStatusLabel(c.status)}</span></td>
                <td>${Utils.formatCurrency(c.total_revenue)}</td>
                <td><span class="badge ${careStatus.class}">${careStatus.label}</span></td>
                <td><span class="${expiryStatus.class}">${expiryStatus.label}</span></td>
                <td><div class="action-btns">
                    <button class="action-btn btn-zalo" onclick="ZaloModule.openZalo('${c.zalo_phone || c.phone}')" title="Zalo">💬</button>
                    <button class="action-btn btn-order" onclick="OrdersModule.showForm(null, \'${c.id}\')" title="Thêm đơn hàng">🛒</button>
                    <button class="action-btn btn-care" onclick="CareModule.markCared(\'${c.id}\')" title="Đã CS" style="${c.last_contact_date && c.last_contact_date.substring(0, 10) === Utils.today() ? 'color:var(--color-success);font-weight:bold;' : 'display:inline-flex;align-items:center;justify-content:center;'}">${c.last_contact_date && c.last_contact_date.substring(0, 10) === Utils.today() ? '✓' : '<div style="width:14px;height:14px;border:2px solid #fff;border-radius:3px;display:inline-block;"></div>'}</button>
                </div></td>
            </tr>`;
        }).join('');

        Utils.renderPagination('drilldown-pagination', this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.renderCustomerPage();
        });
    },

    showOrderList(title, orders) {
        this.previousPage = App.currentPage;
        this.currentData = orders;
        document.getElementById('drilldown-title').textContent = title;

        const thead = document.getElementById('drilldown-thead');
        thead.innerHTML = `<tr>
            <th>Ngày đặt</th><th>Sản phẩm</th><th>SL</th><th>Tổng tiền</th><th>Trạng thái</th><th>Thao tác</th>
        </tr>`;

        this.currentPage = 1;
        this.renderOrderPage();
        App.navigateTo('drilldown');
    },

    renderOrderPage() {
        const total = this.currentData.length;
        const totalPages = Math.ceil(total / this.pageSize);
        const start = (this.currentPage - 1) * this.pageSize;
        const pageData = this.currentData.slice(start, start + this.pageSize);

        const tbody = document.getElementById('drilldown-tbody');
        tbody.innerHTML = pageData.map(o => `<tr>
            <td>${Utils.formatDate(o.order_date)}</td>
            <td>${Utils.escapeHtml(o.product_name || '')}</td>
            <td>${o.quantity || 0}</td>
            <td style="font-weight:600;">${Utils.formatCurrency(o.total_amount)}</td>
            <td><span class="status-badge order-${o.order_status}">${Utils.orderStatusLabel(o.order_status)}</span></td>
            <td><button class="action-btn btn-edit" onclick="OrdersModule.editOrder(\'${o.id}\')" title="Sửa">✏️</button></td>
        </tr>`).join('');

        Utils.renderPagination('drilldown-pagination', this.currentPage, totalPages, (page) => {
            this.currentPage = page;
            this.renderOrderPage();
        });
    },

    goBack() {
        App.navigateTo(this.previousPage);
    },

    initEvents() {
        document.getElementById('btn-drilldown-back')?.addEventListener('click', () => this.goBack());
        const debouncedSearch = Utils.debounce(() => {
            const q = document.getElementById('drilldown-search').value.toLowerCase();
            // simple filter on current data - not re-querying
        }, 300);
        document.getElementById('drilldown-search')?.addEventListener('input', debouncedSearch);
    }
};
