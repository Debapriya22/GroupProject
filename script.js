/* =========================================================
   CAMPUSCONNECT - STUDENT MANAGEMENT DASHBOARD
   SQL DATA + 6 SEMESTER SGPA LINE GRAPH + CGPA
   SUBJECT-WISE ATTENDANCE COMPARISON GRAPH
========================================================= */

"use strict";

/* ======================== CONFIGURATION ======================== */

const STORAGE_KEY = "campusconnect_students";
const MIN_ATTENDANCE = 75;

const SUBJECTS = [
    "Java Programming",
    "Statistical Mathematics",
    "Operating Systems",
    "RDBMS",
    "Computer Networks"
];

const SEMESTERS = [
    "Semester 1",
    "Semester 2",
    "Semester 3",
    "Semester 4",
    "Semester 5",
    "Semester 6"
];

const DEMO_SEMESTER_SGPA = [
    7.12, 6.23, 8.78, 9.25, 9.89, 8.65
];

const PAGE_TITLES = {
    dashboard: "Dashboard Overview",
    academics: "Academic Performance",
    attendance: "Attendance Overview",
    assignments: "Pending Assignments",
    faculty: "Faculty Panel"
};

const SQL_USERS = [
    {
        loginId: "rahul",
        role: "STUDENT",
        studentId: "MCA2026001"
    }
];

let students = [];
let currentRole = "student";
let currentModalType = null;
let editingStudentId = null;

/* ======================== SQL DATABASE DATA ======================== */

const sampleStudents = [
    {
        id: "MCA2026001",
        name: "Rahul Sharma",
        email: "rahul@gmail.com",
        course: "MCA",
        semester: 1,
        department: "MCA",
        year: "1st Year",
        degree: "MCA",
        batch: "2026",
        status: "Active",

        assessments: {
            "Java Programming": 85,
            "Statistical Mathematics": 78,
            "Operating Systems": 82,
            "RDBMS": 91,
            "Computer Networks": 74
        },

        courseAttendance: {
            "Java Programming": { attended: 40, total: 45 },
            "Statistical Mathematics": { attended: 35, total: 40 },
            "Operating Systems": { attended: 42, total: 50 },
            "RDBMS": { attended: 36, total: 45 },
            "Computer Networks": { attended: 32, total: 40 }
        },

        semesterSGPA: [...DEMO_SEMESTER_SGPA],
        attendanceRecords: []
    }
];

/* ======================== ASSIGNMENTS ======================== */

const assignments = [
    {
        title: "Java Programming Assignment",
        subject: "Java Programming",
        dueDate: "2026-12-05",
        description: "Complete the Java programming exercises."
    },
    {
        title: "Statistical Mathematics Assignment",
        subject: "Statistical Mathematics",
        dueDate: "2026-12-08",
        description: "Complete the statistical mathematics problems."
    },
    {
        title: "Operating Systems Assignment",
        subject: "Operating Systems",
        dueDate: "2026-12-12",
        description: "Complete the operating systems assignment."
    },
    {
        title: "RDBMS Assignment",
        subject: "RDBMS",
        dueDate: "2026-12-15",
        description: "Prepare SQL queries and database exercises."
    },
    {
        title: "Computer Networks Assignment",
        subject: "Computer Networks",
        dueDate: "2026-12-18",
        description: "Complete the computer networks exercises."
    }
];

/* ======================== DOM HELPERS ======================== */

const $ = selector => document.querySelector(selector);
const getElement = id => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function initials(name) {
    return String(name || "Student")
        .trim()
        .split(/\s+/)
        .map(part => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function average(values) {
    const valid = values
        .map(Number)
        .filter(Number.isFinite);

    if (!valid.length) return 0;

    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatPercentage(value) {
    return `${Number(value || 0).toFixed(1)}%`;
}

function today() {
    const date = new Date();

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

/* ======================== DATA NORMALIZATION ======================== */

function createDefaultStudent(student = {}) {
    const normalized = {
        ...student,

        id: String(student.id || ""),
        name: String(student.name || "Student"),
        email: String(student.email || ""),
        course: String(student.course || "MCA"),
        semester: Number(student.semester) || 1,

        department: String(student.department || student.course || "MCA"),
        year: String(student.year || "1st Year"),
        degree: String(student.degree || student.course || "MCA"),
        batch: String(student.batch || "2026"),
        status: student.status || "Active",

        assessments:
            student.assessments && typeof student.assessments === "object"
                ? { ...student.assessments }
                : {},

        courseAttendance:
            student.courseAttendance && typeof student.courseAttendance === "object"
                ? { ...student.courseAttendance }
                : {},

        attendanceRecords: Array.isArray(student.attendanceRecords)
            ? student.attendanceRecords
            : [],

        semesterSGPA: Array.isArray(student.semesterSGPA)
            ? [...student.semesterSGPA]
            : []
    };

    SUBJECTS.forEach(subject => {
        if (normalized.assessments[subject] === undefined) {
            normalized.assessments[subject] = 0;
        }

        const course = normalized.courseAttendance[subject];

        if (!course || typeof course !== "object") {
            normalized.courseAttendance[subject] = {
                attended: 0,
                total: 0
            };
        } else {
            normalized.courseAttendance[subject] = {
                attended: Math.max(0, Number(course.attended) || 0),
                total: Math.max(0, Number(course.total) || 0)
            };
        }
    });

    normalized.semesterSGPA = Array.from(
        { length: 6 },
        (_, index) => {
            const value = normalized.semesterSGPA[index];

            if (value === null || value === undefined || value === "") {
                return null;
            }

            const number = Number(value);

            return Number.isFinite(number) && number >= 0 && number <= 10
                ? number
                : null;
        }
    );

    return normalized;
}

/* ======================== LOAD / SAVE DATABASE ======================== */

function loadStudents() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved !== null) {
            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed) && parsed.length > 0) {
                students = parsed.map(createDefaultStudent);

                let rahul = students.find(
                    student => student.id === "MCA2026001"
                );

                if (!rahul) {
                    rahul = createDefaultStudent(sampleStudents[0]);
                    students.push(rahul);
                }

                if (getValidSGPAValues(rahul).length === 0) {
                    rahul.semesterSGPA = [...DEMO_SEMESTER_SGPA];
                }

                saveStudents();
                return;
            }
        }
    } catch (error) {
        console.error("Unable to load student data:", error);
    }

    students = sampleStudents.map(createDefaultStudent);
    saveStudents();
}

