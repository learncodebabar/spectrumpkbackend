import express from 'express';
import multer from 'multer';
import {
    signUp,
    verifyOTP,
    resendOTP,
    login,
    getProfile,
    updateProfile,
    changePassword,
    getCertificate          // ⭐ already imported — good!
} from '../controllers/agentController.js';
import { protectAgent } from '../middleware/auth.js';

const router = express.Router();

// ===== MULTER CONFIG =====
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG and PDF are allowed.'));
        }
    }
});

// ============================================
// PUBLIC ROUTES
// ============================================
router.post(
    '/signup',
    upload.fields([
        { name: 'idFile', maxCount: 1 },
        { name: 'signature', maxCount: 1 }
    ]),
    signUp
);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);

// ============================================
// AGENT PROTECTED ROUTES
// ============================================

// ⭐ CERTIFICATE — MUST be before '/:id' route!
router.get('/certificate', protectAgent, getCertificate);

router.get('/profile', protectAgent, getProfile);
router.put(
    '/:id',
    upload.fields([
        { name: 'idFile', maxCount: 1 },
        { name: 'profileImage', maxCount: 1 }
    ]),
    protectAgent,
    updateProfile
);
router.put('/:id/change-password', protectAgent, changePassword);

export default router;