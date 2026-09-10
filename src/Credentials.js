const AUTH_CREDENTIALS_JSON = '[{"username":"admin","password":"admin123","role":"admin"}]';

function apiLogin(credentials) {
  const username = String(credentials && credentials.username || '').trim();
  const password = String(credentials && credentials.password || '');
  const users = JSON.parse(AUTH_CREDENTIALS_JSON);
  const match = users.find(user => user.username === username && user.password === password);

  if (!match) {
    return { success: false, error: 'Incorrect username or password.' };
  }

  return { success: true, username: match.username, role: match.role };
}