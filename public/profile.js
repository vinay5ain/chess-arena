const BACKEND_URL = 'https://chess-arena-l9c4.onrender.com';

// 🔐 Get player details from localStorage
const playerId = localStorage.getItem('playerId');
const playerName = localStorage.getItem('playerName');
const tournamentId = localStorage.getItem('tournamentId'); // ✅ Make sure this is set in join/login

if (!playerId || !playerName || !tournamentId) {
  alert("Session expired. Please log in again.");
  window.location.href = 'join.html';
}

async function fetchProfile() {
  try {
    // ✅ Fetch leaderboard from correct admin route
    const leaderboardRes = await fetch(`${BACKEND_URL}/api/admin/leaderboard/${tournamentId}`);
    if (!leaderboardRes.ok) throw new Error('Leaderboard not found');
    const leaderboard = await leaderboardRes.json();

    const player = leaderboard.find(p => p.playerId === playerId || p.name.toLowerCase() === playerName.toLowerCase());
    const wins = player?.wins || 0;
    const losses = player?.losses || 0;
    const totalMatches = wins + losses;

    // Fill Player Summary UI
    document.getElementById('playerName').textContent = playerName;
    document.getElementById('playerId').textContent = playerId;
    document.getElementById('tournamentName').textContent = tournamentId;
    document.getElementById('totalWins').textContent = wins;
    document.getElementById('totalLosses').textContent = losses;
    document.getElementById('matchesPlayed').textContent = totalMatches;

    // ✅ Now fetch matches
    await fetchMatches();
  } catch (err) {
    console.error('❌ Profile fetch error:', err);
    alert('Error loading profile data. Please try again later.');
  }
}

async function fetchMatches() {
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

    const filterMatches = (list) =>
      list.filter(m =>
        m.player1?.toLowerCase() === lowerName || m.player2?.toLowerCase() === lowerName
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
    const winner = match.status === 'completed' && match.winner ? ` - Winner: ${match.winner}` : '';
    li.textContent = `${p1} vs ${p2}${round} — ${match.status}${winner}`;
    container.appendChild(li);
  });
}

function logout() {
  localStorage.clear();
  window.location.href = 'join.html';
}

// 🔃 Start loading
fetchProfile();
