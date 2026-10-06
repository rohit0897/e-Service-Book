let employees = [];
let stations = [];
let selectedEmployeeIds = new Set();
let selectedStationIndex = null;

let activeEmployeeForEvents = null;
let activeEmployeeForLeave = null;
let selectedRecordForModal = null;

let currentSortField = 'default';
let currentSortDirection = 'asc';

function computeRetirementDate(dobString) {
  if (!dobString) return '';
  const parts = dobString.split('-');
  if (parts.length !== 3) return '';

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  let targetYear = y + 60;
  let targetMonth = m;

  if (d === 1) {
    targetMonth = m - 1;
    if (targetMonth === 0) {
      targetMonth = 12;
      targetYear -= 1;
    }
  }

  const lastDayDate = new Date(targetYear, targetMonth, 0);
  const yearStr = lastDayDate.getFullYear();
  const monthStr = String(lastDayDate.getMonth() + 1).padStart(2, '0');
  const dayStr = String(lastDayDate.getDate()).padStart(2, '0');

  return `${yearStr}-${monthStr}-${dayStr}`;
}

function calculateAndSetRetirementDate() {
  const dobVal = document.getElementById('formDob').value;
  if (dobVal) {
    const dor = computeRetirementDate(dobVal);
    document.getElementById('formDor').value = dor;
  }
}

function calculateLeaveBalances(emp) {
  if (!emp || !emp.leaveLedger) return { EL: 0, HPL: 0, CCL: 0 };
  let el = 0;
  let hpl = 0;
  let ccl = 0;

  emp.leaveLedger.forEach(item => {
    const days = Number(item.days || 0);
    const factor = (item.action === 'Credit') ? 1 : -1;

    if (item.type === 'EL') {
      el += (days * factor);
    } else if (item.type === 'HPL') {
      hpl += (days * factor);
    } else if (item.type === 'CCL') {
      ccl += (days * factor);
    }
  });

  return {
    EL: Math.max(0, el),
    HPL: Math.max(0, hpl),
    CCL: Math.max(0, ccl)
  };
}

function getUpcomingIncrementOptions(refDate = new Date()) {
  const currentYear = refDate.getFullYear();
  const janDate = new Date(currentYear, 0, 1);
  const julDate = new Date(currentYear, 6, 1);

  let options = [];
  if (refDate < janDate) {
    options.push(`01 Jan ${currentYear}`);
    options.push(`01 Jul ${currentYear}`);
  } else if (refDate < julDate) {
    options.push(`01 Jul ${currentYear}`);
    options.push(`01 Jan ${currentYear + 1}`);
  } else {
    options.push(`01 Jan ${currentYear + 1}`);
    options.push(`01 Jul ${currentYear + 1}`);
  }
  return options;
}

function calculate7thCpcIncrement(currentBasic) {
  const basic = Number(currentBasic) || 0;
  if (basic <= 0) return 0;
  const incrementAmount = basic * 0.03;
  return Math.round((basic + incrementAmount) / 100) * 100;
}

function advanceIncrementDateByOneYear(currentIncrementDueStr) {
  if (!currentIncrementDueStr) {
    const defaultOpts = getUpcomingIncrementOptions();
    return defaultOpts[0];
  }
  const parts = currentIncrementDueStr.trim().split(' ');
  if (parts.length >= 3) {
    const day = parts[0];
    const mon = parts[1];
    const yr = parseInt(parts[2], 10);
    if (!isNaN(yr)) {
      return `${day} ${mon} ${yr + 1}`;
    }
  }
  return currentIncrementDueStr;
}

