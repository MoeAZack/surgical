export interface TranslationSchema {
  // Global & Sidebar
  appTitle: string;
  practiceMgmt: string;
  loggedInAs: string;
  toastSuccess: string;
  toastError: string;
  addCaseBtn: string;
  langToggle: string;
  
  // Tabs
  tabDashboard: string;
  tabOpsLog: string;
  tabCalendar: string;
  tabDrains: string;
  tabComplications: string;
  tabFollowUps: string;
  tabSettings: string;
  
  // Dashboard / Today's Shift
  dashTitle: string;
  dashSub: string;
  shiftView: string;
  analyticsView: string;
  totalCases: string;
  drainsInSitu: string;
  openComps: string;
  fuDue: string;
  appts7d: string;
  successRate: string;
  drainsInSituBoard: string;
  upcomingVisitsBoard: string;
  fuOverdueBoard: string;
  activeDrain: string;
  days: string;
  successByProcTitle: string;
  procCol: string;
  casesCol: string;
  compsCol: string;
  outcomeCol: string;
  pendingMilestones: string;
  
  // Today's Shift View
  todayShiftTitle: string;
  todayShiftSub: string;
  todayAppts: string;
  noApptsToday: string;
  drainsNeedAttention: string;
  noDrainsAlert: string;
  overdueTasks: string;
  noOverdueTasks: string;
  pwaTitle: string;
  pwaBody: string;
  completeBtn: string;
  printShiftSheet: string;
  
  // Surgeon Stats / Reports
  surgeonStatsTitle: string;
  surgeonCol: string;
  complicationRateCol: string;
  monthlySummaryReportBtn: string;
  noSurgeonStats: string;
  monthlySummaryModalTitle: string;
  monthlySummaryModalSub: string;
  printReportBtn: string;
  closeBtn: string;
  
  // Operations Log & Filters
  opsLogTitle: string;
  opsLogSub: string;
  surgicalRecords: string;
  searchPlaceholder: string;
  showFilters: string;
  hideFilters: string;
  allSurgeons: string;
  allProcedures: string;
  allOutcomes: string;
  allDrains: string;
  surgeonFilter: string;
  procedureFilter: string;
  outcomeFilter: string;
  drainFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  noRecordsFound: string;
  actionsCol: string;
  ageCol: string;
  dateCol: string;
  checklistCol: string;
  drainCol: string;
  outcomeLabel: string;
  
  // New Case Form
  newCaseTitle: string;
  newCaseSub: string;
  formIntakeTitle: string;
  patientId: string;
  patientIdPlaceholder: string;
  ageYears: string;
  agePlaceholder: string;
  operationDate: string;
  procedureLabel: string;
  surgeonLabel: string;
  drainPlacedLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
  saveCaseBtn: string;
  savingCase: string;
  
  // Patient Timeline Drawer & Inline Comp
  patientTimeline: string;
  ageText: string;
  operatedText: string;
  surgeonText: string;
  editCaseBtn: string;
  photosBtn: string;
  prePostChecklist: string;
  clinicVisits: string;
  noApptsBooked: string;
  activeDrainTracking: string;
  placedDate: string;
  removalStatus: string;
  removedOn: string;
  inSituText: string;
  totalDaysInSitu: string;
  noDrainsReported: string;
  loggedCompsTitle: string;
  noCompsLogged: string;
  milestoneReview: string;
  milestoneDue: string;
  milestoneOverdue: string;
  finalOutcomeStatus: string;
  clinicalNotes: string;
  quickAddComp: string;
  compType: string;
  gradeLabel: string;
  dateDetectedLabel: string;
  managementLabel: string;
  managementPlaceholder: string;
  submitBtn: string;
  cancelBtn: string;
  
  // Chained Actions Dialog
  chainWoundCheckTitle: string;
  chainWoundCheckBody: string;
  chainFollowUpTitle: string;
  chainFollowUpBody: string;
  chainRemoveDrainTitle: string;
  chainRemoveDrainBody: string;
  confirmBtn: string;
  dismissBtn: string;
  
  // Audit Logs
  auditLogTitle: string;
  auditLogSub: string;
  timestampCol: string;
  userCol: string;
  actionCol: string;
  detailsCol: string;
  searchAuditPlaceholder: string;

  // New Drafts, Validation, Pagination, and WhatsApp Keys
  tabDraftsQueue: string;
  saveAsDraftBtn: string;
  draftSavedSuccess: string;
  draftSubmittedSuccess: string;
  submitAllDraftsBtn: string;
  noDraftsMessage: string;
  deleteDraftBtn: string;
  editDraftTitle: string;
  validationErrorHeader: string;
  whatsappReminderBtn: string;
  whatsappPatientTemplate: string;
  whatsappDocTemplate: string;
  whatsappModalTitle: string;
  whatsappModalSub: string;
  whatsappSendBtn: string;
  prevPageBtn: string;
  nextPageBtn: string;
  pageOfText: string;
  showRowsLabel: string;
}

