const BACKEND_URL = 'https://chess-arena-l9c4.onrender.com';

// 🔐 Validate player session
const playerId = localStorage.getItem('playerId');
const playerName = localStorage.getItem('playerName');
const tournamentId = localStorage.getItem('tournamentId');

if (!playerId || !playerName || !tournamentId) {
  window.location.href = 'join.html';
}

// 🚀 Start loading profile
fetchProfile();

async function fetchProfile() {
  try {
    // 🏆 Fetch leaderboard
    const leaderboardRes = await fetch(`${BACKEND_URL}/api/leaderboard/${tournamentId}`);
    if (!leaderboardRes.ok) throw new Error('Leaderboard fetch failed');
    const leaderboard = await leaderboardRes.json();

    const player = leaderboard.find(p => p.name?.toLowerCase() === playerName.toLowerCase());
    const wins = player?.wins || 0;
    const losses = player?.losses || 0;
    const totalMatches = wins + losses;

    // 🧾 Fill profile summary
    document.getElementById('playerName').textContent = playerName;
    document.getElementById('playerId').textContent = playerId;
    document.getElementById('tournamentName').textContent = tournamentId;
    document.getElementById('totalWins').textContent = wins;
    document.getElementById('totalLosses').textContent = losses;
    document.getElementById('matchesPlayed').textContent = totalMatches;

    // 📦 Fetch matches from admin routes
    await fetchAndRenderMatches();
  } catch (err) {
    console.error('❌ Failed to load profile:', err);
    alert('Error loading profile data. Please try again later.');
  }
}

async function fetchAndRenderMatches() {
  try {
    const [liveRes, upcomingRes, pastRes] = await Promise.all([
      fetch(`${BACKEND_URL}/api/matches/live/${tournamentId}`),
      fetch(`${BACKEND_URL}/api/matches/upcoming/${tournamentId}`),
      fetch(`${BACKEND_URL}/api/matches/past/${tournamentId}`)
    ]);

    const live = await liveRes.json();
    const upcoming = await upcomingRes.json();
    const past = await pastRes.json();

    const lowerName = playerName.toLowerCase();

    const filterMatches = (matches) => matches.filter(
      m => m.player1?.toLowerCase() === lowerName || m.player2?.toLowerCase() === lowerName
    );

    renderMatchList('ongoingMatch', filterMatches(live));
    renderMatchList('upcomingMatches', filterMatches(upcoming));
    renderMatchList('matchHistory', filterMatches(past));
  } catch (err) {
    console.warn('⚠️ Match fetch failed:', err);
    renderMatchList('ongoingMatch', []);
    renderMatchList('upcomingMatches', []);
    renderMatchList('matchHistory', []);
  }
}

function renderMatchList(containerId, matches) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!matches.length) {
    container.innerHTML = '<li>No matches found.</li>';
    return;
  }

  matches.forEach(match => {
    const li = document.createElement('li');
    const p1 = match.player1 || 'Player 1';
    const p2 = match.player2 || 'Player 2';
    const round = match.round ? ` (Round ${match.round})` : '';
    const status = match.status || 'unknown';
    const winner = match.status === 'completed' && match.winner ? ` - Winner: ${match.winner}` : '';
    li.textContent = `${p1} vs ${p2}${round} — ${status}${winner}`;
    container.appendChild(li);
  });
}

function logout() {
  localStorage.clear();
  window.location.href = 'join.html';
}
