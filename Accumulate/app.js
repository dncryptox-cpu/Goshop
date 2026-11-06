// PLEASE FILL IN YOUR SUPABASE PROJECT DETAILS HERE
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

// Initialize Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const loadingContainer = document.getElementById('loading-container');
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');

const authTitle = document.getElementById('auth-title');
const authForm = document.getElementById('auth-form');
const authSubmit = document.getElementById('auth-submit');
const toggleAuthBtn = document.getElementById('toggle-auth');
const displayNameGroup = document.getElementById('display-name-group');
const authError = document.getElementById('auth-error');

const logoutBtn = document.getElementById('logout-btn');
const userNameEl = document.getElementById('user-name');
const userPlanEl = document.getElementById('user-plan');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const displayNameInput = document.getElementById('display-name');

// State
let isLoginMode = true;

// Utility functions
const showElement = (el) => el.classList.remove('hidden');
const hideElement = (el) => el.classList.add('hidden');

const showError = (msg) => {
  authError.textContent = msg;
  showElement(authError);
};

const hideError = () => {
  authError.textContent = '';
  hideElement(authError);
};

// Toggle between Login and Register
toggleAuthBtn.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  hideError();
  
  if (isLoginMode) {
    authTitle.textContent = 'Đăng Nhập';
    authSubmit.textContent = 'Đăng Nhập';
    toggleAuthBtn.textContent = 'Chưa có tài khoản? Đăng ký ngay';
    hideElement(displayNameGroup);
    displayNameInput.removeAttribute('required');
  } else {
    authTitle.textContent = 'Đăng Ký';
    authSubmit.textContent = 'Tạo Tài Khoản';
    toggleAuthBtn.textContent = 'Đã có tài khoản? Đăng nhập';
    showElement(displayNameGroup);
    displayNameInput.setAttribute('required', 'true');
  }
});

// Handle Auth Form Submission
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  authSubmit.disabled = true;
  authSubmit.textContent = 'Đang xử lý...';

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    if (isLoginMode) {
      // Login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } else {
      // Register
      const displayName = displayNameInput.value.trim();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          }
        }
      });
      if (error) throw error;
      
      // Some cases when email confirmation is required, user is not logged in immediately.
      // But we will assume it might be disabled for testing, or we inform them.
      alert('Đăng ký thành công! Vui lòng kiểm tra email nếu có yêu cầu xác thực, hoặc đợi để đăng nhập.');
    }
  } catch (error) {
    showError(error.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = isLoginMode ? 'Đăng Nhập' : 'Tạo Tài Khoản';
  }
});

// Handle Logout
logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  logoutBtn.textContent = 'Đang xuất...';
  await supabase.auth.signOut();
  logoutBtn.disabled = false;
  logoutBtn.textContent = 'Đăng Xuất';
});

// Load User Profile Data
async function loadUserProfile(user) {
  try {
    // We expect the display_name from metadata first as a fallback, but fetch from profiles.
    userNameEl.textContent = user.user_metadata?.display_name || user.email;
    userPlanEl.textContent = 'Đang tải...';

    // Fetch plan from profiles table
    const { data, error } = await supabase
      .from('profiles')
      .select('plan, display_name')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Lỗi khi lấy thông tin profile:', error);
      userPlanEl.textContent = 'Lỗi truy xuất';
    } else if (data) {
      if (data.display_name) userNameEl.textContent = data.display_name;
      userPlanEl.textContent = data.plan;
    }
  } catch (err) {
    console.error(err);
  }
}

// Check initial session
async function checkUser() {
  hideElement(authContainer);
  hideElement(dashboardContainer);
  showElement(loadingContainer);

  if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
    loadingContainer.innerHTML = '<p style="color:red">Vui lòng cập nhật SUPABASE_URL và SUPABASE_ANON_KEY trong app.js!</p>';
    return;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  
  hideElement(loadingContainer);

  if (session && session.user) {
    showElement(dashboardContainer);
    loadUserProfile(session.user);
  } else {
    showElement(authContainer);
  }
}

// Listen to auth state changes (login, logout, token refresh)
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    hideElement(authContainer);
    showElement(dashboardContainer);
    loadUserProfile(session.user);
  } else if (event === 'SIGNED_OUT') {
    hideElement(dashboardContainer);
    showElement(authContainer);
    authForm.reset();
  }
});

// Initialize
checkUser();
