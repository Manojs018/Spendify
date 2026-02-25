/**
 * sanitize.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central input-sanitization & validation middleware for Spendify.
 *
 * Protections provided:
 *   1. XSS          – strip / encode HTML tags & dangerous script content
 *   2. NoSQL inject – reject objects where strings are expected ($ / . keys)
 *   3. ReDoS        – escape untrusted strings before using them in RegExp
 *   4. Input valid. – validate transaction & transfer payloads before DB touch
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── 1. Tiny XSS scrubber (no external deps needed) ─────────────────────────

/**
 * Removes HTML tags, script blocks, and javascript: URIs from a string.
 *
 * IMPORTANT: We do NOT HTML-encode characters like &, <, > here because:
 *   - This data is stored in MongoDB, not rendered to HTML.
 *   - HTML encoding must happen at the rendering layer (e.g. in the browser).
 *   - Encoding would break validation patterns (email regex, etc.).
 *
 * What we DO strip:
 *   - <script>...</script> blocks
 *   - All HTML tags (<img>, <svg>, <a>, etc.)
 *   - Inline javascript: URIs
 *   - HTML event handlers (onclick=, onload=, etc.)
 */
export function stripXSS(value) {
    if (typeof value !== 'string') return value;

    return value
        // Remove <script … > … </script> blocks (case-insensitive, multiline)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove inline event handlers (e.g. onclick="...", onload='...')
        .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
        // Remove javascript: URIs
        .replace(/javascript\s*:/gi, '')
        // Remove vbscript: URIs
        .replace(/vbscript\s*:/gi, '')
        // Remove data: URIs (potential XSS vector)
        .replace(/data\s*:[^,]*,/gi, '')
        // Remove all remaining HTML tags
        .replace(/<[^>]+>/g, '')
        .trim();
}

// ─── 2. NoSQL-injection guard ────────────────────────────────────────────────

/**
 * Recursively walk a value and throw if any key starts with $ or contains a dot.
 * Accepts primitive leaves (string, number, boolean, null, undefined).
 */
export function guardNoSQL(value, path = 'input') {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
        value.forEach((v, i) => guardNoSQL(v, `${path}[${i}]`));
        return;
    }

    if (typeof value === 'object') {
        for (const key of Object.keys(value)) {
            if (key.startsWith('$') || key.includes('.')) {
                throw new Error(
                    `Invalid input: operator key "${key}" is not allowed in ${path}`
                );
            }
            guardNoSQL(value[key], `${path}.${key}`);
        }
    }
}

// ─── 3. ReDoS-safe regex escaping ───────────────────────────────────────────

/**
 * Escape all special regex metacharacters so user-supplied strings
 * can be passed safely to `new RegExp(...)`.
 *
 * This prevents:
 *   - ReDoS: catastrophic backtracking via crafted patterns
 *   - regex injection: altering search semantics
 */
export function escapeRegex(str) {
    if (typeof str !== 'string') return '';
    // Matches every regex metacharacter
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── 4. Middleware: sanitise every req.body & req.query recursively ──────────

/**
 * Express middleware that:
 *   a) Rejects the request if any NoSQL operator key is detected.
 *   b) Strips XSS from every string in req.body.
 */
// HTML detection regex – looks for tag-like patterns before they are stripped
const HTML_TAG_PATTERN = /<[^>]+>/;

/**
 * Reject fields that contain raw HTML markup before stripping.
 * Applies to the category field specifically — HTML there is never valid.
 */
function rejectHtmlInCategory(body, path = 'body') {
    if (!body || typeof body !== 'object') return;
    if (typeof body.category === 'string' && HTML_TAG_PATTERN.test(body.category)) {
        throw new Error('Category contains invalid characters');
    }
}

export function sanitizeBody(req, res, next) {
    try {
        // Guard body against NoSQL injection
        if (req.body && typeof req.body === 'object') {
            guardNoSQL(req.body, 'body');
        }

        // Guard query params against NoSQL injection
        if (req.query && typeof req.query === 'object') {
            guardNoSQL(req.query, 'query');
        }

        // Reject HTML in category BEFORE XSS stripping obscures it
        rejectHtmlInCategory(req.body);

        // XSS-clean all string values in body
        req.body = deepSanitize(req.body);

        next();
    } catch (err) {
        return res.status(400).json({
            success: false,
            message: err.message || 'Invalid input detected',
        });
    }
}

/**
 * Recursively apply stripXSS to every string leaf in obj.
 */
function deepSanitize(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return stripXSS(obj);
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(deepSanitize);
    }

    const result = {};
    for (const [k, v] of Object.entries(obj)) {
        result[k] = deepSanitize(v);
    }
    return result;
}

// ─── 5. Reusable field validators ────────────────────────────────────────────

/**
 * Validate that `value` is a finite, positive number within optional bounds.
 * Returns null on success, or an error string.
 */
