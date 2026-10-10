let currentAuth = { isLoggedIn: false, role: null, userData: null };
let selectedLoginRole = 'admin';
let pendingSecurityAction = null;

function getStoredAdminPassword() {
  return localStorage.getItem('cpo_delhi_admin_password') || 'admin123';
}

function setStoredAdminPassword(newPass) {
  localStorage.setItem('cpo_delhi_admin_password', newPass);
}

function getEmployeePassword(empId) {
  const emp = employees.find(e => e.id.toLowerCase() === empId.toLowerCase());
  return emp ? (emp.password || 'pass123') : 'pass123';
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  }
}

function setLoginRole(role) {
  selectedLoginRole = role;
  const adminBtn = document.getElementById('roleBtnAdmin');
  const empBtn = document.getElementById('roleBtnEmp');
  const label = document.getElementById('loginIdLabel');
  const usernameInput = document.getElementById('loginUsername');

  if (role === 'admin') {
    adminBtn.className = "flex-1 py-1.5 text-xs font-black rounded-md bg-white text-gov-navy shadow-sm transition-all";
    empBtn.className = "flex-1 py-1.5 text-xs font-bold rounded-md text-slate-700 hover:text-gov-navy transition-all";
    label.innerText = "Admin Username / NIC ID";
    usernameInput.placeholder = "admin";
  } else {
    empBtn.className = "flex-1 py-1.5 text-xs font-black rounded-md bg-white text-gov-navy shadow-sm transition-all";
    adminBtn.className = "flex-1 py-1.5 text-xs font-bold rounded-md text-slate-700 hover:text-gov-navy transition-all";
    label.innerText = "Employee ID / Registered Email";
    usernameInput.placeholder = "e.g. CPO-DEL-1001";
  }
  document.getElementById('loginFeedback').classList.add('hidden');
}

function fillCredentials(user, pass, role) {
  setLoginRole(role);
  document.getElementById('loginUsername').value = user;
  document.getElementById('loginPassword').value = pass;
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const user = document.getElementById('loginUsername').value.trim();
  const pass = document.getElementById('loginPassword').value.trim();
  const feedback = document.getElementById('loginFeedback');
  feedback.classList.add('hidden');

  if (selectedLoginRole === 'admin') {
    const storedAdminPass = getStoredAdminPassword();
    if (user.toLowerCase() === 'admin' && pass === storedAdminPass) {
      currentAuth = {
        isLoggedIn: true,
        role: 'admin',
        userData: { name: 'RPO-Delhi Admin', id: 'ADMIN-DEL' }
      };
      sessionStorage.setItem('cpo_delhi_session', JSON.stringify(currentAuth));
      showToast("Admin authenticated. Personnel module unlocked.", "success");
      updateUIAuthState();
      navigateTo('portal');
      return;
    } else {
      feedback.innerText = "Invalid Admin credentials. (Please check password)";
      feedback.classList.remove('hidden');
    }
  } else {
    const matched = employees.find(e => 
      (e.id.toLowerCase() === user.toLowerCase() || e.email.toLowerCase() === user.toLowerCase()) && 
      (e.password === pass)
    );

    if (matched) {
      currentAuth = {
        isLoggedIn: true,
        role: 'employee',
        userData: matched
      };
      sessionStorage.setItem('cpo_delhi_session', JSON.stringify(currentAuth));
      showToast(`Welcome ${matched.name}. Service Book loaded.`, "success");
      updateUIAuthState();
      navigateTo('portal');
      return;
    } else {
      feedback.innerText = "Employee not found or wrong password.";
      feedback.classList.remove('hidden');
    }
  }
}

function logout() {
  currentAuth = { isLoggedIn: false, role: null, userData: null };
  sessionStorage.removeItem('cpo_delhi_session');
  selectedEmployeeIds.clear();
  updateUIAuthState();
  renderPskListTable();
  showToast("Logged out successfully", "info");
  navigateTo('home');
}

