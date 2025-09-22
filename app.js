// Global variables
let currentUser = null;
let currentUserProfile = null;
let editingUserId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize application
async function initializeApp() {
    showLoading(true);
    
    try {
        // Check if user is already logged in
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user) {
            currentUser = session.user;
            await loadUserProfile();
            showDashboard();
        } else {
            showLoginForm();
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showLoginForm();
    }
    
    showLoading(false);
}

// Setup event listeners
function setupEventListeners() {
    // Login/Register forms
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
    document.getElementById('showRegister').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    });
    document.getElementById('showLogin').addEventListener('click', () => {
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    });

    // Dashboard buttons
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('adminLogoutBtn').addEventListener('click', handleLogout);
    document.getElementById('checkInBtn').addEventListener('click', handleCheckIn);
    document.getElementById('checkOutBtn').addEventListener('click', handleCheckOut);

    // Export buttons
    document.getElementById('exportExcel').addEventListener('click', exportUserAttendanceToExcel);
    document.getElementById('exportPDF').addEventListener('click', exportUserAttendanceToPDF);

    // Admin functions
    document.getElementById('addUserBtn').addEventListener('click', showAddUserModal);
    document.getElementById('exportUsersBtn').addEventListener('click', exportUsersToExcel);
    document.getElementById('exportAttendanceBtn').addEventListener('click', exportAllAttendanceToExcel);

    // Modal functions
    document.getElementById('closeModal').addEventListener('click', hideUserModal);
    document.getElementById('cancelModal').addEventListener('click', hideUserModal);
    document.getElementById('userModalForm').addEventListener('submit', handleSaveUser);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });

    // Search functionality
    document.getElementById('userSearch').addEventListener('input', filterUsers);
    document.getElementById('attendanceSearch').addEventListener('input', filterAttendance);

    // Auth state listener
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentUserProfile = null;
            showLoginForm();
        }
    });
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    showLoading(true);

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentUser = data.user;
        await loadUserProfile();
        showDashboard();
        
    } catch (error) {
        showError('loginError', error.message);
    }

    showLoading(false);
}

async function handleRegister(e) {
    e.preventDefault();
    showLoading(true);

    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const fullName = document.getElementById('registerName').value;
    const employeeId = document.getElementById('registerEmployeeId').value;
    const role = document.getElementById('registerRole').value;

    try {
        // Sign up user
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: undefined,
                data: {
                    full_name: fullName,
                    employee_id: employeeId,
                    role: role
                }
            }
        });

        if (error) throw error;

        if (data.user) {
            // Create user profile
            const { error: profileError } = await supabase
                .from('users')
                .insert([{
                    id: data.user.id,
                    email,
                    full_name: fullName,
                    employee_id: employeeId,
                    role: role
                }]);

            if (profileError) throw profileError;

            // تحقق من حالة المستخدم
            if (data.user.email_confirmed_at || !data.user.confirmation_sent_at) {
                // المستخدم مؤكد أو لا يحتاج تأكيد
                currentUser = data.user;
                await loadUserProfile();
                showDashboard();
            } else {
                // في حالة إرسال إيميل التأكيد
                showError('registerError', 'تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول.');
                document.getElementById('registerForm').style.display = 'none';
                document.getElementById('loginForm').style.display = 'block';
            }
        }

    } catch (error) {
        let errorMessage = error.message;
        if (error.message.includes('For security purposes')) {
            errorMessage = 'يرجى الانتظار قليلاً قبل إنشاء حساب آخر (إجراء أمني)';
        } else if (error.message.includes('User already registered')) {
            errorMessage = 'هذا الإيميل مسجل مسبقاً، يرجى تسجيل الدخول';
        }
        showError('registerError', errorMessage);
    }

    showLoading(false);
}

async function handleLogout() {
    showLoading(true);
    
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error('Error signing out:', error);
    }
    
    showLoading(false);
}

// User profile functions
async function loadUserProfile() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;
        
        currentUserProfile = data;
        updateUserInfo();
        
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

function updateUserInfo() {
    if (currentUserProfile) {
        const userNameElement = document.getElementById('userName');
        const userEmployeeIdElement = document.getElementById('userEmployeeId');
        
        if (userNameElement) userNameElement.textContent = currentUserProfile.full_name;
        if (userEmployeeIdElement) userEmployeeIdElement.textContent = currentUserProfile.employee_id;
    }
}

// Dashboard functions
function showDashboard() {
    hideAllScreens();
    
    if (currentUserProfile && currentUserProfile.role === 'admin') {
        document.getElementById('adminDashboard').style.display = 'block';
        loadAdminData();
    } else {
        document.getElementById('userDashboard').style.display = 'block';
        loadUserData();
    }
}

