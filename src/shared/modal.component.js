// src/shared/modal.component.js

class ModalComponent {
  constructor() {
    // Inject styles if not already present
    if (!document.getElementById('modal-styles')) {
      const link = document.createElement('link');
      link.id = 'modal-styles';
      link.rel = 'stylesheet';
      link.href = 'src/shared/modal.css';
      document.head.appendChild(link);
    }
  }

  /**
   * Shows a confirmation modal (like confirm()).
   * @param {string} message The message to display.
   * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise.
   */
  async confirm(message, title = 'Confirm') {
    return this._show({
      title,
      body: message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: 'confirm'
    });
  }

  /**
   * Shows an alert modal (like alert()).
   * @param {string} message The message to display.
   * @returns {Promise<void>} Resolves when closed.
   */
  async alert(message, title = 'Alert') {
    return this._show({
      title,
      body: message,
      confirmText: 'OK',
      type: 'alert'
    });
  }

  /**
   * Shows a prompt modal with an input field (like prompt()).
   * @param {string} message The label/message for the input.
   * @param {string} defaultValue The default value for the input.
   * @returns {Promise<string|null>} Resolves to the input string or null if cancelled.
   */
  async prompt(message, defaultValue = '', title = 'Input Required') {
    return this._show({
      title,
      body: message,
      defaultValue,
      confirmText: 'OK',
      cancelText: 'Cancel',
      type: 'prompt'
    });
  }

  _show(options) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      
      const inputHtml = options.type === 'prompt' 
        ? `<input type="text" id="modal-input" aria-label="Value" value="${options.defaultValue}" />` 
        : '';

      const cancelBtnHtml = options.type !== 'alert' 
        ? `<button class="modal-btn modal-btn-cancel" id="modal-cancel">${options.cancelText || 'Cancel'}</button>` 
        : '';

      overlay.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>${options.title}</h3>
            <button class="modal-close" id="modal-close-x">&times;</button>
          </div>
          <div class="modal-body">
            <div>${options.body}</div>
            ${inputHtml}
          </div>
          <div class="modal-footer">
            ${cancelBtnHtml}
            <button class="modal-btn modal-btn-confirm" id="modal-confirm">${options.confirmText || 'OK'}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const inputEl = overlay.querySelector('#modal-input');
      const confirmBtn = overlay.querySelector('#modal-confirm');
      const cancelBtn = overlay.querySelector('#modal-cancel');
      const closeX = overlay.querySelector('#modal-close-x');

      if (inputEl) {
        inputEl.focus();
        inputEl.select();
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        });
      }

      const close = (result) => {
        overlay.style.opacity = '0'; // Fade out
        setTimeout(() => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
        }, 200);
        resolve(result);
      };

      confirmBtn.addEventListener('click', () => {
        if (options.type === 'prompt') {
          resolve(inputEl.value);
        } else if (options.type === 'confirm') {
          resolve(true);
        } else {
          resolve();
        }
        close(); // Close handles cleanup, but we resolved already.
        // Wait, if I resolve in close(), then I shouldn't resolve here?
        // Actually, the standard pattern is:
        // handle action -> close -> (inside close, remove dom).
        // The promise should be resolved with the value.
        // Let's refactor slightly to be cleaner.
      });

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
           if (options.type === 'prompt') resolve(null);
           else resolve(false);
           
           overlay.style.opacity = '0';
           setTimeout(() => document.body.removeChild(overlay), 200);
        });
      }

      closeX.addEventListener('click', () => {
          if (options.type === 'prompt') resolve(null);
          else if (options.type === 'confirm') resolve(false);
          else resolve();

          overlay.style.opacity = '0';
          setTimeout(() => document.body.removeChild(overlay), 200);
      });
      
      // Close on backdrop click
      overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
              closeX.click();
          }
      });
    });
  }
}

export default ModalComponent;
