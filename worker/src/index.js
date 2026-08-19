// Cloudflare Worker API pour Tabin's avec D1 (SQLite)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Prefer',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    // Gestion preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const searchParams = url.searchParams;

    // Normalisation des routes (/api/tabs ou compatibilité /rest/v1/synced_tabs)
    const isTabsEndpoint = path === '/api/tabs' || path === '/rest/v1/synced_tabs' || path.startsWith('/api/tabs/');

    if (!isTabsEndpoint) {
      if (path === '/' || path === '/health') {
        return jsonResponse({ status: 'ok', service: "Tabin's Cloudflare Worker API" });
      }
      return jsonResponse({ error: 'Not Found' }, 404);
    }

    try {
      const db = env.DB;
      if (!db) {
        return jsonResponse({ error: 'Database binding DB non configurée dans wrangler.toml' }, 500);
      }

      // GET /api/tabs?user_id=...
      if (request.method === 'GET') {
        let userId = searchParams.get('user_id');
        // Support syntaxe Supabase ?user_id=eq.XXX
        if (userId && userId.startsWith('eq.')) {
          userId = userId.replace('eq.', '');
        }

        if (!userId) {
          return jsonResponse({ error: 'Paramètre user_id manquant' }, 400);
        }

        const { results } = await db
          .prepare('SELECT id, user_id, url, is_favorite, created_at FROM synced_tabs WHERE user_id = ? ORDER BY is_favorite DESC, created_at DESC')
          .bind(userId)
          .all();

        // Convertir is_favorite en booléen JS pour compatibilité
        const formatted = (results || []).map(row => ({
          ...row,
          is_favorite: Boolean(row.is_favorite),
        }));

        return jsonResponse(formatted);
      }

      // POST /api/tabs (Ajout d'un onglet)
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const userId = body.user_id;
        const targetUrl = body.url;

        if (!userId || !targetUrl) {
          return jsonResponse({ error: 'user_id et url sont requis' }, 400);
        }

        const id = crypto.randomUUID();
        const isFavorite = body.is_favorite ? 1 : 0;
        const now = new Date().toISOString();

        await db
          .prepare('INSERT INTO synced_tabs (id, user_id, url, is_favorite, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(id, userId, targetUrl, isFavorite, now)
          .run();

        return jsonResponse({
          id,
          user_id: userId,
          url: targetUrl,
          is_favorite: Boolean(isFavorite),
          created_at: now,
        }, 201);
      }

      // PATCH /api/tabs/:id ou /api/tabs (Mise à jour favori)
      if (request.method === 'PATCH') {
        let tabId = path.startsWith('/api/tabs/') ? path.replace('/api/tabs/', '') : null;
        let idParam = searchParams.get('id');
        if (idParam && idParam.startsWith('eq.')) idParam = idParam.replace('eq.', '');
        tabId = tabId || idParam;

        const body = await request.json().catch(() => ({}));
        let userId = searchParams.get('user_id') || body.user_id;
        if (userId && userId.startsWith('eq.')) userId = userId.replace('eq.', '');

        const isFavorite = body.is_favorite ? 1 : 0;

        if (!tabId) {
          return jsonResponse({ error: 'id manquant pour la mise à jour' }, 400);
        }

        let query = 'UPDATE synced_tabs SET is_favorite = ? WHERE id = ?';
        let bindings = [isFavorite, tabId];

        if (userId) {
          query += ' AND user_id = ?';
          bindings.push(userId);
        }

        await db.prepare(query).bind(...bindings).run();

        return jsonResponse({ success: true, id: tabId, is_favorite: Boolean(isFavorite) });
      }

      // DELETE /api/tabs/:id ou /api/tabs?user_id=...
      if (request.method === 'DELETE') {
        let tabId = path.startsWith('/api/tabs/') ? path.replace('/api/tabs/', '') : null;
        let idParam = searchParams.get('id');
        if (idParam && idParam.startsWith('eq.')) idParam = idParam.replace('eq.', '');
        tabId = tabId || idParam;

        let userId = searchParams.get('user_id');
        if (userId && userId.startsWith('eq.')) userId = userId.replace('eq.', '');

        let isFavParam = searchParams.get('is_favorite') || searchParams.get('keep_favorites');
        let keepFavorites = isFavParam === 'eq.false' || isFavParam === 'false' || isFavParam === 'true';

        // Suppression d'un seul onglet par ID
        if (tabId) {
          let query = 'DELETE FROM synced_tabs WHERE id = ?';
          let bindings = [tabId];
          if (userId) {
            query += ' AND user_id = ?';
            bindings.push(userId);
          }
          await db.prepare(query).bind(...bindings).run();
          return jsonResponse({ success: true, deleted: tabId });
        }

        // Nettoyage en masse pour un utilisateur
        if (userId) {
          if (isFavParam === 'eq.false' || isFavParam === 'false' || searchParams.get('keep_favorites') === 'true') {
            // Supprimer uniquement les non-favoris
            await db.prepare('DELETE FROM synced_tabs WHERE user_id = ? AND is_favorite = 0').bind(userId).run();
          } else {
            // Tout supprimer pour cet utilisateur
            await db.prepare('DELETE FROM synced_tabs WHERE user_id = ?').bind(userId).run();
          }
          return jsonResponse({ success: true, cleared: true });
        }

        return jsonResponse({ error: 'Paramètre id ou user_id requis pour DELETE' }, 400);
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    } catch (err) {
      return jsonResponse({ error: err.message || 'Erreur interne' }, 500);
    }
  },
};
