const prisma = require("../utils/prisma");
const ApiError = require('../utils/ApiError');
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10;
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

const searchUsers = async (opts = {}) => {
    const {
        page = 1,
        limit = 20,
        q,
        role,
        isActive,
        isVerified,
        createdFrom,
        createdTo,
        sortBy = 'createdAt',
        sortOrder = 'desc',
    } = opts;

    const where = {
    NOT: { username: { startsWith: 'deleted_' } },

    ...(role && { role }),
    ...(typeof isActive === 'boolean' ? { isActive } : {}),
    ...(typeof isVerified === 'boolean' ? { isVerified } : {}),
    ...((createdFrom || createdTo) ? {
        createdAt: {
            ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
            ...(createdTo ? { lte: new Date(createdTo) } : {}),
        }
    } : {}),
    ...(q ? {
        OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { phoneNumber: { contains: q, mode: 'insensitive' } },
        ]
    } : {}),
};

    const skip = (page - 1) * limit;
    const take = limit;

    const [total, dataRaw] = await prisma.$transaction([
        prisma.user.count({ where }),
        prisma.user.findMany({
            where,
            orderBy: { [sortBy]: sortOrder },
            skip, take,
            select: {
                id: true, email: true, username: true,
                firstName: true, lastName: true, gender: true,
                phoneNumber: true, profilePicture: true,
                role: true, isVerified: true, isActive: true,
                createdAt: true, updatedAt: true,
            }
        })
    ]);

    return {
        data: dataRaw,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        }
    };
};

const getUserByEmail = async (email) => {
    return await prisma.user.findUnique({ where: { email } })
}

const getUserByUsername = async (username) => {
    return await prisma.user.findUnique({ where: { username } })
}

const comparePassword = async (user, plainPassword) => {
    return bcrypt.compare(plainPassword, user.password);
};

const getAllUsers = async () => {
    const users = await prisma.user.findMany({
        where: {
            isActive: true
        }
    })

    // หรือจะสร้าง object ใหม่แบบนี้ก็ได้ (ปลอดภัยกว่า)
    /*
    const safeUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username,
      // ... เอาฟิลด์อื่นๆ ที่ต้องการมาใส่ ...
    }));
    */

    return users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
    });
}

const getUserById = async (id) => {
    const user = await prisma.user.findUnique({ where: { id } })

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    const { password, ...safeUser } = user;
    return safeUser
}

const getUserPublicById = async (id) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true, firstName: true, lastName: true,
            profilePicture: true, role: true, isVerified: true,
            createdAt: true
        }
    });
    if (!user) throw new ApiError(404, 'User not found');
    return user;
};

// const getMyUser = async (id) => {
//     const user = await prisma.user.findUnique({ where: { id } })

//     if (!user) {
//         return null;
//     }

//     const { password, ...safeUser } = user;
//     return safeUser
// }

const createUser = async (data) => {
    const existingUserByEmail = await getUserByEmail(data.email);
    if (existingUserByEmail) {
        throw new ApiError(409, "This email is already in use.");
    }
    const existingUserByUsername = await getUserByUsername(data.username);
    if (existingUserByUsername) {
        throw new ApiError(409, "This username is already taken.");
    }
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    const createData = {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        gender: data.gender,
        nationalIdNumber: data.nationalIdNumber,
        nationalIdExpiryDate: new Date(data.nationalIdExpiryDate), // แปลง string เป็น Date object
        nationalIdPhotoUrl: data.nationalIdPhotoUrl, // URL จาก Cloudinary
        selfiePhotoUrl: data.selfiePhotoUrl, // URL จาก Cloudinary
        role: data.role || 'PASSENGER'
    };

    const user = await prisma.user.create({ data: createData });

    const { password, ...safeUser } = user;
    return safeUser;
}

const updatePassword = async (userId, currentPassword, newPassword) => {
    const userWithPassword = await prisma.user.findUnique({ where: { id: userId } });

    if (!userWithPassword) {
        return { success: false, error: 'USER_NOT_FOUND' };
    }

    const isPasswordCorrect = await bcrypt.compare(currentPassword, userWithPassword.password);

    if (!isPasswordCorrect) {
        return { success: false, error: 'INCORRECT_PASSWORD' };
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
    });

    return { success: true };
};

const updateUserProfile = async (id, data) => {
    const updatedUser = await prisma.user.update({ where: { id }, data });

    const { password, ...safeUser } = updatedUser;
    return safeUser;
};


