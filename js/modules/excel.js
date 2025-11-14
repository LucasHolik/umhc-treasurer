// js/modules/excel.js

import { Data } from './data.js';

function parseAndCleanData(rows) {
  const transactions = [];
  let headerIndex = -1;

  // Find the header row index - look for Date and Description headers in the first few rows
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i] && rows[i].length > 3) {
      const row = rows[i];
      const dateHeader = row[0] && String(row[0]).toLowerCase().includes('date');
      const descriptionHeader = row[3] && String(row[3]).toLowerCase().includes('description');

      if (dateHeader && descriptionHeader) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) {
    return { error: "Couldn't find the header row." };
  }

  // Find column indices dynamically based on headers
  const headers = rows[headerIndex];
  let dateCol = 0;
  let documentCol = 2;
  let descriptionCol = 3;
  let cashInCol = 12;  // Default fallback
  let cashOutCol = 15; // Default fallback

  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i]).toLowerCase();

    if (header.includes('date')) {
      dateCol = i;
    } else if (header.includes('document') || header.includes('ref') || header.includes('reference')) {
      documentCol = i;
    } else if (header.includes('description') || header.includes('desc')) {
      descriptionCol = i;
    } else if (header.includes('in') && (header.includes('cash') || header.includes('amount') || header.includes('credit'))) {
      cashInCol = i;
    } else if (header.includes('out') && (header.includes('cash') || header.includes('amount') || header.includes('debit') || header.includes('withdrawal') || header.includes('expense'))) {
      cashOutCol = i;
    }
  }

  let currentTransaction = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.join('');

    if (rowText.includes('Please note recent transactions may not be included') || rowText.includes('Pending Transactions (Submitted, Waiting Approval)')) {
      break;
    }

    const date = row[dateCol];

    if (date) {
      // If there's a date, it's a new transaction
      if (currentTransaction) {
        transactions.push(currentTransaction);
      }
      currentTransaction = {
        date: Data.normalizeDateString(date),
        document: row[documentCol] || '',
        description: row[descriptionCol] || '',
        cashIn: row[cashInCol] !== undefined ? row[cashInCol] : null,
        cashOut: row[cashOutCol] !== undefined ? row[cashOutCol] : null,
      };
    } else if (currentTransaction) {
      // If there's no date, append the data to the current transaction
      if (row[documentCol] && !currentTransaction.document.includes(String(row[documentCol]))) {
        currentTransaction.document += '\n' + row[documentCol];
      }
      if (row[descriptionCol] && !currentTransaction.description.includes(String(row[descriptionCol]))) {
        currentTransaction.description += ' ' + row[descriptionCol];
      }
    }
  }

  // Add the last transaction
  if (currentTransaction) {
    transactions.push(currentTransaction);
  }

  return transactions;
}


export const Excel = {
  parseFile(file) {
    return new Promise((resolve, reject) => {
      readXlsxFile(file).then((rows) => {
        const cleanedData = parseAndCleanData(rows);
        resolve(cleanedData);
      }).catch(error => {
        reject(error);
      });
    });
  }
};
