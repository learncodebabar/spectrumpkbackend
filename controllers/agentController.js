import Agent from "../models/Agent.js";
import AgentOTPStore from "../models/AgentOTPStore.js";
import Admin from "../models/Admin.js";
import jwt from "jsonwebtoken";
import { generateOTP, isOTPExpired } from "../utils/otpGenerator.js";
import { 
    sendOTPEmail, 
    sendApprovalEmail, 
    sendRejectionEmail,
    sendPendingEmail
} from "../services/emailService.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// ✅ HELPER: Extract ID file info (upload | url)
// ============================================
const extractIdFileInfo = (req) => {
    let idFile = '';
    let idFilePublicId = '';
    let idFileUrl = req.body.idFileUrl || '';
    let idFileSource = 'none';

    // Priority 1: Uploaded file
    if (req.file) {
        const uploadDir = path.join(__dirname, '../uploads/agents');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `agent_${Date.now()}_${req.file.originalname}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, req.file.buffer);

        idFile = `/uploads/agents/${fileName}`;
        idFilePublicId = fileName;
        idFileSource = 'upload';
        idFileUrl = '';
    }
    // Priority 2: Multiple files array
    else if (req.files && req.files.idFile && req.files.idFile[0]) {
        const file = req.files.idFile[0];
        idFile = `/uploads/agents/${file.filename}`;
        idFilePublicId = file.filename;
        idFileSource = 'upload';
        idFileUrl = '';
    }
    // Priority 3: URL provided
    else if (idFileUrl && idFileUrl.trim()) {
        idFileSource = 'url';
    }

    return {
        idFile,
        idFilePublicId,
        idFileUrl: idFileUrl ? idFileUrl.trim() : '',
        idFileSource
    };
};

// ============================================
// ✅ HELPER: Extract signature file (optional)
// ============================================
const extractSignatureInfo = (req) => {
    let signature = '';
    let signaturePublicId = '';

    if (req.files && req.files.signature && req.files.signature[0]) {
        const file = req.files.signature[0];
        signature = `/uploads/agents/${file.filename}`;
        signaturePublicId = file.filename;
    }

    return { signature, signaturePublicId };
};
// ============================================
// 15. GET AGENT CERTIFICATE DATA
// ============================================
export const getCertificate = async (req, res) => {
    try {
        const agent = await Agent.findById(req.agent.id)
            .select("-password -otp -otpExpiry -resetToken -resetTokenExpiry");

        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        // ✅ Sirf approved agents ko certificate milega
        if (agent.approvalStatus !== 'approved') {
            return res.status(403).json({
                success: false,
                message: `Certificate only available for approved agents. Your status: ${agent.approvalStatus}`,
                status: agent.approvalStatus
            });
        }

        // ✅ Unique Certificate ID generate karo (stable — same agent ke liye same ID)
        const certYear = new Date(agent.approvedAt || agent.createdAt).getFullYear();
        const shortId = agent._id.toString().slice(-6).toUpperCase();
        const certificateId = `AGT-${certYear}-${shortId}`;

        // ✅ Verification URL (QR code ke liye)
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-agent/${agent._id}`;

        res.json({
            success: true,
            certificate: {
                certificateId,
                issuedAt: agent.approvedAt || agent.createdAt,
                verificationUrl,

                // Agent Info
                agent: {
                    id: agent._id,
                    name: agent.name,
                    email: agent.email,
                    phone: agent.phone,
                    jobTitle: agent.jobTitle,
                    company: agent.company,
                    specialization: agent.specialization,
                    experience: agent.experience,
                    education: agent.education,
                    city: agent.city,
                    state: agent.state,
                    country: agent.country,
                    bio: agent.bio,
                    languages: agent.languages,
                    skills: agent.skills,
                    profileImage: agent.profileImageDisplayUrl || '',
                    signature: agent.signatureDisplayUrl || '',
                    joinedAt: agent.createdAt,
                    approvedAt: agent.approvedAt,
                    idType: agent.idType,
                    idNumber: agent.idNumber ? `****${agent.idNumber.slice(-4)}` : '', // masked
                }
            }
        });

    } catch (error) {
        console.error("❌ Get Certificate Error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching certificate",
            error: error.message
        });
    }
};
// ============================================
// 1. AGENT SIGN UP
// ============================================
export const signUp = async (req, res) => {
    try {
        const {
            name, email, phone, password, confirmPassword,
            dateOfBirth, gender, nationality,
            idType, idNumber,
            jobTitle, company, experience, education, specialization,
            address, city, state, pincode, country,
            languages, skills, bio,
            agreeTerms, hasReadTerms
        } = req.body;

        console.log("=========================================");
        console.log("📝 AGENT SIGNUP REQUEST");
        console.log("=========================================");
        console.log("📧 Email:", email);
        console.log("👤 Name:", name);
        console.log("📱 Phone:", phone);
        console.log("🔗 ID URL:", req.body.idFileUrl || 'none');
        console.log("📎 ID File:", req.file ? 'uploaded' : 'none');
        console.log("✍️ Signature:", req.files?.signature ? 'uploaded' : 'none');
        console.log("✅ Agree Terms:", agreeTerms);
        console.log("✅ Has Read Terms:", hasReadTerms);
        console.log("=========================================");

        // ===== VALIDATION =====
        if (!name || !email || !phone || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address"
            });
        }

        // ✅ 11-digit phone validation
        if (!/^[0-9]{11}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 11-digit phone number"
            });
        }

        // ⭐ Terms validation (Lازمی)
        if (!agreeTerms || agreeTerms === 'false') {
            return res.status(400).json({
                success: false,
                message: "You must agree to the Terms and Conditions"
            });
        }

        if (!hasReadTerms || hasReadTerms === 'false') {
            return res.status(400).json({
                success: false,
                message: "You must confirm that you have read the Terms and Conditions properly"
            });
        }

        // ===== CHECK IF AGENT EXISTS =====
        const existingAgent = await Agent.findOne({ 
            $or: [
                { email: email.toLowerCase() },
                { phone: phone }
            ]
        });

        if (existingAgent) {
            return res.status(400).json({
                success: false,
                message: existingAgent.email === email.toLowerCase() 
                    ? "Email already registered" 
                    : "Phone number already registered"
            });
        }

        // ===== HANDLE ID FILE =====
        const { idFile, idFilePublicId, idFileUrl, idFileSource } = extractIdFileInfo(req);

        // ===== HANDLE SIGNATURE (Optional) =====
        const { signature, signaturePublicId } = extractSignatureInfo(req);

        // ===== PARSE LANGUAGES & SKILLS =====
        let parsedLanguages = [];
        let parsedSkills = [];
        
        try {
            if (languages) {
                parsedLanguages = typeof languages === 'string' ? JSON.parse(languages) : languages;
            }
            if (skills) {
                parsedSkills = typeof skills === 'string' ? JSON.parse(skills) : skills;
            }
        } catch (error) {
            console.log("⚠️ Parse error:", error);
        }

        // ===== GENERATE OTP =====
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

        // ===== SAVE IN AGENT OTP STORE =====
        await AgentOTPStore.findOneAndUpdate(
            { email: email.toLowerCase() },
            {
                email: email.toLowerCase(),
                name: name.trim(),
                phone: phone,
                password: password,
                dateOfBirth: new Date(dateOfBirth),
                gender: gender,
                nationality: nationality || '',
                idType: idType || '',
                idNumber: idNumber ? idNumber.trim() : '',

                idFile: idFile,
                idFilePublicId: idFilePublicId,
                idFileUrl: idFileUrl,
                idFileSource: idFileSource,

                signature: signature,
                signaturePublicId: signaturePublicId,

                agreeTerms: agreeTerms === 'true' || agreeTerms === true,
                hasReadTerms: hasReadTerms === 'true' || hasReadTerms === true,

                jobTitle: jobTitle,
                company: company || '',
                experience: experience,
                education: education,
                specialization: specialization || '',
                address: address,
                city: city,
                state: state,
                pincode: pincode,
                country: country || 'India',
                languages: parsedLanguages,
                skills: parsedSkills,
                bio: bio || '',
                otp: otp,
                otpExpiry: otpExpiry
            },
            { upsert: true, new: true }
        );

        console.log("✅ Agent data saved in OTPStore");
        console.log("🔑 OTP for testing:", otp);

        // ===== SEND EMAIL =====
        try {
            await sendOTPEmail(email, otp, 'agent_signup');
            console.log("✅ OTP email sent to:", email);
        } catch (emailError) {
            console.log("⚠️ Email error:", emailError.message);
        }

        res.status(201).json({
            success: true,
            message: "Verification code sent to your email",
            email: email,
            otp: otp
        });

    } catch (error) {
        console.error("❌ Agent SignUp Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error during signup",
            error: error.message
        });
    }
};

