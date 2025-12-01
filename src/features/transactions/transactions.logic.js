export const filterData = (data, { selectedCategories, selectedTrips }) => {
    const NO_TAG = '__NO_TAG__';

    return data.filter(item => {
        // Category Filter
        let categoryMatch = true;
        if (selectedCategories.size > 0) {
            const itemCat = item['Category'];
            const hasNoTag = selectedCategories.has(NO_TAG);
            categoryMatch = selectedCategories.has(itemCat) || (hasNoTag && !itemCat);
        }

        // Trip Filter
        let tripMatch = true;
        if (selectedTrips.size > 0) {
            const itemTrip = item['Trip/Event'];
            const hasNoTag = selectedTrips.has(NO_TAG);
            tripMatch = selectedTrips.has(itemTrip) || (hasNoTag && !itemTrip);
        }

        return categoryMatch && tripMatch;
    });
};

export const sortData = (data, field, ascending) => {
    return [...data].sort((a, b) => {
        let valA = a[field] || '';
        let valB = b[field] || '';

        if (field === 'Net') {
             const incomeA = parseFloat(a['Income']) || 0;
             const expenseA = parseFloat(a['Expense']) || 0;
             valA = incomeA - expenseA;

             const incomeB = parseFloat(b['Income']) || 0;
             const expenseB = parseFloat(b['Expense']) || 0;
             valB = incomeB - expenseB;
        } else if (field === 'Income' || field === 'Expense') {
             const numA = parseFloat(valA) || 0;
             const numB = parseFloat(valB) || 0;

             const isPosA = numA > 0;
             const isPosB = numB > 0;

             if (isPosA && !isPosB) return -1; 
             if (!isPosA && isPosB) return 1;  
             
             if (isPosA && isPosB) {
                 valA = numA;
                 valB = numB;
             } else {
                 const otherField = field === 'Income' ? 'Expense' : 'Income';
                 valA = parseFloat(a[otherField]) || 0;
                 valB = parseFloat(b[otherField]) || 0;
             }
        } else if (field === 'Date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }

        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
    });
};
