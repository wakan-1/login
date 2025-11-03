// Global variables
let currentUser = null;
let currentUserRole = null;
let allUsers = [];
let allLocations = [];
let userLocations = [];

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Check if user is already logged in
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            await handleSuccessfulLogin(session);
        } else {
            showLoginForm();
        }
        
        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await handleSuccessfulLogin(session);
            } else if (event === 'SIGNED_OUT') {
                showLoginForm();
            }
        });
        
    } catch (error) {
        console.error('خطأ في تهيئة التطبيق:', error);
        showError('حدث خطأ في تحميل التطبيق');
    }
}

function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('userDashboard').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'none';
    
    // Setup login form
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    
    try {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...';
        errorDiv.style.display = 'none';
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        await handleSuccessfulLogin(data.session);
        
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        errorDiv.textContent = 'خطأ في البريد الإلكتروني أو كلمة المرور';
        errorDiv.style.display = 'block';
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
    }
}

async function handleSuccessfulLogin(session) {
    try {
        // Get user data from database
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (error) throw error;
        
        currentUser = userData;
        currentUserRole = userData.role;
        
        // Hide login form
        document.getElementById('loginForm').style.display = 'none';
        
        // Show appropriate dashboard
        if (userData.role === 'admin') {
            await showAdminDashboard();
        } else {
            await showUserDashboard();
        }
        
    } catch (error) {
        console.error('خطأ في جلب بيانات المستخدم:', error);
        showError('حدث خطأ في تحميل بيانات المستخدم');
    }
}

async function showUserDashboard() {
    document.getElementById('userDashboard').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
    
    // Update user info
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('userEmployeeId').textContent = currentUser.employee_id;
    
    // Setup logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Load user's assigned locations if field user
    if (currentUser.role === 'field_user') {
        await loadUserLocations();
        setupFieldUserInterface();
    } else {
        setupRegularUserInterface();
    }
    
    // Load today's attendance
    await loadTodayAttendance();
    
    // Load attendance history
    await loadUserAttendanceHistory();
}

async function loadUserLocations() {
    try {
        const { data, error } = await supabase
            .from('user_locations')
            .select(`
                location_id,
                locations (
                    id,
                    name,
                    latitude,
                    longitude,
                    radius,
                    is_active
                )
            `)
            .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        userLocations = data.filter(ul => ul.locations.is_active).map(ul => ul.locations);
        
    } catch (error) {
        console.error('خطأ في جلب مواقع المستخدم:', error);
    }
}

function setupFieldUserInterface() {
    // Add location selector to check-in/out buttons
    const actionButtons = document.querySelector('.action-buttons');
    
    // Create location selector
    const locationSelector = document.createElement('div');
    locationSelector.className = 'form-group';
    locationSelector.innerHTML = `
        <label>اختر الموقع:</label>
        <select id="locationSelect" class="form-select">
            <option value="">-- اختر الموقع --</option>
            ${userLocations.map(loc => `<option value="${loc.id}">${loc.name}</option>`).join('')}
        </select>
    `;
    
    actionButtons.parentNode.insertBefore(locationSelector, actionButtons);
    
    // Setup check-in/out buttons
    document.getElementById('checkInBtn').addEventListener('click', () => handleFieldCheckIn());
    document.getElementById('checkOutBtn').addEventListener('click', () => handleFieldCheckOut());
}

function setupRegularUserInterface() {
    // Setup regular check-in/out buttons
    document.getElementById('checkInBtn').addEventListener('click', () => handleCheckIn());
    document.getElementById('checkOutBtn').addEventListener('click', () => handleCheckOut());
}

async function handleFieldCheckIn() {
    const locationId = document.getElementById('locationSelect').value;
    if (!locationId) {
        showStatusMessage('يرجى اختيار الموقع أولاً', 'error');
        return;
    }
    
    const selectedLocation = userLocations.find(loc => loc.id === locationId);
    await handleLocationBasedCheckIn(selectedLocation);
}

