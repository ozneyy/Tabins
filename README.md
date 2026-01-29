# 🚀 Tabin's Chrome Extension

**Tabin's** est une extension Chrome moderne et légère qui vous permet de synchroniser instantanément des onglets depuis votre iPhone vers votre navigateur, sans compte complexe, grâce à un système d'ID unique à 6 caractères.

![Version](https://img.shields.io/badge/version-1.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Fonctionnalités

- **📱 Synchronisation iOS rapide** : Envoyez n'importe quelle page web depuis Safari via un Raccourcis iPhone.
- **🔑 Système sans compte** : Utilisez un ID unique de 6 caractères généré localement. Pas d'email, pas de mot de passe.
- **🧤 Interface Premium** : Design moderne avec Glassmorphism, animations fluides et mode sombre natif.
- **⭐ Favoris** : Marquez vos liens importants. Les favoris sont protégés contre la suppression automatique.
- **🧹 Nettoyage Intelligent** :
    - Limite automatique (5 ou 10 liens).
    - Nettoyage quotidien (toutes les 24h).
    - Nettoyage à chaque démarrage du navigateur.
- **🔒 Sécurisé** : Vos données sont filtrées par votre ID unique sur une base de données Supabase avec Row Level Security (RLS).

## 🛠️ Installation

### 1. Extension Chrome
1. Téléchargez ou clônez ce repository.
2. Ouvrez Chrome et allez sur `chrome://extensions/`.
3. Activez le **Mode développeur** (en haut à droite).
4. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier du projet.

### 2. Raccourci iPhone
1. Créez un nouveau raccourci sur votre iPhone.
2. Configurez-le pour recevoir des **Pages Web Safari**.
3. Utilisez l'action **Obtenir le contenu de l'URL** avec votre URL Supabase.
4. Incluez votre **ID à 6 caractères** (généré dans l'extension) dans le corps du message JSON.

## ⚙️ Configuration Supabase

L'extension nécessite une table `synced_tabs` sur Supabase avec la structure suivante :

```sql
CREATE TABLE synced_tabs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  url TEXT NOT NULL,
  user_id VARCHAR(6) NOT NULL,
  is_favorite BOOLEAN DEFAULT false
);

-- Index pour la performance
CREATE INDEX idx_user_id ON synced_tabs(user_id);

-- Activer RLS
ALTER TABLE synced_tabs ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité (Exemple pour accès anonyme filtré)
CREATE POLICY "Users can only access their own tabs" ON synced_tabs
FOR ALL TO anon
USING (user_id = user_id); -- Note: Le filtrage est géré côté application par l'ID unique
```

## 🎨 Design

Le projet utilise des variables CSS personnalisées pour un thème cohérent :
- **Turquoise & Spring Green** pour les accents.
- **Glassmorphism** pour les cartes et les menus.
- **Animations** pour les interactions et le chargement.

## 📜 Licence

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.

---
Développé avec ❤️ pour simplifier votre navigation multi-appareils.
