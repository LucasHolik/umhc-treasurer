import { formatCurrency } from '../../core/utils.js';
import ApiService from '../../services/api.service.js';
import store from '../../core/state.js';
import ModalComponent from '../../shared/modal.component.js';

export default class SplitTransactionModal {
    constructor() {
        this.transaction = null;
        this.splits = [];
        this.mode = 'create'; // 'create' or 'edit'
        this.groupId = null;
    }

    /**
     * Open the modal.
     * @param {Object} transaction - The source transaction (for create) or restored source (for edit).
     * @param {Array} existingSplits - Optional. If provided, enters edit mode with these splits.
     * @param {string} groupId - Optional. Required if in edit mode.
     */
    async open(transaction, existingSplits = null, groupId = null) {
        this.transaction = transaction;
        
        // Determine original amount (net)
        const income = transaction.Income ? parseFloat(String(transaction.Income).replace(/,/g, '')) : 0;
        const expense = transaction.Expense ? parseFloat(String(transaction.Expense).replace(/,/g, '')) : 0;
        this.originalAmount = isNaN(income) ? 0 : income;
        if (expense > 0) this.originalAmount = expense; // Treat as positive magnitude for splitting
        this.isIncome = income > 0;

        if (existingSplits) {
            this.mode = 'edit';
            this.groupId = groupId;
            this.splits = existingSplits.map(s => ({
                description: s.Description || s.description, // handle both cases
                amount: parseFloat(s.Amount || s.amount || 0)
            }));
        } else {
            this.mode = 'create';
            this.splits = [
                { 
                    description: transaction.Description + ' (Part 1)', 
                    amount: 0
                },
                { 
                    description: transaction.Description + ' (Part 2)', 
                    amount: 0
                }
            ];
        }

        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.render();
            this.updateCalculations();
        });
    }

    render() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const amountDisplay = formatCurrency(this.originalAmount);
        const title = this.mode === 'edit' ? 'Edit Split Transaction' : 'Split Transaction';
        const revertBtn = this.mode === 'edit' ? 
            `<button class="modal-btn" id="revert-split-btn" style="background-color: #d9534f; margin-right: auto;">Revert to Original</button>` : '';

        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div style="font-size: 0.9em; color: #aaa;">Original Transaction</div>
                        <div style="font-size: 1.1em; font-weight: bold; margin-bottom: 5px;">${this.transaction.Description}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #ddd;">${this.transaction.Date}</span>
                            <span style="font-size: 1.2em; color: ${this.isIncome ? '#5cb85c' : '#d9534f'};">${amountDisplay}</span>
                        </div>
                    </div>

                    <div id="splits-container" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;">
                        <!-- Split rows go here -->
                    </div>

                    <button id="add-split-btn" class="secondary-btn" style="width: 100%; margin-bottom: 15px;">+ Add Another Split</button>

                    <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #aaa;">Total Split:</span>
                        <span id="total-split-display" style="font-weight: bold;">$0.00</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
                        <span style="color: #aaa;">Remaining:</span>
                        <span id="remaining-display" style="font-weight: bold;">$0.00</span>
                    </div>
                </div>
                <div class="modal-footer">
                    ${revertBtn}
                    <button class="modal-btn modal-btn-cancel">Cancel</button>
                    <button class="modal-btn modal-btn-confirm" id="save-split-btn" disabled>Save Splits</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.overlay = overlay;
        this.splitsContainer = overlay.querySelector('#splits-container');
        this.saveBtn = overlay.querySelector('#save-split-btn');
        this.totalDisplay = overlay.querySelector('#total-split-display');
        this.remainingDisplay = overlay.querySelector('#remaining-display');

        // Render initial splits
        this.renderSplits();

        // Bind Events
        overlay.querySelector('.modal-close').onclick = () => this.close(null);
        overlay.querySelector('.modal-btn-cancel').onclick = () => this.close(null);
        overlay.querySelector('#add-split-btn').onclick = () => this.addSplit();
        this.saveBtn.onclick = () => this.handleSubmit();

        const revertBtnEl = overlay.querySelector('#revert-split-btn');
        if (revertBtnEl) {
            revertBtnEl.onclick = () => this.handleRevert();
        }
    }

    renderSplits() {
        this.splitsContainer.innerHTML = '';
        this.splits.forEach((split, index) => {
            const row = document.createElement('div');
            row.className = 'split-row';
            row.style.display = 'flex';
            row.style.gap = '10px';
            row.style.marginBottom = '10px';
            row.style.alignItems = 'center';

            row.innerHTML = `
                <input type="text" class="theme-input split-desc" data-index="${index}" value="${split.description}" placeholder="Description" style="flex: 2;">
                <input type="number" class="theme-input split-amount" data-index="${index}" value="${split.amount || ''}" placeholder="0.00" step="0.01" style="flex: 1;">
                <button class="remove-split-btn" data-index="${index}" style="background: none; border: none; color: #d9534f; cursor: pointer; font-size: 1.2em;">&times;</button>
            `;

            this.splitsContainer.appendChild(row);
        });

        // Bind row events
        this.splitsContainer.querySelectorAll('.split-desc').forEach(el => {
            el.addEventListener('input', (e) => {
                this.splits[e.target.dataset.index].description = e.target.value;
            });
        });

        this.splitsContainer.querySelectorAll('.split-amount').forEach(el => {
            el.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.splits[e.target.dataset.index].amount = isNaN(val) ? 0 : val;
                this.updateCalculations();
            });
        });

        this.splitsContainer.querySelectorAll('.remove-split-btn').forEach(el => {
            el.addEventListener('click', (e) => {
                this.removeSplit(parseInt(e.target.dataset.index));
            });
        });
    }

    addSplit() {
        this.splits.push({ 
            description: this.transaction.Description + ' (Part ' + (this.splits.length + 1) + ')', 
            amount: 0
        });
        this.renderSplits();
        this.updateCalculations();
    }

    removeSplit(index) {
        if (this.splits.length <= 2) {
            alert("You must have at least 2 splits.");
            return;
        }
        this.splits.splice(index, 1);
        this.renderSplits();
        this.updateCalculations();
    }

    updateCalculations() {
        const total = this.splits.reduce((sum, s) => sum + (s.amount || 0), 0);
        const remaining = this.originalAmount - total;

        this.totalDisplay.textContent = formatCurrency(total);
        this.remainingDisplay.textContent = formatCurrency(remaining);

        // Tolerance for floating point errors
        const isValid = Math.abs(remaining) < 0.01;
        
        if (isValid) {
            this.remainingDisplay.style.color = '#5cb85c';
            this.saveBtn.disabled = false;
            this.saveBtn.style.opacity = '1';
        } else {
            this.remainingDisplay.style.color = '#d9534f';
            this.saveBtn.disabled = true;
            this.saveBtn.style.opacity = '0.5';
        }
    }

    async handleRevert() {
        const modal = new ModalComponent();
        const confirmed = await modal.confirm("Are you sure you want to revert this split? The original transaction will be restored.");
        
        if (confirmed) {
            // Visually hide the current modal immediately so it feels like "closing"
            if (this.overlay) this.overlay.style.display = 'none';

            store.setState('savingSplitTransaction', true);
            try {
                await ApiService.revertSplit(this.groupId, { skipLoading: true });
                this.close({ action: 'revert' });
            } catch (error) {
                // If it fails, restore the modal so user can try again or see context
                if (this.overlay) this.overlay.style.display = 'flex';

                await modal.alert("Failed to revert: " + error.message);
                store.setState('savingSplitTransaction', false);
            }
        }
    }

    async handleSubmit() {
        // Final validation
        const total = this.splits.reduce((sum, s) => sum + (s.amount || 0), 0);
        if (Math.abs(this.originalAmount - total) >= 0.01) {
            alert("Total split amount must equal original amount.");
            return;
        }

        if (this.splits.some(s => !s.description.trim())) {
            alert("All splits must have a description.");
            return;
        }

        // Format for API
        const splitsPayload = this.splits.map(s => ({
            Description: s.description,
            Amount: s.amount
        }));

        if (this.mode === 'edit') {
             // Handle Edit
             store.setState('savingSplitTransaction', true);
             try {
                 await ApiService.editSplit(this.groupId, splitsPayload, this.transaction, { skipLoading: true });
                 this.close({ action: 'edit' });
             } catch (error) {
                 alert("Failed to update split: " + error.message);
                 store.setState('savingSplitTransaction', false);
             }
        } else {
            // Handle Create (Return data to caller to handle API)
            this.close(splitsPayload);
        }
    }

    close(data) {
        if (this.overlay) {
            this.overlay.remove();
        }
        if (this.resolvePromise) {
            this.resolvePromise(data);
        }
    }
}