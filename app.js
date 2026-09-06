/* ===================================================================
 CRM MINI — MAIN APPLICATION CORE
   Khởi tạo, định tuyến (Routing), quản lý UI shell (Sidebar, Theme)
   =================================================================== */

const App = {
    currentPage: 'dashboard',
    isInitialized: false,

    async init() {
        try {
            // 1. Chờ khởi tạo Database
            document.getElementById('loading-text').textContent = 'Khởi tạo cơ sở dữ liệu...';
            if (!DB.db) {
                await DB.init();
            }

            // Force reload from cloud ONCE to fix Dexie cache
            const forcedSync = localStorage.getItem('force_sync_v5');
            if (!forcedSync) {
                // Clear all indexedDB to force a clean slate from server
                console.log('Forcing clean sync... deleting old data');
                await DB.db.delete();
                await DB.db.open();
                localStorage.setItem('force_sync_v5', 'done');
            }

            // Đảm bảo dữ liệu từ database.json được nạp đầy đủ nếu DB trống
            const currentCustCount = await DB.db.customers.count();
            if (currentCustCount === 0) {
                console.log('DB trống, đang nạp dữ liệu từ server database.json...');
                await DB.syncFromServer();
            }

            // Tự động cập nhật sản phẩm Ancan theo giá tiền
            const ancanUpdated = localStorage.getItem('ancan_updated_v1');
            if (!ancanUpdated) {
                const promotions = {
                    1250000: "Ancan - Mua 1 hộp",
                    3750000: "Ancan - Mua 3 hộp tặng 1 hộp",
                    7500000: "Ancan - Mua 6 hộp tặng 3 hộp",
                    12500000: "Ancan - Mua 10 hộp tặng 6 hộp",
                    18750000: "Ancan - 15 tặng 17",
                    22500000: "Ancan - 18 tặng 20",
                    25000000: "Ancan - Mua 20 tặng 22",
                    37500000: "Ancan - Mua 30 tặng 35",
                    40000000: "Ancan - 80 hộp"
                };
                const allOrders = await DB.db.orders.toArray();
                let ancanCount = 0;
                for (const order of allOrders) {
                    if (promotions[order.total_amount] && order.product_name !== promotions[order.total_amount]) {
                        await DB.db.orders.update(order.id, { product_name: promotions[order.total_amount] });
                        ancanCount++;
                    }
                }
                localStorage.setItem('ancan_updated_v1', 'done');
                if (ancanCount > 0) {
                    console.log(`Đã cập nhật tự động ${ancanCount} đơn hàng Ancan.`);
                    Utils.showToast(`Hệ thống đã tự động tìm thấy và cập nhật ${ancanCount} đơn hàng có tổng tiền trùng khớp với Bảng giá Ancan!`, 'success');
                    setTimeout(() => location.reload(), 2000);
                    return; // Dừng khởi tạo để reload trang cập nhật UI
                }
            }

            // Tự động cập nhật sản phẩm Fu 8 theo giá tiền
            const fu8Updated = localStorage.getItem('fu8_updated_v1');
            if (!fu8Updated) {
                const promotions = {
                    2680000: "Fu 8 - Mua 1 hộp",
                    8040000: "Fu 8 - Mua 3 hộp tặng 1 hộp",
                    13400000: "Fu 8 - Mua 5 hộp tặng 3 hộp",
                    21440000: "Fu 8 - Mua 8 hộp tặng 6 hộp",
                    26800000: "Fu 8 - Mua 10 tặng 8"
                };
                const allOrders = await DB.db.orders.toArray();
                let fu8Count = 0;
                for (const order of allOrders) {
                    if (promotions[order.total_amount] && order.product_name !== promotions[order.total_amount]) {
                        await DB.db.orders.update(order.id, { product_name: promotions[order.total_amount] });
                        fu8Count++;
                    }
                }
                localStorage.setItem('fu8_updated_v1', 'done');
                if (fu8Count > 0) {
                    console.log(`Đã cập nhật tự động ${fu8Count} đơn hàng Fu 8.`);
                    Utils.showToast(`Hệ thống đã tự động tìm thấy và cập nhật ${fu8Count} đơn hàng có tổng tiền trùng khớp với Bảng giá Fu 8!`, 'success');
                    setTimeout(() => location.reload(), 2000);
                    return; // Dừng khởi tạo để reload trang cập nhật UI
                }
            }

            // Tự động cập nhật sản phẩm Fucoidan Nano theo giá tiền
            const fucoidanNanoUpdated = localStorage.getItem('fucoidan_nano_updated_v1');
            if (!fucoidanNanoUpdated) {
                const promotions = {
                    9600000: "Fucoidan Nano - Mua 1 hộp",
                    19200000: "Fucoidan Nano - Mua 2 hộp tặng 1 hộp",
                    28800000: "Fucoidan Nano - Mua 3 hộp tặng 3 hộp",
                    48000000: "Fucoidan Nano - Mua 5 hộp tặng 6 hộp",
                    96000000: "Fucoidan Nano - Mua 10 hộp tặng 14 hộp"
                };
                const allOrders = await DB.db.orders.toArray();
                let fucoidanCount = 0;
                for (const order of allOrders) {
                    if (promotions[order.total_amount] && order.product_name !== promotions[order.total_amount]) {
                        await DB.db.orders.update(order.id, { product_name: promotions[order.total_amount] });
                        fucoidanCount++;
                    }
                }
                localStorage.setItem('fucoidan_nano_updated_v1', 'done');
                if (fucoidanCount > 0) {
                    console.log(`Đã cập nhật tự động ${fucoidanCount} đơn hàng Fucoidan Nano.`);
                    Utils.showToast(`Hệ thống đã tự động tìm thấy và cập nhật ${fucoidanCount} đơn hàng có tổng tiền trùng khớp với Bảng giá Fucoidan Nano!`, 'success');
                    setTimeout(() => location.reload(), 2000);
                    return; // Dừng khởi tạo để reload trang cập nhật UI
                }
            }

            // Tự động tính toán lại hạn dùng sản phẩm theo lô (product_expiries)
            const expiriesFixed = localStorage.getItem('expiries_fixed_v3');
            if (!expiriesFixed) {
                console.log('Recalculating stats for all customers to update product expiries...');
                const allCustomers = await DB.db.customers.toArray();
                for (const c of allCustomers) {
                    await DB.recalculateCustomerStats(c.id);
                }
                localStorage.setItem('expiries_fixed_v3', 'done');
                console.log('Done recalculating stats.');
            }

            // ONE-TIME FIX FOR HUONG HOANG NOTE
            const hhNoteFixed = localStorage.getItem('hh_note_fixed_v1');
            if (!hhNoteFixed) {
                const noteText = `Hà Giang Fucoidan - 18/06/2026 15:26
Chị đang bận lúc khác nhé

Hà Giang Fucoidan - 11/05/2026 10:05
Giao thành công . Đã gửi hướng dẫn sử dụng qua zalo

Hà Giang Fucoidan - 09/05/2026 13:51
Chị phổi vẫn hơi khó thở. Chị hỏi lại thông tin sản phẩm và chương trình ưu đãi. Đã gt chị chương trình ưu đãi, tư vấn chị dùng dài hạn nên lấy 13t9. Chị muốn tặng thêm 1 1 hộp đường mía. Đã tư vấn lại chị. Vậy chị mua thêm 1 hộp đường mía hà thủ ô gửi kèm cho chị

Hà Giang Fucoidan - 08/05/2026 08:47
Chị xử lý xong rồi nhưng giờ đang đi xe máy trên đường. Để lúc khác

Hà Giang Fucoidan - 07/05/2026 10:31 (Đã chỉnh sửa)
Chị tìm ko thấy số của em. Chị đặt nhầm bên khác. Đặt xong mới nhớ ra zalo Hà Giang. Đã tư vấn lại chị. Chờ chị xử lý bên kia đã

Hà Giang Fucoidan - 07/05/2026 09:51
Chị đang đi chùa lát gọi lại

Nguyễn Đoàn - 07/05/2026 09:27
kh để tt

Hà Giang Fucoidan.

Hà Giang Fucoidan - 03/04/2026 16:39 (Đã chỉnh sửa)
Ngày 2 cốc, sáng uống 1 cốc tam thất đi tập thể dục về uống thực dưỡng sau đó đói đói lại ăn 1 cái gì đó. Chiều sau ăn. Chị sau mổ đang cần phục hồi. Uống ngon. Mua trộm ông chồng, uông biết uống ông nói mua linh tinh trên mạng

Hà Giang Fucoidan - 21/03/2026 17:11
Chị chưa dùng bao giờ lấy 2t1 dùng thử thôi. Đã tư vấn lại chị. Chị lấy 6t3

Hà Giang Fucoidan - 21/03/2026 15:21
Đang đi xe máy nhé. Tối gọi lại

Hà Giang Fucoidan - 20/03/2026 15:39
Bác Hà đi có việc rồi ạ. Lát chú gọi lại

Hà Giang Fucoidan - 19/03/2026 14:07
chị 56 tuổi, ung thư phổi, bị mổ 3 tháng, cắt bỏ. Bs bảo truyền hóa chất hỗ trợ chị sợ yếu ko truyền. Về nhà uống lá linh tinh hoa đu đủ. Ăn được, ngủ kém. Không ăn nhiều. Chị Ăn chay. Gửi thông tin zalo chị tìm hiểu thêm

Hà Giang Fucoidan - 19/03/2026 13:35
Đúng rồi nhưng cô đang bận. 1 tiếng nữa gọi lại nhé

Quang Đức - 19/03/2026 12:05
a gọi kh nhé

Hà Giang Fucoidan.

Quang Đức - 19/03/2026 11:43`;
                
                let hhCustomer = await DB.db.customers.where('phone').equals('0984757580').first();
                if (hhCustomer) {
                    hhCustomer.note = noteText;
                    await DB.db.customers.put(hhCustomer);
                } else {
                    hhCustomer = {
                        full_name: 'Hương Hoàng',
                        phone: '0984757580',
                        note: noteText,
                        created_at: new Date().toISOString(),
                        last_contact_date: new Date().toISOString(),
                        status: 'lead'
                    };
                    await DB.db.customers.add(hhCustomer);
                }
                localStorage.setItem('hh_note_fixed_v1', 'done');
                console.log('Fixed note for Hương Hoàng 0984757580');
                Utils.showToast('Đã cập nhật thông tin khách hàng Hương Hoàng 0984757580', 'success');
            }

            // ONE-TIME FIX FOR HUONG HOANG EXCEL V3
            const hhExcelFixed = localStorage.getItem('hh_excel_fixed_v3');
            if (!hhExcelFixed) {
                let hhCustomer = await DB.db.customers.where('phone').equals('0984757580').first();
                if (hhCustomer) {
                    hhCustomer.address = "thôn Nghĩa Lộ - Võng Xuyên - Phúc Thọ - Hà Nội";
                    await DB.db.customers.put(hhCustomer);
                } else {
                    // This shouldn't happen anymore since the first script created it, but just in case
                    hhCustomer = {
                        full_name: 'Hương Hoàng',
                        phone: '0984757580',
                        address: "thôn Nghĩa Lộ - Võng Xuyên - Phúc Thọ - Hà Nội",
                        created_at: new Date().toISOString(),
                        last_contact_date: new Date().toISOString(),
                        status: 'lead'
                    };
                    const newId = await DB.db.customers.add(hhCustomer);
                    hhCustomer.id = newId;
                }
                
                const existingOrder = await DB.db.orders.where({
                    customer_id: hhCustomer.id,
                    order_date: "2026-05-30"
                }).first();
                
                if (!existingOrder) {
                    await DB.db.orders.add({
                        customer_id: hhCustomer.id,
                        product_name: "Fu 8",
                        order_date: "2026-05-30",
                        order_status: "completed",
                        total_amount: 5360000,
                        quantity: 2, 
                        created_at: new Date().toISOString()
                    });
                    
                    await DB.db.care_logs.add({
                        customer_id: hhCustomer.id,
                        care_date: "2026-05-30",
                        care_type: "Khác",
                        note: "Đơn ghép 3t1 tháng sau lấy nốt 2 hộp - CNM",
                        created_at: new Date().toISOString()
                    });
                } else {
                    // Cập nhật lại số tiền nếu đơn hàng đã tồn tại nhưng sai giá trị
                    await DB.db.orders.update(existingOrder.id, {
                        total_amount: 5360000,
                        quantity: 2,
                        product_name: "Fu 8",
                        order_status: "completed"
                    });
                }
                
                // Đồng thời tính toán lại tổng doanh thu của khách hàng để đồng bộ
                const allOrders = await DB.db.orders.where({ customer_id: hhCustomer.id, order_status: 'completed' }).toArray();
                const totalRevenue = allOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
                await DB.db.customers.update(hhCustomer.id, { total_revenue: totalRevenue });
                
                localStorage.setItem('hh_excel_fixed_v3', 'done');
                console.log('Fixed Excel data for Hương Hoàng 0984757580 (V3)');
            }

            // Tự động dọn dẹp các sản phẩm bị lỗi hiển thị "nan"
            const nanCleaned = localStorage.getItem('nan_cleaned_v1');
            if (!nanCleaned) {
                const allOrders = await DB.db.orders.toArray();
                let cleanCount = 0;
                for (const order of allOrders) {
                    if (order.product_name === 'nan' || order.product_name === null || order.product_name === undefined) {
                        await DB.db.orders.update(order.id, { product_name: 'Sản phẩm chưa rõ' });
                        cleanCount++;
                    }
                }
                localStorage.setItem('nan_cleaned_v1', 'done');
                if (cleanCount > 0) {
                    console.log(`Đã tự động sửa ${cleanCount} đơn hàng bị lỗi tên sản phẩm.`);
                    Utils.showToast(`Hệ thống đã tự động tìm và sửa lỗi tên sản phẩm cho ${cleanCount} đơn hàng.`, 'success');
                    setTimeout(() => location.reload(), 2000);
                    return; // Dừng khởi tạo để reload trang cập nhật UI
                }
            }

            // Tự động chuẩn hóa tên sản phẩm (HYBRID MECHANISM)
            const hybridMigration = localStorage.getItem('hybrid_product_migration_v3');
            if (!hybridMigration) {
                const allOrders = await DB.db.orders.toArray();
                let fixCount = 0;
                for (const order of allOrders) {
                    const finalName = await Utils.determineOrderProductName(order);
                    if (finalName !== order.product_name) {
                        await DB.db.orders.update(order.id, { product_name: finalName });
                        fixCount++;
                    }
                }
                localStorage.setItem('hybrid_product_migration_v3', 'done');
                if (fixCount > 0) {
                    console.log(`Đã chuẩn hóa tự động ${fixCount} đơn hàng theo cơ chế Hybrid.`);
                    Utils.showToast(`Hệ thống đã chuẩn hóa tự động ${fixCount} đơn hàng!`, 'success');
                    setTimeout(() => location.reload(), 2000);
                    return; // Dừng khởi tạo để reload trang cập nhật UI
                }
            }

            // 1.5 Đồng bộ dữ liệu ngầm (Chạy ngầm)
            setTimeout(async () => {
                try {
                    const allCustomers = await DB.db.customers.toArray();
                    let updatedPhones = 0;
                    for (const c of allCustomers) {
                        // Đồng bộ doanh số
                        await DB.recalculateCustomerStats(c.id);
                        
                        // Chuẩn hóa số điện thoại
                        let changed = false;
                        let newPhone = c.phone;
                        let newZalo = c.zalo_phone;
                        
                        if (c.phone && c.phone.length >= 15 && !c.phone.includes('/')) {
                            newPhone = Utils.formatPhone(c.phone);
                            if (newPhone !== c.phone) changed = true;
                        }
                        if (c.zalo_phone && c.zalo_phone.length >= 15 && !c.zalo_phone.includes('/')) {
                            newZalo = Utils.formatPhone(c.zalo_phone);
                            if (newZalo !== c.zalo_phone) changed = true;
                        }
                        
                        if (changed) {
                            await DB.db.customers.update(c.id, { phone: newPhone, zalo_phone: newZalo });
                            updatedPhones++;
                        }
                    }
                    console.log(`Đã đồng bộ doanh số. Chuẩn hóa ${updatedPhones} SĐT.`);
                                        } catch (e) { console.error('Lỗi đồng bộ ngầm:', e); }
            }, 1000);

            // 2. Khởi tạo Theme
            document.getElementById('loading-text').textContent = 'Tải giao diện...';
            const savedTheme = await DB.getSetting('theme') || 'dark';
            this.setTheme(savedTheme, false); // Không lưu lại vì vừa đọc ra

            // 3. Khởi tạo sự kiện toàn cục
            this.initEvents();

            // 4. Khởi tạo sự kiện cho từng Module
            CustomersModule.initEvents();
            ProductsModule.initEvents();
            OrdersModule.initEvents();
            CareModule.initEvents();
            if (typeof StoppedModule !== 'undefined' && StoppedModule.initEvents) StoppedModule.initEvents();
            if (typeof CancelledModule !== 'undefined' && CancelledModule.initEvents) CancelledModule.initEvents();
            if (typeof TransferredModule !== 'undefined' && TransferredModule.initEvents) TransferredModule.initEvents();
            ZaloModule.initEvents();
            DashboardModule.initEvents();
            RevenueModule.initEvents();
            ChartsModule.initEvents();
            AiAnalysisModule.initEvents();
            BackupModule.initEvents();
            SettingsModule.initEvents();
            PromotionsModule.initEvents();
            CoVanAiModule.initEvents();
            DrilldownModule.initEvents();
            if (typeof RemediesModule !== 'undefined' && RemediesModule.init) RemediesModule.init();


            // 5. Xử lý Routing từ URL Hash
            const urlParams = new URLSearchParams(window.location.search);
            const routeCustomerId = urlParams.get('customer_id');
            if (routeCustomerId) {
                CustomersModule.currentViewingId = parseInt(routeCustomerId);
                // Cập nhật hash không kích hoạt sự kiện nếu hash đã giống
                if (window.location.hash !== '#customer-detail') {
                    window.location.hash = 'customer-detail';
                } else {
                    this.handleRoute();
                }
            } else {
                this.handleRoute();
            }
            
            window.addEventListener('hashchange', () => this.handleRoute());

            // Hoàn tất tải trang
            setTimeout(() => {
                const appEl = document.getElementById('app');
                if (appEl) appEl.style.display = 'flex';
                document.getElementById('loading-screen').classList.add('hidden');
                App.isInitialized = true;
            }, 500);

        } catch (err) {
            console.error('Initialization failed:', err);
            alert('Lỗi khởi tạo hệ thống: ' + (err.message || err.toString()));
            // Hide loading screen anyway so they can see the app (even if broken)
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) loadingScreen.classList.add('hidden');
        }
    },

    // ===== ROUTING & NAVIGATION =====
    handleRoute() { console.log('viewCustomer called with', CustomersModule.currentViewingId);
        const hash = window.location.hash.substring(1);
        let targetPage = hash;

        // Xử lý mặc định hoặc route không hợp lệ
        if (!targetPage) targetPage = 'dashboard';
        const pageEl = document.getElementById(`page-${targetPage}`);

        if (!pageEl) {
            console.warn(`Route not found: ${targetPage}, fallback to dashboard`);
            targetPage = 'dashboard';
        }

        this.navigateTo(targetPage, false);
    },

    async navigateTo(pageId, changeHash = true) {
        if (changeHash) {
            window.location.hash = pageId;
            return; // hashchange event sẽ gọi lại handleRoute
        }

        this.currentPage = pageId;

        // 1. Cập nhật Sidebar UI
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[href="#${pageId}"]`);
        if (activeLink) activeLink.classList.add('active');

        // 2. Chuyển đổi hiển thị Page Container
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) targetPage.classList.add('active');

        // 3. Đóng mobile menu nếu đang mở
        document.querySelector('.sidebar').classList.remove('mobile-open');

        // 4. Cập nhật tiêu đề Topbar
        const titles = {
            dashboard: 'Tổng quan',
            customers: 'Khách hàng',
            'customer-detail': 'Chi tiết khách hàng',
            products: 'Sản phẩm',
            orders: 'Đơn hàng',
            care: 'Chăm sóc',
            stopped: 'Khách hàng Tạm dừng',
            cancelled: 'Khách hàng Hủy/hoàn',
            zalo: 'Mẫu Zalo',
            revenue: 'Doanh số',
            charts: 'Báo cáo biểu đồ',
            ai: 'AI Phân tích',
            backup: 'Dữ liệu',
            settings: 'Cài đặt',
            promotions: 'Chương trình ưu đãi',
            drilldown: 'Chi tiết danh sách',
            remedies: 'Bài thuốc hay'
        };
        const titleEl = document.getElementById('page-title');
        if (titleEl && titles[pageId]) titleEl.textContent = titles[pageId];

        // 5. Gọi hàm render của module tương ứng
        try {
            switch (pageId) {
                case 'dashboard': await DashboardModule.render(); break;
                case 'customers': await CustomersModule.render(); break;
                case 'customer-detail': 
                    if (CustomersModule.currentViewingId) {
                        await CustomersModule.renderCustomerDetailPage(CustomersModule.currentViewingId);
                    } else {
                        App.navigateTo('customers');
                    }
                    break;
                case 'products': await ProductsModule.render(); break;
                case 'orders': await OrdersModule.render(); break;
                case 'care': await CareModule.render(); break;
                case 'stopped': await StoppedModule.render(); break;
                case 'cancelled': await CancelledModule.render(); break;
                case 'transferred': await TransferredModule.render(); break;
                case 'zalo': await ZaloModule.render(); break;
                case 'revenue': await RevenueModule.render(); break;
                case 'charts': await ChartsModule.renderChartsPage(); break;
                case 'ai-history': await AiHistoryModule.render(); break;
                case 'ai': /* UI tĩnh, không cần render DB nếu chưa click */ break;
                case 'backup': await BackupModule.render(); break;
                case 'settings': await SettingsModule.render(); break;
                case 'promotions': await PromotionsModule.render(); break;
                case 'remedies': await RemediesModule.render(); break;
                // drilldown tự render khi được gọi từ Dashboard/Charts
            }
        } catch (err) {
            console.error(`Error rendering page ${pageId}:`, err);
            Utils.showToast('Lỗi khi tải dữ liệu: ' + err.message, 'error');
        }
    },

    // ===== THEME MANAGEMENT =====
    async setTheme(themeName, saveToDb = true) {
        document.documentElement.setAttribute('data-theme', themeName);
        const toggleIcon = document.getElementById('theme-icon');
        const toggleText = document.getElementById('theme-text');
        
        if (themeName === 'light') {
            if (toggleIcon) toggleIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
            if (toggleText) toggleText.textContent = 'Chế độ tối';
        } else {
            if (toggleIcon) toggleIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
            if (toggleText) toggleText.textContent = 'Chế độ sáng';
        }

        if (saveToDb) {
            await DB.setSetting('theme', themeName);
        }

        // Cập nhật lại biểu đồ nếu đang ở trang có biểu đồ
        if (['dashboard', 'charts', 'revenue'].includes(this.currentPage)) {
            // Đợi CSS transition chạy xong mới render lại chart
            setTimeout(() => {
                if (this.currentPage === 'dashboard') DashboardModule.render();
                if (this.currentPage === 'charts') ChartsModule.renderChartsPage();
                if (this.currentPage === 'revenue') RevenueModule.render();
            }, 300);
        }
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    },

    // ===== UI EVENTS =====
    initEvents() {
        // Toggle Sidebar thu gọn (Desktop)
        document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('collapsed');
            // Cập nhật lại biểu đồ khi resize
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 300);
        });

        // Toggle Mobile Menu
        document.getElementById('btn-mobile-menu')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('mobile-open');
        });

        // Toggle Theme
        document.getElementById('btn-theme-toggle')?.addEventListener('click', () => this.toggleTheme());

        // Quick Add Menu
        const quickAddBtn = document.getElementById('btn-quick-add');
        const quickAddMenu = document.getElementById('quick-add-menu');
        
        if (quickAddBtn && quickAddMenu) {
            quickAddBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                quickAddMenu.style.display = quickAddMenu.style.display === 'block' ? 'none' : 'block';
            });
            
            document.addEventListener('click', () => {
                quickAddMenu.style.display = 'none';
            });
        }

        // Quick Add Actions
        document.getElementById('quick-add-customer')?.addEventListener('click', (e) => { e.preventDefault(); CustomersModule.showForm(); });
        document.getElementById('quick-add-order')?.addEventListener('click', (e) => { e.preventDefault(); OrdersModule.showForm(); });
        document.getElementById('quick-add-product')?.addEventListener('click', (e) => { e.preventDefault(); ProductsModule.showForm(); });
        document.getElementById('quick-add-template')?.addEventListener('click', (e) => { e.preventDefault(); ZaloModule.showTemplateForm(); });

        // Search global focus (chỉ placeholder cho UI shell)
        document.getElementById('global-search')?.addEventListener('focus', () => {
            if (this.currentPage !== 'customers') {
                App.navigateTo('customers');
                setTimeout(() => document.getElementById('customer-search')?.focus(), 100);
            }
        });

        // Tự động mở lịch (Date Picker native) khi click vào bất kỳ ô nhập ngày nào
        document.addEventListener('click', (e) => {
            if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'date') {
                try {
                    if (typeof e.target.showPicker === 'function') {
                        e.target.showPicker();
                    }
                } catch (err) {
                    // Ignore (often triggered when calendar is already open)
                }
            }
        });
    }
};

// Khởi chạy ứng dụng khi DOM tải xong
document.addEventListener('DOMContentLoaded', async () => {
    // Luôn khởi tạo DB trước để tránh lỗi null
    if (typeof DB !== 'undefined' && !DB.db) {
        await DB.init();
    }
    
    // Luôn khởi chạy App để giao diện và dữ liệu database.json hiển thị ngay lập tức
    await App.init();
    
    // Nếu có SupabaseSync, khởi tạo chạy ngầm
    if (typeof SupabaseSync !== 'undefined') {
        try {
            await SupabaseSync.init();

            // Tự động sửa dữ liệu tháng 7 và đẩy lên Supabase thông qua hook (chạy 1 lần)
            const supabaseFix = localStorage.getItem('supabase_fix_july_v4');
            if (!supabaseFix && SupabaseSync.isConnected) {
                console.log('Running Supabase data fix for July data and pushing to cloud...');
                try {
                    // Sửa trạng thái đơn hàng in hoa thành in thường
                    const allOrders = await DB.db.orders.toArray();
                    for (const o of allOrders) {
                        if (o.order_status === 'COMPLETED' || o.order_status === 'DELIVERED' || o.order_status === 'SHIPPING') {
                            const newStatus = o.order_status.toLowerCase();
                            await DB.updateOrder(o.id, { order_status: newStatus }); // Use updateOrder to push
                        }
                    }

                    // Sửa lỗi thiếu Getfly URL
                    const phoneToUrl = {"0357847334": "https://fucoidan2026.getflycrm.com/#/crm/view_account/142238", "0949134168": "https://fucoidan2026.getflycrm.com/#/crm/view_account/247916", "0908710767": "https://fucoidan2026.getflycrm.com/#/crm/view_account/248220", "0338133542": "https://fucoidan2026.getflycrm.com/#/crm/view_account/248067", "0867279359": "https://fucoidan2026.getflycrm.com/#/crm/view_account/215302", "0967482779": "https://fucoidan2026.getflycrm.com/#/crm/view_account/248010", "0989329989": "https://fucoidan2026.getflycrm.com/#/crm/view_account/91909", "0346086477": "https://fucoidan2026.getflycrm.com/#/crm/view_account/218023", "0367759386": "https://fucoidan2026.getflycrm.com/#/crm/view_account/242992", "0916056444": "https://fucoidan2026.getflycrm.com/#/crm/view_account/243366", "0965089064": "https://fucoidan2026.getflycrm.com/#/crm/view_account/247700", "0974166788": "https://fucoidan2026.getflycrm.com/#/crm/view_account/194682", "0981564614": "https://fucoidan2026.getflycrm.com/#/crm/view_account/247465", "0907242660": "https://fucoidan2026.getflycrm.com/#/crm/view_account/52420", "0963707799": "https://fucoidan2026.getflycrm.com/#/crm/view_account/39200", "0393236459": "https://fucoidan2026.getflycrm.com/#/crm/view_account/60669", "0913570703": "https://fucoidan2026.getflycrm.com/#/crm/view_account/176294", "0776497393": "https://fucoidan2026.getflycrm.com/#/crm/view_account/247280", "0339174285": "https://fucoidan2026.getflycrm.com/#/crm/view_account/188023", "0395446181": "https://fucoidan2026.getflycrm.com/#/crm/view_account/245932", "0344042608": "https://fucoidan2026.getflycrm.com/#/crm/view_account/246802", "0327867662": "https://fucoidan2026.getflycrm.com/#/crm/view_account/246753", "0386939499": "https://fucoidan2026.getflycrm.com/#/crm/view_account/246696", "0983131167": "https://fucoidan2026.getflycrm.com/#/crm/view_account/246252", "0784411999": "https://fucoidan2026.getflycrm.com/#/crm/view_account/246626", "0353894362": "https://fucoidan2026.getflycrm.com/#/crm/view_account/191694", "0915767097": "https://fucoidan2026.getflycrm.com/#/crm/view_account/135071", "0865681363": "https://fucoidan2026.getflycrm.com/#/crm/view_account/246517", "0988723359": "https://fucoidan2026.getflycrm.com/#/crm/view_account/200723", "0946388755": "https://fucoidan2026.getflycrm.com/#/crm/view_account/240232", "0945851973": "https://fucoidan2026.getflycrm.com/#/crm/view_account/220288", "0908260380": "https://fucoidan2026.getflycrm.com/#/crm/view_account/242621", "0913203606": "https://fucoidan2026.getflycrm.com/#/crm/view_account/246295", "0394234292": "https://fucoidan2026.getflycrm.com/#/crm/view_account/246162", "0979974413": "https://fucoidan2026.getflycrm.com/#/crm/view_account/246042"};
                    
                    const allCustomers = await DB.db.customers.toArray();
                    for (const c of allCustomers) {
                        if (!c.getfly_url) {
                            const url = phoneToUrl[c.phone] || phoneToUrl[c.zalo_phone];
                            if (url) {
                                await DB.updateCustomer(c.id, { getfly_url: url }); // Use updateCustomer to push
                            }
                        }
                    }
                    
                    localStorage.setItem('supabase_fix_july_v4', 'done');
                    console.log('Supabase fix applied and pushed to cloud!');
                } catch (e) {
                    console.error('Error applying supabase fix:', e);
                }
            }

        } catch (e) {
            console.warn('Supabase sync init failed, running in local mode:', e);
        }
    }
});