// ============================================
// 2. VERIFY AGENT OTP
// ============================================
export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        console.log("=========================================");
        console.log("🔐 VERIFY AGENT OTP");
        console.log("=========================================");

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required"
            });
        }

        const tempData = await AgentOTPStore.findOne({ email: email.toLowerCase() });
        
        if (!tempData) {
            return res.status(404).json({
                success: false,
                message: "No OTP found. Please sign up again."
            });
        }

        if (String(tempData.otp).trim() !== String(otp).trim()) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        if (new Date() > new Date(tempData.otpExpiry)) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        console.log("✅ OTP Matched! Saving agent...");

        const agent = new Agent({
            name: tempData.name,
            email: tempData.email,
            phone: tempData.phone,
            password: tempData.password,
            dateOfBirth: tempData.dateOfBirth,
            gender: tempData.gender,
            nationality: tempData.nationality,
            idType: tempData.idType,
            idNumber: tempData.idNumber,

            idFile: tempData.idFile || '',
            idFilePublicId: tempData.idFilePublicId || '',
            idFileUrl: tempData.idFileUrl || '',
            idFileSource: tempData.idFileSource || 'none',

            signature: tempData.signature || '',
            signaturePublicId: tempData.signaturePublicId || '',

            agreeTerms: tempData.agreeTerms || false,
            hasReadTerms: tempData.hasReadTerms || false,
            termsAcceptedAt: new Date(),

            jobTitle: tempData.jobTitle,
            company: tempData.company,
            experience: tempData.experience,
            education: tempData.education,
            specialization: tempData.specialization,
            address: tempData.address,
            city: tempData.city,
            state: tempData.state,
            pincode: tempData.pincode,
            country: tempData.country,
            languages: tempData.languages,
            skills: tempData.skills,
            bio: tempData.bio,
            isVerified: true,
            approvalStatus: 'pending',
            isActive: false
        });

        await agent.save();
        console.log("✅ Agent saved with PENDING status:", agent.email);

        await AgentOTPStore.deleteOne({ email: email.toLowerCase() });
        console.log("🗑️ Agent OTPStore deleted");

        try {
            await sendPendingEmail(agent.email, agent.name);
            console.log("✅ Pending email sent");
        } catch (emailError) {
            console.log("⚠️ Pending email error:", emailError.message);
        }

        res.json({
            success: true,
            message: "Account created successfully! Waiting for admin approval.",
            agent: {
                id: agent._id,
                name: agent.name,
                email: agent.email,
                phone: agent.phone,
                isVerified: agent.isVerified,
                approvalStatus: agent.approvalStatus,
                createdAt: agent.createdAt
            }
        });

    } catch (error) {
        console.error("❌ Verify Agent OTP Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// ============================================
// 3. RESEND AGENT OTP
// ============================================
export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const tempData = await AgentOTPStore.findOne({ email: email.toLowerCase() });
        if (!tempData) {
            return res.status(404).json({
                success: false,
                message: "No OTP found. Please sign up again."
            });
        }

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);

        tempData.otp = otp;
        tempData.otpExpiry = otpExpiry;
        await tempData.save();

        console.log("✅ New OTP generated:", otp);

        try {
            await sendOTPEmail(email, otp, 'agent_signup');
        } catch (emailError) {
            console.log("⚠️ Email error:", emailError.message);
        }

        res.json({
            success: true,
            message: "New verification code sent to your email",
            otp: otp
        });

    } catch (error) {
        console.error("❌ Resend Agent OTP Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// ============================================
// 4. AGENT LOGIN
// ============================================
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const agent = await Agent.findOne({ email: email.toLowerCase() });
        
        if (!agent) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        if (!agent.isVerified) {
            return res.status(401).json({
                success: false,
                message: "Account not verified. Please verify your email first."
            });
        }

        if (agent.approvalStatus === 'pending') {
            return res.status(403).json({
                success: false,
                message: "Your account is pending admin approval. Please wait.",
                status: 'pending'
            });
        }

        if (agent.approvalStatus === 'rejected') {
            return res.status(403).json({
                success: false,
                message: `Your account has been rejected. Reason: ${agent.rejectionReason || 'No reason provided'}`,
                status: 'rejected'
            });
        }

        if (!agent.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is deactivated. Please contact support."
            });
        }

        const isPasswordValid = await agent.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        agent.lastLogin = new Date();
        agent.loginCount = (agent.loginCount || 0) + 1;
        await agent.save();

        const token = jwt.sign(
            {
                id: agent._id,
                email: agent.email,
                name: agent.name,
                role: 'agent'
            },
            process.env.JWT_SECRET || "your_jwt_secret_key_here",
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            message: "Login successful!",
            token,
            agent: {
                id: agent._id,
                name: agent.name,
                email: agent.email,
                phone: agent.phone,
                isVerified: agent.isVerified,
                isActive: agent.isActive,
                approvalStatus: agent.approvalStatus,
                lastLogin: agent.lastLogin
            }
        });

    } catch (error) {
        console.error("❌ Agent Login Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error during login",
            error: error.message
        });
    }
};

