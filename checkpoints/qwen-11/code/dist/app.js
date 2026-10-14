import { 
  DEMO_WEEK, 
  seedState, 
  loadFor, 
  validateTask, 
  proposePlan, 
  applyPlan, 
  isValidState,
  monday
} from './domain.js';

// DOM elements
let appEl;
let boardEl;
let employeesViewEl;
let taskFormEl;
let planPreviewEl;
let currentWeekEl;
let searchInputEl;
let filterAssigneeEl;
let viewBoardBtn;
let viewEmployeesBtn;
let newTaskBtn;
let prevWeekBtn;
let nextWeekBtn;
let proposePlanBtn;
let planApplyBtn;
let planCancelBtn;
let resetDemoBtn;

// Application state
let state = loadState();
let currentWeek = DEMO_WEEK;
let currentView = 'board'; // 'board' or 'employees'
let searchQuery = '';
let filterAssignee = '';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  appEl = document.querySelector('[data-testid="app"]');
  boardEl = document.querySelector('[data-testid="board"]');
  employeesViewEl = document.querySelector('[data-testid="employees-view"]');
  taskFormEl = document.querySelector('[data-testid="task-form"]');
  planPreviewEl = document.querySelector('[data-testid="plan-preview"]');
  currentWeekEl = document.querySelector('[data-testid="current-week"]');
  searchInputEl = document.querySelector('[data-testid="search"]');
  filterAssigneeEl = document.querySelector('[data-testid="filter-assignee"]');
  viewBoardBtn = document.querySelector('[data-testid="view-board"]');
  viewEmployeesBtn = document.querySelector('[data-testid="view-employees"]');
  newTaskBtn = document.querySelector('[data-testid="new-task"]');
  prevWeekBtn = document.querySelector('[data-testid="prev-week"]');
  nextWeekBtn = document.querySelector('[data-testid="next-week"]');
  proposePlanBtn = document.querySelector('[data-testid="propose-plan"]');
  planApplyBtn = document.querySelector('[data-testid="plan-apply"]');
  planCancelBtn = document.querySelector('[data-testid="plan-cancel-modal"]');
  resetDemoBtn = document.querySelector('[data-testid="reset-demo"]');

  // Set up event listeners
  setupEventListeners();

  // Render initial state
  render();
});

// Set up event listeners
function setupEventListeners() {
  // Week navigation
  prevWeekBtn.addEventListener('click', () => {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() - 7);
    currentWeek = monday(date.toISOString().split('T')[0]);
    render();
  });

  nextWeekBtn.addEventListener('click', () => {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() + 7);
    currentWeek = monday(date.toISOString().split('T')[0]);
    render();
  });

  // Search and filter
  searchInputEl.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
  });

  filterAssigneeEl.addEventListener('change', (e) => {
    filterAssignee = e.target.value;
    render();
  });

  // View toggle
  viewBoardBtn.addEventListener('click', () => {
    currentView = 'board';
    render();
  });

  viewEmployeesBtn.addEventListener('click', () => {
    currentView = 'employees';
    render();
  });

  // New task
  newTaskBtn.addEventListener('click', () => {
    openTaskForm();
  });

  // Plan actions
  proposePlanBtn.addEventListener('click', proposePlanHandler);
  planApplyBtn.addEventListener('click', applyPlanHandler);
  planCancelBtn.addEventListener('click', cancelPlanHandler);
  resetDemoBtn.addEventListener('click', resetDemoHandler);

  // Task form events
  document.getElementById('task-save').addEventListener('click', saveTask);
  document.getElementById('task-cancel-header').addEventListener('click', cancelTask);
  document.getElementById('task-cancel-footer').addEventListener('click', cancelTask);
  
  // Set up drag and drop for the board
  setupBoardDragAndDrop();
  
  // Capacity change events are now handled in renderMetrics
}

