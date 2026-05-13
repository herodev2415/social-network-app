# Social Connect Platform V2 PRO

Plateforme réseau social moderne avec React 18, TypeScript, Vite, Tailwind CSS, composants UI style shadcn, Supabase Auth/PostgreSQL/Storage/Realtime.

## Contenu du ZIP

- Frontend complet dans `src/`
- Pages : connexion, inscription, feed, profil, messages, notifications, recherche, paramètres, groupes, appels
- Composants : Navbar, MainLayout, PostCard, CreatePostForm, CommentSection, StoryItem, RouteGuard, PasswordInput
- Backend Supabase :
  - `supabase/schema.sql`
  - `supabase/rls.sql`
  - `supabase/realtime.sql`
  - `supabase/seed.sql`

## Installation frontend

```bash
npm install
cp .env.example .env
npm run dev
```

Dans `.env`, ajoute :

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Installation Supabase

1. Crée un projet sur Supabase.
2. Va dans **SQL Editor**.
3. Exécute dans cet ordre :
   - `supabase/schema.sql`
   - `supabase/rls.sql`
   - `supabase/realtime.sql`

## Auth Supabase

Dans Supabase Authentication :
- Active Email/Password.
- Pour test rapide, tu peux désactiver temporairement la confirmation email.
- Le premier utilisateur inscrit devient admin automatiquement.

## Storage

Le script crée le bucket public `media`.
Les images > 1 Mo sont compressées automatiquement côté frontend en WebP qualité 0.8.

## Notes importantes

Cette V2 PRO est une base complète et exploitable. Les fonctions critiques sont connectées à Supabase :
- authentification
- profils
- posts
- likes
- commentaires
- stories
- notifications
- groupes
- messages
- appels historique
- RLS
- realtime

Pour production réelle, ajoute :
- validation avancée côté serveur
- edge functions pour WebRTC/appels
- tests E2E
- modération contenu
- pagination serveur plus avancée


## Correction V2 FIXED

Cette version corrige l'erreur npm :
- suppression de `@radix-ui/react-sheet` car ce package n'existe pas sur npm.
- le composant Sheet shadcn est un composant local basé normalement sur Radix Dialog.
- correction JSX dans `ProfilePage.tsx`.

Commandes propres Windows :

```bash
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```

Si `node_modules` ou `package-lock.json` n'existent pas, ignore simplement l'erreur de suppression.
