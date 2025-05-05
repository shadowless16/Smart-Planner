# Smart Planner

A modern, AI-powered daily planner web app with Google Calendar integration, task suggestions, and a mobile-friendly UI.

## Features
- Google Calendar sync (OAuth2)
- AI-powered task and content suggestions (OpenAI)
- Responsive, mobile-friendly sidebar and layout
- Dark mode
- Secure authentication (cookie-based)

## Local Setup

### 1. Prerequisites
- Python 3.11+
- Node.js (for frontend development, optional)

### 2. Clone the repository
```sh
git clone <your-repo-url>
cd "Smart Planner"
```

### 3. Install Python dependencies
```sh
pip install -r requirements.txt
```

### 4. Google OAuth Setup
- Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- Create OAuth 2.0 credentials for a Web application
- Download the credentials.json file
- Place it in `backend/credentials.json` (do NOT commit this file)
- Add `backend/credentials.json` to `.gitignore`

#### For deployment (Render.com, etc):
- Set an environment variable `GOOGLE_CREDENTIALS` with the full JSON content of your credentials.json

### 5. Environment Variables
Create a `.env` file in `backend/` with:
```
OPENAI_API_KEY=your_openai_key
COOKIE_SECRET=your_random_secret
```

### 6. Run the backend
```sh
cd backend
python main.py
```

The app will be available at http://localhost:8000

## Deployment (Render.com example)
- Set `GOOGLE_CREDENTIALS` env variable (see above)
- Set `OPENAI_API_KEY` and `COOKIE_SECRET` as environment variables
- Use the provided `Procfile` for deployment

## Security
- Never commit `credentials.json` or any secret keys
- Use environment variables for all secrets in production

## Mobile UI
- The sidebar is accessible via the hamburger menu on mobile
- Tap outside the sidebar or press ESC to close it

## Logout
- Visit `/logout` to clear your session

---

For questions or issues, open an issue or contact the maintainer.