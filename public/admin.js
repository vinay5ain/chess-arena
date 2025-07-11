// ✅ Set your deployed backend URL
const BASE_URL = 'https://chess-arena-l9c4.onrender.com';
const tournamentId = localStorage.getItem('tournamentId');

if (!tournamentId) {
  alert('Please login first.');
  window.location.href = 'create.html';
} else {
  loadLeaderboard();
  switchTab('live', { target: document.querySelector('.tabs button:nth-child(1)') });
}

// ✅ Disable round input if already set
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/tournament/${tournamentId}`);
    const tournament = await res.json();
    const input = document.getElementById('rounds');
    if (tournament.rounds) {
      input.value = tournament.rounds;
      input.disabled = true;
      input.nextElementSibling.disabled = true;
    }
  } catch (err) {
    console.error('Error loading tournament:', err);
  }
});

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
      if (!m.round) {
        roundDisplay = ' (Round: N/A)';
      } else if (m.round === 'knockout') {
        roundDisplay = ' 🔴 Knockout Round';
      } else if (m.round === 'final') {
        roundDisplay = ' 👑 Final Round';
      } else {
        roundDisplay = ` (Round: ${String(m.round).toUpperCase()})`;
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
  const input = document.getElementById('rounds');
  const rounds = parseInt(input.value);
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
    input.disabled = true;
    input.nextElementSibling.disabled = true;
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
    alert(data.message || '✅ Auto matches created.');
    switchTab('live', { target: document.querySelector('.tabs button:nth-child(1)') });
    loadLeaderboard();
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
    const res = await fetch(`${BASE_URL}/api/player/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, playerName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    alert(`✅ Player added\nName: ${data.name}\nPlayer ID: ${data.playerId}`);
    document.getElementById('newPlayerName').value = '';
    loadLeaderboard();
  } catch (err) {
    alert('Add player failed: ' + err.message);
  }
}