function saveStudents() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    } catch (error) {
        console.error("Unable to save student data:", error);
        showToast("Unable to save data in this browser.", "error");
    }
}

/* ======================== STUDENT CALCULATIONS ======================== */

function getStudentById(id) {
    return students.find(student => student.id === id);
}

function getCurrentStudent() {
    const loggedInUser = getSQLUser("rahul");

    if (loggedInUser) {
        const student = getStudentById(loggedInUser.studentId);
        if (student) return student;
    }

    return students[0] || null;
}

function getStudentMarks(student, subject) {
    return Number(student?.assessments?.[subject]) || 0;
}

function getAverageMarks(student) {
    if (!student) return 0;

    return average(
        SUBJECTS.map(subject => getStudentMarks(student, subject))
    );
}

function getValidSGPAValues(student) {
    if (!student || !Array.isArray(student.semesterSGPA)) {
        return [];
    }

    return student.semesterSGPA
        .filter(value =>
            value !== null &&
            value !== undefined &&
            value !== ""
        )
        .map(Number)
        .filter(value =>
            Number.isFinite(value) &&
            value >= 0 &&
            value <= 10
        );
}

function getCurrentCGPA(student) {
    const validSGPA = getValidSGPAValues(student);

    if (!validSGPA.length) return null;

    const total = validSGPA.reduce(
        (sum, value) => sum + value,
        0
    );

    return total / validSGPA.length;
}

function getSubjectAttendance(student, subject) {
    const record = student?.courseAttendance?.[subject] || {
        attended: 0,
        total: 0
    };

    const attended = Math.max(0, Number(record.attended) || 0);
    const total = Math.max(0, Number(record.total) || 0);

    return {
        attended,
        total,
        percentage: total > 0 ? (attended / total) * 100 : 0
    };
}

function getOverallAttendance(student) {
    if (!student) return 0;

    let attended = 0;
    let total = 0;

    SUBJECTS.forEach(subject => {
        const record = getSubjectAttendance(student, subject);
        attended += record.attended;
        total += record.total;
    });

    return total > 0 ? (attended / total) * 100 : 0;
}

/* ======================== TOAST NOTIFICATIONS ======================== */

function showToast(message, type = "success") {
    const container = getElement("toastContainer");

    if (!container) {
        console.log(message);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ======================== USER PROFILE AND ROLE ======================== */

function updateUserInformation() {
    const student = getCurrentStudent();

    const name = currentRole === "faculty"
        ? "Faculty Member"
        : student?.name || "Student";

    const role = currentRole === "faculty"
        ? "Faculty Account"
        : "Student Account";

    const avatar = currentRole === "faculty" ? "F" : initials(name);

    ["sidebarUserName", "topbarUserName"].forEach(id => {
        const element = getElement(id);
        if (element) element.textContent = name;
    });

    ["sidebarUserRole", "topbarUserRole"].forEach(id => {
        const element = getElement(id);
        if (element) element.textContent = role;
    });

    ["sidebarAvatar", "topbarAvatar"].forEach(id => {
        const element = getElement(id);
        if (element) element.textContent = avatar;
    });

    const welcomeTitle = getElement("welcomeTitle");

    if (welcomeTitle) {
        welcomeTitle.textContent = currentRole === "faculty"
            ? "Welcome, Faculty!"
            : `Welcome back, ${student?.name?.split(" ")[0] || "Student"}!`;
    }

    const welcomeText = getElement("welcomeText");

    if (welcomeText) {
        welcomeText.textContent = currentRole === "faculty"
            ? "Manage student records, marks and classroom attendance."
            : "Track your academic journey and stay on top of your progress.";
    }
}

function updateStudentProfile() {
    const student = getCurrentStudent();

    if (!student) return;

    const fields = {
        profileAvatar: initials(student.name),
        profileName: student.name,
        profileStudentId: student.id,
        profileDepartment: student.department,
        profileYear: student.year,
        profileDegree: student.degree,
        profileBatch: student.batch,
        profileEmail: student.email
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = getElement(id);
        if (element) element.textContent = value || "-";
    });

    const cgpaElement = getElement("currentCGPA");
    const cgpa = getCurrentCGPA(student);

    if (cgpaElement) {
        cgpaElement.textContent =
            cgpa === null ? "N/A" : cgpa.toFixed(2);

        cgpaElement.title =
            cgpa === null
                ? "Semester SGPA data is not available."
                : "Average of available semester SGPA values.";
    }

    const sgpaElement = getElement("semesterSGPAValues");

    if (sgpaElement) {
        sgpaElement.innerHTML = student.semesterSGPA
            .map((value, index) => `
                <div class="sgpa-item">
                    <span>${SEMESTERS[index]}</span>
                    <strong>${value === null ? "N/A" : Number(value).toFixed(2)}</strong>
                </div>
            `)
            .join("");
    }
}

/* ======================== STUDENT STATISTICS ======================== */

function renderStudentStats() {
    const student = getCurrentStudent();
    const container = getElement("stats");

    if (!container || !student) return;

    const attendance = getOverallAttendance(student);
    const marks = getAverageMarks(student);
    const cgpa = getCurrentCGPA(student);

    const data = [
        {
            icon: "✧",
            color: "purple",
            title: "Average Marks",
            value: `${marks.toFixed(2)} / 100`,
            subtitle: "Across all subjects"
        },
        {
            icon: "◷",
            color: "blue",
            title: "Attendance",
            value: formatPercentage(attendance),
            subtitle: attendance >= MIN_ATTENDANCE
                ? "Attendance requirement met"
                : "Below required attendance"
        },
        {
            icon: "▤",
            color: "green",
            title: "Current CGPA",
            value: cgpa === null ? "N/A" : cgpa.toFixed(2),
            subtitle: "Out of 10.00"
        },
        {
            icon: "▣",
            color: "orange",
            title: "Assignments",
            value: assignments.length,
            subtitle: "Pending assignments"
        }
    ];

    container.innerHTML = data.map(item => `
        <div class="stat-card">
            <div class="stat-icon ${item.color}">${item.icon}</div>
            <div>
                <span>${item.title}</span>
                <h3>${item.value}</h3>
                <small>${item.subtitle}</small>
            </div>
        </div>
    `).join("");
}

/* ======================== CANVAS HELPERS ======================== */

function prepareCanvas(canvas, height) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 300);
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    return { ctx, width, height };
}

