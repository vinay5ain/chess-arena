const BASE_URL = 'http://localhost:5000';
const tournamentId = localStorage.getItem('tournamentId');

if (!tournamentId) {
  alert('Please login first.');
  window.location.href = 'create.html';
} else {
  loadLeaderboard();
  switchTab('live', { target: document.querySelector('.tabs button:nth-child(1)') });
}

async function loadLeaderboard() {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/leaderboard/${tournamentId}`);
    const data = await res.json();
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    data.forEach((p, i) => {
      tbody.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${p.name}</td>
          <td>${p.playerId}</td>
          <td>${p.wins}</td>
          <td>${p.losses}</td>
          <td>${p.points}</td>
        </tr>`;
    });
  } catch (err) {
    console.error('Leaderboard load error:', err);
  }
}

async function switchTab(tab, event) {
  document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));
  if (event?.target) event.target.classList.add('active');

  const container = document.getElementById('matchContent');
  container.innerHTML = `<div class="match-item">Loading ${tab} matches...</div>`;

  try {
    const res = await fetch(`${BASE_URL}/api/matches/${tab}/${tournamentId}`);
    const matches = await res.json();
    container.innerHTML = '';
    if (matches.length === 0) {
      container.innerHTML = '<div class="match-item">No matches found.</div>';
    }
    for (const m of matches) {
      let roundDisplay = '';
      if (m.round !== undefined && m.round !== null) {
        roundDisplay = ` (Round: ${String(m.round).toUpperCase()})`;
      } else if (tab === 'upcoming') {
        roundDisplay = ` (Round: N/A)`;
      }
      let html = `${m.player1} vs ${m.player2}${roundDisplay} - ${m.status}`;
      if (tab === 'live') {
        html += `
          <br />
          <label>Winner:</label>
          <select id="win-${m._id}">
            <option value="${m.player1}">${m.player1}</option>
            <option value="${m.player2}">${m.player2}</option>
          </select>
          <button onclick="setWinner('${m._id}')">Set Winner</button>`;
      }
      if (tab === 'past' && m.winner) {
        html += `<br /><strong>Winner:</strong> ${m.winner}`;
      }
      container.innerHTML += `<div class="match-item">${html}</div>`;
    }
  } catch (err) {
    container.innerHTML = '<div class="match-item">Error loading matches.</div>';
  }
}

async function setRounds() {
  const rounds = parseInt(document.getElementById('rounds').value);
  if (!rounds || rounds < 1) return alert('Enter valid round number.');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/rounds/${tournamentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rounds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    alert('✅ Rounds set successfully.');
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

async function autoMatchmaking() {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/auto-match/${tournamentId}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    alert('✅ Auto matches created.');
    switchTab('live', { target: document.querySelector('.tabs button:nth-child(1)') });
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

async function manualMatchmaking() {
  const player1 = prompt('Enter Player 1 name');
  const player2 = prompt('Enter Player 2 name');
  const round = parseInt(prompt('Enter Round number'));
  const time = new Date().toISOString();

  try {
    const res = await fetch(`${BASE_URL}/api/admin/manual-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, player1, player2, round, scheduledTime: time })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    alert('✅ Manual match created.');
    switchTab('upcoming', { target: document.querySelector('.tabs button:nth-child(2)') });
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

async function setWinner(matchId) {
  const winner = document.getElementById(`win-${matchId}`).value;
  try {
    const res = await fetch(`${BASE_URL}/api/admin/set-winner/${matchId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    alert('✅ Winner set.');
    switchTab('live', { target: document.querySelector('.tabs button:nth-child(1)') });
    loadLeaderboard();
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

async function disqualifyPlayer() {
  const playerId = document.getElementById('searchPlayer').value.trim();
  if (!playerId) return alert('Enter player ID');
  try {
    await fetch(`${BASE_URL}/api/player/disqualify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId })
    });
    alert('🚫 Player disqualified');
    loadLeaderboard();
  } catch (err) {
    alert('Disqualification failed.');
  }
}

async function removePoints() {
  const playerId = document.getElementById('searchPlayer').value.trim();
  if (!playerId) return alert('Enter player ID');
  try {
    await fetch(`${BASE_URL}/api/player/updatePoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, points: -1 })
    });
    alert('➖ 1 point removed');
    loadLeaderboard();
  } catch (err) {
    alert('Point update failed.');
  }
}

async function addPlayer() {
  const playerName = document.getElementById('newPlayerName').value.trim();
  if (!playerName) return alert('Enter player name');
  try {
    await fetch(`${BASE_URL}/api/player/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, playerName })
    });
    alert('✅ Player added');
    document.getElementById('newPlayerName').value = '';
    loadLeaderboard();
  } catch (err) {
    alert('Add player failed.');
  }
}