// ============================================
// 5. GET AGENT PROFILE
// ============================================
export const getProfile = async (req, res) => {
    try {
        const agent = await Agent.findById(req.agent.id)
            .select("-password -otp -otpExpiry -resetToken -resetTokenExpiry");

        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        res.json({
            success: true,
            agent
        });

    } catch (error) {
        console.error("❌ Get Agent Profile Error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching profile",
            error: error.message
        });
    }
};

// ============================================
// 6. UPDATE AGENT PROFILE
// ============================================
export const updateProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const agent = await Agent.findById(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        const allowedFields = [
            'name', 'phone', 'dateOfBirth', 'gender', 'nationality',
            'idType', 'idNumber',
            'jobTitle', 'company', 'experience', 'education', 'specialization',
            'address', 'city', 'state', 'pincode', 'country',
            'languages', 'skills', 'bio'
        ];

        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                agent[field] = updateData[field];
            }
        });

        const hasIdFile = req.file || (req.files && req.files.idFile);
        const hasIdUrl = req.body.idFileUrl !== undefined;

        if (hasIdFile || hasIdUrl) {
            const { idFile, idFilePublicId, idFileUrl, idFileSource } = extractIdFileInfo(req);
            agent.idFile = idFile;
            agent.idFilePublicId = idFilePublicId;
            agent.idFileUrl = idFileUrl;
            agent.idFileSource = idFileSource;
        }

        if (req.files && req.files.profileImage && req.files.profileImage[0]) {
            const file = req.files.profileImage[0];
            agent.profileImage = `/uploads/agents/${file.filename}`;
            agent.profileImagePublicId = file.filename;
            agent.profileImageSource = 'upload';
            agent.profileImageUrl = '';
        } else if (req.body.profileImageUrl && req.body.profileImageUrl.trim()) {
            agent.profileImageUrl = req.body.profileImageUrl.trim();
            agent.profileImageSource = 'url';
            agent.profileImage = '';
            agent.profileImagePublicId = '';
        }

        await agent.save();

        res.json({
            success: true,
            message: "Profile updated successfully",
            agent: {
                id: agent._id,
                name: agent.name,
                email: agent.email,
                phone: agent.phone,
                updatedAt: agent.updatedAt
            }
        });

    } catch (error) {
        console.error("❌ Update Agent Error:", error);
        res.status(500).json({
            success: false,
            message: "Error updating profile",
            error: error.message
        });
    }
};

