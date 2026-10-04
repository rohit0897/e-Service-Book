function startLiveClock() {
  const clockEl = document.getElementById('digitalClock');
  if (!clockEl) return;

  function updateTime() {
    const now = new Date();
    const str = now.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + " IST";
    clockEl.innerHTML = `<i class="fa-regular fa-clock mr-1.5 text-gov-gold"></i> ${str}`;
  }
  updateTime();
  setInterval(updateTime, 1000);
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');

  msgEl.innerText = message;

  if (type === 'success') {
    iconEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i>`;
  } else if (type === 'error') {
    iconEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400"></i>`;
  } else {
    iconEl.innerHTML = `<i class="fa-solid fa-circle-info text-blue-400"></i>`;
  }

  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3500);
}

function navigateTo(viewName) {
  document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('bg-white/20', 'text-white', 'text-amber-300');
    tab.classList.add('text-slate-200');
  });

  if (viewName === 'home') {
    document.getElementById('view-home').classList.remove('hidden');
    document.getElementById('tab-home').classList.add('bg-white/20', 'text-white');
  } else if (viewName === 'about') {
    document.getElementById('view-about').classList.remove('hidden');
    document.getElementById('tab-about').classList.add('bg-white/20', 'text-white');
  } else if (viewName === 'psk') {
    document.getElementById('view-psk').classList.remove('hidden');
    renderPskListTable();
    document.getElementById('tab-psk').classList.add('bg-white/20', 'text-white');
  } else if (viewName === 'contact') {
    document.getElementById('view-contact').classList.remove('hidden');
    document.getElementById('tab-contact').classList.add('bg-white/20', 'text-white');
  } else if (viewName === 'portal') {
    if (!currentAuth.isLoggedIn) {
      document.getElementById('view-login').classList.remove('hidden');
      document.getElementById('tab-portal').classList.add('bg-white/20', 'text-amber-300');
    } else if (currentAuth.role === 'admin') {
      document.getElementById('view-admin').classList.remove('hidden');
      renderAdminTable();
      document.getElementById('tab-portal').classList.add('bg-white/20', 'text-amber-300');
    } else if (currentAuth.role === 'employee') {
      document.getElementById('view-employee').classList.remove('hidden');
      renderEmployeeDashboard();
      document.getElementById('tab-portal').classList.add('bg-white/20', 'text-amber-300');
    }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initializeData() {
  startLiveClock();

  const storedEmp = localStorage.getItem('cpo_delhi_employees_v8_3');
  if (storedEmp) {
    try {
      employees = JSON.parse(storedEmp);
    } catch (e) {
      employees = [...DEFAULT_EMPLOYEES];
      saveEmployees();
    }
  } else {
    employees = [...DEFAULT_EMPLOYEES];
    saveEmployees();
  }

  const defaultIncrements = getUpcomingIncrementOptions();
  employees.forEach((emp, i) => {
    if (!emp.events) emp.events = [];
    if (!emp.leaveLedger) emp.leaveLedger = [];
    if (!emp.password) emp.password = "pass123";
    if (!emp.incrementDue) {
      emp.incrementDue = defaultIncrements[i % 2];
    }
    emp.leaveLedger = emp.leaveLedger.filter(l => ['EL', 'HPL', 'CCL'].includes(l.type));
  });

  const storedStations = localStorage.getItem('cpo_delhi_stations');
  if (storedStations) {
    try {
      stations = JSON.parse(storedStations);
    } catch (e) {
      stations = [...DEFAULT_STATIONS];
      saveStations();
    }
  } else {
    stations = [...DEFAULT_STATIONS];
    saveStations();
  }

  const savedSession = sessionStorage.getItem('cpo_delhi_session');
  if (savedSession) {
    try {
      currentAuth = JSON.parse(savedSession);
      if (currentAuth.isLoggedIn && currentAuth.role === 'employee' && currentAuth.userData) {
        const fresh = employees.find(e => e.id === currentAuth.userData.id);
        if (fresh) currentAuth.userData = fresh;
      }
    } catch (e) {
      currentAuth = { isLoggedIn: false, role: null, userData: null };
    }
  }

  updateUIAuthState();
  renderPskListTable();
}

window.addEventListener('DOMContentLoaded', () => {
  initializeData();
  navigateTo('home');
});