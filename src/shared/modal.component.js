// src/shared/modal.component.js

import { el } from '../core/dom.js';

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
      let inputEl;
      if (options.type === 'prompt') {
        inputEl = el('input', {
          type: 'text',
          id: 'modal-input',
          'aria-label': 'Value',
          value: options.defaultValue || ''
        });
      }

      const confirmBtn = el('button', {
        className: 'modal-btn modal-btn-confirm',
        id: 'modal-confirm'
      }, options.confirmText || 'OK');

      const cancelBtn = options.type !== 'alert' ? el('button', {
        className: 'modal-btn modal-btn-cancel',
        id: 'modal-cancel'
      }, options.cancelText || 'Cancel') : null;

      const closeX = el('button', {
        className: 'modal-close',
        id: 'modal-close-x'
      }, '×');

      const modalContent = el('div', { className: 'modal-content' },
        el('div', { className: 'modal-header' },
          el('h3', {}, options.title),
          closeX
        ),
        el('div', { className: 'modal-body' },
          el('div', {}, options.body),
          inputEl
        ),
        el('div', { className: 'modal-footer' },
          cancelBtn,
          confirmBtn
        )
      );

      const overlay = el('div', { className: 'modal-overlay' }, modalContent);

      document.body.appendChild(overlay);

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
        let val;
        if (options.type === 'prompt') {
          val = inputEl.value;
        } else if (options.type === 'confirm') {
          val = true;
        }
        close(val);
      });

      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          close(options.type === 'confirm' ? false : null);
        });
      }

      closeX.addEventListener('click', () => {
        close(options.type === 'confirm' ? false : (options.type === 'prompt' ? null : undefined));
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

