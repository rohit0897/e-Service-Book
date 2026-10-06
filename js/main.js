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

async function initializeData() {
  startLiveClock();

  let cloudLoaded = false;

  // 1. Supabase Cloud se load karein
  const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
  if (client) {
    try {
      const { data, error } = await client
        .from('employees')
        .select('*')
        .order('id', { ascending: true });

      if (!error && data && data.length > 0) {
        employees = data.map(item => ({
          id: item.id,
          name: item.name,
          dob: item.dob,
          fatherName: item.father_name,
          motherName: item.mother_name,
          designation: item.designation,
          group: item.group,
          payLevel: item.pay_level,
          basicPay: Number(item.basic_pay),
          doj: item.doj,
          dor: item.dor,
          incrementDue: item.increment_due,
          phone: item.phone,
          email: item.email,
          password: item.password || 'pass123',
          events: item.events || [],
          leaveLedger: item.leave_ledger || []
        }));
        cloudLoaded = true;
      }
    } catch (e) {
      console.warn("Cloud connection error, falling back to local data", e);
    }
  }

  // 2. Agar Cloud pe data na ho, local storage ya default fallback
  if (!cloudLoaded) {
    const storedEmp = localStorage.getItem('cpo_delhi_employees_v8_3');
    if (storedEmp) {
      try {
        employees = JSON.parse(storedEmp);
      } catch (e) {
        employees = [...DEFAULT_EMPLOYEES];
      }
    } else {
      employees = [...DEFAULT_EMPLOYEES];
    }
    await saveEmployees();
  }

  // Default fields verify karein
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

  // Stations setup
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

  // Session check
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
  if (document.getElementById('view-admin') && !document.getElementById('view-admin').classList.contains('hidden')) {
    applyTableFilters();
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await initializeData();
  navigateTo('home');
});
