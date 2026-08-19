const listContainer = document.getElementById('list');
const contextMenu = document.getElementById('context-menu');
const ctxFavorite = document.getElementById('ctx-favorite');
const ctxDelete = document.getElementById('ctx-delete');
const ctxCopy = document.getElementById('ctx-copy');
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
    const response = await fetch(`${CONFIG.API_URL}/api/tabs?user_id=${userId}`);
    let tabs = await response.json();

    if (!Array.isArray(tabs)) {
      tabs = [];
    }

    // Application de la règle de nettoyage
    const { cleanup_rule } = await chrome.storage.local.get(['cleanup_rule']);
    if (cleanup_rule && cleanup_rule.startsWith('max-')) {
      const limit = parseInt(cleanup_rule.split('-')[1]);
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
    console.error("Erreur fetchTabs:", error);
    listContainer.innerHTML = '<div class="empty">Erreur de connexion à l\'API</div>';
  }
}

async function clearAllTabs(refresh = true, keepFavorites = false) {
  let url = `${CONFIG.API_URL}/api/tabs?user_id=${userId}`;
  if (keepFavorites) {
    url += `&keep_favorites=true`;
  }

  await fetch(url, {
    method: 'DELETE'
  });
  if (refresh) fetchTabs();
}

// Handler pour le changement de règle
document.getElementById('cleanup-rule').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ cleanup_rule: e.target.value });
});

function renderTabs(tabs) {
  if (tabs.length === 0) {
    listContainer.innerHTML = '<div class="empty">Aucun onglet. Utilisez votre raccourci iPhone avec l\'ID : <b>' + userId + '</b></div>';
    return;
  }

  listContainer.innerHTML = tabs.map(tab => {
    let domain = 'lien';
    try {
      domain = new URL(tab.url).hostname;
    } catch (e) {}

    const isFavorite = Boolean(tab.is_favorite);
    return `
      <a href="${tab.url}" target="_blank" class="tab-card ${isFavorite ? 'favorite' : ''}" data-id="${tab.id}" data-url="${tab.url}">
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
      contextMenu.classList.remove('hidden');

      const menuRect = contextMenu.getBoundingClientRect();
      const margin = 10;

      let top = clientY;
      let left = clientX;

      // Ajustement Horizontal
      if (left + menuRect.width > window.innerWidth - margin) {
        left = window.innerWidth - menuRect.width - margin;
      }
      if (left < margin) left = margin;

      // Ajustement Vertical
      if (top + menuRect.height > window.innerHeight - margin) {
        top = window.innerHeight - menuRect.height - margin;
      }
      if (top < margin) top = margin;

      contextMenu.style.left = `${left}px`;
      contextMenu.style.top = `${top}px`;
    });
  });
}

// Actions du menu contextuel
ctxCopy.addEventListener('click', async () => {
  if (!selectedTabId) return;
  const card = document.querySelector(`.tab-card[data-id="${selectedTabId}"]`);
  const url = card.getAttribute('data-url');

  try {
    await navigator.clipboard.writeText(url);
  } catch (err) {
    console.error('Erreur lors de la copie:', err);
  }

  contextMenu.classList.add('hidden');
});

ctxFavorite.addEventListener('click', async () => {
  if (!selectedTabId) return;
  const card = document.querySelector(`.tab-card[data-id="${selectedTabId}"]`);
  const isCurrentlyFavorite = card.classList.contains('favorite');
  const targetState = !isCurrentlyFavorite;

  try {
    await fetch(`${CONFIG.API_URL}/api/tabs/${selectedTabId}?user_id=${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_favorite: targetState })
    });
  } catch (err) {
    console.error("Erreur favori:", err);
  }

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
  try {
    await fetch(`${CONFIG.API_URL}/api/tabs/${id}?user_id=${userId}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error("Erreur suppression:", err);
  }
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
  setTimeout(() => btn.classList.remove('spinning'), 600);
});

// Initialisation au chargement
init();