/* ======================== SEMESTER-WISE SGPA LINE GRAPH ======================== */

function drawSemesterSGPAChart(canvasId, semesterValues) {
    const canvas = getElement(canvasId);

    if (!canvas) {
        console.warn(`Canvas #${canvasId} was not found.`);
        return;
    }

    const { ctx, width, height } = prepareCanvas(canvas, 280);

    const padding = {
        left: 48,
        right: 24,
        top: 30,
        bottom: 48
    };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const values = Array.from(
        { length: 6 },
        (_, index) => {
            const value = semesterValues?.[index];

            if (value === null || value === undefined || value === "") {
                return null;
            }

            const number = Number(value);

            return Number.isFinite(number) && number >= 0 && number <= 10
                ? number
                : null;
        }
    );

    const x = index =>
        padding.left + (index / 5) * chartWidth;

    const y = value =>
        padding.top + chartHeight - (value / 10) * chartHeight;

    ctx.font = "11px DM Sans, sans-serif";
    ctx.fillStyle = "#8b8ba3";
    ctx.strokeStyle = "#e9e8f2";
    ctx.lineWidth = 1;

    for (let value = 0; value <= 10; value += 2) {
        const positionY = y(value);

        ctx.beginPath();
        ctx.moveTo(padding.left, positionY);
        ctx.lineTo(width - padding.right, positionY);
        ctx.stroke();

        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#8b8ba3";

        ctx.fillText(
            value.toFixed(0),
            padding.left - 10,
            positionY
        );
    }

    SEMESTERS.forEach((semester, index) => {
        ctx.fillStyle = "#77758b";
        ctx.font = "11px DM Sans, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        ctx.fillText(
            `Sem ${index + 1}`,
            x(index),
            height - padding.bottom + 15
        );
    });

    const points = values.map((value, index) => {
        if (value === null) return null;

        return {
            x: x(index),
            y: y(value),
            value,
            index
        };
    });

    const validPoints = points.filter(Boolean);

    if (!validPoints.length) {
        ctx.fillStyle = "#8b8ba3";
        ctx.font = "13px DM Sans, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            "Semester-wise SGPA data not available",
            width / 2,
            padding.top + chartHeight / 2
        );

        ctx.textAlign = "left";
        return;
    }

    ctx.beginPath();

    let drawingStarted = false;
    let previousIndex = -2;

    points.forEach(point => {
        if (!point) {
            drawingStarted = false;
            previousIndex = -2;
            return;
        }

        if (!drawingStarted || point.index !== previousIndex + 1) {
            ctx.moveTo(point.x, point.y);
            drawingStarted = true;
        } else {
            ctx.lineTo(point.x, point.y);
        }

        previousIndex = point.index;
    });

    ctx.strokeStyle = "#7565df";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    validPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);

        ctx.fillStyle = "#7565df";
        ctx.fill();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#55516f";
        ctx.font = "bold 12px DM Sans, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        ctx.fillText(
            point.value.toFixed(2),
            point.x,
            point.y - 11
        );
    });

    ctx.textAlign = "left";
}

function renderAcademicChart() {
    const student = getCurrentStudent();

    if (!student) return;

    drawSemesterSGPAChart(
        "academicPerformanceChart",
        student.semesterSGPA
    );
}

/* ======================== SUBJECT-WISE ATTENDANCE BAR GRAPH ======================== */

