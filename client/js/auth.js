// ===================================
// AUTHENTICATION LOGIC
// ===================================

// ============================================================
// PASSWORD STRENGTH UTILITIES (OWASP)
// ============================================================

/**
 * Evaluate password against OWASP requirements.
 * Returns an object with individual rule results and an overall score (0-5).
 */
function evaluatePassword(password) {
    const rules = {
        length: password.length >= 12,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };
    const score = Object.values(rules).filter(Boolean).length;
    return { rules, score };
}

/**
 * Update the live password strength UI.
 */
function updateStrengthUI(password) {
    if (!password) {
        resetStrengthUI();
        return;
    }

    const { rules, score } = evaluatePassword(password);

    // --- requirements checklist ---
    const map = {
        'req-length': rules.length,
        'req-upper': rules.upper,
        'req-lower': rules.lower,
        'req-number': rules.number,
        'req-special': rules.special,
    };
    const labels = {
        'req-length': 'At least 12 characters',
        'req-upper': 'One uppercase letter (A-Z)',
        'req-lower': 'One lowercase letter (a-z)',
        'req-number': 'One number (0-9)',
        'req-special': 'One special character (!@#$%^&*)',
    };

    Object.entries(map).forEach(([id, passed]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (passed) {
            el.textContent = `✓ ${labels[id]}`;
            el.className = 'req-met';
        } else {
            el.textContent = `✗ ${labels[id]}`;
            el.className = 'req-fail';
        }
    });

    // --- strength bar & label ---
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    if (!fill || !label) return;

    const pct = (score / 5) * 100;
    fill.style.width = `${pct}%`;
    fill.className = 'strength-fill'; // reset

    if (score <= 1) {
        fill.classList.add('strength-very-weak');
        label.textContent = 'Very Weak';
        label.className = 'strength-label label-very-weak';
    } else if (score === 2) {
        fill.classList.add('strength-weak');
        label.textContent = 'Weak';
        label.className = 'strength-label label-weak';
    } else if (score === 3) {
        fill.classList.add('strength-fair');
        label.textContent = 'Fair';
        label.className = 'strength-label label-fair';
    } else if (score === 4) {
        fill.classList.add('strength-good');
        label.textContent = 'Good';
        label.className = 'strength-label label-good';
    } else {
        fill.classList.add('strength-strong');
        label.textContent = 'Strong ✓';
        label.className = 'strength-label label-strong';
    }

    // Enable/disable submit button
    const submitBtn = document.getElementById('registerSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = score < 5;
    }
}

function resetStrengthUI() {
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    if (fill) { fill.style.width = '0%'; fill.className = 'strength-fill'; }
    if (label) { label.textContent = ''; label.className = 'strength-label'; }

    const ids = ['req-length', 'req-upper', 'req-lower', 'req-number', 'req-special'];
    const texts = {
        'req-length': 'At least 12 characters',
        'req-upper': 'One uppercase letter (A-Z)',
        'req-lower': 'One lowercase letter (a-z)',
        'req-number': 'One number (0-9)',
        'req-special': 'One special character (!@#$%^&*)',
    };
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = `✗ ${texts[id]}`; el.className = 'req-fail'; }
    });

    const submitBtn = document.getElementById('registerSubmitBtn');
    if (submitBtn) submitBtn.disabled = true;
}

/**
 * Collect all unmet requirements and return them as an array of strings.
 */
function getPasswordErrors(password) {
    const errors = [];
    if (!password || password.length < 12) errors.push('Password must be at least 12 characters long');
    if (password && !/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (password && !/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (password && !/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    if (password && !/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain at least one special character (e.g. !@#$%^&*)');
    return errors;
}

// ============================================================
// PAGE INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // ── If already authenticated, show banner instead of hard-redirecting ──
    if (isAuthenticated()) {
        const banner = document.getElementById('alreadyAuthBanner');
        const loginF = document.getElementById('loginForm');
        const registerF = document.getElementById('registerForm');
        if (banner) banner.style.display = 'block';
        if (loginF) loginF.style.display = 'none';
        if (registerF) registerF.style.display = 'none';

        // Sign-out button clears session and shows login form
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => {
                removeToken();
                removeUser();
                if (banner) banner.style.display = 'none';
                if (loginF) loginF.style.display = 'block';
                showToast('Signed out. You can now register or login.', 'success');
            });
        }
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

    // -------------------------------------------------------
    // Live password strength on keyup
    // -------------------------------------------------------
    const registerPasswordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    const confirmPasswordError = document.getElementById('confirmPasswordError');

    if (registerPasswordInput) {
        registerPasswordInput.addEventListener('input', () => {
            updateStrengthUI(registerPasswordInput.value);
            // Re-validate confirm field if it already has a value
            if (confirmPasswordInput && confirmPasswordInput.value) {
                validateConfirmPassword();
            }
        });
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validateConfirmPassword);
    }

    function validateConfirmPassword() {
        if (!confirmPasswordInput || !confirmPasswordError) return;
        if (confirmPasswordInput.value && confirmPasswordInput.value !== registerPasswordInput.value) {
            confirmPasswordError.textContent = 'Passwords do not match';
            confirmPasswordError.style.display = 'block';
        } else {
            confirmPasswordError.textContent = '';
            confirmPasswordError.style.display = 'none';
        }
    }

    // -------------------------------------------------------
    // Handle LOGIN form submission
    // -------------------------------------------------------
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        // Basic validation
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
                setToken(response.data.token);
                setUser(response.data.user);

                showToast('Login successful! Redirecting...', 'success');

                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }
        } catch (error) {
            showToast(error.message || 'Login failed', 'error');
            hideLoading(submitButton);
        }
    });

    // -------------------------------------------------------
    // Handle REGISTER form submission
    // -------------------------------------------------------
    registerFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : password;

        // Basic field presence
        if (!name || !email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (!validateEmail(email)) {
            showToast('Please enter a valid email', 'error');
            return;
        }

        // OWASP password strength validation (client-side)
        const errors = getPasswordErrors(password);
        if (errors.length > 0) {
            showToast(errors[0], 'error');
            return;
        }

        // Confirm password match
        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
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
                setToken(response.data.token);
                setUser(response.data.user);

                showToast('Registration successful! Redirecting...', 'success');

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
