/* ===================================================================
   CRM MINI — CỐ VẤN AI MODULE
   Tính năng "Cố vấn AI" — Giám đốc Kinh doanh TPCN 16 năm kinh nghiệm
   Phân tích chiến lược dựa trên data biểu đồ + Dynamic Suggestions
   =================================================================== */

const CoVanAiModule = {
    isOpen: false,
    conversationHistory: [],

    // ===== System Prompt chuyên gia TPCN =====
    getSystemPrompt(timeRange, metricsJson) {
        return `Bạn là một Giám đốc Kinh doanh và Chuyên gia Sales Thực Phẩm Chức Năng (TPCN) với 16 năm kinh nghiệm thực chiến. Bạn am hiểu sâu sắc tâm lý khách hàng ngành TPCN: cần xây dựng niềm tin dài hạn, cực kỳ nhạy cảm về giá, cần liệu trình dài ngày để thấy hiệu quả, và đặc tính quản lý sản phẩm có hạn sử dụng (date).

Nhiệm vụ của bạn là phân tích số liệu kinh doanh trong khoảng thời gian ${timeRange} và đưa ra tư vấn chiến lược nhằm thúc đẩy doanh số. 

Dữ liệu đầu vào:
${metricsJson}

Hãy tuân thủ các nguyên tắc tư vấn sau:
1. Đọc bao quát bức tranh (Holistic): Không chỉ nhìn 1 số. Phải liên kết Traffic, Tỷ lệ chuyển đổi (CR) và Tỷ lệ khách cũ (Retention) để bắt đúng "bệnh".
2. Khuyến nghị mang tính thực chiến ngành TPCN: Đừng khuyên chung chung. Hãy nói về chiến thuật up-sale (bán chéo/combo liệu trình 3-6 tháng), xử lý hàng cận date, chiến lược tặng sample dùng thử, kịch bản telesale bám đuổi, và kịch bản CSKH cũ đúng thời điểm họ vừa dùng hết 1 lọ.
3. Giọng điệu (Tone): Sắc bén, thực tế, quyết đoán, mang lại sự tin cậy tuyệt đối. Dùng định dạng Markdown (in đậm, bullet points) để bài tư vấn dễ đọc lướt.

RẤT QUAN TRỌNG: Bạn BẮT BUỘC phải trả về kết quả dưới dạng cấu trúc JSON hợp lệ với 3 key sau:
- "consulting_text": Nội dung bài phân tích và giải pháp (Sử dụng Markdown, emoji phù hợp, chia đoạn ngắn gọn).
- "suggested_questions": Mảng chứa ĐÚNG 3 câu hỏi gợi ý cực kỳ sắc bén (độ dài mỗi câu < 15 chữ) để người dùng đào sâu vào những chỉ số đang có vấn đề hoặc cần khai thác thêm từ dữ liệu trên.
- "action_items": Mảng chứa 3-5 hành động cụ thể, cực kỳ ngắn gọn (checklist) mà người dùng cần làm ngay.

Chỉ xuất định dạng JSON, không có bất kỳ văn bản nào nằm ngoài JSON.`;
    },

    // ===== Gom data từ Dashboard Stats =====
    buildPayload(stats, timeFilterLabel) {
        // Revenue
        const revenue = stats.totalRevenue || 0;
        // Revenue growth (mock for now - would need previous period data)
        const completedOrders = stats.completedOrders || 0;
        const totalCustomers = stats.totalCustomers || 0;
        const conversionRate = totalCustomers > 0 ? ((completedOrders / totalCustomers) * 100).toFixed(1) : '0.0';

        // Returning customer rate
        const purchasedCount = stats.customers.filter(c =>
            ['purchased', 'repurchased', 'vip'].includes(c.status)
        ).length;
        const repeatCount = stats.repurchasedCustomers.length + stats.vipCustomers.length;
        const returningRate = purchasedCount > 0 ? ((repeatCount / purchasedCount) * 100).toFixed(1) : '0.0';

        // Top products
        const completed = stats.orders.filter(o => o.order_status === 'completed');
        const prodMap = {};
        completed.forEach(o => {
            if (!prodMap[o.product_name]) prodMap[o.product_name] = { sales: 0, revenue: 0 };
            prodMap[o.product_name].sales += o.quantity || 1;
            prodMap[o.product_name].revenue += o.total_amount || 0;
        });

        const topProducts = Object.entries(prodMap)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 5)
            .map(([name, data]) => ({
                name,
                sales: data.sales,
                revenue: Utils.formatCurrency(data.revenue)
            }));

        // Care metrics
        const overdueCount = stats.overdueCustomers?.length || 0;
        const productRunningOut = stats.productRunningOut?.length || 0;
        const productExpired = stats.productExpired?.length || 0;
        const dueTodayCount = stats.dueTodayCustomers?.length || 0;

        // New customers this period
        const newCustomers = stats.newCustomers || 0;

        // Cancelled/returned
        const cancelledOrders = stats.cancelledOrders || 0;
        const returnedOrders = stats.returnedOrders || 0;

        return {
            time_range: timeFilterLabel,
            metrics: {
                revenue: Utils.formatCurrency(revenue),
                total_orders: stats.totalOrders || 0,
                completed_orders: completedOrders,
                cancelled_orders: cancelledOrders,
                returned_orders: returnedOrders,
                total_customers: totalCustomers,
                new_customers: newCustomers,
                conversion_rate: conversionRate + '%',
                returning_customer_rate: returningRate + '%',
                overdue_care_customers: overdueCount,
                product_running_out: productRunningOut,
                product_expired: productExpired,
                due_today: dueTodayCount
            },
            top_products: topProducts
        };
    },

    // ===== Lấy nhãn thời gian =====
    getTimeFilterLabel() {
        const filterEl = document.getElementById('charts-time-filter');
        if (!filterEl) return 'Tháng này';
        const val = filterEl.value;
        const labels = {
            'today': 'Hôm nay',
            '7days': '7 ngày qua',
            'month': 'Tháng này',
            'last_month': 'Tháng trước',
            'quarter': 'Quý này',
            'last_quarter': 'Quý trước',
            'year': 'Năm nay',
            'last_year': 'Năm trước',
            'custom': 'Tùy chọn'
        };
        if (val === 'custom') {
            const from = document.getElementById('charts-date-from')?.value || '';
            const to = document.getElementById('charts-date-to')?.value || '';
            if (from && to) {
                return `${Utils.formatDateShort(from)} - ${Utils.formatDateShort(to)}`;
            }
        }
        return labels[val] || 'Tháng này';
    },

    // ===== Gọi Gemini API =====
    async callGeminiAPI(userMessage, metricsPayload) {
        const apiKey = await DB.getSetting('gemini_api_key');
        if (!apiKey) {
            throw new Error('Vui lòng nhập Gemini API Key trong phần Cài đặt → API Key để sử dụng tính năng Cố vấn AI.');
        }

        const timeRange = this.getTimeFilterLabel();
        const metricsJson = JSON.stringify(metricsPayload, null, 2);
        const systemPrompt = this.getSystemPrompt(timeRange, metricsJson);

        const contents = [];

        // If this is a follow-up question, include conversation history
        if (this.conversationHistory.length > 0) {
            this.conversationHistory.forEach(msg => {
                contents.push(msg);
            });
        }

        // Add the user's message
        contents.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        const payload = {
            contents: contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        consulting_text: { type: "STRING", description: "Nội dung bài phân tích và giải pháp (Sử dụng Markdown, emoji phù hợp, chia đoạn ngắn gọn)" },
                        suggested_questions: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Mảng chứa đúng 3 câu hỏi gợi ý cực kỳ sắc bén"
                        },
                        action_items: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Mảng chứa 3-5 hành động cụ thể, ngắn gọn (checklist) để cải thiện chỉ số"
                        }
                    },
                    required: ["consulting_text", "suggested_questions", "action_items"]
                },
                temperature: 0.7,
                maxOutputTokens: 8192
            }
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        // Retry với exponential backoff khi API quá tải
        let response;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) break;

            if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
                const waitSec = Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, waitSec * 1000));
                continue;
            }

            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Lỗi API (${response.status})`);
        }

        const data = await response.json();
        const textRes = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textRes) {
            throw new Error('AI không trả về kết quả. Vui lòng thử lại.');
        }

        // Parse JSON response
        let result;
        try {
            result = JSON.parse(textRes);
        } catch (e) {
            // Try extracting JSON from text
            const jsonMatch = textRes.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Kết quả AI không đúng định dạng JSON.');
            }
        }

        // Update conversation history
        this.conversationHistory.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });
        this.conversationHistory.push({
            role: 'model',
            parts: [{ text: textRes }]
        });

        return result;
    },

    // ===== Markdown → HTML (basic parser) =====
    renderMarkdown(text) {
        if (!text) return '';
        let html = text
            // Headers
            .replace(/^### (.+)$/gm, '<h4 class="covan-h4">$1</h4>')
            .replace(/^## (.+)$/gm, '<h3 class="covan-h3">$1</h3>')
            .replace(/^# (.+)$/gm, '<h2 class="covan-h2">$1</h2>')
            // Horizontal rules
            .replace(/^---+$/gm, '<hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">')
            // ID link parsing
            .replace(/\[ID:\s*(\d+)\]/gi, '<a href="?customer_id=$1" target="_blank" class="btn-link" style="margin-left:8px; font-size:0.9em; text-decoration:none; padding:2px 8px; background:rgba(var(--color-primary-rgb), 0.1); color:var(--color-primary); border-radius:12px; border:1px solid rgba(var(--color-primary-rgb), 0.3);" title="Mở hồ sơ khách hàng ở tab mới">🔗 Xem HS</a>')
            // Customer Title with double spacing
            .replace(/^\*\*(\d+\..+?)\*\*(.*)$/gm, '<div style="margin-top: 24px; margin-bottom: 4px; font-size: 1.05em;"><strong>$1</strong>$2</div>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1); padding:1px 5px; border-radius:3px; font-size:0.9em;">$1</code>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Nested Unordered list items (with 2+ spaces)
            .replace(/^ {2,}- (.+)$/gm, '<li style="margin-left: 30px; list-style-type: circle; margin-top: 4px;">$1</li>')
            // Unordered list items (top level)
            .replace(/^- (.+)$/gm, '<li style="margin-left: 15px; list-style-type: circle; margin-top: 6px;">$1</li>')
            // Numbered list items
            .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Cleanup stray <br> around block elements
        html = html.replace(/<br>\s*(<li|<div|<\/div|<ul|<\/ul)/gi, '$1')
                   .replace(/(<\/li>|<\/div>|<\/ul>)\s*<br>/gi, '$1');

        // Wrap lists
        html = html.replace(/(<li>.*?<\/li>)+/gs, (match) => `<ul class="covan-list">${match}</ul>`);
        // Wrap in paragraphs
        html = `<p>${html}</p>`;
        // Clean up empty paragraphs
        html = html.replace(/<p>\s*<\/p>/g, '');
        return html;
    },

    // ===== Open Side Panel =====
    async open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.conversationHistory = [];
        this.currentSessionId = null;

        const overlay = document.getElementById('covan-overlay');
        const panel = document.getElementById('covan-panel');
        if (!overlay || !panel) return;

        overlay.classList.add('active');
        panel.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Show loading state
        this.showLoading();
        const footer = document.getElementById('covan-footer');
        if (footer) footer.style.display = 'none';

        try {
            // Get current dashboard stats
            const timeFilter = document.getElementById('charts-time-filter')?.value || 'month';
            const dateRange = Utils.getDateRange(timeFilter,
                document.getElementById('charts-date-from')?.value,
                document.getElementById('charts-date-to')?.value
            );
            const stats = await DB.getStats(dateRange);

            // Build payload
            const payload = this.buildPayload(stats, this.getTimeFilterLabel());

            // Call AI
            const result = await this.callGeminiAPI(
                `Hãy phân tích tổng quan chiến lược kinh doanh cho khoảng thời gian ${this.getTimeFilterLabel()} dựa trên dữ liệu được cung cấp.`,
                payload
            );

            // Save to database
            if (result.action_items) {
                const sessionData = {
                    timestamp: new Date().toISOString(),
                    time_range: this.getTimeFilterLabel(),
                    consulting_text: result.consulting_text,
                    action_items: result.action_items.map(text => ({ text: text, completed: false }))
                };
                this.currentSessionId = await DB.saveAiSession(sessionData);
            }

            // Render result
            this.renderResult(result);
            // Store payload for follow-up questions
            this._currentPayload = payload;

        } catch (err) {
            this.renderError(err.message);
        }
    },

    // ===== Close Side Panel =====
    close() {
        this.isOpen = false;
        const overlay = document.getElementById('covan-overlay');
        const panel = document.getElementById('covan-panel');
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
        document.body.style.overflow = '';
    },

    // ===== Show Loading State =====
    showLoading() {
        const content = document.getElementById('covan-content');
        if (!content) return;
        content.innerHTML = `
            <div class="covan-loading">
                <div class="covan-loading-icon">
                    <div class="covan-sparkle">✨</div>
                </div>
                <div class="covan-loading-text">AI đang phân tích chiến lược...</div>
                <div class="covan-loading-subtext">${this.getTimeFilterLabel()}</div>
                <div class="covan-skeleton">
                    <div class="covan-skeleton-line w-80"></div>
                    <div class="covan-skeleton-line w-60"></div>
                    <div class="covan-skeleton-line w-90"></div>
                    <div class="covan-skeleton-line w-40"></div>
                    <div class="covan-skeleton-line w-70"></div>
                    <div class="covan-skeleton-line w-85"></div>
                </div>
            </div>
        `;
    },

    // ===== Render AI Result =====
    renderResult(result) {
        const content = document.getElementById('covan-content');
        if (!content) return;

        const consultingHtml = this.renderMarkdown(result.consulting_text || '');
        const suggestions = result.suggested_questions || [];

        content.innerHTML = `
            <div class="covan-result">
                <div class="covan-article">
                    ${consultingHtml}
                </div>
                ${suggestions.length > 0 ? `
                <div class="covan-suggestions">
                    <div class="covan-suggestions-label">💡 Đào sâu thêm</div>
                    <div class="covan-chips">
                        ${suggestions.map((q, i) => `
                            <button class="covan-chip" onclick="CoVanAiModule.askFollowUp('${Utils.escapeHtml(q.replace(/'/g, "\\'"))}')" id="covan-chip-${i}">
                                <span class="covan-chip-icon">→</span>
                                <span class="covan-chip-text">${Utils.escapeHtml(q)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
        
        const footer = document.getElementById('covan-footer');
        if (footer) footer.style.display = 'flex';
    },

    // ===== Render Error =====
    renderError(message) {
        const content = document.getElementById('covan-content');
        if (!content) return;

        content.innerHTML = `
            <div class="covan-error">
                <div class="covan-error-icon">⚠️</div>
                <div class="covan-error-title">Không thể phân tích</div>
                <div class="covan-error-message">${Utils.escapeHtml(message)}</div>
                <button class="covan-retry-btn" onclick="CoVanAiModule.retryAnalysis()">
                    🔄 Thử lại
                </button>
            </div>
        `;
    },

    submitChat() {
        const input = document.getElementById('covan-chat-input');
        if (!input || !input.value.trim()) return;
        const question = input.value.trim();
        input.value = '';
        this.askFollowUp(question);
    },

    // ===== Follow-up Question =====
    async askFollowUp(question) {
        if (!this._currentPayload) return;

        const footer = document.getElementById('covan-footer');
        if (footer) footer.style.display = 'none';

        // Disable all chips
        document.querySelectorAll('.covan-chip').forEach(el => {
            el.disabled = true;
            el.style.opacity = '0.5';
        });

        // Show loading below current content
        const content = document.getElementById('covan-content');
        const existingResult = content.querySelector('.covan-result');

        // Remove old suggestions
        const oldSuggestions = content.querySelector('.covan-suggestions');
        if (oldSuggestions) oldSuggestions.remove();

        // Add follow-up loading
        const followUpDiv = document.createElement('div');
        followUpDiv.className = 'covan-followup';
        followUpDiv.innerHTML = `
            <div class="covan-followup-question">
                <span class="covan-followup-label">Bạn hỏi:</span>
                <span class="covan-followup-text">${Utils.escapeHtml(question)}</span>
            </div>
            <div class="covan-loading covan-loading-sm">
                <div class="covan-loading-icon">
                    <div class="covan-sparkle">✨</div>
                </div>
                <div class="covan-loading-text">AI đang phân tích câu hỏi...</div>
                <div class="covan-skeleton">
                    <div class="covan-skeleton-line w-80"></div>
                    <div class="covan-skeleton-line w-60"></div>
                    <div class="covan-skeleton-line w-70"></div>
                </div>
            </div>
        `;
        content.appendChild(followUpDiv);

        // Scroll to loading
        followUpDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

        try {
            const result = await this.callGeminiAPI(question, this._currentPayload);

            // Update database
            if (this.currentSessionId) {
                try {
                    const session = await DB.getAiSession(this.currentSessionId);
                    if (session) {
                        session.consulting_text += `\n\n### 💬 Đào sâu: ${question}\n${result.consulting_text}`;
                        if (result.action_items && result.action_items.length > 0) {
                            const newItems = result.action_items.map(text => ({ text: text, completed: false }));
                            session.action_items = session.action_items.concat(newItems);
                        }
                        await DB.db.ai_sessions.put(session);
                        
                        if (window.AiHistoryModule) {
                            const sessions = await DB.getAiSessions();
                            const listContainer = document.getElementById('ai-history-list');
                            if (sessions && listContainer) window.AiHistoryModule.renderList(sessions, listContainer);
                        }
                    }
                } catch (dbErr) {
                    console.error("Lỗi cập nhật phiên cố vấn:", dbErr);
                }
            }

            // Replace loading with result
            const consultingHtml = this.renderMarkdown(result.consulting_text || '');
            const suggestions = result.suggested_questions || [];

            followUpDiv.innerHTML = `
                <div class="covan-followup-question">
                    <span class="covan-followup-label">Bạn hỏi:</span>
                    <span class="covan-followup-text">${Utils.escapeHtml(question)}</span>
                </div>
                <div class="covan-article">
                    ${consultingHtml}
                </div>
                ${suggestions.length > 0 ? `
                <div class="covan-suggestions">
                    <div class="covan-suggestions-label">💡 Đào sâu thêm</div>
                    <div class="covan-chips">
                        ${suggestions.map((q, i) => `
                            <button class="covan-chip" onclick="CoVanAiModule.askFollowUp('${Utils.escapeHtml(q.replace(/'/g, "\\'"))}')" id="covan-followup-chip-${Date.now()}-${i}">
                                <span class="covan-chip-icon">→</span>
                                <span class="covan-chip-text">${Utils.escapeHtml(q)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            `;

            followUpDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (footer) footer.style.display = 'flex';

        } catch (err) {
            followUpDiv.innerHTML = `
                <div class="covan-followup-question">
                    <span class="covan-followup-label">Bạn hỏi:</span>
                    <span class="covan-followup-text">${Utils.escapeHtml(question)}</span>
                </div>
                <div class="covan-error covan-error-sm">
                    <div class="covan-error-message">${Utils.escapeHtml(err.message)}</div>
                </div>
            `;
            if (footer) footer.style.display = 'flex';
        }
    },

    // ===== Retry Analysis =====
    async retryAnalysis() {
        this.close();
        setTimeout(() => this.open(), 300);
    },

    // ===== Init Events =====
    initEvents() {
        // Chỉ đóng thủ công bằng nút X
        document.getElementById('covan-close')?.addEventListener('click', () => {
            this.close();
        });

        // Button click
        document.getElementById('btn-covan-ai')?.addEventListener('click', () => {
            this.open();
        });
    }
};
