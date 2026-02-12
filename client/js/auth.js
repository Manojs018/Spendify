// ===================================
// AUTHENTICATION LOGIC
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already authenticated
    if (isAuthenticated()) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Get form elements
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginFormElement = document.getElementById('loginFormElement');
    const registerFormElement = document.getElementById('registerFormElement');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');

    // Toggle between login and register forms
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    // Handle login form submission
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        // Validation
        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (!validateEmail(email)) {
            showToast('Please enter a valid email', 'error');
            return;
        }

        const submitButton = loginFormElement.querySelector('button[type="submit"]');
        showLoading(submitButton);

        try {
            const response = await apiRequest(API_ENDPOINTS.login, {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            if (response.success) {
                // Store token and user data
                setToken(response.data.token);
                setUser(response.data.user);

                showToast('Login successful! Redirecting...', 'success');

                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }
        } catch (error) {
            showToast(error.message || 'Login failed', 'error');
            hideLoading(submitButton);
        }
    });

    // Handle register form submission
    registerFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;

        // Validation
        if (!name || !email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (!validateEmail(email)) {
            showToast('Please enter a valid email', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        const submitButton = registerFormElement.querySelector('button[type="submit"]');
        showLoading(submitButton);

        try {
            const response = await apiRequest(API_ENDPOINTS.register, {
                method: 'POST',
                body: JSON.stringify({ name, email, password }),
            });

            if (response.success) {
                // Store token and user data
                setToken(response.data.token);
                setUser(response.data.user);

                showToast('Registration successful! Redirecting...', 'success');

                // Redirect to dashboard
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }
        } catch (error) {
            showToast(error.message || 'Registration failed', 'error');
            hideLoading(submitButton);
        }
    });
});