//ฟังก์ชันช่วยดึง Public ID จาก URL ของ Cloudinary
//ตัวอย่าง: https://res.cloudinary.com/.../painamnae/national_ids/abc123.jpg 
//จะได้ค่า: painamnae/national_ids/abc123
const getPublicIdFromUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    try {
        // แยกส่วนประกอบของ URL เพื่อหาคำว่า /upload/
        const parts = url.split(/\/upload\/v\d+\//);
        if (parts.length < 2) return null;
        
        // ตัดนามสกุลไฟล์ (.jpg, .png, .webp) ออกเพื่อให้ได้ Public ID ที่ถูกต้อง
        return parts[1].split('.')[0];
    } catch (error) {
        return null;
    }
};


 // ฟังก์ชันลบบัญชีผู้ใช้
 // รองรับทั้ง Passenger และ Driver พร้อมล้างรูปภาพบน Cloudinary 
const deleteUser = async (userId) => {
    return await prisma.$transaction(async (tx) => {
        // ดึงข้อมูล User พร้อมข้อมูลที่เกี่ยวข้อง (Vehicles และ DriverVerification)
        // เพื่อนำ URL รูปภาพมาใช้ลบใน Cloudinary ก่อนที่ข้อมูลใน DB จะหายไป
        const user = await tx.user.findUnique({
            where: { id: userId },
            include: {
                driverVerification: true, // สำหรับ Driver (ถ้าเป็น Passenger จะได้ null)
                vehicles: true            // สำหรับ Driver (ถ้าเป็น Passenger จะได้ [])
            }
        });

        if (!user) {
            throw new ApiError(404, 'ไม่พบข้อมูลผู้ใช้ที่ต้องการลบ');
        }

        // สร้างรายการ Public ID ของรูปภาพที่ต้องลบทั้งหมด
        const publicIds = [];

        // --- รูปภาพพื้นฐาน (มีทั้ง Passenger และ Driver) ---
        publicIds.push(getPublicIdFromUrl(user.profilePicture));
        publicIds.push(getPublicIdFromUrl(user.nationalIdPhotoUrl));
        publicIds.push(getPublicIdFromUrl(user.selfiePhotoUrl));

        // --- รูปภาพเฉพาะ Driver (เช็กก่อนว่ามีข้อมูลไหม) ---
        if (user.driverVerification) {
            publicIds.push(getPublicIdFromUrl(user.driverVerification.licensePhotoUrl));
            publicIds.push(getPublicIdFromUrl(user.driverVerification.selfiePhotoUrl));
        }

        // --- รูปภาพรถยนต์ (กรณีเป็น Driver ที่ลงทะเบียนรถไว้) ---
        user.vehicles.forEach(vehicle => {
            // เช็กว่าฟิลด์ photos (Json) เป็น Array หรือไม่
            if (Array.isArray(vehicle.photos)) {
                vehicle.photos.forEach(url => {
                    publicIds.push(getPublicIdFromUrl(url));
                });
            }
        });

        // กรองเอาเฉพาะค่าที่มีอยู่จริง (ลบ null/undefined ออก)
        const finalIdsToDelete = publicIds.filter(Boolean);

        // สั่งลบรูปภาพบน Cloudinary
        if (finalIdsToDelete.length > 0) {
            await Promise.allSettled(
                finalIdsToDelete.map(async (pid) => { // ใส่ async ตรงนี้เพื่อให้ใช้ await ข้างในได้
                    try {
                        // เพิ่ม invalidate: true เพื่อลบรูปที่ค้างใน Cache ของ CDN ด้วย
                        const result = await cloudinary.uploader.destroy(pid, { invalidate: true });
                        
                        // พิมพ์สถานะออกมาดูใน Console ของฝั่ง Backend
                        console.log(`[Cloudinary] Deletion status for ${pid}:`, result); 
                        
                        return result;
                    } catch (error) {
                        console.error(`[Cloudinary] Error deleting ${pid}:`, error);
                        return { result: 'error', error };
                    }
                })
            );
        }

        // สั่งลบ User หลักใน Database
        // เนื่องด้วย onDelete: Cascade ใน schema.prisma
        // ทำให้ข้อมูลในตาราง DriverVerification, Vehicle, Route, Booking จะถูกลบอัตโนมัติ
        // แต่ TrafficLog จะยังคงอยู่ เพราะไม่มี @relation
        const deleted = await tx.user.delete({
            where: { id: userId }
        });

        // คืนค่าข้อมูล User ที่ลบแล้ว (ตัด password ออกเพื่อความปลอดภัย)
        const { password, ...safeDeleted } = deleted;
        return safeDeleted;
    });
};


