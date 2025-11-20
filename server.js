// This Node.js server acts as the API layer (the 'plumbing') between your HTML/JS frontend
// and your MS SQL Server database.
const bcrypt = require('bcryptjs');
const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
const PORT = 3000;

// --- CRITICAL CONFIGURATION ---
const dbConfig = {
    user: 'sa',
    password: '0763992144u',
    server: 'DESKTOP-VC443FH', // Machine Name
    database: 'UMS_System', // The database name you provided
    options: {
        trustedConnection: false, // Set to true ONLY if using Windows Authentication
        enableArithAbort: true,
        trustServerCertificate: true,
        instanceName: 'SQLEXPRESS' // Your instance name
    }
};

// --- Middleware ---
app.use(cors()); // Allows our HTML page (which runs locally) to talk to this server
app.use(express.json()); // Allows the server to parse JSON data sent from the forms

// --- Database Connection Pool ---
let pool;

async function connectDb() {
    try {
        if (!pool) {
            pool = await sql.connect(dbConfig);
            console.log('Database connection established successfully.');
        }
        return pool;
    } catch (err) {
        console.error('Database Connection Failed! Details:', err.message);
        console.error('Check your dbConfig: user, password, server, and instanceName.');
        throw err;
    }
}

// Immediately attempt connection when the server starts
connectDb();

// ----------------------------------------------------------------------
// 1. AUTHENTICATION ENDPOINT
// ----------------------------------------------------------------------

app.post('/login', async (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing username, password, or role.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        
        request.input('username', sql.NVarChar, username);
        request.input('password', sql.NVarChar, password); 
        request.input('role', sql.NVarChar, role);

        const result = await request.query(
            `SELECT UserID, FullName, Role 
             FROM [dbo].[User_Staff] 
             WHERE Username = @username 
             AND PasswordHash = @password 
             AND Role = @role`
        );

        if (result.recordset.length > 0) {
            res.json({ success: true, user: result.recordset[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials or incorrect role selected.' });
        }

    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ success: false, message: 'Server error during login process.' });
    }
});


// ----------------------------------------------------------------------
// 2. DATA RETRIEVAL (GET) ENDPOINTS
// ----------------------------------------------------------------------

// --- GET /getDashboardStats (Admin) ---
app.get('/getDashboardStats', async (req, res) => {
    try {
        const pool = await connectDb();
        
        const customerResult = await pool.request().query('SELECT COUNT(*) AS total FROM [dbo].[Customer]');
        const meterResult = await pool.request().query('SELECT COUNT(*) AS total FROM [dbo].[Meter]');
        const billsResult = await pool.request().query(`SELECT COUNT(*) AS total FROM [dbo].[Bill] WHERE Status = 'Unpaid'`);
        const revenueResult = await pool.request().query(
            `SELECT SUM(PaymentAmount) AS total 
             FROM [dbo].[Payment] 
             WHERE MONTH(PaymentDate) = MONTH(GETDATE()) 
             AND YEAR(PaymentDate) = YEAR(GETDATE())`
        );

        res.json({
            success: true,
            data: {
                totalCustomers: customerResult.recordset[0].total,
                totalMeters: meterResult.recordset[0].total,
                billsPending: billsResult.recordset[0].total,
                monthlyRevenue: revenueResult.recordset[0].total || 0
            }
        });

    } catch (err) {
        console.error('Get Dashboard Stats Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve dashboard stats.' });
    }
});

// --- GET /getCustomers (Admin) ---
app.get('/getCustomers', async (req, res) => {
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[Customer]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Customers Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve customer data.' });
    }
});

// --- GET /getCustomerDetails (Admin Edit Page) ---
app.get('/getCustomerDetails', async (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        request.input('CustomerID', sql.NVarChar, id);
        
        const result = await request.query('SELECT * FROM [dbo].[Customer] WHERE CustomerID = @CustomerID');

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Customer not found.' });
        }
    } catch (err) {
        console.error('Get Customer Details Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve customer details.' });
    }
});