function drawAttendanceChart(canvasId, labels, values) {
    const canvas = getElement(canvasId);

    if (!canvas) {
        console.warn(`Canvas #${canvasId} was not found.`);
        return;
    }

    const chartHeight = Math.max(280, labels.length * 52 + 45);
    const { ctx, width, height } = prepareCanvas(canvas, chartHeight);

    const labelWidth = Math.min(155, width * 0.38);
    const rightPadding = 45;
    const barStart = labelWidth;
    const barWidth = Math.max(60, width - labelWidth - rightPadding);
    const topPadding = 25;
    const rowHeight = (height - topPadding - 15) / Math.max(labels.length, 1);
    const barHeight = 13;

    ctx.font = "11px DM Sans, sans-serif";
    ctx.textBaseline = "middle";

    // Empty-state message
    if (!labels.length || !values.length) {
        ctx.fillStyle = "#8b8ba3";
        ctx.font = "13px DM Sans, sans-serif";
        ctx.textAlign = "center";

        ctx.fillText(
            "Subject-wise attendance data not available",
            width / 2,
            height / 2
        );

        return;
    }

    // Vertical scale guides
    [0, 25, 50, 75, 100].forEach(value => {
        const x = barStart + (value / 100) * barWidth;

        ctx.beginPath();
        ctx.moveTo(x, topPadding - 5);
        ctx.lineTo(x, height - 20);

        ctx.strokeStyle = "#e9e8f2";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#8b8ba3";
        ctx.textAlign = "center";
        ctx.font = "10px DM Sans, sans-serif";

        ctx.fillText(
            `${value}%`,
            x,
            height - 9
        );
    });

    // 75% requirement marker
    const requirementX = barStart + (MIN_ATTENDANCE / 100) * barWidth;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(requirementX, topPadding - 5);
    ctx.lineTo(requirementX, height - 20);
    ctx.strokeStyle = "#ed9a68";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    labels.forEach((label, index) => {
        const rawValue = Number(values[index]);
        const value = Number.isFinite(rawValue)
            ? Math.max(0, Math.min(100, rawValue))
            : 0;

        const centerY = topPadding + index * rowHeight + rowHeight / 2;
        const barY = centerY - barHeight / 2;

        // Subject name
        ctx.fillStyle = "#55516f";
        ctx.font = "11px DM Sans, sans-serif";
        ctx.textAlign = "right";

        ctx.fillText(
            label,
            labelWidth - 10,
            centerY
        );

        // Background bar
        ctx.beginPath();
        ctx.roundRect(
            barStart,
            barY,
            barWidth,
            barHeight,
            7
        );

        ctx.fillStyle = "#eeedf5";
        ctx.fill();

        // Attendance bar
        const filledWidth = (value / 100) * barWidth;

        if (filledWidth > 0) {
            ctx.beginPath();
            ctx.roundRect(
                barStart,
                barY,
                filledWidth,
                barHeight,
                7
            );

            ctx.fillStyle = value >= MIN_ATTENDANCE
                ? "#7565df"
                : "#ed9a68";

            ctx.fill();
        }

        // Percentage label
        ctx.fillStyle = "#55516f";
        ctx.font = "bold 11px DM Sans, sans-serif";
        ctx.textAlign = "left";

        ctx.fillText(
            `${value.toFixed(1)}%`,
            barStart + barWidth + 7,
            centerY
        );
    });

    ctx.textAlign = "left";
}

function renderAttendanceChart() {
    const student = getCurrentStudent();

    if (!student) return;

    // Use existing subject-wise attendance totals.
    // No date-wise attendance history is required.

    const labels = SUBJECTS;

    const values = SUBJECTS.map(subject => {
        return getSubjectAttendance(student, subject).percentage;
    });

    drawAttendanceChart(
        "attendanceComparisonChart",
        labels,
        values
    );
}

/* ======================== SUBJECT ATTENDANCE CARDS ======================== */

function renderCourseAttendance() {
    const student = getCurrentStudent();
    const container = getElement("courseAttendanceContainer");

    if (!student || !container) return;

    container.innerHTML = SUBJECTS.map(subject => {
        const data = getSubjectAttendance(student, subject);
        const percentage = data.percentage;
        const safePercentage = Math.max(0, Math.min(100, percentage));

        const status = percentage >= MIN_ATTENDANCE
            ? "attendance-good"
            : "attendance-low";

        return `
            <article class="course-attendance-card ${status}">
                <div class="course-card-header">
                    <strong>${escapeHTML(subject)}</strong>
                    <span class="course-percentage">
                        ${formatPercentage(percentage)}
                    </span>
                </div>

                <div class="course-attendance-stats">
                    <span>Attended: ${data.attended}</span>
                    <span>Total: ${data.total}</span>
                </div>

                <div class="course-progress-track">
                    <div
                        class="course-progress-fill"
                        style="width: ${safePercentage}%"
                    ></div>
                </div>

                <div class="course-chart-wrap">
                    <span>
                        ${percentage >= MIN_ATTENDANCE
                            ? "Requirement achieved"
                            : "Below 75% requirement"}
                    </span>
                </div>
            </article>
        `;
    }).join("");
}

/* ======================== INTERNAL MARKS TABLE ======================== */

function renderInternalMarks() {
    const student = getCurrentStudent();
    const tbody = getElement("internalMarksTable");

    if (!student || !tbody) return;

    tbody.innerHTML = SUBJECTS.map(subject => {
        // Original assessment marks out of 100
        const originalMarks = getStudentMarks(student, subject);

        // Convert assessment marks from 100 to 35
        const assessmentScore = (originalMarks / 100) * 35;

        // Get subject-wise attendance
        const attendance = getSubjectAttendance(student, subject);

        // Convert attendance percentage to 5 marks
        const attendanceScore = (attendance.percentage / 100) * 5;

        // Calculate total marks out of 40
        const totalScore = assessmentScore + attendanceScore;

        return `
            <tr>
                <td>${escapeHTML(subject)}</td>

                <td>
                    ${assessmentScore.toFixed(1)} / 35
                </td>

                <td>
                    ${attendanceScore.toFixed(1)} / 5
                </td>

                <td>
                    <strong>
                        ${totalScore.toFixed(1)} / 40
                    </strong>
                </td>
            </tr>
        `;
    }).join("");
}

