// Export constants and functions as specified in the domain contract
export const DEMO_WEEK = '2026-09-28';

// Return a fresh copy of the seed state
export function seedState() {
  return {
    "version": 1,
    "employees": [
      {
        "id": "anna",
        "name": "Анна Смирнова",
        "initials": "АС",
        "role": "Разработка",
        "color": "#5468d3",
        "capacity": 24,
        "capacities": {}
      },
      {
        "id": "dmitry",
        "name": "Дмитрий Волков",
        "initials": "ДВ",
        "role": "Разработка",
        "color": "#007d87",
        "capacity": 32,
        "capacities": {}
      },
      {
        "id": "maria",
        "name": "Мария Орлова",
        "initials": "МО",
        "role": "Аналитика",
        "color": "#a25a23",
        "capacity": 24,
        "capacities": {}
      },
      {
        "id": "ilya",
        "name": "Илья Соколов",
        "initials": "ИС",
        "role": "Тестирование",
        "color": "#a34e88",
        "capacity": 24,
        "capacities": {}
      }
    ],
    "tasks": [
      {
        "id": "TASK-101",
        "title": "Обновить форму заявки",
        "description": "Добавить выбор типа ресурса и понятные подсказки.",
        "assignee": "anna",
        "hours": 16,
        "status": "doing",
        "week": "2026-09-28"
      },
      {
        "id": "TASK-102",
        "title": "Подключить витрину метрик",
        "description": "Показать основные показатели на странице команды.",
        "assignee": "anna",
        "hours": 16,
        "status": "todo",
        "week": "2026-09-28"
      },
      {
        "id": "TASK-103",
        "title": "Добавить фильтры в реестр",
        "description": "Фильтрация по статусу и ответственному.",
        "assignee": "dmitry",
        "hours": 8,
        "status": "doing",
        "week": "2026-09-28"
      },
      {
        "id": "TASK-104",
        "title": "Исправить выгрузку отчёта",
        "description": "Сохранить порядок столбцов и заголовки.",
        "assignee": "dmitry",
        "hours": 6,
        "status": "todo",
        "week": "2026-09-28"
      },
      {
        "id": "TASK-105",
        "title": "Описать правила согласования",
        "description": "Зафиксировать переходы статусов и критерии приёмки.",
        "assignee": "maria",
        "hours": 8,
        "status": "doing",
        "week": "2026-09-28"
      },
      {
        "id": "TASK-106",
        "title": "Проверить сценарии заявок",
        "description": "Проверить создание, редактирование и завершение заявки.",
        "assignee": "ilya",
        "hours": 12,
        "status": "todo",
        "week": "2026-09-28"
      },
      {
        "id": "TASK-107",
        "title": "Подготовить тестовые данные",
        "description": "Набор вымышленных заявок для демонстрации.",
        "assignee": "ilya",
        "hours": 4,
        "status": "done",
        "week": "2026-09-28"
      },
      {
        "id": "TASK-108",
        "title": "Согласовать поля заявки",
        "description": "Названия, обязательность и ограничения полей.",
        "assignee": "maria",
        "hours": 6,
        "status": "done",
        "week": "2026-09-28"
      },
      {
        "id": "TASK-109",
        "title": "Добавить подсказки на доске",
        "description": "Короткие пояснения статусов задач.",
        "assignee": null,
        "hours": 4,
        "status": "todo",
        "week": "2026-09-28"
      }
    ],
    "nextId": 110
  };
}