export function validateAmount(value, { min = 0.01, max = 1_000_000 } = {}) {
    // Reject non-scalar types (arrays, objects) — catches NoSQL-style injection
    // that slips through guardNoSQL (e.g. a plain array has no $ keys)
    if (value === null || value === undefined) return 'Amount must be a valid number';
    if (typeof value === 'object') return 'Amount must be a valid number';
    const n = parseFloat(value);
    if (!isFinite(n)) return 'Amount must be a valid number';
    if (n < min) return `Amount must be at least ${min}`;
    if (n > max) return `Amount must not exceed ${max}`;
    return null;
}

const VALID_TRANSACTION_TYPES = ['income', 'expense'];
const VALID_SORT_FIELDS = [
    'date', '-date', 'amount', '-amount',
    'category', '-category', 'type', '-type',
    'createdAt', '-createdAt',
];

/**
 * Validate transaction body fields.
 * Returns array of error strings (empty = valid).
 */
export function validateTransactionBody({ amount, type, category, description, date }) {
    const errors = [];

    // amount
    const amtErr = validateAmount(amount);
    if (amtErr) errors.push(amtErr);

    // type
    if (!type || !VALID_TRANSACTION_TYPES.includes(type)) {
        errors.push(`Type must be one of: ${VALID_TRANSACTION_TYPES.join(', ')}`);
    }

    // category – required, alphanum + spaces + common punctuation, max 50 chars
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
        errors.push('Category is required');
    } else if (category.trim().length > 50) {
        errors.push('Category must be 50 characters or fewer');
    } else if (!/^[\w\s\-&',().]+$/u.test(category.trim())) {
        errors.push('Category contains invalid characters');
    }

    // description – optional, max 200 chars (plain text after XSS strip)
    if (description !== undefined && description !== null) {
        if (typeof description !== 'string') {
            errors.push('Description must be a string');
        } else if (description.length > 200) {
            errors.push('Description must be 200 characters or fewer');
        }
    }

    // date – optional, must parse to a valid date if supplied
    if (date !== undefined && date !== null) {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            errors.push('Date is not valid');
        }
    }

    return errors;
}

/**
 * Validate query params for GET /transactions.
 * Returns array of error strings.
 */
export function validateTransactionQuery({ type, category, month, year, search, page, limit, sort }) {
    const errors = [];

    if (type && !VALID_TRANSACTION_TYPES.includes(type)) {
        errors.push(`Type filter must be one of: ${VALID_TRANSACTION_TYPES.join(', ')}`);
    }

    if (category && (typeof category !== 'string' || category.length > 50)) {
        errors.push('Category filter must be a string up to 50 characters');
    }

    if (month !== undefined) {
        const m = parseInt(month, 10);
        if (!Number.isInteger(m) || m < 1 || m > 12) {
            errors.push('Month must be an integer between 1 and 12');
        }
    }

    if (year !== undefined) {
        const y = parseInt(year, 10);
        if (!Number.isInteger(y) || y < 2000 || y > 2100) {
            errors.push('Year must be an integer between 2000 and 2100');
        }
    }

    if (search && typeof search === 'string' && search.length > 100) {
        errors.push('Search term must be 100 characters or fewer');
    }

    if (page !== undefined) {
        const p = parseInt(page, 10);
        if (!Number.isInteger(p) || p < 1) {
            errors.push('Page must be a positive integer');
        }
    }

    if (limit !== undefined) {
        const l = parseInt(limit, 10);
        if (!Number.isInteger(l) || l < 1 || l > 100) {
            errors.push('Limit must be an integer between 1 and 100');
        }
    }

    if (sort && !VALID_SORT_FIELDS.includes(sort)) {
        errors.push(`Sort must be one of: ${VALID_SORT_FIELDS.join(', ')}`);
    }

    return errors;
}

/**
 * Validate transfer send body.
 */
export function validateTransferBody({ recipientEmail, amount, description }) {
    const errors = [];

    if (!recipientEmail || typeof recipientEmail !== 'string' || recipientEmail.trim().length === 0) {
        errors.push('Recipient email is required');
    } else {
        // Basic RFC-5322 inspired email pattern (safe, no catastrophic backtracking)
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(recipientEmail.trim())) {
            errors.push('Recipient email is not a valid email address');
        }
    }

    const amtErr = validateAmount(amount);
    if (amtErr) errors.push(amtErr);

    if (description !== undefined && description !== null) {
        if (typeof description !== 'string') {
            errors.push('Description must be a string');
        } else if (description.length > 200) {
            errors.push('Description must be 200 characters or fewer');
        }
    }

    return errors;
}

/**
 * Validate user search query param.
 */
export function validateSearchQuery({ email }) {
    const errors = [];
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
        errors.push('Email search term is required');
    } else if (email.trim().length > 100) {
        errors.push('Email search term must be 100 characters or fewer');
    }
    return errors;
}
