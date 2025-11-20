// This file contains the primary JavaScript logic for the UMS dashboard forms,
// handling form submissions, data fetching, and communication with the API server.

const API_BASE_URL = 'http://localhost:3000'; // Make sure this matches your Node.js server port

// --- Utility Function to Handle API Communication ---
async function sendData(endpoint, data) {
    try {
        const response = await fetch(API_BASE_URL + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        // Check for non-2xx response status (e.g., 400, 500)
        if (!response.ok) {
            // Attempt to read the error message from the server response body
            const errorData = await response.json();
            throw new Error(errorData.message || `API call failed with status: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        // Handle network errors or errors thrown from the response check
        console.error("API Communication Error:", error);
        // Display a user-friendly error
        displayMessage('error', error.message || 'Network error. Is the Node.js server running?');
        return null;
    }
}

// --- Utility Function to Display Status Messages ---
function displayMessage(type, message, formElement = null) {
    // Select the message area specific to the form, or a global one if form is null
    const container = formElement ? formElement.querySelector('.form-message') : document.querySelector('#form-status');
    // Special case for mobile dashboard
    const mobileContainer = document.querySelector('.message-container');

    if (container) {
        container.textContent = message;
        container.className = `form-message ${type}`;
        // Clear message after 5 seconds
        setTimeout(() => {
            container.textContent = '';
            container.className = 'form-message';
        }, 5000);
    } else if (mobileContainer) {
        mobileContainer.textContent = message;
        mobileContainer.className = `message-container ${type}`;
        setTimeout(() => {
            mobileContainer.textContent = '';
            mobileContainer.className = 'message-container';
        }, 5000);
    }
}

// --- Data Fetching: Load Dashboard Statistics ---
async function loadDashboardStats() {
    const customerWidget = document.getElementById('widget-total-customers');
    if (!customerWidget) return; // Exit if not on the Admin Dashboard

    try {
        const result = await fetch(API_BASE_URL + '/getDashboardStats').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            document.getElementById('widget-total-customers').textContent = result.data.totalCustomers;
            document.getElementById('widget-total-meters').textContent = result.data.totalMeters;
            document.getElementById('widget-bills-pending').textContent = result.data.billsPending;
            document.getElementById('widget-monthly-revenue').textContent = `Rs. ${result.data.monthlyRevenue.toFixed(2)}`;
        }
    } catch (error) {
        console.error("Dashboard Stats Load Error:", error);
        // Display a small error in one of the widgets
        customerWidget.textContent = "Error";
    }
}


// --- Data Fetching: Load Customer Table Data ---
async function loadCustomers() {
    const tableBody = document.getElementById('customer-table-body');
    if (!tableBody) return; // Exit if we are not on the Customer Management page

    try {
        const result = await fetch(API_BASE_URL + '/getCustomers').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            tableBody.innerHTML = ''; 

            result.data.forEach(customer => {
                const row = tableBody.insertRow();
                
                row.insertCell().textContent = customer.CustomerID;
                row.insertCell().textContent = customer.CustomerName;
                row.insertCell().textContent = customer.CustomerType;
                row.insertCell().textContent = customer.Email || 'N/A';
                row.insertCell().textContent = customer.Phone;
                row.insertCell().textContent = customer.ServiceAddress;
                
                const actionCell = row.insertCell();
                actionCell.innerHTML = `
                    <a href="edit-customer.html?id=${customer.CustomerID}">
                        <button class="btn-action btn-edit">Edit</button>
                    </a>
                    <button class="btn-action btn-delete">Delete</button>
                `;
            });
            
        } else {
            tableBody.innerHTML = '<tr><td colspan="7">No customer data found in the database.</td></tr>';
        }

    } catch (error) {
        console.error("Customer Data Load Error:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-error">Failed to load data: ${error.message}. Ensure API is running.</td></tr>`;
    }
}

// --- Handle Customer Deletion ---
async function handleDeleteCustomer(customerId) {
    if (!confirm(`Are you sure you want to delete customer ${customerId}? This will delete all their meters, bills, and payments.`)) {
        return;
    }

    try {
        const result = await sendData('/deleteCustomer', { CustomerID: customerId });

        if (result && result.success) {
            displayMessage('success', result.message || 'Customer deleted successfully.');
            loadCustomers(); // Reload the customer table
        }
        // Note: displayMessage on error is handled by sendData()
    } catch (error) {
        console.error("Delete Customer Error:", error);
    }
}

// --- Load Specific Customer Data for Editing ---
async function loadCustomerForEdit() {
    const form = document.getElementById('edit-customer-form');
    if (!form) return; // Exit if not on the edit-customer page

    const params = new URLSearchParams(window.location.search);
    const customerId = params.get('id');

    if (!customerId) {
        displayMessage('error', 'No Customer ID provided.', form);
        return;
    }

    try {
        const result = await fetch(`${API_BASE_URL}/getCustomerDetails?id=${customerId}`).then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            const customer = result.data;
            
            document.getElementById('customer-id').value = customer.CustomerID;
            document.getElementById('customer-name').value = customer.CustomerName;
            document.getElementById('customer-type').value = customer.CustomerType;
            document.getElementById('email').value = customer.Email;
            document.getElementById('phone').value = customer.Phone;
            document.getElementById('service-address').value = customer.ServiceAddress;
            document.getElementById('billing-address').value = customer.BillingAddress;
            
            document.getElementById('edit-page-title').textContent = `Edit Customer (${customer.CustomerID})`;

        } else {
            displayMessage('error', result.message || 'Customer not found.', form);
        }
    } catch (error) {
        console.error("Load Customer for Edit Error:", error);
        displayMessage('error', `Failed to load customer data: ${error.message}`, form);
    }
}


// --- Data Fetching: Load Customer Dropdown Options ---
async function loadCustomerOptions() {
    const selectElement = document.getElementById('customer-id-select');
    if (!selectElement) return; // Exit if not on a page with this dropdown

    // Check if options are already loaded
    if (selectElement.options.length > 1) {
        return; // Already populated
    }

    try {
        const result = await fetch(API_BASE_URL + '/getCustomers').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            const currentValue = selectElement.value; // Preserve selected value if already set
            selectElement.innerHTML = ''; // Clear "Loading..."
            
            const placeholder = document.createElement('option');
            placeholder.value = "";
            placeholder.textContent = "Select a customer...";
            placeholder.disabled = true;
            selectElement.appendChild(placeholder);

            result.data.forEach(customer => {
                const option = document.createElement('option');
                option.value = customer.CustomerID;
                option.textContent = `${customer.CustomerID}: ${customer.CustomerName}`;
                selectElement.appendChild(option);
            });

            // Re-select the original value if it's still valid (for edit forms)
            if (currentValue && selectElement.querySelector(`option[value="${currentValue}"]`)) {
                selectElement.value = currentValue; 
            } else {
                selectElement.selectedIndex = 0; // Select placeholder
            }

        } else {
            selectElement.innerHTML = '<option value="" disabled selected>Error loading customers</option>';
        }
    } catch (error) {
        console.error("Customer Options Load Error:", error);
        selectElement.innerHTML = '<option value="" disabled selected>API Error</option>';
    }
}

// --- *** NEW FUNCTION *** ---
// --- Data Fetching: Load Utility Dropdown Options ---
async function loadUtilityOptions() {
    const selectElement = document.getElementById('utility-id');
    if (!selectElement) return; // Exit if not on a page with this dropdown

    // Check if options are already loaded
    if (selectElement.options.length > 1) {
        return; // Already populated
    }

    try {
        // This endpoint MUST exist in your server.js
        const result = await fetch(API_BASE_URL + '/getUtilityTypes').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            const currentValue = selectElement.value; // Preserve selected value
            selectElement.innerHTML = ''; // Clear "Loading..."
            
            const placeholder = document.createElement('option');
            placeholder.value = "";
            placeholder.textContent = "Select a utility...";
            placeholder.disabled = true;
            selectElement.appendChild(placeholder);

            result.data.forEach(utility => {
                const option = document.createElement('option');
                option.value = utility.UtilityID; // e.g., "ELEC"
                option.textContent = utility.UtilityName; // e.g., "Electricity"
                selectElement.appendChild(option);
            });

            if (currentValue && selectElement.querySelector(`option[value="${currentValue}"]`)) {
                selectElement.value = currentValue; 
            } else {
                selectElement.selectedIndex = 0;
            }

        } else {
            selectElement.innerHTML = '<option value="" disabled selected>Error loading utilities</option>';
        }
    } catch (error) {
        console.error("Utility Options Load Error:", error);
        selectElement.innerHTML = '<option value="" disabled selected>API Error</option>';
    }
}