async function handleFieldCheckOut() {
    const locationId = document.getElementById('locationSelect').value;
    if (!locationId) {
        showStatusMessage('يرجى اختيار الموقع أولاً', 'error');
        return;
    }
    
    const selectedLocation = userLocations.find(loc => loc.id === locationId);
    await handleLocationBasedCheckOut(selectedLocation);
}

async function handleLocationBasedCheckIn(location) {
    try {
        showStatusMessage('جاري التحقق من الموقع...', 'info');
        
        const position = await getCurrentPosition();
        const distance = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            parseFloat(location.latitude),
            parseFloat(location.longitude)
        );
        
        if (distance > location.radius) {
            showStatusMessage(`أنت خارج نطاق الموقع. المسافة: ${Math.round(distance)} متر`, 'error');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('attendance_records')
            .upsert({
                user_id: currentUser.id,
                date: today,
                check_in: new Date().toISOString(),
                check_in_location: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                },
                location_id: location.id
            }, {
                onConflict: 'user_id,date'
            });
        
        if (error) throw error;
        
        showStatusMessage(`تم تسجيل الحضور في ${location.name} بنجاح`, 'success');
        await loadTodayAttendance();
        
    } catch (error) {
        console.error('خطأ في تسجيل الحضور:', error);
        showStatusMessage('حدث خطأ في تسجيل الحضور', 'error');
    }
}

async function handleLocationBasedCheckOut(location) {
    try {
        showStatusMessage('جاري التحقق من الموقع...', 'info');
        
        const position = await getCurrentPosition();
        const distance = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            parseFloat(location.latitude),
            parseFloat(location.longitude)
        );
        
        if (distance > location.radius) {
            showStatusMessage(`أنت خارج نطاق الموقع. المسافة: ${Math.round(distance)} متر`, 'error');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('attendance_records')
            .update({
                check_out: new Date().toISOString(),
                check_out_location: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                }
            })
            .eq('user_id', currentUser.id)
            .eq('date', today)
            .eq('location_id', location.id);
        
        if (error) throw error;
        
        showStatusMessage(`تم تسجيل الانصراف من ${location.name} بنجاح`, 'success');
        await loadTodayAttendance();
        
    } catch (error) {
        console.error('خطأ في تسجيل الانصراف:', error);
        showStatusMessage('حدث خطأ في تسجيل الانصراف', 'error');
    }
}

async function handleCheckIn() {
    try {
        showStatusMessage('جاري التحقق من الموقع...', 'info');
        
        const position = await getCurrentPosition();
        const distance = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            OFFICE_LOCATION.latitude,
            OFFICE_LOCATION.longitude
        );
        
        if (distance > OFFICE_LOCATION.radius) {
            showStatusMessage(`أنت خارج نطاق المكتب. المسافة: ${Math.round(distance)} متر`, 'error');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('attendance_records')
            .upsert({
                user_id: currentUser.id,
                date: today,
                check_in: new Date().toISOString(),
                check_in_location: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                }
            }, {
                onConflict: 'user_id,date'
            });
        
        if (error) throw error;
        
        showStatusMessage('تم تسجيل الحضور بنجاح', 'success');
        await loadTodayAttendance();
        
    } catch (error) {
        console.error('خطأ في تسجيل الحضور:', error);
        showStatusMessage('حدث خطأ في تسجيل الحضور', 'error');
    }
}

async function handleCheckOut() {
    try {
        showStatusMessage('جاري التحقق من الموقع...', 'info');
        
        const position = await getCurrentPosition();
        const distance = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            OFFICE_LOCATION.latitude,
            OFFICE_LOCATION.longitude
        );
        
        if (distance > OFFICE_LOCATION.radius) {
            showStatusMessage(`أنت خارج نطاق المكتب. المسافة: ${Math.round(distance)} متر`, 'error');
            return;
        }
        
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('attendance_records')
            .update({
                check_out: new Date().toISOString(),
                check_out_location: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                }
            })
            .eq('user_id', currentUser.id)
            .eq('date', today);
        
        if (error) throw error;
        
        showStatusMessage('تم تسجيل الانصراف بنجاح', 'success');
        await loadTodayAttendance();
        
    } catch (error) {
        console.error('خطأ في تسجيل الانصراف:', error);
        showStatusMessage('حدث خطأ في تسجيل الانصراف', 'error');
    }
}