// เอกสารประกอบ: ส่งออกข้อมูล User ไป CSV พร้อม Zip ด้วย National ID และส่ง Email
const exportAndEmailUserData = async (userId, nationalIdNumber, exportData = {}) => {
    const { 
        generateUserDataCSV, 
        generateDriverVerificationCSV, 
        generateVehiclesDataCSV,
        generateRouteHistoryCSV,
        generateBookingHistoryCSV
    } = require('../utils/csvExport');
    const { createZipArchive } = require('../utils/zipService');
    const { sendExportedDataEmail } = require('../utils/emailService');

    try {
        // เช็คว่า user เลือก data ไหมบ้าง
        const hasSelectedData = exportData && Object.values(exportData).some(val => val === true);
        
        if (!hasSelectedData) {
            console.log('[Export and Email] No data selected for export. Skipping email.');
            return {
                success: true,
                message: 'No data selected for export. Email not sent.',
                emailSent: false
            };
        }

        // ดึงข้อมูล User ทั้งหมด
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                driverVerification: true,
                vehicles: true,
                bookings: {    // สำหรับ Passenger: bookings ทั้งหมด
                    include: {
                        route: true  // ดึง route info ใน booking
                    }
                },
                createdRoutes: true  // สำหรับ Driver: routes ที่สร้าง
            }
        });

        if (!user) {
            throw new ApiError(404, 'ไม่พบข้อมูลผู้ใช้');
        }

        // ดึง routes ที่ user เป็น passenger (จาก bookings)
        let passengerRoutes = [];
        if (user.bookings && user.bookings.length > 0) {
            // เก็บ unique routes จาก bookings
            const uniqueRoutes = new Map();
            user.bookings.forEach(booking => {
                if (booking.route && !uniqueRoutes.has(booking.route.id)) {
                    uniqueRoutes.set(booking.route.id, booking.route);
                }
            });
            passengerRoutes = Array.from(uniqueRoutes.values());
        }

        // สร้าง array สำหรับเก็บ CSV files
        const csvFiles = [];

        // สร้าง User Data CSV (ถ้าเลือก personalInfo)
        if (exportData.personalInfo) {
            const userCsvResult = await generateUserDataCSV(user);
            if (userCsvResult.success) {
                csvFiles.push({
                    fileName: userCsvResult.fileName,
                    data: userCsvResult.data
                });
                console.log('[Export] Added user data CSV');
            } else {
                console.error('[CSV Generation Error] Failed to generate user data:', userCsvResult);
            }
        }

        // สร้าง Driver Verification CSV (ถ้าเลือก driverLicense และมีข้อมูล)
        if (exportData.driverLicense && user.driverVerification) {
            const driverCsvResult = await generateDriverVerificationCSV(user.driverVerification);
            if (driverCsvResult.success) {
                csvFiles.push({
                    fileName: driverCsvResult.fileName,
                    data: driverCsvResult.data
                });
                console.log('[Export] Added driver verification CSV');
            }
        }

        // สร้าง Vehicles Data CSV (ถ้าเลือก vehicle และมีข้อมูล)
        if (exportData.vehicle && user.vehicles && user.vehicles.length > 0) {
            const vehiclesCsvResult = await generateVehiclesDataCSV(user.vehicles);
            if (vehiclesCsvResult.success) {
                csvFiles.push({
                    fileName: vehiclesCsvResult.fileName,
                    data: vehiclesCsvResult.data
                });
                console.log('[Export] Added vehicles CSV');
            }
        }

        // สร้าง Route History CSV (ถ้าเลือก routeHistory และมีข้อมูล) - สำหรับ Driver
        if (exportData.routeHistory && user.createdRoutes && user.createdRoutes.length > 0) {
            const routeCsvResult = await generateRouteHistoryCSV(user.createdRoutes);
            if (routeCsvResult.success) {
                csvFiles.push({
                    fileName: routeCsvResult.fileName,
                    data: routeCsvResult.data
                });
                console.log('[Export] Added route history CSV');
            }
        }

        // สร้าง Booking History CSV (ถ้าเลือก bookingHistory และมีข้อมูล) - สำหรับ Passenger
        if (exportData.bookingHistory && user.bookings && user.bookings.length > 0) {
            const bookingCsvResult = await generateBookingHistoryCSV(user.bookings);
            if (bookingCsvResult.success) {
                csvFiles.push({
                    fileName: bookingCsvResult.fileName,
                    data: bookingCsvResult.data
                });
                console.log('[Export] Added booking history CSV');
            }
        }

        // ถ้าไม่มี CSV files ที่ generate ได้ → ไม่ส่งอีเมล
        if (csvFiles.length === 0) {
            console.log('[Export and Email] No CSV files generated. Email not sent.');
            return {
                success: true,
                message: 'No CSV files generated. Email not sent.',
                emailSent: false
            };
        }

        // Zip files 
        const zipResult = await createZipArchive(csvFiles);

        if (!zipResult.success) {
            throw new Error(zipResult.error || 'Failed to create zip file');
        }

        // ส่ง email พร้อม zip file
        const emailResult = await sendExportedDataEmail(
            user.email,
            zipResult.data,
            user.firstName || user.username
        );

        return {
            success: true,
            message: 'ส่งออกข้อมูล User และส่ง Email สำเร็จ',
            emailSent: emailResult.success,
            emailMessage: emailResult.message
        };

    } catch (error) {
        console.error('[Export and Email User Data Error]', error);
        return {
            success: false,
            message: error.message || 'เกิดข้อผิดพลาดในการส่งออกข้อมูลและส่ง Email'
        };
    }
};


