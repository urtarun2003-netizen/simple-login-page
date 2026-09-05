const STORAGE_KEY = "workdeskDataV1";

const defaultData = {
  user: null,
  tasks: [],
  reminders: [],
  notes: [],
  notifications: [],
  activity: [],
  settings: {
    theme: "light",
    notifications: true,
    sound: true,
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12"
  }
};

let data = loadData();
let currentCalendarDate = new Date();

const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", init);

function init() {
  normalizeData();
  bindEvents();
  buildCalendarSelectors();
  applyTheme();
  updateTodayLabel();

  if (data.user?.loggedIn) {
    showScreen("appScreen");
    initializeApp();
  } else {
    showScreen("authScreen");
  }

  checkReminders();
  setInterval(checkReminders, 15000);
}

function normalizeData() {
  data = {
    ...defaultData,
    ...data,
    settings: { ...defaultData.settings, ...(data.settings || {}) },
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    reminders: Array.isArray(data.reminders) ? data.reminders : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    activity: Array.isArray(data.activity) ? data.activity : []
  };
  saveData();
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function bindEvents() {
  $("showLoginBtn").addEventListener("click", () => switchAuth("login"));
  $("showRegisterBtn").addEventListener("click", () => switchAuth("register"));

  $("loginForm").addEventListener("submit", handleLogin);
  $("registerForm").addEventListener("submit", handleRegister);

  $$(".password-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $(btn.dataset.target);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
    });
  });

  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });

  $$("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.go));
  });

  $("sidebarLogoutBtn").addEventListener("click", logout);
  $("settingsLogoutBtn").addEventListener("click", logout);

  $("notificationShortcut").addEventListener("click", () => navigate("notificationsPage"));
  $("themeToggleBtn").addEventListener("click", toggleTheme);
  $("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));

  $("dashboardAddTaskBtn").addEventListener("click", () => openTaskModal());
  $("addTaskBtn").addEventListener("click", () => openTaskModal());
  $("addReminderBtn").addEventListener("click", () => openReminderModal());
  $("addNoteBtn").addEventListener("click", () => openNoteModal());

  $("taskForm").addEventListener("submit", saveTask);
  $("reminderForm").addEventListener("submit", saveReminder);
  $("noteForm").addEventListener("submit", saveNote);

  $$(".close-modal").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  $$(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.classList.remove("active");
    });
  });

  $("taskSearch").addEventListener("input", renderTasks);
  $("taskStatusFilter").addEventListener("change", renderTasks);
  $("taskPriorityFilter").addEventListener("change", renderTasks);
  $("noteSearch").addEventListener("input", renderNotes);

  $("markAllReadBtn").addEventListener("click", markAllNotificationsRead);

  $("prevMonthBtn").addEventListener("click", () => changeMonth(-1));
  $("nextMonthBtn").addEventListener("click", () => changeMonth(1));
  $("todayBtn").addEventListener("click", () => {
    currentCalendarDate = new Date();
    syncCalendarSelectors();
    renderCalendar();
  });
  $("calendarMonth").addEventListener("change", updateCalendarFromSelectors);
  $("calendarYear").addEventListener("change", updateCalendarFromSelectors);

  $("darkModeSwitch").addEventListener("change", (e) => {
    data.settings.theme = e.target.checked ? "dark" : "light";
    saveData();
    applyTheme();
  });

  $("notificationSwitch").addEventListener("change", (e) => {
    data.settings.notifications = e.target.checked;
    saveData();
  });

  $("soundSwitch").addEventListener("change", (e) => {
    data.settings.sound = e.target.checked;
    saveData();
  });

  $("dateFormatSelect").addEventListener("change", (e) => {
    data.settings.dateFormat = e.target.value;
    saveData();
    renderAll();
  });

  $("timeFormatSelect").addEventListener("change", (e) => {
    data.settings.timeFormat = e.target.value;
    saveData();
    renderAll();
  });

  $("changePasswordBtn").addEventListener("click", changePassword);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $$(".modal-backdrop.active").forEach((m) => m.classList.remove("active"));
    }
  });
}

function switchAuth(mode) {
  const isLogin = mode === "login";
  $("loginForm").classList.toggle("active", isLogin);
  $("registerForm").classList.toggle("active", !isLogin);
  $("showLoginBtn").classList.toggle("active", isLogin);
  $("showRegisterBtn").classList.toggle("active", !isLogin);
  $("loginError").textContent = "";
  $("registerError").textContent = "";
}

