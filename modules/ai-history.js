/* ===================================================================
   CRM MINI — LỊCH SỬ CỐ VẤN AI
   =================================================================== */

const AiHistoryModule = {
    async render() {
        const listContainer = document.getElementById('ai-history-list');
        const listView = document.getElementById('ai-history-list-view');
        const detailView = document.getElementById('ai-history-detail-view');
        
        // Show list, hide detail
        if (listView) listView.style.display = 'block';
        if (detailView) detailView.style.display = 'none';

        const sessions = await DB.getAiSessions();

        if (!sessions || sessions.length === 0) {
            listContainer.innerHTML = `
                <div class="ai-history-empty" style="text-align:center; padding: 40px 20px;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">📉</div>
                    <h4>Chưa có phiên cố vấn nào</h4>
                    <p style="color:var(--text-secondary); margin-top:5px;">Hãy vào mục Biểu đồ và chọn "✨ Cố vấn AI" để bắt đầu.</p>
                </div>
            `;
            return;
        }

        this.renderList(sessions, listContainer);
    },

    renderList(sessions, container) {
        let html = '';
        sessions.forEach(session => {
            const completedCount = session.action_items ? session.action_items.filter(i => i.completed).length : 0;
            const totalCount = session.action_items ? session.action_items.length : 0;
            
            // Get first task text as preview
            let previewTask = "Không có action items";
            if (session.action_items && session.action_items.length > 0) {
                previewTask = session.action_items[0].text;
                if (previewTask.length > 80) previewTask = previewTask.substring(0, 80) + '...';
            }

            let statusText = 'Chưa bắt đầu';
            let statusStyle = 'background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);';
            if (completedCount === totalCount && totalCount > 0) {
                statusText = 'Đã hoàn thành';
                statusStyle = 'background: rgba(34, 197, 94, 0.1); color: var(--color-success); border: 1px solid rgba(34, 197, 94, 0.2);';
            } else if (completedCount > 0) {
                statusText = 'Đang tiến hành';
                statusStyle = 'background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);';
            }

            html += `
                <div class="ai-history-item" onclick="AiHistoryModule.viewDetail(\'${session.id}\')" id="ai-session-${session.id}">
                    <div class="ai-history-item-left">
                        <div class="ai-history-title">Phân tích kinh doanh — ${Utils.escapeHtml(session.time_range)}</div>
                        <div class="ai-history-subtitle">${Utils.escapeHtml(previewTask)}</div>
                        <div class="ai-history-subtitle" style="font-size: 0.85rem; font-weight: 500; color: var(--color-primary); margin-top: 4px;">Tiến độ: ${completedCount}/${totalCount} việc</div>
                    </div>
                    <div class="ai-history-item-right" style="align-items: center; flex-direction: row; gap: 20px;">
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                            <div class="ai-history-badge" style="${statusStyle}">${statusText}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">${Utils.formatDateVerbose(session.timestamp)}</div>
                        </div>
                        <div class="ai-history-btn-view">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    async viewDetail(id) {
        const session = await DB.getAiSession(id);
        const detailContainer = document.getElementById('ai-history-detail');
        const detailTime = document.getElementById('ai-history-detail-time');
        const listView = document.getElementById('ai-history-list-view');
        const detailView = document.getElementById('ai-history-detail-view');
        
        if (!session) return;

        // Switch view
        if (listView) listView.style.display = 'none';
        if (detailView) detailView.style.display = 'block';

        if (detailTime) {
            detailTime.innerText = `Khoảng thời gian: ${Utils.escapeHtml(session.time_range)} | Ngày tạo: ${Utils.formatDateVerbose(session.timestamp)}`;
        }

        let checklistHtml = '';
        if (session.action_items && session.action_items.length > 0) {
            checklistHtml = `
                <div class="ai-checklist card">
                    <h4 class="ai-checklist-title">✅ Checklist Hành Động</h4>
                    <div class="ai-checklist-items">
                        ${session.action_items.map((item, index) => `
                            <label class="ai-checklist-item">
                                <input type="checkbox" onchange="AiHistoryModule.toggleAction(\'${session.id}\', ${index}, this.checked)" ${item.completed ? 'checked' : ''}>
                                <span class="ai-checklist-text">${Utils.escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const consultingHtml = CoVanAiModule.renderMarkdown(session.consulting_text || '');

        detailContainer.innerHTML = `
            ${checklistHtml}
            <div class="ai-consulting-full card" style="margin-top:20px;">
                <h4 style="margin-bottom:15px; display:flex; align-items:center; gap:8px;">
                    <span>✨</span> Chi tiết phiên tư vấn
                </h4>
                <div class="covan-article">
                    ${consultingHtml}
                </div>
            </div>
        `;
        
        // Scroll to top
        window.scrollTo(0, 0);
    },

    async toggleAction(sessionId, actionIndex, isChecked) {
        await DB.updateAiSessionAction(sessionId, actionIndex, isChecked);
        // Refresh the list silently so data is updated when going back
        const sessions = await DB.getAiSessions();
        if (sessions) {
            const listContainer = document.getElementById('ai-history-list');
            if (listContainer) this.renderList(sessions, listContainer);
        }
    },

    goBack() {
        const listView = document.getElementById('ai-history-list-view');
        const detailView = document.getElementById('ai-history-detail-view');
        
        if (detailView) detailView.style.display = 'none';
        if (listView) listView.style.display = 'block';
    }
};
