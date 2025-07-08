// ✅ Use deployed backend URL instead of localhost
const BACKEND_URL = 'https://chess-arena-l9c4.onrender.com';

const playerId = localStorage.getItem('playerId');
if (!playerId) window.location.href = 'join.html';

let playerName = '';

async function fetchProfile() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/player/profile/${playerId}`);
    const data = await res.json();

    if (!res.ok || !data) {
      alert(data?.message || 'Player not found');
      return;
    }

    playerName = data.name;
    document.getElementById('playerName').textContent = data.name ?? 'Unknown';
    document.getElementById('playerId').textContent = data.playerId ?? 'N/A';

    if (data.tournamentId) {
      const tourRes = await fetch(`${BACKEND_URL}/api/tournament/${data.tournamentId}`);
      const tour = await tourRes.json();
      document.getElementById('tournamentName').textContent = tour.tournamentName ?? 'Unknown';
    }

    fetchMatches();
  } catch (err) {
    console.error('❌ Failed to load profile:', err);
    alert('Error loading profile.');
  }
}

async function fetchMatches() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/matches/player/${playerId}`);
    const data = await res.json();

    if (!res.ok) {
      renderMatchList('ongoingMatch', []);
      renderMatchList('upcomingMatches', []);
      renderMatchList('matchHistory', []);
      return;
    }

    const totalMatches = [...data.ongoing, ...data.upcoming, ...data.history];
    const wins = data.history.filter(m =>
      typeof m.winner === 'string' &&
      typeof playerName === 'string' &&
      m.winner.toLowerCase() === playerName.toLowerCase()
    ).length;
    const losses = data.history.length - wins;

    document.getElementById('matchesPlayed').textContent = totalMatches.length;
    document.getElementById('totalWins').textContent = wins;
    document.getElementById('totalLosses').textContent = losses;

    renderMatchList('ongoingMatch', data.ongoing || []);
    renderMatchList('upcomingMatches', data.upcoming || []);
    renderMatchList('matchHistory', data.history || []);
  } catch (err) {
    console.warn('⚠️ Match API failed or not implemented.');
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
    const p1 = match.player1Name || match.player1 || 'Player 1';
    const p2 = match.player2Name || match.player2 || 'Player 2';
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

fetchProfile();
