// This file acts as the database layer.
// It uses a hybrid approach:
// 1. If running on Trickle, it uses the built-in Trickle Database for cross-device sync.
// 2. If running locally or hosted elsewhere (e.g., Vercel, Netlify), it falls back to Local Storage.

window.StorageDB = {
    // Helper to check if we are in the Trickle environment
    isTrickleEnv: () => {
        // Temporarily disabled to use local storage exclusively
        return false;
    },

    // --- Local Session & Preferences (Always uses localStorage) ---
    getCurrentUser: () => {
        try {
            return JSON.parse(localStorage.getItem('aether_current_user'));
        } catch { return null; }
    },
    setCurrentUser: (user) => {
        if (user) {
            localStorage.setItem('aether_current_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('aether_current_user');
        }
    },
    getSavedAccounts: () => {
        try {
            const accounts = JSON.parse(localStorage.getItem('aether_saved_accounts') || '[]');
            return Array.isArray(accounts) ? accounts : [];
        } catch { return []; }
    },
    saveAccount: (user) => {
        try {
            if (!user || !user.email) return;
            const accounts = window.StorageDB.getSavedAccounts();
            const existing = accounts.findIndex(a => a.email === user.email);
            if (existing >= 0) {
                accounts[existing] = user;
            } else {
                accounts.push(user);
            }
            localStorage.setItem('aether_saved_accounts', JSON.stringify(accounts));
        } catch (e) {
            console.error('Error saving account:', e);
        }
    },
    removeAccount: (email) => {
        try {
            const accounts = window.StorageDB.getSavedAccounts();
            const filtered = accounts.filter(a => a.email !== email);
            localStorage.setItem('aether_saved_accounts', JSON.stringify(filtered));
        } catch (e) {
            console.error('Error removing account:', e);
        }
    },
    getApiKey: () => {
        try {
            return localStorage.getItem('aether_api_key') || '';
        } catch { return ''; }
    },
    setApiKey: (key) => {
        if (key) {
            localStorage.setItem('aether_api_key', key);
        } else {
            localStorage.removeItem('aether_api_key');
        }
    },

    // --- Users Management ---
    getUsers: async () => {
        try {
            const local = JSON.parse(localStorage.getItem('local_aether_user') || '[]');
            return Array.isArray(local) ? local : [];
        } catch (e) {
            console.error("Error reading local users:", e);
            return [];
        }
    },
    saveUser: async (user) => {
        try {
            const users = JSON.parse(localStorage.getItem('local_aether_user') || '[]');
            const existingIndex = users.findIndex(u => u.email === user.email);
            if (existingIndex >= 0) {
                users[existingIndex] = user;
            } else {
                users.push(user);
            }
            localStorage.setItem('local_aether_user', JSON.stringify(users));
        } catch (e) {
            console.error("Error saving user to local storage:", e);
            throw new Error("Failed to save user");
        }
    },
    getUserByEmail: async (email) => {
        const users = await window.StorageDB.getUsers();
        return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    },

    // --- Courses Catalog ---
    getAllCourses: async () => {
        try {
            const local = JSON.parse(localStorage.getItem('local_aether_course') || '[]');
            return Array.isArray(local) ? local : [];
        } catch (e) {
            console.error("Error parsing local courses:", e);
            return [];
        }
    },
    addCourse: async (course) => {
        try {
            const courses = JSON.parse(localStorage.getItem('local_aether_course') || '[]');
            const existingIndex = courses.findIndex(c => c.id === course.id);
            if (existingIndex >= 0) {
                courses[existingIndex] = course;
            } else {
                courses.push(course);
            }
            localStorage.setItem('local_aether_course', JSON.stringify(courses));
        } catch (e) {
            console.error("Error saving course to local storage:", e);
            throw new Error("Failed to save course");
        }
    },

    deleteCourseById: async (courseId) => {
        try {
            const courses = JSON.parse(localStorage.getItem('local_aether_course') || '[]');
            const next = courses.filter(c => String(c.id) !== String(courseId));
            localStorage.setItem('local_aether_course', JSON.stringify(next));
        } catch (e) {
            console.error("Error deleting course:", e);
            throw new Error("Failed to delete course");
        }
    },

    // --- User Data Helper ---
    _getUserData: async () => {
        try {
            const local = JSON.parse(localStorage.getItem('local_aether_user_data') || '[]');
            return Array.isArray(local) ? local : [];
        } catch (e) {
            console.error('Error reading user data (local):', e);
            return [];
        }
    },
    _saveUserDataField: async (email, field, value) => {
        try {
            const allData = JSON.parse(localStorage.getItem('local_aether_user_data') || '[]');
            const existingIndex = allData.findIndex(d => d.email === email);
            if (existingIndex >= 0) {
                allData[existingIndex][field] = value;
            } else {
                allData.push({ email, [field]: value });
            }
            localStorage.setItem('local_aether_user_data', JSON.stringify(allData));
        } catch (e) {
            console.error(`Error saving user data field ${field}:`, e);
            throw new Error(`Failed to save ${field}`);
        }
    },
    _getUserDocData: async (email) => {
        const allData = await window.StorageDB._getUserData();
        return allData.find(d => d.email === email) || null;
    },

    // --- User Data Methods ---
    getMyCourses: async (email) => {
        const data = await window.StorageDB._getUserDocData(email);
        return data ? (data.myCourses || []) : [];
    },
    setMyCourses: async (email, courses) => {
        await window.StorageDB._saveUserDataField(email, 'myCourses', courses);
    },

    getStats: async (email) => {
        const data = await window.StorageDB._getUserDocData(email);
        return data ? (data.stats || []) : [];
    },
    setStats: async (email, stats) => {
        await window.StorageDB._saveUserDataField(email, 'stats', stats);
    },

    getAITutorUsed: async (email) => {
        const data = await window.StorageDB._getUserDocData(email);
        return data ? !!data.aiTutorUsed : false;
    },
    markAITutorUsed: async (email) => {
        await window.StorageDB._saveUserDataField(email, 'aiTutorUsed', true);
    },

    getChatHistory: async (email) => {
        const data = await window.StorageDB._getUserDocData(email);
        return data ? (data.chatHistory || []) : [];
    },
    setChatHistory: async (email, messages) => {
        await window.StorageDB._saveUserDataField(email, 'chatHistory', messages);
    },

    // Course enrollment tracking
    getCourseEnrollments: async (courseId) => {
        try {
            const users = await window.StorageDB.getUsers();
            const allUserData = await window.StorageDB._getUserData();
            
            let count = 0;
            for (const user of users) {
                if (user.role !== 'student') continue;
                const userData = window.StorageDB.isTrickleEnv() 
                    ? allUserData.find(i => i.objectData.email === user.email)?.objectData
                    : allUserData.find(d => d.email === user.email);
                
                const myCourses = userData?.myCourses || [];
                if (myCourses.some(c => String(c.id) === String(courseId))) {
                    count++;
                }
            }
            return count;
        } catch (e) {
            console.error('Error getting course enrollments:', e);
            return 0;
        }
    },

    // Course rating management
    getCourseRating: async (courseId) => {
        try {
            const allUserData = await window.StorageDB._getUserData();
            let totalRating = 0;
            let ratingCount = 0;
            
            for (const userData of allUserData) {
                const data = window.StorageDB.isTrickleEnv() ? userData.objectData : userData;
                const ratings = data?.courseRatings || {};
                if (ratings[courseId]) {
                    totalRating += ratings[courseId];
                    ratingCount++;
                }
            }
            
            return ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : '0.0';
        } catch (e) {
            console.error('Error getting course rating:', e);
            return '0.0';
        }
    },

    setUserCourseRating: async (email, courseId, rating) => {
        try {
            const userData = await window.StorageDB._getUserDocData(email);
            const currentRatings = userData?.courseRatings || {};
            currentRatings[courseId] = Number(rating);
            await window.StorageDB._saveUserDataField(email, 'courseRatings', currentRatings);
        } catch (e) {
            console.error('Error setting course rating:', e);
        }
    },

    getUserCourseRating: async (email, courseId) => {
        try {
            const userData = await window.StorageDB._getUserDocData(email);
            const ratings = userData?.courseRatings || {};
            return ratings[courseId] || 0;
        } catch (e) {
            console.error('Error getting user course rating:', e);
            return 0;
        }
    }
};