// js/modules/excel.js

import { Data } from './data.js';

function parseAndCleanData(rows) {
  const transactions = [];
  let headerIndex = -1;

  // Find the header row index
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'Date' && rows[i][3] === 'Description') {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return { error: "Couldn't find the header row." };
  }

  let currentTransaction = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rowText = row.join('');

    if (rowText.includes('Please note recent transactions may not be included') || rowText.includes('Pending Transactions (Submitted, Waiting Approval)')) {
      break;
    }

    const date = row[0];

    if (date) {
      // If there's a date, it's a new transaction
      if (currentTransaction) {
        transactions.push(currentTransaction);
      }
      currentTransaction = {
        date: Data.normalizeDateString(date),
        document: row[2] || '',
        description: row[3] || '',
        cashIn: row[12] || null,
        cashOut: row[15] || null,
      };
    } else if (currentTransaction) {
      // If there's no date, append the data to the current transaction
      if (row[2] && !currentTransaction.document.includes(row[2])) {
        currentTransaction.document += '\n' + row[2];
      }
      if (row[3] && !currentTransaction.description.includes(row[3])) {
        currentTransaction.description += ' ' + row[3];
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
