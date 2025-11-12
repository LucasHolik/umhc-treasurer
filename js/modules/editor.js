// js/modules/editor.js

import { Tags } from './tags.js';

let changes = {};
let currentExpenses = [];

function render(expenses) {
  currentExpenses = expenses;
  const editorBody = document.getElementById('editor-body');
  editorBody.innerHTML = '';

  expenses.forEach(expense => {
    const row = document.createElement('tr');
    row.dataset.rowId = expense.row;

    const createCell = (text) => {
      const cell = document.createElement('td');
      cell.textContent = text;
      return cell;
    };

    const createSelectCell = (type, selectedValue) => {
      const cell = document.createElement('td');
      const select = document.createElement('select');
      select.dataset.type = type;
      select.dataset.rowId = expense.row;

      const tags = Tags.getTags()[type];
      const uniqueTags = [...new Set(tags.filter(tag => tag))];
      const options = ["", ...uniqueTags];

      options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option || 'none'; // Display 'none' for the empty option
        if (option === selectedValue) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });

      select.addEventListener('change', (e) => {
        const rowId = e.target.dataset.rowId;
        if (!changes[rowId]) {
          changes[rowId] = {
            tripEvent: expense['Trip/Event'],
            category: expense.Category
          };
        }
        changes[rowId][type] = e.target.value;
      });

      cell.appendChild(select);
      return cell;
    };

    row.appendChild(createCell(expense.row));
    row.appendChild(createCell(expense.Document));
    row.appendChild(createCell(expense.Date));
    row.appendChild(createCell(expense.Description));
    row.appendChild(createSelectCell('Trip/Event', expense['Trip/Event']));
    row.appendChild(createSelectCell('Category', expense.Category));
    row.appendChild(createCell(expense.Income));
    row.appendChild(createCell(expense.Expense));
    row.appendChild(createCell(expense['Time-uploaded']));

    editorBody.appendChild(row);
  });
}

export const Editor = {
  render,
  rerender: () => render(currentExpenses),
  getChanges: () => {
    const changeArray = Object.keys(changes).map(rowId => ({
      row: rowId,
      tripEvent: changes[rowId]['Trip/Event'],
      category: changes[rowId]['Category']
    }));
    return changeArray;
  },
  clearChanges: () => {
    changes = {};
  }
};