// ฟังก์ชันการลบ User แบบ Anonymize
const anonymizeUser = async (userId) => {
    // 1. ดึงข้อมูลมาเตรียมไว้ข้างนอก Transaction ก่อนเลย
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            driverVerification: true,
            vehicles: true,
        }
    });

    if (!user) throw new ApiError(404, 'ไม่พบข้อมูลผู้ใช้');

    // 2. รวบรวม Public IDs เตรียมไว้
    const publicIds = [];
    publicIds.push(getPublicIdFromUrl(user.profilePicture));
    publicIds.push(getPublicIdFromUrl(user.nationalIdPhotoUrl));
    publicIds.push(getPublicIdFromUrl(user.selfiePhotoUrl));

    if (user.driverVerification) {
        publicIds.push(getPublicIdFromUrl(user.driverVerification.licensePhotoUrl));
        publicIds.push(getPublicIdFromUrl(user.driverVerification.selfiePhotoUrl));
    }

    user.vehicles.forEach(vehicle => {
        if (Array.isArray(vehicle.photos)) {
            vehicle.photos.forEach(url => publicIds.push(getPublicIdFromUrl(url)));
        }
    });

    const finalIdsToDelete = publicIds.filter(Boolean);

    // 3. เริ่มงาน Database (ให้ทำงานรวดเร็วเพียงอย่างเดียว)
    const result = await prisma.$transaction(async (tx) => {
        const hash = crypto.createHash('sha256')
            .update(userId + Date.now())
            .digest('hex')
            .slice(0, 12);

        // Anonymize ข้อมูล User
        const anonymized = await tx.user.update({
            where: { id: userId },
            data: {
                username: `deleted_${hash}`,
                email: `deleted_${hash}@deleted.invalid`,
                password: '[DELETED]',
                firstName: 'Deleted',
                lastName: 'User',
                gender: null,
                phoneNumber: null,
                profilePicture: null,
                nationalIdNumber: `DELETED_${hash}`,
                nationalIdPhotoUrl: `DELETED_${hash}_photo`,
                nationalIdExpiryDate: null,
                selfiePhotoUrl: null,
                otpCode: null,
                isActive: false,
                isVerified: false,
                lastLogin: null,
                passengerSuspendedUntil: null,
                driverSuspendedUntil: null,
            }
        });

        if (user.driverVerification) {
            await tx.driverVerification.update({
                where: { userId },
                data: {
                    licenseNumber: `DEL-${hash.toUpperCase()}`,
                    firstNameOnLicense: 'Deleted',
                    lastNameOnLicense: 'User',
                    // ห้ามใส่ null เพราะ Schema บังคับว่าเป็น String
                    // ให้ใส่ข้อความบอกสถานะแทน เพื่อให้ตรงตามเงื่อนไขของ Database
                    licensePhotoUrl: `DELETED_${hash}`, 
                    selfiePhotoUrl:  `DELETED_${hash}`,
                    status: 'REJECTED'
                    }
            });
        }

        const userVehicles = await tx.vehicle.findMany({
            where: { userId },
        });

        for (const vehicle of userVehicles) {
            await tx.vehicle.update({
                where: { id: vehicle.id },
                data: {
                    // ใช้ userId และ vehicle.id เพื่อให้เลขทะเบียนใหม่ไม่ซ้ำกัน
                    licensePlate: `DELETE_${userId.slice(-4)}_${String(vehicle.id).slice(-4)}`, // เปลี่ยนเลขทะเบียนแบบไม่ชนกัน
                    photos: null // ลบรูปภาพรถ
                }
            });
        }
        await tx.notification.deleteMany({ where: { userId } });

        
        // ส่วนของการจัดการกับ Booking
        // ค้นหาการจองที่ยังไม่จบของ User คนนี้
        const activeBookings = await tx.booking.findMany({
            where: {
                passengerId: userId,
                status: { in: ['PENDING', 'CONFIRMED'] } // เฉพาะที่ยังรออยู่หรือยืนยันแล้ว
            },
            include: {
                route: true
            }
        });

        // วนลูปเพื่อยกเลิกการจองและคืนที่นั่ง
        for (const booking of activeBookings) {
            // คืนที่นั่งให้ Driver ในตาราง Route
            await tx.route.update({
                where: { id: booking.routeId },
                data: {
                    availableSeats: {
                        increment: booking.numberOfSeats // บวกที่นั่งกลับคืนไป
                    }
                }
            });

            // อัปเดตสถานะการจองเป็นยกเลิก
            await tx.booking.update({
                where: { id: booking.id },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancelledBy: 'PASSENGER',
                    cancelReason: 'CHANGE_OF_PLAN' 
                }
            });
        }
        
        // ส่วนของการจัดการกับ Booking
        if (user.role === 'DRIVER') {
            // 1. ค้นหาเส้นทางที่ยังไม่เสร็จสิ้น (ยังไม่จบงาน หรือ ยังไม่ถูกยกเลิก)
            const activeRoutes = await tx.route.findMany({
                where: {
                    driverId: userId,
                    status: { in: ['AVAILABLE', 'FULL', 'IN_TRANSIT'] }
                },
                include: {
                    bookings: true // ดึงการจองของทุกเส้นทางออกมาด้วย
                }
            });

            for (const route of activeRoutes) {
                // 2. ยกเลิกการจองทั้งหมดในเส้นทางนั้นๆ
                if (route.bookings.length > 0) {
                    await tx.booking.updateMany({
                        where: { routeId: route.id },
                        data: {
                            status: 'CANCELLED',
                            cancelledAt: new Date(),
                            cancelledBy: 'DRIVER',
                            cancelReason: 'DRIVER_DELAY' // หรือตั้งใหม่เป็น SYSTEM_DEACTIVATION
                        }
                    });
                    
                }

                // 3. ยกเลิกเส้นทางของ Driver
                await tx.route.update({
                    where: { id: route.id },
                    data: {
                        status: 'CANCELLED',
                        cancelledAt: new Date(),
                        cancelledBy: 'DRIVER'
                    }
                });
            }
        }        

        return anonymized;
    });

    // 4. เมื่อ Database อัปเดตสำเร็จแล้ว ค่อยสั่งลบรูปบน Cloudinary (อยู่นอก tx แล้ว ไม่ติด timeout แน่นอน)
    if (finalIdsToDelete.length > 0) {
        // ไม่ต้องรอ (await) ก็ได้ถ้าอยากให้ User ได้รับ Response เร็วขึ้น 
        // หรือจะรอเพื่อดู log ก็ได้ เพราะมันไม่กระทบ DB แล้ว
        Promise.allSettled(
            finalIdsToDelete.map(pid =>
                cloudinary.uploader.destroy(pid, { invalidate: true })
                    .then(res => console.log(`[Cloudinary] Deleted ${pid}:`, res))
                    .catch(err => console.error(`[Cloudinary] Error deleting ${pid}:`, err))
            )
        );
    }

    const { password, ...safeAnonymized } = result;
    return safeAnonymized;
};


// const setUserStatusActive = async (id, isActive) => {
//     const updatedUser = await prisma.user.update({
//         where: { id },
//         data: { isActive: isActive },
//     });

//     const { password, ...safeUser } = updatedUser;
//     return safeUser;
// };

// const setUserStatusVerified = async (id, isVerified) => {
//     const updatedUser = await prisma.user.update({
//         where: { id },
//         data: { isVerified: isVerified },
//     });

//     const { password, ...safeUser } = updatedUser;
//     return safeUser;
// };

// เฉพาะใช้สำหรับ verify password เท่านั้น ไม่ return ออกไปใช้ที่อื่น
const verifyPasswordById = async (id, plainPassword) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            password: true
        }
    })

    if (!user) return null  

    return bcrypt.compare(plainPassword, user.password)  
}

module.exports = {
    searchUsers,
    getAllUsers,
    getUserById,
    createUser,
    getUserByEmail,
    getUserByUsername,
    comparePassword,
    updatePassword,
    deleteUser,
    anonymizeUser,
    exportAndEmailUserData,
    updateUserProfile,
    getUserPublicById,
    verifyPasswordById,
};