function populateIncrementDueDropdown(selectedVal = '') {
  const select = document.getElementById('formIncrementDue');
  if (!select) return;
  select.innerHTML = '';

  const upcoming = getUpcomingIncrementOptions(new Date());
  let optionsToRender = [...upcoming];

  if (selectedVal && !optionsToRender.includes(selectedVal)) {
    optionsToRender.unshift(selectedVal);
  }

  optionsToRender.forEach(opt => {
    const optionEl = document.createElement('option');
    optionEl.value = opt;
    optionEl.textContent = opt;
    if (selectedVal && selectedVal === opt) {
      optionEl.selected = true;
    }
    select.appendChild(optionEl);
  });

  if (!selectedVal && optionsToRender.length > 0) {
    select.value = optionsToRender[0];
  }
}

function toggleManageMenu() {
  const dropdown = document.getElementById('manageEmployeesDropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

window.addEventListener('click', function(e) {
  const wrapper = document.getElementById('manageEmployeesMenuWrapper');
  const dropdown = document.getElementById('manageEmployeesDropdown');
  if (wrapper && dropdown && !wrapper.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});

function actionFromMenu(action) {
  const dropdown = document.getElementById('manageEmployeesDropdown');
  if (dropdown) dropdown.classList.add('hidden');

  if (action === 'add_single') {
    openAddEmployeeModal();
  } else if (action === 'add_bulk') {
    openBulkUploadModal();
  } else if (action === 'edit_single') {
    handleSingleEditFromSelection();
  } else if (action === 'delete_selected') {
    handleDeleteSelectedFromSelection();
  }
}

function handleSingleEditFromSelection() {
  const count = selectedEmployeeIds.size;
  if (count === 0) {
    showToast("Please select at least 1 employee using the checkbox.", "error");
    return;
  }
  const firstId = Array.from(selectedEmployeeIds)[0];
  const targetEmp = employees.find(e => e.id === firstId);
  const targetIdx = employees.findIndex(e => e.id === firstId);

  if (!targetEmp || targetIdx === -1) return;

  openSecurityWarningModal(
    'EDIT_EMPLOYEE',
    { index: targetIdx },
    `SECURITY 2FA: Employee record "${targetEmp.name}" (${targetEmp.id}) details badalne ke liye Admin NIC credentials re-verify karein.`
  );
}

function handleDeleteSelectedFromSelection() {
  const count = selectedEmployeeIds.size;
  if (count === 0) {
    showToast("Delete karne ke liye pehle checkboxes se employees select karein.", "error");
    return;
  }

  openSecurityWarningModal(
    'BULK_DELETE',
    { ids: Array.from(selectedEmployeeIds) },
    `CRITICAL 2FA CONFIRMATION: Kya aap sach me selected ${count} employees ke service records ko permanently delete karna chahte hain? Admin Passkey enter karke confirm karein.`
  );
}

async function saveEmployees() {
  // 1. Local Browser backup
  localStorage.setItem('cpo_delhi_employees_v8_3', JSON.stringify(employees));
  
  if (typeof currentAuth !== 'undefined' && currentAuth.isLoggedIn && currentAuth.role === 'employee' && currentAuth.userData) {
    const fresh = employees.find(e => e.id === currentAuth.userData.id);
    if (fresh) {
      currentAuth.userData = fresh;
      sessionStorage.setItem('cpo_delhi_session', JSON.stringify(currentAuth));
    }
  }

  // 2. Supabase Cloud Sync
  try {
    const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (client) {
      const recordsToSync = employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        dob: emp.dob,
        father_name: emp.fatherName,
        mother_name: emp.motherName,
        designation: emp.designation,
        group: emp.group,
        pay_level: emp.payLevel,
        basic_pay: emp.basicPay,
        doj: emp.doj,
        dor: emp.dor,
        increment_due: emp.incrementDue,
        phone: emp.phone,
        email: emp.email,
        password: emp.password || 'pass123',
        events: emp.events || [],
        leave_ledger: emp.leaveLedger || [],
        updated_at: new Date().toISOString()
      }));

      const { error } = await client
        .from('employees')
        .upsert(recordsToSync, { onConflict: 'id' });

      if (error) {
        console.warn("Supabase Save Warning:", error.message);
      }
    }
  } catch (err) {
    console.warn("Supabase Network Sync Failed:", err);
  }
}