// --- GET /getMeters (Admin) ---
app.get('/getMeters', async (req, res) => {
    try {
        const pool = await connectDb();
        const query = `
            SELECT 
                M.MeterID, M.CustomerID, U.UtilityName, M.Status, C.ServiceAddress, M.Location
            FROM [dbo].[Meter] AS M
            JOIN [dbo].[Customer] AS C ON M.CustomerID = C.CustomerID
            JOIN [dbo].[Utility_Type] AS U ON M.UtilityID = U.UtilityID
        `;
        const result = await pool.request().query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Meters Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve meter data.' });
    }
});

// --- GET /getMeterDetails (Admin Edit Page) ---
app.get('/getMeterDetails', async (req, res) => {
    const { id } = req.query; 
    if (!id) {
        return res.status(400).json({ success: false, message: 'Meter ID is required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        request.input('MeterID', sql.NVarChar, id);
        
        const result = await request.query('SELECT * FROM [dbo].[Meter] WHERE MeterID = @MeterID');

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Meter not found.' });
        }
    } catch (err) {
        console.error('Get Meter Details Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve meter details.' });
    }
});

// --- GET /getTariffs (Admin) ---
app.get('/getTariffs', async (req, res) => {
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[Tariff]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Tariffs Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve tariff data.' });
    }
});

// --- GET /getTariffDetails (Admin Edit Page) ---
app.get('/getTariffDetails', async (req, res) => {
    const { id } = req.query; 
    if (!id) {
        return res.status(400).json({ success: false, message: 'Tariff ID is required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        request.input('TariffID', sql.NVarChar, id);
        
        const result = await request.query('SELECT * FROM [dbo].[Tariff] WHERE TariffID = @TariffID');

        if (result.recordset.length > 0) {
            res.json({ success: true, data: result.recordset[0] });
        } else {
            res.status(404).json({ success: false, message: 'Tariff not found.' });
        }
    } catch (err) {
        console.error('Get Tariff Details Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve tariff details.' });
    }
});

// --- GET /getBillingLedger (Admin) ---
app.get('/getBillingLedger', async (req, res) => {
    try {
        const pool = await connectDb();
        const query = `
            SELECT 
                B.BillID, B.CustomerID, B.BillDate, B.AmountDue, B.Status, P.PaymentDate
            FROM [dbo].[Bill] AS B
            LEFT JOIN [dbo].[Payment] AS P ON B.BillID = P.BillID
            ORDER BY B.BillDate DESC
        `;
        const result = await pool.request().query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Billing Ledger Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve billing ledger.' });
    }
});

// --- GET /getRoutes (Field Officer) ---
app.get('/getRoutes', async (req, res) => {
    try {
        const pool = await connectDb();
        const query = `
            SELECT M.MeterID, C.CustomerName, C.ServiceAddress, U.UtilityName
            FROM [dbo].[Meter] AS M
            JOIN [dbo].[Customer] AS C ON M.CustomerID = C.CustomerID
            JOIN [dbo].[Utility_Type] AS U ON M.UtilityID = U.UtilityID
            WHERE M.Status = 'Active'
            AND M.MeterID NOT IN (
                SELECT R.MeterID
                FROM [dbo].[Meter_Reading] AS R
                WHERE MONTH(R.ReadingDate) = MONTH(GETDATE())
                AND YEAR(R.ReadingDate) = YEAR(GETDATE())
            )
        `;
        const result = await pool.request().query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Routes Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve routes.' });
    }
});

// --- GET /getDefaultersReport (Manager) ---
app.get('/getDefaultersReport', async (req, res) => {
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[vw_DefaultersList]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Defaulters Report Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve defaulters report.' });
    }
});

// --- GET /getRevenueReport (Manager) ---
app.get('/getRevenueReport', async (req, res) => {
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[vw_MonthlyRevenueReport]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Revenue Report Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to retrieve revenue report.' });
    }
});

// --- *** THIS ENDPOINT WAS MISSING *** ---
// --- GET /getUtilityTypes (Required for Edit Forms) ---
app.get('/getUtilityTypes', async (req, res) => {
    console.log("Fetching utility types for dropdowns...");
    try {
        const pool = await connectDb();
        const result = await pool.request().query('SELECT * FROM [dbo].[Utility_Type]');
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Get Utility Types Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch from [dbo].[Utility_Type]' });
    }
});


// ----------------------------------------------------------------------
// 3. DATA SUBMISSION (POST) ENDPOINTS
// ----------------------------------------------------------------------

