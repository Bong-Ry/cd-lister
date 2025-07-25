document.addEventListener('DOMContentLoaded', () => {
    if (typeof sessionId === 'undefined') return;

    const tableBody          = document.querySelector('#results-table tbody');
    const modal              = document.getElementById('image-modal');
    const modalImg           = document.getElementById('modal-image');
    const modalClose         = document.querySelector('.modal-close');
    const progressContainer  = document.getElementById('progress-container');
    const progressBarInner   = document.querySelector('.progress-bar-inner');
    const resultsContainer   = document.getElementById('results-table-container');
    const downloadBtn        = document.getElementById('download-csv-btn');

    function createRow(record) {
        const isError   = record.status === 'error';
        const imageUrl  = record.aiData?.J1_FileId ? `/image/${record.aiData.J1_FileId}` : 'https://via.placeholder.com/120';
        const title     = record.aiData?.Title || 'タイトル取得エラー';
        const artist    = record.aiData?.Artist || 'アーティスト取得エラー';

        // 価格のラジオボタンを USD で生成
        const priceOptions = ['29.99', '39.99', '59.99', '79.99'];
        const priceRadios  = priceOptions.map((price, index) =>
            `<label class="radio-label"><input type="radio" name="price-${record.id}" value="${price}" ${index === 0 ? 'checked' : ''} ${isError ? 'disabled' : ''}> ${price} USD</label>`
        ).join('');

        // 送料のプルダウンを USD で生成
        const shippingOptions = {'15': 'Standard Shipping (15USD)', '25': 'Expedited Shipping (25USD)'};
        const shippingSelect = Object.entries(shippingOptions).map(([price, name]) => `<option value="${price}">${name}</option>`).join('');

        return `
            <tr id="row-${record.id}" data-record-id="${record.id}" class="record-row">
                <td class="status-cell">${isError ? `❌<br><small>${record.error || ''}</small>` : '✏️'}</td>
                <td class="image-cell"><img src="${imageUrl}" alt="CD Image" class="main-record-image"></td>
                <td class="info-cell">
                    <div class="info-input-group">
                        <label>SKU (フォルダ名)</label>
                        <span class="sku-display">${record.folderName}</span>
                    </div>
                    <div class="info-input-group">
                        <label>${artist}</label>
                        <textarea name="title" rows="4" class="title-input">${title}</textarea>
                    </div>
                </td>
                <td class="input-cell">
                    <div class="input-section">
                        <div class="input-group full-width">
                            <label>価格</label>
                            <div class="radio-group">${priceRadios}</div>
                        </div>
                        <div class="input-group">
                            <label>送料</label>
                            <select name="shipping" ${isError ? 'disabled' : ''}>${shippingSelect}</select>
                        </div>
                    </div>
                    <div class="input-group full-width" style="margin-top: 15px;">
                        <label>コメント</label>
                        <textarea name="comment" rows="3" ${isError ? 'disabled' : ''}>${record.aiData?.editionNotes || ''}</textarea>
                    </div>
                </td>
                <td class="action-cell">
                    <button class="btn btn-save" ${isError ? 'disabled' : ''}>保存</button>
                </td>
            </tr>`;
    }

    function handleSave(event) {
        const row       = event.target.closest('tr');
        const recordId  = row.dataset.recordId;

        const data = {
            title:    row.querySelector('[name="title"]').value,
            price:    row.querySelector(`input[name="price-${recordId}"]:checked`).value,
            shipping: row.querySelector('[name="shipping"]').value,
            comment:  row.querySelector('[name="comment"]').value,
        };

        fetch(`/save/${sessionId}/${recordId}`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(data),
        })
        .then(res => res.json())
        .then(result => {
            if (result.status === 'ok') {
                row.querySelector('.status-cell').innerHTML = '✅';
                row.classList.add('saved');
                row.querySelectorAll('input, textarea, button, select').forEach(el => el.disabled = true);
                downloadBtn.style.display = 'inline-block';
            }
        });
    }

    function setupEventListeners(row) {
        row.querySelector('.btn-save').addEventListener('click', handleSave);
        row.querySelector('.main-record-image').addEventListener('click', e => {
            modal.style.display = 'flex';
            modalImg.src = e.target.src;
        });
    }

    modalClose.onclick = () => { modal.style.display = 'none'; };
    window.onclick     = event => { if (event.target === modal) modal.style.display = 'none'; };

    function checkStatus() {
        fetch(`/status/${sessionId}`)
        .then(res => res.json())
        .then(session => {
            if (!session || !session.records) return;

            if (session.status === 'error') {
                 clearInterval(intervalId);
                 progressText.textContent = 'エラーが発生しました。';
                 errorMessage.textContent = session.error;
                 errorMessage.style.display = 'block';
                 return;
            }

            session.records.forEach(record => {
                let row = document.getElementById(`row-${record.id}`);
                if (!row && record.status !== 'pending') {
                    tableBody.insertAdjacentHTML('beforeend', createRow(record));
                    row = document.getElementById(`row-${record.id}`);
                    setupEventListeners(row);
                }
            });

            const total      = session.records.length;
            const processed  = session.records.filter(r => r.status !== 'pending').length;
            const progress   = total > 0 ? (processed / total) * 100 : 0;
            progressBarInner.style.width = `${progress}%`;
            progressText.textContent = `処理中... (${processed}/${total})`;

            if (session.status === 'completed') {
                clearInterval(intervalId);
                progressContainer.style.display = 'none';
                resultsContainer.style.display  = 'block';
                downloadBtn.href = `/csv/${sessionId}`;
            }
        });
    }

    const intervalId = setInterval(checkStatus, 2000);
});