function saveStations() {
  localStorage.setItem('cpo_delhi_stations', JSON.stringify(stations));
  renderPskListTable();
}

function toggleSelectAllEmployees(isChecked) {
  const currentFiltered = getFilteredEmployees();
  if (isChecked) {
    currentFiltered.forEach(emp => selectedEmployeeIds.add(emp.id));
  } else {
    currentFiltered.forEach(emp => selectedEmployeeIds.delete(emp.id));
  }
  updateMultiSelectUI();
}

function toggleEmployeeSelection(empId, isChecked) {
  if (isChecked) {
    selectedEmployeeIds.add(empId);
  } else {
    selectedEmployeeIds.delete(empId);
  }
  updateMultiSelectUI();
}

function updateMultiSelectUI() {
  const count = selectedEmployeeIds.size;
  const selectAll = document.getElementById('selectAllCheckbox');
  const badge = document.getElementById('manageMenuSelectedBadge');
  const notice = document.getElementById('selectedEmpNotice');

  if (badge) {
    if (count > 0) {
      badge.innerText = `${count} Selected`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (notice) {
    if (count > 0) {
      notice.innerHTML = `<span class="text-emerald-800 font-extrabold"><i class="fa-solid fa-circle-check mr-1"></i> ${count} employee(s) selected in table. Open 'Manage Employees' to apply action.</span>`;
    } else {
      notice.innerHTML = `<i class="fa-solid fa-square-check mr-1 text-gov-blue"></i> Use checkboxes below to select employees for edit/delete.`;
    }
  }

  const currentFiltered = getFilteredEmployees();
  if (selectAll && currentFiltered.length > 0) {
    const allSelected = currentFiltered.every(e => selectedEmployeeIds.has(e.id));
    const someSelected = currentFiltered.some(e => selectedEmployeeIds.has(e.id));
    selectAll.checked = allSelected;
    selectAll.indeterminate = !allSelected && someSelected;
  } else if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }

  document.querySelectorAll('.emp-row-checkbox').forEach(cb => {
    cb.checked = selectedEmployeeIds.has(cb.value);
  });
}

function toggleSortDirection() {
  currentSortDirection = (currentSortDirection === 'asc') ? 'desc' : 'asc';
  const label = document.getElementById('sortDirectionLabel');
  const icon = document.getElementById('sortDirectionIcon');
  
  if (currentSortDirection === 'asc') {
    label.innerText = 'ASC';
    icon.className = 'fa-solid fa-arrow-up-long text-[10px] text-gov-blue';
  } else {
    label.innerText = 'DESC';
    icon.className = 'fa-solid fa-arrow-down-long text-[10px] text-amber-600';
  }
  applyTableFilters();
}

function getFilteredEmployees() {
  const q = (document.getElementById('adminSearchInput') ? document.getElementById('adminSearchInput').value : '').toLowerCase().trim();
  const group = document.getElementById('groupFilterSelect') ? document.getElementById('groupFilterSelect').value : '';
  const post = document.getElementById('postFilterSelect') ? document.getElementById('postFilterSelect').value : '';
  const payLevel = document.getElementById('payLevelFilterSelect') ? document.getElementById('payLevelFilterSelect').value : '';
  const incDueFilter = document.getElementById('incrementDueFilterSelect') ? document.getElementById('incrementDueFilterSelect').value : '';
  const sortField = document.getElementById('sortFieldSelect') ? document.getElementById('sortFieldSelect').value : 'default';

  let result = employees.filter(emp => {
    const matchesQuery = 
      emp.name.toLowerCase().includes(q) ||
      emp.id.toLowerCase().includes(q) ||
      emp.designation.toLowerCase().includes(q) ||
      (emp.phone && emp.phone.includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q)) ||
      (emp.fatherName && emp.fatherName.toLowerCase().includes(q)) ||
      (emp.motherName
