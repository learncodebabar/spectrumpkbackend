// backend/models/CertificateSettings.js
import mongoose from "mongoose";

const certificateSettingsSchema = new mongoose.Schema({
    // ============================================
    // ORGANIZATION / LOGO
    // ============================================
    orgName: {
        type: String,
        default: 'Agent Portal'
    },
    orgTagline: {
        type: String,
        default: 'Verified Partner Network'
    },

    // Logo — upload OR url
    logo: {
        type: String,               // /uploads/cert/logo.png
        default: ''
    },
    logoPublicId: {
        type: String,
        default: ''
    },
    logoUrl: {
        type: String,               // https://...
        default: ''
    },
    logoSource: {
        type: String,
        enum: ['upload', 'url', 'none', ''],
        default: 'none'
    },

    // ============================================
    // CERTIFICATE TEXT
    // ============================================
    certificateTitle: {
        type: String,
        default: 'Certificate of Representation'
    },
    certifyText: {
        type: String,
        default: 'This is to certify that'
    },
    description: {
        type: String,
        default: 'is hereby appointed as a Verified Education Agent of the Agent Portal network. This individual is authorized to represent the organization and assist students in their educational journey.'
    },

    // ============================================
    // VALIDITY
    // ============================================
    validityYears: {
        type: Number,
        default: 1
    },

    // ============================================
    // SEAL
    // ============================================
    sealText: {
        type: String,
        default: 'OFFICIAL'
    },
    sealSubText: {
        type: String,
        default: 'VERIFIED'
    },
    sealColor: {
        type: String,
        default: '#b83a52'          // maroon
    },

    // ============================================
    // SIGNATURE
    // ============================================
    signatoryName: {
        type: String,
        default: 'Authorized Signatory'
    },
    signatoryRole: {
        type: String,
        default: 'Agent Portal'
    },
    signatureImage: {
        type: String,               // admin uploaded signature (optional)
        default: ''
    },

    // ============================================
    // FOOTER
    // ============================================
    footerNote: {
        type: String,
        default: ''
    },

    // ============================================
    // BORDER THEME
    // ============================================
    borderTheme: {
        type: String,
        enum: ['navy-gold', 'blue-scallop', 'classic-green', 'modern-purple'],
        default: 'navy-gold'
    },

    // ============================================
    // STATUS
    // ============================================
    isActive: {
        type: Boolean,
        default: true
    },

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null
    }

}, { timestamps: true });

const CertificateSettings = mongoose.model('CertificateSettings', certificateSettingsSchema);
export default CertificateSettings;