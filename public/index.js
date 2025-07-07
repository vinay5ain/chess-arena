function showLoginForm() {
  const loginForm = document.getElementById('login-form');
  loginForm.style.display = loginForm.style.display === 'block' ? 'none' : 'block';
}

function handleLogin(role) {
  if (role === 'participant') {
    window.location.href = 'join.html';
  } else if (role === 'organizer') {
    window.location.href = 'create.html';
  }
}
