const BACKEND_URL = 'https://chess-arena-l9c4.onrender.com';

const playerId = localStorage.getItem('playerId');
const playerName = localStorage.getItem('playerName');
const tournamentId = localStorage.getItem('tournamentId');

if (!playerId || !playerName || !tournamentId) {
  alert('Missing player data. Please join or login again.');
  window.location.href = 'join.html';
}

async function fetchProfile() {
  try {
    // Fetch leaderboard
    const lbRes = await fetch(`${BACKEND_URL}/api/leaderboard/${tournamentId}`);
    if (!lbRes.ok) throw new Error('Leaderboard not found');
    const leaderboard = await lbRes.json();

    const player = leaderboard.find(p =>
      p.name.replace(/ 👑| 🥈| 🥉/g, '').toLowerCase() === playerName.toLowerCase()
    );

    const wins = player?.wins || 0;
    const losses = player?.losses || 0;
    const matchesPlayed = wins + losses;

    // Set summary fields
    document.getElementById('playerName').textContent = playerName;
    document.getElementById('playerId').textContent = playerId;
    document.getElementById('matchesPlayed').textContent = matchesPlayed;
    document.getElementById('totalWins').textContent = wins;
    document.getElementById('totalLosses').textContent = losses;

    // Fetch tournament name
    const tourRes = await fetch(`${BACKEND_URL}/api/tournament/${tournamentId}`);
    const tour = await tourRes.json();
    document.getElementById('tournamentName').textContent = tour?.tournamentName || 'Unknown';

    await fetchMatches();
  } catch (err) {
    console.error('❌ Error loading profile:', err.message);
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

    const [live, upcoming, past] = await Promise.all([
      liveRes.json(),
      upcomingRes.json(),
      pastRes.json()
    ]);

    const nameLower = playerName.toLowerCase();

    const filterMatches = matches =>
      matches.filter(
        m =>
          m.player1?.toLowerCase() === nameLower ||
          m.player2?.toLowerCase() === nameLower
      );

    renderMatchList('ongoingMatch', filterMatches(live));
    renderMatchList('upcomingMatches', filterMatches(upcoming));
    renderMatchList('matchHistory', filterMatches(past));
  } catch (err) {
    console.error('⚠️ Error fetching matches:', err.message);
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
    const round = match.round ? ` (Round: ${match.round})` : '';
    const winner = match.status === 'completed' && match.winner ? ` - Winner: ${match.winner}` : '';
    li.textContent = `${p1} vs ${p2}${round} — ${match.status}${winner}`;
    container.appendChild(li);
  });
}

function logout() {
  localStorage.clear();
  window.location.href = 'join.html';
}

fetchProfile();
