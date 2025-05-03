// DOM Elements
 const sidebarToggle = document.getElementById('sidebar-toggle');
 const sidebar = document.getElementById('sidebar');
 const mainContent = document.getElementById('main-content');
 const tabs = document.querySelectorAll('.tab');
 const taskActions = document.querySelectorAll('.task-action');
 const currentDateElement = document.getElementById('current-date');

 // Define the base URL for the backend API
 const API_BASE_URL = window.location.origin;

 // Set current date
 function setCurrentDate() {
   const now = new Date();
   const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
   currentDateElement.textContent = now.toLocaleDateString('en-US', options);
 }

 // Toggle sidebar
 function toggleSidebar() {
   sidebar.classList.toggle('open');
   
   // Update the toggle icon
   const toggleIcon = sidebarToggle.querySelector('svg');
   if (sidebar.classList.contains('open')) {
     toggleIcon.innerHTML = `
       <line x1="18" y1="6" x2="6" y2="18"></line>
       <line x1="6" y1="6" x2="18" y2="18"></line>
     `;
   } else {
     toggleIcon.innerHTML = `
       <line x1="3" y1="12" x2="21" y2="12"></line>
       <line x1="3" y1="6" x2="21" y2="6"></line>
       <line x1="3" y1="18" x2="21" y2="18"></line>
     `;
   }
 }

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
     if (!response.ok) {
       throw new Error('Failed to fetch tasks');
     }
     const data = await response.json();
     console.log('Full response data:', data); // Log the full response for debugging

     // Ensure data.timeline exists and is an array
     if (Array.isArray(data.timeline)) {
       console.log('Timeline:', data.timeline);
       renderTasks(data.timeline); // Render tasks in the timeline
     } else {
       console.warn('No valid timeline found in the response');
       renderTasks([]); // Render an empty timeline as a fallback
     }
   } catch (error) {
     console.error('Error fetching tasks:', error);
   }
 }

 // Fetch AI suggestions from the backend
 async function fetchAISuggestions() {
   try {
     const response = await fetch(`${API_BASE_URL}/ai/suggest-tasks`);
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
     const response = await fetch(`${API_BASE_URL}/ai/goal-suggestions?goal=${encodeURIComponent(goal)}`);
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
   const goalSuggestionsContainer = document.getElementById('goal-suggestions-container');
   goalSuggestionsContainer.innerHTML = ''; // Clear existing suggestions

   suggestions.forEach(suggestion => {
     const suggestionElement = document.createElement('div');
     suggestionElement.className = 'goal-suggestion-item';
     suggestionElement.textContent = suggestion;
     goalSuggestionsContainer.appendChild(suggestionElement);
   });
 }

 // Fetch generated content from the backend
 async function fetchGeneratedContent(prompt) {
   try {
     const response = await fetch(`${API_BASE_URL}/api/generate-content`, {
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
     console.log('Generated Content:', data.generatedContent);

     // Display the generated content
     const generatedContent = document.getElementById('generated-content');
     const contentPlaceholder = document.getElementById('content-placeholder');
     const tabsContainer = document.getElementById('tabs-container');

     if (data.generatedContent) {
       generatedContent.textContent = data.generatedContent;
       contentPlaceholder.style.display = 'none';
       tabsContainer.style.display = 'block';
       generatedContent.style.display = 'block'; // Ensure the content is visible
     } else {
       alert('No content generated. Please try again.');
     }
   } catch (error) {
     console.error('Error generating content:', error);
     alert('Failed to generate content. Please try again.');
   }
 }

 // Initialize
 function init() {
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
 }

 // Add event listener for fetching goal suggestions
 document.getElementById('fetch-goal-suggestions-btn').addEventListener('click', () => {
   const goalInput = document.getElementById('goal-input').value;
   if (goalInput.trim()) {
     fetchGoalSuggestions(goalInput);
   } else {
     alert('Please enter a goal to get suggestions.');
   }
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

 // Run initialization
 document.addEventListener('DOMContentLoaded', init);
