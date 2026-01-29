const listContainer = document.getElementById('list');
const contextMenu = document.getElementById('context-menu');
const ctxFavorite = document.getElementById('ctx-favorite');
const ctxDelete = document.getElementById('ctx-delete');
const setupScreen = document.getElementById('setup-screen');
const mainView = document.getElementById('main-view');
const idDisplay = document.getElementById('generated-id');

const settingsView = document.getElementById('settings-view');
const backBtn = document.getElementById('back-btn');
const settingsCurrentId = document.getElementById('settings-current-id');
const resetIdBtn = document.getElementById('reset-id-btn');

let selectedTabId = null;
let userId = null;

// Génère un ID de 6 caractères aléatoires (Lettres + Chiffres)
function generateUserId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // On enlève les caractères ambigus (0, O, I, 1)
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

async function init() {
  // Récupère l'ID via chrome.storage.local
  const data = await chrome.storage.local.get(['tabins_user_id', 'cleanup_rule']);
  userId = data.tabins_user_id;
  const rule = data.cleanup_rule;

  if (userId) {
    // DOUBLE SÉCURITÉ : On vérifie si le nettoyage de session doit être fait ici aussi
    // au cas où le background script aurait été bloqué par le browser/Helium
    if (rule === 'startup') {
      const session = await chrome.storage.session.get(['cleanup_done']);
      if (!session.cleanup_done) {
        console.log("Plan B : Nettoyage de session depuis la popup");
        await clearAllTabs(false, true); // Supprimer non-favoris sans rafraîchir tout de suite
        await chrome.storage.session.set({ cleanup_done: true });
      }
    }
    showMainView();
  } else {
    showSetupScreen();
  }
}

function showSetupScreen() {
  setupScreen.classList.remove('hidden');
  mainView.classList.add('hidden');
  settingsView.classList.add('hidden');
}

function showMainView() {
  setupScreen.classList.add('hidden');
  mainView.classList.remove('hidden');
  settingsView.classList.add('hidden');
  fetchTabs();
}

function showSettingsView() {
  setupScreen.classList.add('hidden');
  mainView.classList.add('hidden');
  settingsView.classList.remove('hidden');
  settingsCurrentId.textContent = userId;

  chrome.storage.local.get(['cleanup_rule']).then(data => {
    if (data.cleanup_rule) {
      document.getElementById('cleanup-rule').value = data.cleanup_rule;
    }
  });
}

document.getElementById('generate-btn').addEventListener('click', async () => {
  const btn = document.getElementById('generate-btn');
  const confirmBtn = document.getElementById('confirm-id-btn');
  const newId = generateUserId();

  idDisplay.textContent = newId;
  btn.classList.add('hidden');
  confirmBtn.classList.remove('hidden');

  userId = newId;
});

document.getElementById('confirm-id-btn').addEventListener('click', async () => {
  const confirmBtn = document.getElementById('confirm-id-btn');
  confirmBtn.textContent = 'Enregistrement...';

  await chrome.storage.local.set({ 'tabins_user_id': userId });

  setTimeout(() => showMainView(), 500);
});

document.getElementById('settings-btn').addEventListener('click', showSettingsView);
backBtn.addEventListener('click', showMainView);

resetIdBtn.addEventListener('click', async () => {
  if (confirm('Réinitialiser votre ID ? Cela vous déconnectera de votre session actuelle.')) {
    await chrome.storage.local.remove('tabins_user_id');
    userId = null;
    idDisplay.textContent = '------';

    // Reset buttons state
    document.getElementById('generate-btn').classList.remove('hidden');
    document.getElementById('confirm-id-btn').classList.add('hidden');
    document.getElementById('generate-btn').textContent = 'Générer mon ID';

    showSetupScreen();
  }
});

async function fetchTabs() {
  try {
    // FILTRE par user_id
    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/synced_tabs?user_id=eq.${userId}&select=*&order=is_favorite.desc,created_at.desc`, {
      headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}` }
    });
    let tabs = await response.json();

    // Application de la règle de nettoyage
    const { cleanup_rule } = await chrome.storage.local.get(['cleanup_rule']);
    if (cleanup_rule && cleanup_rule.startsWith('max-')) {
      const limit = parseInt(cleanup_rule.split('-')[1]);
      // On ne compte que les non-favoris pour la limite si on veut, 
      // ou on supprime les plus anciens non-favoris au delà de la limite totale.
      if (tabs.length > limit) {
        // On récupère uniquement les non-favoris qui dépassent la limite
        const nonFavorites = tabs.filter(t => !t.is_favorite);
        const favoritesCount = tabs.length - nonFavorites.length;

        // On ne peut supprimer que si on a des non-favoris
        if (nonFavorites.length > (limit - favoritesCount)) {
          const toDeleteCount = tabs.length - limit;
          const tabsToDelete = nonFavorites.slice(-toDeleteCount); // Les plus anciens non-favoris

          for (const tab of tabsToDelete) {
            await deleteTab(tab.id, false);
          }
          if (tabsToDelete.length > 0) return fetchTabs();
        }
      }
    } else if (cleanup_rule === 'daily') {
      const { last_cleanup } = await chrome.storage.local.get(['last_cleanup']);
      const now = Date.now();
      if (!last_cleanup || now - last_cleanup > 24 * 60 * 60 * 1000) {
        await clearAllTabs(false, true); // true = keep favorites
        await chrome.storage.local.set({ last_cleanup: now });
        return fetchTabs();
      }
    }

    renderTabs(tabs);
  } catch (error) {
    listContainer.innerHTML = '<div class="empty">Erreur de connexion</div>';
  }
}

