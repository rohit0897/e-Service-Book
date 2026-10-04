/* Default Initial CPO Staff Dataset with Increment Due populated */
const DEFAULT_EMPLOYEES = [
  {
    id: "CPO-DEL-1001",
    name: "Dr. Arvind K. Saxena",
    dob: "1972-04-14",
    fatherName: "Late Shri Ramesh Chandra Saxena",
    motherName: "Smt. Shanti Devi Saxena",
    designation: "Regional Passport Officer (RPO)",
    group: "Group A",
    payLevel: "Level 12",
    basicPay: 83600,
    doj: "2014-06-16",
    dor: "2032-04-30",
    incrementDue: "01 Jul 2027",
    phone: "9811002233",
    email: "arvind.saxena@mea.gov.in",
    password: "pass123",
    events: [
      {
        id: "EVT-1001-1",
        date: "2024-07-01",
        type: "Annual Increment",
        orderNo: "MEA/RPO-D/INC/2024/09",
        description: "Granted annual increment raising basic pay from 81,200 to 83,600 in Level 12.",
        authority: "Joint Secretary (PSP) & CPO, MEA"
      },
      {
        id: "EVT-1001-2",
        date: "2025-03-31",
        type: "Service Verification",
        orderNo: "RPO/DEL/ESTT/VERIF/2025",
        description: "Annual verification of service completed and certified under GFR rules.",
        authority: "Head of Office, RPO Delhi"
      }
    ],
    leaveLedger: [
      { id: "LV-1001-1", date: "2026-01-01", action: "Credit", type: "EL", days: 30, orderNo: "Advance Credit 2026", period: "2026" },
      { id: "LV-1001-2", date: "2026-01-01", action: "Credit", type: "HPL", days: 20, orderNo: "Advance Credit 2026", period: "2026" },
      { id: "LV-1001-3", date: "2026-01-01", action: "Credit", type: "CCL", days: 15, orderNo: "Opening Balance", period: "2026" },
      { id: "LV-1001-4", date: "2026-02-10", action: "Debit", type: "EL", days: 4, orderNo: "RPO/Leave/2026/04", period: "10-Feb-2026 to 13-Feb-2026" }
    ]
  },
  {
    id: "CPO-DEL-1014",
    name: "Mohan Lal Sharma",
    dob: "1976-11-05",
    fatherName: "Shri K. L. Sharma",
    motherName: "Smt. Pushpa Sharma",
    designation: "Deputy Passport Officer (DPO)",
    group: "Group A",
    payLevel: "Level 11",
    basicPay: 69700,
    doj: "2015-11-20",
    dor: "2036-11-30",
    incrementDue: "01 Jan 2027",
    phone: "9910293847",
    email: "ml.sharma@mea.gov.in",
    password: "pass123",
    events: [],
    leaveLedger: [
      { id: "LV-1014-1", date: "2026-01-01", action: "Credit", type: "EL", days: 25, orderNo: "Balance Credit", period: "2026" },
      { id: "LV-1014-2", date: "2026-01-01", action: "Credit", type: "HPL", days: 15, orderNo: "Balance Credit", period: "2026" },
      { id: "LV-1014-3", date: "2026-01-01", action: "Credit", type: "CCL", days: 10, orderNo: "Balance Credit", period: "2026" }
    ]
  },
  {
    id: "CPO-DEL-1025",
    name: "Pooja Malhotra",
    dob: "1985-01-15",
    fatherName: "Shri R. N. Malhotra",
    motherName: "Smt. Saroj Malhotra",
    designation: "Assistant Passport Officer (APO)",
    group: "Group B (Gazetted)",
    payLevel: "Level 10",
    basicPay: 57800,
    doj: "2017-03-12",
    dor: "2045-01-31",
    incrementDue: "01 Jul 2027",
    phone: "9818273645",
    email: "pooja.malhotra@mea.gov.in",
    password: "pass123",
    events: [],
    leaveLedger: [
      { id: "LV-1025-1", date: "2026-01-01", action: "Credit", type: "EL", days: 18, orderNo: "Balance Credit", period: "2026" },
      { id: "LV-1025-2", date: "2026-01-01", action: "Credit", type: "HPL", days: 12, orderNo: "Balance Credit", period: "2026" },
      { id: "LV-1025-3", date: "2026-01-01", action: "Credit", type: "CCL", days: 20, orderNo: "Opening Credit", period: "2026" }
    ]
  }
];

/* Default Stations */
const DEFAULT_STATIONS = [
  {
    type: "Main Office",
    code: "RPO HQ",
    name: "RPO Delhi (HQ Bhikaji Cama)",
    address: "Hudco Trikoot-3, Bhikaji Cama Place, R.K. Puram, New Delhi - 110066",
    jurisdiction: "All NCT Delhi & Extended Regional Jurisdiction",
    staff: 45,
    status: "Operational"
  },
  {
    type: "PSK",
    code: "PSK 01",
    name: "PSK Herald House (ITO)",
    address: "Herald House, 5A, Bahadur Shah Zafar Marg, New Delhi - 110002",
    jurisdiction: "Central & East Delhi",
    staff: 18,
    status: "Operational"
  },
  {
    type: "PSK",
    code: "PSK 02",
    name: "PSK Shalimar Place",
    address: "Aggarwal Auto Mall, Shalimar Place, Outer Ring Road, Delhi - 110088",
    jurisdiction: "North & West Delhi",
    staff: 22,
    status: "Operational"
  },
  {
    type: "PSK",
    code: "PSK 04",
    name: "PSK Gurugram",
    address: "Udyog Vihar Phase 4, Gurugram, Haryana - 122016",
    jurisdiction: "Gurugram & Faridabad NCR",
    staff: 16,
    status: "Operational"
  },
  {
    type: "POPSK",
    code: "POPSK 01",
    name: "POPSK Delhi Cantt",
    address: "Delhi Cantt Head Post Office, Sadar Bazar, Delhi Cantt - 110010",
    jurisdiction: "Cantonment & Surrounds",
    staff: 6,
    status: "Operational"
  }
];