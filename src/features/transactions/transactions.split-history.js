import { formatCurrency } from '../../core/utils.js';
import ApiService from '../../services/api.service.js';
import store from '../../core/state.js';
import SplitTransactionModal from './split-transaction.modal.js';

export default class TransactionsSplitHistory {
    constructor() {
    }

    async open(data) {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.data = data;
            this.render();
        });
    }

    groupData(data) {
        const groups = {};
        // Sort by date desc first
        const sorted = [...data].sort((a, b) => {
             // Try parse date
             const dateA = new Date(a.Date);
             const dateB = new Date(b.Date);
             return dateB - dateA;
        });

        sorted.forEach(row => {
            const id = row['Split Group ID'];
            if (!id) return; // Should not happen
            if (!groups[id]) groups[id] = [];
            groups[id].push(row);
        });
        return groups;
    }

    render() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const groupedData = this.groupData(this.data);
        const groupIds = Object.keys(groupedData);

        let rowsHtml = '';
        if (groupIds.length === 0) {
            rowsHtml = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #aaa;">No split history found.</td></tr>';
        } else {
            groupIds.forEach(groupId => {
                const rows = groupedData[groupId];
                const source = rows.find(r => r['Split Type'] === 'SOURCE') || rows[0];
                
                const date = source.Date || '';
                const desc = source.Description || '';
                const isReverted = rows.some(r => r['Split Type'] === 'REVERTED');
                
                // Calculate total from source
                let amount = 0;
                if (source.Income) amount = parseFloat(String(source.Income).replace(/,/g, ''));
                else if (source.Expense) amount = -parseFloat(String(source.Expense).replace(/,/g, ''));
                
                const amountClass = amount >= 0 ? 'positive' : 'negative';
                const statusLabel = isReverted ? '<span style="color:#aaa; font-size:0.8em;">(REVERTED)</span>' : '';

                // Build Detail Rows
                let detailRowsHtml = '';
                rows.forEach(row => {
                    const rType = row['Split Type'];
                    const rDesc = row.Description || '';
                    const rDate = row.Date || '';
                    const rTrip = row['Trip/Event'] || '';
                    const rCat = row['Category'] || '';
                    
                    let rAmount = 0;
                    if (row.Income) rAmount = parseFloat(String(row.Income).replace(/,/g, ''));
                    else if (row.Expense) rAmount = -parseFloat(String(row.Expense).replace(/,/g, ''));
                    const rAmountClass = rAmount >= 0 ? 'positive' : 'negative';

                    // Styling based on type
                    let rBg = 'transparent';
                    if (rType === 'SOURCE') rBg = 'rgba(255, 0, 0, 0.1)';
                    if (rType === 'CHILD') rBg = 'rgba(0, 255, 0, 0.05)';
                    
                    const clickableClass = !isReverted ? 'split-detail-clickable' : '';
                    const cursorStyle = !isReverted ? 'cursor: pointer;' : '';

                    detailRowsHtml += `
                        <tr class="split-detail-row ${clickableClass}" style="background: ${rBg}; ${cursorStyle}" data-group="${groupId}">
                            <td style="padding: 8px;">${rType}</td>
                            <td>${rDate}</td>
                            <td>${rDesc}</td>
                            <td>${rTrip} / ${rCat}</td>
                            <td><span class="${rAmountClass}">${formatCurrency(Math.abs(rAmount))}</span></td>
                        </tr>
                    `;
                });

                // Summary Row
                rowsHtml += `
                    <tr class="split-group-header" data-group="${groupId}">
                        <td style="width: 40px; text-align: center;"><span class="split-toggle-icon">▶</span></td>
                        <td>${date}</td>
                        <td>${desc} ${statusLabel}</td>
                        <td><span class="${amountClass}">${formatCurrency(Math.abs(amount))}</span></td>
                        <td style="font-family: monospace; color: #888;">${groupId.substring(0, 8)}...</td>
                    </tr>
                    <tr class="split-group-details" id="details-${groupId}">
                        <td colspan="5" style="padding: 0;">
                            <div style="padding: 10px; background: rgba(0,0,0,0.2);">
                                <table class="split-detail-table">
                                    <thead>
                                        <tr style="color: #aaa; font-size: 0.85em; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                            <th style="text-align: left; padding: 5px;">Type</th>
                                            <th style="text-align: left; padding: 5px;">Date</th>
                                            <th style="text-align: left; padding: 5px;">Description</th>
                                            <th style="text-align: left; padding: 5px;">Tags</th>
                                            <th style="text-align: left; padding: 5px;">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${detailRowsHtml}
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        overlay.innerHTML = `
            <div class="modal-content" style="width: 95%; max-width: 1200px; max-height: 90vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3>Split Transaction History</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" style="overflow-y: auto; padding: 0;">
                    <table class="section-table" style="width: 100%; border-collapse: separate; border-spacing: 0;">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Total Amount</th>
                                <th>Group ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-confirm">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.overlay = overlay;

        // Bind Group Toggle events
        overlay.querySelectorAll('.split-group-header').forEach(header => {
            header.addEventListener('click', () => {
                const groupId = header.dataset.group;
                const details = overlay.querySelector(`#details-${groupId}`);
                
                if (header.classList.contains('split-group-expanded')) {
                    header.classList.remove('split-group-expanded');
                    details.classList.remove('active');
                } else {
                    header.classList.add('split-group-expanded');
                    details.classList.add('active');
                }
            });
        });

        // Bind Detail Row click events (Edit)
        overlay.querySelectorAll('.split-detail-clickable').forEach(row => {
            row.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent toggling the group
                const groupId = row.dataset.group;
                this.handleRowClick(groupId);
            });
        });

        const close = () => {
            overlay.remove();
            this.resolvePromise();
        };

        overlay.querySelector('.modal-close').onclick = close;
        overlay.querySelector('.modal-btn-confirm').onclick = close;
    }

    async handleRowClick(groupId) {
        // 1. Find data locally from this.data
        const groupRows = this.data.filter(r => r['Split Group ID'] === groupId);
        
        if (groupRows.length === 0) {
            alert("Error: Transaction details not found in local history.");
            return;
        }

        const source = groupRows.find(r => r['Split Type'] === 'SOURCE');
        const children = groupRows.filter(r => r['Split Type'] === 'CHILD');
        
        if (!source) {
             // Should not happen if data integrity is good
             alert("Error: Source transaction missing.");
             return;
        }

        // 2. Open Modal using local data
        try {
            const modal = new SplitTransactionModal();
            const action = await modal.open(source, children, groupId);
            
            if (action && action.action === 'edit') {
                this.overlay.remove();
                
                store.setState('savingSplitTransaction', true); 
                try {
                    await ApiService.editSplit(action.groupId, action.splits, action.original, { skipLoading: true });
                    document.dispatchEvent(new CustomEvent('dataUploaded'));
                } catch (error) {
                    console.error("Failed to update split:", error);
                    alert("Failed to update split: " + error.message);
                    store.setState('savingSplitTransaction', false);
                }
                this.resolvePromise(true); 
            } else if (action && action.action === 'revert') {
                 this.overlay.remove();
                 
                 store.setState('savingSplitTransaction', true); 
                 try {
                    await ApiService.revertSplit(action.groupId, { skipLoading: true });
                    document.dispatchEvent(new CustomEvent('dataUploaded'));
                 } catch (error) {
                     console.error("Failed to revert split:", error);
                     alert("Failed to revert split: " + error.message);
                     store.setState('savingSplitTransaction', false);
                 }

                 this.resolvePromise(true);
            } else if (action) { // This handles if a split was created, which won't happen here
                this.overlay.remove();
                this.resolvePromise(true);
            }
        } catch (error) {
            console.error("Failed to open split modal:", error);
            alert("An error occurred: " + error.message);
        }
    }
}
