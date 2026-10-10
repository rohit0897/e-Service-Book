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
    // Agar leave deleted/cancelled hai to balance calculate karte waqt use chhod dein (Auto Reverse)
    if (item.isDeleted) return;

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
      (emp.motherName && emp.motherName.toLowerCase().includes(q)) ||
      (emp.incrementDue && emp.incrementDue.toLowerCase().includes(q));

    const matchesGroup = group ? emp.group === group : true;
    const matchesPost = post ? emp.designation === post : true;
    const matchesLevel = payLevel ? emp.payLevel.includes(payLevel) : true;
    const matchesInc = incDueFilter ? (emp.incrementDue && emp.incrementDue.includes(incDueFilter)) : true;

    return matchesQuery && matchesGroup && matchesPost && matchesLevel && matchesInc;
  });

  if (sortField !== 'default') {
    result.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (sortField === 'basicPay') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return result;
}

function renderAdminTable(filteredData = null) {
  const data = filteredData || getFilteredEmployees();
  const tbody = document.getElementById('employeeTableBody');
  const emptyState = document.getElementById('tableEmptyState');
  const countEl = document.getElementById('filteredRecordCount');

  countEl.innerText = data.length;
  tbody.innerHTML = '';

  if (data.length === 0) {
    emptyState.classList.remove('hidden');
    updateMultiSelectUI();
    return;
  }
  emptyState.classList.add('hidden');

  data.forEach((emp) => {
    const realIndex = employees.findIndex(item => item.id === emp.id);
    const isChecked = selectedEmployeeIds.has(emp.id);

    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-50 transition-colors border-b border-slate-300 ${isChecked ? 'bg-blue-50/70' : ''}`;
    
    tr.innerHTML = `
      <td class="py-3 px-1 text-center">
        <input type="checkbox" value="${emp.id}" ${isChecked ? 'checked' : ''} onchange="toggleEmployeeSelection('${emp.id}', this.checked)" class="emp-row-checkbox rounded border-slate-400 text-gov-blue focus:ring-gov-blue cursor-pointer h-4 w-4">
      </td>
      <td class="py-3 px-2 font-mono font-black text-gov-navy text-center max-w-[120px] break-all whitespace-normal">${emp.id}</td>
      <td class="py-3 px-2 text-slate-900">
        <div class="font-extrabold text-gov-navy break-words">${emp.name}</div>
        <div class="text-[11px] text-slate-600 font-semibold flex items-start gap-1 mt-0.5">
          <i class="fa-regular fa-envelope text-[10px] text-slate-400 mt-0.5 shrink-0"></i> 
          <span class="break-all leading-tight">${emp.email || '--'}</span>
        </div>
        <div class="text-[11px] text-slate-600 font-semibold flex items-center gap-1 mt-0.5 whitespace-nowrap">
          <i class="fa-solid fa-phone text-[10px] text-slate-400 shrink-0"></i> +91 ${emp.phone || '--'}
        </div>
      </td>
      <td class="py-3 px-1 font-semibold text-slate-800 text-center whitespace-nowrap">
        ${formatDate(emp.dob)}
      </td>
      <td class="py-3 px-2 text-slate-900 text-center">
        <div class="font-bold break-words leading-tight">${emp.designation}</div>
        <div class="flex items-center justify-center gap-1 mt-1 flex-wrap">
          <span class="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-800 rounded text-[10px] font-extrabold border border-slate-300">
            ${emp.group}
          </span>
          <span class="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-800 rounded text-[10px] font-extrabold border border-slate-300">
            ${emp.payLevel}
          </span>
        </div>
      </td>
      <td class="py-3 px-1 font-black text-gov-navy text-center whitespace-nowrap">
        ₹${Number(emp.basicPay || 0).toLocaleString('en-IN')}
      </td>
      <td class="py-3 px-1 text-center font-bold text-amber-900 whitespace-nowrap">
        ${formatDate(emp.dor)}
      </td>
      <td class="py-3 px-1 text-center whitespace-nowrap">
        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-950 border border-emerald-300 whitespace-nowrap">
          <i class="fa-solid fa-calendar-day mr-1 text-emerald-700 shrink-0"></i> ${emp.incrementDue || '01 Jul 2027'}
        </span>
      </td>
      <td class="py-3 px-1 text-center whitespace-nowrap">
        <button onclick="openLeaveModal(${realIndex})" title="Manage Leave Ledger" class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 rounded-lg font-black text-xs border border-emerald-400 inline-flex items-center justify-center transition-colors whitespace-nowrap">
          <i class="fa-solid fa-calendar-check mr-1 text-emerald-800"></i> Leave
        </button>
      </td>
      <td class="py-3 px-1 text-center whitespace-nowrap">
        <button onclick="openEventsModal(${realIndex})" title="Add / View Service Events" class="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-lg font-black text-xs border border-amber-400 inline-flex items-center justify-center transition-colors whitespace-nowrap">
          <i class="fa-solid fa-timeline mr-1 text-amber-800"></i> Events
        </button>
      </td>
      <td class="py-3 px-1 text-center align-middle whitespace-nowrap">
        <button onclick="viewEmployeeRecord(${realIndex})" title="View Service Book Dossier" class="h-8 w-8 rounded-lg bg-blue-100 text-blue-900 hover:bg-blue-200 border border-blue-300 inline-flex items-center justify-center transition-colors font-bold shrink-0">
          <i class="fa-solid fa-eye text-sm"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateMultiSelectUI();
}

function applyTableFilters() {
  const filtered = getFilteredEmployees();
  renderAdminTable(filtered);
}

function resetFilters() {
  document.getElementById('adminSearchInput').value = '';
  document.getElementById('groupFilterSelect').value = '';
  document.getElementById('postFilterSelect').value = '';
  document.getElementById('payLevelFilterSelect').value = '';
  document.getElementById('incrementDueFilterSelect').value = '';
  document.getElementById('sortFieldSelect').value = 'default';
  currentSortDirection = 'asc';
  document.getElementById('sortDirectionLabel').innerText = 'ASC';
  document.getElementById('sortDirectionIcon').className = 'fa-solid fa-arrow-up-long text-[10px] text-gov-blue';
  renderAdminTable();
}

function openAddEmployeeModal() {
  document.getElementById('modalTitle').innerText = "Add New CPO Employee Service Book";
  document.getElementById('formEmployeeIndex').value = "-1";
  document.getElementById('employeeForm').reset();
  const nextNum = employees.length + 1045;
  document.getElementById('formEmpId').value = `CPO-DEL-${nextNum}`;
  document.getElementById('formEmpPassword').value = "pass123";
  document.getElementById('formDor').value = "";

  // Leave balance fields reset (Default 0)
  document.getElementById('formInitialEL').value = "0";
  document.getElementById('formInitialHPL').value = "0";
  document.getElementById('formInitialCCL').value = "0";
  document.getElementById('formInitialEL').disabled = false;
  document.getElementById('formInitialHPL').disabled = false;
  document.getElementById('formInitialCCL').disabled = false;
  
  populateIncrementDueDropdown();
  document.getElementById('employeeModal').classList.remove('hidden');
}

function editEmployeeRecord(index) {
  const emp = employees[index];
  if (!emp) return;

  document.getElementById('modalTitle').innerText = `Edit Service Book: ${emp.id}`;
  document.getElementById('formEmployeeIndex').value = index;
  document.getElementById('formEmpId').value = emp.id;
  document.getElementById('formFullName').value = emp.name;
  document.getElementById('formDob').value = emp.dob || '';
  document.getElementById('formFatherName').value = emp.fatherName || '';
  document.getElementById('formMotherName').value = emp.motherName || '';
  document.getElementById('formDesignation').value = emp.designation || '';
  document.getElementById('formGroup').value = emp.group || 'Group B (Non-Gazetted)';
  document.getElementById('formPayLevel').value = emp.payLevel || 'Level 7';
  document.getElementById('formBasicPay').value = emp.basicPay || '';
  document.getElementById('formDoj').value = emp.doj || '';
  document.getElementById('formDor').value = emp.dor || computeRetirementDate(emp.dob);
  
  populateIncrementDueDropdown(emp.incrementDue || '');

  document.getElementById('formPhone').value = emp.phone || '';
  document.getElementById('formEmail').value = emp.email || '';
  document.getElementById('formEmpPassword').value = emp.password || "pass123";

  const curBal = calculateLeaveBalances(emp);
  document.getElementById('formInitialEL').value = curBal.EL || 0;
  document.getElementById('formInitialHPL').value = curBal.HPL || 0;
  document.getElementById('formInitialCCL').value = curBal.CCL || 0;
  document.getElementById('formInitialEL').disabled = true;
  document.getElementById('formInitialHPL').disabled = true;
  document.getElementById('formInitialCCL').disabled = true;

  document.getElementById('employeeModal').classList.remove('hidden');
}

function closeEmployeeModal() {
  document.getElementById('employeeModal').classList.add('hidden');
}

async function handleEmployeeFormSubmit(e) {
  e.preventDefault();
  const idx = parseInt(document.getElementById('formEmployeeIndex').value, 10);
  const dobVal = document.getElementById('formDob').value;
  const calculatedDor = computeRetirementDate(dobVal);
  const selectedIncrementDue = document.getElementById('formIncrementDue').value;

  const existingRecord = (idx >= 0) ? employees[idx] : null;

  // Box mein daali gayi actual values read karein
  const inputEL = Number(document.getElementById('formInitialEL').value) || 0;
  const inputHPL = Number(document.getElementById('formInitialHPL').value) || 0;
  const inputCCL = Number(document.getElementById('formInitialCCL').value) || 0;

  let initialLeaves = [];
  const todayDate = new Date().toISOString().split('T')[0];

  // Agar value 0 se badi hogi tabhi leave add hogi
  if (inputEL > 0) {
    initialLeaves.push({
      id: `LV-${Date.now()}-1`,
      date: todayDate,
      action: "Credit",
      type: "EL",
      days: inputEL,
      orderNo: "Initial Credit (Opening Balance)",
      period: "Opening",
      isDeleted: false
    });
  }

  if (inputHPL > 0) {
    initialLeaves.push({
      id: `LV-${Date.now()}-2`,
      date: todayDate,
      action: "Credit",
      type: "HPL",
      days: inputHPL,
      orderNo: "Initial Credit (Opening Balance)",
      period: "Opening",
      isDeleted: false
    });
  }

  if (inputCCL > 0) {
    initialLeaves.push({
      id: `LV-${Date.now()}-3`,
      date: todayDate,
      action: "Credit",
      type: "CCL",
      days: inputCCL,
      orderNo: "Initial CCL Allocation",
      period: "Opening",
      isDeleted: false
    });
  }

  const newRecord = {
    id: document.getElementById('formEmpId').value.trim(),
    name: document.getElementById('formFullName').value.trim(),
    dob: dobVal,
    fatherName: document.getElementById('formFatherName').value.trim(),
    motherName: document.getElementById('formMotherName').value.trim(),
    designation: document.getElementById('formDesignation').value,
    group: document.getElementById('formGroup').value,
    payLevel: document.getElementById('formPayLevel').value,
    basicPay: Number(document.getElementById('formBasicPay').value),
    doj: document.getElementById('formDoj').value,
    dor: calculatedDor,
    incrementDue: selectedIncrementDue,
    phone: document.getElementById('formPhone').value.trim(),
    email: document.getElementById('formEmail').value.trim(),
    password: document.getElementById('formEmpPassword').value.trim() || 'pass123',
    events: existingRecord ? (existingRecord.events || []) : [],
    leaveLedger: existingRecord ? (existingRecord.leaveLedger || []) : initialLeaves
  };

  if (idx === -1) {
    const exists = employees.some(item => item.id.toLowerCase() === newRecord.id.toLowerCase());
    if (exists) {
      showToast(`Employee ID ${newRecord.id} already exists! Use a unique code.`, "error");
      return;
    }
    employees.unshift(newRecord);
    showToast(`Employee ${newRecord.name} added. Next Increment: ${newRecord.incrementDue}`, "success");
  } else {
    employees[idx] = newRecord;
    showToast(`Service Book for ${newRecord.name} updated successfully.`, "success");
  }

  await saveEmployees();
  closeEmployeeModal();
  applyTableFilters();
}

function handleEventTypeChange() {
  const type = document.getElementById('eventFormType').value;
  const incContainer = document.getElementById('incrementFieldsContainer');
  const descInput = document.getElementById('eventFormDesc');

  if (!activeEmployeeForEvents) return;

  if (type === 'Annual Increment') {
    incContainer.classList.remove('hidden');
    const curr = Number(activeEmployeeForEvents.basicPay) || 0;
    const nxt = calculate7thCpcIncrement(curr);
    const nextIncStr = advanceIncrementDateByOneYear(activeEmployeeForEvents.incrementDue || '01 Jul 2026');

    document.getElementById('eventCurrentBasicPay').value = curr;
    document.getElementById('eventNextBasicPay').value = nxt;
    document.getElementById('eventNextIncrementDueText').value = nextIncStr;

    descInput.value = `Annual increment granted as per 7th CPC rules raising basic pay from ₹${curr.toLocaleString('en-IN')} to ₹${nxt.toLocaleString('en-IN')} in ${activeEmployeeForEvents.payLevel}. Next increment due on ${nextIncStr}.`;
  } else {
    incContainer.classList.add('hidden');
  }
}

function openEventsModal(index) {
  const emp = employees[index];
  if (!emp) return;
  activeEmployeeForEvents = emp;

  document.getElementById('eventsModalSub').innerText = `${emp.name} (${emp.id}) • Basic Pay: ₹${Number(emp.basicPay || 0).toLocaleString('en-IN')} • Next Inc: ${emp.incrementDue || '--'}`;
  document.getElementById('addEventForm').reset();
  document.getElementById('eventFormDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('eventFormAuthority').value = "Head of Office, RPO Delhi";
  document.getElementById('eventFormType').value = "Annual Increment";

  handleEventTypeChange();
  renderEventsTimelineList();
  document.getElementById('eventsModal').classList.remove('hidden');
}

function closeEventsModal() {
  document.getElementById('eventsModal').classList.add('hidden');
  activeEmployeeForEvents = null;
  applyTableFilters();
}

async function handleAddEventSubmit(e) {
  e.preventDefault();
  if (!activeEmployeeForEvents) return;

  const eventType = document.getElementById('eventFormType').value;
  const orderNo = document.getElementById('eventFormOrderNo').value.trim();
  const desc = document.getElementById('eventFormDesc').value.trim();
  const authority = document.getElementById('eventFormAuthority').value.trim();
  const effDate = document.getElementById('eventFormDate').value;

  let updatedPayMsg = "";
  let prevBasic = null;
  let prevIncDue = null;

  if (eventType === 'Annual Increment') {
    const nextBasic = Number(document.getElementById('eventNextBasicPay').value);
    const nextIncDue = document.getElementById('eventNextIncrementDueText').value;

    prevBasic = Number(activeEmployeeForEvents.basicPay) || 0;
    prevIncDue = activeEmployeeForEvents.incrementDue || '01 Jul 2027';

    if (nextBasic > 0) {
      activeEmployeeForEvents.basicPay = nextBasic;
    }
    if (nextIncDue) {
      activeEmployeeForEvents.incrementDue = nextIncDue;
    }
    updatedPayMsg = ` (Basic Pay updated to ₹${nextBasic.toLocaleString('en-IN')} & Next Due: ${nextIncDue})`;
  }

  const newEvent = {
    id: `EVT-${Date.now()}`,
    date: effDate,
    type: eventType,
    orderNo: orderNo,
    description: desc,
    authority: authority,
    previousBasicPay: prevBasic,
    previousIncrementDue: prevIncDue,
    isDeleted: false
  };

  if (!activeEmployeeForEvents.events) activeEmployeeForEvents.events = [];
  activeEmployeeForEvents.events.unshift(newEvent);

  await saveEmployees();
  renderEventsTimelineList();
  
  document.getElementById('eventsModalSub').innerText = `${activeEmployeeForEvents.name} (${activeEmployeeForEvents.id}) • Basic Pay: ₹${Number(activeEmployeeForEvents.basicPay || 0).toLocaleString('en-IN')} • Next Inc: ${activeEmployeeForEvents.incrementDue || '--'}`;

  document.getElementById('addEventForm').reset();
  document.getElementById('eventFormDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('eventFormAuthority').value = "Head of Office, RPO Delhi";
  document.getElementById('eventFormType').value = "Annual Increment";
  handleEventTypeChange();

  showToast(`Service event added!${updatedPayMsg}`, "success");
}

async function deleteServiceEvent(eventId) {
  if (!activeEmployeeForEvents) return;
  const evt = activeEmployeeForEvents.events.find(e => e.id === eventId);
  if (!evt) return;

  const cancelRef = prompt(
    "SERVICE EVENT CANCELLATION / REVERSAL:\nKripya is entry ko cancel karne ke liye Sanction / Official Order No. ya Reference No. darj karein:"
  );

  if (cancelRef === null) return;
  if (cancelRef.trim() === "") {
    showToast("Cancellation Order/Reference No. darj karna anivarya hai.", "error");
    return;
  }

  // 1. Soft Delete mark karein aur Cancellation Order store karein
  evt.isDeleted = true;
  evt.deletedAt = new Date().toISOString();
  evt.cancellationOrderNo = cancelRef.trim();

  // 2. Particulars / Pay revert karein
  if (evt.type === 'Annual Increment' && evt.previousBasicPay) {
    activeEmployeeForEvents.basicPay = evt.previousBasicPay;
    if (evt.previousIncrementDue) {
      activeEmployeeForEvents.incrementDue = evt.previousIncrementDue;
    }
  }

  await saveEmployees();
  renderEventsTimelineList();
  
  document.getElementById('eventsModalSub').innerText = `${activeEmployeeForEvents.name} (${activeEmployeeForEvents.id}) • Basic Pay: ₹${Number(activeEmployeeForEvents.basicPay || 0).toLocaleString('en-IN')} • Next Inc: ${activeEmployeeForEvents.incrementDue || '--'}`;
  
  showToast(`Service event cancelled (Order: ${cancelRef.trim()}) & pay particulars reversed.`, "info");
}

function renderEventsTimelineList() {
  const container = document.getElementById('eventsListContainer');
  if (!container || !activeEmployeeForEvents) return;

  const events = activeEmployeeForEvents.events || [];
  if (events.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-700 font-bold p-3 bg-slate-50 rounded border border-slate-200">No service events recorded yet.</p>`;
    return;
  }

  container.innerHTML = events.map(evt => {
    const isCancelled = evt.isDeleted === true;

    return `
      <div class="p-3 rounded-lg border-2 shadow-xs relative transition-all ${isCancelled ? 'bg-rose-50/75 border-rose-300 opacity-80' : 'bg-white border-slate-200'}">
        <div class="flex justify-between items-start">
          <div class="flex items-center space-x-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-black ${isCancelled ? 'bg-rose-200 text-rose-950 border border-rose-400' : 'bg-amber-100 text-amber-950 border border-amber-300'}">
              ${evt.type}
            </span>
            <span class="text-xs font-mono font-bold text-gov-navy ${isCancelled ? 'line-through text-slate-500' : ''}">${formatDate(evt.date)}</span>
            ${isCancelled ? '<span class="px-1.5 py-0.2 bg-rose-600 text-white rounded text-[9px] font-black tracking-wider uppercase">[CANCELLED / REVERTED]</span>' : ''}
          </div>
          ${!isCancelled ? `
            <button onclick="deleteServiceEvent('${evt.id}')" title="Cancel & Revert Event" class="text-rose-600 hover:text-rose-800 text-xs p-1 font-bold">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : `
            <span class="text-[10px] text-rose-700 font-extrabold italic">Cancelled</span>
          `}
        </div>
        <p class="text-xs font-bold mt-1.5 leading-relaxed break-words ${isCancelled ? 'line-through text-slate-500' : 'text-slate-900'}">${evt.description}</p>
          <div class="mt-2 pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-[11px] text-slate-700 font-semibold gap-1">
            <span class="break-all"><strong>Order:</strong> ${evt.orderNo}</span>${isCancelled && evt.cancellationOrderNo ? `<span class="text-rose-800 font-bold break-all"><strong>Reversal Order:</strong> ${evt.cancellationOrderNo}</span>` : ''}
            <span class="break-words"><strong>Attested by:</strong> ${evt.authority}</span>
          </div>
      </div>
    `;
  }).join('');
}

function openLeaveModal(index) {
  const emp = employees[index];
  if (!emp) return;
  activeEmployeeForLeave = emp;

  document.getElementById('leaveModalSub').innerText = `${emp.name} (${emp.id}) • Pay Level: ${emp.payLevel}`;
  document.getElementById('addLeaveForm').reset();
  document.getElementById('leaveFormDate').value = new Date().toISOString().split('T')[0];

  updateModalLeaveBalances();
  renderLeaveLedgerTable();
  document.getElementById('leaveModal').classList.remove('hidden');
}

function closeLeaveModal() {
  document.getElementById('leaveModal').classList.add('hidden');
  activeEmployeeForLeave = null;
  applyTableFilters();
}

function updateModalLeaveBalances() {
  if (!activeEmployeeForLeave) return;
  const b = calculateLeaveBalances(activeEmployeeForLeave);
  document.getElementById('modalElBalance').innerText = `${b.EL} Days`;
  document.getElementById('modalHplBalance').innerText = `${b.HPL} Days`;
  document.getElementById('modalCclBalance').innerText = `${b.CCL} Days`;
}

async function handleAddLeaveSubmit(e) {
  e.preventDefault();
  if (!activeEmployeeForLeave) return;

  const action = document.getElementById('leaveFormAction').value;
  const type = document.getElementById('leaveFormType').value;
  const days = Number(document.getElementById('leaveFormDays').value);
  const curBalances = calculateLeaveBalances(activeEmployeeForLeave);

  if (action === 'Debit') {
    if (type === 'EL' && days > curBalances.EL) {
      showToast(`Warning: Requested EL debit (${days}d) exceeds balance (${curBalances.EL}d).`, "error");
    } else if (type === 'CCL' && days > curBalances.CCL) {
      showToast(`Warning: Requested CCL debit (${days}d) exceeds balance (${curBalances.CCL}d).`, "error");
    }
  }

  const newLeaveEntry = {
    id: `LV-${Date.now()}`,
    date: document.getElementById('leaveFormDate').value,
    action: action,
    type: type,
    days: days,
    orderNo: document.getElementById('leaveFormOrder').value.trim(),
    period: document.getElementById('leaveFormPeriod').value.trim() || 'N/A',
    isDeleted: false // Active record status
  };

  if (!activeEmployeeForLeave.leaveLedger) activeEmployeeForLeave.leaveLedger = [];
  activeEmployeeForLeave.leaveLedger.unshift(newLeaveEntry);

  await saveEmployees();
  updateModalLeaveBalances();
  renderLeaveLedgerTable();
  document.getElementById('addLeaveForm').reset();
  document.getElementById('leaveFormDate').value = new Date().toISOString().split('T')[0];
  showToast(`Leave ${action} of ${days} days (${type}) recorded successfully.`, "success");
}

async function deleteLeaveTransaction(leaveId) {
  if (!activeEmployeeForLeave) return;
  const item = activeEmployeeForLeave.leaveLedger.find(l => l.id === leaveId);
  if (!item) return;

  const cancelRef = prompt(
    "LEAVE CANCELLATION / REVERSAL:\nKripya is leave entry ko cancel/reverse karne ke liye Competent Authority ka Order No. ya Reference No. darj karein:"
  );

  if (cancelRef === null) return;
  if (cancelRef.trim() === "") {
    showToast("Cancellation Order/Reference No. darj karna anivarya hai.", "error");
    return;
  }

  // 1. Soft Delete mark karein aur Reversal Order store karein
  item.isDeleted = true;
  item.deletedAt = new Date().toISOString();
  item.cancellationOrderNo = cancelRef.trim();

  // 2. Storage & Cloud sync
  await saveEmployees();
  
  // 3. Balance recalculate (auto reverse) aur UI render
  updateModalLeaveBalances();
  renderLeaveLedgerTable();
  showToast(`Leave entry cancelled & balance auto-reversed (Ref: ${cancelRef.trim()}).`, "info");
}

function renderLeaveLedgerTable() {
  const tbody = document.getElementById('leaveLedgerTableBody');
  if (!tbody || !activeEmployeeForLeave) return;

  const ledger = activeEmployeeForLeave.leaveLedger || [];
  if (ledger.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-slate-700 font-bold">No leave transactions recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = ledger.map(item => {
    const isCredit = item.action === 'Credit';
    const isCancelled = item.isDeleted === true;
    const badgeColor = isCredit ? 'bg-emerald-100 text-emerald-950 border-emerald-400 font-black' : 'bg-rose-100 text-rose-950 border-rose-400 font-black';
    const sign = isCredit ? '+' : '-';

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-200 ${isCancelled ? 'bg-rose-50/75 opacity-75' : ''}">
        <td class="py-2 px-2.5 font-mono text-xs font-bold ${isCancelled ? 'line-through text-slate-400' : ''}">${formatDate(item.date)}</td>
        <td class="py-2 px-2.5 font-black text-slate-900">
          <span class="${isCancelled ? 'line-through text-slate-400' : ''}">${item.type}</span>
          ${isCancelled ? '<span class="ml-1 px-1.5 py-0.2 bg-rose-600 text-white rounded text-[9px] font-black uppercase inline-block">[CANCELLED]</span>' : ''}
        </td>
        <td class="py-2 px-2.5">
          <span class="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase border ${badgeColor} ${isCancelled ? 'opacity-50' : ''}">
            ${item.action}
          </span>
        </td>
        <td class="py-2 px-2.5 font-mono font-black text-center ${isCancelled ? 'line-through text-slate-400' : (isCredit ? 'text-emerald-800' : 'text-rose-800')}">
          ${sign}${item.days}
        </td>
        <td class="py-2 px-2.5 text-slate-900 font-semibold break-words" title="${item.orderNo}">
          <div class="${isCancelled ? 'line-through text-slate-400' : ''}">${item.orderNo}</div>
          ${isCancelled && item.cancellationOrderNo ? `
            <div class="text-[10px] text-rose-800 font-extrabold mt-0.5">Rev Order: ${item.cancellationOrderNo}</div>
          ` : ''}
        </td>
        <td class="py-2 px-2.5 text-slate-700 font-medium text-xs break-words whitespace-normal ${isCancelled ? 'line-through text-slate-400' : ''}">${item.period}</td>
        <td class="py-2 px-2.5 text-center">
          ${!isCancelled ? `
            <button onclick="deleteLeaveTransaction('${item.id}')" title="Cancel & Reverse Leave" class="text-rose-600 hover:text-rose-800 font-bold">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          ` : `
            <span class="text-[10px] text-rose-700 font-extrabold italic">Cancelled</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function openBulkUploadModal() {
  document.getElementById('excelFileInput').value = '';
  document.getElementById('selectedExcelName').innerText = '';
  document.getElementById('bulkUploadSummary').classList.add('hidden');
  document.getElementById('bulkUploadModal').classList.remove('hidden');
}

function closeBulkUploadModal() {
  document.getElementById('bulkUploadModal').classList.add('hidden');
}

function downloadSampleExcelTemplate() {
  const sampleData = [
    {
      "Employee ID": "CPO-DEL-2001",
      "Employee Name": "Anand Mohan Sharma",
      "Date of Birth (YYYY-MM-DD)": "1982-05-18",
      "Father Name": "Shri Ram Murti Sharma",
      "Mother Name": "Smt. Shanti Devi",
      "Designation": "Assistant Passport Officer (APO)",
      "Group": "Group A",
      "Pay Level": "Level 10",
      "Basic Pay": 56100,
      "Date of Joining (YYYY-MM-DD)": "2016-07-01",
      "Increment Due (01 Jan / 01 Jul YYYY)": "01 Jul 2027",
      "Mobile No": "9812345678",
      "Email ID": "anand.sharma@mea.gov.in",
      "Password": "pass123"
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Staff_Roster");
  XLSX.writeFile(wb, "CPO_Delhi_Staff_Bulk_Upload_Template.xlsx");
  showToast("Template downloaded successfully.", "success");
}

function handleExcelFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById('selectedExcelName').innerText = `Selected: ${file.name}`;
  const reader = new FileReader();

  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!jsonData || jsonData.length === 0) {
        showToast("The uploaded spreadsheet contains no data rows.", "error");
        return;
      }

      let addedCount = 0;
      let updatedCount = 0;
      const defaultIncList = getUpcomingIncrementOptions();

      jsonData.forEach((row, i) => {
        const empId = String(row["Employee ID"] || row["Employee_ID"] || row["id"] || row["ID"] || "").trim();
        const name = String(row["Employee Name"] || row["Employee_Name"] || row["name"] || row["Name"] || "").trim();

        if (!empId || !name) return;

        let rawDob = row["Date of Birth (YYYY-MM-DD)"] || row["DOB"] || row["dob"] || "1990-01-01";
        let rawDoj = row["Date of Joining (YYYY-MM-DD)"] || row["DOJ"] || row["doj"] || "2020-01-01";

        const dob = normalizeExcelDate(rawDob);
        const doj = normalizeExcelDate(rawDoj);
        const dor = computeRetirementDate(dob);
        const incDue = String(row["Increment Due (01 Jan / 01 Jul YYYY)"] || row["Increment Due"] || defaultIncList[i % 2]).trim();

        const fatherName = String(row["Father Name"] || row["Father's Name"] || row["fatherName"] || "").trim();
        const motherName = String(row["Mother Name"] || row["Mother's Name"] || row["motherName"] || "").trim();
        const designation = String(row["Designation"] || row["designation"] || "Passport Assistant").trim();
        const group = String(row["Group"] || row["group"] || "Group B (Non-Gazetted)").trim();
        const payLevel = String(row["Pay Level"] || row["payLevel"] || "Level 7").trim();
        const basicPay = Number(row["Basic Pay"] || row["basicPay"] || 35400);
        const phone = String(row["Mobile No"] || row["Mobile"] || row["phone"] || "9999999999").trim();
        const email = String(row["Email ID"] || row["Email"] || row["email"] || `${empId.toLowerCase()}@mea.gov.in`).trim();

        const existingIdx = employees.findIndex(e => e.id.toLowerCase() === empId.toLowerCase());
        const existingEvents = existingIdx >= 0 ? (employees[existingIdx].events || []) : [];
        const existingLeave = existingIdx >= 0 ? (employees[existingIdx].leaveLedger || []) : [];

        const newEmployeeObj = {
          id: empId,
          name: name,
          dob: dob,
          fatherName: fatherName,
          motherName: motherName,
          designation: designation,
          group: group,
          payLevel: payLevel,
          basicPay: basicPay,
          doj: doj,
          dor: dor,
          incrementDue: incDue,
          phone: phone,
          email: email,
          password: String(row["Password"] || "pass123").trim(),
          events: existingEvents,
          leaveLedger: existingLeave
        };

        if (existingIdx >= 0) {
          employees[existingIdx] = newEmployeeObj;
          updatedCount++;
        } else {
          employees.push(newEmployeeObj);
          addedCount++;
        }
      });

      await saveEmployees();
      applyTableFilters();

      const summaryDiv = document.getElementById('bulkUploadSummary');
      summaryDiv.innerHTML = `
        <div class="font-black flex items-center text-sm">
          <i class="fa-solid fa-circle-check text-emerald-800 mr-2"></i> File Processed Successfully!
        </div>
        <p class="mt-1">
          New Service Books Added: <strong>${addedCount}</strong> | Existing Updated: <strong>${updatedCount}</strong>.
        </p>
      `;
      summaryDiv.classList.remove('hidden');
      showToast(`Bulk Ingestion Done: ${addedCount} added, ${updatedCount} updated.`, "success");

    } catch (error) {
      console.error(error);
      showToast("Failed to process Excel file. Please check columns format.", "error");
    }
  };

  reader.readAsArrayBuffer(file);
}

function normalizeExcelDate(val) {
  if (!val) return '1990-01-01';
  if (typeof val === 'number') {
    const utc_days = Math.floor(val - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${String(parts[1]).padStart(2,'0')}-${String(parts[0]).padStart(2,'0')}`;
      }
    }
  }
  return str;
}

function viewEmployeeRecord(index) {
  const emp = employees[index];
  if (!emp) return;
  selectedRecordForModal = emp;
  const b = calculateLeaveBalances(emp);

  let eventsHtml = "";
  if (emp.events && emp.events.length > 0) {
    eventsHtml = `
      <div class="mt-4 pt-3 border-t-2 border-slate-200 col-span-2">
        <h5 class="text-xs font-black text-gov-navy uppercase tracking-wider mb-2">Service Book Events History</h5>
        <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
          ${emp.events.map(ev => `
            <div class="p-2 rounded border text-xs ${ev.isDeleted ? 'bg-rose-50 border-rose-200 opacity-75' : 'bg-slate-50 border-slate-200'}">
              <div class="flex justify-between font-bold">
                <span>${ev.type}${ev.isDeleted ? '<span class="text-rose-600 font-black">[CANCELLED]</span>' : ''}</span>
                <span class="text-slate-500 font-mono">${formatDate(ev.date)}</span>
              </div>
              <p class="text-slate-700 mt-0.5 ${ev.isDeleted ? 'line-through' : ''}">${ev.description}</p>${ev.isDeleted && ev.cancellationOrderNo ? `<p class="text-[10px] text-rose-800 font-bold mt-1">Reversal Order: ${ev.cancellationOrderNo}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const content = document.getElementById('viewModalContent');
  content.innerHTML = `
    <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
      <div class="flex justify-between items-start">
        <div>
          <span class="text-xs font-black tracking-wider text-amber-700 uppercase">Central Passport Organization</span>
          <h4 class="text-base font-black text-gov-navy">${emp.name}</h4>
          <p class="text-slate-800 font-bold">${emp.designation} (${emp.group})</p>
        </div>
        <span class="px-2.5 py-1 bg-gov-navy text-white font-mono font-black rounded-lg text-xs">${emp.id}</span>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 text-center">
      <div class="p-2.5 bg-emerald-50 rounded-lg border-2 border-emerald-300">
        <span class="text-xs uppercase font-black text-emerald-900">Earned Leave (EL)</span>
        <span class="block text-lg font-black text-emerald-950">${b.EL} Days</span>
      </div>
      <div class="p-2.5 bg-blue-50 rounded-lg border-2 border-blue-300">
        <span class="text-xs uppercase font-black text-blue-900">Half Pay Leave (HPL)</span>
        <span class="block text-lg font-black text-blue-950">${b.HPL} Days</span>
      </div>
      <div class="p-2.5 bg-purple-50 rounded-lg border-2 border-purple-300">
        <span class="text-xs uppercase font-black text-purple-900">Child Care Leave (CCL)</span>
        <span class="block text-lg font-black text-purple-950">${b.CCL} Days</span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="p-2.5 rounded-lg border-2 border-slate-200 bg-white">
        <span class="text-slate-600 block text-xs font-bold">Date of Birth (DOB)</span>
        <span class="font-extrabold text-slate-900">${formatDate(emp.dob)}</span>
      </div>
      <div class="p-2.5 rounded-lg border-2 border-slate-200 bg-white">
        <span class="text-slate-600 block text-xs font-bold">Father's Name</span>
        <span class="font-extrabold text-slate-900">${emp.fatherName || '--'}</span>
      </div>
      <div class="p-2.5 rounded-lg border-2 border-slate-200 bg-white">
        <span class="text-slate-600 block text-xs font-bold">Mother's Name</span>
        <span class="font-extrabold text-slate-900">${emp.motherName || '--'}</span>
      </div>
      <div class="p-2.5 rounded-lg border-2 border-slate-200 bg-white">
        <span class="text-slate-600 block text-xs font-bold">Basic Pay & Pay Level</span>
        <span class="font-black text-gov-blue">₹${Number(emp.basicPay || 0).toLocaleString('en-IN')} (${emp.payLevel})</span>
      </div>
      <div class="p-2.5 rounded-lg border-2 border-slate-200 bg-white">
        <span class="text-slate-600 block text-xs font-bold">Date of Joining (DOJ)</span>
        <span class="font-extrabold text-slate-900">${formatDate(emp.doj)}</span>
      </div>
      <div class="p-2.5 rounded-lg border-2 border-slate-200 bg-white">
        <span class="text-slate-600 block text-xs font-bold">Date of Retirement (60 Yrs)</span>
        <span class="font-extrabold text-slate-900">${formatDate(emp.dor)}</span>
      </div>
      <div class="p-2.5 rounded-lg border-2 border-emerald-300 bg-emerald-50">
        <span class="text-emerald-900 block text-xs font-black">Next Increment Due On</span>
        <span class="font-black text-emerald-950">${emp.incrementDue || '01 Jul 2027'}</span>
      </div>
      <div class="p-2.5 rounded-lg border-2 border-slate-200 bg-white">
        <span class="text-slate-600 block text-xs font-bold">Official Mobile No.</span>
        <span class="font-extrabold text-slate-900">+91 ${emp.phone || '--'}</span>
      </div>
      <div class="p-2.5 rounded-lg border-2 border-slate-200 bg-white col-span-2">
        <span class="text-slate-600 block text-xs font-bold">Official Email ID</span>
        <span class="font-extrabold text-slate-900">${emp.email || '--'}</span>
      </div>

      <div class="p-2.5 rounded-lg border-2 border-slate-200 bg-white col-span-2 flex items-center justify-between">
        <div>
          <span class="text-slate-600 block text-xs font-bold">Portal Access Security</span>
          <span class="font-mono text-sm tracking-widest font-black text-slate-700">••••••••</span>
          <span class="text-[10px] text-slate-500 block font-semibold">(Encrypted / Masked for Privacy)</span>
        </div>
        <div>
          <button onclick="requestResetEmployeePassword('${emp.id}')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs transition-colors flex items-center shadow-xs">
            <i class="fa-solid fa-arrows-rotate mr-1.5"></i> Reset to Default
          </button>
        </div>
      </div>

      ${eventsHtml}
    </div>
  `;

  document.getElementById('viewRecordModal').classList.remove('hidden');
}

function requestResetEmployeePassword(empId) {
  const emp = employees.find(e => e.id.toLowerCase() === empId.toLowerCase());
  if (!emp) return;

  openSecurityWarningModal(
    'RESET_PASSWORD_2FA',
    { empId: emp.id },
    `SECURITY AUTHORIZATION: Kya aap sach me employee "${emp.name}" (${emp.id}) ka password reset karke default 'pass123' set karna chahte hain? Confirm karne ke liye apna Admin NIC Username aur Password enter karein.`
  );
}

function closeViewRecordModal() {
  document.getElementById('viewRecordModal').classList.add('hidden');
  selectedRecordForModal = null;
}

function exportToCSV() {
  if (!employees || employees.length === 0) {
    showToast("No employee records to export.", "error");
    return;
  }

  const headers = [
    "Employee_ID", "Employee_Name", "Date_Of_Birth", "Father_Name", "Mother_Name",
    "Designation", "Group", "Pay_Level", "Basic_Pay", "Date_Of_Joining",
    "Date_Of_Retirement", "Increment_Due_On", "Mobile_No", "Email_ID", "EL_Balance", "HPL_Balance", "CCL_Balance"
  ];
  
  const rows = employees.map(emp => {
    const b = calculateLeaveBalances(emp);
    return [
      `"${emp.id}"`, `"${emp.name}"`, `"${emp.dob}"`, `"${emp.fatherName || ''}"`,
      `"${emp.motherName || ''}"`, `"${emp.designation}"`, `"${emp.group}"`,
      `"${emp.payLevel}"`, `"${emp.basicPay || ''}"`, `"${emp.doj}"`,
      `"${emp.dor}"`, `"${emp.incrementDue || ''}"`, `"${emp.phone}"`, `"${emp.email}"`,
      `"${b.EL}"`, `"${b.HPL}"`, `"${b.CCL}"`
    ];
  });

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `CPO_RPO_Delhi_Staff_Register_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Exported ${employees.length} records to CSV format.`, "success");
}

function printSingleRecordModal() {
  if (!selectedRecordForModal) return;
  printSingleEmployee(selectedRecordForModal);
}

function printCurrentEmployeeSlip() {
  if (currentAuth.role === 'employee' && currentAuth.userData) {
    printSingleEmployee(currentAuth.userData);
  }
}

function printSingleEmployee(emp) {
  const printableArea = document.getElementById('printableArea');
  const b = calculateLeaveBalances(emp);

  let eventsHtml = "";
  if (emp.events && emp.events.length > 0) {
    eventsHtml = `
      <h4 style="margin: 20px 0 8px 0; font-size: 12px; color: #0b2545; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px;">VERIFIED SERVICE BOOK EVENTS RECORD</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Date</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Event</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Order No.</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${emp.events.map(ev => `
            <tr style="${ev.isDeleted ? 'color: #888; text-decoration: line-through;' : ''}">
              <td style="border: 1px solid #cbd5e1; padding: 6px;">${formatDate(ev.date)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${ev.type}${ev.isDeleted ? ' (CANCELLED)' : ''}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px;">${ev.orderNo}${ev.isDeleted && ev.cancellationOrderNo ? `<br><small style="color: #991b1b;">Rev: ${ev.cancellationOrderNo}</small>` : ''}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px;">${ev.description}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  printableArea.innerHTML = `
    <div style="font-family: Arial, sans-serif; padding: 30px; border: 2px solid #0b2545; max-width: 800px; margin: auto;">
      <div style="text-align: center; border-bottom: 2px solid #0b2545; padding-bottom: 10px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 12px; font-weight: bold; color: #ff9933;">GOVERNMENT OF INDIA • MINISTRY OF EXTERNAL AFFAIRS</p>
        <h2 style="margin: 4px 0; color: #0b2545; font-size: 20px;">CENTRAL PASSPORT ORGANIZATION</h2>
        <h3 style="margin: 0; color: #134074; font-size: 15px;">REGIONAL PASSPORT OFFICE, DELHI</h3>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #555;">Official e-Service Book Transcript (Leave Account: EL, HPL, CCL)</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; background: #f8fafc; width: 35%; font-weight: bold;">CPO Employee ID:</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">${emp.id}</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Employee Name:</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${emp.name}</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Date of Birth (DOB):</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${formatDate(emp.dob)}</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Father's / Mother's Name:</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${emp.fatherName || '--'} / ${emp.motherName || '--'}</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Designation & Group:</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${emp.designation} (${emp.group})</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Basic Pay (7th CPC):</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: #0b2545;">₹${Number(emp.basicPay || 0).toLocaleString('en-IN')} (${emp.payLevel})</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Date of Joining / Retirement:</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">DOJ: ${formatDate(emp.doj)} | Superannuation (60 Yrs): <strong>${formatDate(emp.dor)}</strong></td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; background: #f0fdf4; font-weight: bold; color: #166534;">Next Increment Due On:</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: #166534;">${emp.incrementDue || '01 Jul 2027'}</td>
        </tr>
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; background: #f0fdf4; font-weight: bold; color: #166534;">Verified Leave Balances:</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: #166534;">EL: ${b.EL} Days | HPL: ${b.HPL} Days | CCL: ${b.CCL} Days</td>
        </tr>
      </table>

      ${eventsHtml}
    </div>
  `;

  printableArea.classList.remove('hidden');
  window.print();
  printableArea.classList.add('hidden');
}

function renderEmployeeDashboard() {
  const emp = currentAuth.userData;
  if (!emp) return;

  const balances = calculateLeaveBalances(emp);
  const eventsCount = emp.events ? emp.events.length : 0;

  document.getElementById('empAvatarLetter').innerText = emp.name.charAt(0).toUpperCase();
  document.getElementById('empCardName').innerText = emp.name;
  document.getElementById('empCardDesignation').innerText = emp.designation;
  document.getElementById('empCardId').innerText = emp.id;
  document.getElementById('empCardGroupBadge').innerText = emp.group;

  document.getElementById('empDeskElBalance').innerText = `${balances.EL} Days`;
  document.getElementById('empDeskHplBalance').innerText = `${balances.HPL} Days`;
  document.getElementById('empDeskCclBalance').innerText = `${balances.CCL} Days`;
  document.getElementById('empDeskEventsCount').innerText = `${eventsCount} Entries`;

  document.getElementById('detailEmpId').innerText = emp.id;
  document.getElementById('detailDob').innerText = formatDate(emp.dob);
  document.getElementById('detailFatherName').innerText = emp.fatherName || '--';
  document.getElementById('detailMotherName').innerText = emp.motherName || '--';
  document.getElementById('detailDesignation').innerText = emp.designation;
  document.getElementById('detailGroup').innerText = emp.group;
  document.getElementById('detailPayLevel').innerText = emp.payLevel;
  document.getElementById('detailBasicPay').innerText = `₹${Number(emp.basicPay || 0).toLocaleString('en-IN')}`;
  document.getElementById('detailDoj').innerText = formatDate(emp.doj);
  document.getElementById('detailDor').innerText = `${formatDate(emp.dor)} (Superannuation)`;
  document.getElementById('detailIncrementDue').innerText = emp.incrementDue || '01 Jul 2027';
  document.getElementById('detailContact').innerText = `${emp.email} • +91 ${emp.phone}`;

  const leaveTbody = document.getElementById('empSelfLeaveTableBody');
  const ledger = emp.leaveLedger || [];
  if (ledger.length === 0) {
    leaveTbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-slate-700 font-bold">No leave ledger transactions on record.</td></tr>`;
  } else {
    leaveTbody.innerHTML = ledger.map(l => {
      const isCredit = l.action === 'Credit';
      const isCancelled = l.isDeleted === true;

      return `
        <tr class="hover:bg-slate-50 border-b border-slate-200 ${isCancelled ? 'bg-rose-50/75 opacity-75' : ''}">
          <td class="py-2.5 px-3 font-mono text-xs font-bold ${isCancelled ? 'line-through text-slate-400' : ''}">${formatDate(l.date)}</td>
          <td class="py-2.5 px-3 font-black text-slate-900">
            <span class="${isCancelled ? 'line-through text-slate-400' : ''}">${l.type}</span>
            ${isCancelled ? '<span class="ml-1 px-1.5 py-0.2 bg-rose-600 text-white rounded text-[9px] font-black uppercase inline-block">[CANCELLED]</span>' : ''}
          </td>
          <td class="py-2.5 px-3">
            <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-black border ${isCredit ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : 'bg-rose-100 text-rose-950 border-rose-300'} ${isCancelled ? 'opacity-50' : ''}">
              ${l.action}
            </span>
          </td>
          <td class="py-2.5 px-3 font-mono font-black text-center ${isCancelled ? 'line-through text-slate-400' : (isCredit ? 'text-emerald-800' : 'text-rose-800')}">
            ${isCredit ? '+' : '-'}${l.days}
          </td>
          <td class="py-2.5 px-3 text-slate-900 font-bold">
            <div class="${isCancelled ? 'line-through text-slate-400' : ''}">${l.orderNo}</div>
            ${isCancelled && l.cancellationOrderNo ? `<div class="text-[10px] text-rose-800 font-extrabold mt-0.5">Rev Order: ${l.cancellationOrderNo}</div>` : ''}
          </td>
          <td class="py-2.5 px-3 text-slate-700 font-semibold ${isCancelled ? 'line-through text-slate-400' : ''}">${l.period || '--'}</td>
        </tr>
      `;
    }).join('');
  }

  const eventsContainer = document.getElementById('empSelfEventsContainer');
  const events = emp.events || [];
  if (events.length === 0) {
    eventsContainer.innerHTML = `<p class="text-xs text-slate-700 font-bold p-3 bg-slate-50 rounded border border-slate-200">No official service events recorded in your e-Service Book yet.</p>`;
  } else {
    eventsContainer.innerHTML = events.map(ev => {
      const isCancelled = ev.isDeleted === true;

      return `
        <div class="p-3 rounded-lg border-2 shadow-xs ${isCancelled ? 'bg-rose-50/75 border-rose-300 opacity-80' : 'bg-white border-slate-200'}">
          <div class="flex justify-between items-center">
            <span class="px-2 py-0.5 rounded text-[10px] font-black ${isCancelled ? 'bg-rose-200 text-rose-950 border border-rose-400' : 'bg-amber-100 text-amber-950 border border-amber-300'}">
              ${ev.type}
            </span>
            <div class="flex items-center gap-2">
              ${isCancelled ? '<span class="px-1.5 py-0.2 bg-rose-600 text-white rounded text-[9px] font-black uppercase">[CANCELLED]</span>' : ''}
              <span class="text-xs font-mono font-black text-gov-navy ${isCancelled ? 'line-through text-slate-500' : ''}">${formatDate(ev.date)}</span>
            </div>
          </div>
          <p class="text-xs font-bold mt-1.5 ${isCancelled ? 'line-through text-slate-500' : 'text-slate-900'}">${ev.description}</p>
          <div class="mt-2 pt-2 border-t border-slate-200 text-xs font-bold text-slate-600 flex justify-between items-center">
            <span><strong>Order Ref:</strong> ${ev.orderNo} ${isCancelled && ev.cancellationOrderNo ? `<span class="text-rose-800 ml-2 font-black">(Rev: ${ev.cancellationOrderNo})</span>` : ''}</span>
            <span><strong>Attesting Office:</strong> ${ev.authority}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

function selectStationRow(idx) {
  selectedStationIndex = idx;
  const editBtn = document.getElementById('btnEditStationTop');
  const delBtn = document.getElementById('btnDeleteStationTop');

  if (editBtn && delBtn && stations[idx]) {
    editBtn.disabled = false;
    editBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    delBtn.disabled = false;
    delBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
  renderPskListTable();
}

function handleTopEditStation() {
  if (selectedStationIndex === null || !stations[selectedStationIndex]) {
    showToast("Please select an office row first.", "error");
    return;
  }
  requestEditPskModal(selectedStationIndex);
}

function handleTopDeleteStation() {
  if (selectedStationIndex === null || !stations[selectedStationIndex]) {
    showToast("Please select an office row first.", "error");
    return;
  }
  requestDeletePskModal(selectedStationIndex);
}

function renderPskListTable() {
  const tbody = document.getElementById('pskTableBody');
  if (!tbody) return;

  if (stations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-700 font-bold">No passport offices or kendras registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = stations.map((st, idx) => {
    const isSelected = selectedStationIndex === idx;
    let badgeStyle = "bg-blue-100 text-gov-blue border-blue-300";
    if (st.type === "Main Office") {
      badgeStyle = "bg-amber-100 text-amber-950 border-amber-400 font-black";
    } else if (st.type === "POPSK") {
      badgeStyle = "bg-purple-100 text-purple-900 border-purple-300 font-bold";
    }

    return `
      <tr class="hover:bg-blue-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-100 font-semibold' : ''}" onclick="selectStationRow(${idx})">
        <td class="py-3 px-3 text-center">
          <input type="radio" name="stationSelectionRadio" value="${idx}" ${isSelected ? 'checked' : ''} class="h-4 w-4 text-gov-navy focus:ring-gov-navy cursor-pointer">
        </td>
        <td class="py-3 px-3">
          <span class="inline-block px-2 py-0.5 rounded text-[10px] uppercase font-black border ${badgeStyle}">${st.code}</span>
          <div class="text-[11px] text-slate-700 font-bold mt-0.5">${st.type}</div>
        </td>
        <td class="py-3 px-4 font-black text-gov-navy">
          <div>${st.name}</div>
        </td>
        <td class="py-3 px-4 text-slate-900 font-medium leading-relaxed text-xs">
          <div class="flex items-start">
            <i class="fa-solid fa-location-dot text-rose-600 mr-2 mt-0.5 flex-shrink-0 text-xs"></i>
            <span>${st.address}</span>
          </div>
        </td>
        <td class="py-3 px-3 text-slate-800 font-semibold">
          ${st.jurisdiction}
        </td>
        <td class="py-3 px-3 text-center font-black text-slate-900">
          ${st.staff} Staff
        </td>
        <td class="py-3 px-3 text-center">
          <span class="inline-block text-[10px] bg-green-100 text-green-900 px-2.5 py-0.5 rounded-full font-black border border-green-300">
            ${st.status}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function requestOpenPskModal() {
  document.getElementById('pskModalTitle').innerText = "Add Passport Office / Kendra";
  document.getElementById('formPskIndex').value = "-1";
  document.getElementById('pskForm').reset();
  document.getElementById('pskModal').classList.remove('hidden');
}

function requestEditPskModal(idx) {
  const st = stations[idx];
  if (!st) return;

  document.getElementById('pskModalTitle').innerText = `Edit: ${st.name}`;
  document.getElementById('formPskIndex').value = idx;
  document.getElementById('formPskType').value = st.type;
  document.getElementById('formPskCode').value = st.code;
  document.getElementById('formPskName').value = st.name;
  document.getElementById('formPskAddress').value = st.address;
  document.getElementById('formPskJurisdiction').value = st.jurisdiction;
  document.getElementById('formPskStaff').value = st.staff;

  document.getElementById('pskModal').classList.remove('hidden');
}

function closePskModal() {
  document.getElementById('pskModal').classList.add('hidden');
}

function handlePskFormSubmit(e) {
  e.preventDefault();
  const idx = parseInt(document.getElementById('formPskIndex').value, 10);

  const stationData = {
    type: document.getElementById('formPskType').value,
    code: document.getElementById('formPskCode').value.trim(),
    name: document.getElementById('formPskName').value.trim(),
    address: document.getElementById('formPskAddress').value.trim(),
    jurisdiction: document.getElementById('formPskJurisdiction').value.trim(),
    staff: Number(document.getElementById('formPskStaff').value),
    status: "Operational"
  };

  closePskModal();

  if (idx === -1) {
    openSecurityWarningModal('ADD_PSK', stationData, `Are you sure you want to officially commission "${stationData.name}" (${stationData.type}) under Regional Passport Office Delhi jurisdiction?`);
  } else {
    openSecurityWarningModal('EDIT_PSK', { idx, stationData }, `Are you sure you want to modify details, address, or jurisdiction for "${stationData.name}"?`);
  }
}

function requestDeletePskModal(idx) {
  const st = stations[idx];
  if (!st) return;

  openSecurityWarningModal('DELETE_PSK', { idx, name: st.name }, `WARNING: You are requesting the official decommissioning and removal of "${st.name}" (${st.code}).`);
}

async function deleteEmployeeFromSupabase(empIds) {
  try {
    const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    if (client) {
      await client.from('employees').delete().in('id', empIds);
    }
  } catch (err) {
    console.error("Supabase Delete Error:", err);
  }
}
