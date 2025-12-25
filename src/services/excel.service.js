// src/services/excel.service.js

// This service depends on the 'read-excel-file' library, which is expected to be loaded globally.
// Make sure to include <script src="path/to/read-excel-file.min.js"></script> in your index.html

function normalizeDateString(dateValue) {
  if (dateValue === null || dateValue === undefined || dateValue === "") {
    return "";
  }

  // Convert to string and trim
  let dateString = String(dateValue).trim();

  // Handle DD/MM/YYYY format from Excel
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    try {
      const parts = dateString.split("/");
      if (parts.length === 3) {
        // Assuming DD/MM/YYYY format - convert to YYYY-MM-DD
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        // Format to YYYY-MM-DD with leading zeros
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    } catch (e) {
      // If parsing fails, return the original string
      return dateString;
    }
  }

  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString; // Already in correct format
  }

  // Handle ISO date strings (YYYY-MM-DDTHH:MM:SS.mmmZ)
  if (dateString.includes("T") && dateString.includes("Z")) {
    try {
      // Extract just the date part (YYYY-MM-DD) before the 'T'
      return dateString.split("T")[0];
    } catch (e) {
      return dateString;
    }
  }

  // Handle date-time strings that might have been converted by Google Sheets (e.g., "2024-10-19 23:00:00")
  if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(dateString)) {
    try {
      // Extract just the date part (YYYY-MM-DD) before the time
      return dateString.split(" ")[0];
    } catch (e) {
      return dateString;
    }
  }

  // For other formats, return as-is
  return dateString;
}

function parseAndCleanData(rows) {
  const transactions = [];
  let headerIndex = -1;

  // Find the header row index
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i] && rows[i].length > 3) {
      const row = rows[i];
      const dateHeader =
        row[0] && String(row[0]).toLowerCase().includes("date");
      const descriptionHeader =
        row[3] && String(row[3]).toLowerCase().includes("description");

      if (dateHeader && descriptionHeader) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) {
    throw new Error("Couldn't find the header row in the Excel file.");
  }

  const headers = rows[headerIndex].map((h) => String(h || "").toLowerCase());

  const dateCol = headers.findIndex((h) => h.includes("date"));
  const documentCol = headers.findIndex(
    (h) => h.includes("document") || h.includes("ref")
  );
  const descriptionCol = headers.findIndex((h) => h.includes("description"));
  const cashInCol = headers.findIndex(
    (h) =>
      h.includes("in") &&
      (h.includes("cash") || h.includes("amount") || h.includes("credit"))
  );
  const cashOutCol = headers.findIndex(
    (h) =>
      h.includes("out") &&
      (h.includes("cash") || h.includes("amount") || h.includes("debit"))
  );

  let currentTransaction = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rowText = row.join("").toLowerCase();
    if (
      rowText.includes("please note recent transactions may not be included") ||
      rowText.includes("pending transactions")
    ) {
      break;
    }

    const date = row[dateCol];

    if (date) {
      if (currentTransaction) {
        transactions.push(currentTransaction);
      }
      currentTransaction = {
        date: normalizeDateString(date),
        document: row[documentCol] || "",
        description: row[descriptionCol] || "",
        cashIn: row[cashInCol] !== undefined ? row[cashInCol] : null,
        cashOut: row[cashOutCol] !== undefined ? row[cashOutCol] : null,
      };
    } else if (currentTransaction) {
      if (
        row[documentCol] &&
        !String(currentTransaction.document).includes(String(row[documentCol]))
      ) {
        currentTransaction.document += "\n" + row[documentCol];
      }
      if (
        row[descriptionCol] &&
        !String(currentTransaction.description).includes(
          String(row[descriptionCol])
        )
      ) {
        currentTransaction.description += " " + row[descriptionCol];
      }
    }
  }

  if (currentTransaction) {
    transactions.push(currentTransaction);
  }

  return transactions;
}

const ExcelService = {
  parseFile(file) {
    return new Promise((resolve, reject) => {
      if (typeof readXlsxFile === "undefined") {
        return reject(new Error("The 'readXlsxFile' library is not loaded."));
      }
      readXlsxFile(file)
        .then((rows) => {
          const cleanedData = parseAndCleanData(rows);
          resolve(cleanedData);
        })
        .catch((error) => {
          reject(error);
        });
    });
  },
};

export default ExcelService;