// --- POST /getAdminReport (Admin) ---
app.post('/getAdminReport', async (req, res) => {
    const { 'report-type': reportType, 'start-date': startDate, 'end-date': endDate } = req.body;

    if (!reportType) {
        return res.status(400).json({ success: false, message: 'Report type is required.' });
    }

    let query = '';
    let headers = [];
    let reportName = '';
    const request = (await connectDb()).request();

    try {
        if (reportType === 'new-customers') {
            reportName = 'New Customer Registrations';
            headers = ['Customer ID', 'Name', 'Type', 'Registration Date', 'Email', 'Phone'];
            query = `
                SELECT CustomerID, CustomerName, CustomerType, RegistrationDate, Email, Phone
                FROM [dbo].[Customer]
                WHERE RegistrationDate BETWEEN @startDate AND @endDate
                ORDER BY RegistrationDate DESC
            `;
            request.input('startDate', sql.Date, startDate || '1900-01-01');
            request.input('endDate', sql.Date, endDate || '2099-12-31');
        
        } else if (reportType === 'readings-log') {
            reportName = 'Meter Reading Log';
            headers = ['Reading ID', 'Meter ID', 'Reading Value', 'Reading Date', 'Field Officer ID'];
            query = `
                SELECT R.ReadingID, R.MeterID, R.ReadingValue, R.ReadingDate, R.UserID
                FROM [dbo].[Meter_Reading] AS R
                WHERE R.ReadingDate BETWEEN @startDate AND @endDate
                ORDER BY R.ReadingDate DESC
            `;
            request.input('startDate', sql.Date, startDate || '1900-01-01');
            request.input('endDate', sql.Date, endDate || '2099-12-31');

        } else if (reportType === 'payment-log') {
            reportName = 'Payment Received Log';
            headers = ['Payment ID', 'Bill ID', 'Payment Amount', 'Payment Date', 'Method', 'Cashier ID'];
            query = `
                SELECT P.PaymentID, P.BillID, P.PaymentAmount, P.PaymentDate, P.PaymentMethod, P.UserID
                FROM [dbo].[Payment] AS P
                WHERE P.PaymentDate BETWEEN @startDate AND @endDate
                ORDER BY P.PaymentDate DESC
            `;
            request.input('startDate', sql.DateTime, startDate ? `${startDate} 00:00:00` : '1900-01-01');
            request.input('endDate', sql.DateTime, endDate ? `${endDate} 23:59:59` : '2099-12-31');
            
        } else {
            return res.status(400).json({ success: false, message: 'Invalid report type selected.' });
        }

        const result = await request.query(query);
        res.json({ success: true, reportName, headers, data: result.recordset });

    } catch (err) {
        console.error(`Admin Report Error (${reportType}):`, err.message);
        res.status(500).json({ success: false, message: `Failed to generate report: ${err.message}` });
    }
});

// --- POST /addCustomer (Admin) ---
app.post('/addCustomer', async (req, res) => {
    const { 
        'customer-name': customerName, 
        'customer-type': customerType, 
        email, 
        phone, 
        'service-address': serviceAddress, 
        'billing-address': billingAddress 
    } = req.body;

    const customerId = 'CUST-' + Math.floor(Math.random() * 900 + 100);

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            INSERT INTO [dbo].[Customer] 
                (CustomerID, CustomerName, CustomerType, Email, Phone, ServiceAddress, BillingAddress, RegistrationDate)
            VALUES 
                (@customerId, @customerName, @customerType, @email, @phone, @serviceAddress, @billingAddress, GETDATE())
        `;

        request.input('customerId', sql.NVarChar, customerId);
        request.input('customerName', sql.NVarChar, customerName);
        request.input('customerType', sql.NVarChar, customerType);
        request.input('email', sql.NVarChar, email);
        request.input('phone', sql.NVarChar, phone);
        request.input('serviceAddress', sql.NVarChar, serviceAddress);
        request.input('billingAddress', sql.NVarChar, billingAddress);
        
        await request.query(query);
        res.json({ success: true, message: 'Customer added.', customerId: customerId });
    } catch (err) {
        console.error('Add Customer Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to add customer. Check database logs.' });
    }
});

// --- POST /updateCustomer (Admin Edit Page) ---
app.post('/updateCustomer', async (req, res) => {
    const { 
        'customer-id': customerId,
        'customer-name': customerName, 
        'customer-type': customerType, 
        email, 
        phone, 
        'service-address': serviceAddress, 
        'billing-address': billingAddress 
    } = req.body;

    if (!customerId) {
        return res.status(400).json({ success: false, message: 'Customer ID is missing.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            UPDATE [dbo].[Customer]
            SET 
                CustomerName = @customerName,
                CustomerType = @customerType,
                Email = @email,
                Phone = @phone,
                ServiceAddress = @serviceAddress,
                BillingAddress = @billingAddress
            WHERE 
                CustomerID = @customerId
        `;

        request.input('customerId', sql.NVarChar, customerId);
        request.input('customerName', sql.NVarChar, customerName);
        request.input('customerType', sql.NVarChar, customerType);
        request.input('email', sql.NVarChar, email);
        request.input('phone', sql.NVarChar, phone);
        request.input('serviceAddress', sql.NVarChar, serviceAddress);
        request.input('billingAddress', sql.NVarChar, billingAddress);
        
        await request.query(query);
        res.json({ success: true, message: 'Customer details updated successfully.' });
    } catch (err) {
        console.error('Update Customer Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update customer.' });
    }
});