async function loadTodayAttendance() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('date', today)
            .single();
        
        const checkInStatus = document.getElementById('checkInStatus');
        const checkOutStatus = document.getElementById('checkOutStatus');
        const checkInBtn = document.getElementById('checkInBtn');
        const checkOutBtn = document.getElementById('checkOutBtn');
        
        if (data && data.check_in) {
            const checkInTime = new Date(data.check_in).toLocaleTimeString('ar-SA');
            let locationName = 'المكتب الرئيسي';
            
            // Get location name if location_id exists
            if (data.location_id) {
                try {
                    const { data: locationData } = await supabase
                        .from('locations')
                        .select('name')
                        .eq('id', data.location_id)
                        .single();
                    if (locationData) locationName = locationData.name;
                } catch (err) {
                    console.log('Location not found, using default');
                }
            }
            
            checkInStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${checkInTime} - ${locationName}`;
            checkInBtn.disabled = true;
            checkOutBtn.disabled = false;
        } else {
            checkInStatus.innerHTML = '<i class="fas fa-times-circle"></i> لم يسجل بعد';
            checkInBtn.disabled = false;
            checkOutBtn.disabled = true;
        }
        
        if (data && data.check_out) {
            const checkOutTime = new Date(data.check_out).toLocaleTimeString('ar-SA');
            let locationName = 'المكتب الرئيسي';
            
            // Get location name if location_id exists
            if (data.location_id) {
                try {
                    const { data: locationData } = await supabase
                        .from('locations')
                        .select('name')
                        .eq('id', data.location_id)
                        .single();
                    if (locationData) locationName = locationData.name;
                } catch (err) {
                    console.log('Location not found, using default');
                }
            }
            
            checkOutStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${checkOutTime} - ${locationName}`;
            checkOutBtn.disabled = true;
        } else {
            checkOutStatus.innerHTML = '<i class="fas fa-times-circle"></i> لم يسجل بعد';
        }
        
    } catch (error) {
        console.error('خطأ في جلب بيانات اليوم:', error);
    }
}

async function loadUserAttendanceHistory() {
    try {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false })
            .limit(30);
        
        if (error) throw error;
        
        const tbody = document.getElementById('attendanceTableBody');
        tbody.innerHTML = '';
        
        for (const record of data) {
            const row = document.createElement('tr');
            let locationName = 'المكتب الرئيسي';
            
            // Get location name if location_id exists
            if (record.location_id) {
                try {
                    const { data: locationData } = await supabase
                        .from('locations')
                        .select('name')
                        .eq('id', record.location_id)
                        .single();
                    if (locationData) locationName = locationData.name;
                } catch (err) {
                    console.log('Location not found for record, using default');
                }
            }
            
            row.innerHTML = `
                <td>${new Date(record.date).toLocaleDateString('ar-SA')}</td>
                <td>${record.check_in ? new Date(record.check_in).toLocaleTimeString('ar-SA') : '-'}</td>
                <td>${record.check_out ? new Date(record.check_out).toLocaleTimeString('ar-SA') : '-'}</td>
                <td>${record.total_hours ? parseFloat(record.total_hours).toFixed(2) + ' ساعة' : '-'}</td>
                <td>${locationName}</td>
            `;
            tbody.appendChild(row);
        }
        
    } catch (error) {
        console.error('خطأ في جلب سجل الحضور:', error);
    }
}