// --- Data Fetching: Load Meter Table Data ---
async function loadMeters() {
    const tableBody = document.getElementById('meter-table-body');
    if (!tableBody) return; 

    try {
        const result = await fetch(API_BASE_URL + '/getMeters').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            tableBody.innerHTML = ''; 

            result.data.forEach(meter => {
                const row = tableBody.insertRow();
                
                row.insertCell().textContent = meter.MeterID;
                row.insertCell().textContent = meter.CustomerID;
                row.insertCell().textContent = meter.UtilityName; // From the JOIN
                
                const statusCell = row.insertCell();
                statusCell.innerHTML = `<span class="status-tag status-${meter.Status.toLowerCase().replace(' ', '-')}">${meter.Status}</span>`;
                
                row.insertCell().textContent = meter.Location || meter.ServiceAddress; // Use meter location or fallback to service address
                
                const actionCell = row.insertCell();
                actionCell.innerHTML = `
                    <a href="edit-meter.html?id=${meter.MeterID}">
                        <button class="btn-action btn-edit">Edit</button>
                    </a>
                    <button class="btn-action btn-delete">Delete</button>
                `;
            });
            
        } else {
            tableBody.innerHTML = '<tr><td colspan="6">No meter data found in the database.</td></tr>';
        }

    } catch (error) {
        console.error("Meter Data Load Error:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-error">Failed to load data: ${error.message}. Ensure API is running.</td></tr>`;
    }
}

// --- Handle Meter Deletion ---
async function handleDeleteMeter(meterId) {
    if (!confirm(`Are you sure you want to delete meter ${meterId}? This will also delete all associated readings, bills, and payments.`)) {
        return;
    }

    try {
        const result = await sendData('/deleteMeter', { MeterID: meterId });

        if (result && result.success) {
            displayMessage('success', result.message || 'Meter deleted.');
            loadMeters(); // Reloads the table (if on table page)

            // --- Redirect if we are on the edit page ---
            if (document.getElementById('edit-meter-form')) {
                displayMessage('success', 'Meter deleted. Redirecting to list...');
                setTimeout(() => {
                    window.location.href = 'meter-management.html';
                }, 2000);
            }
        }
    } catch (error) {
        console.error("Delete Meter Error:", error);
    }
}

// --- Load Specific Meter Data for Editing ---
async function loadMeterForEdit() {
    const form = document.getElementById('edit-meter-form');
    if (!form) return; // Exit if not on the edit-meter page

    // 1. Get the Meter ID from the URL (e.g., ?id=MTR-E-001)
    const params = new URLSearchParams(window.location.search);
    const meterId = params.get('id');

    if (!meterId) {
        displayMessage('error', 'No Meter ID provided.', form);
        return;
    }

    // --- *** THIS IS THE FIX *** ---
    // 2. Load BOTH dropdowns first and wait for them to finish
    await loadCustomerOptions();
    await loadUtilityOptions();
    // --- *** END OF FIX *** ---

    // 3. Fetch this specific meter's data
    try {
        const result = await fetch(`${API_BASE_URL}/getMeterDetails?id=${meterId}`).then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            const meter = result.data;
            
            // 4. Fill the form with the data (This will now work)
            document.getElementById('meter-id').value = meter.MeterID;
            document.getElementById('customer-id-select').value = meter.CustomerID; 
            document.getElementById('utility-id').value = meter.UtilityID;
            document.getElementById('status').value = meter.Status;
            document.getElementById('location').value = meter.Location;
            
            // Update the page titles
            document.getElementById('edit-page-title').textContent = `Edit Meter (${meter.MeterID})`;
            document.getElementById('edit-form-header').textContent = `Update Meter: ${meter.MeterID}`;

        } else {
            displayMessage('error', result.message || 'Meter not found.', form);
        }
    } catch (error) {
        console.error("Load Meter for Edit Error:", error);
        displayMessage('error', `Failed to load meter data: ${error.message}`, form);
    }
}


// --- Data Fetching: Load Tariff Table Data ---
async function loadTariffs() {
    const tableBody = document.getElementById('tariff-table-body');
    if (!tableBody) return; 

    try {
        const result = await fetch(API_BASE_URL + '/getTariffs').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            tableBody.innerHTML = ''; 

            result.data.forEach(tariff => {
                const row = tableBody.insertRow();
                
                row.insertCell().textContent = tariff.TariffID;
                row.insertCell().textContent = tariff.UtilityID;
                row.insertCell().textContent = tariff.TariffName;
                row.insertCell().textContent = `Rs. ${tariff.Rate.toFixed(2)}`;
                row.insertCell().textContent = `${tariff.MinUnits} - ${tariff.MaxUnits || 'Above'}`;
                
                const actionCell = row.insertCell();
                actionCell.innerHTML = `
                    <a href="edit-tariff.html?id=${tariff.TariffID}">
                        <button class="btn-action btn-edit">Edit</button>
                    </a>
                    <button class="btn-action btn-delete">Delete</button>
                `;
            });
            
        } else {
            tableBody.innerHTML = '<tr><td colspan="6">No tariff data found in the database.</td></tr>';
        }

    } catch (error) {
        console.error("Tariff Data Load Error:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-error">Failed to load data: ${error.message}. Ensure API is running.</td></tr>`;
    }
}

