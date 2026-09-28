import mongoose from "mongoose";

const agentOTPStoreSchema = new mongoose.Schema({
    // ===== All form data temporarily stored =====
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        unique: true
    },

    // Personal Information
    name: { type: String, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },

    // Personal Details
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true },
    nationality: { type: String, default: '' },

    // Identification (optional — upload OR url)
    idType: { type: String, required: true },
    idNumber: { type: String, required: true },

    idFile: { type: String, default: '' },              // ⭐ was required: true — now optional
    idFilePublicId: { type: String, default: '' },
    idFileUrl: { type: String, default: '' },           // ⭐ NEW
    idFileSource: {                                     // ⭐ NEW
        type: String,
        enum: ['upload', 'url', 'none', ''],
        default: 'none'
    },

    // ⭐ SIGNATURE (optional — upload OR url)
    signature: { type: String, default: '' },           // ⭐ NEW
    signaturePublicId: { type: String, default: '' },   // ⭐ NEW
    signatureUrl: { type: String, default: '' },        // ⭐ NEW
    signatureSource: {                                  // ⭐ NEW
        type: String,
        enum: ['upload', 'url', 'none', ''],
        default: 'none'
    },

    // ⭐ TERMS — THIS IS THE MAIN FIX
    agreeTerms: { type: Boolean, default: false },      // ⭐ NEW
    hasReadTerms: { type: Boolean, default: false },    // ⭐ NEW

    // Professional
    jobTitle: { type: String, required: true },
    company: { type: String, default: '' },
    experience: { type: String, required: true },
    education: { type: String, required: true },
    specialization: { type: String, default: '' },

    // Location
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: 'India' },

    // Languages & Skills
    languages: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    bio: { type: String, default: '' },

    // OTP
    otp: { type: String, required: true },
    otpExpiry: { type: Date, required: true },

    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300
    }
});

const AgentOTPStore = mongoose.model('AgentOTPStore', agentOTPStoreSchema);
export default AgentOTPStore;