async function showAdminDashboard() {
    document.getElementById('adminDashboard').style.display = 'block';
    document.getElementById('userDashboard').style.display = 'none';
    
    // Setup logout button
    document.getElementById('adminLogoutBtn').addEventListener('click', handleLogout);
    
    // Setup tabs
    setupTabs();
    
    // Load initial data
    await loadUsers();
    await loadLocations();
    await loadAttendanceRecords();
    
    // Setup event listeners
    setupAdminEventListeners();
}

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Remove active class from all tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            btn.classList.add('active');
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });
}

function setupAdminEventListeners() {
    // User management
    document.getElementById('addUserBtn').addEventListener('click', () => openUserModal());
    document.getElementById('userSearch').addEventListener('input', filterUsers);
    
    // Location management
    document.getElementById('addLocationBtn').addEventListener('click', () => openLocationModal());
    document.getElementById('locationSearch').addEventListener('input', filterLocations);
    
    // Attendance search
    document.getElementById('attendanceSearch').addEventListener('input', filterAttendance);
    
    // Export buttons
    document.getElementById('exportUsersBtn').addEventListener('click', exportUsers);
    document.getElementById('exportAttendanceExcel').addEventListener('click', () => exportAttendance('excel'));
    document.getElementById('exportAttendancePDF').addEventListener('click', () => exportAttendance('pdf'));
    
    // Modal event listeners
    setupModalEventListeners();
}

function setupModalEventListeners() {
    // User modal
    document.getElementById('closeModal').addEventListener('click', closeUserModal);
    document.getElementById('cancelModal').addEventListener('click', closeUserModal);
    document.getElementById('userModalForm').addEventListener('submit', saveUser);
    
    // Location modal
    document.getElementById('closeLocationModal').addEventListener('click', closeLocationModal);
    document.getElementById('cancelLocationModal').addEventListener('click', closeLocationModal);
    document.getElementById('locationModalForm').addEventListener('submit', saveLocation);
    
    // Role change handler
    document.getElementById('modalRole').addEventListener('change', handleRoleChange);
}

function handleRoleChange() {
    const role = document.getElementById('modalRole').value;
    const locationsGroup = document.getElementById('userLocationsGroup');
    
    if (role === 'field_user') {
        locationsGroup.style.display = 'block';
        loadLocationCheckboxes();
    } else {
        locationsGroup.style.display = 'none';
    }
}

async function loadLocationCheckboxes() {
    try {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('is_active', true)
            .order('name');
        
        if (error) throw error;
        
        const container = document.getElementById('locationCheckboxes');
        container.innerHTML = '';
        
        data.forEach(location => {
            const label = document.createElement('label');
            label.innerHTML = `
                <input type="checkbox" value="${location.id}" name="userLocations">
                ${location.name}
            `;
            container.appendChild(label);
        });
        
    } catch (error) {
        console.error('خطأ في جلب المواقع:', error);
    }
}

async function loadUsers() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allUsers = data;
        displayUsers(data);
        
    } catch (error) {
        console.error('خطأ في جلب المستخدمين:', error);
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.employee_id}</td>
            <td>${user.full_name}</td>
            <td>${user.email}</td>
            <td><span class="status-badge ${user.role}">${getRoleText(user.role)}</span></td>
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
}

function getRoleText(role) {
    switch(role) {
        case 'admin': return 'مدير';
        case 'user': return 'موظف';
        case 'field_user': return 'مندوب';
        default: return role;
    }
}

async function loadLocations() {
    try {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allLocations = data;
        displayLocations(data);
        
    } catch (error) {
        console.error('خطأ في جلب المواقع:', error);
    }
}

