// This file contains the logic for the login page, which authenticates the user
// against the Node.js API server before granting access to the dashboards.

const API_BASE_URL = 'http://localhost:3000'; // Make sure this matches your running server

// --- Utility Function to Display Status Messages on the Login Page ---
function displayLoginMessage(type, message) {
    const container = document.getElementById('login-error-message');
    if (!container) return; // Exit if the message area is not found

    container.textContent = message;
    container.className = `form-message ${type}`;

    // Clear the message after a short delay
    setTimeout(() => {
        container.textContent = '';
        container.className = 'form-message';
    }, 4000);
}

// --- Main Login Submission Handler ---
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.querySelector('.login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            
            event.preventDefault(); 
            displayLoginMessage('info', 'Logging in...');

            // 1. Collect form data
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const role = document.getElementById('role').value;

            // Simple client-side validation
            if (!username || !password || !role) {
                displayLoginMessage('error', 'Please fill in all fields and select a role.');
                return;
            }

            try {
                // 2. Send data to the Node.js API for authentication
                const response = await fetch(API_BASE_URL + '/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password, role }),
                });

                const result = await response.json();

                // 3. Process the server response
                if (response.ok && result.success) {
                    
                    // ⭐ START OF ADDITION: Save user details to Session Storage
                    sessionStorage.setItem('userID', result.user.UserID);
                    sessionStorage.setItem('userRole', result.user.Role);
                    sessionStorage.setItem('userName', result.user.FullName); 
                    // ⭐ END OF ADDITION

                    // Determine redirect based on authenticated role
                    let destination = '';
                    
                    // *** CRITICAL FIX: Matching the exact SQL Server role names from your table ***
                    switch (result.user.Role) {
                        case 'Admin': // Matches the data in your screenshot
                            destination = 'admin-dashboard.html';
                            break;
                        case 'FieldOfficer': // Matches the data in your screenshot
                            destination = 'view-routes.html'; 
                            break;
                        case 'Cashier': // Matches the data in your screenshot
                            destination = 'cashier-dashboard.html';
                            break;
                        case 'Manager': // Matches the data in your screenshot
                            destination = 'manager-dashboard.html';
                            break;
                        default:
                            destination = 'login.html'; 
                    }
                    
                    // Successful login and redirect
                    window.location.href = destination;

                } else {
                    // Display error message from the server (e.g., 'Invalid credentials')
                    displayLoginMessage('error', result.message || 'Login failed. Check your network.');
                }

            } catch (error) {
                console.error('Network or Server Error:', error);
                displayLoginMessage('error', 'Could not connect to the server. Is the API running?');
            }
        });
    }
});
