/* ===================================================================
   CRM MINI — AI IMPORT MODULE
   Đọc file, gửi lên Gemini API, nhận JSON và tạo khách hàng
   =================================================================== */

const AiImportModule = {
    apiKey: '',
    
    initEvents() {
        const fileInput = document.getElementById('ai-import-file-input');
        const btnUpload = document.getElementById('btn-ai-import-file');
        
        if (btnUpload && fileInput) {
            btnUpload.addEventListener('click', async () => {
                const key = await DB.getSetting('gemini_api_key');
                if (!key) {
                    Utils.showToast('Vui lòng nhập Gemini API Key trong phần Cài đặt trước khi dùng tính năng này!', 'error');
                    App.navigateTo('settings');
                    return;
                }
                this.apiKey = key;
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.processFile(e.target.files[0]);
                }
                // Reset input
                e.target.value = '';
            });

            const btnRetryInline = document.getElementById('btn-ai-retry-file');
            if (btnRetryInline) {
                btnRetryInline.addEventListener('click', () => {
                    if (this._lastFile) {
                        this.processFile(this._lastFile);
                    } else {
                        Utils.showToast('Không có file nào được lưu trước đó.', 'warning');
                    }
                });
            }
        }
    },

    async processFile(file) {
        this._lastFile = file;
        this.showProgress('Đang đọc file...');
        
        // Cập nhật giao diện inline cho nút thử lại
        const retryContainer = document.getElementById('ai-retry-container');
        const filenameSpan = document.getElementById('ai-last-filename');
        if (retryContainer && filenameSpan) {
            filenameSpan.textContent = "📄 " + file.name;
            retryContainer.style.display = 'flex';
        }
        
        try {
            const ext = file.name.split('.').pop().toLowerCase();
            let aiPayload = null;

            if (ext === 'pdf' || ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
                // Đọc file dưới dạng base64 cho ảnh và PDF
                const base64Data = await this.readAsBase64(file);
                const mimeType = file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
                
                aiPayload = {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                };
                
            } else if (ext === 'docx') {
                // Dùng Mammoth để đọc Word
                if (typeof mammoth === 'undefined') throw new Error('Thư viện Mammoth chưa được tải');
                this.showProgress('Đang phân tích file Word...');
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                aiPayload = { text: "Dữ liệu dạng văn bản từ file Word:\n" + result.value };

            } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
                // Dùng SheetJS để đọc Excel
                if (typeof XLSX === 'undefined') throw new Error('Thư viện SheetJS (XLSX) chưa được tải');
                this.showProgress('Đang phân tích file Excel...');
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                let excelText = '';
                workbook.SheetNames.forEach(sheetName => {
                    const htmlStr = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
                    excelText += `Sheet ${sheetName}:\n${htmlStr}\n\n`;
                });
                aiPayload = { text: "Dữ liệu dạng CSV từ file Excel:\n" + excelText.substring(0, 50000) }; // limit size
            } else {
                throw new Error('Định dạng file không được hỗ trợ. Vui lòng chọn PDF, Ảnh, Word hoặc Excel.');
            }

            // Gửi lên Gemini
            this.showProgress('Đang nhờ AI trích xuất dữ liệu...');
            const extractedData = await this.callGeminiAPI(aiPayload);
            
            // Xử lý và Lưu vào DB
            this.showProgress('Đang lưu vào hệ thống...');
            if (extractedData && Array.isArray(extractedData)) {
                let countNew = 0;
                let countUpdate = 0;
                const dbCustomers = await DB.getAllCustomers();
                
                for (const customerData of extractedData) {
                    if (customerData.full_name || customerData.phone) {
                        const phone = customerData.phone || '';
                        let existingCust = null;
                        
                        // Tìm khách trùng (theo SĐT hoặc Tên)
                        if (phone && phone.length >= 8) {
                            existingCust = dbCustomers.find(c => 
                                (c.phone && c.phone.includes(phone)) || 
                                (c.zalo_phone && c.zalo_phone.includes(phone))
                            );
                        }
                        if (!existingCust && customerData.full_name) {
                            existingCust = dbCustomers.find(c => c.full_name.toLowerCase().trim() === customerData.full_name.toLowerCase().trim());
                        }
                        
                        let custId = null;
                        const extractedNote = customerData.note || customerData.notes || customerData.ghi_chu || customerData.Ghi_chu || customerData.description || customerData.Nội_dung_chat || customerData.trao_doi || customerData.Trao_doi || customerData.trao_đổi || customerData.Trao_đổi || '';

                        if (existingCust) {
                            // Cập nhật thông tin còn thiếu
                            const updates = {};
                            if (!existingCust.address && customerData.address) updates.address = customerData.address;
                            if (!existingCust.zalo_phone && customerData.zalo_phone) updates.zalo_phone = customerData.zalo_phone;
                            if (!existingCust.tags && customerData.tags) updates.tags = customerData.tags;
                            
                            // Gộp ghi chú vào customer profile
                            let shouldAddCareLog = false;
                            if (extractedNote) {
                                if (!existingCust.note) {
                                    updates.note = extractedNote;
                                    shouldAddCareLog = true;
                                } else if (!existingCust.note.includes(extractedNote)) {
                                    updates.note = existingCust.note + '\n\n' + extractedNote;
                                    shouldAddCareLog = true;
                                }
                            }
                            
                            if (Object.keys(updates).length > 0) {
                                await DB.updateCustomer(existingCust.id, updates);
                            }
                            if (updates.note) existingCust.note = updates.note;
                            
                            custId = existingCust.id;
                            
                            // Đưa ghi chú vào timeline trao đổi để hiển thị trên UI
                            if (shouldAddCareLog) {
                                await DB.addCareLog({
                                    customer_id: custId,
                                    care_date: Utils.today(),
                                    care_type: 'Trích xuất AI',
                                    note: extractedNote
                                });
                            }
                            
                            countUpdate++;
                        } else {
                            // Tạo khách hàng mới
                            const newCust = {
                                full_name: customerData.full_name || 'Khách chưa có tên',
                                phone: phone,
                                zalo_phone: customerData.zalo_phone || phone,
                                address: customerData.address || '',
                                status: customerData.status || 'new',
                                customer_source: customerData.customer_source || 'other',
                                tags: customerData.tags || '',
                                note: extractedNote,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            };
                            custId = await DB.addCustomer(newCust);
                            
                            // Đưa ghi chú ban đầu vào timeline trao đổi
                            if (extractedNote) {
                                await DB.addCareLog({
                                    customer_id: custId,
                                    care_date: Utils.today(),
                                    care_type: 'Ghi chú ban đầu',
                                    note: extractedNote
                                });
                            }
                            
                            countNew++;
                        }
                        
                        // Nếu AI trích xuất được đơn hàng (orders)
                        if (customerData.orders && Array.isArray(customerData.orders) && customerData.orders.length > 0) {
                            const dbProducts = await DB.getAllProducts();
                            const orderItems = [];
                            let totalAmount = 0;
                            
                            for (const o of customerData.orders) {
                                let product = dbProducts.find(p => p.product_name.toLowerCase().includes(o.product_name.toLowerCase()));
                                
                                // Tạo sản phẩm mới nếu chưa có
                                if (!product) {
                                    const newProdId = await DB.addProduct({
                                        product_name: o.product_name,
                                        price: o.price || 0,
                                        unit_name: 'Hộp',
                                        dosage_per_day: '1',
                                        product_category: 'other'
                                    });
                                    product = await DB.getProduct(newProdId);
                                }
                                
                                const qty = o.quantity || 1;
                                const price = (o.price !== undefined && o.price !== null && o.price !== "") ? Number(o.price) : (product.price || 0);
                                orderItems.push({
                                    product_id: product.id,
                                    product_name: product.product_name,
                                    quantity: qty,
                                    unit_price: price,
                                    is_gift: false
                                });
                                totalAmount += qty * price;
                            }
                            
                            if (orderItems.length > 0) {
                                const productNames = orderItems.map(i => `${i.product_name} x${i.quantity}`).join(', ');
                                const firstOrder = customerData.orders[0];
                                const finalAmount = firstOrder.total_amount || totalAmount;
                                const mainItem = orderItems[0];
                                
                                const tempOrder = {
                                    items: orderItems,
                                    total_amount: finalAmount,
                                    product_name: productNames
                                };
                                const finalProductName = await Utils.determineOrderProductName(tempOrder);
                                
                                // Xử lý ngày đặt hàng
                                let oDate = Utils.today();
                                if (firstOrder.order_date && firstOrder.order_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    oDate = firstOrder.order_date;
                                }
                                
                                // Xử lý trạng thái đơn
                                let oStatus = 'completed';
                                if (firstOrder.order_status) {
                                    const s = firstOrder.order_status.toLowerCase();
                                    if (s.includes('cancel') || s.includes('hủy') || s.includes('hoàn')) oStatus = 'cancelled';
                                    else if (s.includes('new') || s.includes('mới')) oStatus = 'new';
                                    else if (s.includes('wait') || s.includes('chờ') || s.includes('đang giao')) oStatus = 'processing';
                                }

                                // --- Tính toán số lượng và ngày hết thuốc ---
                                const supportKeywords = ['đông trùng', 'hà thủ ô', 'sâm ngọc', 'a giáp', 'bổ gan'];
                                let mainProductQty = 0;
                                let maxCycleDays = 0;
                                
                                for (const item of orderItems) {
                                    const pName = item.product_name.toLowerCase();
                                    const isSupport = supportKeywords.some(kw => pName.includes(kw));
                                    
                                    if (!isSupport) {
                                        mainProductQty += item.quantity;
                                        const dbProd = dbProducts.find(p => p.id === item.product_id);
                                        const cycle = dbProd ? (dbProd.usage_cycle_days || 0) : 0;
                                        const itemCycleDays = cycle * item.quantity;
                                        if (itemCycleDays > maxCycleDays) maxCycleDays = itemCycleDays;
                                    }
                                }
                                
                                // Nếu tất cả đều là sản phẩm bổ trợ (không có sản phẩm chính)
                                if (mainProductQty === 0) {
                                    mainProductQty = orderItems.reduce((s, i) => s + i.quantity, 0);
                                    for (const item of orderItems) {
                                        const dbProd = dbProducts.find(p => p.id === item.product_id);
                                        const cycle = dbProd ? (dbProd.usage_cycle_days || 0) : 0;
                                        const itemCycleDays = cycle * item.quantity;
                                        if (itemCycleDays > maxCycleDays) maxCycleDays = itemCycleDays;
                                    }
                                }
                                
                                // Xử lý ngày đặt hàng
                                let oDate = Utils.today();
                                if (firstOrder.order_date && firstOrder.order_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    oDate = firstOrder.order_date;
                                }
                                
                                // Fix lỗi đảo lộn ngày tháng (nếu ngày văng ra khỏi tháng 7/2026 thì đảo lại)
                                if (oDate > Utils.today()) {
                                    const parts = oDate.split('-');
                                    if (parts.length === 3) {
                                        const y = parts[0];
                                        const m = parseInt(parts[1], 10);
                                        const d = parseInt(parts[2], 10);
                                        // Swap month and day
                                        if (d <= 12) {
                                            oDate = `${y}-${d.toString().padStart(2, '0')}-${m.toString().padStart(2, '0')}`;
                                        }
                                    }
                                }

                                let estimatedEndDate = '';
                                if (maxCycleDays > 0 && oDate) {
                                    estimatedEndDate = Utils.addDays(oDate, maxCycleDays);
                                }

                                await DB.addOrder({
                                    customer_id: custId,
                                    items: orderItems,
                                    product_id: mainItem.product_id,
                                    product_name: finalProductName,
                                    order_date: oDate,
                                    quantity: mainProductQty,
                                    unit_price: mainItem.unit_price,
                                    discount: 0,
                                    total_amount: finalAmount,
                                    order_status: oStatus,
                                    estimated_product_end_date: estimatedEndDate,
                                    note: 'Tạo tự động từ AI Import'
                                });
                            }
                        }
                    }
                }
                
                let resultHtml = '';
                if (countNew > 0 || countUpdate > 0) {
                    resultHtml = `<div style="text-align:center; padding: 20px;">
                                    <div style="font-size: 50px; margin-bottom:15px;">✅</div>
                                    <h3 style="color:var(--success); margin-bottom:15px;">Xử lý thành công!</h3>
                                    <div style="background: rgba(46,204,113,0.1); padding: 15px; border-radius: 8px;">
                                        <p style="margin:5px 0;">Đã tạo mới: <b>${countNew}</b> khách hàng</p>
                                        <p style="margin:5px 0;">Đã cập nhật: <b>${countUpdate}</b> khách hàng</p>
                                    </div>
                                  </div>`;
                } else {
                    resultHtml = `<div style="text-align:center; padding: 20px;">
                                    <div style="font-size: 50px; margin-bottom:15px;">⚠️</div>
                                    <h3 style="color:var(--warning); margin-bottom:15px;">Chưa hoàn thành</h3>
                                    <p>AI đã quét file nhưng không trích xuất được thông tin khách hàng mới nào hoặc dữ liệu hoàn toàn trùng lặp.</p>
                                  </div>`;
                }
                
                const footerHtml = `
                    <button class="btn-secondary" onclick="Utils.closeModal()">Đóng</button>
                    <button class="btn-primary" onclick="Utils.closeModal(); setTimeout(() => AiImportModule.processFile(AiImportModule._lastFile), 300)">🔄 Thử lại file cũ</button>
                `;
                Utils.openModal('Kết quả Import', resultHtml, footerHtml);
                
            } else {
                throw new Error('AI không tìm thấy khách hàng nào hợp lệ trong file.');
            }
        } catch (error) {
            console.error(error);
            const errHtml = `<div style="text-align:center; padding: 20px;">
                                <div style="font-size: 50px; margin-bottom:15px;">❌</div>
                                <h3 style="color:var(--danger); margin-bottom:15px;">Xử lý thất bại</h3>
                                <p style="color:#ff6b6b;">${error.message}</p>
                             </div>`;
            const footerHtml = `
                <button class="btn-secondary" onclick="Utils.closeModal()">Đóng</button>
                <button class="btn-primary" onclick="Utils.closeModal(); setTimeout(() => AiImportModule.processFile(AiImportModule._lastFile), 300)">🔄 Thử lại file cũ</button>
            `;
            Utils.openModal('Lỗi hệ thống', errHtml, footerHtml);
            this.hideProgress();
        } finally {
            this.hideProgress();
            if (window.DashboardModule) window.DashboardModule.render();
            if (window.CustomersModule) window.CustomersModule.render();
        }
    },

    readAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    },

    async callGeminiAPI(payloadPart) {
        // Debug: List available models
        let targetModel = 'gemini-1.5-flash'; // default
        try {
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
            const listRes = await fetch(listUrl);
            const listData = await listRes.json();
            
            // Ưu tiên dùng flash vì bản Pro giới hạn 2 requests/phút dễ bị lỗi quá tải
            if (listData && listData.models) {
                const flashModel = listData.models.find(m => m.name.includes('flash') && m.supportedGenerationMethods.includes('generateContent'));
                if (flashModel) {
                    targetModel = flashModel.name.replace('models/', '');
                } else {
                    const proModel = listData.models.find(m => m.name.includes('pro') && m.supportedGenerationMethods.includes('generateContent'));
                    if (proModel) targetModel = proModel.name.replace('models/', '');
                }
            }
        } catch(e) {
            console.error("Lỗi lấy danh sách model:", e);
        }
            
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${this.apiKey}`;
        
        const systemInstruction = `Bạn là trợ lý AI chuyên trích xuất dữ liệu khách hàng cho CRM.
Bạn PHẢI trả về duy nhất 1 mảng JSON chứa các Object khách hàng, không có bất kỳ văn bản nào khác.
Mỗi Object BẮT BUỘC có các thuộc tính sau (nếu không có dữ liệu thì để chuỗi rỗng ""):
- "full_name": Tên khách hàng
- "phone": Số điện thoại
- "zalo_phone": Số Zalo (nếu có)
- "address": Địa chỉ đầy đủ
- "status": "new"
- "customer_source": "other"
- "tags": "Các từ khóa ngắn"
- "note": ĐÂY LÀ TRƯỜNG QUAN TRỌNG NHẤT. Bạn PHẢI thu thập MỌI câu chữ liên quan đến khách hàng này (bao gồm cột Trao đổi, lịch sử trò chuyện, đoạn chat, ghi chú của nhân viên, tình trạng bệnh lý). Đặt biệt CHÚ Ý cột hoặc dòng có chữ "Trao đổi" và CHÉP NGUYÊN VĂN vào đây. Tuyệt đối KHÔNG ĐƯỢC TÓM TẮT hay bỏ sót.
- "orders": [
    {
       "product_name": "Tên sản phẩm",
       "quantity": 2,
       "price": 500000, // CHÚ Ý: NẾU LÀ HÀNG TẶNG / QUÀ TẶNG, BẮT BUỘC ĐỂ GIÁ LÀ 0
       "order_date": "YYYY-MM-DD",
       "order_status": "completed",
       "total_amount": 1000000
    }
  ]

Chỉ trả về JSON, không giải thích gì thêm.`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: "Hãy phân tích nội dung sau và trích xuất danh sách khách hàng sang định dạng JSON." },
                        payloadPart
                    ]
                }
            ],
            systemInstruction: {
                parts: [ { text: systemInstruction } ]
            },
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt < maxRetries) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errData = await response.json();
                    const errMsg = errData.error?.message || 'Lỗi từ Gemini API';
                    
                    // Nếu lỗi do high demand (503) hoặc vượt quota (429), thử lại
                    if (response.status === 503 || errMsg.toLowerCase().includes('high demand') || errMsg.toLowerCase().includes('overloaded')) {
                        throw new Error('HIGH_DEMAND');
                    }
                    if (response.status === 429 || errMsg.toLowerCase().includes('quota')) {
                        let waitTime = 15; // default 15s
                        const match = errMsg.match(/retry in ([\d\.]+)s/i);
                        if (match && match[1]) {
                            waitTime = Math.ceil(parseFloat(match[1])) + 1; // Làm tròn lên và cộng thêm 1s cho chắc
                        }
                        if (waitTime > 60) {
                            throw new Error('Đã vượt quá giới hạn gọi API (Quota Exceeded). Thời gian chờ quá lâu, vui lòng chia nhỏ file Excel và thử lại sau.');
                        }
                        throw new Error('QUOTA_EXCEEDED:' + waitTime);
                    }
                    throw new Error(errMsg);
                }

                const data = await response.json();
                const text = data.candidates[0].content.parts[0].text;
                
                try {
                    return JSON.parse(text);
                } catch(e) {
                    console.error("Lỗi parse JSON:", text);
                    throw new Error("AI trả về định dạng dữ liệu không hợp lệ.");
                }
            } catch (err) {
                if (err.message === 'HIGH_DEMAND') {
                    attempt++;
                    if (attempt >= maxRetries) {
                        throw new Error('Máy chủ AI hiện đang quá tải. Vui lòng thử lại sau vài phút hoặc chia nhỏ file Excel.');
                    }
                    this.showProgress(`Máy chủ bận, đang thử lại lần ${attempt}...`);
                    await new Promise(r => setTimeout(r, 3000 * attempt)); // Đợi 3s, 6s...
                } else if (err.message.startsWith('QUOTA_EXCEEDED')) {
                    attempt++;
                    if (attempt >= maxRetries) {
                        throw new Error('Đã vượt quá giới hạn gọi API (Quota Exceeded). Vui lòng chia nhỏ file Excel và đợi một lát rồi up lại.');
                    }
                    const waitTime = parseInt(err.message.split(':')[1]) || 15;
                    this.showProgress(`Đã tới giới hạn API. Đang đợi ${waitTime}s để thử lại lần ${attempt}...`);
                    await new Promise(r => setTimeout(r, waitTime * 1000));
                } else {
                    throw err;
                }
            }
        }
    },

    showProgress(text) {
        const progressDiv = document.getElementById('ai-import-progress');
        const statusText = document.getElementById('ai-import-status');
        if (progressDiv && statusText) {
            progressDiv.style.display = 'block';
            statusText.textContent = text;
        }
    },

    hideProgress() {
        const progressDiv = document.getElementById('ai-import-progress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
    }
};

// Initialize after DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Wait a little bit for DB to initialize before setting up
    setTimeout(() => {
        AiImportModule.initEvents();
    }, 1000);
});
