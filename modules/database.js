/* ===================================================================
   CRM MINI — DATABASE MODULE
   IndexedDB wrapper sử dụng Dexie.js
   Quản lý toàn bộ dữ liệu local-first
   =================================================================== */

const DB = {
    db: null,

    // ===== Khởi tạo database =====
    async init() {
        this.db = new Dexie('CRMminiDB');

        this.db.version(5).stores({
            customers: 'id, full_name, phone, zalo_phone, customer_source, status, tags, last_contact_date, next_care_date, overdue_status, transferred_status, total_revenue, priority_score, created_at',
            products: 'id, product_name, product_category, price, active_status, created_at',
            orders: 'id, customer_id, product_id, order_date, order_status, total_amount, estimated_product_end_date, created_at',
            care_logs: 'id, customer_id, care_date, care_type, created_at',
            message_templates: 'id, template_name, created_at',
            settings: 'key',
            backup_logs: 'id, backup_date',
            appointments: 'id, customer_id, appointment_date, status, created_at',
            ai_sessions: 'id, timestamp, time_range, created_at',
            ai_analysis_history: 'id, analysis_type, created_at'
        });

        try {
            await this.db.open();
        } catch (e) {
            console.error('Lỗi nâng cấp CSDL (do đổi khóa chính sang UUID). Đang tiến hành xóa và tạo lại CSDL cục bộ...', e);
            await Dexie.delete('CRMminiDB');
            this.db = new Dexie('CRMminiDB');
            this.db.version(5).stores({
                customers: 'id, full_name, phone, zalo_phone, customer_source, status, tags, last_contact_date, next_care_date, overdue_status, transferred_status, total_revenue, priority_score, created_at',
                products: 'id, product_name, product_category, price, active_status, created_at',
                orders: 'id, customer_id, product_id, order_date, order_status, total_amount, estimated_product_end_date, created_at',
                care_logs: 'id, customer_id, care_date, care_type, created_at',
                message_templates: 'id, template_name, created_at',
                settings: 'key',
                backup_logs: 'id, backup_date',
                appointments: 'id, customer_id, appointment_date, status, created_at',
                ai_sessions: 'id, timestamp, time_range, created_at',
                ai_analysis_history: 'id, analysis_type, created_at'
            });
            await this.db.open();
        }
        console.log('✅ Database initialized successfully');

        // Khởi tạo settings mặc định
        await this.initDefaultSettings();

        // Tự động kéo từ Két sắt (Local Server) nếu CSDL trên máy trống rỗng
        await this.syncFromServer();
        
        // Đăng ký Dexie Hooks để đẩy dữ liệu lên Supabase tự động
        const tablesToSync = ['customers', 'products', 'orders', 'care_logs', 'appointments', 'message_templates'];
        tablesToSync.forEach(table => {
            this.db[table].hook('creating', function(primKey, obj, trans) {
                if(typeof SupabaseSync !== 'undefined' && SupabaseSync.isConnected && !SupabaseSync.isSyncing) {
                    this.onsuccess = function (realPrimKey) {
                        const pushObj = { ...obj, id: realPrimKey };
                        setTimeout(() => SupabaseSync.push(table, pushObj), 100);
                    };
                }
            });
            this.db[table].hook('updating', function(mods, primKey, obj, trans) {
                if(typeof SupabaseSync !== 'undefined' && SupabaseSync.isConnected && !SupabaseSync.isSyncing) {
                    setTimeout(async () => {
                        try {
                            const latestObj = await DB.db[table].get(primKey);
                            if (latestObj) {
                                SupabaseSync.push(table, latestObj);
                            }
                        } catch(e) {
                            console.error('Lỗi lấy dữ liệu sau khi update:', e);
                        }
                    }, 100);
                }
            });
            this.db[table].hook('deleting', function(primKey, obj, trans) {
                if(typeof SupabaseSync !== 'undefined' && SupabaseSync.isConnected && !SupabaseSync.isSyncing) {
                    setTimeout(() => SupabaseSync.remove(table, primKey), 100);
                }
            });
        });
        await this.fixSwappedDates();
        await this.fixMissingTotalAmounts();
        await this.fixCustomerStats();
        await this.fixCompletedOrderDates();
        await this.fixAllLogs();
        await this.fixNgaOrderDate();

        // Đăng ký sự kiện đồng bộ trước khi tắt ứng dụng
        window.addEventListener('beforeunload', () => {
            if (this._syncTimeout) {
                clearTimeout(this._syncTimeout);
                this.saveToServer(true);
            }
        });
    },

    async fixSwappedDates() {
        const hasFixed = await this.getSetting('has_fixed_swapped_dates_v5');
        if (hasFixed) return;

        try {
            let updatedCount = 0;

            // 1. Fix Care Logs
            const logs = await this.db.care_logs.toArray();
            for (let log of logs) {
                if (!log.care_date) continue;

                const parts = log.care_date.split('-');
                if (parts.length === 3) {
                    const currMonth = parseInt(parts[1]);
                    const currDay = parseInt(parts[2]);

                    let newDate = null;
                    if (currMonth > 7) {
                        newDate = `${parts[0]}-${currDay.toString().padStart(2, '0')}-${currMonth.toString().padStart(2, '0')}`;
                    } else if (log.note) {
                        const match = log.note.match(/^\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
                        if (match) {
                            const textDay = parseInt(match[1]);
                            const textMonth = parseInt(match[2]);
                            if (currMonth === textDay && currDay === textMonth && textDay !== textMonth) {
                                newDate = `${parts[0]}-${textMonth.toString().padStart(2, '0')}-${textDay.toString().padStart(2, '0')}`;
                            }
                        }
                    }

                    if (newDate) {
                        await this.db.care_logs.update(log.id, { care_date: newDate });
                        updatedCount++;
                    }
                }
            }
            // 2. Fix Orders (Imported from Feb Excel Sheet)
            const orders = await this.db.orders.toArray();
            for (let order of orders) {
                let needsUpdate = false;
                const updates = {};

                if (order.items && order.items.length > 0) {
                    const mainItem = order.items.find(i => !i.is_gift) || order.items[0];
                    if (order.product_name !== mainItem.product_name) {
                        updates.product_name = mainItem.product_name;
                        needsUpdate = true;
                    }
                }

                if (order.note === 'Imported from Feb Excel Sheet' && order.order_date) {
                    const parts = order.order_date.split('-');
                    if (parts.length === 3) {
                        const currMonth = parseInt(parts[1]);
                        const currDay = parseInt(parts[2]);

                        // Fix any date that is > 2026-07-04 (e.g. Month > 7)
                        if (currMonth > 7) {
                            updates.order_date = `${parts[0]}-${currDay.toString().padStart(2, '0')}-${currMonth.toString().padStart(2, '0')}`;
                            needsUpdate = true;
                        } else if (currDay === 4 && currMonth <= 12 && currMonth !== 4) {
                            // Keep the specific rule for April 4th swap
                            updates.order_date = `${parts[0]}-04-${currMonth.toString().padStart(2, '0')}`;
                            needsUpdate = true;
                        } else if (currDay === 1 && currMonth === 2) {
                            updates.order_date = `${parts[0]}-01-02`;
                            needsUpdate = true;
                        }

                        if (needsUpdate && updates.order_date) {
                            // Recalculate estimated_product_end_date
                            const products = await this.db.products.toArray();
                            let product = products.find(p => p.id === order.product_id);
                            let cycle = product ? (product.usage_cycle_days || 0) : 0;
                            let totalCycle = cycle * (order.quantity || 1);
                            if (totalCycle > 0) {
                                updates.estimated_product_end_date = Utils.addDays(updates.order_date, totalCycle);
                            }
                        }
                    }
                }

                if (needsUpdate) {
                    await this.db.orders.update(order.id, updates);
                    updatedCount++;
                }
            }

            await this.db.settings.put({ key: 'has_fixed_swapped_dates_v5', value: true });
            if (updatedCount > 0) {
                console.log(`🔧 Fixed ${updatedCount} swapped dates!`);
                this.scheduleSync();
            }
        } catch (e) {
            console.error('Error fixing swapped dates', e);
        }
    },

    async fixMissingTotalAmounts() {
        const hasFixed = await this.getSetting('has_fixed_missing_total_amounts');
        if (hasFixed) return;

        try {
            let updatedCount = 0;
            const orders = await this.db.orders.toArray();
            const products = await this.db.products.toArray();

            for (let order of orders) {
                // Bỏ qua nếu đơn hàng có ghi chú là hàng tặng
                if (order.note && (order.note.toLowerCase().includes('tặng') || order.note.toLowerCase().includes('gift'))) {
                    continue;
                }

                if (!order.total_amount || order.total_amount === 0 || order.total_amount === '0') {
                    let newTotal = 0;

                    let qty = order.quantity || 1;

                    if (order.items && order.items.length > 0) {
                        for (const item of order.items) {
                            if (item.is_gift) continue;
                            let product = products.find(p => p.product_name === item.product_name);
                            if (product) {
                                newTotal += (product.price || 0) * (item.quantity || 1);
                            }
                        }
                    } else if (order.product_name) {
                        let product = products.find(p => p.product_name === order.product_name);
                        if (product) {
                            newTotal += (product.price || 0) * qty;
                        }
                    }

                    // Nếu tính ra lớn hơn 0 (không phải hàng tặng hoàn toàn) thì mới cập nhật
                    if (newTotal > 0) {
                        await this.db.orders.update(order.id, { total_amount: newTotal });
                        await this.recalculateCustomerStats(order.customer_id);
                        updatedCount++;
                    }
                }
            }

            await this.db.settings.put({ key: 'has_fixed_missing_total_amounts', value: true });
            if (updatedCount > 0) {
                console.log(`🔧 Fixed ${updatedCount} orders missing total amount!`);
                this.scheduleSync();
            }
        } catch (e) {
            console.error('Error fixing missing total amounts', e);
        }
    },

    async fixAllLogs() {
        if (localStorage.getItem('fixed_all_logs_time_3')) return;
        try {
            const logs = await this.db.care_logs.toArray();
            let fixed = false;
            for (let log of logs) {
                if (!log.note) continue;
                const match = log.note.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{2}:\d{2})/);
                if (match) {
                    const [day, month, year] = match[1].split('/');
                    const time = match[2];
                    const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00.000Z`;
                    if (log.created_at !== isoStr) {
                        await this.db.care_logs.update(log.id, { created_at: isoStr, care_date: isoStr.split('T')[0] });
                        fixed = true;
                    }
                }
            }
            if (fixed) {
                localStorage.setItem('fixed_all_logs_time_3', 'true');
            }
        } catch (e) {
            console.error('Error fixing all logs:', e);
        }
    },

    async fixNgaOrderDate() {
        if (localStorage.getItem('fixed_nga_order_date')) return;
        try {
            const ngaList = await this.db.customers.filter(c => c.full_name && c.full_name.includes('Nga')).toArray();
            let fixed = false;
            for (const nga of ngaList) {
                const orders = await this.db.orders.where('customer_id').equals(nga.id).toArray();
                for (let order of orders) {
                    if (order.order_date === '2026-07-04') {
                        await this.db.orders.update(order.id, { order_date: '2026-04-07' });
                        fixed = true;
                    }
                }
            }
            if (fixed) {
                localStorage.setItem('fixed_nga_order_date', 'true');
            }
        } catch (e) {
            console.error('Error fixing Nga order date:', e);
        }
    },

    async fixCustomerStats() {
        if (localStorage.getItem('fixed_customer_stats_v1')) return;
        try {
            const customers = await this.db.customers.toArray();
            let count = 0;
            for (const c of customers) {
                await this.recalculateCustomerStats(c.id);
                count++;
            }
            localStorage.setItem('fixed_customer_stats_v1', 'true');
            console.log(`🔧 Resynced stats for ${count} customers`);
            this.scheduleSync();
        } catch (e) {
            console.error('Error fixing customer stats', e);
        }
    },

    // ===== Settings mặc định =====
    async initDefaultSettings() {
        const defaults = {
            commission_rate: { key: 'commission_rate', value: 10 },
            care_cycle_days: { key: 'care_cycle_days', value: 30 },
            priority_keywords: {
                key: 'priority_keywords',
                value: ['hẹn gọi lại', 'hỏi giá', 'cần tư vấn', 'quan tâm', 'combo']
            },
            priority_scores: {
                key: 'priority_scores',
                value: {
                    overdue_care: 30, product_expired: 30, product_running_out: 25,
                    care_due_today: 25, waiting_close: 20, interested_combo: 20,
                    vip: 15, repurchased: 15, high_revenue: 10, keyword_match: 10
                }
            },
            stop_care_keywords: {
                key: 'stop_care_keywords',
                value: ['không dùng nữa', 'đã chết', 'không uống nữa', 'đã mất']
            },
            non_priority_keywords: {
                key: 'non_priority_keywords',
                value: ['không có tiền', 'chưa muốn mua', 'để hỏi vợ', 'không mua']
            },
            use_ai_keyword_filter: { key: 'use_ai_keyword_filter', value: false },
            theme: { key: 'theme', value: 'dark' }
        };

        for (const [key, data] of Object.entries(defaults)) {
            const existing = await this.db.settings.get(key);
            if (!existing) {
                await this.db.settings.put(data);
            }
        }
    },

    // ===== SETTINGS CRUD =====
    async getSetting(key) {
        const setting = await this.db.settings.get(key);
        return setting ? setting.value : null;
    },

    async setSetting(key, value) {
        await this.db.settings.put({ key, value });
        this.scheduleSync();
    },

    // ===== CUSTOMERS CRUD =====
    async addCustomer(customer) {
        customer.id = Utils.generateId();
        customer.created_at = new Date().toISOString();
        customer.updated_at = customer.created_at;
        customer.total_revenue = customer.total_revenue || 0;
        customer.total_orders = customer.total_orders || 0;
        customer.priority_score = customer.priority_score || 0;
        customer.overdue_status = customer.overdue_status || false;
        customer.transferred_status = customer.transferred_status || false;
        customer.stopped_status = customer.stopped_status || false;
        customer.care_cycle_days = customer.care_cycle_days || 30;

        customer.phone = Utils.formatPhone(customer.phone);
        if (customer.zalo_phone) customer.zalo_phone = Utils.formatPhone(customer.zalo_phone);

        customer.keyword_category = 'NONE';

        if (customer.note) {
            const intent = await Utils.analyzeKeywordIntent(customer.note);
            customer.keyword_category = intent;
            if (intent === 'STOPPED') {
                customer.stopped_status = true;
            }
            if (intent === 'CANCELLED') {
                customer.cancelled_status = true;
            }
        }

        const result = await this.db.customers.add(customer);
        this.scheduleSync();
        return result;
    },

    async updateCustomer(id, data) {
        data.updated_at = new Date().toISOString();
        if (data.phone) data.phone = Utils.formatPhone(data.phone);
        if (data.zalo_phone) data.zalo_phone = Utils.formatPhone(data.zalo_phone);

        if (data.note) {
            const intent = await Utils.analyzeKeywordIntent(data.note);
            data.keyword_category = intent;
            if (intent === 'STOPPED') {
                data.stopped_status = true;
            }
            if (intent === 'CANCELLED') {
                data.cancelled_status = true;
            }
        }
        const result = await this.db.customers.update(id, data);
        this.scheduleSync();
        return result;
    },

    async deleteCustomer(id) {
        const result = await this.db.customers.update(id, { 
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        this.scheduleSync();
        return result;
    },

    async getCustomer(id) {
        return await this.db.customers.get(id);
    },

    async getAllCustomers() {
        return await this.db.customers.toArray();
    },

    async getActiveCustomers() {
        return await this.db.customers.filter(c => !c.transferred_status && !c.deleted_at && !c.stopped_status && !c.cancelled_status && c.status !== 'cancelled').toArray();
    },

    async getTransferredCustomers() {
        return await this.db.customers.filter(c => c.transferred_status === true && !c.deleted_at).toArray();
    },

    async getStoppedCustomers() {
        return await this.db.customers.filter(c => c.stopped_status === true && !c.deleted_at).toArray();
    },

    async getCancelledCustomers() {
        return await this.db.customers.filter(c => (c.cancelled_status === true || c.status === 'cancelled') && !c.deleted_at).toArray();
    },

    async searchCustomers(query) {
        const q = query.toLowerCase();
        return await this.db.customers.filter(c => {
            return (c.full_name && c.full_name.toLowerCase().includes(q)) ||
                (c.phone && c.phone.includes(q)) ||
                (c.zalo_phone && c.zalo_phone.includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q));
        }).toArray();
    },

    // ===== PRODUCTS CRUD =====
    async addProduct(product) {
        product.id = Utils.generateId();
        product.created_at = new Date().toISOString();
        product.updated_at = product.created_at;
        product.active_status = product.active_status !== false;
        const result = await this.db.products.add(product);
        this.scheduleSync();
        return result;
    },

    async updateProduct(id, data) {
        data.updated_at = new Date().toISOString();
        const result = await this.db.products.update(id, data);
        this.scheduleSync();
        return result;
    },

    async deleteProduct(id) {
        const result = await this.db.products.update(id, { 
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        this.scheduleSync();
        return result;
    },

    async getProduct(id) {
        return await this.db.products.get(id);
    },

    async getAllProducts() {
        return await this.db.products.filter(p => p.active_status !== false && !p.deleted_at).toArray();
    },

    // ===== ORDERS CRUD =====
    async recalculateCustomerStats(customerId, forceExpiryUpdate = false) {
        const orders = await this.getOrdersByCustomer(customerId);
        let total_orders = orders.length;
        let total_revenue = 0;
        let last_order_date = null;
        let last_product_used = null;
        let estimated_product_end_date = null;
        let last_completed_order_date = null;
        let product_expiries = null;

        const validOrders = [...orders].filter(o => o.order_status !== 'cancelled').sort((a, b) => {
            if (a.order_date !== b.order_date) {
                return a.order_date > b.order_date ? -1 : 1;
            }
            return (b.id || 0) - (a.id || 0);
        });

        if (validOrders.length > 0) {
            last_order_date = validOrders[0].order_date;
            last_product_used = validOrders[0].product_name;
            estimated_product_end_date = validOrders[0].estimated_product_end_date || null;

            product_expiries = {};
            for (const o of validOrders) {
                if (o.estimated_product_end_date && o.product_name) {
                    let baseName = o.product_name.split('-')[0].trim();
                    if (!product_expiries[baseName]) {
                        product_expiries[baseName] = o.estimated_product_end_date;
                    }
                }
            }
        }

        const completedOrders = orders.filter(o => ['completed', 'delivered', 'shipping'].includes(o.order_status)).sort((a, b) => a.order_date > b.order_date ? -1 : 1);
        if (completedOrders.length > 0) {
            last_completed_order_date = completedOrders[0].order_date;
        }

        for (const o of orders) {
            if (['completed', 'delivered', 'shipping'].includes(o.order_status)) {
                total_revenue += (o.total_amount || 0);
            }
        }

        const customer = await this.db.customers.get(customerId);
        let newStatus = undefined;
        if (customer) {
            const currentStatus = customer.status;
            const completedCount = completedOrders.length;

            if (completedCount >= 2) {
                if (['new', 'contacted', 'consulting', 'waiting_close', 'purchased'].includes(currentStatus)) {
                    newStatus = 'repurchased';
                }
            } else if (completedCount === 1) {
                if (['new', 'contacted', 'consulting', 'waiting_close', 'repurchased'].includes(currentStatus)) {
                    newStatus = 'purchased';
                }
            } else if (completedCount === 0) {
                // Hạ cấp trạng thái nếu trước đó là đã mua nhưng tất cả đơn đã bị hủy
                if (['purchased', 'repurchased'].includes(currentStatus)) {
                    newStatus = 'waiting_close';
                }
            }
        }

        const careLogs = await this.getCareLogsByCustomer(customerId);
        let max_contact_date = last_order_date;
        for (const log of careLogs) {
            const isMissedCall = /\b(cnm|knm|chưa nghe máy|không nghe máy)\b/i.test(log.note?.trim() || '');
            if (isMissedCall) continue;

            const d = log.care_date || (log.created_at ? log.created_at.substring(0, 10) : null);
            if (d && (!max_contact_date || d > max_contact_date)) max_contact_date = d;
        }

        // Lấy estimated_product_end_date cũ từ customer để không ghi đè giá trị cập nhật thủ công từ ghi chú (nếu nó lớn hơn giá trị của validOrder cuối)
        let final_end_date = estimated_product_end_date;
        let final_expiry_formula = null;

        if (validOrders.length > 0) {
            const o = validOrders[0];
            if (o.estimated_product_end_date && o.order_date) {
                const p = await this.db.products.get(o.product_id);
                if (p) {
                    const cycle = p.usage_cycle_days || 0;
                    const qty = o.quantity || 1;
                    const totalDays = cycle * qty;
                    final_expiry_formula = `${Utils.formatDate(o.order_date)} Mua ${qty} hộp x${cycle} = ${totalDays} ngày (ngày dự kiến hết sp ${Utils.formatDate(o.estimated_product_end_date)})`;
                }
            }
        }

        if (!forceExpiryUpdate && customer && customer.estimated_product_end_date && estimated_product_end_date) {
            if (customer.estimated_product_end_date > estimated_product_end_date) {
                final_end_date = customer.estimated_product_end_date;
                final_expiry_formula = customer.expiry_formula || null;
            }
        } else if (validOrders.length === 0) {
             final_end_date = null; // Clear if no valid orders
             final_expiry_formula = null;
        } else if (!forceExpiryUpdate && customer && !estimated_product_end_date && customer.estimated_product_end_date) {
             final_end_date = customer.estimated_product_end_date;
             final_expiry_formula = customer.expiry_formula || null;
        }

        let updateData = {
            total_orders,
            total_revenue,
            last_order_date,
            last_product_used,
            estimated_product_end_date: final_end_date,
            expiry_formula: final_expiry_formula,
            product_expiries: product_expiries || null,
            last_completed_order_date: last_completed_order_date || null
        };
        
        if (max_contact_date) {
            updateData.last_contact_date = max_contact_date;
        }

        if (newStatus) {
            updateData.status = newStatus;
        }

        await this.db.customers.update(customerId, {
            ...updateData,
            updated_at: new Date().toISOString()
        });
    },

    async addOrder(order) {
        order.id = Utils.generateId();
        order.created_at = new Date().toISOString();
        order.updated_at = order.created_at;

        const orderId = await this.db.orders.add(order);
        await this.recalculateCustomerStats(order.customer_id, true);

        const careConfig = {
            m1: await this.getSetting('care_milestone_1') !== undefined ? await this.getSetting('care_milestone_1') : 1,
            m2: await this.getSetting('care_milestone_2') !== undefined ? await this.getSetting('care_milestone_2') : 7,
            m3: await this.getSetting('care_milestone_3') !== undefined ? await this.getSetting('care_milestone_3') : 22,
            cycle: await this.getSetting('care_cycle_days') || 30
        };
        const customer = await this.getCustomer(order.customer_id);
        const milestone = Utils.getNextCareMilestone(customer.last_completed_order_date, order.order_date, careConfig, customer.note);
        const nextCareDate = milestone ? milestone.date : Utils.addDays(order.order_date, careConfig.cycle);

        await this.db.customers.update(order.customer_id, {
            last_contact_date: order.order_date,
            next_care_date: nextCareDate,
            overdue_status: false,
            updated_at: new Date().toISOString()
        });

        this.scheduleSync();
        return orderId;
    },

    async updateOrder(id, data) {
        data.updated_at = new Date().toISOString();
        const oldOrder = await this.getOrder(id);
        await this.db.orders.update(id, data);
        if (oldOrder && oldOrder.customer_id) {
            await this.recalculateCustomerStats(oldOrder.customer_id, true);
        }
        this.scheduleSync();
        return true;
    },

    async deleteOrder(id) {
        const oldOrder = await this.getOrder(id);
        await this.db.orders.update(id, { 
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        if (oldOrder && oldOrder.customer_id) {
            await this.recalculateCustomerStats(oldOrder.customer_id, true);
        }
        this.scheduleSync();
        return true;
    },

    async getOrder(id) {
        return await this.db.orders.get(id);
    },

    async getAllOrders() {
        return await this.db.orders.filter(o => !o.deleted_at).toArray();
    },

    async getOrdersByCustomer(customerId) {
        return await this.db.orders.filter(o => o.customer_id == customerId && !o.deleted_at).toArray();
    },

    async getOrdersByDateRange(from, to) {
        return await this.db.orders.filter(o => {
            return o.order_date >= from && o.order_date <= to && !o.deleted_at;
        }).toArray();
    },

    async getOrdersByStatus(status) {
        return await this.db.orders.filter(o => o.order_status === status && !o.deleted_at).toArray();
    },

    // ===== CARE LOGS =====
    async deleteCareLog(id) {
        return await this.db.care_logs.update(id, { 
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    },

    async updateCareLog(id, data) {
        data.updated_at = new Date().toISOString();
        const result = await this.db.care_logs.update(id, data);

        // Nếu nội dung ghi chú thay đổi, chạy lại phân tích từ khóa
        if (data.note !== undefined) {
            const log = await this.db.care_logs.get(id);
            if (log) {
                const intent = await Utils.analyzeKeywordIntent(data.note);
                if (intent === 'STOPPED') {
                    Utils.showToast('Đã tự động chuyển khách hàng vào danh sách Tạm dừng do AI/từ khóa.', 'warning', 5000);
                } else if (intent === 'PRIORITY') {
                    Utils.showToast('AI: Đã đánh dấu Ưu tiên.', 'success');
                } else if (intent === 'NON_PRIORITY') {
                    Utils.showToast('AI: Đã đánh dấu Không ưu tiên.', 'info');
                }

                await this.db.customers.update(log.customer_id, {
                    ...(intent === 'STOPPED' ? { stopped_status: true } : { stopped_status: false }),
                    ...(intent !== 'NONE' ? { keyword_category: intent } : { keyword_category: 'NONE' }),
                    updated_at: new Date().toISOString()
                });
            }
        }

        this.scheduleSync();
        return result;
    },

    async addCareLog(log) {
        log.id = Utils.generateId();
        if (!log.created_at) {
            log.created_at = new Date().toISOString();
        }

        if (log.note) {
            const match = log.note.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{2}:\d{2})/);
            if (match) {
                const [day, month, year] = match[1].split('/');
                const time = match[2];
                const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00.000Z`;
                log.created_at = isoStr;
                log.care_date = isoStr.split('T')[0];
            }
        }

        const logId = await this.db.care_logs.add(log);

        // Cập nhật ngày chăm sóc khách hàng
        const careConfig = {
            m1: await this.getSetting('care_milestone_1') !== undefined ? await this.getSetting('care_milestone_1') : 1,
            m2: await this.getSetting('care_milestone_2') !== undefined ? await this.getSetting('care_milestone_2') : 7,
            m3: await this.getSetting('care_milestone_3') !== undefined ? await this.getSetting('care_milestone_3') : 22,
            cycle: await this.getSetting('care_cycle_days') || 30
        };
        const customer = await this.getCustomer(log.customer_id);

        let intent = 'NONE';
        if (log.note) {
            intent = await Utils.analyzeKeywordIntent(log.note);

            // Lọc Phương án A: Nếu mốc thời gian của note nằm trong quá khứ so với đơn hàng gần nhất
            if (intent === 'STOPPED' && customer.last_completed_order_date && log.care_date) {
                if (log.care_date < customer.last_completed_order_date) {
                    intent = 'NONE';
                    console.log('AI: Bỏ qua từ khóa tạm dừng do ghi chú này cũ hơn đơn hàng gần nhất.');
                }
            }

            if (intent === 'STOPPED') {
                Utils.showToast('Đã tự động chuyển khách hàng vào danh sách Tạm dừng do AI/từ khóa.', 'warning', 5000);
            } else if (intent === 'PRIORITY') {
                Utils.showToast('AI: Đã đánh dấu Ưu tiên.', 'success');
            } else if (intent === 'NON_PRIORITY') {
                Utils.showToast('AI: Đã đánh dấu Không ưu tiên.', 'info');
            }
        }

        const rawNoteText = log.note?.trim() || '';
        const isMissedCall = /\b(cnm|knm|chưa nghe máy|không nghe máy)\b/i.test(rawNoteText);
        const isValidContact = rawNoteText.length > 0 && !isMissedCall;

        if (isValidContact) {
            const milestone = Utils.getNextCareMilestone(customer.last_completed_order_date, log.care_date, careConfig, log.note);
            const nextCareDate = milestone ? milestone.date : Utils.addDays(log.care_date, careConfig.cycle);

            await this.db.customers.update(log.customer_id, {
                last_contact_date: log.care_date,
                next_care_date: nextCareDate,
                overdue_status: false,
                ...(intent === 'STOPPED' ? { stopped_status: true } : {}),
                ...(intent !== 'NONE' ? { keyword_category: intent } : {}),
                updated_at: new Date().toISOString()
            });
        } else {
            if (intent !== 'NONE' || intent === 'STOPPED') {
                await this.db.customers.update(log.customer_id, {
                    ...(intent === 'STOPPED' ? { stopped_status: true } : {}),
                    ...(intent !== 'NONE' ? { keyword_category: intent } : {}),
                    updated_at: new Date().toISOString()
                });
            }
        }

        this.scheduleSync();
        return logId;
    },


    async getCareLogsByCustomer(customerId) {
        return await this.db.care_logs.filter(l => l.customer_id == customerId && !l.deleted_at).toArray().then(logs => {
            return logs.sort((a, b) => {
                const dateA = new Date(a.care_date).getTime();
                const dateB = new Date(b.care_date).getTime();
                if (dateA == dateB) {
                    return new Date(b.created_at || b.care_date).getTime() - new Date(a.created_at || a.care_date).getTime();
                }
                return dateB - dateA;
            });
        });
    },

    async getAllCareLogs() {
        return await this.db.care_logs.filter(l => !l.deleted_at).toArray();
    },

    // ===== APPOINTMENTS =====
    async addAppointment(data) {
        data.created_at = new Date().toISOString();
        if (!data.status) data.status = 'pending';
        const result = await this.db.appointments.add(data);
        this.scheduleSync();
        return result;
    },

    async updateAppointment(id, data) {
        data.updated_at = new Date().toISOString();
        const result = await this.db.appointments.update(id, data);
        this.scheduleSync();
        return result;
    },

    async deleteAppointment(id) {
        const result = await this.db.appointments.update(id, { 
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        this.scheduleSync();
        return result;
    },

    async getAppointmentsByCustomer(customerId) {
        return await this.db.appointments.where('customer_id').equals(customerId).reverse().sortBy('appointment_date');
    },

    // ===== MESSAGE TEMPLATES =====
    async addTemplate(template) {
        template.created_at = new Date().toISOString();
        const result = await this.db.message_templates.add(template);
        this.scheduleSync();
        return result;
    },

    async updateTemplate(id, data) {
        const result = await this.db.message_templates.update(id, data);
        this.scheduleSync();
        return result;
    },

    async deleteTemplate(id) {
        const result = await this.db.message_templates.update(id, { 
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        this.scheduleSync();
        return result;
    },

    async getAllTemplates() {
        return await this.db.message_templates.filter(t => !t.deleted_at).toArray();
    },

    // ===== BACKUP =====
    async exportAllData() {
        const data = {
            version: '1.0',
            exported_at: new Date().toISOString(),
            customers: await this.db.customers.toArray(),
            products: await this.db.products.toArray(),
            orders: await this.db.orders.toArray(),
            care_logs: await this.db.care_logs.toArray(),
            message_templates: await this.db.message_templates.toArray(),
            settings: await this.db.settings.toArray(),
            backup_logs: await this.db.backup_logs.toArray(),
            appointments: await this.db.appointments.toArray()
        };
        return data;
    },

    async importAllData(data, avoidSyncToServer = false) {
        // Validate
        if (!data || !data.version) {
            throw new Error('File backup không hợp lệ');
        }

        await this.db.transaction('rw',
            this.db.customers, this.db.products, this.db.orders,
            this.db.care_logs, this.db.message_templates, this.db.settings,
            this.db.backup_logs, this.db.appointments,
            async () => {
                // Xóa dữ liệu cũ
                await this.db.customers.clear();
                await this.db.products.clear();
                await this.db.orders.clear();
                await this.db.care_logs.clear();
                await this.db.message_templates.clear();
                await this.db.settings.clear();
                await this.db.backup_logs.clear();
                await this.db.appointments.clear();

                // Import dữ liệu mới
                if (data.customers?.length) await this.db.customers.bulkAdd(data.customers);
                if (data.products?.length) await this.db.products.bulkAdd(data.products);
                if (data.orders?.length) await this.db.orders.bulkAdd(data.orders);
                if (data.care_logs?.length) await this.db.care_logs.bulkAdd(data.care_logs);
                if (data.message_templates?.length) await this.db.message_templates.bulkAdd(data.message_templates);
                if (data.settings?.length) await this.db.settings.bulkAdd(data.settings);
                if (data.backup_logs?.length) await this.db.backup_logs.bulkAdd(data.backup_logs);
                if (data.appointments?.length) await this.db.appointments.bulkAdd(data.appointments);
            }
        );

        if (!avoidSyncToServer) {
            this.scheduleSync();
        }
    },

    // ===== HỆ THỐNG ĐỒNG BỘ GOOGLE DRIVE (TỰ ĐỘNG) =====
    _syncTimeout: null,

    scheduleSync() {
        if (this._syncTimeout) clearTimeout(this._syncTimeout);
        this._syncTimeout = setTimeout(() => {
            this._syncTimeout = null;
            this.saveToServer();
        }, 1000); // Đợi 1 giây sau hành động cuối để gửi dữ liệu
    },

    _syncLock: Promise.resolve(),

    async saveToServer(isUnloading = false) {
        try {
            const data = await this.exportAllData();
            const baseTimestamp = await this.getSetting('last_sync_timestamp') || '';
            const res = await fetch('/api/save-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Base-Timestamp': baseTimestamp
                },
                body: JSON.stringify(data),
                keepalive: isUnloading
            });
            if (res.ok) {
                await this.setSetting('last_sync_timestamp', data.exported_at);
                console.log('✅ Đã lưu CSDL vào database.json trên máy.');
            } else {
                console.warn('⚠️ Server save-data returned status:', res.status);
            }
        } catch (e) {
            console.error('❌ Lưu vào database.json thất bại:', e);
        }
    },

    async fixCompletedOrderDates() {
        try {
            const hasRun = localStorage.getItem('fix_completed_order_dates_v1');
            if (hasRun) return;

            const customers = await this.db.customers.toArray();
            for (let c of customers) {
                await this.recalculateCustomerStats(c.id);
            }

            localStorage.setItem('fix_completed_order_dates_v1', 'done');
            console.log("Đã cập nhật last_completed_order_date cho khách hàng cũ.");
        } catch (e) {
            console.error("Lỗi cập nhật last_completed_order_date:", e);
        }
    },

    async syncFromServer() {
        let releaseLock;
        const lockAcquired = new Promise(resolve => releaseLock = resolve);
        const currentLock = this._syncLock;
        this._syncLock = currentLock.then(() => lockAcquired);

        await currentLock;
        try {
            console.log('☁️ Đang đọc dữ liệu từ server database.json...');
            const response = await fetch('/api/get-data');
            if (response.status === 200) {
                const serverData = await response.json();
                if (serverData && serverData.exported_at) {
                    // SILENT MERGE GETFLY_URL
                    if (serverData.customers) {
                        try {
                            const localCusts = await this.db.customers.toArray();
                            let updated = 0;
                            for (let sc of serverData.customers) {
                                if (sc.getfly_url && sc.getfly_url.includes('/view_account/')) {
                                    let lc = localCusts.find(c => c.id === sc.id);
                                    if (lc && lc.getfly_url !== sc.getfly_url) {
                                        await this.db.customers.update(lc.id, { getfly_url: sc.getfly_url });
                                        updated++;
                                    }
                                }
                            }
                            if (updated > 0) {
                                console.log(`🔗 Merged ${updated} full getfly links to local DB!`);
                                if (window.CustomersModule && typeof CustomersModule.renderTable === 'function') {
                                    CustomersModule.loadCustomers();
                                }
                            }
                        } catch (e) {
                            console.error('Silent merge error', e);
                        }
                    }

                    const localCustCount = await this.db.customers.count();
                    const localTimestamp = await this.getSetting('last_sync_timestamp');

                    if (localCustCount === 0 || !localTimestamp || serverData.exported_at > localTimestamp) {
                        console.log(`☁️ Dữ liệu database.json mới hơn hoặc DB cục bộ trống (Server: ${serverData.exported_at}, Local: ${localTimestamp || 'None'}, KH: ${localCustCount}). Đang nạp...`);
                        await this.importAllData(serverData, true);
                        await this.setSetting('last_sync_timestamp', serverData.exported_at);
                        console.log('✅ Đã nạp thành công dữ liệu từ database.json vào trình duyệt.');
                    } else {
                        console.log('☁️ CSDL trình duyệt đã đồng bộ mới nhất.');
                    }
                }
            } else if (response.status === 404) {
                console.log('☁️ Chưa tìm thấy database.json trên server. Tạo bản lưu đầu tiên...');
                await this.saveToServer();
            } else {
                console.warn('☁️ Fetch server database failed with code:', response.status);
            }
        } catch (e) {
            console.error('❌ Fetch from server failed:', e);
        } finally {
            releaseLock();
        }
    },

    async addBackupLog(log) {
        log.backup_date = new Date().toISOString();
        return await this.db.backup_logs.add(log);
    },

    async getBackupLogs() {
        return await this.db.backup_logs.reverse().sortBy('backup_date');
    },

    // ===== STATISTICS / AGGREGATION =====
    async getStats(dateRange) {
        const customers = await this.getActiveCustomers();
        const allOrders = await this.getAllOrders();
        const products = await this.getAllProducts();
        const careCycle = await this.getSetting('care_cycle_days') || 30;
        const commissionRate = await this.getSetting('commission_rate') || 10;
        const today = Utils.today();

        // Filter orders by date range
        const orders = dateRange ?
            allOrders.filter(o => o.order_date >= dateRange.from && o.order_date <= dateRange.to) :
            allOrders;

        const completedOrders = orders.filter(o => o.order_status === 'completed');
        const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const commission = totalRevenue * (commissionRate / 100);

        const careConfig = {
            m1: await this.getSetting('care_milestone_1') !== undefined ? await this.getSetting('care_milestone_1') : 1,
            m2: await this.getSetting('care_milestone_2') !== undefined ? await this.getSetting('care_milestone_2') : 7,
            m3: await this.getSetting('care_milestone_3') !== undefined ? await this.getSetting('care_milestone_3') : 22,
            cycle: await this.getSetting('care_cycle_days') || 30
        };

        // Khách hàng cần chăm sóc
        const overdueCustomers = customers.filter(c => {
            const status = Utils.getCareStatus(c, careConfig);
            return status.status === 'overdue' || status.status === 'never';
        });

        const overdue30Customers = customers.filter(c => {
            if (!c.last_contact_date) return true;
            return Utils.daysAgo(c.last_contact_date) > 30;
        });

        const dueTodayCustomers = customers.filter(c => {
            const status = Utils.getCareStatus(c, careConfig);
            return status.status === 'due' || status.status === 'overdue' || status.status === 'never';
        });

        // Khách hết/sắp hết sản phẩm
        const productRunningOut = customers.filter(c => {
            if (!c.estimated_product_end_date) return false;
            const days = Utils.daysFromNow(c.estimated_product_end_date);
            return days >= 0 && days <= 7;
        });

        const productExpired = customers.filter(c => {
            if (!c.estimated_product_end_date) return false;
            return Utils.daysFromNow(c.estimated_product_end_date) < 0;
            const days = Utils.daysFromNow(c.estimated_product_end_date) < 0;
        });

        // Khách bị chuyển
        const transferred = await this.getTransferredCustomers();

        // Phân loại khách hàng theo trạng thái & tags
        const repurchasedCustomers = customers.filter(c => c.status === 'repurchased');
        const vipCustomers = customers.filter(c => c.status === 'vip');
        const agencyCustomers = customers.filter(c => c.status === 'agency' || (c.tags && c.tags.toLowerCase().includes('đại lý')));

        // Khách mới tháng này
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const newCustomers = customers.filter(c => c.created_at >= monthStart);

        // Tỉ lệ chuyển đổi
        const allCustomersCount = customers.length;
        const purchasedCount = customers.filter(c =>
            ['purchased', 'repurchased', 'vip'].includes(c.status)
        ).length;
        const conversionRate = allCustomersCount > 0 ? ((purchasedCount / allCustomersCount) * 100).toFixed(1) : 0;

        // Đơn hàng theo trạng thái
        const ordersByStatus = {};
        orders.forEach(o => {
            ordersByStatus[o.order_status] = (ordersByStatus[o.order_status] || 0) + 1;
        });

        return {
            totalCustomers: customers.length,
            newCustomers: newCustomers.length,
            dueTodayCustomers,
            overdueCustomers,
            overdue30Customers,
            productRunningOut,
            productExpired,
            transferred,
            repurchasedCustomers,
            vipCustomers,
            agencyCustomers,
            totalRevenue,
            commission,
            conversionRate,
            completedOrders: ordersByStatus.completed || 0,
            cancelledOrders: ordersByStatus.cancelled || 0,
            returnedOrders: ordersByStatus.returned || 0,
            totalOrders: orders.length,
            ordersByStatus,
            products,
            customers,
            orders,
            allOrders,
            careConfig,
            commissionRate
        };
    },

    // ===== SEED DATA (Dữ liệu mẫu) =====
    async seedDemoData() {
        // Sản phẩm thực phẩm chức năng mẫu
        const products = [
            { product_name: 'Fucoidan Nano 4500', product_category: 'fucoidan', price: 1850000, unit_name: 'Hộp', quantity_per_unit: 60, usage_instruction: 'Uống 2 viên/lần, 2 lần/ngày', dosage_per_day: 4, usage_cycle_days: 15, reorder_reminder_days: 3, description: 'Fucoidan chiết xuất từ tảo nâu Okinawa', note: 'Hỗ trợ tăng cường miễn dịch' },
            { product_name: 'Nutri Nano Fucoidan 500g', product_category: 'fucoidan', price: 950000, unit_name: 'Hộp', quantity_per_unit: 30, usage_instruction: 'Uống 1 gói/lần, 2 lần/ngày', dosage_per_day: 2, usage_cycle_days: 15, reorder_reminder_days: 3, description: 'Bột Fucoidan hòa tan', note: 'Dạng bột dễ uống' },
            { product_name: 'Ancan', product_category: 'fucoidan', price: 750000, unit_name: 'Hộp', quantity_per_unit: 60, usage_instruction: 'Uống 2 viên/lần, 2 lần/ngày', dosage_per_day: 4, usage_cycle_days: 15, reorder_reminder_days: 3, description: 'Hỗ trợ phòng ngừa ung thư', note: 'Kết hợp Fucoidan và nấm' },
            { product_name: 'Fucoidan Premium 8', product_category: 'fucoidan', price: 2400000, unit_name: 'Hộp', quantity_per_unit: 120, usage_instruction: 'Uống 4 viên/lần, 2 lần/ngày', dosage_per_day: 8, usage_cycle_days: 15, reorder_reminder_days: 3, description: 'Fucoidan cao cấp 8 thành phần', note: 'Sản phẩm cao cấp nhất' },
            { product_name: 'Vitamin D3 K2 MK7', product_category: 'vitamin', price: 350000, unit_name: 'Lọ', quantity_per_unit: 60, usage_instruction: 'Uống 1 viên/ngày sau ăn', dosage_per_day: 1, usage_cycle_days: 60, reorder_reminder_days: 7, description: 'Bổ sung Vitamin D3 và K2', note: 'Hỗ trợ hấp thu canxi' },
            { product_name: 'Omega 3-6-9 Plus', product_category: 'omega', price: 420000, unit_name: 'Lọ', quantity_per_unit: 90, usage_instruction: 'Uống 1 viên/lần, 3 lần/ngày', dosage_per_day: 3, usage_cycle_days: 30, reorder_reminder_days: 5, description: 'Dầu cá Omega tổng hợp', note: 'Hỗ trợ tim mạch' },
        ];

        for (const p of products) {
            await this.addProduct(p);
        }

        // Khách hàng mẫu
        const sources = ['facebook', 'fanpage', 'zalo', 'tiktok', 'referral', 'livestream', 'event', 'company_data'];
        const statuses = ['new', 'contacted', 'consulting', 'waiting_close', 'purchased', 'repurchased', 'vip'];
        const names = [
            'Nguyễn Thị Hoa', 'Trần Văn Minh', 'Lê Thị Thu', 'Phạm Đức Anh', 'Hoàng Thị Lan',
            'Vũ Minh Tuấn', 'Đặng Thị Mai', 'Bùi Văn Long', 'Ngô Thị Hương', 'Dương Văn Hùng',
            'Lý Thị Ngọc', 'Đinh Văn Tâm', 'Trương Thị Yến', 'Hồ Quang Vinh', 'Phan Thị Diệu',
            'Cao Văn Đạt', 'Tạ Thị Bích', 'Lương Minh Khoa', 'Châu Thị Kim', 'Nguyễn Hữu Toàn',
            'Trần Thị Phương', 'Lê Văn Quý', 'Phạm Thị Ánh', 'Hoàng Đình Phú', 'Vũ Thị Trang',
            'Đỗ Văn Hải', 'Bùi Thị Linh', 'Ngô Quốc Cường', 'Dương Thị Thảo', 'Mai Văn Sơn'
        ];

        const allProducts = await this.getAllProducts();
        const now = new Date();

        for (let i = 0; i < names.length; i++) {
            const phone = `09${(10000000 + Math.floor(Math.random() * 90000000)).toString().substring(0, 8)}`;
            const daysAgo = Math.floor(Math.random() * 90);
            const lastContact = new Date(now);
            lastContact.setDate(lastContact.getDate() - daysAgo);
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const source = sources[Math.floor(Math.random() * sources.length)];

            const customerId = await this.addCustomer({
                full_name: names[i],
                phone: phone,
                zalo_phone: phone,
                email: `${names[i].toLowerCase().replace(/\s+/g, '.').normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@email.com`,
                address: `Số ${Math.floor(Math.random() * 200)}, Quận ${Math.floor(Math.random() * 12) + 1}, TP.HCM`,
                customer_source: source,
                status: status,
                tags: status === 'vip' ? 'VIP' : '',
                note: i % 5 === 0 ? 'Khách quan tâm combo ưu đãi, hẹn gọi lại tuần sau' :
                    i % 4 === 0 ? 'Cần tư vấn thêm về sản phẩm Fucoidan' :
                        i % 3 === 0 ? 'Khách hỏi giá combo 3 sản phẩm' : '',
                last_contact_date: lastContact.toISOString().split('T')[0],
                next_care_date: Utils.addDays(lastContact.toISOString().split('T')[0], 30),
                care_cycle_days: 30
            });

            // Tạo đơn hàng cho khách đã mua
            if (['purchased', 'repurchased', 'vip'].includes(status)) {
                const product = allProducts[Math.floor(Math.random() * allProducts.length)];
                const qty = Math.floor(Math.random() * 3) + 1;
                const orderDate = new Date(now);
                orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 60));
                const endDate = Utils.addDays(orderDate.toISOString().split('T')[0], product.usage_cycle_days * qty);

                await this.addOrder({
                    customer_id: customerId,
                    product_id: product.id,
                    product_name: product.product_name,
                    order_date: orderDate.toISOString().split('T')[0],
                    quantity: qty,
                    unit_price: product.price,
                    discount: Math.random() > 0.7 ? Math.floor(product.price * qty * 0.05) : 0,
                    total_amount: product.price * qty - (Math.random() > 0.7 ? Math.floor(product.price * qty * 0.05) : 0),
                    order_status: 'completed',
                    estimated_product_end_date: endDate,
                    cancel_reason: '',
                    note: ''
                });

                // Đơn hàng thứ 2 cho khách mua lại
                if (status === 'repurchased' || status === 'vip') {
                    const p2 = allProducts[Math.floor(Math.random() * allProducts.length)];
                    const od2 = new Date(now);
                    od2.setDate(od2.getDate() - Math.floor(Math.random() * 30));
                    await this.addOrder({
                        customer_id: customerId,
                        product_id: p2.id,
                        product_name: p2.product_name,
                        order_date: od2.toISOString().split('T')[0],
                        quantity: 1,
                        unit_price: p2.price,
                        discount: 0,
                        total_amount: p2.price,
                        order_status: Math.random() > 0.8 ? 'cancelled' : 'completed',
                        estimated_product_end_date: Utils.addDays(od2.toISOString().split('T')[0], p2.usage_cycle_days),
                        cancel_reason: '',
                        note: ''
                    });
                }
            }
        }

        // Mẫu tin nhắn
        const templates = [
            { template_name: 'Chào khách mới', content: 'Chào {{ten_khach}} ạ! Em là [Tên sales], cảm ơn anh/chị đã quan tâm đến sản phẩm bên em. Em có thể tư vấn thêm cho anh/chị về {{san_pham}} được không ạ? 😊' },
            { template_name: 'Nhắc sắp hết SP', content: 'Chào {{ten_khach}} ạ! Em thấy sản phẩm {{san_pham}} của anh/chị sắp dùng hết rồi ạ. Anh/chị có muốn em đặt thêm cho đợt tiếp theo không ạ? Hiện bên em đang có ưu đãi đặc biệt cho khách hàng mua lại ạ! 🎁' },
            { template_name: 'Chăm sóc định kỳ', content: 'Chào {{ten_khach}} ạ! Lâu quá không liên hệ, em muốn hỏi thăm anh/chị sức khỏe dạo này thế nào ạ? Sản phẩm {{san_pham}} anh/chị dùng có hiệu quả tốt không ạ? Em luôn sẵn sàng hỗ trợ anh/chị ạ! 💚' },
            { template_name: 'Cảm ơn mua hàng', content: 'Cảm ơn {{ten_khach}} đã tin tưởng và đặt hàng ạ! Đơn hàng của anh/chị đã được xác nhận. Em sẽ cập nhật tình trạng giao hàng cho anh/chị sớm nhất ạ! 📦✨' },
            { template_name: 'Giới thiệu combo', content: 'Chào {{ten_khach}} ạ! Bên em hiện có combo ưu đãi đặc biệt dành cho khách hàng thân thiết: [Tên combo]. Giá gốc [Giá gốc], nay chỉ còn [Giá ưu đãi]. Anh/chị có quan tâm không ạ? 🌟' }
        ];

        for (const t of templates) {
            await this.addTemplate(t);
        }

        console.log('✅ Demo data seeded successfully');
    },

    // ===== Xóa toàn bộ dữ liệu =====
    async clearAllData() {
        await this.db.customers.clear();
        await this.db.products.clear();
        await this.db.orders.clear();
        await this.db.care_logs.clear();
        await this.db.message_templates.clear();
        await this.db.backup_logs.clear();
        // Giữ settings
        console.log('🗑️ All data cleared');
        this.scheduleSync();
    },

    // ===== AI SESSIONS =====
    async saveAiSession(sessionData) {
        sessionData.created_at = new Date().toISOString();
        return await this.db.ai_sessions.add(sessionData);
    },

    async getAiSessions() {
        return await this.db.ai_sessions.orderBy('timestamp').reverse().toArray();
    },

    async getAiSession(id) {
        return await this.db.ai_sessions.get(id);
    },

    async updateAiSessionAction(sessionId, actionIndex, completed) {
        const session = await this.getAiSession(sessionId);
        if (session && session.action_items && session.action_items[actionIndex]) {
            session.action_items[actionIndex].completed = completed;
            await this.db.ai_sessions.put(session);
        }
    },

    // ===== AI ANALYSIS HISTORY (Local Only) =====
    async saveAiAnalysisHistory(data) {
        data.created_at = new Date().toISOString();
        return await this.db.ai_analysis_history.add(data);
    },

    async getAiAnalysisHistory() {
        return await this.db.ai_analysis_history.orderBy('created_at').reverse().toArray();
    }
};
