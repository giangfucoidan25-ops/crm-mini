/* ===================================================================
   CRM MINI — PROMOTIONS MODULE
   Quản lý chương trình ưu đãi của các sản phẩm
   =================================================================== */

const PromotionsModule = {
    defaultConfig: {
        'ancan': [
            { price: 1250000, buy: 1, get: 0 },
            { price: 3750000, buy: 3, get: 1 },
            { price: 7500000, buy: 6, get: 3 },
            { price: 12500000, buy: 10, get: 6 },
            { price: 18750000, buy: 15, get: 10 }
        ],
        'fu8': [
            { price: 2680000, buy: 1, get: 0 },
            { price: 8040000, buy: 3, get: 1 },
            { price: 13400000, buy: 5, get: 3 },
            { price: 21440000, buy: 8, get: 6 },
            { price: 26800000, buy: 10, get: 8 }
        ],
        'fucoidan_nano': [
            { price: 9600000, buy: 1, get: 0 },
            { price: 19200000, buy: 2, get: 1 },
            { price: 28800000, buy: 3, get: 3 },
            { price: 48000000, buy: 5, get: 6 },
            { price: 96000000, buy: 10, get: 14 }
        ],
        'nutri_nano': [
            { price: 630000, buy: 1, get: 0 },
            { price: 1890000, buy: 3, get: 1 },
            { price: 2520000, buy: 4, get: 2 },
            { price: 3780000, buy: 6, get: 3 },
            { price: 4410000, buy: 7, get: 4 },
            { price: 5040000, buy: 8, get: 5 },
            { price: 7560000, buy: 12, get: 8 },
            { price: 8190000, buy: 13, get: 9 },
            { price: 11340000, buy: 18, get: 14 },
            { price: 18900000, buy: 30, get: 24 },
            { price: 37800000, buy: 60, get: 60 },
            { price: 56700000, buy: 90, get: 96 },
            { price: 75600000, buy: 120, get: 130 }
        ]
    },

    productNames: {
        'nutri_nano': 'Nutri Nano Fucoidan',
        'ancan': 'Ancan',
        'fu8': 'Fu 8',
        'fucoidan_nano': 'Fucoidan Nano'
    },

    async render() {
        let config = await DB.getSetting('promotions_config');
        if (!config) {
            config = this.defaultConfig;
        }

        const grid = document.getElementById('promotions-grid');
        if (!grid) return;

        let html = '';
        for (const [key, name] of Object.entries(this.productNames)) {
            const items = config[key] || this.defaultConfig[key];
            
            let rowsHtml = '';
            items.forEach((item, index) => {
                rowsHtml += `
                    <tr>
                        <td>
                            <input type="number" class="input-field promo-buy" data-key="${key}" data-index="${index}" value="${item.buy}" min="1" style="width: 60px; text-align: center;">
                        </td>
                        <td>
                            <input type="number" class="input-field promo-get" data-key="${key}" data-index="${index}" value="${item.get}" min="0" style="width: 60px; text-align: center;">
                        </td>
                        <td style="font-weight: bold; color: var(--color-primary); text-align: right;">
                            ${Utils.formatCurrency(item.price)}
                            <input type="hidden" class="promo-price" data-key="${key}" data-index="${index}" value="${item.price}">
                        </td>
                    </tr>
                `;
            });

            html += `
                <div class="glass-card settings-card" style="padding: 0;">
                    <div style="padding: 15px 20px; border-bottom: 1px solid var(--border-color); background: rgba(128, 90, 213, 0.05); border-radius: 12px 12px 0 0;">
                        <h4 style="margin: 0; color: var(--color-purple);">🎁 Ưu đãi ${name}</h4>
                    </div>
                    <div style="padding: 20px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th style="text-align: center; padding-bottom: 10px; color: var(--text-muted); font-size: 13px;">Mua (hộp)</th>
                                    <th style="text-align: center; padding-bottom: 10px; color: var(--text-muted); font-size: 13px;">Tặng (hộp)</th>
                                    <th style="text-align: right; padding-bottom: 10px; color: var(--text-muted); font-size: 13px;">Tổng Giá trị</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    async save() {
        const newConfig = {
            'nutri_nano': [],
            'ancan': [],
            'fu8': [],
            'fucoidan_nano': []
        };

        const buyInputs = document.querySelectorAll('.promo-buy');
        const getInputs = document.querySelectorAll('.promo-get');
        const priceInputs = document.querySelectorAll('.promo-price');

        for (let i = 0; i < buyInputs.length; i++) {
            const key = buyInputs[i].getAttribute('data-key');
            newConfig[key].push({
                buy: parseInt(buyInputs[i].value) || 0,
                get: parseInt(getInputs[i].value) || 0,
                price: parseInt(priceInputs[i].value) || 0
            });
        }

        await DB.setSetting('promotions_config', newConfig);
        Utils.showToast('Đã lưu cấu hình ưu đãi thành công!', 'success');
    },

    initEvents() {
        document.getElementById('btn-save-promotions')?.addEventListener('click', () => {
            this.save();
        });
    }
};