async function clearAllTabs(refresh = true, keepFavorites = false) {
  let url = `${CONFIG.SUPABASE_URL}/rest/v1/synced_tabs?user_id=eq.${userId}`;
  if (keepFavorites) {
    url += `&is_favorite=eq.false`;
  }

  await fetch(url, {
    method: 'DELETE',
    headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}` }
  });
  if (refresh) fetchTabs();
}

// Handler pour le changement de règle
document.getElementById('cleanup-rule').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ cleanup_rule: e.target.value });
});

// Dans showSettingsView, charger la règle actuelle
function showSettingsView() {
  setupScreen.classList.add('hidden');
  mainView.classList.add('hidden');
  settingsView.classList.remove('hidden');
  settingsCurrentId.textContent = userId;

  chrome.storage.local.get(['cleanup_rule']).then(data => {
    if (data.cleanup_rule) {
      document.getElementById('cleanup-rule').value = data.cleanup_rule;
    }
  });
}

function renderTabs(tabs) {
  if (tabs.length === 0) {
    listContainer.innerHTML = '<div class="empty">Aucun onglet. Utilisez votre raccourci iPhone avec l\'ID : <b>' + userId + '</b></div>';
    return;
  }

  listContainer.innerHTML = tabs.map(tab => {
    const domain = new URL(tab.url).hostname;
    const isFavorite = tab.is_favorite;
    return `
      <a href="${tab.url}" target="_blank" class="tab-card ${isFavorite ? 'favorite' : ''}" data-id="${tab.id}">
        <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" class="favicon">
        <div class="info">
          <div class="title-row">
            <span class="title">${tab.url}</span>
            ${isFavorite ? '<svg class="fav-icon" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>' : ''}
          </div>
          <span class="domain">${domain}</span>
        </div>
      </a>
    `;
  }).join('');

  // Gestion du clic droit
  document.querySelectorAll('.tab-card').forEach(card => {
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectedTabId = card.getAttribute('data-id');
      const isFavorite = card.classList.contains('favorite');

      // Update menu text
      ctxFavorite.innerHTML = isFavorite ? `
        <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        Retirer des favoris
      ` : `
        <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        Favoris
      `;

      // Positionnement du menu
      const { clientX, clientY } = e;
      contextMenu.style.left = `${clientX}px`;
      contextMenu.style.top = `${clientY}px`;
      contextMenu.classList.remove('hidden');

      // Ajustement si le menu dépasse
      const menuRect = contextMenu.getBoundingClientRect();
      if (clientX + menuRect.width > window.innerWidth) {
        contextMenu.style.left = `${clientX - menuRect.width}px`;
      }
      if (clientY + menuRect.height > window.innerHeight) {
        contextMenu.style.top = `${clientY - menuRect.height}px`;
      }
    });
  });
}

// Actions du menu contextuel
ctxFavorite.addEventListener('click', async () => {
  if (!selectedTabId) return;
  const card = document.querySelector(`.tab-card[data-id="${selectedTabId}"]`);
  const isCurrentlyFavorite = card.classList.contains('favorite');
  const targetState = !isCurrentlyFavorite;

  try {
    await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/synced_tabs?id=eq.${selectedTabId}&user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': CONFIG.SUPABASE_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ is_favorite: targetState })
    });
  } catch (err) { }

  contextMenu.classList.add('hidden');
  fetchTabs();
});

ctxDelete.addEventListener('click', async () => {
  if (!selectedTabId) return;
  if (confirm('Supprimer cet onglet ?')) {
    console.log('Action Suppression:', selectedTabId);
    await deleteTab(selectedTabId);
  }
  contextMenu.classList.add('hidden');
});

// Fermer le menu au clic ailleurs
document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) {
    contextMenu.classList.add('hidden');
  }
});

async function deleteTab(id, refresh = true) {
  await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/synced_tabs?id=eq.${id}&user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}` }
  });
  if (refresh) fetchTabs();
}

document.getElementById('clear-all').addEventListener('click', async () => {
  if (confirm('Vider toute la liste ?')) {
    await clearAllTabs();
  }
});

document.getElementById('refresh').addEventListener('click', () => {
  const btn = document.getElementById('refresh');
  btn.classList.add('spinning');
  fetchTabs();
  // On retire la classe après l'animation (600ms dans le CSS)
  setTimeout(() => btn.classList.remove('spinning'), 600);
});

// Initialisation au chargement
init();