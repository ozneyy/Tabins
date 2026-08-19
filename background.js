// background.js - Gestion des tâches de fond
self.importScripts('config.js'); // Pour accéder à CONFIG

async function checkStartupCleanup() {
    console.log("🔍 Vérification du nettoyage au démarrage...");
    const data = await chrome.storage.local.get(['tabins_user_id', 'cleanup_rule']);
    const userId = data.tabins_user_id;
    const rule = data.cleanup_rule;

    if (userId && rule === 'startup') {
        // Fallback si session storage n'est pas supporté par Helium
        if (!chrome.storage || !chrome.storage.session) {
            console.log("⚠️ Session Storage non supporté. Nettoyage forcé.");
            await performCleanup(userId);
            return;
        }

        const session = await chrome.storage.session.get(['cleanup_done']);
        if (!session.cleanup_done) {
            await performCleanup(userId);
        } else {
            console.log("ℹ️ Nettoyage déjà effectué pour cette session.");
        }
    } else {
        console.log("ℹ️ Règle actuelle :", rule || "aucune");
    }
}

async function performCleanup(userId) {
    console.log("🚀 Nettoyage en cours pour :", userId);
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/tabs?user_id=${userId}&keep_favorites=true`, {
            method: 'DELETE'
        });

        if (response.ok) {
            if (chrome.storage.session) {
                await chrome.storage.session.set({ cleanup_done: true });
            }
            console.log("✅ Nettoyage réussi.");
        } else {
            console.error("❌ Erreur API Worker :", response.status);
        }
    } catch (error) {
        console.error("❌ Erreur réseau :", error);
    }
}

// Se déclenche au démarrage officiel du navigateur
chrome.runtime.onStartup.addListener(checkStartupCleanup);

// Se déclenche aussi au réveil du Service Worker pour plus de fiabilité
checkStartupCleanup();

console.log("Service Worker Tabin's prêt !");