function handleRegister(e) {
  e.preventDefault();

  const username = $("registerUsername").value.trim();
  const password = $("registerPassword").value;
  const confirm = $("confirmPassword").value;

  if (username.length < 3) {
    $("registerError").textContent = "User ID must be at least 3 characters.";
    return;
  }

  if (password.length < 4) {
    $("registerError").textContent = "Password must be at least 4 characters.";
    return;
  }

  if (password !== confirm) {
    $("registerError").textContent = "Passwords do not match.";
    return;
  }

  data.user = {
    username,
    password,
    loggedIn: false,
    createdAt: new Date().toISOString()
  };

  addActivity("Account created");
  saveData();

  $("registerForm").reset();
  switchAuth("login");
  $("loginUsername").value = username;
  showToast("Account created successfully. You can now login.", "success");
}

function handleLogin(e) {
  e.preventDefault();

  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value;

  if (!data.user) {
    $("loginError").textContent = "No account found. Please create an account first.";
    return;
  }

  if (username !== data.user.username || password !== data.user.password) {
    $("loginError").textContent = "Incorrect user ID or password.";
    return;
  }

  data.user.loggedIn = true;
  addActivity("Logged in");
  saveData();

  $("welcomeTitle").textContent = `Welcome, ${data.user.username}`;
  showScreen("welcomeScreen");

  setTimeout(() => {
    showScreen("appScreen");
    initializeApp();
  }, 1800);
}

function logout() {
  if (data.user) data.user.loggedIn = false;
  addActivity("Logged out");
  saveData();
  $("sidebar").classList.remove("open");
  showScreen("authScreen");
  $("loginPassword").value = "";
  $("loginError").textContent = "";
}

function showScreen(id) {
  $$(".screen").forEach((screen) => screen.classList.remove("active"));
  $(id).classList.add("active");
}

function initializeApp() {
  $("topUsername").textContent = data.user?.username || "User";
  $("topAvatar").textContent = (data.user?.username || "U").charAt(0).toUpperCase();
  $("settingsUsername").value = data.user?.username || "";
  $("notificationSwitch").checked = !!data.settings.notifications;
  $("soundSwitch").checked = !!data.settings.sound;
  $("darkModeSwitch").checked = data.settings.theme === "dark";
  $("dateFormatSelect").value = data.settings.dateFormat;
  $("timeFormatSelect").value = data.settings.timeFormat;

  navigate("dashboardPage");
  syncCalendarSelectors();
  renderAll();
}

function navigate(pageId) {
  $$(".page").forEach((page) => page.classList.remove("active"));
  $(pageId).classList.add("active");

  $$(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  const headings = {
    dashboardPage: "Overview",
    tasksPage: "Tasks",
    remindersPage: "Task Reminder",
    notificationsPage: "Notifications",
    notesPage: "Notes",
    calendarPage: "Calendar",
    settingsPage: "Settings"
  };

  $("pageHeading").textContent = headings[pageId] || "WorkDesk";
  $("sidebar").classList.remove("open");

  if (pageId === "notificationsPage") {
    renderNotifications();
  }
  if (pageId === "calendarPage") {
    renderCalendar();
  }
}

function renderAll() {
  renderDashboard();
  renderTasks();
  renderReminders();
  renderNotifications();
  renderNotes();
  renderCalendar();
  renderReminderTaskOptions();
  updateTopUnreadCount();
}

function renderDashboard() {
  const pending = data.tasks.filter((t) => !t.completed);
  const completed = data.tasks.filter((t) => t.completed);
  const futureReminders = data.reminders.filter((r) => reminderDateTime(r) >= new Date());
  const unread = data.notifications.filter((n) => !n.read);

  $("pendingStat").textContent = pending.length;
  $("completedStat").textContent = completed.length;
  $("reminderStat").textContent = futureReminders.length;
  $("notificationStat").textContent = unread.length;

  const upcomingTasks = [...pending]
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  $("dashboardTaskList").innerHTML = upcomingTasks.length
    ? upcomingTasks.map((task) => `
      <div class="mini-item">
        <strong>${escapeHtml(task.title)}</strong>
        <p>${formatDate(task.dueDate)} • ${escapeHtml(task.priority)} priority</p>
      </div>
    `).join("")
    : emptyState("No pending tasks.");

  const upcomingReminders = [...futureReminders]
    .sort((a, b) => reminderDateTime(a) - reminderDateTime(b))
    .slice(0, 5);

  $("dashboardReminderList").innerHTML = upcomingReminders.length
    ? upcomingReminders.map((r) => `
      <div class="mini-item">
        <strong>${escapeHtml(r.title)}</strong>
        <p>${formatDate(r.date)} • ${formatTime(r.time)}</p>
      </div>
    `).join("")
    : emptyState("No upcoming reminders.");

  const notes = [...data.notes]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);

  $("dashboardNoteList").innerHTML = notes.length
    ? notes.map((note) => `
      <div class="mini-item">
        <strong>${escapeHtml(note.title)}</strong>
        <p>${escapeHtml(truncate(note.body, 80))}</p>
      </div>
    `).join("")
    : emptyState("No notes yet.");

  const activity = data.activity.slice(0, 6);
  $("dashboardActivityList").innerHTML = activity.length
    ? activity.map((item) => `
      <div class="mini-item">
        <strong>${escapeHtml(item.message)}</strong>
        <p>${formatDateTime(item.time)}</p>
      </div>
    `).join("")
    : emptyState("No recent activity.");
}

