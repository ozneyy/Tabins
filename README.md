# 🚀 Tabin's - Synchronisation d'onglets iOS vers Navigateur

**Tabin's** est une extension pour navigateurs (Chrome, Firefox, etc.) moderne et légère qui vous permet de synchroniser instantanément des onglets depuis votre iPhone vers votre ordinateur, sans compte complexe, grâce à un système d'ID unique à 6 caractères.

![Version](https://img.shields.io/badge/version-1.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Backend](https://img.shields.io/badge/backend-Cloudflare%20D1%20%2B%20Workers-orange.svg)

<p align="left">
  <img src="icons/icon128.png" width="128" alt="Tabin's Logo">
</p>

## ✨ Fonctionnalités

- **📱 Synchronisation iOS rapide** : Envoyez n'importe quelle page web depuis Safari via un Raccourcis iPhone.
- **🔑 Système sans compte** : Utilisez un ID unique de 6 caractères généré localement. Pas d'email, pas de mot de passe.
- **⭐ Favoris** : Marquez vos liens importants. Les favoris sont protégés contre la suppression automatique.
- **🧹 Nettoyage Intelligent** :
    - Limite automatique (5 ou 10 liens).
    - Nettoyage quotidien (toutes les 24h).
    - Nettoyage à chaque démarrage du navigateur.
- **⚡ Backend Serverless 100% Gratuit** : Fonctionne avec Cloudflare Workers + base SQLite D1 (aucune mise en pause de base de données).

---

## 🛠️ Déploiement du Backend (Cloudflare Workers + D1)

Le backend est entièrement serverless et gratuit.

### Prérequis
- [Node.js](https://nodejs.org/) installé.
- Un compte gratuit [Cloudflare](https://dash.cloudflare.com/).

### Étapes de déploiement

1. Ouvrez un terminal dans le dossier `worker/` :
   ```bash
   cd worker
   npm install
   ```

2. Connectez-vous à Cloudflare :
   ```bash
   npx wrangler login
   ```

3. Créez la base de données D1 :
   ```bash
   npx wrangler d1 create tabins-db
   ```
   *Copiez le `database_id` affiché dans la console et collez-le dans `worker/wrangler.toml` à la ligne `database_id = "..."`.*

4. Initialisez la table SQL dans D1 :
   ```bash
   npm run db:init
   ```

5. Déployez le Worker :
   ```bash
   npm run deploy
   ```
   *Notez l'URL générée (ex : `https://tabins-api.<votre-sous-domaine>.workers.dev`).*

6. Renseignez cette URL dans le fichier `config.js` à la racine de l'extension :
   ```javascript
   var CONFIG = {
     API_URL: "https://tabins-api.<votre-sous-domaine>.workers.dev"
   };
   ```

---

## 💻 Installation de l'Extension

### Chrome / Brave / Edge
1. Ouvrez `chrome://extensions/`.
2. Activez le **Mode développeur** (en haut à droite).
3. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier racine du projet.

### Firefox
1. Exécutez le script Python `python build_xpi.py` pour générer `tabins.xpi`.
2. Ouvrez `about:debugging#/runtime/this-firefox` dans Firefox.
3. Cliquez sur **Charger un module temporaire** et sélectionnez `tabins.xpi` ou `manifest.json`.

---

## 📱 Configuration du Raccourci iPhone

Dans l'application **Raccourcis** sur iOS :

1. Créez un raccourci qui reçoit l'entrée **URL de Safari / Partage**.
2. Ajoutez l'action **Obtenir le contenu de l'URL** :
   - **URL** : `https://tabins-api.<votre-sous-domaine>.workers.dev/api/tabs`
   - **Méthode** : `POST`
   - **En-têtes** :
     - `Content-Type` : `application/json`
   - **Corps de la requête** : JSON
     - `user_id` : `VOTRE_ID_6_CARACTERES` (Texte)
     - `url` : `Entrée du raccourci` (URL)

---

## 📜 Licence

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.