async function loadUserData() {
    await loadTodaysAttendance();
    await loadUserAttendanceRecords();
}

async function loadAdminData() {
    await loadAllUsers();
    await loadAllAttendanceRecords();
}

// Attendance functions
async function loadTodaysAttendance() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        updateTodaysStatus(data);
        
    } catch (error) {
        console.error('Error loading today\'s attendance:', error);
    }
}

function updateTodaysStatus(record) {
    const checkInStatus = document.getElementById('checkInStatus');
    const checkOutStatus = document.getElementById('checkOutStatus');
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');

    if (record && record.check_in) {
        const checkInTime = new Date(record.check_in).toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit'
        });
        checkInStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${checkInTime}`;
        checkInBtn.disabled = true;
        
        if (record.check_out) {
            const checkOutTime = new Date(record.check_out).toLocaleTimeString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit'
            });
            checkOutStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${checkOutTime}`;
            checkOutBtn.disabled = true;
        } else {
            checkOutBtn.disabled = false;
        }
    } else {
        checkInBtn.disabled = false;
        checkOutBtn.disabled = true;
    }
}

async function handleCheckIn() {
    showLoading(true);
    
    try {
        const location = await getCurrentLocation();
        
        if (!isWithinOfficeRadius(location)) {
            throw new Error('أنت خارج نطاق المكتب المسموح (50 متر)');
        }

        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('attendance_records')
            .insert({
                user_id: currentUser.id,
                check_in: new Date().toISOString(),
                check_in_location: location,
                date: today
            })
            .select()
            .single();

        if (error) throw error;

        showStatusMessage('تم تسجيل الحضور بنجاح!', 'success');
        await loadTodaysAttendance();
        await loadUserAttendanceRecords();
        
    } catch (error) {
        showStatusMessage(error.message, 'error');
    }
    
    showLoading(false);
}

async function handleCheckOut() {
    showLoading(true);
    
    try {
        const location = await getCurrentLocation();
        
        if (!isWithinOfficeRadius(location)) {
            throw new Error('أنت خارج نطاق المكتب المسموح (50 متر)');
        }

        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('attendance_records')
            .update({
                check_out: new Date().toISOString(),
                check_out_location: location
            })
            .eq('user_id', currentUser.id)
            .eq('date', today)
            .select()
            .single();

        if (error) throw error;

        showStatusMessage('تم تسجيل الانصراف بنجاح!', 'success');
        await loadTodaysAttendance();
        await loadUserAttendanceRecords();
        
    } catch (error) {
        showStatusMessage(error.message, 'error');
    }
    
    showLoading(false);
}

// Location functions
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('الموقع الجغرافي غير مدعوم في هذا المتصفح'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                let message = 'لا يمكن الحصول على الموقع الحالي';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'تم رفض الوصول للموقع الجغرافي';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'معلومات الموقع غير متوفرة';
                        break;
                    case error.TIMEOUT:
                        message = 'انتهت مهلة الحصول على الموقع';
                        break;
                }
                reject(new Error(message));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    });
}

function isWithinOfficeRadius(userLocation) {
    const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        OFFICE_LOCATION.latitude,
        OFFICE_LOCATION.longitude
    );
    
    return distance <= OFFICE_LOCATION.radius;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
}

// Data loading functions
async function loadUserAttendanceRecords() {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        const endOfMonth = new Date();
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);

        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .gte('date', startOfMonth.toISOString().split('T')[0])
            .lte('date', endOfMonth.toISOString().split('T')[0])
            .order('date', { ascending: false });

        if (error) throw error;

        displayUserAttendanceRecords(data || []);
        
    } catch (error) {
        console.error('Error loading attendance records:', error);
    }
}

