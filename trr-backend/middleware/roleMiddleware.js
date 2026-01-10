/**
 * Role-based access control middleware
 * Separates routing based on user roles (Admin, Manager, Customer)
 */

const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'your_default_secret_key';

/**
 * Verify token and extract user role
 */
function extractUserRole(req) {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];
    
    if (!token) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        return decoded.role;
    } catch (error) {
        return null;
    }
}

/**
 * Middleware to require admin role
 */
function requireAdmin(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access denied. No token provided.' 
        });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        
        if (decoded.role !== 'Admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. Admin privileges required.' 
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token.' 
        });
    }
}

/**
 * Middleware to require admin or manager role
 */
function requireAdminOrManager(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access denied. No token provided.' 
        });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        
        if (decoded.role !== 'Admin' && decoded.role !== 'Manager') {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. Admin or Manager privileges required.' 
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token.' 
        });
    }
}

/**
 * Middleware to require customer role (authenticated user)
 */
function requireCustomer(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access denied. Please log in.' 
        });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token.' 
        });
    }
}

/**
 * Middleware to check if user owns the resource
 */
function requireOwnership(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access denied. No token provided.' 
        });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        
        // Allow admin to access any resource
        if (decoded.role === 'Admin' || decoded.role === 'Manager') {
            req.user = decoded;
            return next();
        }

        // Check if user owns the resource (userId in params matches token userId)
        const resourceUserId = req.params.userId || req.body.userId || req.query.userId;
        
        if (decoded.id !== resourceUserId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. You can only access your own resources.' 
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token.' 
        });
    }
}

module.exports = {
    extractUserRole,
    requireAdmin,
    requireAdminOrManager,
    requireCustomer,
    requireOwnership
};