function renderTasks() {
  const search = $("taskSearch")?.value.toLowerCase().trim() || "";
  const status = $("taskStatusFilter")?.value || "all";
  const priority = $("taskPriorityFilter")?.value || "all";

  const filtered = data.tasks
    .filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(search) ||
        (task.description || "").toLowerCase().includes(search);

      const matchesStatus =
        status === "all" ||
        (status === "completed" && task.completed) ||
        (status === "pending" && !task.completed);

      const matchesPriority = priority === "all" || task.priority === priority;

      return matchesSearch && matchesStatus && matchesPriority;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

  $("taskList").innerHTML = filtered.length
    ? filtered.map((task) => `
      <article class="task-card ${task.completed ? "completed" : ""}">
        <input
          class="task-check"
          type="checkbox"
          ${task.completed ? "checked" : ""}
          onchange="toggleTaskComplete('${task.id}')"
          aria-label="Toggle complete"
        />

        <div>
          <div class="task-title-row">
            <h3>${escapeHtml(task.title)}</h3>
            <span class="priority ${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>
          </div>
          <p>${escapeHtml(task.description || "No description")}</p>
          <div class="task-meta">
            <span>Due: ${formatDate(task.dueDate)}</span>
            <span>Status: ${task.completed ? "Completed" : "Pending"}</span>
          </div>
        </div>

        <div class="card-actions">
          <button class="small-btn" onclick="editTask('${task.id}')">Edit</button>
          <button class="small-btn danger" onclick="deleteTask('${task.id}')">Delete</button>
        </div>
      </article>
    `).join("")
    : emptyState("No tasks found.");
}

function openTaskModal(task = null) {
  $("taskForm").reset();
  $("taskId").value = "";
  $("taskModalTitle").textContent = task ? "Edit Task" : "New Task";
  $("taskPriority").value = "Medium";

  if (task) {
    $("taskId").value = task.id;
    $("taskTitle").value = task.title;
    $("taskDescription").value = task.description || "";
    $("taskDate").value = task.dueDate;
    $("taskPriority").value = task.priority;
  } else {
    $("taskDate").value = toDateInput(new Date());
  }

  $("taskModal").classList.add("active");
  setTimeout(() => $("taskTitle").focus(), 30);
}

function saveTask(e) {
  e.preventDefault();

  const id = $("taskId").value;
  const task = {
    id: id || uid(),
    title: $("taskTitle").value.trim(),
    description: $("taskDescription").value.trim(),
    dueDate: $("taskDate").value,
    priority: $("taskPriority").value,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (id) {
    const index = data.tasks.findIndex((t) => t.id === id);
    if (index !== -1) {
      task.completed = data.tasks[index].completed;
      task.createdAt = data.tasks[index].createdAt;
      data.tasks[index] = task;
      addActivity(`Task updated: ${task.title}`);
    }
  } else {
    data.tasks.push(task);
    addActivity(`Task created: ${task.title}`);
  }

  saveData();
  closeModal("taskModal");
  renderAll();
  showToast(id ? "Task updated." : "Task created.", "success");
}

function editTask(id) {
  const task = data.tasks.find((t) => t.id === id);
  if (task) openTaskModal(task);
}

function deleteTask(id) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return;

  if (!confirm(`Delete task "${task.title}"?`)) return;

  data.tasks = data.tasks.filter((t) => t.id !== id);
  data.reminders = data.reminders.map((r) =>
    r.taskId === id ? { ...r, taskId: "" } : r
  );

  addActivity(`Task deleted: ${task.title}`);
  saveData();
  renderAll();
  showToast("Task deleted.");
}

