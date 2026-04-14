'use strict';

const GITHUB_REPO = 'oscaromargp/boletin-la-buena';
const FILE_PATH = 'data/db.json';

// Get token from config/localStorage
function getGithubToken() {
  const settings = getSettings();
  return settings.githubToken || ''; // Add token in configuration HUD settings -> Prefs
}

async function fetchFromGithub() {
  const token = getGithubToken();
  if (!token) return null;

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 404) return null; // File doesn't exist yet
    if (!res.ok) throw new Error("Error fetching data from GitHub");

    const data = await res.json();
    const contentStr = decodeURIComponent(escape(atob(data.content)));
    return { sha: data.sha, content: JSON.parse(contentStr) };
  } catch (err) {
    console.error("fetchFromGithub error:", err);
    return null;
  }
}

async function saveToGithub(dashboardData) {
  const token = getGithubToken();
  if (!token) return;

  try {
    // Need SHA to update file
    let sha = null;
    const existing = await fetchFromGithub();
    if (existing) {
      sha = existing.sha;
    }

    const contentStr = JSON.stringify(dashboardData, null, 2);
    // Base64 encode preserving utf-8
    const base64Content = btoa(unescape(encodeURIComponent(contentStr)));

    const body = {
      message: 'Sistema Operativo: Auto-sync dashboard data',
      content: base64Content
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("Error saving to GitHub");
    console.log("GitHub sync successful!");
  } catch (err) {
    console.error("saveToGithub error:", err);
  }
}

// Sync function to expose
window.GithubSync = {
  syncUp: async function() {
    const data = {
      kanban: getKanban(),
      daily: getDaily(),
      timestamp: Date.now()
    };
    await saveToGithub(data);
  },
  syncDown: async function() {
    const remote = await fetchFromGithub();
    if (remote && remote.content) {
      if (remote.content.kanban) localStorage.setItem(KANBAN_KEY, JSON.stringify(remote.content.kanban));
      if (remote.content.daily) localStorage.setItem(DAILY_KEY, JSON.stringify(remote.content.daily));
      return true;
    }
    return false;
  }
};
