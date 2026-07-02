# Backend Tasklist

## Architecture

Le backend est une API Node.js en TypeScript avec Express. La structure suit une séparation simple par responsabilités : les routes exposent les endpoints, les contrôleurs gèrent la validation et les codes HTTP, et les services encapsulent l’accès Prisma à la base MySQL.

## Prérequis

- Node.js 20
- npm
- Une base MySQL accessible via `DATABASE_URL`
- Prisma CLI et client générés via `npm run prisma:generate`

## Outils

- Express pour l’API HTTP
- Prisma pour l’accès aux données
- Vitest pour les tests unitaires et e2e
- Supertest pour tester les routes HTTP
- Docker pour l’image applicative
- Jenkins pour la CI/CD
- SonarQube pour l’analyse qualité
- Trivy pour le scan de vulnérabilités

## Configuration

Le fichier `.env` n’est pas versionné. Un fichier `.env.example` documente les variables attendues :

- `DATABASE_URL` : chaîne de connexion MySQL utilisée par Prisma
- `PORT` : port d’écoute de l’API, par défaut `3001`

## Jenkins et SonarQube

Le pipeline Jenkins suit l’ordre suivant : checkout, `npm ci`, génération Prisma, tests unitaires avec couverture, tests e2e, build TypeScript, analyse SonarQube, Quality Gate, build Docker, scan Trivy, génération SBOM SPDX, puis push vers Docker Hub.

L’analyse SonarQube s’appuie sur `sonar-project.properties` avec :

- `sonar.sources=src`
- `sonar.tests=src/__tests__`
- exclusion des tests des sources analysées
- `coverage/lcov.info` pour la couverture JavaScript
- `reports/junit.xml` pour les rapports d’exécution des tests

## Docker

L’image Docker est multi-stage :

1. Stage build basé sur `node:20-alpine`
2. `npm ci`
3. `npm run prisma:generate`
4. `npm run build`
5. Stage runtime basé sur `node:20-alpine`
6. `npm ci --omit=dev`
7. exécution sous un utilisateur non-root
8. exposition du port `3001`
9. démarrage via `node dist/server.js`

Le fichier `.dockerignore` réduit le contexte d’image pour éviter d’envoyer les artefacts, les tests et les secrets locaux.

## Lancer en local avec Docker

Le projet inclut un `docker-compose.yml` avec deux services :

- `mysql` (MySQL 8) avec volume nommé pour persister les donnees
- `backend` (build depuis le `Dockerfile`) qui attend que MySQL soit sain avant de demarrer

Le backend applique le schema Prisma au demarrage (`npx prisma db push --accept-data-loss`) puis lance l'API.

Demarrage local :

```bash
docker compose up -d --build
```

Verification rapide :

```bash
docker compose ps
curl http://localhost:3001/api/tasks
```

Si tout est correct, l'appel `GET /api/tasks` renvoie un JSON (souvent `[]` au premier demarrage).

## Stratégie de tests

- Les tests unitaires valident les services et les contrôleurs isolément avec des mocks Prisma et des mocks de service.
- Les tests e2e valident les routes HTTP via Supertest avec une base SQLite dédiée aux tests.
- Les cas couverts incluent le chemin nominal, les erreurs de validation `400`, les ressources absentes `404` et les erreurs internes `500`.

## Stratégie de sécurité

- `.env` reste local et n’est pas suivi par Git
- les identifiants Docker Hub et SonarQube sont injectés par Jenkins
- Trivy bloque le pipeline sur les vulnérabilités `HIGH` et `CRITICAL`
- l’image runtime n’embarque que les dépendances de production

## Génération des livrables

- Couverture unitaire : `npm run test:coverage`
- Couverture e2e : `npm run test:e2e:coverage`
- Build applicatif : `npm run build`
- Image locale : `docker build -t cicd-tasklist-backend .`
- SBOM SPDX : `trivy image --format spdx-json -o sbom-spdx.json <image>`