function toggleTaskComplete(id) {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  task.updatedAt = new Date().toISOString();
  addActivity(`${task.completed ? "Task completed" : "Task reopened"}: ${task.title}`);
  saveData();
  renderAll();
}

function renderReminderTaskOptions() {
  const select = $("reminderTask");
  if (!select) return;

  const current = select.value;
  select.innerHTML = `<option value="">No related task</option>` +
    data.tasks.map((task) => `<option value="${task.id}">${escapeHtml(task.title)}</option>`).join("");

  select.value = current;
}

function renderReminders() {
  const reminders = [...data.reminders]
    .sort((a, b) => reminderDateTime(a) - reminderDateTime(b));

  $("reminderList").innerHTML = reminders.length
    ? reminders.map((r) => {
        const task = data.tasks.find((t) => t.id === r.taskId);
        const past = reminderDateTime(r) < new Date();

        return `
          <article class="reminder-card">
            <h3>${escapeHtml(r.title)}</h3>
            <div class="reminder-time">${formatDate(r.date)} • ${formatTime(r.time)}</div>
            <p class="muted">${task ? `Related task: ${escapeHtml(task.title)}` : "No related task"}</p>
            <p class="muted">${r.triggered ? "Triggered" : past ? "Past due" : "Scheduled"}</p>
            <div class="card-actions">
              <button class="small-btn" onclick="editReminder('${r.id}')">Edit</button>
              <button class="small-btn danger" onclick="deleteReminder('${r.id}')">Delete</button>
            </div>
          </article>
        `;
      }).join("")
    : emptyState("No reminders scheduled.");
}

function openReminderModal(reminder = null) {
  $("reminderForm").reset();
  $("reminderId").value = "";
  $("reminderModalTitle").textContent = reminder ? "Edit Reminder" : "New Reminder";
  renderReminderTaskOptions();

  if (reminder) {
    $("reminderId").value = reminder.id;
    $("reminderTitle").value = reminder.title;
    $("reminderTask").value = reminder.taskId || "";
    $("reminderDate").value = reminder.date;
    $("reminderTime").value = reminder.time;
  } else {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    $("reminderDate").value = toDateInput(now);
    $("reminderTime").value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  $("reminderModal").classList.add("active");
}

function saveReminder(e) {
  e.preventDefault();

  const id = $("reminderId").value;
  const reminder = {
    id: id || uid(),
    title: $("reminderTitle").value.trim(),
    taskId: $("reminderTask").value,
    date: $("reminderDate").value,
    time: $("reminderTime").value,
    triggered: false,
    createdAt: new Date().toISOString()
  };

  if (id) {
    const index = data.reminders.findIndex((r) => r.id === id);
    if (index !== -1) {
      reminder.createdAt = data.reminders[index].createdAt;
      data.reminders[index] = reminder;
      addActivity(`Reminder updated: ${reminder.title}`);
    }
  } else {
    data.reminders.push(reminder);
    addActivity(`Reminder scheduled: ${reminder.title}`);
  }

  saveData();
  closeModal("reminderModal");
  renderAll();
  showToast(id ? "Reminder updated." : "Reminder scheduled.", "success");
}

function editReminder(id) {
  const reminder = data.reminders.find((r) => r.id === id);
  if (reminder) openReminderModal(reminder);
}

function deleteReminder(id) {
  const reminder = data.reminders.find((r) => r.id === id);
  if (!reminder) return;

  if (!confirm(`Delete reminder "${reminder.title}"?`)) return;

  data.reminders = data.reminders.filter((r) => r.id !== id);
  addActivity(`Reminder deleted: ${reminder.title}`);
  saveData();
  renderAll();
  showToast("Reminder deleted.");
}

function checkReminders() {
  const now = new Date();
  let changed = false;

  data.reminders.forEach((reminder) => {
    const when = reminderDateTime(reminder);
    if (!reminder.triggered && when <= now) {
      reminder.triggered = true;
      changed = true;

      const message = `Reminder: ${reminder.title}`;

      if (data.settings.notifications) {
        addNotification(reminder.title, `Scheduled for ${formatDate(reminder.date)} at ${formatTime(reminder.time)}.`, "reminder");
        showToast(message, "success");
      }

      if (data.settings.sound) {
        playReminderSound();
      }

      addActivity(`Reminder triggered: ${reminder.title}`);
    }
  });

  if (changed) {
    saveData();
    renderAll();
  }
}

function playReminderSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    setTimeout(() => ctx.close(), 700);
  } catch {}
}

