const STORAGE_KEY = "msm-attendance-mockup-v1";

const attendanceOptions = ["Present", "Absent", "Late", "Excused", "Not Recorded"];
const engagementOptions = ["Highly Engaged", "Engaged", "Somewhat Engaged", "Not Engaged", "Not Applicable"];

let state = {
  courses: [],
  selectedCourseId: null,
  selectedSessionDate: null
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    state = JSON.parse(saved);
  }
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function parseLines(value) {
  return value
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
}

function getSelectedCourse() {
  return state.courses.find(course => course.id === state.selectedCourseId);
}

function getSessionRecord(course, sessionDate) {
  if (!course.records[sessionDate]) {
    course.records[sessionDate] = {
      submittedAt: null,
      attendees: course.attendees.map(attendee => ({
        attendeeId: attendee.id,
        attendance: "Not Recorded",
        engagement: "Not Applicable",
        notes: ""
      }))
    };
  }
  return course.records[sessionDate];
}

function renderCourses() {
  const list = document.getElementById("courseList");

  if (!state.courses.length) {
    list.innerHTML = `<div class="empty-state">No courses yet. Create a course or load demo data.</div>`;
    return;
  }

  list.innerHTML = state.courses.map(course => {
    const completed = course.schedule.filter(date => course.records[date]?.submittedAt).length;
    const total = course.schedule.length;

    return `
      <div class="course-card ${course.id === state.selectedCourseId ? "active" : ""}" onclick="selectCourse('${course.id}')">
        <h3>${escapeHtml(course.name)}</h3>
        <p class="course-meta">Facilitator: ${escapeHtml(course.facilitatorName)}</p>
        <p class="course-meta">${course.attendees.length} attendees • ${total} sessions</p>
        <div class="badge-row">
          <span class="badge primary">${escapeHtml(course.status)}</span>
          <span class="badge ${completed === total ? "success" : "warning"}">${completed}/${total} sessions submitted</span>
        </div>
      </div>
    `;
  }).join("");
}

function selectCourse(courseId) {
  state.selectedCourseId = courseId;
  const course = getSelectedCourse();
  state.selectedSessionDate = course.schedule[0] || null;
  saveState();
  render();
}

function selectSession(date) {
  state.selectedSessionDate = date;
  saveState();
  renderAttendance();
}

function renderAttendance() {
  const area = document.getElementById("attendanceArea");
  const course = getSelectedCourse();

  if (!course) {
    area.innerHTML = `<div class="empty-state">Select or create a course to begin tracking attendance.</div>`;
    return;
  }

  const sessionDate = state.selectedSessionDate || course.schedule[0];
  const record = getSessionRecord(course, sessionDate);

  const tabs = course.schedule.map(date => `
    <button class="session-tab ${date === sessionDate ? "active" : ""}" onclick="selectSession('${date}')">
      ${formatDate(date)}
    </button>
  `).join("");

  const rows = course.attendees.map(attendee => {
    const attendeeRecord = record.attendees.find(r => r.attendeeId === attendee.id) || {
      attendeeId: attendee.id,
      attendance: "Not Recorded",
      engagement: "Not Applicable",
      notes: ""
    };

    return `
      <tr>
        <td><strong>${escapeHtml(attendee.name)}</strong></td>
        <td>
          <select onchange="updateAttendance('${attendee.id}', this.value)">
            ${attendanceOptions.map(option => `<option ${option === attendeeRecord.attendance ? "selected" : ""}>${option}</option>`).join("")}
          </select>
        </td>
        <td>
          <select onchange="updateEngagement('${attendee.id}', this.value)">
            ${engagementOptions.map(option => `<option ${option === attendeeRecord.engagement ? "selected" : ""}>${option}</option>`).join("")}
          </select>
        </td>
        <td>
          <input value="${escapeAttr(attendeeRecord.notes || "")}" placeholder="Optional note" onchange="updateNotes('${attendee.id}', this.value)" />
        </td>
      </tr>
    `;
  }).join("");

  area.innerHTML = `
    <div class="badge-row">
      <span class="badge primary">${escapeHtml(course.name)}</span>
      <span class="badge">${formatDate(sessionDate)}</span>
      <span class="badge ${record.submittedAt ? "success" : "warning"}">${record.submittedAt ? "Submitted" : "Not Submitted"}</span>
    </div>

    <div class="session-tabs">${tabs}</div>

    <table class="attendance-table">
      <thead>
        <tr>
          <th>Attendee</th>
          <th>Attendance</th>
          <th>Engagement Level</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="table-actions">
      <span class="timestamp">${record.submittedAt ? `Submitted: ${new Date(record.submittedAt).toLocaleString()}` : "No submission timestamp yet."}</span>
      <button class="primary" onclick="submitSession()">Submit Attendance</button>
    </div>
  `;
}

function updateAttendance(attendeeId, value) {
  const course = getSelectedCourse();
  const record = getSessionRecord(course, state.selectedSessionDate);
  const attendeeRecord = record.attendees.find(r => r.attendeeId === attendeeId);
  attendeeRecord.attendance = value;

  if (value === "Absent") {
    attendeeRecord.engagement = "Not Applicable";
  }

  saveState();
  renderDashboard();
}

function updateEngagement(attendeeId, value) {
  const course = getSelectedCourse();
  const record = getSessionRecord(course, state.selectedSessionDate);
  const attendeeRecord = record.attendees.find(r => r.attendeeId === attendeeId);
  attendeeRecord.engagement = value;
  saveState();
  renderDashboard();
}