/* ======================== PENDING ASSIGNMENTS ======================== */

function renderAssignments() {
    const container = getElement("pendingAssignments");
    const count = getElement("pendingAssignmentCount");

    if (!container) return;

    if (count) count.textContent = assignments.length;

    container.innerHTML = assignments.map(assignment => `
        <article class="assignment-card">
            <div>
                <span class="assignment-subject">
                    ${escapeHTML(assignment.subject)}
                </span>
                <h3>${escapeHTML(assignment.title)}</h3>
                <p>${escapeHTML(assignment.description)}</p>
            </div>

            <div class="assignment-due-date">
                <span>Due date</span>
                <strong>${escapeHTML(assignment.dueDate)}</strong>
            </div>
        </article>
    `).join("");
}

/* ======================== FACULTY STATISTICS ======================== */

function renderFacultyStats() {
    const departments = new Set(
        students.map(student => student.department).filter(Boolean)
    );

    const averageAttendance = average(students.map(getOverallAttendance));
    const averageMarks = average(students.map(getAverageMarks));

    const values = {
        facultyTotalStudents: students.length,
        facultyDepartmentCount: departments.size,
        facultyAverageAttendance: formatPercentage(averageAttendance),
        facultyAverageCGPA: averageMarks.toFixed(2)
    };

    Object.entries(values).forEach(([id, value]) => {
        const element = getElement(id);
        if (element) element.textContent = value;
    });
}

/* ======================== DEPARTMENT FILTER ======================== */

function renderDepartmentFilter() {
    const select = getElement("departmentFilter");

    if (!select) return;

    const previousValue = select.value;

    const departments = [...new Set(
        students.map(student => student.department).filter(Boolean)
    )].sort();

    select.innerHTML = `
        <option value="">All Departments</option>
        ${departments.map(department => `
            <option value="${escapeHTML(department)}">
                ${escapeHTML(department)}
            </option>
        `).join("")}
    `;

    select.value = departments.includes(previousValue) ? previousValue : "";
}

/* ======================== FACULTY STUDENT TABLE ======================== */