function displayLocations(locations) {
    const tbody = document.getElementById('locationsTableBody');
    tbody.innerHTML = '';
    
    locations.forEach(location => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${location.name}</td>
            <td>${location.latitude}</td>
            <td>${location.longitude}</td>
            <td>${location.radius} متر</td>
            <td><span class="status-badge ${location.is_active ? 'active' : 'inactive'}">${location.is_active ? 'نشط' : 'غير نشط'}</span></td>
            <td>
                <div class="action-buttons-table">
                    <button class="btn-edit" onclick="editLocation('${location.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" onclick="deleteLocation('${location.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadAttendanceRecords() {
    try {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*, users(employee_id, full_name)')
            .order('date', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        await displayAttendanceRecords(data);
        
    } catch (error) {
        console.error('خطأ في جلب سجلات الحضور:', error);
    }
}

async function displayAttendanceRecords(records) {
    const tbody = document.getElementById('adminAttendanceTableBody');
    tbody.innerHTML = '';
    
    for (const record of records) {
        const row = document.createElement('tr');
        let locationName = 'المكتب الرئيسي';
        
        // Get location name if location_id exists
        if (record.location_id) {
            try {
                const { data: locationData } = await supabase
                    .from('locations')
                    .select('name')
                    .eq('id', record.location_id)
                    .single();
                if (locationData) locationName = locationData.name;
            } catch (err) {
                console.log('Location not found for admin record, using default');
            }
        }
        
        row.innerHTML = `
            <td>${record.users.employee_id}</td>
            <td>${record.users.full_name}</td>
            <td>${new Date(record.date).toLocaleDateString('ar-SA')}</td>
            <td>${record.check_in ? new Date(record.check_in).toLocaleTimeString('ar-SA') : '-'}</td>
            <td>${record.check_out ? new Date(record.check_out).toLocaleTimeString('ar-SA') : '-'}</td>
            <td>${record.total_hours ? parseFloat(record.total_hours).toFixed(2) + ' ساعة' : '-'}</td>
            <td>${locationName}</td>
        `;
        tbody.appendChild(row);
    }
}

// Modal functions
function openUserModal(userId = null) {
    const modal = document.getElementById('userModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('userModalForm');
    
    form.reset();
    
    if (userId) {
        title.textContent = 'تعديل المستخدم';
        loadUserData(userId);
    } else {
        title.textContent = 'إضافة مستخدم جديد';
        document.getElementById('passwordGroup').style.display = 'block';
        document.getElementById('userLocationsGroup').style.display = 'none';
    }
    
    modal.style.display = 'flex';
}

function openLocationModal(locationId = null) {
    const modal = document.getElementById('locationModal');
    const title = document.getElementById('locationModalTitle');
    const form = document.getElementById('locationModalForm');
    
    form.reset();
    
    if (locationId) {
        title.textContent = 'تعديل الموقع';
        loadLocationData(locationId);
    } else {
        title.textContent = 'إضافة موقع جديد';
    }
    
    modal.style.display = 'flex';
}

async function loadUserData(userId) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('modalEmail').value = user.email;
        document.getElementById('modalName').value = user.full_name;
        document.getElementById('modalEmployeeId').value = user.employee_id;
        document.getElementById('modalRole').value = user.role;
        document.getElementById('passwordGroup').style.display = 'none';
        
        // Handle role-specific UI
        handleRoleChange();
        
        // Load user locations if field user
        if (user.role === 'field_user') {
            await loadUserLocationAssignments(userId);
        }
        
        // Store user ID for update
        document.getElementById('userModalForm').dataset.userId = userId;
        
    } catch (error) {
        console.error('خطأ في جلب بيانات المستخدم:', error);
    }
}

async function loadUserLocationAssignments(userId) {
    try {
        const { data, error } = await supabase
            .from('user_locations')
            .select('location_id')
            .eq('user_id', userId);
        
        if (error) throw error;
        
        const assignedLocationIds = data.map(ul => ul.location_id);
        
        // Check the assigned locations
        const checkboxes = document.querySelectorAll('input[name="userLocations"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = assignedLocationIds.includes(checkbox.value);
        });
        
    } catch (error) {
        console.error('خطأ في جلب مواقع المستخدم:', error);
    }
}