function updateNotes(attendeeId, value) {
  const course = getSelectedCourse();
  const record = getSessionRecord(course, state.selectedSessionDate);
  const attendeeRecord = record.attendees.find(r => r.attendeeId === attendeeId);
  attendeeRecord.notes = value;
  saveState();
}

function submitSession() {
  const course = getSelectedCourse();
  const record = getSessionRecord(course, state.selectedSessionDate);
  record.submittedAt = new Date().toISOString();
  saveState();
  render();
}

function renderDashboard() {
  const dashboard = document.getElementById("dashboard");

  const totalCourses = state.courses.length;
  const totalSessions = state.courses.reduce((sum, c) => sum + c.schedule.length, 0);
  const submittedSessions = state.courses.reduce((sum, c) => {
    return sum + c.schedule.filter(date => c.records[date]?.submittedAt).length;
  }, 0);
  const missingSessions = totalSessions - submittedSessions;

  const overdueRows = [];
  const today = new Date();
  today.setHours(0,0,0,0);

  state.courses.forEach(course => {
    course.schedule.forEach(date => {
      const sessionDate = new Date(date + "T00:00:00");
      const submitted = Boolean(course.records[date]?.submittedAt);

      if (!submitted && sessionDate < today) {
        overdueRows.push({
          course: course.name,
          facilitator: course.facilitatorName,
          date,
          status: "Missing"
        });
      }
    });
  });

  dashboard.innerHTML = `
    <div class="metric">
      <p class="label">Total Courses</p>
      <div class="value">${totalCourses}</div>
      <p class="label">Created in mockup</p>
    </div>
    <div class="metric">
      <p class="label">Total Sessions</p>
      <div class="value">${totalSessions}</div>
      <p class="label">Scheduled sessions</p>
    </div>
    <div class="metric">
      <p class="label">Submitted</p>
      <div class="value">${submittedSessions}</div>
      <p class="label">Attendance records complete</p>
    </div>
    <div class="metric">
      <p class="label">Missing</p>
      <div class="value">${missingSessions}</div>
      <p class="label">Need facilitator follow-up</p>
    </div>

    <div class="report-list">
      <h3>Weekly Email Report Preview</h3>
      ${overdueRows.length ? overdueRows.map(row => `
        <div class="report-row">
          <strong>${escapeHtml(row.course)}</strong>
          <span>${escapeHtml(row.facilitator)}</span>
          <span>${formatDate(row.date)}</span>
          <span class="badge warning">${row.status}</span>
        </div>
      `).join("") : `<div class="empty-state">No overdue attendance records based on the current mock data.</div>`}
    </div>
  `;
}

function render() {
  renderCourses();
  renderAttendance();
  renderDashboard();
}

function seedDemoData() {
  state = {
    selectedCourseId: "course-demo-1",
    selectedSessionDate: "2026-06-03",
    courses: [
      {
        id: "course-demo-1",
        name: "Story Workshop - Spring Cohort",
        facilitatorName: "Jane Facilitator",
        facilitatorEmail: "jane@example.org",
        status: "Active",
        schedule: ["2026-06-03", "2026-06-10", "2026-06-17"],
        attendees: [
          { id: "a1", name: "Maria Garcia" },
          { id: "a2", name: "James Wilson" },
          { id: "a3", name: "Ava Thompson" },
          { id: "a4", name: "Noah Johnson" }
        ],
        records: {
          "2026-06-03": {
            submittedAt: new Date().toISOString(),
            attendees: [
              { attendeeId: "a1", attendance: "Present", engagement: "Highly Engaged", notes: "Shared during group discussion." },
              { attendeeId: "a2", attendance: "Present", engagement: "Engaged", notes: "" },
              { attendeeId: "a3", attendance: "Late", engagement: "Somewhat Engaged", notes: "" },
              { attendeeId: "a4", attendance: "Absent", engagement: "Not Applicable", notes: "" }
            ]
          }
        }
      },
      {
        id: "course-demo-2",
        name: "Legacy Stories - Evening Class",
        facilitatorName: "Mark Facilitator",
        facilitatorEmail: "mark@example.org",
        status: "Active",
        schedule: ["2026-05-28", "2026-06-04", "2026-06-11"],
        attendees: [
          { id: "b1", name: "Sophia Lee" },
          { id: "b2", name: "Liam Brown" },
          { id: "b3", name: "Emma Martinez" }
        ],
        records: {}
      }
    ]
  };

  saveState();
  render();
}

function clearData() {
  if (!confirm("Clear all mockup data from this browser?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = {
    courses: [],
    selectedCourseId: null,
    selectedSessionDate: null
  };
  render();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, match => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[match]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function formatDate(dateString) {
  const date = new Date(dateString + "T00:00:00");
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

document.getElementById("courseForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("courseName").value.trim();
  const facilitatorName = document.getElementById("facilitatorName").value.trim();
  const facilitatorEmail = document.getElementById("facilitatorEmail").value.trim();
  const status = document.getElementById("courseStatus").value;
  const schedule = parseLines(document.getElementById("scheduleDates").value);
  const attendeeNames = parseLines(document.getElementById("attendees").value);

  const course = {
    id: createId(),
    name,
    facilitatorName,
    facilitatorEmail,
    status,
    schedule,
    attendees: attendeeNames.map(attendee => ({
      id: createId(),
      name: attendee
    })),
    records: {}
  };

  state.courses.push(course);
  state.selectedCourseId = course.id;
  state.selectedSessionDate = schedule[0] || null;

  event.target.reset();
  saveState();
  render();
});

document.getElementById("seedDemoBtn").addEventListener("click", seedDemoData);
document.getElementById("clearDataBtn").addEventListener("click", clearData);

loadState();
render();
