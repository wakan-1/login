// Global variables
let currentUser = null;
let supabaseClient = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log('تحميل التطبيق...');
    
    // Wait for Supabase to load
    await waitForSupabase();
    
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false
            }
        });
        console.log('تم تحميل Supabase بنجاح');
        
        // Check for existing session
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            await handleUserSession(session.user);
        }
        
        // Initialize event listeners
        initializeEventListeners();
    } else {
        console.error('فشل في تحميل مكتبة Supabase');
        showError('فشل في تحميل النظام. يرجى إعادة تحميل الصفحة.');
    }
});

// Wait for Supabase to load
function waitForSupabase() {
    return new Promise((resolve) => {
        if (window.supabase) {
            resolve();
        } else {
            setTimeout(() => waitForSupabase().then(resolve), 100);
        }
    });
}

// Initialize all event listeners
function initializeEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Logout buttons
    const logoutBtn = document.getElementById('logoutBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', handleLogout);

    // Check in/out buttons
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');
    if (checkInBtn) checkInBtn.addEventListener('click', handleCheckIn);
    if (checkOutBtn) checkOutBtn.addEventListener('click', handleCheckOut);

    // Admin tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });

    // Add user button
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) addUserBtn.addEventListener('click', showAddUserModal);

    // Modal events
    const closeModal = document.getElementById('closeModal');
    const cancelModal = document.getElementById('cancelModal');
    const userModalForm = document.getElementById('userModalForm');
    
    if (closeModal) closeModal.addEventListener('click', hideUserModal);
    if (cancelModal) cancelModal.addEventListener('click', hideUserModal);
    if (userModalForm) userModalForm.addEventListener('submit', handleUserSubmit);

    // Search functionality
    const userSearch = document.getElementById('userSearch');
    const attendanceSearch = document.getElementById('attendanceSearch');
    
    if (userSearch) userSearch.addEventListener('input', filterUsers);
    if (attendanceSearch) attendanceSearch.addEventListener('input', filterAttendance);

    // Export buttons
    const exportUsersBtn = document.getElementById('exportUsersBtn');
    const exportAttendanceExcel = document.getElementById('exportAttendanceExcel');
    const exportAttendancePDF = document.getElementById('exportAttendancePDF');
    
    if (exportUsersBtn) exportUsersBtn.addEventListener('click', exportUsersToExcel);
    if (exportAttendanceExcel) exportAttendanceExcel.addEventListener('click', exportAttendanceToExcel);
    if (exportAttendancePDF) exportAttendancePDF.addEventListener('click', exportAttendanceToPDF);
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    
    try {
        showLoading(true);
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...';
        
        console.log('محاولة تسجيل الدخول:', email);
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            console.error('خطأ في تسجيل الدخول:', error);
            throw error;
        }
        
        console.log('تم تسجيل الدخول بنجاح:', data.user);
        await handleUserSession(data.user);
        
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        let errorMessage = 'خطأ في تسجيل الدخول';
        
        if (error.message.includes('Invalid login credentials')) {
            errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
        } else if (error.message.includes('Email not confirmed')) {
            errorMessage = 'يرجى تأكيد البريد الإلكتروني أولاً';
        }
        
        showError(errorMessage);
    } finally {
        showLoading(false);
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
    }
}

// Handle user session
async function handleUserSession(user) {
    try {
        console.log('معالجة جلسة المستخدم:', user.id);
        console.log('البريد الإلكتروني:', user.email);
        
        // Get user data from users table
        console.log('جلب بيانات المستخدم من قاعدة البيانات...');
        const { data: userData, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error) {
            console.error('خطأ في جلب بيانات المستخدم:', error);
            
            showError('المستخدم غير موجود في النظام. يرجى التواصل مع الإدارة.');
            await handleLogout();
            return;
        } else {
            currentUser = userData;
            console.log('بيانات المستخدم:', currentUser);
        }
        
        // Hide login form
        document.getElementById('loginForm').style.display = 'none';
        
        // Show appropriate dashboard
        if (currentUser.role === 'admin') {
            showAdminDashboard();
        } else {
            showUserDashboard();
        }
        
    } catch (error) {
        console.error('خطأ في معالجة جلسة المستخدم:', error);
        showError('خطأ في معالجة بيانات المستخدم');
        await handleLogout();
    }
}