// --- Handle Tariff Deletion ---
async function handleDeleteTariff(tariffId) {
    if (!confirm(`Are you sure you want to delete tariff ${tariffId}?`)) {
        return;
    }

    try {
        const result = await sendData('/deleteTariff', { TariffID: tariffId });

        if (result && result.success) {
            displayMessage('success', result.message || 'Tariff plan deleted.');
            loadTariffs(); // Reloads the table (if on table page)

            // --- Redirect if we are on the edit page ---
            if (document.getElementById('edit-tariff-form')) {
                displayMessage('success', 'Tariff deleted. Redirecting to list...');
                setTimeout(() => {
                    window.location.href = 'tariff-plans.html';
                }, 2000);
            }
        }
    } catch (error) {
        console.error("Delete Tariff Error:", error);
    }
}

// --- Load Specific Tariff Data for Editing ---
async function loadTariffForEdit() {
    const form = document.getElementById('edit-tariff-form');
    if (!form) return; // Exit if not on the edit-tariff page

    // 1. Get the Tariff ID from the URL (e.g., ?id=ELEC-01)
    const params = new URLSearchParams(window.location.search);
    const tariffId = params.get('id');

    if (!tariffId) {
        displayMessage('error', 'No Tariff ID provided.', form);
        return;
    }

    // --- *** THIS IS THE FIX *** ---
    // 2. Load the utility dropdown first
    await loadUtilityOptions();
    // --- *** END OF FIX *** ---

    // 3. Fetch this specific tariff's data
    try {
        const result = await fetch(`${API_BASE_URL}/getTariffDetails?id=${tariffId}`).then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            const tariff = result.data;
            
            // 4. Fill the form with the data
            document.getElementById('tariff-id').value = tariff.TariffID;
            document.getElementById('tariff-name').value = tariff.TariffName;
            document.getElementById('utility-id').value = tariff.UtilityID; // This will now work
            document.getElementById('rate').value = tariff.Rate;
            
            // Update the page title
            document.getElementById('edit-page-title').textContent = `Edit Tariff (${tariff.TariffID})`;

        } else {
            displayMessage('error', result.message || 'Tariff not found.', form);
        }
    } catch (error) {
        console.error("Load Tariff for Edit Error:", error);
        displayMessage('error', `Failed to load tariff data: ${error.message}`, form);
    }
}


