import store from '../../core/state.js';

export default class TransactionsManualModal {
    constructor() {
        // Styles handled by shared css or inline
    }

    async open() {
        return new Promise((resolve) => {
            this.resolvePromise = resolve;
            this.render();
        });
    }

    render() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Add Manual Transaction</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="color: #aaa; font-size: 0.9em; margin-bottom: 15px;">
                        Use this ONLY for old transactions not covered by Excel files.
                    </p>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="manual-date" class="theme-input" style="width: 100%;">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="manual-desc" class="theme-input" placeholder="e.g. Old Equipment" style="width: 100%;">
                    </div>
                     <div class="form-group">
                        <label>Document (Optional)</label>
                        <input type="text" id="manual-doc" class="theme-input" placeholder="e.g. Invoice #123" style="width: 100%;">
                    </div>
                    <div class="form-group" style="display: flex; gap: 10px;">
                        <div style="flex: 1;">
                            <label>Type</label>
                            <select id="manual-type" class="theme-select" style="width: 100%;">
                                <option value="Expense">Expense (Money Out)</option>
                                <option value="Income">Income (Money In)</option>
                            </select>
                        </div>
                        <div style="flex: 1;">
                            <label>Amount (£)</label>
                            <input type="number" id="manual-amount" class="theme-input" step="0.01" placeholder="0.00" style="width: 100%;">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-cancel">Cancel</button>
                    <button class="modal-btn modal-btn-confirm" style="background-color: #f0ad4e;">Add Transaction</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.overlay = overlay;
        
        // Bind Events
        overlay.querySelector('.modal-close').onclick = () => this.close(null);
        overlay.querySelector('.modal-btn-cancel').onclick = () => this.close(null);
        overlay.querySelector('.modal-btn-confirm').onclick = () => this.handleSubmit();
        
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        overlay.querySelector('#manual-date').value = today;
    }

    async handleSubmit() {
        const date = this.overlay.querySelector('#manual-date').value;
        const desc = this.overlay.querySelector('#manual-desc').value;
        const doc = this.overlay.querySelector('#manual-doc').value;
        const type = this.overlay.querySelector('#manual-type').value;
        const amount = parseFloat(this.overlay.querySelector('#manual-amount').value);

        if (!date || !desc || isNaN(amount) || amount <= 0) {
            alert("Please fill in all required fields with valid values.");
            return;
        }

        const transaction = {
            date: date,
            description: desc,
            document: doc,
            cashIn: type === 'Income' ? amount : "",
            cashOut: type === 'Expense' ? amount : "",
            isManual: true
        };

        this.close(transaction);
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
