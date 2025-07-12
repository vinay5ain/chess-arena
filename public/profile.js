const BACKEND_URL = 'https://chess-arena-l9c4.onrender.com';

const playerId = localStorage.getItem('playerId');
const playerName = localStorage.getItem('playerName');
const tournamentId = localStorage.getItem('tournamentId');

if (!playerId || !playerName || !tournamentId) {
  console.error('❌ Missing localStorage values:', { playerId, playerName, tournamentId });
  window.location.href = 'join.html';
}

console.log('✅ LocalStorage:', { playerId, playerName, tournamentId });

(async function fetchProfile() {
  try {
    // 1. Fetch leaderboard data
    const leaderboardRes = await fetch(`${BACKEND_URL}/api/leaderboard/${tournamentId}`);
    if (!leaderboardRes.ok) throw new Error('Failed to fetch leaderboard');
    const leaderboard = await leaderboardRes.json();
    console.log('🏆 Leaderboard:', leaderboard);

    const player = leaderboard.find(
      p => p.playerId === playerId || (p.name && p.name.toLowerCase() === playerName.toLowerCase())
    );

    if (!player) throw new Error('Player not found in leaderboard');

    const wins = player.wins || 0;
    const losses = player.losses || 0;
    const totalMatches = wins + losses;

    document.getElementById('playerName').textContent = playerName;
    document.getElementById('playerId').textContent = playerId;
    document.getElementById('totalWins').textContent = wins;
    document.getElementById('totalLosses').textContent = losses;
    document.getElementById('matchesPlayed').textContent = totalMatches;

    // 2. Fetch tournament name
    const tourRes = await fetch(`${BACKEND_URL}/api/tournament/${tournamentId}`);
    if (!tourRes.ok) throw new Error('Failed to fetch tournament');
    const tour = await tourRes.json();
    console.log('🏟 Tournament:', tour);
    document.getElementById('tournamentName').textContent = tour.tournamentName || 'Unknown';

    // 3. Fetch matches
    await fetchMatches();
  } catch (err) {
    console.error('❌ Error loading profile:', err.message);
    alert('Error loading profile data. Please try again later.');
  }
})();

async function fetchMatches() {
  try {
    const [liveRes, upcomingRes, pastRes] = await Promise.all([
      fetch(`${BACKEND_URL}/api/matches/live/${tournamentId}`),
      fetch(`${BACKEND_URL}/api/matches/upcoming/${tournamentId}`),
      fetch(`${BACKEND_URL}/api/matches/past/${tournamentId}`)
    ]);

    if (!liveRes.ok || !upcomingRes.ok || !pastRes.ok) throw new Error('Match endpoints failed');

    const [liveMatches, upcomingMatches, pastMatches] = await Promise.all([
      liveRes.json(),
      upcomingRes.json(),
      pastRes.json()
    ]);

    const lowerName = playerName.toLowerCase();

    const filterPlayerMatches = (matches) =>
      matches.filter(m =>
        (m.player1 && m.player1.toLowerCase() === lowerName) ||
        (m.player2 && m.player2.toLowerCase() === lowerName)
      );

    const liveFiltered = filterPlayerMatches(liveMatches);
    const upcomingFiltered = filterPlayerMatches(upcomingMatches);
    const pastFiltered = filterPlayerMatches(pastMatches);

    renderMatchList('ongoingMatch', liveFiltered);
    renderMatchList('upcomingMatches', upcomingFiltered);
    renderMatchList('matchHistory', pastFiltered);
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
    const p1 = match.player1 || match.player1Name || 'Player 1';
    const p2 = match.player2 || match.player2Name || 'Player 2';
    const round = match.round ? ` (Round ${match.round})` : '';
    const status = match.status || 'Pending';
    const winner = match.status === 'completed' && match.winner
      ? ` — Winner: ${match.winner}`
      : '';
    li.textContent = `${p1} vs ${p2}${round} — ${status}${winner}`;
    container.appendChild(li);
  });
}

function logout() {
  localStorage.clear();
  window.location.href = 'join.html';
}
