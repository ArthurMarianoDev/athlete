# ZoneTrack — PRD

## Original Problem Statement
Construir um app mobile que usa GPS para criar uma zona local de competição para quem faz corrida de rua, ciclismo e caminhada, com ranking, nome e dados da corrida. Front-end dark e moderno, responsivo. (Stack entregue: React Native/Expo + FastAPI + MongoDB.)

## User Choices
- Atividades: Corrida + Ciclismo + Caminhada
- Zonas: automáticas (raio ao redor do usuário) + pré-definidas
- Ranking: por distância total e por ritmo/velocidade
- Auth: Login com Google (Emergent-managed) + e-mail/senha (JWT)
- Tema: dark com verde neon (#00E65C)

## Architecture
- Frontend: Expo Router, tabs (Zonas, Registrar, Ranking, Perfil), react-native-svg para traçado de rota (sem chaves de mapa), expo-location para GPS, @tanstack/react-query, fontes Rajdhani + Manrope.
- Backend: FastAPI `/api`, JWT (bcrypt) + Emergent Google session, MongoDB (motor). Soft-delete em atividades.
- Auth gate único no root layout.

## Personas
- Atleta amador de rua/parque que quer competir localmente e acompanhar seu progresso e posição no ranking do bairro.

## Core Requirements (static)
- Registrar atividade via GPS (distância, tempo, ritmo/velocidade, calorias, rota).
- Zonas de competição locais (auto + pré-definidas), seleção de zona ativa.
- Ranking por zona: distância e ritmo, com filtro por tipo e linha do próprio usuário fixada.
- Perfil com estatísticas agregadas e histórico.

## Implemented (2026-06)
- [x] Auth e-mail/senha (JWT) + Google (Emergent) — register/login/me, gate de navegação
- [x] Zonas: listagem ordenada por distância, criação de zona automática (raio 3km), detalhe da zona
- [x] Registro de atividade ao vivo com expo-location (run/cycle/walk), pausar/retomar/parar, traçado SVG
- [x] Ranking por distância e ritmo, filtro por tipo, linha do usuário fixada
- [x] Perfil: stats agregados, histórico com miniatura de rota, logout
- [x] Detalhe da atividade com grid de métricas e exclusão (soft delete)
- [x] Tema dark verde neon, fontes Rajdhani/Manrope, ícones SVG
- Testado: backend 14/14 pytest, frontend fluxos críticos OK

## Backlog / Next
- P1: Mapa real (react-native-maps) com estilo dark quando gerar build nativo
- P1: Conquistas/medalhas por zona e recordes pessoais (PRs)
- P2: Compartilhar atividade como imagem
- P2: Feed social da zona com curtidas
- P2: Metas semanais de distância

## Next Tasks
- Coletar feedback do usuário sobre o fluxo de registro e ranking.
