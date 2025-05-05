console.log("app.js loaded!");
console.log("Setting up DOMContentLoaded listener");


// DOM Elements
 const sidebarToggle = document.getElementById('sidebar-toggle');
 const sidebar = document.getElementById('sidebar');
 const mainContent = document.getElementById('main-content');
 const tabs = document.querySelectorAll('.tab');
 const taskActions = document.querySelectorAll('.task-action');
 const currentDateElement = document.getElementById('current-date');

 // Define the base URL for the backend API
 const API_BASE_URL = 'https://smart-planner-dad4.onrender.com';

 // Set current date
 function setCurrentDate() {
   const now = new Date();
   const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
   currentDateElement.textContent = now.toLocaleDateString('en-US', options);
 }

 // Mobile sidebar toggle and overlay logic
 function openSidebar() {
   sidebar.classList.add('open');
   mainContent.classList.add('sidebar-open');
   document.body.classList.add('sidebar-overlay');
 }

 function closeSidebar() {
   sidebar.classList.remove('open');
   mainContent.classList.remove('sidebar-open');
   document.body.classList.remove('sidebar-overlay');
 }

 function toggleSidebar() {
   if (sidebar.classList.contains('open')) {
     closeSidebar();
   } else {
     openSidebar();
   }
 }

 if (sidebarToggle) {
   sidebarToggle.addEventListener('click', toggleSidebar);
 }

 // Close sidebar when clicking outside (on overlay)
 document.addEventListener('click', function (e) {
   if (
     sidebar.classList.contains('open') &&
     document.body.classList.contains('sidebar-overlay') &&
     !sidebar.contains(e.target) &&
     e.target !== sidebarToggle &&
     !sidebarToggle.contains(e.target)
   ) {
     closeSidebar();
   }
 });

 // Optional: close sidebar on ESC key
 window.addEventListener('keydown', function (e) {
   if (e.key === 'Escape' && sidebar.classList.contains('open')) {
     closeSidebar();
   }
 });

 // Ensure the correct tab content is displayed
 function switchTab(event) {
   const selectedTab = event.currentTarget.dataset.tab;

   // Hide all tab contents
   const tabContents = document.querySelectorAll('.tab-content');
   tabContents.forEach(content => {
     content.classList.remove('active');
   });

   // Show the selected tab content
   const activeTabContent = document.getElementById(`${selectedTab}-tab`);
   if (activeTabContent) {
     activeTabContent.classList.add('active');
   }

   // Hide the timeline if not in the "Plans" tab
   const timeline = document.querySelector('.timeline');
   if (selectedTab === 'plans') {
     timeline.style.display = 'block';
   } else {
     timeline.style.display = 'none';
   }

   // Update active tab
   const tabs = document.querySelectorAll('.tab');
   tabs.forEach(tab => {
     tab.classList.remove('active');
   });
   event.currentTarget.classList.add('active');
 }

 // Add event listeners to tabs
 document.querySelectorAll('.tab').forEach(tab => {
   tab.addEventListener('click', switchTab);
 });

 // Toggle task completion
 function toggleTaskCompletion(event) {
   const taskCard = event.currentTarget.closest('.task-card');
   taskCard.classList.toggle('completed');
   
   // Update the badge if needed
   const taskInfo = taskCard.querySelector('.task-info');
   let badge = taskInfo.querySelector('.task-badge');
   
   if (taskCard.classList.contains('completed')) {
     if (!badge) {
       const taskTitle = taskInfo.querySelector('.task-title');
       badge = document.createElement('div');
       badge.className = 'task-badge';
       badge.innerHTML = `
         <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="button-icon">
           <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
           <polyline points="22 4 12 14.01 9 11.01"></polyline>
         </svg>
         Completed
       `;
       taskTitle.insertAdjacentElement('afterend', badge);
     }
   } else if (badge) {
     badge.remove();
   }
   
   // Update progress
   updateProgress();
 }

 // Update progress bar
 function updateProgress() {
   const totalTasks = document.querySelectorAll('.task-card').length;
   const completedTasks = document.querySelectorAll('.task-card.completed').length;
   const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
   
   document.querySelector('.progress-indicator').style.width = `${progressPercentage}%`;
   document.querySelector('.progress-count').textContent = `${completedTasks}/${totalTasks} tasks`;
 }

 // Render tasks in the timeline
 function renderTasks(timeline) {
   const timelineContainer = document.querySelector('.timeline');
   timelineContainer.innerHTML = ''; // Clear existing tasks

   timeline.forEach((entry) => {
     const taskElement = document.createElement('div');
     taskElement.className = 'timeline-item';
     taskElement.innerHTML = `
       <div class="time-indicator">
         <span class="time-label">${entry.time || 'N/A'}</span>
         <div class="time-line"></div>
       </div>
       <div class="task-card">
         <div class="task-content">
           <h3 class="task-title">${entry.task || 'Untitled Task'}</h3>
         </div>
       </div>
     `;
     timelineContainer.appendChild(taskElement);
   });
 }

 // Render AI suggestions
 function renderAISuggestions(suggestions) {
   const suggestionsContainer = document.getElementById('suggestions-container');
   suggestionsContainer.innerHTML = ''; // Clear existing suggestions

   suggestions.forEach(suggestion => {
     const suggestionElement = document.createElement('div');
     suggestionElement.className = 'suggestion-item';
     suggestionElement.textContent = suggestion;
     suggestionsContainer.appendChild(suggestionElement);
   });
 }

 // Fetch tasks from the backend
 async function fetchTasks() {
   try {
     const response = await fetch(`${API_BASE_URL}/calendar/events`);
     if (response.status === 401) {
       // Redirect to auth endpoint if unauthorized
       window.location.href = `${API_BASE_URL}/auth`;
       return;
     }
     if (!response.ok) {
       throw new Error('Failed to fetch tasks');
     }
     const data = await response.json();
     console.log('Full response data:', data);

     // Ensure data.timeline exists and is an array
     if (Array.isArray(data.timeline)) {
       console.log('Timeline:', data.timeline);
       renderTasks(data.timeline);
     } else {
       console.warn('No valid timeline found in the response');
       renderTasks([]);
     }
   } catch (error) {
     console.error('Error fetching tasks:', error);
   }
 }

 // Fetch AI suggestions from the backend
 async function fetchAISuggestions() {
   try {
     const response = await fetch(`${API_BASE_URL}/api/suggest-tasks`);
     if (!response.ok) {
       throw new Error('Failed to fetch AI suggestions');
     }
     const data = await response.json();
     console.log('AI Suggestions:', data.suggestions);
     renderAISuggestions(data.suggestions); // Render AI suggestions
   } catch (error) {
     console.error('Error fetching AI suggestions:', error);
   }
 }

 // Fetch goal suggestions from the backend
 async function fetchGoalSuggestions(goal) {
   try {
     const response = await fetch(`${API_BASE_URL}/api/goal-suggestions?goal=${encodeURIComponent(goal)}`);
     if (!response.ok) {
       throw new Error('Failed to fetch goal suggestions');
     }
     const data = await response.json();
     console.log('Goal Suggestions:', data.suggestions);
     renderGoalSuggestions(data.suggestions); // Render goal suggestions
   } catch (error) {
     console.error('Error fetching goal suggestions:', error);
   }
 }

 // Render goal suggestions in the Goal tab
 function renderGoalSuggestions(suggestions) {
   console.log('Rendering goal suggestions:', suggestions);
   const goalSuggestionsContainer = document.getElementById('goal-suggestions-container');
   goalSuggestionsContainer.innerHTML = ''; // Clear existing suggestions

   if (!suggestions || suggestions.length === 0) {
     goalSuggestionsContainer.innerHTML = '<div>No suggestions found.</div>';
     return;
   }

   suggestions.forEach(suggestion => {
     const suggestionElement = document.createElement('div');
     suggestionElement.className = 'goal-suggestion-item';
     suggestionElement.textContent = suggestion;
     // Add icon
     suggestionElement.innerHTML = `<span class="goal-suggestion-icon">🎯</span> <span class="goal-suggestion-text">${suggestion}</span>`;
     // Add click handler for interactivity
     suggestionElement.addEventListener('click', (e) => {
       e.stopPropagation();
       // Remove any existing popup
       document.querySelectorAll('.goal-suggestion-popup').forEach(p => p.remove());
       // Create popup menu
       const popup = document.createElement('div');
       popup.className = 'goal-suggestion-popup';
       popup.innerHTML = `
         <button class="popup-btn add-goal">Add as Goal</button>
         <button class="popup-btn add-plan">Add as Plan</button>
       `;
       // Position popup
       popup.style.position = 'absolute';
       popup.style.left = e.clientX + 'px';
       popup.style.top = e.clientY + 'px';
       // Add handlers
       popup.querySelector('.add-goal').onclick = () => {
         alert('Added as Goal: ' + suggestion);
         popup.remove();
       };
       popup.querySelector('.add-plan').onclick = () => {
         alert('Added as Plan: ' + suggestion);
         popup.remove();
       };
       // Remove popup on click outside
       document.addEventListener('click', function handler() {
         popup.remove();
         document.removeEventListener('click', handler);
       });
       document.body.appendChild(popup);
     });
     goalSuggestionsContainer.appendChild(suggestionElement);
   });
 }

 // Fetch generated content from the backend
 async function fetchGeneratedContent(prompt) {
   try {
     // Show loading state
     const generateBtn = document.getElementById('generate-btn');
     const generateText = document.getElementById('generate-text');
     generateBtn.disabled = true;
     generateText.textContent = 'Generating...';

     const response = await fetch(`${API_BASE_URL}/generate-content`, {  // Fixed URL
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ prompt }),
     });

     if (!response.ok) {
       throw new Error('Failed to generate content');
     }

     const data = await response.json();
     
     // Display the generated content
     const contentPlaceholder = document.getElementById('content-placeholder');
     const tabsContainer = document.getElementById('tabs-container');
     const generatedContent = document.getElementById('generated-content');
     const charCount = document.getElementById('character-count');
     
     if (data.generatedContent) {
       // Split content into LinkedIn and Twitter sections
       const sections = data.generatedContent.split('\n\n');
       let formattedContent = '';
       if (sections.length === 1) {
         // If only one section, just show it
         formattedContent = `<div class="content-section">${sections[0]}</div>`;
       } else {
         formattedContent = sections.map(section => {
           if (section.toLowerCase().includes('linkedin')) {
             return `<div class="content-section linkedin">
               <h4>LinkedIn Post</h4>
               <div class="content-box">
                 <div class="content-actions">
                   <button class="copy-btn" data-content="${encodeURIComponent(section.replace('LinkedIn:', '').trim())}">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                       <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                       <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                     </svg>
                     Copy
                   </button>
                 </div>
                 ${section.replace('LinkedIn:', '').trim()}
               </div>
             </div>`;
           } else if (section.toLowerCase().includes('twitter')) {
             return `<div class="content-section twitter">
               <h4>Twitter Post</h4>
               <div class="content-box">
                 <div class="content-actions">
                   <button class="copy-btn" data-content="${encodeURIComponent(section.replace('Twitter:', '').trim())}">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                       <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                       <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                     </svg>
                     Copy
                   </button>
                 </div>
                 ${section.replace('Twitter:', '').trim()}
               </div>
             </div>`;
           }
           return `<div class="content-section">${section}</div>`;
         }).join('');
       }

       // Update the display
       contentPlaceholder.style.display = 'none';
       tabsContainer.style.display = 'block';
       generatedContent.innerHTML = formattedContent;
       generatedContent.style.display = 'block';
       generatedContent.parentElement.style.display = 'block'; // Ensure parent is visible
       
       // Update character count
       const totalChars = data.generatedContent.length;
       charCount.textContent = `Character count: ${totalChars}`;
       charCount.style.display = 'block';

       // Enable the action buttons
       document.getElementById('regenerate-btn').disabled = false;
       document.getElementById('save-btn').disabled = false;

       // Add click handlers for copy buttons
       document.querySelectorAll('.copy-btn').forEach(btn => {
         btn.addEventListener('click', async () => {
           const content = decodeURIComponent(btn.dataset.content);
           try {
             await navigator.clipboard.writeText(content);
             const originalText = btn.innerHTML;
             btn.innerHTML = `
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M20 6L9 17l-5-5"></path>
               </svg>
               Copied!
             `;
             setTimeout(() => {
               btn.innerHTML = originalText;
             }, 2000);
           } catch (err) {
             console.error('Failed to copy:', err);
           }
         });
       });
     } else {
       alert('No content generated. Please try again.');
     }
   } catch (error) {
     console.error('Error generating content:', error);
     alert('Failed to generate content. Please try again.');
   } finally {
     // Reset button state
     const generateBtn = document.getElementById('generate-btn');
     const generateText = document.getElementById('generate-text');
     generateBtn.disabled = false;
     generateText.textContent = 'Generate Content';
   }
 }