function renderStudentTable() {
    const tbody = getElement("studentTable");

    if (!tbody) return;

    const search = (getElement("searchInput")?.value || "").toLowerCase();
    const department = getElement("departmentFilter")?.value || "";

    const filtered = students.filter(student => {
        const matchesSearch =
            student.name.toLowerCase().includes(search) ||
            student.id.toLowerCase().includes(search);

        const matchesDepartment =
            !department || student.department === department;

        return matchesSearch && matchesDepartment;
    });

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr><td colspan="7">No students found.</td></tr>
        `;
    } else {
        tbody.innerHTML = filtered.map(student => `
            <tr>
                <td><strong>${escapeHTML(student.name)}</strong></td>
                <td>${escapeHTML(student.id)}</td>
                <td>${escapeHTML(student.department)}</td>
                <td>${escapeHTML(student.year)}</td>
                <td>${getAverageMarks(student).toFixed(2)}</td>
                <td>
                    <span class="status-badge">
                        ${escapeHTML(student.status || "Active")}
                    </span>
                </td>
                <td>
                    <div class="table-actions">
                        <button
                            type="button"
                            class="action-button"
                            data-action="edit"
                            data-id="${escapeHTML(student.id)}"
                        >Edit</button>

                        <button
                            type="button"
                            class="action-button delete-action"
                            data-action="delete"
                            data-id="${escapeHTML(student.id)}"
                        >Delete</button>
                    </div>
                </td>
            </tr>
        `).join("");
    }

    const recordCount = getElement("recordCount");

    if (recordCount) {
        recordCount.textContent =
            `Showing ${filtered.length} of ${students.length} students`;
    }
}

/* ======================== FACULTY ATTENDANCE TABLE ======================== */

function renderFacultyAttendance() {
    const tbody = getElement("facultyAttendanceTable");

    if (!tbody) return;

    const search = (
        getElement("attendanceSearchInput")?.value || ""
    ).toLowerCase();

    const selectedSubject =
        getElement("attendanceSubjectFilter")?.value || "";

    const rows = [];

    students.forEach(student => {
        SUBJECTS.forEach(subject => {
            if (selectedSubject && selectedSubject !== subject) return;

            if (
                search &&
                !student.name.toLowerCase().includes(search) &&
                !student.id.toLowerCase().includes(search)
            ) return;

            const attendance = getSubjectAttendance(student, subject);

            rows.push(`
                <tr>
                    <td>${escapeHTML(student.name)}</td>
                    <td>${escapeHTML(student.id)}</td>
                    <td>${escapeHTML(subject)}</td>
                    <td>${attendance.attended}</td>
                    <td>${attendance.total}</td>
                    <td>${formatPercentage(attendance.percentage)}</td>
                    <td>
                        <button
                            type="button"
                            class="action-button"
                            data-action="attendance"
                            data-id="${escapeHTML(student.id)}"
                            data-subject="${escapeHTML(subject)}"
                        >Update</button>
                    </td>
                </tr>
            `);
        });
    });

    tbody.innerHTML = rows.length
        ? rows.join("")
        : `<tr><td colspan="7">No attendance records found.</td></tr>`;
}

/* ======================== MODAL SYSTEM ======================== */

function openModal(title, content) {
    const root = getElement("modalRoot");

    if (!root) return;

    root.innerHTML = `
        <div class="modal-overlay" id="modalOverlay">
            <div
                class="modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modalTitle"
            >
                <div class="modal-header">
                    <h2 id="modalTitle">${escapeHTML(title)}</h2>

                    <button
                        type="button"
                        class="modal-close"
                        id="modalCloseButton"
                        aria-label="Close"
                    >×</button>
                </div>

                <div class="modal-body">${content}</div>
            </div>
        </div>
    `;

    getElement("modalCloseButton")?.addEventListener("click", closeModal);

    getElement("modalOverlay")?.addEventListener("click", event => {
        if (event.target.id === "modalOverlay") closeModal();
    });

    document.removeEventListener("keydown", handleModalEscape);
    document.addEventListener("keydown", handleModalEscape);
}

function handleModalEscape(event) {
    if (event.key === "Escape") closeModal();
}

function closeModal() {
    const root = getElement("modalRoot");

    if (root) root.innerHTML = "";

    document.removeEventListener("keydown", handleModalEscape);

    currentModalType = null;
    editingStudentId = null;
}

/* ======================== ADD / EDIT STUDENT FORM ======================== */

function openForm(studentId = null) {
    const student = studentId ? getStudentById(studentId) : null;

    if (studentId && !student) {
        showToast("Student record not found.", "error");
        return;
    }

    editingStudentId = studentId;
    currentModalType = "student";

    openModal(
        student ? "Edit Student" : "Add New Student",
        `
            <form id="studentForm" class="modal-form">
                <div class="form-group">
                    <label for="studentName">Full Name</label>
                    <input
                        id="studentName"
                        name="name"
                        required
                        value="${escapeHTML(student?.name || "")}"
                        placeholder="Enter student name"
                    >
                </div>

                <div class="form-group">
                    <label for="studentId">Student ID</label>
                    <input
                        id="studentId"
                        name="id"
                        required
                        value="${escapeHTML(student?.id || "")}"
                        placeholder="e.g. MCA2026002"
                    >
                </div>

                <div class="form-group">
                    <label for="studentDepartment">Department / Course</label>
                    <input
                        id="studentDepartment"
                        name="department"
                        required
                        value="${escapeHTML(student?.department || "MCA")}"
                    >
                </div>

                <div class="form-group">
                    <label for="studentYear">Year</label>
                    <select id="studentYear" name="year" required>
                        ${["1st Year", "2nd Year", "3rd Year", "4th Year"]
                            .map(year => `
                                <option
                                    value="${year}"
                                    ${student?.year === year ? "selected" : ""}
                                >${year}</option>
                            `).join("")}
                    </select>
                </div>

                <div class="form-group">
                    <label for="studentDegree">Degree</label>
                    <input
                        id="studentDegree"
                        name="degree"
                        required
                        value="${escapeHTML(student?.degree || "MCA")}"
                    >
                </div>

                <div class="form-group">
                    <label for="studentBatch">Batch</label>
                    <input
                        id="studentBatch"
                        name="batch"
                        required
                        value="${escapeHTML(student?.batch || "2026")}"
                    >
                </div>

                <div class="form-group">
                    <label for="studentEmail">Email</label>
                    <input
                        id="studentEmail"
                        name="email"
                        type="email"
                        required
                        value="${escapeHTML(student?.email || "")}"
                        placeholder="student@example.com"
                    >
                </div>

                <div class="modal-actions">
                    <button
                        type="button"
                        class="secondary-button"
                        id="cancelStudent"
                    >Cancel</button>

                    <button type="submit" class="primary-button">
                        ${student ? "Save Changes" : "Add Student"}
                    </button>
                </div>
            </form>
        `
    );

    getElement("cancelStudent")?.addEventListener("click", closeModal);
    getElement("studentForm")?.addEventListener("submit", handleStudentFormSubmit);
}

function editStudent(id) {
    openForm(id);
}

function handleStudentFormSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const originalId = editingStudentId;

    const existingStudent = originalId
        ? getStudentById(originalId)
        : null;

    const newId = String(formData.get("id") || "").trim();

    const duplicate = students.some(student =>
        student.id.toLowerCase() === newId.toLowerCase() &&
        student.id !== originalId
    );

    if (duplicate) {
        showToast("This student ID already exists.", "error");
        return;
    }

    const studentData = {
        id: newId,
        name: String(formData.get("name") || "").trim(),
        department: String(formData.get("department") || "").trim(),
        year: formData.get("year"),
        degree: String(formData.get("degree") || "").trim(),
        batch: String(formData.get("batch") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        course: String(formData.get("degree") || "MCA").trim(),
        semester: existingStudent?.semester || 1,
        status: existingStudent?.status || "Active"
    };

    if (existingStudent) {
        Object.assign(existingStudent, studentData);
    } else {
        students.push(createDefaultStudent({
            ...studentData,
            assessments: {},
            courseAttendance: {},
            attendanceRecords: [],
            semesterSGPA: [null, null, null, null, null, null]
        }));
    }

    saveStudents();
    closeModal();
    refreshDashboard();

    showToast(
        existingStudent
            ? "Student details updated successfully."
            : "New student added successfully."
    );
}

/* ======================== DELETE STUDENT ======================== */

function deleteStudent(id) {
    const student = getStudentById(id);

    if (!student) return;

    const confirmed = window.confirm(
        `Are you sure you want to delete ${student.name}?`
    );

    if (!confirmed) return;

    students = students.filter(item => item.id !== id);

    saveStudents();
    refreshDashboard();

    showToast("Student deleted successfully.");
}

/* ======================== UPLOAD MARKS ======================== */

function openMarksModal() {
    if (!students.length) {
        showToast("Add a student first.", "error");
        return;
    }

    currentModalType = "marks";

    openModal(
        "Upload Subject Marks",
        `
            <form id="marksForm" class="modal-form">
                <div class="form-group">
                    <label for="marksStudent">Select Student</label>
                    <select id="marksStudent" required>
                        ${students.map(student => `
                            <option value="${escapeHTML(student.id)}">
                                ${escapeHTML(student.name)}
                                (${escapeHTML(student.id)})
                            </option>
                        `).join("")}
                    </select>
                </div>

                <div class="form-group">
                    <label for="marksSubject">Select Subject</label>
                    <select id="marksSubject" required>
                        ${SUBJECTS.map(subject => `
                            <option value="${escapeHTML(subject)}">
                                ${escapeHTML(subject)}
                            </option>
                        `).join("")}
                    </select>
                </div>

                <div class="form-group">
                    <label for="assessmentMarks">Marks (out of 100)</label>
                    <input
                        type="number"
                        id="assessmentMarks"
                        min="0"
                        max="100"
                        required
                        value="0"
                    >
                </div>

                <div class="modal-actions">
                    <button
                        type="button"
                        class="secondary-button"
                        id="cancelMarks"
                    >Cancel</button>

                    <button type="submit" class="primary-button">
                        Save Marks
                    </button>
                </div>
            </form>
        `
    );

    getElement("cancelMarks")?.addEventListener("click", closeModal);

    getElement("marksForm")?.addEventListener("submit", event => {
        event.preventDefault();

        const student = getStudentById(
            getElement("marksStudent").value
        );

        const subject = getElement("marksSubject").value;
        const marks = Number(getElement("assessmentMarks").value);

        if (
            !student ||
            !SUBJECTS.includes(subject) ||
            !Number.isFinite(marks) ||
            marks < 0 ||
            marks > 100
        ) {
            showToast("Please enter valid marks.", "error");
            return;
        }

        student.assessments[subject] = marks;

        saveStudents();
        closeModal();
        refreshDashboard();

        showToast("Subject marks updated successfully.");
    });
}

/* ======================== ATTENDANCE MANAGEMENT ======================== */

function openAttendanceModal(studentId = null, subjectName = null) {
    if (!students.length) {
        showToast("Add a student first.", "error");
        return;
    }

    currentModalType = "attendance";

    const selectedStudent = studentId || students[0].id;
    const selectedSubject = subjectName || SUBJECTS[0];

    openModal(
        "Manage Student Attendance",
        `
            <form id="attendanceForm" class="modal-form">
                <div class="form-group">
                    <label for="attendanceStudent">Select Student</label>
                    <select id="attendanceStudent" required>
                        ${students.map(student => `
                            <option
                                value="${escapeHTML(student.id)}"
                                ${student.id === selectedStudent ? "selected" : ""}
                            >
                                ${escapeHTML(student.name)}
                            </option>
                        `).join("")}
                    </select>
                </div>

                <div class="form-group">
                    <label for="attendanceSubject">Select Subject</label>
                    <select id="attendanceSubject" required>
                        ${SUBJECTS.map(subject => `
                            <option
                                value="${escapeHTML(subject)}"
                                ${subject === selectedSubject ? "selected" : ""}
                            >
                                ${escapeHTML(subject)}
                            </option>
                        `).join("")}
                    </select>
                </div>

                <div class="form-group">
                    <label for="attendanceDate">Attendance Date</label>
                    <input
                        type="date"
                        id="attendanceDate"
                        value="${today()}"
                        max="${today()}"
                        required
                    >
                </div>

                <div class="form-group">
                    <label for="attendanceStatus">Attendance Status</label>
                    <select id="attendanceStatus" required>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                    </select>
                </div>

                <div class="modal-actions">
                    <button
                        type="button"
                        class="secondary-button"
                        id="cancelAttendance"
                    >Cancel</button>

                    <button type="submit" class="primary-button">
                        Save Attendance
                    </button>
                </div>
            </form>
        `
    );

    getElement("cancelAttendance")?.addEventListener("click", closeModal);

    getElement("attendanceForm")?.addEventListener("submit", event => {
        event.preventDefault();

        const student = getStudentById(
            getElement("attendanceStudent").value
        );

        const subject = getElement("attendanceSubject").value;
        const date = getElement("attendanceDate").value;
        const status = getElement("attendanceStatus").value;

        if (!student || !date || !SUBJECTS.includes(subject)) {
            showToast("Please complete all attendance fields.", "error");
            return;
        }

        const duplicate = student.attendanceRecords.some(record =>
            record.subject === subject && record.date === date
        );

        if (duplicate) {
            showToast(
                "Attendance for this subject and date is already recorded.",
                "error"
            );
            return;
        }

        const record = {
            subject,
            date,
            present: status === "present"
        };

        student.attendanceRecords.push(record);

        const course = student.courseAttendance[subject];
        course.total += 1;

        if (record.present) course.attended += 1;

        saveStudents();
        closeModal();
        refreshDashboard();

        showToast("Attendance recorded successfully.");
    });
}

/* ======================== NAVIGATION ======================== */

function navigateToSection(section) {
    const target = getElement(section);

    if (target) {
        target.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.toggle(
            "active",
            link.dataset.section === section
        );
    });

    const title = PAGE_TITLES[section] || "Dashboard Overview";
    const pageTitle = getElement("pageTitle");
    const breadcrumb = getElement("breadcrumbCurrent");

    if (pageTitle) pageTitle.textContent = title;

    if (breadcrumb) {
        breadcrumb.textContent = title.replace(" Overview", "");
    }
}

function setupNavigation() {
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();

            const section = link.dataset.section;

            navigateToSection(section);
            closeMobileSidebar();
        });
    });
}

/* ======================== ROLE SWITCHER ======================== */

function switchRole(role) {
    currentRole = role === "faculty" ? "faculty" : "student";

    const studentView = getElement("studentView");
    const facultyView = getElement("facultyView");
    const welcomeBanner = getElement("welcomeBanner");

    if (studentView) studentView.hidden = currentRole !== "student";
    if (facultyView) facultyView.hidden = currentRole !== "faculty";
    if (welcomeBanner) welcomeBanner.hidden = false;

    updateUserInformation();

    if (currentRole === "faculty") {
        renderFacultyDashboard();
    } else {
        renderStudentDashboard();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* ======================== MOBILE SIDEBAR ======================== */

function openMobileSidebar() {
    getElement("sidebar")?.classList.add("active");
}

function closeMobileSidebar() {
    getElement("sidebar")?.classList.remove("active");
}

function setupMobileSidebar() {
    getElement("mobileMenuButton")?.addEventListener(
        "click",
        openMobileSidebar
    );

    document.addEventListener("click", event => {
        const sidebar = getElement("sidebar");
        const button = getElement("mobileMenuButton");

        if (
            sidebar &&
            sidebar.classList.contains("active") &&
            !sidebar.contains(event.target) &&
            !button?.contains(event.target)
        ) {
            closeMobileSidebar();
        }
    });
}

/* ======================== EVENT LISTENERS ======================== */

function setupFacultyActions() {
    getElement("addStudentButton")?.addEventListener("click", () => openForm());
    getElement("facultyAddStudentButton")?.addEventListener("click", () => openForm());
    getElement("uploadMarksButton")?.addEventListener("click", openMarksModal);

    getElement("manageAttendanceButton")?.addEventListener(
        "click",
        () => openAttendanceModal()
    );

    getElement("searchInput")?.addEventListener("input", renderStudentTable);
    getElement("departmentFilter")?.addEventListener("change", renderStudentTable);

    getElement("attendanceSearchInput")?.addEventListener(
        "input",
        renderFacultyAttendance
    );

    getElement("attendanceSubjectFilter")?.addEventListener(
        "change",
        renderFacultyAttendance
    );

    getElement("studentTable")?.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");

        if (!button) return;

        const id = button.dataset.id;

        if (button.dataset.action === "edit") editStudent(id);
        if (button.dataset.action === "delete") deleteStudent(id);
    });

    getElement("facultyAttendanceTable")?.addEventListener(
        "click",
        event => {
            const button = event.target.closest("[data-action]");

            if (!button || button.dataset.action !== "attendance") return;

            openAttendanceModal(
                button.dataset.id,
                button.dataset.subject
            );
        }
    );
}

function setupGeneralEvents() {
    getElement("roleSelector")?.addEventListener("change", event => {
        switchRole(event.target.value);
    });

    getElement("notificationButton")?.addEventListener(
        "click",
        () => showToast("You are all caught up!")
    );
}

/* ======================== DASHBOARD RENDERING ======================== */

function renderStudentDashboard() {
    updateUserInformation();
    updateStudentProfile();
    renderStudentStats();

    renderAcademicChart();
    renderAttendanceChart();
    renderCourseAttendance();
    renderInternalMarks();
    renderAssignments();
}

function renderFacultyDashboard() {
    updateUserInformation();
    renderFacultyStats();
    renderDepartmentFilter();
    renderStudentTable();
    renderFacultyAttendance();
}

function refreshDashboard() {
    updateUserInformation();

    if (currentRole === "faculty") {
        renderFacultyDashboard();
    } else {
        renderStudentDashboard();
    }
}

/* ======================== DATABASE USER INFORMATION ======================== */

function getSQLUser(loginId) {
    return SQL_USERS.find(user => user.loginId === loginId) || null;
}

/* ======================== INITIALIZATION ======================== */

function initializeDashboard() {
    loadStudents();

    setupNavigation();
    setupMobileSidebar();
    setupFacultyActions();
    setupGeneralEvents();

    const roleSelector = getElement("roleSelector");

    if (roleSelector) {
        roleSelector.value = "student";
    }

    switchRole("student");

    window.addEventListener("resize", () => {
        if (currentRole === "student") {
            renderAcademicChart();
            renderAttendanceChart();
        }
    });

    const currentStudent = getCurrentStudent();

    console.log("CampusConnect dashboard initialized successfully.");
    console.log("SQL Student:", currentStudent);
    console.log("SQL Login:", getSQLUser("rahul"));

    console.log(
        "Average Marks:",
        getAverageMarks(currentStudent).toFixed(2)
    );

    console.log(
        "Overall Attendance:",
        formatPercentage(getOverallAttendance(currentStudent))
    );

    console.log(
        "Semester-wise SGPA:",
        currentStudent?.semesterSGPA
    );

    console.log(
        "Current CGPA:",
        getCurrentCGPA(currentStudent)?.toFixed(2) ?? "N/A"
    );
}

document.addEventListener("DOMContentLoaded", initializeDashboard);