async function loadLocationData(locationId) {
    try {
        const { data: location, error } = await supabase
            .from('locations')
            .select('*')
            .eq('id', locationId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('modalLocationName').value = location.name;
        document.getElementById('modalLatitude').value = location.latitude;
        document.getElementById('modalLongitude').value = location.longitude;
        document.getElementById('modalRadius').value = location.radius;
        document.getElementById('modalLocationActive').checked = location.is_active;
        
        // Store location ID for update
        document.getElementById('locationModalForm').dataset.locationId = locationId;
        
    } catch (error) {
        console.error('خطأ في جلب بيانات الموقع:', error);
    }
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
    document.getElementById('userModalForm').reset();
    delete document.getElementById('userModalForm').dataset.userId;
}

function closeLocationModal() {
    document.getElementById('locationModal').style.display = 'none';
    document.getElementById('locationModalForm').reset();
    delete document.getElementById('locationModalForm').dataset.locationId;
}

async function saveUser(e) {
    e.preventDefault();
    
    const form = e.target;
    const userId = form.dataset.userId;
    const isEdit = !!userId;
    
    const email = document.getElementById('modalEmail').value;
    const fullName = document.getElementById('modalName').value;
    const employeeId = document.getElementById('modalEmployeeId').value;
    const role = document.getElementById('modalRole').value;
    const password = document.getElementById('modalPassword').value;
    
    try {
        if (isEdit) {
            // Update existing user
            const { error } = await supabase
                .from('users')
                .update({
                    email,
                    full_name: fullName,
                    employee_id: employeeId,
                    role
                })
                .eq('id', userId);
            
            if (error) throw error;
            
            // Update user locations if field user
            if (role === 'field_user') {
                await updateUserLocations(userId);
            }
            
        } else {
            // Create new user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        employee_id: employeeId,
                        role
                    }
                }
            });
            
            if (authError) throw authError;
            
            // Insert user data
            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    id: authData.user.id,
                    email,
                    full_name: fullName,
                    employee_id: employeeId,
                    role
                });
            
            if (insertError) throw insertError;
            
            // Add user locations if field user
            if (role === 'field_user') {
                await updateUserLocations(authData.user.id);
            }
        }
        
        closeUserModal();
        await loadUsers();
        showStatusMessage(isEdit ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في حفظ المستخدم:', error);
        showStatusMessage('حدث خطأ في حفظ المستخدم', 'error');
    }
}

async function updateUserLocations(userId) {
    try {
        // Delete existing assignments
        await supabase
            .from('user_locations')
            .delete()
            .eq('user_id', userId);
        
        // Get selected locations
        const checkboxes = document.querySelectorAll('input[name="userLocations"]:checked');
        const locationIds = Array.from(checkboxes).map(cb => cb.value);
        
        // Insert new assignments
        if (locationIds.length > 0) {
            const assignments = locationIds.map(locationId => ({
                user_id: userId,
                location_id: locationId
            }));
            
            const { error } = await supabase
                .from('user_locations')
                .insert(assignments);
            
            if (error) throw error;
        }
        
    } catch (error) {
        console.error('خطأ في تحديث مواقع المستخدم:', error);
        throw error;
    }
}

async function saveLocation(e) {
    e.preventDefault();
    
    const form = e.target;
    const locationId = form.dataset.locationId;
    const isEdit = !!locationId;
    
    const name = document.getElementById('modalLocationName').value;
    const latitude = parseFloat(document.getElementById('modalLatitude').value);
    const longitude = parseFloat(document.getElementById('modalLongitude').value);
    const radius = parseInt(document.getElementById('modalRadius').value);
    const isActive = document.getElementById('modalLocationActive').checked;
    
    try {
        const locationData = {
            name,
            latitude,
            longitude,
            radius,
            is_active: isActive
        };
        
        if (isEdit) {
            const { error } = await supabase
                .from('locations')
                .update(locationData)
                .eq('id', locationId);
            
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('locations')
                .insert(locationData);
            
            if (error) throw error;
        }
        
        closeLocationModal();
        await loadLocations();
        showStatusMessage(isEdit ? 'تم تحديث الموقع بنجاح' : 'تم إضافة الموقع بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في حفظ الموقع:', error);
        showStatusMessage('حدث خطأ في حفظ الموقع', 'error');
    }
}