function updateUIAuthState() {
  const widget = document.getElementById('authStatusWidget');
  const portalNavText = document.getElementById('portalNavText');
  const tabPortal = document.getElementById('tab-portal');

  if (!currentAuth.isLoggedIn) {
    // 1. Logout State: Neeche wala tab hide rahega
    if (tabPortal) tabPortal.classList.add('hidden');
    if (portalNavText) portalNavText.innerText = "e-Service Portal Login";

    widget.innerHTML = `
      <button onclick="navigateTo('portal')" class="px-3.5 py-1.5 bg-gov-navy hover:bg-gov-blue text-white text-xs font-black rounded-lg shadow-sm transition-all flex items-center">
        <i class="fa-solid fa-user-lock mr-1.5"></i> Portal Login
      </button>
    `;
  } else {
    // 2. Login State: Neeche wala tab appear ho jayega
    if (tabPortal) tabPortal.classList.remove('hidden');
    if (portalNavText) portalNavText.innerText = currentAuth.role === 'admin' ? "Admin Dashboard" : "My Service Book";

    const roleBadge = currentAuth.role === 'admin' 
      ? `<span class="bg-amber-200 text-amber-950 text-[10px] px-2 py-0.5 rounded font-black border border-amber-300">ADMIN</span>`
      : `<span class="bg-emerald-100 text-emerald-900 text-[10px] px-2 py-0.5 rounded font-black border border-emerald-300">STAFF</span>`;

    // Yahan Change Password button ko user info aur Logout button ke beech add kiya gaya hai
    widget.innerHTML = `
      <div class="flex items-center space-x-3 text-right">
        <div>
          <div class="text-xs font-black text-gov-navy">${currentAuth.userData.name}</div>
          <div class="text-[11px] text-slate-700 font-bold">${roleBadge} ${currentAuth.userData.id}</div>
        </div>
        
        <button onclick="openChangePasswordModal()" title="Change Password"
           style="background-color: #fcd34d; color: #0f172a; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); border: none; cursor: pointer;">
           <i class="fa-solid fa-key" style="font-size: 11px; color: #0f172a;"></i>
           <span>Change Password</span>
        </button>

        <button onclick="logout()" title="Logout"
           style="background-color: #b91c1c; color: #ffffff; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.15); border: none; cursor: pointer;">
           <i class="fa-solid fa-power-off" style="font-size: 11px;"></i>
           <span>Logout</span>
        </button>
      </div>
    `;
  }
}

function openChangePasswordModal() {
  if (!currentAuth.isLoggedIn) {
    showToast("Please login first to change your password.", "error");
    navigateTo('portal');
    return;
  }

  const modal = document.getElementById('changePasswordModal');
  const form = document.getElementById('changePasswordForm');
  const accountInfo = document.getElementById('changePassAccountInfo');
  const feedback = document.getElementById('changePassFeedback');

  form.reset();
  feedback.classList.add('hidden');

  document.getElementById('currPasswordInput').type = 'password';
  document.getElementById('newPasswordInput').type = 'password';
  document.getElementById('confirmPasswordInput').type = 'password';

  ['currPassIcon', 'newPassIcon', 'confPassIcon'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('fa-eye-slash');
      el.classList.add('fa-eye');
    }
  });

  if (currentAuth.role === 'admin') {
    accountInfo.innerText = "Administrator (RPO-Delhi HQ Admin)";
  } else {
    accountInfo.innerText = `${currentAuth.userData.name} (${currentAuth.userData.id})`;
  }

  modal.classList.remove('hidden');
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.add('hidden');
}

function handleChangePasswordSubmit(e) {
  e.preventDefault();
  const currPass = document.getElementById('currPasswordInput').value.trim();
  const newPass = document.getElementById('newPasswordInput').value.trim();
  const confPass = document.getElementById('confirmPasswordInput').value.trim();
  const feedback = document.getElementById('changePassFeedback');

  feedback.classList.add('hidden');

  if (newPass.length < 4) {
    feedback.innerText = "New password must be at least 4 characters long.";
    feedback.className = "p-3 rounded-lg text-xs font-bold border-2 bg-rose-100 text-rose-900 border-rose-400";
    feedback.classList.remove('hidden');
    return;
  }

  if (newPass !== confPass) {
    feedback.innerText = "New password and Confirm password do not match.";
    feedback.className = "p-3 rounded-lg text-xs font-bold border-2 bg-rose-100 text-rose-900 border-rose-400";
    feedback.classList.remove('hidden');
    return;
  }

  if (currentAuth.role === 'admin') {
    const storedAdminPass = getStoredAdminPassword();
    if (currPass !== storedAdminPass) {
      feedback.innerText = "Incorrect current administrator password!";
      feedback.className = "p-3 rounded-lg text-xs font-bold border-2 bg-rose-100 text-rose-900 border-rose-400";
      feedback.classList.remove('hidden');
      return;
    }

    setStoredAdminPassword(newPass);
    showToast("Admin password changed successfully! Use your new password on next login.", "success");
    closeChangePasswordModal();

  } else if (currentAuth.role === 'employee') {
    const empId = currentAuth.userData.id;
    const targetEmp = employees.find(emp => emp.id.toLowerCase() === empId.toLowerCase());

    if (!targetEmp) {
      feedback.innerText = "Employee record not found in system.";
      feedback.className = "p-3 rounded-lg text-xs font-bold border-2 bg-rose-100 text-rose-900 border-rose-400";
      feedback.classList.remove('hidden');
      return;
    }

    const validCurr = targetEmp.password || 'pass123';
    if (currPass !== validCurr) {
      feedback.innerText = "Incorrect current employee password!";
      feedback.className = "p-3 rounded-lg text-xs font-bold border-2 bg-rose-100 text-rose-900 border-rose-400";
      feedback.classList.remove('hidden');
      return;
    }

    targetEmp.password = newPass;
    currentAuth.userData = { ...targetEmp };
    saveEmployees();
    sessionStorage.setItem('cpo_delhi_session', JSON.stringify(currentAuth));
    showToast("Your password has been changed successfully.", "success");
    closeChangePasswordModal();
  }
}

