/**
 * Password Strength Validator
 * Enforces strong password requirements on the backend
 */

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with isValid flag and messages
 */
function validatePasswordStrength(password) {
    const errors = [];
    const warnings = [];
    let strength = 0;
    let strengthLevel = 'weak';

    // Check minimum length (at least 8 characters)
    if (!password || password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    } else {
        strength += 1;
    }

    // Check for uppercase letters
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    } else {
        strength += 1;
    }

    // Check for lowercase letters
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    } else {
        strength += 1;
    }

    // Check for numbers
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    } else {
        strength += 1;
    }

    // Check for special characters
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\'":|,.<>?/)');
    } else {
        strength += 1;
    }

    // Check for common weak passwords
    const commonPasswords = [
        'password', '12345678', 'qwerty', 'abc123', 'password123',
        'admin123', 'letmein', 'welcome', 'monkey', '1234567890'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
        errors.push('Password is too common. Please choose a more unique password');
        strength = 0;
    }

    // Check for sequential characters
    if (/(.)\1{2,}/.test(password)) {
        warnings.push('Password contains repeating characters');
    }

    // Check for sequential numbers
    if (/(?:012|123|234|345|456|567|678|789|890)/.test(password)) {
        warnings.push('Password contains sequential numbers');
    }

    // Check password length bonus
    if (password.length >= 12) {
        strength += 1;
    }
    if (password.length >= 16) {
        strength += 1;
    }

    // Determine strength level
    if (strength >= 6) {
        strengthLevel = 'strong';
    } else if (strength >= 4) {
        strengthLevel = 'medium';
    } else {
        strengthLevel = 'weak';
    }

    return {
        isValid: errors.length === 0,
        strength: strengthLevel,
        score: Math.min(strength, 7),
        errors: errors,
        warnings: warnings,
        message: errors.length === 0 
            ? `Password strength: ${strengthLevel}`
            : `Password validation failed: ${errors.join(', ')}`
    };
}

/**
 * Check if password meets minimum requirements
 * @param {string} password - Password to check
 * @returns {boolean} - True if password meets requirements
 */
function meetsMinimumRequirements(password) {
    return (
        password &&
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /\d/.test(password) &&
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    );
}

/**
 * Generate password strength feedback for users
 * @param {string} password - Password to analyze
 * @returns {object} - Detailed feedback object
 */
function getPasswordFeedback(password) {
    const validation = validatePasswordStrength(password);
    
    const suggestions = [];
    
    if (password.length < 8) {
        suggestions.push('Use at least 8 characters');
    }
    if (password.length < 12) {
        suggestions.push('Consider using 12 or more characters for better security');
    }
    if (!/[A-Z]/.test(password)) {
        suggestions.push('Add uppercase letters (A-Z)');
    }
    if (!/[a-z]/.test(password)) {
        suggestions.push('Add lowercase letters (a-z)');
    }
    if (!/\d/.test(password)) {
        suggestions.push('Add numbers (0-9)');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        suggestions.push('Add special characters (!@#$%^&*...)');
    }

    return {
        ...validation,
        suggestions: suggestions,
        percentage: Math.round((validation.score / 7) * 100)
    };
}

module.exports = {
    validatePasswordStrength,
    meetsMinimumRequirements,
    getPasswordFeedback
};
