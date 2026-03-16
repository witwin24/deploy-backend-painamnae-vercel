const THAI_TIMEZONE_OFFSET_HOURS = 7;
const MS_PER_HOUR = 60 * 60 * 1000;
const THAI_TIME_OFFSET_MS = THAI_TIMEZONE_OFFSET_HOURS * MS_PER_HOUR;

/**
 * แปลงเวลาปัจจุบันเป็น UTC+7 (ไทย)
 * ใช้ตอนเก็บ Log
 */
const nowThai = () => {
    return new Date(Date.now() + THAI_TIME_OFFSET_MS);
};

/**
 * แปลง UTC → UTC+7 สำหรับ query Prisma
 * ใช้ตอนรับ startDate / endDate จาก Frontend
 */
const utcToThai = (dateStr) => {
    const date = new Date(dateStr);
    date.setTime(date.getTime() + THAI_TIME_OFFSET_MS);
    return date;
};

module.exports = { nowThai, utcToThai };