function openSecurityWarningModal(actionType, data, warningMessage) {
  pendingSecurityAction = { type: actionType, data: data };
  
  document.getElementById('warningActionTitle').innerText = actionType.replace('_', ' ') + " CONFIRMATION";
  document.getElementById('warningActionDescription').innerText = warningMessage;

  document.getElementById('reAuthAdminUser').value = '';
  document.getElementById('reAuthAdminPass').value = '';
  document.getElementById('reAuthFeedback').classList.add('hidden');

  // Purane view dossier modal ko piche hide kar dein taaki ye seedhe center mein upar dikhe
  const viewModal = document.getElementById('viewRecordModal');
  if (viewModal && !viewModal.classList.contains('hidden')) {
    viewModal.classList.add('hidden');
  }

  const secModal = document.getElementById('securityWarningModal');
  secModal.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeSecurityWarningModal() {
  document.getElementById('securityWarningModal').classList.add('hidden');
  pendingSecurityAction = null;
}

function handleSecurityReAuthSubmit(e) {
  e.preventDefault();
  const user = document.getElementById('reAuthAdminUser').value.trim();
  const pass = document.getElementById('reAuthAdminPass').value.trim();
  const feedback = document.getElementById('reAuthFeedback');

  const adminPass = getStoredAdminPassword();

  if (user.toLowerCase() === 'admin' && pass === adminPass) {
    feedback.classList.add('hidden');
    executePendingSecurityAction();
    closeSecurityWarningModal();
  } else {
    feedback.innerText = "Security 2FA Verification Failed! Incorrect Admin ID or Password.";
    feedback.classList.remove('hidden');
  }
}

async function executePendingSecurityAction() {
  if (!pendingSecurityAction) return;
  const { type, data } = pendingSecurityAction;

  if (type === 'EDIT_EMPLOYEE') {
    editEmployeeRecord(data.index);
    showToast("Identity verified! Service record unlocked for editing.", "success");
  } 
  else if (type === 'RESET_PASSWORD_2FA') {
    const emp = employees.find(e => e.id.toLowerCase() === data.empId.toLowerCase());
    if (emp) {
      emp.password = "pass123";
      saveEmployees();
      if (selectedRecordForModal && selectedRecordForModal.id === emp.id) {
        viewEmployeeRecord(employees.findIndex(e => e.id === emp.id));
      }
      showToast(`Password for ${emp.name} has been reset to default 'pass123'.`, "success");
    }
  }
  else if (type === 'BULK_DELETE') {
    const idsToDelete = data.ids || [];
    const count = idsToDelete.length;
    
    // Supabase se delete karein
    if (typeof deleteEmployeeFromSupabase === 'function') {
      await deleteEmployeeFromSupabase(idsToDelete);
    }

    employees = employees.filter(emp => !idsToDelete.includes(emp.id));
    selectedEmployeeIds.clear();
    await saveEmployees();
    applyTableFilters();
    showToast(`2FA Verified: ${count} employee record(s) deleted permanently.`, "info");
  }
  else if (type === 'ADD_PSK') {
    stations.push(data);
    saveStations();
    selectedStationIndex = stations.length - 1;
    selectStationRow(selectedStationIndex);
    showToast(`Office "${data.name}" added successfully to registry.`, "success");
  } 
  else if (type === 'EDIT_PSK') {
    stations[data.idx] = data.stationData;
    saveStations();
    selectStationRow(data.idx);
    showToast(`Office "${data.stationData.name}" updated successfully.`, "success");
  } 
  else if (type === 'DELETE_PSK') {
    const removedName = data.name;
    stations.splice(data.idx, 1);
    selectedStationIndex = null;
    const editBtn = document.getElementById('btnEditStationTop');
    const delBtn = document.getElementById('btnDeleteStationTop');
    if (editBtn) { editBtn.disabled = true; editBtn.classList.add('opacity-50', 'cursor-not-allowed'); }
    if (delBtn) { delBtn.disabled = true; delBtn.classList.add('opacity-50', 'cursor-not-allowed'); }

    saveStations();
    showToast(`"${removedName}" removed from active register.`, "info");
  }
}