// Show user dashboard
async function showUserDashboard() {
    document.getElementById('userDashboard').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
    
    // Update user info
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userEmployeeId').textContent = currentUser.employee_id;
    
    // Load today's attendance
    await loadTodayAttendance();
    
    // Load attendance history
    await loadUserAttendanceHistory();
}

// Show admin dashboard
async function showAdminDashboard() {
    document.getElementById('adminDashboard').style.display = 'block';
    document.getElementById('userDashboard').style.display = 'none';
    
    // Load users
    await loadUsers();
    
    // Load attendance records
    await loadAllAttendanceRecords();
}

// Load today's attendance
async function loadTodayAttendance() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabaseClient
            .from('attendance_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('date', today)
            .single();
        
        const checkInStatus = document.getElementById('checkInStatus');
        const checkOutStatus = document.getElementById('checkOutStatus');
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');
        
        if (error && error.code !== 'PGRST116') {
            console.error('خطأ في جلب بيانات الحضور:', error);
            return;
        }
        
        if (data) {
            // Update check-in status
            if (data.check_in) {
                const checkInTime = new Date(data.check_in).toLocaleTimeString('ar-SA');
                checkInStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${checkInTime}`;
                checkInBtn.disabled = true;
                checkInBtn.innerHTML = '<i class="fas fa-check"></i> تم التسجيل';
            }
            
            // Update check-out status
            if (data.check_out) {
                const checkOutTime = new Date(data.check_out).toLocaleTimeString('ar-SA');
                checkOutStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${checkOutTime}`;
                checkOutBtn.disabled = true;
                checkOutBtn.innerHTML = '<i class="fas fa-check"></i> تم التسجيل';
            } else if (data.check_in) {
                checkOutBtn.disabled = false;
            }
        } else {
            // No record for today
            checkInBtn.disabled = false;
            checkOutBtn.disabled = true;
        }
        
    } catch (error) {
        console.error('خطأ في تحميل بيانات الحضور:', error);
    }
}

// Handle check-in
async function handleCheckIn() {
    try {
        showLoading(true);
        
        // Get location
        const location = await getCurrentLocation();
        
        // Check if user is admin or within office radius
        if (currentUser.role !== 'admin') {
            const distance = calculateDistance(
                location.latitude, location.longitude,
                OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude
            );
            
            if (distance > OFFICE_LOCATION.radius) {
                showError(`يجب أن تكون في نطاق ${OFFICE_LOCATION.radius} متر من ${OFFICE_LOCATION.name}`);
                return;
            }
        }
        
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();
        
        const { data, error } = await supabaseClient
            .from('attendance_records')
            .upsert({
                user_id: currentUser.id,
                date: today,
                check_in: now,
                check_in_location: location
            })
            .select()
            .single();
        
        if (error) throw error;
        
        showSuccess('تم تسجيل الحضور بنجاح');
        await loadTodayAttendance();
        
    } catch (error) {
        console.error('خطأ في تسجيل الحضور:', error);
        showError('خطأ في تسجيل الحضور: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Handle check-out
async function handleCheckOut() {
    try {
        showLoading(true);
        
        // Get location
        const location = await getCurrentLocation();
        
        // Check if user is admin or within office radius
        if (currentUser.role !== 'admin') {
            const distance = calculateDistance(
                location.latitude, location.longitude,
                OFFICE_LOCATION.latitude, OFFICE_LOCATION.longitude
            );
            
            if (distance > OFFICE_LOCATION.radius) {
                showError(`يجب أن تكون في نطاق ${OFFICE_LOCATION.radius} متر من ${OFFICE_LOCATION.name}`);
                return;
            }
        }
        
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();
        
        const { data, error } = await supabaseClient
            .from('attendance_records')
            .update({
                check_out: now,
                check_out_location: location
            })
            .eq('user_id', currentUser.id)
            .eq('date', today)
            .select()
            .single();
        
        if (error) throw error;
        
        showSuccess('تم تسجيل الانصراف بنجاح');
        await loadTodayAttendance();
        
    } catch (error) {
        console.error('خطأ في تسجيل الانصراف:', error);
        showError('خطأ في تسجيل الانصراف: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Get current location
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
                reject(new Error('فشل في الحصول على الموقع الجغرافي'));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });
}

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in meters
}

// Load user attendance history
async function loadUserAttendanceHistory() {
    try {
        const { data, error } = await supabaseClient
            .from('attendance_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false })
            .limit(30);
        
        if (error) throw error;
        
        const tbody = document.getElementById('attendanceTableBody');
        tbody.innerHTML = '';
        
        data.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(record.date).toLocaleDateString('ar-SA')}</td>
                <td>${record.check_in ? new Date(record.check_in).toLocaleTimeString('ar-SA') : '-'}</td>
                <td>${record.check_out ? new Date(record.check_out).toLocaleTimeString('ar-SA') : '-'}</td>
                <td>${record.total_hours ? record.total_hours + ' ساعة' : '-'}</td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('خطأ في تحميل سجل الحضور:', error);
    }
}

// Load all users (admin only)
async function loadUsers() {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        data.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.employee_id}</td>
                <td>${user.full_name}</td>
                <td>${user.email}</td>
                <td><span class="status-badge ${user.role}">${user.role === 'admin' ? 'مدير' : 'موظف'}</span></td>
                <td><span class="status-badge ${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'نشط' : 'غير نشط'}</span></td>
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
        
    } catch (error) {
        console.error('خطأ في تحميل المستخدمين:', error);
    }
}

