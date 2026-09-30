// backend/routes/certificateSettingsRoutes.js
import express from 'express';
import multer from 'multer';
import {
    getSettings,
    updateSettings,
    getPublicSettings
} from '../controllers/certificateSettingsController.js';
import { protect } from '../middleware/auth.js';   // ⭐ protect = admin auth
// ↑ tumhare auth.js mein 'protect' admin ke liye hai, 'protectAgent' agent ke liye

const router = express.Router();

// ===== MULTER =====
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/jpg', 'image/svg+xml'];
        if (ok.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only JPG, PNG, SVG allowed'));
    }
});

// ============================================
// PUBLIC ROUTE (agent ke liye — no auth)
// ============================================
router.get('/certificate-settings/public', getPublicSettings);

// ============================================
// ADMIN ROUTES
// ============================================
router.get('/admin/certificate-settings', protect, getSettings);
router.put(
    '/admin/certificate-settings',
    protect,
    upload.fields([
        { name: 'logo', maxCount: 1 },
        { name: 'signatureImage', maxCount: 1 }
    ]),
    updateSettings
);

export default router;