// Add Task Form functionality
function showTaskForm() {
  const overlay = document.getElementById('task-form-overlay');
  overlay.style.display = 'flex';
  
  // Set minimum datetime to now
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Convert to local time
  const datetime = document.getElementById('task-datetime');
  datetime.min = now.toISOString().slice(0, 16);
  datetime.value = now.toISOString().slice(0, 16);
}

function hideTaskForm() {
  const overlay = document.getElementById('task-form-overlay');
  overlay.style.display = 'none';
}

// Handle task form submission
async function handleTaskSubmit(event) {
  event.preventDefault();
  const form = event.target;
  
  // Get the local datetime and convert to UTC
  const localDateTime = new Date(form.querySelector('#task-datetime').value);
  const startDateTime = new Date(localDateTime.getTime() - localDateTime.getTimezoneOffset() * 60000);
  const durationMinutes = parseInt(form.querySelector('#task-duration').value);
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

  const formData = {
    task_summary: form.querySelector('#task-title').value,
    task_description: form.querySelector('#task-description').value,
    start_time: startDateTime.toISOString(),
    end_time: endDateTime.toISOString()
  };

  try {
    const response = await fetch(`${API_BASE_URL}/create_task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (response.status === 401) {
      window.location.href = `${API_BASE_URL}/auth`;
      return;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create task');
    }

    const result = await response.json();
    console.log('Task created:', result);
    
    // Hide the form and refresh tasks
    hideTaskForm();
    form.reset();
    fetchTasks();
  } catch (error) {
    console.error('Error creating task:', error);
    alert(error.message || 'Failed to create task. Please try again.');
  }
}

// Helper function to calculate end time based on duration
function calculateEndTime(startTime, durationMinutes) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return end.toISOString().slice(0, 19) + 'Z';
}

// Sidebar tab switching
function handleSidebarTabClick(event) {
  const selectedTab = event.currentTarget.dataset.tab;
  // Remove active from all sidebar tabs
  document.querySelectorAll('.nav-item').forEach(tab => tab.classList.remove('active'));
  event.currentTarget.classList.add('active');
  // Hide all main tab contents
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  // Show the selected main tab content
  const mainTab = document.getElementById(`${selectedTab}-tab`);
  if (mainTab) mainTab.classList.add('active');
}
// Add event listeners to sidebar tabs
 document.querySelectorAll('.nav-item').forEach(tab => {
   tab.addEventListener('click', handleSidebarTabClick);
 });

// Helper: fetch all events for a month
async function fetchMonthEvents(year, month) {
  // month: 0-based
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  const startISO = start.toISOString();
  const endISO = end.toISOString();
  const response = await fetch(`${API_BASE_URL}/calendar/events?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`);
  if (!response.ok) return [];
  const data = await response.json();
  // Assume data.events is a list of events with ISO date strings
  return data.events || [];
}
// Enhanced calendar rendering with event count
async function renderCalendar(year, month) {
  const calendarContainer = document.getElementById('calendar-container');
  calendarContainer.innerHTML = '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  // Fetch events for the month
  const events = await fetchMonthEvents(year, month);
  // Map: day number -> count
  const eventCount = {};
  events.forEach(ev => {
    let dateStr = ev.start && ev.start.dateTime ? ev.start.dateTime : ev.start.date;
    if (dateStr) {
      const d = new Date(dateStr);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        eventCount[day] = (eventCount[day] || 0) + 1;
      }
    }
  });
  // Header
  const header = document.createElement('div');
  header.className = 'calendar-header';
  header.innerHTML = `
    <button class="calendar-nav prev-month">&#8592;</button>
    <span class="calendar-title">${monthNames[month]} ${year}</span>
    <button class="calendar-nav next-month">&#8594;</button>
  `;
  calendarContainer.appendChild(header);
  // Days of week
  const daysRow = document.createElement('div');
  daysRow.className = 'calendar-days-row';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day => {
    const d = document.createElement('div');
    d.className = 'calendar-day-label';
    d.textContent = day;
    daysRow.appendChild(d);
  });
  calendarContainer.appendChild(daysRow);
  // Dates grid
  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  for (let i = 0; i < firstDay.getDay(); i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day empty';
    grid.appendChild(empty);
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = d;
    if (date.getTime() === today.getTime()) {
      dayEl.classList.add('today');
    }
    // Show event count badge
    if (eventCount[d]) {
      const badge = document.createElement('span');
      badge.className = 'calendar-event-badge';
      badge.textContent = eventCount[d];
      dayEl.appendChild(badge);
    }
    dayEl.addEventListener('click', () => {
      alert(`Clicked: ${monthNames[month]} ${d}, ${year}`);
    });
    grid.appendChild(dayEl);
  }
  calendarContainer.appendChild(grid);
  // Navigation
  header.querySelector('.prev-month').onclick = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    renderCalendar(newYear, newMonth);
  };
  header.querySelector('.next-month').onclick = () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    renderCalendar(newYear, newMonth);
  };
}
// Render calendar on Calendar tab show
function setupCalendarTab() {
  const calendarTab = document.getElementById('calendar-tab');
  if (!calendarTab) return;
  // Show current month by default
  const now = new Date();
  renderCalendar(now.getFullYear(), now.getMonth());
}
// Show calendar when Calendar tab is activated
const sidebarTabs = document.querySelectorAll('.nav-item');
sidebarTabs.forEach(tab => {
  tab.addEventListener('click', (e) => {
    if (tab.dataset.tab === 'calendar') {
      setupCalendarTab();
    }
  });
});

// Dark mode toggle logic
function setDarkMode(enabled) {
  if (enabled) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'true');
  } else {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'false');
  }
}
function setupDarkModeToggle() {
  const toggle = document.getElementById('dark-mode-toggle');
  if (!toggle) return;
  // Load preference
  const darkPref = localStorage.getItem('darkMode') === 'true';
  toggle.checked = darkPref;
  setDarkMode(darkPref);
  toggle.addEventListener('change', () => {
    setDarkMode(toggle.checked);
  });
}

 // Initialize
 function init() {
   console.log("init() called");
   // Set current date
   setCurrentDate();
   
   // Add event listeners
   // Check if sidebarToggle exists before adding the event listener
   if (sidebarToggle) {
     sidebarToggle.addEventListener('click', toggleSidebar);
   }
   
   tabs.forEach(tab => {
     tab.addEventListener('click', switchTab);
   });
   
   taskActions.forEach(action => {
     action.addEventListener('click', toggleTaskCompletion);
   });
   
   // Check if mobile
   function checkMobile() {
     if (window.innerWidth >= 768) {
       sidebar.classList.add('open');
       mainContent.classList.add('sidebar-open');
     } else {
       sidebar.classList.remove('open');
       mainContent.classList.remove('sidebar-open');
     }
   }
   
   // Initial check
   checkMobile();
   
   // Listen for window resize
   window.addEventListener('resize', checkMobile);
   
   // Update progress
   updateProgress();

   // Fetch tasks and AI suggestions
   fetchTasks();
   fetchAISuggestions();

   // Add Task form event listeners
   document.querySelectorAll('.add-task-button, .button.button-outline').forEach(button => {
     button.addEventListener('click', showTaskForm);
   });

   document.getElementById('cancel-task').addEventListener('click', hideTaskForm);
   document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);

   // Set initial minimum datetime for the form
   const now = new Date();
   now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
   const datetime = document.getElementById('task-datetime');
   if (datetime) {
     datetime.min = now.toISOString().slice(0, 16);
     datetime.value = now.toISOString().slice(0, 16);
   }

   // Suggest subtasks button
   document.getElementById('suggest-btn').addEventListener('click', async () => {
     const taskTitle = document.getElementById('task-title').value;
     if (!taskTitle) {
       alert('Please enter a task title first');
       return;
     }

     try {
       const response = await fetch(`${API_BASE_URL}/suggest`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({ task_summary: taskTitle }),
       });

       if (!response.ok) {
         throw new Error('Failed to get suggestions');
       }

       const data = await response.json();
       const container = document.getElementById('suggestions-container');
       container.innerHTML = data.subtasks.map(subtask => `
         <div class="suggestion-item">
           <input type="checkbox" id="subtask-${subtask}" name="subtasks[]" value="${subtask}">
           <label for="subtask-${subtask}">${subtask}</label>
         </div>
       `).join('');
     } catch (error) {
       console.error('Error getting suggestions:', error);
       alert('Failed to get suggestions. Please try again.');
     }
   });

   // AI Suggestions button handler
   document.querySelector('.button.button-primary').addEventListener('click', async () => {
     // Create and show suggestions modal first
     const modal = document.createElement('div');
     modal.className = 'overlay';
     modal.style.display = 'flex';
     modal.innerHTML = `
       <div class="task-form-container">
         <h3>AI Task Suggestions</h3>
         <div class="form-group">
           <label for="mood-topic">How are you feeling? Or what would you like to focus on?</label>
           <input type="text" id="mood-topic" placeholder="Enter mood (e.g., energetic, creative) or topic (e.g., health, coding)">
         </div>
         <button type="button" class="get-suggestions-btn">Get Personalized Suggestions</button>
         <div class="suggestions-list"></div>
         <div class="form-actions">
           <button type="button" class="close-suggestions">Close</button>
         </div>
       </div>
     `;
     
     document.body.appendChild(modal);
     
     // Add event listeners
     const getSuggestionsBtn = modal.querySelector('.get-suggestions-btn');
     const moodTopicInput = modal.querySelector('#mood-topic');
     const suggestionsList = modal.querySelector('.suggestions-list');
     
     getSuggestionsBtn.addEventListener('click', async () => {
       const moodOrTopic = moodTopicInput.value.trim();
       if (!moodOrTopic) {
         alert('Please enter your mood or a topic of interest');
         return;
       }
       
       try {
         getSuggestionsBtn.disabled = true;
         getSuggestionsBtn.textContent = 'Getting suggestions...';
         
       const response = await fetch(`${API_BASE_URL}/api/suggest-by-mood`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({ mood_or_topic: moodOrTopic }),
       });
     } catch (error) {
       console.error('Error fetching suggestions by mood:', error);
       alert('Failed to fetch suggestions. Please try again.');
     } finally {
       getSuggestionsBtn.disabled = false;
       getSuggestionsBtn.textContent = 'Get Personalized Suggestions';
     }
   });

   modal.querySelector('.close-suggestions').addEventListener('click', () => {
     document.body.removeChild(modal);
   });
 });

 // Add event listener to the Generate Content button
 const generateBtn = document.getElementById('generate-btn');
 generateBtn.addEventListener('click', () => {
   const promptInput = document.getElementById('prompt').value;
   if (promptInput.trim()) {
     fetchGeneratedContent(promptInput);
   } else {
     alert('Please enter a topic or keywords to generate content.');
   }
 });

 // Add event listener for the Goals tab 'Get Suggestions' button
 const fetchGoalBtn = document.getElementById('fetch-goal-suggestions-btn');
 if (fetchGoalBtn) {
   fetchGoalBtn.addEventListener('click', () => {
     const goalInput = document.getElementById('goal-input').value.trim();
     console.log('Get Suggestions clicked. Goal:', goalInput);
     if (goalInput) {
       fetchGoalSuggestions(goalInput);
     } else {
       alert('Please enter your goal first.');
     }
   });
 }

 // Run initialization
 setupDarkModeToggle();
}

document.addEventListener('DOMContentLoaded', init);
console.log("DOMContentLoaded event fired");