// --- Data Fetching: Load Admin Billing Ledger ---
async function loadBillingLedger() {
    const tableBody = document.getElementById('billing-ledger-body');
    if (!tableBody) return; 

    try {
        const result = await fetch(API_BASE_URL + '/getBillingLedger').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            tableBody.innerHTML = ''; 

            result.data.forEach(bill => {
                const row = tableBody.insertRow();
                
                row.insertCell().textContent = bill.BillID;
                row.insertCell().textContent = bill.CustomerID;
                row.insertCell().textContent = new Date(bill.BillDate).toLocaleDateString();
                row.insertCell().textContent = `Rs. ${bill.AmountDue.toFixed(2)}`;
                
                // Add status tag
                const statusCell = row.insertCell();
                statusCell.innerHTML = `<span class="status-tag status-${bill.Status.toLowerCase()}">${bill.Status}</span>`;

                row.insertCell().textContent = bill.PaymentDate ? new Date(bill.PaymentDate).toLocaleDateString() : '---';
            });
            
        } else {
            tableBody.innerHTML = '<tr><td colspan="6">No billing data found.</td></tr>';
        }

    } catch (error) {
        console.error("Billing Ledger Load Error:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-error">Failed to load data: ${error.message}. Ensure API is running.</td></tr>`;
    }
}

// --- Data Fetching: Load Field Officer Routes ---
async function loadRoutes() {
    const cardContainer = document.getElementById('route-card-container');
    if (!cardContainer) return; // Exit if not on the routes page

    try {
        const result = await fetch(API_BASE_URL + '/getRoutes').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data && result.data.length > 0) {
            cardContainer.innerHTML = ''; 

            result.data.forEach(route => {
                const card = document.createElement('a');
                card.className = 'route-card';
                card.href = `enter-reading.html?meterId=${route.MeterID}&address=${encodeURIComponent(route.ServiceAddress)}`;
                
                card.innerHTML = `
                    <div class="card-header">
                        <span class="utility-type ${route.UtilityName.toLowerCase()}">${route.UtilityName}</span>
                        <span class="meter-id">${route.MeterID}</span>
                    </div>
                    <div class="card-body">
                        <p class="customer-name">${route.CustomerName}</p>
                        <p class="address">${route.ServiceAddress}</p>
                    </div>
                    <div class="card-footer">
                        Enter Reading &rarr;
                    </div>
                `;
                cardContainer.appendChild(card);
            });
            
        } else {
            cardContainer.innerHTML = '<p class="no-routes">No routes found for today. All readings are complete!</p>';
        }

    } catch (error) {
        console.error("Route Data Load Error:", error);
        cardContainer.innerHTML = `<p class="no-routes text-error">Failed to load routes: ${error.message}. Ensure API is running.</p>`;
    }
}

// --- Page-Specific Logic for Field Officer Form ---
function prefillReadingForm() {
    const form = document.getElementById('submit-reading-form');
    if (!form) return; // Exit if not on the reading form page

    const params = new URLSearchParams(window.location.search);
    const meterId = params.get('meterId');
    const address = params.get('address');

    if (meterId) {
        form.querySelector('#meter-id').value = meterId;
    }
    if (address) {
        form.querySelector('#service-address').value = address;
    }
    
    // Set reading date to today by default
    const today = new Date().toISOString().split('T')[0];
    form.querySelector('#reading-date').value = today;
}

// --- Data Fetching: Load Manager Defaulters Report ---
async function loadDefaultersReport() {
    const tableBody = document.getElementById('defaulters-table-body');
    if (!tableBody) return; 

    try {
        const result = await fetch(API_BASE_URL + '/getDefaultersReport').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            tableBody.innerHTML = ''; 

            result.data.forEach(item => {
                const row = tableBody.insertRow();
                
                row.insertCell().textContent = item.BillID;
                row.insertCell().textContent = item.CustomerName;
                row.insertCell().textContent = item.Phone;
                row.insertCell().textContent = new Date(item.DueDate).toLocaleDateString();
                row.insertCell().textContent = `Rs. ${item.AmountDue.toFixed(2)}`;
                
                const statusCell = row.insertCell();
                statusCell.innerHTML = `<span class="status-tag status-${item.Status.toLowerCase()}">${item.Status}</span>`;
            });
            
        } else {
            tableBody.innerHTML = '<tr><td colspan="6">No defaulters found.</td></tr>';
        }

    } catch (error) {
        console.error("Defaulters Report Load Error:", error);
        tableBody.innerHTML = `<tr><td colspan="6" class="text-error">Failed to load data: ${error.message}. Ensure API is running.</td></tr>`;
    }
}

// --- Data Fetching: Load Manager Revenue Report ---
async function loadRevenueReport() {
    const tableBody = document.getElementById('revenue-table-body');
    if (!tableBody) return; 

    try {
        const result = await fetch(API_BASE_URL + '/getRevenueReport').then(res => {
            if (!res.ok) throw new Error(`HTTP status ${res.status}`);
            return res.json();
        });

        if (result && result.success && result.data) {
            tableBody.innerHTML = ''; 

            let grandTotal = 0;
            result.data.forEach(item => {
                const row = tableBody.insertRow();
                
                row.insertCell().textContent = item.UtilityName;
                row.insertCell().textContent = item.TotalPayments;
                row.insertCell().textContent = `Rs. ${item.TotalRevenue.toFixed(2)}`;
                grandTotal += item.TotalRevenue;
            });

            // Add a total row
            const totalRow = tableBody.insertRow();
            totalRow.className = 'table-total-row';
            totalRow.insertCell().textContent = 'Grand Total';
            totalRow.insertCell().textContent = '';
            totalRow.insertCell().textContent = `Rs. ${grandTotal.toFixed(2)}`;
            
        } else {
            tableBody.innerHTML = '<tr><td colspan="3">No revenue data found for this period.</td></tr>';
        }

    } catch (error) {
        console.error("Revenue Report Load Error:", error);
        tableBody.innerHTML = `<tr><td colspan="3" class="text-error">Failed to load data: ${error.message}. Ensure API is running.</td></tr>`;
    }
}

// --- Helper function to dynamically build report tables ---
function buildReportTable(headers, data) {
    const tableHeader = document.getElementById('report-table-header');
    const tableBody = document.getElementById('report-table-body');
    
    if (!tableHeader || !tableBody) return;

    // 1. Clear old data
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';

    // 2. Build Header
    const headerRow = tableHeader.insertRow();
    headers.forEach(headerText => {
        headerRow.insertCell().textContent = headerText;
    });

    // 3. Build Body
    if (data && data.length > 0) {
        data.forEach(dataRow => {
            const row = tableBody.insertRow();
            // Loop through the object properties in order
            Object.values(dataRow).forEach(value => {
                // Format dates nicely
                if (value && (value.toString().includes('T') || value.toString().includes('-'))) {
                    const d = new Date(value);
                    if (!isNaN(d)) {
                        value = d.toLocaleDateString();
                    }
                }
                row.insertCell().textContent = value;
            });
        });
    } else {
        tableBody.innerHTML = `<tr><td colspan="${headers.length}" style="text-align: center;">No data found for this report.</td></tr>`;
    }
}

// --- Main Form Submission Handler ---
async function handleFormSubmission(event) {
    event.preventDefault(); // Stop the default browser form submission

    const form = event.target;
    const formId = form.id;
    const formData = Object.fromEntries(new FormData(form).entries());

    let endpoint = '';
    let successMessage = '';
    
    // --- Determine API Endpoint based on Form ID ---
    
    if (formId === 'add-customer-form') {
        endpoint = '/addCustomer';
        successMessage = 'Customer registered successfully!';
        
    } else if (formId === 'record-payment-form') {
        endpoint = '/recordPayment';
        successMessage = 'Payment recorded and balance updated!';
        
    } else if (formId === 'add-meter-form') {
        endpoint = '/addMeter';
        successMessage = 'New meter registered and linked to customer!';

    } else if (formId === 'add-tariff-form') {
        endpoint = '/addTariff';
        successMessage = 'New tariff plan saved!';
        
    } else if (formId === 'generate-bill-form') {
        endpoint = '/generateBill';
        successMessage = 'Bill generation started successfully!';
        
    } else if (formId === 'submit-reading-form') {
        endpoint = '/submitReading';
        successMessage = 'Meter reading submitted successfully!';

    } else if (formId === 'edit-customer-form') {
        endpoint = '/updateCustomer';
        successMessage = 'Customer details updated successfully!';
    
    } else if (formId === 'edit-tariff-form') {
        endpoint = '/updateTariff';
        successMessage = 'Tariff plan updated successfully!';
    
    } else if (formId === 'edit-meter-form') {
        endpoint = '/updateMeter';
        successMessage = 'Meter details updated successfully!';
        
    } else if (formId === 'admin-report-form') {
        endpoint = '/getAdminReport';
        // This form is handled differently, it expects data back
        
        try {
            const result = await sendData(endpoint, formData);
            if (result && result.success) {
                document.getElementById('report-title').textContent = `Report: ${result.reportName}`;
                buildReportTable(result.headers, result.data);
                displayMessage('success', 'Report generated successfully.', form);
            }
        } catch (err) {
            // Error is already logged by sendData
        }
        return; // Stop here, don't run the standard sendData block
        
    } else {
        console.warn(`No handler for form ID: ${formId}`);
        displayMessage('warning', 'Form action not yet implemented.', form);
        return; 
    }

    // --- Send Data to API (Standard POST forms) ---
    sendData(endpoint, formData)
        .then(result => {
            if (result && result.success) {
                displayMessage('success', successMessage, form);
                
                // Don't reset edit forms, do reset add forms
                if (formId.startsWith('add-')) {
                    form.reset();
                }

                // Special redirect for field officer after submission
                if (formId === 'submit-reading-form') {
                    displayMessage('success', 'Success! Returning to routes list...', form);
                    setTimeout(() => {
                        window.location.href = 'view-routes.html';
                    }, 2000);
                }

                // Reload the relevant tables after a successful action
                if (endpoint.includes('Customer')) {
                    loadCustomers();
                } else if (endpoint.includes('Meter')) {
                    loadMeters();
                } else if (endpoint.includes('Tariff')) {
                    loadTariffs();
                } else if (endpoint.includes('Payment')) {
                    loadBillingLedger();
                }
            }
        });
}

// --- Initialize Event Listeners on Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Find all forms in the application (excluding the login form, which has its own JS)
    const allDataForms = document.querySelectorAll('form.data-form');

    allDataForms.forEach(form => {
        // Attach the main submission handler
        form.addEventListener('submit', handleFormSubmission);
    });

    // --- Conditional Data Loading on Page Load ---
    if (document.getElementById('widget-total-customers')) {
        loadDashboardStats();
    }
    if (document.getElementById('customer-table-body')) {
        loadCustomers();
    }
    if (document.getElementById('meter-table-body')) {
        loadMeters();
    }
    if (document.getElementById('tariff-table-body')) {
        loadTariffs();
    }
    if (document.getElementById('billing-ledger-body')) {
        loadBillingLedger();
    }
    // --- Field Officer Specific Loaders ---
    if (document.getElementById('route-card-container')) {
        loadRoutes();
    }
    if (document.getElementById('submit-reading-form')) {
        prefillReadingForm();
    }
    // --- Manager Specific Loaders ---
    if (document.getElementById('defaulters-table-body')) {
        loadDefaultersReport();
    }
    if (document.getElementById('revenue-table-body')) {
        loadRevenueReport();
    }
    // --- Dropdown and Edit Form Loaders ---
    if (document.getElementById('customer-id-select')) {
        loadCustomerOptions();
    }
    // --- *** NEW *** ---
    // Load utilities for any page that has the utility dropdown
    if (document.getElementById('utility-id')) {
        loadUtilityOptions();
    }
    // --- *** END NEW *** ---
    if (document.getElementById('edit-customer-form')) {
        loadCustomerForEdit();
    }
    if (document.getElementById('edit-tariff-form')) {
        loadTariffForEdit();
    }
    if (document.getElementById('edit-meter-form')) {
        loadMeterForEdit();
    }

    // --- Event Delegation for TABLE Delete Buttons ---
    const customerTableBody = document.getElementById('customer-table-body');
    if (customerTableBody) {
        customerTableBody.addEventListener('click', (event) => {
            if (event.target.classList.contains('btn-delete')) {
                const tableRow = event.target.closest('tr');
                const customerId = tableRow.cells[0].textContent;
                if (customerId) {
                    handleDeleteCustomer(customerId);
                }
            }
        });
    }

    const meterTableBody = document.getElementById('meter-table-body');
    if (meterTableBody) {
        meterTableBody.addEventListener('click', (event) => {
            if (event.target.classList.contains('btn-delete')) {
                const tableRow = event.target.closest('tr');
                const meterId = tableRow.cells[0].textContent;
                if (meterId) {
                    handleDeleteMeter(meterId);
                }
            }
        });
    }

    const tariffTableBody = document.getElementById('tariff-table-body');
    if (tariffTableBody) {
        tariffTableBody.addEventListener('click', (event) => {
            if (event.target.classList.contains('btn-delete')) {
                const tableRow = event.target.closest('tr');
                const tariffId = tableRow.cells[0].textContent;
                if (tariffId) {
                    handleDeleteTariff(tariffId);
                }
            }
        });
    }

    // --- Event Listeners for EDIT PAGE Delete Buttons ---
    const singleTariffDeleteBtn = document.getElementById('delete-tariff-btn');
    if (singleTariffDeleteBtn) {
        singleTariffDeleteBtn.addEventListener('click', () => {
            const tariffId = document.getElementById('tariff-id').value;
            if (tariffId) {
                handleDeleteTariff(tariffId);
            }
        });
    }

    const singleMeterDeleteBtn = document.getElementById('delete-meter-btn');
    if (singleMeterDeleteBtn) {
        singleMeterDeleteBtn.addEventListener('click', () => {
            const meterId = document.getElementById('meter-id').value;
            if (meterId) {
                handleDeleteMeter(meterId);
            }
        });
    }
});
