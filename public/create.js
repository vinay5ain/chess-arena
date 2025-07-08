// ✅ Use Render deployment backend
const BASE_URL = 'https://chess-arena-l9c4.onrender.com';

document.getElementById('tournament-type').addEventListener('change', function () {
  const isPrivate = this.value === 'private';
  document.getElementById('private-fields').style.display = isPrivate ? 'block' : 'none';
  document.getElementById('public-fields').style.display = isPrivate ? 'none' : 'block';
});

function openLogin() {
  document.getElementById('loginModal').style.display = 'block';
}

function closeLogin() {
  document.getElementById('loginModal').style.display = 'none';
}

async function checkLogin() {
  const name = document.getElementById('login-name').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  if (!name || !pass) {
    alert('❌ Enter tournament name and password');
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/tournament/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentName: name, password: pass })
    });

    const data = await res.json();

    if (!res.ok) {
      alert("❌ " + (data.message || "Login failed"));
      return;
    }

    localStorage.setItem("tournamentId", data.tournament._id);
    localStorage.setItem("tournamentName", data.tournament.tournamentName);
    alert("✅ Logged in!");
    window.location.href = "admin.html";

  } catch (err) {
    console.error("Login error:", err);
    alert("❌ Network error.");
  }
}

async function handleCreate(event) {
  event.preventDefault();

  const tournamentName = document.getElementById('tournament-name').value.trim();
  const password = document.getElementById('password').value.trim();
  const isPrivate = document.getElementById('tournament-type').value === 'private';
  const accessKey = document.getElementById('access-key').value.trim();
  const entryFee = document.getElementById('entry-fee').value.trim();
  const mode = document.getElementById('mode').value;

  const payload = {
    tournamentName,
    organizerName: tournamentName,
    isPrivate,
    password,
    mode,
    accessKey: isPrivate ? accessKey : null,
    entryFee: !isPrivate ? Number(entryFee) : null
  };

  try {
    const res = await fetch(`${BASE_URL}/api/tournament/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert('❌ ' + data.message);
      return;
    }

    alert('✅ Tournament Created!');
    localStorage.setItem("tournamentId", data.tournament._id);
    window.location.href = "admin.html";

  } catch (error) {
    console.error("❌ Network error:", error);
    alert("❌ Network error.");
  }
}

window.onclick = function (e) {
  const modal = document.getElementById('loginModal');
  if (e.target === modal) modal.style.display = 'none';
};