// --- POST /deleteCustomer (Admin) ---
app.post('/deleteCustomer', async (req, res) => {
    const { CustomerID } = req.body;
    if (!CustomerID) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    const pool = await connectDb();
    const transaction = pool.transaction();

    try {
        await transaction.begin();
        const request = transaction.request();
        request.input('CustomerID', sql.NVarChar, CustomerID);

        await request.query(`
            DELETE FROM [dbo].[Payment] 
            WHERE BillID IN (SELECT BillID FROM [dbo].[Bill] WHERE CustomerID = @CustomerID)
        `);
        await request.query(`DELETE FROM [dbo].[Bill] WHERE CustomerID = @CustomerID`);
        await request.query(`
            DELETE FROM [dbo].[Meter_Reading] 
            WHERE MeterID IN (SELECT MeterID FROM [dbo].[Meter] WHERE CustomerID = @CustomerID)
        `);
        await request.query(`DELETE FROM [dbo].[Meter] WHERE CustomerID = @CustomerID`);
        const result = await request.query(`DELETE FROM [dbo].[Customer] WHERE CustomerID = @CustomerID`);

        await transaction.commit();

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Customer and all related data deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Customer not found.' });
        }
    } catch (err) {
        await transaction.rollback();
        console.error('Delete Customer Error:', err.message);
        res.status(500).json({ success: false, message: `Failed to delete customer: ${err.message}` });
    }
});


// --- POST /recordPayment (Cashier) ---
app.post('/recordPayment', async (req, res) => {
    const { 
        'bill-id': billId, 
        'payment-amount': paymentAmount, 
        'payment-method': paymentMethod 
    } = req.body;

    const cashierId = 'U-003'; 

    try {
        const pool = await connectDb();
        const request = pool.request();

        const result = await request
            .input('BillID', sql.NVarChar, billId)
            .input('UserID', sql.NVarChar, cashierId)
            .input('PaymentAmount', sql.Decimal(10, 2), paymentAmount)
            .input('PaymentMethod', sql.NVarChar, paymentMethod)
            .execute('[dbo].[sp_RecordPayment]'); 

        res.json({ success: true, message: 'Payment successfully recorded and bill updated.' });
    } catch (err) {
        console.error('Record Payment Error:', err.message);
        res.status(500).json({ success: false, message: 'Payment failed: Bill not found or database error.' });
    }
});

