const BACKEND_URL = 'https://chess-arena-l9c4.onrender.com';

// Load from localStorage
const playerId     = localStorage.getItem('playerId');
const playerName   = localStorage.getItem('playerName');
const tournamentId = localStorage.getItem('tournamentId');

// If any key is missing, redirect to join
if (!playerId || !playerName || !tournamentId) {
  console.error('❌ Missing localStorage:', { playerId, playerName, tournamentId });
  return window.location.href = 'join.html';
}

console.log('✅ profile.js init:', { playerId, playerName, tournamentId });

// Entry point
initProfile();

async function initProfile() {
  try {
    await loadLeaderboardAndSummary();
    await renderMatches();
  } catch (err) {
    console.error('❌ INIT PROFILE ERROR:', err);
    alert('Error loading profile data. Please try again later.');
  }
}

// Fetch and display leaderboard summary
async function loadLeaderboardAndSummary() {
  console.log('⚙️ Fetching leaderboard...');
  const res = await fetch(`${BACKEND_URL}/api/leaderboard/${tournamentId}`);
  console.log('Leaderboard HTTP status:', res.status);
  if (!res.ok) throw new Error(`Leaderboard failed: ${res.status}`);
  const data = await res.json();
  console.log('Leaderboard JSON:', data);

  const playerStats = data.find(p =>
    p.playerId === playerId ||
    p.name?.toLowerCase() === playerName.toLowerCase()
  );

  if (!playerStats) throw new Error('Player stats not found in leaderboard');

  const wins = playerStats.wins || 0;
  const losses = playerStats.losses || 0;
  const total = wins + losses;

  // Update UI
  document.getElementById('playerName').textContent    = playerName;
  document.getElementById('playerId').textContent      = playerId;
  document.getElementById('totalWins').textContent     = wins;
  document.getElementById('totalLosses').textContent   = losses;
  document.getElementById('matchesPlayed').textContent = total;

  // Load tournament name
  console.log('⚙️ Fetching tournament info...');
  const tRes = await fetch(`${BACKEND_URL}/api/tournament/${tournamentId}`);
  console.log('Tournament HTTP status:', tRes.status);
  if (!tRes.ok) throw new Error(`Tournament fetch failed: ${tRes.status}`);
  const tour = await tRes.json();
  console.log('Tournament JSON:', tour);
  document.getElementById('tournamentName').textContent = tour.tournamentName || '[Unknown]';
}

// Fetch and show matches
async function renderMatches() {
  console.log('⚙️ Fetching matches for live, upcoming, past');
  const [liveRes, upRes, pastRes] = await Promise.all([
    fetch(`${BACKEND_URL}/api/matches/live/${tournamentId}`),
    fetch(`${BACKEND_URL}/api/matches/upcoming/${tournamentId}`),
    fetch(`${BACKEND_URL}/api/matches/past/${tournamentId}`)
  ]);
  console.log('Live status:', liveRes.status, 'Upcoming:', upRes.status, 'Past:', pastRes.status);

  if (!liveRes.ok || !upRes.ok || !pastRes.ok) {
    throw new Error('Some match endpoint failed');
  }

  const [live, upcoming, past] = await Promise.all([
    liveRes.json(), upRes.json(), pastRes.json()
  ]);
  console.log('🎮 Live:', live, '📅 Upcoming:', upcoming, '🕰 Past:', past);

  const lname = playerName.toLowerCase();
  const filterPlayer = arr => arr.filter(m =>
    (m.player1?.toLowerCase() === lname) || (m.player2?.toLowerCase() === lname)
  );

  renderList('ongoingMatch', filterPlayer(live));
  renderList('upcomingMatches', filterPlayer(upcoming));
  renderList('matchHistory', filterPlayer(past));
}

// Populate a UL element with matches
function renderList(elementId, arr) {
  const ul = document.getElementById(elementId);
  ul.innerHTML = '';  // clear placeholder

  if (!arr.length) {
    ul.innerHTML = '<li>No matches found.</li>';
    return;
  }

  arr.forEach(m => {
    const li = document.createElement('li');
    const p1 = m.player1 || m.player1Name || 'Player 1';
    const p2 = m.player2 || m.player2Name || 'Player 2';
    const rnd = m.round ? ` (Round ${m.round})` : '';
    const stat = m.status || 'unknown';
    const win = (stat === 'completed' && m.winner) ? ` — Winner: ${m.winner}` : '';
    li.textContent = `${p1} vs ${p2}${rnd} — ${stat}${win}`;
    ul.appendChild(li);
  });
}

// Log out and clear
function logout() {
  localStorage.clear();
  window.location.href = 'join.html';
}
