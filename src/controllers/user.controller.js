const asyncHandler = require('express-async-handler');
const userService = require("../services/user.service");
const ApiError = require('../utils/ApiError');
const { uploadToCloudinary } = require('../utils/cloudinary');
const notifService = require('../services/notification.service');
const bcrypt = require("bcrypt");
const prisma = require('../config/prisma');

const adminListUsers = asyncHandler(async (req, res) => {
    const result = await userService.searchUsers(req.query);
    res.status(200).json({
        success: true,
        message: "Users (admin) retrieved",
        ...result,
    });
});

const getAllUsers = asyncHandler(async (req, res) => {
    const users = await userService.getAllUsers();
    res.status(200).json({
        success: true,
        message: "Users retrieved",
        data: users
    });
});

const getUserById = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    res.status(200).json({
        success: true,
        message: "User retrieved",
        data: user
    });
});

const getUserPublicById = asyncHandler(async (req, res) => {
    const user = await userService.getUserPublicById(req.params.id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    res.status(200).json({
        success: true,
        message: "User retrieved",
        data: user
    });
});

const getMyUser = asyncHandler(async (req, res) => {
    const user = req.user.sub
    const data = await userService.getUserById(user)
    res.status(200).json({
        success: true,
        message: "User retrieved",
        data: data
    })

})
const createUser = asyncHandler(async (req, res) => {
    const userData = req.body;

    if (!req.files || !req.files.nationalIdPhotoUrl || !req.files.selfiePhotoUrl) {
        throw new ApiError(400, "National ID photo and selfie photo are required.");
    }

    // อัปโหลดรูปทั้งสองไปยัง Cloudinary
    const [nationalIdResult, selfieResult] = await Promise.all([
        uploadToCloudinary(req.files.nationalIdPhotoUrl[0].buffer, 'painamnae/national_ids'),
        uploadToCloudinary(req.files.selfiePhotoUrl[0].buffer, 'painamnae/selfies')
    ]);

    // เพิ่ม URL ของรูปภาพเข้าไปในข้อมูลที่จะบันทึก
    userData.nationalIdPhotoUrl = nationalIdResult.url;
    userData.selfiePhotoUrl = selfieResult.url;

    const newUser = await userService.createUser(userData);

    const notifPayload = {
        userId: newUser.id,
        type: 'VERIFICATION',
        title: 'ข้อมูลยืนยันตัวตนถูกส่งแล้ว',
        body: 'เราได้รับข้อมูลบัตรประชาชนและรูปถ่ายของคุณแล้ว กำลังรอแอดมินตรวจสอบ',
        link: '/profile/verification',
        metadata: {
            kind: 'identity_verification_submission',
            userId: newUser.id,
            initiatedBy: 'user'
        }
    }

    await notifService.createNotificationByAdmin(notifPayload)

    res.status(201).json({
        success: true,
        message: "User created successfully. Please wait for verification.",
        data: newUser
    });
});

const deleteMyUser = asyncHandler(async (req, res) => {
    try {
        const userId = req.user.sub;
        const { password, exportData } = req.body;

        console.log('[DELETE USER] Starting deletion process for userId:', userId);
        console.log('[DELETE USER] Received password:', !!password);
        console.log('[DELETE USER] Export data:', exportData);

        if (!password) {
            console.warn('[DELETE USER] Password not provided');
            return res.status(400).json({
                success: false,
                message: "Password is required"
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                password: true,
                email: true,
                firstName: true,
                username: true,
                nationalIdNumber: true
            }
        });

        if (!user) {
            console.warn('[DELETE USER] User not found with id:', userId);
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.nationalIdNumber) {
            console.warn('[DELETE USER] National ID not found for user:', user.email);
            return res.status(400).json({
                success: false,
                message: "National ID not found. Please complete identity verification first."
            });
        }

        console.log('[DELETE USER] User found:', user.email);
        
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('[DELETE USER] Password comparison result:', isMatch);

        if (!isMatch) {
            console.warn('[DELETE USER] Password mismatch for user:', user.email);
            return res.status(401).json({
                success: false,
                message: "Invalid password"
            });
        }

        // ส่งออกข้อมูล User ไป CSV, Zip ด้วย National ID Number เป็น Password และส่ง Email
        console.log('[DELETE USER] Starting export process...');
        const exportResult = await userService.exportAndEmailUserData(userId, user.nationalIdNumber, exportData);
        console.log('[DELETE USER] Export result:', exportResult);

        if (!exportResult.success) {
            console.error('[DELETE USER] Export failed:', exportResult.message);
            // ถ้า export ล้มเหลว ให้ยังคงลบบัญชีต่อไป แต่ alert ให้ผู้ใช้ทราบ
        }

        // ลบบัญชี User (Anonymize)
        console.log('[DELETE USER] Starting user anonymization...');
        const deletedUser = await userService.anonymizeUser(userId);
        console.log('[DELETE USER] User anonymized successfully:', deletedUser.id);

        res.status(200).json({
            success: true,
            message: "User account deleted successfully. Data has been exported and sent to your email.",
            data: { 
                deletedUserId: deletedUser.id,
                emailSent: exportResult.emailSent
            }
        });

    } catch (err) {
        console.error("DELETE USER ERROR:", err);
        console.error('Error stack:', err.stack);
        res.status(500).json({
            success: false,
            message: err.message || "Internal Server Error"
        });
    }
});

const updateCurrentUserProfile = asyncHandler(async (req, res) => {
    // เอาข้อมูล text fields ที่มากับ req.body
    const updateData = { ...req.body };


    if (req.files?.nationalIdPhotoUrl) {
        const buf = req.files.nationalIdPhotoUrl[0].buffer;
        const result = await uploadToCloudinary(buf, 'painamnae/national_ids');
        updateData.nationalIdPhotoUrl = result.url;
    }

    if (req.files?.selfiePhotoUrl) {
        const buf = req.files.selfiePhotoUrl[0].buffer;
        const result = await uploadToCloudinary(buf, 'painamnae/selfies');
        updateData.selfiePhotoUrl = result.url;
    }

    if (req.files?.profilePicture) {
        const buf = req.files.profilePicture[0].buffer;
        const result = await uploadToCloudinary(buf, 'painamnae/profiles');
        updateData.profilePicture = result.url;
    }

    const updatedUser = await userService.updateUserProfile(req.user.sub, updateData);
    res.status(200).json({
        success: true,
        message: "Profile updated",
        data: updatedUser
    });
});

const adminUpdateUser = asyncHandler(async (req, res) => {
    const updatedUser = await userService.updateUserProfile(req.params.id, req.body);
    res.status(200).json({
        success: true,
        message: "User updated by admin",
        data: updatedUser
    });
});

// const adminDeleteUser = asyncHandler(async (req, res) => {
//     const deletedUser = await userService.deleteUser(req.params.id);
//     res.status(200).json({
//         success: true,
//         message: "User deleted successfully.",
//         data: { deletedUserId: deletedUser.id }
//     });
// });

// Admin ลบ User (Anonymize)
const adminDeleteUser = asyncHandler(async (req, res) => {
    const anonymized = await userService.anonymizeUser(req.params.id);
    res.status(200).json({
        success: true,
        message: "User anonymized successfully.",
        data: { deletedUserId: anonymized.id }
    });
});

const setUserStatus = asyncHandler(async (req, res) => {
    const { isActive, isVerified } = req.body

    if (typeof isActive !== 'boolean' && typeof isVerified !== 'boolean') {
        throw new ApiError(400, 'Provide at least one of isActive or isVerified as boolean');
    }

    let updatedUser = await userService.updateUserProfile(req.params.id, {
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(typeof isVerified === 'boolean' ? { isVerified } : {}),
    });

    if (typeof isVerified === 'boolean') {
        try {
            if (isVerified === true) {
                await notifService.createNotificationByAdmin({
                    userId: updatedUser.id,
                    type: 'VERIFICATION',
                    title: 'ยืนยันตัวตนสำเร็จ',
                    body: 'แอดมินได้ตรวจสอบบัญชีของคุณแล้ว ตอนนี้คุณสามารถใช้งานได้เต็มรูปแบบ',
                    link: '/profile/verification',
                    metadata: {
                        kind: 'user_verification',
                        userId: updatedUser.id,
                        initiatedBy: 'system'
                    }
                });
            }
            else if (isVerified === false) {
                await notifService.createNotificationByAdmin({
                    userId: updatedUser.id,
                    type: 'VERIFICATION',
                    title: 'ยืนยันตัวตนไม่สำเร็จ',
                    body: 'ข้อมูลบัตรประชาชน/รูปถ่ายของคุณไม่ผ่านการตรวจสอบ กรุณาตรวจสอบและส่งใหม่อีกครั้ง',
                    link: '/profile/verification',
                    metadata: {
                        kind: 'user_verification',
                        userId: updatedUser.id,
                        initiatedBy: 'system'
                    }
                });
            }
        } catch (e) {
            console.error('Failed to create verification notification:', e);
        }
    }

    res.status(200).json({ success: true, message: "User status updated", data: updatedUser });
});

const comparePassword = asyncHandler(async (req, res) => {
    const { password } = req.body;

    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    const result = await userService.verifyPasswordById(req.params.id, password)

    if (result === null) {
        throw new ApiError(404, "ไม่พบผู้ใช้");
    }

    if (!result) {
        throw new ApiError(401, "รหัสผ่านไม่ถูกต้อง");
    }

    res.status(200).json({ message: "verified" });
});





module.exports = {
    adminListUsers,
    getAllUsers,
    getUserById,
    getMyUser,
    getUserPublicById,
    createUser,
    updateCurrentUserProfile,
    adminUpdateUser,
    adminDeleteUser,
    setUserStatus,
    deleteMyUser,
    comparePassword,
};