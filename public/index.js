function showLoginForm() {
  const form = document.getElementById('login-form');
  form.classList.toggle('hidden');
  form.scrollIntoView({ behavior: 'smooth' });
}

function toggleMenu() {
  const navLinks = document.getElementById('nav-links');
  navLinks.classList.toggle('show');
}

function handleLogin(role) {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();

  if (!name || !email) {
    alert("Please fill in both name and email.");
    return;
  }

  localStorage.setItem('playerName', name);
  localStorage.setItem('playerEmail', email);

  if (role === 'participant') {
    window.location.href = 'join.html';
  } else if (role === 'organizer') {
    window.location.href = 'create.html';
  }
}