// Return monday of the week for a given date
export function monday(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// Calculate load metrics for an employee for a specific week
export function loadFor(state, employeeId, week) {
  const employee = state.employees.find(e => e.id === employeeId);
  if (!employee) {
    throw new Error(`Employee with id ${employeeId} not found`);
  }

  // Filter tasks for the specified week and employee
  const weekTasks = state.tasks.filter(task => task.week === week);
  const employeeTasks = weekTasks.filter(task => task.assignee === employeeId);
  
  // Calculate active hours (non-done tasks)
  const activeTasks = employeeTasks.filter(task => task.status !== 'done');
  const activeHours = activeTasks.reduce((sum, task) => sum + task.hours, 0);
  
  // Calculate done hours
  const doneTasks = employeeTasks.filter(task => task.status === 'done');
  const doneHours = doneTasks.reduce((sum, task) => sum + task.hours, 0);
  
  // Total assigned hours for progress calculation
  const totalHours = employeeTasks.reduce((sum, task) => sum + task.hours, 0);
  
  // Get capacity for the week (specific week capacity or default)
  const capacity = employee.capacities[week] !== undefined ? employee.capacities[week] : employee.capacity;
  
  // Calculate percentage and overload
  let percent = null;
  let overload = 0;
  
  if (capacity > 0) {
    percent = Math.round((activeHours / capacity) * 100);
    if (activeHours > capacity) {
      overload = activeHours - capacity;
    }
  } else if (capacity === 0 && activeHours > 0) {
    // Special case: zero capacity but active hours means all hours are overload
    overload = activeHours;
  }
  
  // Calculate progress (completed hours / total assigned hours)
  let progress = 0;
  if (totalHours > 0) {
    progress = Math.round((doneHours / totalHours) * 100);
  }
  
  return {
    tasks: employeeTasks,
    active: activeTasks,
    hours: activeHours,
    capacity: capacity,
    totalHours: totalHours,
    doneHours: doneHours,
    overload: overload,
    percent: percent,
    progress: progress
  };
}

// Validate a task object
export function validateTask(task, employees) {
  // Create a copy to avoid mutating the input
  const validatedTask = { ...task };
  
  // Validate title (1-140 characters after trim)
  if (typeof validatedTask.title !== 'string') {
    throw new Error('Title must be a string');
  }
  
  const trimmedTitle = validatedTask.title.trim();
  if (trimmedTitle.length < 1 || trimmedTitle.length > 140) {
    throw new Error('Title must be between 1 and 140 characters after trimming');
  }
  validatedTask.title = trimmedTitle;
  
  // Validate description (up to 1000 characters)
  if (typeof validatedTask.description !== 'string') {
    throw new Error('Description must be a string');
  }
  
  if (validatedTask.description.length > 1000) {
    throw new Error('Description must be no more than 1000 characters');
  }
  
  // Validate hours (0.5-168 with 0.5 step)
  if (typeof validatedTask.hours !== 'number' || isNaN(validatedTask.hours)) {
    throw new Error('Hours must be a number');
  }
  
  if (validatedTask.hours < 0.5 || validatedTask.hours > 168) {
    throw new Error('Hours must be between 0.5 and 168');
  }
  
  // Check if hours is a multiple of 0.5
  if (validatedTask.hours % 0.5 !== 0) {
    throw new Error('Hours must be in 0.5 hour increments');
  }
  
  // Validate assignee (must be null or exist in employees)
  if (validatedTask.assignee !== null) {
    if (typeof validatedTask.assignee !== 'string') {
      throw new Error('Assignee must be null or a string');
    }
    
    const assigneeExists = employees.some(emp => emp.id === validatedTask.assignee);
    if (!assigneeExists) {
      throw new Error('Assignee must be null or a valid employee ID');
    }
  }
  
  // Validate status (must be todo, doing, or done)
  const validStatuses = ['todo', 'doing', 'done'];
  if (!validStatuses.includes(validatedTask.status)) {
    throw new Error('Status must be one of: todo, doing, done');
  }
  
  // Validate week (must be a Monday)
  if (typeof validatedTask.week !== 'string') {
    throw new Error('Week must be a string');
  }
  
  if (monday(validatedTask.week) !== validatedTask.week) {
    throw new Error('Week must be a Monday date in YYYY-MM-DD format');
  }
  
  return validatedTask;
}

// Propose a plan for task distribution
export function proposePlan(state, week) {
  // Create a deep copy of the state to avoid mutation
  const stateCopy = JSON.parse(JSON.stringify(state));
  
  // Get tasks for the specified week that are not done
  const weekTasks = stateCopy.tasks.filter(task => 
    task.week === week && task.status !== 'done'
  );
  
  // Get employees with their capacities for the week
  const employeesWithCapacity = stateCopy.employees.map(employee => {
    const capacity = employee.capacities[week] !== undefined ? 
      employee.capacities[week] : employee.capacity;
    return { ...employee, capacity };
  });
  
  // Calculate total available capacity
  const totalCapacity = employeesWithCapacity.reduce((sum, emp) => sum + emp.capacity, 0);
  
  // Calculate total workload
  const totalWorkload = weekTasks.reduce((sum, task) => sum + task.hours, 0);
  
  // Calculate unassigned hours as the excess workload beyond capacity
  const unassignedHours = Math.max(0, totalWorkload - totalCapacity);
  
  // Find unassigned tasks (tasks with null assignee) for actual assignments
  const unassignedTasks = weekTasks.filter(task => task.assignee === null);
  
  // Create assignments array for unassigned tasks only
  const assignments = [];
  
  // Sort unassigned tasks by hours (descending) to try to fit larger tasks first
  const sortedTasks = [...unassignedTasks].sort((a, b) => b.hours - a.hours);
  
  // Try to assign each unassigned task to available capacity
  const employeeLoads = employeesWithCapacity.map(employee => {
    const employeeTasks = weekTasks.filter(task => task.assignee === employee.id);
    const assignedHours = employeeTasks.reduce((sum, task) => sum + task.hours, 0);
    return {
      id: employee.id,
      capacity: employee.capacity,
      assignedHours: assignedHours,
      availableHours: Math.max(0, employee.capacity - assignedHours)
    };
  });
  
  for (const task of sortedTasks) {
    // Find the employee with the most available capacity
    let bestEmployee = null;
    let maxAvailable = -1;
    
    for (const emp of employeeLoads) {
      if (emp.availableHours >= task.hours && emp.availableHours > maxAvailable) {
        maxAvailable = emp.availableHours;
        bestEmployee = emp;
      }
    }
    
    if (bestEmployee && bestEmployee.capacity > 0) {
      // Assign task to this employee
      assignments.push({
        taskId: task.id,
        assignee: bestEmployee.id
      });
      
      // Update employee's available hours
      bestEmployee.availableHours -= task.hours;
      bestEmployee.assignedHours += task.hours;
    }
  }
  
  return {
    assignments,
    unassignedHours
  };
}

// Apply a proposed plan to the state
export function applyPlan(state, plan) {
  // Create a deep copy of the state to avoid mutation
  const newState = JSON.parse(JSON.stringify(state));
  
  // Apply each assignment in the plan
  for (const assignment of plan.assignments) {
    const task = newState.tasks.find(t => t.id === assignment.taskId);
    if (task) {
      // Only update tasks that are still in todo or doing status
      if (task.status !== 'done') {
        task.assignee = assignment.assignee;
      }
    }
  }
  
  return newState;
}

// Check if a state is valid
export function isValidState(state) {
  // Check if state has required properties
  if (!state || typeof state !== 'object') {
    return false;
  }
  
  if (!Array.isArray(state.employees) || !Array.isArray(state.tasks)) {
    return false;
  }
  
  if (typeof state.nextId !== 'number' || state.nextId < 110) {
    return false;
  }
  
  // Check for duplicate employee IDs
  const employeeIds = state.employees.map(e => e.id);
  if (new Set(employeeIds).size !== employeeIds.length) {
    return false;
  }
  
  // Check for duplicate task IDs
  const taskIds = state.tasks.map(t => t.id);
  if (new Set(taskIds).size !== taskIds.length) {
    return false;
  }
  
  // Check that all task properties are valid
  for (const task of state.tasks) {
    if (!task.id || !task.title || typeof task.hours !== 'number' || 
        !task.status || !task.week) {
      return false;
    }
    
    // Check that assignee is either null or a valid employee ID
    if (task.assignee !== null && !employeeIds.includes(task.assignee)) {
      return false;
    }
    
    // Check that status is valid
    if (!['todo', 'doing', 'done'].includes(task.status)) {
      return false;
    }
  }
  
  return true;
}