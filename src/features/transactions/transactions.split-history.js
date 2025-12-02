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

    render() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        let rowsHtml = '';
        if (this.data.length === 0) {
            rowsHtml = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #aaa;">No split history found.</td></tr>';
        } else {
            this.data.forEach(row => {
                const date = row.Date || '';
                const desc = row.Description || '';
                const type = row['Split Type'] || '';
                const group = row['Split Group ID'] || '';
                const splitDate = row['Split Date'] ? new Date(row['Split Date']).toLocaleString() : '';
                const isReverted = row['Split Type'] === 'REVERTED' || (row['Trip/Event'] === 'REVERTED'); // Check how we mark it. Service_Sheet marked type+1 value 'REVERTED'
                // Actually, in Service_Split.gs:
                // splitSheet.getRange(sourceRowIndex, typeIndex + 1).setValue('REVERTED');
                // So 'Split Type' will be 'REVERTED'.
                
                let amount = 0;
                if (row.Income) amount = parseFloat(String(row.Income).replace(/,/g, ''));
                else if (row.Expense) amount = -parseFloat(String(row.Expense).replace(/,/g, ''));
                
                const amountClass = amount >= 0 ? 'positive' : 'negative';
                
                // Row style
                let bg = 'transparent';
                if (type === 'SOURCE') bg = 'rgba(255, 0, 0, 0.1)';
                if (type === 'CHILD') bg = 'rgba(0, 255, 0, 0.05)';
                if (type === 'REVERTED') bg = 'rgba(100, 100, 100, 0.2)';

                // Click handler data
                const isClickable = type !== 'REVERTED'; // Only active splits can be edited?
                // Actually, if it's Source, we can view it. If it's Child, we can view it.
                // If it's REVERTED, it's done.
                
                rowsHtml += `
                    <tr style="background: ${bg}; ${isClickable ? 'cursor: pointer;' : ''}" 
                        class="${isClickable ? 'history-row' : ''}" 
                        data-group="${group}"
                        data-type="${type}">
                        <td>${date}</td>
                        <td>${desc}</td>
                        <td><span class="${amountClass}">${formatCurrency(Math.abs(amount))}</span></td>
                        <td>${type}</td>
                        <td style="font-size: 0.8em; color: #aaa;">${splitDate}</td>
                        <td style="font-size: 0.8em; font-family: monospace; color: #888;">${group.substring(0, 8)}...</td>
                    </tr>
                `;
            });
        }

        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 80vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3>Split Transaction History</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body" style="overflow-y: auto; padding: 0;">
                    <table class="section-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Type</th>
                                <th>Split On</th>
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

        // Bind click events
        overlay.querySelectorAll('.history-row').forEach(row => {
            row.addEventListener('click', () => {
                const groupId = row.dataset.group;
                const type = row.dataset.type;
                // Prevent editing 'REVERTED' (handled by css class logic but double check)
                if (type !== 'REVERTED') {
                    this.handleRowClick(groupId);
                }
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
        // We reuse the logic from TransactionsComponent to open edit modal
        // But we are inside the history modal. We should probably close history modal?
        // Or open on top?
        // Let's try opening on top.
        
        store.setState('isLoading', true);
        try {
            const result = await ApiService.getSplitGroup(groupId);
            store.setState('isLoading', false);
            
            if (!result.success) throw new Error(result.message);
            
            const { source, children } = result.data;
            
            // Open Split Modal in Edit Mode
            const modal = new SplitTransactionModal();
            const action = await modal.open(source, children, groupId);
            
            if (action) {
                // If action happened (edit or revert), we should close history and refresh data
                this.overlay.remove();
                this.resolvePromise(true); // Signal that data changed
                document.dispatchEvent(new CustomEvent('dataUploaded'));
            }
        } catch (error) {
            store.setState('isLoading', false);
            console.error("Failed to load split group:", error);
            alert("Failed to load split details: " + error.message);
        }
    }
}