// ============================================
// 7. CHANGE AGENT PASSWORD
// ============================================
export const changePassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { currentPassword, newPassword, confirmNewPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({
                success: false,
                message: "All password fields are required"
            });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({
                success: false,
                message: "New passwords do not match"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters"
            });
        }

        const agent = await Agent.findById(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        const isPasswordValid = await agent.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        agent.password = newPassword;
        await agent.save();

        res.json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (error) {
        console.error("❌ Change Password Error:", error);
        res.status(500).json({
            success: false,
            message: "Error changing password",
            error: error.message
        });
    }
};

// ============================================
// 8. GET ALL AGENTS (ADMIN)
// ============================================
export const getAllAgents = async (req, res) => {
    try {
        const agents = await Agent.find()
            .select("-password -otp -otpExpiry -resetToken -resetTokenExpiry")
            .sort({ createdAt: -1 });

        const pending = agents.filter(a => a.approvalStatus === 'pending');
        const approved = agents.filter(a => a.approvalStatus === 'approved');
        const rejected = agents.filter(a => a.approvalStatus === 'rejected');

        console.log(`📊 Fetched ${agents.length} agents (Pending: ${pending.length}, Approved: ${approved.length}, Rejected: ${rejected.length})`);

        res.json({
            success: true,
            count: agents.length,
            stats: {
                pending: pending.length,
                approved: approved.length,
                rejected: rejected.length,
                total: agents.length
            },
            agents
        });

    } catch (error) {
        console.error("❌ GetAllAgents Error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching agents",
            error: error.message
        });
    }
};

// ============================================
// 9. GET PENDING AGENTS (ADMIN)
// ============================================
export const getPendingAgents = async (req, res) => {
    try {
        const agents = await Agent.find({ approvalStatus: 'pending' })
            .select("-password -otp -otpExpiry -resetToken -resetTokenExpiry")
            .sort({ createdAt: 1 });

        res.json({
            success: true,
            count: agents.length,
            agents
        });

    } catch (error) {
        console.error("❌ GetPendingAgents Error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching pending agents",
            error: error.message
        });
    }
};

