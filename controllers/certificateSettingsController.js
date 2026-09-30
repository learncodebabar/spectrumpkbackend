// backend/controllers/certificateSettingsController.js
import CertificateSettings from '../models/CertificateSettings.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// HELPER — Get or create default settings
// ============================================
const getOrCreateSettings = async () => {
    let settings = await CertificateSettings.findOne();
    if (!settings) {
        settings = await CertificateSettings.create({});
    }
    return settings;
};

// ============================================
// GET SETTINGS (Admin)
// ============================================
export const getSettings = async (req, res) => {
    try {
        const settings = await getOrCreateSettings();
        res.json({ success: true, settings });
    } catch (error) {
        console.error('❌ Get Certificate Settings Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// UPDATE SETTINGS (Admin)
// ============================================
export const updateSettings = async (req, res) => {
    try {
        const settings = await getOrCreateSettings();

        const allowedFields = [
            'orgName', 'orgTagline',
            'certificateTitle', 'certifyText', 'description',
            'validityYears',
            'sealText', 'sealSubText', 'sealColor',
            'signatoryName', 'signatoryRole',
            'footerNote', 'borderTheme'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                settings[field] = req.body[field];
            }
        });

        // ===== LOGO HANDLING =====
        if (req.files && req.files.logo && req.files.logo[0]) {
            const file = req.files.logo[0];
            const uploadDir = path.join(__dirname, '../uploads/certificate');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const fileName = `logo_${Date.now()}_${file.originalname}`;
            fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);

            settings.logo = `/uploads/certificate/${fileName}`;
            settings.logoPublicId = fileName;
            settings.logoUrl = '';
            settings.logoSource = 'upload';
        } else if (req.body.logoUrl !== undefined && req.body.logoUrl.trim()) {
            settings.logoUrl = req.body.logoUrl.trim();
            settings.logo = '';
            settings.logoPublicId = '';
            settings.logoSource = 'url';
        } else if (req.body.logoUrl === '') {
            // Clear logo
            settings.logo = '';
            settings.logoUrl = '';
            settings.logoPublicId = '';
            settings.logoSource = 'none';
        }

        // ===== SIGNATURE IMAGE =====
        if (req.files && req.files.signatureImage && req.files.signatureImage[0]) {
            const file = req.files.signatureImage[0];
            const uploadDir = path.join(__dirname, '../uploads/certificate');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const fileName = `signature_${Date.now()}_${file.originalname}`;
            fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);

            settings.signatureImage = `/uploads/certificate/${fileName}`;
        }

        if (req.admin?.id) {
            settings.updatedBy = req.admin.id;
        }

        await settings.save();

        res.json({
            success: true,
            message: 'Certificate settings updated successfully',
            settings
        });

    } catch (error) {
        console.error('❌ Update Certificate Settings Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// GET PUBLIC SETTINGS (Agent ko dikhane ke liye)
// ============================================
export const getPublicSettings = async (req, res) => {
    try {
        const settings = await getOrCreateSettings();

        // Display URL helper
        const getLogoDisplay = () => {
            if (settings.logoUrl) return settings.logoUrl;
            if (settings.logo) {
                const clean = settings.logo.replace(/\\/g, '/');
                return clean.startsWith('/') ? clean : `/${clean}`;
            }
            return '';
        };

        const getSignatureDisplay = () => {
            if (settings.signatureImage) {
                const clean = settings.signatureImage.replace(/\\/g, '/');
                return clean.startsWith('/') ? clean : `/${clean}`;
            }
            return '';
        };

        res.json({
            success: true,
            settings: {
                orgName: settings.orgName,
                orgTagline: settings.orgTagline,
                logo: getLogoDisplay(),
                certificateTitle: settings.certificateTitle,
                certifyText: settings.certifyText,
                description: settings.description,
                validityYears: settings.validityYears,
                sealText: settings.sealText,
                sealSubText: settings.sealSubText,
                sealColor: settings.sealColor,
                signatoryName: settings.signatoryName,
                signatoryRole: settings.signatoryRole,
                signatureImage: getSignatureDisplay(),
                footerNote: settings.footerNote,
                borderTheme: settings.borderTheme
            }
        });
    } catch (error) {
        console.error('❌ Get Public Certificate Settings Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};