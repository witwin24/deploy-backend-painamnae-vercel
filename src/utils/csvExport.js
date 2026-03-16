const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const { Readable } = require('stream');

/**
 * Generate CSV data for user as buffer
 * @param {Object} user - User data object
 * @returns {Object} - { success: boolean, data: Buffer }
 */
const generateUserDataCSV = async (user) => {
    try {
        // Create CSV header
        let csvContent = 'Field,Value\n';

        // Prepare data rows
        const data = [
            { field: 'User ID', value: user.id || 'N/A' },
            { field: 'Username', value: user.username || 'N/A' },
            { field: 'Email', value: user.email || 'N/A' },
            { field: 'First Name', value: user.firstName || 'N/A' },
            { field: 'Last Name', value: user.lastName || 'N/A' },
            { field: 'Gender', value: user.gender || 'N/A' },
            { field: 'Phone Number', value: user.phoneNumber ? String(user.phoneNumber) : 'N/A' },
            { field: 'National ID Number', value: user.nationalIdNumber ? `'${user.nationalIdNumber}` : 'N/A' },
            { field: 'National ID Expiry Date', value: user.nationalIdExpiryDate ? new Date(user.nationalIdExpiryDate).toISOString().split('T')[0] : 'N/A' },
            { field: 'Role', value: user.role || 'PASSENGER' },
            { field: 'Is Verified', value: user.isVerified ? 'Yes' : 'No' },
            { field: 'Is Active', value: user.isActive ? 'Yes' : 'No' },
            { field: 'Created At', value: user.createdAt ? new Date(user.createdAt).toISOString() : 'N/A' },
            { field: 'Updated At', value: user.updatedAt ? new Date(user.updatedAt).toISOString() : 'N/A' },
            { field: 'Last Login', value: user.lastLogin ? new Date(user.lastLogin).toISOString() : 'N/A' }
        ];

        // Convert to CSV (with proper escaping)
        data.forEach(row => {
            const escapedValue = String(row.value).includes(',') || String(row.value).includes('"') 
                ? `"${String(row.value).replace(/"/g, '""')}"` 
                : row.value;
            csvContent += `"${row.field}","${escapedValue}"\n`;
        });

        // Add BOM for UTF-8 encoding
        const buffer = Buffer.from('\ufeff' + csvContent, 'utf8');

        return {
            success: true,
            data: buffer,
            fileName: 'user_data.csv'
        };

    } catch (error) {
        console.error('[User Data CSV Generation Error]', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generate Driver Verification CSV data as buffer
 * @param {Object} driverVerification - Driver verification data
 * @returns {Object} - { success: boolean, data: Buffer }
 */
const generateDriverVerificationCSV = async (driverVerification) => {
    try {
        let csvContent = 'Field,Value\n';

        const data = [
            { field: 'License Number', value: driverVerification?.licenseNumber ? `'${driverVerification.licenseNumber}` : 'N/A' },
            { field: 'First Name on License', value: driverVerification?.firstNameOnLicense || 'N/A' },
            { field: 'Last Name on License', value: driverVerification?.lastNameOnLicense || 'N/A' },
            { field: 'License Type', value: driverVerification?.typeOnLicense || 'N/A' },
            { field: 'License Issue Date', value: driverVerification?.licenseIssueDate ? new Date(driverVerification.licenseIssueDate).toISOString().split('T')[0] : 'N/A' },
            { field: 'License Expiry Date', value: driverVerification?.licenseExpiryDate ? new Date(driverVerification.licenseExpiryDate).toISOString().split('T')[0] : 'N/A' },
            { field: 'Verification Status', value: driverVerification?.status || 'N/A' },
            { field: 'Created At', value: driverVerification?.createdAt ? new Date(driverVerification.createdAt).toISOString() : 'N/A' }
        ];

        data.forEach(row => {
            const escapedValue = String(row.value).includes(',') || String(row.value).includes('"') 
                ? `"${String(row.value).replace(/"/g, '""')}"` 
                : row.value;
            csvContent += `"${row.field}","${escapedValue}"\n`;
        });

        const buffer = Buffer.from('\ufeff' + csvContent, 'utf8');

        return {
            success: true,
            data: buffer,
            fileName: 'driver_verification.csv'
        };

    } catch (error) {
        console.error('[Driver Verification CSV Generation Error]', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generate vehicles data as CSV buffer
 * @param {Array} vehicles - Array of vehicle objects
 * @returns {Object} - { success: boolean, data: Buffer }
 */
const generateVehiclesDataCSV = async (vehicles) => {
    try {
        let csvContent = 'No.,Vehicle Model,License Plate,Vehicle Type,Color,Seat Capacity,Amenities\n';

        vehicles.forEach((vehicle, index) => {
            const row = {
                no: index + 1,
                model: vehicle.vehicleModel || 'N/A',
                plate: vehicle.licensePlate ? `'${vehicle.licensePlate}` : 'N/A',
                type: vehicle.vehicleType || 'N/A',
                color: vehicle.color || 'N/A',
                capacity: String(vehicle.seatCapacity || 'N/A'),
                amenities: Array.isArray(vehicle.amenities) ? vehicle.amenities.join('; ') : 'N/A'
            };

            const values = [row.no, row.model, row.plate, row.type, row.color, row.capacity, row.amenities];
            const csvRow = values.map(val => {
                const str = String(val);
                return str.includes(',') || str.includes('"') 
                    ? `"${str.replace(/"/g, '""')}"` 
                    : `"${str}"`;
            }).join(',');

            csvContent += csvRow + '\n';
        });

        const buffer = Buffer.from('\ufeff' + csvContent, 'utf8');

        return {
            success: true,
            data: buffer,
            fileName: 'vehicles_data.csv'
        };

    } catch (error) {
        console.error('[Vehicles CSV Generation Error]', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generate route history data as CSV buffer (for Driver)
 * @param {Array} routes - Array of route objects
 * @returns {Object} - { success: boolean, data: Buffer }
 */
const generateRouteHistoryCSV = async (routes) => {
    try {
        let csvContent = 'No.,Route ID,Origin,Destination,Departure Date,Departure Time,Available Seats,Price per Seat,Status,Created At\n';

        routes.forEach((route, index) => {
            const row = {
                no: index + 1,
                routeId: route.id || 'N/A',
                origin: route.startLocation ? (route.startLocation.address || route.startLocation.name || 'N/A') : 'N/A',
                destination: route.endLocation ? (route.endLocation.address || route.endLocation.name || 'N/A') : 'N/A',
                departureDate: route.departureTime ? new Date(route.departureTime).toISOString().split('T')[0] : 'N/A',
                departureTime: route.departureTime ? new Date(route.departureTime).toTimeString().slice(0, 5) : 'N/A',
                availableSeats: String(route.availableSeats || 'N/A'),
                pricePerSeat: route.pricePerSeat ? `'${route.pricePerSeat}` : 'N/A',
                status: route.status || 'N/A',
                createdAt: route.createdAt ? new Date(route.createdAt).toISOString() : 'N/A'
            };

            const values = [row.no, row.routeId, row.origin, row.destination, row.departureDate, row.departureTime, row.availableSeats, row.pricePerSeat, row.status, row.createdAt];
            const csvRow = values.map(val => {
                const str = String(val);
                return str.includes(',') || str.includes('"') 
                    ? `"${str.replace(/"/g, '""')}"` 
                    : `"${str}"`;
            }).join(',');

            csvContent += csvRow + '\n';
        });

        const buffer = Buffer.from('\ufeff' + csvContent, 'utf8');

        return {
            success: true,
            data: buffer,
            fileName: 'route_history.csv'
        };

    } catch (error) {
        console.error('[Route History CSV Generation Error]', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generate booking history data as CSV buffer (for Passenger)
 * @param {Array} bookings - Array of booking objects
 * @returns {Object} - { success: boolean, data: Buffer }
 */
const generateBookingHistoryCSV = async (bookings) => {
    try {
        let csvContent = 'No.,Booking ID,Route ID,Origin,Destination,Booking Date,Departure Date,Number of Seats,Status,Created At\n';

        bookings.forEach((booking, index) => {
            const row = {
                no: index + 1,
                bookingId: booking.id || 'N/A',
                routeId: booking.routeId || 'N/A',
                origin: booking.route?.startLocation ? (booking.route.startLocation.address || booking.route.startLocation.name || 'N/A') : 'N/A',
                destination: booking.route?.endLocation ? (booking.route.endLocation.address || booking.route.endLocation.name || 'N/A') : 'N/A',
                bookingDate: booking.createdAt ? new Date(booking.createdAt).toISOString().split('T')[0] : 'N/A',
                departureDate: booking.route?.departureTime ? new Date(booking.route.departureTime).toISOString().split('T')[0] : 'N/A',
                numberOfSeats: String(booking.numberOfSeats || 'N/A'),
                status: booking.status || 'N/A',
                createdAt: booking.createdAt ? new Date(booking.createdAt).toISOString() : 'N/A'
            };

            const values = [row.no, row.bookingId, row.routeId, row.origin, row.destination, row.bookingDate, row.departureDate, row.numberOfSeats, row.status, row.createdAt];
            const csvRow = values.map(val => {
                const str = String(val);
                return str.includes(',') || str.includes('"') 
                    ? `"${str.replace(/"/g, '""')}"` 
                    : `"${str}"`;
            }).join(',');

            csvContent += csvRow + '\n';
        });

        const buffer = Buffer.from('\ufeff' + csvContent, 'utf8');

        return {
            success: true,
            data: buffer,
            fileName: 'booking_history.csv'
        };

    } catch (error) {
        console.error('[Booking History CSV Generation Error]', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    generateUserDataCSV,
    generateDriverVerificationCSV,
    generateVehiclesDataCSV,
    generateRouteHistoryCSV,
    generateBookingHistoryCSV
};