// --- POST /addMeter (Admin) ---
app.post('/addMeter', async (req, res) => {
    const { 
        'customer-id': customerId, 
        'meter-id': meterId, 
        'utility-type': utilityId, 
        status, 
        location 
    } = req.body;

    if (!customerId || !meterId || !utilityId || !status) {
        return res.status(400).json({ success: false, message: 'Missing required meter details.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            INSERT INTO [dbo].[Meter] 
                (MeterID, CustomerID, UtilityID, Status, Location, InstallDate)
            VALUES 
                (@meterId, @customerId, @utilityId, @status, @location, GETDATE())
        `;

        request.input('meterId', sql.NVarChar, meterId);
        request.input('customerId', sql.NVarChar, customerId);
        request.input('utilityId', sql.NVarChar, utilityId); 
        request.input('status', sql.NVarChar, status);
        request.input('location', sql.NVarChar, location);
        
        await request.query(query);
        res.json({ success: true, message: 'New meter registered successfully.' });
    } catch (err) {
        console.error('Add Meter Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to register meter. Check if Meter ID or Customer ID are valid.' });
    }
});

// --- POST /deleteMeter (Admin) ---
app.post('/deleteMeter', async (req, res) => {
    const { MeterID } = req.body;
    if (!MeterID) {
        return res.status(400).json({ success: false, message: 'Meter ID is required.' });
    }

    const pool = await connectDb();
    const transaction = pool.transaction();

    try {
        await transaction.begin();
        const request = transaction.request();
        request.input('MeterID', sql.NVarChar, MeterID);

        // 1. Delete Payments
        await request.query(`
            DELETE FROM [dbo].[Payment]
            WHERE BillID IN (
                SELECT BillID FROM [dbo].[Bill] 
                WHERE ReadingID IN (
                    SELECT ReadingID FROM [dbo].[Meter_Reading] WHERE MeterID = @MeterID
                )
            )
        `);

        // 2. Delete Bills
        await request.query(`
            DELETE FROM [dbo].[Bill]
            WHERE ReadingID IN (
                SELECT ReadingID FROM [dbo].[Meter_Reading] WHERE MeterID = @MeterID
            )
        `);
        
        // 3. Delete Meter Readings
        await request.query(`DELETE FROM [dbo].[Meter_Reading] WHERE MeterID = @MeterID`);
        
        // 4. Finally, Delete the Meter
        const result = await request.query(`DELETE FROM [dbo].[Meter] WHERE MeterID = @MeterID`);

        await transaction.commit();

        if (result.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Meter and all its readings, bills, and payments deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Meter not found.' });
        }
    } catch (err) {
        await transaction.rollback();
        console.error('Delete Meter Error:', err.message);
        res.status(500).json({ success: false, message: `Failed to delete meter: ${err.message}` });
    }
});

// --- POST /updateMeter (Admin Edit Page) ---
app.post('/updateMeter', async (req, res) => {
    const { 
        'meter-id': meterId,
        'customer-id': customerId, 
        'utility-id': utilityId, 
        status,
        location
    } = req.body;

    if (!meterId || !customerId || !utilityId || !status) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            UPDATE [dbo].[Meter]
            SET 
                CustomerID = @customerId,
                UtilityID = @utilityId,
                Status = @status,
                Location = @location
            WHERE 
                MeterID = @meterId
        `;

        request.input('meterId', sql.NVarChar, meterId);
        request.input('customerId', sql.NVarChar, customerId);
        request.input('utilityId', sql.NVarChar, utilityId);
        request.input('status', sql.NVarChar, status);
        request.input('location', sql.NVarChar, location);
        
        await request.query(query);
        res.json({ success: true, message: 'Meter details updated successfully.' });
    } catch (err) {
        console.error('Update Meter Error:', err.message);
        res.status(500).json({ success: false, message: `Failed to update meter: ${err.message}` });
    }
});

// --- POST /addTariff (Admin) ---
app.post('/addTariff', async (req, res) => {
    const { 
        'tariff-id': tariffId, 
        'utility-type': utilityId, 
        'tariff-name': tariffName, 
        rate 
    } = req.body;

    if (!tariffId || !utilityId || !tariffName || !rate) {
        return res.status(400).json({ success: false, message: 'Missing required tariff fields (ID, Utility, Name, Rate).' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            INSERT INTO [dbo].[Tariff] 
                (TariffID, UtilityID, TariffName, Rate, MinUnits, FixedCharge)
            VALUES 
                (@tariffId, @utilityId, @tariffName, @rate, 0, 0)
        `;

        request.input('tariffId', sql.NVarChar, tariffId);
        request.input('utilityId', sql.NVarChar, utilityId);
        request.input('tariffName', sql.NVarChar, tariffName);
        request.input('rate', sql.Decimal(10, 2), rate);
        
        await request.query(query);
        res.json({ success: true, message: 'New tariff plan registered successfully.' });
    } catch (err) {
        console.error('Add Tariff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to register tariff. Check if Tariff ID already exists.' });
    }
});

// --- POST /deleteTariff (Admin) ---
app.post('/deleteTariff', async (req, res) => {
    const { TariffID } = req.body;
    if (!TariffID) {
        return res.status(400).json({ success: false, message: 'Tariff ID is required.' });
    }

    const pool = await connectDb();
    const transaction = pool.transaction();

    try {
        await transaction.begin();
        const request = transaction.request();
        request.input('TariffID', sql.NVarChar, TariffID);

        const checkResult = await request.query(`SELECT COUNT(*) as count FROM [dbo].[Bill] WHERE TariffID = @TariffID`);
        
        if (checkResult.recordset[0].count > 0) {
            await transaction.rollback(); 
            return res.status(400).json({ 
                success: false, 
                message: `Cannot delete Tariff ID ${TariffID}: It is already linked to ${checkResult.recordset[0].count} existing bill(s).` 
            });
        }

        const deleteResult = await request.query(`DELETE FROM [dbo].[Tariff] WHERE TariffID = @TariffID`);

        await transaction.commit();
        
        if (deleteResult.rowsAffected[0] > 0) {
            res.json({ success: true, message: 'Tariff plan deleted successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'Tariff plan not found.' });
        }
    } catch (err) {
        await transaction.rollback();
        console.error('Delete Tariff Error:', err.message);
        res.status(500).json({ success: false, message: `Failed to delete tariff: ${err.message}` });
    }
});

// --- POST /updateTariff (Admin Edit Page) ---
app.post('/updateTariff', async (req, res) => {
    const { 
        'tariff-id': tariffId,
        'tariff-name': tariffName, 
        'utility-id': utilityId, 
        rate
    } = req.body;

    if (!tariffId || !tariffName || !utilityId || !rate) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            UPDATE [dbo].[Tariff]
            SET 
                TariffName = @tariffName,
                UtilityID = @utilityId,
                Rate = @rate
            WHERE 
                TariffID = @tariffId
        `;

        request.input('tariffId', sql.NVarChar, tariffId);
        request.input('tariffName', sql.NVarChar, tariffName);
        request.input('utilityId', sql.NVarChar, utilityId);
        request.input('rate', sql.Decimal(10, 2), rate);
        
        await request.query(query);
        res.json({ success: true, message: 'Tariff plan updated successfully.' });
    } catch (err) {
        console.error('Update Tariff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update tariff plan.' });
    }
});

// --- POST /submitReading (Field Officer) ---
app.post('/submitReading', async (req, res) => {
    const { 
        'meter-id': meterId, 
        'reading-value': readingValue, 
        'reading-date': readingDate 
        
    } = req.body;

    if (!meterId || !readingValue || !readingDate) {
        return res.status(400).json({ success: false, message: 'Missing Meter ID, Reading Value, or Date.' });
    }

    const fieldOfficerId = 'U-002'; // Using correct ID

    try {
        const pool = await connectDb();
        const request = pool.request();

        const query = `
            INSERT INTO [dbo].[Meter_Reading] 
                (MeterID, UserID, ReadingValue, ReadingDate)
            VALUES 
                (@meterId, @userId, @readingValue, @readingDate)
        `;
        
        request.input('meterId', sql.NVarChar, meterId);
        request.input('userId', sql.NVarChar, fieldOfficerId);
        request.input('readingValue', sql.Decimal(10, 2), readingValue);
        request.input('readingDate', sql.Date, readingDate);

        await request.query(query);
        res.json({ success: true, message: 'Reading submitted successfully.' });
    } catch (err) {
        console.error('Submit Reading Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to submit reading. Check if Meter ID is correct.' });
    }
});

// --- POST /generateBill (Cashier) ---
app.post('/generateBill', async (req, res) => {
    const { 
        'customer-id': customerId, 
        'billing-month': billingMonth // e.g., "2024-06"
    } = req.body;

    if (!customerId || !billingMonth) {
        return res.status(400).json({ success: false, message: 'Missing Customer ID or Billing Month.' });
    }

    try {
        const pool = await connectDb();
        const request = pool.request();
        
        // This executes the Stored Procedure you created
        const result = await request
            .input('CustomerID', sql.NVarChar, customerId)
            .input('BillingMonth', sql.Date, `${billingMonth}-01`) // Pass the first day of the month
            .execute('[dbo].[sp_GenerateBill]'); 

        res.json({ success: true, message: 'Bill generated successfully!', data: result.recordset });

    } catch (err) {
        console.error('Generate Bill Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

/////rehan part////
// ----------------------------------------------------------------------
// 2. FIELD OFFICER DATA RETRIEVAL (GET) ENDPOINTS
// ----------------------------------------------------------------------

// --- GET /getRoutes (Field Officer: My Assigned Route) ---
app.get('/getRoutes', async (req, res) => {
    try {
    const pool = await connectDb();
    const query = `
        SELECT M.MeterID, C.CustomerName, C.ServiceAddress, U.UtilityName
        FROM [dbo].[Meter] AS M
        JOIN [dbo].[Customer] AS C ON M.CustomerID = C.CustomerID
        JOIN [dbo].[Utility_Type] AS U ON M.UtilityID = U.UtilityID
        WHERE M.Status = 'Active'
        AND M.MeterID NOT IN (
        SELECT R.MeterID
        FROM [dbo].[Meter_Reading] AS R
        WHERE MONTH(R.ReadingDate) = MONTH(GETDATE())
        AND YEAR(R.ReadingDate) = YEAR(GETDATE())
        )
`;
    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset });
    } catch (err) {
    console.error('Get Routes Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve routes.' });
}
});

// --- GET /api/meter-details/:id (Field Officer: Enter Meter Reading) ---
app.get('/api/meter-details/:id', async (req, res) => {
    const meterId = req.params.id; // Get the ID from the URL (e.g., "MTR-E-001")

    try {
    const pool = await connectDb();
    const request = pool.request();

    const query = `
    SELECT 
    m.MeterID, 
    c.CustomerName, 
    c.ServiceAddress
    FROM 
    dbo.Meter AS m
    INNER JOIN 
    dbo.Customer AS c ON m.CustomerID = c.CustomerID
    WHERE 
    m.MeterID = @MeterID
    `;

    request.input('MeterID', sql.NVarChar, meterId);
    const result = await request.query(query);

    if (result.recordset.length > 0) {
    res.json({ success: true, data: result.recordset[0] });
    } else {
    res.status(404).json({ success: false, message: 'Meter not found.' });
    }

    } catch (err) {
    console.error('Get Meter Details Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve meter details.' });
}
});


// ----------------------------------------------------------------------
// 3. FIELD OFFICER DATA SUBMISSION (POST) ENDPOINT
// ----------------------------------------------------------------------

// --- POST /submitReading (Field Officer) ---
app.post('/submitReading', async (req, res) => {
    const { 
        'meter-id': meterId, 
        'reading-value': readingValue, 
        'reading-date': readingDate,
        'notes': notes,
        'user-id': fieldOfficerId  // <--- ⭐ CHANGE 1: Get the actual user ID from the frontend
    } = req.body;

    if (!meterId || !readingValue || !readingDate || !fieldOfficerId) { // <--- ⭐ CHANGE 2: Validate UserID
        return res.status(400).json({ success: false, message: 'Missing Meter ID, Reading Value, Date, or User ID.' });
    }

    // ⭐ REMOVED the line: const fieldOfficerId = 'U-002'; 

    try {
    const pool = await connectDb();
    const request = pool.request();

        // Inserts the new reading and notes
    const query = `
    INSERT INTO [dbo].[Meter_Reading] 
    (MeterID, UserID, ReadingValue, ReadingDate, Notes)
    VALUES 
        (@meterId, @userId, @readingValue, @readingDate, @notes)
`;
    
    request.input('meterId', sql.NVarChar, meterId);
    request.input('userId', sql.NVarChar, fieldOfficerId); // <--- Uses the dynamically passed ID
    request.input('readingValue', sql.Decimal(10, 2), readingValue);
    request.input('readingDate', sql.Date, readingDate);
    request.input('notes', sql.NVarChar, notes || null); // Pass notes, or null if it's empty

    await request.query(query);
    res.json({ success: true, message: 'Reading submitted successfully.' });
    } catch (err) {
    console.error('Submit Reading Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to submit reading. Check if Meter ID is correct.' });
    }
});

////end rehan part////




// ----------------------------------------------------------------------
// 4. SERVER LISTENER
// ----------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