function displayUserAttendanceRecords(records) {
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #718096;">لا توجد سجلات حضور لهذا الشهر</td></tr>';
        return;
    }

    records.forEach(record => {
        const row = document.createElement('tr');
        
        const date = new Date(record.date).toLocaleDateString('ar-SA');
        const checkIn = record.check_in ? 
            new Date(record.check_in).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 
            'لم يسجل';
        const checkOut = record.check_out ? 
            new Date(record.check_out).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 
            'لم يسجل';
        const totalHours = record.total_hours ? 
            `${record.total_hours.toFixed(2)} ساعة` : 
            'غير محسوب';

        row.innerHTML = `
            <td>${date}</td>
            <td style="color: ${record.check_in ? '#38a169' : '#a0aec0'}; font-weight: 600;">${checkIn}</td>
            <td style="color: ${record.check_out ? '#dd6b20' : '#a0aec0'}; font-weight: 600;">${checkOut}</td>
            <td style="font-weight: 600;">${totalHours}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Admin functions
async function loadAllUsers() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        displayUsers(data || []);
        
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        
        const roleText = user.role === 'admin' ? 'مدير' : 'موظف';
        const statusText = user.is_active ? 'نشط' : 'غير نشط';
        
        row.innerHTML = `
            <td style="font-weight: 600;">${user.employee_id}</td>
            <td>${user.full_name}</td>
            <td style="color: #718096;">${user.email}</td>
            <td><span class="status-badge ${user.role}">${roleText}</span></td>
            <td><span class="status-badge ${user.is_active ? 'active' : 'inactive'}">${statusText}</span></td>
            <td>
                <div class="action-buttons-table">
                    <button class="btn-edit" onclick="editUser('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" onclick="deleteUser('${user.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function loadAllAttendanceRecords() {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        const endOfMonth = new Date();
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);

        const { data, error } = await supabase
            .from('attendance_records')
            .select(`
                *,
                users!inner(full_name, employee_id)
            `)
            .gte('date', startOfMonth.toISOString().split('T')[0])
            .lte('date', endOfMonth.toISOString().split('T')[0])
            .order('date', { ascending: false });

        if (error) throw error;

        displayAllAttendanceRecords(data || []);
        
    } catch (error) {
        console.error('Error loading all attendance records:', error);
    }
}

function displayAllAttendanceRecords(records) {
    const tbody = document.getElementById('adminAttendanceTableBody');
    tbody.innerHTML = '';

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #718096;">لا توجد سجلات حضور لهذا الشهر</td></tr>';
        return;
    }

    records.forEach(record => {
        const row = document.createElement('tr');
        
        const date = new Date(record.date).toLocaleDateString('ar-SA');
        const checkIn = record.check_in ? 
            new Date(record.check_in).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 
            'لم يسجل';
        const checkOut = record.check_out ? 
            new Date(record.check_out).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 
            'لم يسجل';
        const totalHours = record.total_hours ? 
            `${record.total_hours.toFixed(2)} ساعة` : 
            'غير محسوب';

        row.innerHTML = `
            <td style="font-weight: 600;">${record.users.employee_id}</td>
            <td>${record.users.full_name}</td>
            <td>${date}</td>
            <td style="color: ${record.check_in ? '#38a169' : '#a0aec0'}; font-weight: 600;">${checkIn}</td>
            <td style="color: ${record.check_out ? '#dd6b20' : '#a0aec0'}; font-weight: 600;">${checkOut}</td>
            <td style="font-weight: 600;">${totalHours}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// User management functions
function showAddUserModal() {
    editingUserId = null;
    document.getElementById('modalTitle').textContent = 'إضافة مستخدم جديد';
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('modalPassword').required = true;
    
    // Clear form
    document.getElementById('modalEmail').value = '';
    document.getElementById('modalName').value = '';
    document.getElementById('modalEmployeeId').value = '';
    document.getElementById('modalRole').value = 'user';
    document.getElementById('modalPassword').value = '';
    
    document.getElementById('userModal').style.display = 'flex';
}

async function editUser(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        editingUserId = userId;
        document.getElementById('modalTitle').textContent = 'تعديل مستخدم';
        document.getElementById('passwordGroup').style.display = 'none';
        document.getElementById('modalPassword').required = false;
        
        // Fill form
        document.getElementById('modalEmail').value = data.email;
        document.getElementById('modalName').value = data.full_name;
        document.getElementById('modalEmployeeId').value = data.employee_id;
        document.getElementById('modalRole').value = data.role;
        document.getElementById('modalPassword').value = '';
        
        document.getElementById('userModal').style.display = 'flex';
        
    } catch (error) {
        alert('خطأ في تحميل بيانات المستخدم: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;

    showLoading(true);
    
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        await loadAllUsers();
        
    } catch (error) {
        alert('خطأ في حذف المستخدم: ' + error.message);
    }
    
    showLoading(false);
}

async function handleSaveUser(e) {
    e.preventDefault();
    showLoading(true);

    const email = document.getElementById('modalEmail').value;
    const fullName = document.getElementById('modalName').value;
    const employeeId = document.getElementById('modalEmployeeId').value;
    const role = document.getElementById('modalRole').value;
    const password = document.getElementById('modalPassword').value;

    try {
        if (editingUserId) {
            // Update existing user
            const { error } = await supabase
                .from('users')
                .update({
                    email,
                    full_name: fullName,
                    employee_id: employeeId,
                    role
                })
                .eq('id', editingUserId);

            if (error) throw error;
        } else {
            // Create new user
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });

            if (error) throw error;

            if (data.user) {
                const { error: profileError } = await supabase
                    .from('users')
                    .insert([{
                        id: data.user.id,
                        email,
                        full_name: fullName,
                        employee_id: employeeId,
                        role
                    }]);

                if (profileError) throw profileError;
            }
        }

        hideUserModal();
        await loadAllUsers();
        
    } catch (error) {
        alert('خطأ في حفظ المستخدم: ' + error.message);
    }
    
    showLoading(false);
}

function hideUserModal() {
    document.getElementById('userModal').style.display = 'none';
    editingUserId = null;
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');

    // Load data if needed
    if (tabName === 'attendance') {
        loadAllAttendanceRecords();
    }
}

// Search and filter functions
function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#usersTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function filterAttendance() {
    const searchTerm = document.getElementById('attendanceSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#adminAttendanceTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Export functions
async function exportUserAttendanceToExcel() {
    try {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false });

        if (error) throw error;

        const wsData = [
            ['التاريخ', 'الحضور', 'الانصراف', 'إجمالي الساعات'],
            ...data.map(record => [
                new Date(record.date).toLocaleDateString('ar-SA'),
                record.check_in ? new Date(record.check_in).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'لم يسجل',
                record.check_out ? new Date(record.check_out).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'لم يسجل',
                record.total_hours ? `${record.total_hours.toFixed(2)} ساعة` : 'غير محسوب'
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'سجل الحضور');
        
        const fileName = `attendance-${currentUserProfile.employee_id}-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
    } catch (error) {
        alert('خطأ في تصدير الملف: ' + error.message);
    }
}

