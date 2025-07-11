const backendURL = 'https://chess-arena-l9c4.onrender.com';

const tabJoin = document.getElementById('tab-join');
const tabLogin = document.getElementById('tab-login');
const secJoin = document.getElementById('section-join');
const secLogin = document.getElementById('section-login');

tabJoin.onclick = () => {
  tabJoin.classList.add('active');
  tabLogin.classList.remove('active');
  secJoin.classList.add('active');
  secLogin.classList.remove('active');
};

tabLogin.onclick = () => {
  tabLogin.classList.add('active');
  tabJoin.classList.remove('active');
  secLogin.classList.add('active');
  secJoin.classList.remove('active');
};

const typeSelect = document.getElementById('tournamentType');
const accessKeySection = document.getElementById('accessKeySection');
const entryFeeSection = document.getElementById('entryFeeSection');

typeSelect.addEventListener('change', () => {
  const isPrivate = typeSelect.value === 'private';
  accessKeySection.classList.toggle('hidden', !isPrivate);
  entryFeeSection.classList.toggle('hidden', isPrivate);
});

// ✅ Join Tournament
document.getElementById('joinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('join-error');
  errorEl.textContent = '';

  const playerName = document.getElementById('playerName').value.trim();
  let email = document.getElementById('email').value.trim();
  const tournamentName = document.getElementById('tournamentName').value.trim();
  const isPrivate = typeSelect.value === 'private';
  const accessKey = document.getElementById('accessKey').value.trim();
  const entryFee = document.getElementById('entryFee').value;

  if (!email.includes('@')) email += '@gmail.com';

  try {
    const res = await fetch(`${backendURL}/api/tournament/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, email, tournamentName, isPrivate, accessKey, entryFee })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || res.statusText);

    alert('✅ Joined! Your Player ID: ' + data.player.playerId);
    localStorage.setItem('playerId', data.player.playerId);
    localStorage.setItem('playerName', data.player.name);
    window.location.href = 'profile.html';
  } catch (err) {
    errorEl.textContent = '❌ ' + err.message;
  }
});

// ✅ Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  const loginName = document.getElementById('loginName').value.trim();
  const loginId = document.getElementById('loginId').value.trim();

  try {
    const res = await fetch(`${backendURL}/api/player/profile/${encodeURIComponent(loginId)}`);
    const player = await res.json();

    if (!res.ok || !player.name) throw new Error(player.message || 'Player not found');

    if (player.name.toLowerCase() !== loginName.toLowerCase()) {
      throw new Error('Name and ID do not match');
    }

    localStorage.setItem('playerId', player.playerId);
    localStorage.setItem('playerName', player.name);

    alert('✅ Logged in!');
    window.location.href = 'profile.html';
  } catch (err) {
    errorEl.textContent = '❌ ' + err.message;
  }
});