// Load all attendance records (admin only)
async function loadAllAttendanceRecords() {
    try {
        const { data, error } = await supabaseClient
            .from('attendance_records')
            .select(`
                *,
                users (
                    employee_id,
                    full_name
                )
            `)
            .order('date', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        const tbody = document.getElementById('adminAttendanceTableBody');
        tbody.innerHTML = '';
        
        data.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.users.employee_id}</td>
                <td>${record.users.full_name}</td>
                <td>${new Date(record.date).toLocaleDateString('ar-SA')}</td>
                <td>${record.check_in ? new Date(record.check_in).toLocaleTimeString('ar-SA') : '-'}</td>
                <td>${record.check_out ? new Date(record.check_out).toLocaleTimeString('ar-SA') : '-'}</td>
                <td>${record.total_hours ? record.total_hours + ' ساعة' : '-'}</td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('خطأ في تحميل سجلات الحضور:', error);
    }
}

// Switch tabs (admin)
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
    
    // Load data based on tab
    if (tabName === 'users') {
        loadUsers();
    } else if (tabName === 'attendance') {
        loadAllAttendanceRecords();
    }
}

// Show add user modal
function showAddUserModal() {
    document.getElementById('modalTitle').textContent = 'إضافة مستخدم جديد';
    document.getElementById('userModalForm').reset();
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('modalPassword').required = true;
    document.getElementById('userModal').style.display = 'flex';
    document.getElementById('userModal').dataset.mode = 'add';
}

// Hide user modal
function hideUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