export const translations: Record<"en" | "ar", TranslationSchema> = {
  en: {
    appTitle: "Case Tracker",
    practiceMgmt: "Practice Management",
    loggedInAs: "Logged In As",
    toastSuccess: "Operational changes saved successfully! ✓",
    toastError: "Error loading database:",
    addCaseBtn: "New Case Intake",
    langToggle: "العربية (Arabic)",
    
    tabDashboard: "Dashboard",
    tabOpsLog: "Operations Log",
    tabCalendar: "Appointments Calendar",
    tabDrains: "Drainage Tracking",
    tabComplications: "Complications Registry",
    tabFollowUps: "Follow-up Milestones",
    tabSettings: "System Settings",
    
    dashTitle: "Practice Dashboard",
    dashSub: "Live metrics and actions — calculated from safe cloud-synced database.",
    shiftView: "Shift View (Today)",
    analyticsView: "Analytics (Month)",
    totalCases: "Total Cases",
    drainsInSitu: "Drains In Situ",
    openComps: "Open Complications",
    fuDue: "F/Ups Due",
    appts7d: "Appts (7d)",
    successRate: "Success Rate",
    drainsInSituBoard: "Drains Still In Situ",
    upcomingVisitsBoard: "Upcoming Visits (7d)",
    fuOverdueBoard: "Follow-ups Due & Overdue",
    activeDrain: "active drain",
    days: "days",
    successByProcTitle: "Practice Success by Procedure",
    procCol: "Procedure",
    casesCol: "Total Cases",
    compsCol: "Logged Complications",
    outcomeCol: "Resolved Success Rate",
    pendingMilestones: "pending milestones",
    
    todayShiftTitle: "Today's Clinical Shift",
    todayShiftSub: "Actionable focus panel for today's visits, critical drains, and urgent checklist tasks.",
    todayAppts: "Today's Scheduled Visits",
    noApptsToday: "No clinic visits scheduled for today.",
    drainsNeedAttention: "Active Drains (Threshold Warning)",
    noDrainsAlert: "No active drains exceed the warning period today. ✓",
    overdueTasks: "Pending Practice Alerts",
    noOverdueTasks: "Excellent! No overdue patient events currently require attention. ✓",
    pwaTitle: "Instant Mobile Access",
    pwaBody: "Tap 'Add to Home Screen' in Safari or Chrome on your mobile device. The applet will load with a native icon and launch in full-screen immersion without address bars.",
    completeBtn: "Mark Done",
    printShiftSheet: "Print Shift Sheet",
    
    surgeonStatsTitle: "Surgeon Success & Outcomes",
    surgeonCol: "Surgeon",
    complicationRateCol: "Complication Rate",
    monthlySummaryReportBtn: "Print Practice Summary Report",
    noSurgeonStats: "No operational cases recorded to compile surgeon analytics.",
    monthlySummaryModalTitle: "Surgical Outcomes & Clinical Performance Summary",
    monthlySummaryModalSub: "Practice leadership report — Compiled from real-time database inputs.",
    printReportBtn: "Print Document",
    closeBtn: "Close",
    
    opsLogTitle: "Operations Log",
    opsLogSub: "Tap a patient ID to view history, checklist, appointments, and full record logs.",
    surgicalRecords: "Surgical Records",
    searchPlaceholder: "Search ID, procedure, surgeon...",
    showFilters: "Show Advanced Filters",
    hideFilters: "Hide Filters",
    allSurgeons: "All Surgeons",
    allProcedures: "All Procedures",
    allOutcomes: "All Outcomes",
    allDrains: "All Drains",
    surgeonFilter: "Surgeon Filter",
    procedureFilter: "Procedure Filter",
    outcomeFilter: "Outcome Status",
    drainFilter: "Drain Status",
    dateFromFilter: "From Date",
    dateToFilter: "To Date",
    noRecordsFound: "No surgical records match your filter criteria.",
    actionsCol: "Actions",
    ageCol: "Age",
    dateCol: "Date",
    checklistCol: "Checklist",
    drainCol: "Drain",
    outcomeLabel: "Outcome",
    
    newCaseTitle: "New Surgical Case",
    newCaseSub: "Saves a validated record to the operations database and instantly initializes follow-up milestones.",
    formIntakeTitle: "Operational Intake Form",
    patientId: "Patient ID",
    patientIdPlaceholder: "e.g. PS-0142",
    ageYears: "Age (Years)",
    agePlaceholder: "e.g. 34",
    operationDate: "Operation Date",
    procedureLabel: "Surgical Procedure",
    surgeonLabel: "Surgeon",
    drainPlacedLabel: "Drain Placed",
    notesLabel: "Notes (Optional)",
    notesPlaceholder: "e.g. Suture types, implant sizes, intra-operative details...",
    saveCaseBtn: "Save Surgical Case",
    savingCase: "Saving record...",
    
    patientTimeline: "Patient Timeline",
    ageText: "Age",
    operatedText: "Operated",
    surgeonText: "Surgeon",
    editCaseBtn: "Edit Case",
    photosBtn: "Patient Photos",
    prePostChecklist: "Pre & Post-op Checklist",
    clinicVisits: "Scheduled Clinic Visits",
    noApptsBooked: "No short-term appointments booked.",
    activeDrainTracking: "Active Drain Tracking",
    placedDate: "Placed Date",
    removalStatus: "Removal Status",
    removedOn: "Removed on",
    inSituText: "In situ",
    totalDaysInSitu: "Total days in situ",
    noDrainsReported: "No drainage placement reported.",
    loggedCompsTitle: "Logged Complications",
    noCompsLogged: "No complication events registered. ✓",
    milestoneReview: "Milestone Review Records",
    milestoneDue: "Due",
    milestoneOverdue: "Overdue",
    finalOutcomeStatus: "Final Outcome Status",
    clinicalNotes: "Clinical Notes",
    quickAddComp: "Log Complication Directly",
    compType: "Complication",
    gradeLabel: "Clavien Grade",
    dateDetectedLabel: "Date Detected",
    managementLabel: "Management Detail",
    managementPlaceholder: "e.g. Bedside aspiration, antibiotics...",
    submitBtn: "Log Event",
    cancelBtn: "Cancel",
    
    chainWoundCheckTitle: "Schedule Wound Check?",
    chainWoundCheckBody: "Operation successfully saved. Would you like to automatically schedule a wound check appointment 5 days out?",
    chainFollowUpTitle: "Schedule Follow-up Visit?",
    chainFollowUpBody: "Drain successfully marked as removed. Would you like to schedule a 1-week follow-up appointment?",
    chainRemoveDrainTitle: "Mark Drain Removed?",
    chainRemoveDrainBody: "Appointment marked as Done. Would you like to automatically record the drain as removed today?",
    confirmBtn: "Confirm",
    dismissBtn: "Dismiss",
    
    auditLogTitle: "Practice Audit Logs",
    auditLogSub: "Silent cryptographic log mapping clinical record edits, deletions, and creations for medical compliance.",
    timestampCol: "Timestamp",
    userCol: "User",
    actionCol: "Action",
    detailsCol: "Details",
    searchAuditPlaceholder: "Search audit logs by patient ID, user, or action...",

    // New Drafts, Validation, Pagination, and WhatsApp Keys (EN)
    tabDraftsQueue: "Drafts Hub",
    saveAsDraftBtn: "Save as Draft",
    draftSavedSuccess: "Case saved to local drafts successfully! ✓",
    draftSubmittedSuccess: "Draft submitted to the case database successfully! ✓",
    submitAllDraftsBtn: "Sync All Drafts",
    noDraftsMessage: "No drafts in your clinical queue. Ready for offline or quick intakes! ✓",
    deleteDraftBtn: "Discard Draft",
    editDraftTitle: "Edit Case Draft",
    validationErrorHeader: "Please resolve clinical warnings before saving:",
    whatsappReminderBtn: "WhatsApp Reminder",
    whatsappPatientTemplate: "Dear [PATIENT], this is a polite reminder from Dr. [SURGEON]'s clinic regarding your recent [PROCEDURE] follow-up status.",
    whatsappDocTemplate: "Dear Doctor, patient [PATIENT] has an active alert requiring clinical review: [DETAILS].",
    whatsappModalTitle: "Compose WhatsApp Reminder",
    whatsappModalSub: "Directly notify the patient or senior clinical supervisor with secure, pre-filled operational templates.",
    whatsappSendBtn: "Launch WhatsApp Web",
    prevPageBtn: "Previous",
    nextPageBtn: "Next",
    pageOfText: "Page",
    showRowsLabel: "Rows per page"
  },
  ar: {
    appTitle: "متابع الحالات الجراحية",
    practiceMgmt: "إدارة العيادة والممارسات",
    loggedInAs: "تم الدخول باسم",
    toastSuccess: "تم حفظ التغييرات التشغيلية بنجاح! ✓",
    toastError: "خطأ في تحميل قاعدة البيانات:",
    addCaseBtn: "إدخال حالة جديدة",
    langToggle: "English (الإنجليزية)",
    
    tabDashboard: "لوحة التحكم",
    tabOpsLog: "سجل العمليات",
    tabCalendar: "جدول المواعيد",
    tabDrains: "متابعة الأنابيب",
    tabComplications: "سجل المضاعفات",
    tabFollowUps: "مراحل المتابعة",
    tabSettings: "إعدادات النظام",
    
    dashTitle: "لوحة تحكم العيادة",
    dashSub: "المؤشرات المباشرة والإجراءات المتاحة — يتم احتسابها من قاعدة بيانات سحابية آمنة.",
    shiftView: "وردية اليوم (الشفت)",
    analyticsView: "التحليلات (الشهر)",
    totalCases: "إجمالي الحالات",
    drainsInSitu: "الأنابيب النشطة",
    openComps: "مضاعفات مفتوحة",
    fuDue: "متابعات مستحقة",
    appts7d: "مواعيد (٧ أيام)",
    successRate: "نسبة النجاح",
    drainsInSituBoard: "الأنابيب التي لا تزال نشطة",
    upcomingVisitsBoard: "الزيارات القادمة (٧ أيام)",
    fuOverdueBoard: "المتابعات المستحقة والمتأخرة",
    activeDrain: "أنبوب نشط",
    days: "أيام",
    successByProcTitle: "نسب النجاح حسب الإجراء الجراحي",
    procCol: "الإجراء",
    casesCol: "إجمالي الحالات",
    compsCol: "المضاعفات المسجلة",
    outcomeCol: "نسبة النجاح بعد الحل",
    pendingMilestones: "في انتظار المتابعات",
    
    todayShiftTitle: "وردية العمل السريري اليوم",
    todayShiftSub: "لوحة تركيز تفاعلية لزيارات اليوم، الأنابيب الحرجة، والمهام العاجلة للمرضى.",
    todayAppts: "مواعيد الزيارات المجدولة اليوم",
    noApptsToday: "لا توجد زيارات مجدولة في العيادة اليوم.",
    drainsNeedAttention: "الأنابيب النشطة (تجاوزت حد التحذير)",
    noDrainsAlert: "لا توجد أنابيب نشطة تجاوزت فترة التحذير اليوم. ✓",
    overdueTasks: "تنبيهات جراحية معلقة",
    noOverdueTasks: "ممتاز! لا توجد تنبيهات متأخرة تتطلب المتابعة العاجلة حالياً. ✓",
    pwaTitle: "دخول سريع من الجوال",
    pwaBody: "انقر على 'إضافة إلى الشاشة الرئيسية' في متصفح سفاري أو كروم على هاتفك المحمول. سيتم تحميل التطبيق بأيقونة مخصصة ويفتح بملء الشاشة بدون أشرطة العناوين.",
    completeBtn: "إتمام الزيارة",
    printShiftSheet: "طباعة ورقة الوردية",
    
    surgeonStatsTitle: "نجاح الجراحين والنتائج",
    surgeonCol: "الجراح",
    complicationRateCol: "معدل المضاعفات",
    monthlySummaryReportBtn: "طباعة التقرير الشهري للعيادة",
    noSurgeonStats: "لا توجد حالات جراحية مسجلة لتجميع تحليلات الجراحين.",
    monthlySummaryModalTitle: "ملخص النتائج الجراحية والأداء السريري",
    monthlySummaryModalSub: "تقرير القيادة وإدارة العيادة — مجمع من مدخلات قاعدة البيانات في الوقت الفعلي.",
    printReportBtn: "طباعة التقرير",
    closeBtn: "إغلاق",
    
    opsLogTitle: "سجل العمليات",
    opsLogSub: "انقر فوق معرف المريض لعرض السجل الزمني وقائمة المهام والمواعيد والملف الكامل.",
    surgicalRecords: "السجلات الجراحية",
    searchPlaceholder: "بحث عن مريض، إجراء، جراح...",
    showFilters: "عرض الفلاتر المتقدمة",
    hideFilters: "إخفاء الفلاتر",
    allSurgeons: "كل الجراحين",
    allProcedures: "كل الإجراءات",
    allOutcomes: "كل النتائج",
    allDrains: "كل حالات الأنابيب",
    surgeonFilter: "فلتر الجراح",
    procedureFilter: "فلتر الإجراء",
    outcomeFilter: "حالة النتيجة",
    drainFilter: "حالة الأنبوب",
    dateFromFilter: "من تاريخ",
    dateToFilter: "إلى تاريخ",
    noRecordsFound: "لا توجد سجلات جراحية تطابق معايير الفلترة الخاصة بك.",
    actionsCol: "الإجراءات",
    ageCol: "العمر",
    dateCol: "التاريخ",
    checklistCol: "القائمة",
    drainCol: "الأنبوب",
    outcomeLabel: "النتيجة",
    
    newCaseTitle: "حالة جراحية جديدة",
    newCaseSub: "يحفظ سجلاً معتمداً في قاعدة بيانات العمليات ويبدأ فوراً تفعيل مراحل المتابعة المستقبلية.",
    formIntakeTitle: "استمارة إدخال بيانات جراحية",
    patientId: "معرف المريض",
    patientIdPlaceholder: "مثال: PS-0142",
    ageYears: "العمر (سنوات)",
    agePlaceholder: "مثال: ٣٤",
    operationDate: "تاريخ العملية",
    procedureLabel: "الإجراء الجراحي",
    surgeonLabel: "الجراح",
    drainPlacedLabel: "تم وضع أنبوب تصريف",
    notesLabel: "ملاحظات سريرية (اختياري)",
    notesPlaceholder: "مثال: أنواع الخيوط، مقاسات الغرسات، تفاصيل العملية الجراحية...",
    saveCaseBtn: "حفظ الحالة الجراحية",
    savingCase: "جاري حفظ السجل...",
    
    patientTimeline: "السجل الزمني للمريض",
    ageText: "العمر",
    operatedText: "تاريخ الجراحة",
    surgeonText: "الجراح المبشر",
    editCaseBtn: "تعديل الحالة",
    photosBtn: "صور الحالة",
    prePostChecklist: "قائمة فحص ما قبل وما بعد الجراحة",
    clinicVisits: "الزيارات المجدولة في العيادة",
    noApptsBooked: "لا توجد مواعيد قريبة محجوزة.",
    activeDrainTracking: "متابعة أنبوب التصريف النشط",
    placedDate: "تاريخ الوضع",
    removalStatus: "حالة الإزالة",
    removedOn: "تمت الإزالة في",
    inSituText: "نشط في مكانه",
    totalDaysInSitu: "إجمالي أيام النشاط",
    noDrainsReported: "لم يتم الإبلاغ عن وضع أنبوب تصريف.",
    loggedCompsTitle: "المضاعفات المسجلة",
    noCompsLogged: "لم يتم تسجيل أي مضاعفات لهذه الحالة. ✓",
    milestoneReview: "سجلات مراجعة المعالم والمتابعات",
    milestoneDue: "مستحق",
    milestoneOverdue: "متأخر",
    finalOutcomeStatus: "حالة النتيجة النهائية",
    clinicalNotes: "الملاحظات السريرية",
    quickAddComp: "تسجيل مضاعفة مباشرة للغرفة",
    compType: "المضاعفة",
    gradeLabel: "تصنيف كلافين",
    dateDetectedLabel: "تاريخ الاكتشاف",
    managementLabel: "طريقة التعامل والعلاج",
    managementPlaceholder: "مثال: سحب في العيادة، مضادات حيوية...",
    submitBtn: "تسجيل الحدث",
    cancelBtn: "إلغاء",
    
    chainWoundCheckTitle: "هل ترغب في جدولة مراجعة الجرح؟",
    chainWoundCheckBody: "تم حفظ العملية بنجاح. هل ترغب في جدولة موعد تلقائي لمراجعة الجرح بعد 5 أيام؟",
    chainFollowUpTitle: "جدولة موعد متابعة؟",
    chainFollowUpBody: "تم تسجيل إزالة أنبوب التصريف بنجاح. هل ترغب في جدولة موعد متابعة بعد أسبوع؟",
    chainRemoveDrainTitle: "تسجيل إزالة أنبوب التصريف؟",
    chainRemoveDrainBody: "تم وضع علامة 'مكتمل' على موعد العيادة. هل ترغب في تسجيل إزالة أنبوب التصريف تلقائياً اليوم؟",
    confirmBtn: "تأكيد",
    dismissBtn: "تخطي",
    
    auditLogTitle: "سجل التدقيق والمراقبة الطبي",
    auditLogSub: "سجل صامت آمن يتتبع عمليات إضافة وتعديل وحذف السجلات الطبية للامتثال للمعايير الطبية الموثوقة.",
    timestampCol: "التاريخ والوقت",
    userCol: "المستخدم",
    actionCol: "الإجراء",
    detailsCol: "التفاصيل",
    searchAuditPlaceholder: "البحث في سجل التدقيق والمراقبة...",

    // New Drafts, Validation, Pagination, and WhatsApp Keys (AR)
    tabDraftsQueue: "مركز المسودات",
    saveAsDraftBtn: "حفظ كمسودة",
    draftSavedSuccess: "تم حفظ الحالة في المسودات المحلية بنجاح! ✓",
    draftSubmittedSuccess: "تم إرسال المسودة إلى قاعدة بيانات الحالات بنجاح! ✓",
    submitAllDraftsBtn: "مزامنة جميع المسودات",
    noDraftsMessage: "لا توجد مسودات في قائمتك السريرية حالياً. جاهز للإدخال السريع أو دون اتصال! ✓",
    deleteDraftBtn: "حذف المسودة",
    editDraftTitle: "تعديل مسودة الحالة",
    validationErrorHeader: "يرجى حل التنبيهات السريرية التالية قبل الحفظ:",
    whatsappReminderBtn: "تذكير واتساب",
    whatsappPatientTemplate: "عزيزي [PATIENT]، نود تذكيرك بموعد أو حالة متابعة [PROCEDURE] مع عيادة الدكتور [SURGEON]. دمتم بصحة وعافية.",
    whatsappDocTemplate: "عزيزي الدكتور، هناك تنبيه سريري نشط للمريض [PATIENT] يتطلب المراجعة: [DETAILS].",
    whatsappModalTitle: "إنشاء تذكير واتساب",
    whatsappModalSub: "أرسل إشعاراً عاجلاً للمريض أو الطبيب المسؤول عبر قوالب طبية آمنة وجاهزة.",
    whatsappSendBtn: "فتح واتساب ويب",
    prevPageBtn: "السابق",
    nextPageBtn: "التالي",
    pageOfText: "صفحة",
    showRowsLabel: "الصفوف في الصفحة"
  }
};