function addNotification(title, message, type = "system") {
  data.notifications.unshift({
    id: uid(),
    title,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString()
  });
}

function renderNotifications() {
  const notifications = [...data.notifications].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  $("notificationList").innerHTML = notifications.length
    ? notifications.map((n) => `
      <article class="notification-card ${n.read ? "" : "unread"}" onclick="markNotificationRead('${n.id}')">
        <div class="notification-icon">${n.type === "reminder" ? "⏰" : "🔔"}</div>
        <div>
          <h4>${escapeHtml(n.title)}</h4>
          <p>${escapeHtml(n.message)}</p>
          <small>${formatDateTime(n.createdAt)}</small>
        </div>
      </article>
    `).join("")
    : emptyState("No notifications.");

  updateTopUnreadCount();
}

function markNotificationRead(id) {
  const notification = data.notifications.find((n) => n.id === id);
  if (!notification) return;

  notification.read = true;
  saveData();
  renderNotifications();
  renderDashboard();
}

function markAllNotificationsRead() {
  data.notifications.forEach((n) => n.read = true);
  saveData();
  renderNotifications();
  renderDashboard();
  showToast("All notifications marked as read.", "success");
}

function updateTopUnreadCount() {
  const count = data.notifications.filter((n) => !n.read).length;
  $("topUnreadCount").textContent = count;
  $("topUnreadCount").style.display = count ? "grid" : "none";
}

function renderNotes() {
  const search = $("noteSearch")?.value.toLowerCase().trim() || "";

  const notes = [...data.notes]
    .filter((note) =>
      note.title.toLowerCase().includes(search) ||
      note.body.toLowerCase().includes(search)
    )
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  $("notesGrid").innerHTML = notes.length
    ? notes.map((note) => `
      <article class="note-card">
        <h3>${escapeHtml(note.title)}</h3>
        <p>${escapeHtml(truncate(note.body, 260))}</p>
        <small class="muted">Updated ${formatDateTime(note.updatedAt)}</small>
        <div class="card-actions" style="margin-top:12px">
          <button class="small-btn" onclick="editNote('${note.id}')">Edit</button>
          <button class="small-btn danger" onclick="deleteNote('${note.id}')">Delete</button>
        </div>
      </article>
    `).join("")
    : emptyState("No notes found.");
}

function openNoteModal(note = null) {
  $("noteForm").reset();
  $("noteId").value = "";
  $("noteModalTitle").textContent = note ? "Edit Note" : "New Note";

  if (note) {
    $("noteId").value = note.id;
    $("noteTitle").value = note.title;
    $("noteBody").value = note.body;
  }

  $("noteModal").classList.add("active");
}

function saveNote(e) {
  e.preventDefault();

  const id = $("noteId").value;
  const now = new Date().toISOString();

  const note = {
    id: id || uid(),
    title: $("noteTitle").value.trim(),
    body: $("noteBody").value.trim(),
    createdAt: now,
    updatedAt: now
  };

  if (id) {
    const index = data.notes.findIndex((n) => n.id === id);
    if (index !== -1) {
      note.createdAt = data.notes[index].createdAt;
      data.notes[index] = note;
      addActivity(`Note updated: ${note.title}`);
    }
  } else {
    data.notes.unshift(note);
    addActivity(`Note created: ${note.title}`);
  }

  saveData();
  closeModal("noteModal");
  renderAll();
  showToast(id ? "Note updated." : "Note created.", "success");
}

function editNote(id) {
  const note = data.notes.find((n) => n.id === id);
  if (note) openNoteModal(note);
}

function deleteNote(id) {
  const note = data.notes.find((n) => n.id === id);
  if (!note) return;

  if (!confirm(`Delete note "${note.title}"?`)) return;

  data.notes = data.notes.filter((n) => n.id !== id);
  addActivity(`Note deleted: ${note.title}`);
  saveData();
  renderAll();
  showToast("Note deleted.");
}