// ============================================
// 10. GET AGENT BY ID (ADMIN)
// ============================================
export const getAgentById = async (req, res) => {
    try {
        const { id } = req.params;

        const agent = await Agent.findById(id)
            .select("-password -otp -otpExpiry -resetToken -resetTokenExpiry");

        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        res.json({
            success: true,
            agent
        });

    } catch (error) {
        console.error("❌ GetAgentById Error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching agent",
            error: error.message
        });
    }
};

// ============================================
// 11. APPROVE AGENT (ADMIN)
// ============================================
export const approveAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;

        const agent = await Agent.findById(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        const oldStatus = agent.approvalStatus;

        agent.approvalStatus = 'approved';
        agent.approvedBy = adminId;
        agent.approvedAt = new Date();
        agent.isActive = true;
        agent.rejectionReason = '';
        await agent.save();

        let emailSent = false;
        try {
            emailSent = await sendApprovalEmail(agent.email, agent.name);
            console.log("✅ Approval email sent:", emailSent);
        } catch (emailError) {
            console.error("⚠️ Approval email error:", emailError.message);
        }

        res.json({
            success: true,
            message: "Agent approved successfully! Email sent to agent.",
            emailSent,
            agent: {
                id: agent._id,
                name: agent.name,
                email: agent.email,
                approvalStatus: agent.approvalStatus,
                previousStatus: oldStatus,
                approvedAt: agent.approvedAt
            }
        });

    } catch (error) {
        console.error("❌ Approve Agent Error:", error);
        res.status(500).json({
            success: false,
            message: "Error approving agent",
            error: error.message
        });
    }
};

// ============================================
// 12. REJECT AGENT (ADMIN)
// ============================================
export const rejectAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminId = req.admin.id;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required"
            });
        }

        const agent = await Agent.findById(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        const oldStatus = agent.approvalStatus;

        agent.approvalStatus = 'rejected';
        agent.rejectionReason = reason;
        agent.rejectedBy = adminId;
        agent.rejectedAt = new Date();
        agent.isActive = false;
        await agent.save();

        let emailSent = false;
        try {
            emailSent = await sendRejectionEmail(agent.email, agent.name, reason);
            console.log("✅ Rejection email sent:", emailSent);
        } catch (emailError) {
            console.error("⚠️ Rejection email error:", emailError.message);
        }

        res.json({
            success: true,
            message: "Agent rejected successfully! Email sent to agent.",
            emailSent,
            agent: {
                id: agent._id,
                name: agent.name,
                email: agent.email,
                approvalStatus: agent.approvalStatus,
                previousStatus: oldStatus,
                rejectionReason: agent.rejectionReason,
                rejectedAt: agent.rejectedAt
            }
        });

    } catch (error) {
        console.error("❌ Reject Agent Error:", error);
        res.status(500).json({
            success: false,
            message: "Error rejecting agent",
            error: error.message
        });
    }
};

// ============================================
// 13. SET AGENT TO PENDING (ADMIN)
// ============================================
export const setPendingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.admin.id;

        const agent = await Agent.findById(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        const oldStatus = agent.approvalStatus;

        agent.approvalStatus = 'pending';
        agent.rejectionReason = '';
        agent.isActive = false;
        agent.approvedAt = null;
        agent.rejectedAt = null;
        await agent.save();

        let emailSent = false;
        try {
            emailSent = await sendPendingEmail(agent.email, agent.name);
            console.log("✅ Pending email sent:", emailSent);
        } catch (emailError) {
            console.error("⚠️ Pending email error:", emailError.message);
        }

        res.json({
            success: true,
            message: "Agent status changed to pending! Email sent to agent.",
            emailSent,
            agent: {
                id: agent._id,
                name: agent.name,
                email: agent.email,
                approvalStatus: agent.approvalStatus,
                previousStatus: oldStatus
            }
        });

    } catch (error) {
        console.error("❌ Set Pending Error:", error);
        res.status(500).json({
            success: false,
            message: "Error setting agent to pending",
            error: error.message
        });
    }
};

// ============================================
// 14. DELETE AGENT (ADMIN)
// ============================================
export const deleteAgent = async (req, res) => {
    try {
        const { id } = req.params;

        const agent = await Agent.findByIdAndDelete(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        res.json({
            success: true,
            message: "Agent deleted successfully",
            agent: {
                id: agent._id,
                name: agent.name,
                email: agent.email
            }
        });

    } catch (error) {
        console.error("❌ Delete Agent Error:", error);
        res.status(500).json({
            success: false,
            message: "Error deleting agent",
            error: error.message
        });
    }
};