// Handle user form submit
async function handleUserSubmit(e) {
    e.preventDefault();
    
    const mode = document.getElementById('userModal').dataset.mode;
    const email = document.getElementById('modalEmail').value;
    const fullName = document.getElementById('modalName').value;
    const employeeId = document.getElementById('modalEmployeeId').value;
    const role = document.getElementById('modalRole').value;
    const password = document.getElementById('modalPassword').value;
    
    try {
        showLoading(true);
        
        if (mode === 'add') {
            // Call edge function to create user
            const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    full_name: fullName,
                    employee_id: employeeId,
                    role: role
                })
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            showSuccess('تم إنشاء المستخدم بنجاح');
        } else if (mode === 'edit') {
            const userId = document.getElementById('userModal').dataset.userId;
            
            // Call edge function to update user
            const response = await fetch(`${SUPABASE_URL}/functions/v1/update-user`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId,
                    email: email,
                    full_name: fullName,
                    employee_id: employeeId,
                    role: role
                })
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            showSuccess('تم تحديث المستخدم بنجاح');
        }
        
        hideUserModal();
        await loadUsers();
        
    } catch (error) {
        console.error('خطأ في حفظ المستخدم:', error);
        showError('خطأ في حفظ المستخدم: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Edit user
async function editUser(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('modalTitle').textContent = 'تعديل المستخدم';
        document.getElementById('modalEmail').value = data.email;
        document.getElementById('modalName').value = data.full_name;
        document.getElementById('modalEmployeeId').value = data.employee_id;
        document.getElementById('modalRole').value = data.role;
        document.getElementById('passwordGroup').style.display = 'none';
        document.getElementById('modalPassword').required = false;
        document.getElementById('userModal').style.display = 'flex';
        document.getElementById('userModal').dataset.mode = 'edit';
        document.getElementById('userModal').dataset.userId = userId;
        
    } catch (error) {
        console.error('خطأ في تحميل بيانات المستخدم:', error);
        showError('خطأ في تحميل بيانات المستخدم');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const { error } = await supabaseClient
            .from('users')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        showSuccess('تم حذف المستخدم بنجاح');
        await loadUsers();
        
    } catch (error) {
        console.error('خطأ في حذف المستخدم:', error);
        showError('خطأ في حذف المستخدم: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Filter users
function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#usersTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Filter attendance
function filterAttendance() {
    const searchTerm = document.getElementById('attendanceSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#adminAttendanceTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Export users to Excel
async function exportUsersToExcel() {
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const ws = XLSX.utils.json_to_sheet(data.map(user => ({
            'رقم الموظف': user.employee_id,
            'الاسم الكامل': user.full_name,
            'البريد الإلكتروني': user.email,
            'النوع': user.role === 'admin' ? 'مدير' : 'موظف',
            'الحالة': user.is_active ? 'نشط' : 'غير نشط',
            'تاريخ الإنشاء': new Date(user.created_at).toLocaleDateString('ar-SA')
        })));
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'المستخدمين');
        XLSX.writeFile(wb, 'users.xlsx');
        
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        showError('خطأ في تصدير البيانات');
    }
}

// Export attendance to Excel
async function exportAttendanceToExcel() {
    try {
        const { data, error } = await supabaseClient
            .from('attendance_records')
            .select(`
                *,
                users (
                    employee_id,
                    full_name
                )
            `)
            .order('date', { ascending: false });
        
        if (error) throw error;
        
        const ws = XLSX.utils.json_to_sheet(data.map(record => ({
            'رقم الموظف': record.users.employee_id,
            'اسم الموظف': record.users.full_name,
            'التاريخ': new Date(record.date).toLocaleDateString('ar-SA'),
            'الحضور': record.check_in ? new Date(record.check_in).toLocaleTimeString('ar-SA') : '-',
            'الانصراف': record.check_out ? new Date(record.check_out).toLocaleTimeString('ar-SA') : '-',
            'إجمالي الساعات': record.total_hours || '-'
        })));
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'سجل الحضور');
        XLSX.writeFile(wb, 'attendance.xlsx');
        
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        showError('خطأ في تصدير البيانات');
    }
}

// Export attendance to PDF
async function exportAttendanceToPDF() {
    try {
        const { data, error } = await supabaseClient
            .from('attendance_records')
            .select(`
                *,
                users (
                    employee_id,
                    full_name
                )
            `)
            .order('date', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Add title
        doc.setFont('helvetica');
        doc.setFontSize(16);
        doc.text('Attendance Report', 20, 20);
        
        let y = 40;
        doc.setFontSize(12);
        
        data.forEach(record => {
            const text = `${record.users.employee_id} - ${record.users.full_name} - ${new Date(record.date).toLocaleDateString('ar-SA')}`;
            doc.text(text, 20, y);
            y += 10;
            
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
        });
        
        doc.save('attendance-report.pdf');
        
    } catch (error) {
        console.error('خطأ في تصدير PDF:', error);
        showError('خطأ في تصدير PDF');
    }
}

// Handle logout
async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        
        // Hide dashboards
        document.getElementById('userDashboard').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'none';
        
        // Show login form
        document.getElementById('loginForm').style.display = 'flex';
        
        // Reset form
        document.getElementById('loginFormElement').reset();
        
    } catch (error) {
        console.error('خطأ في تسجيل الخروج:', error);
    }
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    // Create success message element
    const successDiv = document.createElement('div');
    successDiv.className = 'status-message success';
    successDiv.textContent = message;
    successDiv.style.position = 'fixed';
    successDiv.style.top = '20px';
    successDiv.style.right = '20px';
    successDiv.style.zIndex = '9999';
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        document.body.removeChild(successDiv);
    }, 3000);
}