async function exportUserAttendanceToPDF() {
    try {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false });

        if (error) throw error;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        // Add title
        pdf.text('سجل الحضور والانصراف', 20, 20);
        pdf.text(`الموظف: ${currentUserProfile.full_name}`, 20, 30);
        pdf.text(`رقم الموظف: ${currentUserProfile.employee_id}`, 20, 40);
        
        let yPosition = 60;
        data.forEach(record => {
            const date = new Date(record.date).toLocaleDateString('ar-SA');
            const checkIn = record.check_in ? 
                new Date(record.check_in).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 
                'غير مسجل';
            const checkOut = record.check_out ? 
                new Date(record.check_out).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 
                'غير مسجل';
            const hours = record.total_hours ? record.total_hours.toFixed(2) : 'غير محسوب';
            
            pdf.text(`${date} | ${checkIn} - ${checkOut} | ${hours} ساعة`, 20, yPosition);
            yPosition += 10;
        });
        
        const fileName = `attendance-${currentUserProfile.employee_id}-${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);
        
    } catch (error) {
        alert('خطأ في تصدير الملف: ' + error.message);
    }
}

async function exportUsersToExcel() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const wsData = [
            ['رقم الموظف', 'الاسم الكامل', 'البريد الإلكتروني', 'النوع', 'الحالة', 'تاريخ الإنشاء'],
            ...data.map(user => [
                user.employee_id,
                user.full_name,
                user.email,
                user.role === 'admin' ? 'مدير' : 'موظف',
                user.is_active ? 'نشط' : 'غير نشط',
                new Date(user.created_at).toLocaleDateString('ar-SA')
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'المستخدمون');
        
        const fileName = `users-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
    } catch (error) {
        alert('خطأ في تصدير الملف: ' + error.message);
    }
}

async function exportAllAttendanceToExcel() {
    try {
        const { data, error } = await supabase
            .from('attendance_records')
            .select(`
                *,
                users!inner(full_name, employee_id)
            `)
            .order('date', { ascending: false });

        if (error) throw error;

        const wsData = [
            ['رقم الموظف', 'اسم الموظف', 'التاريخ', 'الحضور', 'الانصراف', 'إجمالي الساعات'],
            ...data.map(record => [
                record.users.employee_id,
                record.users.full_name,
                new Date(record.date).toLocaleDateString('ar-SA'),
                record.check_in ? new Date(record.check_in).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'لم يسجل',
                record.check_out ? new Date(record.check_out).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'لم يسجل',
                record.total_hours ? `${record.total_hours.toFixed(2)} ساعة` : 'غير محسوب'
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'سجل الحضور');
        
        const fileName = `all-attendance-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
    } catch (error) {
        alert('خطأ في تصدير الملف: ' + error.message);
    }
}

// Utility functions
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function showStatusMessage(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 5000);
}

function hideAllScreens() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('userDashboard').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'none';
}

function showLoginForm() {
    hideAllScreens();
    document.getElementById('loginForm').style.display = 'block';
}