function buildCalendarSelectors() {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  $("calendarMonth").innerHTML = months
    .map((month, index) => `<option value="${index}">${month}</option>`)
    .join("");

  let years = "";
  for (let year = 2020; year <= 2050; year++) {
    years += `<option value="${year}">${year}</option>`;
  }
  $("calendarYear").innerHTML = years;

  syncCalendarSelectors();
}

function syncCalendarSelectors() {
  $("calendarMonth").value = currentCalendarDate.getMonth();
  $("calendarYear").value = currentCalendarDate.getFullYear();
}

function updateCalendarFromSelectors() {
  currentCalendarDate = new Date(
    Number($("calendarYear").value),
    Number($("calendarMonth").value),
    1
  );
  renderCalendar();
}

function changeMonth(delta) {
  currentCalendarDate = new Date(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth() + delta,
    1
  );
  syncCalendarSelectors();
  renderCalendar();
}

function renderCalendar() {
  if (!$("calendarGrid")) return;

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());

  let html = "";

  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);

    const iso = toDateInput(day);
    const inMonth = day.getMonth() === month;
    const today = isSameDate(day, new Date());

    const taskEvents = data.tasks
      .filter((t) => t.dueDate === iso)
      .slice(0, 2);

    const reminderEvents = data.reminders
      .filter((r) => r.date === iso)
      .slice(0, 2);

    html += `
      <div class="calendar-day ${inMonth ? "" : "other-month"} ${today ? "today" : ""}" onclick="calendarDay('${iso}')">
        <span class="day-number">${day.getDate()}</span>
        <div class="calendar-events">
          ${taskEvents.map((t) => `<div class="calendar-event" title="${escapeHtml(t.title)}">Task: ${escapeHtml(t.title)}</div>`).join("")}
          ${reminderEvents.map((r) => `<div class="calendar-event reminder" title="${escapeHtml(r.title)}">Reminder: ${escapeHtml(r.title)}</div>`).join("")}
        </div>
      </div>
    `;
  }

  $("calendarGrid").innerHTML = html;
}

function calendarDay(iso) {
  openTaskModal();
  $("taskDate").value = iso;
}

function applyTheme() {
  const dark = data.settings.theme === "dark";
  document.body.classList.toggle("dark", dark);
  $("themeToggleBtn").textContent = dark ? "☀️" : "🌙";
  $("darkModeSwitch").checked = dark;
}

function toggleTheme() {
  data.settings.theme = data.settings.theme === "dark" ? "light" : "dark";
  saveData();
  applyTheme();
}

function changePassword() {
  if (!data.user) return;

  const current = $("currentPassword").value;
  const next = $("newPassword").value;

  if (current !== data.user.password) {
    showToast("Current password is incorrect.", "error");
    return;
  }

  if (next.length < 4) {
    showToast("New password must be at least 4 characters.", "error");
    return;
  }

  data.user.password = next;
  addActivity("Password changed");
  saveData();

  $("currentPassword").value = "";
  $("newPassword").value = "";
  showToast("Password changed successfully.", "success");
}

function addActivity(message) {
  data.activity.unshift({
    id: uid(),
    message,
    time: new Date().toISOString()
  });

  data.activity = data.activity.slice(0, 50);
}

function closeModal(id) {
  $(id).classList.remove("active");
}

function updateTodayLabel() {
  $("todayLabel").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const d = new Date(`${dateString}T00:00:00`);
  const format = data.settings.dateFormat || "DD/MM/YYYY";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  if (format === "MM/DD/YYYY") return `${mm}/${dd}/${yyyy}`;
  if (format === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
  return `${dd}/${mm}/${yyyy}`;
}

function formatTime(timeString) {
  if (!timeString) return "-";

  const [h, m] = timeString.split(":").map(Number);

  if (data.settings.timeFormat === "24") {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatDateTime(isoString) {
  const d = new Date(isoString);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: data.settings.timeFormat === "24" ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: data.settings.timeFormat !== "24"
  }).format(d);
}

function reminderDateTime(reminder) {
  return new Date(`${reminder.date}T${reminder.time || "00:00"}:00`);
}

function toDateInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, type = "") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  $("toastContainer").appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

window.editTask = editTask;
window.deleteTask = deleteTask;
window.toggleTaskComplete = toggleTaskComplete;
window.editReminder = editReminder;
window.deleteReminder = deleteReminder;
window.markNotificationRead = markNotificationRead;
window.editNote = editNote;
window.deleteNote = deleteNote;
window.calendarDay = calendarDay;