// Global functions for button clicks
window.editUser = function(userId) {
    openUserModal(userId);
};

window.deleteUser = async function(userId) {
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userId);
            
            if (error) throw error;
            
            await loadUsers();
            showStatusMessage('تم حذف المستخدم بنجاح', 'success');
            
        } catch (error) {
            console.error('خطأ في حذف المستخدم:', error);
            showStatusMessage('حدث خطأ في حذف المستخدم', 'error');
        }
    }
};

window.editLocation = function(locationId) {
    openLocationModal(locationId);
};

window.deleteLocation = async function(locationId) {
    if (confirm('هل أنت متأكد من حذف هذا الموقع؟')) {
        try {
            const { error } = await supabase
                .from('locations')
                .delete()
                .eq('id', locationId);
            
            if (error) throw error;
            
            await loadLocations();
            showStatusMessage('تم حذف الموقع بنجاح', 'success');
            
        } catch (error) {
            console.error('خطأ في حذف الموقع:', error);
            showStatusMessage('حدث خطأ في حذف الموقع', 'error');
        }
    }
};

// Filter functions
function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filteredUsers = allUsers.filter(user => 
        user.full_name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.employee_id.toLowerCase().includes(searchTerm)
    );
    displayUsers(filteredUsers);
}

function filterLocations() {
    const searchTerm = document.getElementById('locationSearch').value.toLowerCase();
    const filteredLocations = allLocations.filter(location => 
        location.name.toLowerCase().includes(searchTerm)
    );
    displayLocations(filteredLocations);
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
function exportUsers() {
    const wb = XLSX.utils.book_new();
    const wsData = [
        ['رقم الموظف', 'الاسم الكامل', 'البريد الإلكتروني', 'النوع', 'الحالة', 'تاريخ الإنشاء']
    ];
    
    allUsers.forEach(user => {
        wsData.push([
            user.employee_id,
            user.full_name,
            user.email,
            getRoleText(user.role),
            user.is_active ? 'نشط' : 'غير نشط',
            new Date(user.created_at).toLocaleDateString('ar-SA')
        ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'المستخدمين');
    XLSX.writeFile(wb, 'users.xlsx');
}

function exportAttendance(format) {
    const rows = document.querySelectorAll('#adminAttendanceTableBody tr');
    const data = [];
    
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const cells = row.querySelectorAll('td');
            data.push([
                cells[0].textContent, // رقم الموظف
                cells[1].textContent, // اسم الموظف
                cells[2].textContent, // التاريخ
                cells[3].textContent, // الحضور
                cells[4].textContent, // الانصراف
                cells[5].textContent, // إجمالي الساعات
                cells[6].textContent  // الموقع
            ]);
        }
    });
    
    if (format === 'excel') {
        const wb = XLSX.utils.book_new();
        const wsData = [
            ['رقم الموظف', 'اسم الموظف', 'التاريخ', 'الحضور', 'الانصراف', 'إجمالي الساعات', 'الموقع'],
            ...data
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'سجل الحضور');
        XLSX.writeFile(wb, 'attendance.xlsx');
    }
}

// Utility functions
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('الموقع الجغرافي غير مدعوم في هذا المتصفح'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        });
    });
}

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
    
    return R * c;
}

function showStatusMessage(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        statusDiv.style.display = 'block';
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

function showError(message) {
    console.error(message);
    alert(message);
}

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Reset global variables
        currentUser = null;
        currentUserRole = null;
        allUsers = [];
        allLocations = [];
        userLocations = [];
        
        // Show login form
        showLoginForm();
        
    } catch (error) {
        console.error('خطأ في تسجيل الخروج:', error);
        showError('حدث خطأ في تسجيل الخروج');
    }
}