// Set up drag and drop for the board using event delegation
function setupBoardDragAndDrop() {
  // Complete drag and drop implementation with all events
  document.addEventListener('dragstart', (e) => {
    const taskEl = e.target.closest('.task-card');
    if (taskEl && taskEl.dataset.taskId) {
      e.dataTransfer.setData('text/plain', taskEl.dataset.taskId);
      e.dataTransfer.effectAllowed = 'move';
      taskEl.classList.add('dragging');
    }
  });

  document.addEventListener('dragend', (e) => {
    const taskEl = e.target.closest('.task-card');
    if (taskEl) {
      taskEl.classList.remove('dragging');
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  document.addEventListener('dragenter', (e) => {
    const column = e.target.closest('.column');
    if (column) {
      column.classList.add('over');
    }
  });

  document.addEventListener('dragleave', (e) => {
    const column = e.target.closest('.column');
    if (column && !column.contains(e.relatedTarget)) {
      column.classList.remove('over');
    }
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    
    // Remove 'over' class from all columns
    document.querySelectorAll('.column').forEach(col => {
      col.classList.remove('over');
    });
    
    const taskId = e.dataTransfer.getData('text/plain');
    const column = e.target.closest('.column[data-testid^="column-"]');
    
    if (taskId && column) {
      const status = column.dataset.testid.replace('column-', '');
      
      if (['todo', 'doing', 'done'].includes(status)) {
        const taskIndex = state.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          state.tasks[taskIndex].status = status;
          saveState();
          render();
        }
      }
    }
  });
}

// Render the application
function render() {
  renderWeek();
  renderMetrics();
  renderFilters();
  renderViewToggle();
  
  if (currentView === 'board') {
    renderBoard();
  } else {
    renderEmployeesView();
  }
}

// Render current week
function renderWeek() {
  currentWeekEl.textContent = formatDate(currentWeek);
}

// Render employee metrics
function renderMetrics() {
  const employeesContainer = document.querySelector('.employee-metrics');
  if (!employeesContainer) return;
  
  employeesContainer.innerHTML = '';
  
  state.employees.forEach(employee => {
    const load = loadFor(state, employee.id, currentWeek);
    const capacity = employee.capacities[currentWeek] !== undefined ? 
      employee.capacities[currentWeek] : employee.capacity;
    
    const employeeEl = document.createElement('div');
    employeeEl.className = 'employee-card';
    employeeEl.dataset.testid = `employee-${employee.id}`;
    
    employeeEl.innerHTML = `
      <div class="employee-header">
        <div>
          <h3 class="employee-name">${employee.name}</h3>
          <p class="employee-role">${employee.role}</p>
        </div>
        <div class="employee-initials" style="background: ${employee.color}">${employee.initials}</div>
      </div>
      <div class="employee-stats">
        <div class="stat-item">
          <span class="stat-label">Загрузка</span>
          <span class="stat-value load-value ${load.overload > 0 ? 'overload' : ''}" data-testid="load-${employee.id}">
            ${load.hours}/${capacity} ч
            ${load.overload > 0 ? ` (+${load.overload} ч)` : ''}
            ${load.percent !== null ? ` ${load.percent}%` : ''}
          </span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Прогресс</span>
          <span class="stat-value progress-value ${load.progress < 30 ? 'low' : load.progress > 70 ? 'high' : ''}" data-testid="progress-${employee.id}">
            ${load.progress}%
          </span>
        </div>
        <div class="stat-item">
          <div class="progress-container">
            <div class="progress-bar" role="progressbar" aria-valuenow="${load.progress}" aria-valuemin="0" aria-valuemax="100" style="width: ${load.progress}%">
              <span class="progress-bar-text">${load.progress}%</span>
            </div>
          </div>
        </div>
        <div class="stat-item">
          <span class="stat-label">Доступность</span>
          <input type="number" min="0" max="168" step="1" 
                 class="capacity-input" 
                 data-testid="capacity-${employee.id}"
                 value="${capacity}">
        </div>
      </div>
    `;
    
    employeesContainer.appendChild(employeeEl);
  });
  
  // Reattach event listeners for capacity inputs
  document.querySelectorAll('[data-testid^="capacity-"]').forEach(input => {
    input.addEventListener('change', (e) => {
      const employeeId = e.target.dataset.testid.replace('capacity-', '');
      updateEmployeeCapacity(employeeId, parseFloat(e.target.value) || 0);
    });
  });
}

// Render filters
function renderFilters() {
  // Update filter assignee options
  const currentFilterValue = filterAssigneeEl.value;
  filterAssigneeEl.innerHTML = '<option value="">Все сотрудники</option>';
  
  state.employees.forEach(employee => {
    const option = document.createElement('option');
    option.value = employee.id;
    option.textContent = employee.name;
    filterAssigneeEl.appendChild(option);
  });
  
  filterAssigneeEl.value = currentFilterValue;
}

// Render view toggle
function renderViewToggle() {
  viewBoardBtn.classList.toggle('active', currentView === 'board');
  viewEmployeesBtn.classList.toggle('active', currentView === 'employees');
  
  boardEl.style.display = currentView === 'board' ? 'grid' : 'none';
  employeesViewEl.style.display = currentView === 'employees' ? 'block' : 'none';
}

// Render board view
function renderBoard() {
  // Filter tasks for current week
  const weekTasks = state.tasks.filter(task => task.week === currentWeek);
  
  // Apply search filter
  const filteredTasks = weekTasks.filter(task => {
    const matchesSearch = searchQuery === '' || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      task.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAssignee = filterAssignee === '' || task.assignee === filterAssignee;
    
    return matchesSearch && matchesAssignee;
  });
  
  // Group tasks by status
  const todoTasks = filteredTasks.filter(task => task.status === 'todo');
  const doingTasks = filteredTasks.filter(task => task.status === 'doing');
  const doneTasks = filteredTasks.filter(task => task.status === 'done');
  
  // Render columns
  renderColumn('todo', todoTasks);
  renderColumn('doing', doingTasks);
  renderColumn('done', doneTasks);
  
  // Drag and drop is already set up in setupEventListeners, no need to call it again
}

// Render a column
function renderColumn(status, tasks) {
  const columnEl = document.querySelector(`[data-testid="column-${status}"]`);
  const taskListEl = columnEl.querySelector('.task-list');
  
  // Update column count
  columnEl.querySelector('.column-count').textContent = tasks.length;
  
  // Render tasks
  taskListEl.innerHTML = '';
  
  tasks.forEach(task => {
    const taskEl = createTaskElement(task);
    taskListEl.appendChild(taskEl);
  });
}

// Create task element
function createTaskElement(task) {
  const taskEl = document.createElement('div');
  taskEl.className = 'task-card';
  taskEl.draggable = true;
  taskEl.dataset.testid = `task-${task.id}`;
  taskEl.dataset.taskId = task.id; // Add taskId as a data attribute
  
  // Find assignee info
  let assigneeInfo = { name: 'Без ответственного', initials: '', color: '#cccccc' };
  if (task.assignee) {
    const assignee = state.employees.find(e => e.id === task.assignee);
    if (assignee) {
      assigneeInfo = assignee;
    }
  }
  
  taskEl.innerHTML = `
    <h4 class="task-title">${task.title}</h4>
    <div class="task-meta">
      <span class="task-hours">${task.hours} ч</span>
      <div class="task-assignee">
        <span class="assignee-initials" style="background: ${assigneeInfo.color}">${assigneeInfo.initials || '?'}</span>
        <span>${assigneeInfo.name}</span>
      </div>
    </div>
    <div class="task-actions">
      <button class="btn btn-sm" data-testid="edit-${task.id}">Редактировать</button>
      <button class="btn btn-sm btn-danger" data-testid="delete-${task.id}">Удалить</button>
    </div>
  `;
  
  // Always add event listeners since elements are recreated on each render
  // Add edit and delete event listeners
  taskEl.querySelector(`[data-testid="edit-${task.id}"]`).addEventListener('click', () => {
    openTaskForm(task);
  });
  
  taskEl.querySelector(`[data-testid="delete-${task.id}"]`).addEventListener('click', () => {
    deleteTask(task.id);
  });
  
  return taskEl;
}

// Render employees view
function renderEmployeesView() {
  const weekTasks = state.tasks.filter(task => task.week === currentWeek);
  
  // Apply search filter
  const filteredTasks = weekTasks.filter(task => {
    const matchesSearch = searchQuery === '' || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      task.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // For employee view, we don't apply assignee filter
    return matchesSearch;
  });
  
  // Group tasks by assignee
  const tasksByAssignee = {};
  filteredTasks.forEach(task => {
    const assigneeId = task.assignee || 'unassigned';
    if (!tasksByAssignee[assigneeId]) {
      tasksByAssignee[assigneeId] = [];
    }
    tasksByAssignee[assigneeId].push(task);
  });
  
  // Render employee sections
  employeesViewEl.innerHTML = '';
  
  // Render each employee
  state.employees.forEach(employee => {
    const employeeTasks = tasksByAssignee[employee.id] || [];
    const employeeSection = createEmployeeSection(employee, employeeTasks);
    employeesViewEl.appendChild(employeeSection);
  });
  
  // Render unassigned tasks
  if (tasksByAssignee.unassigned && tasksByAssignee.unassigned.length > 0) {
    const unassignedSection = createUnassignedSection(tasksByAssignee.unassigned);
    employeesViewEl.appendChild(unassignedSection);
  }
  
  // If no tasks match filters
  if (filteredTasks.length === 0) {
    employeesViewEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3 class="empty-state-title">Задачи не найдены</h3>
        <p class="empty-state-text">Попробуйте изменить параметры поиска</p>
      </div>
    `;
  }
}

// Create employee section
function createEmployeeSection(employee, tasks) {
  const sectionEl = document.createElement('div');
  sectionEl.className = 'employee-section';
  sectionEl.dataset.testid = `employee-${employee.id}`;
  
  // Group tasks by status
  const todoTasks = tasks.filter(task => task.status === 'todo');
  const doingTasks = tasks.filter(task => task.status === 'doing');
  const doneTasks = tasks.filter(task => task.status === 'done');
  
  sectionEl.innerHTML = `
    <div class="employee-section-header">
      <h3 class="employee-section-title">
        <span class="assignee-initials" style="background: ${employee.color}">${employee.initials}</span>
        ${employee.name}
        <span>(${tasks.length} задач)</span>
      </h3>
    </div>
    <table class="task-table">
      <thead>
        <tr>
          <th>Задача</th>
          <th>Часы</th>
          <th>Статус</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(task => `
          <tr data-testid="task-${task.id}">
            <td>${task.title}</td>
            <td>${task.hours} ч</td>
            <td>${getStatusText(task.status)}</td>
            <td>
              <button class="btn btn-sm" data-testid="edit-${task.id}">Редактировать</button>
              <button class="btn btn-sm btn-danger" data-testid="delete-${task.id}">Удалить</button>
            </td>
          </tr>
        `).join('')}
        ${tasks.length === 0 ? `
          <tr>
            <td colspan="4" class="text-center">Нет задач</td>
          </tr>
        ` : ''}
      </tbody>
    </table>
  `;
  
  // Add event listeners for edit/delete buttons
  tasks.forEach(task => {
    sectionEl.querySelector(`[data-testid="edit-${task.id}"]`).addEventListener('click', () => {
      openTaskForm(task);
    });
    
    sectionEl.querySelector(`[data-testid="delete-${task.id}"]`).addEventListener('click', () => {
      deleteTask(task.id);
    });
  });
  
  return sectionEl;
}

// Create unassigned section
function createUnassignedSection(tasks) {
  const sectionEl = document.createElement('div');
  sectionEl.className = 'employee-section';
  
  sectionEl.innerHTML = `
    <div class="employee-section-header">
      <h3 class="employee-section-title">
        Без ответственного
        <span>(${tasks.length} задач)</span>
      </h3>
    </div>
    <table class="task-table">
      <thead>
        <tr>
          <th>Задача</th>
          <th>Часы</th>
          <th>Статус</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(task => `
          <tr data-testid="task-${task.id}">
            <td>${task.title}</td>
            <td>${task.hours} ч</td>
            <td>${getStatusText(task.status)}</td>
            <td>
              <button class="btn btn-sm" data-testid="edit-${task.id}">Редактировать</button>
              <button class="btn btn-sm btn-danger" data-testid="delete-${task.id}">Удалить</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  // Add event listeners for edit/delete buttons
  tasks.forEach(task => {
    sectionEl.querySelector(`[data-testid="edit-${task.id}"]`).addEventListener('click', () => {
      openTaskForm(task);
    });
    
    sectionEl.querySelector(`[data-testid="delete-${task.id}"]`).addEventListener('click', () => {
      deleteTask(task.id);
    });
  });
  
  return sectionEl;
}

// Get status text
function getStatusText(status) {
  switch (status) {
    case 'todo': return 'Новая';
    case 'doing': return 'В работе';
    case 'done': return 'Готово';
    default: return status;
  }
}

// Open task form
function openTaskForm(task = null) {
  const isEditing = !!task;
  
  // Reset form
  document.getElementById('task-form').reset();
  
  // Populate assignee dropdown
  const assigneeSelect = document.getElementById('task-assignee');
  assigneeSelect.innerHTML = '<option value="">Без ответственного</option>';
  state.employees.forEach(employee => {
    const option = document.createElement('option');
    option.value = employee.id;
    option.textContent = employee.name;
    assigneeSelect.appendChild(option);
  });
  
  // Clear any previous error
  const errorEl = document.getElementById('task-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('show');
  }
  
  // Set form values if editing
  if (isEditing) {
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-description').value = task.description;
    document.getElementById('task-hours').value = task.hours;
    document.getElementById('task-assignee').value = task.assignee || '';
    document.getElementById('task-status').value = task.status;
    document.getElementById('task-week').value = task.week;
  } else {
    // Set default values for new task
    document.getElementById('task-week').value = currentWeek;
    document.getElementById('task-status').value = 'todo';
  }
  
  // Update form title
  const modalTitleEl = document.querySelector('.modal-title');
  if (modalTitleEl) {
    modalTitleEl.textContent = isEditing ? 'Редактировать задачу' : 'Новая задача';
  }
  
  // Show modal
  if (taskFormEl) {
    taskFormEl.classList.add('show');
  }
}

// Save task
function saveTask() {
  // Hide any existing error
  const errorEl = document.querySelector('[data-testid="task-error"]');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('show');
  }
  
  try {
    // Get form values
    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const hours = parseFloat(document.getElementById('task-hours').value);
    const assignee = document.getElementById('task-assignee').value || null;
    const status = document.getElementById('task-status').value;
    const week = document.getElementById('task-week').value;
    
    // Create task object
    const task = {
      id: id || `TASK-${state.nextId}`,
      title,
      description,
      assignee,
      hours,
      status,
      week
    };
    
    // Validate task
    const validatedTask = validateTask(task, state.employees);
    
    if (id) {
      // Update existing task
      const taskIndex = state.tasks.findIndex(t => t.id === id);
      if (taskIndex !== -1) {
        state.tasks[taskIndex] = validatedTask;
      }
    } else {
      // Add new task
      state.tasks.push(validatedTask);
      state.nextId++;
    }
    
    // Save state and close form
    saveState();
    if (taskFormEl) {
      taskFormEl.classList.remove('show');
    }
    render();
  } catch (error) {
    // Show error
    const errorDisplayEl = document.querySelector('[data-testid="task-error"]');
    if (errorDisplayEl) {
      errorDisplayEl.textContent = error.message;
      errorDisplayEl.classList.add('show');
    }
    console.error('Task validation error:', error);
  }
}

// Cancel task form
function cancelTask() {
  taskFormEl.classList.remove('show');
}

// Add event listener for the close button in the modal header
document.addEventListener('DOMContentLoaded', () => {
  const taskCancelBtn = document.getElementById('task-cancel');
  if (taskCancelBtn) {
    taskCancelBtn.addEventListener('click', cancelTask);
  }
});

// Delete task
function deleteTask(taskId) {
  if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
    state.tasks = state.tasks.filter(task => task.id !== taskId);
    saveState();
    render();
  }
}

// Update employee capacity
function updateEmployeeCapacity(employeeId, capacity) {
  // Ensure capacity is within bounds
  capacity = Math.max(0, Math.min(168, capacity));
  
  // Find employee
  const employee = state.employees.find(e => e.id === employeeId);
  if (employee) {
    // Set capacity for current week
    if (!employee.capacities) {
      employee.capacities = {};
    }
    employee.capacities[currentWeek] = capacity;
    
    // Save state and re-render
    saveState();
    render();
  }
}

// Propose plan handler
function proposePlanHandler() {
  const plan = proposePlan(state, currentWeek);
  
  // Render plan preview
  const previewListEl = document.querySelector('.plan-preview-list');
  previewListEl.innerHTML = '';
  
  // Show assignments
  plan.assignments.forEach(assignment => {
    const task = state.tasks.find(t => t.id === assignment.taskId);
    const assignee = state.employees.find(e => e.id === assignment.assignee);
    
    if (task && assignee) {
      const itemEl = document.createElement('div');
      itemEl.className = 'plan-preview-item';
      itemEl.innerHTML = `
        <span class="plan-task-title">${task.title}</span>
        <span class="plan-assignee">${assignee.name}</span>
      `;
      previewListEl.appendChild(itemEl);
    }
  });
  
  // Show unassigned hours
  if (plan.unassignedHours > 0) {
    const itemEl = document.createElement('div');
    itemEl.className = 'plan-preview-item';
    itemEl.innerHTML = `
      <span class="plan-task-title">Неназначенные часы</span>
      <span class="plan-assignee">${plan.unassignedHours} ч</span>
    `;
    previewListEl.appendChild(itemEl);
  }
  
  // Show modal
  planPreviewEl.classList.add('show');
}

// Apply plan handler
function applyPlanHandler() {
  const plan = proposePlan(state, currentWeek);
  state = applyPlan(state, plan);
  saveState();
  planPreviewEl.classList.remove('show');
  render();
}

// Cancel plan handler
function cancelPlanHandler() {
  planPreviewEl.classList.remove('show');
}

// Reset demo handler
function resetDemoHandler() {
  if (confirm('Вы уверены, что хотите сбросить данные к демонстрационному примеру?')) {
    state = seedState();
    saveState();
    render();
  }
}

// Format date as DD.MM.YYYY
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
}

// Load state from localStorage
function loadState() {
  try {
    const savedState = localStorage.getItem('taskTrackerState');
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      if (isValidState(parsedState)) {
        return parsedState;
      }
    }
  } catch (error) {
    console.error('Error loading state from localStorage:', error);
  }
  
  // Return seed state if no valid saved state
  return seedState();
}

// Save state to localStorage
function saveState() {
  try {
    localStorage.setItem('taskTrackerState', JSON.stringify(state));
  } catch (error) {
    console.error('Error saving state to localStorage:', error);
  }
}